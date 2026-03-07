import { fetchActivityRegistry, toggleActivityRegistryStatus, updateActivityRegistry } from '../../modules/pm_api.js';

export async function renderActivityRegistry(container) {
    if (!container) return;

    container.innerHTML = `
        <div style="background: white; border-radius: 12px; border: 1px solid var(--glass-border); overflow: hidden;">
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">Configurazione Log Attività</h3>
                    <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">Definisci cosa tracciare e come devono apparire i messaggi nello storico.</p>
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
                tableContainer.innerHTML = `<div style="text-align: center; padding: 3rem;">Nessuna regola trovata.</div>`;
                return;
            }

            let html = `
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: var(--bg-hover);">
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Tabella</th>
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Triggers</th>
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Template</th>
                                <th style="padding: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border); text-align: right;">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            rules.forEach((rule, index) => {
                const isLast = index === rules.length - 1;
                const borderBottom = isLast ? 'none' : '1px solid var(--glass-border)';

                const triggers = [];
                if (rule.track_insert) triggers.push('INS');
                if (rule.track_update) triggers.push('UPD');
                if (rule.track_delete) triggers.push('DEL');

                const template = rule.template_insert || rule.template_update || 'Granular/Custom';

                html += `
                    <tr style="${!rule.is_active ? 'opacity: 0.5;' : ''}">
                        <td style="padding: 1rem; border-bottom: ${borderBottom}; font-weight: 600;">${rule.table_name}</td>
                        <td style="padding: 1rem; border-bottom: ${borderBottom}; color: var(--text-secondary); font-size: 0.75rem;">
                            ${triggers.join(' / ')}
                        </td>
                        <td style="padding: 1rem; border-bottom: ${borderBottom}; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${template}
                        </td>
                        <td style="padding: 1rem; border-bottom: ${borderBottom}; text-align: right;">
                             <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                                <label class="toggle-switch" style="display: inline-block; position: relative; width: 36px; height: 18px;">
                                    <input type="checkbox" class="registry-toggle" data-id="${rule.id}" ${rule.is_active ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${rule.is_active ? 'var(--brand-blue)' : '#ccc'}; transition: .4s; border-radius: 18px;">
                                        <span style="position: absolute; height: 12px; width: 12px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: .4s; transform: ${rule.is_active ? 'translateX(18px)' : 'translateX(0)'};"></span>
                                    </span>
                                </label>
                                <button class="icon-btn edit-rule-btn" data-id="${rule.id}" title="Modifica Testi" style="background: var(--bg-secondary);">
                                    <span class="material-icons-round" style="font-size: 1.25rem;">edit</span>
                                </button>
                             </div>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table></div>`;
            tableContainer.innerHTML = html;

            // Handlers
            container.querySelectorAll('.registry-toggle').forEach(toggle => {
                toggle.addEventListener('change', async (e) => {
                    try {
                        await toggleActivityRegistryStatus(e.target.dataset.id, e.target.checked);
                        loadRegistry();
                    } catch (err) {
                        window.showGlobalAlert('Errore status', 'error');
                        e.target.checked = !e.target.checked;
                    }
                });
            });

            container.querySelectorAll('.edit-rule-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const rule = rules.find(r => r.id === btn.dataset.id);
                    if (rule) openEditModal(rule);
                });
            });

        } catch (err) {
            console.error(err);
            tableContainer.innerHTML = 'Errore.';
        }
    }

    function openEditModal(rule) {
        const modal = document.createElement('div');
        modal.className = 'custom-modal-overlay';
        modal.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);';
        
        // Granular templates section
        let granularHtml = '';
        if (rule.column_templates) {
            granularHtml = `<div style="margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-secondary);">Template per singola colonna (UPDATE):</h4>`;
            for (const [col, tmpl] of Object.entries(rule.column_templates || {})) {
                granularHtml += `
                    <div style="margin-bottom: 0.75rem;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: #666; display: block; margin-bottom: 4px;">Colonna: ${col}</label>
                        <input type="text" class="modal-input granular-tmpl" data-col="${col}" value="${tmpl}" style="width: 100%; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.6rem;">
                    </div>
                `;
            }
            granularHtml += `</div>`;
        }

        modal.innerHTML = `
            <div class="glass-card animate-scale-in" style="width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; font-size: 1.4rem;">Modifica Regole: ${rule.table_name}</h2>
                    <button class="icon-btn close-modal-btn"><span class="material-icons-round">close</span></button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                        <label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.5rem;">Template Creazione (INSERT)</label>
                        <input type="text" id="edit-tmpl-insert" value="${rule.template_insert || ''}" class="modal-input" style="width: 100%; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.6rem;">
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 0.5rem;">Template Base Aggiornamento (UPDATE)</label>
                        <input type="text" id="edit-tmpl-update" value="${rule.template_update || ''}" class="modal-input" style="width: 100%; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.6rem;">
                    </div>
                    
                    ${granularHtml}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
                    <button class="secondary-btn close-modal-btn" style="padding: 0.75rem 1.5rem;">Annulla</button>
                    <button id="save-rule-btn" class="primary-btn" style="padding: 0.75rem 1.5rem; background: var(--brand-blue); color: white;">Salva Modifiche</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelectorAll('.close-modal-btn').forEach(b => b.onclick = close);
        modal.onclick = (e) => { if (e.target === modal) close(); };

        modal.querySelector('#save-rule-btn').onclick = async () => {
            const updates = {
                template_insert: modal.querySelector('#edit-tmpl-insert').value,
                template_update: modal.querySelector('#edit-tmpl-update').value,
            };

            // Collect granular
            if (rule.column_templates) {
                const newColTmpl = { ...rule.column_templates };
                modal.querySelectorAll('.granular-tmpl').forEach(inp => {
                    newColTmpl[inp.dataset.col] = inp.value;
                });
                updates.column_templates = newColTmpl;
            }

            try {
                await updateActivityRegistry(rule.id, updates);
                window.showGlobalAlert('Modifiche salvate con successo!', 'success');
                close();
                loadRegistry();
            } catch (err) {
                window.showGlobalAlert('Errore salvataggio', 'error');
            }
        };
    }

    loadRegistry();
}
