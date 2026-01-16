import { state } from '../modules/state.js?v=123';
import { formatAmount } from '../modules/utils.js?v=123';
import { upsertBankTransaction, fetchBankTransactions } from '../modules/api.js?v=123';

export function renderBankTransactions(container) {
    const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

    function getCounterpartyInfo(t) {
        if (t.clients) return { name: t.clients.business_name, icon: 'business_center', color: '#4e92d8' };
        if (t.suppliers) return { name: t.suppliers.name, icon: 'local_shipping', color: '#f59e0b' };
        if (t.collaborators) return { name: t.collaborators.full_name, icon: 'contact_page', color: '#8b5cf6' };
        return { name: t.counterparty_name || 'Altra Operazione', icon: 'payments', color: '#94a3b8' };
    }

    const render = () => {
        const availableYears = [...new Set(state.bankTransactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);

        // If no year selected, pick latest available with data, or current year
        if (!state.bankTransactionsYear) {
            state.bankTransactionsYear = availableYears.length > 0 ? availableYears[0] : new Date().getFullYear();
        }
        const year = state.bankTransactionsYear;
        const currentType = state.bankTransactionsType || 'tutti';

        // Ensure current year is in list even if empty
        if (!availableYears.includes(new Date().getFullYear())) availableYears.unshift(new Date().getFullYear());

        let movements = state.bankTransactions.filter(t => {
            const d = new Date(t.date).getFullYear();
            return d === parseInt(year);
        });

        // Filter by Type
        if (currentType !== 'tutti') {
            movements = movements.filter(t => t.type === currentType);
        }

        // Filter by Search
        if (state.searchTerm) {
            const term = state.searchTerm.toLowerCase();
            movements = movements.filter(t =>
                (t.description && t.description.toLowerCase().includes(term)) ||
                (t.clients && t.clients.business_name && t.clients.business_name.toLowerCase().includes(term)) ||
                (t.suppliers && t.suppliers.name && t.suppliers.name.toLowerCase().includes(term)) ||
                (t.collaborators && t.collaborators.full_name && t.collaborators.full_name.toLowerCase().includes(term)) ||
                (t.counterparty_name && t.counterparty_name.toLowerCase().includes(term)) ||
                (t.transaction_categories && t.transaction_categories.name && t.transaction_categories.name.toLowerCase().includes(term)) ||
                (t.amount && t.amount.toString().includes(term))
            );
        }

        // Stats for the filtered period
        const totalIn = movements.filter(t => t.type === 'entrata').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const totalOut = movements.filter(t => t.type === 'uscita').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const balance = totalIn - totalOut;

        // Category Breakdown
        const catStats = {};
        movements.forEach(t => {
            const catName = t.transaction_categories ? t.transaction_categories.name : 'In attesa di categoria';
            if (!catStats[catName]) catStats[catName] = { in: 0, out: 0, count: 0 };
            if (t.type === 'entrata') catStats[catName].in += parseFloat(t.amount);
            else catStats[catName].out += parseFloat(t.amount);
            catStats[catName].count++;
        });
        const sortedCats = Object.entries(catStats)
            .sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out))
            .slice(0, 5);

        // Grouping by Month
        const groups = {};
        movements.forEach(t => {
            const m = new Date(t.date).getMonth();
            if (!groups[m]) groups[m] = [];
            groups[m].push(t);
        });
        const sortedMonths = Object.keys(groups).sort((a, b) => b - a);

        let bodyContent = '';
        if (movements.length === 0) {
            bodyContent = `
                <div style="text-align:center; padding: 6rem 2rem; background: var(--glass-bg); border-radius: 24px; border: 2px dashed var(--glass-border);">
                    <div style="width: 80px; height: 80px; background: rgba(78, 146, 216, 0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                        <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">block</span>
                    </div>
                    <h2 style="font-family: var(--font-titles); font-weight: 400; margin-bottom: 0.5rem;">Nessuna transazione</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem; max-width: 400px; margin-inline: auto;">Non abbiamo trovato movimenti per l'anno selezionato o con i criteri di ricerca inseriti.</p>
                    <button class="primary-btn" onclick="openBankTransactionModal()">
                        <span class="material-icons-round">add</span> Aggiungi Primo Movimento
                    </button>
                     <button class="primary-btn secondary" onclick="openImportModal()" style="margin-top: 1rem;">
                        <span class="material-icons-round">upload_file</span> Importa CSV
                    </button>
                </div>
            `;
        } else {
            bodyContent = sortedMonths.map(m => {
                const monthMovements = groups[m].sort((a, b) => new Date(b.date) - new Date(a.date));
                const monthTotalIn = monthMovements.filter(t => t.type === 'entrata').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
                const monthTotalOut = monthMovements.filter(t => t.type === 'uscita').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

                return `
                    <div class="month-group">
                        <div class="month-group-header">
                            <span>${monthNames[m]} ${year}</span>
                            <div style="display: flex; gap: 1rem; margin-left: auto; font-size: 0.85rem; font-weight: 400;">
                                <span style="color: #22c55e;">+${formatAmount(monthTotalIn)} €</span>
                                <span style="color: #ef4444;">-${formatAmount(monthTotalOut)} €</span>
                            </div>
                        </div>
                        <div class="transactions-list">
                            ${monthMovements.map(t => {
                    const info = getCounterpartyInfo(t);
                    const isIncome = t.type === 'entrata';
                    const catName = t.transaction_categories ? t.transaction_categories.name : 'Altro';

                    let refHtml = '<span style="color: var(--text-tertiary); font-size: 0.75rem;">-</span>';
                    if (t.invoices) {
                        refHtml = `<span class="ref-tag blue" onclick="event.stopPropagation(); window.openInvoiceForm('${t.invoices.id}')" style="cursor:pointer">Fatt. #${t.invoices.invoice_number}</span>`;
                    } else if (t.passive_invoices) {
                        refHtml = `<span class="ref-tag orange" onclick="event.stopPropagation(); window.openPassiveInvoiceModalV2('${t.passive_invoices.id}')" style="cursor:pointer">Fatt. #${t.passive_invoices.invoice_number}</span>`;
                    } else if (t.external_ref_active_invoice) {
                        refHtml = `<span class="ref-tag">Rif #${t.external_ref_active_invoice}</span>`;
                    }

                    return `
                                    <div class="transaction-row card" onclick="openBankTransactionModal('${t.id}')" style="cursor: pointer;">
                                        <div style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; border-right: 1px solid var(--glass-border); padding-right: 1rem;">
                                            <div style="font-weight: 400; font-size: 1.1rem; color: var(--text-primary); line-height: 1;">${new Date(t.date).getDate()}</div>
                                            <div style="font-size: 0.7rem; text-transform: uppercase;">${monthNames[m].substring(0, 3)}</div>
                                        </div>
                                        <div style="min-width: 0;">
                                            <div style="font-weight: 400; font-size: 0.95rem; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.description}</div>
                                            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem;">
                                                <span class="material-icons-round" style="font-size: 0.9rem; color: ${info.color};">${info.icon}</span>
                                                ${info.name}
                                            </div>
                                        </div>
                                        <div>
                                            <span class="cat-badge ${isIncome ? 'income' : 'expense'}">
                                                <span class="material-icons-round" style="font-size: 1rem;">${isIncome ? 'add_circle_outline' : 'remove_circle_outline'}</span>
                                                ${catName}
                                            </span>
                                        </div>
                                        <div>
                                            ${refHtml}
                                        </div>
                                        <div style="text-align: right; font-weight: 400; font-size: 1.15rem; color: ${isIncome ? '#16a34a' : '#dc2626'};">
                                            ${isIncome ? '+' : '-'} ${formatAmount(t.amount)} €
                                        </div>
                                    <div style="text-align: right; color: var(--text-tertiary); display:flex; align-items:center; gap:0.5rem; justify-content:flex-end;">
                                            ${t.attachment_url ? `
                                                <a href="${t.attachment_url}" target="_blank" onclick="event.stopPropagation()" title="Vedi Allegato" style="color:var(--text-secondary); display:flex; align-items:center;">
                                                    <span class="material-icons-round" style="font-size: 1.1rem;">attach_file</span>
                                                </a>
                                            ` : ''}
                                            <span class="material-icons-round" style="font-size: 1.25rem;">chevron_right</span>
                                        </div>
                                    </div>
                                `;
                }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">
                <!-- TOP KPI PANEL -->
                <div class="bank-kpi-grid">
                    <div class="bank-kpi-card income">
                        <div class="icon-box"><span class="material-icons-round">trending_up</span></div>
                        <div class="content">
                            <span class="label">Entrate Totali</span>
                            <span class="value">${formatAmount(totalIn)} €</span>
                        </div>
                    </div>
                    <div class="bank-kpi-card expense">
                        <div class="icon-box"><span class="material-icons-round">trending_down</span></div>
                        <div class="content">
                            <span class="label">Uscite Totali</span>
                            <span class="value">${formatAmount(totalOut)} €</span>
                        </div>
                    </div>
                    <div class="bank-kpi-card balance">
                        <div class="icon-box"><span class="material-icons-round">account_balance_wallet</span></div>
                        <div class="content">
                            <span class="label">Saldo Periodo</span>
                            <span class="value" style="color: ${balance >= 0 ? '#16a34a' : '#dc2626'}">${formatAmount(balance)} €</span>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 350px; gap: 2rem; align-items: start;">
                    <!-- MAIN LIST -->
                    <div class="main-column">
                        <div class="section-header" style="background: var(--card-bg); padding: 1.25rem 1.5rem; border-radius: 20px; border: 1px solid var(--glass-border); margin-bottom: 1.5rem; backdrop-filter: blur(10px);">
                            <div>
                                <h2 style="font-family: var(--font-titles); font-weight: 400; margin: 0; font-size: 1.5rem;">Registro Movimenti</h2>
                                <span style="font-size: 0.85rem; color: var(--text-secondary);">${movements.length} operazioni nel ${year}</span>
                            </div>
                            <div style="display: flex; gap: 1.25rem; align-items: center;">
                                <div class="segmented-control" style="font-size: 0.8rem;">
                                    <input type="radio" name="page-filter-type" value="tutti" id="filter-all" ${currentType === 'tutti' ? 'checked' : ''} onchange="window.setBankTransactionsType('tutti')">
                                    <label for="filter-all">Tutti</label>
                                    <input type="radio" name="page-filter-type" value="entrata" id="filter-in" ${currentType === 'entrata' ? 'checked' : ''} onchange="window.setBankTransactionsType('entrata')">
                                    <label for="filter-in">Entrate</label>
                                    <input type="radio" name="page-filter-type" value="uscita" id="filter-out" ${currentType === 'uscita' ? 'checked' : ''} onchange="window.setBankTransactionsType('uscita')">
                                    <label for="filter-out">Uscite</label>
                                </div>
                                <div class="year-selector" style="display:flex; background: rgba(0,0,0,0.03); padding: 0.25rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                                    ${availableYears.map(y => `
                                        <button class="pill-filter ${y == year ? 'active' : ''}" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 400;" onclick="window.setBankTransactionsYear(${y})">${y}</button>
                                    `).join('')}
                                </div>
                                <button class="primary-btn secondary" onclick="openImportModal()" style="border-radius: 12px; height: 42px; display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="material-icons-round">upload_file</span>
                                    <span>Importa</span>
                                </button>
                                <button class="primary-btn" onclick="openBankTransactionModal()" style="border-radius: 12px; height: 42px;">
                                    <span class="material-icons-round">add</span>
                                </button>
                            </div>
                        </div>
                        ${bodyContent}
                    </div>

                    <!-- SIDE ANALYTICS -->
                    <div class="side-column" style="position: sticky; top: 1.5rem;">
                        <div class="card analytics-card">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                                <h3 style="font-family: var(--font-titles); font-weight: 400; font-size: 1.1rem; display: flex; align-items: center; gap: 0.75rem; margin:0;">
                                    <span class="material-icons-round" style="color: var(--brand-blue);">pie_chart</span>
                                    Analisi Uscite
                                </h3>
                                <button class="icon-btn small" onclick="openCategoryManager()" title="Gestisci Categorie" style="width:28px; height:28px;">
                                    <span class="material-icons-round" style="font-size:1.1rem;">settings</span>
                                </button>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                                ${(() => {
                // Filter for expenses only
                const expenseMovements = movements.filter(t => t.type === 'uscita');
                const expenseTotal = expenseMovements.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

                if (expenseTotal === 0) return '<div style="text-align:center; color:var(--text-tertiary); font-size:0.85rem;">Nessuna uscita registrata.</div>';

                const expStats = {};
                expenseMovements.forEach(t => {
                    const catName = t.transaction_categories ? t.transaction_categories.name : 'Altro';
                    if (!expStats[catName]) expStats[catName] = 0;
                    expStats[catName] += parseFloat(t.amount);
                });

                return Object.entries(expStats)
                    .sort((a, b) => b[1] - a[1]) // Sort by amount desc
                    .slice(0, 6) // Top 6
                    .map(([name, val]) => {
                        const percentage = (val / expenseTotal * 100).toFixed(0);
                        return `
                                                <div>
                                                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.5rem;">
                                                        <span style="font-weight: 500; color: var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;">${name}</span>
                                                        <span style="font-weight: 400;">${formatAmount(val)} €</span>
                                                    </div>
                                                    <div class="analytics-bar-bg">
                                                        <div class="analytics-bar-fill" style="width: ${percentage}%; background: var(--apple-red);"></div>
                                                    </div>
                                                </div>
                                            `;
                    }).join('');
            })()}
                            </div>
                            
                            <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--glass-border);">
                                <button class="primary-btn secondary full-width" onclick="openCategoryManager()">
                                    Gestisci Categorie
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    container.innerHTML = render();

    window.setBankTransactionsYear = (y) => {
        state.bankTransactionsYear = y;
        container.innerHTML = render();
    };

    window.setBankTransactionsType = (type) => {
        state.bankTransactionsType = type;
        container.innerHTML = render();
    };
}

export function initBankTransactionModals() {
    if (!document.getElementById('bank-transaction-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="bank-transaction-modal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 id="bt-modal-title">Nuovo Movimento</h2>
                        <button class="close-modal material-icons-round" onclick="closeBankTransactionModal()">close</button>
                    </div>
                    <form id="bank-transaction-form">
                        <input type="hidden" id="bt-id">
                        
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label>Tipo Movimento</label>
                                <div class="segmented-control">
                                    <input type="radio" name="bt-type" value="entrata" id="bt-type-in" checked>
                                    <label for="bt-type-in">Entrata</label>
                                    <input type="radio" name="bt-type" value="uscita" id="bt-type-out">
                                    <label for="bt-type-out">Uscita</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Data *</label>
                                <input type="date" id="bt-date" required>
                            </div>
                            <div class="form-group">
                                <label>Importo (€) *</label>
                                <input type="number" id="bt-amount" step="0.01" required>
                            </div>

                            <div class="form-group full-width">
                                <label>Descrizione *</label>
                                <input type="text" id="bt-description" required>
                            </div>

                            <div class="form-group full-width">
                                <label>Categoria *</label>
                                <select id="bt-category" required>
                                    <option value="">Seleziona...</option>
                                    <!-- Options injected via JS -->
                                </select>
                            </div>

                            <div class="form-group full-width" id="bt-client-group">
                                <label>Cliente</label>
                                <select id="bt-client">
                                    <option value="">Nessun cliente...</option>
                                    ${state.clients.map(c => `<option value="${c.id}">${c.business_name}</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group full-width" id="bt-supplier-group" style="display:none;">
                                <label>Fornitore / Collaboratore</label>
                                <select id="bt-supplier">
                                    <option value="">Nessun fornitore...</option>
                                    <optgroup label="Fornitori">
                                        ${state.suppliers.map(s => `<option value="S_${s.id}">${s.name}</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="Collaboratori">
                                        ${state.collaborators.map(c => `<option value="C_${c.id}">${c.full_name}</option>`).join('')}
                                    </optgroup>
                                </select>
                            </div>

                            <div class="form-group full-width" id="bt-invoice-group" style="display:none;">
                                <label>Collega a Fattura</label>
                                <select id="bt-invoice">
                                    <option value="">Nessuna fattura...</option>
                                    <!-- Options filtered by client/supplier -->
                                </select>
                            </div>

                            <div class="form-group full-width">
                                <label>Controparte Libera (Fallback)</label>
                                <input type="text" id="bt-counterparty" placeholder="Nome azienda generica">
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="primary-btn secondary" onclick="closeBankTransactionModal()">Annulla</button>
                            <button type="submit" class="primary-btn">Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        `);

        // Close Logic
        window.closeBankTransactionModal = () => document.getElementById('bank-transaction-modal').classList.remove('active');

        // Logic for filtering Invoice options
        const updateInvoiceOptions = () => {
            const type = document.querySelector('input[name="bt-type"]:checked').value;
            const invoiceSelect = document.getElementById('bt-invoice');
            invoiceSelect.innerHTML = '<option value="">Nessuna fattura...</option>';

            if (type === 'entrata') {
                const clientId = document.getElementById('bt-client').value;
                if (clientId) {
                    const filtered = state.invoices.filter(i => i.client_id == clientId);
                    filtered.forEach(i => {
                        const opt = document.createElement('option');
                        opt.value = i.id;
                        opt.textContent = `Fattura #${i.invoice_number} (${formatAmount(i.amount_tax_included)} €)`;
                        invoiceSelect.appendChild(opt);
                    });
                }
            } else {
                const supplierVal = document.getElementById('bt-supplier').value;
                if (supplierVal) {
                    const [sType, sId] = supplierVal.split('_');
                    const filtered = state.passiveInvoices.filter(i => {
                        if (sType === 'S') return i.supplier_id == sId;
                        if (sType === 'C') return i.collaborator_id == sId;
                        return false;
                    });
                    filtered.forEach(i => {
                        const opt = document.createElement('option');
                        opt.value = i.id;
                        opt.textContent = `Fattura #${i.invoice_number} (${formatAmount(i.amount_tax_included)} €)`;
                        invoiceSelect.appendChild(opt);
                    });
                }
            }
        };

        const btTypeInputs = document.querySelectorAll('input[name="bt-type"]');
        btTypeInputs.forEach(input => {
            input.addEventListener('change', () => {
                window.updateCategoryOptions();
                updateInvoiceOptions();
            });
        });

        document.getElementById('bt-client').addEventListener('change', updateInvoiceOptions);
        document.getElementById('bt-supplier').addEventListener('change', updateInvoiceOptions);

        // Submit Logic
        document.getElementById('bank-transaction-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.querySelector('input[name="bt-type"]:checked').value;
            const supplierVal = document.getElementById('bt-supplier').value;
            const [sType, sId] = supplierVal ? supplierVal.split('_') : [null, null];

            const formData = {
                id: document.getElementById('bt-id').value || undefined,
                date: document.getElementById('bt-date').value,
                amount: parseFloat(document.getElementById('bt-amount').value),
                description: document.getElementById('bt-description').value,
                type: type,
                category_id: document.getElementById('bt-category').value,
                counterparty_name: document.getElementById('bt-counterparty').value,
                client_id: type === 'entrata' ? (document.getElementById('bt-client').value || null) : null,
                supplier_id: (type === 'uscita' && sType === 'S') ? sId : null,
                collaborator_id: (type === 'uscita' && sType === 'C') ? sId : null,
                active_invoice_id: type === 'entrata' ? (document.getElementById('bt-invoice').value || null) : null,
                passive_invoice_id: type === 'uscita' ? (document.getElementById('bt-invoice').value || null) : null
            };

            try {
                await upsertBankTransaction(formData);
                closeBankTransactionModal();
                if (state.currentPage === 'bank-transactions') {
                    renderBankTransactions(document.getElementById('content-area'));
                }
            } catch (err) {
                showAlert('Errore: ' + err.message, 'error');
            }
        });
    }
}

window.openBankTransactionModal = (id = null) => {
    const modal = document.getElementById('bank-transaction-modal');
    if (modal) {
        modal.classList.add('active');
        const form = document.getElementById('bank-transaction-form');
        form.reset();

        // Populate Categories
        window.updateCategoryOptions = () => {
            const typeValue = document.querySelector('input[name="bt-type"]:checked').value;
            const select = document.getElementById('bt-category');
            select.innerHTML = '<option value="">Seleziona...</option>';

            const cats = state.transactionCategories.filter(c => c.type === typeValue || c.type === 'altro');

            // Check for potential subcategories (parent_id)
            const parents = cats.filter(c => !c.parent_id);
            const children = cats.filter(c => c.parent_id);

            parents.forEach(p => {
                const group = document.createElement('optgroup');
                group.label = p.name;

                const pOpt = document.createElement('option');
                pOpt.value = p.id;
                pOpt.textContent = p.name;
                select.appendChild(pOpt);

                const myChildren = children.filter(c => c.parent_id === p.id);
                myChildren.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = `— ${c.name}`;
                    select.appendChild(opt);
                });
            });

            // If no parent-child found, just list all
            if (parents.length === 0 && cats.length > 0) {
                cats.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    select.appendChild(opt);
                });
            }

            // Toggle visibility of entity selects
            document.getElementById('bt-client-group').style.display = typeValue === 'entrata' ? 'block' : 'none';
            document.getElementById('bt-supplier-group').style.display = typeValue === 'uscita' ? 'block' : 'none';
            document.getElementById('bt-invoice-group').style.display = 'block';
        };

        updateCategoryOptions();

        if (id) {
            document.getElementById('bt-modal-title').textContent = 'Modifica Movimento';
            const t = state.bankTransactions.find(x => x.id == id);
            if (t) {
                document.getElementById('bt-id').value = t.id;
                document.getElementById('bt-date').value = t.date;
                document.getElementById('bt-amount').value = t.amount;
                document.getElementById('bt-description').value = t.description;
                document.getElementById('bt-counterparty').value = t.counterparty_name || '';

                if (t.type === 'entrata') document.getElementById('bt-type-in').checked = true;
                else document.getElementById('bt-type-out').checked = true;

                updateCategoryOptions();
                document.getElementById('bt-category').value = t.category_id || '';

                if (t.type === 'entrata') {
                    document.getElementById('bt-client').value = t.client_id || '';
                } else {
                    if (t.supplier_id) document.getElementById('bt-supplier').value = `S_${t.supplier_id}`;
                    else if (t.collaborator_id) document.getElementById('bt-supplier').value = `C_${t.collaborator_id}`;
                }

                document.getElementById(t.type === 'entrata' ? 'bt-client' : 'bt-supplier').dispatchEvent(new Event('change'));
                document.getElementById('bt-invoice').value = t.active_invoice_id || t.passive_invoice_id || '';
            }
        } else {
            document.getElementById('bt-modal-title').textContent = 'Nuovo Movimento';
            document.getElementById('bt-id').value = '';
            document.getElementById('bt-date').value = new Date().toISOString().split('T')[0];
        }
    }
};


// --- CATEGORY MANAGER ---

export function initCategoryManagerModal() {
    if (!document.getElementById('category-manager-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="category-manager-modal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Gestione Categorie Uscite</h2>
                        <button class="close-modal material-icons-round" onclick="document.getElementById('category-manager-modal').classList.remove('active')">close</button>
                    </div>
                    <div class="modal-body">
                        <div id="cat-manager-list" style="margin-bottom: 1.5rem; max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
                            <!-- List injected via JS -->
                        </div>
                        
                        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px;">
                            <h4 style="margin: 0 0 0.8rem 0; font-size: 0.95rem;">Nuova Categoria</h4>
                            <form id="new-category-form" style="display: flex; gap: 0.5rem;">
                                <input type="text" id="new-cat-name" placeholder="Nome categoria..." required style="flex: 1;">
                                <select id="new-cat-parent" style="width: 140px;">
                                    <option value="">Principale</option>
                                    <!-- Parent options -->
                                </select>
                                <button type="submit" class="primary-btn small">
                                    <span class="material-icons-round">add</span>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Handle Add
        document.getElementById('new-category-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-cat-name');
            const parentSelect = document.getElementById('new-cat-parent');

            const newCat = {
                name: nameInput.value,
                type: 'uscita', // Only managing expenses for now as requested
                parent_id: parentSelect.value || null
            };

            try {
                // Import dynamically to avoid circular dependencies if any
                const { upsertTransactionCategory } = await import('../modules/api.js?v=123');
                await upsertTransactionCategory(newCat);

                nameInput.value = '';
                renderCategoryList();
                // Refresh main view too to update dropdowns if needed?
                // window.updateCategoryOptions() will be called next time modal opens
            } catch (err) {
                showAlert("Errore creazione categoria: " + err.message, 'error');
            }
        });
    }
}

window.openCategoryManager = () => {
    initCategoryManagerModal();
    const modal = document.getElementById('category-manager-modal');
    modal.classList.add('active');
    renderCategoryList();
};

function renderCategoryList() {
    const list = document.getElementById('cat-manager-list');
    const parentSelect = document.getElementById('new-cat-parent');

    // Filter only expense categories
    const cats = state.transactionCategories.filter(c => c.type === 'uscita');
    const parents = cats.filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));

    // Populate Select
    parentSelect.innerHTML = '<option value="">Principale</option>';
    parents.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        parentSelect.appendChild(opt);
    });

    // Populate List
    list.innerHTML = parents.map(p => {
        const children = cats.filter(c => c.parent_id === p.id).sort((a, b) => a.name.localeCompare(b.name));
        return `
            <div class="cat-item-row" style="background: white; border: 1px solid var(--glass-border); border-radius: 8px; overflow: hidden;">
                <div style="padding: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 400;">${p.name}</span>
                    <button class="icon-btn small danger" onclick="deleteCategory('${p.id}')"><span class="material-icons-round">delete</span></button>
                </div>
                ${children.map(c => `
                    <div style="padding: 0.5rem 0.75rem 0.5rem 2rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; background: #fafafa; font-size: 0.9rem;">
                        <span>${c.name}</span>
                        <button class="icon-btn small danger" onclick="deleteCategory('${c.id}')"><span class="material-icons-round" style="font-size: 1rem;">delete</span></button>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

window.deleteCategory = async (id) => {
    if (!await window.showConfirm("Sei sicuro? Eliminando questa categoria potresti perdere il riferimento nelle transazioni esistenti.", { type: 'danger' })) return;
    try {
        const { deleteTransactionCategory } = await import('../modules/api.js?v=123');
        await deleteTransactionCategory(id);
        renderCategoryList();
    } catch (err) {
        window.showAlert("Errore eliminazione: " + err.message, 'error');
    }
};

// --- IMPORT FUNCTIONALITY ---

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.some(cell => cell)) rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    return rows;
}

export function initImportModal() {
    if (document.getElementById('import-transactions-modal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="import-transactions-modal" class="modal">
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h2>Importa Movimenti</h2>
                    <button class="close-modal material-icons-round" onclick="document.getElementById('import-transactions-modal').classList.remove('active')">close</button>
                </div>
                
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding-bottom: 0;">
                    <!-- STEP 1: UPLOAD -->
                    <div id="import-step-upload" style="text-align: center; padding: 3rem 1rem;">
                        <input type="file" id="import-file-input" accept=".csv, .xlsx, .xls" style="display: none;">
                        <div style="margin-bottom: 2rem;">
                            <span class="material-icons-round" style="font-size: 4rem; color: var(--text-tertiary);">upload_file</span>
                            <h3 style="margin: 1rem 0 0.5rem; font-family: var(--font-titles);">Carica Excel o CSV</h3>
                            <p style="color: var(--text-secondary);">Seleziona il file (.xlsx, .xls) dei movimenti (es. export banca)</p>
                        </div>
                        <button class="primary-btn" onclick="document.getElementById('import-file-input').click()">
                            Scegli File
                        </button>
                    </div>

                    <!-- STEP 2: REVIEW -->
                    <div id="import-step-review" style="display: none;">
                        <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                            <p style="margin: 0; color: var(--text-secondary);">Rivedi e conferma le transazioni prima di importarle.</p>
                            <span id="import-stats" style="font-size: 0.85rem; font-weight: 500;"></span>
                        </div>

                        <div class="table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 12px;">
                            <table class="data-table" style="font-size: 0.85rem;">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;">
                                            <input type="checkbox" id="import-check-all" checked onchange="toggleImportAll(this)">
                                        </th>
                                        <th style="width: 100px;">Data</th>
                                        <th>Descrizione</th>
                                        <th style="width: 100px;">Importo</th>
                                        <th style="width: 150px;">Categoria (Suggerita)</th>
                                        <th style="width: 150px;">Controparte</th>
                                        <th style="width: 40px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="import-table-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="modal-footer" id="import-footer" style="padding: 1rem; border-top: 1px solid var(--glass-border); display: none; justify-content: flex-end; gap: 1rem;">
                    <button class="primary-btn secondary" onclick="resetImport()">Indietro</button>
                    <button class="primary-btn" onclick="confirmImport()">
                        Conferma Importazione (<span id="import-count-btn">0</span>)
                    </button>
                </div>
            </div>
        </div>
    `);

    // File Input Handler
    document.getElementById('import-file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (file.name.toLowerCase().endsWith('.csv')) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const csvData = parseCSV(evt.target.result);
                    analyzeAndRenderImport(csvData);
                };
                reader.readAsText(file);
            } else {
                // EXCEL Handling
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Get raw values (header: 1 returns array of arrays)
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
                analyzeAndRenderImport(rows);
            }
        } catch (err) {
            console.error(err);
            window.showAlert("Errore lettura file: " + err.message, 'error');
        }
    });
}

let pendingImportRows = [];

function analyzeAndRenderImport(rows) {
    if (!rows || rows.length < 2) {
        window.showAlert("Il file sembra vuoto o non valido.", 'error');
        return;
    }

    console.log('[Import] Rows received:', rows.length, rows.slice(0, 3));

    // Find headers row: look for a row that has SEPARATE cells containing 'data' and 'descrizione' (or 'importo'/'prezzo')
    const headerRowIndex = rows.findIndex(r => {
        if (!r || !Array.isArray(r)) return false;
        const lowerCells = r.map(c => (c || '').toString().toLowerCase().trim());
        const hasData = lowerCells.some(c => c === 'data' || c.includes('data'));
        const hasDesc = lowerCells.some(c => c === 'descrizione' || c.includes('descrizione') || c.includes('causale'));
        return hasData && hasDesc;
    });

    console.log('[Import] Header row index:', headerRowIndex);

    if (headerRowIndex === -1) {
        window.showAlert("Impossibile trovare l'intestazione. Assicurati che il file contenga colonne 'Data' e 'Descrizione'.", 'error');
        return;
    }

    const headers = rows[headerRowIndex].map(h => h.toLowerCase().trim());
    const idxDate = headers.indexOf('data');
    const idxType = headers.indexOf('tipo movimento');
    const idxCounterparty = headers.indexOf('azienda');
    const idxDesc = headers.indexOf('descrizione');
    const idxAmount = headers.indexOf('prezzo');
    const idxCat = headers.indexOf('tipo uscita'); // User's custom category column

    const dataRows = rows.slice(headerRowIndex + 1);
    pendingImportRows = [];

    dataRows.forEach((row, i) => {
        if (!row[idxDate] && !row[idxDesc]) return;

        // Parse Amount
        let amountStr = row[idxAmount] || '0';
        amountStr = amountStr.replace(/[€\s]/g, '').replace('.', '').replace(',', '.').trim();
        const amount = parseFloat(amountStr) || 0;

        // Parse Date (DD/MM/YYYY)
        const dateParts = (row[idxDate] || '').split('/');
        let isoDate = new Date().toISOString().split('T')[0];
        if (dateParts.length === 3) {
            isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        }

        // Parse Type
        let type = 'uscita';
        const typeRaw = (row[idxType] || '').toLowerCase();
        if (typeRaw.includes('entrata')) type = 'entrata';

        // Suggest Category
        let suggestedCatId = '';
        const catRaw = (row[idxCat] || '').toLowerCase();
        // Exact/Partial match on name
        const matchCat = state.transactionCategories.find(c => c.name.toLowerCase() === catRaw || (catRaw && c.name.toLowerCase().includes(catRaw)));
        if (matchCat) suggestedCatId = matchCat.id;

        // Suggest Counterparty
        let suggestedCounterparty = row[idxCounterparty] || '';
        let clientId = null;
        let supplierId = null;
        let collaboratorId = null;

        // Try to match with DB entities
        if (suggestedCounterparty) {
            const cleanName = suggestedCounterparty.toLowerCase();
            const client = state.clients.find(c => c.business_name.toLowerCase().includes(cleanName));
            if (client) {
                clientId = client.id;
                type = 'entrata'; // Force entrata if client found? Maybe check type first.
            } else {
                const supplier = state.suppliers.find(s => s.name.toLowerCase().includes(cleanName));
                if (supplier) {
                    supplierId = supplier.id;
                } else {
                    const collab = state.collaborators.find(c => c.full_name.toLowerCase().includes(cleanName));
                    if (collab) {
                        collaboratorId = collab.id;
                    }
                }
            }
        }

        pendingImportRows.push({
            _id: i,
            date: isoDate,
            description: row[idxDesc] || '',
            amount: amount,
            type: type,
            category_id: suggestedCatId,
            counterparty_name: suggestedCounterparty,
            client_id: clientId,
            supplier_id: supplierId,
            collaborator_id: collaboratorId,
            selected: true
        });
    });

    renderImportTable();

    document.getElementById('import-step-upload').style.display = 'none';
    document.getElementById('import-step-review').style.display = 'block';
    document.getElementById('import-footer').style.display = 'flex';
}

function renderImportTable() {
    const tbody = document.getElementById('import-table-body');
    tbody.innerHTML = pendingImportRows.map(row => `
        <tr class="${!row.selected ? 'opacity-50' : ''}">
            <td>
                <input type="checkbox" onchange="toggleImportRow(${row._id})" ${row.selected ? 'checked' : ''}>
            </td>
            <td>
                <input type="date" value="${row.date}" onchange="updateImportRow(${row._id}, 'date', this.value)" style="width:100%; border:none; background:transparent;">
            </td>
            <td>
                <input type="text" value="${row.description.replace(/"/g, '&quot;')}" onchange="updateImportRow(${row._id}, 'description', this.value)" style="width:100%; border:none; background:transparent;">
            </td>
            <td>
                <input type="number" step="0.01" value="${row.amount}" onchange="updateImportRow(${row._id}, 'amount', parseFloat(this.value))" style="width:100%; border:none; background:transparent;">
            </td>
            <td>
                <select onchange="updateImportRow(${row._id}, 'category_id', this.value)" style="width:100%; border:none; background:transparent;">
                    <option value="">Seleziona...</option>
                    ${state.transactionCategories.map(c => `<option value="${c.id}" ${c.id == row.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </td>
            <td>
                <input type="text" value="${row.counterparty_name.replace(/"/g, '&quot;')}" onchange="updateImportRow(${row._id}, 'counterparty_name', this.value)" placeholder="Libera..." style="width:100%; border:none; background:transparent;">
            </td>
            <td>
                <button class="icon-btn small danger" onclick="removeImportRow(${row._id})"><span class="material-icons-round">close</span></button>
            </td>
        </tr>
    `).join('');

    const count = pendingImportRows.filter(r => r.selected).length;
    document.getElementById('import-count-btn').textContent = count;
    document.getElementById('import-stats').textContent = `${count} di ${pendingImportRows.length} righe selezionate`;
}

window.toggleImportAll = (checkbox) => {
    const val = checkbox.checked;
    pendingImportRows.forEach(r => r.selected = val);
    renderImportTable();
};

window.toggleImportRow = (id) => {
    const row = pendingImportRows.find(r => r._id === id);
    if (row) {
        row.selected = !row.selected;
        renderImportTable();
    }
};

window.updateImportRow = (id, field, value) => {
    const row = pendingImportRows.find(r => r._id === id);
    if (row) row[field] = value;
};

window.removeImportRow = (id) => {
    pendingImportRows = pendingImportRows.filter(r => r._id !== id);
    renderImportTable();
};

window.resetImport = () => {
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-step-upload').style.display = 'block';
    document.getElementById('import-step-review').style.display = 'none';
    document.getElementById('import-footer').style.display = 'none';
    pendingImportRows = [];
};

window.confirmImport = async () => {
    const toImport = pendingImportRows.filter(r => r.selected);
    if (toImport.length === 0) return;

    if (!confirm(`Confermi l'importazione di ${toImport.length} movimenti?`)) return;

    try {
        const { upsertBankTransaction } = await import('../modules/api.js?v=123');
        let successCount = 0;

        // Sequential import to avoid overwhelming DB/network
        for (const row of toImport) {
            const payload = {
                date: row.date,
                amount: row.amount,
                description: row.description,
                type: row.type,
                category_id: row.category_id || null,
                counterparty_name: row.counterparty_name,
                client_id: row.client_id,
                supplier_id: row.supplier_id,
                collaborator_id: row.collaborator_id
            };
            await upsertBankTransaction(payload);
            successCount++;
        }

        window.showAlert(`Importati ${successCount} movimenti con successo!`);
        document.getElementById('import-transactions-modal').classList.remove('active');
        if (state.currentPage === 'bank-transactions') {
            const { renderBankTransactions } = await import('../features/bank_transactions.js?v=123');
            renderBankTransactions(document.getElementById('content-area'));
        }
    } catch (err) {
        window.showAlert("Errore durante l'importazione: " + err.message, 'error');
    }
};

window.openImportModal = () => {
    initImportModal();
    document.getElementById('import-transactions-modal').classList.add('active');
    resetImport();
};
