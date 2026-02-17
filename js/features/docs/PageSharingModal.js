import { state } from '/js/modules/state.js';
import { fetchDepartments, fetchCollaborators } from '../../modules/api.js';
import { fetchPagePermissions, addPagePermission, deletePagePermission, updateDocPage } from '../../modules/docs_api.js?v=1';

export async function openPageSharingModal(page) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; width: 90vw; border-radius: 16px; padding: 0; display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; background: white; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="font-size: 20px;">share</span>
                    </div>
                    <h2 style="font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--text-primary);">Condividi pagina</h2>
                </div>
                <button class="close-modal-btn" style="background:none; border:none; cursor:pointer; color:var(--text-tertiary);">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

            <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                <!-- Public Access Toggle -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="material-icons-round" style="color: ${page.is_public ? 'var(--brand-blue)' : '#94a3b8'};">public</span>
                        <div>
                            <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Accesso pubblico</div>
                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">Chiunque nella commessa può vedere</div>
                        </div>
                    </div>
                    <div id="public-toggle" style="width: 44px; height: 24px; border-radius: 12px; background: ${page.is_public ? 'var(--brand-blue)' : '#cbd5e1'}; cursor: pointer; position: relative; transition: 0.3s;">
                        <div style="width: 18px; height: 18px; border-radius: 50%; background: white; position: absolute; top: 3px; left: ${page.is_public ? '23px' : '3px'}; transition: 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
                    </div>
                </div>

                <div style="height: 1px; background: #f1f5f9;"></div>

                <!-- Add Permission Section -->
                <div>
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--text-secondary);">Aggiungi accesso</label>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <select id="share-type" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.9rem;">
                            <option value="collaborator">Collaboratore singolo</option>
                            <option value="department">Intero Reparto</option>
                        </select>
                        
                        <div id="target-select-container">
                            <select id="share-target" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; outline: none; font-size: 0.9rem;">
                                <!-- Options loaded dynamically -->
                            </select>
                        </div>

                        <button id="add-permission-btn" style="background: var(--brand-blue); color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span class="material-icons-round" style="font-size: 18px;">add</span>
                            Condividi
                        </button>
                    </div>
                </div>

                <!-- Active Permissions List -->
                <div>
                    <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--text-secondary);">Persone con accesso</label>
                    <div id="permissions-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
                        <div class="loading-state" style="text-align: center; padding: 1rem;"><div class="loading-spinner"></div></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('active');

    const typeSelect = modal.querySelector('#share-type');
    const targetSelect = modal.querySelector('#share-target');
    const addBtn = modal.querySelector('#add-permission-btn');
    const listContainer = modal.querySelector('#permissions-list');
    const closeBtn = modal.querySelector('.close-modal-btn');

    const close = () => modal.remove();
    closeBtn.onclick = close;

    // Background click to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    // Public Toggle Logic
    const publicToggle = modal.querySelector('#public-toggle');
    const publicIcon = modal.querySelector('.material-icons-round[style*="public"]');
    let isPublic = page.is_public;

    publicToggle.onclick = async () => {
        try {
            isPublic = !isPublic;
            await updateDocPage(page.id, { is_public: isPublic });

            // Update UI
            publicToggle.style.background = isPublic ? 'var(--brand-blue)' : '#cbd5e1';
            publicToggle.querySelector('div').style.left = isPublic ? '23px' : '3px';
            if (publicIcon) publicIcon.style.color = isPublic ? 'var(--brand-blue)' : '#94a3b8';

            // Notify UI to refresh sidebar if needed
            document.dispatchEvent(new CustomEvent('doc-page-updated', { detail: { pageId: page.id } }));
        } catch (err) {
            alert('Errore aggiornamento privacy: ' + err.message);
        }
    };

    // Data Loaders
    const loadTargets = async () => {
        const type = typeSelect.value;
        targetSelect.innerHTML = '<option value="">Caricamento...</option>';

        if (type === 'department') {
            if (!state.departments || state.departments.length === 0) await fetchDepartments();
            targetSelect.innerHTML = state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        } else {
            if (!state.collaborators || state.collaborators.length === 0) await fetchCollaborators();
            targetSelect.innerHTML = state.collaborators.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
        }
    };

    const loadPermissions = async () => {
        try {
            const perms = await fetchPagePermissions(page.id);
            if (perms.length === 0) {
                listContainer.innerHTML = '<div style="color: var(--text-tertiary); font-size: 0.85rem; text-align: center; padding: 1rem;">Nessuna condivisione attiva.</div>';
                return;
            }

            // Ensure we have catalog data to resolve names
            if (!state.departments || state.departments.length === 0) await fetchDepartments();
            if (!state.collaborators || state.collaborators.length === 0) await fetchCollaborators();

            listContainer.innerHTML = perms.map(p => {
                let name = 'Sconosciuto';
                let icon = 'person';

                if (p.target_type === 'department') {
                    const dept = state.departments.find(d => d.id === p.target_id);
                    name = dept ? dept.name : 'Reparto non trovato';
                    icon = 'groups';
                } else {
                    const collab = state.collaborators.find(c => c.id === p.target_id);
                    name = collab ? collab.full_name : 'Collaboratore non trovato';
                }

                return `
                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 8px 12px; background: #f8fafc; border-radius: 8px;">
                        <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">${icon}</span>
                        <div style="flex: 1;">
                            <div style="font-size: 0.9rem; font-weight: 500; color: var(--text-primary);">${name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">${p.target_type === 'department' ? 'Reparto' : 'Singolo'}</div>
                        </div>
                        <button class="delete-perm-btn" data-id="${p.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 4px; display: flex;">
                            <span class="material-icons-round" style="font-size: 18px;">delete</span>
                        </button>
                    </div>
                `;
            }).join('');

            // Delete logic
            listContainer.querySelectorAll('.delete-perm-btn').forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    if (confirm('Rimuovere l\'accesso?')) {
                        await deletePagePermission(id);
                        loadPermissions();
                    }
                };
            });

        } catch (err) {
            listContainer.innerHTML = `<div style="color: #ef4444; font-size: 0.8rem;">Errore: ${err.message}</div>`;
        }
    };

    typeSelect.onchange = loadTargets;
    addBtn.onclick = async () => {
        const type = typeSelect.value;
        const targetId = targetSelect.value;

        if (!targetId) {
            alert('Seleziona un destinatario.');
            return;
        }

        try {
            await addPagePermission(page.id, type, targetId, 'view');
            loadPermissions();
        } catch (err) {
            if (err.message.includes('unique_violation') || err.code === '23505') {
                alert('Accesso già esistente per questo destinatario.');
            } else {
                alert('Errore: ' + err.message);
            }
        }
    };

    // Initial Load
    loadTargets();
    loadPermissions();
}
