import { supabase } from '../modules/config.js?v=157';
import { state } from '../modules/state.js?v=157';
import { fetchDepartments, fetchTransactionCategories, fetchAllSystemConfig, upsertSystemConfig } from '../modules/api.js?v=157';

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

        if (state.currentPage === 'employees') {
            window.dispatchEvent(new CustomEvent('departments-updated'));
        }

    } catch (err) {
        if (window.showAlert) window.showAlert('Errore aggiunta reparto: ' + err.message, 'error');
        else console.error(err);
    }
}

export async function handleDeleteDepartment(id) {
    if (window.showConfirm && !await window.showConfirm('Sei sicuro di voler eliminare questo reparto?', { type: 'danger' })) return;
    if (!window.showConfirm && !confirm('Sei sicuro?')) return;

    try {
        const { error } = await supabase.from('departments').delete().eq('id', id);
        if (error) throw error;

        await fetchDepartments();
        loadDepartments();
        if (state.currentPage === 'employees') {
            window.dispatchEvent(new CustomEvent('departments-updated'));
        }
    } catch (err) {
        if (window.showAlert) window.showAlert('Errore eliminazione reparto: ' + err.message, 'error');
        else console.error(err);
    }
}

// ==========================================
// FULL SETTINGS PAGE RENDERER
// ==========================================

export async function renderSettings(container) {
    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 800px; margin: 0 auto; padding: 2rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                <h1 style="font-family: var(--font-titles); color: var(--text-primary); margin: 0;">Impostazioni</h1>
            </div>
            
            <!-- Cards Grid -->
            <div style="display: grid; gap: 2rem;">
                
                <!-- External Integrations Card -->
                <div class="glass-card" style="padding: 2rem;">
                    <h2 style="font-size: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">extension</span>
                        Integrazioni Esterne
                    </h2>
                    
                    <div id="system-config-loader" class="loader small"></div>
                    <form id="system-config-form" style="display: none; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Google Calendar Section -->
                        <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                            <h3 style="font-size: 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <!-- Google Icon SVG -->
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.29.81-.55z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                Google Calendar
                            </h3>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
                                Configura le credenziali OAuth 2.0 per consentire la sincronizzazione dei calendari dei collaboratori.
                                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color: var(--brand-blue); text-decoration: underline;">Console Google Cloud</a>
                            </p>

                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label style="font-size: 0.8rem; font-weight: 500; display: block; margin-bottom: 0.4rem;">Google Client ID</label>
                                <input type="text" name="google_client_id" class="modal-input" placeholder="...apps.googleusercontent.com" style="width: 100%;">
                            </div>
                            
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 500; display: block; margin-bottom: 0.4rem;">Google Client Secret</label>
                                <input type="password" name="google_client_secret" class="modal-input" placeholder="Client secret..." style="width: 100%;">
                                <span style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 0.35rem; display: block;">Visibile solo al momento dell'inserimento per sicurezza.</span>
                            </div>
                        </div>

                        <!-- Save Button -->
                        <div style="display: flex; justify-content: flex-end;">
                            <button type="submit" class="primary-btn" style="padding: 0.75rem 1.5rem;">
                                <span class="material-icons-round">save</span> Salva Configurazioni
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Departments Card (Link to Modal) -->
                <div class="glass-card" style="padding: 2rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem;">Gestione Reparti</h2>
                        <p style="font-size: 0.9rem; color: var(--text-secondary);">Configura i reparti aziendali per i collaboratori.</p>
                    </div>
                    <button class="secondary-btn" onclick="openDepartmentManager()">
                        <span class="material-icons-round">category</span> Gestisci
                    </button>
                </div>
            </div>
        </div>
    `;

    // Initialize Logic
    await loadSystemConfigForm();

    // Ensure global exposure of department manager logic
    if (!window.openDepartmentManager) {
        window.openDepartmentManager = openDepartmentManager;
    }
}

async function loadSystemConfigForm() {
    const loader = document.getElementById('system-config-loader');
    const form = document.getElementById('system-config-form');

    try {
        const configs = await fetchAllSystemConfig();

        // Populate inputs
        const clientId = configs.find(c => c.key === 'google_client_id')?.value || '';
        const clientSecret = configs.find(c => c.key === 'google_client_secret')?.value || '';

        if (form) {
            form.querySelector('[name="google_client_id"]').value = clientId;
            form.querySelector('[name="google_client_secret"]').value = clientSecret;

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleSaveSystemConfig(new FormData(form));
            });

            loader.style.display = 'none';
            form.style.display = 'flex';
        }
    } catch (err) {
        console.error("Error loading configs:", err);
        if (loader) loader.innerHTML = '<div style="color: var(--error-color);">Errore caricamento configurazioni.</div>';
    }
}

async function handleSaveSystemConfig(formData) {
    try {
        const clientId = formData.get('google_client_id').trim();
        const clientSecret = formData.get('google_client_secret').trim();

        if (clientId) await upsertSystemConfig('google_client_id', clientId, 'Google OAuth Client ID');
        if (clientSecret) await upsertSystemConfig('google_client_secret', clientSecret, 'Google OAuth Client Secret');

        if (window.showGlobalAlert) window.showGlobalAlert('Configurazioni salvate con successo!', 'success');
        else alert('Salvato!');
    } catch (err) {
        console.error("Save config error:", err);
        if (window.showGlobalAlert) window.showGlobalAlert('Errore nel salvataggio: ' + err.message, 'error');
        else alert('Errore: ' + err.message);
    }
}
