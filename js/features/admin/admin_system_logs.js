
import { supabase } from '../../modules/config.js?v=155';
import { state } from '../../modules/state.js?v=155';

export async function renderSystemLogs(container) {
    container.innerHTML = `
        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="color: var(--error);">bug_report</span>
                    Log di Sistema (Errori)
                </h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button id="mark-all-resolved" class="secondary-btn small" style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round">done_all</span> Segna Risolti
                    </button>
                    <button id="refresh-system-logs" class="secondary-btn small" style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round">refresh</span> Aggiorna
                    </button>
                </div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Data</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Funzione</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Messaggio</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Dettagli</th>
                            <th style="padding: 1rem; color: var(--text-secondary); font-weight: 500;">Stato</th>
                        </tr>
                    </thead>
                    <tbody id="system-logs-body">
                        <tr><td colspan="5" style="padding: 2rem; text-align: center;">Caricamento...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
               <span style="font-size: 0.8rem; color: var(--text-tertiary);">Mostrati ultimi 50 errori</span>
            </div>
        </div>
    `;

    const loadLogs = async () => {
        const tbody = container.querySelector('#system-logs-body');
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center;"><span class="loader small"></span></td></tr>';

        try {
            // Query debug_logs for errors
            const { data, error } = await supabase
                .from('debug_logs')
                .select('*')
                .eq('level', 'error')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--success);"><span class="material-icons-round" style="vertical-align: middle; margin-right: 0.5rem;">check_circle</span>Nessun errore recente. Tutto OK!</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(log => `
                <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-primary); ${log.is_resolved ? 'opacity: 0.5;' : ''}">
                    <td style="padding: 1rem; white-space: nowrap;">
                        ${new Date(log.created_at).toLocaleString('it-IT')}
                    </td>
                    <td style="padding: 1rem; font-family: monospace; font-size: 0.8rem; color: var(--brand-viola);">
                        ${escapeHtml(log.function_name)}
                    </td>
                    <td style="padding: 1rem;">
                        ${escapeHtml(log.message)}
                    </td>
                    <td style="padding: 1rem;">
                        <button class="detail-btn" data-details='${escapeHtml(JSON.stringify(log.details))}' style="
                            background: var(--bg-tertiary); border: 1px solid var(--border-color); 
                            padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;
                        ">
                            Vedi JSON
                        </button>
                    </td>
                    <td style="padding: 1rem;">
                        <span style="
                            padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; 
                            background: ${log.is_resolved ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; 
                            color: ${log.is_resolved ? 'var(--success)' : 'var(--error)'};
                        ">
                            ${log.is_resolved ? 'Risolto' : 'Attivo'}
                        </span>
                    </td>
                </tr>
            `).join('');

            // Detail button click handler
            container.querySelectorAll('.detail-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const details = btn.dataset.details;
                    try {
                        const parsed = JSON.parse(details);
                        alert(JSON.stringify(parsed, null, 2));
                    } catch {
                        alert(details);
                    }
                });
            });

        } catch (err) {
            console.error('Error fetching system logs:', err);
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--error);">Errore: ${err.message}</td></tr>`;
        }
    };

    // Mark all as resolved
    container.querySelector('#mark-all-resolved').addEventListener('click', async () => {
        try {
            const { error } = await supabase
                .from('debug_logs')
                .update({ is_resolved: true })
                .eq('level', 'error')
                .eq('is_resolved', false);

            if (error) throw error;

            if (window.showGlobalAlert) window.showGlobalAlert('Tutti gli errori segnati come risolti.', 'success');
            loadLogs();
        } catch (err) {
            console.error('Error marking resolved:', err);
            if (window.showGlobalAlert) window.showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    container.querySelector('#refresh-system-logs').addEventListener('click', loadLogs);

    // Initial load
    loadLogs();
}

// Count unresolved errors (for badge)
export async function getUnresolvedErrorCount() {
    try {
        const { count, error } = await supabase
            .from('debug_logs')
            .select('*', { count: 'exact', head: true })
            .eq('level', 'error')
            .eq('is_resolved', false);

        if (error) throw error;
        return count || 0;
    } catch {
        return 0;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
