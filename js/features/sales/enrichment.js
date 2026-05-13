/**
 * sales/enrichment.js
 * Tab "Arricchimento AI" nel dettaglio prospect.
 * Cerca info pubbliche su azienda e popola industry + company_size + descrizione.
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { upsertProspect } from './api.js?v=8000';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';

const MODEL = AI_MODELS.sales_drafter;

export async function renderEnrichmentTab(container, prospect, onEnriched) {
    const enriched = prospect.ai_enrichment_data || {};
    const hasData = enriched.industry || enriched.company_size || enriched.description;

    container.innerHTML = buildEnrichmentHTML(prospect, enriched, hasData);
    bindEnrichmentEvents(container, prospect, onEnriched);
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildEnrichmentHTML(prospect, enriched, hasData) {
    const savedAt = enriched.enriched_at
        ? 'Ultimo aggiornamento: ' + new Date(enriched.enriched_at).toLocaleString('it-IT')
        : '';

    const resultHTML = hasData
        ? buildResultCards(enriched)
        : '<div style="text-align:center;padding:2.5rem;color:var(--text-tertiary);">' +
              '<span class="material-icons-round" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:0.75rem;">auto_awesome</span>' +
              '<div style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem;">Nessun arricchimento ancora</div>' +
              '<div style="font-size:0.8rem;">Clicca il bottone per analizzare questa azienda con l\'AI.</div>' +
          '</div>';

    return (
        '<div style="padding:0.5rem 0;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">' +
                '<div>' +
                    '<div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);">Analisi AI — ' + escHtml(prospect.business_name) + '</div>' +
                    (savedAt ? '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:2px;">' + savedAt + '</div>' : '') +
                '</div>' +
                '<button id="btn-run-enrichment" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.78rem;padding:0.45rem 0.9rem;border-radius:10px;font-weight:700;">' +
                    '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span>' +
                    (hasData ? 'Rigenera' : 'Arricchisci') +
                '</button>' +
            '</div>' +
            '<div id="enrichment-result">' + resultHTML + '</div>' +
        '</div>'
    );
}

function buildResultCards(enriched) {
    const cards = [
        { icon: 'category',        label: 'Settore',           value: enriched.industry },
        { icon: 'groups',          label: 'Dimensione team',   value: enriched.company_size },
        { icon: 'language',        label: 'Sito web',          value: enriched.website_confirmed },
        { icon: 'location_on',     label: 'Sede',              value: enriched.location },
        { icon: 'trending_up',     label: 'Fatturato stimato', value: enriched.revenue_estimate },
    ].filter(c => c.value);

    const cardsHTML = cards.map(c =>
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:0.85rem;display:flex;align-items:flex-start;gap:0.75rem;">' +
            '<span class="material-icons-round" style="font-size:1.1rem;color:var(--brand-blue);flex-shrink:0;">' + c.icon + '</span>' +
            '<div>' +
                '<div style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;">' + c.label + '</div>' +
                '<div style="font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-top:2px;">' + escHtml(c.value) + '</div>' +
            '</div>' +
        '</div>'
    ).join('');

    const descHTML = enriched.description
        ? '<div style="margin-top:1rem;background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:1rem;">' +
              '<div style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Descrizione</div>' +
              '<div style="font-size:0.85rem;color:var(--text-primary);line-height:1.5;">' + escHtml(enriched.description) + '</div>' +
          '</div>'
        : '';

    const keyInfoHTML = enriched.key_info && enriched.key_info.length > 0
        ? '<div style="margin-top:1rem;">' +
              '<div style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">Note strategiche</div>' +
              '<ul style="margin:0;padding-left:1.2rem;">' +
                  enriched.key_info.map(info => '<li style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px;">' + escHtml(info) + '</li>').join('') +
              '</ul>' +
          '</div>'
        : '';

    return (
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' + cardsHTML + '</div>' +
        descHTML +
        keyInfoHTML
    );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindEnrichmentEvents(container, prospect, onEnriched) {
    container.querySelector('#btn-run-enrichment')?.addEventListener('click', async () => {
        await runEnrichment(container, prospect, onEnriched);
    });
}

async function runEnrichment(container, prospect, onEnriched) {
    const resultDiv = container.querySelector('#enrichment-result');
    const btn = container.querySelector('#btn-run-enrichment');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;">refresh</span> Analisi in corso…';

    resultDiv.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);">' +
            '<span class="material-icons-round" style="animation:spin 1s linear infinite;">auto_awesome</span>' +
            'L\'AI sta analizzando ' + escHtml(prospect.business_name) + '…' +
        '</div>';

    try {
        const prompt = buildEnrichmentPrompt(prospect);
        const schema = {
            industry:          'string — settore di attività principale (es. "Agenzia di comunicazione", "Studio legale")',
            company_size:      'string — stima dipendenti/collaboratori (es. "1-5", "10-50", "50-200")',
            description:       'string — descrizione sintetica dell\'azienda in 2-3 frasi',
            website_confirmed: 'string | null — URL sito web se riscontrabile',
            location:          'string | null — città/regione sede',
            revenue_estimate:  'string | null — fatturato stimato se deducibile (es. "< 500k€", "1-5M€")',
            key_info:          'array of string — 2-4 note strategiche utili per un\'agenzia che vuole proporsi a questa azienda',
        };

        const result = await completeJSON(prompt, schema, {
            feature: 'sales_drafter',
            model:   MODEL,
            system:  'Sei un analista business specializzato in aziende italiane. Basati su informazioni pubblicamente note. Se non sei sicuro di un dato, omettilo o indicalo con un punto interrogativo.',
        });

        const enrichmentData = {
            ...result,
            enriched_at: new Date().toISOString(),
        };

        // Persist ai_enrichment_data + aggiorna campi industry/company_size se vuoti
        const updatePayload = { id: prospect.id, ai_enrichment_data: enrichmentData };
        if (!prospect.industry && result.industry) updatePayload.industry = result.industry;
        if (!prospect.company_size && result.company_size) updatePayload.company_size = result.company_size;

        await upsertProspect(updatePayload);

        // Update local prospect object for re-render
        prospect.ai_enrichment_data = enrichmentData;
        if (updatePayload.industry) prospect.industry = updatePayload.industry;
        if (updatePayload.company_size) prospect.company_size = updatePayload.company_size;

        resultDiv.innerHTML = buildResultCards(enrichmentData);
        showGlobalAlert('Arricchimento completato', 'success');
        onEnriched && onEnriched(prospect);
    } catch (err) {
        console.error('[Enrichment] error', err);
        resultDiv.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;">Errore durante l\'analisi: ' + escHtml(err.message) + '</div>';
        showGlobalAlert('Errore AI: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span> Rigenera';
    }
}

function buildEnrichmentPrompt(prospect) {
    const parts = [
        'Analizza questa azienda prospect:',
        '- Nome: ' + prospect.business_name,
    ];
    if (prospect.website) parts.push('- Sito web: ' + prospect.website);
    if (prospect.contact_name) parts.push('- Referente: ' + prospect.contact_name);
    if (prospect.industry) parts.push('- Settore dichiarato: ' + prospect.industry);
    if (prospect.company_size) parts.push('- Dimensione dichiarata: ' + prospect.company_size);
    if (prospect.linkedin_url) parts.push('- LinkedIn: ' + prospect.linkedin_url);
    parts.push('');
    parts.push('Contesto: stiamo valutando se proporre i servizi di comunicazione e marketing della nostra agenzia (Gleeye, Genova) a questa azienda.');
    return parts.join('\n');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
