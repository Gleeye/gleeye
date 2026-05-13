/**
 * pricing/index.js
 * Dashboard Pricing Intelligence — 5 sezioni, dati reali + analisi AI.
 */

import { formatAmount } from '../../modules/utils.js?v=8000';
import {
    loadAllStaticData,
    analyzeWinLoss,
    analyzeMargins,
    analyzeSensitivity,
    analyzePricingSuggestions,
    analyzeLostDeals,
} from './ai_analysis.js?v=8000';

// ─── costanti ────────────────────────────────────────────────────────────

const TABS = [
    { id: 'win_loss',    icon: 'trending_up',     label: 'Win/Loss' },
    { id: 'margin',      icon: 'account_balance',  label: 'Margini' },
    { id: 'sensitivity', icon: 'tune',             label: 'Sensitivity' },
    { id: 'suggestions', icon: 'lightbulb',        label: 'Prezzi Ottimali' },
    { id: 'lost_deal',   icon: 'restore',          label: 'Lost Deal Recovery' },
];

const ANALYSIS_FNS = {
    win_loss:    analyzeWinLoss,
    margin:      analyzeMargins,
    sensitivity: analyzeSensitivity,
    suggestions: analyzePricingSuggestions,
    lost_deal:   analyzeLostDeals,
};

let _data = null;
let _activeTab = 'win_loss';

// ─── entry point ─────────────────────────────────────────────────────────

export async function renderPricingDashboard(container) {
    container.innerHTML = renderShell();
    attachTabListeners(container);

    try {
        _data = await loadAllStaticData();
        renderTab(container, _activeTab);
    } catch (err) {
        container.querySelector('#pricing-content').innerHTML =
            `<div class="glass-card" style="padding:2rem;color:var(--danger);">
                <span class="material-icons-round">error</span>
                Errore caricamento dati: ${err.message}
             </div>`;
    }
}

// ─── shell HTML ──────────────────────────────────────────────────────────

function renderShell() {
    return `
<div class="pricing-dashboard animate-fade-in" style="padding-bottom:4rem;">

    <div class="glass-card" style="margin-bottom:1.5rem;padding:1.25rem 1.5rem;display:flex;justify-content:space-between;align-items:center;">
        <div>
            <h2 style="font-family:var(--font-titles);font-size:1.4rem;margin:0 0 0.2rem;">
                Pricing Intelligence
            </h2>
            <p style="margin:0;font-size:0.8rem;color:var(--text-secondary);">
                Win/Loss · Margini · Sensitivity · Prezzi ottimali · Lost Deal Recovery
            </p>
        </div>
        <div style="font-size:0.75rem;color:var(--text-secondary);text-align:right;">
            Analisi AI su dati reali<br>Cache 24h per ogni sezione
        </div>
    </div>

    <div class="segmented-control" style="margin-bottom:1.5rem;flex-wrap:wrap;gap:0.25rem;" id="pricing-tabs">
        ${TABS.map(t => `
        <button class="segment${t.id === _activeTab ? ' active' : ''}" data-tab="${t.id}" style="display:flex;align-items:center;gap:0.4rem;">
            <span class="material-icons-round" style="font-size:1rem;">${t.icon}</span>
            ${t.label}
        </button>`).join('')}
    </div>

    <div id="pricing-content">
        ${renderSkeleton()}
    </div>
</div>`;
}

function renderSkeleton() {
    return `<div style="display:flex;flex-direction:column;gap:1rem;">
        ${[1,2,3].map(() => `<div class="glass-card" style="height:80px;background:var(--glass-bg);animation:pulse 1.5s infinite;border-radius:12px;"></div>`).join('')}
    </div>`;
}

// ─── tab listeners ───────────────────────────────────────────────────────

function attachTabListeners(container) {
    container.querySelector('#pricing-tabs').addEventListener('click', e => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        _activeTab = btn.dataset.tab;
        container.querySelectorAll('#pricing-tabs .segment').forEach(b => b.classList.toggle('active', b === btn));
        if (_data) renderTab(container, _activeTab);
    });
}

// ─── tab dispatcher ──────────────────────────────────────────────────────

function renderTab(container, tabId) {
    const el = container.querySelector('#pricing-content');
    switch (tabId) {
        case 'win_loss':    el.innerHTML = renderWinLoss(_data);    break;
        case 'margin':      el.innerHTML = renderMargin(_data);     break;
        case 'sensitivity': el.innerHTML = renderSensitivity(_data); break;
        case 'suggestions': el.innerHTML = renderSuggestions(_data); break;
        case 'lost_deal':   el.innerHTML = renderLostDeal(_data);   break;
    }
    attachAiButtonListener(container, tabId);
}

// ─── pulsante AI generico ────────────────────────────────────────────────

function attachAiButtonListener(container, tabId) {
    const btn = container.querySelector('[data-ai-analyze]');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const boxId = btn.dataset.aiAnalyze;
        const box = container.querySelector(`#${boxId}`);
        if (!box) return;

        btn.disabled = true;
        btn.innerHTML = `<span class="material-icons-round" style="animation:spin 1s linear infinite;font-size:1rem;">refresh</span> Analisi in corso…`;
        box.innerHTML = `<div style="color:var(--text-secondary);font-size:0.85rem;">Invio dati a Claude Sonnet…</div>`;

        try {
            const fn = ANALYSIS_FNS[tabId];
            const result = await fn();
            box.innerHTML = renderAiBox(result.narrative, result._cached, result._cached_at);
        } catch (err) {
            box.innerHTML = `<div style="color:var(--danger);font-size:0.85rem;">Errore: ${err.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span> Rigenera analisi`;
        }
    });
}

function renderAiBox(narrative, cached = false, cachedAt = null) {
    const lines = (narrative || '').split('\n').filter(l => l.trim());
    const cacheNote = cached && cachedAt
        ? `<span style="font-size:0.7rem;color:var(--text-secondary);margin-left:0.5rem;">· cache ${new Date(cachedAt).toLocaleDateString('it-IT')}</span>`
        : '';
    return `
<div style="background:var(--glass-bg-2,rgba(255,255,255,0.04));border:1px solid var(--glass-border);border-radius:10px;padding:1.25rem;">
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;font-size:0.8rem;color:var(--text-secondary);">
        <span class="material-icons-round" style="font-size:1rem;color:var(--brand-viola);">auto_awesome</span>
        Claude Sonnet — Pricing Intelligence${cacheNote}
    </div>
    <div style="font-size:0.88rem;line-height:1.65;color:var(--text-primary);white-space:pre-wrap;">${escapeHtml(narrative || 'Nessuna analisi disponibile.')}</div>
</div>`;
}

function aiSection(tabId, label = 'Genera analisi AI') {
    return `
<div class="glass-card" style="padding:1.25rem 1.5rem;margin-top:1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1rem;display:flex;align-items:center;gap:0.5rem;">
            <span class="material-icons-round" style="color:var(--brand-viola);">auto_awesome</span>
            Analisi AI
        </h3>
        <button class="btn btn-secondary" data-ai-analyze="ai-box-${tabId}" style="font-size:0.8rem;display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.9rem;">
            <span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>
            ${label}
        </button>
    </div>
    <div id="ai-box-${tabId}" style="color:var(--text-secondary);font-size:0.85rem;">
        Premi il pulsante per generare l'analisi con Claude Sonnet (cache 24h).
    </div>
</div>`;
}

// ─── Sezione 1: Win/Loss ─────────────────────────────────────────────────

function renderWinLoss({ winLoss: s }) {
    const winColor = s.win_rate >= 60 ? '#10b981' : s.win_rate >= 40 ? '#f59e0b' : '#ef4444';

    return `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.25rem;">
    ${kpiCard('Win Rate', `${s.win_rate}%`, 'trending_up', winColor)}
    ${kpiCard('Offerte Accettate', s.accepted, 'check_circle', '#10b981')}
    ${kpiCard('Offerte Rifiutate', s.rejected, 'cancel', '#ef4444')}
    ${kpiCard('Prezzo Medio Vinte', `€${formatAmount(s.avg_price_accepted)}`, 'euro', 'var(--brand-viola)')}
    ${kpiCard('Prezzo Medio Perse', `€${formatAmount(s.avg_price_rejected)}`, 'money_off', 'var(--text-secondary)')}
    ${kpiCard('Revenue Persa (rifiutate)', `€${formatAmount(s.revenue_rejected)}`, 'savings', '#f59e0b')}
</div>

<div class="glass-card" style="padding:1.25rem 1.5rem;">
    <h3 style="margin:0 0 1rem;font-size:1rem;">Win Rate per Categoria</h3>
    <div style="display:flex;flex-direction:column;gap:0.6rem;">
        ${s.by_category.map(c => `
        <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;font-size:0.85rem;">
                <span>${c.category}</span>
                <span style="color:var(--text-secondary);">${c.accepted}/${c.total} → <strong style="color:${c.win_rate>=60?'#10b981':c.win_rate>=40?'#f59e0b':'#ef4444'}">${c.win_rate}%</strong></span>
            </div>
            <div style="height:6px;background:var(--glass-border);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${c.win_rate}%;background:${c.win_rate>=60?'#10b981':c.win_rate>=40?'#f59e0b':'#ef4444'};border-radius:3px;transition:width 0.5s;"></div>
            </div>
        </div>`).join('')}
    </div>
</div>

${aiSection('win_loss', 'Analizza Win/Loss con AI')}`;
}

// ─── Sezione 2: Margin Calibration ───────────────────────────────────────

function renderMargin({ margins: s }) {
    const marginColor = s.avg_margin_pct >= 45 ? '#10b981' : s.avg_margin_pct >= 30 ? '#f59e0b' : '#ef4444';

    return `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.25rem;">
    ${kpiCard('Margine Medio', `${s.avg_margin_pct}%`, 'percent', marginColor)}
    ${kpiCard('Fatturato Totale', `€${formatAmount(s.total_revenue)}`, 'euro', 'var(--brand-viola)')}
    ${kpiCard('Costi Totali', `€${formatAmount(s.total_cost)}`, 'receipt', 'var(--text-secondary)')}
    ${kpiCard('Margine Totale', `€${formatAmount(s.total_margin)}`, 'account_balance', '#10b981')}
</div>

<div class="glass-card" style="padding:1.25rem 1.5rem;margin-bottom:1.25rem;">
    <h3 style="margin:0 0 1rem;font-size:1rem;">Margine per Categoria</h3>
    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead>
            <tr style="color:var(--text-secondary);border-bottom:1px solid var(--glass-border);">
                <th style="text-align:left;padding:0.4rem 0.5rem;">Categoria</th>
                <th style="text-align:right;padding:0.4rem 0.5rem;">Ordini</th>
                <th style="text-align:right;padding:0.4rem 0.5rem;">Fatturato</th>
                <th style="text-align:right;padding:0.4rem 0.5rem;">Costo</th>
                <th style="text-align:right;padding:0.4rem 0.5rem;">Margine %</th>
            </tr>
        </thead>
        <tbody>
            ${s.by_category.map(c => `
            <tr style="border-bottom:1px solid var(--glass-border);">
                <td style="padding:0.4rem 0.5rem;">${c.category}</td>
                <td style="text-align:right;padding:0.4rem 0.5rem;">${c.count}</td>
                <td style="text-align:right;padding:0.4rem 0.5rem;">€${formatAmount(c.revenue)}</td>
                <td style="text-align:right;padding:0.4rem 0.5rem;">€${formatAmount(c.cost)}</td>
                <td style="text-align:right;padding:0.4rem 0.5rem;font-weight:600;color:${c.margin_pct>=45?'#10b981':c.margin_pct>=30?'#f59e0b':'#ef4444'};">${c.margin_pct}%</td>
            </tr>`).join('')}
        </tbody>
    </table>
</div>

<div class="glass-card" style="padding:1.25rem 1.5rem;">
    <h3 style="margin:0 0 1rem;font-size:1rem;">Outlier — Margine Basso (accettati, &lt;30%)</h3>
    ${s.orders.filter(o => o.margin_pct < 30 && o.price > 0).length === 0
        ? `<p style="color:var(--text-secondary);font-size:0.85rem;">Nessun ordine con margine sotto 30%. Ottimo!</p>`
        : `<div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${s.orders.filter(o => o.margin_pct < 30 && o.price > 0).map(o => `
            <div style="display:flex;justify-content:space-between;padding:0.5rem 0.75rem;background:rgba(239,68,68,0.06);border-radius:8px;font-size:0.83rem;">
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(o.title)}">${escapeHtml(o.title)}</span>
                <span style="margin-left:1rem;white-space:nowrap;">€${formatAmount(o.price)} · <strong style="color:#ef4444;">${o.margin_pct}%</strong></span>
            </div>`).join('')}
          </div>`
    }
</div>

${aiSection('margin', 'Analizza Margini con AI')}`;
}

// ─── Sezione 3: Sensitivity ───────────────────────────────────────────────

function renderSensitivity({ sensitivity: s }) {
    if (!s.length) return `<div class="glass-card" style="padding:2rem;color:var(--text-secondary);">Dati insufficienti per la sensitivity analysis. Servono almeno 2 offerte accettate e rifiutate per categoria.</div>`;

    return `
<div class="glass-card" style="padding:1.25rem 1.5rem;margin-bottom:1.25rem;">
    <h3 style="margin:0 0 0.5rem;font-size:1rem;">Headroom di prezzo per categoria</h3>
    <p style="margin:0 0 1rem;font-size:0.8rem;color:var(--text-secondary);">Stima della differenza tra prezzi vinti e persi — indica quanto spazio c'è per aumenti senza perdere significativamente win rate.</p>
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
        ${s.map(c => `
        <div class="glass-card" style="padding:0.9rem 1.1rem;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
                <div>
                    <strong style="font-size:0.9rem;">${c.category}</strong>
                    <span style="font-size:0.75rem;color:var(--text-secondary);margin-left:0.5rem;">${c.win_count} vinte · ${c.lost_count} perse</span>
                </div>
                <span style="font-size:0.75rem;padding:0.2rem 0.6rem;border-radius:20px;background:${c.headroom_pct>=15?'rgba(16,185,129,0.15)':c.headroom_pct>=5?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.1)'};color:${c.headroom_pct>=15?'#10b981':c.headroom_pct>=5?'#f59e0b':'#ef4444'};">
                    ${c.recommendation}
                </span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0.5rem;font-size:0.8rem;color:var(--text-secondary);">
                <span>Prezzo medio vinte: <strong style="color:var(--text-primary);">€${formatAmount(c.avg_price_won)}</strong></span>
                ${c.avg_price_lost !== null ? `<span>Prezzo medio perse: <strong style="color:var(--text-primary);">€${formatAmount(c.avg_price_lost)}</strong></span>` : ''}
                <span>Win rate: <strong style="color:var(--text-primary);">${c.win_rate}%</strong></span>
                <span>Headroom: <strong style="color:var(--text-primary);">+${c.headroom_pct}%</strong></span>
                <span>Sim. +10% = +€${formatAmount(c.sim_increase_10)} per ordine</span>
            </div>
        </div>`).join('')}
    </div>
</div>

${aiSection('sensitivity', 'Analizza Sensitivity con AI')}`;
}

// ─── Sezione 4: Prezzi Ottimali ───────────────────────────────────────────

function renderSuggestions({ suggestions: s }) {
    const toRevise = s.filter(x => x.delta_pct !== 0);
    const stable   = s.filter(x => x.delta_pct === 0);

    return `
${toRevise.length > 0 ? `
<div class="glass-card" style="padding:1.25rem 1.5rem;margin-bottom:1.25rem;">
    <h3 style="margin:0 0 0.5rem;font-size:1rem;">Servizi con aggiustamento suggerito</h3>
    <p style="margin:0 0 1rem;font-size:0.8rem;color:var(--text-secondary);">Basato su dati interni win/loss. Nessun benchmark esterno — AI propone, Davide decide.</p>
    <div style="display:flex;flex-direction:column;gap:0.5rem;">
        ${toRevise.map(x => `
        <div style="display:flex;align-items:flex-start;gap:1rem;padding:0.75rem 1rem;background:var(--glass-bg);border-radius:10px;border:1px solid var(--glass-border);">
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.88rem;font-weight:600;margin-bottom:0.25rem;">${escapeHtml(x.name)}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);">${escapeHtml(x.rationale)}</div>
            </div>
            <div style="text-align:right;white-space:nowrap;">
                <div style="font-size:0.8rem;color:var(--text-secondary);text-decoration:line-through;">€${formatAmount(x.current_price)}</div>
                <div style="font-size:1rem;font-weight:700;color:${x.delta_pct>0?'#10b981':'#f59e0b'};">€${formatAmount(x.suggested_price)}</div>
                <div style="font-size:0.7rem;color:${x.delta_pct>0?'#10b981':'#f59e0b'};">+${x.delta_pct}%</div>
            </div>
        </div>`).join('')}
    </div>
</div>` : `<div class="glass-card" style="padding:1.25rem 1.5rem;margin-bottom:1.25rem;color:var(--text-secondary);">Nessun aggiustamento suggerito — tariffario già allineato con i dati storici.</div>`}

${stable.length > 0 ? `
<div class="glass-card" style="padding:1.25rem 1.5rem;margin-bottom:1.25rem;">
    <h3 style="margin:0 0 1rem;font-size:1rem;">Servizi stabili (campione)</h3>
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
        ${stable.slice(0,8).map(x => `
        <span style="padding:0.3rem 0.75rem;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:20px;font-size:0.8rem;">
            ${escapeHtml(x.name)} · €${formatAmount(x.current_price)}
        </span>`).join('')}
    </div>
</div>` : ''}

${aiSection('suggestions', 'Genera raccomandazioni AI')}`;
}

// ─── Sezione 5: Lost Deal Recovery ───────────────────────────────────────

function renderLostDeal({ lostDeals: deals }) {
    const totalValue = deals.reduce((s, d) => s + d.price, 0);
    const recoveryTarget = Math.round(totalValue * 0.27);

    return `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.25rem;">
    ${kpiCard('Deal Persi (6 mesi)', deals.length, 'cancel', '#ef4444')}
    ${kpiCard('Valore Totale', `€${formatAmount(totalValue)}`, 'savings', '#f59e0b')}
    ${kpiCard('Recovery Target (27%)', `€${formatAmount(recoveryTarget)}`, 'trending_up', '#10b981')}
</div>

<div class="glass-card" style="padding:1.25rem 1.5rem;margin-bottom:1.25rem;">
    <h3 style="margin:0 0 1rem;font-size:1rem;">Offerte da re-approcciare</h3>
    ${deals.length === 0
        ? `<p style="color:var(--text-secondary);font-size:0.85rem;">Nessuna offerta rifiutata negli ultimi 6 mesi. Ottima notizia!</p>`
        : `<div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${deals.map(d => `
            <div style="display:flex;align-items:center;gap:1rem;padding:0.75rem 1rem;background:var(--glass-bg);border-radius:10px;border:1px solid var(--glass-border);">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);">${escapeHtml(d.client_name)} · ${d.category} · ${d.days_ago}gg fa</div>
                </div>
                <div style="text-align:right;white-space:nowrap;">
                    <div style="font-size:1rem;font-weight:700;">€${formatAmount(d.price)}</div>
                    <div style="font-size:0.7rem;padding:0.15rem 0.5rem;background:rgba(239,68,68,0.1);color:#ef4444;border-radius:20px;margin-top:0.2rem;">rifiutata</div>
                </div>
            </div>`).join('')}
          </div>`
    }
</div>

${aiSection('lost_deal', 'Genera piano recovery + email AI')}`;
}

// ─── helper componenti ────────────────────────────────────────────────────

function kpiCard(label, value, icon, color) {
    return `
<div class="glass-card" style="padding:1rem 1.25rem;display:flex;flex-direction:column;gap:0.4rem;">
    <div style="display:flex;align-items:center;gap:0.4rem;color:var(--text-secondary);font-size:0.75rem;">
        <span class="material-icons-round" style="font-size:0.9rem;color:${color};">${icon}</span>
        ${label}
    </div>
    <div style="font-size:1.4rem;font-weight:700;color:${color};">${value}</div>
</div>`;
}

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
