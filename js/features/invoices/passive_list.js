// Passive invoices listing views (Partners WL, Collaborators, Suppliers).
// Extracted from invoices.js. Pure rendering — no module-level state.
// External calls remain via window:
//   - window.openInvoiceDetail(id, detailType)
//   - window.openPassiveInvoiceForm(null, mode)

import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '../../modules/utils.js?v=8000';

export function renderPassiveInvoicesPartners(container) {
    const sectionTitle = 'Fatture Partner WL';
    renderPassiveInvoicesGeneric(container, sectionTitle, 'partners');
}

export function renderPassiveInvoicesCollab(container) {
    const sectionTitle = 'Fatture Collaboratori';
    renderPassiveInvoicesGeneric(container, sectionTitle, 'collaborators');
}

export function renderPassiveInvoicesSuppliers(container) {
    const sectionTitle = 'Fatture Fornitori';
    renderPassiveInvoicesGeneric(container, sectionTitle, 'suppliers');
}

function renderPassiveInvoicesGeneric(container, title, type) {
    const isCollab = type === 'collaborators' || type === 'partners';
    const iconName = isCollab ? 'person' : 'business';
    const gradientColor = '#ef4444'; // Always red for passive (costs) as per user rules
    // Auto-switch Year Logic
    let currentYear = state.passiveInvoiceYear;
    if (!currentYear && state.passiveInvoices.length > 0) {
        const def = new Date().getFullYear();
        // Check availability for default year
        const hasData = state.passiveInvoices.some(inv =>
            new Date(inv.issue_date || inv.date || inv.invoice_date).getFullYear() === def &&
            (isCollab ? inv.collaborator_id : (!inv.collaborator_id))
        );
        if (hasData) currentYear = def;
        else {
            const allYears = [...new Set(state.passiveInvoices
                .filter(inv => isCollab ? inv.collaborator_id : (!inv.collaborator_id))
                .map(inv => new Date(inv.issue_date || inv.date || inv.invoice_date).getFullYear()))
            ].sort((a, b) => b - a);
            currentYear = allYears.length > 0 ? allYears[0] : def;
        }
        state.passiveInvoiceYear = currentYear;
    } else if (!currentYear) currentYear = new Date().getFullYear();

    const statusFilter = state.passiveInvoiceStatusFilter || 'all';

    let filtered = state.passiveInvoices.filter(inv => {
        const matchesYear = new Date(inv.issue_date).getFullYear() === currentYear;

        let subTypeMatch = false;
        if (type === 'partners') {
            subTypeMatch = inv.collaborators?.type === 'white_label';
        } else if (isCollab) {
            subTypeMatch = inv.collaborator_id && inv.collaborators?.type !== 'white_label';
        } else {
            subTypeMatch = !!inv.supplier_id && !inv.collaborator_id;
        }

        const search = state.searchTerm.toLowerCase();
        const name = (inv.collaborators?.full_name || inv.suppliers?.name || '').toLowerCase();
        const num = (inv.invoice_number || '').toLowerCase();
        return matchesYear && subTypeMatch && (name.includes(search) || num.includes(search));
    });

    // Calculate KPIs using amount_tax_excluded (importo)
    const totalCosti = filtered.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);

    // Status normalization helper
    const isPaid = (inv) => {
        const s = (inv.status || '').toLowerCase();
        const hasTransaction = state.bankTransactions?.some(t => t.passive_invoice_id === inv.id || t.linked_invoices?.includes(inv.id));
        return s === 'pagato' || s === 'pagata' || s === 'saldato' || s === 'saldata' || hasTransaction;
    };

    const nonPagate = filtered.filter(i => !isPaid(i));
    const pagate = filtered.filter(i => isPaid(i));

    const daPagare = nonPagate.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const pagato = pagate.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);

    // Apply status filter
    if (statusFilter === 'pending') {
        filtered = nonPagate;
    } else if (statusFilter === 'paid') {
        filtered = pagate;
    }

    const getStatusStyle = (inv) => {
        const s = (inv.status || '').toLowerCase();
        const paid = isPaid(inv);
        if (paid) return 'background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);';
        if (s === 'ricevuta' || s === 'inviata') return 'background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);';
        return 'background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);';
    };

    const kpiActiveStyle = (filter) => statusFilter === filter ? 'box-shadow: 0 0 0 2px var(--brand-blue); transform: scale(1.02);' : '';

    const formatDateBlock = (dateStr) => {
        if (!dateStr) return '<div style="min-width: 45px;"></div>';
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `<div style="text-align: center; min-width: 45px;">
            <div style="font-size: 1.5rem; font-weight: 300; line-height: 1; color: var(--text-primary);">${day}</div>
            <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em;">${month}</div>
            <div style="font-size: 0.6rem; color: var(--text-tertiary);">${year}</div>
        </div>`;
    };

    const cards = filtered.map(inv => {
        let name = '-';
        if (isCollab) name = inv.collaborators?.full_name || 'Collaboratore Sconosciuto';
        else name = inv.suppliers?.name || 'Fornitore Sconosciuto';

        const importo = parseFloat(inv.amount_tax_excluded) || 0;
        const iva = parseFloat(inv.tax_amount) || 0;
        const nettoAPagare = parseFloat(inv.amount_tax_included) || importo;
        const settlementDate = inv.payment_date ? new Date(inv.payment_date).toLocaleDateString('it-IT') : null;

        const isRitenuta = isCollab && nettoAPagare < importo;
        const invoiceType = isRitenuta ? 'Ritenuta' : 'Fattura';

        let linkedOrdersDisplay = [];
        if (isCollab) {
            let linkedOrders = inv.related_orders || [];
            if (!Array.isArray(linkedOrders) && typeof linkedOrders === 'string') {
                try { linkedOrders = JSON.parse(linkedOrders); } catch (e) { linkedOrders = [linkedOrders]; }
            }
            if (Array.isArray(linkedOrders) && linkedOrders.length > 0) {
                linkedOrdersDisplay = linkedOrders.map(id => {
                    const ord = state.orders ? state.orders.find(o => o.id === id) : null;
                    if (!ord) return '';
                    const clientCode = ord.clients?.client_code || '';
                    return clientCode ? `${clientCode} ${ord.order_number}` : ord.order_number;
                }).filter(n => n);
            }
        }

        const description = !isCollab ? (inv.service_description || inv.description || '') : '';

        return `
        <div class="glass-card clickable-card inv-mobile-card" data-id="${inv.id}">
            <!-- Desktop Layout -->
            <div class="inv-card-desktop">
                <div class="card-left">
                    ${formatDateBlock(inv.issue_date)}
                    <div class="card-separator"></div>
                    <div class="invoice-number-badge">
                        <div class="inv-num">${inv.invoice_number || '-'}</div>
                        <div class="inv-label">${invoiceType}</div>
                    </div>
                </div>
                <div class="card-center">
                    <div class="client-name">${name}</div>
                    ${description ? `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.2rem;">${description}</div>` : ''}
                    ${linkedOrdersDisplay.length > 0 ? `
                        <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 0.2rem; display: flex; align-items: center; gap: 0.3rem;">
                            <span class="material-icons-round" style="font-size: 0.9rem;">link</span>
                            ${linkedOrdersDisplay.slice(0, 2).join(', ')}${linkedOrdersDisplay.length > 2 ? ` +${linkedOrdersDisplay.length - 2}` : ''}
                        </div>` : ''}
                </div>
                <div class="card-right">
                    <div class="status-wrapper">
                        <span class="status-badge" style="${getStatusStyle(inv)}">${isPaid(inv) ? 'Pagata' : (inv.status || 'Bozza')}</span>
                        <span class="settlement-date">${settlementDate || ''}</span>
                    </div>
                    <div class="amount-wrapper">
                        <div class="amount-total" style="color: #ef4444;">€ ${formatAmount(nettoAPagare)}</div>
                        <div class="amount-details">
                            Importo € ${formatAmount(importo)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile Layout -->
            <div class="inv-card-mobile">
                <div class="mob-row-top">
                    <div class="mob-date-num">
                        <div class="mob-num">#${inv.invoice_number || '-'}</div>
                        <div class="mob-date">
                            <strong>${new Date(inv.issue_date).getDate()}</strong>
                            ${new Date(inv.issue_date).toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()}
                        </div>
                    </div>
                    <div class="mob-client-info">
                        <div class="mob-client-name">${name}</div>
                        <div class="mob-status-row">
                            <span class="status-badge" style="${getStatusStyle(inv)}">${isPaid(inv) ? 'Pagata' : (inv.status || 'Bozza')}</span>
                            <span class="mob-settlement">${settlementDate || ''}</span>
                        </div>
                    </div>
                </div>
                <div class="mob-row-bottom">
                    <div class="mob-amounts-left">
                        <span class="mob-importo">€ ${formatAmount(importo)}</span>
                        ${iva > 0 ? `<span class="mob-iva">IVA € ${formatAmount(iva)}</span>` : ''}
                    </div>
                    <div class="mob-netto" style="color: #ef4444;">€ ${formatAmount(nettoAPagare)}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in invoices-management-view" style="max-width: 1100px; margin: 0 auto; padding: 1rem;">
            <style>
                /* Scoped Header & Layout */
                .invoices-management-view .invoice-page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; gap: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem; }
                .invoices-management-view .title-group { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem; }
                .invoices-management-view .header-icon { color: ${gradientColor}; font-size: 1.25rem; }
                .invoices-management-view .page-title { font-size: 1.25rem; font-weight: 700; margin: 0; font-family: var(--font-titles); color: var(--text-primary); }
                .invoices-management-view .year-badge { background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
                .invoices-management-view .header-subtitle { font-size: 0.85rem; color: var(--text-tertiary); margin: 0; }
                .invoices-management-view .header-actions-row { display: flex; gap: 0.75rem; align-items: center; }
                .invoices-management-view .year-select-wrapper { position: relative; }
                .invoices-management-view .clean-select { padding: 0.5rem 2.2rem 0.5rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--card-bg); font-size: 0.9rem; font-weight: 600; cursor: pointer; appearance: none; min-width: 100px; color: var(--text-primary); }
                .invoices-management-view .select-icon { position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; pointer-events: none; opacity: 0.3; }
                .invoices-management-view .fab-btn { width: 44px; height: 44px; border-radius: 50% !important; padding: 0 !important; min-width: 0 !important; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25); display: flex; align-items: center; justify-content: center; background: ${gradientColor} !important; border: none !important; color: white !important; }

                /* Scoped KPI Grid */
                .invoices-management-view .inv-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
                .invoices-management-view .kpi-card, .invoices-management-view .kpi-static { padding: 1.25rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: var(--border-radius-lg); transition: all 0.2s; position: relative; overflow: hidden; }
                .invoices-management-view .kpi-card:hover { transform: translateY(-2px); border-color: var(--kpi-color); }
                .invoices-management-view .kpi-card.active-filter { border-color: var(--kpi-color); background: var(--glass-bg); }
                .invoices-management-view .kpi-label { font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
                .invoices-management-view .kpi-value { font-size: 1.5rem; font-weight: 800; font-family: var(--font-titles); }
                .invoices-management-view .kpi-subtext { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem; }
                .invoices-management-view .progress-container { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(0,0,0,0.05); }
                .invoices-management-view .progress-bar { height: 100%; transition: width 0.3s; }

                /* Scoped Invoice Cards Layout Control */
                .invoices-management-view .inv-card-desktop { display: flex; align-items: center; width: 100%; gap: 1.25rem; }
                .invoices-management-view .inv-card-mobile { display: none; width: 100%; flex-direction: column; gap: 0.75rem; }

                .invoices-management-view .clickable-card {
                    padding: 1rem 1.25rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid var(--glass-border);
                    background: var(--card-bg);
                }
                .invoices-management-view .clickable-card:hover { border-color: var(--brand-blue); background: var(--glass-bg); }

                .invoices-management-view .card-left { display: flex; align-items: center; gap: 0.75rem; }
                .invoices-management-view .card-separator { width: 1px; height: 36px; background: var(--glass-border); }
                .invoices-management-view .invoice-number-badge { text-align: center; min-width: 50px; padding: 0.25rem 0.5rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; }
                .invoices-management-view .inv-num { font-size: 1.1rem; font-weight: 600; line-height: 1; color: var(--brand-blue); }
                .invoices-management-view .inv-label { font-size: 0.6rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em; }

                .invoices-management-view .card-center { flex: 1; min-width: 0; }
                .invoices-management-view .client-name { font-size: 1rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                .invoices-management-view .card-right { display: flex; align-items: center; gap: 2rem; }
                .invoices-management-view .status-wrapper { display: flex; align-items: center; gap: 0.5rem; min-width: 160px; justify-content: flex-end; }
                .invoices-management-view .status-badge { padding: 0.3rem 0.75rem; border-radius: 2rem; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
                .invoices-management-view .settlement-date { font-size: 0.75rem; color: var(--text-tertiary); min-width: 75px; text-align: right; }

                .invoices-management-view .amount-wrapper { text-align: right; min-width: 110px; }
                .invoices-management-view .amount-total { font-size: 1.1rem; font-weight: 700; }
                .invoices-management-view .amount-details { font-size: 0.7rem; color: var(--text-tertiary); }

                @media (max-width: 768px) {
                    .invoices-management-view .inv-card-desktop { display: none !important; }
                    .invoices-management-view .inv-card-mobile { display: flex !important; margin: 0; padding: 0.25rem 0.15rem; }

                    .invoices-management-view .clickable-card { padding: 0.75rem 1rem !important; border-radius: 14px; }

                    /* Mobile Stacking Logic */
                    .invoices-management-view .mob-row-top { display: flex; gap: 0.85rem; align-items: flex-start; }
                    .invoices-management-view .mob-date-num { text-align: center; min-width: 50px; padding-right: 0.75rem; border-right: 1px solid var(--glass-border); display: flex; flex-direction: column; justify-content: center; }
                    .invoices-management-view .mob-num { font-size: 0.75rem; color: var(--brand-blue); font-weight: 600; margin-bottom: 4px; }
                    .invoices-management-view .mob-date { font-size: 1.1rem; line-height: 1.1; color: var(--text-tertiary); font-weight: 300; }
                    .invoices-management-view .mob-date strong { display: block; font-weight: 700; color: var(--text-primary); font-size: 1.25rem; }

                    .invoices-management-view .mob-client-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
                    .invoices-management-view .mob-client-name { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.4rem; line-height: 1.2; word-break: break-word; }
                    .invoices-management-view .mob-status-row { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; }
                    .invoices-management-view .mob-status-row .status-badge { font-size: 0.65rem; padding: 0.2rem 0.6rem; }
                    .invoices-management-view .mob-settlement { font-size: 0.7rem; color: var(--text-tertiary); }

                    .invoices-management-view .mob-row-bottom {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 0.6rem;
                        padding-top: 0.6rem;
                        border-top: 1px solid rgba(0,0,0,0.03);
                    }
                    .invoices-management-view .mob-amounts-left { display: flex; align-items: center; gap: 0.6rem; }
                    .invoices-management-view .mob-importo { font-size: 0.75rem; color: var(--text-tertiary); }
                    .invoices-management-view .mob-iva { font-size: 0.75rem; color: var(--text-tertiary); }
                    .invoices-management-view .mob-netto { font-size: 1.1rem; font-weight: 800; color: #ef4444; }

                    .invoices-management-view .desktop-only-title { display: none; }
                    .invoices-management-view .invoice-page-header { align-items: center; border-bottom: none; padding-bottom: 0.75rem; }
                    .invoices-management-view .header-actions-row { width: 100%; justify-content: space-between; }
                    .invoices-management-view .inv-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1.25rem; }
                    .invoices-management-view .kpi-card, .invoices-management-view .kpi-static { padding: 0.85rem; border-radius: 12px; }
                    .invoices-management-view .kpi-label { font-size: 0.6rem; }
                    .invoices-management-view .kpi-value { font-size: 1.1rem; }
                    .invoices-management-view .fab-btn { width: 40px; height: 40px; }
                    .invoices-management-view .clean-select { padding: 0.45rem 2rem 0.45rem 0.6rem; font-size: 0.85rem; min-width: 85px; }
                }
            </style>

            <!-- Header -->
            <div class="invoice-page-header">
                <div class="header-main">
                    <div class="title-group">
                         <span class="material-icons-round header-icon">receipt_long</span>
                         <h1 class="page-title desktop-only-title">${title}</h1>
                         <div class="year-badge">${currentYear}</div>
                    </div>
                    <p class="header-subtitle">${filtered.length} documenti registrati</p>
                </div>
                <div class="header-actions-row">
                    <div class="year-select-wrapper">
                        <select id="pinv-year-filter" class="clean-select">
                             ${[...new Set(state.passiveInvoices.map(inv => new Date(inv.issue_date).getFullYear()))].sort((a, b) => b - a).map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                        <span class="material-icons-round select-icon">expand_more</span>
                    </div>
                    <button class="primary-btn fab-btn" id="btn-new-passive" title="Nuovo Documento">
                        <span class="material-icons-round">add</span>
                    </button>
                </div>
            </div>

            <!-- KPI Summary -->
            <div class="inv-kpi-grid">
                <div class="glass-card kpi-card ${statusFilter === 'all' ? 'active-filter' : ''}" data-filter="all" style="--kpi-color: ${gradientColor};">
                    <div class="kpi-label">Totale Costi</div>
                    <div class="kpi-value" style="color: ${gradientColor};">€ ${formatAmount(totalCosti)}</div>
                </div>
                <div class="glass-card kpi-card ${statusFilter === 'pending' ? 'active-filter' : ''}" data-filter="pending" style="--kpi-color: #f59e0b;">
                    <div class="kpi-label">Da Pagare</div>
                    <div class="kpi-value" style="color: #f59e0b;">€ ${formatAmount(daPagare)}</div>
                    <div class="kpi-subtext">${nonPagate.length} documenti</div>
                </div>
                <div class="glass-card kpi-card ${statusFilter === 'paid' ? 'active-filter' : ''}" data-filter="paid" style="--kpi-color: #10b981;">
                    <div class="kpi-label">Pagato</div>
                    <div class="kpi-value" style="color: #10b981;">€ ${formatAmount(pagato)}</div>
                    <div class="kpi-subtext">${pagate.length} documenti</div>
                </div>
                <div class="glass-card kpi-static" style="border-bottom: 3px solid #f59e0b;">
                    <div class="kpi-label">Pendenti</div>
                    <div class="kpi-value" style="color: ${nonPagate.length > 0 ? '#f59e0b' : '#10b981'};">${nonPagate.length}</div>
                    <div class="kpi-subtext" style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">${nonPagate.length} documenti</div>
                    <div class="progress-container" style="height: 4px; background: rgba(0,0,0,0.05); border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
                        <div class="progress-bar" style="width: ${filtered.length > 0 ? (nonPagate.length / filtered.length * 100) : 0}%; height: 100%; background: #f59e0b;"></div>
                    </div>
                </div>
            </div>

            <!-- Invoice List -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${cards ? cards : `
                    <div class="empty-state">
                        <span class="empty-icon">📭</span>
                        <p class="empty-title">Nessuna fattura passiva per il ${currentYear}</p>
                        <p class="empty-subtitle">Controlla il filtro anno o lo stato selezionato.${state.passiveInvoices.length > 0 ? ` (${state.passiveInvoices.length} fatture totali con altri filtri)` : ''}</p>
                    </div>
                `}
            </div>
        </div>`;

    // Event listeners
    container.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', () => {
            let detailType = 'passive-collab';
            if (type === 'suppliers') detailType = 'passive-supplier';
            if (type === 'partners') detailType = 'passive-partner-wl';
            window.openInvoiceDetail(card.dataset.id, detailType);
        });
    });
    container.querySelector('#btn-new-passive')?.addEventListener('click', () => {
        let mode = 'collab';
        if (type === 'suppliers') mode = 'supplier';
        if (type === 'partners') mode = 'partner-wl';
        window.openPassiveInvoiceForm(null, mode);
    });
    container.querySelector('#pinv-year-filter')?.addEventListener('change', (e) => {
        state.passiveInvoiceYear = parseInt(e.target.value);
        state.passiveInvoiceStatusFilter = 'all';
        renderPassiveInvoicesGeneric(container, title, type);
    });
    // KPI click handlers
    container.querySelectorAll('.kpi-card').forEach(kpi => {
        kpi.addEventListener('click', () => {
            state.passiveInvoiceStatusFilter = kpi.dataset.filter;
            renderPassiveInvoicesGeneric(container, title, type);
        });
    });
}
