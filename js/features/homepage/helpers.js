// Homepage shared helpers.
// Extracted from homepage-alt.js (Fase split-monstro step 5).
//
// Public exports:
//   - getFirstName(collab, profile)       capitalised first name with email fallback
//   - renderCollaboratorPayments(data)    bottom widget for collaborator payments/invoices
//   - detectUserRole(normalizedTags)      pure role detection (returns 'partner' | ...)

import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '../../modules/utils.js?v=8000';

export const getFirstName = (collab, profile) => {
    let name = collab?.first_name || collab?.full_name || profile?.first_name || profile?.full_name;
    
    if (!name || name === 'null' || name === 'undefined') {
        const email = collab?.email || profile?.email || state.session?.user?.email;
        if (email) name = email.split('@')[0];
        else return 'Utente';
    }

    // Clean up technical strings (email prefixes, dots, underscores, exclamation marks)
    const clean = name.split('@')[0].replace(/[._!]/g, ' ').trim();
    const firstWord = clean.split(' ').filter(Boolean)[0] || 'Utente';
    
    // Capitalize properly
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
};

export function renderCollaboratorPayments(data) {
    const payContainer = document.getElementById('hp-collab-payments-list');
    const invContainer = document.getElementById('hp-collab-invoices-list');
    if (!payContainer || !invContainer) return;

    const { nextPayments, nextInvoices } = data;

    // --- PAYMENTS BOX ---
    if (nextPayments.length === 0) {
        payContainer.innerHTML = `<div style="padding: 1rem 0; text-align: center; color: #94a3b8; font-size: 0.78rem;">Nessun pagamento in sospeso.</div>`;
    } else {
        payContainer.innerHTML = nextPayments.map(p => {
            const date = p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : 'N.D.';
            const isOverdue = p.due_date && new Date(p.due_date) < new Date();
            const statusLabel = p.status || 'In attesa';
            const statusColor = isOverdue ? '#ef4444' : '#f59e0b';
            const statusBg = isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
            const clientName = p.orders?.clients?.client_code || p.orders?.clients?.business_name || '';
            const orderInfo = p.orders
                ? `${p.orders.order_number || ''}${clientName ? ' · ' + clientName : ''}`
                : (p.assignment_id || '');
            return `
                <div style="padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 0.82rem; font-weight: 600; color: #1e293b; line-height: 1.35;">${p.title || 'Pagamento'}</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #1e293b; flex-shrink: 0; letter-spacing: -0.01em;">${formatAmount(p.amount)} €</span>
                    </div>
                    ${orderInfo ? `<div style="margin-top: 3px; font-size: 0.68rem; color: #64748b; font-weight: 500;">${orderInfo}</div>` : ''}
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px;">
                        <span style="font-size: 0.65rem; color: #94a3b8;">Scad. ${date}</span>
                        <span style="font-size: 0.62rem; font-weight: 700; color: ${statusColor}; background: ${statusBg}; padding: 1px 6px; border-radius: 4px;">${statusLabel}</span>
                    </div>
                </div>`;
        }).join('');
    }

    // --- INVOICES BOX ---
    if (nextInvoices.length === 0) {
        invContainer.innerHTML = `<div style="padding: 1rem 0; text-align: center; color: #94a3b8; font-size: 0.78rem;">Nessuna fattura presente.</div>`;
    } else {
        invContainer.innerHTML = nextInvoices.map(i => {
            const isPaid = i.status === 'Pagata' || i.status === 'Pagato';
            const isPending = i.status === 'Da Pagare';
            const statusColor = isPaid ? '#10b981' : isPending ? '#f59e0b' : '#64748b';
            const statusBg = isPaid ? 'rgba(16,185,129,0.08)' : isPending ? 'rgba(245,158,11,0.08)' : 'rgba(100,116,139,0.08)';
            const issueDate = i.issue_date ? new Date(i.issue_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' }) : 'N.D.';
            return `
                <div style="padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 0.82rem; font-weight: 600; color: #1e293b; line-height: 1.35;">Fattura n.${i.invoice_number || 'N.D.'}</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #1e293b; flex-shrink: 0; letter-spacing: -0.01em;">${formatAmount(i.amount_tax_included)} €</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px;">
                        <span style="font-size: 0.65rem; color: #94a3b8;">${issueDate}</span>
                        <span style="font-size: 0.62rem; font-weight: 700; color: ${statusColor}; background: ${statusBg}; padding: 1px 6px; border-radius: 4px;">${i.status || 'Emessa'}</span>
                    </div>
                </div>`;
        }).join('');
    }
}

export function detectUserRole(normalizedTags) {
    if (normalizedTags.includes('partner')) return 'partner';
    if (normalizedTags.includes('amministrazione')) return 'amministrazione';
    if (normalizedTags.includes('account')) return 'account';
    if (normalizedTags.includes('project manager') || normalizedTags.includes('pm')) return 'pm';
    return 'collaboratore';
}
