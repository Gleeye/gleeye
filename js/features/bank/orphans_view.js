// CA-8 — Movimenti bancari orfani (senza fattura collegata)
// Vista #bank-orphans: lista, dropdown "Collega a...", AI Suggest

import { supabase } from '/js/modules/config.js?v=8000';
import { formatAmount } from '/js/modules/utils.js?v=8000';
import { approveBankTransaction } from '/js/modules/api.js?v=8000';
import { aiSuggestMatch } from './orphans_ai.js?v=8000';

const WINDOW_DAYS = 90;

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function renderBankOrphans(container) {
    container.innerHTML = _buildShell();
    const body = container.querySelector('#bo-body');

    try {
        const [orphans, invoices, passiveInvoices] = await Promise.all([
            _fetchOrphans(),
            _fetchInvoiceCandidates(),
            _fetchPassiveCandidates(),
        ]);

        if (orphans.length === 0) {
            body.innerHTML = _buildEmptyState();
            return;
        }

        body.innerHTML = _buildTable(orphans, invoices, passiveInvoices);
        _attachListeners(body, invoices, passiveInvoices);

    } catch (err) {
        console.error('[bank_orphans]', err);
        body.innerHTML = `<div style="padding:2rem; color:#ef4444;">Errore nel caricamento: ${err.message}</div>`;
    }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function _fetchOrphans() {
    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);

    // Fetch posted transactions without invoice links
    const { data, error } = await supabase
        .from('bank_transactions')
        .select(`
            id, description, amount, date, status,
            transaction_categories(name, type),
            clients(business_name),
            suppliers(name)
        `)
        .eq('status', 'posted')
        .gte('date', since.toISOString().split('T')[0])
        .is('active_invoice_id', null)
        .is('passive_invoice_id', null)
        .order('date', { ascending: false });

    if (error) throw error;

    // Filter out those already linked via payments
    const ids = (data || []).map(t => t.id);
    if (ids.length === 0) return [];

    const { data: linkedPayments } = await supabase
        .from('payments')
        .select('bank_transaction_id')
        .in('bank_transaction_id', ids);

    const linkedSet = new Set((linkedPayments || []).map(p => p.bank_transaction_id));

    // Also filter out linked_invoices non-empty (multi-invoice support)
    const { data: withLinked } = await supabase
        .from('bank_transactions')
        .select('id, linked_invoices')
        .in('id', ids);

    const multiLinkedSet = new Set(
        (withLinked || [])
            .filter(t => t.linked_invoices && t.linked_invoices.length > 0)
            .map(t => t.id)
    );

    return (data || []).filter(t => !linkedSet.has(t.id) && !multiLinkedSet.has(t.id));
}

async function _fetchInvoiceCandidates() {
    const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, invoice_date, clients(business_name)')
        .order('invoice_date', { ascending: false })
        .limit(200);
    return data || [];
}

async function _fetchPassiveCandidates() {
    const { data } = await supabase
        .from('passive_invoices')
        .select('id, invoice_number, amount, invoice_date, suppliers(name), collaborators(full_name)')
        .order('invoice_date', { ascending: false })
        .limit(200);
    return data || [];
}

// ─── Candidate filtering (±5%) ────────────────────────────────────────────────

function _filterCandidates(tx, invoices, passiveInvoices) {
    const abs = Math.abs(Number(tx.amount));
    const isOutflow = Number(tx.amount) < 0;
    const margin = abs * 0.05;

    const matchPool = isOutflow ? passiveInvoices : invoices;
    return matchPool
        .filter(inv => {
            const invAmt = Math.abs(Number(inv.amount));
            return invAmt >= abs - margin && invAmt <= abs + margin;
        })
        .slice(0, 20);
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function _buildShell() {
    return `
        <div style="padding: 1.5rem; max-width: 1100px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;">
                <div>
                    <h1 style="font-family: var(--font-titles); font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.25rem;">
                        Movimenti da Quadrare
                    </h1>
                    <p style="font-size: 0.82rem; color: var(--text-tertiary); margin: 0;">
                        Movimenti bancari approvati senza fattura collegata (ultimi ${WINDOW_DAYS} giorni)
                    </p>
                </div>
                <a href="#bank-transactions" style="font-size: 0.8rem; color: var(--brand-blue); text-decoration: none; display: flex; align-items: center; gap: 0.35rem;">
                    <span class="material-icons-round" style="font-size: 1rem;">arrow_back</span>
                    Tutti i movimenti
                </a>
            </div>
            <div id="bo-body">
                <div style="display: flex; align-items: center; justify-content: center; padding: 4rem; gap: 0.75rem; color: var(--text-tertiary);">
                    <span class="material-icons-round" style="animation: spin 1.2s linear infinite;">autorenew</span>
                    Caricamento…
                </div>
            </div>
        </div>
    `;
}

function _buildEmptyState() {
    return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 1rem; text-align: center;">
            <span class="material-icons-round" style="font-size: 3rem; color: #10b981;">check_circle</span>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">Tutto quadrato</div>
            <div style="font-size: 0.85rem; color: var(--text-tertiary);">Nessun movimento degli ultimi ${WINDOW_DAYS} giorni è privo di fattura. Ottimo lavoro.</div>
        </div>
    `;
}

function _buildTable(orphans, invoices, passiveInvoices) {
    const totalOrphan = orphans.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    const rows = orphans.map(tx => {
        const isOutflow = Number(tx.amount) < 0;
        const candidates = _filterCandidates(tx, invoices, passiveInvoices);
        const candidateOptions = candidates.map(c => {
            const label = isOutflow
                ? `#${c.invoice_number || '?'} — ${c.suppliers?.name || c.collaborators?.full_name || '?'} — ${formatAmount(Math.abs(Number(c.amount)))} €`
                : `#${c.invoice_number || '?'} — ${c.clients?.business_name || '?'} — ${formatAmount(Math.abs(Number(c.amount)))} €`;
            return `<option value="${c.id}" data-type="${isOutflow ? 'passive' : 'active'}">${label}</option>`;
        }).join('');

        return `
            <tr data-tx-id="${tx.id}" data-tx-amount="${tx.amount}" data-tx-desc="${_esc(tx.description || '')}">
                <td style="padding: 0.75rem 1rem; white-space: nowrap; font-size: 0.82rem; color: var(--text-tertiary);">
                    ${_formatDate(tx.date)}
                </td>
                <td style="padding: 0.75rem 1rem; font-size: 0.85rem; color: var(--text-primary); max-width: 280px;">
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${_esc(tx.description || '')}">
                        ${_esc(tx.description || '—')}
                    </div>
                    ${tx.clients?.business_name ? `<div style="font-size:0.75rem;color:var(--text-tertiary);">${_esc(tx.clients.business_name)}</div>` : ''}
                    ${tx.suppliers?.name ? `<div style="font-size:0.75rem;color:var(--text-tertiary);">${_esc(tx.suppliers.name)}</div>` : ''}
                </td>
                <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 700; white-space: nowrap; font-size: 0.9rem; color: ${isOutflow ? '#ef4444' : '#10b981'};">
                    ${isOutflow ? '−' : '+'}${formatAmount(Math.abs(Number(tx.amount)))} €
                </td>
                <td style="padding: 0.75rem 1rem; min-width: 280px;">
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <select class="bo-select" data-tx-id="${tx.id}"
                            style="flex: 1; font-size: 0.8rem; padding: 0.35rem 0.5rem; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--card-bg); color: var(--text-primary); cursor: pointer;">
                            <option value="">— Collega a… —</option>
                            ${candidateOptions}
                        </select>
                        <button class="bo-link-btn" data-tx-id="${tx.id}"
                            style="padding: 0.35rem 0.65rem; font-size: 0.78rem; background: var(--brand-gradient); color: white; border: none; border-radius: 8px; cursor: pointer; white-space: nowrap; opacity: 0.4; pointer-events: none;"
                            disabled>
                            Collega
                        </button>
                    </div>
                </td>
                <td style="padding: 0.75rem 1rem;">
                    <button class="bo-ai-btn" data-tx-id="${tx.id}"
                        style="display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.65rem; font-size: 0.78rem; background: rgba(99,102,241,0.08); color: var(--brand-blue); border: 1px solid rgba(99,102,241,0.2); border-radius: 8px; cursor: pointer; white-space: nowrap;">
                        <span class="material-icons-round" style="font-size: 0.95rem;">psychology</span>
                        AI Suggest
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div style="margin-bottom: 1rem; padding: 0.85rem 1.1rem; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 12px; display: flex; align-items: center; gap: 0.75rem;">
            <span class="material-icons-round" style="color: #ef4444; font-size: 1.1rem;">warning_amber</span>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">
                <b>${orphans.length} moviment${orphans.length === 1 ? 'o' : 'i'}</b> non riconciliat${orphans.length === 1 ? 'o' : 'i'} —
                totale <b>${formatAmount(totalOrphan)} €</b>
            </span>
        </div>
        <div style="overflow-x: auto; border: 1px solid var(--glass-border); border-radius: 14px; background: var(--card-bg);">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--glass-border); background: var(--bg-secondary);">
                        <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em;">Data</th>
                        <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em;">Descrizione</th>
                        <th style="padding: 0.75rem 1rem; text-align: right; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em;">Importo</th>
                        <th style="padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em;">Collega fattura</th>
                        <th style="padding: 0.75rem 1rem;"></th>
                    </tr>
                </thead>
                <tbody id="bo-tbody">
                    ${rows}
                </tbody>
            </table>
        </div>
        <div id="bo-ai-modal-container"></div>
    `;
}

// ─── Event listeners ──────────────────────────────────────────────────────────

function _attachListeners(body, invoices, passiveInvoices) {
    // Enable "Collega" button when dropdown changes
    body.addEventListener('change', e => {
        if (!e.target.classList.contains('bo-select')) return;
        const txId = e.target.dataset.txId;
        const btn = body.querySelector(`.bo-link-btn[data-tx-id="${txId}"]`);
        if (!btn) return;
        const hasValue = !!e.target.value;
        btn.disabled = !hasValue;
        btn.style.opacity = hasValue ? '1' : '0.4';
        btn.style.pointerEvents = hasValue ? 'auto' : 'none';
    });

    // "Collega" button click → call approveBankTransaction RPC
    body.addEventListener('click', async e => {
        const linkBtn = e.target.closest('.bo-link-btn');
        if (linkBtn) {
            await _handleLink(linkBtn, body);
            return;
        }

        const aiBtn = e.target.closest('.bo-ai-btn');
        if (aiBtn) {
            await _handleAiSuggest(aiBtn, body, invoices, passiveInvoices);
        }
    });
}

async function _handleLink(btn, body) {
    const txId = btn.dataset.txId;
    const select = body.querySelector(`.bo-select[data-tx-id="${txId}"]`);
    if (!select?.value) return;

    const invoiceId = select.value;
    const invoiceType = select.options[select.selectedIndex]?.dataset.type;

    btn.disabled = true;
    btn.textContent = '…';

    try {
        await approveBankTransaction(txId, {
            active_invoice_id: invoiceType === 'active' ? invoiceId : null,
            passive_invoice_id: invoiceType === 'passive' ? invoiceId : null,
        });

        // Remove row with fade
        const row = body.querySelector(`tr[data-tx-id="${txId}"]`);
        if (row) {
            row.style.transition = 'opacity 0.3s';
            row.style.opacity = '0';
            setTimeout(() => {
                row.remove();
                _checkEmptyTable(body);
            }, 300);
        }
    } catch (err) {
        console.error('[bank_orphans] link error', err);
        btn.disabled = false;
        btn.textContent = 'Collega';
        alert('Errore nel collegamento: ' + err.message);
    }
}

async function _handleAiSuggest(btn, body, invoices, passiveInvoices) {
    const txId = btn.dataset.txId;
    const row = body.querySelector(`tr[data-tx-id="${txId}"]`);
    if (!row) return;

    const txAmount = Number(row.dataset.txAmount);
    const txDesc = row.dataset.txDesc;
    const isOutflow = txAmount < 0;
    const candidates = _filterCandidates(
        { amount: txAmount, description: txDesc },
        invoices,
        passiveInvoices
    );

    btn.disabled = true;
    btn.innerHTML = `<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;">autorenew</span>`;

    try {
        const result = await aiSuggestMatch(
            { id: txId, description: txDesc, amount: txAmount },
            candidates,
            isOutflow
        );
        _showAiResultModal(body, txId, result, candidates, isOutflow);
    } catch (err) {
        console.error('[bank_orphans] ai suggest error', err);
        alert('Errore AI: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-icons-round" style="font-size:0.95rem;">psychology</span> AI Suggest`;
    }
}

function _showAiResultModal(body, txId, result, candidates, isOutflow) {
    const container = body.querySelector('#bo-ai-modal-container');
    if (!container) return;

    const matched = candidates.find(c => c.id === result.bestMatchId);
    const matchLabel = matched
        ? (isOutflow
            ? `Fattura passiva #${matched.invoice_number || '?'} — ${matched.suppliers?.name || matched.collaborators?.full_name || '?'} — ${formatAmount(Math.abs(Number(matched.amount)))} €`
            : `Fattura attiva #${matched.invoice_number || '?'} — ${matched.clients?.business_name || '?'} — ${formatAmount(Math.abs(Number(matched.amount)))} €`)
        : null;

    const confidence = result.confidence || 0;
    const confColor = confidence >= 80 ? '#10b981' : confidence >= 50 ? '#f59e0b' : '#ef4444';

    container.innerHTML = `
        <div class="modal active" id="bo-ai-modal" style="z-index: 1100;">
            <div class="modal-content glass-card" style="max-width: 480px; padding: 0; border-radius: 18px; overflow: hidden;">
                <div style="padding: 1.1rem 1.4rem; background: var(--brand-gradient); color: white; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <span class="material-icons-round" style="font-size: 1.2rem;">psychology</span>
                        <span style="font-weight: 700; font-size: 0.95rem;">Suggerimento AI</span>
                    </div>
                    <button onclick="document.getElementById('bo-ai-modal')?.remove()"
                        style="background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="font-size: 1rem;">close</span>
                    </button>
                </div>
                <div style="padding: 1.4rem;">
                    ${matchLabel ? `
                        <div style="margin-bottom: 1rem; padding: 0.85rem 1rem; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--glass-border);">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.4rem;">Match suggerito</div>
                            <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">${_esc(matchLabel)}</div>
                        </div>
                        <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 0.78rem; color: var(--text-tertiary);">Confidenza:</span>
                            <span style="font-weight: 700; font-size: 0.85rem; color: ${confColor};">${confidence}%</span>
                        </div>
                        ${result.reason ? `
                            <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55; margin-bottom: 1.25rem; padding: 0.75rem; background: rgba(99,102,241,0.05); border-radius: 8px; border-left: 3px solid var(--brand-blue);">
                                ${_esc(result.reason)}
                            </div>
                        ` : ''}
                        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                            <button onclick="document.getElementById('bo-ai-modal')?.remove()"
                                style="padding: 0.5rem 1rem; font-size: 0.82rem; border: 1px solid var(--glass-border); background: var(--card-bg); color: var(--text-secondary); border-radius: 8px; cursor: pointer;">
                                Annulla
                            </button>
                            <button id="bo-ai-apply-btn"
                                data-tx-id="${txId}"
                                data-invoice-id="${matched.id}"
                                data-invoice-type="${isOutflow ? 'passive' : 'active'}"
                                style="padding: 0.5rem 1.1rem; font-size: 0.82rem; background: var(--brand-gradient); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                Applica match
                            </button>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 1.5rem 0; color: var(--text-secondary);">
                            <span class="material-icons-round" style="font-size: 2rem; color: var(--text-tertiary);">search_off</span>
                            <div style="margin-top: 0.5rem; font-size: 0.85rem;">Nessun candidato convincente trovato tra le fatture ±5%.</div>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

    const applyBtn = container.querySelector('#bo-ai-apply-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const txIdApply = applyBtn.dataset.txId;
            const invoiceIdApply = applyBtn.dataset.invoiceId;
            const typeApply = applyBtn.dataset.invoiceType;
            applyBtn.disabled = true;
            applyBtn.textContent = '…';
            try {
                await approveBankTransaction(txIdApply, {
                    active_invoice_id: typeApply === 'active' ? invoiceIdApply : null,
                    passive_invoice_id: typeApply === 'passive' ? invoiceIdApply : null,
                });
                document.getElementById('bo-ai-modal')?.remove();
                const row = body.querySelector(`tr[data-tx-id="${txIdApply}"]`);
                if (row) {
                    row.style.transition = 'opacity 0.3s';
                    row.style.opacity = '0';
                    setTimeout(() => { row.remove(); _checkEmptyTable(body); }, 300);
                }
            } catch (err) {
                applyBtn.disabled = false;
                applyBtn.textContent = 'Applica match';
                alert('Errore: ' + err.message);
            }
        });
    }
}

function _checkEmptyTable(body) {
    const remaining = body.querySelectorAll('#bo-tbody tr');
    if (remaining.length === 0) {
        body.innerHTML = _buildEmptyState();
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
