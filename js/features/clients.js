import { state } from '../modules/state.js?v=157';
import { formatAmount } from '../modules/utils.js?v=157';
// Import dependencies similar to collaborators.js
// We assume fetch functions are available in api.js if needed, but we rely on state mostly
import { fetchOrders, fetchInvoices, fetchPayments } from '../modules/api.js?v=157';

export function renderClients(container) {
    const filteredClients = state.clients.filter(c =>
        (c.business_name || '').toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        (c.client_code || '').toLowerCase().includes(state.searchTerm.toLowerCase())
    );

    const clientsHTML = filteredClients.length > 0 ? filteredClients.map(client => `
        <tr class="clickable-row" data-id="${client.id}" onclick="window.location.hash='client-detail/${client.id}'" style="cursor: pointer; transition: background 0.2s;">
            <td><span style="font-family: monospace; font-size: 0.9rem; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">${client.client_code || '-'}</span></td>
            <td style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${client.business_name}</td>
            <td>${client.city || '-'}</td>
            <td>${client.email || '-'}</td>
            <td>${client.phone || '-'}</td>
             <td style="text-align: right;">
                <button class="icon-btn" style="width: 32px; height: 32px;" title="Modifica (WIP)">
                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">edit</span>
                </button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center; padding: 3rem; opacity: 0.5;">Nessun cliente trovato.</td></tr>';

    container.innerHTML = `
        <div class="animate-fade-in">
            <div class="table-container">
                <div class="section-header" style="margin-bottom: 1.5rem;">
                    <div>
                        <span style="font-size: 1.25rem; font-weight: 600; color: var(--text-primary);">Anagrafica Clienti</span>
                        <span style="font-size: 0.9rem; color: var(--text-tertiary); margin-left: 0.5rem; font-weight: 400;">(${filteredClients.length} totali)</span>
                    </div>
                    <button class="primary-btn small" onclick="window.showAlert('Funzionalità nuovo cliente in arrivo...', 'info')" style="gap: 0.5rem;">
                        <span class="material-icons-round">add</span> Nuovo Cliente
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 100px;">Codice</th>
                            <th>Ragione Sociale</th>
                            <th>Città</th>
                            <th>Email</th>
                            <th>Telefono</th>
                            <th style="width: 60px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clientsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function renderClientDetail(container) {
    const id = state.currentId;
    const client = state.clients.find(c => c.id == id);

    if (!client) {
        container.innerHTML = '<div style="padding:2rem; text-align:center;">Cliente non trovato</div>';
        return;
    }

    // Ensure state data is loaded
    if ((!state.payments || state.payments.length === 0) && typeof fetchPayments !== 'undefined') {
        fetchPayments().then(() => renderClientDetail(container));
        return; // Rerender after fetch
    }

    // Filter Data
    const clientOrders = state.orders ? state.orders.filter(o => o.client_id === client.id) : [];
    const clientInvoices = state.invoices ? state.invoices.filter(i => i.client_id === client.id) : []; // Active invoices
    const clientPayments = state.payments ? state.payments.filter(p => p.payment_type === 'Cliente' && p.client_id === client.id) : [];

    // Calculate KPI
    const totalInvoiced = clientInvoices.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const totalPaid = clientPayments.filter(p => p.status === 'Done' || p.status === 'Saldato').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalDue = totalInvoiced - totalPaid; // Approximate logic

    container.innerHTML = `
        <div class="animate-fade-in">
            <button class="btn-link" onclick="window.location.hash='sales'" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); padding: 0;">
                <span class="material-icons-round">arrow_back</span> Torna alla lista
            </button>

            <!-- Header Profile -->
            <div class="glass-card" style="padding: 2.5rem; display: flex; gap: 2.5rem; align-items: flex-start; margin-bottom: 2rem;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                    <div style="width: 120px; height: 120px; border-radius: 50%; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem; font-weight: 400; box-shadow: var(--shadow-premium);">
                        ${client.business_name ? client.business_name[0].toUpperCase() : 'C'}
                    </div>
                     <!-- Code Badge -->
                    ${client.client_code ? `<span style="font-size: 0.85rem; color: var(--text-tertiary); font-family: monospace; letter-spacing: 1px; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 4px;">${client.client_code}</span>` : ''}
                </div>
                
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h1 style="margin: 0 0 0.5rem 0; font-size: 2.2rem; letter-spacing: -0.5px; color: var(--text-primary);">${client.business_name}</h1>
                            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem;">
                                <span style="font-size: 1rem; color: var(--brand-blue); font-weight: 400;">Cliente</span>
                                <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--text-tertiary);"></div>
                                <span style="font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 10px; border-radius: 12px;">${client.city || 'N/A'}</span>
                            </div>
                        </div>
                        
                        <button class="icon-btn" style="background: var(--bg-secondary); width: 42px; height: 42px;" onclick="window.showAlert('Modifica cliente in arrivo...', 'info')" title="Modifica">
                            <span class="material-icons-round" style="color: var(--text-primary);">edit</span>
                        </button>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--glass-border);">
                        <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">CONTATTI</span>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <a href="mailto:${client.email}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">email</span>
                                    ${client.email || '-'}
                                </a>
                                <a href="tel:${client.phone}" style="display: flex; gap: 0.6rem; align-items: center; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">call</span>
                                    ${client.phone || '-'}
                                </a>
                            </div>
                        </div>
                        
                         <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">INDIRIZZO</span>
                            <div style="display: flex; gap: 0.6rem; align-items: flex-start; color: var(--text-primary); font-weight: 500;">
                                <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary); margin-top: 1px;">place</span>
                                <span>${client.address || '-'}</span>
                            </div>
                        </div>

                        <div>
                            <span style="display: block; font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary); margin-bottom: 0.4rem; letter-spacing: 0.5px;">DATI FISCALI</span>
                            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                                <div style="display:flex; justify-content: space-between;">
                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">P.IVA</span>
                                    <span style="font-family: monospace; font-size: 0.9rem;">${client.vat_number || '-'}</span>
                                </div>
                                <div style="display:flex; justify-content: space-between;">
                                    <span style="color: var(--text-secondary); font-size: 0.85rem;">SDI/PEC</span>
                                    <span style="font-family: monospace; font-size: 0.9rem;">${client.sdi_code || client.pec || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs Controls -->
            <div class="tabs-container" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1.5rem;">
                <button class="tab-btn active" data-tab="overview" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 400; cursor: pointer;">Panoramica</button>
                <button class="tab-btn" data-tab="orders" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Commesse (${clientOrders.length})</button>
                <button class="tab-btn" data-tab="invoices" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Fatture (${clientInvoices.length})</button>
                <button class="tab-btn" data-tab="payments" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">Pagamenti (${clientPayments.length})</button>
            </div>

            <!-- Tab Content: Overview -->
            <div id="tab-overview" class="tab-content">
                <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 2rem;">
                    <div class="stats-card">
                        <div class="stats-header"><span>Totale Fatturato</span></div>
                        <div class="stats-value">€ ${formatAmount(totalInvoiced)}</div>
                        <div class="stats-trend">Imponibile</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-header"><span>Incassato</span></div>
                        <div class="stats-value">€ ${formatAmount(totalPaid)}</div>
                        <div class="stats-trend trend-up">Totale</div>
                    </div>
                     <div class="stats-card">
                        <div class="stats-header"><span>Da Incassare</span></div>
                        <div class="stats-value">€ ${formatAmount(totalDue)}</div>
                        <div class="stats-trend trend-down">Residuo</div>
                    </div>
                     <div class="stats-card">
                        <div class="stats-header"><span>Commesse</span></div>
                        <div class="stats-value">${clientOrders.length}</div>
                        <div class="stats-trend">Totali</div>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Orders -->
            <div id="tab-orders" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead><tr><th>N. Ordine</th><th>Data</th><th>Titolo</th><th>Stato</th></tr></thead>
                        <tbody>
                            ${clientOrders.length ? clientOrders.map(o => `
                                 <tr onclick="window.location.hash='order-detail/${o.id}'" style="cursor:pointer; transition: background 0.15s;" class="hover-row">
                                     <td>${o.order_number}</td>
                                     <td>${new Date(o.order_date).toLocaleDateString()}</td>
                                     <td>${o.title}</td>
                                     <td><span class="status-badge">${o.status_works || 'In corso'}</span></td>
                                 </tr>
                             `).join('') : '<tr><td colspan="4" style="text-align:center; padding:1rem; opacity:0.6;">Nessuna commessa registrata.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>

            <!-- Tab Content: Invoices -->
            <div id="tab-invoices" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead><tr><th>Numero</th><th>Data</th><th>Imponibile</th><th>Stato</th></tr></thead>
                        <tbody>
                            ${clientInvoices.length ? clientInvoices.map(i => `
                                 <tr style="cursor: default;">
                                     <td>${i.invoice_number}</td>
                                     <td>${new Date(i.issue_date).toLocaleDateString()}</td>
                                     <td>€ ${formatAmount(i.amount_tax_excluded)}</td>
                                     <td><span class="status-badge ${i.status === 'Pagato' ? 'status-active' : 'status-pending'}">${i.status}</span></td>
                                 </tr>
                             `).join('') : '<tr><td colspan="4" style="text-align:center; padding:1rem; opacity:0.6;">Nessuna fattura attiva.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>

            <!-- Tab Content: Payments -->
            <div id="tab-payments" class="tab-content hidden">
                 <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;"><span style="display:flex; align-items:center; gap:4px;">Data <span class="material-icons-round" style="font-size:14px">arrow_downward</span></span></th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Causale</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Incarico</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">Importo</th>
                                <th style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem; text-align:right;">Stato</th>
                            </tr>
                        </thead>
                         <tbody>
                            ${clientPayments.length ? clientPayments.map(p => `
                                <tr onclick="openPaymentModal('${p.id}')" style="cursor: pointer; transition: background 0.2s;">
                                    <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${new Date(p.due_date).toLocaleDateString()}</td>
                                    <td><span style="font-size: 0.9rem; color: var(--text-primary);">${p.title || '-'}</span></td>
                                    <td>
                                        ${p.orders?.order_number ?
            `<span style="border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: var(--text-primary); background: white;">${p.orders.order_number}</span>`
            : '-'}
                                    </td>
                                    <td style="font-family: 'Outfit', sans-serif; font-weight: 500; color: var(--text-primary);">€ ${formatAmount(p.amount)}</td>
                                    <td style="text-align:right;">
                                        ${p.status === 'Done' || p.status === 'Completato' || p.status === 'Saldato' ?
            `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--success); font-weight: 500; font-size: 0.85rem;"><span class="material-icons-round" style="font-size: 16px;">check_circle</span> Saldato</span>` :
            `<span style="display: inline-flex; align-items: center; gap: 4px; color: var(--warning); font-weight: 500; font-size: 0.85rem;"><span class="material-icons-round" style="font-size: 16px;">schedule</span> ${p.status || 'In attesa'}</span>`
        }
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" style="text-align:center; padding:2rem; color: var(--text-tertiary);">Nessun pagamento registrato.</td></tr>'}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    `;

    // Tabs Logic
    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottom = '2px solid transparent';
                t.style.color = 'var(--text-secondary)';
            });
            contents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            tab.style.borderBottom = '2px solid var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';
            const targetId = `tab-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.remove('hidden');
        });
    });
}
