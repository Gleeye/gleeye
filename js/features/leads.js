import { state } from '../modules/state.js';
import { fetchLeads, fetchLeadDetail, upsertLead, deleteLead } from '../modules/api.js';
import { fetchSapServices } from '../modules/api.js';
import { renderModal, closeModal, showGlobalAlert, showConfirm, formatAmount } from '../modules/utils.js';

function getLeadStatusColor(status) {
    const s = status?.toLowerCase() || '';
    if (s.includes('prenotata')) return '#3b82f6';
    if (s.includes('inviato')) return '#f59e0b';
    if (s.includes('vinto')) return '#10b981';
    if (s.includes('perso')) return '#ef4444';
    return '#6366f1';
}

function getMacroStatusColor(macro_status) {
    const s = macro_status?.toLowerCase() || '';
    if (s === 'vinto') return '#10b981';
    if (s === 'perso') return '#ef4444';
    return '#f59e0b'; // in lavorazione
}

export async function renderLeads(container) {
    if (!state.leads || state.leads.length === 0) await fetchLeads();
    if (!state.sapServices || state.sapServices.length === 0) await fetchSapServices();

    const titleDiv = document.getElementById('page-title');
    if (titleDiv) titleDiv.textContent = 'Gestione Leads';

    const leads = state.leads || [];

    const rows = leads.map(lead => {
        const date = lead.created_at ? new Date(lead.created_at).toLocaleDateString('it-IT') : '-';
        const sapServiceName = lead.core_services?.name || 'N/D';
        const color = getLeadStatusColor(lead.status);
        const macroColor = getMacroStatusColor(lead.macro_status);

        return `
            <tr class="clickable-row" onclick="window.location.hash='#lead-detail/${lead.id}'" style="border-bottom: 1px solid var(--glass-border); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 1rem 1.5rem; font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${lead.lead_code}</td>
                <td style="padding: 1rem 1.5rem; font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">${lead.company_name}</td>
                <td style="padding: 1rem 1.5rem; font-size: 0.85rem; color: var(--text-secondary);">${sapServiceName}</td>
                <td style="padding: 1rem 1.5rem; font-size: 0.85rem; color: var(--text-tertiary);">${date}</td>
                <td style="padding: 1rem 1.5rem;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: ${color}15; color: ${color}; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></span>
                        ${lead.status}
                    </div>
                </td>
                <td style="padding: 1rem 1.5rem;">
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: ${macroColor}15; color: ${macroColor}; padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                        ${lead.macro_status}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding: 1.5rem;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h1 style="font-size: 1.75rem; font-weight: 800; font-family: var(--font-titles); color: var(--text-primary); margin: 0; letter-spacing: -0.02em;">Leads</h1>
                    <div style="font-size: 0.85rem; color: var(--text-tertiary); margin-top: 0.25rem;">Gestisci i contatti dal funnel SAP</div>
                </div>
                <button onclick="window.openLeadModal()" class="primary-btn" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; padding: 0.6rem 1.2rem; border-radius: 12px; font-weight: 700;">
                    <span class="material-icons-round" style="font-size: 1.1rem;">add</span>
                    Nuovo Lead
                </button>
            </div>

            <div class="glass-card" style="padding: 0; overflow: hidden; border-radius: 16px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm);">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: var(--bg-tertiary); border-bottom: 1px solid var(--glass-border);">
                            <tr>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.72rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Codice</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.72rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Azienda</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.72rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Servizio SAP</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.72rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Data</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.72rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Stato Dettaglio</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.72rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Macro Stato</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">Nessun lead presente.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    initLeadModal();
}

export async function renderLeadDetail(container) {
    const hash = window.location.hash;
    const parts = hash.split('/');
    const leadId = parts[parts.length - 1];

    if (!leadId) return;

    if (!state.sapServices || state.sapServices.length === 0) await fetchSapServices();

    const lead = await fetchLeadDetail(leadId);
    if (!lead) {
        container.innerHTML = '<div class="p-4">Lead non trovato.</div>';
        return;
    }

    initLeadModal();

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.style.opacity = '1';
        pageTitle.style.display = 'flex';
        pageTitle.style.alignItems = 'center';
        pageTitle.style.gap = '1.25rem';
        pageTitle.innerHTML = `
            <div onclick="window.history.back()" 
                 style="width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 10;"
                 onmouseover="this.style.transform='scale(1.12)'" 
                 onmouseout="this.style.transform='scale(1)'">
                <svg width="42" height="42" style="position: absolute; top: 0; left: 0; transform: rotate(-90deg);">
                    <defs>
                        <linearGradient id="back-btn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color: #4e92d8" />
                            <stop offset="100%" style="stop-color: #614aa2" />
                        </linearGradient>
                    </defs>
                    <circle cx="21" cy="21" r="19.5" fill="none" stroke="url(#back-btn-grad)" stroke-width="2.5" stroke-linecap="round" />
                </svg>
                <span class="material-icons-round" style="font-size: 1.4rem; background: linear-gradient(135deg, #4e92d8, #614aa2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; position: relative; z-index: 2;">arrow_back</span>
            </div>
            <span style="color: var(--text-primary); font-weight: 700; font-size: 1.55rem; letter-spacing: -0.015em;">Dettaglio Lead</span>
        `;
    }

    const color = getLeadStatusColor(lead.status);
    const macroColor = getMacroStatusColor(lead.macro_status);
    const enterDate = new Date(lead.created_at);
    const formattedDate = enterDate.toLocaleDateString('it-IT') + ' ' + enterDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1100px; margin: 0 auto; padding: 1.5rem;">
            
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; background: var(--bg-secondary); padding: 2rem; border-radius: 20px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm);">
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, var(--brand-blue), var(--brand-viola)); display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px rgba(97, 74, 162, 0.2); color: white;">
                        <span class="material-icons-round" style="font-size: 2rem;">contact_mail</span>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.25rem;">
                            <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: 800; color: var(--text-tertiary); letter-spacing: 0.05em; background: white; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--glass-border);">${lead.lead_code}</div>
                        </div>
                        <h1 style="font-size: 2rem; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em; line-height: 1.2;">${lead.company_name}</h1>
                        <div style="display: flex; align-items: center; gap: 1rem; color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem; font-weight: 500;">
                            <span style="display: flex; align-items: center; gap: 0.4rem; background: rgba(0,0,0,0.03); padding: 4px 10px; border-radius: 8px;"><span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">event</span> Entrato il ${formattedDate}</span>
                            <span style="display: flex; align-items: center; gap: 0.4rem; background: rgba(0,0,0,0.03); padding: 4px 10px; border-radius: 8px;"><span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-viola);">category</span> ${lead.core_services?.name || 'N/D'}</span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                     <!-- Macro Status Editor -->
                     <button onclick="window.editLeadStatus('${lead.id}')" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 0; margin-bottom: 4px;" title="Modifica Stato">
                         <div style="display: inline-flex; align-items: center; gap: 6px; background: ${macroColor}15; color: ${macroColor}; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid ${macroColor}30; transition: all 0.2s;">
                             ${lead.macro_status}
                         </div>
                         <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary);">edit</span>
                     </button>
                    <!-- Detail Status -->
                     <div style="font-size: 0.85rem; font-weight: 600; color: ${color}; background: ${color}10; padding: 4px 12px; border-radius: 8px;">${lead.status}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div class="glass-card" style="padding: 2rem; background: white; border: 1px solid var(--glass-border); border-radius: 20px; border-top: 4px solid var(--brand-blue);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="font-size: 1.25rem; font-weight: 800; margin: 0; font-family: var(--font-titles); display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="color: var(--brand-blue);">notes</span> Note / Dettagli</h3>
                            <button onclick="window.editLead('${lead.id}')" class="icon-btn" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); width: 36px; height: 36px; border-radius: 10px; color: var(--text-secondary);" title="Modifica Info Lead">
                                <span class="material-icons-round" style="font-size: 1.2rem;">edit</span>
                            </button>
                        </div>
                        <div style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; background: rgba(0,0,0,0.02); padding: 1.5rem; border-radius: 12px; min-height: 150px; white-space: pre-wrap;">${lead.notes || '<span style="opacity:0.5; font-style:italic;">Nessuna nota presente.</span>'}</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    
                    <div class="glass-card" style="padding: 1.5rem; background: linear-gradient(135deg, white, #f8fafc); border: 1px solid var(--glass-border); border-radius: 20px; text-align: center;">
                        <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(16, 185, 129, 0.1); margin: 0 auto 1rem auto; display: flex; align-items: center; justify-content: center; color: #10b981;">
                            <span class="material-icons-round" style="font-size: 1.5rem;">account_balance_wallet</span>
                        </div>
                        <h3 style="font-size: 1.1rem; font-weight: 800; margin: 0 0 0.5rem 0; font-family: var(--font-titles);">Trasforma in Ordine</h3>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-bottom: 1.5rem; line-height: 1.4;">Se il lead è stato vinto, crea un nuovo ordine per iniziare i lavori.</div>
                        <button onclick="window.createOrderFromLead('${lead.id}')" class="primary-btn" style="width: 100%; justify-content: center; gap: 0.5rem; font-size: 0.9rem; padding: 0.8rem; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 700;">
                            <span class="material-icons-round">rocket_launch</span>
                            Crea Nuovo Ordine
                        </button>
                    </div>

                    <!-- Delete Button Box -->
                    <div style="text-align: right;">
                        <button onclick="window.confirmDeleteLead('${lead.id}')" style="background: none; border: none; color: #ef4444; font-size: 0.8rem; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
                            <span class="material-icons-round" style="font-size: 1rem;">delete</span>
                            Elimina Lead
                        </button>
                    </div>

                </div>
            </div>

        </div>
    `;
}

function initLeadModal() {
    window.openLeadModal = () => {
        const formHtml = `
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                <input type="hidden" id="lead-id" value="">
                
                <div class="form-group">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Azienda*</label>
                    <input type="text" id="lead-company" class="app-input" placeholder="Nome Azienda" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);" required>
                </div>
                
                <div class="form-group">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Servizio SAP d'Interesse</label>
                    <select id="lead-service" class="app-input" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                        <option value="">Nessuno specifico</option>
                        ${state.sapServices.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Stato Dettaglio</label>
                    <input type="text" id="lead-status" class="app-input" placeholder="es. Call prenotata, Contratto inviato..." value="Call di onboarding prenotata" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                </div>
                
                <div class="form-group">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Macro Stato</label>
                    <select id="lead-macro-status" class="app-input" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                        <option value="in lavorazione">In Lavorazione</option>
                        <option value="vinto">Vinto</option>
                        <option value="perso">Perso</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Note</label>
                    <textarea id="lead-notes" class="app-input" placeholder="Aggiungi ulteriori dettagli..." rows="4" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border); resize: vertical;"></textarea>
                </div>

                <button onclick="window.saveLead()" class="primary-btn" style="width: 100%; padding: 0.85rem; border-radius: 10px; font-weight: 700; justify-content: center; margin-top: 0.5rem; background: var(--brand-blue); color: white; border: none; cursor: pointer;">
                    Salva Data
                </button>
            </div>
        `;
        renderModal('edit-lead-modal', `
            <div style="padding: 1.5rem; min-width: 450px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 800; font-size: 1.25rem;">Nuovo Lead</h2>
                    <button class="icon-btn close-modal" onclick="window.closeModal('edit-lead-modal')">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                ${formHtml}
            </div>
        `);
    };

    window.editLead = (id) => {
        const lead = state.leads?.find(l => l.id === id);
        if (!lead) return;
        window.openLeadModal();
        setTimeout(() => {
            const modal = document.getElementById('edit-lead-modal');
            if (!modal) return;
            modal.querySelector('h2').textContent = 'Modifica Lead';
            modal.querySelector('#lead-id').value = lead.id;
            modal.querySelector('#lead-company').value = lead.company_name || '';
            modal.querySelector('#lead-service').value = lead.core_service_id || '';
            modal.querySelector('#lead-status').value = lead.status || '';
            modal.querySelector('#lead-macro-status').value = lead.macro_status || 'in lavorazione';
            modal.querySelector('#lead-notes').value = lead.notes || '';
        }, 50);
    };

    window.saveLead = async () => {
        const modal = document.getElementById('edit-lead-modal');
        const id = modal.querySelector('#lead-id').value;
        const company_name = modal.querySelector('#lead-company').value.trim();
        const core_service_id = modal.querySelector('#lead-service').value || null;
        const status = modal.querySelector('#lead-status').value.trim();
        const macro_status = modal.querySelector('#lead-macro-status').value;
        const notes = modal.querySelector('#lead-notes').value.trim();

        if (!company_name) return showGlobalAlert('Inserisci il nome azienda!', 'error');

        try {
            await upsertLead({
                id: id || undefined,
                company_name,
                core_service_id,
                status: status || 'Call di onboarding prenotata',
                macro_status,
                notes
            });
            closeModal('edit-lead-modal');
            showGlobalAlert('Lead salvato con successo!', 'success');

            // re-render current view
            const hash = window.location.hash;
            if (hash.includes('lead-detail')) {
                renderLeadDetail(document.getElementById('main-content') || document.body);
            } else {
                renderLeads(document.getElementById('main-content') || document.body);
            }
        } catch (e) {
            console.error(e);
            showGlobalAlert('Errore durante il salvataggio.', 'error');
        }
    };

    window.confirmDeleteLead = async (id) => {
        if (await showConfirm("Sei sicuro di voler eliminare questo lead? L'azione è irreversibile.", 'Elimina Lead')) {
            try {
                await deleteLead(id);
                showGlobalAlert('Lead eliminato', 'success');
                window.location.hash = '#leads';
            } catch (e) {
                console.error(e);
                showGlobalAlert('Errore in eliminazione', 'error');
            }
        }
    };

    window.editLeadStatus = (id) => {
        const lead = state.leads?.find(l => l.id === id);
        if (!lead) return;

        renderModal('edit-status-modal', `
             <div style="padding: 1.5rem; min-width: 400px;">
                 <h3 style="margin: 0 0 1.5rem 0; font-family: var(--font-titles);">Aggiorna Stato / Macro Stato</h3>
                 <input type="hidden" id="status-lead-id" value="${lead.id}">
                 
                 <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Stato Dettaglio</label>
                    <input type="text" id="status-detail" class="app-input" value="${lead.status || ''}" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                 </div>

                 <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Macro Stato</label>
                    <select id="status-macro" class="app-input" style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                        <option value="in lavorazione" ${lead.macro_status === 'in lavorazione' ? 'selected' : ''}>In Lavorazione</option>
                        <option value="vinto" ${lead.macro_status === 'vinto' ? 'selected' : ''}>Vinto</option>
                        <option value="perso" ${lead.macro_status === 'perso' ? 'selected' : ''}>Perso</option>
                    </select>
                 </div>

                 <div style="display: flex; gap: 1rem;">
                     <button onclick="window.closeModal('edit-status-modal')" style="flex: 1; padding: 0.8rem; border-radius: 10px; border: 1px solid var(--glass-border); background: white; cursor: pointer; font-weight: 600;">Annulla</button>
                     <button onclick="window.saveLeadStatus()" style="flex: 1; background: var(--brand-blue); color: white; padding: 0.8rem; border-radius: 10px; border: none; cursor: pointer; font-weight: 700;">Salva</button>
                 </div>
             </div>
         `);
    };

    window.saveLeadStatus = async () => {
        const id = document.getElementById('status-lead-id').value;
        const status = document.getElementById('status-detail').value.trim();
        const macro_status = document.getElementById('status-macro').value;

        try {
            const lead = state.leads?.find(l => l.id === id);
            await upsertLead({
                id,
                status,
                macro_status
            });
            closeModal('edit-status-modal');
            showGlobalAlert('Stato aggiornato', 'success');
            renderLeadDetail(document.getElementById('main-content') || document.body);
        } catch (e) {
            console.error(e);
            showGlobalAlert('Errore aggiornamento', 'error');
        }
    };

    window.createOrderFromLead = async (id) => {
        const lead = state.leads?.find(l => l.id === id);
        if (!lead) return;

        // Ensure orders modal logic is available.
        if (typeof window.openNewOrderModal !== 'function') {
            await import('./orders.js').then(m => m.initNewOrderModal());
        }

        // We can pre-fill order modal using a global trick or just open it. 
        // For now let's just trigger openNewOrderModal, optionally setting something if supported.
        // It asks to open window.openNewOrderModal()
        window.openNewOrderModal();

        // Wait for modal to render and try to pre-fill client name or title
        setTimeout(() => {
            const modal = document.getElementById('new-order-modal');
            if (modal) {
                const titleInput = modal.querySelector('#order-title');
                if (titleInput) titleInput.value = 'Progetto ' + lead.company_name;
            }
        }, 100);
    };
}
