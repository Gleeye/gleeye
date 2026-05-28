// workspace_navigator — UN solo posto che mostra TUTTO ciò che è attaccato
// a un livello della gerarchia PM (area / cliente / commessa / pm_space / pm_item).
//
// Modello a 4 famiglie:
//   🎙️ Report     → doc_pages.metadata.source = 'voice_memo'
//   📝 Appunti    → doc_pages (page_type='page' OR 'whiteboard'); Doc + Whiteboard
//   📁 File       → pm_spaces.cloud_links (jsonb, fonte Dropbox per ora)
//   🔗 Risorse    → tabella `resources` (shortcut/link esterni ricorrenti)
//
// La vista è gerarchica: aggrega i child-space (cluster→progetti, oppure tutti i
// pm_space dell'area). Per ora UI a sezioni espandibili per child-space.
// Step successivo: navigazione fino al singolo pm_item.

import { supabase } from '../../modules/config.js?v=8000';
import { openFullscreenEditor } from '../docs/DocsView.js?v=8003';

const KIND_META = {
    report: { label: 'Report', icon: 'mic', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.10)' },
    appunti: { label: 'Appunti', icon: 'edit_note', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.10)' },
    file: { label: 'File', icon: 'folder', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)' },
    risorse: { label: 'Risorse', icon: 'link', color: '#10b981', bg: 'rgba(16, 185, 129, 0.10)' },
};

function _pageKind(p) {
    if (p?.metadata?.source === 'voice_memo') return 'report';
    return 'appunti'; // include page_type='whiteboard' o 'page'
}

function _pageIcon(p) {
    if (p?.metadata?.source === 'voice_memo') return 'mic';
    if (p?.page_type === 'whiteboard') return 'gesture';
    return 'description';
}

function _pageTypeLabel(p) {
    if (p?.metadata?.source === 'voice_memo') return 'Report';
    if (p?.page_type === 'whiteboard') return 'Whiteboard';
    return 'Doc';
}

function _fileIconForLink(link) {
    const t = (link?.source || '').toLowerCase();
    if (t.includes('drive')) return 'cloud';
    return 'cloud_queue'; // dropbox default
}

function _fileLabelForLink(link) {
    const t = (link?.source || '').toLowerCase();
    if (t.includes('drive')) return 'Drive';
    return 'Dropbox';
}

/**
 * @param {HTMLElement} container
 * @param {Object} opts
 *   - scope: 'area' | 'client' | 'pm_space' | 'pm_item'
 *   - scopeId: string (slug per area, uuid altrimenti)
 *   - pmSpaceIds: string[] — pm_spaces che fanno parte di questo scope (per aggregare)
 *   - spaceNamesMap: {id: name}
 *   - itemIds?: string[] — opzionale, pm_items di interesse
 */
export async function renderWorkspaceNavigator(container, opts = {}) {
    const {
        scope = 'pm_space',
        scopeId = null,
        pmSpaceIds = [],
        spaceNamesMap = {},
    } = opts;

    container.innerHTML = '<div style="display:flex;justify-content:center;padding:2rem;"><span class="loader"></span></div>';

    // ─── FETCH ────────────────────────────────────────────────────────────────
    let docPages = [];
    let files = []; // { title, url, source, added_at, pmSpaceId }
    let resources = []; // resources table rows
    let pmSpaces = []; // metadata per child-space

    try {
        // 1. doc_spaces dei pm_space coinvolti
        if (pmSpaceIds.length > 0) {
            const { data: ds } = await supabase
                .from('doc_spaces')
                .select('id, space_ref')
                .in('space_ref', pmSpaceIds);
            const dsToPm = {};
            (ds || []).forEach(d => { dsToPm[d.id] = d.space_ref; });
            const dsIds = (ds || []).map(d => d.id);

            // 2. doc_pages per quegli doc_space
            if (dsIds.length > 0) {
                const { data: pages } = await supabase
                    .from('doc_pages')
                    .select('id, title, created_at, metadata, page_type, space_ref, item_ref')
                    .in('space_ref', dsIds)
                    .order('created_at', { ascending: false });
                docPages = (pages || []).map(p => ({ ...p, _pmSpaceId: dsToPm[p.space_ref] || null }));
            }

            // 3. pm_spaces metadata + cloud_links
            const { data: ps } = await supabase
                .from('pm_spaces')
                .select('id, name, cloud_links, is_cluster, parent_ref, area')
                .in('id', pmSpaceIds);
            pmSpaces = ps || [];
            pmSpaces.forEach(s => {
                const links = Array.isArray(s.cloud_links) ? s.cloud_links : [];
                links.forEach(l => {
                    files.push({
                        title: l.title || l.url || 'File',
                        url: l.url,
                        source: l.source || 'dropbox',
                        added_at: l.added_at || null,
                        pmSpaceId: s.id,
                    });
                });
            });
        }

        // 4. resources (per lo scope corrente + child pm_spaces)
        const resQueries = [];
        if (scope === 'area' || scope === 'client') {
            // risorse dello scope alto
            resQueries.push(
                supabase.from('resources')
                    .select('*')
                    .eq('scope_type', scope)
                    .eq('scope_id', scopeId || '')
            );
        }
        if (pmSpaceIds.length > 0) {
            resQueries.push(
                supabase.from('resources')
                    .select('*')
                    .eq('scope_type', 'pm_space')
                    .in('scope_id', pmSpaceIds)
            );
        }
        const resResults = await Promise.all(resQueries);
        resResults.forEach(r => {
            if (r?.data) resources = resources.concat(r.data);
        });

    } catch (e) {
        console.error('[workspace_navigator] fetch error', e);
        container.innerHTML = `<div style="padding:2rem; color:#ef4444;">Errore caricamento workspace: ${e.message}</div>`;
        return;
    }

    // ─── STATE ────────────────────────────────────────────────────────────────
    let currentFilter = 'all';
    let expandedSpaces = new Set(pmSpaceIds); // tutti aperti default

    // ─── HELPERS RENDER ───────────────────────────────────────────────────────
    const chip = (key, label, icon, count) => {
        const active = currentFilter === key;
        const meta = key === 'all' ? null : KIND_META[key];
        const color = active ? 'white' : (meta?.color || 'var(--text-secondary)');
        const bg = active ? (meta?.color || 'var(--brand-blue)') : 'white';
        const border = active ? (meta?.color || 'var(--brand-blue)') : 'var(--surface-2, #e2e8f0)';
        return `<button data-chip="${key}" style="
            padding: 6px 14px; border-radius: 999px;
            border: 1px solid ${border};
            background: ${bg}; color: ${color};
            font-size: 0.78rem; font-weight: 700; cursor: pointer;
            font-family: 'Plus Jakarta Sans', sans-serif;
            display: inline-flex; align-items: center; gap: 6px;
            transition: all 0.15s;
        "><span class="material-icons-round" style="font-size: 0.9rem;">${icon}</span>${label}<span style="opacity:0.7;font-weight:600;margin-left:2px;">${count}</span></button>`;
    };

    const countOf = (kind) => {
        if (kind === 'report') return docPages.filter(p => _pageKind(p) === 'report').length;
        if (kind === 'appunti') return docPages.filter(p => _pageKind(p) === 'appunti').length;
        if (kind === 'file') return files.length;
        if (kind === 'risorse') return resources.length;
        if (kind === 'all') return docPages.length + files.length + resources.length;
        return 0;
    };

    const visibleKinds = () => {
        if (currentFilter === 'all') return ['report', 'appunti', 'file', 'risorse'];
        return [currentFilter];
    };

    // raggruppa per pm_space
    const itemsForSpace = (pmSpaceId) => {
        const kinds = visibleKinds();
        const out = [];
        if (kinds.includes('report') || kinds.includes('appunti')) {
            docPages.filter(p => p._pmSpaceId === pmSpaceId).forEach(p => {
                const k = _pageKind(p);
                if (kinds.includes(k)) out.push({ kind: k, page: p, ts: p.created_at });
            });
        }
        if (kinds.includes('file')) {
            files.filter(f => f.pmSpaceId === pmSpaceId).forEach(f => {
                out.push({ kind: 'file', file: f, ts: f.added_at });
            });
        }
        if (kinds.includes('risorse')) {
            resources.filter(r => r.scope_type === 'pm_space' && r.scope_id === pmSpaceId).forEach(r => {
                out.push({ kind: 'risorse', res: r, ts: r.created_at });
            });
        }
        out.sort((a, b) => (new Date(b.ts || 0)) - (new Date(a.ts || 0)));
        return out;
    };

    // risorse a livello scope (area/client)
    const scopeLevelResources = () => {
        if (!(scope === 'area' || scope === 'client')) return [];
        return resources.filter(r => r.scope_type === scope && r.scope_id === (scopeId || ''));
    };

    // ─── RENDER ROW ───────────────────────────────────────────────────────────
    const rowHtml = (entry) => {
        if (entry.kind === 'report' || entry.kind === 'appunti') {
            const p = entry.page;
            const meta = KIND_META[entry.kind];
            return `<div class="ws-row" data-action="open-page" data-id="${p.id}" style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <div style="width:30px; height:30px; border-radius:8px; background:${meta.bg}; color:${meta.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <span class="material-icons-round" style="font-size:1rem;">${_pageIcon(p)}</span>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.88rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.title || 'Senza titolo'}</div>
                    <div style="font-size:0.68rem; color:var(--text-tertiary); margin-top:2px;">
                        <span style="background:${meta.bg}; color:${meta.color}; padding:1px 6px; border-radius:5px; font-weight:700;">${_pageTypeLabel(p)}</span>
                        <span style="margin-left:6px;">${new Date(p.created_at).toLocaleString('it-IT', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
                <span class="material-icons-round" style="color:var(--text-tertiary); font-size:1rem;">chevron_right</span>
            </div>`;
        }
        if (entry.kind === 'file') {
            const f = entry.file;
            const meta = KIND_META.file;
            const fileIcon = _fileIconForLink(f);
            const fileLabel = _fileLabelForLink(f);
            return `<a class="ws-row" href="${f.url}" target="_blank" rel="noopener" style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; text-decoration:none;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <div style="width:30px; height:30px; border-radius:8px; background:${meta.bg}; color:${meta.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <span class="material-icons-round" style="font-size:1rem;">${fileIcon}</span>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.88rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${f.title}</div>
                    <div style="font-size:0.68rem; color:var(--text-tertiary); margin-top:2px;">
                        <span style="background:${meta.bg}; color:${meta.color}; padding:1px 6px; border-radius:5px; font-weight:700;">${fileLabel}</span>
                        ${f.added_at ? `<span style="margin-left:6px;">${new Date(f.added_at).toLocaleDateString('it-IT')}</span>` : ''}
                    </div>
                </div>
                <span class="material-icons-round" style="color:var(--text-tertiary); font-size:1rem;">open_in_new</span>
            </a>`;
        }
        if (entry.kind === 'risorse') {
            const r = entry.res;
            const meta = KIND_META.risorse;
            return `<a class="ws-row" href="${r.url}" target="_blank" rel="noopener" data-action="open-resource" data-id="${r.id}" style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; text-decoration:none;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <div style="width:30px; height:30px; border-radius:8px; background:${meta.bg}; color:${meta.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <span class="material-icons-round" style="font-size:1rem;">${r.icon || 'link'}</span>
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.88rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.title}</div>
                    <div style="font-size:0.68rem; color:var(--text-tertiary); margin-top:2px;">
                        <span style="background:${meta.bg}; color:${meta.color}; padding:1px 6px; border-radius:5px; font-weight:700;">Risorsa</span>
                        ${r.description ? `<span style="margin-left:6px;">${r.description}</span>` : ''}
                    </div>
                </div>
                <span class="material-icons-round" style="color:var(--text-tertiary); font-size:1rem;">open_in_new</span>
            </a>`;
        }
        return '';
    };

    // ─── RENDER ───────────────────────────────────────────────────────────────
    const render = () => {
        const totalEverything = countOf('all');
        const showScopeLevel = (scope === 'area' || scope === 'client') && scopeLevelResources().length > 0;

        container.innerHTML = `
            <div style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; height: 100%; box-sizing: border-box;">
                <!-- Filters + Add button -->
                <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;">
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        ${chip('all', 'Tutti', 'apps', totalEverything)}
                        ${chip('report', 'Report', 'mic', countOf('report'))}
                        ${chip('appunti', 'Appunti', 'edit_note', countOf('appunti'))}
                        ${chip('file', 'File', 'folder', countOf('file'))}
                        ${chip('risorse', 'Risorse', 'link', countOf('risorse'))}
                    </div>
                    <button id="ws-add-resource" style="
                        padding: 8px 14px; border-radius: 10px; border: none;
                        background: var(--brand-gradient, linear-gradient(135deg,#4e92d8,#614aa2));
                        color: white; font-weight: 700; font-size: 0.78rem;
                        cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
                        box-shadow: 0 4px 12px rgba(78,146,216,0.2);
                    "><span class="material-icons-round" style="font-size: 1rem;">add_link</span> Aggiungi risorsa</button>
                </div>

                <!-- Empty state -->
                ${totalEverything === 0 ? `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 1.5rem; text-align:center; color:var(--text-tertiary);">
                        <span class="material-icons-round" style="font-size:3rem; opacity:0.4; margin-bottom:1rem;">inbox</span>
                        <div style="font-size:0.9rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Nessun contenuto qui ancora</div>
                        <div style="font-size:0.8rem; max-width:380px;">Crea il primo report (voice memo), un appunto stile Notion, una whiteboard, o aggiungi una risorsa veloce.</div>
                    </div>
                ` : `
                    <div style="overflow-y: auto; flex: 1 1 auto; min-height: 0; display:flex; flex-direction:column; gap:14px;">
                        ${showScopeLevel ? `
                            <div class="ws-section">
                                <div class="ws-section-head" style="display:flex; align-items:center; gap:8px; margin-bottom:6px; padding:0 4px;">
                                    <span class="material-icons-round" style="font-size:1rem; color:var(--text-tertiary);">workspace_premium</span>
                                    <div style="font-size:0.78rem; font-weight:800; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">Risorse di ${scope === 'area' ? 'questa area' : 'questo cliente'}</div>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    ${scopeLevelResources().map(r => rowHtml({ kind: 'risorse', res: r, ts: r.created_at })).join('')}
                                </div>
                            </div>
                        ` : ''}

                        ${pmSpaces.map(ps => {
                            const entries = itemsForSpace(ps.id);
                            if (entries.length === 0) return '';
                            const expanded = expandedSpaces.has(ps.id);
                            const spaceLabel = ps.name || spaceNamesMap[ps.id] || '(progetto)';
                            const cluster = ps.is_cluster ? '<span style="background:rgba(124,58,237,0.10); color:#7c3aed; padding:1px 6px; border-radius:5px; font-size:0.65rem; font-weight:800; margin-left:6px;">CLUSTER</span>' : '';
                            return `
                                <div class="ws-section" data-space="${ps.id}">
                                    <div class="ws-section-head" style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:8px 6px; border-radius:8px;" data-toggle-space="${ps.id}" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                                        <span class="material-icons-round" style="font-size:1rem; color:var(--text-tertiary); transition:transform 0.15s; transform:${expanded ? 'rotate(90deg)' : 'rotate(0deg)'};">chevron_right</span>
                                        <span class="material-icons-round" style="font-size:1rem; color:var(--brand-blue);">folder</span>
                                        <div style="font-size:0.85rem; font-weight:800; color:var(--text-primary);">${spaceLabel}${cluster}</div>
                                        <div style="margin-left:auto; font-size:0.7rem; color:var(--text-tertiary); font-weight:700;">${entries.length}</div>
                                    </div>
                                    ${expanded ? `<div style="display:flex; flex-direction:column; gap:4px; margin-left:20px; padding-left:8px; border-left:1.5px solid #e2e8f0;">
                                        ${entries.map(rowHtml).join('')}
                                    </div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;

        // Wire chips
        container.querySelectorAll('[data-chip]').forEach(btn => {
            btn.onclick = () => { currentFilter = btn.dataset.chip; render(); };
        });

        // Wire toggle
        container.querySelectorAll('[data-toggle-space]').forEach(el => {
            el.onclick = () => {
                const id = el.dataset.toggleSpace;
                if (expandedSpaces.has(id)) expandedSpaces.delete(id); else expandedSpaces.add(id);
                render();
            };
        });

        // Wire row open-page
        container.querySelectorAll('[data-action="open-page"]').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const pageId = el.dataset.id;
                try {
                    const { data: page, error } = await supabase
                        .from('doc_pages').select('*').eq('id', pageId).single();
                    if (error || !page) throw error || new Error('Pagina non trovata');
                    await openFullscreenEditor(page);
                } catch (err) {
                    console.error('[workspace_navigator] open page', err);
                    window.showGlobalAlert?.('Errore apertura: ' + (err?.message || err), 'error');
                }
            };
        });

        // Wire add resource
        const addBtn = container.querySelector('#ws-add-resource');
        if (addBtn) addBtn.onclick = () => _openAddResourceModal({ scope, scopeId, pmSpaceIds, spaceNamesMap, onSaved: () => renderWorkspaceNavigator(container, opts) });
    };

    render();
}

// ─── Add resource modal ──────────────────────────────────────────────────────
function _openAddResourceModal({ scope, scopeId, pmSpaceIds, spaceNamesMap, onSaved }) {
    const existing = document.getElementById('ws-add-resource-modal');
    if (existing) existing.remove();

    // Opzioni di destinazione: scope alto + ogni pm_space
    const targetOptions = [];
    if (scope === 'area' || scope === 'client') {
        targetOptions.push({ value: `${scope}|${scopeId}`, label: scope === 'area' ? 'Tutta l\'area' : 'Tutto il cliente' });
    }
    pmSpaceIds.forEach(sid => {
        const n = spaceNamesMap[sid] || '(progetto)';
        targetOptions.push({ value: `pm_space|${sid}`, label: n });
    });

    const modal = document.createElement('div');
    modal.id = 'ws-add-resource-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; padding: 0; border-radius: 16px; overflow: hidden;">
            <div style="padding: 1rem 1.25rem; background: var(--brand-gradient, linear-gradient(135deg,#4e92d8,#614aa2)); color: white; display: flex; align-items: center; justify-content: space-between;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons-round">add_link</span>
                    <div style="font-weight: 800; font-family: 'Satoshi', sans-serif;">Nuova risorsa</div>
                </div>
                <button onclick="document.getElementById('ws-add-resource-modal').remove()" style="background:rgba(255,255,255,0.2); border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;"><span class="material-icons-round" style="font-size:1.1rem;">close</span></button>
            </div>
            <div style="padding: 1.25rem; display:flex; flex-direction:column; gap: 1rem;">
                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">Dove la metti</label>
                    <select id="ws-res-target" style="width:100%; margin-top:0.4rem; padding:0.6rem 0.9rem; border:1px solid var(--glass-border); border-radius:10px; font-size:0.88rem; background:white;">
                        ${targetOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">Titolo</label>
                    <input id="ws-res-title" type="text" placeholder="es. App booking, Calendario editoriale cliente…" style="width:100%; margin-top:0.4rem; padding:0.6rem 0.9rem; border:1px solid var(--glass-border); border-radius:10px; font-size:0.88rem; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">URL</label>
                    <input id="ws-res-url" type="url" placeholder="https://…" style="width:100%; margin-top:0.4rem; padding:0.6rem 0.9rem; border:1px solid var(--glass-border); border-radius:10px; font-size:0.88rem; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">Descrizione (opzionale)</label>
                    <input id="ws-res-desc" type="text" placeholder="A cosa serve" style="width:100%; margin-top:0.4rem; padding:0.6rem 0.9rem; border:1px solid var(--glass-border); border-radius:10px; font-size:0.88rem; box-sizing:border-box;">
                </div>
                <div style="display:flex; gap:0.75rem; justify-content:flex-end; padding-top:0.5rem;">
                    <button onclick="document.getElementById('ws-add-resource-modal').remove()" style="padding:0.55rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.85rem; cursor:pointer;">Annulla</button>
                    <button id="ws-res-save" style="padding:0.55rem 1.25rem; border-radius:10px; border:none; background:var(--brand-gradient, linear-gradient(135deg,#4e92d8,#614aa2)); color:white; font-weight:700; font-size:0.85rem; cursor:pointer;">Salva</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('ws-res-save').onclick = async () => {
        const target = document.getElementById('ws-res-target').value;
        const title = document.getElementById('ws-res-title').value.trim();
        const url = document.getElementById('ws-res-url').value.trim();
        const desc = document.getElementById('ws-res-desc').value.trim();

        if (!title || !url) {
            window.showGlobalAlert?.('Titolo e URL sono obbligatori', 'error');
            return;
        }
        if (!/^https?:\/\//i.test(url)) {
            window.showGlobalAlert?.('URL non valido — deve iniziare con http:// o https://', 'error');
            return;
        }

        const [t_type, t_id] = target.split('|');
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase.from('resources').insert({
            scope_type: t_type,
            scope_id: t_id,
            title,
            url,
            description: desc || null,
            created_by: user?.id || null,
        });

        if (error) {
            window.showGlobalAlert?.('Errore: ' + error.message, 'error');
            return;
        }

        modal.remove();
        window.showGlobalAlert?.('Risorsa aggiunta');
        if (typeof onSaved === 'function') onSaved();
    };
}
