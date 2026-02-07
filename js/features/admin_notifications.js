/**
 * Admin Notification Settings Page
 * Manages global notification types and configuration
 */

import { supabase } from '../modules/config.js?v=317';
import { state } from '../modules/state.js?v=317';
import { fetchAllSystemConfig, upsertSystemConfig } from '../modules/api.js?v=317';

export async function renderAdminNotifications(container) {
    // Check admin access
    if (!state.profile || state.profile.role !== 'admin') {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center;">
                <span class="material-icons-round" style="font-size: 3rem; color: var(--error-color);">lock</span>
                <h3>Accesso Negato</h3>
                <p>Questa pagina è riservata agli amministratori.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1000px; margin: 0 auto;">
            <div style="margin-bottom: 2rem;">
                <h1 style="margin: 0; font-size: 1.8rem;">Impostazioni Notifiche</h1>
                <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary);">Gestisci i tipi di notifica e la configurazione email</p>
            </div>

            <!-- Tabs -->
            <div class="tabs-container" style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1.5rem;">
                <button class="admin-tab-btn active" data-tab="types" style="padding: 0.8rem 1rem; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 500; cursor: pointer;">
                    Tipi di Notifica
                </button>
                <button class="admin-tab-btn" data-tab="email" style="padding: 0.8rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">
                    Configurazione Email
                </button>
            </div>

            <!-- Tab: Notification Types -->
            <div id="admin-tab-types" class="admin-tab-content">
                <div class="glass-card" style="padding: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 style="margin: 0; font-size: 1.1rem;">Tipi di Notifica Attivi</h3>
                        <button class="primary-btn small" id="add-notification-type-btn">
                            <span class="material-icons-round" style="font-size: 16px;">add</span>
                            Nuovo Tipo
                        </button>
                    </div>
                    <div id="notification-types-list">
                        <div style="padding: 2rem; text-align: center;"><span class="loader"></span></div>
                    </div>
                </div>
            </div>

            <!-- Tab: Email Configuration -->
            <div id="admin-tab-email" class="admin-tab-content hidden">
                <div class="glass-card" style="padding: 2rem; max-width: 600px;">
                    <h3 style="margin: 0 0 1.5rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">email</span>
                        Configurazione SMTP
                    </h3>
                    <form id="smtp-config-form">
                        <div class="form-group">
                            <label>SMTP Host</label>
                            <input type="text" id="smtp-host" placeholder="smtp.gmail.com">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>Porta</label>
                                <input type="number" id="smtp-port" placeholder="587">
                            </div>
                            <div class="form-group">
                                <label>Sicurezza</label>
                                <select id="smtp-security">
                                    <option value="tls">TLS</option>
                                    <option value="ssl">SSL</option>
                                    <option value="none">Nessuna</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Username / Email</label>
                            <input type="email" id="smtp-user" placeholder="noreply@gleeye.eu">
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" id="smtp-pass" placeholder="••••••••">
                        </div>
                        <div class="form-group">
                            <label>Nome Mittente</label>
                            <input type="text" id="smtp-from-name" placeholder="Gleeye Workspace">
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 2rem;">
                            <button type="button" class="secondary-btn" id="test-email-btn">
                                <span class="material-icons-round" style="font-size: 16px;">send</span>
                                Invia Test
                            </button>
                            <button type="submit" class="primary-btn">Salva Configurazione</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Tab Logic
    const tabs = container.querySelectorAll('.admin-tab-btn');
    const contents = container.querySelectorAll('.admin-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
            });
            contents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';

            const target = document.getElementById('admin-tab-' + tab.dataset.tab);
            if (target) target.classList.remove('hidden');
        });
    });

    // Load notification types
    loadNotificationTypes(container);

    // Load SMTP config
    loadSMTPConfig();

    // Bind form submit
    const smtpForm = container.querySelector('#smtp-config-form');
    smtpForm.addEventListener('submit', saveSMTPConfig);

    // Test email button
    container.querySelector('#test-email-btn').addEventListener('click', sendTestEmail);
}

// --- RENDER LOGIC ---

async function loadNotificationTypes(container) {
    const list = container.querySelector('#notification-types-list');

    try {
        const { data, error } = await supabase
            .from('notification_types')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:var(--text-tertiary);">Nessun tipo di notifica configurato.</p>';
            return;
        }

        const categoryLabels = {
            'booking': 'Prenotazioni',
            'payment': 'Pagamenti',
            'invoice': 'Fatture',
            'order': 'Ordini',
            'general': 'Generali'
        };

        // Group by category
        const grouped = {};
        data.forEach(t => {
            if (!grouped[t.category]) grouped[t.category] = [];
            grouped[t.category].push(t);
        });

        let html = `
            <style>
                .notif-row {
                    display: flex; justify-content: space-between; align-items: center; 
                    padding: 1.25rem; background: var(--bg-secondary); border-radius: 16px; 
                    border: 1px solid var(--glass-border); transition: all 0.2s; cursor: pointer;
                }
                .notif-row:hover {
                    background: var(--card-bg);
                    border-color: var(--brand-blue);
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }
                .channel-icon {
                    padding: 8px; border-radius: 50%; background: var(--glass-border); 
                    color: var(--text-tertiary); transition: all 0.2s;
                    display: flex; align-items: center; justify-content: center;
                }
                .channel-icon.active {
                    background: rgba(78, 146, 216, 0.1); color: var(--brand-blue);
                }
                .channel-icon.active.web {
                    background: rgba(139, 92, 246, 0.1); color: var(--brand-viola);
                }
                
                /* Switch Toggle Style */
                .modal-switch-container {
                    display: flex; align-items: center; justify-content: space-between; 
                    padding: 1rem; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 0.75rem;
                }
                .modal-switch-label {
                    display: flex; align-items: center; gap: 10px; font-weight: 500; color: var(--text-primary);
                }
                .switch {
                    position: relative; display: inline-block; width: 44px; height: 24px;
                }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider {
                    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; 
                    background-color: #ccc; transition: .4s; border-radius: 34px;
                }
                .slider:before {
                    position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; 
                    background-color: white; transition: .4s; border-radius: 50%;
                }
                input:checked + .slider { background-color: var(--brand-blue); }
                input:checked + .slider:before { transform: translateX(20px); }
            </style>
        `;

        for (const category in grouped) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h4 style="margin: 0 0 1rem 0.5rem; font-size: 0.8rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1px;">
                        ${categoryLabels[category] || category}
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
            `;

            grouped[category].forEach(type => {
                html += `
                    <div class="notif-row" data-id="${type.id}">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem;">
                                ${type.label_it}
                                ${!type.is_active ? '<span style="font-size: 0.7rem; padding: 2px 8px; background: var(--text-tertiary); color: white; border-radius: 10px;">INATTIVO</span>' : ''}
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4;">
                                ${type.description || 'Nessuna descrizione.'}
                            </div>
                            <code style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 6px; display: inline-block; background: var(--bg-primary); padding: 2px 6px; border-radius: 4px;">${type.key}</code>
                        </div>

                        <!-- Status Icons -->
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-left: 1.5rem;">
                            <div class="channel-icon ${type.default_email ? 'active' : ''}" title="Email ${type.default_email ? 'Attiva' : 'Disabilitata'}">
                                <span class="material-icons-round">email</span>
                            </div>
                            <div class="channel-icon ${type.default_web ? 'active web' : ''}" title="Notifica App ${type.default_web ? 'Attiva' : 'Disabilitata'}">
                                <span class="material-icons-round">notifications_active</span>
                            </div>
                            <!-- Arrow -->
                            <span class="material-icons-round" style="color: var(--glass-border); margin-left: 0.5rem;">chevron_right</span>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        list.innerHTML = html;

        // Click Handler (Row)
        list.querySelectorAll('.notif-row').forEach(row => {
            row.addEventListener('click', () => openEditModal(row.dataset.id, data));
        });

    } catch (err) {
        console.error('Error loading notification types:', err);
        list.innerHTML = `<p style="text-align:center; color:var(--error-color);">Errore: ${err.message}</p>`;
    }
}

// --- EDIT MODAL LOGIC (ENHANCED) ---

let currentEditId = null;

function openEditModal(id, allTypes) {
    const type = allTypes.find(t => t.id === id);
    if (!type) return;

    currentEditId = id;

    // Remove existing if any
    const existing = document.getElementById('edit-notification-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'edit-notification-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999;';

    // Updated width to be much wider as requested
    modal.innerHTML = `
        <div class="modal-content animate-scale-in" style="background: white; width: 900px; max-width: 95%; border-radius: 24px; box-shadow: 0 25px 50px rgba(0,0,0,0.15); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden;">
            <!-- Header -->
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: #fff;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-primary);">Configura Notifica</h3>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                         <span class="material-icons-round" style="font-size: 16px; color: var(--brand-blue);">info</span>
                         <span style="color: var(--text-secondary); font-size: 0.95rem;">${type.label_it}</span>
                         <code style="font-size: 0.75rem; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; color: var(--text-tertiary);">${type.key}</code>
                    </div>
                </div>
                <button class="close-modal-btn icon-btn" style="background: var(--bg-secondary); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: background 0.2s;">
                    <span class="material-icons-round">close</span>
                </button>
            </div>

            <!-- Tabs Navigation -->
            <div style="padding: 0 2rem; background: var(--bg-primary); border-bottom: 1px solid var(--glass-border); display: flex; gap: 2rem;">
                <button class="modal-tab-btn active" data-target="tab-general" style="padding: 1rem 0; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 600; cursor: pointer;">Generale</button>
                <button class="modal-tab-btn" data-target="tab-team" style="padding: 1rem 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); font-weight: 500; cursor: pointer;">Template Team</button>
                <button class="modal-tab-btn" data-target="tab-guest" style="padding: 1rem 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); font-weight: 500; cursor: pointer;">Template Cliente</button>
            </div>

            <!-- Body (Scrollable) -->
            <div style="padding: 2rem; overflow-y: auto; flex: 1; background: #fff;">
                
                <!-- TAB 1: GENERAL -->
                <div id="tab-general" class="modal-tab-content">
                    <div style="max-width: 600px;">
                        <div class="modal-switch-container">
                            <div class="modal-switch-label">
                                <span class="material-icons-round" style="color: var(--success-color);">power_settings_new</span>
                                <div>
                                    <div style="font-size: 1rem;">Notifica Attiva</div>
                                    <div style="font-size: 0.8rem; color: var(--text-tertiary); font-weight: 400;">Abilita o disabilita questo tipo di notifica globalmente</div>
                                </div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="edit-active" ${type.is_active ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>

                        <div style="margin-top: 2rem;">
                            <h4 style="margin: 0 0 1rem 0.5rem; font-size: 0.8rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700;">Canali Disponibili</h4>
                            
                            <div class="modal-switch-container">
                                <div class="modal-switch-label">
                                    <span class="material-icons-round" style="color: #4e92d8;">email</span>
                                    Canale Email (SMTP)
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="edit-email-enabled" ${type.default_email ? 'checked' : ''}>
                                    <span class="slider"></span>
                                </label>
                            </div>

                            <div class="modal-switch-container">
                                <div class="modal-switch-label">
                                    <span class="material-icons-round" style="color: #8b5cf6;">notifications_active</span>
                                    Canale Web / App
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="edit-web-enabled" ${type.default_web ? 'checked' : ''}>
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB 2: TEAM TEMPLATE -->
                <div id="tab-team" class="modal-tab-content hidden" style="display: none;">
                    <div class="info-box" style="background: #eff6ff; border: 1px solid #dbeafe; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; color: #1e40af; font-size: 0.9rem;">
                        <span class="material-icons-round" style="font-size: 16px; vertical-align: middle;">info</span>
                        Questa email viene inviata ai <strong>collaboratori</strong> o agli amministratori.
                    </div>

                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label>Oggetto Email</label>
                        <input type="text" id="edit-template-subject" value="${type.email_subject_template || ''}" placeholder="Es. Nuova prenotazione: {{guest_name}}">
                    </div>

                    <div class="form-group">
                        <label>Contenuto (HTML)</label>
                        <textarea id="edit-template-body" style="min-height: 300px; font-family: monospace; font-size: 0.9rem; line-height: 1.6; padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border);" placeholder="<h1>Ciao...</h1>">${type.email_body_template || ''}</textarea>
                    </div>

                    <div style="margin-top: 1rem;">
                        <span style="font-size: 0.8rem; color: var(--text-tertiary); display: block; margin-bottom: 0.5rem;">Variabili dinamiche:</span>
                        <div class="variables-list" style="display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
                    </div>
                </div>

                <!-- TAB 3: GUEST TEMPLATE -->
                <div id="tab-guest" class="modal-tab-content hidden" style="display: none;">
                    <div class="info-box" style="background: #fdf2f8; border: 1px solid #fce7f3; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; color: #be185d; font-size: 0.9rem;">
                        <span class="material-icons-round" style="font-size: 16px; vertical-align: middle;">info</span>
                        Questa email viene inviata al <strong>cliente finale</strong> (se applicabile).
                        <div style="margin-top: 8px; display: flex; align-items: center; gap: 10px;">
                            <label class="switch" style="transform: scale(0.8); margin: 0;">
                                <input type="checkbox" id="edit-guest-enabled" ${type.default_email_guest !== false ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <span style="font-size: 0.85rem; font-weight: 600;">Abilita invio al cliente</span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label>Oggetto Email Cliente</label>
                        <input type="text" id="edit-guest-subject" value="${type.email_subject_template_guest || ''}" placeholder="Es. Conferma Prenotazione">
                    </div>

                    <div class="form-group">
                        <label>Contenuto Cliente (HTML)</label>
                        <textarea id="edit-guest-body" style="min-height: 300px; font-family: monospace; font-size: 0.9rem; line-height: 1.6; padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border);" placeholder="<p>Gentile {{guest_name}}...</p>">${type.email_body_template_guest || ''}</textarea>
                    </div>
                     <div style="margin-top: 1rem;">
                        <span style="font-size: 0.8rem; color: var(--text-tertiary); display: block; margin-bottom: 0.5rem;">Variabili dinamiche:</span>
                        <div class="variables-list-guest" style="display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
                    </div>
                </div>

            </div>

            <!-- Footer -->
            <div style="padding: 1.5rem 2rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 1rem; background: var(--glass-bg);">
                <button class="secondary-btn close-modal-btn" style="padding: 0.8rem 1.5rem;">Annulla</button>
                <button class="primary-btn" id="save-settings-btn" style="padding: 0.8rem 2.5rem; font-size: 1rem;">Salva Modifiche</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // --- LOGIC ---

    // 1. TABS
    const tabs = modal.querySelectorAll('.modal-tab-btn');
    const sections = modal.querySelectorAll('.modal-tab-content');

    tabs.forEach(tab => {
        tab.onclick = () => {
            // Remove active classes
            tabs.forEach(t => {
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
                t.classList.remove('active');
            });
            sections.forEach(s => s.style.display = 'none');

            // Activate clicked
            tab.style.borderBottomColor = 'var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';
            tab.classList.add('active');

            const targetId = tab.dataset.target;
            document.getElementById(targetId).style.display = 'block';
        }
    });

    // 2. CLOSE
    modal.querySelectorAll('.close-modal-btn').forEach(b => b.onclick = () => modal.remove());

    // 3. VARIABLES
    const renderVars = (containerClass) => {
        const containers = modal.querySelectorAll(containerClass); // might be multiple? no just one usually per tab
        containers.forEach(container => {
            container.innerHTML = '';
            const vars = type.variables_schema || [];
            if (vars.length > 0) {
                vars.forEach(v => {
                    const chip = document.createElement('span');
                    chip.style.cssText = 'font-size: 0.75rem; background: var(--bg-secondary); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--glass-border); font-family: monospace; cursor: pointer; transition: all 0.2s; color: var(--brand-blue);';
                    chip.innerText = `{{${v}}}`;
                    chip.onmouseover = () => chip.style.background = '#e0f2fe';
                    chip.onmouseout = () => chip.style.background = 'var(--bg-secondary)';

                    chip.onclick = () => {
                        navigator.clipboard.writeText(`{{${v}}}`);
                        const orig = chip.innerText;
                        chip.innerText = 'Copiato!';
                        setTimeout(() => chip.innerText = orig, 800);
                    };
                    container.appendChild(chip);
                });
            } else {
                container.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-tertiary);">- Nessuna variabile -</span>';
            }
        });
    };
    renderVars('.variables-list');
    renderVars('.variables-list-guest');

    // 4. SAVE
    modal.querySelector('#save-settings-btn').onclick = () => saveNotificationTypeChanges(id);
}

async function saveNotificationTypeChanges(id) {
    const isActive = document.getElementById('edit-active').checked;
    const emailEnabled = document.getElementById('edit-email-enabled').checked;
    const webEnabled = document.getElementById('edit-web-enabled').checked;

    // Team Template
    const subject = document.getElementById('edit-template-subject').value;
    const body = document.getElementById('edit-template-body').value;

    // Guest Template
    const guestEnabled = document.getElementById('edit-guest-enabled').checked;
    const guestSubject = document.getElementById('edit-guest-subject').value;
    const guestBody = document.getElementById('edit-guest-body').value;

    const btn = document.getElementById('save-settings-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loader small"></span>';
    btn.disabled = true;

    try {
        const { error } = await supabase
            .from('notification_types')
            .update({
                is_active: isActive,
                default_email: emailEnabled,
                default_web: webEnabled,
                default_email_guest: guestEnabled,
                email_subject_template: subject,
                email_body_template: body,
                email_subject_template_guest: guestSubject,
                email_body_template_guest: guestBody
            })
            .eq('id', id);

        if (error) throw error;

        window.showAlert('Configurazione salvata con successo!', 'success');
        document.getElementById('edit-notification-modal').remove();

        // Refresh list
        const list = document.getElementById('notification-types-list');
        if (list) {
            const container = list.closest('.animate-fade-in').parentNode;
            loadNotificationTypes(container);
        }

    } catch (err) {
        console.error(err);
        window.showAlert('Errore salvataggio: ' + err.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function loadSMTPConfig() {
    try {
        const config = await fetchAllSystemConfig();
        const configMap = {};
        config.forEach(c => configMap[c.key] = c.value);

        document.getElementById('smtp-host').value = configMap['smtp_host'] || '';
        document.getElementById('smtp-port').value = configMap['smtp_port'] || '587';
        document.getElementById('smtp-security').value = configMap['smtp_security'] || 'tls';
        document.getElementById('smtp-user').value = configMap['smtp_user'] || '';
        document.getElementById('smtp-pass').value = configMap['smtp_pass'] || '';
        document.getElementById('smtp-from-name').value = configMap['smtp_from_name'] || 'Gleeye Workspace';
    } catch (err) {
        console.error('Error loading SMTP config:', err);
    }
}

async function saveSMTPConfig(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Salvataggio...';
    btn.disabled = true;

    try {
        await Promise.all([
            upsertSystemConfig('smtp_host', document.getElementById('smtp-host').value),
            upsertSystemConfig('smtp_port', document.getElementById('smtp-port').value),
            upsertSystemConfig('smtp_security', document.getElementById('smtp-security').value),
            upsertSystemConfig('smtp_user', document.getElementById('smtp-user').value),
            upsertSystemConfig('smtp_pass', document.getElementById('smtp-pass').value),
            upsertSystemConfig('smtp_from_name', document.getElementById('smtp-from-name').value)
        ]);

        window.showAlert('Configurazione SMTP salvata!', 'success');
    } catch (err) {
        console.error('Error saving SMTP config:', err);
        window.showAlert('Errore: ' + err.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function sendTestEmail() {
    const btn = document.getElementById('test-email-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loader small"></span>';
    btn.disabled = true;

    try {
        // Get current user's email as recipient
        const recipientEmail = state.session?.user?.email;
        if (!recipientEmail) {
            throw new Error('Nessun utente loggato');
        }

        const { data, error } = await supabase.functions.invoke('process-notification', {
            body: {
                test: true,
                recipient_email: recipientEmail
            }
        });

        if (error) throw error;

        if (data.success) {
            window.showAlert(`Email di test inviata a ${recipientEmail}!`, 'success');
        } else {
            console.error('SMTP Test Error:', data.error);
            window.showAlert(`Errore SMTP: ${data.error || 'Invio fallito'}`, 'error');
        }
    } catch (err) {
        console.error('Test email error:', err);
        window.showAlert('Errore invio test: ' + err.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
