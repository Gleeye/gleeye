/**
 * sales/enrichment.js
 * Tab "Arricchimento AI" nel dettaglio prospect.
 *
 * Layer 1 (sempre): 5 campi standard Gleeye + meta + promising_score
 * Layer 2 (deep dive automatico se promising_score ≥ 70): 11 campi strategici
 *
 * Modello: AI_MODELS.sales_drafter (Gemini Flash Lite). NON toccare ai_client.js.
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { upsertProspect } from './api.js?v=8001';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';

const MODEL = AI_MODELS.sales_drafter;
const AUTO_DEEP_DIVE_THRESHOLD = 70;

// ─── SITE SCRAPER (edge function scrape-prospect-site v2) ─────────────────────
// v2: multi-pagina (home + /contatti + /chi-siamo + /team + sitemap),
// JSON-LD schema.org parse, sector schema runtime extraction.
//
// @param {string} url - URL del sito
// @param {array}  [sectorSchema] - fields[] dal sector_extraction_schemas
export async function scrapeProspectSite(url, sectorSchema) {
    if (!url) return null;
    try {
        const body = { url };
        if (Array.isArray(sectorSchema) && sectorSchema.length > 0) body.sector_schema = sectorSchema;
        const { data, error } = await supabase.functions.invoke('scrape-prospect-site', { body });
        if (error) {
            console.warn('[scrape] invoke error', error);
            return { success: false, error: String(error?.message || error), url };
        }
        return data;
    } catch (err) {
        console.warn('[scrape] exception', err);
        return { success: false, error: String(err?.message || err), url };
    }
}

export async function renderEnrichmentTab(container, prospect, onEnriched) {
    const enriched = prospect.ai_enrichment_data || {};
    container.innerHTML = buildEnrichmentHTML(prospect, enriched);
    bindEnrichmentEvents(container, prospect, onEnriched);
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildEnrichmentHTML(prospect, e) {
    const hasL1 = !!e.layer1_at || !!e.descrizione_lampo || !!e.chi_sono_cosa_fanno;
    const hasL2 = !!e.layer2_at || !!e.analisi_swot || !!e.competitor;
    const savedAt = e.layer1_at ? new Date(e.layer1_at).toLocaleString('it-IT') : '';
    const promising = e.promising_score != null ? Number(e.promising_score) : null;

    return (
        '<div style="padding:0.5rem 0;">' +
            // Header
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);">Arricchimento AI — ' + escHtml(prospect.business_name) + '</div>' +
                    (savedAt
                        ? '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:3px;">Layer 1: ' + savedAt + (hasL2 ? ' · Layer 2 attivo' : '') + '</div>'
                        : '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:3px;">Nessun arricchimento ancora</div>') +
                '</div>' +
                '<div style="display:flex;gap:0.4rem;">' +
                    (hasL1 && !hasL2
                        ? '<button id="btn-deep-dive" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.78rem;padding:0.45rem 0.9rem;border-radius:10px;border:1px solid #8b5cf640;background:#8b5cf608;color:#8b5cf6;font-weight:700;cursor:pointer;">' +
                            '<span class="material-icons-round" style="font-size:0.95rem;">psychology</span>Deep dive (Layer 2)' +
                        '</button>'
                        : '') +
                    '<button id="btn-run-enrichment" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.78rem;padding:0.45rem 0.9rem;border-radius:10px;font-weight:700;">' +
                        '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span>' +
                        (hasL1 ? 'Rigenera Layer 1' : 'Arricchisci') +
                    '</button>' +
                '</div>' +
            '</div>' +
            // Promising score
            (promising != null ? buildPromisingScoreBar(promising) : '') +
            // Result body
            '<div id="enrichment-result">' +
                (hasL1
                    ? buildLayer1Cards(e) + (hasL2 ? buildLayer2Cards(e) : '')
                    : buildEmptyState()
                ) +
            '</div>' +
        '</div>'
    );
}

function buildEmptyState() {
    return (
        '<div style="text-align:center;padding:2.5rem;color:var(--text-tertiary);border:2px dashed var(--glass-border);border-radius:14px;">' +
            '<span class="material-icons-round" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:0.75rem;">auto_awesome</span>' +
            '<div style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem;">Nessun arricchimento ancora</div>' +
            '<div style="font-size:0.78rem;line-height:1.5;max-width:420px;margin:0 auto;">' +
                'L\'AI inferisce profilo, prodotti, target, USP. Se il prospect è promettente (score ≥ 70/100), parte automaticamente il Deep dive (Layer 2) con analisi competitor, SWOT, opportunità.' +
            '</div>' +
        '</div>'
    );
}

function buildPromisingScoreBar(score) {
    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#94a3b8';
    const label = score >= 70 ? 'Promettente' : score >= 40 ? 'Da valutare' : 'Poco promettente';
    return (
        '<div style="background:' + color + '08;border:1px solid ' + color + '33;border-radius:12px;padding:0.75rem 1rem;margin-bottom:1rem;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<div style="font-size:0.72rem;font-weight:800;color:' + color + ';text-transform:uppercase;letter-spacing:0.04em;">Promising Score</div>' +
                '<div style="font-size:0.95rem;font-weight:900;color:' + color + ';">' + score + '/100 · ' + label + '</div>' +
            '</div>' +
            '<div style="height:6px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;">' +
                '<div style="height:100%;width:' + score + '%;background:' + color + ';border-radius:4px;"></div>' +
            '</div>' +
        '</div>'
    );
}

// ─── LAYER 1 cards (5 campi standard + meta) ─────────────────────────────────

function buildLayer1Cards(e) {
    const cards = [
        { icon: 'category',     label: 'Settore',          value: e.industry },
        { icon: 'groups',       label: 'Dimensione team',  value: e.company_size },
        { icon: 'location_on',  label: 'Sede',             value: e.location },
        { icon: 'trending_up',  label: 'Fatturato stimato', value: e.revenue_estimate },
    ].filter(c => c.value);

    return (
        '<div style="margin-bottom:1.5rem;">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.75rem;">' +
                '<span class="material-icons-round" style="font-size:0.95rem;color:var(--brand-blue);">auto_awesome</span>' +
                '<span style="font-size:0.78rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.04em;">Layer 1 — Profilo</span>' +
            '</div>' +
            (cards.length > 0
                ? '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:0.5rem;margin-bottom:0.75rem;">' +
                    cards.map(c => metaCard(c.icon, c.label, c.value)).join('') +
                  '</div>'
                : '') +
            field5('description', 'Descrizione lampo', e.descrizione_lampo) +
            field5('group', 'Chi sono e cosa fanno', e.chi_sono_cosa_fanno) +
            field5('shopping_bag', 'Prodotti / servizi', e.prodotti_servizi) +
            field5('people', 'Clientela target', e.clientela_target) +
            field5('emoji_events', 'Punto distintivo', e.punto_distintivo) +
        '</div>'
    );
}

function metaCard(icon, label, value) {
    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:10px;padding:0.6rem 0.75rem;display:flex;align-items:center;gap:0.5rem;">' +
            '<span class="material-icons-round" style="font-size:1rem;color:var(--brand-blue);">' + icon + '</span>' +
            '<div style="min-width:0;">' +
                '<div style="font-size:0.62rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">' + label + '</div>' +
                '<div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(value) + '</div>' +
            '</div>' +
        '</div>'
    );
}

function field5(icon, label, value) {
    if (!value) return '';
    return (
        '<div style="margin-bottom:0.6rem;background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:10px;padding:0.7rem 0.9rem;">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:3px;">' +
                '<span class="material-icons-round" style="font-size:0.9rem;color:var(--brand-blue);">' + icon + '</span>' +
                '<span style="font-size:0.7rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">' + label + '</span>' +
            '</div>' +
            '<div style="font-size:0.82rem;color:var(--text-primary);line-height:1.5;">' + escHtml(value) + '</div>' +
        '</div>'
    );
}

// ─── LAYER 2 cards (deep dive strategico) ────────────────────────────────────

function buildLayer2Cards(e) {
    return (
        '<div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px dashed var(--glass-border);">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.75rem;">' +
                '<span class="material-icons-round" style="font-size:0.95rem;color:#8b5cf6;">psychology</span>' +
                '<span style="font-size:0.78rem;font-weight:800;color:#8b5cf6;text-transform:uppercase;letter-spacing:0.04em;">Layer 2 — Deep dive</span>' +
            '</div>' +
            field5deep('groups_3', 'Competitor identificati', e.competitor) +
            field5deep('verified', 'Punti di forza', e.punti_forza) +
            field5deep('error_outline', 'Punti di debolezza', e.punti_debolezza) +
            field5deep('grid_view', 'Analisi SWOT', e.analisi_swot) +
            field5deep('newspaper', 'News recenti', e.news_recenti) +
            field5deep('chat', 'Testimonianze clienti', e.testimonianze) +
            field5deep('language', 'Presenza online', e.presenza_online) +
            field5deep('lightbulb', 'Opportunità marketing', e.opportunita_marketing) +
            field5deep('campaign', 'SAP candidati per questo prospect', e.sap_candidati) +
            field5deep('insights', 'Fattibilità (cosa rende facile/difficile chiuderli)', e.fattibilita_note) +
            (e.fattibilita_score != null
                ? '<div style="margin-top:0.6rem;background:#8b5cf608;border:1px solid #8b5cf622;border-radius:10px;padding:0.7rem 0.9rem;display:flex;justify-content:space-between;align-items:center;">' +
                    '<span style="font-size:0.78rem;font-weight:700;color:var(--text-primary);">Fattibilità chiusura</span>' +
                    '<span style="font-size:0.95rem;font-weight:900;color:#8b5cf6;">' + e.fattibilita_score + '/100</span>' +
                  '</div>'
                : '') +
        '</div>'
    );
}

function field5deep(icon, label, value) {
    if (!value) return '';
    return (
        '<div style="margin-bottom:0.6rem;background:#8b5cf608;border:1px solid #8b5cf622;border-radius:10px;padding:0.7rem 0.9rem;">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:3px;">' +
                '<span class="material-icons-round" style="font-size:0.9rem;color:#8b5cf6;">' + icon + '</span>' +
                '<span style="font-size:0.7rem;font-weight:800;color:#8b5cf6;text-transform:uppercase;letter-spacing:0.04em;">' + label + '</span>' +
            '</div>' +
            '<div style="font-size:0.82rem;color:var(--text-primary);line-height:1.5;white-space:pre-wrap;">' + escHtml(value) + '</div>' +
        '</div>'
    );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindEnrichmentEvents(container, prospect, onEnriched) {
    container.querySelector('#btn-run-enrichment')?.addEventListener('click', async () => {
        await runLayer1(container, prospect, onEnriched);
    });
    container.querySelector('#btn-deep-dive')?.addEventListener('click', async () => {
        await runLayer2(container, prospect, onEnriched, true);
    });
}

// ─── LAYER 1 ──────────────────────────────────────────────────────────────────

async function runLayer1(container, prospect, onEnriched) {
    const resultDiv = container.querySelector('#enrichment-result');
    const btn = container.querySelector('#btn-run-enrichment');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;">refresh</span> Layer 1…';

    resultDiv.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);">' +
            '<span class="material-icons-round" style="animation:spin 1s linear infinite;">auto_awesome</span>' +
            'AI analizza ' + escHtml(prospect.business_name) + ' (Layer 1)…' +
        '</div>';

    try {
        const result = await runLayer1AI(prospect);

        const enrichmentData = {
            ...(prospect.ai_enrichment_data || {}),
            // 5 campi standard Gleeye
            descrizione_lampo:      result.descrizione_lampo || null,
            chi_sono_cosa_fanno:    result.chi_sono_cosa_fanno || null,
            prodotti_servizi:       result.prodotti_servizi || null,
            clientela_target:       result.clientela_target || null,
            punto_distintivo:       result.punto_distintivo || null,
            // Meta
            industry:               result.industry || null,
            company_size:           result.company_size || null,
            location:               result.location || null,
            revenue_estimate:       result.revenue_estimate || null,
            promising_score:        result.promising_score != null ? Number(result.promising_score) : null,
            promising_rationale:    result.promising_rationale || null,
            // Timestamp
            layer1_at:              new Date().toISOString(),
            layer1_model:           MODEL,
        };

        const updatePayload = { id: prospect.id, ai_enrichment_data: enrichmentData };
        if (!prospect.industry && result.industry) updatePayload.industry = result.industry;
        if (!prospect.company_size && result.company_size) updatePayload.company_size = result.company_size;

        await upsertProspect(updatePayload);
        prospect.ai_enrichment_data = enrichmentData;
        if (updatePayload.industry) prospect.industry = updatePayload.industry;
        if (updatePayload.company_size) prospect.company_size = updatePayload.company_size;

        showGlobalAlert('Layer 1 completato', 'success');
        onEnriched && onEnriched(prospect);

        // Auto-trigger Layer 2 se promettente
        if (enrichmentData.promising_score >= AUTO_DEEP_DIVE_THRESHOLD) {
            // Re-render con Layer 1 visibile
            renderEnrichmentTab(container, prospect, onEnriched);
            // Lancia Layer 2 in background
            setTimeout(() => runLayer2(container, prospect, onEnriched, false), 300);
        } else {
            renderEnrichmentTab(container, prospect, onEnriched);
        }
    } catch (err) {
        console.error('[Enrichment L1] error', err);
        resultDiv.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;">Errore Layer 1: ' + escHtml(err.message) + '</div>';
        showGlobalAlert('Errore AI: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span>Riprova';
    }
}

export async function runLayer1AI(prospect, scrapeData) {
    const prompt = buildLayer1Prompt(prospect, scrapeData);
    const schema = {
        descrizione_lampo:    'string — 1 frase di max 15 parole. Es: "Studio dentistico specializzato in implantologia con 3 sedi in Liguria."',
        chi_sono_cosa_fanno:  'string — paragrafo 2-4 frasi descrittive',
        prodotti_servizi:     'string — cosa vendono, con esempi concreti',
        clientela_target:     'string — a chi si rivolgono (segmento, fascia, geografia)',
        punto_distintivo:     'string — il loro USP/differenziatore, se rilevabile',
        industry:             'string — settore (es. "Hospitality", "Studio professionale")',
        company_size:         'string | null — stima dipendenti (es. "1-5", "10-50")',
        location:             'string | null — città/sede principale',
        revenue_estimate:     'string | null — fatturato stimato (es. "< 500k", "1-5M")',
        promising_score:      0, // 0-100
        promising_rationale:  'string — perché è/non è promettente per Gleeye',
    };
    const result = await completeJSON(prompt, schema, {
        feature: 'sales_enrichment_l1',
        model: MODEL,
        system:
            'Sei un analista business per agenzie di comunicazione italiane (Gleeye, Genova). ' +
            'Analizza l\'azienda prospect partendo dalle info fornite. ' +
            'NON inventare dati che non hai. Se manca un\'info, ometti il campo o usa null. ' +
            'Il promising_score (0-100) valuta quanto vale la pena approfondire QUESTO prospect per Gleeye come potenziale cliente: ' +
            'considera dimensione azienda, settore acquistato, presenza online attuale, pain potenziali, capacità di spesa. ' +
            '≥70 = molto promettente, deep dive automatico. Rispondi SOLO in JSON valido.',
    });
    return result;
}

function buildLayer1Prompt(prospect, scrapeData) {
    const lines = [
        '## PROSPECT',
        '- Azienda: ' + (prospect.business_name || '?'),
    ];
    if (prospect.website) lines.push('- Sito: ' + prospect.website);
    if (prospect.industry) lines.push('- Settore dichiarato: ' + prospect.industry);
    if (prospect.company_size) lines.push('- Dimensione dichiarata: ' + prospect.company_size);
    if (prospect.contact_name) lines.push('- Referente: ' + prospect.contact_name);
    if (prospect.contact_email) lines.push('- Email: ' + prospect.contact_email);
    if (prospect.linkedin_url) lines.push('- LinkedIn: ' + prospect.linkedin_url);
    if (prospect.notes) lines.push('- Note: ' + prospect.notes);

    if (scrapeData && scrapeData.success) {
        lines.push('');
        lines.push('## CONTENUTO DEL SITO (scraping reale)');
        if (scrapeData.title) lines.push('- Titolo: ' + scrapeData.title);
        if (scrapeData.meta_description) lines.push('- Meta description: ' + scrapeData.meta_description);
        if (scrapeData.emails?.length) lines.push('- Email: ' + scrapeData.emails.join(', '));
        if (scrapeData.socials && Object.keys(scrapeData.socials).length) {
            lines.push('- Social: ' + Object.entries(scrapeData.socials).map(([k, v]) => k + '=' + v).join(' · '));
        }
        if (scrapeData.text) {
            lines.push('');
            lines.push('### Testo del sito (max 6K char):');
            lines.push(scrapeData.text.slice(0, 6000));
        }
    }

    lines.push('');
    lines.push('## OBIETTIVO');
    lines.push('Gleeye è un\'agenzia di comunicazione/marketing a Genova. Vuole valutare se proporsi a questa azienda.');
    lines.push('');
    lines.push('## OUTPUT');
    lines.push('Compila TUTTI i campi richiesti. Sii concreto. Se non hai info, lascia null/ometti.');
    lines.push('Particolare attenzione al `promising_score` 0-100: quanto vale la pena per Gleeye approfondire questo prospect (vedi sistema).');

    return lines.join('\n');
}

// ─── LAYER 2 ──────────────────────────────────────────────────────────────────

async function runLayer2(container, prospect, onEnriched, isManualTrigger) {
    const resultDiv = container.querySelector('#enrichment-result');
    const btn = container.querySelector('#btn-deep-dive');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;">refresh</span>Deep dive…';
    }

    // Banner di processo (overlay sopra Layer 1 esistente)
    let progressDiv = container.querySelector('#layer2-progress');
    if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'layer2-progress';
        progressDiv.style.cssText = 'margin-top:1rem;display:flex;align-items:center;justify-content:center;padding:1.2rem;gap:0.75rem;color:#8b5cf6;background:#8b5cf608;border:1px solid #8b5cf622;border-radius:12px;';
        progressDiv.innerHTML = '<span class="material-icons-round" style="animation:spin 1s linear infinite;">psychology</span>' +
            (isManualTrigger ? 'Deep dive richiesto…' : 'Auto Deep dive (score ≥ ' + AUTO_DEEP_DIVE_THRESHOLD + ')…');
        resultDiv.appendChild(progressDiv);
    }

    try {
        const result = await runLayer2AI(prospect);

        const enrichmentData = {
            ...(prospect.ai_enrichment_data || {}),
            competitor:             result.competitor || null,
            punti_forza:            result.punti_forza || null,
            punti_debolezza:        result.punti_debolezza || null,
            analisi_swot:           result.analisi_swot || null,
            news_recenti:           result.news_recenti || null,
            testimonianze:          result.testimonianze || null,
            presenza_online:        result.presenza_online || null,
            opportunita_marketing:  result.opportunita_marketing || null,
            sap_candidati:          result.sap_candidati || null,
            fattibilita_note:       result.fattibilita_note || null,
            fattibilita_score:      result.fattibilita_score != null ? Number(result.fattibilita_score) : null,
            layer2_at:              new Date().toISOString(),
            layer2_model:           MODEL,
        };

        await upsertProspect({ id: prospect.id, ai_enrichment_data: enrichmentData });
        prospect.ai_enrichment_data = enrichmentData;

        showGlobalAlert('Deep dive completato', 'success');
        onEnriched && onEnriched(prospect);
        renderEnrichmentTab(container, prospect, onEnriched);
    } catch (err) {
        console.error('[Enrichment L2] error', err);
        if (progressDiv) progressDiv.innerHTML = '<div style="color:#ef4444;">Errore Layer 2: ' + escHtml(err.message) + '</div>';
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;">psychology</span>Riprova Deep dive';
        }
    }
}

export async function runLayer2AI(prospect, scrapeData) {
    const prompt = buildLayer2Prompt(prospect, scrapeData);
    const schema = {
        competitor:            'string — concorrenti diretti identificati (3-5 nomi se possibile, altrimenti tipologia)',
        punti_forza:           'string — bullet list dei loro punti di forza',
        punti_debolezza:       'string — bullet list dei loro punti deboli (= attack surface per noi)',
        analisi_swot:          'string — SWOT strutturata (Strengths, Weaknesses, Opportunities, Threats)',
        news_recenti:          'string — novità ultimi 6 mesi se rilevabili dal sito/social/news (lascia null se nessuna)',
        testimonianze:         'string — cosa dicono i loro clienti (sintesi)',
        presenza_online:       'string — valutazione qualitativa della loro presenza digitale (sito, social, SEO)',
        opportunita_marketing: 'string — cosa Gleeye potrebbe fare per loro concretamente',
        sap_candidati:         'string — quali SAP/servizi Gleeye sembrano più adatti per QUESTO prospect (possono divergere dal default della nicchia)',
        fattibilita_note:      'string — cosa rende facile/difficile chiuderli (segnali budget, decision maker, urgenza)',
        fattibilita_score:     0, // 0-100
    };
    const result = await completeJSON(prompt, schema, {
        feature: 'sales_enrichment_l2',
        model: MODEL,
        system:
            'Sei un consulente strategico per agenzie di comunicazione. ' +
            'Stai facendo deep dive su un prospect promettente per Gleeye (Genova). ' +
            'Sii concreto, dichiara incertezze, non inventare. ' +
            'Il fattibilita_score 0-100 stima quanto è realistico chiuderli come clienti. ' +
            'Rispondi SOLO in JSON valido.',
    });
    return result;
}

function buildLayer2Prompt(prospect, scrapeData) {
    const e = prospect.ai_enrichment_data || {};
    const lines = [
        '## PROSPECT',
        '- Azienda: ' + (prospect.business_name || '?'),
    ];
    if (prospect.website) lines.push('- Sito: ' + prospect.website);
    if (prospect.industry) lines.push('- Settore: ' + prospect.industry);
    if (prospect.linkedin_url) lines.push('- LinkedIn: ' + prospect.linkedin_url);
    lines.push('');
    lines.push('## CONTESTO LAYER 1 (già analizzato)');
    if (e.descrizione_lampo) lines.push('- Descrizione: ' + e.descrizione_lampo);
    if (e.chi_sono_cosa_fanno) lines.push('- Chi sono: ' + e.chi_sono_cosa_fanno);
    if (e.prodotti_servizi) lines.push('- Prodotti/servizi: ' + e.prodotti_servizi);
    if (e.clientela_target) lines.push('- Clientela: ' + e.clientela_target);
    if (e.punto_distintivo) lines.push('- USP: ' + e.punto_distintivo);
    if (e.promising_score != null) lines.push('- Promising score Layer 1: ' + e.promising_score);

    if (scrapeData && scrapeData.success && scrapeData.text) {
        lines.push('');
        lines.push('## CONTENUTO DEL SITO (scraping reale)');
        if (scrapeData.title) lines.push('- Titolo: ' + scrapeData.title);
        if (scrapeData.meta_description) lines.push('- Meta: ' + scrapeData.meta_description);
        lines.push('');
        lines.push('### Testo (max 8K char):');
        lines.push(scrapeData.text.slice(0, 8000));
    }

    lines.push('');
    lines.push('## OBIETTIVO');
    lines.push('Deep dive strategico per decidere se/come Gleeye dovrebbe attaccare questo prospect.');
    lines.push('Per news/testimonianze, basati ESCLUSIVAMENTE sul testo del sito sopra. Non inventare — usa null.');

    return lines.join('\n');
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
