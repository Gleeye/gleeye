import { state } from '/js/modules/state.js';
import { formatAmount } from '../modules/utils.js?v=1000';
import { fetchCollaborators, upsertCollaborator, deleteCollaborator } from '../modules/api.js';

export async function renderWhiteLabelPartners(container) {
    if (!state.collaborators || state.collaborators.length === 0) {
        await fetchCollaborators();
    }

    const partners = state.collaborators.filter(c => c.type === 'white_label' && c.is_active !== false);

    container.innerHTML = `
        <div class="animate-fade-in" style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h1 style="font-size: 2rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 0.75rem;">
                        <span class="material-icons-round" style="font-size: 2.2rem; color: var(--brand-blue);">corporate_fare</span>
                        Partner White Label
                    </h1>
                    <p style="color: var(--text-tertiary); margin-top: 0.5rem;">Gestione aziende partner e dati fiscali per fatturazione passiva.</p>
                </div>
                <button class="primary-btn" id="add-partner-wl-btn">
                    <span class="material-icons-round">add</span>
                    Nuovo Partner
                </button>
            </div>

            <div id="partners-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
                ${partners.map(p => renderPartnerCard(p)).join('')}
                ${partners.length === 0 ? '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-tertiary);">Nessun partner trovato. Clicca su "Nuovo Partner" per iniziare.</div>' : ''}
            </div>
        </div>
    `;

    document.getElementById('add-partner-wl-btn')?.addEventListener('click', () => openWhiteLabelPartnerModal());

    // Add click events to cards
    container.querySelectorAll('.partner-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            window.location.hash = `#white-label-partner-detail/${id}`;
        });
    });
}

function renderPartnerCard(p) {
    return `
        <div class="glass-card partner-card clickable-card" data-id="${p.id}" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="width: 52px; height: 52px; border-radius: 12px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                    <span class="material-icons-round" style="font-size: 1.8rem;">corporate_fare</span>
                </div>
                <button class="icon-btn edit-btn" style="padding: 4px;" onclick="event.stopPropagation(); window.openWhiteLabelPartnerModal('${p.id}')">
                    <span class="material-icons-round" style="font-size: 1.2rem;">edit</span>
                </button>
            </div>
            
            <div>
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">${p.full_name}</h3>
                <p style="margin: 0.25rem 0 0; color: var(--brand-blue); font-size: 0.8rem; font-weight: 500;">Partner White Label</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
                <div>
                    <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">P.IVA</div>
                    <div style="font-size: 0.85rem; font-weight: 500;">${p.vat_number || '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">Paese</div>
                    <div style="font-size: 0.85rem; font-weight: 500;">${p.country || 'IT'}</div>
                </div>
            </div>
        </div>
    `;
}

export async function renderWhiteLabelPartnerDetail(container) {
    const id = state.currentId;
    if (!state.collaborators || state.collaborators.length === 0) await fetchCollaborators();
    const p = state.collaborators.find(x => x.id == id);

    if (!p) {
        container.innerHTML = '<div style="padding: 2rem;">Partner non trovato.</div>';
        return;
    }

    container.innerHTML = `
        <div class="animate-fade-in" style="padding: 2rem; max-width: 1000px; margin: 0 auto;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                <button class="icon-btn" onclick="window.history.back()">
                    <span class="material-icons-round">arrow_back</span>
                </button>
                <h1 style="margin: 0;">${p.full_name}</h1>
                <span class="badge" style="background: var(--brand-blue-light); color: var(--brand-blue);">Partner WL</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round">business</span> Dati Societari
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Ragione Sociale</label>
                            <div style="font-weight: 500;">${p.full_name}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Partita IVA</label>
                            <div style="font-weight: 500;">${p.vat_number || '-'}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Codice Fiscale</label>
                            <div style="font-weight: 500;">${p.fiscal_code || '-'}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Indirizzo</label>
                            <div style="font-weight: 500;">${p.address || ''} ${p.city || ''} (${p.province || ''})</div>
                        </div>
                    </div>
                </div>

                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round">account_balance</span> Configurazione Fiscale
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Regime</label>
                            <div style="font-weight: 500; text-transform: capitalize;">${p.fiscal_regime || 'ordinario'}</div>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">IVA Default</label>
                            <div style="font-weight: 500;">${p.default_vat_rate || 22}%</div>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Ritenuta</label>
                            <div style="font-weight: 500;">${p.withholding_tax_rate || 0}%</div>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Cassa Prev.</label>
                            <div style="font-weight: 500;">${p.cassa_previdenziale_rate || 0}%</div>
                        </div>
                        <div style="grid-column: span 2;">
                            <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Termini Pagamento</label>
                            <div style="font-weight: 500;">${p.payment_terms || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="primary-btn secondary" onclick="window.openWhiteLabelPartnerModal('${p.id}')">
                    <span class="material-icons-round">edit</span> Modifica
                </button>
            </div>
        </div>
    `;
}

export function initWhiteLabelPartnerModals() {
    if (document.getElementById('partner-wl-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'partner-wl-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; width: 90vw;">
            <div class="modal-header">
                <h2 id="partner-wl-modal-title">Nuovo Partner WL</h2>
                <button class="close-modal material-icons-round" id="close-partner-wl-modal">close</button>
            </div>
            <div class="modal-body">
                <form id="partner-wl-form">
                    <input type="hidden" id="partner-wl-id">
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <!-- Anagrafica Aziendale -->
                        <div style="grid-column: span 2;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                                Dati Societari
                            </div>
                            <div class="form-group full-width">
                                <label>Ragione Sociale *</label>
                                <input type="text" id="partner-wl-full-name" required placeholder="Es: Gleeye S.r.l.">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Partita IVA</label>
                            <input type="text" id="partner-wl-vat" placeholder="IT00000000000">
                        </div>
                        <div class="form-group">
                            <label>Codice Fiscale</label>
                            <input type="text" id="partner-wl-fiscal-code" style="text-transform: uppercase;">
                        </div>

                        <!-- Fiscali -->
                        <div style="grid-column: span 2; margin-top: 1rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                                Configurazione Fiscale
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Regime Fiscale</label>
                            <select id="partner-wl-fiscal-regime">
                                <option value="ordinario">Ordinario</option>
                                <option value="forfettario">Forfettario</option>
                                <option value="minimi">Minimi</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Paese</label>
                            <select id="partner-wl-country">
                                <option value="IT">Italia</option>
                                <option value="UE">UE (Intra)</option>
                                <option value="EXTRA">Extra UE</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>IVA Default %</label>
                            <input type="number" id="partner-wl-vat-rate" value="22">
                        </div>
                        <div class="form-group">
                            <label>Ritenuta %</label>
                            <input type="number" id="partner-wl-withholding" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Cassa Prev. %</label>
                            <input type="number" id="partner-wl-cassa" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Termini di Pagamento</label>
                            <input type="text" id="partner-wl-payment-terms" placeholder="30gg d.f.">
                        </div>

                        <!-- Contatti & Altro -->
                        <div style="grid-column: span 2; margin-top: 1rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                                Recapiti & Sede
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Email PEC</label>
                            <input type="email" id="partner-wl-pec">
                        </div>
                        <div class="form-group">
                            <label>Email Amministrazione</label>
                            <input type="email" id="partner-wl-email">
                        </div>
                        <div class="form-group full-width">
                            <label>Indirizzo Sede Legale</label>
                            <input type="text" id="partner-wl-address">
                        </div>
                    </div>

                    <div class="form-actions" style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <button type="button" class="primary-btn danger-outline" id="delete-partner-wl-btn" style="display: none;">
                            <span class="material-icons-round">delete</span> Elimina
                        </button>
                        <div style="display: flex; gap: 1rem; margin-left: auto;">
                            <button type="button" class="primary-btn secondary" id="cancel-partner-wl-modal">Annulla</button>
                            <button type="submit" class="primary-btn">Salva Partner</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Eventi
    const close = () => modal.classList.remove('active');
    document.getElementById('close-partner-wl-modal').addEventListener('click', close);
    document.getElementById('cancel-partner-wl-modal').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    // Delete handler
    document.getElementById('delete-partner-wl-btn').addEventListener('click', async () => {
        const id = document.getElementById('partner-wl-id').value;
        if (!id) return;

        const confirmed = await window.showConfirm(
            'Sei sicuro di voler eliminare questo partner? l\'operazione è irreversibile.',
            'Elimina Partner'
        );

        if (confirmed) {
            try {
                await deleteCollaborator(id);
                close();
                if (state.currentPage === 'white-label-partners') {
                    renderWhiteLabelPartners(document.getElementById('content-area'));
                } else {
                    window.location.hash = '#white-label-partners';
                }
                window.showAlert('Partner eliminato con successo', 'success');
            } catch (err) {
                window.showAlert('Errore durante l\'eliminazione: ' + err.message, 'error');
            }
        }
    });

    document.getElementById('partner-wl-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        const id = document.getElementById('partner-wl-id').value;
        const formData = {
            id: id || undefined,
            type: 'white_label',
            full_name: document.getElementById('partner-wl-full-name').value,
            vat_number: document.getElementById('partner-wl-vat').value || null,
            fiscal_code: document.getElementById('partner-wl-fiscal-code').value || null,
            fiscal_regime: document.getElementById('partner-wl-fiscal-regime').value,
            country: document.getElementById('partner-wl-country').value,
            default_vat_rate: document.getElementById('partner-wl-vat-rate').value === '' ? 22 : parseFloat(document.getElementById('partner-wl-vat-rate').value),
            withholding_tax_rate: document.getElementById('partner-wl-withholding').value === '' ? 0 : parseFloat(document.getElementById('partner-wl-withholding').value),
            cassa_previdenziale_rate: document.getElementById('partner-wl-cassa').value === '' ? 0 : parseFloat(document.getElementById('partner-wl-cassa').value),
            payment_terms: document.getElementById('partner-wl-payment-terms').value || '',
            pec: document.getElementById('partner-wl-pec').value || null,
            email: document.getElementById('partner-wl-email').value || null,
            address: document.getElementById('partner-wl-address').value || null,
            is_active: true
        };

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loader-sm"></span> Salvataggio...';

            await upsertCollaborator(formData);
            close();

            window.showAlert('Partner salvato con successo', 'success');

            // Refresh logic based on current view
            if (state.currentPage === 'white-label-partners') {
                renderWhiteLabelPartners(document.getElementById('content-area'));
            } else if (state.currentPage === 'white-label-partner-detail') {
                renderWhiteLabelPartnerDetail(document.getElementById('content-area'));
            }
        } catch (err) {
            console.error("Error saving partner:", err);
            window.showAlert('Errore durante il salvataggio: ' + (err.message || err.details || 'Errore sconosciuto'), 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    window.openWhiteLabelPartnerModal = (id = null) => {
        const title = document.getElementById('partner-wl-modal-title');
        const idInput = document.getElementById('partner-wl-id');
        const form = document.getElementById('partner-wl-form');
        const deleteBtn = document.getElementById('delete-partner-wl-btn');
        form.reset();

        if (id) {
            const p = state.collaborators.find(x => x.id == id);
            if (p) {
                title.textContent = 'Modifica Partner WL';
                idInput.value = p.id;
                document.getElementById('partner-wl-full-name').value = p.full_name || '';
                document.getElementById('partner-wl-vat').value = p.vat_number || '';
                document.getElementById('partner-wl-fiscal-code').value = p.fiscal_code || '';
                document.getElementById('partner-wl-fiscal-regime').value = p.fiscal_regime || 'ordinario';
                document.getElementById('partner-wl-country').value = p.country || 'IT';
                document.getElementById('partner-wl-vat-rate').value = p.default_vat_rate || 22;
                document.getElementById('partner-wl-withholding').value = p.withholding_tax_rate || 0;
                document.getElementById('partner-wl-cassa').value = p.cassa_previdenziale_rate || 0;
                document.getElementById('partner-wl-payment-terms').value = p.payment_terms || '';
                document.getElementById('partner-wl-pec').value = p.pec || '';
                document.getElementById('partner-wl-email').value = p.email || '';
                document.getElementById('partner-wl-address').value = p.address || '';
                deleteBtn.style.display = 'flex';
            }
        } else {
            title.textContent = 'Nuovo Partner WL';
            idInput.value = '';
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
    };
}
