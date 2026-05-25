// Homepage Pinned Items
// Vista compatta in homepage delle entità pinnate dall'utente.
// Storage: user_pinned_items (per-user, RLS).

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

const TYPE_META = {
    order:        { icon: 'inventory_2',    color: '#3b82f6', route: 'order-detail',        label: 'Commessa' },
    client:       { icon: 'business',       color: '#10b981', route: 'client-detail',       label: 'Cliente' },
    assignment:   { icon: 'assignment',     color: '#8b5cf6', route: 'assignment-detail',   label: 'Incarico' },
    pm_item:      { icon: 'task_alt',       color: '#f59e0b', route: 'pm',                  label: 'Task' },
    collaborator: { icon: 'badge',          color: '#ef4444', route: 'collaborator-detail', label: 'Collab' },
};

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

export async function renderPinnedSection(container) {
    const userId = state.profile?.id;
    if (!userId) {
        container.innerHTML = '';
        return;
    }

    const { data: pinned, error } = await supabase
        .from('user_pinned_items')
        .select('id, entity_type, entity_id, label, position, created_at')
        .eq('user_id', userId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

    if (error || !pinned || pinned.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 1.25rem; padding: 1rem 1.25rem; background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(245, 158, 11, 0.01)); border: 1px solid rgba(245, 158, 11, 0.18); border-radius: 14px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span class="material-icons-round" style="font-size: 1.05rem; color: #f59e0b;">push_pin</span>
                <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.04em;">Pinnati</span>
                <span style="font-size: 0.7rem; color: var(--text-tertiary);">${pinned.length}</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${pinned.map(p => {
                    const meta = TYPE_META[p.entity_type] || { icon: 'star', color: '#6b7280', route: 'home', label: p.entity_type };
                    return `
                        <a href="#${meta.route}/${p.entity_id}" class="pinned-chip"
                            style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.7rem; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 999px; text-decoration: none; color: var(--text-primary); font-size: 0.78rem; cursor: pointer; transition: all 0.15s;"
                            onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.06)'"
                            onmouseout="this.style.transform='';this.style.boxShadow=''">
                            <span class="material-icons-round" style="font-size: 0.95rem; color: ${meta.color};">${meta.icon}</span>
                            <span>${escapeHtml(p.label || meta.label)}</span>
                            <button onclick="event.preventDefault();event.stopPropagation();window.unpinItem('${p.id}', event.target.closest('.pinned-chip'))"
                                style="background: none; border: none; padding: 0; margin-left: 0.15rem; cursor: pointer; color: var(--text-tertiary); display: flex; align-items: center;" title="Rimuovi dai pinned">
                                <span class="material-icons-round" style="font-size: 0.9rem;">close</span>
                            </button>
                        </a>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

window.togglePin = async function (entityType, entityId, label) {
    const userId = state.profile?.id;
    if (!userId) return { ok: false, error: 'Non autenticato' };

    // Check if already pinned
    const { data: existing } = await supabase
        .from('user_pinned_items')
        .select('id')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase.from('user_pinned_items').delete().eq('id', existing.id);
        if (error) { alert('Errore: ' + error.message); return { ok: false, pinned: true }; }
        return { ok: true, pinned: false };
    }

    const { error } = await supabase.from('user_pinned_items').insert({
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        label: label || null,
    });
    if (error) { alert('Errore: ' + error.message); return { ok: false, pinned: false }; }
    return { ok: true, pinned: true };
};

window.unpinItem = async function (pinId, chipEl) {
    const { error } = await supabase.from('user_pinned_items').delete().eq('id', pinId);
    if (error) { alert('Errore: ' + error.message); return; }
    if (chipEl) chipEl.remove();
};

/** Verifica se l'entità è già pinnata (per render del bottone su detail page) */
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
