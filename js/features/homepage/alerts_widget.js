// Centro Alert — widget homepage admin
// Aggrega in un colpo d'occhio le 6 voci che richiedono attenzione.
// Self-inserting: si posiziona prima di #hp-activity-feed-block.

import { supabase } from '/js/modules/config.js?v=8000';
import { formatAmount } from '/js/modules/utils.js?v=8000';

const CONTAINER_ID = 'hp-centro-alert-block';

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function renderAlertsWidget() {
    const feedBlock = document.getElementById('hp-activity-feed-block');
    if (!feedBlock) return;

    const existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.cssText = 'flex-shrink: 0;';
    feedBlock.parentElement.insertBefore(container, feedBlock);

    container.innerHTML = _buildSkeleton();

    try {
        const data = await _fetchAll();
        _render(container, data);
    } catch (err) {
        console.error('[alerts_widget]', err);
        container.innerHTML = '';
    }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function _fetchAll() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTs = new Date().toISOString();
    const ago30 = new Date();
    ago30.setDate(ago30.getDate() - 30);
    const ago30Str = ago30.toISOString().split('T')[0];
    const ago7 = new Date();
    ago7.setDate(ago7.getDate() - 7);
    const ago7Iso = ago7.toISOString();
    const ago90 = new Date();
    ago90.setDate(ago90.getDate() - 90);
    const ago90Str = ago90.toISOString().split('T')[0];

    const [inv, collPay, tasks, orphans, passReview, pricing, marginRisk, unbilled] = await Promise.allSettled([

        // 1. Fatture clienti scadute: inviate da più di 30gg, non ancora saldate
        supabase
            .from('invoices')
            .select('id, amount_tax_included')
            .eq('status', 'Inviata')
            .is('payment_date', null)
            .lt('invoice_date', ago30Str),

        // 2. Pagamenti collaboratori in ritardo
        supabase
            .from('payments')
            .select('id, amount')
            .eq('payment_type', 'Collaboratore')
            .neq('status', 'Completato')
            .neq('status', 'Done')
            .lt('due_date', todayStr),

        // 3. Task urgenti scadute
        supabase
            .from('pm_items')
            .select('id')
            .eq('priority', 'urgent')
            .neq('status', 'done')
            .lt('due_date', todayTs),

        // 4. Movimenti bancari orfani (90gg, posted, senza invoice)
        supabase
            .from('bank_transactions')
            .select('id, linked_invoices')
            .eq('status', 'posted')
            .gte('date', ago90Str)
            .is('active_invoice_id', null)
            .is('passive_invoice_id', null),

        // 5. Fatture passive in attesa di revisione AI
        supabase
            .from('passive_invoices')
            .select('id')
            .eq('review_status', 'pending'),

        // 6. Run Pricing AI recenti (ultimi 7gg) — alert se presenti
        supabase
            .from('pricing_analysis_runs')
            .select('id')
            .eq('status', 'done')
            .gte('created_at', ago7Iso),

        // 7. Commesse a rischio margine: accettate, non chiuse, con incarichi
        //    firmati che sforano cost_final di più del 10%.
        //    Strategia: prendiamo orders attivi + tutti i loro assignments, poi
        //    aggregiamo client-side (nessuna view dedicata per ora).
        (async () => {
            const { data: orders, error: e1 } = await supabase
                .from('orders')
                .select('id, order_number, title, cost_final, offer_status, status_works')
                .eq('offer_status', 'accettata');
            if (e1) return { data: [], error: e1 };
            const activeOrders = (orders || []).filter(o => {
                const sw = (o.status_works || '').toLowerCase();
                return !['completato', 'chiuso'].includes(sw)
                    && Number(o.cost_final) > 0;
            });
            if (activeOrders.length === 0) return { data: [], error: null };
            const orderIds = activeOrders.map(o => o.id);
            const { data: asgs, error: e2 } = await supabase
                .from('assignments')
                .select('id, order_id, amount')
                .in('order_id', orderIds);
            if (e2) return { data: [], error: e2 };
            const byOrder = {};
            (asgs || []).forEach(a => {
                if (!a.order_id) return;
                byOrder[a.order_id] = (byOrder[a.order_id] || 0) + Number(a.amount || 0);
            });
            // Solo ordini CON almeno un incarico e con erosione effettiva > 10%
            const eroded = activeOrders.map(o => {
                const realCost = byOrder[o.id] || 0;
                if (realCost === 0) return null;
                const erosionPct = ((realCost - Number(o.cost_final)) / Number(o.cost_final)) * 100;
                if (erosionPct <= 10) return null;
                return {
                    id: o.id,
                    order_number: o.order_number,
                    title: o.title,
                    erosionPct: Math.round(erosionPct),
                    erosionAmount: realCost - Number(o.cost_final),
                };
            }).filter(Boolean).sort((a, b) => b.erosionPct - a.erosionPct);
            return { data: eroded, error: null };
        })(),

        // 8. Commesse chiuse (status_works=completato) con residuo da fatturare.
        //    Lavoro finito ma fattura mai emessa o solo parziale.
        (async () => {
            const { data: orders, error: e1 } = await supabase
                .from('orders')
                .select('id, order_number, title, price_final')
                .eq('status_works', 'completato')
                .gt('price_final', 0);
            if (e1) return { data: [], error: e1 };
            if (!orders || orders.length === 0) return { data: [], error: null };
            const orderIds = orders.map(o => o.id);
            // Fatture linkate via linked_orders (jsonb array) o order_id legacy
            const { data: invs, error: e2 } = await supabase
                .from('invoices')
                .select('id, order_id, linked_orders, amount_tax_excluded');
            if (e2) return { data: [], error: e2 };
            const billedByOrder = {};
            (invs || []).forEach(inv => {
                const amount = Number(inv.amount_tax_excluded || 0);
                if (Array.isArray(inv.linked_orders)) {
                    inv.linked_orders.forEach(oid => {
                        if (orderIds.includes(oid)) {
                            billedByOrder[oid] = (billedByOrder[oid] || 0) + amount;
                        }
                    });
                } else if (inv.order_id && orderIds.includes(inv.order_id)) {
                    billedByOrder[inv.order_id] = (billedByOrder[inv.order_id] || 0) + amount;
                }
            });
            const unbilledOrders = orders.map(o => {
                const billed = billedByOrder[o.id] || 0;
                const residual = Number(o.price_final) - billed;
                if (residual <= 0.5) return null;
                return {
                    id: o.id,
                    order_number: o.order_number,
                    title: o.title,
                    residual,
                };
            }).filter(Boolean).sort((a, b) => b.residual - a.residual);
            return { data: unbilledOrders, error: null };
        })(),
    ]);

    // — voce 4: esclude i movimenti già collegati via payments o linked_invoices
    let orphanCount = 0;
    if (orphans.status === 'fulfilled' && !orphans.value.error) {
        const rows = orphans.value.data || [];
        const multiLinked = new Set(
            rows.filter(t => t.linked_invoices && t.linked_invoices.length > 0).map(t => t.id)
        );
        const ids = rows.filter(t => !multiLinked.has(t.id)).map(t => t.id);
        if (ids.length > 0) {
            const { data: linkedPay } = await supabase
                .from('payments')
                .select('bank_transaction_id')
                .in('bank_transaction_id', ids);
            const linkedSet = new Set((linkedPay || []).map(p => p.bank_transaction_id));
            orphanCount = ids.filter(id => !linkedSet.has(id)).length;
        }
    }

    const invRows   = inv.status   === 'fulfilled' && !inv.value.error   ? inv.value.data   || [] : [];
    const payRows   = collPay.status === 'fulfilled' && !collPay.value.error ? collPay.value.data || [] : [];
    const taskRows  = tasks.status  === 'fulfilled' && !tasks.value.error  ? tasks.value.data  || [] : [];
    const passRows  = passReview.status === 'fulfilled' && !passReview.value.error ? passReview.value.data || [] : [];
    const pricingRows = pricing.status === 'fulfilled' && !pricing.value.error ? pricing.value.data || [] : [];
    const marginRiskRows = marginRisk.status === 'fulfilled' && !marginRisk.value.error ? marginRisk.value.data || [] : [];
    const unbilledRows = unbilled.status === 'fulfilled' && !unbilled.value.error ? unbilled.value.data || [] : [];

    const invTotal  = invRows.reduce((s, r) => s + Number(r.amount_tax_included || 0), 0);
    const payTotal  = payRows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const marginTotal = marginRiskRows.reduce((s, r) => s + Number(r.erosionAmount || 0), 0);
    const unbilledTotal = unbilledRows.reduce((s, r) => s + Number(r.residual || 0), 0);

    return {
        invoices:    { count: invRows.length,   total: invTotal },
        collabPay:   { count: payRows.length,    total: payTotal },
        urgentTasks: { count: taskRows.length },
        orphans:     { count: orphanCount },
        passReview:  { count: passRows.length },
        pricing:     { count: pricingRows.length },
        marginRisk:  { count: marginRiskRows.length, total: marginTotal, top: marginRiskRows[0] || null },
        unbilled:    { count: unbilledRows.length, total: unbilledTotal, top: unbilledRows[0] || null },
    };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function _render(container, data) {
    const rows = _buildRows(data);
    const hasAlerts = rows.some(r => r.count > 0);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);

    const bgStyle = hasAlerts
        ? 'background: linear-gradient(135deg, rgba(255,241,242,0.85), rgba(255,255,255,0.95)); border: 1px solid rgba(251,113,133,0.18); box-shadow: 0 10px 25px -5px rgba(251,113,133,0.1), 0 8px 10px -6px rgba(251,113,133,0.06);'
        : 'background: white; border: 1px solid #f1f5f9; box-shadow: 0 4px 15px rgba(0,0,0,0.03);';

    const badgeHtml = hasAlerts
        ? '<span style="display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; background: #ef4444; color: white; font-size: 0.65rem; font-weight: 800; border-radius: 10px; padding: 0 5px;">'
          + totalCount + '</span>'
        : '';

    let itemsHtml;
    if (!hasAlerts) {
        itemsHtml = '<div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; color: #16a34a; opacity: 0.8;">'
            + '<span class="material-icons-round" style="font-size: 15px;">check_circle</span>'
            + '<span style="font-size: 0.78rem; font-weight: 500;">Tutto in ordine</span>'
            + '</div>';
    } else {
        itemsHtml = rows
            .filter(r => r.count > 0)
            .map(r => _buildRow(r))
            .join('');
    }

    container.innerHTML = '<div style="border-radius: 28px; padding: 1.25rem 1.5rem; ' + bgStyle + '">'
        + '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.85rem; flex-shrink: 0;">'
        +   '<div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.6);">'
        +     '<span class="material-icons-round" style="font-size: 18px; color: ' + (hasAlerts ? '#ef4444' : '#64748b') + ';">crisis_alert</span>'
        +   '</div>'
        +   '<h4 style="font-family: \'Outfit\', sans-serif; font-size: 0.9rem; font-weight: 700; color: #1e293b; margin: 0; flex: 1; letter-spacing: -0.01em;">Centro Alert</h4>'
        +   badgeHtml
        + '</div>'
        + '<div style="display: flex; flex-direction: column; gap: 2px;">'
        +   itemsHtml
        + '</div>'
        + '</div>';
}

function _buildRows(data) {
    return [
        {
            count:   data.invoices.count,
            label:   'Fatture clienti scadute',
            sub:     data.invoices.count > 0 ? formatAmount(data.invoices.total) : '',
            link:    '#invoices',
            icon:    'receipt_long',
            color:   '#ef4444',
        },
        {
            count:   data.collabPay.count,
            label:   'Pagamenti collab in ritardo',
            sub:     data.collabPay.count > 0 ? formatAmount(data.collabPay.total) : '',
            link:    '#payments',
            icon:    'payments',
            color:   '#f59e0b',
        },
        {
            count:   data.urgentTasks.count,
            label:   'Task urgenti scadute',
            sub:     '',
            link:    '#tasks-summary',
            icon:    'priority_high',
            color:   '#8b5cf6',
        },
        {
            count:   data.orphans.count,
            label:   'Movimenti senza fattura',
            sub:     '',
            link:    '#bank-orphans',
            icon:    'account_balance',
            color:   '#06b6d4',
        },
        {
            count:   data.passReview.count,
            label:   'Fatture passive da revisionare',
            sub:     '',
            link:    '#passive-invoices-collab',
            icon:    'find_in_page',
            color:   '#64748b',
        },
        {
            count:   data.pricing.count,
            label:   'Pricing AI — analisi disponibili',
            sub:     '',
            link:    '#pricing',
            icon:    'auto_graph',
            color:   '#10b981',
        },
        {
            count:   data.marginRisk.count,
            label:   data.marginRisk.count === 1
                ? 'Commessa con margine eroso'
                : 'Commesse con margine eroso',
            sub:     data.marginRisk.count > 0 ? '+' + formatAmount(data.marginRisk.total) + ' di costo' : '',
            // Click → apre la commessa più erosa. Niente nuova view, niente filtri dashboard.
            link:    data.marginRisk.top ? '#order-detail/' + data.marginRisk.top.id : '#dashboard',
            icon:    'trending_up',
            color:   '#dc2626',
        },
        {
            count:   data.unbilled.count,
            label:   data.unbilled.count === 1
                ? 'Commessa chiusa da fatturare'
                : 'Commesse chiuse da fatturare',
            sub:     data.unbilled.count > 0 ? formatAmount(data.unbilled.total) + ' sul tavolo' : '',
            // Click → apre la commessa con il residuo più alto.
            link:    data.unbilled.top ? '#order-detail/' + data.unbilled.top.id : '#dashboard',
            icon:    'receipt',
            color:   '#0d9488',
        },
    ];
}

function _buildRow(row) {
    const dot = '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ' + row.color + '; flex-shrink: 0; margin-top: 1px;"></span>';

    return '<div onclick="window.location.hash=\'' + row.link + '\'" style="'
        + 'display: flex; align-items: center; gap: 10px; padding: 7px 6px; cursor: pointer; '
        + 'border-radius: 10px; transition: background 0.15s; '
        + '" onmouseover="this.style.background=\'rgba(0,0,0,0.03)\'" onmouseout="this.style.background=\'transparent\'">'
        +   dot
        +   '<span style="font-size: 0.78rem; font-weight: 600; color: #1e293b; flex: 1; line-height: 1.2;">' + row.label + '</span>'
        +   (row.sub ? '<span style="font-size: 0.72rem; font-weight: 700; color: ' + row.color + '; flex-shrink: 0;">' + row.sub + '</span>' : '')
        +   '<span style="font-size: 0.78rem; font-weight: 800; color: ' + row.color + '; min-width: 20px; text-align: right; flex-shrink: 0;">' + row.count + '</span>'
        +   '<span class="material-icons-round" style="font-size: 14px; color: #cbd5e1; flex-shrink: 0;">chevron_right</span>'
        + '</div>';
}

function _buildSkeleton() {
    return '<div style="border-radius: 28px; padding: 1.25rem 1.5rem; background: white; border: 1px solid #f1f5f9;">'
        + '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.85rem;">'
        +   '<div style="width: 32px; height: 32px; border-radius: 10px; background: #f1f5f9;"></div>'
        +   '<div style="height: 14px; width: 100px; background: #f1f5f9; border-radius: 6px;"></div>'
        + '</div>'
        + '<div style="display: flex; flex-direction: column; gap: 8px;">'
        +   '<div style="height: 10px; background: #f8fafc; border-radius: 4px;"></div>'
        +   '<div style="height: 10px; background: #f8fafc; border-radius: 4px; width: 80%;"></div>'
        +   '<div style="height: 10px; background: #f8fafc; border-radius: 4px; width: 60%;"></div>'
        + '</div>'
        + '</div>';
}
