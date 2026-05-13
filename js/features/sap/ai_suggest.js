// SAP-5 — Analisi AI: quali SAP costruire
// Legge storico commesse + servizi tariffari più usati → chiede a Claude
// di suggerire 5 nuovi SAP in ordine di rendimento atteso.

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { chat } from '../../modules/ai_client.js?v=8000';

export async function openSapAiSuggest() {
    const existing = document.getElementById('sap-ai-suggest-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sap-ai-suggest-modal';
    modal.className = 'modal';
    modal.innerHTML = _buildShellHTML();
    document.body.appendChild(modal);
    modal.classList.add('active');
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    _runAnalysis(modal);
}

// ─── Analysis engine ──────────────────────────────────────────────────────────

async function _runAnalysis(modal) {
    _setContent(modal, _buildLoadingHTML());

    try {
        const [ordersData, servicesData, existingSap] = await Promise.all([
            _fetchOrdersHistory(),
            _fetchTopServices(),
            state.sapServices || [],
        ]);

        const prompt = _buildPrompt(ordersData, servicesData, existingSap);

        const resp = await chat({
            feature: 'doc_generator',
            messages: [
                { role: 'system', content: `Sei un consulente strategico per agenzie di comunicazione italiane. Analizza dati reali e fornisci suggerimenti concreti e attuabili. Rispondi in italiano. Output: JSON strutturato.` },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 2000,
            temperature: 0.4,
            feature_context: { entity_type: 'sap_suggest', analysis: 'new_sap_recommendations' },
        });

        const raw = resp?.choices?.[0]?.message?.content;
        if (!raw) throw new Error('Risposta AI vuota');

        const parsed = JSON.parse(raw);
        _setContent(modal, _buildResultsHTML(parsed, ordersData));

    } catch (err) {
        console.error('[sap_ai_suggest]', err);
        _setContent(modal, _buildErrorHTML(err.message));
    }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function _fetchOrdersHistory() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: orders } = await supabase
        .from('orders')
        .select('id, title, offer_status, price_final, price_planned, created_at, sap_service_id')
        .gte('created_at', oneYearAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

    const total = orders?.length || 0;
    const accepted = orders?.filter(o => ['accettata', 'vinta'].includes(o.offer_status))?.length || 0;
    const avgPrice = accepted > 0
        ? Math.round((orders || []).filter(o => ['accettata','vinta'].includes(o.offer_status)).reduce((s, o) => s + (Number(o.price_final || o.price_planned) || 0), 0) / accepted)
        : 0;

    return { total, accepted, acceptanceRate: total > 0 ? Math.round((accepted/total)*100) : 0, avgPrice, orders: orders || [] };
}

async function _fetchTopServices() {
    // Servizi tariffari più usati negli incarichi/commesse
    const { data: items } = await supabase
        .from('pm_items')
        .select('title, price, cost, quantity')
        .not('price', 'is', null)
        .limit(500);

    if (!items) return [];

    const freq = {};
    items.forEach(i => {
        const key = (i.title || '').trim().toLowerCase();
        if (!key) return;
        freq[key] = freq[key] || { title: i.title, count: 0, totalRevenue: 0 };
        freq[key].count++;
        freq[key].totalRevenue += (Number(i.price) || 0) * (Number(i.quantity) || 1);
    });

    return Object.values(freq)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(s => ({ title: s.title, usedInOrders: s.count, totalRevenue: Math.round(s.totalRevenue) }));
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function _buildPrompt(ordersData, services, existingSap) {
    const existingNames = existingSap.map(s => s.name).join(', ');
    const topServices = services.slice(0, 15).map(s => `- "${s.title}": usato ${s.usedInOrders} volte, fatturato totale ~${s.totalRevenue}€`).join('\n');

    return `Sei un consulente per un'agenzia di comunicazione italiana (Genova). Analizza questi dati reali e suggerisci 5 nuovi Servizi a Pacchetto (SAP) da costruire, in ordine di rendimento atteso.

## Dati storici (ultimi 12 mesi)
- Offerte totali: ${ordersData.total}
- Offerte accettate: ${ordersData.accepted} (${ordersData.acceptanceRate}% tasso accettazione)
- Prezzo medio commessa accettata: ${ordersData.avgPrice}€

## Servizi tariffari più usati nelle commesse
${topServices || 'Dati non disponibili'}

## SAP già esistenti
${existingNames || 'Nessuno'}

## Task
Suggerisci 5 nuovi SAP da costruire che:
1. Sfruttino i servizi già padroneggiati (combinandoli in pacchetti)
2. Abbiano prevedibilità (clienti ricorrenti o mercato chiaro)
3. Siano differenti dai SAP già esistenti
4. Abbiano alto potenziale di margine

Rispondi con JSON esatto:
{
  "suggestions": [
    {
      "rank": 1,
      "name": "Nome SAP",
      "rationale": "Perché questo SAP è suggerito (2-3 frasi)",
      "target": "A chi venderlo",
      "baseServices": ["servizio 1", "servizio 2"],
      "estimatedPrice": "range €",
      "estimatedMargin": "% stimato",
      "urgency": "alta|media|bassa"
    }
  ],
  "insight": "1-2 frasi di insight strategico generale sui dati"
}`;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function _buildShellHTML() {
    return `
        <div class="modal-content" style="max-width:680px; width:95vw; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl);">
            <div style="padding:1.25rem 1.75rem; background:var(--brand-gradient); color:white; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span class="material-icons-round" style="font-size:1.4rem;">psychology</span>
                    <div>
                        <div style="font-weight:800; font-size:1.05rem; font-family:var(--font-titles);">Analisi AI — Quali SAP costruire</div>
                        <div style="font-size:0.8rem; opacity:0.85;">Analisi storico commesse + suggerimenti</div>
                    </div>
                </div>
                <button onclick="document.getElementById('sap-ai-suggest-modal').remove()" style="background:rgba(255,255,255,0.2); border:none; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <span class="material-icons-round" style="font-size:1.1rem;">close</span>
                </button>
            </div>
            <div id="sap-suggest-body" style="padding:1.5rem 1.75rem; max-height:70vh; overflow-y:auto;"></div>
        </div>
    `;
}

function _buildLoadingHTML() {
    return `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem; gap:1rem;">
            <span class="material-icons-round" style="font-size:2.5rem; color:var(--brand-blue); animation:spin 1.5s linear infinite;">autorenew</span>
            <div style="font-weight:700; color:var(--text-primary);">Analizzando le commesse…</div>
            <div style="font-size:0.82rem; color:var(--text-tertiary); text-align:center;">Claude sta esaminando lo storico ordini e i servizi più usati</div>
        </div>
    `;
}

function _buildErrorHTML(msg) {
    return `<div style="padding:1.5rem; background:rgba(239,68,68,0.06); border-radius:12px; border:1px solid rgba(239,68,68,0.2); color:#ef4444;">Errore durante l'analisi: ${msg}</div>`;
}

function _buildResultsHTML(data, ordersData) {
    const { suggestions = [], insight = '' } = data;
    const urgencyColors = { alta: '#ef4444', media: '#f59e0b', bassa: '#10b981' };

    const cards = suggestions.map(s => `
        <div style="padding:1.1rem 1.25rem; background:white; border:1px solid var(--glass-border); border-radius:14px; display:flex; flex-direction:column; gap:0.6rem;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:1rem;">
                <div style="display:flex; align-items:center; gap:0.65rem;">
                    <div style="width:28px; height:28px; border-radius:8px; background:var(--brand-gradient); display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:0.85rem; flex-shrink:0;">${s.rank}</div>
                    <span style="font-weight:800; font-size:0.95rem; color:var(--text-primary); font-family:var(--font-titles);">${s.name}</span>
                </div>
                <span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:${urgencyColors[s.urgency] || '#64748b'}22; color:${urgencyColors[s.urgency] || '#64748b'}; font-weight:700; flex-shrink:0; white-space:nowrap;">urgenza ${s.urgency}</span>
            </div>
            <div style="font-size:0.83rem; color:var(--text-secondary); line-height:1.5;">${s.rationale}</div>
            <div style="display:flex; flex-wrap:wrap; gap:0.5rem; font-size:0.78rem;">
                <span style="padding:2px 8px; background:var(--bg-secondary); border-radius:6px; color:var(--text-tertiary);"><b>Target:</b> ${s.target}</span>
                ${s.estimatedPrice ? `<span style="padding:2px 8px; background:rgba(16,185,129,0.08); border-radius:6px; color:#10b981; font-weight:700;">${s.estimatedPrice}</span>` : ''}
                ${s.estimatedMargin ? `<span style="padding:2px 8px; background:var(--bg-secondary); border-radius:6px; color:var(--text-tertiary);">margine ~${s.estimatedMargin}</span>` : ''}
            </div>
            ${s.baseServices?.length ? `
                <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
                    ${s.baseServices.map(b => `<span style="font-size:0.72rem; padding:2px 6px; background:rgba(99,102,241,0.08); color:var(--brand-blue); border-radius:5px; font-weight:600;">${b}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');

    return `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            ${insight ? `
                <div style="padding:0.85rem 1.1rem; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); border-radius:12px; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
                    <b>Insight strategico:</b> ${insight}
                </div>
            ` : ''}
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                ${cards}
            </div>
            <div style="padding-top:0.75rem; border-top:1px solid var(--glass-border); font-size:0.75rem; color:var(--text-tertiary); text-align:right;">
                Basato su ${ordersData.total} offerte (${ordersData.acceptanceRate}% accettazione) — ultimi 12 mesi
            </div>
        </div>
    `;
}

function _setContent(modal, html) {
    const body = modal.querySelector('#sap-suggest-body');
    if (body) body.innerHTML = html;
}
