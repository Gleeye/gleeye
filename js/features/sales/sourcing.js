/**
 * sales/sourcing.js
 * Sourcing Agent — trova aziende reali per nicchia usando OpenStreetMap Overpass API.
 *
 * Approccio:
 * 1. AI mappa keyword nicchia → tag OSM (hardcoded + AI fallback)
 * 2. Query Overpass per ogni città del geo_scope
 * 3. Anteprima risultati con dedup
 * 4. Davide seleziona quali importare
 * 5. Batch insert in prospects collegati alla nicchia
 *
 * NO edge function — Overpass supporta CORS, chiamo dal browser.
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { upsertNiche } from './api.js?v=8000';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';
import { scrapeProspectSite } from './enrichment.js?v=8001';
import { buildLeanUpdatePayload } from './completeness.js?v=8001';

const MODEL = AI_MODELS.sales_drafter;
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// Mapping hardcoded delle keyword più comuni → tag OSM
// (key OSM = chiave del tag, value = valore o array di valori; usato per costruire la query)
const KEYWORD_TO_OSM_TAGS = {
    'hotel':                  [{ key: 'tourism', value: 'hotel' }, { key: 'tourism', value: 'guest_house' }],
    'struttura ricettiva':    [{ key: 'tourism', value: 'hotel' }, { key: 'tourism', value: 'guest_house' }, { key: 'tourism', value: 'apartment' }, { key: 'tourism', value: 'hostel' }],
    'b&b':                    [{ key: 'tourism', value: 'guest_house' }],
    'agriturismo':            [{ key: 'tourism', value: 'guest_house' }],
    'ristorante':             [{ key: 'amenity', value: 'restaurant' }],
    'pizzeria':               [{ key: 'amenity', value: 'restaurant' }, { key: 'cuisine', value: 'pizza' }],
    'bar':                    [{ key: 'amenity', value: 'bar' }, { key: 'amenity', value: 'cafe' }],
    'caffè':                  [{ key: 'amenity', value: 'cafe' }],
    'gelateria':              [{ key: 'amenity', value: 'ice_cream' }],
    'panetteria':             [{ key: 'shop', value: 'bakery' }],
    'macelleria':             [{ key: 'shop', value: 'butcher' }],
    'parrucchiere':           [{ key: 'shop', value: 'hairdresser' }],
    'estetista':              [{ key: 'shop', value: 'beauty' }],
    'palestra':               [{ key: 'leisure', value: 'fitness_centre' }, { key: 'leisure', value: 'sports_centre' }],
    'studio dentistico':      [{ key: 'amenity', value: 'dentist' }, { key: 'healthcare', value: 'dentist' }],
    'dentista':               [{ key: 'amenity', value: 'dentist' }],
    'medico':                 [{ key: 'amenity', value: 'doctors' }],
    'farmacia':               [{ key: 'amenity', value: 'pharmacy' }],
    'veterinario':            [{ key: 'amenity', value: 'veterinary' }],
    'avvocato':               [{ key: 'office', value: 'lawyer' }],
    'commercialista':         [{ key: 'office', value: 'accountant' }, { key: 'office', value: 'tax_advisor' }],
    'architetto':             [{ key: 'office', value: 'architect' }],
    'ingegnere':              [{ key: 'office', value: 'engineer' }],
    'agenzia immobiliare':    [{ key: 'office', value: 'estate_agent' }],
    'cantiere nautico':       [{ key: 'craft', value: 'boatbuilder' }, { key: 'industrial', value: 'shipyard' }],
    'concessionaria':         [{ key: 'shop', value: 'car' }],
    'officina':               [{ key: 'shop', value: 'car_repair' }],
    'autoscuola':             [{ key: 'amenity', value: 'driving_school' }],
    'negozio abbigliamento':  [{ key: 'shop', value: 'clothes' }],
    'libreria':               [{ key: 'shop', value: 'books' }],
    'fioraio':                [{ key: 'shop', value: 'florist' }],
    'gioielleria':            [{ key: 'shop', value: 'jewelry' }],
    'ottico':                 [{ key: 'shop', value: 'optician' }],
    'museo':                  [{ key: 'tourism', value: 'museum' }],
    'teatro':                 [{ key: 'amenity', value: 'theatre' }],
    'scuola':                 [{ key: 'amenity', value: 'school' }],
    'asilo':                  [{ key: 'amenity', value: 'kindergarten' }],
};

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

export async function openSourcingModal(niche, onImported) {
    const overlay = buildOverlay('modal-sourcing');
    overlay.innerHTML = buildModalShell(
        'Sorgenti prospect — ' + escHtml(niche.name),
        '',
        buildBodyHTML(niche),
        '<button class="modal-close-x-explicit" style="padding:0.6rem 1.2rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.85rem;font-weight:600;cursor:pointer;">Chiudi</button>'
    );

    document.body.appendChild(overlay);
    overlay.dataset.nicheId = niche.id;

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close-x-explicit').addEventListener('click', close);
    overlay.querySelector('.modal-close-x').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    bindEvents(overlay, niche, onImported, close);
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildBodyHTML(niche) {
    const geoScope = Array.isArray(niche.geo_scope) ? niche.geo_scope : [];
    const hasGeo = geoScope.length > 0;

    // Auto-suggest keyword dal nome nicchia (es. "Strutture ricettive Liguria" → "struttura ricettiva")
    const suggestedKeyword = suggestKeywordFromName(niche.name);

    return (
        '<div>' +
            '<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1.25rem;line-height:1.5;">' +
                'Cerco aziende reali su OpenStreetMap (gratis, illimitato) per la nicchia <strong>' + escHtml(niche.name) + '</strong>. ' +
                'Scegli keyword + città, vedi anteprima, selezioni cosa importare.' +
            '</div>' +

            // Keyword input
            '<div style="margin-bottom:1rem;">' +
                '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Tipo di azienda (keyword)</label>' +
                '<input id="sourcing-keyword" type="text" value="' + escHtml(suggestedKeyword) + '" placeholder="Es. struttura ricettiva, ristorante, parrucchiere" ' +
                    'style="width:100%;padding:0.65rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.88rem;box-sizing:border-box;">' +
                '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:4px;">Esempi supportati: hotel, ristorante, bar, pizzeria, parrucchiere, palestra, studio dentistico, avvocato, agenzia immobiliare… (se non standard, l\'AI mappa al miglior tag OSM)</div>' +
            '</div>' +

            // Geo scope (multi-select)
            '<div style="margin-bottom:1rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                    '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;">Città / aree (' + geoScope.length + ' nel geo_scope)</label>' +
                    (hasGeo ? '<button id="btn-toggle-all-cities" style="font-size:0.7rem;padding:3px 9px;border-radius:6px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;font-weight:600;">Tutte / nessuna</button>' : '') +
                '</div>' +
                (hasGeo
                    ? '<div id="sourcing-cities" style="display:flex;flex-wrap:wrap;gap:4px;max-height:180px;overflow-y:auto;padding:0.5rem;background:var(--bg-tertiary);border-radius:10px;">' +
                        geoScope.map((c, i) =>
                            '<label class="city-chip" style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:8px;background:var(--bg-secondary);font-size:0.78rem;cursor:pointer;border:1px solid var(--glass-border);">' +
                                '<input type="checkbox" data-city="' + escHtml(c) + '" ' + (i < 3 ? 'checked' : '') + ' style="cursor:pointer;">' +
                                '<span>' + escHtml(c) + '</span>' +
                            '</label>'
                        ).join('') +
                    '</div>'
                    : '<div style="padding:0.75rem;background:#f59e0b08;border:1px solid #f59e0b33;border-radius:10px;font-size:0.8rem;color:#92400e;">⚠ Nessuna città nel geo_scope. Analizza prima la nicchia con AI per popolare la lista comuni.</div>'
                ) +
            '</div>' +

            // Search button
            (hasGeo
                ? '<button id="btn-sourcing-search" class="primary-btn" style="width:100%;padding:0.7rem;border-radius:12px;font-size:0.88rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;">' +
                    '<span class="material-icons-round" style="font-size:1.05rem;">travel_explore</span>Cerca aziende reali' +
                  '</button>'
                : '') +

            // Results
            '<div id="sourcing-results" style="margin-top:1rem;"></div>' +
        '</div>'
    );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindEvents(overlay, niche, onImported, close) {
    overlay.querySelector('#btn-toggle-all-cities')?.addEventListener('click', () => {
        const boxes = overlay.querySelectorAll('#sourcing-cities input[type=checkbox]');
        const allChecked = Array.from(boxes).every(b => b.checked);
        boxes.forEach(b => { b.checked = !allChecked; });
    });

    overlay.querySelector('#btn-sourcing-search')?.addEventListener('click', async () => {
        await runSourcing(overlay, niche);
    });
}

async function runSourcing(overlay, niche) {
    const keyword = overlay.querySelector('#sourcing-keyword')?.value?.trim();
    const cityBoxes = overlay.querySelectorAll('#sourcing-cities input[type=checkbox]:checked');
    const cities = Array.from(cityBoxes).map(b => b.dataset.city);

    if (!keyword) { showGlobalAlert('Specifica una keyword', 'error'); return; }
    if (cities.length === 0) { showGlobalAlert('Seleziona almeno una città', 'error'); return; }

    const btn = overlay.querySelector('#btn-sourcing-search');
    const resultsDiv = overlay.querySelector('#sourcing-results');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:1.05rem;animation:spin 1s linear infinite;">refresh</span>Cerco su OSM…';

    resultsDiv.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);background:var(--bg-tertiary);border-radius:12px;">' +
            '<span class="material-icons-round" style="animation:spin 1s linear infinite;">travel_explore</span>' +
            'Cerco "' + escHtml(keyword) + '" in ' + cities.length + ' città…' +
        '</div>';

    try {
        // 1. Risolvi keyword → tag OSM
        const osmTags = await resolveKeywordToOsmTags(keyword);
        if (!osmTags || osmTags.length === 0) {
            throw new Error('Impossibile mappare la keyword a un tag OSM. Prova una keyword più standard (hotel, ristorante, parrucchiere, ecc.)');
        }

        // 2. Query Overpass per ogni città
        const allResults = [];
        for (let i = 0; i < cities.length; i++) {
            const city = cities[i];
            resultsDiv.innerHTML =
                '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);background:var(--bg-tertiary);border-radius:12px;">' +
                    '<span class="material-icons-round" style="animation:spin 1s linear infinite;">travel_explore</span>' +
                    '(' + (i + 1) + '/' + cities.length + ') Cerco in ' + escHtml(city) + '…' +
                '</div>';
            try {
                const cityResults = await queryOverpass(osmTags, city);
                allResults.push(...cityResults.map(r => ({ ...r, _city: city })));
            } catch (err) {
                console.warn('[Sourcing] city failed', city, err);
            }
        }

        // 3. Dedup per nome (case-insensitive)
        const dedupMap = new Map();
        for (const r of allResults) {
            const key = (r.name || '').toLowerCase().trim();
            if (key && !dedupMap.has(key)) dedupMap.set(key, r);
        }
        const unique = Array.from(dedupMap.values());

        // Salva risultati sul nodo overlay per accesso da importSelected
        overlay._sourcingResults = unique;

        // 4. Render risultati
        resultsDiv.innerHTML = buildResultsHTML(unique, keyword, osmTags);

        // Bind import button
        overlay.querySelector('#btn-import-selected')?.addEventListener('click', async () => {
            await importSelected(overlay, niche);
        });

    } catch (err) {
        console.error('[Sourcing] error', err);
        resultsDiv.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;background:#ef444408;border-radius:10px;">Errore: ' + escHtml(err.message) + '</div>';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1.05rem;">travel_explore</span>Cerca aziende reali';
    }
}

function buildResultsHTML(results, keyword, osmTags) {
    if (results.length === 0) {
        return (
            '<div style="padding:1.25rem;background:#f59e0b08;border:1px solid #f59e0b33;border-radius:12px;font-size:0.85rem;color:#92400e;">' +
                '<strong>Nessun risultato trovato.</strong><br>' +
                'Possibili cause: (1) keyword troppo specifica per OSM, (2) zona poco mappata, (3) tag OSM non corretto.<br>' +
                'Tag OSM provati: <code>' + osmTags.map(t => t.key + '=' + t.value).join(', ') + '</code>' +
            '</div>'
        );
    }

    return (
        '<div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin:1.25rem 0 0.75rem;">' +
                '<div>' +
                    '<div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);">' + results.length + ' aziende trovate</div>' +
                    '<div style="font-size:0.72rem;color:var(--text-tertiary);">Da OSM · tag: ' + osmTags.map(t => t.key + '=' + t.value).join(', ') + '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.4rem;">' +
                    '<button id="btn-toggle-all-results" style="font-size:0.74rem;padding:5px 11px;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);cursor:pointer;font-weight:600;">Seleziona tutto</button>' +
                    '<button id="btn-import-selected" class="primary-btn" style="font-size:0.78rem;padding:5px 14px;border-radius:8px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">' +
                        '<span class="material-icons-round" style="font-size:0.95rem;">download</span>Importa selezionati' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div id="sourcing-list" style="max-height:340px;overflow-y:auto;border:1px solid var(--glass-border);border-radius:12px;">' +
                results.map((r, i) => buildResultRow(r, i)).join('') +
            '</div>' +
        '</div>'
    );
}

function buildResultRow(r, index) {
    return (
        '<label style="display:grid;grid-template-columns:auto 1fr auto;gap:0.6rem;align-items:flex-start;padding:0.7rem 0.9rem;border-bottom:1px solid var(--glass-border);cursor:pointer;font-size:0.82rem;">' +
            '<input type="checkbox" class="sourcing-row" data-index="' + index + '" checked style="margin-top:3px;cursor:pointer;">' +
            '<div style="min-width:0;">' +
                '<div style="font-weight:700;color:var(--text-primary);">' + escHtml(r.name || '?') + '</div>' +
                '<div style="font-size:0.72rem;color:var(--text-tertiary);line-height:1.4;margin-top:2px;">' +
                    (r._city ? '<span style="font-weight:600;color:#3b82f6;">📍 ' + escHtml(r._city) + '</span> · ' : '') +
                    (r.address ? escHtml(r.address) + ' · ' : '') +
                    (r.phone ? '📞 ' + escHtml(r.phone) + ' · ' : '') +
                    (r.website ? '🌐 sito ' : '') +
                    (r.email ? '✉ email' : '') +
                '</div>' +
                (r.website ? '<div style="font-size:0.7rem;color:#3b82f6;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(r.website) + '</div>' : '') +
            '</div>' +
            '<span style="font-size:0.65rem;color:var(--text-tertiary);white-space:nowrap;">OSM #' + (index + 1) + '</span>' +
        '</label>'
    );
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

async function importSelected(overlay, niche) {
    // Pesca i risultati selezionati
    const checkedBoxes = overlay.querySelectorAll('.sourcing-row:checked');
    if (checkedBoxes.length === 0) { showGlobalAlert('Seleziona almeno un\'azienda', 'error'); return; }

    const lastResults = overlay._sourcingResults || [];
    const selectedResults = Array.from(checkedBoxes).map(b => lastResults[parseInt(b.dataset.index, 10)]).filter(Boolean);
    if (selectedResults.length === 0) { showGlobalAlert('Nessun risultato valido', 'error'); return; }

    const btn = overlay.querySelector('#btn-import-selected');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;">refresh</span>Importo…';

    try {
        const rows = selectedResults.map(r => ({
            business_name:      r.name || '(senza nome)',
            website:            r.website || null,
            contact_phone:      r.phone || null,
            contact_email:      r.email || null,
            industry:           niche.name || null,
            niche_id:           niche.id,
            funnel_segment:     'cold',
            pipeline_stage:     'sourced',
            acquisition_source: 'outreach',
            stage_history:      [{ stage: 'sourced', entered_at: new Date().toISOString() }],
            notes:              r.address ? 'Indirizzo: ' + r.address + ' · Fonte: OSM' : 'Fonte: OSM',
            ai_enrichment_data: {
                osm_id: r.osm_id || null,
                osm_tags: r.osm_tags || {},
                city_origin: r._city || null,
                sourced_at: new Date().toISOString(),
            },
        }));

        // Step 1: insert dei prospect con dati base OSM
        const { data: inserted, error } = await supabase.from('prospects').insert(rows).select('id, website, contact_email, contact_phone, linkedin_url, social_links, ai_enrichment_data');
        if (error) throw error;

        showGlobalAlert(rows.length + ' prospect importati. Avvio scraping aggressivo in background…', 'success');

        // Step 2: scraping aggressivo dei siti web (background, in batch concorrenti)
        // Estrae email/social/phones dal sito, calcola completeness_score, aggiorna prospect.
        // NIENTE testo grezzo salvato nel DB (regola DB lean).
        await runAggressiveScraping(overlay, inserted || []);

    } catch (err) {
        console.error('[Import] error', err);
        showGlobalAlert('Errore import: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;">download</span>Importa selezionati';
    }
}

/**
 * Sourcing aggressivo: per ogni prospect appena importato con sito web,
 * lancia scraping → estrae email/social/phones → calcola completeness → update prospect.
 * Concorrenza limitata per non saturare l'edge function.
 * UI: progress bar e contatori live.
 */
async function runAggressiveScraping(overlay, prospects) {
    const targets = prospects.filter(p => p.website);
    const skipped = prospects.length - targets.length;

    // Sostituisce i risultati con un pannello di progress
    const resultsDiv = overlay.querySelector('#sourcing-results');
    if (resultsDiv) {
        resultsDiv.innerHTML =
            '<div style="padding:1.25rem;background:#3b82f608;border:1px solid #3b82f622;border-radius:14px;">' +
                '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">' +
                    '<span class="material-icons-round" style="font-size:1.1rem;color:#3b82f6;animation:spin 1s linear infinite;">refresh</span>' +
                    '<span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">Scraping aggressivo — estraggo email/social/contenuto dai siti</span>' +
                '</div>' +
                '<div id="aggro-progress" style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.6rem;">' +
                    '0/' + targets.length + ' completati' + (skipped > 0 ? ' · ' + skipped + ' senza sito (saltati)' : '') +
                '</div>' +
                '<div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;">' +
                    '<div id="aggro-bar" style="height:100%;width:0%;background:#3b82f6;border-radius:4px;transition:width 0.3s;"></div>' +
                '</div>' +
                '<div id="aggro-stats" style="font-size:0.72rem;color:var(--text-tertiary);margin-top:0.6rem;">Email trovate: 0 · Social trovati: 0 · Completi (≥60): 0</div>' +
            '</div>';
    }

    // Concorrenza limitata (max 3 fetch in parallelo)
    const CONCURRENCY = 3;
    let done = 0;
    let foundEmails = 0;
    let foundSocials = 0;
    let highCompleteness = 0;

    const updateUi = (currentTarget) => {
        if (!resultsDiv) return;
        const progress = overlay.querySelector('#aggro-progress');
        const bar = overlay.querySelector('#aggro-bar');
        const stats = overlay.querySelector('#aggro-stats');
        const pct = targets.length === 0 ? 100 : Math.round((done / targets.length) * 100);
        if (progress) progress.textContent = done + '/' + targets.length + ' completati' + (currentTarget ? ' · in corso: ' + currentTarget.substr(0, 50) : '');
        if (bar) bar.style.width = pct + '%';
        if (stats) stats.textContent = 'Email trovate: ' + foundEmails + ' · Social trovati: ' + foundSocials + ' · Completi (≥60): ' + highCompleteness;
    };

    // Worker pool
    const queue = [...targets];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length > 0) {
            const p = queue.shift();
            if (!p) break;
            updateUi(p.website);
            try {
                const scrape = await scrapeProspectSite(p.website);
                const update = buildLeanUpdatePayload(p, scrape);
                if (update.contact_email) foundEmails++;
                if (update.social_links && Object.keys(update.social_links).length > 0) foundSocials++;
                if (update.completeness_score >= 60) highCompleteness++;
                update.id = p.id;
                await supabase.from('prospects').update(update).eq('id', p.id);
            } catch (err) {
                console.warn('[AggroScrape] fail', p.website, err);
            }
            done++;
            updateUi();
        }
    });
    await Promise.all(workers);

    // Done
    if (resultsDiv) {
        resultsDiv.innerHTML =
            '<div style="padding:1.25rem;background:#10b98108;border:1px solid #10b98133;border-radius:14px;">' +
                '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">' +
                    '<span class="material-icons-round" style="font-size:1.2rem;color:#10b981;">check_circle</span>' +
                    '<span style="font-size:0.95rem;font-weight:800;color:var(--text-primary);">Scraping completato</span>' +
                '</div>' +
                '<div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;">' +
                    targets.length + ' siti analizzati. ' +
                    foundEmails + ' email estratte. ' +
                    foundSocials + ' set di social trovati. ' +
                    highCompleteness + ' prospect promettenti (completeness ≥ 60).' +
                    (skipped > 0 ? '<br>' + skipped + ' prospect senza sito (skip).' : '') +
                '</div>' +
                '<button class="primary-btn" onclick="window.location.hash=\'sales-niche/' + (overlay.dataset.nicheId || '') + '\'" style="margin-top:0.8rem;font-size:0.82rem;padding:0.55rem 1.1rem;border-radius:10px;font-weight:700;">Vai alla nicchia</button>' +
            '</div>';
    }
}

// ─── OVERPASS QUERY ──────────────────────────────────────────────────────────

async function queryOverpass(osmTags, city) {
    // Costruisce filtro per tutti i tag (OR)
    const tagFilters = osmTags.map(t => `"${t.key}"="${t.value}"`).join('|"');
    // Query: trova area "city" → cerca node/way/relation con tag dentro l'area
    const tagBlocks = osmTags.map(t =>
        `node["${t.key}"="${t.value}"](area.searchArea);` +
        `way["${t.key}"="${t.value}"](area.searchArea);` +
        `relation["${t.key}"="${t.value}"](area.searchArea);`
    ).join('');

    const query = `
[out:json][timeout:25];
area["name"="${city.replace(/"/g, '')}"]->.searchArea;
(
  ${tagBlocks}
);
out tags center 150;
`;

    const resp = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
    });

    if (!resp.ok) throw new Error('Overpass HTTP ' + resp.status);
    const json = await resp.json();
    const elements = json.elements || [];

    return elements.map(el => {
        const t = el.tags || {};
        return {
            osm_id: el.type + '/' + el.id,
            osm_tags: t,
            name: t.name || t['name:it'] || t.brand || null,
            website: t.website || t['contact:website'] || null,
            phone: t.phone || t['contact:phone'] || null,
            email: t.email || t['contact:email'] || null,
            address: [t['addr:street'], t['addr:housenumber'], t['addr:city']].filter(Boolean).join(' ') || null,
        };
    }).filter(r => r.name); // scarta quelle senza nome
}

// ─── KEYWORD MAPPING ─────────────────────────────────────────────────────────

async function resolveKeywordToOsmTags(keyword) {
    const lower = keyword.toLowerCase().trim();

    // 1. Hit hardcoded?
    if (KEYWORD_TO_OSM_TAGS[lower]) return KEYWORD_TO_OSM_TAGS[lower];

    // 2. Match parziale hardcoded
    for (const [k, tags] of Object.entries(KEYWORD_TO_OSM_TAGS)) {
        if (lower.includes(k) || k.includes(lower)) return tags;
    }

    // 3. Fallback AI: chiedi a Gemini di mappare
    try {
        const schema = {
            tags: [{ key: 'string', value: 'string' }],
            rationale: 'string',
        };
        const result = await completeJSON(
            'Mappa la keyword italiana "' + keyword + '" ai tag OpenStreetMap (OSM) più rilevanti.\n' +
            'Formato output: array di tag {key, value} dello schema OSM.\n' +
            'Esempi:\n' +
            '- "hotel" → [{key:"tourism",value:"hotel"},{key:"tourism",value:"guest_house"}]\n' +
            '- "studio dentistico" → [{key:"amenity",value:"dentist"},{key:"healthcare",value:"dentist"}]\n' +
            '- "officina meccanica" → [{key:"shop",value:"car_repair"}]\n' +
            'Massimo 4 tag. Solo tag OSM validi.',
            schema,
            { feature: 'sales_sourcing_kwmap', model: MODEL, system: 'Sei un esperto di OpenStreetMap tagging. Rispondi SOLO in JSON valido.' }
        );
        return (result.tags || []).filter(t => t.key && t.value);
    } catch (err) {
        console.warn('[Sourcing] AI keyword mapping failed', err);
        return [];
    }
}

function suggestKeywordFromName(nicheName) {
    if (!nicheName) return '';
    const lower = nicheName.toLowerCase();
    // Cerca match con la lista hardcoded
    for (const k of Object.keys(KEYWORD_TO_OSM_TAGS)) {
        if (lower.includes(k)) return k;
    }
    // Default: prima parola
    return nicheName.split(/\s+/)[0] || '';
}

// ─── MODAL SHELL (riusa lo stesso pattern di niches.js) ──────────────────────

function buildOverlay(id) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    return overlay;
}

function buildModalShell(title, headerExtra, bodyHTML, footerHTML) {
    return (
        '<div style="background:var(--bg-primary, #ffffff);border-radius:20px;padding:2rem;max-width:860px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.35);border:1px solid var(--glass-border, rgba(0,0,0,0.08));">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">' +
                '<h2 style="font-size:1.25rem;font-weight:800;font-family:var(--font-titles);margin:0;">' + title + '</h2>' +
                '<div style="display:flex;gap:0.4rem;align-items:center;">' +
                    headerExtra +
                    '<button class="modal-close-x" style="background:var(--bg-tertiary);color:var(--text-secondary);border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;cursor:pointer;">✕</button>' +
                '</div>' +
            '</div>' +
            bodyHTML +
            '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--glass-border);">' +
                footerHTML +
            '</div>' +
        '</div>'
    );
}

// Toggle-all results bind (delegato dopo render)
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-toggle-all-results') {
        const list = document.querySelector('#sourcing-list');
        if (!list) return;
        const boxes = list.querySelectorAll('input[type=checkbox]');
        const allChecked = Array.from(boxes).every(b => b.checked);
        boxes.forEach(b => { b.checked = !allChecked; });
    }
});

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
