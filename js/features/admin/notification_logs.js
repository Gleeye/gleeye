
import { supabase } from '../../modules/config.js?v=148';
import { state } from '../../modules/state.js?v=148';

export async function renderNotificationLogs(container) {
    container.innerHTML = `
        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Log Notifiche (Admin View)</h3>
                <button id="refresh-logs" class="secondary-btn small" style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round">refresh</span> Aggiorna
                </button>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Data</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Collaboratore</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Utente (Sessione)</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Titolo</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Messaggio</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Stato</th>
                        </tr>
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

    const loadLogs = async () => {
        const tbody = container.querySelector('#logs-body');
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center;"><span class="loader small"></span></td></tr>';

        try {
            const { data, error } = await supabase.rpc('get_admin_notification_logs', {
                p_limit: 50,
                p_offset: 0
            });

            if (error) throw error;

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nessuna notifica trovata.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(log => `
                <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-primary);">
                    <td style="padding: 1rem; white-space: nowrap;">
                        ${new Date(log.created_at).toLocaleString('it-IT')}
                    </td>
                    <td style="padding: 1rem; font-weight: 500;">
                        ${log.collaborator_name || '-'}
                    </td>
                    <td style="padding: 1rem; color: var(--text-secondary);">
                        ${log.user_email || '-'}
                    </td>
                    <td style="padding: 1rem;">${escapeHtml(log.title)}</td>
                    <td style="padding: 1rem;">
                        <div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(log.message)}">
                            ${escapeHtml(log.message)}
                        </div>
                    </td>
                    <td style="padding: 1rem;">
                        <span style="
                            padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; 
                            background: ${log.is_read ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; 
                            color: ${log.is_read ? 'var(--success)' : 'var(--error)'};
                        ">
                            ${log.is_read ? 'Letta' : 'Non letta'}
                        </span>
                    </td>
                </tr>
            `).join('');

        } catch (err) {
            console.error('Error fetching logs:', err);
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--error);">Errore: ${err.message}</td></tr>`;
        }
    };

    container.querySelector('#refresh-logs').addEventListener('click', loadLogs);

    // Initial load
    loadLogs();
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
