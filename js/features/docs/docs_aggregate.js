// Lista aggregata di doc_pages per UNO o più pm_space.
// Usata in vista area (aggrega tutti i progetti dell'area) e in vista space
// (un singolo progetto), per dare un elenco "Documenti" unico con filtri.
//
// Click su un item → apre il viewer Notion-like fullscreen (openFullscreenEditor)
// invece di entrare in modalità modifica laterale come fa renderDocsView.

import { supabase } from '../../modules/config.js?v=8000';
import { openFullscreenEditor } from './DocsView.js?v=8003';

const TYPE_META = {
    voice_memo: { label: 'Report', icon: 'mic', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.10)' },
    whiteboard: { label: 'Whiteboard', icon: 'gesture', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.10)' },
    page: { label: 'Pagina', icon: 'description', color: '#4e92d8', bg: 'rgba(78, 146, 216, 0.10)' },
};

function _pageKind(p) {
    if (p?.metadata?.source === 'voice_memo') return 'voice_memo';
    if (p?.page_type === 'whiteboard') return 'whiteboard';
    return 'page';
}

/**
 * @param {HTMLElement} container
 * @param {string[]} pmSpaceIds  ids di pm_spaces da aggregare
 * @param {Object} options
 *   - emptyMessage: string  (default "Nessun documento.")
 *   - showSpaceLabel: bool  (default true se >1 space)
 *   - spaceNamesMap: object {id: name}
 */
export async function renderDocsAggregate(container, pmSpaceIds = [], options = {}) {
    const {
        emptyMessage = 'Nessun documento ancora creato qui.',
        spaceNamesMap = {},
    } = options;
    const showSpaceLabel = options.showSpaceLabel ?? (pmSpaceIds.length > 1);

    container.innerHTML = '<div style="display:flex;justify-content:center;padding:2rem;"><span class="loader"></span></div>';

    if (!pmSpaceIds || pmSpaceIds.length === 0) {
        container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-tertiary);">${emptyMessage}</div>`;
        return;
    }

    // 1. doc_spaces per i pm_space
    const { data: docSpaces, error: dsErr } = await supabase
        .from('doc_spaces')
        .select('id, space_ref')
        .in('space_ref', pmSpaceIds);
    if (dsErr) {
        console.error('[docs_aggregate] doc_spaces error', dsErr);
        container.innerHTML = '<div style="padding:2rem; color:#ef4444;">Errore caricamento documenti.</div>';
        return;
    }
    const docSpaceIds = (docSpaces || []).map(d => d.id);
    const docSpaceToPmSpace = {};
    (docSpaces || []).forEach(d => { docSpaceToPmSpace[d.id] = d.space_ref; });

    if (docSpaceIds.length === 0) {
        container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-tertiary);">${emptyMessage}</div>`;
        return;
    }

    // 2. doc_pages
    const { data: pages, error: pgErr } = await supabase
        .from('doc_pages')
        .select('id, title, created_at, metadata, space_ref, page_type')
        .in('space_ref', docSpaceIds)
        .order('created_at', { ascending: false });
    if (pgErr) {
        console.error('[docs_aggregate] doc_pages error', pgErr);
        container.innerHTML = '<div style="padding:2rem; color:#ef4444;">Errore caricamento documenti.</div>';
        return;
    }

    if (!pages || pages.length === 0) {
        container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-tertiary);">${emptyMessage}</div>`;
        return;
    }

    let currentFilter = 'all';

    const render = () => {
        const filtered = currentFilter === 'all' ? pages : pages.filter(p => _pageKind(p) === currentFilter);
        const counts = {
            all: pages.length,
            voice_memo: pages.filter(p => _pageKind(p) === 'voice_memo').length,
            page: pages.filter(p => _pageKind(p) === 'page').length,
            whiteboard: pages.filter(p => _pageKind(p) === 'whiteboard').length,
        };

        const filterBtn = (key, label) => {
            const active = currentFilter === key;
            return `<button data-filter="${key}" style="
                padding: 6px 12px; border-radius: 999px;
                border: 1px solid ${active ? 'var(--brand-blue)' : 'var(--surface-2, #e2e8f0)'};
                background: ${active ? 'var(--brand-blue)' : 'white'};
                color: ${active ? 'white' : 'var(--text-secondary, #475569)'};
                font-size: 0.78rem; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
                display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s;
            ">${label} <span style="opacity: 0.7; font-weight: 600;">${counts[key] || 0}</span></button>`;
        };

        container.innerHTML = `
            <div style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; height: 100%; box-sizing: border-box;">
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${filterBtn('all', 'Tutti')}
                    ${filterBtn('voice_memo', 'Report')}
                    ${filterBtn('page', 'Pagine')}
                    ${filterBtn('whiteboard', 'Whiteboard')}
                </div>
                <div id="docs-aggregate-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1 1 auto; min-height: 0;">
                    ${filtered.length === 0
                ? `<div style="padding:2rem; text-align:center; color:var(--text-tertiary); font-style:italic;">Nessun documento di questo tipo.</div>`
                : filtered.map(p => {
                    const kind = _pageKind(p);
                    const meta = TYPE_META[kind] || TYPE_META.page;
                    const pmSpaceId = docSpaceToPmSpace[p.space_ref];
                    const spaceName = showSpaceLabel ? (spaceNamesMap[pmSpaceId] || '') : '';
                    return `
                        <div class="docs-agg-item" data-page-id="${p.id}" style="
                            display: flex; align-items: center; gap: 12px;
                            padding: 12px 14px; border-radius: 12px;
                            background: white; border: 1px solid var(--surface-2, #e2e8f0);
                            cursor: pointer; transition: all 0.15s;
                        " onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.04)'" onmouseout="this.style.borderColor='var(--surface-2, #e2e8f0)'; this.style.boxShadow='none'">
                            <div style="
                                width: 36px; height: 36px; border-radius: 10px;
                                background: ${meta.bg}; color: ${meta.color};
                                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                            "><span class="material-icons-round" style="font-size: 1.1rem;">${meta.icon}</span></div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.title || 'Senza titolo'}</div>
                                <div style="display: flex; gap: 8px; align-items: center; margin-top: 3px; font-size: 0.7rem; color: var(--text-tertiary);">
                                    <span style="background: ${meta.bg}; color: ${meta.color}; padding: 1px 8px; border-radius: 6px; font-weight: 700;">${meta.label}</span>
                                    <span>${new Date(p.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    ${spaceName ? `<span style="opacity: 0.75;">· ${spaceName}</span>` : ''}
                                </div>
                            </div>
                            <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 1.1rem;">chevron_right</span>
                        </div>
                    `;
                }).join('')
            }
                </div>
            </div>
        `;

        container.querySelectorAll('[data-filter]').forEach(btn => {
            btn.onclick = () => { currentFilter = btn.dataset.filter; render(); };
        });
        container.querySelectorAll('.docs-agg-item').forEach(item => {
            item.onclick = async () => {
                const pageId = item.dataset.pageId;
                try {
                    const { data: page, error } = await supabase
                        .from('doc_pages').select('*').eq('id', pageId).single();
                    if (error || !page) throw error || new Error('Pagina non trovata');
                    await openFullscreenEditor(page);
                } catch (e) {
                    console.error('[docs_aggregate] open page error', e);
                    if (window.showGlobalAlert) window.showGlobalAlert('Errore apertura documento: ' + (e?.message || e), 'error');
                }
            };
        });
    };

    render();
}
