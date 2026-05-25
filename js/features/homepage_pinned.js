// Sidebar Pinned Items
// Sezione "Pinnati" in sidebar, sotto profilo / sopra menu principale.
// Storage: user_pinned_items (per-user, RLS).

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

const TYPE_META = {
    order:        { icon: 'inventory_2',    color: '#3b82f6', route: 'order-detail' },
    client:       { icon: 'business',       color: '#10b981', route: 'client-detail' },
    assignment:   { icon: 'assignment',     color: '#8b5cf6', route: 'assignment-detail' },
    pm_item:      { icon: 'task_alt',       color: '#f59e0b', route: 'pm' },
    collaborator: { icon: 'badge',          color: '#ef4444', route: 'collaborator-detail' },
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
        <div class="sidebar-pinned-section" style="padding: 0.5rem 0.75rem 0.75rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--glass-border);">
            <div class="sidebar-pinned-label" style="display: flex; align-items: center; gap: 0.35rem; padding: 0 0.5rem 0.4rem; font-size: 0.62rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em;">
                <span class="material-icons-round" style="font-size: 0.85rem; color: #f59e0b;">push_pin</span>
                <span class="sidebar-pinned-label-text">Pinnati</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.15rem;">
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
    const meta = TYPE_META[p.entity_type] || { icon: 'star', color: '#6b7280', route: 'home' };
    const label = p.label || `${p.entity_type} ${p.entity_id.slice(0, 8)}`;
    return `
        <a href="#${meta.route}/${p.entity_id}" class="pin-row nav-item sub-item" style="display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 8px; text-decoration: none; color: var(--text-primary); font-size: 0.78rem; cursor: pointer; position: relative; min-height: 32px;">
            <span class="material-icons-round" style="font-size: 1.05rem; color: ${meta.color}; flex-shrink: 0;">${meta.icon}</span>
            <span class="pin-label" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
            <button class="pin-close" onclick="event.preventDefault();event.stopPropagation();window.unpinItem('${p.id}', this.closest('.pin-row'))"
                style="background: none; border: none; padding: 2px; cursor: pointer; color: var(--text-tertiary); opacity: 0; transition: opacity 0.15s; display: flex; align-items: center; flex-shrink: 0;" title="Rimuovi dai pinned">
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
