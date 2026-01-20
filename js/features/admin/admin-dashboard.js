
// js/features/admin/admin-dashboard.js
import { state } from '../../modules/state.js?v=148';
import { renderAdminNotifications } from '../notifications.js?v=148';

export function renderAdminDashboard(container) {
    const activeRole = state.impersonatedRole || state.profile?.role;
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
                            Impostazioni
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
                </div>

                <!-- Tab Content: Settings -->
                <div id="tab-settings" class="tab-content" style="padding: 2rem;">
                    <!-- Notifications Settings will be injected here -->
                    <div id="admin-notifications-container"></div>
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
                        <!-- Feature Card: Team Chat (Hidden in public)
                        <div class="glass-card feature-card" style="padding: 1.5rem; border: 1px solid var(--glass-border); transition: all 0.2s; cursor: pointer;">
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
                            <button class="primary-btn" onclick="window.location.hash = 'chat'" style="width: 100%;">
                                Apri Chat
                            </button>
                        </div>
                        -->
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
        });
    });
}
