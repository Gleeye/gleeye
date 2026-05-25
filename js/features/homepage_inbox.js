// Homepage Inbox unificato
// Widget con cose da fare oggi: bozze email, orfani banca, task urgenti,
// rinnovi imminenti, solleciti clienti.

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

const ROWS = [
    {
        key: 'email_drafts',
        icon: 'drafts',
        color: '#d97706',
        label: 'Bozze email da inviare',
        route: '#outbound-emails',
        fetch: async () => {
            const { count } = await supabase
                .from('outbound_emails')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'draft');
            return count || 0;
        },
    },
    {
        key: 'bank_orphans',
        icon: 'account_balance_wallet',
        color: '#ef4444',
        label: 'Movimenti bancari da quadrare',
        route: '#bank-orphans',
        fetch: async () => {
            const { count } = await supabase
                .from('bank_transactions')
                .select('id', { count: 'exact', head: true })
                .is('linked_invoice_id', null)
                .is('linked_passive_invoice_id', null)
                .gt('created_at', new Date(Date.now() - 90 * 86400000).toISOString());
            return count || 0;
        },
    },
    {
        key: 'overdue_tasks',
        icon: 'task_alt',
        color: '#7c3aed',
        label: 'Task scaduti o urgenti',
        route: '#tasks-summary',
        fetch: async () => {
            const userId = state.profile?.id;
            if (!userId) return 0;
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from('pm_items')
                .select('id, due_date, priority, status, pm_item_assignees!inner(user_ref)')
                .neq('status', 'done')
                .is('archived_at', null)
                .or(`due_date.lt.${now},priority.eq.urgent`)
                .eq('pm_item_assignees.user_ref', userId)
                .limit(50);
            if (error) return 0;
            return (data || []).length;
        },
    },
    {
        key: 'subscription_renewals',
        icon: 'subscriptions',
        color: '#8b5cf6',
        label: 'Rinnovi abbonamenti entro 14gg',
        route: '#cfo-subscriptions',
        fetch: async () => {
            const data = await supabase.rpc('fn_subscription_dashboard');
            const upcoming = data?.data?.upcoming || [];
            return upcoming.filter(u => u.days_to_renewal !== null && u.days_to_renewal <= 14).length;
        },
    },
    {
        key: 'dormant_clients',
        icon: 'business',
        color: '#64748b',
        label: 'Clienti dormienti da riattivare',
        route: '#sales',
        fetch: async () => {
            const { count } = await supabase
                .from('clients')
                .select('id', { count: 'exact', head: true })
                .eq('status_derived', 'Dormiente')
                .eq('archived', false);
            return count || 0;
        },
    },
];

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

export async function renderInboxWidget(slot) {
    if (!slot) return;
    slot.innerHTML = `<div style="padding:1rem;color:var(--text-tertiary);font-size:.8rem;">Caricamento Inbox…</div>`;

    const results = await Promise.all(ROWS.map(async row => {
        try {
            const count = await row.fetch();
            return { ...row, count };
        } catch (err) {
            console.warn(`[inbox] ${row.key} failed`, err);
            return { ...row, count: 0, error: true };
        }
    }));

    const totalCount = results.reduce((s, r) => s + (r.count || 0), 0);
    const visible = results.filter(r => r.count > 0);

    if (totalCount === 0) {
        slot.innerHTML = `
            <div style="margin-bottom:1.5rem;padding:1.5rem;background:linear-gradient(135deg,rgba(16,185,129,.06),rgba(16,185,129,.01));border:1px solid rgba(16,185,129,.18);border-radius:16px;text-align:center;">
                <span class="material-icons-round" style="font-size:2rem;color:#10b981;">check_circle</span>
                <div style="font-weight:600;color:#1f2937;margin-top:.5rem;">Tutto in ordine</div>
                <div style="font-size:.78rem;color:var(--text-secondary);margin-top:.2rem;">Nessuna pendenza nell'Inbox.</div>
            </div>
        `;
        return;
    }

    slot.innerHTML = `
        <div style="margin-bottom:1.5rem;background:#fff;border:1px solid var(--glass-border);border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.03);">
            <div style="padding:.85rem 1.25rem;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;gap:.5rem;background:linear-gradient(135deg,rgba(99,102,241,.04),transparent);">
                <span class="material-icons-round" style="font-size:1.1rem;color:#6366f1;">inbox</span>
                <span style="font-weight:700;font-size:.95rem;color:var(--text-primary);font-family:var(--font-titles);">Inbox</span>
                <span style="margin-left:auto;background:#6366f1;color:#fff;font-size:.65rem;font-weight:700;padding:.15rem .55rem;border-radius:999px;">${totalCount}</span>
            </div>
            <div style="display:flex;flex-direction:column;">
                ${visible.map(r => `
                    <a href="${r.route}" style="display:flex;align-items:center;gap:.85rem;padding:.85rem 1.25rem;text-decoration:none;color:var(--text-primary);border-bottom:1px solid var(--glass-border);transition:background .15s;" onmouseover="this.style.background='rgba(99,102,241,.04)'" onmouseout="this.style.background='transparent'">
                        <div style="width:36px;height:36px;border-radius:10px;background:${r.color}15;color:${r.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <span class="material-icons-round" style="font-size:1.2rem;">${r.icon}</span>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:.88rem;font-weight:500;color:var(--text-primary);">${escapeHtml(r.label)}</div>
                        </div>
                        <span style="background:${r.color};color:#fff;font-size:.72rem;font-weight:700;padding:.2rem .6rem;border-radius:999px;flex-shrink:0;">${r.count}</span>
                        <span class="material-icons-round" style="font-size:1rem;color:var(--text-tertiary);flex-shrink:0;">chevron_right</span>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
}
