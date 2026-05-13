// AI Usage Dashboard — Gleeye ERP
// Mostra consumi e costi delle chiamate AI dell'app.
// Sorgente: tabella `ai_usage_log` + view `ai_usage_monthly_summary`.
// Accessibile da Amministrazione → tab "Consumi AI".

import { supabase } from '../../modules/config.js?v=8000';
import { formatAmount } from '../../modules/utils.js?v=8000';

/**
 * Render principale del pannello.
 * @param {HTMLElement} container
 */
export async function renderAIUsageDashboard(container) {
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
                <h2 style="font-family: var(--font-titles); font-size: 1.5rem; margin: 0 0 0.5rem; color: var(--text-primary);">Consumi AI</h2>
                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
                    Costi e volumi delle chiamate AI dell'app. I dati arrivano da <code>ai_usage_log</code>
                    e si aggiornano in tempo reale ad ogni chiamata.
                </p>
            </div>
            <div id="ai-usage-loading" style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
                <span class="loader" style="display: inline-block; margin-bottom: 1rem;"></span>
                <div>Caricamento dati...</div>
            </div>
            <div id="ai-usage-content" style="display: none; gap: 1.5rem; flex-direction: column;"></div>
        </div>
    `;

    try {
        await loadAndRender(container);
    } catch (err) {
        console.error('[ai_usage_dashboard] Errore:', err);
        const loading = container.querySelector('#ai-usage-loading');
        if (loading) {
            loading.innerHTML = `<div style="color: var(--error);">Errore caricamento dati: ${err.message}</div>`;
        }
    }
}

async function loadAndRender(container) {
    const loadingEl = container.querySelector('#ai-usage-loading');
    const contentEl = container.querySelector('#ai-usage-content');

    // Periodo: mese corrente + mese precedente per delta
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Query parallele
    const [
        { data: currentMonth, error: e1 },
        { data: prevMonth, error: e2 },
        { data: recentCalls, error: e3 },
        { data: byFeatureMonth, error: e4 },
    ] = await Promise.all([
        // Aggregato mese corrente
        supabase
            .from('ai_usage_log')
            .select('user_id, cost_eur, cost_usd, input_tokens, output_tokens, total_tokens, response_time_ms, success')
            .gte('created_at', monthStart),
        // Aggregato mese precedente
        supabase
            .from('ai_usage_log')
            .select('cost_eur, cost_usd, total_tokens')
            .gte('created_at', prevMonthStart)
            .lte('created_at', prevMonthEnd),
        // Ultime 50 chiamate dettagliate
        supabase
            .from('ai_usage_log')
            .select('id, created_at, user_id, feature, model, input_tokens, output_tokens, total_tokens, cost_eur, cost_usd, response_time_ms, success, error_message')
            .order('created_at', { ascending: false })
            .limit(50),
        // Aggregato per feature mese corrente
        supabase
            .from('ai_usage_log')
            .select('feature, cost_eur, cost_usd, total_tokens')
            .gte('created_at', monthStart),
    ]);

    if (e1) throw new Error(`Errore mese corrente: ${e1.message}`);
    if (e2) console.warn('[ai_usage] mese precedente:', e2);
    if (e3) console.warn('[ai_usage] recenti:', e3);
    if (e4) console.warn('[ai_usage] per feature:', e4);

    // Risolvi user_id → nome (1 query per tutti gli utenti distinti)
    const userIds = new Set();
    (currentMonth || []).forEach(r => { if (r.user_id) userIds.add(r.user_id); });
    (recentCalls || []).forEach(r => { if (r.user_id) userIds.add(r.user_id); });

    const userMap = {};
    if (userIds.size > 0) {
        const { data: profiles, error: pe } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', Array.from(userIds));
        if (pe) {
            console.warn('[ai_usage] errore profili:', pe);
        } else {
            (profiles || []).forEach(p => {
                userMap[p.id] = p.full_name || p.email || p.id.substring(0, 8);
            });
        }
    }
    const labelUser = (uid) => uid ? (userMap[uid] || uid.substring(0, 8) + '…') : 'Sistema';

    // Calcoli
    const totals = aggregate(currentMonth || []);
    const prevTotals = aggregate(prevMonth || []);
    const featureBreakdown = groupBy(byFeatureMonth || [], 'feature');
    const userBreakdown = groupByUser(currentMonth || [], labelUser);

    // Render
    contentEl.innerHTML = `
        ${renderKPIs(totals, prevTotals)}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;" class="ai-usage-breakdowns">
            ${renderFeatureBreakdown(featureBreakdown)}
            ${renderUserBreakdown(userBreakdown)}
        </div>
        ${renderRecentCalls(recentCalls || [], labelUser)}
    `;
    loadingEl.style.display = 'none';
    contentEl.style.display = 'flex';
}

function aggregate(rows) {
    return rows.reduce((acc, r) => {
        acc.count += 1;
        acc.costEur += Number(r.cost_eur || 0);
        acc.costUsd += Number(r.cost_usd || 0);
        acc.inputTokens += Number(r.input_tokens || 0);
        acc.outputTokens += Number(r.output_tokens || 0);
        acc.totalTokens += Number(r.total_tokens || 0);
        acc.totalMs += Number(r.response_time_ms || 0);
        if (r.success === false) acc.errors += 1;
        return acc;
    }, { count: 0, costEur: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, totalMs: 0, errors: 0 });
}

function groupBy(rows, key) {
    const map = {};
    for (const r of rows) {
        const k = r[key] || '(senza feature)';
        if (!map[k]) map[k] = { count: 0, costEur: 0, costUsd: 0, totalTokens: 0 };
        map[k].count += 1;
        map[k].costEur += Number(r.cost_eur || 0);
        map[k].costUsd += Number(r.cost_usd || 0);
        map[k].totalTokens += Number(r.total_tokens || 0);
    }
    return Object.entries(map)
        .map(([feature, stats]) => ({ feature, ...stats }))
        .sort((a, b) => b.costEur - a.costEur);
}

function groupByUser(rows, labelFn) {
    const map = {};
    for (const r of rows) {
        const k = r.user_id || '__system__';
        if (!map[k]) map[k] = { count: 0, costEur: 0, totalTokens: 0 };
        map[k].count += 1;
        map[k].costEur += Number(r.cost_eur || 0);
        map[k].totalTokens += Number(r.total_tokens || 0);
    }
    return Object.entries(map)
        .map(([uid, stats]) => ({ user: uid === '__system__' ? 'Sistema' : labelFn(uid), userId: uid, ...stats }))
        .sort((a, b) => b.costEur - a.costEur);
}

function renderKPIs(t, prev) {
    const avgMs = t.count > 0 ? Math.round(t.totalMs / t.count) : 0;
    const deltaCost = prev.costEur > 0 ? ((t.costEur - prev.costEur) / prev.costEur) * 100 : null;
    const deltaSymbol = deltaCost == null ? '' : deltaCost > 0 ? '↑' : '↓';
    const deltaColor = deltaCost == null ? 'var(--text-tertiary)' : deltaCost > 0 ? '#ef4444' : '#10b981';
    const deltaStr = deltaCost == null ? 'primo mese' : `${deltaSymbol} ${Math.abs(deltaCost).toFixed(0)}% vs mese scorso`;

    return `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
            ${kpiCard({
                icon: 'payments',
                label: 'Costo mese corrente',
                value: `€ ${t.costEur.toFixed(4)}`,
                subValue: `$ ${t.costUsd.toFixed(4)}`,
                hint: deltaStr,
                hintColor: deltaColor,
                accent: '#6366f1',
            })}
            ${kpiCard({
                icon: 'forum',
                label: 'Chiamate totali',
                value: t.count.toLocaleString('it-IT'),
                subValue: `${t.errors} errori`,
                hint: t.errors > 0 ? `${((t.errors / t.count) * 100).toFixed(1)}% fallite` : 'tutte ok',
                hintColor: t.errors > 0 ? '#ef4444' : '#10b981',
                accent: '#3b82f6',
            })}
            ${kpiCard({
                icon: 'token',
                label: 'Token totali',
                value: formatNum(t.totalTokens),
                subValue: `${formatNum(t.inputTokens)} in / ${formatNum(t.outputTokens)} out`,
                hint: 'mese corrente',
                hintColor: 'var(--text-tertiary)',
                accent: '#8b5cf6',
            })}
            ${kpiCard({
                icon: 'speed',
                label: 'Latenza media',
                value: `${avgMs} ms`,
                subValue: avgMs < 1000 ? 'sotto 1s' : `${(avgMs / 1000).toFixed(1)}s`,
                hint: 'risposta API',
                hintColor: 'var(--text-tertiary)',
                accent: '#f59e0b',
            })}
        </div>
    `;
}

function kpiCard({ icon, label, value, subValue, hint, hintColor, accent }) {
    return `
        <div class="glass-card" style="padding: 1.25rem; border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: ${accent};">
                <span class="material-icons-round" style="font-size: 1.2rem;">${icon}</span>
                <span style="font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">${label}</span>
            </div>
            <div style="font-family: var(--font-titles); font-size: 1.6rem; font-weight: 700; color: var(--text-primary); line-height: 1.1;">${value}</div>
            <div style="font-size: 0.75rem; color: var(--text-tertiary);">${subValue}</div>
            <div style="font-size: 0.7rem; font-weight: 500; color: ${hintColor}; margin-top: 0.25rem;">${hint}</div>
        </div>
    `;
}

function renderFeatureBreakdown(rows) {
    if (rows.length === 0) {
        return `
            <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
                <h3 style="margin: 0 0 0.5rem; font-size: 1rem;">Costo per feature</h3>
                <p style="color: var(--text-tertiary); font-size: 0.85rem; margin: 0;">Nessuna chiamata AI registrata questo mese.</p>
            </div>
        `;
    }
    const maxCost = Math.max(...rows.map(r => r.costEur));
    return `
        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
            <h3 style="margin: 0 0 1rem; font-size: 1rem; color: var(--text-primary);">Costo per feature (mese corrente)</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${rows.map(r => {
                    const widthPct = maxCost > 0 ? (r.costEur / maxCost) * 100 : 0;
                    return `
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                                <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(r.feature)}</span>
                                <span style="color: var(--text-secondary); font-variant-numeric: tabular-nums;">
                                    € ${r.costEur.toFixed(4)} · ${formatNum(r.totalTokens)} tok · ${r.count} chiamate
                                </span>
                            </div>
                            <div style="height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                                <div style="width: ${widthPct}%; height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 3px;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderUserBreakdown(rows) {
    if (rows.length === 0) {
        return `
            <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
                <h3 style="margin: 0 0 0.5rem; font-size: 1rem;">Costo per utente</h3>
                <p style="color: var(--text-tertiary); font-size: 0.85rem; margin: 0;">Nessuna chiamata AI registrata.</p>
            </div>
        `;
    }
    const maxCost = Math.max(...rows.map(r => r.costEur));
    return `
        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
            <h3 style="margin: 0 0 1rem; font-size: 1rem; color: var(--text-primary);">Costo per utente (mese corrente)</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${rows.map(r => {
                    const widthPct = maxCost > 0 ? (r.costEur / maxCost) * 100 : 0;
                    return `
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                                <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(r.user)}</span>
                                <span style="color: var(--text-secondary); font-variant-numeric: tabular-nums;">
                                    € ${r.costEur.toFixed(4)} · ${formatNum(r.totalTokens)} tok · ${r.count} chiamate
                                </span>
                            </div>
                            <div style="height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                                <div style="width: ${widthPct}%; height: 100%; background: linear-gradient(90deg, #10b981, #3b82f6); border-radius: 3px;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderRecentCalls(rows, labelUser = () => 'Sistema') {
    if (rows.length === 0) {
        return `
            <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
                <h3 style="margin: 0 0 0.5rem; font-size: 1rem;">Ultime chiamate</h3>
                <p style="color: var(--text-tertiary); font-size: 0.85rem; margin: 0;">Nessuna chiamata registrata.</p>
            </div>
        `;
    }
    return `
        <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1rem; color: var(--text-primary);">Ultime ${rows.length} chiamate</h3>
                <span style="font-size: 0.7rem; color: var(--text-tertiary);">tempo reale</span>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--glass-border); text-align: left;">
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem;">Quando</th>
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem;">Utente</th>
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem;">Feature</th>
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem;">Modello</th>
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem; text-align: right;">Token</th>
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem; text-align: right;">Costo</th>
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem; text-align: right;">Latenza</th>
                            <th style="padding: 0.5rem 0.5rem 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem; text-align: center;">Esito</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => {
                            const dt = new Date(r.created_at);
                            const when = `${dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
                            const modelShort = (r.model || '').split('/').pop() || '-';
                            const totalTok = Number(r.total_tokens || 0);
                            const costEur = Number(r.cost_eur || 0);
                            const ms = Number(r.response_time_ms || 0);
                            const success = r.success !== false;
                            return `
                                <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.1s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
                                    <td style="padding: 0.6rem 0.5rem; color: var(--text-tertiary); font-variant-numeric: tabular-nums;">${when}</td>
                                    <td style="padding: 0.6rem 0.5rem; color: var(--text-secondary); white-space: nowrap;">${escapeHtml(labelUser(r.user_id))}</td>
                                    <td style="padding: 0.6rem 0.5rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(r.feature)}</td>
                                    <td style="padding: 0.6rem 0.5rem; color: var(--text-secondary); font-family: ui-monospace, monospace; font-size: 0.75rem;">${escapeHtml(modelShort)}</td>
                                    <td style="padding: 0.6rem 0.5rem; text-align: right; color: var(--text-secondary); font-variant-numeric: tabular-nums;">${formatNum(totalTok)}</td>
                                    <td style="padding: 0.6rem 0.5rem; text-align: right; font-variant-numeric: tabular-nums; color: var(--text-primary); font-weight: 500;">€ ${costEur.toFixed(6)}</td>
                                    <td style="padding: 0.6rem 0.5rem; text-align: right; color: var(--text-tertiary); font-variant-numeric: tabular-nums;">${ms} ms</td>
                                    <td style="padding: 0.6rem 0.5rem; text-align: center;">
                                        ${success
                                            ? `<span style="color: #10b981; font-size: 1rem;" title="ok"><span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">check_circle</span></span>`
                                            : `<span style="color: #ef4444; font-size: 1rem;" title="${escapeHtml(r.error_message || 'errore')}"><span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">error</span></span>`
                                        }
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function formatNum(n) {
    n = Number(n || 0);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString('it-IT');
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
