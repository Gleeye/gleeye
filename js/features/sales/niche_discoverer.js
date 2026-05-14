/**
 * sales/niche_discoverer.js
 * Niche Discoverer agent (MVP intelligence report).
 *
 * Legge i prospect di una nicchia/pool, li passa a Gemini con i loro dati strutturati,
 * l'AI propone 3-7 sotto-segmenti omogenei (con motivazione, segnali comuni, pain probabile,
 * SAP candidati). Output: report di intelligence — l'utente vede le proposte ma le nicchie
 * NON vengono ancora materializzate. Fase successiva (operativizzazione) richiederà schema
 * change (parent_niche_id + UI assegnazione prospect).
 *
 * Costo: una chiamata Gemini Flash Lite per discover (~1-2 cent per pool di 100-500 prospect).
 */

import { supabase } from '../../modules/config.js?v=8000';
import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';
import { openOverlay, buildModalShell, closeOverlay, bindModalCloseButtons } from './_modal.js?v=8001';

const MODEL = AI_MODELS.default;

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apre il modal Niche Discoverer per una nicchia/pool data.
 */
export async function openDiscovererModal(niche) {
    const overlay = openOverlay('niche-discoverer-' + niche.id);
    const shell = buildModalShell({
        title: 'Niche Discoverer · ' + niche.name,
        headerExtra: '<span style="font-size:0.7rem;color:var(--text-tertiary);">Analisi AI per scoprire sotto-segmenti omogenei nel pool</span>',
        body: '<div id="discoverer-body" style="min-height:200px;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);">' +
                  '<div style="text-align:center;">' +
                      '<span class="material-icons-round" style="font-size:2.5rem;color:var(--brand-blue);animation:spin 1.5s linear infinite;">auto_awesome</span>' +
                      '<div style="margin-top:0.75rem;font-size:0.85rem;">Carico i prospect e li analizzo con l\'AI…</div>' +
                  '</div>' +
              '</div>',
        footer: '<button class="btn-glass btn-modal-close" style="padding:0.55rem 1.2rem;">Chiudi</button>',
        maxWidth: '900px',
    });
    overlay.appendChild(shell);
    bindModalCloseButtons(overlay);

    try {
        const prospects = await fetchProspectsForDiscovery(niche.id);
        const body = document.getElementById('discoverer-body');

        if (prospects.length < 20) {
            body.innerHTML = renderInsufficientData(prospects.length);
            return;
        }

        body.innerHTML =
            '<div style="text-align:center;color:var(--text-tertiary);">' +
                '<span class="material-icons-round" style="font-size:2rem;color:var(--brand-blue);animation:spin 1.5s linear infinite;">psychology</span>' +
                '<div style="margin-top:0.75rem;font-size:0.85rem;">L\'AI sta cluster-izzando ' + prospects.length + ' prospect arricchiti…</div>' +
            '</div>';

        const discovery = await runDiscovery(niche, prospects);
        body.innerHTML = renderDiscoveryReport(niche, prospects.length, discovery);
    } catch (err) {
        console.error('[NicheDiscoverer]', err);
        const body = document.getElementById('discoverer-body');
        if (body) body.innerHTML = '<div style="color:#dc2626;padding:1rem;text-align:center;">Errore: ' + err.message + '</div>';
        showGlobalAlert('Niche Discoverer fallito: ' + err.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA FETCH
// ═══════════════════════════════════════════════════════════════════════════

async function fetchProspectsForDiscovery(nicheId) {
    const { data, error } = await supabase
        .from('prospects')
        .select('id, business_name, website, contact_phone, contact_email, social_links, completeness_score, ai_enrichment_data, niche_id')
        .eq('niche_id', nicheId)
        .gte('completeness_score', 25)
        .limit(500);

    if (error) throw error;
    return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// AI DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Costruisce un dossier compatto per ogni prospect (solo segnali utili al cluster).
 * Evitiamo di mandare HTML/testi raw, troppi token. Solo dati strutturati.
 */
function buildProspectDossier(p) {
    const e = p.ai_enrichment_data || {};
    const s = e.osm_structured || {};
    const social = p.social_links || {};
    return {
        id: p.id,
        nome: p.business_name,
        sito: p.website ? 'sì' : 'no',
        email_generica: p.contact_email && p.contact_email.startsWith('info@') ? 'sì' : (p.contact_email ? 'specifica' : 'no'),
        telefono: p.contact_phone ? 'sì' : 'no',
        social_count: Object.keys(social).length,
        social_attivi: Object.keys(social),
        comune: e.city_origin || s.addr_city || null,
        provincia: s.addr_province || null,
        completezza: p.completeness_score,
        rating_google: e.google_rating || null,
        reviews_count: e.google_reviews_count || null,
        cucina: s.cuisine || null,
        brand: s.brand || null,
        camere: s.rooms || null,
        stelle: s.stars || null,
        fascia_prezzo: s.price_range || null,
        anno_apertura: s.start_date || e.founding_date || null,
        delivery: s.delivery || null,
        outdoor: s.outdoor_seating || null,
        wifi: s.wifi || null,
        wheelchair: s.wheelchair || null,
        dieta_vegan: s.diet_vegan || null,
        dieta_gluten_free: s.diet_gluten_free || null,
        pagamento_carte: s.payment_cards || null,
        partita_iva: e.vat_id || null,
        ragione_sociale: e.legal_name || null,
        titolare: e.founder || null,
        dipendenti: e.number_of_employees || null,
        framework_sito: e.site_fingerprint?.framework || null,
        sito_bloccato_js: e.site_fingerprint?.rendering === 'csr' ? 'sì' : 'no',
        descrizione: s.description ? s.description.slice(0, 120) : null,
    };
}

async function runDiscovery(niche, prospects) {
    const dossiers = prospects.map(buildProspectDossier);

    const schema = {
        analisi_globale: 'string — 1 paragrafo sul pool nel suo insieme (dimensioni medie, presenza web tipica, gap evidenti)',
        sotto_nicchie: [
            {
                nome: 'string — nome sintetico della sotto-nicchia (max 40 char)',
                descrizione: 'string — 1 frase chi sono questi prospect',
                criterio_cluster: 'string — i segnali che li raggruppano (max 60 char)',
                prospect_ids: ['string — id dei prospect che appartengono'],
                pain_probabile: 'string — il dolore specifico di questa sotto-nicchia (max 100 char)',
                offerta_candidata: 'string — che pacchetto Gleeye proporresti (max 100 char)',
                priorita: 'string — alta|media|bassa',
                rationale_priorita: 'string — perché questa priorità (max 80 char)',
            }
        ],
        cluster_residuo: {
            count: 'number — quanti prospect non rientrano in nessuna sotto-nicchia chiara',
            motivo: 'string — perché non clusterabili (dati insufficienti, eterogeneità, ecc.)',
        },
        insight_strategici: ['string — 2-4 osservazioni che dovrebbero guidare la strategia (max 100 char ciascuna)'],
    };

    const system = 'Sei un analista strategico vendite B2B esperto del mercato italiano. ' +
        'Cluster-izzi pool di aziende per individuare sotto-segmenti omogenei su cui differenziare l\'outreach. ' +
        'Tagli netti, sotto-nicchie azionabili. NON includere prospect in una sotto-nicchia se non c\'è un criterio forte: ' +
        'meglio meno sotto-nicchie ma omogenee che molte deboli. Output SOLO in JSON valido secondo schema.';

    const prompt =
        'POOL: "' + niche.name + '" (settore: ' + (niche.sector?.name || 'generico') + ')\n' +
        'OBIETTIVO: scopri 3-7 sotto-nicchie omogenee nel pool, basandoti sui dati strutturati che vedi.\n\n' +
        'CRITERI POSSIBILI di cluster (combinabili): dimensione (camere/stelle/dipendenti), area geografica/provincia, ' +
        'maturità digitale (presenza social, framework sito, qualità email), positioning (fascia prezzo, brand, cucina, ' +
        'pubblico target), tratti operativi (delivery, accessibilità, dieta vegan/gluten, outdoor seating), ' +
        'anzianità (anno apertura), status digitale (sito bloccato JS, no sito, sito moderno).\n\n' +
        'OUTPUT: per ogni sotto-nicchia: nome, descrizione 1 frase, criterio cluster, lista prospect_ids appartenenti, ' +
        'pain probabile specifico, offerta Gleeye candidata, priorità (alta/media/bassa) con motivazione. ' +
        'Più "insight strategici" che dovrebbero guidare la strategia commerciale generale.\n\n' +
        'PROSPECT NEL POOL (' + dossiers.length + '):\n' +
        JSON.stringify(dossiers).slice(0, 70_000);  // safety cap

    const result = await completeJSON(prompt, schema, {
        feature: 'sales_niche_discoverer',
        model: MODEL,
        system,
    });

    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// UI RENDER
// ═══════════════════════════════════════════════════════════════════════════

function renderInsufficientData(count) {
    return '<div style="padding:1.5rem;text-align:center;">' +
        '<span class="material-icons-round" style="font-size:2.5rem;color:#f59e0b;">info</span>' +
        '<div style="margin-top:0.75rem;font-size:0.95rem;color:var(--text-primary);">Dati insufficienti per Discovery</div>' +
        '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-tertiary);">' +
            'Il pool ha ' + count + ' prospect con completezza ≥ 25. Servono almeno 20 prospect arricchiti perché il cluster abbia senso.' +
        '</div>' +
        '<div style="margin-top:1rem;font-size:0.78rem;color:var(--text-tertiary);">' +
            'Suggerimento: lancia il Sourcing per ampliare il pool, poi rilancia il Niche Discoverer.' +
        '</div>' +
    '</div>';
}

function renderDiscoveryReport(niche, totalProspects, discovery) {
    const subs = discovery.sotto_nicchie || [];
    const residual = discovery.cluster_residuo || {};
    const insights = discovery.insight_strategici || [];

    return '<div style="padding:0.25rem;">' +
        // Analisi globale
        '<div style="padding:0.85rem 1rem;background:var(--brand-blue)10;border-left:3px solid var(--brand-blue);border-radius:8px;margin-bottom:1.25rem;">' +
            '<div style="font-size:0.7rem;color:var(--brand-blue);text-transform:uppercase;font-weight:700;letter-spacing:0.05em;margin-bottom:0.4rem;">Analisi globale del pool</div>' +
            '<div style="font-size:0.85rem;color:var(--text-primary);line-height:1.5;">' + escapeHtml(discovery.analisi_globale || '') + '</div>' +
        '</div>' +

        // Insight strategici
        (insights.length > 0
            ? '<div style="margin-bottom:1.25rem;">' +
                '<div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;font-weight:700;letter-spacing:0.05em;margin-bottom:0.5rem;">Insight strategici</div>' +
                '<ul style="margin:0;padding-left:1.25rem;font-size:0.85rem;color:var(--text-primary);line-height:1.65;">' +
                    insights.map(i => '<li style="margin-bottom:0.3rem;">' + escapeHtml(i) + '</li>').join('') +
                '</ul>' +
            '</div>'
            : '') +

        // Sotto-nicchie scoperte
        '<div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;font-weight:700;letter-spacing:0.05em;margin-bottom:0.6rem;">' +
            'Sotto-nicchie scoperte (' + subs.length + ' su ' + totalProspects + ' prospect)' +
        '</div>' +
        subs.map((s, idx) => renderSubNicheCard(s, idx)).join('') +

        // Cluster residuo
        (residual.count > 0
            ? '<div style="padding:0.7rem 0.9rem;background:var(--bg-secondary);border:1px dashed var(--glass-border);border-radius:8px;margin-top:0.75rem;">' +
                '<div style="font-size:0.75rem;color:var(--text-tertiary);font-weight:600;margin-bottom:0.2rem;">Cluster residuo: ' + residual.count + ' prospect</div>' +
                '<div style="font-size:0.78rem;color:var(--text-tertiary);">' + escapeHtml(residual.motivo || '') + '</div>' +
            '</div>'
            : '') +

        // Disclaimer MVP
        '<div style="margin-top:1.5rem;padding:0.75rem 1rem;background:#f59e0b08;border:1px solid #f59e0b33;border-radius:8px;font-size:0.78rem;color:var(--text-tertiary);">' +
            '<strong style="color:#f59e0b;">Nota:</strong> al momento questo è un report di sola intelligence. ' +
            'Nella prossima evoluzione potrai materializzare le sotto-nicchie scelte come nicchie operative ' +
            '(con prospect riassegnati e sequenze dedicate).' +
        '</div>' +
    '</div>';
}

function renderSubNicheCard(s, idx) {
    const priorityColor = s.priorita === 'alta' ? '#dc2626' : (s.priorita === 'media' ? '#f59e0b' : '#6b7280');
    const priorityBg = s.priorita === 'alta' ? '#dc262615' : (s.priorita === 'media' ? '#f59e0b15' : '#6b728015');
    const count = (s.prospect_ids || []).length;
    return '<div style="padding:0.9rem 1rem;background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:10px;margin-bottom:0.6rem;">' +
        // Header
        '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;flex-wrap:wrap;">' +
            '<div style="font-size:0.92rem;font-weight:700;color:var(--text-primary);">' + escapeHtml(s.nome || '') + '</div>' +
            '<span style="padding:0.15rem 0.5rem;background:' + priorityBg + ';color:' + priorityColor + ';border-radius:6px;font-size:0.65rem;text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">' +
                'Priorità ' + (s.priorita || 'media') +
            '</span>' +
            '<span style="margin-left:auto;padding:0.15rem 0.5rem;background:var(--brand-blue)15;color:var(--brand-blue);border-radius:6px;font-size:0.7rem;font-weight:700;">' +
                count + ' prospect' +
            '</span>' +
        '</div>' +
        // Descrizione
        '<div style="font-size:0.82rem;color:var(--text-primary);margin-bottom:0.5rem;line-height:1.5;">' +
            escapeHtml(s.descrizione || '') +
        '</div>' +
        // Grid criterio + pain + offerta
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.75rem;">' +
            kv('Criterio cluster', s.criterio_cluster) +
            kv('Pain probabile', s.pain_probabile) +
            kv('Offerta candidata', s.offerta_candidata, 'span 2') +
            (s.rationale_priorita ? kv('Perché ' + (s.priorita || ''), s.rationale_priorita, 'span 2') : '') +
        '</div>' +
    '</div>';
}

function kv(label, value, gridSpan) {
    if (!value) return '';
    const style = gridSpan ? 'grid-column:' + gridSpan + ';' : '';
    return '<div style="' + style + '">' +
        '<div style="font-size:0.65rem;color:var(--text-tertiary);text-transform:uppercase;font-weight:600;letter-spacing:0.03em;margin-bottom:0.15rem;">' + escapeHtml(label) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-primary);line-height:1.4;">' + escapeHtml(value) + '</div>' +
    '</div>';
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
