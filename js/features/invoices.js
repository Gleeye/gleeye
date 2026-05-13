import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '../modules/utils.js?v=8000';
import { CustomSelect } from '../components/CustomSelect.js?v=8000';
import { DashboardData } from './dashboard.js?v=8000';
import { showGlobalAlert } from '../modules/utils.js?v=8000';
import { supabase } from '../modules/config.js?v=8000';
import { fetchInvoices, fetchPassiveInvoices, fetchPayments, fetchBankTransactions, fetchCollaborators } from '../modules/api.js?v=8000';
import { renderPassiveInvoicesPartners, renderPassiveInvoicesCollab, renderPassiveInvoicesSuppliers } from './invoices/passive_list.js?v=8000';
import { initInvoiceDetailModals, openInvoiceDetail } from './invoices/detail_modal.js?v=8000';
import { renderInvoices, renderActiveInvoicesSafe } from './invoices/active_list.js?v=8000';
import { glossaryTip } from '../modules/help_tooltip.js?v=8002';

// Re-export the active listing views so the router + dashboard dynamic imports
// (`features/invoices.js` → renderActiveInvoicesSafe etc.) keep working unchanged.
export { renderInvoices, renderActiveInvoicesSafe };

// --- INVOICE FORM MODAL LOGIC ---

export function initInvoiceModals() {
    if (!document.getElementById('invoice-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="invoice-modal" class="modal">
                <div class="modal-content glass-card" style="max-width: 700px; padding: 0; overflow: hidden;">
                <!-- Header -->
                <div style="padding: 1.5rem 2rem; background: var(--bg-secondary); border-bottom: 1px solid var(--glass-border);">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, var(--brand-blue), #2563eb); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                                <span class="material-icons-round" style="color: white; font-size: 1.4rem;">receipt</span>
                            </div>
                            <div>
                                <h2 id="invoice-modal-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem; color: var(--text-primary);">Nuova Fattura</h2>
                                <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-tertiary);">Compila i dettagli del documento fiscale</p>
                            </div>
                        </div>
                        <button class="icon-btn" id="close-invoice-modal-btn" style="width: 36px; height: 36px; border-radius: 10px; background: white; border: 1px solid var(--glass-border);">
                            <span class="material-icons-round" style="font-size: 1.25rem; color: var(--text-tertiary);">close</span>
                        </button>
                    </div>
                </div>

                <!-- Body -->
                <div id="invoice-modal-body" style="padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto;">
                    <form id="invoice-form" style="display: flex; flex-direction: column; gap: 1.5rem;">

                        <!-- Row 1: Numero + Data -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Numero Fattura *</label>
                                <input type="text" id="inv-number" class="modal-input" required placeholder="Es. 25-01" style="width: 100%;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Invio *</label>
                                <input type="date" id="inv-date" class="modal-input" required style="width: 100%;">
                            </div>
                        </div>

                        <!-- Row 2: Cliente -->
                        <div>
                            <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Cliente *</label>
                            <div style="position: relative;">
                                <select id="inv-client" class="modal-input" required style="width: 100%;">
                                    <option value="">Seleziona cliente...</option>
                                </select>
                            </div>
                        </div>

                        <!-- Row 3: Importo + Esigibilità IVA -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Importo Imponibile *</label>
                                <div style="position: relative;">
                                    <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                    <input type="number" id="inv-amount" class="modal-input" step="0.01" required placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                </div>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Esigibilità IVA * ${glossaryTip('esigibilita_iva')}</label>
                                <select id="inv-vat-eligibility" class="modal-input" required style="width: 100%;">
                                    <option value="Immediata">Immediata (I)</option>
                                    <option value="Differita">Differita (D)</option>
                                    <option value="Scissione dei pagamenti">Scissione dei pagamenti (S)</option>
                                    <option value="Esente art. 10">Esente art. 10 (N2.1)</option>
                                    <option value="Escluso art. 15">Escluso art. 15 - Anticipi (N2.2)</option>
                                    <option value="Non imponibile">Non imponibile (N3)</option>
                                </select>
                            </div>
                        </div>

                        <!-- Row 4: Spese Anticipate -->
                        <div style="padding: 1rem; background: rgba(139, 92, 246, 0.05); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.15);">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <input type="checkbox" id="inv-has-expenses" style="width: 18px; height: 18px; cursor: pointer;">
                                    <label for="inv-has-expenses" style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">Spese anticipate per conto cliente</label>
                            </div>
                            <p style="margin: 0.5rem 0 0 1.75rem; font-size: 0.7rem; color: var(--text-tertiary);">Art. 15 DPR 633/72 - Escluse da base imponibile IVA</p>
                            <div id="inv-expenses-amount-container" style="display: none; margin-top: 0.75rem; margin-left: 1.75rem;">
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase;">Importo Spese €</label>
                                <input type="number" id="inv-expenses-amount" class="modal-input" step="0.01" placeholder="0.00" style="max-width: 200px;">
                            </div>
                        </div>

                        <!-- Row 5: Ordini (multi-selezione tramite aggiunta) -->
                        <div>
                            <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Ordini Collegati</label>
                            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                                <select id="inv-order" class="modal-input" style="flex: 1;">
                                    <option value="">Seleziona ordine da aggiungere...</option>
                                </select>
                                <button type="button" id="btn-add-order" class="primary-btn small" style="padding: 0 0.75rem;">Aggiungi</button>
                            </div>
                            <div id="inv-selected-orders-list" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <!-- Badges here -->
                            </div>
                            <p style="margin: 0.4rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);">Puoi associare più ordini alla stessa fattura</p>
                        </div>

                        <!-- Row 6: Stato + Data Saldo -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Stato Fattura</label>
                                <select id="inv-status" class="modal-input" style="width: 100%;">
                                    <option value="Inviata">Inviata</option>
                                    <option value="Saldata">Saldata</option>
                                </select>
                            </div>
                            <div id="inv-payment-date-container" style="display: none;">
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Saldo</label>
                                <input type="date" id="inv-payment-date" class="modal-input" style="width: 100%;">
                            </div>
                        </div>

                        <!-- Row 7: Pagamenti (filtrati per ordini) -->
                        <div id="inv-payments-container" style="display: none;">
                            <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Collega Pagamenti</label>
                            <div id="inv-payments-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding: 0.5rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--glass-border);">
                                <p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--glass-border);">
                            <button type="button" class="primary-btn secondary" id="cancel-invoice-btn" style="padding: 0.6rem 1.25rem;">Annulla</button>
                            <button type="submit" class="primary-btn" style="padding: 0.6rem 1.5rem;">
                                <span class="material-icons-round" style="font-size: 1.1rem;">save</span>
                                Salva Fattura
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            </div>
            
            <!-- Passive Invoice Modal - Collaborators (Premium Design) -->
            <div id="passive-invoice-modal" class="modal">
                <div class="modal-content glass-card" style="max-width: 750px; padding: 0; overflow: hidden;">
                    <!-- Header -->
                    <div style="padding: 1.5rem 2rem; background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), transparent); border-bottom: 1px solid var(--glass-border);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);">
                                    <span class="material-icons-round" style="color: white; font-size: 1.4rem;">person</span>
                                </div>
                                <div>
                                    <h2 id="passive-invoice-modal-title" style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.25rem; color: var(--text-primary);">Nuova Fattura Collaboratore</h2>
                                    <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--text-tertiary);">Registra documento fiscale ricevuto</p>
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <input type="file" id="pinv-ai-pdf-input" accept="application/pdf" style="display: none;">
                                <button id="pinv-ai-import-btn" type="button" title="Carica un PDF: l'AI legge la fattura e precompila tutti i campi" style="height: 36px; padding: 0 0.85rem; border-radius: 10px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border: none; cursor: pointer; font-weight: 600; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3);">
                                    <span class="material-icons-round" style="font-size: 1rem;">auto_awesome</span>
                                    <span id="pinv-ai-import-label">Importa con AI</span>
                                </button>
                                <button class="icon-btn" id="close-passive-modal" style="width: 36px; height: 36px; border-radius: 10px; background: white; border: 1px solid var(--glass-border);">
                                    <span class="material-icons-round" style="font-size: 1.25rem; color: var(--text-tertiary);">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Body -->
                    <div style="padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto;">
                        <form id="passive-invoice-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            
                            <!-- Mode: Collaborator Fields -->
                            <div id="pinv-collab-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Regime fiscale del fornitore * ${glossaryTip('regime_fiscale_overview')}</label>
                                    <select id="pinv-type" class="modal-input" style="width: 100%;">
                                        <option value="ritenuta">Regime Ordinario (IVA 22% + Ritenuta)</option>
                                        <option value="forfettario">Regime Forfettario (no IVA, no Ritenuta)</option>
                                        <option value="occasionale">Prestazione Occasionale (Ritenuta 20%)</option>
                                        <option value="estero">Estero / Reverse Charge (no IVA)</option>
                                        <option value="parcella">Parcella / Notula (IVA + Ritenuta)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Collaboratore *</label>
                                    <select id="pinv-collaborator" class="modal-input" style="width: 100%;">
                                        <option value="">Seleziona collaboratore...</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Mode: Supplier Fields -->
                            <div id="pinv-supplier-fields" style="display: none; grid-template-columns: 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Fornitore *</label>
                                    <select id="pinv-supplier" class="modal-input" style="width: 100%;">
                                        <option value="">Seleziona fornitore...</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Descrizione Servizio *</label>
                                    <input type="text" id="pinv-description" class="modal-input" placeholder="Es. Consulenza SEO, Acquisto Software..." style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 2: Numero + Data -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Numero Fattura *</label>
                                    <input type="text" id="pinv-number" class="modal-input" required placeholder="N. documento" style="width: 100%;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Ricezione *</label>
                                    <input type="date" id="pinv-date" class="modal-input" required style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 3: Importo + Cassa + Netto -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Importo / Compenso *</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                        <input type="number" id="pinv-amount" class="modal-input" step="0.01" required placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                    </div>
                                </div>
                                <div id="pinv-cassa-container" style="display: none;">
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Cassa Previdenza (4%) ${glossaryTip('cassa_previdenza')}</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                        <input type="number" id="pinv-cassa" class="modal-input" step="0.01" placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                    </div>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Netto a Pagare *</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--text-tertiary);">€</span>
                                        <input type="number" id="pinv-net" class="modal-input" step="0.01" required placeholder="0.00" style="width: 100%; padding-left: 2rem;">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Row 3b: Breakdown calcolo automatico -->
                            <div id="pinv-calc-breakdown" style="padding: 0.75rem 1rem; background: rgba(139, 92, 246, 0.05); border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.15);">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                    <p id="pinv-calc-hint" style="margin: 0; font-size: 0.75rem; color: #8b5cf6; font-weight: 500;">
                                        <span class="material-icons-round" style="font-size: 0.9rem; vertical-align: middle; margin-right: 0.25rem;">calculate</span>
                                        Ritenuta 20%: € 0.00
                                    </p>
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                                            <input type="checkbox" id="pinv-has-rivalsa" style="width: 16px; height: 16px; cursor: pointer;">
                                            <label for="pinv-has-rivalsa" style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">+ Rivalsa INPS 4%</label>${glossaryTip('rivalsa_inps')}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                                            <input type="checkbox" id="pinv-has-vat" style="width: 16px; height: 16px; cursor: pointer;">
                                            <label for="pinv-has-vat" style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">+ IVA 22%</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                                            <input type="checkbox" id="pinv-has-bollo" style="width: 16px; height: 16px; cursor: pointer;">
                                            <label for="pinv-has-bollo" style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); cursor: pointer;">+ Bollo €2</label>${glossaryTip('bollo_virtuale')}
                                        </div>
                                    </div>
                                </div>
                                <p id="pinv-calc-details" style="margin: 0.5rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);"></p>
                            </div>
                            
                            <!-- Row 4: Stato + Data Saldo -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Stato *</label>
                                    <select id="pinv-status" class="modal-input" required style="width: 100%;">
                                        <option value="Da Pagare">Da Pagare</option>
                                        <option value="Pagata">Pagata</option>
                                    </select>
                                </div>
                                <div id="pinv-payment-date-container" style="display: none;">
                                    <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Data Saldo</label>
                                    <input type="date" id="pinv-payment-date" class="modal-input" style="width: 100%;">
                                </div>
                            </div>
                            
                            <!-- Row 5: Ordini (filtro opzionale) -->
                            <div>
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Filtra per Ordine</label>
                                <select id="pinv-order" class="modal-input" style="width: 100%;">
                                    <option value="">Tutti gli ordini</option>
                                </select>
                            </div>
                            
                            <!-- Row 6: Pagamenti (tutti quelli in attesa per il collaboratore) -->
                            <div id="pinv-payments-container" style="display: none;">
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">Collega Pagamenti *</label>
                                <div id="pinv-payments-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding: 0.5rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--glass-border);">
                                    <p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un collaboratore per vedere i pagamenti in attesa</p>
                                </div>
                                <p style="margin: 0.4rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);">Seleziona uno o più pagamenti per questa fattura</p>
                            </div>
                            
                            <!-- Row 7: File Upload -->
                            <div style="padding: 1rem; background: rgba(139, 92, 246, 0.05); border-radius: 12px; border: 1px dashed rgba(139, 92, 246, 0.3);">
                                <label style="display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Allega Fattura *</label>
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <input type="file" id="pinv-file" accept=".pdf,.png,.jpg,.jpeg" style="flex: 1; font-size: 0.85rem;">
                                    <div id="pinv-file-preview" style="display: none; padding: 0.5rem 0.75rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; color: #10b981; font-size: 0.75rem; font-weight: 600;">
                                        <span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">check_circle</span>
                                        <span id="pinv-file-name">file.pdf</span>
                                    </div>
                                </div>
                                <p style="margin: 0.5rem 0 0; font-size: 0.65rem; color: var(--text-tertiary);">Formati: PDF, PNG, JPG (max 5MB)</p>
                            </div>
                            
                            <!-- Actions -->
                            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--glass-border);">
                                <button type="button" class="primary-btn secondary" id="cancel-passive-btn" style="padding: 0.6rem 1.25rem;">Annulla</button>
                                <button type="submit" class="primary-btn" style="padding: 0.6rem 1.5rem; background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
                                    <span class="material-icons-round" style="font-size: 1.1rem;">save</span>
                                    Salva Fattura
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <!-- Unpaid Modal -->
        <div id="unpaid-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header"><h2 id="unpaid-modal-title">Fatture Non Saldate</h2><button class="close-modal" onclick="this.closest('.modal').classList.remove('active')">x</button></div>
                <div id="unpaid-list"></div>
            </div>
        </div>
    `);

        // Attach Close Listeners
        document.getElementById('close-invoice-modal-btn')?.addEventListener('click', closeInvoiceForm);
        document.getElementById('cancel-invoice-btn')?.addEventListener('click', closeInvoiceForm);

        const closePassive = document.getElementById('close-passive-modal');
        if (closePassive) closePassive.addEventListener('click', closePassiveInvoiceForm);
        document.getElementById('cancel-passive-btn')?.addEventListener('click', closePassiveInvoiceForm);

        // === AI: Importa fattura da PDF ===
        const aiBtn = document.getElementById('pinv-ai-import-btn');
        const aiInput = document.getElementById('pinv-ai-pdf-input');
        if (aiBtn && aiInput) {
            aiBtn.addEventListener('click', () => aiInput.click());
            aiInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.type !== 'application/pdf') {
                    showGlobalAlert("Seleziona un file PDF", 'error');
                    aiInput.value = '';
                    return;
                }
                await handlePassiveInvoiceAIImport(file);
                aiInput.value = '';
            });
        }

        // Conditional field logic: Spese Anticipate
        document.getElementById('inv-has-expenses')?.addEventListener('change', (e) => {
            document.getElementById('inv-expenses-amount-container').style.display = e.target.checked ? 'block' : 'none';
        });

        // Conditional field logic: Data Saldo based on Status
        document.getElementById('inv-status')?.addEventListener('change', (e) => {
            document.getElementById('inv-payment-date-container').style.display = e.target.value === 'Saldata' ? 'block' : 'none';
        });

        // Cascading: Cliente → Ordini
        document.getElementById('inv-client')?.addEventListener('change', (e) => {
            updateOrdersDropdown(e.target.value);
        });

        // Cascading: Ordine → Pagamenti
        document.getElementById('btn-add-order')?.addEventListener('click', () => {
            const select = document.getElementById('inv-order');
            const orderId = select.value;
            if (orderId && !state.selectedOrderIds.includes(orderId)) {
                state.selectedOrderIds.push(orderId);
                renderSelectedOrders();
                select.value = '';
            }
        });

        // ========== PASSIVE INVOICE MODAL LISTENERS ==========

        // Tipo documento → Auto-calc Netto + hint update
        document.getElementById('pinv-type')?.addEventListener('change', (e) => {
            updateNettoCalculation();
            updateCalcHint(e.target.value);
        });

        // Importo → Auto-calc Netto
        document.getElementById('pinv-amount')?.addEventListener('input', () => {
            updateNettoCalculation();
        });

        // IVA checkbox → recalc when manually toggled
        document.getElementById('pinv-has-vat')?.addEventListener('change', () => {
            state._pinvVatManuallySet = true; // Flag to prevent auto-override
            updateNettoCalculation();
        });

        // Rivalsa checkbox → recalc when manually toggled
        document.getElementById('pinv-has-rivalsa')?.addEventListener('change', () => {
            state._pinvRivalsaManuallySet = true;
            updateNettoCalculation();
        });

        // Bollo checkbox → recalc when manually toggled
        document.getElementById('pinv-has-bollo')?.addEventListener('change', () => {
            state._pinvBolloManuallySet = true;
            updateNettoCalculation();
        });

        // Collaboratore → Ordini e Pagamenti cascade
        document.getElementById('pinv-collaborator')?.addEventListener('change', (e) => {
            updatePassiveOrdersDropdown(e.target.value);
            updatePassivePaymentsForCollaborator(e.target.value);
        });

        // Ordine → Pagamenti filter
        document.getElementById('pinv-order')?.addEventListener('change', (e) => {
            const collabId = document.getElementById('pinv-collaborator').value;
            updatePassivePaymentsForCollaborator(collabId, e.target.value);
        });

        // Stato → Data Saldo conditional
        document.getElementById('pinv-status')?.addEventListener('change', (e) => {
            document.getElementById('pinv-payment-date-container').style.display = e.target.value === 'Pagata' ? 'block' : 'none';
        });

        // File preview
        document.getElementById('pinv-file')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('pinv-file-preview');
            const fileName = document.getElementById('pinv-file-name');
            if (file && preview && fileName) {
                preview.style.display = 'inline-flex';
                fileName.textContent = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
            } else if (preview) {
                preview.style.display = 'none';
            }
        });

        // Passive form submit
        const passiveForm = document.getElementById('passive-invoice-form');
        if (passiveForm) passiveForm.addEventListener('submit', handleSavePassiveInvoice);
        // Initialize Custom Select for Collaborator
        const collabSelect = document.getElementById('pinv-collaborator');
        if (collabSelect) {
            state.customCollabSelect = new CustomSelect(collabSelect);
        }
    }

    // Assign global functions
    window.openInvoiceForm = openInvoiceForm;
    window.closeInvoiceForm = closeInvoiceForm;
    window.handleSaveInvoice = handleSaveInvoice;
    window.openPassiveInvoiceForm = openPassiveInvoiceForm;
    window.closePassiveInvoiceForm = closePassiveInvoiceForm;

    const form = document.getElementById('invoice-form');
    if (form) form.addEventListener('submit', handleSaveInvoice);
}

function populateClientDropdown() {
    const select = document.getElementById('inv-client');
    if (!select) return;

    const clients = state.clients || [];
    select.innerHTML = '<option value="">Seleziona cliente...</option>' +
        clients.map(c => `<option value="${c.id}">${c.client_code} - ${c.business_name}</option>`).join('');
}

function updateOrdersDropdown(clientId) {
    const select = document.getElementById('inv-order');
    const paymentsContainer = document.getElementById('inv-payments-container');

    if (!select) return;

    if (!clientId) {
        select.innerHTML = '<option value="">Seleziona prima un cliente</option>';
        if (paymentsContainer) paymentsContainer.style.display = 'none';
        return;
    }

    const orders = (state.orders || []).filter(o => o.client_id === clientId);
    select.innerHTML = '<option value="">Nessun ordine</option>' +
        orders.map(o => `<option value="${o.id}">${o.order_number} - ${o.title || 'Senza titolo'}</option>`).join('');

    // Show payments container if orders available
    if (paymentsContainer) paymentsContainer.style.display = orders.length > 0 ? 'block' : 'none';
}

function renderSelectedOrders() {
    const list = document.getElementById('inv-selected-orders-list');
    if (!list) return;

    if (!state.selectedOrderIds || state.selectedOrderIds.length === 0) {
        list.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-tertiary); font-style: italic;">Nessun ordine selezionato</span>';
        updatePaymentsForOrders([]);
        return;
    }

    list.innerHTML = state.selectedOrderIds.map(id => {
        const order = state.orders.find(o => o.id === id);
        return `
            <div class="status-badge" style="background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); border: 1px solid rgba(59, 130, 246, 0.2); display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.6rem;">
                <span style="font-size: 0.75rem; font-weight: 600;">${order?.order_number || order?.title || 'Ordine'}</span>
                <span class="material-icons-round" onclick="removeSelectedOrder('${id}')" style="font-size: 1rem; cursor: pointer; opacity: 0.6;">close</span>
            </div>
        `;
    }).join('');

    updatePaymentsForOrders(state.selectedOrderIds);

    // Global helper for the close button
    window.removeSelectedOrder = (id) => {
        state.selectedOrderIds = state.selectedOrderIds.filter(oid => oid !== id);
        renderSelectedOrders();
    };
}

function updatePaymentsForOrders(orderIds) {
    const list = document.getElementById('inv-payments-list');
    if (!list) return;

    if (!orderIds || orderIds.length === 0) {
        list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona almeno un ordine per vedere i pagamenti</p>';
        document.getElementById('inv-payments-container').style.display = 'none';
        return;
    }

    document.getElementById('inv-payments-container').style.display = 'block';

    const payments = (state.payments || []).filter(p =>
        orderIds.includes(p.order_id) &&
        p.payment_type === 'Cliente' &&
        (!p.invoice_id || p.invoice_id === state.currentInvoiceId)
    );

    if (payments.length === 0) {
        list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Nessun pagamento da associare per gli ordini selezionati</p>';
        return;
    }

    list.innerHTML = payments.map(p => {
        const isChecked = (state.currentInvoiceId && p.invoice_id === state.currentInvoiceId) ? 'checked' : '';
        const order = state.orders.find(o => o.id === p.order_id);
        return `
            <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; background: white; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">
                <input type="checkbox" class="inv-payment-check" value="${p.id}" ${isChecked} style="width: 16px; height: 16px;">
                <div style="flex: 1;">
                    <div style="font-size: 0.85rem; font-weight: 600;">${p.title || 'Pagamento'}</div>
                    <div style="font-size: 0.65rem; color: var(--text-tertiary);">${order?.order_number || ''} • ${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : 'Senza scadenza'}</div>
                </div>
                <div style="font-weight: 700; color: var(--brand-blue);">€ ${formatAmount(p.amount)}</div>
            </label>
        `;
    }).join('');
}

export function openInvoiceForm(id = null) {
    const modal = document.getElementById('invoice-modal');
    if (!modal) return;

    state.currentInvoiceId = id;

    // Populate client dropdown
    populateClientDropdown();

    // Reset form
    document.getElementById('invoice-form').reset();
    document.getElementById('inv-expenses-amount-container').style.display = 'none';
    document.getElementById('inv-payment-date-container').style.display = 'none';
    document.getElementById('inv-payments-container').style.display = 'none';
    document.getElementById('inv-order').innerHTML = '<option value="">Seleziona prima un cliente</option>';
    document.getElementById('inv-payments-list').innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>';
    state.selectedOrderIds = [];
    renderSelectedOrders();

    if (id) {
        document.getElementById('invoice-modal-title').textContent = 'Modifica Fattura';
        const inv = state.invoices.find(i => i.id === id);
        if (inv) {
            document.getElementById('inv-number').value = inv.invoice_number || '';
            document.getElementById('inv-date').value = inv.invoice_date || '';
            document.getElementById('inv-amount').value = inv.amount_tax_excluded || '';
            document.getElementById('inv-status').value = inv.status || 'Inviata';
            document.getElementById('inv-vat-eligibility').value = inv.vat_eligibility || 'Immediata';
            document.getElementById('inv-client').value = inv.client_id || '';

            // Trigger cascading
            if (inv.client_id) {
                updateOrdersDropdown(inv.client_id);
                
                // Initialize selectedOrderIds
                state.selectedOrderIds = [];
                if (inv.linked_orders && Array.isArray(inv.linked_orders)) {
                    state.selectedOrderIds = [...inv.linked_orders];
                } else if (inv.order_id) {
                    state.selectedOrderIds = [inv.order_id];
                }
                renderSelectedOrders();
            }

            // Spese anticipate
            if (inv.expenses_client_account && inv.expenses_client_account > 0) {
                document.getElementById('inv-has-expenses').checked = true;
                document.getElementById('inv-expenses-amount-container').style.display = 'block';
                document.getElementById('inv-expenses-amount').value = inv.expenses_client_account;
            }

            // Payment date
            if (inv.status === 'Saldata') {
                document.getElementById('inv-payment-date-container').style.display = 'block';
                document.getElementById('inv-payment-date').value = inv.payment_date || '';
            }
        }
    } else {
        document.getElementById('invoice-modal-title').textContent = 'Nuova Fattura';
        document.getElementById('inv-number').value = getNextInvoiceNumber();
        document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

export function closeInvoiceForm() {
    const modal = document.getElementById('invoice-modal');
    if (modal) modal.classList.remove('active');
    state.currentInvoiceId = null;
}

export async function handleSaveInvoice(e) {
    e.preventDefault();

    const clientId = document.getElementById('inv-client').value;
    const orderId = document.getElementById('inv-order').value;
    const hasExpenses = document.getElementById('inv-has-expenses').checked;
    const expensesAmount = hasExpenses ? parseFloat(document.getElementById('inv-expenses-amount').value) || 0 : 0;
    const status = document.getElementById('inv-status').value;

    // Get selected payments
    const selectedPayments = Array.from(document.querySelectorAll('.inv-payment-check:checked')).map(cb => cb.value);

    // Calculate IVA based on eligibility
    const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
    const vatEligibility = document.getElementById('inv-vat-eligibility').value;
    const vatRate = vatEligibility.includes('Esente') || vatEligibility.includes('Escluso') || vatEligibility.includes('Non imponibile') ? 0 : 22;
    const taxAmount = amount * (vatRate / 100);
    const amountTaxIncluded = vatEligibility.includes('Scissione') ? amount : amount + taxAmount;

    const data = {
        invoice_number: document.getElementById('inv-number').value,
        invoice_date: document.getElementById('inv-date').value,
        amount_tax_excluded: amount,
        tax_amount: taxAmount,
        vat_rate: vatRate,
        amount_tax_included: amountTaxIncluded,
        vat_eligibility: vatEligibility,
        expenses_client_account: expensesAmount,
        status: status,
        payment_date: status === 'Saldata' ? document.getElementById('inv-payment-date').value : null,
        client_id: clientId || null,
        order_id: state.selectedOrderIds.length > 0 ? state.selectedOrderIds[0] : null,
        linked_orders: state.selectedOrderIds
    };

    try {
        let result;
        if (state.currentInvoiceId) {
            result = await supabase.from('invoices').update(data).eq('id', state.currentInvoiceId).select();
        } else {
            result = await supabase.from('invoices').insert([data]).select();
        }

        if (result.error) throw result.error;
        showGlobalAlert(state.currentInvoiceId ? 'Fattura aggiornata!' : 'Fattura creata!', 'success');

        // Update linked payments associations
        if (result.data && result.data[0]) {
            const savedId = result.data[0].id;
            // Unlink any payments that were previously linked but are no longer selected
            const { data: currentLinked } = await supabase.from('payments').select('id').eq('invoice_id', savedId);
            if (currentLinked) {
                const toUnlink = currentLinked.filter(p => !selectedPayments.includes(p.id));
                for (const p of toUnlink) {
                    await supabase.from('payments').update({ invoice_id: null }).eq('id', p.id);
                }
            }

            // Link all selected payments
            if (selectedPayments.length > 0) {
                for (const paymentId of selectedPayments) {
                    const updatePayload = { invoice_id: savedId };
                    if (status === 'Saldata') updatePayload.status = 'Saldato';
                    await supabase.from('payments').update(updatePayload).eq('id', paymentId);
                }
            }
        }

        closeInvoiceForm();

        // Small delay to ensure Supabase persistence before fetch
        await new Promise(r => setTimeout(r, 500));
        await fetchInvoices();
        await fetchPayments(true); // Force refresh of payments for the dashboard

        // Auto-switch year to the new invoice's year to ensure it's visible
        const invYear = new Date(data.invoice_date).getFullYear();
        if (invYear !== state.dashboardYear) {
            state.dashboardYear = invYear;
        }

        // Refresh UI immediately
        if (state.currentPage === 'invoices') {
            renderActiveInvoicesSafe(document.getElementById('content-area'));
        }

        window.dispatchEvent(new Event('data:updated'));
    } catch (err) {
        console.error("Save error details:", JSON.stringify(err, null, 2));
        showGlobalAlert("Errore salvataggio: " + (err.message || "Controlla la console"), 'error');
    }
}

// Helpers
function getNextInvoiceNumber() {
    const year = new Date().getFullYear().toString().slice(-2);
    const existingNumbers = (state.invoices || [])
        .filter(i => i.invoice_number && i.invoice_number.startsWith(year))
        .map(i => {
            const parts = i.invoice_number.split('-');
            return parts.length > 1 ? parseInt(parts[1]) : 0;
        })
        .filter(n => !isNaN(n));

    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return `${year} -${String(maxNum + 1).padStart(2, '0')} `;
}

// ========== PASSIVE INVOICE MODAL FUNCTIONS ==========

async function populateCollaboratorDropdown() {
    const select = document.getElementById('pinv-collaborator');
    if (!select) return;

    if (!state.collaborators || state.collaborators.length === 0) {
        await fetchCollaborators();
    }
    const collaborators = state.collaborators || [];
    const modal = document.getElementById('passive-invoice-modal');
    const isPartnerMode = modal?.dataset.mode === 'partner-wl';

    const filtered = isPartnerMode
        ? collaborators.filter(c => c.type === 'white_label')
        : collaborators.filter(c => c.type !== 'white_label');

    select.innerHTML = `<option value="">Seleziona ${isPartnerMode ? 'Partner' : 'Collaboratore'}...</option>` +
        filtered.map(c => `<option value="${c.id}" data-settings='${JSON.stringify({
            regime: c.fiscal_regime || 'ordinario',
            cassaRate: c.cassa_previdenziale_rate !== undefined && c.cassa_previdenziale_rate !== null ? c.cassa_previdenziale_rate : 0,
            vatRate: c.default_vat_rate !== undefined && c.default_vat_rate !== null ? c.default_vat_rate : 22,
            withholdingRate: c.withholding_tax_rate !== undefined && c.withholding_tax_rate !== null ? c.withholding_tax_rate : 20
        })}'>${c.full_name}</option>`).join('');

    if (state.customCollabSelect) state.customCollabSelect.refresh();
}

async function populateSupplierDropdown() {
    const select = document.getElementById('pinv-supplier');
    if (!select) return;

    if (!state.suppliers || state.suppliers.length === 0) {
        // Fetch suppliers if not loaded (assuming fetchSuppliers exists or generic fetch)
        const { data } = await supabase.from('suppliers').select('*').order('name');
        state.suppliers = data || [];
    }
    const suppliers = state.suppliers || [];
    select.innerHTML = '<option value="">Seleziona fornitore...</option>' +
        suppliers.map(s => {
            const settings = {
                regime: s.fiscal_regime || 'ordinario',
                cassaRate: s.cassa_previdenziale_rate || 0,
                vatRate: s.default_vat_rate || 22,
                country: s.country || 'IT'
            };
            return `<option value="${s.id}" data-settings='${JSON.stringify(settings)}'>${s.name}</option>`;
        }).join('');

    // Attach listener if not already attached (idempotent because of how functions work but let's be safe)
    // Actually best to attach listener once in init. Or here if we replace the element. 
    // Since we are just changing innerHTML, listener on select persists.
}

// Supplier Change Listener Logic
function handleSupplierChange(e) {
    const opt = e.target.selectedOptions[0];
    if (!opt || !opt.dataset.settings) return;

    const settings = JSON.parse(opt.dataset.settings);
    const hasVatCheckbox = document.getElementById('pinv-has-vat');

    // Auto-configure
    if (settings.regime === 'forfettario' || settings.regime === 'minimi') {
        hasVatCheckbox.checked = false;
        state._pinvVatManuallySet = true; // prevent auto-recheck
    } else {
        // Ordinario
        if (settings.country === 'IT') {
            hasVatCheckbox.checked = true;
        } else {
            // Foreign: usually no VAT (reverse charge)
            hasVatCheckbox.checked = false;
        }
        state._pinvVatManuallySet = true;
    }

    // Toggle Cassa Field
    const cassaContainer = document.getElementById('pinv-cassa-container');
    const cassaInput = document.getElementById('pinv-cassa');
    if (settings.cassaRate > 0) {
        cassaContainer.style.display = 'block';
        cassaInput.dataset.rate = settings.cassaRate;
        // Trigger recalc will interpret this
    } else {
        cassaContainer.style.display = 'none';
        cassaInput.value = '';
        cassaInput.dataset.rate = 0;
    }

    updateNettoCalculation();
}

function updateNettoCalculation() {
    const modal = document.getElementById('passive-invoice-modal');
    const mode = modal.dataset.mode || 'collab';
    const isPartner = mode === 'partner-wl';

    const importo = parseFloat(document.getElementById('pinv-amount')?.value) || 0;
    const hasVat = document.getElementById('pinv-has-vat')?.checked;

    let netto = 0;
    let desc = '';

    if (mode === 'collab' || isPartner) {
        const tipo = document.getElementById('pinv-type')?.value || 'ritenuta';
        const colSelect = document.getElementById('pinv-collaborator');
        const colOpt = colSelect?.selectedOptions[0];
        // Use settings from dataset or fall back to defaults
        // For Partners, default withholding rate should be 0 unless specified
        const settings = colOpt?.dataset.settings ? JSON.parse(colOpt.dataset.settings) : { 
            cassaRate: isPartner ? 0 : 4, 
            withholdingRate: isPartner ? 0 : 20 
        };

        let cassa = 0;
        let imponibile = importo;
        let iva = 0;
        let ritenuta = 0;
        let bollo = 0;

        const hasRivalsa = document.getElementById('pinv-has-rivalsa')?.checked;
        const hasBollo = document.getElementById('pinv-has-bollo')?.checked;

        // Rivalsa (Cassa) Calculation
        const cassaInput = document.getElementById('pinv-cassa');
        const cassaContainer = document.getElementById('pinv-cassa-container');
        const rate = (tipo === 'occasionale') ? 0 : (parseFloat(settings.cassaRate) || 4); // Default to 4% for collaborators if not specified

        if (hasRivalsa && rate > 0) {
            cassa = importo * (rate / 100);
            imponibile = importo + cassa;
            if (cassaInput) {
                cassaInput.value = cassa.toFixed(2);
                cassaInput.dataset.rate = rate;
            }
        } else {
            cassa = 0;
            imponibile = importo;
            if (cassaInput) cassaInput.value = '';
        }

        // Show/hide cassa container regardless of checkbox (user wants to see the field if it *could* have cassa)
        // For Partners, we ALWASY hide it because they don't have Cassa
        if (!isPartner && tipo !== 'occasionale' && tipo !== 'estero') {
            if (cassaContainer) cassaContainer.style.display = 'block';
        } else {
            if (cassaContainer) cassaContainer.style.display = 'none';
        }

        // Bollo Calculation
        if (hasBollo) bollo = 2;

        if (tipo === 'forfettario') {
            iva = 0;
            ritenuta = 0;
            netto = imponibile + bollo;
            desc = `(Imponibile${bollo ? ' + Bollo' : ''})`;
        } else if (tipo === 'occasionale') {
            iva = 0;
            ritenuta = importo * 0.20;
            netto = importo - ritenuta + bollo;
            desc = `(Importo - 20% Ritenuta${bollo ? ' + Bollo' : ''})`;
        } else if (tipo === 'fattura' || tipo === 'ritenuta' || tipo === 'parcella' || tipo === 'nota_debito') {
            if (hasVat) iva = imponibile * 0.22;
            ritenuta = imponibile * ((parseFloat(settings.withholdingRate) || (isPartner ? 0 : 20)) / 100);
            netto = imponibile + iva - ritenuta + bollo;
            desc = isPartner ? `(Imp. + IVA)` : `(Imp. + Cassa + IVA - Ret. ${bollo ? '+ Bollo' : ''})`;
        } else if (tipo === 'estero' || tipo === 'reverse_charge') {
            iva = 0;
            ritenuta = 0;
            netto = imponibile + bollo;
            desc = `(Imponibile ${bollo ? '+ Bollo' : ''})`;
        } else if (tipo === 'nota_credito') {
            if (hasVat) iva = imponibile * 0.22;
            netto = imponibile + iva;
            desc = `(Nota di Credito: Imponibile + IVA)`;
        }

        const netInput = document.getElementById('pinv-net');
        if (netInput) netInput.value = netto.toFixed(2);

        const detailsEl = document.getElementById('pinv-calc-details');
        if (detailsEl) {
            detailsEl.textContent = `Dettaglio: Importo €${formatAmount(importo)} + Cassa €${formatAmount(cassa)} = Imponibile €${formatAmount(imponibile)} ${desc}`;
        }
        const hintEl = document.getElementById('pinv-calc-hint');
        if (hintEl) {
            hintEl.innerHTML = `<span class="material-icons-round" style="font-size: 0.9rem; vertical-align: middle; margin-right: 0.25rem;">calculate</span> ${ritenuta > 0 ? `Ritenuta: €${formatAmount(ritenuta)}` : ''}${ritenuta > 0 && iva > 0 ? ' | ' : ''}${iva > 0 ? `IVA: €${formatAmount(iva)}` : ''}${bollo > 0 ? ` | Bollo: €${formatAmount(bollo)}` : ''}`;
        }
    } else {
        // --- SUPPLIER LOGIC ---
        const cassaInput = document.getElementById('pinv-cassa');
        let cassa = 0;
        if (cassaInput && cassaInput.offsetParent !== null) {
            const rate = parseFloat(cassaInput.dataset.rate) || 0;
            cassa = importo * (rate / 100);
            cassaInput.value = cassa.toFixed(2);
        }

        const imponibile = importo + cassa;
        const iva = hasVat ? imponibile * 0.22 : 0;
        netto = imponibile + iva;

        const netInput = document.getElementById('pinv-net');
        if (netInput) netInput.value = netto.toFixed(2);

        const detailsEl = document.getElementById('pinv-calc-details');
        if (detailsEl) detailsEl.textContent = `Imponibile: €${formatAmount(imponibile)}${iva > 0 ? ` + IVA €${formatAmount(iva)}` : ''}`;

        const hintEl = document.getElementById('pinv-calc-hint');
        if (hintEl) hintEl.textContent = `(Imponibile ${cassa > 0 ? '+ Cassa ' : ''}${hasVat ? '+ IVA' : '(No IVA)'})`;
    }
}

function updateCalcHint(tipo) {
    // Reset manual overrides when tipo changes
    state._pinvVatManuallySet = false;
    state._pinvRivalsaManuallySet = false;
    state._pinvBolloManuallySet = false;

    // Update auto-checkboxes based on tipo
    const vatCheckbox = document.getElementById('pinv-has-vat');
    const rivalsaCheckbox = document.getElementById('pinv-has-rivalsa');
    const bolloCheckbox = document.getElementById('pinv-has-bollo');
    const amount = parseFloat(document.getElementById('pinv-amount')?.value) || 0;

    if (vatCheckbox && !state._pinvVatManuallySet) {
        vatCheckbox.checked = ['ritenuta', 'fattura', 'parcella', 'nota_debito', 'nota_credito'].includes(tipo);
    }
    if (rivalsaCheckbox && !state._pinvRivalsaManuallySet) {
        // If it's a partner (company), we should hide the Rivalsa option entirely
        const modal = document.getElementById('passive-invoice-modal');
        const isPartner = modal?.dataset.mode === 'partner-wl';
        
        if (isPartner) {
            rivalsaCheckbox.checked = false;
            if (rivalsaCheckbox.parentElement) rivalsaCheckbox.parentElement.style.display = 'none';
        } else {
            rivalsaCheckbox.checked = ['ritenuta', 'fattura', 'parcella', 'forfettario'].includes(tipo);
            if (rivalsaCheckbox.parentElement) rivalsaCheckbox.parentElement.style.display = 'flex';
        }
    }
    if (bolloCheckbox && !state._pinvBolloManuallySet) {
        bolloCheckbox.checked = (tipo === 'forfettario' || tipo === 'occasionale' || tipo === 'estero' || tipo === 'reverse_charge') && amount > 77.47;
    }

    // Recalculate
    updateNettoCalculation();
}

function updatePassiveOrdersDropdown(collaboratorId) {
    const select = document.getElementById('pinv-order');
    if (!select) return;

    if (!collaboratorId) {
        select.innerHTML = '<option value="">Seleziona prima un collaboratore</option>';
        return;
    }

    // Find orders where this collaborator has assignments
    const collaboratorAssignments = (state.assignments || []).filter(a => a.collaborator_id === collaboratorId);
    const orderIds = [...new Set(collaboratorAssignments.map(a => a.order_id).filter(Boolean))];
    const orders = (state.orders || []).filter(o => orderIds.includes(o.id));

    select.innerHTML = '<option value="">Tutti gli ordini</option>' +
        orders.map(o => `<option value="${o.id}">${o.order_number} - ${o.short_name || o.title || 'Senza titolo'}</option>`).join('');
}

function updatePassivePaymentsForCollaborator(collaboratorId, optionalOrderId = null) {
    const list = document.getElementById('pinv-payments-list');
    const container = document.getElementById('pinv-payments-container');
    if (!list || !container) return;

    if (!collaboratorId) {
        container.style.display = 'none';
        list.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un collaboratore per vedere i pagamenti in attesa</p>';
        return;
    }

    // Get payments for collaborator (passive) that are pending invoice
    // We only want 'Invito Inviato' (In attesa fattura) OR payments already linked to this specific invoice
    const payments = (state.payments || []).filter(p =>
        p.collaborator_id === collaboratorId &&
        p.payment_type === 'Collaboratore' &&
        (p.status === 'Invito Inviato' || p.passive_invoice_id === state.currentPassiveInvoiceId) &&
        (!p.passive_invoice_id || p.passive_invoice_id === state.currentPassiveInvoiceId) &&
        (!optionalOrderId || p.order_id === optionalOrderId)
    );

    container.style.display = 'block';

    if (payments.length === 0) {
        list.innerHTML = `<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Nessun pagamento in attesa ${optionalOrderId ? 'per questo ordine' : 'per questo collaboratore'}</p>`;
        return;
    }

    list.innerHTML = payments.map(p => {
        const order = state.orders?.find(o => o.id === p.order_id);
        const orderInfo = order ? `${order.order_number} - ${order.short_name || order.title || 'Senza titolo'}` : 'Nessun ordine';
        const isChecked = (state.currentPassiveInvoiceId && p.passive_invoice_id === state.currentPassiveInvoiceId) ? 'checked' : '';
        
        return `
            <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.6rem; background: white; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.2s;">
                <input type="checkbox" class="pinv-payment-check" value="${p.id}" data-order-id="${p.order_id}" ${isChecked} style="width: 16px; height: 16px; margin-top: 2px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary);" class="text-truncate">${p.title || 'Pagamento'}</div>
                    <div style="font-size: 0.65rem; color: var(--text-tertiary); font-weight: 500;" class="text-truncate">${orderInfo}</div>
                    <div style="font-size: 0.6rem; color: var(--text-tertiary); margin-top: 1px;">Scadenza: ${p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT') : 'Nessuna'}</div>
                </div>
                <div style="font-weight: 800; color: #8b5cf6; font-size: 0.85rem; flex-shrink: 0; margin-left: auto;">€ ${formatAmount(p.amount)}</div>
            </label>
        `;
    }).join('');
}


async function handleSavePassiveInvoice(e) {
    e.preventDefault();

    const modal = document.getElementById('passive-invoice-modal');
    const mode = modal.dataset.mode || 'collab';

    const tipo = document.getElementById('pinv-type').value;
    const collaboratorId = document.getElementById('pinv-collaborator').value;
    const supplierId = document.getElementById('pinv-supplier').value;
    const description = document.getElementById('pinv-description').value;

    // Validate required fields
    if (mode === 'collab' && !collaboratorId && (tipo === 'ritenuta' || tipo === 'occasionale' || tipo === 'forfettario')) {
        showGlobalAlert("Seleziona un collaboratore", 'warning');
        return;
    }
    if (mode === 'supplier') {
        if (!supplierId) {
            showGlobalAlert("Seleziona un fornitore", 'warning');
            return;
        }
        if (!description) {
            showGlobalAlert("Inserisci descr. servizio", 'warning');
            return;
        }
    }

    const orderId = document.getElementById('pinv-order').value;
    const hasVat = document.getElementById('pinv-has-vat').checked;
    const hasRivalsa = document.getElementById('pinv-has-rivalsa').checked;
    const hasBollo = document.getElementById('pinv-has-bollo').checked;
    const status = document.getElementById('pinv-status').value;
    const importo = parseFloat(document.getElementById('pinv-amount').value) || 0;

    // Recalculate fiscal values
    let compenso = importo;
    let rivalsa = 0;
    let imponibile = compenso;
    let iva = 0;
    let ritenuta = 0;
    let bollo = 0;
    let netto = compenso;

    if (mode === 'collab' || mode === 'partner-wl') {
        const colSelect = document.getElementById('pinv-collaborator');
        const colOpt = colSelect?.selectedOptions[0];
        const settings = colOpt?.dataset.settings ? JSON.parse(colOpt.dataset.settings) : { cassaRate: 4, withholdingRate: 20 };

        // Rivalsa
        const rate = (tipo === 'occasionale') ? 0 : (parseFloat(settings.cassaRate) || 4);
        if (hasRivalsa && rate > 0) {
            rivalsa = compenso * (rate / 100);
            imponibile = compenso + rivalsa;
        } else {
            rivalsa = 0;
            imponibile = compenso;
        }

        // Bollo
        if (hasBollo) bollo = 2;

        if (tipo === 'forfettario') {
            iva = 0;
            ritenuta = 0;
            netto = imponibile + bollo;
        } else if (tipo === 'occasionale') {
            iva = 0;
            ritenuta = compenso * 0.20;
            netto = compenso - ritenuta + bollo;
        } else if (tipo === 'ritenuta' || tipo === 'fattura' || tipo === 'parcella') {
            if (hasVat) iva = imponibile * 0.22;
            
            // Partner Companies don't have withholding tax, even if it's a "fattura"
            if (mode === 'partner-wl') {
                ritenuta = 0;
            } else {
                ritenuta = imponibile * ((parseFloat(settings.withholdingRate) || 20) / 100);
            }
            
            netto = imponibile + iva - ritenuta + bollo;
        } else if (tipo === 'estero') {
            iva = 0;
            ritenuta = 0;
            netto = imponibile + bollo;
        } else if (tipo === 'nota_credito') {
            if (hasVat) iva = imponibile * 0.22;
            netto = imponibile + iva;
        }
    } else {
        // Supplier mode: simple VAT calculation
        imponibile = compenso;
        if (hasVat) iva = imponibile * 0.22;
        netto = imponibile + iva;
    }

    // Collect unique related orders from selected payments
    const checkedPayments = Array.from(document.querySelectorAll('.pinv-payment-check:checked'));
    const selectedPayments = checkedPayments.map(cb => cb.value);
    
    let relatedOrderIds = [...new Set(checkedPayments.map(cb => cb.dataset.orderId).filter(id => id && id !== 'undefined'))];
    let relatedOrders = [];
    
    if (relatedOrderIds.length > 0 && state.orders) {
        relatedOrderIds.forEach(oid => {
            const order = state.orders.find(o => o.id === oid);
            if (order) relatedOrders.push(order.order_number);
        });
    } else if (orderId && state.orders) {
        // Fallback to the single filter dropdown if no specific payments were checked
        const order = state.orders.find(o => o.id === orderId);
        if (order) relatedOrders.push(order.order_number);
    }
    
    const relatedOrdersString = relatedOrders.join(', ');

    // Handle file upload
    const fileInput = document.getElementById('pinv-file');
    let attachmentUrl = null;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `passive-invoices/${Date.now()}_${file.name}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
            attachmentUrl = urlData.publicUrl;
        } catch (uploadErr) {
            console.error("Upload error:", uploadErr);
            showGlobalAlert("Errore caricamento file: " + uploadErr.message, 'error');
            return;
        }
    }

    // Names for denormalization
    const collaboratorName = (mode === 'collab' || mode === 'partner-wl') ? document.getElementById('pinv-collaborator').options[document.getElementById('pinv-collaborator').selectedIndex]?.text : null;
    const supplierName = mode === 'supplier' ? document.getElementById('pinv-supplier').options[document.getElementById('pinv-supplier').selectedIndex]?.text : null;

    const data = {
        invoice_number: document.getElementById('pinv-number').value,
        issue_date: document.getElementById('pinv-date').value || null,
        amount_tax_excluded: importo,
        amount_tax_included: netto,
        tax_amount: iva,
        ritenuta: ritenuta,
        rivalsa_inps: rivalsa,
        cassa_previdenziale: parseFloat(document.getElementById('pinv-cassa')?.value) || 0,
        stamp_duty: bollo,
        iva_attiva: hasVat,
        category: tipo,
        status: status,
        payment_date: (status === 'Pagata' && document.getElementById('pinv-payment-date').value) ? document.getElementById('pinv-payment-date').value : null,
        collaborator_id: (mode === 'collab' || mode === 'partner-wl') ? collaboratorId : null,
        collaborator_name: collaboratorName,
        supplier_id: mode === 'supplier' ? supplierId : null,
        supplier_name: supplierName,
        description: mode === 'supplier' ? description : null,
        related_orders: relatedOrdersString,
        attachment_url: attachmentUrl,
    };

    try {
        let error;
        let savedId = state.currentPassiveInvoiceId;

        if (state.currentPassiveInvoiceId) {
            // For update, don't overwrite attachment if no new file
            if (!attachmentUrl) delete data.attachment_url;
            const res = await supabase.from('passive_invoices').update(data).eq('id', state.currentPassiveInvoiceId).select();
            error = res.error;
            if (res.data && res.data[0]) savedId = res.data[0].id;
        } else {
            const res = await supabase.from('passive_invoices').insert([data]).select();
            error = res.error;
            if (res.data && res.data[0]) savedId = res.data[0].id;
        }

        if (error) throw error;

        showGlobalAlert(state.currentPassiveInvoiceId ? 'Fattura aggiornata!' : 'Fattura registrata!', 'success');

        // Update linked payments associations
        if (savedId) {
            // Unlink any payments that were previously linked but are no longer selected
            // (Only necessary on edit mode, but safe to check)
            const { data: currentLinked } = await supabase.from('payments').select('id').eq('passive_invoice_id', savedId);
            if (currentLinked) {
                const toUnlink = currentLinked.filter(p => !selectedPayments.includes(p.id));
                for (const p of toUnlink) {
                    await supabase.from('payments').update({ passive_invoice_id: null }).eq('id', p.id);
                }
            }

            // Link all selected payments
            if (selectedPayments.length > 0) {
                for (const paymentId of selectedPayments) {
                    const updatePayload = { passive_invoice_id: savedId };
                    // If invoice is already 'Pagata', mark payment as 'Saldato'
                    // Otherwise, change status from 'Invito Inviato' to 'Fattura Ricevuta'
                    if (status === 'Pagata') {
                        updatePayload.status = 'Saldato';
                    } else {
                        updatePayload.status = 'Fattura Ricevuta';
                    }
                    await supabase.from('payments').update(updatePayload).eq('id', paymentId);
                }
            }
        }

        closePassiveInvoiceForm();
        await new Promise(r => setTimeout(r, 500)); // Delay for DB consistency
        await fetchPassiveInvoices(true);
        if (selectedPayments.length > 0) await fetchPayments(true); // Refresh payments cache to see the links

        // Auto-switch year if invoice is from a different year
        const invYear = data.issue_date ? new Date(data.issue_date).getFullYear() : (state.passiveInvoiceYear || new Date().getFullYear());
        if (invYear !== (state.passiveInvoiceYear || new Date().getFullYear())) {
            state.passiveInvoiceYear = invYear;
        }

        if (state.currentPage === 'passive-invoices-suppliers') {
            renderPassiveInvoicesSuppliers(document.getElementById('content-area'));
        } else if (state.currentPage === 'passive-invoices-collab') {
            renderPassiveInvoicesCollab(document.getElementById('content-area'));
        } else if (state.currentPage === 'passive-invoices-partners') {
            renderPassiveInvoicesPartners(document.getElementById('content-area'));
        }

        window.dispatchEvent(new Event('data:updated'));
    } catch (err) {
        console.error("Save error details:", JSON.stringify(err, null, 2));
        showGlobalAlert("Errore salvataggio: " + (err.message || err.details || "Errore sconosciuto"), 'error');
    }
}

// Export for consumption
export const InvoiceLogic = { renderActiveInvoicesSafe, initInvoiceModals };

// Detail modal — extracted to invoices/detail_modal.js (imported at top of file).
// Side effect on import: registers window.openInvoiceDetail. Re-exported below
// so the public surface of features/invoices.js stays identical.
export { initInvoiceDetailModals, openInvoiceDetail };

// Original Export
export async function openPassiveInvoiceForm(id = null, mode = 'collab') {
    const modal = document.getElementById('passive-invoice-modal');
    if (!modal) return;

    state.currentPassiveInvoiceId = id;
    state._pinvVatManuallySet = false;
    state._pinvRivalsaManuallySet = false;
    state._pinvBolloManuallySet = false;

    // Populate collaborators/suppliers and UI setup
    const isPartner = mode === 'partner-wl';

    if (mode === 'collab' || isPartner) {
        const entityLabel = isPartner ? 'Partner WL' : 'Collaboratore';
        const modalHeader = document.querySelector('#passive-invoice-modal .modal-content > div:first-child');
        const iconContainer = modalHeader?.querySelector('div > div:first-child');
        const iconSpan = iconContainer?.querySelector('.material-icons-round');

        if (isPartner) {
            if (iconSpan) iconSpan.style.display = 'none';
            if (iconContainer) iconContainer.style.display = 'none';
            if (modalHeader) modalHeader.style.background = 'transparent';
            if (modalHeader) modalHeader.style.padding = '1.25rem 2rem 0.75rem';
        } else {
            if (iconSpan) { iconSpan.style.display = 'flex'; iconSpan.textContent = 'person'; }
            if (iconContainer) { iconContainer.style.display = 'flex'; iconContainer.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)'; }
            if (modalHeader) modalHeader.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), transparent)';
            if (modalHeader) modalHeader.style.padding = '1.5rem 2rem';
        }

        document.getElementById('passive-invoice-modal-title').textContent = id ? `Modifica Fattura ${entityLabel}` : `Nuova Fattura ${entityLabel}`;

        // Update label in DOM if it exists
        const labelCollab = document.querySelector('label[for="pinv-collaborator"]') || document.querySelector('#pinv-collab-fields label:nth-of-type(1)');
        // Actually searching by text is safer if IDs aren't present
        const labels = document.querySelectorAll('#pinv-collab-fields label');
        labels.forEach(l => {
            if (l.textContent.includes('Collaboratore')) l.textContent = entityLabel + ' *';
        });

        document.getElementById('pinv-collab-fields').style.display = 'grid';
        document.getElementById('pinv-supplier-fields').style.display = 'none';

        modal.dataset.mode = mode; // Set mode before populating to ensure filtering
        await populateCollaboratorDropdown();
    } else {
        document.getElementById('passive-invoice-modal-title').textContent = id ? 'Modifica Fattura Fornitore' : 'Nuova Fattura Fornitore';
        document.getElementById('pinv-collab-fields').style.display = 'none';
        document.getElementById('pinv-supplier-fields').style.display = 'grid';
        await populateSupplierDropdown();
    }

    // Reset form
    document.getElementById('passive-invoice-form').reset();
    document.getElementById('pinv-payment-date-container').style.display = 'none';
    document.getElementById('pinv-payments-container').style.display = 'none';

    // Clear dropdowns based on mode
    const typeSelect = document.getElementById('pinv-type');
    if (isPartner) {
        typeSelect.innerHTML = `
            <option value="fattura">Fattura Ordinaria (IVA 22%)</option>
            <option value="reverse_charge">Fattura con Reverse Charge (No IVA)</option>
            <option value="estero">Fattura Estera / Intra-UE (No IVA)</option>
            <option value="nota_credito">Nota di Credito</option>
            <option value="nota_debito">Nota di Debito</option>
            <option value="forfettario">Regime Forfettario (No IVA, No Ritenuta)</option>
        `;
    } else {
        typeSelect.innerHTML = `
            <option value="ritenuta">Regime Ordinario (IVA 22% + Ritenuta)</option>
            <option value="forfettario">Regime Forfettario (No IVA, No Ritenuta)</option>
            <option value="occasionale">Prestazione Occasionale (Ritenuta 20%)</option>
            <option value="estero">Fattura Estero / Rev. Charge (No IVA)</option>
            <option value="parcella">Parcella/Notula (IVA + Ritenuta)</option>
            <option value="nota_credito">Nota di Credito</option>
        `;
    }

    if (mode === 'collab' || isPartner) document.getElementById('pinv-order').innerHTML = `<option value="">Seleziona prima un ${isPartner ? 'partner' : 'collaboratore'}</option>`;
    else document.getElementById('pinv-order').innerHTML = '<option value="">Bozza (nessun ordine collegato)</option>';

    document.getElementById('pinv-payments-list').innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center;">Seleziona un ordine per vedere i pagamenti</p>';
    document.getElementById('pinv-file-preview').style.display = 'none';
    if (mode === 'collab' || isPartner) updateCalcHint(isPartner ? 'fattura' : 'ritenuta');

    if (id) {
        const inv = state.passiveInvoices.find(i => i.id === id);
        if (inv) {
            document.getElementById('pinv-number').value = inv.invoice_number || '';
            document.getElementById('pinv-date').value = inv.issue_date || '';
            document.getElementById('pinv-amount').value = inv.amount_tax_excluded || '';
            document.getElementById('pinv-net').value = inv.amount_tax_included || '';
            document.getElementById('pinv-has-vat').checked = inv.iva_attiva || (inv.tax_amount > 0);
            document.getElementById('pinv-has-rivalsa').checked = (inv.rivalsa_inps > 0 || inv.cassa_previdenziale > 0);
            document.getElementById('pinv-has-bollo').checked = (inv.stamp_duty > 0);
            
            // Set manual overrides to true to prevent updateCalcHint from overwriting loaded values
            state._pinvVatManuallySet = true;
            state._pinvRivalsaManuallySet = true;
            state._pinvBolloManuallySet = true;
            document.getElementById('pinv-status').value = inv.status || 'Da Pagare';

            if (mode === 'collab' || isPartner) {
                const typeVal = inv.category || (isPartner ? 'fattura' : 'ritenuta');
                document.getElementById('pinv-type').value = typeVal;
                
                const collabVal = inv.collaborator_id || '';
                const collabEl = document.getElementById('pinv-collaborator');
                collabEl.value = collabVal;
                
                // Trigger change to update CustomSelect UI and load orders/payments
                collabEl.dispatchEvent(new Event('change', { bubbles: true }));

                if (collabVal) {
                    updatePassiveOrdersDropdown(collabVal);
                    updatePassivePaymentsForCollaborator(collabVal);
                    
                    // Mark previously linked payments as checked (logic: find payments already linked to this invoice)
                    setTimeout(() => {
                        // Check state.payments since we already fetched them
                        const linkedPayments = state.payments.filter(p => p.passive_invoice_id === inv.id);
                        if (linkedPayments.length > 0) {
                            linkedPayments.forEach(p => {
                                const cb = document.querySelector(`.pinv-payment-check[value="${p.id}"]`);
                                if (cb) cb.checked = true;
                            });
                        }
                    }, 600);
                }
                updateCalcHint(typeVal);
            } else {
                // Supplier mode
                document.getElementById('pinv-supplier').value = inv.supplier_id || '';
                document.getElementById('pinv-description').value = inv.description || inv.service_description || '';
            }

            // Attachment Preview
            if (inv.attachment_url) {
                const preview = document.getElementById('pinv-file-preview');
                const nameEl = document.getElementById('pinv-file-name');
                preview.style.display = 'flex';
                const fileName = inv.attachment_url.split('/').pop().split('?')[0];
                nameEl.textContent = decodeURIComponent(fileName);
                nameEl.onclick = () => window.open(inv.attachment_url, '_blank');
            }

            // Payment date
            if (inv.status === 'Pagata') {
                document.getElementById('pinv-payment-date-container').style.display = 'block';
                document.getElementById('pinv-payment-date').value = inv.payment_date || '';
            }
        }
    } else {
        document.getElementById('pinv-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
    modal.dataset.mode = mode;
}

export function closePassiveInvoiceForm() {
    const modal = document.getElementById('passive-invoice-modal');
    if (modal) modal.classList.remove('active');
    state.currentPassiveInvoiceId = null;
}

// Passive invoices listing views — extracted to invoices/passive_list.js.
// Imported at the top of this file; re-exported here so the router + dashboard
// dynamic-import paths (`features/invoices.js` → renderPassive*) keep working unchanged.
export { renderPassiveInvoicesPartners, renderPassiveInvoicesCollab, renderPassiveInvoicesSuppliers };

// ========= AI Import PDF =========

// pdfjs-dist caricato lazy da CDN al primo uso (~400KB cached forever)
let _pdfjsModulePromise = null;
function loadPdfJs() {
    if (_pdfjsModulePromise) return _pdfjsModulePromise;
    _pdfjsModulePromise = (async () => {
        // Import ESM build da unpkg/jsDelivr
        const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
        // Worker URL: necessario per pdfjs-dist (text extraction in worker thread)
        mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
        return mod;
    })();
    return _pdfjsModulePromise;
}

/**
 * Estrae il testo da un File PDF lato browser (pdfjs-dist nativo, supporto canvas/worker).
 */
async function extractPdfTextInBrowser(file) {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const chunks = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        chunks.push(tc.items.map(it => it.str || '').join(' '));
    }
    return { text: chunks.join('\n\n').trim(), pageCount: pdf.numPages };
}

const INVOICE_EXTRACTION_SCHEMA = {
    supplier_name: 'string — ragione sociale del fornitore',
    supplier_vat: 'string|null — P.IVA 11 cifre senza prefisso IT',
    supplier_fiscal_code: 'string|null',
    supplier_email: 'string|null',
    invoice_number: 'string',
    invoice_date: 'string — YYYY-MM-DD',
    due_date: 'string|null — YYYY-MM-DD',
    currency: 'string — es. EUR',
    total_gross: 'number — totale lordo a pagare',
    taxable_amount: 'number|null — imponibile',
    vat_amount: 'number|null',
    vat_rate: 'number|null — es. 22 per 22%',
    withholding_amount: 'number|null — ritenuta acconto',
    cassa_amount: 'number|null — cassa previdenza',
    bollo_amount: 'number|null — bollo virtuale (2 € se applicato)',
    regime: 'string|null — ordinario|forfettario|occasionale|estero|parcella',
    description: 'string|null — causale/descrizione principale',
    confidence: 'string — high|medium|low',
    notes: 'string|null',
};

const INVOICE_SYSTEM_PROMPT = `Sei un assistente specializzato nell'estrarre dati strutturati da fatture italiane.
L'utente ti manda il TESTO estratto da un PDF di una fattura passiva.
Estrai i campi e rispondi SOLO con JSON valido come da schema.

REGOLE:
- Date in formato YYYY-MM-DD.
- Importi come numeri (punto decimale).
- supplier_vat: solo 11 cifre senza prefisso 'IT'.
- regime: ordinario|forfettario|occasionale|estero|parcella.
- Se forfettario: vat_rate=0, withholding_amount=null.
- Se Reverse Charge / estero: regime="estero", vat_amount=0.
- Campi obbligatori: supplier_name, invoice_number, invoice_date, total_gross.`;

/**
 * Match supplier in state.suppliers via P.IVA → CF → email → name fuzzy.
 */
function matchSupplierLocal(extracted) {
    if (!Array.isArray(state.suppliers) || !extracted) return null;
    const piva = extracted.supplier_vat?.replace(/\D/g, '');
    if (piva) {
        const m = state.suppliers.find(s => (s.vat_number || '').replace(/\D/g, '') === piva);
        if (m) return m;
    }
    const cf = extracted.supplier_fiscal_code?.toUpperCase().trim();
    if (cf) {
        const m = state.suppliers.find(s => (s.tax_code || '').toUpperCase().trim() === cf);
        if (m) return m;
    }
    const email = extracted.supplier_email?.toLowerCase().trim();
    if (email) {
        const m = state.suppliers.find(s => (s.email || '').toLowerCase().trim() === email);
        if (m) return m;
    }
    const name = extracted.supplier_name?.toLowerCase().trim();
    if (name && name.length > 2) {
        const m = state.suppliers.find(s => (s.name || '').toLowerCase().includes(name) || name.includes((s.name || '').toLowerCase()));
        if (m) return m;
    }
    return null;
}

/**
 * Carica un PDF, estrae il testo nel browser (pdfjs-dist), lo manda a
 * `ai.completeJSON()` (Gemini Flash via OpenRouter), riceve i campi estratti
 * e precompila il modal. Match supplier locale via state.suppliers.
 *
 * NON salva niente: l'utente conferma + corregge + clicca Salva come al solito.
 */
async function handlePassiveInvoiceAIImport(file) {
    const label = document.getElementById('pinv-ai-import-label');
    const btn = document.getElementById('pinv-ai-import-btn');
    const originalLabel = label?.textContent || 'Importa con AI';

    function setBusy(text, disabled = true) {
        if (label) label.textContent = text;
        if (btn) btn.disabled = disabled;
    }

    setBusy('Lettura PDF…');

    try {
        // 1) Estrai testo PDF nel browser
        const { text: pdfText, pageCount } = await extractPdfTextInBrowser(file);

        if (!pdfText) {
            showGlobalAlert("Il PDF non contiene testo estraibile (probabile scansione). Carica manualmente.", 'error');
            return;
        }

        setBusy('Estrazione AI…');

        // 2) Chiamata AI via wrapper centrale (logga auto in ai_usage_log)
        if (!window.ai?.completeJSON) {
            showGlobalAlert("Modulo AI non caricato. Hard refresh.", 'error');
            return;
        }
        const TRUNCATE = 60000;
        const finalText = pdfText.length > TRUNCATE ? pdfText.slice(0, TRUNCATE) + '\n[…troncato…]' : pdfText;

        const extracted = await window.ai.completeJSON(
            `Nome file: ${file.name}\nPagine: ${pageCount}\n\nTESTO PDF:\n${finalText}`,
            INVOICE_EXTRACTION_SCHEMA,
            {
                feature: 'passive_invoice_pdf_parser',
                system: INVOICE_SYSTEM_PROMPT,
                temperature: 0.1,
            }
        );

        if (!extracted || typeof extracted !== 'object') {
            showGlobalAlert("AI non è riuscita a estrarre i campi. Riprova o carica manualmente.", 'error');
            return;
        }

        // 3) Match supplier locale
        const matchedSupplier = matchSupplierLocal(extracted);

        // 4) Riempi il form
        applyExtractedInvoiceToForm(extracted, matchedSupplier);

        const confidence = extracted.confidence || 'medium';
        const supLabel = matchedSupplier?.name
            ? ` · ${matchedSupplier.name} riconosciuto`
            : ' · fornitore non riconosciuto (seleziona manualmente)';
        showGlobalAlert(`✨ Campi precompilati (confidenza ${confidence})${supLabel}. Controlla e salva.`, 'success');
    } catch (e) {
        console.error('[ai-import] errore:', e);
        showGlobalAlert(`Errore: ${e.message || e}`, 'error');
    } finally {
        setBusy(originalLabel, false);
    }
}

/**
 * Mappa l'output dell'edge function sui campi del modal passive_invoice.
 * Mappa best-effort: se un campo manca lo lascia in default.
 */
function applyExtractedInvoiceToForm(extracted, matchedSupplier) {
    // Determina mode: se c'è un supplier matched → mode 'supplier', altrimenti 'collaborator' (default).
    // Il modal cambia campi via dropdown #pinv-mode (se esiste) — non possiamo forzare,
    // ma se il supplier è matched lo selezioniamo nel dropdown suppliers.

    // Regime fiscale (collaborator mode)
    const regime = (extracted.regime || '').toLowerCase();
    const typeSelect = document.getElementById('pinv-type');
    if (typeSelect) {
        const map = {
            ordinario: 'ritenuta',
            forfettario: 'forfettario',
            occasionale: 'occasionale',
            estero: 'estero',
            parcella: 'parcella',
        };
        const target = map[regime];
        if (target) {
            const opt = Array.from(typeSelect.options).find(o => o.value === target);
            if (opt) {
                typeSelect.value = target;
                typeSelect.dispatchEvent(new Event('change'));
            }
        }
    }

    // Supplier match (try both selectors: supplier mode + collaborator mode)
    if (matchedSupplier?.id) {
        const supSelect = document.getElementById('pinv-supplier');
        if (supSelect) {
            const opt = Array.from(supSelect.options).find(o => o.value === matchedSupplier.id);
            if (opt) {
                supSelect.value = matchedSupplier.id;
                supSelect.dispatchEvent(new Event('change'));
            }
        }
    }

    // Number + date
    if (extracted.invoice_number) {
        const el = document.getElementById('pinv-number');
        if (el) el.value = extracted.invoice_number;
    }
    if (extracted.invoice_date) {
        const el = document.getElementById('pinv-date');
        if (el) el.value = extracted.invoice_date;
    }
    if (extracted.description) {
        const el = document.getElementById('pinv-description');
        if (el) el.value = extracted.description;
    }

    // Amounts: imponibile, cassa, netto
    const taxable = Number(extracted.taxable_amount || 0);
    const totalGross = Number(extracted.total_gross || 0);
    const cassa = Number(extracted.cassa_amount || 0);
    const bollo = Number(extracted.bollo_amount || 0);
    const vat = Number(extracted.vat_amount || 0);
    const ritenuta = Number(extracted.withholding_amount || 0);

    // pinv-amount → "Importo / Compenso" (imponibile lordo prima di IVA/ritenuta)
    const amountEl = document.getElementById('pinv-amount');
    if (amountEl) {
        const value = taxable > 0 ? taxable : Math.max(0, totalGross - vat - cassa - bollo + ritenuta);
        if (value > 0) amountEl.value = value.toFixed(2);
    }

    // pinv-net → "Netto a Pagare"
    const netEl = document.getElementById('pinv-net');
    if (netEl && totalGross > 0) {
        netEl.value = totalGross.toFixed(2);
    }

    // pinv-cassa
    const cassaEl = document.getElementById('pinv-cassa');
    if (cassaEl && cassa > 0) {
        cassaEl.value = cassa.toFixed(2);
    }

    // Checkboxes
    const vatCb = document.getElementById('pinv-has-vat');
    if (vatCb) vatCb.checked = vat > 0;
    const bolloCb = document.getElementById('pinv-has-bollo');
    if (bolloCb) bolloCb.checked = bollo > 0;
    // Rivalsa: heuristic — solo se c'è cassa SU regime ordinario non-cassa (es. INPS gestione separata)
    // Per ora la lasciamo off di default: l'utente la attiva se sa che il fornitore la applica.

    // Trigger ricalcolo breakdown (se l'app ha listener su pinv-amount change)
    amountEl?.dispatchEvent(new Event('input'));
    netEl?.dispatchEvent(new Event('input'));
}

