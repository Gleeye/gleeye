/**
 * Admin Notification Settings Page
 * Manages global notification types and configuration
 */

import { supabase } from '../modules/config.js?v=123';
import { state } from '../modules/state.js?v=123';
import { fetchAllSystemConfig, upsertSystemConfig } from '../modules/api.js?v=123';

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

        let html = '';
        for (const category in grouped) {
            html += `
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
                        ${categoryLabels[category] || category}
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            `;

            grouped[category].forEach(type => {
                html += `
                    <div class="notification-type-row" data-id="${type.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--glass-border);">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                ${type.label_it}
                                <span style="font-size: 0.7rem; padding: 2px 6px; background: var(--glass-border); border-radius: 4px; color: var(--text-tertiary);">${type.key}</span>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary);">${type.description || ''}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <!-- Edit Button -->
                            <button class="icon-btn edit-type-btn" data-id="${type.id}" title="Modifica Template">
                                <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">edit</span>
                            </button>

                            <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
                                <span title="Default Email">📧 ${type.default_email ? 'Sì' : 'No'}</span>
                                <span title="Default Web">🔔 ${type.default_web ? 'Sì' : 'No'}</span>
                            </div>
                            <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;" title="Attivo">
                                <input type="checkbox" class="type-active-toggle" data-id="${type.id}" ${type.is_active ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--success-color);">
                            </label>
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

        // --- BINDINGS ---

        // 1. Toggle Active
        list.querySelectorAll('.type-active-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const isActive = e.target.checked;
                try {
                    const { error } = await supabase.from('notification_types').update({ is_active: isActive }).eq('id', id);
                    if (error) throw error;
                    window.showAlert(`Tipo di notifica ${isActive ? 'attivato' : 'disattivato'}`, 'success');
                } catch (err) {
                    console.error(err);
                    window.showAlert('Errore: ' + err.message, 'error');
                    e.target.checked = !isActive;
                }
            });
        });

        // 2. Edit Button
        list.querySelectorAll('.edit-type-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id, data));
        });

    } catch (err) {
        console.error('Error loading notification types:', err);
        list.innerHTML = `<p style="text-align:center; color:var(--error-color);">Errore: ${err.message}</p>`;
    }
}

// --- EDIT MODAL LOGIC ---

let currentEditId = null;

function openEditModal(id, allTypes) {
    const type = allTypes.find(t => t.id === id);
    if (!type) return;

    currentEditId = id;

    // Create modal if not exists
    let modal = document.getElementById('edit-notification-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-notification-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content animate-scale-in" style="max-width: 700px; width: 90%;">
                <div class="modal-header">
                    <h3 style="margin: 0;">Modifica Template Notifica</h3>
                    <button class="close-modal-btn" style="background:none; border:none; cursor:pointer;">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div class="form-group">
                        <label>Oggetto Email (Template)</label>
                        <input type="text" id="edit-template-subject" placeholder="Es. Nuova prenotazione: {{guest_name}}">
                        <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">Usa le variabili mostrate sotto.</p>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label>Corpo Email (HTML)</label>
                        <textarea id="edit-template-body" style="width: 100%; min-height: 200px; font-family: monospace; font-size: 0.9rem;" placeholder="<p>Ciao {{guest_name}}...</p>"></textarea>
                    </div>
                    
                    <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                        <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Variabili Disponibili</label>
                        <div id="edit-variables-list" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                            <!-- populated dynamically -->
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 1rem;">
                    <button class="secondary-btn close-modal-btn">Annulla</button>
                    <button class="primary-btn" id="save-template-btn">Salva Modifiche</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Bind events
        modal.querySelectorAll('.close-modal-btn').forEach(b => b.onclick = () => modal.remove());
        modal.querySelector('#save-template-btn').onclick = saveTemplateChanges;
    }

    // Populate Data
    document.getElementById('edit-template-subject').value = type.email_subject_template || '';
    document.getElementById('edit-template-body').value = type.email_body_template || '';

    // Populate Variables
    const varList = document.getElementById('edit-variables-list');
    varList.innerHTML = '';
    const vars = type.variables_schema || [];
    if (vars.length === 0) {
        varList.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-tertiary);">{nessuna variabile definita}</span>';
    } else {
        vars.forEach(v => {
            const chip = document.createElement('span');
            chip.style.cssText = 'font-size: 0.8rem; background: var(--glass-border); padding: 2px 8px; border-radius: 4px; font-family: monospace; cursor: pointer; user-select: all;';
            chip.textContent = `{{${v}}}`;
            chip.onclick = () => {
                // Simple copy to clipboard or insert
                navigator.clipboard.writeText(`{{${v}}}`);
                window.showAlert('Variabile copiata!', 'success');
            };
            varList.appendChild(chip);
        });
    }

    // Show
    modal.style.display = 'flex';
}

async function saveTemplateChanges() {
    const subject = document.getElementById('edit-template-subject').value;
    const body = document.getElementById('edit-template-body').value;
    const btn = document.getElementById('save-template-btn');

    if (!currentEditId) return;

    const originalText = btn.innerText;
    btn.innerText = 'Salvataggio...';
    btn.disabled = true;

    try {
        const { error } = await supabase
            .from('notification_types')
            .update({
                email_subject_template: subject,
                email_body_template: body
            })
            .eq('id', currentEditId);

        if (error) throw error;

        window.showAlert('Template aggiornato con successo!', 'success');
        document.getElementById('edit-notification-modal').remove();

        // Refresh list? Or just reload page context potentially? 
        // For now, reload the section seems easiest or re-fetch
        // But since we are creating the modal dynamically, destroying it is fine.

        // Trigger a reload of the list to reflect updates if needed (though local list is stale now)
        // A full page refresh or function re-call is safer to keep sync.
        const container = document.querySelector('#admin-tab-types').closest('.animate-fade-in').parentNode;
        // Hacky way to find container, better to dispatch event or just let user refresh manually or re-call loadNotificationTypes if exposed.
        // For simplicity, we just close. The user can refresh if they want to see "latest" but UI doesn't show template text in list anyway.

    } catch (err) {
        console.error(err);
        window.showAlert('Errore salvataggio: ' + err.message, 'error');
    } finally {
        btn.innerText = originalText;
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
