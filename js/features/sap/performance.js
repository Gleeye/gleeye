// SAP-6 — Performance Dashboard per singolo SAP
// Mostra KPI reali: tasso accettazione, prezzo medio, margine, tempi.
// Query su orders con sap_service_id = serviceId.

import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount } from '../../modules/utils.js?v=8000';

export async function renderSapPerformance(containerId, serviceId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; padding:2rem; color:var(--text-tertiary);"><span class="material-icons-round" style="animation:spin 1s linear infinite;">autorenew</span></div>`;

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, offer_status, price_final, price_planned, cost_final, cost_planned, created_at')
        .eq('sap_service_id', serviceId)
        .order('created_at', { ascending: false });

    if (error || !orders) {
        container.innerHTML = `<div style="padding:1rem; font-size:0.82rem; color:var(--text-tertiary);">Nessun dato disponibile.</div>`;
        return;
    }

    if (orders.length === 0) {
        container.innerHTML = `
            <div style="padding:1.5rem; text-align:center; color:var(--text-tertiary); font-size:0.85rem;">
                <span class="material-icons-round" style="font-size:2rem; display:block; margin-bottom:0.5rem; opacity:0.4;">bar_chart</span>
                Nessun ordine da questo SAP ancora.<br>
                <span style="font-size:0.78rem;">I KPI appariranno dopo il primo ordine creato.</span>
            </div>`;
        return;
    }

    const accepted = orders.filter(o => ['accettata', 'vinta'].includes(o.offer_status));
    const total    = orders.length;
    const accRate  = total > 0 ? Math.round((accepted.length / total) * 100) : 0;

    const avgPrice = accepted.length > 0
        ? Math.round(accepted.reduce((s, o) => s + (Number(o.price_final || o.price_planned) || 0), 0) / accepted.length)
        : 0;

    const avgCost = accepted.length > 0
        ? Math.round(accepted.reduce((s, o) => s + (Number(o.cost_final || o.cost_planned) || 0), 0) / accepted.length)
        : 0;

    const avgMargin = avgPrice > 0 ? Math.round(((avgPrice - avgCost) / avgPrice) * 100) : 0;

    const kpis = [
        {
            icon: 'percent',
            label: 'Tasso accettazione',
            value: `${accRate}%`,
            sub: `${accepted.length}/${total} offerte`,
            color: accRate >= 60 ? '#10b981' : accRate >= 40 ? '#f59e0b' : '#ef4444',
        },
        {
            icon: 'euro',
            label: 'Prezzo medio realizzato',
            value: avgPrice > 0 ? `${formatAmount(avgPrice)}€` : '—',
            sub: accepted.length > 0 ? `su ${accepted.length} commesse` : 'nessuna accettata',
            color: 'var(--brand-blue)',
        },
        {
            icon: 'trending_up',
            label: 'Margine medio',
            value: avgMargin > 0 ? `${avgMargin}%` : '—',
            sub: avgCost > 0 ? `costo medio ${formatAmount(avgCost)}€` : '',
            color: avgMargin >= 40 ? '#10b981' : avgMargin >= 20 ? '#f59e0b' : '#ef4444',
        },
        {
            icon: 'receipt_long',
            label: 'Totale ordini',
            value: total.toString(),
            sub: `${accepted.length} accettati`,
            color: 'var(--text-primary)',
        },
    ];

    const recentRows = orders.slice(0, 5).map(o => {
        const isAcc = ['accettata', 'vinta'].includes(o.offer_status);
        const price = Number(o.price_final || o.price_planned) || 0;
        return `
            <tr style="border-bottom:1px solid var(--glass-border);">
                <td style="padding:0.5rem 0; font-size:0.8rem; color:var(--text-secondary);">${new Date(o.created_at).toLocaleDateString('it-IT')}</td>
                <td style="padding:0.5rem 0.5rem; font-size:0.8rem;">
                    <span style="padding:2px 7px; border-radius:6px; font-size:0.72rem; font-weight:700; background:${isAcc ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)'}; color:${isAcc ? '#10b981' : '#ef4444'};">
                        ${isAcc ? 'Accettata' : o.offer_status || '—'}
                    </span>
                </td>
                <td style="padding:0.5rem 0; font-size:0.8rem; font-weight:700; color:var(--text-primary); text-align:right;">${price > 0 ? formatAmount(price) + '€' : '—'}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
                ${kpis.map(k => `
                    <div style="padding:0.85rem 1rem; background:white; border:1px solid var(--glass-border); border-radius:12px;">
                        <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                            <span class="material-icons-round" style="font-size:0.95rem; color:${k.color};">${k.icon}</span>
                            <span style="font-size:0.65rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary);">${k.label}</span>
                        </div>
                        <div style="font-size:1.3rem; font-weight:800; color:${k.color}; font-family:var(--font-titles); line-height:1;">${k.value}</div>
                        ${k.sub ? `<div style="font-size:0.7rem; color:var(--text-tertiary); margin-top:0.25rem;">${k.sub}</div>` : ''}
                    </div>
                `).join('')}
            </div>

            ${orders.length > 0 ? `
                <div>
                    <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Ultimi ordini</div>
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="text-align:left; font-size:0.65rem; color:var(--text-tertiary); font-weight:700; padding-bottom:0.35rem;">Data</th>
                                <th style="text-align:left; font-size:0.65rem; color:var(--text-tertiary); font-weight:700; padding-bottom:0.35rem; padding-left:0.5rem;">Stato</th>
                                <th style="text-align:right; font-size:0.65rem; color:var(--text-tertiary); font-weight:700; padding-bottom:0.35rem;">Valore</th>
                            </tr>
                        </thead>
                        <tbody>${recentRows}</tbody>
                    </table>
                </div>
            ` : ''}
        </div>
    `;
}
