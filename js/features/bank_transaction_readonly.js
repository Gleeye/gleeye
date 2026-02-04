import { state } from '../modules/state.js?v=156';
import { formatAmount } from '../modules/utils.js?v=156';

export function renderReadOnlyView(t) {
    const container = document.getElementById('bt-read-only-view');
    if (!container) return;

    const type = t.type || 'entrata';
    const isIncome = type === 'entrata';
    const sign = isIncome ? '+' : '-';

    // Resolve entity name
    let entityName = t.counterparty_name || 'Controparte Sconosciuta';
    if (t.client_id && state.clients) {
        const c = state.clients.find(x => x.id === t.client_id);
        if (c) entityName = c.business_name;
    } else if (t.supplier_id && state.suppliers) {
        const s = state.suppliers.find(x => x.id === t.supplier_id);
        if (s) entityName = s.name;
    } else if (t.collaborator_id && state.collaborators) {
        const c = state.collaborators.find(x => x.id === t.collaborator_id);
        if (c) entityName = c.full_name;
    }

    // Resolve Category
    let catName = 'Nessuna Categoria';
    if (t.category_id && state.transactionCategories) {
        const cat = state.transactionCategories.find(c => c.id === t.category_id);
        if (cat) catName = cat.name.toUpperCase();
    } else if (t.transaction_categories) {
        catName = t.transaction_categories.name.toUpperCase();
    }

    // Resolve Invoices
    let linkedInvoices = [];
    if (t.active_invoice_match) linkedInvoices.push(t.active_invoice_match);
    if (t.passive_invoice_match) linkedInvoices.push(t.passive_invoice_match);

    // Manual linked invoices (IDs)
    if (t.linked_invoices && t.linked_invoices.length > 0) {
        const allInvoices = [...(state.invoices || []), ...(state.passiveInvoices || [])];
        t.linked_invoices.forEach(id => {
            const found = allInvoices.find(inv => inv.id === id);
            if (found) linkedInvoices.push(found);
        });
    }
    // De-duplicate by ID
    linkedInvoices = [...new Map(linkedInvoices.map(item => [item.id, item])).values()];

    container.innerHTML = `
        <div style="max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 0.5rem;">
            
            <!-- HEADER INFO (Super Dense) -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--glass-border); margin-bottom: 0.25rem;">
                <div style="display: flex; flex-direction: column; gap: 0.1rem;">
                    <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">
                        ${new Date(t.date).toLocaleDateString('it-IT', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()}
                    </div>
                    <div style="display: flex; align-items: baseline; gap: 0.5rem;">
                        <span style="font-size: 1.5rem; font-weight: 700; ${isIncome ? 'color: #16a34a;' : 'color: #dc2626;'}">
                            ${sign} ${formatAmount(Math.abs(t.amount))} €
                        </span>
                        <div style="padding: 1px 6px; background: #e0f2fe; color: #0284c7; border-radius: 4px; font-weight: 600; font-size: 0.65rem; display: flex; align-items: center; gap: 3px;">
                            <span class="material-icons-round" style="font-size: 12px;">verified</span> Registrato
                        </div>
                    </div>
                </div>
            </div>

            <!-- DETAILS GRID (Single Column for density / Two Columns very tight) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                
                <!-- Description (Full Width) -->
                <div style="grid-column: span 2; background: #fff; padding: 0.5rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                    <div style="font-size: 0.6rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.2rem;">Descrizione</div>
                    <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.3;">${t.description}</div>
                </div>

                <!-- Entity -->
                <div style="background: #fff; padding: 0.5rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                     <div style="font-size: 0.6rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.2rem;">Controparte</div>
                     <div style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
                        <span class="material-icons-round" style="color: var(--text-tertiary); font-size: 0.9rem;">person</span> 
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${entityName}</span>
                     </div>
                </div>

                <!-- Category -->
                <div style="background: #fff; padding: 0.5rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                     <div style="font-size: 0.6rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.2rem;">Categoria</div>
                     <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); display: inline-flex; align-items: center; padding: 2px 6px; background: var(--bg-secondary); border-radius: 5px;">
                        ${catName}
                     </div>
                </div>

                <!-- Linked Docs -->
                 <div style="grid-column: span 2; background: #fff; padding: 0.5rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                    <div style="font-size: 0.6rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.35rem;">Documenti Collegati</div>
                    
                    ${linkedInvoices.length > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                            ${linkedInvoices.map(inv => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.5rem; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <div style="width: 24px; height: 24px; background: #e0e7ff; color: #4338ca; border-radius: 5px; display: flex; align-items: center; justify-content: center;">
                                            <span class="material-icons-round" style="font-size: 0.85rem;">receipt</span>
                                        </div>
                                        <div>
                                            <div style="font-weight: 600; font-size: 0.8rem; color: #1e293b;">Fatt. #${inv.invoice_number}</div>
                                        </div>
                                    </div>
                                    <div style="font-weight: 600; color: #1e293b; font-size: 0.8rem;">€ ${formatAmount(inv.amount_tax_included || inv.amount_gross || 0)}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div style="color: var(--text-tertiary); font-style: italic; font-size: 0.75rem;">Nessun documento collegato</div>'}
                </div>
            </div>

            ${t.raw || t.description_original ? `
             <!-- Original Data (Enhanced) -->
            <div style="margin-top: 0.2rem; padding: 0.5rem; border: 1px dashed #cbd5e1; border-radius: 10px; background: #f8fafc; display: flex; flex-direction: column; gap: 0.4rem;">
                 <div style="font-size: 0.6rem; font-weight: 600; color: #64748b; text-transform: uppercase; display: flex; align-items: center; gap: 0.4rem;">
                    <span class="material-icons-round" style="font-size: 11px;">data_object</span> Dati Originali Banca
                 </div>
                 
                 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; padding-bottom: 0.2rem; border-bottom: 1px solid #e2e8f0;">
                    <div>
                        <div style="font-size: 0.55rem; color: #94a3b8; text-transform: uppercase;">Data</div>
                        <div style="font-size: 0.75rem; font-family: monospace; font-weight: 600; color: #475569;">${t.raw?.source?.contabile_date || 'N/A'}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.55rem; color: #94a3b8; text-transform: uppercase;">Importo</div>
                        <div style="font-size: 0.75rem; font-family: monospace; font-weight: 600; color: #475569;">${t.raw?.source?.amount_signed ? (t.raw.source.amount_signed > 0 ? '+' : '') + formatAmount(t.raw.source.amount_signed) : 'N/A'} €</div>
                    </div>
                 </div>

                 <div>
                    <div style="font-size: 0.55rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.1rem;">Descrizione Breve</div>
                    <div style="font-size: 0.75rem; color: #334155; font-weight: 500;">${t.raw?.source?.description || 'N/A'}</div>
                 </div>

                 <div>
                    <div style="font-size: 0.55rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.1rem;">Dettaglio Esteso</div>
                    <div style="font-family: monospace; font-size: 0.7rem; color: #475569; line-height: 1.3; white-space: pre-wrap; word-break: break-all; opacity: 0.85;">${t.description_original || t.raw?.source?.extended_description || t.raw?.description || 'N/A'}</div>
                 </div>
            </div>
            ` : ''}

        </div>
    `;
}

export function switchToEditMode() {
    document.getElementById('bt-read-only-view').style.display = 'none';
    document.getElementById('bt-edit-view').style.display = 'grid'; // Restore grid layout
    document.getElementById('bt-footer-read').style.display = 'none';
    document.getElementById('bt-footer-edit').style.display = 'flex';
    document.getElementById('bt-modal-title').textContent = 'Modifica Movimento';
}
