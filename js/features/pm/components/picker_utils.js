import { state } from '../../../modules/state.js?v=157';

export function renderUserPicker(spaceId, targetRole, assignedUserIds = new Set()) {
    const space = state.pm_spaces?.find(s => s.id === spaceId) || {};
    const orderId = space.ref_ordine;

    const suggestedSet = new Set();

    if (orderId && state.assignments) {
        state.assignments
            .filter(a => a.order_id === orderId)
            .forEach(a => suggestedSet.add(a.collaborator_id));
    }

    const suggestions = [];
    const others = [];
    const processedUserIds = new Set();

    (state.collaborators || []).forEach(c => {
        // Filter inactive
        if (c.is_active === false || c.active === false) return; // Strict check

        const uid = c.user_id;

        // 1. Role Filtering for PM
        if (targetRole === 'pm') {
            let tags = c.tags || [];
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
            }
            const isProjectManager = Array.isArray(tags) &&
                tags.some(t => t.toLowerCase() === 'project manager' || t.toLowerCase() === 'pm');

            if (!isProjectManager) return;
        }

        // Exclude if already assigned
        if (uid && assignedUserIds.has(uid)) return;
        if (c.id && assignedUserIds.has(c.id)) return;
        // Also avoid duplicate listings if same user has multiple collab records (rare but possible)
        if (uid && processedUserIds.has(uid)) return;

        if (uid) processedUserIds.add(uid);

        // Resolve Name/Avatar
        let name = c.full_name;
        if (!name || name === 'Utente') {
            name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        }
        if (!name) name = 'Collaboratore Sconosciuto';

        let avatar = c.avatar_url;

        // Fallback to Profile
        if ((!name || !avatar) && uid) {
            const p = state.profiles?.find(x => x.id === uid);
            if (p) {
                if (!name || name === 'Collaboratore Sconosciuto') name = `${p.first_name} ${p.last_name}`;
                if (!avatar) avatar = p.avatar_url;
            }
        }

        const u = {
            uid: uid,
            collabId: c.id,
            name: name,
            avatar: avatar,
            hasAccount: !!uid
        };

        if (suggestedSet.has(c.id)) suggestions.push(u);
        else others.push(u);
    });

    // Add Default PM if not assigned
    if (space.default_pm_user_ref && !assignedUserIds.has(space.default_pm_user_ref) && !processedUserIds.has(space.default_pm_user_ref)) {
        const pm = state.profiles?.find(p => p.id === space.default_pm_user_ref);
        if (pm) {
            suggestions.unshift({
                uid: pm.id,
                name: `${pm.first_name} ${pm.last_name} (PM)`,
                avatar: pm.avatar_url,
                hasAccount: true,
                isPm: true
            });
        }
    }

    if (suggestions.length === 0 && others.length === 0) {
        return `<div style="padding:1rem; text-align:center; color:var(--text-secondary); font-size:0.8rem;">Nessun altro utente disponibile</div>`;
    }

    const renderOption = (u) => {
        const uid = u.uid || '';
        const avatar = u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name);
        const name = u.name;
        let desc = '';
        if (u.isPm) desc = 'Project Manager';
        else if (!u.hasAccount) desc = 'Collaboratore esterno';

        return `
            <div class="user-option" 
                data-uid="${uid}" 
                data-collab-id="${u.collabId || ''}"
                data-has-account="${u.hasAccount}"
                data-target-role="${targetRole}"
                style="
                    padding: 0.75rem 1rem; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    cursor: pointer; 
                    transition: background 0.2s;
                    pointer-events: auto !important;
                    position: relative;
                    z-index: 1;
                    opacity: ${!u.hasAccount && targetRole === 'pm' ? '0.5' : '1'};
                " onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='transparent'">
                <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%;">
                <div>
                    <div style="font-size: 0.9rem; font-weight: 500;">${name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary);">${desc}</div>
                </div>
            </div>
        `;
    };

    const headerStyle = "padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); letter-spacing: 0.05em; background: var(--surface-1); border-bottom: 1px solid var(--surface-2);";

    return `
        <div>
           ${targetRole === 'pm' ? '<div style="padding:1rem; text-align:center; font-size:0.8rem; color:var(--brand-blue); border-bottom:1px solid var(--surface-2);">Seleziona Project Manager</div>' : ''}
           ${suggestions.length ? `<div style="${headerStyle}">SUGGERITI</div>${suggestions.map(renderOption).join('')}` : ''}
           <div style="${headerStyle}">TUTTI</div>
           ${others.map(renderOption).join('')}
        </div>
    `;
}
