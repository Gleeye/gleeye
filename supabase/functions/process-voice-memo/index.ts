// Edge function: process-voice-memo
// Reportistica AI Filone 3A: voice memo → trascrizione + report strutturato.
//
// Pipeline:
//   1. Riceve { job_id } in POST body
//   2. Mark job as 'processing'
//   3. Download audio dal bucket voice_memos (base64)
//   4. Chiama Gemini 2.5 Flash (audio understanding) via OpenRouter
//   5. Parse output JSON: transcription, summary, report_markdown, action_items
//   6. Update job: status='completed' + popola fields + completed_at
//   7. Su errore: status='failed' + error_message
//
// Modello: google/gemini-2.5-flash (NON Lite — Flash Lite audio è meno affidabile).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'google/gemini-2.5-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!supabaseUrl || !serviceKey) return jsonResp({ error: 'supabase env missing' }, 500);
    if (!openrouterKey) return jsonResp({ error: 'OPENROUTER_API_KEY missing' }, 500);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let job_id: string | null = null;
    try {
        const body = await req.json().catch(() => ({}));
        job_id = body?.job_id || null;
        if (!job_id) return jsonResp({ error: 'job_id required' }, 400);

        // 1. Carica il job
        const { data: job, error: jobErr } = await admin
            .from('pm_ai_report_jobs')
            .select('id, audio_url, status, space_ref, item_ref')
            .eq('id', job_id)
            .single();

        if (jobErr || !job) return jsonResp({ error: 'job not found', detail: jobErr?.message }, 404);
        if (job.status === 'completed') return jsonResp({ ok: true, already_done: true, job_id });

        // 2. Mark processing
        await admin
            .from('pm_ai_report_jobs')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', job_id);

        // 3. Download audio (URL pubblico bucket voice_memos)
        const audioResp = await fetch(job.audio_url);
        if (!audioResp.ok) {
            await markFailed(admin, job_id, `Audio download failed: ${audioResp.status}`);
            return jsonResp({ error: 'audio download failed' }, 500);
        }
        const audioBlob = await audioResp.arrayBuffer();
        const audioSizeMB = audioBlob.byteLength / (1024 * 1024);
        if (audioSizeMB > 50) {
            await markFailed(admin, job_id, `Audio troppo grande (${audioSizeMB.toFixed(1)}MB max 50MB)`);
            return jsonResp({ error: 'audio too large' }, 413);
        }
        const audioBase64 = arrayBufferToBase64(audioBlob);
        const audioFormat = detectAudioFormat(job.audio_url);

        // 4. Chiama Gemini via OpenRouter con audio input
        const prompt = `Sei un assistente di un'agenzia di comunicazione italiana (Gleeye).
Riceverai un memo vocale registrato durante o dopo una riunione/lavoro.
Devi produrre un report strutturato in italiano.

OUTPUT FORMATO JSON ESATTO:
{
  "transcription": "trascrizione completa parola per parola, italiano corretto, niente commenti",
  "summary": "riassunto in 3-5 frasi del contenuto principale",
  "report_markdown": "report strutturato in markdown con sezioni: ## Contesto, ## Punti chiave, ## Decisioni, ## Azioni successive. Italiano professionale.",
  "action_items": [
    { "text": "descrizione task in imperativo", "assignee_hint": "nome se menzionato o null", "due_hint": "scadenza naturale se menzionata o null", "priority": "alta|media|bassa" }
  ]
}

Linee guida:
- Trascrizione: fedele all'audio, correggi solo punteggiatura ovvia
- Action items: SOLO compiti concreti menzionati, non inventare
- Niente saluti, niente firme, niente "ecco il report"
- Se l'audio non è chiaro, indica nel summary "audio difficile da comprendere"`;

        const orResp = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openrouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://workspace.gleeye.eu',
                'X-Title': 'Gleeye ERP - Voice Memo Reports',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'input_audio', input_audio: { data: audioBase64, format: audioFormat } },
                            { type: 'text', text: prompt },
                        ],
                    },
                ],
                temperature: 0.3,
                max_tokens: 4000,
                response_format: { type: 'json_object' },
            }),
        });

        if (!orResp.ok) {
            const errText = await orResp.text();
            await markFailed(admin, job_id, `OpenRouter error ${orResp.status}: ${errText.slice(0, 500)}`);
            return jsonResp({ error: 'AI call failed', status: orResp.status, detail: errText.slice(0, 500) }, 500);
        }

        const orJson = await orResp.json();
        const content = orJson?.choices?.[0]?.message?.content;
        if (!content) {
            await markFailed(admin, job_id, 'AI response vuota');
            return jsonResp({ error: 'empty AI response' }, 500);
        }

        // 5. Parse JSON
        let parsed: any;
        try {
            parsed = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (e) {
            // Fallback: estrae JSON da blocco markdown se l'AI ha avvolto
            const match = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (match) {
                try { parsed = JSON.parse(match[1]); } catch { /* keep null */ }
            }
        }

        if (!parsed || !parsed.transcription) {
            await markFailed(admin, job_id, 'AI output non parseabile');
            return jsonResp({ error: 'unparseable AI output', raw: content.slice(0, 500) }, 500);
        }

        // 6. Calcola costo stimato (Gemini 2.5 Flash: ~$0.075/M input, $0.30/M output)
        const usage = orJson?.usage || {};
        const inputTok = usage.prompt_tokens || 0;
        const outputTok = usage.completion_tokens || 0;
        const totalTok = inputTok + outputTok;
        const costUsd = (inputTok * 0.075 + outputTok * 0.30) / 1_000_000;
        const costEur = costUsd * 0.93; // FX approssimativo

        // 7. Update job
        await admin
            .from('pm_ai_report_jobs')
            .update({
                status: 'completed',
                transcription: parsed.transcription,
                summary: parsed.summary || '',
                report_markdown: parsed.report_markdown || '',
                action_items: parsed.action_items || [],
                tokens_used: totalTok,
                cost_eur: costEur,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', job_id);

        return jsonResp({
            ok: true,
            job_id,
            tokens_used: totalTok,
            cost_eur: costEur,
            action_items_count: (parsed.action_items || []).length,
        });
    } catch (err: any) {
        console.error('[process-voice-memo] fatal', err);
        if (job_id) await markFailed(admin, job_id, String(err?.message || err));
        return jsonResp({ error: 'internal error', detail: String(err?.message || err) }, 500);
    }
});

async function markFailed(admin: any, jobId: string, reason: string) {
    try {
        await admin
            .from('pm_ai_report_jobs')
            .update({
                status: 'failed',
                error_message: reason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);
    } catch (e) {
        console.error('[process-voice-memo] markFailed error', e);
    }
}

function detectAudioFormat(url: string): string {
    const lower = url.toLowerCase().split('?')[0];
    if (lower.endsWith('.m4a')) return 'mp3'; // Gemini accetta m4a come mp3 family
    if (lower.endsWith('.mp3')) return 'mp3';
    if (lower.endsWith('.wav')) return 'wav';
    if (lower.endsWith('.ogg')) return 'ogg';
    if (lower.endsWith('.flac')) return 'flac';
    if (lower.endsWith('.webm')) return 'webm';
    return 'mp3'; // default fallback
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
}

function jsonResp(obj: any, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
