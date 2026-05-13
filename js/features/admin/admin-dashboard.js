
// js/features/admin/admin-dashboard.js
import { state } from '/js/modules/state.js?v=8000';
import { renderAdminNotifications } from '../notifications.js?v=8000';
import { renderNotificationLogs } from './notification_logs.js?v=8000';
import { renderSystemLogs, getUnresolvedErrorCount } from './admin_system_logs.js?v=8000';

export function renderAdminDashboard(container) {
    // SIMPLIFIED ACCESS CHECK
    // If profile is not loaded yet, assume admin to allow rendering (Router already checked auth).
    // If profile IS loaded, check role strictly.
    const activeRole = state.impersonatedRole || (state.profile ? state.profile.role : 'admin');

    if (activeRole !== 'admin') {
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                <span class="material-icons-round" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">lock</span>
                <h3>Accesso Negato</h3>
                <p>Non hai i permessi per accedere a questa area.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1000px; margin: 0 auto; padding: 2rem;">
            <div style="margin-bottom: 2rem;">
                <h1 style="font-family: var(--font-titles); font-size: 2rem; margin-bottom: 0.5rem; color: var(--text-primary);">Pannello Amministratore</h1>
                <p style="color: var(--text-secondary);">Gestisci le impostazioni globali e prova le nuove funzionalità sperimentali.</p>
            </div>

            <div class="glass-card" style="padding: 0; overflow: hidden; min-height: 500px;">
                <!-- Tabs -->
                <div style="display: flex; border-bottom: 1px solid var(--glass-border); background: var(--bg-secondary);">
                    <button class="tab-btn active" data-tab="settings" style="
                        flex: 1; padding: 1rem; border: none; background: none; 
                        border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); 
                        font-weight: 600; cursor: pointer; transition: all 0.2s;
                    ">
                        <span style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span class="material-icons-round">settings</span>
                            Generali
                        </span>
                    </button>
                    <button class="tab-btn" data-tab="email" style="
                        flex: 1; padding: 1rem; border: none; background: none; 
                        border-bottom: 2px solid transparent; color: var(--text-secondary); 
                        font-weight: 500; cursor: pointer; transition: all 0.2s;
                    ">
                        <span style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span class="material-icons-round">mail</span>
                            Email
                        </span>
                    </button>
                    <button class="tab-btn" data-tab="labs" style="
                        flex: 1; padding: 1rem; border: none; background: none; 
                        border-bottom: 2px solid transparent; color: var(--text-secondary); 
                        font-weight: 500; cursor: pointer; transition: all 0.2s;
                    ">
                        <span style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span class="material-icons-round">science</span>
                            Laboratorio
                        </span>
                    </button>
                    <button class="tab-btn" data-tab="logs" style="
                        flex: 1; padding: 1rem; border: none; background: none; 
                        border-bottom: 2px solid transparent; color: var(--text-secondary); 
                        font-weight: 500; cursor: pointer; transition: all 0.2s;
                    ">
                        <span style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span class="material-icons-round">list_alt</span>
                            Log Notifiche
                        </span>
                    </button>
                    <button class="tab-btn" data-tab="registry" style="
                        flex: 1; padding: 1rem; border: none; background: none; 
                        border-bottom: 2px solid transparent; color: var(--text-secondary); 
                        font-weight: 500; cursor: pointer; transition: all 0.2s;
                    ">
                        <span style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span class="material-icons-round">rule</span>
                            Registro Notifiche
                        </span>
                    </button>
                    <button class="tab-btn" data-tab="system" style="
                        flex: 1; padding: 1rem; border: none; background: none;
                        border-bottom: 2px solid transparent; color: var(--text-secondary);
                        font-weight: 500; cursor: pointer; transition: all 0.2s; position: relative;
                    ">
                        <span style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span class="material-icons-round">bug_report</span>
                            Sistema
                            <span id="error-badge" style="display: none; position: absolute; top: 8px; right: 12px; background: var(--error); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 10px; font-weight: 700;"></span>
                        </span>
                    </button>
                    <button class="tab-btn" data-tab="ai-usage" style="
                        flex: 1; padding: 1rem; border: none; background: none;
                        border-bottom: 2px solid transparent; color: var(--text-secondary);
                        font-weight: 500; cursor: pointer; transition: all 0.2s;
                    ">
                        <span style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span class="material-icons-round">auto_awesome</span>
                            Consumi AI
                        </span>
                    </button>
                </div>

                <!-- Tab Content: Settings -->
                <div id="tab-settings" class="tab-content" style="padding: 2rem;">
                    
                    <!-- Google Calendar Config Section -->
                    <div class="glass-card" style="padding: 1.5rem; margin-bottom: 2rem; border: 1px solid var(--glass-border);">
                        <h3 style="font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <!-- Google Icon SVG -->
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.29.81-.55z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Google Calendar Integration
                        </h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem; line-height: 1.5;">
                            Configura le credenziali OAuth 2.0 per consentire ai collaboratori di sincronizzare i loro calendari.
                            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color: var(--brand-blue);">Console Google Cloud</a>
                        </p>

                        <div id="google-config-loader" style="text-align: center; padding: 1rem;"><span class="loader small"></span></div>
                        <form id="google-config-form" style="display: none; gap: 1.5rem; flex-direction: column;">
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 500; display: block; margin-bottom: 0.4rem;">Google Client ID</label>
                                <input type="text" name="google_client_id" class="modal-input" placeholder="...apps.googleusercontent.com" style="width: 100%;">
                            </div>
                            
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 500; display: block; margin-bottom: 0.4rem;">Google Client Secret</label>
                                <input type="password" name="google_client_secret" class="modal-input" placeholder="Client secret..." style="width: 100%;">
                            </div>

                            <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                                <button type="submit" class="primary-btn" style="padding: 0.6rem 1.25rem;">
                                    <span class="material-icons-round">save</span> Salva
                                </button>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Notifications Settings will be injected here -->
                    <div id="admin-notifications-container"></div>
                </div>

                <!-- Tab Content: Email -->
                <div id="tab-email" class="tab-content hidden" style="padding: 2rem;">
                    <div id="email-config-loader" style="text-align: center; padding: 1rem;"><span class="loader small"></span></div>
                    
                    <div id="email-tabs-container" style="display: none; flex-direction: column; gap: 2rem;">
                        
                        <!-- 1. SMTP Accounts Section -->
                        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
                            <h3 style="font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="color: var(--brand-blue);">server</span>
                                Account di Invio (SMTP)
                            </h3>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem; line-height: 1.5;">
                                Configura gli account email da cui il sistema invierà le comunicazioni.
                            </p>

                            <div id="smtp-accounts-list" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
                                <!-- Accounts Card logic here -->
                            </div>

                            <button id="add-smtp-btn" class="secondary-btn" style="width: 100%; justify-content: center; padding: 0.75rem;">
                                <span class="material-icons-round">add</span> Aggiungi Account SMTP
                            </button>
                        </div>

                        <!-- 2. System Notification Templates -->
                        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                                <div>
                                    <h3 style="font-size: 1.1rem; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                                        <span class="material-icons-round" style="color: var(--brand-blue);">edit_document</span>
                                        Modelli Messaggi di Sistema
                                    </h3>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">Personalizza i testi per ogni tipo di evento.</p>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <select id="template-filter-cat" class="modal-input" style="padding: 4px 10px; font-size: 0.75rem;">
                                        <option value="all">Tutti le categorie</option>
                                        <option value="booking">Prenotazioni</option>
                                        <option value="order">Commesse</option>
                                        <option value="invoice">Contabilità</option>
                                        <option value="general">Generale</option>
                                    </select>
                                </div>
                            </div>

                            <div id="notification-templates-list" style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                                <!-- Notification templates will be injected here -->
                            </div>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                           <button id="save-all-email-btn" class="primary-btn" style="padding: 0.75rem 2rem; font-size: 1rem;">
                                <span class="material-icons-round">save</span> Salva Tutte le Configurazioni Email
                           </button>
                        </div>
                    </div>
                </div>
                    
                    <!-- Notifications Settings will be injected here -->
                    <div id="admin-notifications-container"></div>

                </div>

                <!-- Tab Content: Logs -->
                <div id="tab-logs" class="tab-content hidden" style="padding: 2rem;">
                    <div id="admin-logs-container">Caricamento log...</div>
                </div>

                <!-- Tab Content: Registry -->
                <div id="tab-registry" class="tab-content hidden" style="padding: 2rem; background: var(--bg-primary);">
                    <div id="admin-registry-container">Caricamento registro...</div>
                </div>

                <!-- Tab Content: System -->
                <div id="tab-system" class="tab-content hidden" style="padding: 2rem;">
                    <div id="admin-system-container">Caricamento log di sistema...</div>
                </div>

                <!-- Tab Content: AI Usage -->
                <div id="tab-ai-usage" class="tab-content hidden" style="padding: 2rem;">
                    <div id="admin-ai-usage-container">Caricamento consumi AI...</div>
                </div>

                <!-- Tab Content: Labs -->
                <div id="tab-labs" class="tab-content hidden" style="padding: 2rem;">
                    <div style="background: rgba(97, 74, 162, 0.05); border: 1px solid rgba(97, 74, 162, 0.1); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
                        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                            <span class="material-icons-round" style="color: var(--brand-viola); font-size: 2rem;">science</span>
                            <div>
                                <h3 style="margin: 0; color: var(--brand-viola);">Gleeye Labs</h3>
                                <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">Funzionalità sperimentali in fase di sviluppo. Non ancora pronte per il rilascio pubblico.</p>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                        <!-- Feature Card: Project Hub -->
                        <div class="glass-card feature-card" style="padding: 1.5rem; border: 1px solid var(--glass-border); transition: all 0.2s; cursor: pointer;"
                             onclick="window.location.hash = 'pm/commesse'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                <div style="background: linear-gradient(135deg, #FF6B6B, #FF8E53); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white;">
                                    <span class="material-icons-round">folder_special</span>
                                </div>
                                <span style="background: rgba(33, 150, 243, 0.1); color: #2196f3; font-size: 0.7rem; font-weight: 700; padding: 4px 8px; border-radius: 4px;">BETA</span>
                            </div>
                            <h4 style="margin: 0 0 0.5rem; font-size: 1.1rem;">Project Hub</h4>
                            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.4;">
                                Nuovo modulo per la gestione avanzata delle commesse e attività. Visualizzazione ad albero, KPI e drawer interattivo.
                            </p>
                            <button class="primary-btn" style="width: 100%;">
                                Apri Project Hub
                            </button>
                        </div>

                        <!-- Feature Card: Booking Hub -->
                        <div class="glass-card feature-card" style="padding: 1.5rem; border: 1px solid var(--glass-border); transition: all 0.2s; cursor: pointer;"
                             onclick="window.location.hash = 'booking'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                <div style="background: linear-gradient(135deg, #4facfe, #00f2fe); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white;">
                                    <span class="material-icons-round">event_available</span>
                                </div>
                                <span style="background: rgba(156, 39, 176, 0.1); color: #9c27b0; font-size: 0.7rem; font-weight: 700; padding: 4px 8px; border-radius: 4px;">RE-DESIGN</span>
                            </div>
                            <h4 style="margin: 0 0 0.5rem; font-size: 1.1rem;">Booking Hub</h4>
                            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.4;">
                                Sistema di prenotazione basato su React. Gestione disponibilità team, cataloghi servizi e integrazione Google Calendar.
                            </p>
                            <button class="primary-btn" style="width: 100%;">
                                Apri Booking Hub
                            </button>
                        </div>

                        <!-- Feature Card: Team Chat -->
                        <div class="glass-card feature-card" style="padding: 1.5rem; border: 1px solid var(--glass-border); transition: all 0.2s; cursor: pointer;"
                             onclick="window.location.hash = 'chat'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                                <div style="background: linear-gradient(135deg, #4e92d8, #614aa2); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white;">
                                    <span class="material-icons-round">chat</span>
                                </div>
                                <span style="background: rgba(255, 152, 0, 0.1); color: #f57c00; font-size: 0.7rem; font-weight: 700; padding: 4px 8px; border-radius: 4px;">ALPHA</span>
                            </div>
                            <h4 style="margin: 0 0 0.5rem; font-size: 1.1rem;">Team Chat</h4>
                            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.4;">
                                Sistema di messaggistica interna in tempo reale. Supporta canali, DM, reazioni e allegati.
                            </p>
                            <button class="primary-btn" style="width: 100%;">
                                Apri Chat
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render Notifications settings immediately into the container
    const notifContainer = container.querySelector('#admin-notifications-container');
    if (notifContainer) renderAdminNotifications(notifContainer);

    // Tab Logic
    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Reset active states
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
                t.style.fontWeight = '500';
            });
            contents.forEach(c => c.classList.add('hidden'));

            // Set active state
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';
            tab.style.fontWeight = '600';

            // Show content
            const targetId = `tab-${tab.dataset.tab}`;
            container.querySelector(`#${targetId}`).classList.remove('hidden');

            // Render logs if logs tab is active
            if (tab.dataset.tab === 'logs') {
                const logsContainer = container.querySelector('#admin-logs-container');
                renderNotificationLogs(logsContainer);
            }

            // Render registry if registry tab is active
            if (tab.dataset.tab === 'registry') {
                const registryContainer = container.querySelector('#admin-registry-container');
                import('./admin_registry.js?v=8000').then(mod => {
                    mod.renderActivityRegistry(registryContainer);
                }).catch(err => console.error("Error loading registry module:", err));
            }

            // Render system logs if system tab is active
            if (tab.dataset.tab === 'system') {
                const systemContainer = container.querySelector('#admin-system-container');
                renderSystemLogs(systemContainer);
            }

            // Render AI usage dashboard if ai-usage tab is active
            if (tab.dataset.tab === 'ai-usage') {
                const aiContainer = container.querySelector('#admin-ai-usage-container');
                import('./ai_usage_dashboard.js?v=8001').then(mod => {
                    mod.renderAIUsageDashboard(aiContainer);
                }).catch(err => console.error('Error loading AI usage dashboard:', err));
            }
        });
    });

    // Load error badge count
    getUnresolvedErrorCount().then(count => {
        const badge = container.querySelector('#error-badge');
        if (badge && count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline';
        }
    });

    // Load All Configs
    loadAdminConfigs();
}

async function loadAdminConfigs() {
    const googleLoader = document.getElementById('google-config-loader');
    const googleForm = document.getElementById('google-config-form');
    const emailLoader = document.getElementById('email_config-loader') || document.getElementById('email-config-loader');
    const emailTabsContainer = document.getElementById('email-tabs-container');
    
    if (!googleForm || !emailTabsContainer) return;

    try {
        const { supabase } = await import('../../modules/config.js?v=8000');
        const { fetchAllSystemConfig, upsertSystemConfig } = await import('../../modules/api.js?v=8000');
        
        const configs = await fetchAllSystemConfig();

        // 1. Google Config Populate
        googleForm.querySelector('[name="google_client_id"]').value = configs.find(c => c.key === 'google_client_id')?.value || '';
        googleForm.querySelector('[name="google_client_secret"]').value = configs.find(c => c.key === 'google_client_secret')?.value || '';

        googleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientId = googleForm.querySelector('[name="google_client_id"]').value.trim();
            const clientSecret = googleForm.querySelector('[name="google_client_secret"]').value.trim();
            try {
                await upsertSystemConfig('google_client_id', clientId, 'Google OAuth Client ID');
                await upsertSystemConfig('google_client_secret', clientSecret, 'Google OAuth Client Secret');
                if (window.showGlobalAlert) window.showGlobalAlert('Configurazione Google salvata!', 'success');
            } catch (err) {
                if (window.showGlobalAlert) window.showGlobalAlert('Errore: ' + err.message, 'error');
            }
        });

        // 2. Email Section Handling
        // Multiple SMTP Accounts
        let smtpAccounts = [];
        try {
            const smtpJson = configs.find(c => c.key === 'smtp_accounts')?.value;
            smtpAccounts = smtpJson ? JSON.parse(smtpJson) : [];
        } catch (e) { console.warn("SMTP Accounts parsing error, using defaults"); }

        // Fallback for old single SMTP if accounts list is empty
        if (smtpAccounts.length === 0) {
            const oldHost = configs.find(c => c.key === 'smtp_host')?.value;
            if (oldHost) {
                smtpAccounts.push({
                    id: 'primary',
                    name: configs.find(c => c.key === 'smtp_user')?.value || 'Account Principale',
                    host: oldHost,
                    port: configs.find(c => c.key === 'smtp_port')?.value || '587',
                    security: configs.find(c => c.key === 'smtp_security')?.value || 'ssl',
                    from_name: configs.find(c => c.key === 'smtp_from_name')?.value || '',
                    user: configs.find(c => c.key === 'smtp_user')?.value || '',
                    pass: configs.find(c => c.key === 'smtp_pass')?.value || ''
                });
            }
        }

        const accountsList = document.getElementById('smtp-accounts-list');
        const renderAccounts = () => {
            accountsList.innerHTML = smtpAccounts.map((acc, index) => `
                <div class="glass-card" style="padding: 1rem; background: var(--bg-primary); border: 1px solid var(--glass-border); position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <input type="text" class="modal-input" placeholder="Etichetta Interna (opzionale)" value="${acc.name}" 
                               style="font-weight: 700; border: none; background: transparent; padding: 0; font-size: 1rem;"
                               oninput="this.closest('.glass-card').querySelector('.smtp-label').textContent = '#' + (parseInt(this.dataset.index)+1) + ': ' + (this.closest('.glass-card').querySelector('.smtp-user-field').value || this.value)">
                        <button onclick="window.removeSmtpAccount(${index})" class="text-error" style="background: none; border: none; cursor: pointer;">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div class="form-group">
                            <label style="font-size: 0.75rem;">Host</label>
                            <input type="text" class="modal-input" value="${acc.host || ''}" onchange="window.updateSmtpAccount(${index}, 'host', this.value)">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.75rem;">Porta</label>
                            <input type="text" class="modal-input" value="${acc.port || ''}" onchange="window.updateSmtpAccount(${index}, 'port', this.value)">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.75rem;">Utente (Email)</label>
                            <input type="text" class="modal-input smtp-user-field" value="${acc.user || ''}" 
                                   oninput="window.updateSmtpAccount(${index}, 'user', this.value); this.closest('.glass-card').querySelector('.smtp-label').textContent = '#' + (${index}+1) + ': ' + this.value">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.75rem;">Password</label>
                            <input type="password" class="modal-input" value="${acc.pass || ''}" onchange="window.updateSmtpAccount(${index}, 'pass', this.value)">
                        </div>
                    </div>
                </div>
            `).join('');
        };

        window.updateSmtpAccount = (idx, key, val) => { smtpAccounts[idx][key] = val; };
        window.removeSmtpAccount = (idx) => { smtpAccounts.splice(idx, 1); renderAccounts(); };
        document.getElementById('add-smtp-btn').onclick = () => {
            smtpAccounts.push({ id: Math.random().toString(36).substr(2, 9), name: '', host: '', port: '587', user: '', pass: '', security: 'ssl' });
            renderAccounts();
        };

        renderAccounts();

        // Notification Templates handling
        const { data: notifTypes } = await supabase.from('notification_types').select('*').order('category');
        const templatesList = document.getElementById('notification-templates-list');
        const renderTemplates = (filter = 'all') => {
            const filtered = filter === 'all' ? notifTypes : notifTypes.filter(t => t.category === filter);
            templatesList.innerHTML = filtered.map(tpl => `
                <div class="glass-card template-card" style="padding: 1.25rem; background: var(--bg-primary); border: 1px solid var(--glass-border);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div>
                            <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--brand-blue); background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">${tpl.category || 'general'}</span>
                            <h4 style="margin: 0.5rem 0 0; font-size: 1rem;">${tpl.label_it || tpl.key}</h4>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-direction: column; align-items: flex-end;">
                             <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Invia da:</div>
                             <select class="modal-input tpl-smtp-id" data-id="${tpl.id}" style="padding: 4px 8px; font-size: 0.75rem;">
                                <option value="">Predefinito (Prima casella)</option>
                                ${smtpAccounts.map(acc => `
                                    <option value="${acc.id}" ${tpl.smtp_account_id === acc.id ? 'selected' : ''}>
                                        ${acc.user || acc.name || 'Account senza email'} ${acc.from_name ? `(${acc.from_name})` : ''}
                                    </option>
                                `).join('')}
                             </select>
                             <div style="margin-top: 0.5rem; display: flex; flex-direction: column; align-items: flex-end; width: 100%;">
                                 <div style="font-size: 0.75rem; color: var(--brand-blue); margin-bottom: 0.25rem;">n8n Webhook (opzionale):</div>
                                 <input type="url" class="modal-input tpl-webhook-url" data-id="${tpl.id}" value="${tpl.webhook_url || ''}" 
                                        placeholder="https://n8n.your-instance.com/..." 
                                        style="padding: 4px 8px; font-size: 0.75rem; width: 100%; text-align: right;">
                             </div>
                             <button onclick="window.toggleTemplateEditor('${tpl.id}')" class="secondary-btn" style="padding: 4px 8px; font-size: 0.75rem; margin-top: 0.75rem;">
                                <span class="material-icons-round" style="font-size: 1rem;">expand_more</span> Modifica Testi
                             </button>
                        </div>
                    </div>
                    <div id="editor-${tpl.id}" class="hidden" style="margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem; display: flex; flex-direction: column; gap: 1.5rem;">
                        <p style="font-size: 0.75rem; color: var(--text-tertiary); margin: 0;">Variabili disponibili: <code>${(tpl.variables_schema || []).join(', ')}</code></p>
                        
                        <!-- Internal Template -->
                        <div style="border: 1px solid var(--glass-border); padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.01);">
                            <h5 style="margin: 0 0 1rem; font-size: 0.8rem; color: var(--brand-blue); text-transform: uppercase;">Messaggio Interno (Collaboratori)</h5>
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label style="font-size: 0.75rem;">Oggetto Email</label>
                                <input type="text" class="modal-input tpl-subject" data-id="${tpl.id}" value="${tpl.email_subject_template || ''}" style="width: 100%;">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.75rem;">Corpo Messaggio (HTML)</label>
                                <textarea class="modal-input tpl-body" data-id="${tpl.id}" rows="4" style="width: 100%; font-family: monospace; font-size: 0.8rem;">${tpl.email_body_template || ''}</textarea>
                            </div>
                        </div>

                        <!-- Guest Template (if supported) -->
                        ${(tpl.category === 'booking' || tpl.email_subject_template_guest) ? `
                        <div style="border: 1px solid var(--glass-border); padding: 1rem; border-radius: 8px; background: rgba(16, 185, 129, 0.02);">
                            <h5 style="margin: 0 0 1rem; font-size: 0.8rem; color: #10b981; text-transform: uppercase;">Messaggio per il Cliente (Guest)</h5>
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label style="font-size: 0.75rem;">Oggetto Email Guest</label>
                                <input type="text" class="modal-input tpl-subject-guest" data-id="${tpl.id}" value="${tpl.email_subject_template_guest || ''}" style="width: 100%;">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.75rem;">Corpo Messaggio Guest (HTML)</label>
                                <textarea class="modal-input tpl-body-guest" data-id="${tpl.id}" rows="4" style="width: 100%; font-family: monospace; font-size: 0.8rem;">${tpl.email_body_template_guest || ''}</textarea>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        };

        window.toggleTemplateEditor = (id) => {
            const el = document.getElementById(`editor-${id}`);
            el.classList.toggle('hidden');
        };

        document.getElementById('template-filter-cat').onchange = (e) => renderTemplates(e.target.value);
        renderTemplates();

        // Save All Button
        document.getElementById('save-all-email-btn').onclick = async () => {
            try {
                // 1. Save SMTP Accounts
                await upsertSystemConfig('smtp_accounts', JSON.stringify(smtpAccounts), 'Configurazioni SMTP multiple');

                // 2. Save Templates
                const rows = templatesList.querySelectorAll('.template-card');
                for (const row of rows) {
                    const id = row.querySelector('.tpl-subject').dataset.id;
                    const subject = row.querySelector('.tpl-subject').value;
                    const body = row.querySelector('.tpl-body').value;
                    const smtpId = row.querySelector('.tpl-smtp-id').value;
                    const webhookUrl = row.querySelector('.tpl-webhook-url').value;
                    
                    const guestSubjectInput = row.querySelector('.tpl-subject-guest');
                    const guestBodyInput = row.querySelector('.tpl-body-guest');
                    
                    const updates = {
                        email_subject_template: subject,
                        email_body_template: body,
                        smtp_account_id: smtpId || null,
                        webhook_url: webhookUrl || null
                    };

                    if (guestSubjectInput) updates.email_subject_template_guest = guestSubjectInput.value;
                    if (guestBodyInput) updates.email_body_template_guest = guestBodyInput.value;

                    await supabase.from('notification_types').update(updates).eq('id', id);
                }

                if (window.showGlobalAlert) window.showGlobalAlert('Configurazioni Email salvate con successo!', 'success');
            } catch (err) {
                console.error("Save all email configs failed:", err);
                if (window.showGlobalAlert) window.showGlobalAlert('Errore durante il salvataggio: ' + err.message, 'error');
            }
        };

        googleLoader.style.display = 'none';
        googleForm.style.display = 'flex';
        emailLoader.style.display = 'none';
        emailTabsContainer.style.display = 'flex';
    } catch (err) {
        console.error('Load admin config error:', err);
    }
}
