// Edge function: process-voice-memo v5 — pipeline 2-step economica
//
// STEP 1: Trascrizione audio -> testo
//   Modello: google/gemini-1.5-flash-8b (audio-capable, ~30x piu' economico di 2.5 Flash)
//
// STEP 2: Strutturazione testo -> JSON report
//   Modello: google/gemini-2.5-flash-lite (text only, il modello default dell'app)
//
// + Auto-delete file audio dal bucket dopo trascrizione completata (GDPR + storage saving)
// + Calcolo cost_eur preciso sui 2 modelli
//
// Risparmio atteso: ~96% rispetto alla versione monolitica 2.5 Flash
// (€0.07 -> €0.004 per audio di 30 min)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STEP1_MODEL = 'google/gemini-2.5-flash';     // trascrizione audio
const STEP2_MODEL = 'google/gemini-2.5-flash-lite';   // strutturazione testo
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const BUCKET = 'voice_memos';

// Pricing in USD per Milione di token (al 15/5/2026 via OpenRouter)
const PRICE = {
    step1_input: 0.10,  // Flash 8B input (audio token uguali)
    step1_output: 0.40,   // Flash 8B output text
    step2_input: 0.10,    // Flash Lite input text
    step2_output: 0.40,   // Flash Lite output text
};
const USD_TO_EUR = 0.93;

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

        const { data: job, error: jobErr } = await admin
            .from('pm_ai_report_jobs')
            .select('id, audio_url, status, space_ref, item_ref')
            .eq('id', job_id)
            .single();

        if (jobErr || !job) return jsonResp({ error: 'job not found', detail: jobErr?.message }, 404);
        if (job.status === 'completed') return jsonResp({ ok: true, already_done: true, job_id });

        await admin
            .from('pm_ai_report_jobs')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', job_id);

        // ────── Download audio ──────
        const audioResp = await fetch(job.audio_url);
        if (!audioResp.ok) {
            await markFailed(admin, job_id, 'Audio download failed: ' + audioResp.status);
            return jsonResp({ error: 'audio download failed' }, 500);
        }
        const audioBlob = await audioResp.arrayBuffer();
        const audioSizeMB = audioBlob.byteLength / (1024 * 1024);
        if (audioSizeMB > 50) {
            await markFailed(admin, job_id, 'Audio troppo grande (' + audioSizeMB.toFixed(1) + 'MB max 50MB)');
            return jsonResp({ error: 'audio too large' }, 413);
        }
        const audioBase64 = arrayBufferToBase64(audioBlob);
        const audioFormat = detectAudioFormat(job.audio_url);

        // ────── STEP 1: Trascrizione (audio -> testo) ──────
        const step1Prompt = "Trascrivi questo memo vocale in italiano. Fedelmente, parola per parola. Punteggiatura naturale. Niente commenti tuoi, niente intro, niente saluti. Solo la trascrizione.";

        const step1Resp = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: openRouterHeaders(openrouterKey),
            body: JSON.stringify({
                model: STEP1_MODEL,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'input_audio', input_audio: { data: audioBase64, format: audioFormat } },
                        { type: 'text', text: step1Prompt },
                    ],
                }],
                temperature: 0.2,
                max_tokens: 8000,
            }),
        });

        if (!step1Resp.ok) {
            const errText = await step1Resp.text();
            await markFailed(admin, job_id, 'Step1 (trascrizione) error ' + step1Resp.status + ': ' + errText.slice(0, 500));
            return jsonResp({ error: 'transcription failed', status: step1Resp.status, detail: errText.slice(0, 500) }, 500);
        }

        const step1Json = await step1Resp.json();
        const transcription = step1Json?.choices?.[0]?.message?.content;
        if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 10) {
            await markFailed(admin, job_id, 'Trascrizione vuota o troppo corta');
            return jsonResp({ error: 'empty transcription' }, 500);
        }

        const step1Usage = step1Json?.usage || {};
        const step1InTok = step1Usage.prompt_tokens || 0;
        const step1OutTok = step1Usage.completion_tokens || 0;

        // ────── STEP 2: Strutturazione (testo -> JSON report) ──────
        const step2Prompt = "Analizza questa trascrizione di un memo vocale di un'agenzia di comunicazione italiana (Gleeye).\n\n" +
            "TRASCRIZIONE:\n```\n" + transcription + "\n```\n\n" +
            "Produci un report strutturato in italiano. OUTPUT JSON ESATTO:\n" +
            "{\n" +
            "  \"summary\": \"riassunto 3-5 frasi del contenuto principale\",\n" +
            "  \"report_markdown\": \"report strutturato in markdown con sezioni: ## Contesto, ## Punti chiave, ## Decisioni, ## Azioni successive. Italiano professionale.\",\n" +
            "  \"action_items\": [\n" +
            "    { \"text\": \"task in imperativo\", \"assignee_hint\": \"nome se menzionato o null\", \"due_hint\": \"scadenza naturale se menzionata o null\", \"priority\": \"alta|media|bassa\" }\n" +
            "  ]\n" +
            "}\n\n" +
            "Regole:\n" +
            "- action_items: SOLO compiti concreti menzionati, non inventare\n" +
            "- Niente saluti, niente firme, niente 'ecco il report'\n" +
            "- Rispondi SOLO con JSON valido, nessun testo prima/dopo, nessun blocco markdown";

        const step2Resp = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: openRouterHeaders(openrouterKey),
            body: JSON.stringify({
                model: STEP2_MODEL,
                messages: [{ role: 'user', content: step2Prompt }],
                temperature: 0.3,
                max_tokens: 4000,
                response_format: { type: 'json_object' },
            }),
        });

        if (!step2Resp.ok) {
            const errText = await step2Resp.text();
            await markFailed(admin, job_id, 'Step2 (strutturazione) error ' + step2Resp.status + ': ' + errText.slice(0, 500));
            return jsonResp({ error: 'structuring failed', status: step2Resp.status, detail: errText.slice(0, 500) }, 500);
        }

        const step2Json = await step2Resp.json();
        const step2Content = step2Json?.choices?.[0]?.message?.content;
        const step2Usage = step2Json?.usage || {};
        const step2InTok = step2Usage.prompt_tokens || 0;
        const step2OutTok = step2Usage.completion_tokens || 0;

        // ────── Parse JSON robusto + rescue ──────
        const contentStr = typeof step2Content === 'string' ? step2Content : JSON.stringify(step2Content);
        let parsed: any = null;

        try { parsed = JSON.parse(contentStr); } catch { /* */ }
        if (!parsed) {
            const m = contentStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (m) { try { parsed = JSON.parse(m[1].trim()); } catch { /* */ } }
        }
        if (!parsed) {
            const f = contentStr.indexOf('{');
            const l = contentStr.lastIndexOf('}');
            if (f !== -1 && l > f) {
                try { parsed = JSON.parse(contentStr.slice(f, l + 1)); } catch { /* */ }
            }
        }

        // ────── Calcolo costo ──────
        const totalUsd =
            (step1InTok * PRICE.step1_input + step1OutTok * PRICE.step1_output) / 1_000_000 +
            (step2InTok * PRICE.step2_input + step2OutTok * PRICE.step2_output) / 1_000_000;
        const totalEur = totalUsd * USD_TO_EUR;
        const totalTokens = step1InTok + step1OutTok + step2InTok + step2OutTok;

        // ────── Salvataggio risultato ──────
        const reportMd = parsed?.report_markdown || transcription;
        const summary = parsed?.summary || '(strutturazione fallita, salvata trascrizione grezza)';
        const actionItems = Array.isArray(parsed?.action_items) ? parsed.action_items : [];

        await admin
            .from('pm_ai_report_jobs')
            .update({
                status: 'completed',
                transcription,
                summary,
                report_markdown: reportMd,
                action_items: actionItems,
                tokens_used: totalTokens,
                cost_eur: totalEur,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                error_message: parsed ? null : 'step2 parse fallito, salvato fallback',
            })
            .eq('id', job_id);

        // ────── Auto-delete file audio dal bucket (GDPR + storage) ──────
        const audioPath = extractStoragePath(job.audio_url, BUCKET);
        let audioDeleted = false;
        if (audioPath) {
            const { error: delErr } = await admin.storage.from(BUCKET).remove([audioPath]);
            if (!delErr) audioDeleted = true;
            else console.warn('[process-voice-memo] audio delete failed:', delErr.message);
        }

        return jsonResp({
            ok: true,
            job_id,
            pipeline: '2-step',
            step1_tokens: step1InTok + step1OutTok,
            step2_tokens: step2InTok + step2OutTok,
            total_tokens: totalTokens,
            cost_eur: totalEur,
            cost_usd: totalUsd,
            audio_deleted: audioDeleted,
            transcription_length: transcription.length,
            action_items_count: actionItems.length,
        });
    } catch (err: any) {
        console.error('[process-voice-memo] fatal', err);
        if (job_id) await markFailed(admin, job_id, String(err?.message || err));
        return jsonResp({ error: 'internal error', detail: String(err?.message || err) }, 500);
    }
});

function openRouterHeaders(key: string) {
    return {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://workspace.gleeye.eu',
        'X-Title': 'Gleeye ERP - Voice Memo Reports',
    };
}

async function markFailed(admin: any, jobId: string, reason: string) {
    try {
        await admin
            .from('pm_ai_report_jobs')
            .update({ status: 'failed', error_message: reason, updated_at: new Date().toISOString() })
            .eq('id', jobId);
    } catch (e) { console.error('[process-voice-memo] markFailed error', e); }
}

function detectAudioFormat(url: string): string {
    const lower = url.toLowerCase().split('?')[0];
    if (lower.endsWith('.m4a')) return 'mp3';
    if (lower.endsWith('.mp3')) return 'mp3';
    if (lower.endsWith('.wav')) return 'wav';
    if (lower.endsWith('.ogg')) return 'ogg';
    if (lower.endsWith('.flac')) return 'flac';
    if (lower.endsWith('.webm')) return 'webm';
    return 'mp3';
}

// Estrae il path interno al bucket dall'URL pubblico.
// URL: https://xxx.supabase.co/storage/v1/object/public/voice_memos/UUID/filename.m4a
// Path: UUID/filename.m4a
function extractStoragePath(publicUrl: string, bucket: string): string | null {
    try {
        const marker = '/public/' + bucket + '/';
        const idx = publicUrl.indexOf(marker);
        if (idx === -1) return null;
        return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
    } catch {
        return null;
    }
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
