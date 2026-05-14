// Active invoices list views.
//   - renderInvoices: legacy table renderer (kept for back-compat; no external callers
//     found at extraction time — candidate for cleanup once confirmed unused).
//   - renderActiveInvoicesSafe: the modern delegated-event renderer used by the router.
//
// Extracted from invoices.js. External calls remain via window:
//   - window.openInvoiceForm(id)
//   - window.openInvoiceDetail(id, 'active')

import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '../../modules/utils.js?v=8000';
import { DashboardData } from '../dashboard.js?v=8000';

// --- VIEW FUNCTIONS ---

export function renderInvoices(container) {
    const activeStats = DashboardData.getStats(state.dashboardYear, 'all');
    // ... (Stats rendering logic could be duplicated or reused, sticking to simple list for this view if it's the "Fatture Attive" list)
    // Actually the "Fatture Attive" page usually showed the table.

    // Using filtered invoices
    const filteredInvoices = state.invoices.filter(inv => {
        const matchesSearch = inv.invoice_number.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            (inv.clients?.business_name || '').toLowerCase().includes(state.searchTerm.toLowerCase());
        const matchesYear = state.dashboardYear ? new Date(inv.invoice_date).getFullYear() === state.dashboardYear : true;
        return matchesSearch && matchesYear;
    });

    const rows = filteredInvoices.map(inv => {
        const isPaid = inv.status === 'Saldata';
        return `
        <tr class="clickable-row" onclick="openInvoiceForm('${inv.id}')">
            <td>${inv.invoice_number}</td>
            <td>${inv.clients?.business_name || '-'}</td>
            <td>${new Date(inv.invoice_date).toLocaleDateString('it-IT')}</td>
            <td>€ ${formatAmount(inv.amount_tax_excluded)}</td>
            <td>
                <span class="status-badge ${isPaid ? 'status-active' : 'status-pending'}">
                    ${inv.status}
                </span>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in">
            <div class="table-container">
                 <div class="section-header">
                    <div style="display:flex; gap:1rem; align-items:center;">
                        <span>Fatture Attive (${filteredInvoices.length})</span>
                        <select onchange="state.dashboardYear=parseInt(this.value); render();" style="padding:0.2rem; border-radius:5px;">
                            <option value="2025" ${state.dashboardYear === 2025 ? 'selected' : ''}>2025</option>
                            <option value="2024" ${state.dashboardYear === 2024 ? 'selected' : ''}>2024</option>
                        </select>
                    </div>
                    <button class="primary-btn small" onclick="openInvoiceForm()">+ Nuova Fattura</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Numero</th>
                            <th>Cliente</th>
                            <th>Data</th>
                            <th>Imponibile</th>
                            <th>Stato</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;

    // Attach global functions for onclick handlers if needed, or use event delegation
    // Ideally we use event delegation.
    container.querySelector('table tbody').addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.onclick) {
            // The onclick attribute in HTML string won't see our module functions unless they are global.
            // We must expose them or use delegation properly.
            // Replacing inline onclick with data-id.
        }
    });
}

// Re-writing to use delegation for safety
export function renderActiveInvoicesSafe(container) {
    let currentYear = state.dashboardYear;

    // Auto-Switch Active Year Logic
    const hasDataForCurrent = currentYear && state.invoices.some(inv => new Date(inv.invoice_date).getFullYear() === parseInt(currentYear));

    if ((!currentYear || !hasDataForCurrent) && state.invoices.length > 0) {
        const def = 2026;
        const hasDataDef = state.invoices.some(inv => new Date(inv.invoice_date).getFullYear() === def);
        if (hasDataDef) {
            currentYear = def;
        } else {
            const allYears = [...new Set(state.invoices.map(inv => new Date(inv.invoice_date).getFullYear()))].sort((a, b) => b - a);
            currentYear = allYears.length > 0 ? allYears[0] : def;
        }
        state.dashboardYear = currentYear;
    } else if (!currentYear) {
        currentYear = 2026;
        state.dashboardYear = currentYear;
    }

    const statusFilter = state.invoiceStatusFilter || 'all';

    let filteredInvoices = state.invoices.filter(inv => {
        const matchesSearch = inv.invoice_number.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
            (inv.clients?.business_name || '').toLowerCase().includes(state.searchTerm.toLowerCase());
        const matchesYear = new Date(inv.invoice_date).getFullYear() === currentYear;
        return matchesSearch && matchesYear;
    });

    filteredInvoices.sort((a, b) => {
        const numA = a.invoice_number || '';
        const numB = b.invoice_number || '';
        return numB.localeCompare(numA, undefined, { numeric: true });
    });

    const totalFatturato = filteredInvoices.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    const nonSaldate = filteredInvoices.filter(i => i.status !== 'Saldata');
    const saldate = filteredInvoices.filter(i => i.status === 'Saldata');
    // "Da incassare" considera i pagamenti parziali: sottrae l'amount_paid già incassato.
    // (es. fattura €1000 con €400 di acconto già arrivato → contiamo €600 da incassare, non €1000)
    const daIncassare = nonSaldate.reduce((sum, i) => {
        const lordo = parseFloat(i.amount_tax_included) || parseFloat(i.amount_tax_excluded) || 0;
        const giaPagato = parseFloat(i.amount_paid) || 0;
        return sum + Math.max(0, lordo - giaPagato);
    }, 0);
    const incassato = saldate.reduce((sum, i) => sum + (parseFloat(i.amount_tax_excluded) || 0), 0);
    // Aggiungiamo anche gli acconti parziali su fatture non ancora chiuse
    const incassatoParziale = nonSaldate.reduce((sum, i) => sum + (parseFloat(i.amount_paid) || 0), 0);
    const percIncasso = totalFatturato > 0 ? Math.round(((incassato + incassatoParziale) / totalFatturato) * 100) : 0;

    if (statusFilter === 'pending') filteredInvoices = nonSaldate;
    else if (statusFilter === 'paid') filteredInvoices = saldate;

    const getStatusStyle = (status) => {
        if (status === 'Saldata') return 'background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);';
        if (status === 'Inviata') return 'background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);';
        return 'background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);';
    };

    const formatDateBlock = (dateStr) => {
        if (!dateStr) return '';
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

    const cards = filteredInvoices.map(inv => {
        const importo = parseFloat(inv.amount_tax_excluded) || 0;
        const iva = parseFloat(inv.tax_amount) || 0;
        const isSplit = inv.vat_eligibility && inv.vat_eligibility.toLowerCase().includes('scissione');
        const nettoAPagare = isSplit ? importo : (importo + iva);
        const settlementDate = inv.payment_date ? new Date(inv.payment_date).toLocaleDateString('it-IT') : null;

        // Stato pagamento parziale: bonifici incassati > 0 ma < 95% dell'importo lordo
        const amountTaxIncluded = parseFloat(inv.amount_tax_included) || nettoAPagare;
        const amountPaid = parseFloat(inv.amount_paid) || 0;
        const isPartial = inv.status !== 'Saldata' && amountPaid > 0 && amountPaid < amountTaxIncluded * 0.95;
        const partialPct = amountTaxIncluded > 0 ? Math.round((amountPaid / amountTaxIncluded) * 100) : 0;
        const partialBadge = isPartial
            ? `<span class="status-badge" title="Incassato €${formatAmount(amountPaid)} di €${formatAmount(amountTaxIncluded)}" style="background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.68rem; margin-left: 4px;">⏳ Parziale ${partialPct}%</span>`
            : '';

        return `
        <div class="glass-card clickable-card inv-mobile-card" data-id="${inv.id}">
            <!-- Desktop Layout (Standard horizontal) -->
            <div class="inv-card-desktop">
                <div class="card-left">
                    ${formatDateBlock(inv.invoice_date)}
                    <div class="card-separator"></div>
                    <div class="invoice-number-badge">
                        <div class="inv-num">${inv.invoice_number || '-'}</div>
                        <div class="inv-label">Fattura</div>
                    </div>
                </div>
                <div class="card-center">
                    <div class="client-name">${inv.clients?.business_name || inv.clienti || inv.nome_cliente || '-'}</div>
                </div>
                <div class="card-right">
                    <div class="status-wrapper">
                        <span class="status-badge" style="${getStatusStyle(inv.status)}">${inv.status || 'Bozza'}</span>
                        ${partialBadge}
                        <span class="settlement-date">${settlementDate || ''}</span>
                    </div>
                    <div class="amount-wrapper">
                        <div class="amount-total">€ ${formatAmount(importo)}</div>
                        <div class="amount-details">
                            ${iva > 0 ? `IVA € ${formatAmount(iva)}` : 'esente IVA'}
                            ${isSplit ? '<span class="material-icons-round split-icon">call_split</span>' : ''}
                        </div>
                        <div style="font-size: 0.7rem; color: #10b981; font-weight: 600;">Netto € ${formatAmount(nettoAPagare)}</div>
                    </div>
                </div>
            </div>

            <!-- Mobile Layout (Custom stacking as requested) -->
            <div class="inv-card-mobile">
                <div class="mob-row-top">
                    <div class="mob-date-num">
                        <div class="mob-num">#${inv.invoice_number}</div>
                        <div class="mob-date">
                            <strong>${new Date(inv.invoice_date).getDate()}</strong>
                            ${new Date(inv.invoice_date).toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()}
                        </div>
                    </div>
                    <div class="mob-client-info">
                        <div class="mob-client-name">${inv.clients?.business_name || inv.clienti || inv.nome_cliente || '-'}</div>
                        <div class="mob-status-row">
                            <span class="status-badge" style="${getStatusStyle(inv.status)}">${inv.status || 'Bozza'}</span>
                            <span class="mob-settlement">${settlementDate || ''}</span>
                        </div>
                    </div>
                </div>
                <div class="mob-row-bottom">
                    <div class="mob-amounts-left">
                        <span class="mob-importo">€ ${formatAmount(importo)}</span>
                        <span class="mob-iva">${iva > 0 ? `IVA € ${formatAmount(iva)}` : 'esente IVA'}</span>
                    </div>
                    <div class="mob-netto">€ ${formatAmount(nettoAPagare)}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1100px; margin: 0 auto; padding: 1rem;">
            <div class="invoice-page-header">
                <div class="header-main">
                    <div class="title-group">
                         <span class="material-icons-round header-icon">receipt_long</span>
                         <h1 class="page-title desktop-only-title">Fatture Attive</h1>
                         <div class="year-badge">${currentYear}</div>
                    </div>
                    <p class="header-subtitle">${filteredInvoices.length} documenti emessi</p>
                </div>
                <div class="header-actions-row">
                    <div class="year-select-wrapper">
                        <select id="inv-year-filter" class="clean-select">
                             ${(() => {
                                 // Anni dinamici: dai dati esistenti + l'anno corrente, ordinati discendenti.
                                 // Previene la rottura del dropdown nel 2027+ (vecchio formato hardcoded 2024/25/26).
                                 const years = new Set(state.invoices
                                     .map(inv => new Date(inv.invoice_date).getFullYear())
                                     .filter(y => Number.isFinite(y)));
                                 years.add(new Date().getFullYear());
                                 if (currentYear) years.add(parseInt(currentYear));
                                 return [...years].sort((a, b) => b - a)
                                     .map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`)
                                     .join('');
                             })()}
                        </select>
                        <span class="material-icons-round select-icon">expand_more</span>
                    </div>
                    <button class="primary-btn fab-btn" id="btn-new-invoice" title="Nuova Fattura">
                        <span class="material-icons-round">add</span>
                    </button>
                </div>
            </div>

            <div class="inv-kpi-grid">
                <div class="glass-card kpi-card ${statusFilter === 'all' ? 'active-filter' : ''}" data-filter="all" style="--kpi-color: #10b981;">
                    <div class="kpi-label">Totale Fatturato</div>
                    <div class="kpi-value" style="color: #10b981;">€ ${formatAmount(totalFatturato)}</div>
                </div>
                <div class="glass-card kpi-card ${statusFilter === 'pending' ? 'active-filter' : ''}" data-filter="pending" style="--kpi-color: #f59e0b;">
                    <div class="kpi-label">Da Incassare</div>
                    <div class="kpi-value" style="color: #f59e0b;">€ ${formatAmount(daIncassare)}</div>
                    <div class="kpi-subtext">${nonSaldate.length} fatture</div>
                </div>
                <div class="glass-card kpi-card ${statusFilter === 'paid' ? 'active-filter' : ''}" data-filter="paid" style="--kpi-color: #3b82f6;">
                    <div class="kpi-label">Incassato</div>
                    <div class="kpi-value" style="color: #3b82f6;">€ ${formatAmount(incassato)}</div>
                    <div class="kpi-subtext">${saldate.length} fatture</div>
                </div>
                <div class="glass-card kpi-static">
                    <div class="kpi-label">% Incasso</div>
                    <div class="kpi-value" style="color: ${percIncasso >= 75 ? '#10b981' : percIncasso >= 50 ? '#f59e0b' : '#ef4444'};">${percIncasso}%</div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percIncasso}%; background: ${percIncasso >= 75 ? '#10b981' : percIncasso >= 50 ? '#f59e0b' : '#ef4444'};"></div>
                    </div>
                </div>
            </div>
            <style>
                /* Header & Layout */
                .invoice-page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; gap: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem; }
                .title-group { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem; }
                .header-icon { color: #10b981; font-size: 1.25rem; }
                .page-title { font-size: 1.25rem; font-weight: 700; margin: 0; font-family: var(--font-titles); color: var(--text-primary); }
                .year-badge { background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; }
                .header-subtitle { font-size: 0.85rem; color: var(--text-tertiary); margin: 0; }
                .header-actions-row { display: flex; gap: 0.75rem; align-items: center; }
                .year-select-wrapper { position: relative; }
                .clean-select { padding: 0.5rem 2.2rem 0.5rem 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--card-bg); font-size: 0.9rem; font-weight: 600; cursor: pointer; appearance: none; min-width: 100px; color: var(--text-primary); }
                .select-icon { position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; pointer-events: none; opacity: 0.3; }
                .fab-btn { width: 44px; height: 44px; border-radius: 50% !important; padding: 0 !important; min-width: 0 !important; box-shadow: 0 4px 12px rgba(97, 74, 162, 0.25); display: flex; align-items: center; justify-content: center; }
                
                /* KPI Grid */
                .inv-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
                .kpi-card, .kpi-static { padding: 1.25rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: var(--border-radius-lg); transition: all 0.2s; position: relative; overflow: hidden; }
                .kpi-card:hover { transform: translateY(-2px); border-color: var(--kpi-color); }
                .kpi-card.active-filter { border-color: var(--kpi-color); background: var(--glass-bg); }
                .kpi-label { font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
                .kpi-value { font-size: 1.5rem; font-weight: 800; font-family: var(--font-titles); }
                .kpi-subtext { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem; }
                .progress-container { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(0,0,0,0.05); }
                .progress-bar { height: 100%; transition: width 0.3s; }

                /* Invoice Cards Layout Control */
                .inv-card-desktop { display: flex; align-items: center; width: 100%; gap: 1.25rem; }
                .inv-card-mobile { display: none; width: 100%; flex-direction: column; gap: 0.75rem; }

                .clickable-card { 
                    padding: 1rem 1.25rem; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                    border: 1px solid var(--glass-border); 
                    background: var(--card-bg);
                }
                .clickable-card:hover { border-color: var(--brand-blue); background: var(--glass-bg); }
                
                .card-left { display: flex; align-items: center; gap: 0.75rem; }
                .card-separator { width: 1px; height: 36px; background: var(--glass-border); }
                .invoice-number-badge { text-align: center; min-width: 50px; padding: 0.25rem 0.5rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; }
                .inv-num { font-size: 1.1rem; font-weight: 600; line-height: 1; color: var(--brand-blue); }
                .inv-label { font-size: 0.6rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.02em; }
                
                .card-center { flex: 1; min-width: 0; }
                .client-name { font-size: 1rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                
                .card-right { display: flex; align-items: center; gap: 2rem; }
                .status-wrapper { display: flex; align-items: center; gap: 0.5rem; min-width: 160px; justify-content: flex-end; }
                .status-badge { padding: 0.3rem 0.75rem; border-radius: 2rem; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
                .settlement-date { font-size: 0.75rem; color: var(--text-tertiary); min-width: 75px; text-align: right; }
                
                .amount-wrapper { text-align: right; min-width: 110px; }
                .amount-total { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); }
                .amount-details { font-size: 0.7rem; color: var(--text-tertiary); display: flex; align-items: center; justify-content: flex-end; gap: 0.3rem; }
                .split-icon { font-size: 0.9rem; color: #8b5cf6; }

                @media (max-width: 768px) {
                    .inv-card-desktop { display: none; }
                    .inv-card-mobile { display: flex; }
                    
                    .clickable-card { padding: 0.75rem 0.85rem !important; }
                    
                    /* Mobile Stacking Logic */
                    .mob-row-top { display: flex; gap: 0.85rem; align-items: flex-start; }
                    .mob-date-num { text-align: center; min-width: 50px; padding-right: 0.75rem; border-right: 1px solid var(--glass-border); display: flex; flex-direction: column; justify-content: center; }
                    .mob-num { font-size: 0.75rem; color: var(--brand-blue); font-weight: 600; margin-bottom: 4px; }
                    .mob-date { font-size: 1.1rem; line-height: 1.1; color: var(--text-tertiary); font-weight: 300; }
                    .mob-date strong { display: block; font-weight: 700; color: var(--text-primary); font-size: 1.25rem; }
                    
                    .mob-client-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
                    .mob-client-name { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.4rem; line-height: 1.2; word-break: break-word; }
                    .mob-status-row { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; }
                    .mob-status-row .status-badge { font-size: 0.65rem; padding: 0.2rem 0.6rem; }
                    .mob-settlement { font-size: 0.7rem; color: var(--text-tertiary); }
                    
                    .mob-row-bottom { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        margin-top: 0.6rem; 
                        padding-top: 0.6rem; 
                        border-top: 1px solid rgba(0,0,0,0.03); 
                    }
                    .mob-amounts-left { display: flex; align-items: center; gap: 0.6rem; }
                    .mob-importo { font-size: 0.75rem; color: var(--text-tertiary); }
                    .mob-iva { font-size: 0.75rem; color: var(--text-tertiary); }
                    .mob-netto { font-size: 1.1rem; font-weight: 800; color: #10b981; }

                    .desktop-only-title { display: none; }
                    .invoice-page-header { align-items: center; padding-bottom: 0.75rem; }
                    .inv-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1.25rem; }
                    .kpi-card, .kpi-static { padding: 0.85rem; border-radius: 12px; }
                    .kpi-label { font-size: 0.6rem; }
                    .kpi-value { font-size: 1.1rem; }
                    .fab-btn { width: 40px; height: 40px; }
                    .clean-select { padding: 0.45rem 2rem 0.45rem 0.6rem; font-size: 0.85rem; min-width: 85px; }
                }
            </style>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${cards || '<div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">Nessuna fattura trovata</div>'}
            </div>
        </div>`;

    container.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', () => window.openInvoiceDetail(card.dataset.id, 'active'));
    });
    container.querySelector('#btn-new-invoice')?.addEventListener('click', () => openInvoiceForm());
    container.querySelector('#inv-year-filter')?.addEventListener('change', (e) => {
        state.dashboardYear = parseInt(e.target.value);
        state.invoiceStatusFilter = 'all';
        renderActiveInvoicesSafe(container);
    });
    container.querySelectorAll('.kpi-card').forEach(kpi => {
        kpi.addEventListener('click', () => {
            state.invoiceStatusFilter = kpi.dataset.filter;
            renderActiveInvoicesSafe(container);
        });
    });
}
