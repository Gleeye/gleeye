import { state } from '../../../modules/state.js';

export function renderUserPicker(spaceId, targetRole, assignedUserIds = new Set(), extraSuggestedIds = new Set(), sectionTitle = 'Tutti i collaboratori') {
    const space = state.pm_spaces?.find(s => s.id === spaceId) || {};
    const orderId = space.ref_ordine;

    const suggestedSet = new Set(extraSuggestedIds);

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
        if (c.active === false || c.is_active === false) return;

        const uid = c.user_id;

        // 1. Role Filtering for PM
        if (targetRole === 'pm') {
            let tags = c.tags || [];
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch (e) { tags = tags.split(',').map(t => t.trim()); }
            }
            const managerTags = ['project manager', 'pm', 'account', 'partner', 'amministrazione', 'socio'];
            const isProjectManager = Array.isArray(tags) &&
                tags.some(t => managerTags.includes(t.toLowerCase()));

            if (!isProjectManager) return;
        }

        // Exclude if already assigned
        if (uid && assignedUserIds.has(uid)) return;
        if (c.id && assignedUserIds.has(c.id)) return;
        if (uid && processedUserIds.has(uid)) return;

        if (uid) processedUserIds.add(uid);

        let name = c?.full_name || [c?.first_name, c?.last_name].filter(v => v && v !== 'null').join(' ');
        if (!name || name === 'Utente') {
            const p = state.profiles?.find(x => x.id === uid);
            if (p) {
                name = p.full_name || [p.first_name, p.last_name].filter(v => v && v !== 'null').join(' ');
            }
        }
        if (!name) name = 'Collaboratore Sconosciuto';

        let avatar = c.avatar_url;
        if (!avatar && uid) {
            const p = state.profiles?.find(x => x.id === uid);
            if (p) avatar = p.avatar_url;
        }

        const u = {
            uid: uid,
            collabId: c.id,
            name: name,
            avatar: avatar,
            hasAccount: !!uid
        };

        if (suggestedSet.has(c.id) || (uid && suggestedSet.has(uid))) suggestions.push(u);
        else others.push(u);
    });

    if (space.default_pm_user_ref && !assignedUserIds.has(space.default_pm_user_ref) && !processedUserIds.has(space.default_pm_user_ref)) {
        const pm = state.profiles?.find(p => p.id === space.default_pm_user_ref);
        if (pm) {
            suggestions.unshift({
                uid: pm.id,
                name: (pm.full_name || [pm.first_name, pm.last_name].filter(v => v && v !== 'null').join(' ') || 'PM') + ' (PM)',
                avatar: pm.avatar_url,
                hasAccount: true,
                isPm: true
            });
        }
    }

    const renderOption = (u) => {
        const uid = u.uid || '';
        const avatar = u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name);
        let desc = u.isPm ? 'Project Manager' : (!u.hasAccount ? 'Collaboratore esterno' : '');

        return `
            <div class="user-option" 
                data-uid="${uid}" 
                data-collab-id="${u.collabId || ''}"
                data-name="${u.name}"
                data-name-search="${u.name.toLowerCase()}"
                style="
                    padding: 8px 12px; 
                    display: flex; 
                    align-items: center; 
                    gap: 10px; 
                    cursor: pointer; 
                    transition: background 0.15s;
                    opacity: ${!u.hasAccount && targetRole === 'pm' ? '0.5' : '1'};
                " onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <img src="${avatar}" style="width: 28px; height: 28px; border-radius: 6px; object-fit: cover; flex-shrink: 0;">
                <div style="min-width: 0; flex: 1;">
                    <div style="font-size: 0.9rem; font-weight: 500; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</div>
                    ${desc ? `<div style="font-size: 0.7rem; color: #94a3b8; white-space: nowrap;">${desc}</div>` : ''}
                </div>
            </div>
        `;
    };

    const headerStyle = "padding: 5px 12px; font-size: 0.65rem; font-weight: 600; color: #94a3b8; letter-spacing: 0.05em; background: #f8fafc; border-bottom: 1px solid #f1f5f9; text-transform: uppercase;";

    return `
        <div class="user-picker-container" style="display: flex; flex-direction: column; max-height: 400px; width: 100%;">
            <div style="padding: 10px 12px 6px; background: white;">
                <div style="display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                    <input type="text" class="user-picker-search" placeholder="Filtra..." 
                        autocomplete="one-time-code" 
                        autocorrect="off" 
                        autocapitalize="none" 
                        spellcheck="false" 
                        inputmode="search"
                        data-lpignore="true"
                        style="
                        border: none !important; background: transparent !important; height: 28px; width: 100%; font-size: 0.9rem; outline: none !important; box-shadow: none !important; padding: 0; color: #334155;
                    ">
                </div>
            </div>
            <div class="user-picker-list" style="overflow-y: auto; flex: 1; padding-bottom: 4px;">
               ${suggestions.length ? `<div class="picker-section-header" style="${headerStyle}">Suggeriti</div>${suggestions.map(renderOption).join('')}` : ''}
               <div class="picker-section-header" style="${headerStyle}">${sectionTitle}</div>
               ${others.length ? others.map(renderOption).join('') : `<div style="padding: 1rem; text-align: center; color: #94a3b8; font-size: 0.8rem;">Nessun altro utente disponibile</div>`}
            </div>
        </div>
    `;
}





