// Sidebar Pinned Items
// Sezione "Pinnati" in sidebar, sotto profilo / sopra menu principale.
// Storage: user_pinned_items (per-user, RLS).

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

const TYPE_META = {
    order:        { icon: 'inventory_2',    color: '#3b82f6', route: 'order-detail',              label: 'Commessa' },
    pm_commessa:  { icon: 'workspaces',     color: '#1e40af', route: 'pm/commessa',               label: 'Commessa PM' },
    client:       { icon: 'business',       color: '#10b981', route: 'client-detail',             label: 'Cliente' },
    contact:      { icon: 'contact_phone',  color: '#059669', route: 'contacts',                  label: 'Referente' },
    assignment:   { icon: 'assignment',     color: '#8b5cf6', route: 'assignment-detail',         label: 'Incarico' },
    pm_item:      { icon: 'task_alt',       color: '#f59e0b', route: 'pm/task',                   label: 'Task' },
    collaborator: { icon: 'badge',          color: '#ef4444', route: 'collaborator-detail',       label: 'Collaboratore' },
    wl_partner:   { icon: 'corporate_fare', color: '#dc2626', route: 'white-label-partner-detail',label: 'Partner WL' },
    supplier:     { icon: 'local_shipping', color: '#64748b', route: 'suppliers',                 label: 'Fornitore' },
    pm_space:     { icon: 'folder_open',    color: '#0ea5e9', route: 'pm/space',                  label: 'Workspace PM' },
    pm_area:      { icon: 'category',       color: '#a855f7', route: 'pm/area',                   label: 'Area PM' },
    sap_service:  { icon: 'inventory',      color: '#d97706', route: 'sap-service-detail',        label: 'Servizio SAP' },
    doc_page:     { icon: 'description',    color: '#0891b2', route: 'pm/doc',                    label: 'Documento' },
};

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

export async function renderSidebarPinned() {
    const slot = document.getElementById('sidebar-pinned-slot');
    if (!slot) return;

    const userId = state.profile?.id;
    if (!userId) {
        slot.innerHTML = '';
        return;
    }

    const { data: pinned, error } = await supabase
        .from('user_pinned_items')
        .select('id, entity_type, entity_id, label, position, created_at')
        .eq('user_id', userId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

    if (error || !pinned || pinned.length === 0) {
        slot.innerHTML = '';
        return;
    }

    slot.innerHTML = `
        <div class="sidebar-pinned-section" style="padding: 0.65rem 0.5rem 0.75rem; border-top: 1px solid var(--glass-border); margin-top: 0.5rem;">
            <div class="sidebar-pinned-label" style="display: flex; align-items: center; gap: 0.35rem; padding: 0 0.5rem 0.5rem; font-size: 0.62rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em;">
                <span class="material-icons-round" style="font-size: 0.85rem; color: #f59e0b;">star</span>
                <span class="sidebar-pinned-label-text">Preferiti</span>
                <span class="sidebar-pinned-label-text" style="margin-left: auto; color: var(--text-tertiary); font-weight: 600;">${pinned.length}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                ${pinned.map(p => renderRow(p)).join('')}
            </div>
        </div>
    `;

    // Hover delete X
    slot.querySelectorAll('.pin-row').forEach(row => {
        const closeBtn = row.querySelector('.pin-close');
        if (!closeBtn) return;
        row.addEventListener('mouseenter', () => { closeBtn.style.opacity = '1'; });
        row.addEventListener('mouseleave', () => { closeBtn.style.opacity = '0'; });
    });
}

function renderRow(p) {
    const meta = TYPE_META[p.entity_type] || { icon: 'star', color: '#6b7280', route: 'home', label: p.entity_type };
    const fullLabel = p.label || `${meta.label} ${p.entity_id.slice(0, 8)}`;
    return `
        <a href="#${meta.route}/${p.entity_id}" class="pin-row nav-item sub-item" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.55rem; border-radius: 8px; text-decoration: none; color: var(--text-primary); cursor: pointer; position: relative; min-height: 40px;" title="${escapeHtml(fullLabel)}">
            <span class="material-icons-round" style="font-size: 1.15rem; color: ${meta.color}; flex-shrink: 0;">${meta.icon}</span>
            <div class="pin-label" style="flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.1; overflow: hidden;">
                <span style="font-size: 0.58rem; font-weight: 700; color: ${meta.color}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1px;">${meta.label}</span>
                <span style="font-size: 0.76rem; color: var(--text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(fullLabel)}</span>
            </div>
            <button class="pin-close" onclick="event.preventDefault();event.stopPropagation();window.unpinItem('${p.id}', this.closest('.pin-row'))"
                style="background: none; border: none; padding: 2px; cursor: pointer; color: var(--text-tertiary); opacity: 0; transition: opacity 0.15s; display: flex; align-items: center; flex-shrink: 0;" title="Rimuovi dai preferiti">
                <span class="material-icons-round" style="font-size: 0.95rem;">close</span>
            </button>
        </a>
    `;
}

window.togglePin = async function (entityType, entityId, label) {
    const userId = state.profile?.id;
    if (!userId) return { ok: false, error: 'Non autenticato' };

    const { data: existing } = await supabase
        .from('user_pinned_items')
        .select('id')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();

    let pinned;
    if (existing) {
        const { error } = await supabase.from('user_pinned_items').delete().eq('id', existing.id);
        if (error) { alert('Errore: ' + error.message); return { ok: false, pinned: true }; }
        pinned = false;
    } else {
        const { error } = await supabase.from('user_pinned_items').insert({
            user_id: userId,
            entity_type: entityType,
            entity_id: entityId,
            label: label || null,
        });
        if (error) { alert('Errore: ' + error.message); return { ok: false, pinned: false }; }
        pinned = true;
    }

    // Re-render sidebar
    await renderSidebarPinned();
    return { ok: true, pinned };
};

window.unpinItem = async function (pinId, rowEl) {
    const { error } = await supabase.from('user_pinned_items').delete().eq('id', pinId);
    if (error) { alert('Errore: ' + error.message); return; }
    if (rowEl) {
        rowEl.style.transition = 'opacity 0.15s';
        rowEl.style.opacity = '0';
        setTimeout(() => renderSidebarPinned(), 200);
    } else {
        renderSidebarPinned();
    }
    // Update pin buttons on current page if any
    document.querySelectorAll('[data-pin-btn]').forEach(btn => {
        const t = btn.dataset.pinType;
        const i = btn.dataset.pinId;
        if (!t || !i) return;
        // Will refresh below
    });
};

/** Costruisce HTML del bottone preferito per qualsiasi entity detail header */
export function buildFavoriteButton({ entityType, entityId, label, size = 40 }) {
    const safeLabel = (label || '').replace(/"/g, '&quot;');
    return `
        <button class="icon-btn favorite-btn" id="fav-btn-${entityType}-${entityId}"
                data-fav-type="${entityType}" data-fav-id="${entityId}" data-fav-label="${safeLabel}"
                onclick="window.handleFavoriteClick(this)"
                title="Aggiungi ai Preferiti"
                style="width: ${size}px; height: ${size}px; border-radius: 12px; background: white; border: 1px solid var(--glass-border); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow-sm); margin-right: .5rem;">
            <span class="material-icons-round" style="font-size:1.15rem;">star_outline</span>
        </button>
    `;
}

/** Inizializza lo stato visuale di tutti i bottoni preferito presenti nel container */
export async function initFavoriteButtons(container) {
    const buttons = (container || document).querySelectorAll('.favorite-btn');
    for (const btn of buttons) {
        const t = btn.dataset.favType;
        const i = btn.dataset.favId;
        if (!t || !i) continue;
        const pinned = await isPinned(t, i);
        applyFavStyle(btn, pinned);
    }
}

function applyFavStyle(btn, pinned) {
    const icon = btn.querySelector('.material-icons-round');
    if (pinned) {
        btn.style.background = 'rgba(245,158,11,.12)';
        btn.style.borderColor = '#f59e0b';
        btn.style.color = '#f59e0b';
        btn.title = 'Rimuovi dai Preferiti';
        if (icon) icon.textContent = 'star';
    } else {
        btn.style.background = 'white';
        btn.style.borderColor = 'var(--glass-border)';
        btn.style.color = 'var(--text-secondary)';
        btn.title = 'Aggiungi ai Preferiti';
        if (icon) icon.textContent = 'star_outline';
    }
}

window.handleFavoriteClick = async function (btn) {
    const t = btn.dataset.favType;
    const i = btn.dataset.favId;
    const label = btn.dataset.favLabel || null;
    if (!t || !i) return;
    const result = await window.togglePin(t, i, label);
    if (!result?.ok) return;
    applyFavStyle(btn, result.pinned);
};

/** Verifica se l'entità è già pinnata */
export async function isPinned(entityType, entityId) {
    const userId = state.profile?.id;
    if (!userId) return false;
    const { data } = await supabase
        .from('user_pinned_items')
        .select('id')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();
    return !!data;
}

// Auto-hide labels quando sidebar è collapsed
const SIDEBAR_COLLAPSED_CLASS = 'collapsed';
function syncCollapsedStyles() {
    const sidebar = document.getElementById('sidebar');
    const slot = document.getElementById('sidebar-pinned-slot');
    if (!sidebar || !slot) return;
    const isCollapsed = sidebar.classList.contains(SIDEBAR_COLLAPSED_CLASS);
    slot.querySelectorAll('.pin-label, .sidebar-pinned-label-text').forEach(el => {
        el.style.display = isCollapsed ? 'none' : '';
    });
}

// Observe sidebar class changes
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            const obs = new MutationObserver(syncCollapsedStyles);
            obs.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
        }
    });
}

// Auto-init dei .favorite-btn appena vengono inseriti nel DOM (drawer, modal, viste)
async function initSingleFavBtn(btn) {
    if (btn.dataset.favInit === '1') return;
    btn.dataset.favInit = '1';
    const t = btn.dataset.favType;
    const i = btn.dataset.favId;
    if (!t || !i) return;
    try {
        const pinned = await isPinned(t, i);
        applyFavStyle(btn, pinned);
    } catch (e) { /* silenzioso */ }
}

if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const autoInit = () => {
        document.querySelectorAll('.favorite-btn').forEach(initSingleFavBtn);
    };
    autoInit();
    const obs = new MutationObserver(mutations => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches?.('.favorite-btn')) {
                    initSingleFavBtn(node);
                }
                node.querySelectorAll?.('.favorite-btn').forEach(initSingleFavBtn);
            }
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}
