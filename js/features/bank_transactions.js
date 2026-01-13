import { state } from '../modules/state.js?v=210';
import { formatAmount } from '../modules/utils.js?v=210';
import { upsertBankTransaction, fetchBankTransactions } from '../modules/api.js?v=210';

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
                const { upsertTransactionCategory } = await import('../modules/api.js?v=209');
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
        const { deleteTransactionCategory } = await import('../modules/api.js?v=209');
        await deleteTransactionCategory(id);
        renderCategoryList();
    } catch (err) {
        window.showAlert("Errore eliminazione: " + err.message, 'error');
    }
};
