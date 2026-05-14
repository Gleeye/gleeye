/**
 * sales/prospects_view.js
 * Vista globale TUTTI i prospect (#sales-prospects).
 * Tabella unica cross-nicchia con filtri ricchi: settore, nicchia, status, completeness, promising,
 * ha-email/telefono/social/rating, località, ricerca per nome.
 *
 * Punto di osservazione orizzontale: vedi tutta la massa lavorabile a colpo d'occhio.
 */

import { supabase } from '../../modules/config.js?v=8001';
import { fetchSapServicesForSales, fetchIndustrySectors } from './api.js?v=8001';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';
import { openProspectModal } from './pipeline_board.js?v=8003';

const STATUS_TYPES = [
    { key: 'all',         label: 'Tutti' },
    { key: 'sourced',     label: 'Solo sourceati (non in pipeline)' },
    { key: 'in_pipeline', label: 'Solo in pipeline' },
    { key: 'cold',        label: 'Cold' },
    { key: 'contacted',   label: 'Contatto inviato' },
    { key: 'replied',     label: 'Risposto' },
    { key: 'proposal_sent', label: 'Proposta inviata' },
    { key: 'converted',   label: 'Convertito' },
];

const _state = new WeakMap();

export async function renderProspectsView(container) {
    container.innerHTML = loadingHTML('Caricamento prospect…');

    try {
        const [prospects, niches, sectors] = await Promise.all([
            fetchAllProspects(),
            supabase.from('outreach_niches').select('id, name, sector_id, sector:industry_sectors(id, slug, name, icon)').then(r => r.data || []),
            fetchIndustrySectors(),
        ]);

        const state = _state.get(container) || {
            filters: {
                search: '',
                sortBy: 'completeness',
                sortDir: 'desc',
                nicheId: '',
                sectorId: '',
                cities: [],
                minCompleteness: 0,
                minPromising: 0,
                status: 'all',
                has_email: false,
                has_phone: false,
                has_social: false,
                has_rating: false,
            },
        };
        _state.set(container, state);

        const ctx = { prospects, niches, sectors, container, state };
        container.innerHTML = buildPageHTML(ctx);
        bindEvents(ctx);
    } catch (err) {
        console.error('[ProspectsView] error', err);
        container.innerHTML = '<div style="padding:2rem;color:red;">Errore: ' + escHtml(err.message) + '</div>';
    }
}

async function fetchAllProspects() {
    const { data, error } = await supabase
        .from('prospects')
        .select(`
            *,
            target_sap:core_services(id, name),
            niche:outreach_niches(id, name, sector_id, sector:industry_sectors(id, slug, name, icon))
        `)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildPageHTML(ctx) {
    const { prospects, niches, sectors, state } = ctx;

    // Filtra
    const filtered = applyFilters(prospects, state.filters);

    // KPI
    const total = prospects.length;
    const completi = prospects.filter(p => (p.completeness_score || 0) >= 60).length;
    const promettenti = prospects.filter(p => ((p.ai_enrichment_data || {}).promising_score || 0) >= 70).length;
    const inPipeline = prospects.filter(p => p.pipeline_stage && p.pipeline_stage !== 'sourced').length;
    const conEmail = prospects.filter(p => p.contact_email).length;
    const conSocial = prospects.filter(p => {
        const s = p.social_links || {};
        return Object.keys(s).filter(k => s[k]).length > 0;
    }).length;

    // Lista città disponibili dai prospect (per filtro)
    const cities = Array.from(new Set(prospects.map(p => (p.ai_enrichment_data || {}).city_origin).filter(Boolean))).sort();

    return (
        '<div class="animate-fade-in" style="max-width:1400px;margin:0 auto;padding:1.25rem 1.5rem 2rem;">' +
            // Header
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;">' +
                '<div>' +
                    '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">Prospect</h1>' +
                    '<div style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.25rem;">' +
                        'Tutti i prospect cross-nicchia · ' + total + ' totali · ' + filtered.length + ' filtrati' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
                    '<a href="#sales-niches" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                        '<span class="material-icons-round" style="font-size:1rem;">explore</span>Nicchie' +
                    '</a>' +
                    '<a href="#sales-pipeline" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                        '<span class="material-icons-round" style="font-size:1rem;">view_kanban</span>Pipeline' +
                    '</a>' +
                '</div>' +
            '</div>' +
            // KPI row compatta
            '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:0.6rem;margin-bottom:1rem;">' +
                kpiMiniCard('Totali', total, 'people', 'var(--brand-blue)') +
                kpiMiniCard('Completi ≥60', completi, 'check_circle', '#10b981') +
                kpiMiniCard('Promettenti ≥70', promettenti, 'trending_up', '#10b981') +
                kpiMiniCard('In pipeline', inPipeline, 'forward_to_inbox', '#3b82f6') +
                kpiMiniCard('Con email', conEmail, 'mail', '#f59e0b') +
                kpiMiniCard('Con social', conSocial, 'public', '#8b5cf6') +
            '</div>' +

            // FILTRI TOOLBAR
            buildFiltersToolbar(ctx, niches, sectors, cities) +

            // TABELLA
            (filtered.length === 0
                ? '<div style="padding:3rem;text-align:center;border:2px dashed var(--glass-border);border-radius:14px;color:var(--text-tertiary);">' +
                    '<span class="material-icons-round" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:0.5rem;">filter_alt_off</span>' +
                    '<div style="font-size:0.95rem;font-weight:700;color:var(--text-primary);margin-bottom:0.4rem;">Nessun prospect corrisponde ai filtri</div>' +
                    '<button id="filter-reset-empty" style="margin-top:0.6rem;font-size:0.85rem;padding:0.45rem 1rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--brand-blue);cursor:pointer;font-weight:700;">Reset filtri</button>' +
                  '</div>'
                : buildTable(filtered)
            ) +
        '</div>'
    );
}

function kpiMiniCard(label, value, icon, color) {
    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:0.7rem 0.85rem;display:flex;align-items:center;gap:0.6rem;">' +
            '<span class="material-icons-round" style="font-size:1.4rem;color:' + color + ';">' + icon + '</span>' +
            '<div>' +
                '<div style="font-size:0.62rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">' + label + '</div>' +
                '<div style="font-size:1.3rem;font-weight:900;color:var(--text-primary);line-height:1;font-family:var(--font-titles);">' + value + '</div>' +
            '</div>' +
        '</div>'
    );
}

function buildFiltersToolbar(ctx, niches, sectors, cities) {
    const f = ctx.state.filters;

    const sectorOptions = '<option value="">— tutti i settori —</option>' +
        sectors.map(s => '<option value="' + s.id + '"' + (f.sectorId === s.id ? ' selected' : '') + '>' + escHtml(s.name) + '</option>').join('');

    // Filtra le nicchie per settore se selezionato
    const nicheList = f.sectorId ? niches.filter(n => n.sector_id === f.sectorId) : niches;
    const nicheOptions = '<option value="">— tutte le nicchie —</option>' +
        nicheList.map(n => '<option value="' + n.id + '"' + (f.nicheId === n.id ? ' selected' : '') + '>' + escHtml(n.name) + (n.sector ? ' (' + escHtml(n.sector.name) + ')' : '') + '</option>').join('');

    const statusOptions = STATUS_TYPES.map(s => '<option value="' + s.key + '"' + (f.status === s.key ? ' selected' : '') + '>' + s.label + '</option>').join('');

    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:0.75rem 0.9rem;margin-bottom:0.75rem;">' +
            // Riga 1: search + select + sort + reset
            '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:0.5rem;align-items:end;">' +
                '<div>' +
                    fieldLabel('Cerca azienda') +
                    '<input id="pv-search" type="text" value="' + escHtml(f.search) + '" placeholder="Nome..." style="width:100%;padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.82rem;box-sizing:border-box;">' +
                '</div>' +
                '<div>' + fieldLabel('Settore') +
                    '<select id="pv-sector" style="padding:0.45rem 0.6rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;width:100%;">' + sectorOptions + '</select></div>' +
                '<div>' + fieldLabel('Nicchia') +
                    '<select id="pv-niche" style="padding:0.45rem 0.6rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;width:100%;">' + nicheOptions + '</select></div>' +
                '<div>' + fieldLabel('Stato') +
                    '<select id="pv-status" style="padding:0.45rem 0.6rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;width:100%;">' + statusOptions + '</select></div>' +
                '<div>' + fieldLabel('Ordina per') +
                    '<select id="pv-sort" style="padding:0.45rem 0.6rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.8rem;width:100%;">' +
                        sortOpt('completeness_desc', f, 'Completezza ↓') +
                        sortOpt('completeness_asc',  f, 'Completezza ↑') +
                        sortOpt('promising_desc',    f, 'Promising AI ↓') +
                        sortOpt('promising_asc',     f, 'Promising AI ↑') +
                        sortOpt('alpha_asc',         f, 'A→Z') +
                        sortOpt('alpha_desc',        f, 'Z→A') +
                        sortOpt('created_desc',      f, 'Più recenti') +
                    '</select></div>' +
                '<button id="pv-reset" style="padding:0.45rem 0.85rem;border-radius:8px;border:1px solid var(--glass-border);background:var(--bg-tertiary);color:var(--text-secondary);font-size:0.78rem;font-weight:600;cursor:pointer;height:fit-content;">Reset</button>' +
            '</div>' +
            // Riga 2: "Deve avere" toggles + soglie
            '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed var(--glass-border);align-items:center;">' +
                '<span style="font-size:0.7rem;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Deve avere:</span>' +
                hasFilterPill('has_email', 'Email', '✉', f) +
                hasFilterPill('has_phone', 'Telefono', '☎', f) +
                hasFilterPill('has_social', 'Social', '🔗', f) +
                hasFilterPill('has_rating', 'Rating Google', '⭐', f) +
                '<span style="margin-left:0.6rem;font-size:0.7rem;color:var(--text-tertiary);font-weight:600;">Completezza min:</span>' +
                '<input id="pv-min-completeness" type="number" min="0" max="100" step="10" value="' + f.minCompleteness + '" style="width:60px;padding:3px 6px;border-radius:6px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.74rem;">' +
                '<span style="font-size:0.7rem;color:var(--text-tertiary);font-weight:600;">Promising min:</span>' +
                '<input id="pv-min-promising" type="number" min="0" max="100" step="10" value="' + f.minPromising + '" style="width:60px;padding:3px 6px;border-radius:6px;border:1px solid var(--glass-border);background:var(--bg-primary);color:var(--text-primary);font-size:0.74rem;">' +
            '</div>' +
            // Riga 3: località pillole multi
            (cities.length > 0
                ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed var(--glass-border);align-items:center;">' +
                    '<span style="font-size:0.7rem;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-right:4px;">Località' + (f.cities.length > 0 ? ' (' + f.cities.length + ' attive)' : '') + ':</span>' +
                    cities.slice(0, 50).map(city => {
                        const cityClean = String(city).trim();
                        const selected = f.cities.includes(cityClean);
                        return '<button class="pv-city-pill" data-city="' + escHtml(cityClean) + '" style="font-size:0.7rem;padding:3px 9px;border-radius:8px;border:1px solid ' + (selected ? '#3b82f6' : 'var(--glass-border)') + ';background:' + (selected ? '#3b82f620' : 'var(--bg-tertiary)') + ';color:' + (selected ? '#3b82f6' : 'var(--text-secondary)') + ';cursor:pointer;font-weight:' + (selected ? '700' : '600') + ';">' + escHtml(cityClean) + '</button>';
                    }).join('') +
                    (cities.length > 50 ? '<span style="font-size:0.7rem;color:var(--text-tertiary);">+' + (cities.length - 50) + '</span>' : '') +
                    (f.cities.length > 0
                        ? '<button id="pv-cities-clear" style="margin-left:6px;font-size:0.68rem;padding:2px 8px;border-radius:6px;border:none;background:#ef444415;color:#ef4444;cursor:pointer;font-weight:700;">pulisci</button>'
                        : '') +
                  '</div>'
                : '') +
        '</div>'
    );
}

function sortOpt(value, f, label) {
    const cur = f.sortBy + '_' + f.sortDir;
    return '<option value="' + value + '"' + (cur === value ? ' selected' : '') + '>' + label + '</option>';
}

function hasFilterPill(key, label, icon, filters) {
    const active = !!filters[key];
    return '<button class="pv-has-pill" data-key="' + key + '" style="font-size:0.7rem;padding:3px 9px;border-radius:8px;border:1px solid ' + (active ? '#10b981' : 'var(--glass-border)') + ';background:' + (active ? '#10b98120' : 'var(--bg-tertiary)') + ';color:' + (active ? '#10b981' : 'var(--text-secondary)') + ';cursor:pointer;font-weight:' + (active ? '700' : '600') + ';display:inline-flex;align-items:center;gap:3px;">' +
        '<span>' + icon + '</span>' + label +
    '</button>';
}

function buildTable(prospects) {
    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;overflow:hidden;">' +
            // Header sticky
            '<div style="display:grid;grid-template-columns:1fr 130px 100px 90px 80px 100px;gap:0.6rem;padding:0.55rem 0.9rem;background:var(--bg-tertiary);font-size:0.68rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid var(--glass-border);position:sticky;top:0;z-index:1;">' +
                '<div>Azienda · Località</div>' +
                '<div>Nicchia</div>' +
                '<div style="text-align:center;">Completezza</div>' +
                '<div style="text-align:center;">Promising</div>' +
                '<div style="text-align:center;">Rating</div>' +
                '<div>Stato</div>' +
            '</div>' +
            '<div style="max-height:64vh;overflow-y:auto;">' +
                prospects.map(p => buildRow(p)).join('') +
            '</div>' +
        '</div>'
    );
}

function buildRow(p) {
    const e = p.ai_enrichment_data || {};
    const completeness = p.completeness_score;
    const promising = e.promising_score;
    const compColor = completeness == null ? '#94a3b8' : completeness >= 60 ? '#10b981' : completeness >= 30 ? '#f59e0b' : '#ef4444';
    const promColor = promising == null ? '#94a3b8' : promising >= 70 ? '#10b981' : promising >= 40 ? '#f59e0b' : '#94a3b8';
    const stage = p.pipeline_stage || 'sourced';
    const stageColors = { sourced: '#94a3b8', cold: '#3b82f6', contacted: '#3b82f6', replied: '#f59e0b', proposal_sent: '#8b5cf6', converted: '#10b981' };
    const stageColor = stageColors[stage] || '#94a3b8';
    const socials = p.social_links || {};
    const socialCount = Object.keys(socials).filter(k => socials[k]).length;
    const rating = e.google_rating;
    const reviewsCount = e.google_reviews_count;

    return (
        '<div class="pv-row" data-id="' + p.id + '" style="display:grid;grid-template-columns:1fr 130px 100px 90px 80px 100px;gap:0.6rem;padding:0.6rem 0.9rem;border-bottom:1px solid var(--glass-border);align-items:center;font-size:0.82rem;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'\'">' +
            '<div style="min-width:0;">' +
                '<div style="font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(p.business_name) + '</div>' +
                '<div style="font-size:0.7rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;gap:6px;align-items:center;">' +
                    (e.city_origin ? '<span>📍 ' + escHtml(e.city_origin) + '</span>' : '') +
                    (p.contact_email ? '<span>✉</span>' : '') +
                    (p.contact_phone ? '<span>☎</span>' : '') +
                    (socialCount > 0 ? '<span>🔗' + socialCount + '</span>' : '') +
                '</div>' +
            '</div>' +
            '<div style="font-size:0.74rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                (p.niche ? '<span style="color:var(--brand-blue);">' + escHtml(p.niche.name) + '</span>' : '<span style="opacity:0.5;">—</span>') +
            '</div>' +
            '<div style="text-align:center;">' +
                (completeness != null
                    ? '<span style="font-size:0.74rem;font-weight:800;padding:3px 8px;border-radius:6px;background:' + compColor + '15;color:' + compColor + ';">' + completeness + '</span>'
                    : '<span style="font-size:0.68rem;color:var(--text-tertiary);">—</span>') +
            '</div>' +
            '<div style="text-align:center;">' +
                (promising != null
                    ? '<span style="font-size:0.74rem;font-weight:800;padding:3px 8px;border-radius:6px;background:' + promColor + '15;color:' + promColor + ';">' + promising + '</span>'
                    : '<span style="font-size:0.68rem;color:var(--text-tertiary);">—</span>') +
            '</div>' +
            '<div style="text-align:center;font-size:0.78rem;font-weight:700;">' +
                (rating
                    ? '<span style="color:#d97706;">⭐ ' + Number(rating).toFixed(1) + (reviewsCount ? ' <span style="font-weight:500;opacity:0.7;font-size:0.7rem;">(' + reviewsCount + ')</span>' : '') + '</span>'
                    : '<span style="color:var(--text-tertiary);opacity:0.5;">—</span>') +
            '</div>' +
            '<div>' +
                '<span style="font-size:0.65rem;font-weight:700;padding:3px 7px;border-radius:6px;background:' + stageColor + '15;color:' + stageColor + ';text-transform:uppercase;letter-spacing:0.04em;">' + stage + '</span>' +
            '</div>' +
        '</div>'
    );
}

// ─── FILTER LOGIC ────────────────────────────────────────────────────────────

function applyFilters(prospects, f) {
    let out = prospects.slice();

    // Settore (via niche.sector_id)
    if (f.sectorId) out = out.filter(p => p.niche?.sector_id === f.sectorId);

    // Nicchia
    if (f.nicheId) out = out.filter(p => p.niche_id === f.nicheId);

    // Stato
    if (f.status === 'sourced') out = out.filter(p => p.pipeline_stage === 'sourced');
    else if (f.status === 'in_pipeline') out = out.filter(p => p.pipeline_stage && p.pipeline_stage !== 'sourced');
    else if (f.status && f.status !== 'all') out = out.filter(p => p.pipeline_stage === f.status);

    // Località
    if (f.cities && f.cities.length > 0) {
        const set = new Set(f.cities.map(c => String(c).trim()));
        out = out.filter(p => {
            const c = (p.ai_enrichment_data || {}).city_origin;
            return c && set.has(String(c).trim());
        });
    }

    // Has-X
    if (f.has_email) out = out.filter(p => !!p.contact_email);
    if (f.has_phone) out = out.filter(p => !!p.contact_phone);
    if (f.has_social) out = out.filter(p => {
        const s = p.social_links || {};
        return Object.keys(s).filter(k => s[k]).length > 0;
    });
    if (f.has_rating) out = out.filter(p => {
        const e = p.ai_enrichment_data || {};
        return e.google_rating != null && Number(e.google_rating) > 0;
    });

    // Soglie
    if (f.minCompleteness > 0) out = out.filter(p => (p.completeness_score || 0) >= f.minCompleteness);
    if (f.minPromising > 0) out = out.filter(p => ((p.ai_enrichment_data || {}).promising_score || 0) >= f.minPromising);

    // Search
    if (f.search && f.search.trim()) {
        const q = f.search.toLowerCase().trim();
        out = out.filter(p => (p.business_name || '').toLowerCase().includes(q));
    }

    // Sort
    const dir = f.sortDir === 'desc' ? -1 : 1;
    const getCompl = p => p.completeness_score || 0;
    const getProm  = p => (p.ai_enrichment_data || {}).promising_score || 0;
    if (f.sortBy === 'completeness') out.sort((a, b) => dir * (getCompl(a) - getCompl(b)));
    else if (f.sortBy === 'promising') out.sort((a, b) => dir * (getProm(a) - getProm(b)));
    else if (f.sortBy === 'alpha') out.sort((a, b) => dir * (a.business_name || '').localeCompare(b.business_name || ''));
    else if (f.sortBy === 'created') out.sort((a, b) => dir * (new Date(a.created_at || 0) - new Date(b.created_at || 0)));

    return out;
}

// ─── EVENTS ──────────────────────────────────────────────────────────────────

function bindEvents(ctx) {
    const { container, state, prospects } = ctx;

    const reRender = () => {
        container.innerHTML = buildPageHTML(ctx);
        bindEvents(ctx);
    };

    container.querySelector('#pv-search')?.addEventListener('input', e => { state.filters.search = e.target.value; reRender(); });
    container.querySelector('#pv-sector')?.addEventListener('change', e => {
        state.filters.sectorId = e.target.value;
        state.filters.nicheId = ''; // reset nicchia se cambio settore
        reRender();
    });
    container.querySelector('#pv-niche')?.addEventListener('change', e => { state.filters.nicheId = e.target.value; reRender(); });
    container.querySelector('#pv-status')?.addEventListener('change', e => { state.filters.status = e.target.value; reRender(); });
    container.querySelector('#pv-sort')?.addEventListener('change', e => {
        const [by, dir] = e.target.value.split('_');
        state.filters.sortBy = by;
        state.filters.sortDir = dir;
        reRender();
    });
    container.querySelector('#pv-min-completeness')?.addEventListener('change', e => { state.filters.minCompleteness = parseInt(e.target.value, 10) || 0; reRender(); });
    container.querySelector('#pv-min-promising')?.addEventListener('change', e => { state.filters.minPromising = parseInt(e.target.value, 10) || 0; reRender(); });
    container.querySelectorAll('.pv-has-pill').forEach(p => {
        p.addEventListener('click', () => { state.filters[p.dataset.key] = !state.filters[p.dataset.key]; reRender(); });
    });
    container.querySelectorAll('.pv-city-pill').forEach(p => {
        p.addEventListener('click', () => {
            const city = String(p.dataset.city || '').trim();
            const idx = state.filters.cities.indexOf(city);
            if (idx >= 0) state.filters.cities.splice(idx, 1);
            else state.filters.cities.push(city);
            reRender();
        });
    });
    container.querySelector('#pv-cities-clear')?.addEventListener('click', () => { state.filters.cities = []; reRender(); });
    const resetFn = () => {
        state.filters = { search: '', sortBy: 'completeness', sortDir: 'desc', nicheId: '', sectorId: '', cities: [], minCompleteness: 0, minPromising: 0, status: 'all', has_email: false, has_phone: false, has_social: false, has_rating: false };
        reRender();
    };
    container.querySelector('#pv-reset')?.addEventListener('click', resetFn);
    container.querySelector('#filter-reset-empty')?.addEventListener('click', resetFn);

    // Click row → modal prospect
    container.querySelectorAll('.pv-row').forEach(row => {
        row.addEventListener('click', async () => {
            const id = row.dataset.id;
            const p = prospects.find(x => x.id === id);
            if (!p) return;
            try {
                const sapServices = await fetchSapServicesForSales();
                openProspectModal(p, sapServices, () => renderProspectsView(container));
            } catch (err) {
                showGlobalAlert('Errore: ' + err.message, 'error');
            }
        });
    });
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function loadingHTML(label) {
    return '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary);gap:0.75rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>' + label + '</div>';
}

function fieldLabel(label) {
    return '<label style="font-size:0.65rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:3px;">' + label + '</label>';
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
