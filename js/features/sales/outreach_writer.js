/**
 * sales/outreach_writer.js
 * Outreach Writer Agent: genera template di messaggio per ogni step di una sequenza outreach.
 *
 * Input:
 * - step: { channel, step_type, step_number, delay_days }
 * - niche: contesto nicchia (nome, pain_points, niche_language, geo_scope)
 * - sap: contesto SAP target (name, value_proposition, target_customer, process_blueprint)
 * - prospect (opzionale): per personalizzazione vera (se generiamo per un prospect specifico)
 * - tone: professionale / diretto / creativo / amichevole
 * - previousMessage (opzionale): per coerenza follow-up con messaggio precedente
 *
 * Output schema dipende dal channel:
 * - email: { subject, body, length_words }
 * - dm_linkedin/dm_instagram/whatsapp: { body, length_words }
 * - loom: { loom_script, email_subject, email_body }
 * - cold_call: { script, opening_line }
 *
 * Modello: AI_MODELS.sales_drafter (Gemini Flash Lite).
 * Metodologia: Bani + Parozzi.
 *  - email max 150 parole, CTA morbida (vendi il MEETING non il servizio)
 *  - initial: pain + valore + CTA call
 *  - followup_light: 2-3 righe brevi
 *  - followup_value: caso studio o insight, no soldi
 *  - followup_gif: tono leggero + meme/GIF
 *  - final_close: chiusura definitiva ("ultimo messaggio")
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';

const MODEL = AI_MODELS.sales_drafter;

const STEP_TYPE_GUIDES = {
    initial: {
        label: 'Primo contatto',
        guide: 'Personalizzazione vera (dettaglio specifico azienda + pain della nicchia) + caso studio breve + CTA morbida ("15 minuti questa settimana?"). NO mai vendere il servizio, vendi la CALL. Max 150 parole.',
    },
    followup_light: {
        label: 'Follow-up leggero',
        guide: '2-3 righe massimo. "Hey [Nome], non so se hai visto il messaggio di [N] giorni fa. Capisco se non è il momento giusto — fammi solo sapere così non ti disturbo più." Nessuna nuova proposta, solo gentile bump.',
    },
    followup_value: {
        label: 'Follow-up con valore',
        guide: 'Condividi un caso studio breve, un insight specifico della nicchia, o un mini-tip applicabile. NO ancora vendita. Costruisci autorità. CTA molto soft (es. "Se utile parliamone").',
    },
    followup_gif: {
        label: 'Follow-up con GIF/meme',
        guide: 'Tono leggero, rompe il ghiaccio. Esempio: "Ancora qui ad aspettare 🦗" + GIF suggerita (cane che dorme, sasso che rotola). Frase breve poi spunto: "Hai 5 min questa settimana?". Genera solo testo + suggerimento GIF.',
    },
    final_close: {
        label: 'Chiusura definitiva',
        guide: '"Ultimo messaggio da parte mia — se mai cambierà qualcosa, sono qui." Tono onesto, no manipolazione. Lascia porta aperta per il futuro ma chiudi questa sequenza.',
    },
};

const CHANNEL_GUIDES = {
    email: 'Email professionale ma diretta. Oggetto < 60 char. Saluto + corpo + CTA + firma "[Nome] - Gleeye". Personalizzato con il nome dell\'azienda. Suggerimento oggetto: domanda o curiosità, NON "agenzia comunicazione".',
    dm_linkedin: 'DM LinkedIn: max 70 parole. Tono professionale ma colloquiale. NO link nel primo messaggio (li flagga lo spam filter). CTA: "ne parliamo?".',
    dm_instagram: 'DM Instagram: max 50 parole. Tono amichevole, casual. Si può iniziare con riferimento al loro contenuto recente.',
    whatsapp: 'WhatsApp: max 60 parole, conversazionale. NO essere troppo formale. Subito al sodo.',
    loom: 'Video Loom 3-6 minuti: script che mostra il sito/profilo del prospect a schermo, con la faccia del mittente in un cerchio. Struttura: 1) "Sono [Nome], ho visto [X]" 2) "Lavoro con [nicchia] li aiuto con [risultato]" 3) "Quando ho visto il tuo [Y] ho avuto un\'idea per [risultato]" 4) Demo idea sullo schermo 5) Caso studio breve 6) CTA: "Se ha senso, una chiacchierata di 15 min?". Email wrapper: oggetto "Piccola sorpresa per te [Nome]" o "[X] idee per [pain specifico]" + 2 righe + embed GIF Loom.',
    cold_call: 'Cold call script: opening line di 7-10 sec che ferma l\'occhiata mentale ("Sono [Nome], non so se ha 30 secondi — sto chiamando le strutture turistiche liguri per [problema]"). Poi 2-3 frasi gancio + CTA: "Si scaldo i numeri 2 minuti questa settimana?". MAI presentarsi come "agenzia" — bruciato.',
};

/**
 * Genera un template di messaggio per uno step della sequenza.
 *
 * @param {object} args
 * @param {object} args.step - { channel, step_type, step_number, delay_days }
 * @param {object} args.niche - nicchia (con pain_points, niche_language, geo_scope opzionali)
 * @param {object} [args.sap] - SAP target (name, value_proposition, target_customer, process_blueprint)
 * @param {object} [args.prospect] - prospect specifico per personalizzazione
 * @param {string} [args.tone='professionale'] - tono
 * @param {string} [args.previousMessage] - testo del messaggio precedente (per coerenza)
 * @param {string} [args.customInstructions] - istruzioni custom di Davide
 * @returns {Promise<object>} template generato
 */
export async function generateOutreachStepTemplate(args) {
    const { step, niche, sap, prospect, tone = 'professionale', previousMessage, customInstructions } = args;

    if (!step || !step.channel || !step.step_type) {
        throw new Error('Step deve avere channel e step_type');
    }

    const prompt = buildPrompt({ step, niche, sap, prospect, tone, previousMessage, customInstructions });
    const schema = buildSchemaForChannel(step.channel);

    const result = await completeJSON(prompt, schema, {
        feature: 'sales_outreach_writer',
        model: MODEL,
        system:
            'Sei un copywriter esperto di cold outreach B2B per agenzie di comunicazione italiane (Gleeye, Genova). ' +
            'Conosci la metodologia Gabriel Bani (Loom System 2.0, sequence multi-step) e Matteo Parozzi (12 principi outreach, OTO Formula, ARC obiezioni). ' +
            'Regole non negoziabili: ' +
            '(1) NEVER vendere il servizio nell\'outreach iniziale, vendi sempre la CALL. ' +
            '(2) Personalizzazione vera: usa il nome dell\'azienda, dettagli specifici se forniti, linguaggio della nicchia. ' +
            '(3) Email max 150 parole, DM max secondo channel guide, follow-up brevi. ' +
            '(4) NO mai chiamarti "agenzia" se la nicchia è stata bruciata (vedi pain). ' +
            '(5) CTA morbida, mai aggressiva. ' +
            '(6) Usa placeholder {{business_name}} per il nome azienda, {{contact_name}} se referente, {{nome_mittente}} per chi firma. ' +
            'Rispondi SOLO in JSON valido.',
    });

    return result;
}

function buildSchemaForChannel(channel) {
    switch (channel) {
        case 'email':
            return {
                subject: 'string — oggetto email < 60 caratteri, intrigante, NO termini come "agenzia" o "marketing"',
                body: 'string — corpo email, plain text, con saluto + corpo + CTA + firma. Usa placeholder {{business_name}}, {{contact_name}}, {{nome_mittente}}',
                length_words: 0,
                rationale: 'string — 1 riga sul perché questo messaggio dovrebbe funzionare per questa nicchia/step',
            };
        case 'dm_linkedin':
        case 'dm_instagram':
        case 'whatsapp':
            return {
                body: 'string — corpo del DM, brevissimo (vedi channel guide). Plain text. Placeholder {{business_name}} {{contact_name}} {{nome_mittente}}',
                length_words: 0,
                rationale: 'string',
            };
        case 'loom':
            return {
                loom_script: 'string — script del video Loom 3-6 min, formato bullet/step da seguire mentre si registra mostrando il sito del prospect',
                email_subject: 'string — oggetto email che accompagna il Loom (es. "Piccola sorpresa per te [Nome]")',
                email_body: 'string — testo email che incornicia il video (2-4 righe + embed GIF Loom). Placeholder {{business_name}} {{contact_name}} {{nome_mittente}}',
                rationale: 'string',
            };
        case 'cold_call':
            return {
                opening_line: 'string — frase di apertura 7-10 sec che ferma l\'attenzione',
                script: 'string — script completo della chiamata (3-5 punti)',
                rationale: 'string',
            };
        default:
            return {
                body: 'string',
                rationale: 'string',
            };
    }
}

function buildPrompt({ step, niche, sap, prospect, tone, previousMessage, customInstructions }) {
    const lines = [];
    const typeGuide = STEP_TYPE_GUIDES[step.step_type] || { label: step.step_type, guide: '' };
    const channelGuide = CHANNEL_GUIDES[step.channel] || '';

    lines.push('## STEP DA SCRIVERE');
    lines.push('- Canale: ' + step.channel);
    lines.push('- Tipo step: ' + step.step_type + ' (' + typeGuide.label + ')');
    lines.push('- Numero step nella sequenza: ' + (step.step_number || '?'));
    if (step.delay_days != null) lines.push('- Giorni dopo precedente: ' + step.delay_days);
    lines.push('- Tono: ' + tone);
    lines.push('');
    lines.push('## GUIDA STEP TYPE');
    lines.push(typeGuide.guide);
    lines.push('');
    lines.push('## GUIDA CHANNEL');
    lines.push(channelGuide);

    lines.push('');
    lines.push('## NICCHIA TARGET');
    if (niche) {
        lines.push('- Nome: ' + niche.name);
        if (niche.description) lines.push('- Descrizione: ' + niche.description);
        if (Array.isArray(niche.pain_points) && niche.pain_points.length) {
            lines.push('- Pain points (USA QUESTI):');
            niche.pain_points.forEach(p => lines.push('  • ' + p));
        }
        if (niche.niche_language && typeof niche.niche_language === 'object') {
            const langEntries = Object.entries(niche.niche_language);
            if (langEntries.length) {
                lines.push('- Linguaggio nicchia (USA QUESTI TERMINI):');
                langEntries.forEach(([k, v]) => lines.push('  • "' + k + '" = ' + v));
            }
        }
    } else {
        lines.push('Generica.');
    }

    if (sap) {
        lines.push('');
        lines.push('## SAP/SERVIZIO DA PROMUOVERE (sotto traccia, non venderlo)');
        lines.push('- Nome: ' + sap.name);
        if (sap.value_proposition) lines.push('- Value prop: ' + sap.value_proposition);
        if (sap.target_customer) lines.push('- Cliente ideale: ' + sap.target_customer);
        if (sap.description) lines.push('- Descrizione: ' + sap.description.slice(0, 400));
    }

    if (prospect) {
        lines.push('');
        lines.push('## PROSPECT SPECIFICO (personalizza!)');
        lines.push('- Azienda: ' + prospect.business_name);
        if (prospect.contact_name) lines.push('- Referente: ' + prospect.contact_name);
        if (prospect.website) lines.push('- Sito: ' + prospect.website);
        const e = prospect.ai_enrichment_data || {};
        if (e.descrizione_lampo) lines.push('- Cosa fanno: ' + e.descrizione_lampo);
        if (e.punto_distintivo) lines.push('- Loro USP: ' + e.punto_distintivo);
        if (e.opportunita_marketing) lines.push('- Opportunità marketing identificata: ' + e.opportunita_marketing);
    }

    if (previousMessage) {
        lines.push('');
        lines.push('## MESSAGGIO PRECEDENTE (per coerenza)');
        lines.push(previousMessage.slice(0, 1500));
    }

    if (customInstructions) {
        lines.push('');
        lines.push('## ISTRUZIONI CUSTOM');
        lines.push(customInstructions);
    }

    lines.push('');
    lines.push('## OUTPUT');
    lines.push('Genera il template di messaggio seguendo lo schema. Usa placeholder {{...}} dove serve personalizzazione runtime. Sii concreto, non generico. Mai parole come "rivoluzionare", "soluzione innovativa", "ottimizzare". Linguaggio umano.');

    return lines.join('\n');
}

/**
 * Lookup helper per pickare il template dal risultato a seconda del channel.
 */
export function extractTemplateFields(channel, generated) {
    if (!generated) return { subject: null, body: null, loom_script: null };
    switch (channel) {
        case 'email':
            return {
                subject: generated.subject || null,
                body: generated.body || null,
                loom_script: null,
            };
        case 'loom':
            return {
                subject: generated.email_subject || null,
                body: generated.email_body || null,
                loom_script: generated.loom_script || null,
            };
        case 'cold_call':
            return {
                subject: null,
                body: generated.script || null,
                loom_script: null,
            };
        default:
            return {
                subject: null,
                body: generated.body || null,
                loom_script: null,
            };
    }
}
