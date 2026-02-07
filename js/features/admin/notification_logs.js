
import { supabase } from '../../modules/config.js?v=317';
import { state } from '../../modules/state.js?v=317';

export async function renderNotificationLogs(container) {
    container.innerHTML = `
        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Log Comunicazioni</h3>
                <div style="display: flex; gap: 0.5rem; background: var(--bg-tertiary); padding: 4px; border-radius: 8px;">
                     <button id="tab-emails" class="tab-btn active" style="padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 500; background: var(--card-bg); color: var(--text-primary); box-shadow: var(--shadow-sm);">Email</button>
                     <button id="tab-app" class="tab-btn" style="padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 500; background: transparent; color: var(--text-secondary);">Notifiche App</button>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                <button id="refresh-logs" class="secondary-btn small" style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round">refresh</span> Aggiorna
                </button>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead id="logs-head">
                        <!-- Injected by JS -->
                    </thead>
                    <tbody id="logs-body">
                        <tr><td colspan="6" style="padding: 2rem; text-align: center;">Caricamento...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
               <span style="font-size: 0.8rem; color: var(--text-tertiary);">Mostrati ultimi 50 record</span>
            </div>
        </div>
    `;

    let currentMode = 'emails'; // 'emails' or 'app'

    const updateTabs = (mode) => {
        currentMode = mode;
        const btnEmail = container.querySelector('#tab-emails');
        const btnApp = container.querySelector('#tab-app');

        if (mode === 'emails') {
            btnEmail.style.background = 'var(--card-bg)';
            btnEmail.style.color = 'var(--text-primary)';
            btnEmail.style.boxShadow = 'var(--shadow-sm)';

            btnApp.style.background = 'transparent';
            btnApp.style.color = 'var(--text-secondary)';
            btnApp.style.boxShadow = 'none';
        } else {
            btnApp.style.background = 'var(--card-bg)';
            btnApp.style.color = 'var(--text-primary)';
            btnApp.style.boxShadow = 'var(--shadow-sm)';

            btnEmail.style.background = 'transparent';
            btnEmail.style.color = 'var(--text-secondary)';
            btnEmail.style.boxShadow = 'none';
        }
    };

    const loadLogs = async () => {
        const thead = container.querySelector('#logs-head');
        const tbody = container.querySelector('#logs-body');

        tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center;"><span class="loader small"></span></td></tr>';

        // Render Headers based on mode
        if (currentMode === 'emails') {
            thead.innerHTML = `
                <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Data</th>
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Oggetto Email</th>
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Destinatari (Collaboratore & Cliente)</th>
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Stato Invio</th>
                </tr>
            `;
        } else {
            thead.innerHTML = `
                <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Data</th>
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Destinatario (App)</th>
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Titolo Notifica</th>
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Messaggio</th>
                    <th style="padding: 0.75rem; color: var(--text-secondary); font-weight: 500;">Stato Lettura</th>
                </tr>
            `;
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    id, created_at, type, title, message, email_status, email_error, metadata, is_read,
                    collaborators(name, first_name, last_name, email)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nessun record trovato.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(log => {
                // Common Data
                const dateStr = new Date(log.created_at).toLocaleString('it-IT');

                // Name Logic
                let collabName = log.collaborators?.name || '-';
                if (log.collaborators?.first_name || log.collaborators?.last_name) {
                    collabName = `${log.collaborators.first_name || ''} ${log.collaborators.last_name || ''}`.trim();
                }

                if (currentMode === 'emails') {
                    // --- EMAIL VIEW ---
                    const rows = [];
                    const emailStatus = log.email_status || 'queued';
                    const statusColor = emailStatus === 'sent' ? 'var(--success)' : emailStatus === 'failed' ? 'var(--error)' : 'var(--warning)';
                    const statusBg = emailStatus === 'sent' ? 'rgba(34, 197, 94, 0.1)' : emailStatus === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';

                    const sentToCollab = log.metadata?.sent_to || log.collaborators?.email;
                    const sentToGuest = log.metadata?.sent_to_guest;

                    // 1. Collaborator Row (Always exists if status is not queued, or if queued we show intended)
                    if (sentToCollab || emailStatus === 'queued') {
                        rows.push({
                            date: dateStr,
                            subject: escapeHtml(log.title),
                            recipient: sentToCollab || '-',
                            recipientLabel: 'Collaboratore',
                            recipientIcon: 'person',
                            recipientColor: 'var(--text-primary)',
                            status: emailStatus,
                            statusBg,
                            statusColor,
                            error: log.email_error
                        });
                    }

                    // 2. Guest Row (Only if guest email exists in metadata)
                    if (sentToGuest) {
                        rows.push({
                            date: dateStr,
                            subject: `Prenotazione: ${log.metadata?.guest_name || 'Cliente'} (Conferma)`, // Differentiate subject slightly
                            recipient: sentToGuest,
                            recipientLabel: 'Cliente',
                            recipientIcon: 'alternate_email',
                            recipientColor: 'var(--brand-blue)',
                            status: emailStatus, // Assumes same status for now as we don't track them separately in DB yet
                            statusBg,
                            statusColor,
                            error: null // We don't know specific guest error yet
                        });
                    }

                    return rows.map(r => `
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-primary);">
                            <td style="padding: 0.75rem; white-space: nowrap; font-size: 0.8rem;">${r.date}</td>
                            <td style="padding: 0.75rem; font-weight: 500;">
                                <div style="display:flex; flex-direction:column;">
                                    <span>${r.subject}</span>
                                    <span style="font-size:0.7rem; color:var(--text-tertiary); margin-top:2px;">Versione ${r.recipientLabel}</span>
                                </div>
                            </td>
                            <td style="padding: 0.75rem; font-size: 0.8rem; color: var(--text-secondary);">
                                <div style="display:flex; align-items:center; gap:6px; color: ${r.recipientColor};">
                                    <span class="material-icons-round" style="font-size:16px;">${r.recipientIcon}</span> 
                                    <span>${r.recipient}</span>
                                </div>
                            </td>
                            <td style="padding: 0.75rem;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; background: ${r.statusBg}; color: ${r.statusColor}; font-weight: 600; text-transform: uppercase;">
                                        ${r.status}
                                    </span>
                                    ${r.error ? `<span class="material-icons-round" style="font-size: 16px; color: var(--error); cursor: help;" title="${escapeHtml(r.error)}">error_outline</span>` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    // --- APP NOTIFICATION VIEW ---
                    const isRead = log.is_read;
                    const readStatusHtml = isRead
                        ? `<span style="color: var(--text-tertiary); display:flex; align-items:center; gap:4px; font-size:0.8rem;"><span class="material-icons-round" style="font-size:16px;">done_all</span> Letta</span>`
                        : `<span style="color: var(--brand-blue); display:flex; align-items:center; gap:4px; font-size:0.8rem; font-weight:500;"><span class="material-icons-round" style="font-size:16px;">mark_email_unread</span> Da leggere</span>`;

                    return `
                         <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-primary);">
                            <td style="padding: 0.75rem; white-space: nowrap; font-size: 0.8rem;">${dateStr}</td>
                            <td style="padding: 0.75rem;">
                                <div style="font-weight: 500;">${collabName}</div>
                                <div style="font-size: 0.75rem; color: var(--text-tertiary);">${log.collaborators?.email || ''}</div>
                            </td>
                            <td style="padding: 0.75rem;">${escapeHtml(log.title)}</td>
                            <td style="padding: 0.75rem;">
                                <div style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); font-size: 0.8rem;" title="${escapeHtml(log.message)}">
                                    ${escapeHtml(log.message)}
                                </div>
                            </td>
                            <td style="padding: 0.75rem;">${readStatusHtml}</td>
                        </tr>
                    `;
                }
            }).join('');

        } catch (err) {
            console.error('Error fetching logs:', err);
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--error);">Errore: ${err.message}</td></tr>`;
        }
    };

    container.querySelector('#refresh-logs').addEventListener('click', loadLogs);

    container.querySelector('#tab-emails').addEventListener('click', () => {
        updateTabs('emails');
        loadLogs();
    });

    container.querySelector('#tab-app').addEventListener('click', () => {
        updateTabs('app');
        loadLogs();
    });

    // Initial load
    updateTabs('emails'); // Default
    loadLogs();
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/<</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

