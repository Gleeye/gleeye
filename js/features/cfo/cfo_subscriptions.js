// CFO Virtuale — Cash-out Abbonamenti
// Vista #cfo-subscriptions: totali annuo/mensile, breakdown categoria,
// top 5, alert tool inutilizzati, rinnovi prossimi 60gg.

import { supabase } from '/js/modules/config.js?v=8000';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderCFOSubscriptions(container) {
    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1200px; margin: 0 auto; padding: 1rem;">
            <div style="margin-bottom: 1.5rem;">
                <h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 .35rem; color: var(--text-primary);">Cash-out abbonamenti</h1>
                <p style="margin: 0; color: var(--text-secondary); font-size: .9rem;">
                    Proiezione annuale e mensile dei costi ricorrenti, con alert su tool inutilizzati e rinnovi imminenti.
                </p>
            </div>
            <div id="cfo-subs-body">
                <div style="padding: 3rem; text-align: center; color: var(--text-tertiary);">Caricamento…</div>
            </div>
        </div>
    `;

    const body = container.querySelector('#cfo-subs-body');
    const { data, error } = await supabase.rpc('fn_subscription_dashboard');

    if (error) {
        body.innerHTML = `<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;color:#dc2626;">Errore: ${esc(error.message)}</div>`;
        return;
    }

    if (!data || !data.count) {
        body.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: var(--text-tertiary); background: var(--bg-secondary); border-radius: 12px;">
                <span class="material-icons-round" style="font-size: 2.5rem; opacity: .4; margin-bottom: .75rem; display: block;">subscriptions</span>
                Nessun abbonamento configurato.<br>
                <span style="font-size:.85rem;">Vai in <a href="#suppliers" style="color: #8b5cf6;">Fornitori</a> e segna importo + frequenza sui fornitori ricorrenti.</span>
            </div>
        `;
        return;
    }

    const top5Html = (data.top5 || []).map(t => {
        const inactive = (t.invoices_last_6m === 0);
        return `<div style="display:flex;align-items:center;gap:.6rem;padding:.65rem .85rem;background:var(--bg-tertiary);border-radius:10px;border:1px solid var(--glass-border);${inactive ? 'opacity:.85;' : ''}">
            <span style="font-size:.9rem;font-weight:600;color:var(--text-primary);flex:1;">${esc(t.name)}</span>
            <span style="font-size:.7rem;color:var(--text-tertiary);text-transform:uppercase;">${esc(t.frequency || '—')}</span>
            <span style="font-size:.9rem;font-weight:700;color:var(--text-primary);">${fmt(t.yearly_cost)}€<span style="color:var(--text-tertiary);font-weight:400;font-size:.75rem;">/anno</span></span>
            ${inactive ? '<span style="font-size:.62rem;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(245,158,11,.15);color:#d97706;text-transform:uppercase;letter-spacing:.04em;" title="Nessuna fattura ricevuta negli ultimi 6 mesi">Inattivo</span>' : ''}
        </div>`;
    }).join('');

    const catHtml = (data.by_category || []).map(c => {
        const pct = data.yearly_total > 0 ? Math.round((c.yearly_cost / data.yearly_total) * 100) : 0;
        return `<div style="margin-bottom:.75rem;">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text-secondary);margin-bottom:.3rem;">
                <span style="text-transform:capitalize;">${esc((c.category || 'altro').replace(/_/g,' '))} <span style="color:var(--text-tertiary);">(${c.count})</span></span>
                <span style="font-weight:600;color:var(--text-primary);">${fmt(c.yearly_cost)}€ <span style="color:var(--text-tertiary);">(${pct}%)</span></span>
            </div>
            <div style="width:100%;height:8px;background:var(--bg-tertiary);border-radius:999px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:#8b5cf6;"></div>
            </div>
        </div>`;
    }).join('');

    const upcomingHtml = (data.upcoming || []).map(u => {
        const urgency = u.days_to_renewal <= 7 ? '#ef4444' : u.days_to_renewal <= 30 ? '#f59e0b' : '#3b82f6';
        return `<div style="display:flex;align-items:center;gap:.6rem;padding:.55rem .8rem;background:var(--bg-tertiary);border-radius:10px;font-size:.85rem;">
            <span style="font-weight:600;color:var(--text-primary);flex:1;">${esc(u.name)}</span>
            <span style="color:var(--text-tertiary);">${fmt2(u.subscription_amount)}€</span>
            <span style="font-weight:700;color:${urgency};">${u.days_to_renewal}gg</span>
        </div>`;
    }).join('');

    body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
            <div class="glass-card" style="padding:1.25rem;border:1px solid rgba(139,92,246,.18);background:linear-gradient(135deg,rgba(139,92,246,.06),rgba(139,92,246,.01));">
                <div style="font-size:.7rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Costo annuo</div>
                <div style="font-size:2rem;font-weight:800;color:#8b5cf6;font-family:var(--font-titles);line-height:1;">${fmt(data.yearly_total)}€</div>
                <div style="font-size:.72rem;color:var(--text-tertiary);margin-top:.4rem;">${data.count} abbonament${data.count === 1 ? 'o' : 'i'} attivo</div>
            </div>
            <div class="glass-card" style="padding:1.25rem;border:1px solid var(--glass-border);">
                <div style="font-size:.7rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Costo mensile medio</div>
                <div style="font-size:2rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);line-height:1;">${fmt2(data.monthly_total)}€</div>
                <div style="font-size:.72rem;color:var(--text-tertiary);margin-top:.4rem;">Proiezione equivalente</div>
            </div>
        </div>

        ${data.orphans?.length ? `
            <div class="glass-card" style="padding:1.25rem;margin-bottom:1.5rem;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">
                    <span class="material-icons-round" style="font-size:1.1rem;color:#d97706;">warning_amber</span>
                    <span style="font-weight:700;font-size:.95rem;color:#d97706;">${data.orphans.length} tool senza fattura ricevuta da 6+ mesi</span>
                </div>
                <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.85rem;">
                    Potenziale risparmio: <strong style="color:var(--text-primary);">${fmt(data.orphans.reduce((s,o) => s + (o.yearly_cost || 0), 0))}€/anno</strong> se cancelli quelli che non usi più.
                </div>
                <div style="display:flex;flex-direction:column;gap:.4rem;">
                    ${data.orphans.map(o => `<div style="display:flex;justify-content:space-between;padding:.5rem .7rem;background:rgba(255,255,255,.5);border-radius:8px;font-size:.82rem;">
                        <span style="color:var(--text-primary);font-weight:500;">${esc(o.name)}</span>
                        <span style="color:#d97706;font-weight:700;">${fmt(o.yearly_cost)}€/anno</span>
                    </div>`).join('')}
                </div>
            </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">
            <div class="glass-card" style="padding:1.25rem;">
                <div style="font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:1rem;">Distribuzione per categoria</div>
                ${catHtml || '<div style="color:var(--text-tertiary);font-size:.85rem;">Niente categorie</div>'}
            </div>
            <div class="glass-card" style="padding:1.25rem;">
                <div style="font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:1rem;">Top 5 per costo annuo</div>
                <div style="display:flex;flex-direction:column;gap:.4rem;">
                    ${top5Html || '<div style="color:var(--text-tertiary);font-size:.85rem;">Niente abbonamenti</div>'}
                </div>
            </div>
        </div>

        ${upcomingHtml ? `
            <div class="glass-card" style="padding:1.25rem;margin-top:1.25rem;">
                <div style="font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:1rem;">Rinnovi prossimi 60 giorni</div>
                <div style="display:flex;flex-direction:column;gap:.4rem;">${upcomingHtml}</div>
            </div>
        ` : ''}

        <div style="text-align:right;margin-top:1.25rem;">
            <a href="#suppliers" style="font-size:.85rem;color:#8b5cf6;text-decoration:none;font-weight:600;">Gestisci fornitori e abbonamenti →</a>
        </div>
    `;
}
