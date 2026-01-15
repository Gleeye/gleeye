import { supabase } from '../modules/config.js?v=123';
import { state } from '../modules/state.js?v=123';
import { fetchDepartments, fetchTransactionCategories } from '../modules/api.js?v=123';

export function initSettingsModals() {
    if (!document.getElementById('dept-manager-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="dept-manager-modal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Gestione Reparti</h2>
                        <button class="close-modal material-icons-round" id="close-dept-modal-btn">close</button>
                    </div>
                    <div class="dept-list-container">
                        <form id="dept-form" style="display: flex; gap: 0.5rem; margin-bottom: 2rem;">
                            <input type="text" id="new-dept-name" placeholder="Nuovo reparto..." required style="flex: 1;">
                            <button type="submit" class="primary-btn small" style="width: auto;">Aggiungi</button>
                        </form>
                        <div id="dept-list-items" style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <!-- Reparti caricati qui -->
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Form Submit Handler
        document.getElementById('dept-form').addEventListener('submit', handleAddDepartment);
        document.getElementById('close-dept-modal-btn').addEventListener('click', closeDepartmentManager);
    }
}

export function closeDepartmentManager() {
    const modal = document.getElementById('dept-manager-modal');
    if (modal) modal.classList.remove('active');
}

export function openDepartmentManager() {
    const modal = document.getElementById('dept-manager-modal');
    if (modal) {
        modal.classList.add('active');
        loadDepartments();
    }
}

async function loadDepartments() {
    const list = document.getElementById('dept-list-items');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; opacity:0.6;">Caricamento...</div>';

    // Ensure we have latest
    await fetchDepartments();

    if (state.departments.length === 0) {
        list.innerHTML = '<div style="text-align:center; opacity:0.6;">Nessun reparto trovato.</div>';
        return;
    }

    list.innerHTML = state.departments.map(d => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
            <span style="font-weight: 500;">${d.name}</span>
            <button class="icon-btn small delete-dept-btn" data-id="${d.id}" style="color: var(--error-color);">
                <span class="material-icons-round">delete</span>
            </button>
        </div>
    `).join('');

    // Attach delete listeners
    list.querySelectorAll('.delete-dept-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteDepartment(btn.dataset.id));
    });
}

async function handleAddDepartment(e) {
    e.preventDefault();
    const input = document.getElementById('new-dept-name');
    const name = input.value.trim();
    if (!name) return;

    try {
        const { error } = await supabase.from('departments').insert([{ name }]);
        if (error) throw error;

        input.value = '';
        await fetchDepartments();
        loadDepartments(); // Refresh list

        // Also refresh collaborator view if open to update pills
        // This is a bit of a hack, simply updating state should trigger re-renders if we had reactive UI
        // We will just reload the current page's view if it is employees
        if (state.currentPage === 'employees') {
            // We can't easily call renderCollaborators from here without circular deps or event bus
            // Ideally we just reload the page hash or similar, but for now let's leave it. 
            // The user will see it updated when they refresh or navigate back.
            // Actually, the pills map over state.departments so if we re-render renderCollaborators it would work.
            // But we don't have access to renderCollaborators here.
            // We can dispatch a custom event.
            window.dispatchEvent(new CustomEvent('departments-updated'));
        }

    } catch (err) {
        showAlert('Errore aggiunta reparto: ' + err.message, 'error');
    }
}

async function handleDeleteDepartment(id) {
    if (!await showConfirm('Sei sicuro di voler eliminare questo reparto?', { type: 'danger' })) return;

    try {
        const { error } = await supabase.from('departments').delete().eq('id', id);
        if (error) throw error;

        await fetchDepartments();
        loadDepartments();
        if (state.currentPage === 'employees') {
            window.dispatchEvent(new CustomEvent('departments-updated'));
        }
    } catch (err) {
        showAlert('Errore eliminazione reparto: ' + err.message, 'error');
    }
}
