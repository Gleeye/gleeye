import { fetchActivityRegistry, toggleActivityRegistryStatus } from '../../modules/pm_api.js';

export async function renderActivityRegistry(container) {
    if (!container) return;

    container.innerHTML = `
        <div style="background: white; border-radius: 12px; border: 1px solid var(--glass-border); overflow: hidden;">
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">Unified Activity Registry</h3>
                    <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">Configura quali eventi generano uno storico nelle attività.</p>
                </div>
                <button class="icon-btn" id="refresh-registry-btn" title="Aggiorna" style="background: var(--bg-secondary); border-radius: 8px;">
                    <span class="material-icons-round">refresh</span>
                </button>
            </div>
            
            <div id="registry-table-container" style="padding: 1rem;">
                <div style="text-align: center; padding: 2rem;"><span class="loader small"></span></div>
            </div>
        </div>
    `;

    const tableContainer = container.querySelector('#registry-table-container');
    const refreshBtn = container.querySelector('#refresh-registry-btn');

    refreshBtn.addEventListener('click', () => loadRegistry());

    async function loadRegistry() {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 2rem;"><span class="loader small"></span></div>';
        try {
            const rules = await fetchActivityRegistry();

            if (rules.length === 0) {
                tableContainer.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <span class="material-icons-round" style="font-size: 3rem; opacity: 0.5; margin-bottom: 1rem;">settings_backup_restore</span>
                        <p>Nessuna regola configurata nel registro.</p>
                    </div>
                `;
                return;
            }

            let html = `
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: var(--bg-hover);">
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border); border-top-left-radius: 8px;">Tabella Monitorata</th>
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Triggers</th>
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Template Aggiornamento</th>
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border); border-top-right-radius: 8px; text-align: right;">Stato</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            rules.forEach((rule, index) => {
                const isLast = index === rules.length - 1;
                const borderBottom = isLast ? 'none' : '1px solid var(--glass-border)';

                // Triggers styling
                const triggers = [];
                if (rule.track_insert) triggers.push('<span style="background: rgba(33, 150, 243, 0.1); color: #2196f3; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">INSERT</span>');
                if (rule.track_update) triggers.push('<span style="background: rgba(76, 175, 80, 0.1); color: #4caf50; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">UPDATE</span>');
                if (rule.track_delete) triggers.push('<span style="background: rgba(244, 67, 54, 0.1); color: #f44336; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">DELETE</span>');

                // Template preview
                const template = rule.template_update || rule.template_insert || '<em>Template non definito</em>';

                html += `
                    <tr style="transition: background-color 0.2s; ${!rule.is_active ? 'opacity: 0.6;' : ''}">
                        <td style="padding: 1rem; border-bottom: ${borderBottom}; font-family: monospace; font-weight: 600; color: var(--brand-viola);">${rule.table_name}</td>
                        <td style="padding: 1rem; border-bottom: ${borderBottom};">
                            <div style="display: flex; gap: 0.25rem;">${triggers.join('')}</div>
                        </td>
                        <td style="padding: 1rem; border-bottom: ${borderBottom}; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${template}">
                            ${template}
                        </td>
                        <td style="padding: 1rem; border-bottom: ${borderBottom}; text-align: right;">
                            <label class="toggle-switch" style="display: inline-block; position: relative; width: 44px; height: 24px;">
                                <input type="checkbox" class="registry-toggle" data-id="${rule.id}" ${rule.is_active ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${rule.is_active ? 'var(--success-color, #4caf50)' : 'var(--glass-border)'}; transition: .4s; border-radius: 34px;">
                                    <span style="position: absolute; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: ${rule.is_active ? 'translateX(20px)' : 'translateX(0)'}; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
                                </span>
                            </label>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            tableContainer.innerHTML = html;

            // Attach toggle handlers
            container.querySelectorAll('.registry-toggle').forEach(toggle => {
                toggle.addEventListener('change', async (e) => {
                    const id = e.target.dataset.id;
                    const isActive = e.target.checked;

                    // Visual update of slider immediately
                    const slider = e.target.nextElementSibling;
                    const knob = slider.querySelector('span');

                    if (isActive) {
                        slider.style.backgroundColor = 'var(--success-color, #4caf50)';
                        knob.style.transform = 'translateX(20px)';
                        e.target.closest('tr').style.opacity = '1';
                    } else {
                        slider.style.backgroundColor = 'var(--glass-border)';
                        knob.style.transform = 'translateX(0)';
                        e.target.closest('tr').style.opacity = '0.6';
                    }

                    try {
                        await toggleActivityRegistryStatus(id, isActive);
                        if (window.showGlobalAlert) window.showGlobalAlert('Status registro aggiornato.', 'success');
                    } catch (err) {
                        console.error(err);
                        if (window.showGlobalAlert) window.showGlobalAlert('Errore aggiornamento stato', 'error');
                        // Revert visual change on error
                        e.target.checked = !isActive;
                        loadRegistry(); // Reload full state to be safe
                    }
                });
            });

        } catch (err) {
            tableContainer.innerHTML = `<div style="text-align: center; color: var(--error-color); padding: 2rem;">Errore caricamento del registro.</div>`;
            console.error(err);
        }
    }

    loadRegistry();
}
