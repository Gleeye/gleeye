import { supabase } from '../modules/config.js?v=116';
import { state } from '../modules/state.js?v=116';
import { formatAmount } from '../modules/utils.js?v=116';

export async function renderSuppliers(container) {
    // Fetch data
    const { data: suppliers, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="error-state">Errore caricamento fornitori: ${error.message}</div>`;
        return;
    }

    // Store in state
    state.suppliers = suppliers || [];

    const activeSuppliers = suppliers.filter(s => !s.archived);
    const archivedSuppliers = suppliers.filter(s => s.archived);

    // Calculate stats
    const totalActive = activeSuppliers.length;
    const totalArchived = archivedSuppliers.length;

    const render = () => {
        const showArchived = state.suppliersShowArchived || false;
        const displaySuppliers = showArchived ? archivedSuppliers : activeSuppliers;

        return `
            <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">
                <!-- KPI PANEL -->
                <div class="bank-kpi-grid">
                    <div class="bank-kpi-card" style="border-left: 4px solid var(--brand-blue);">
                        <div class="icon-box"><span class="material-icons-round">business</span></div>
                        <div class="content">
                            <span class="label">Fornitori Attivi</span>
                            <span class="value">${totalActive}</span>
                        </div>
                    </div>
                    <div class="bank-kpi-card" style="border-left: 4px solid #f59e0b;">
                        <div class="icon-box" style="background: rgba(245, 158, 11, 0.1);"><span class="material-icons-round" style="color: #f59e0b;">inventory_2</span></div>
                        <div class="content">
                            <span class="label">Fornitori Archiviati</span>
                            <span class="value">${totalArchived}</span>
                        </div>
                    </div>
                    <div class="bank-kpi-card" style="border-left: 4px solid var(--brand-green);">
                        <div class="icon-box" style="background: rgba(34, 197, 94, 0.1);"><span class="material-icons-round" style="color: var(--brand-green);">receipt_long</span></div>
                        <div class="content">
                            <span class="label">Fatture Collegate</span>
                            <span class="value">—</span>
                        </div>
                    </div>
                </div>

                <div class="main-column">
                    <!-- HEADER -->
                    <div class="section-header" style="background: var(--card-bg); padding: 1.25rem 1.5rem; border-radius: 20px; border: 1px solid var(--glass-border); margin-bottom: 1.5rem; backdrop-filter: blur(10px);">
                        <div>
                            <h2 style="font-family: var(--font-titles); font-weight: 400; margin: 0; font-size: 1.5rem;">Fornitori</h2>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">${displaySuppliers.length} fornitori ${showArchived ? 'archiviati' : 'attivi'}</span>
                        </div>
                        <div style="display: flex; gap: 1.25rem; align-items: center;">
                            <div class="segmented-control" style="font-size: 0.8rem;">
                                <input type="radio" name="supplier-filter" value="active" id="filter-active" ${!showArchived ? 'checked' : ''} onchange="window.toggleSuppliersArchive(false)">
                                <label for="filter-active">Attivi</label>
                                <input type="radio" name="supplier-filter" value="archived" id="filter-archived" ${showArchived ? 'checked' : ''} onchange="window.toggleSuppliersArchive(true)">
                                <label for="filter-archived">Archiviati</label>
                            </div>
                            <button class="primary-btn" onclick="window.openSupplierModal()" style="border-radius: 12px; height: 42px;">
                                <span class="material-icons-round">add</span>
                                Nuovo
                            </button>
                        </div>
                    </div>

                    <!-- LIST -->
                    ${displaySuppliers.length === 0 ? `
                        <div style="text-align:center; padding: 6rem 2rem; background: var(--glass-bg); border-radius: 24px; border: 2px dashed var(--glass-border);">
                            <div style="width: 80px; height: 80px; background: rgba(78, 146, 216, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                                <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">business</span>
                            </div>
                            <h2 style="font-family: var(--font-titles); font-weight: 400; margin-bottom: 0.5rem;">Nessun fornitore</h2>
                            <p style="color: var(--text-secondary); margin-bottom: 2rem; max-width: 400px; margin-inline: auto;">Non hai ancora aggiunto fornitori ${showArchived ? 'archiviati' : 'al sistema'}.</p>
                            ${!showArchived ? `
                                <button class="primary-btn" onclick="window.openSupplierModal()">
                                    <span class="material-icons-round">add</span> Aggiungi Primo Fornitore
                                </button>
                            ` : ''}
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${displaySuppliers.map(s => `
                                <div class="transaction-row card" onclick="window.openSupplierDetail('${s.id}')" style="cursor: pointer; grid-template-columns: auto 1fr auto auto auto auto;">
                                    <div style="font-size: 2rem; color: var(--brand-blue); opacity: 0.3;">
                                        <span class="material-icons-round" style="font-size: inherit;">${s.archived ? 'inventory_2' : 'business'}</span>
                                    </div>
                                    <div style="min-width: 0;">
                                        <div style="font-weight: 400; font-size: 0.95rem; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.name}</div>
                                        <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem;">
                                            ${s.website ? `
                                                <span class="material-icons-round" style="font-size: 0.9rem; color: var(--brand-blue);">link</span>
                                                <a href="${s.website}" target="_blank" onclick="event.stopPropagation()" style="color: inherit; text-decoration: none; hover:text-decoration: underline;">${s.website}</a>
                                            ` : '<span style="color: var(--text-tertiary);">Nessun sito web</span>'}
                                        </div>
                                    </div>
                                    <div style="text-align: right; color: var(--text-tertiary); font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${s.notes || '—'}
                                    </div>
                                    <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation()">
                                        <button class="icon-btn small" onclick="window.openSupplierDetail('${s.id}')" title="Dettagli">
                                            <span class="material-icons-round">visibility</span>
                                        </button>
                                        <button class="icon-btn small" onclick="window.openSupplierModal('${s.id}')" title="Modifica">
                                            <span class="material-icons-round">edit</span>
                                        </button>
                                        <button class="icon-btn small ${s.archived ? 'success' : 'warning'}" onclick="window.toggleSupplierArchive('${s.id}', ${!s.archived})" title="${s.archived ? 'Ripristina' : 'Archivia'}">
                                            <span class="material-icons-round">${s.archived ? 'restore_from_trash' : 'archive'}</span>
                                        </button>
                                    </div>
                                    <div style="text-align: right; color: var(--text-tertiary);">
                                        <span class="material-icons-round" style="font-size: 1.25rem;">chevron_right</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    };

    container.innerHTML = render();

    // Global functions
    window.toggleSuppliersArchive = (showArchived) => {
        state.suppliersShowArchived = showArchived;
        container.innerHTML = render();
    };

    window.toggleSupplierArchive = async (id, archive) => {
        const { error } = await supabase
            .from('suppliers')
            .update({ archived: archive })
            .eq('id', id);

        if (error) {
            window.showAlert('Errore: ' + error.message, 'error');
            return;
        }

        // Reload
        const idx = state.suppliers.findIndex(s => s.id === id);
        if (idx >= 0) state.suppliers[idx].archived = archive;
        container.innerHTML = render();
    };
}

// Initialize Modals
export function initSupplierModals() {
    if (!document.getElementById('supplier-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="supplier-modal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 id="supplier-modal-title">Nuovo Fornitore</h2>
                        <button class="close-modal material-icons-round" onclick="window.closeSupplierModal()">close</button>
                    </div>
                    <form id="supplier-form">
                        <input type="hidden" id="supplier-id">
                        <div class="form-group">
                            <label>Nome *</label>
                            <input type="text" id="supplier-name" required>
                        </div>
                        <div class="form-group">
                            <label>Sito Web</label>
                            <input type="url" id="supplier-website" placeholder="https://esempio.com">
                        </div>
                        <div class="form-group">
                            <label>Note</label>
                            <textarea id="supplier-notes" rows="3"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="primary-btn secondary" onclick="window.closeSupplierModal()">Annulla</button>
                            <button type="submit" class="primary-btn">Salva</button>
                        </div>
                    </form>
                </div>
            </div>

            <div id="supplier-detail-modal" class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h2 id="detail-supplier-name">Fornitore</h2>
                        <button class="close-modal material-icons-round" onclick="window.closeSupplierDetail()">close</button>
                    </div>
                    <div class="modal-body" id="supplier-detail-content">
                        <div style="text-align: center; padding: 3rem;">
                            <span class="loader"></span>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Form Submit
        document.getElementById('supplier-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('supplier-id').value;
            const data = {
                name: document.getElementById('supplier-name').value,
                website: document.getElementById('supplier-website').value || null,
                notes: document.getElementById('supplier-notes').value || null
            };

            try {
                if (id) {
                    await supabase.from('suppliers').update(data).eq('id', id);
                } else {
                    await supabase.from('suppliers').insert(data);
                }
                window.closeSupplierModal();
                // Reload
                if (state.currentPage === 'suppliers') {
                    renderSuppliers(document.getElementById('content-area'));
                }
            } catch (err) {
                window.showAlert('Errore: ' + err.message, 'error');
            }
        });
    }

    window.closeSupplierModal = () => document.getElementById('supplier-modal').classList.remove('active');
    window.closeSupplierDetail = () => document.getElementById('supplier-detail-modal').classList.remove('active');
}

window.openSupplierModal = (id = null) => {
    const modal = document.getElementById('supplier-modal');
    const form = document.getElementById('supplier-form');
    form.reset();

    if (id) {
        const supplier = state.suppliers.find(s => s.id === id);
        if (supplier) {
            document.getElementById('supplier-modal-title').textContent = 'Modifica Fornitore';
            document.getElementById('supplier-id').value = supplier.id;
            document.getElementById('supplier-name').value = supplier.name;
            document.getElementById('supplier-website').value = supplier.website || '';
            document.getElementById('supplier-notes').value = supplier.notes || '';
        }
    } else {
        document.getElementById('supplier-modal-title').textContent = 'Nuovo Fornitore';
        document.getElementById('supplier-id').value = '';
    }

    modal.classList.add('active');
};

window.openSupplierDetail = async (id) => {
    const modal = document.getElementById('supplier-detail-modal');
    const supplier = state.suppliers.find(s => s.id === id);
    if (!supplier) return;

    document.getElementById('detail-supplier-name').textContent = supplier.name;
    modal.classList.add('active');

    // Fetch invoices
    const { data: invoices, error } = await supabase
        .from('passive_invoices')
        .select('*')
        .eq('supplier_id', id)
        .order('issue_date', { ascending: false });

    const totalAmount = (invoices || []).reduce((sum, inv) => sum + (parseFloat(inv.amount_tax_included) || 0), 0);
    const count = (invoices || []).length;

    const content = document.getElementById('supplier-detail-content');
    content.innerHTML = `
        <div class="bank-kpi-grid" style="margin-bottom: 2rem;">
            <div class="bank-kpi-card" style="border-left: 4px solid var(--brand-blue);">
                <div class="icon-box"><span class="material-icons-round">receipt_long</span></div>
                <div class="content">
                    <span class="label">Fatture Totali</span>
                    <span class="value">${count}</span>
                </div>
            </div>
            <div class="bank-kpi-card" style="border-left: 4px solid var(--brand-green);">
                <div class="icon-box" style="background: rgba(34, 197, 94, 0.1);"><span class="material-icons-round" style="color: var(--brand-green);">euro</span></div>
                <div class="content">
                    <span class="label">Importo Totale</span>
                    <span class="value">${formatAmount(totalAmount)} €</span>
                </div>
            </div>
            <div class="bank-kpi-card" style="border-left: 4px solid #f59e0b;">
                <div class="icon-box" style="background: rgba(245, 158, 11, 0.1);"><span class="material-icons-round" style="color: #f59e0b;">link</span></div>
                <div class="content">
                    <span class="label">Sito Web</span>
                    <span class="value" style="font-size: 0.9rem; font-weight: 500;">${supplier.website ? `<a href="${supplier.website}" target="_blank" style="color: var(--brand-blue);">${supplier.website}</a>` : '—'}</span>
                </div>
            </div>
        </div>

        ${supplier.notes ? `
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; margin-bottom: 2rem;">
                <h4 style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; margin: 0 0 0.5rem 0;">Note</h4>
                <p style="margin: 0;">${supplier.notes}</p>
            </div>
        ` : ''}

        <h3 style="font-family: var(--font-titles); font-weight: 400; margin: 0 0 1rem 0;">Fatture Collegate</h3>
        ${!invoices || invoices.length === 0 ? `
            <div style="text-align: center; padding: 3rem; background: var(--bg-secondary); border-radius: 12px;">
                <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">receipt_long</span>
                <p style="color: var(--text-secondary); margin-top: 1rem;">Nessuna fattura collegata</p>
            </div>
        ` : `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${invoices.map(inv => `
                    <div class="transaction-row card" style="grid-template-columns: 60px 1fr auto auto;">
                        <div style="font-size: 0.85rem; color: var(--text-secondary); text-align: center;">
                            <div style="font-weight: 400; font-size: 1.1rem; color: var(--text-primary); line-height: 1;">${inv.issue_date ? new Date(inv.issue_date).getDate() : '-'}</div>
                            <div style="font-size: 0.7rem; text-transform: uppercase;">${inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('it-IT', { month: 'short' }) : '-'}</div>
                        </div>
                        <div style="min-width: 0;">
                            <div style="font-weight: 400; font-size: 0.9rem; margin-bottom: 0.2rem;">${inv.invoice_number || 'Senza numero'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${inv.category || inv.notes || '—'}</div>
                        </div>
                        <div style="text-align: right; font-weight: 400; font-size: 1rem; color: var(--apple-red);">
                            ${formatAmount(inv.amount_tax_included || 0)} €
                        </div>
                        <div style="text-align: right;">
                            ${inv.attachment_url ? `
                                <a href="${inv.attachment_url}" target="_blank" style="color: var(--text-secondary);">
                                    <span class="material-icons-round" style="font-size: 1.1rem;">attach_file</span>
                                </a>
                            ` : '<span style="color: var(--text-tertiary);">—</span>'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `}

        <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="primary-btn secondary" onclick="window.closeSupplierDetail()">Chiudi</button>
            <button class="primary-btn" onclick="window.closeSupplierDetail(); window.openSupplierModal('${id}');">
                <span class="material-icons-round">edit</span> Modifica
            </button>
        </div>
    `;
};
