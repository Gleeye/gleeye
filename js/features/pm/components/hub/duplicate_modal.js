// Hub drawer — duplicate-task modal + quick assignee removal.
// Extracted from hub_drawer.js step 3.
//
// Public exports:
//   - showDuplicateModal(itemId, currentItem, spaceId)
//     Resolves with options { count, type, parentRef, targetSpaceId, includeSubtasks }
//     describing how the user wants to duplicate the task.
//
// Side effects on import:
//   - window.quickRemoveAssignee(itemId, assignmentId)
//     Removes a pm_item_assignees row and refreshes the drawer.
//
// Note on circular dep: the original quickRemoveAssignee re-opens the
// drawer via openHubDrawer (declared in hub_drawer.js, our parent).
// Rewritten as `import('../hub_drawer.js')` dynamic import to avoid a
// static cycle.

import { state } from '../../../../modules/state.js?v=8000';
import { supabase } from '../../../../modules/config.js?v=8000';
import { renderModal, closeModal } from '../../../../modules/utils.js?v=8000';

export async function showDuplicateModal(itemId, currentItem, spaceId) {
    return new Promise((resolve) => {
        const modalId = `duplicate-modal-${Date.now()}`;

        // 1. Prepare and format spaces
        const spaces = (state.pm_spaces || []).map(s => {
            let displayName = s.name || '';
            let icon = 'folder';
            let color = 'var(--text-tertiary, #94a3b8)';

            if (s.type === 'commessa') {
                const o = (state.orders || []).find(x => x.id === s.ref_ordine);
                displayName = o ? `#${o.order_number} ${o.title}` : (s.name || 'Commessa');
                icon = 'style';
                color = 'var(--brand-blue)';
            } else if (s.is_cluster) {
                icon = 'folder_special';
                color = 'var(--brand-purple)';
            } else if (s.type === 'interno') {
                color = 'var(--brand-purple)';
                if (s.parent_ref) color = 'rgba(var(--brand-purple-rgb, 139, 92, 246), 0.7)';
            }

            return { ...s, displayName: displayName || 'Senza nome', icon, color };
        }).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

        const currentSpace = spaces.find(s => s.id === spaceId);
        let selectedSpaceId = spaceId;

        const content = `
            <div style="background: var(--bg-card, #fff); position: relative;">
                <button class="close-modal" id="dup-close-x" style="position: absolute; top: -10px; right: -10px; z-index: 10;"><span class="material-icons-round">close</span></button>
                <h3 style="margin: 0 0 1.25rem 0; font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">Duplica <b>${currentItem.title}</b></h3>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary, #94a3b8); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.02em;">NOME</label>
                    <input type="text" id="dup-title" class="form-control" value="copia di ${currentItem.title}" style="width: 100%; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border-default, #e2e8f0); font-size: 0.85rem; font-family: 'Outfit', sans-serif; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--brand-blue)'" onblur="this.style.borderColor='var(--border-default, #e2e8f0)'">
                </div>

                <div style="margin-bottom: 1rem;">
                    <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary, #94a3b8); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.02em;">PREFISSO PER SOTTO-ATTIVITÀ (FACOLTATIVO)</label>
                    <input type="text" id="dup-prefix" class="form-control" placeholder="es. [COPY] " style="width: 100%; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border-default, #e2e8f0); font-size: 0.85rem; font-family: 'Outfit', sans-serif; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--brand-blue)'" onblur="this.style.borderColor='var(--border-default, #e2e8f0)'">
                </div>

                <div style="margin-bottom: 1.25rem;">
                    <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary, #94a3b8); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.02em;">SALVA IN</label>
                    <div style="position: relative;">
                        <div id="dup-space-trigger" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border-default, #e2e8f0); background: var(--bg-card, #fff); cursor: pointer; transition: all 0.2s;">
                           <span class="material-icons-round" style="font-size: 1.1rem; color: ${currentSpace ? currentSpace.color : 'var(--text-tertiary, #94a3b8)'};">${currentSpace ? currentSpace.icon : 'location_on'}</span>
                           <span id="dup-space-label" style="font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentSpace ? currentSpace.displayName : 'Seleziona ubicazione...'}</span>
                           <span class="material-icons-round" style="margin-left: auto; font-size: 1.1rem; color: var(--text-tertiary, #94a3b8);">expand_more</span>
                        </div>
                        <div id="dup-space-menu" class="hidden dropdown-menu glass-card" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; z-index: 1000; max-height: 220px; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-radius: 12px; background: var(--bg-card, white); border: 1px solid var(--bg-tertiary, #f1f5f9); padding: 6px;">
                            <div style="padding: 4px 8px 10px; border-bottom: 1px solid var(--bg-tertiary, #f1f5f9); position: sticky; top: 0; background: var(--bg-card, #fff); z-index: 1;">
                                <input type="text" id="dup-space-search" placeholder="Cerca progetto..." style="width: 100%; border: none; outline: none; font-size: 0.8rem; font-family: 'Outfit', sans-serif; height: 32px;">
                            </div>
                            <div id="dup-spaces-list">
                                ${spaces.map(s => `
                                    <div class="dup-space-opt" data-id="${s.id}" data-name="${s.displayName.toLowerCase()}" style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.8rem; transition: background 0.2s; border-radius: 8px;">
                                        <span class="material-icons-round" style="font-size: 1.1rem; color: ${s.color};">${s.icon}</span>
                                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${s.displayName}</span>
                                        ${s.id === selectedSpaceId ? '<span class="material-icons-round" style="font-size: 0.9rem; color: var(--brand-blue);">check</span>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 1.25rem;">
                    <label style="display: block; font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary, #94a3b8); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.02em;">COSA COPIARE</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                            <input type="checkbox" id="dup-inc-sub" checked style="width: 16px; height: 16px; border-radius: 4px; accent-color: var(--brand-blue); cursor: pointer;">
                            <span style="font-weight: 500;">Sotto-attività</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                            <input type="checkbox" id="dup-inc-desc" checked style="width: 16px; height: 16px; border-radius: 4px; accent-color: var(--brand-blue); cursor: pointer;">
                            <span style="font-weight: 500;">Descrizioni</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                            <input type="checkbox" id="dup-inc-attach" checked style="width: 16px; height: 16px; border-radius: 4px; accent-color: var(--brand-blue); cursor: pointer;">
                            <span style="font-weight: 500;">Allegati</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                            <input type="checkbox" id="dup-inc-assign" checked style="width: 16px; height: 16px; border-radius: 4px; accent-color: var(--brand-blue); cursor: pointer;">
                            <span style="font-weight: 500;">Assegnatari</span>
                        </label>
                    </div>
                </div>

                <div style="margin-bottom: 1.5rem; border-top: 1px dashed var(--bg-tertiary, #f1f5f9); padding-top: 1rem;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; user-select: none;">
                        <input type="checkbox" id="dup-reschedule" style="width: 16px; height: 16px; border-radius: 4px; accent-color: var(--brand-blue); cursor: pointer;">
                        <span style="font-weight: 500;">Ripianificare (pulisci date)</span>
                    </label>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="dup-cancel" style="padding: 8px 16px; font-weight: 600; background: var(--bg-tertiary, #f1f5f9); color: var(--text-secondary, #64748b); border: none; border-radius: 10px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 0.85rem; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-hover, #e2e8f0)'" onmouseout="this.style.background='var(--bg-tertiary, #f1f5f9)'">Annulla</button>
                    <button id="dup-submit" style="padding: 8px 20px; font-weight: 600; background: var(--brand-blue); color: #fff; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); font-family: 'Outfit', sans-serif; font-size: 0.85rem; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 15px rgba(59, 130, 246, 0.3)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.2)'">Duplica</button>
                </div>
            </div>
        `;

        renderModal(modalId, content);

        const modalDiv = document.getElementById(modalId);

        // Compact styling override
        const contentDiv = modalDiv.querySelector('.modal-content');
        if (contentDiv) {
            contentDiv.style.maxWidth = '460px';
            contentDiv.style.padding = '1.5rem';
            contentDiv.style.borderRadius = '20px';
        }

        const trigger = modalDiv.querySelector('#dup-space-trigger');
        const menu = modalDiv.querySelector('#dup-space-menu');
        const searchInput = modalDiv.querySelector('#dup-space-search');
        const label = modalDiv.querySelector('#dup-space-label');
        const triggerIcon = trigger.querySelector('.material-icons-round:first-child');

        trigger.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
            if (!menu.classList.contains('hidden')) searchInput.focus();
        };

        searchInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            modalDiv.querySelectorAll('.dup-space-opt').forEach(opt => {
                const name = opt.dataset.name;
                opt.style.display = name.includes(val) ? 'flex' : 'none';
            });
        };

        modalDiv.querySelectorAll('.dup-space-opt').forEach(opt => {
            opt.onmouseover = () => opt.style.background = 'var(--bg-tertiary, #f8fafc)';
            opt.onmouseout = () => opt.style.background = 'transparent';
            opt.onclick = (e) => {
                e.stopPropagation();
                selectedSpaceId = opt.dataset.id;
                const s = spaces.find(x => x.id === selectedSpaceId);
                label.innerText = s.displayName;
                triggerIcon.innerText = s.icon;
                triggerIcon.style.color = s.color;

                menu.classList.add('hidden');
                modalDiv.querySelectorAll('.dup-space-opt .material-icons-round:last-child').forEach(check => {
                    if (check.innerText === 'check') check.remove();
                });
                opt.innerHTML += `<span class="material-icons-round" style="font-size: 0.9rem; color: var(--brand-blue); margin-left: auto;">check</span>`;
            };
        });

        document.getElementById('dup-cancel').onclick = () => {
            closeModal(modalId);
            resolve(null);
        };

        document.getElementById('dup-close-x').onclick = () => {
            closeModal(modalId);
            resolve(null);
        };

        document.getElementById('dup-submit').onclick = () => {
            const options = {
                title: document.getElementById('dup-title').value,
                prefix: document.getElementById('dup-prefix').value,
                newSpaceId: selectedSpaceId,
                includeSubItems: document.getElementById('dup-inc-sub').checked,
                includeDescription: document.getElementById('dup-inc-desc').checked,
                includeAttachments: document.getElementById('dup-inc-attach').checked,
                includeAssignees: document.getElementById('dup-inc-assign').checked,
                reschedule: document.getElementById('dup-reschedule').checked
            };
            closeModal(modalId);
            resolve(options);
        };

        // Close space menu on outside click
        modalDiv.onclick = (e) => {
            if (!e.target.closest('#dup-space-trigger') && !e.target.closest('#dup-space-menu')) {
                menu.classList.add('hidden');
            }
        };
    });
}

window.quickRemoveAssignee = async (itemId, assignmentId) => {
    if (!confirm("Rimuovere questa persona dalla task?")) return;
    try {
        await supabase.from('pm_item_assignees').delete().eq('id', assignmentId);
        // Refresh the drawer to show updated state
        // Re-open the drawer via dynamic import to avoid a static circular dep with hub_drawer.js
        import('../hub_drawer.js?v=8022').then(m => m.openHubDrawer(itemId));
    } catch (e) {
        console.error("Error removing assignee:", e);
        alert("Errore durante la rimozione dell'assegnatario.");
    }
};
