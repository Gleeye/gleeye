/**
 * sales/metrics.js
 * Pagina metriche pipeline: conversion rate per stadio, tempo medio, top sorgenti.
 */

import { fetchProspects, PIPELINE_STAGES, ACQUISITION_SOURCES } from './api.js?v=8000';

export async function renderSalesMetrics(container) {
    container.innerHTML = buildLoadingHTML();

    try {
        const prospects = await fetchProspects();
        container.innerHTML = buildMetricsHTML(prospects);
    } catch (err) {
        container.innerHTML = '<p style="padding:2rem;color:red;">Errore: ' + err.message + '</p>';
    }
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildLoadingHTML() {
    return '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary);gap:0.75rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>Calcolo metriche…</div>';
}

function buildMetricsHTML(prospects) {
    if (prospects.length === 0) {
        return (
            '<div class="animate-fade-in" style="max-width:1200px;margin:0 auto;padding:1.5rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">' +
                    '<div>' +
                        '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">Metriche Pipeline</h1>' +
                    '</div>' +
                    '<a href="#sales-pipeline" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                        '<span class="material-icons-round" style="font-size:1rem;">view_kanban</span>Pipeline' +
                    '</a>' +
                '</div>' +
                '<div style="text-align:center;padding:4rem;color:var(--text-tertiary);">' +
                    '<span class="material-icons-round" style="font-size:4rem;opacity:0.3;display:block;margin-bottom:1rem;">bar_chart</span>' +
                    '<div style="font-size:1rem;font-weight:600;">Nessun prospect ancora</div>' +
                    '<div style="font-size:0.85rem;margin-top:0.5rem;">Aggiungi prospect nella pipeline per vedere le metriche.</div>' +
                    '<a href="#sales-pipeline" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;padding:0.6rem 1.2rem;border-radius:12px;font-weight:700;margin-top:1.5rem;text-decoration:none;">' +
                        '<span class="material-icons-round" style="font-size:1rem;">add</span>Vai alla Pipeline' +
                    '</a>' +
                '</div>' +
            '</div>'
        );
    }

    const kpis = computeKPIs(prospects);
    const conversionRows = computeConversionFunnel(prospects);
    const avgTimeRows = computeAvgTimePerStage(prospects);
    const sourceRows = computeTopSources(prospects);

    return (
        '<div class="animate-fade-in" style="max-width:1200px;margin:0 auto;padding:1.5rem;">' +
            // Header
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">' +
                '<div>' +
                    '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">Metriche Pipeline</h1>' +
                    '<div style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.25rem;">' + prospects.length + ' prospect totali</div>' +
                '</div>' +
                '<a href="#sales-pipeline" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                    '<span class="material-icons-round" style="font-size:1rem;">view_kanban</span>Pipeline' +
                '</a>' +
            '</div>' +
            // KPI cards
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem;">' +
                kpiCard('Prospect totali', kpis.total, 'people', '#3b82f6') +
                kpiCard('Attivi', kpis.active, 'pending', '#f59e0b') +
                kpiCard('Convertiti', kpis.converted, 'check_circle', '#10b981') +
                kpiCard('Tasso conversione', kpis.conversionRate + '%', 'trending_up', '#8b5cf6') +
            '</div>' +
            // 2 col layout
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem;">' +
                // Funnel conversione
                buildSection('Funnel conversione per stadio', buildFunnelHTML(conversionRows)) +
                // Top sorgenti
                buildSection('Top sorgenti acquisizione', buildSourcesHTML(sourceRows)) +
            '</div>' +
            // Tempo medio per stadio (full width)
            buildSection('Tempo medio per stadio (gg)', buildAvgTimeHTML(avgTimeRows)) +
        '</div>'
    );
}

// ─── COMPUTE ──────────────────────────────────────────────────────────────────

function computeKPIs(prospects) {
    const total = prospects.length;
    const converted = prospects.filter(p => p.pipeline_stage === 'converted').length;
    const active = total - converted;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { total, converted, active, conversionRate };
}

function computeConversionFunnel(prospects) {
    const stageCounts = {};
    PIPELINE_STAGES.forEach(s => { stageCounts[s.key] = 0; });
    prospects.forEach(p => {
        if (stageCounts[p.pipeline_stage] !== undefined) stageCounts[p.pipeline_stage]++;
    });

    const total = prospects.length || 1;
    return PIPELINE_STAGES.map(s => ({
        stage: s,
        count: stageCounts[s.key],
        pct:   Math.round((stageCounts[s.key] / total) * 100),
    }));
}

function computeAvgTimePerStage(prospects) {
    // Per ogni prospect, guarda stage_history e calcola durata in ogni stadio
    const stageTotals = {};
    const stageCounts = {};
    PIPELINE_STAGES.forEach(s => { stageTotals[s.key] = 0; stageCounts[s.key] = 0; });

    prospects.forEach(p => {
        const history = p.stage_history || [];
        if (history.length < 2) return;
        for (let i = 0; i < history.length - 1; i++) {
            const stageKey = history[i].stage;
            const from = new Date(history[i].entered_at);
            const to = new Date(history[i + 1].entered_at);
            const days = (to - from) / (1000 * 60 * 60 * 24);
            if (stageTotals[stageKey] !== undefined && days >= 0) {
                stageTotals[stageKey] += days;
                stageCounts[stageKey]++;
            }
        }
    });

    return PIPELINE_STAGES.map(s => ({
        stage: s,
        avgDays: stageCounts[s.key] > 0 ? Math.round(stageTotals[s.key] / stageCounts[s.key]) : null,
        sampleSize: stageCounts[s.key],
    }));
}

function computeTopSources(prospects) {
    const counts = {};
    prospects.forEach(p => {
        const src = p.acquisition_source || 'other';
        counts[src] = (counts[src] || 0) + 1;
    });
    const total = prospects.length || 1;
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({
            label: ACQUISITION_SOURCES.find(s => s.key === key)?.label || key,
            count,
            pct: Math.round((count / total) * 100),
        }));
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────

function buildSection(title, contentHTML) {
    return (
        '<div class="glass-card" style="padding:1.25rem;border-radius:16px;border:1px solid var(--glass-border);">' +
            '<div style="font-size:0.8rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem;">' + title + '</div>' +
            contentHTML +
        '</div>'
    );
}

function kpiCard(label, value, icon, color) {
    return (
        '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:16px;padding:1.25rem;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">' +
                '<span class="material-icons-round" style="font-size:1.2rem;color:' + color + ';">' + icon + '</span>' +
                '<span style="font-size:0.72rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;">' + label + '</span>' +
            '</div>' +
            '<div style="font-size:2rem;font-weight:900;color:var(--text-primary);font-family:var(--font-titles);">' + value + '</div>' +
        '</div>'
    );
}

function buildFunnelHTML(rows) {
    const maxCount = Math.max(...rows.map(r => r.count), 1);
    return rows.map(r =>
        '<div style="margin-bottom:0.75rem;">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px;">' +
                '<span style="font-weight:600;color:var(--text-primary);">' + r.stage.label + '</span>' +
                '<span style="color:var(--text-tertiary);">' + r.count + ' (' + r.pct + '%)</span>' +
            '</div>' +
            '<div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;">' +
                '<div style="height:100%;width:' + (r.count / maxCount * 100) + '%;background:' + r.stage.color + ';border-radius:4px;transition:width 0.4s;"></div>' +
            '</div>' +
        '</div>'
    ).join('');
}

function buildSourcesHTML(rows) {
    if (rows.length === 0) return '<div style="color:var(--text-tertiary);font-size:0.82rem;">Nessun dato</div>';
    const maxCount = Math.max(...rows.map(r => r.count), 1);
    return rows.map((r, i) => {
        const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
        const color = colors[i % colors.length];
        return (
            '<div style="margin-bottom:0.75rem;">' +
                '<div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px;">' +
                    '<span style="font-weight:600;color:var(--text-primary);">' + r.label + '</span>' +
                    '<span style="color:var(--text-tertiary);">' + r.count + ' (' + r.pct + '%)</span>' +
                '</div>' +
                '<div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;">' +
                    '<div style="height:100%;width:' + (r.count / maxCount * 100) + '%;background:' + color + ';border-radius:4px;transition:width 0.4s;"></div>' +
                '</div>' +
            '</div>'
        );
    }).join('');
}

function buildAvgTimeHTML(rows) {
    const withData = rows.filter(r => r.avgDays !== null);
    if (withData.length === 0) {
        return '<div style="color:var(--text-tertiary);font-size:0.82rem;">Dati insufficienti — serve storico movimenti tra stadi per calcolare il tempo medio.</div>';
    }
    return (
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">' +
            rows.map(r =>
                '<div style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:12px;padding:1rem;text-align:center;">' +
                    '<div style="font-size:0.72rem;font-weight:700;color:' + r.stage.color + ';text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.5rem;">' + r.stage.label + '</div>' +
                    (r.avgDays !== null
                        ? '<div style="font-size:1.8rem;font-weight:900;color:var(--text-primary);">' + r.avgDays + '<span style="font-size:0.9rem;font-weight:600;color:var(--text-tertiary);"> gg</span></div>' +
                          '<div style="font-size:0.7rem;color:var(--text-tertiary);margin-top:2px;">' + r.sampleSize + ' campioni</div>'
                        : '<div style="font-size:0.8rem;color:var(--text-tertiary);margin-top:0.5rem;">—</div>'
                    ) +
                '</div>'
            ).join('') +
        '</div>'
    );
}
