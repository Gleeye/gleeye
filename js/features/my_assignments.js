import { state } from '../modules/state.js';
import { supabase } from '../modules/config.js';
import { formatAmount, showGlobalAlert, formatDate } from '../modules/utils.js?v=1000';

// ─────────────────────────────────────────────────────────────────────────────
// STATI PAGAMENTI COLLABORATORI
// Flusso: To Do → Invito Inviato → Fattura Ricevuta → Completato
// ─────────────────────────────────────────────────────────────────────────────
const PAY = {
    isCompleted:       s => ['completato','done','pagato'].some(v => (s||'').toLowerCase().includes(v)),
    isInvitoInviato:   s => (s||'').toLowerCase() === 'invito inviato',
    isFatturaRicevuta: s => (s||'').toLowerCase() === 'fattura ricevuta',
    isToDo:            s => ['to do','da fare','todo'].includes((s||'').toLowerCase().trim()),
};

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
export async function renderMyAssignments(container) {

    // Identità — supporta impersonation
    let collaboratorId, collaborator;
    if (state.impersonatedRole === 'collaborator' && state.impersonatedCollaboratorId) {
        collaboratorId = state.impersonatedCollaboratorId;
        collaborator   = (state.collaborators || []).find(c => c.id === collaboratorId);
    } else {
        const pid = state.profile?.id;
        if (!pid) { container.innerHTML = _msg('Sessione non valida.'); return; }
        collaborator = (state.collaborators || []).find(c => c.user_id === pid);
        if (!collaborator) { container.innerHTML = _msg('Profilo collaboratore non trovato.'); return; }
        collaboratorId = collaborator.id;
    }
    const collaboratorUserId = collaborator?.user_id || null;

    container.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:300px;"><div class="loader"></div></div>`;

    try {
        // ── Incarichi ─────────────────────────────────────────────────────────
        const { data: rawA = [], error: aErr } = await supabase
            .from('assignments')
            .select('id, description, status, total_amount, start_date, updated_at, order_id')
            .eq('collaborator_id', collaboratorId)
            .order('start_date', { ascending: false });
        if (aErr) throw aErr;

        // Orders + Clients separati (no nested join)
        const orderIds = [...new Set(rawA.map(a => a.order_id).filter(Boolean))];
        const ordersMap = {}, clientsMap = {};
        if (orderIds.length) {
            const { data: orders = [] } = await supabase.from('orders')
                .select('id, title, order_number, client_id').in('id', orderIds);
            orders.forEach(o => { ordersMap[o.id] = o; });
            const cids = [...new Set(orders.map(o => o.client_id).filter(Boolean))];
            if (cids.length) {
                const { data: clients = [] } = await supabase.from('clients')
                    .select('id, business_name').in('id', cids);
                clients.forEach(c => { clientsMap[c.id] = c; });
            }
        }
        const assignments = rawA.map(a => ({
            ...a,
            order:  ordersMap[a.order_id]  || null,
            client: ordersMap[a.order_id]  ? (clientsMap[ordersMap[a.order_id].client_id] || null) : null,
        }));

        // ── Pagamenti ─────────────────────────────────────────────────────────
        const { data: payments = [], error: pErr } = await supabase
            .from('payments')
            .select('id, title, amount, due_date, payment_date, status, payment_type, assignment_id')
            .eq('collaborator_id', collaboratorId)
            .order('due_date', { ascending: true });
        if (pErr) throw pErr;

        // ── Fatture ───────────────────────────────────────────────────────────
        const { data: invoices = [], error: iErr } = await supabase
            .from('passive_invoices')
            .select('id, invoice_number, issue_date, due_date, status, amount_tax_excluded, description')
            .eq('collaborator_id', collaboratorId)
            .order('issue_date', { ascending: false });
        if (iErr) throw iErr;

        // ── PM items (tutti: aperti + completati) ─────────────────────────────
        const orCond = `collaborator_ref.eq.${collaboratorId}` +
            (collaboratorUserId ? `,user_ref.eq.${collaboratorUserId}` : '');
        const { data: assigneesData = [] } = await supabase
            .from('pm_item_assignees')
            .select('pm_item_ref, pm_items!inner(id, title, status, priority, due_date, item_type, updated_at, space_ref, pm_spaces(name))')
            .or(orCond);
        const seen = new Set();
        const pmItems = assigneesData
            .filter(r => r.pm_items && !seen.has(r.pm_items.id) && seen.add(r.pm_items.id))
            .map(r => ({ ...r.pm_items, spaceName: r.pm_items.pm_spaces?.name || null }));

        // ── Anno di default e disponibili ─────────────────────────────────────
        // Solo anni in cui esistono dati reali — nessun seed con l'anno corrente
        const yearsSet = new Set();
        assignments.forEach(a => a.start_date && yearsSet.add(new Date(a.start_date).getFullYear()));
        payments.forEach(p => { const d = p.payment_date||p.due_date; d && yearsSet.add(new Date(d).getFullYear()); });
        const availableYears = [...yearsSet].sort((a,b) => b - a);

        // Defaulta all'anno corrente se presente, altrimenti al più recente disponibile
        const curY = new Date().getFullYear();
        let selectedYear = availableYears.includes(curY) ? curY : (availableYears[0] ?? 'all');
        const rerender = () => _renderView(container, {
            collaborator, assignments, payments, invoices, pmItems,
            availableYears, selectedYear,
            onYearChange: y => { selectedYear = y; rerender(); },
        });
        rerender();

    } catch (err) {
        console.error('[MyAssignments]', err);
        showGlobalAlert?.('Errore nel caricamento', 'error');
        container.innerHTML = `<div style="padding:2rem;color:#ef4444;border-radius:12px;background:rgba(239,68,68,.05);margin:1rem;">
            <strong>Errore</strong><p style="margin:.5rem 0 0;">${err.message}</p></div>`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────
function _renderView(container, { collaborator, assignments, payments, invoices, pmItems, availableYears, selectedYear, onYearChange }) {

    const isAll = selectedYear === 'all';

    // Suddivisione incarichi
    const inCorso    = assignments.filter(a => _isActive(a.status));
    const completati = assignments.filter(a => _isCompleted(a.status));

    // Mappa pagamenti per incarico
    const payByAssignment = {};
    payments.forEach(p => {
        if (!p.assignment_id) return;
        if (!payByAssignment[p.assignment_id]) payByAssignment[p.assignment_id] = [];
        payByAssignment[p.assignment_id].push(p);
    });

    // ── Bucket pagamenti ───────────────────────────────────────────────
    const daFatturare     = payments.filter(p => PAY.isInvitoInviato(p.status));
    const fatturaRicevuta = payments.filter(p => PAY.isFatturaRicevuta(p.status));
    const ricevuti        = payments.filter(p => PAY.isCompleted(p.status));
    // Pending = tutto ciò che non è in una delle 3 categorie sopra
    const pending = payments.filter(p =>
        !PAY.isInvitoInviato(p.status) && !PAY.isFatturaRicevuta(p.status) && !PAY.isCompleted(p.status));
    const programmati = pending.filter(p => p.due_date);
    const senzaData   = pending.filter(p => !p.due_date);

    // ── Grafici mensili (filtrati per anno) ──────────────────────────
    const MONTHS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const monthlyIncassato = Array(12).fill(0);
    const monthlyPmDone    = Array(12).fill(0);

    ricevuti.forEach(p => {
        const d = p.payment_date || p.due_date; if (!d) return;
        const date = new Date(d);
        if (!isAll && date.getFullYear() !== selectedYear) return;
        monthlyIncassato[date.getMonth()] += parseFloat(p.amount) || 0;
    });
    pmItems.filter(t => _isPmDone(t.status)).forEach(t => {
        if (!t.updated_at) return;
        const date = new Date(t.updated_at);
        if (!isAll && date.getFullYear() !== selectedYear) return;
        monthlyPmDone[date.getMonth()]++;
    });

    // ── KPI per anno ─────────────────────────────────────────────────
    const budgetAnno    = assignments.filter(a => isAll || !a.start_date || new Date(a.start_date).getFullYear() === selectedYear)
                                     .reduce((s,a) => s + (parseFloat(a.total_amount)||0), 0);
    const incassatoAnno = monthlyIncassato.reduce((s,v) => s+v, 0);
    const ricevutiAnno  = ricevuti.filter(p => {
        const d = p.payment_date || p.due_date; if (!d) return false;
        return isAll || new Date(d).getFullYear() === selectedYear;
    }).length;

    // Task + Attività — aperti (stato attuale, no filtro anno) e chiusi (filtro anno)
    const taskAperte    = pmItems.filter(t => !_isPmDone(t.status) && t.item_type === 'task').length;
    const taskChiuse    = pmItems.filter(t => _isPmDone(t.status) && t.item_type === 'task'
                            && (!t.updated_at || isAll || new Date(t.updated_at).getFullYear() === selectedYear)).length;
    const attivInCorso  = pmItems.filter(t => !_isPmDone(t.status) && t.item_type === 'attivita').length;
    const attivChiuse   = pmItems.filter(t => _isPmDone(t.status) && t.item_type === 'attivita'
                            && (!t.updated_at || isAll || new Date(t.updated_at).getFullYear() === selectedYear)).length;

    // ── Pagamenti attivi ordinati per lista ──────────────────────────
    const activePaysSorted = [...daFatturare, ...fatturaRicevuta, ...programmati, ...senzaData]
        .sort((a,b) => {
            const rank = p => PAY.isInvitoInviato(p.status)?0 : PAY.isFatturaRicevuta(p.status)?1 : p.due_date?2 : 3;
            const d = rank(a) - rank(b);
            if (d !== 0) return d;
            if (!a.due_date && !b.due_date) return 0;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        });

    const yearLabel = isAll ? 'totale' : String(selectedYear);
    const budgetPct = budgetAnno > 0 ? Math.min(Math.round((incassatoAnno/budgetAnno)*100), 100) : 0;

    container.innerHTML = `
    <style>
        /* 4 colonne: incarichi | pagamenti | compensi | lavoro */
        .ma-grid {
            display: grid;
            grid-template-columns: minmax(0,1.3fr) minmax(0,1.1fr) minmax(0,.9fr) minmax(0,.9fr);
            gap: 1.5rem;
            align-items: start;
        }
        @media (max-width:1280px) {
            .ma-grid { grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important; }
        }
        @media (max-width:760px) {
            .ma-grid { grid-template-columns: 1fr !important; }
        }
        .ma-card-hover { transition: all .25s cubic-bezier(.4,0,.2,1); }
        .ma-card-hover:hover { box-shadow: 0 8px 32px rgba(0,0,0,.1) !important; transform: translateY(-2px); }
        .ma-stat-row { display:flex; justify-content:space-between; align-items:center; padding:.65rem 0; border-bottom:1px solid rgba(0,0,0,.035); }
        .ma-stat-row:last-child { border-bottom:none; padding-bottom:.1rem; }
        .ma-stat-label { font-size:.78rem; color:var(--text-secondary); display:flex; align-items:center; gap:.3rem; line-height:1.3; }
        .ma-stat-value { font-weight:800; font-size:.95rem; color:var(--text-primary); font-family:'Outfit',sans-serif; flex-shrink:0; margin-left:.5rem; }
        .ma-section-label { font-size:.6rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:.06em; font-weight:700; margin-bottom:.4rem; margin-top:.2rem; }
    </style>
    <div class="animate-fade-in" style="padding:2rem;display:flex;flex-direction:column;gap:2rem;">

        <!-- ══ 4 COLONNE ═════════════════════════════════════════════════ -->
        <div class="ma-grid">

            <!-- ── COL 1: Incarichi attivi ───────────────────────────────── -->
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
                    <div style="display:flex;align-items:center;gap:.4rem;">
                        <span style="font-weight:700;font-size:.88rem;color:var(--text-primary);">Incarichi attivi</span>
                        <span style="background:rgba(245,158,11,.12);color:#f59e0b;border-radius:10px;padding:1px 7px;font-size:.65rem;font-weight:700;">${inCorso.length}</span>
                    </div>
                    ${completati.length ? `<span style="font-size:.68rem;color:var(--text-tertiary);">${completati.length} conclusi</span>` : ''}
                </div>
                ${inCorso.length === 0
                    ? `<div style="${CSS.card}padding:2rem;text-align:center;">
                        <span class="material-icons-round" style="font-size:1.8rem;opacity:.15;display:block;margin-bottom:.4rem;">work_off</span>
                        <span style="font-size:.8rem;color:var(--text-tertiary);">Nessun incarico attivo</span>
                       </div>`
                    : `<div style="display:flex;flex-direction:column;gap:.875rem;">
                        ${inCorso.map(a => _assignmentCard(a, payByAssignment[a.id] || [])).join('')}
                       </div>`
                }
            </div>

            <!-- ── COL 2: Pagamenti ──────────────────────────────────────── -->
            <div style="display:flex;flex-direction:column;gap:1rem;">
                ${_paySegmentBar(daFatturare, fatturaRicevuta, programmati, senzaData)}
                ${activePaysSorted.length === 0 ? '' :
                    `<div style="${CSS.card}padding:0 1rem;max-height:360px;overflow-y:auto;scrollbar-width:thin;">
                        ${activePaysSorted.map((p,i) => _payItem(p, i < activePaysSorted.length-1)).join('')}
                     </div>`
                }
            </div>

            <!-- ── COL 3: Compensi ──────────────────────────────────────── -->
            <div style="display:flex;flex-direction:column;gap:1rem;">

                <!-- Filtro anno — solo sopra Compensi + Lavoro -->
                ${availableYears.length > 1 ? `
                <div style="display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;padding:.1rem 0;">
                    <span style="font-size:.6rem;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-right:.15rem;">Anno</span>
                    ${availableYears.map(y => _pill(y, selectedYear===y)).join('')}
                    ${_pill('all', selectedYear==='all', 'Tutto')}
                </div>` : ''}

                <!-- Card economics -->
                <div style="${CSS.card}padding:1.35rem 1.4rem;">
                    <div style="font-weight:700;font-size:.9rem;color:var(--text-primary);margin-bottom:1rem;">Compensi</div>
                    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.4rem;">
                        <div>
                            <div style="font-size:.54rem;color:var(--text-tertiary);text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Totale ${yearLabel}</div>
                            <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);font-family:'Outfit',sans-serif;line-height:1.2;">${formatAmount(budgetAnno)}€</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:.54rem;color:#10b981;text-transform:uppercase;font-weight:700;letter-spacing:.05em;">Incassato</div>
                            <div style="font-size:1.15rem;font-weight:800;color:#10b981;font-family:'Outfit',sans-serif;line-height:1.2;">${formatAmount(incassatoAnno)}€</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;">
                        <div style="flex:1;height:5px;border-radius:3px;overflow:hidden;background:rgba(0,0,0,.05);">
                            <div style="width:${budgetPct}%;height:100%;background:${budgetPct>=100?'#10b981':budgetPct>=50?'#3b82f6':'#8b5cf6'};border-radius:3px;transition:width .5s;"></div>
                        </div>
                        <span style="font-size:.62rem;font-weight:700;color:${budgetPct>=100?'#10b981':'var(--text-tertiary)'};">${budgetPct}%</span>
                    </div>
                    <div style="font-size:.62rem;color:var(--text-tertiary);text-align:right;">${ricevutiAnno} pagamenti ricevuti</div>
                </div>

                <!-- Grafico incassato per mese -->
                ${_barChart('Incassato / mese', MONTHS, monthlyIncassato, '#10b981', v => formatAmount(v)+'€')}

            </div>

            <!-- ── COL 4: Lavoro ─────────────────────────────────────────── -->
            <div style="display:flex;flex-direction:column;gap:1rem;">

                <!-- Card task + attività -->
                <div style="${CSS.card}padding:1.35rem 1.4rem;">
                    <div style="font-weight:700;font-size:.9rem;color:var(--text-primary);margin-bottom:1rem;">Lavoro</div>

                    <!-- Stato attuale (no filtro anno) -->
                    <div class="ma-section-label">In corso</div>
                    <div class="ma-stat-row">
                        <span class="ma-stat-label">
                            <span class="material-icons-round" style="font-size:12px;color:#3b82f6;">radio_button_checked</span>Task aperte
                        </span>
                        <span class="ma-stat-value" style="color:#3b82f6;">${taskAperte}</span>
                    </div>
                    <div class="ma-stat-row" style="margin-bottom:.6rem;">
                        <span class="ma-stat-label">
                            <span class="material-icons-round" style="font-size:12px;color:#f59e0b;">play_circle</span>Attività attive
                        </span>
                        <span class="ma-stat-value" style="color:#f59e0b;">${attivInCorso}</span>
                    </div>

                    <!-- Storico anno -->
                    <div class="ma-section-label" style="margin-top:.55rem;">${yearLabel}</div>
                    <div class="ma-stat-row">
                        <span class="ma-stat-label">
                            <span class="material-icons-round" style="font-size:12px;color:#10b981;">check_circle</span>Task chiuse
                        </span>
                        <span class="ma-stat-value">${taskChiuse}</span>
                    </div>
                    <div class="ma-stat-row">
                        <span class="ma-stat-label">
                            <span class="material-icons-round" style="font-size:12px;color:#10b981;">check_circle</span>Attività chiuse
                        </span>
                        <span class="ma-stat-value">${attivChiuse}</span>
                    </div>
                </div>

                <!-- Grafico task + attività chiuse per mese -->
                ${_barChart('Chiuse / mese', MONTHS, monthlyPmDone, '#3b82f6', v => String(v))}

            </div>
        </div>

        <!-- ══ TABS STORICI full width ════════════════════════════════════ -->
        <div style="${CSS.card}overflow:hidden;">
            <div style="padding:0 1.5rem;border-bottom:1px solid var(--glass-border);display:flex;gap:.25rem;background:rgba(0,0,0,.015);">
                ${_tabHdr('assignments','Tutti gli incarichi', assignments.length, true)}
                ${_tabHdr('payments',   'Storico pagamenti',   payments.length,    false)}
                ${_tabHdr('invoices',   'Fatture',             invoices.length,    false)}
            </div>
            <div id="ma-pane-assignments">${_tabAssignments(assignments)}</div>
            <div id="ma-pane-payments"    style="display:none;">${_tabAllPayments(payments)}</div>
            <div id="ma-pane-invoices"    style="display:none;">${_tabInvoices(invoices)}</div>
        </div>

    </div>`;

    // Year pills
    container.querySelectorAll('.ma-pill').forEach(el =>
        el.addEventListener('click', () => onYearChange(el.dataset.year === 'all' ? 'all' : +el.dataset.year))
    );

    // Tabs
    container.querySelectorAll('.ma-tab').forEach(tab =>
        tab.addEventListener('click', () => {
            const t = tab.dataset.tab;
            container.querySelectorAll('.ma-tab').forEach(x => {
                x.style.borderBottomColor='transparent'; x.style.color='var(--text-tertiary)'; x.style.fontWeight='400';
                const b=x.querySelector('.ma-tbadge'); if(b){b.style.background='rgba(0,0,0,.06)';b.style.color='var(--text-tertiary)';}
            });
            tab.style.borderBottomColor='var(--brand-blue)'; tab.style.color='var(--brand-blue)'; tab.style.fontWeight='600';
            const b=tab.querySelector('.ma-tbadge'); if(b){b.style.background='rgba(59,130,246,.12)';b.style.color='var(--brand-blue)';}
            ['assignments','payments','invoices'].forEach(k => {
                const p=container.querySelector(`#ma-pane-${k}`); if(p) p.style.display=(k===t?'':'none');
            });
        })
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = {
    card: 'background:rgba(255,255,255,.75);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.35);border-radius:16px;box-shadow:0 2px 16px rgba(0,0,0,.05);',
};

// ─────────────────────────────────────────────────────────────────────────────
// PREDICATI
// ─────────────────────────────────────────────────────────────────────────────
function _isActive(s)    { const v=(s||'').toLowerCase(); return v.includes('corso')||v.includes('attiv'); }
function _isCompleted(s) { const v=(s||'').toLowerCase(); return v.includes('complet')||v.includes('terminat')||v.includes('chiuso'); }
function _isPmDone(s)    { const v=(s||'').toLowerCase(); return v==='done'||v==='completato'||v==='completata'; }
function _msg(t)         { return `<div style="padding:2rem;text-align:center;color:var(--text-secondary);">${t}</div>`; }

function _statusColor(s) {
    const v=(s||'').toLowerCase();
    if(_isCompleted(v))         return '#10b981';
    if(v.includes('corso'))     return '#f59e0b';
    if(v.includes('sospeso'))   return '#ef4444';
    if(v.includes('attesa'))    return '#3b82f6';
    if(v.includes('to do')||v==='todo') return '#6b7280';
    return '#6366f1';
}

function _payStatusMeta(s, hasDueDate=true) {
    if (PAY.isInvitoInviato(s))    return { color:'#f59e0b', label:'Da fatturare',  bg:'rgba(245,158,11,.08)' };
    if (PAY.isFatturaRicevuta(s))  return { color:'#3b82f6', label:'In attesa',     bg:'rgba(59,130,246,.08)' };
    if (PAY.isCompleted(s))        return { color:'#10b981', label:'Ricevuto',       bg:'rgba(16,185,129,.08)' };
    if (!hasDueDate)               return { color:'#e879f9', label:'Senza data',    bg:'rgba(232,121,249,.08)' };
    return                                { color:'#6b7280', label:'Programmato',   bg:'rgba(107,114,128,.08)' };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTI
// ─────────────────────────────────────────────────────────────────────────────
function _assignmentCard(a, aPayments) {
    const sc = _statusColor(a.status);
    const code   = a.id || '-';
    const client = a.client?.business_name || '-';
    const order  = a.order?.title || '';
    const budgetNum = parseFloat(a.total_amount) || 0;

    // Incassato per questo incarico
    const incassato = aPayments.filter(p => PAY.isCompleted(p.status)).reduce((s,p) => s + (parseFloat(p.amount)||0), 0);
    const pct = budgetNum > 0 ? Math.min(Math.round((incassato/budgetNum)*100), 100) : 0;
    const totalPay = aPayments.length;
    const donePay  = aPayments.filter(p => PAY.isCompleted(p.status)).length;
    const pctColor = pct >= 100 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#8b5cf6';

    // Prossimo pagamento non completato
    const nextPay = aPayments
        .filter(p => !PAY.isCompleted(p.status))
        .sort((x,y) => {
            const rank = p => PAY.isInvitoInviato(p.status)?0 : PAY.isFatturaRicevuta(p.status)?1 : 2;
            const d = rank(x) - rank(y);
            if (d !== 0) return d;
            if (!x.due_date && !y.due_date) return 0;
            if (!x.due_date) return 1;
            if (!y.due_date) return -1;
            return new Date(x.due_date) - new Date(y.due_date);
        })[0];
    const nextMeta = nextPay ? _payStatusMeta(nextPay.status, !!nextPay.due_date) : null;

    return `
        <div class="ma-card-hover" onclick="window.location.hash='assignment-detail/${a.id}'"
             style="${CSS.card}padding:0;cursor:pointer;overflow:hidden;border-left:3px solid ${sc};">

            <div style="padding:1.25rem 1.35rem 1.1rem;">
                <!-- Riga 1: codice · cliente -->
                <div style="display:flex;align-items:baseline;gap:.5rem;line-height:1.3;">
                    <span style="font-weight:800;font-size:.8rem;color:var(--brand-blue);font-family:monospace;letter-spacing:.03em;flex-shrink:0;">${code}</span>
                    <span style="font-weight:700;font-size:.92rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${client}</span>
                </div>
                ${order ? `<div style="font-size:.73rem;color:var(--text-tertiary);margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${order}</div>` : ''}

                <!-- Progress bar -->
                <div style="margin-top:.85rem;display:flex;align-items:center;gap:.6rem;">
                    <div style="flex:1;height:5px;border-radius:3px;overflow:hidden;background:rgba(0,0,0,.05);">
                        <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:3px;transition:width .5s cubic-bezier(.4,0,.2,1);"></div>
                    </div>
                    <span style="font-size:.65rem;font-weight:700;color:${pct>=100?'#10b981':'var(--text-tertiary)'};">${pct}%</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:.35rem;">
                    <span style="font-size:.7rem;color:var(--text-tertiary);">${formatAmount(incassato)}€ <span style="opacity:.5;">su</span> ${formatAmount(budgetNum)}€</span>
                    ${totalPay > 0 ? `<span style="font-size:.65rem;color:var(--text-tertiary);">${donePay}/${totalPay} pagamenti</span>` : ''}
                </div>
            </div>

            ${nextPay ? `
            <div style="padding:.75rem 1.35rem;background:${nextMeta.bg};display:flex;justify-content:space-between;align-items:center;gap:.5rem;">
                <div style="display:flex;align-items:center;gap:.35rem;min-width:0;">
                    <span style="background:${nextMeta.color}22;color:${nextMeta.color};border-radius:4px;padding:1px 6px;font-size:.6rem;font-weight:700;white-space:nowrap;">${nextMeta.label}</span>
                    <span style="font-size:.7rem;color:var(--text-tertiary);white-space:nowrap;">${nextPay.due_date ? formatDate(nextPay.due_date) : 'senza scadenza'}</span>
                </div>
                <span style="font-weight:800;font-size:.85rem;font-family:'Outfit',sans-serif;color:var(--text-primary);flex-shrink:0;">${formatAmount(nextPay.amount)}€</span>
            </div>` : ''}
        </div>`;
}

function _paySegmentBar(daFatturare, fatturaRicevuta, programmati, senzaData) {
    const segments = [
        { items: daFatturare,     label: 'Da fatturare',  color: '#f59e0b' },
        { items: fatturaRicevuta, label: 'In attesa',     color: '#3b82f6' },
        { items: programmati,     label: 'Programmati',   color: '#94a3b8' },
        { items: senzaData,       label: 'Senza data',    color: '#e879f9' },
    ];
    const totalAmount = segments.reduce((s, seg) => s + seg.items.reduce((ss, p) => ss + (parseFloat(p.amount)||0), 0), 0);
    const totalCount  = segments.reduce((s, seg) => s + seg.items.length, 0);

    if (totalCount === 0) return `<div style="${CSS.card}padding:1.5rem;text-align:center;font-size:.8rem;color:var(--text-tertiary);">Nessun pagamento</div>`;

    return `
        <div style="${CSS.card}padding:1.35rem 1.4rem;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
                <span style="font-weight:700;font-size:.92rem;color:var(--text-primary);">Pagamenti</span>
                <span style="font-size:.75rem;font-weight:700;color:var(--text-tertiary);">${totalCount} totali · ${formatAmount(totalAmount)}€</span>
            </div>
            <!-- Barra segmentata -->
            <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:rgba(0,0,0,.04);margin-bottom:1rem;">
                ${segments.map(seg => {
                    const amt = seg.items.reduce((s, p) => s + (parseFloat(p.amount)||0), 0);
                    const pct = totalAmount > 0 ? (amt / totalAmount) * 100 : 0;
                    return pct > 0 ? `<div style="width:${pct}%;background:${seg.color};transition:width .4s;" title="${seg.label}: ${formatAmount(amt)}€"></div>` : '';
                }).join('')}
            </div>
            <!-- Legenda 2×2 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem .75rem;">
                ${segments.map(seg => {
                    const amt = seg.items.reduce((s, p) => s + (parseFloat(p.amount)||0), 0);
                    return `<div style="display:flex;align-items:center;gap:.4rem;">
                        <div style="width:7px;height:7px;border-radius:2px;background:${seg.color};flex-shrink:0;"></div>
                        <span style="font-size:.72rem;color:var(--text-secondary);font-weight:500;">${seg.label}</span>
                        <span style="font-weight:800;font-size:.82rem;color:var(--text-primary);margin-left:auto;font-family:'Outfit',sans-serif;">${seg.items.length}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
}

// Card-list item per pagamenti attivi (sezione pagamenti)
function _payItem(p, hasBorder=true) {
    const meta = _payStatusMeta(p.status, !!p.due_date);
    const isUrgent = PAY.isInvitoInviato(p.status);
    const dateStr = p.due_date ? formatDate(p.due_date) : null;
    const isOverdue = p.due_date && new Date(p.due_date) < new Date();

    return `
        <div style="padding:.9rem 0;${hasBorder?'border-bottom:1px solid rgba(0,0,0,.04);':''}display:flex;justify-content:space-between;align-items:flex-start;gap:.875rem;${isUrgent?'':''}">
            <div style="flex:1;min-width:0;">
                <div style="font-size:.875rem;font-weight:600;color:var(--text-primary);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.title||'Pagamento'}</div>
                <div style="display:flex;align-items:center;gap:.4rem;margin-top:.3rem;flex-wrap:wrap;">
                    <span style="background:${meta.color}14;color:${meta.color};border-radius:5px;padding:1px 7px;font-size:.65rem;font-weight:700;">${meta.label}</span>
                    ${dateStr ? `<span style="font-size:.68rem;color:${isOverdue?'#ef4444':'var(--text-tertiary)'};">
                        ${isOverdue ? '⚠ scad. ' : 'entro '}${dateStr}
                    </span>` : `<span style="font-size:.68rem;color:var(--text-tertiary);font-style:italic;">senza scadenza</span>`}
                </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:.95rem;font-weight:800;font-family:'Outfit',sans-serif;color:var(--text-primary);">${formatAmount(p.amount)}€</div>
            </div>
        </div>`;
}

// Riga tabella per lo storico pagamenti (tab)
function _payRow(p) {
    const meta = _payStatusMeta(p.status, !!p.due_date);
    return `
        <tr style="border-bottom:1px solid var(--glass-border);">
            <td style="padding:.875rem 1.25rem;font-weight:600;font-size:.875rem;color:var(--text-primary);">${p.title||'-'}</td>
            <td style="padding:.875rem 1.25rem;">
                <span style="background:${meta.color}18;color:${meta.color};border-radius:6px;padding:2px 8px;font-size:.68rem;font-weight:700;">${meta.label}</span>
            </td>
            <td style="padding:.875rem 1.25rem;text-align:right;font-weight:800;font-size:.9rem;font-family:'Outfit',sans-serif;">${formatAmount(p.amount)}€</td>
            <td style="padding:.875rem 1.25rem;font-size:.82rem;color:var(--text-secondary);">${p.due_date?formatDate(p.due_date):'-'}</td>
        </tr>`;
}

function _pill(year, active, label=null) {
    return `<button class="ma-pill" data-year="${year}" style="
        padding:.3rem .85rem;border-radius:20px;cursor:pointer;transition:all .2s;
        border:1px solid ${active?'var(--brand-blue)':'rgba(0,0,0,.1)'};
        background:${active?'var(--brand-blue)':'transparent'};
        color:${active?'#fff':'var(--text-secondary)'};
        font-size:.8rem;font-weight:${active?'700':'500'};
    ">${label||year}</button>`;
}

function _kpi(label, value, icon, color) {
    return `<div style="${CSS.card}padding:1.1rem 1.25rem;display:flex;align-items:center;gap:.875rem;">
        <div style="width:40px;height:40px;border-radius:10px;background:${color}14;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span class="material-icons-round" style="font-size:19px;">${icon}</span>
        </div>
        <div>
            <div style="font-size:.6rem;color:var(--text-tertiary);text-transform:uppercase;font-weight:700;letter-spacing:.05em;margin-bottom:.15rem;">${label}</div>
            <div style="font-size:1.25rem;font-weight:800;color:var(--text-primary);font-family:'Plus Jakarta Sans',sans-serif;line-height:1.1;">${value}</div>
        </div>
    </div>`;
}

function _barChart(title, labels, values, color, fmt) {
    const max = Math.max(...values, 1);
    const total = values.reduce((s,v)=>s+v,0);
    return `
        <div style="${CSS.card}padding:1.35rem 1.4rem;">
            <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:1.1rem;">
                <span style="font-weight:700;font-size:.875rem;color:var(--text-primary);">${title}</span>
                ${total > 0 ? `<span style="font-size:.8rem;font-weight:700;color:${color};">${fmt(total)}</span>` : ''}
            </div>
            <div style="display:flex;align-items:flex-end;gap:4px;height:96px;">
                ${values.map((v,i) => {
                    const h = v>0 ? Math.max(Math.round((v/max)*100),8) : 3;
                    const now = new Date();
                    const isCurrent = i===now.getMonth();
                    const col = v>0 ? (isCurrent?color:`${color}70`) : 'rgba(0,0,0,.06)';
                    return `<div title="${labels[i]}: ${fmt(v)}" style="flex:1;background:${col};height:${h}%;border-radius:3px 3px 0 0;transition:height .3s;cursor:default;"></div>`;
                }).join('')}
            </div>
            <div style="display:flex;gap:4px;margin-top:5px;">
                ${labels.map(m=>`<div style="flex:1;text-align:center;font-size:.53rem;color:var(--text-tertiary);font-weight:600;">${m}</div>`).join('')}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────────────────────
const TH = (t,right=false) =>
    `<th style="padding:.75rem 1.25rem;font-size:.68rem;color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:.05em;${right?'text-align:right;':''}">${t}</th>`;

function _tabHdr(key, label, count, active) {
    return `<div class="ma-tab" data-tab="${key}" style="
        padding:.875rem 1rem;cursor:pointer;font-size:.875rem;display:flex;align-items:center;gap:.4rem;
        border-bottom:2px solid ${active?'var(--brand-blue)':'transparent'};
        color:${active?'var(--brand-blue)':'var(--text-tertiary)'};
        font-weight:${active?'600':'400'};transition:all .2s;">
        ${label}
        <span class="ma-tbadge" style="border-radius:10px;padding:1px 7px;font-size:.68rem;font-weight:700;
            background:${active?'rgba(59,130,246,.12)':'rgba(0,0,0,.06)'};
            color:${active?'var(--brand-blue)':'var(--text-tertiary)'};">${count}</span>
    </div>`;
}

function _empty(icon, text) {
    return `<div style="padding:3rem;text-align:center;color:var(--text-tertiary);">
        <span class="material-icons-round" style="font-size:2.5rem;display:block;margin-bottom:.6rem;opacity:.2;">${icon}</span>
        <span style="font-size:.875rem;">${text}</span></div>`;
}

function _tabAssignments(list) {
    if (!list.length) return _empty('assignment_late','Nessun incarico.');
    return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--glass-border);">${TH('Codice · Cliente')}${TH('Commessa')}${TH('Stato')}${TH('Budget',true)}${TH('Inizio')}</tr></thead>
        <tbody>${list.map(a => {
            const sc=_statusColor(a.status);
            return `<tr onclick="window.location.hash='assignment-detail/${a.id}'"
                style="cursor:pointer;border-bottom:1px solid var(--glass-border);transition:background .15s;"
                onmouseover="this.style.background='rgba(0,0,0,.02)'" onmouseout="this.style.background='transparent'">
                <td style="padding:.875rem 1.25rem;">
                    <div style="font-weight:700;color:var(--brand-blue);font-size:.82rem;font-family:monospace;">${a.id}</div>
                    <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.15rem;">${a.client?.business_name||'-'}</div>
                </td>
                <td style="padding:.875rem 1.25rem;font-size:.82rem;color:var(--text-secondary);max-width:200px;">
                    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.order?.title||'-'}</div>
                </td>
                <td style="padding:.875rem 1.25rem;">
                    <span style="background:${sc}18;color:${sc};border-radius:6px;padding:2px 8px;font-size:.68rem;font-weight:700;">${a.status||'N/D'}</span>
                </td>
                <td style="padding:.875rem 1.25rem;text-align:right;font-weight:800;font-size:.88rem;font-family:'Outfit',sans-serif;">${formatAmount(a.total_amount)}€</td>
                <td style="padding:.875rem 1.25rem;font-size:.8rem;color:var(--text-tertiary);">${a.start_date?formatDate(a.start_date):'-'}</td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
}

function _tabAllPayments(list) {
    if (!list.length) return _empty('payments','Nessun pagamento.');
    const orderRank = p => { if(PAY.isInvitoInviato(p.status))return 0; if(PAY.isFatturaRicevuta(p.status))return 1; if(PAY.isCompleted(p.status))return 3; return 2; };
    const sorted = [...list].sort((a,b) => {
        const d = orderRank(a) - orderRank(b);
        if (d !== 0) return d;
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
    });
    return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--glass-border);">${TH('Titolo')}${TH('Stato')}${TH('Importo',true)}${TH('Scadenza')}</tr></thead>
        <tbody>${sorted.map(p => _payRow(p)).join('')}</tbody></table></div>`;
}

function _tabInvoices(list) {
    if (!list.length) return _empty('receipt_long','Nessuna fattura.');
    return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--glass-border);">${TH('N° Fattura')}${TH('Emissione')}${TH('Scadenza')}${TH('Imponibile',true)}${TH('Stato')}</tr></thead>
        <tbody>${list.map(inv => {
            const paid=(inv.status||'').toLowerCase().includes('pagat');
            const sc=paid?'#10b981':'#3b82f6';
            return `<tr style="border-bottom:1px solid var(--glass-border);">
                <td style="padding:.875rem 1.25rem;">
                    <div style="font-weight:700;font-size:.875rem;">${inv.invoice_number||'-'}</div>
                    ${inv.description?`<div style="font-size:.72rem;color:var(--text-tertiary);margin-top:.1rem;">${inv.description}</div>`:''}
                </td>
                <td style="padding:.875rem 1.25rem;font-size:.82rem;color:var(--text-secondary);">${inv.issue_date?formatDate(inv.issue_date):'-'}</td>
                <td style="padding:.875rem 1.25rem;font-size:.82rem;color:var(--text-secondary);">${inv.due_date?formatDate(inv.due_date):'-'}</td>
                <td style="padding:.875rem 1.25rem;text-align:right;font-weight:800;font-size:.88rem;font-family:'Outfit',sans-serif;">${formatAmount(inv.amount_tax_excluded)}€</td>
                <td style="padding:.875rem 1.25rem;"><span style="background:${sc}18;color:${sc};border-radius:6px;padding:2px 8px;font-size:.68rem;font-weight:700;">${inv.status||'N/D'}</span></td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
}
