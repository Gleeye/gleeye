import { state } from '/js/modules/state.js?v=8000';
import { formatAmount } from '../modules/utils.js?v=8000';
import {
    fetchCollaborators, upsertCollaborator, deleteCollaborator,
    fetchAssignments,
    fetchPartnerContacts, upsertPartnerContact, deletePartnerContact,
    fetchPartnerContracts, upsertPartnerContract, deletePartnerContract
} from '../modules/api.js?v=8000';

// ── helpers ──────────────────────────────────────────────────────────────────

const CONTRACT_TYPES = {
    nda: 'NDA',
    framework_agreement: 'Framework Agreement',
    confidentiality: 'Riservatezza',
    other: 'Altro'
};

function scorecard(assignments) {
    const total = assignments.length;
    const completed = assignments.filter(a => a.status === 'Completato' || a.status === 'completed').length;
    const onTime = assignments.filter(a =>
        (a.status === 'Completato' || a.status === 'completed')
    ).length; // proxy: completed = delivered (no deadline field available)
    const pct = total > 0 ? Math.round((onTime / total) * 100) : null;
    const totalVolume = assignments.reduce((s, a) => s + parseFloat(a.total_amount || 0), 0);
    const last = assignments[0] || null;
    return { total, completed, pct, totalVolume, last };
}

function starsHtml(rating, interactive = false, partnerId = '') {
    const val = parseFloat(rating) || 0;
    const stars = [1, 2, 3, 4, 5].map(n => {
        const filled = n <= Math.round(val);
        const style = 'font-size: 1.3rem; color: ' + (filled ? 'var(--color-warning, #f59e0b)' : 'var(--border-light)') + '; cursor: ' + (interactive ? 'pointer' : 'default') + ';';
        const attrs = interactive ? 'data-star="' + n + '" data-partner-id="' + partnerId + '" class="star-btn"' : '';
        return '<span class="material-icons-round" style="' + style + '" ' + attrs + '>' + (filled ? 'star' : 'star_border') + '</span>';
    }).join('');
    const label = val > 0 ? '<span style="margin-left:0.4rem;font-size:0.85rem;font-weight:600;color:var(--text-secondary);">' + val.toFixed(1) + '</span>' : '';
    return stars + label;
}

function statusBadge(status) {
    const map = {
        'Completato': { bg: '#10b98115', color: '#10b981' },
        'completed': { bg: '#10b98115', color: '#10b981' },
        'In corso': { bg: '#3b82f615', color: '#3b82f6' },
        'active': { bg: '#3b82f615', color: '#3b82f6' },
    };
    const s = map[status] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
    return '<span style="background:' + s.bg + ';color:' + s.color + ';padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;">' + (status || '-') + '</span>';
}

// ── list ─────────────────────────────────────────────────────────────────────

export async function renderWhiteLabelPartners(container) {
    if (!state.collaborators || state.collaborators.length === 0) {
        await fetchCollaborators();
    }

    const partners = state.collaborators.filter(c => c.type === 'white_label' && c.is_active !== false);

    container.innerHTML = `
        <div class="animate-fade-in" style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h1 style="font-size: 2rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 0.75rem;">
                        <span class="material-icons-round" style="font-size: 2.2rem; color: var(--brand-blue);">corporate_fare</span>
                        Partner White Label
                    </h1>
                    <p style="color: var(--text-tertiary); margin-top: 0.5rem;">Gestione aziende partner e dati fiscali per fatturazione passiva.</p>
                </div>
                <button class="primary-btn" id="add-partner-wl-btn">
                    <span class="material-icons-round">add</span>
                    Nuovo Partner
                </button>
            </div>

            <div id="partners-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
                ${partners.map(p => renderPartnerCard(p)).join('')}
                ${partners.length === 0 ? '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-tertiary);">Nessun partner trovato. Clicca su "Nuovo Partner" per iniziare.</div>' : ''}
            </div>
        </div>
    `;

    document.getElementById('add-partner-wl-btn')?.addEventListener('click', () => openWhiteLabelPartnerModal());

    container.querySelectorAll('.partner-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.hash = '#white-label-partner-detail/' + card.dataset.id;
        });
    });
}

// Stile lifecycle (B7 — coerente con collaborators)
const _WL_LIFECYCLE_STYLE = {
    attivo:      { label: 'Attivo',         color: '#10b981' },
    dormiente:   { label: 'Dormiente',      color: '#94a3b8' },
    candidato:   { label: 'Candidato',      color: '#3b82f6' },
    valutazione: { label: 'In valutazione', color: '#f59e0b' },
    perso:       { label: 'Perso',          color: '#ef4444' },
};

function renderPartnerCard(p) {
    const rating = p.quality_rating;
    const lc = _WL_LIFECYCLE_STYLE[p.status_lifecycle];
    const lcBadge = lc ? `<span title="Lifecycle: ${lc.label}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:${lc.color}18;color:${lc.color};border:1px solid ${lc.color}40;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;"><span style="width:6px;height:6px;border-radius:50%;background:${lc.color};"></span>${lc.label}</span>` : '';
    return `
        <div class="glass-card partner-card clickable-card" data-id="${p.id}" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="width: 52px; height: 52px; border-radius: 12px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                    <span class="material-icons-round" style="font-size: 1.8rem;">corporate_fare</span>
                </div>
                <div style="display:flex; gap:0.4rem; align-items:center;">
                    ${lcBadge}
                    <button class="icon-btn edit-btn" style="padding: 4px;" onclick="event.stopPropagation(); window.openWhiteLabelPartnerModal('${p.id}')">
                        <span class="material-icons-round" style="font-size: 1.2rem;">edit</span>
                    </button>
                </div>
            </div>

            <div>
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">${p.full_name}</h3>
                <p style="margin: 0.25rem 0 0; color: var(--brand-blue); font-size: 0.8rem; font-weight: 500;">Partner White Label</p>
                ${rating ? '<div style="margin-top:0.4rem;">' + starsHtml(rating) + '</div>' : ''}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
                <div>
                    <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">P.IVA</div>
                    <div style="font-size: 0.85rem; font-weight: 500;">${p.vat_number || '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase;">Paese</div>
                    <div style="font-size: 0.85rem; font-weight: 500;">${p.country || 'IT'}</div>
                </div>
            </div>
        </div>
    `;
}

// ── detail ────────────────────────────────────────────────────────────────────

export async function renderWhiteLabelPartnerDetail(container) {
    const id = state.currentId;
    if (!state.collaborators || state.collaborators.length === 0) await fetchCollaborators();
    const p = state.collaborators.find(x => x.id == id);

    if (!p) {
        container.innerHTML = '<div style="padding: 2rem;">Partner non trovato.</div>';
        return;
    }

    // carica dati paralleli
    if (!state.assignments) await fetchAssignments();
    const assignments = (state.assignments || []).filter(a => a.collaborator_id === p.id);
    const [contacts, contracts] = await Promise.all([
        fetchPartnerContacts(p.id),
        fetchPartnerContracts(p.id)
    ]);

    const sc = scorecard(assignments);

    container.innerHTML = buildDetailHtml(p, assignments, contacts, contracts, sc);

    // tab switching
    const tabs = container.querySelectorAll('.wl-tab-btn');
    const contents = container.querySelectorAll('.wl-tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
                t.style.fontWeight = '500';
            });
            contents.forEach(c => c.classList.add('hidden'));
            tab.style.borderBottomColor = 'var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';
            tab.style.fontWeight = '600';
            document.getElementById('wl-tab-' + tab.dataset.tab)?.classList.remove('hidden');
        });
    });

    // star rating click via delegation on scorecard tab
    container.addEventListener('click', async e => {
        const btn = e.target.closest('.star-btn');
        if (!btn) return;
        const newRating = parseFloat(btn.dataset.star);
        const pId = btn.dataset.partnerId;
        if (!pId) return;
        try {
            await upsertCollaborator({ id: pId, quality_rating: newRating });
            const idx = state.collaborators.findIndex(c => c.id === pId);
            if (idx >= 0) state.collaborators[idx].quality_rating = newRating;
            const starsEl = document.getElementById('scorecard-stars');
            if (starsEl) starsEl.innerHTML = starsHtml(newRating, true, pId);
            window.showAlert('Rating aggiornato', 'success');
        } catch (err) {
            window.showAlert('Errore: ' + err.message, 'error');
        }
    });

    attachReferentiEvents(p.id, contacts);
    attachContrattiEvents(p.id, contracts);
}

function buildDetailHtml(p, assignments, contacts, contracts, sc) {
    return `
        <div class="animate-fade-in" style="padding: 2rem; max-width: 1100px; margin: 0 auto;">
            <!-- header -->
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
                <button class="icon-btn" onclick="window.history.back()">
                    <span class="material-icons-round">arrow_back</span>
                </button>
                <div style="flex:1; min-width: 200px;">
                    <h1 style="margin: 0; font-size: 1.6rem;">${p.full_name}</h1>
                    <p style="margin: 0.25rem 0 0; color: var(--text-tertiary); font-size: 0.85rem;">${p.vat_number || ''}</p>
                </div>
                <span class="badge" style="background: var(--brand-blue-light); color: var(--brand-blue);">Partner WL</span>
                <button class="primary-btn secondary" onclick="window.openWhiteLabelPartnerModal('${p.id}')">
                    <span class="material-icons-round">edit</span> Modifica
                </button>
            </div>

            <!-- tab nav -->
            <div style="display: flex; gap: 2rem; border-bottom: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
                <button class="wl-tab-btn" data-tab="dati" style="padding: 0.75rem 0; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">Dati</button>
                <button class="wl-tab-btn" data-tab="scorecard" style="padding: 0.75rem 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); font-weight: 500; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">Scorecard</button>
                <button class="wl-tab-btn" data-tab="referenti" style="padding: 0.75rem 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); font-weight: 500; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">Referenti (${contacts.length})</button>
                <button class="wl-tab-btn" data-tab="contratti" style="padding: 0.75rem 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); font-weight: 500; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">Contratti (${contracts.length})</button>
            </div>

            <!-- tab: dati -->
            <div id="wl-tab-dati" class="wl-tab-content">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round">business</span> Dati Societari
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Ragione Sociale</label>
                                <div style="font-weight: 500;">${p.full_name}</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Partita IVA</label>
                                <div style="font-weight: 500;">${p.vat_number || '-'}</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Codice Fiscale</label>
                                <div style="font-weight: 500;">${p.fiscal_code || '-'}</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Indirizzo</label>
                                <div style="font-weight: 500;">${[p.address, p.city, p.province ? '(' + p.province + ')' : ''].filter(Boolean).join(' ') || '-'}</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Email Amm.</label>
                                <div style="font-weight: 500;">${p.email || '-'}</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">PEC</label>
                                <div style="font-weight: 500;">${p.pec || '-'}</div>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round">account_balance</span> Configurazione Fiscale
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Regime</label>
                                <div style="font-weight: 500; text-transform: capitalize;">${p.fiscal_regime || 'ordinario'}</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">IVA Default</label>
                                <div style="font-weight: 500;">${p.default_vat_rate || 22}%</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Ritenuta</label>
                                <div style="font-weight: 500;">${p.withholding_tax_rate || 0}%</div>
                            </div>
                            <div>
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Cassa Prev.</label>
                                <div style="font-weight: 500;">${p.cassa_previdenziale_rate || 0}%</div>
                            </div>
                            <div style="grid-column: span 2;">
                                <label style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase;">Termini Pagamento</label>
                                <div style="font-weight: 500;">${p.payment_terms || '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- tab: scorecard -->
            <div id="wl-tab-scorecard" class="wl-tab-content hidden">
                ${buildScorecardTab(p, assignments, sc)}
            </div>

            <!-- tab: referenti -->
            <div id="wl-tab-referenti" class="wl-tab-content hidden">
                ${buildReferentiTab(contacts, p.id)}
            </div>

            <!-- tab: contratti -->
            <div id="wl-tab-contratti" class="wl-tab-content hidden">
                ${buildContrattiTab(contracts, p.id)}
            </div>
        </div>
    `;
}

function buildScorecardTab(p, assignments, sc) {
    const kpiCard = (icon, label, value, sub) => {
        const subHtml = sub ? '<div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:0.2rem;">' + sub + '</div>' : '';
        return '<div class="glass-card" style="padding:1.5rem;display:flex;flex-direction:column;gap:0.5rem;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;color:var(--text-tertiary);font-size:0.75rem;text-transform:uppercase;">' +
            '<span class="material-icons-round" style="font-size:1.1rem;">' + icon + '</span>' + label +
            '</div>' +
            '<div style="font-size:1.6rem;font-weight:700;">' + value + '</div>' +
            subHtml +
            '</div>';
    };

    const lastAssignment = sc.last
        ? (sc.last.orders?.order_number || '-') + ' — ' + (sc.last.orders?.clients?.business_name || '')
        : 'Nessun incarico';

    return '<div style="display:flex;flex-direction:column;gap:2rem;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;">' +
        kpiCard('assignment', 'Incarichi totali', sc.total, null) +
        kpiCard('check_circle', 'Completati', sc.completed, sc.pct !== null ? sc.pct + '% del totale' : null) +
        kpiCard('payments', 'Volume affidato', formatAmount(sc.totalVolume) + '€', null) +
        kpiCard('history', 'Ultimo incarico', lastAssignment, null) +
        '</div>' +

        '<div class="glass-card" style="padding:1.5rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">' +
        '<h3 style="margin:0;display:flex;align-items:center;gap:0.5rem;"><span class="material-icons-round">star</span> Rating Qualità</h3>' +
        '<span style="font-size:0.75rem;color:var(--text-tertiary);">Clicca per aggiornare</span>' +
        '</div>' +
        '<div id="scorecard-stars" style="display:flex;align-items:center;gap:0.25rem;">' +
        starsHtml(p.quality_rating, true, p.id) +
        '</div>' +
        (p.quality_rating ? '' : '<p style="margin:0.75rem 0 0;font-size:0.85rem;color:var(--text-tertiary);">Nessun rating assegnato. Clicca su una stella per valutare.</p>') +
        '</div>' +

        (assignments.length > 0 ? '<div class="glass-card" style="padding:0;overflow:hidden;">' +
        '<div style="padding:1rem 1.5rem;background:var(--bg-secondary);font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--text-tertiary);">Storico incarichi</div>' +
        '<table style="width:100%;border-collapse:collapse;text-align:left;">' +
        '<thead style="background:var(--bg-secondary);color:var(--text-tertiary);font-size:0.75rem;text-transform:uppercase;">' +
        '<tr><th style="padding:0.75rem 1rem;">Commessa</th><th style="padding:0.75rem 1rem;">Importo</th><th style="padding:0.75rem 1rem;">Stato</th></tr>' +
        '</thead><tbody>' +
        assignments.map(a =>
            '<tr style="border-bottom:1px solid var(--glass-border);cursor:pointer;" onclick="window.location.hash=\'assignment-detail/' + a.id + '\'">' +
            '<td style="padding:0.75rem 1rem;font-weight:500;">' + (a.orders?.order_number || '-') +
            '<div style="font-size:0.75rem;color:var(--text-tertiary);">' + (a.orders?.clients?.business_name || '') + '</div></td>' +
            '<td style="padding:0.75rem 1rem;font-weight:600;">' + formatAmount(a.total_amount) + '€</td>' +
            '<td style="padding:0.75rem 1rem;">' + statusBadge(a.status) + '</td>' +
            '</tr>'
        ).join('') +
        '</tbody></table></div>' : '') +
        '</div>';
}

function buildReferentiTab(contacts, partnerId) {
    return '<div style="display:flex;flex-direction:column;gap:1.5rem;">' +
        '<div style="display:flex;justify-content:flex-end;">' +
        '<button class="primary-btn" id="wl-add-contact-btn" style="font-size:0.875rem;">' +
        '<span class="material-icons-round">person_add</span> Aggiungi Referente' +
        '</button></div>' +
        (contacts.length === 0
            ? '<div style="text-align:center;padding:3rem;background:var(--bg-secondary);border-radius:12px;color:var(--text-tertiary);">Nessun referente associato a questo partner.</div>'
            : '<div class="glass-card" style="padding:0;overflow:hidden;">' +
            '<table style="width:100%;border-collapse:collapse;text-align:left;">' +
            '<thead style="background:var(--bg-secondary);color:var(--text-tertiary);font-size:0.75rem;text-transform:uppercase;">' +
            '<tr><th style="padding:1rem;">Nome</th><th style="padding:1rem;">Ruolo</th><th style="padding:1rem;">Email</th><th style="padding:1rem;">Telefono</th><th style="padding:1rem;"></th></tr>' +
            '</thead><tbody>' +
            contacts.map(c =>
                '<tr style="border-bottom:1px solid var(--glass-border);">' +
                '<td style="padding:1rem;font-weight:500;">' + (c.full_name || (c.first_name + ' ' + c.last_name)) + '</td>' +
                '<td style="padding:1rem;color:var(--text-secondary);">' + (c.role || '-') + '</td>' +
                '<td style="padding:1rem;color:var(--text-secondary);">' + (c.email || '-') + '</td>' +
                '<td style="padding:1rem;color:var(--text-secondary);">' + (c.phone || c.mobile || '-') + '</td>' +
                '<td style="padding:1rem;text-align:right;">' +
                '<button class="icon-btn wl-edit-contact-btn" data-id="' + c.id + '" data-partner-id="' + partnerId + '" style="padding:4px;">' +
                '<span class="material-icons-round" style="font-size:1.1rem;">edit</span></button>' +
                '</td></tr>'
            ).join('') +
            '</tbody></table></div>'
        ) +
        '</div>';
}

function buildContrattiTab(contracts, partnerId) {
    const typeLabel = t => CONTRACT_TYPES[t] || t;
    return '<div style="display:flex;flex-direction:column;gap:1.5rem;">' +
        '<div style="display:flex;justify-content:flex-end;">' +
        '<button class="primary-btn" id="wl-add-contract-btn" style="font-size:0.875rem;">' +
        '<span class="material-icons-round">add</span> Aggiungi Contratto' +
        '</button></div>' +
        (contracts.length === 0
            ? '<div style="text-align:center;padding:3rem;background:var(--bg-secondary);border-radius:12px;color:var(--text-tertiary);">Nessun contratto quadro registrato per questo partner.</div>'
            : '<div class="glass-card" style="padding:0;overflow:hidden;">' +
            '<table style="width:100%;border-collapse:collapse;text-align:left;">' +
            '<thead style="background:var(--bg-secondary);color:var(--text-tertiary);font-size:0.75rem;text-transform:uppercase;">' +
            '<tr><th style="padding:1rem;">Tipo</th><th style="padding:1rem;">Titolo</th><th style="padding:1rem;">Validità</th><th style="padding:1rem;">Note</th><th style="padding:1rem;"></th></tr>' +
            '</thead><tbody>' +
            contracts.map(c => {
                const dateRange = [c.start_date, c.end_date].filter(Boolean).join(' → ') || '-';
                const fileLink = c.file_url
                    ? '<a href="' + c.file_url + '" target="_blank" style="color:var(--brand-blue);font-size:0.8rem;display:flex;align-items:center;gap:2px;"><span class="material-icons-round" style="font-size:0.9rem;">open_in_new</span>File</a>'
                    : '';
                return '<tr style="border-bottom:1px solid var(--glass-border);">' +
                    '<td style="padding:1rem;"><span class="badge">' + typeLabel(c.type) + '</span></td>' +
                    '<td style="padding:1rem;font-weight:500;">' + (c.title || '-') + '</td>' +
                    '<td style="padding:1rem;color:var(--text-secondary);font-size:0.85rem;">' + dateRange + '</td>' +
                    '<td style="padding:1rem;color:var(--text-secondary);font-size:0.85rem;max-width:200px;">' +
                    (c.notes ? '<span title="' + c.notes.replace(/"/g, '&quot;') + '">' + c.notes.slice(0, 60) + (c.notes.length > 60 ? '…' : '') + '</span>' : '-') +
                    '</td>' +
                    '<td style="padding:1rem;text-align:right;display:flex;align-items:center;gap:0.5rem;justify-content:flex-end;">' +
                    fileLink +
                    '<button class="icon-btn wl-edit-contract-btn" data-id="' + c.id + '" data-partner-id="' + partnerId + '" style="padding:4px;">' +
                    '<span class="material-icons-round" style="font-size:1.1rem;">edit</span></button>' +
                    '</td></tr>';
            }).join('') +
            '</tbody></table></div>'
        ) +
        '</div>';
}

// ── attach events ─────────────────────────────────────────────────────────────

function attachReferentiEvents(partnerId, contacts) {
    document.getElementById('wl-add-contact-btn')?.addEventListener('click', () => {
        openContactModal(partnerId, null, async () => {
            const updated = await fetchPartnerContacts(partnerId);
            const tab = document.getElementById('wl-tab-referenti');
            if (tab) {
                tab.innerHTML = buildReferentiTab(updated, partnerId);
                attachReferentiEvents(partnerId, updated);
            }
        });
    });

    document.querySelectorAll('.wl-edit-contact-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const contactId = btn.dataset.id;
            const contact = contacts?.find(c => c.id === contactId);
            openContactModal(partnerId, contact, async () => {
                const updated = await fetchPartnerContacts(partnerId);
                const tab = document.getElementById('wl-tab-referenti');
                if (tab) {
                    tab.innerHTML = buildReferentiTab(updated, partnerId);
                    attachReferentiEvents(partnerId, updated);
                }
            });
        });
    });
}

function attachContrattiEvents(partnerId, contracts) {
    document.getElementById('wl-add-contract-btn')?.addEventListener('click', () => {
        openContractModal(partnerId, null, async () => {
            const updated = await fetchPartnerContracts(partnerId);
            const tab = document.getElementById('wl-tab-contratti');
            if (tab) {
                tab.innerHTML = buildContrattiTab(updated, partnerId);
                attachContrattiEvents(partnerId, updated);
            }
        });
    });

    document.querySelectorAll('.wl-edit-contract-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const contractId = btn.dataset.id;
            const contract = contracts?.find(c => c.id === contractId);
            openContractModal(partnerId, contract, async () => {
                const updated = await fetchPartnerContracts(partnerId);
                const tab = document.getElementById('wl-tab-contratti');
                if (tab) {
                    tab.innerHTML = buildContrattiTab(updated, partnerId);
                    attachContrattiEvents(partnerId, updated);
                }
            });
        });
    });
}

// ── contact modal ─────────────────────────────────────────────────────────────

function openContactModal(partnerId, contact, onSaved) {
    let modal = document.getElementById('wl-contact-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wl-contact-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 540px; width: 90vw;">
                <div class="modal-header">
                    <h2 id="wl-contact-modal-title">Referente</h2>
                    <button class="close-modal material-icons-round" id="close-wl-contact-modal">close</button>
                </div>
                <div class="modal-body">
                    <form id="wl-contact-form">
                        <input type="hidden" id="wl-contact-id">
                        <input type="hidden" id="wl-contact-partner-id">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                            <div class="form-group">
                                <label>Nome *</label>
                                <input type="text" id="wl-contact-first-name" required>
                            </div>
                            <div class="form-group">
                                <label>Cognome *</label>
                                <input type="text" id="wl-contact-last-name" required>
                            </div>
                            <div class="form-group">
                                <label>Ruolo / Funzione</label>
                                <input type="text" id="wl-contact-role" placeholder="Es: Account Manager">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="wl-contact-email">
                            </div>
                            <div class="form-group">
                                <label>Telefono</label>
                                <input type="tel" id="wl-contact-phone">
                            </div>
                            <div class="form-group">
                                <label>Mobile</label>
                                <input type="tel" id="wl-contact-mobile">
                            </div>
                        </div>
                        <div class="form-actions" style="margin-top:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                            <button type="button" class="primary-btn danger-outline" id="wl-delete-contact-btn" style="display:none;">
                                <span class="material-icons-round">delete</span> Elimina
                            </button>
                            <div style="display:flex;gap:1rem;margin-left:auto;">
                                <button type="button" class="primary-btn secondary" id="wl-cancel-contact-modal">Annulla</button>
                                <button type="submit" class="primary-btn">Salva</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const close = () => modal.classList.remove('active');
    document.getElementById('close-wl-contact-modal').onclick = close;
    document.getElementById('wl-cancel-contact-modal').onclick = close;
    modal.onclick = e => { if (e.target === modal) close(); };

    const form = document.getElementById('wl-contact-form');
    form.reset();
    document.getElementById('wl-contact-modal-title').textContent = contact ? 'Modifica Referente' : 'Nuovo Referente';
    document.getElementById('wl-contact-id').value = contact?.id || '';
    document.getElementById('wl-contact-partner-id').value = partnerId;
    document.getElementById('wl-contact-first-name').value = contact?.first_name || '';
    document.getElementById('wl-contact-last-name').value = contact?.last_name || '';
    document.getElementById('wl-contact-role').value = contact?.role || '';
    document.getElementById('wl-contact-email').value = contact?.email || '';
    document.getElementById('wl-contact-phone').value = contact?.phone || '';
    document.getElementById('wl-contact-mobile').value = contact?.mobile || '';

    const deleteBtn = document.getElementById('wl-delete-contact-btn');
    deleteBtn.style.display = contact ? 'flex' : 'none';
    deleteBtn.onclick = async () => {
        const confirmed = await window.showConfirm('Eliminare questo referente?', 'Elimina Referente');
        if (!confirmed) return;
        try {
            await deletePartnerContact(contact.id);
            close();
            window.showAlert('Referente eliminato', 'success');
            onSaved && onSaved();
        } catch (err) {
            window.showAlert('Errore: ' + err.message, 'error');
        }
    };

    form.onsubmit = async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="loader-sm"></span>';
        const firstName = document.getElementById('wl-contact-first-name').value.trim();
        const lastName = document.getElementById('wl-contact-last-name').value.trim();
        const payload = {
            id: document.getElementById('wl-contact-id').value || undefined,
            collaborator_id: partnerId,
            relation_type: 'partner_wl',
            first_name: firstName,
            last_name: lastName,
            full_name: (firstName + ' ' + lastName).trim(),
            role: document.getElementById('wl-contact-role').value || null,
            email: document.getElementById('wl-contact-email').value || null,
            phone: document.getElementById('wl-contact-phone').value || null,
            mobile: document.getElementById('wl-contact-mobile').value || null,
        };
        if (!payload.id) delete payload.id;
        try {
            await upsertPartnerContact(payload);
            close();
            window.showAlert('Referente salvato', 'success');
            onSaved && onSaved();
        } catch (err) {
            window.showAlert('Errore: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    };

    modal.classList.add('active');
}

// ── contract modal ────────────────────────────────────────────────────────────

function openContractModal(partnerId, contract, onSaved) {
    let modal = document.getElementById('wl-contract-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wl-contract-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 580px; width: 90vw;">
                <div class="modal-header">
                    <h2 id="wl-contract-modal-title">Contratto Quadro</h2>
                    <button class="close-modal material-icons-round" id="close-wl-contract-modal">close</button>
                </div>
                <div class="modal-body">
                    <form id="wl-contract-form">
                        <input type="hidden" id="wl-contract-id">
                        <input type="hidden" id="wl-contract-partner-id">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                            <div class="form-group">
                                <label>Tipo *</label>
                                <select id="wl-contract-type">
                                    <option value="nda">NDA</option>
                                    <option value="framework_agreement">Framework Agreement</option>
                                    <option value="confidentiality">Riservatezza</option>
                                    <option value="other">Altro</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Titolo</label>
                                <input type="text" id="wl-contract-title" placeholder="Es: NDA 2024">
                            </div>
                            <div class="form-group">
                                <label>Data inizio</label>
                                <input type="date" id="wl-contract-start">
                            </div>
                            <div class="form-group">
                                <label>Data scadenza</label>
                                <input type="date" id="wl-contract-end">
                            </div>
                            <div class="form-group full-width" style="grid-column:span 2;">
                                <label>URL File (Drive, Dropbox…)</label>
                                <input type="url" id="wl-contract-file-url" placeholder="https://drive.google.com/…">
                            </div>
                            <div class="form-group full-width" style="grid-column:span 2;">
                                <label>Note</label>
                                <textarea id="wl-contract-notes" rows="3" style="width:100%;resize:vertical;"></textarea>
                            </div>
                        </div>
                        <div class="form-actions" style="margin-top:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                            <button type="button" class="primary-btn danger-outline" id="wl-delete-contract-btn" style="display:none;">
                                <span class="material-icons-round">delete</span> Elimina
                            </button>
                            <div style="display:flex;gap:1rem;margin-left:auto;">
                                <button type="button" class="primary-btn secondary" id="wl-cancel-contract-modal">Annulla</button>
                                <button type="submit" class="primary-btn">Salva</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const close = () => modal.classList.remove('active');
    document.getElementById('close-wl-contract-modal').onclick = close;
    document.getElementById('wl-cancel-contract-modal').onclick = close;
    modal.onclick = e => { if (e.target === modal) close(); };

    const form = document.getElementById('wl-contract-form');
    form.reset();
    document.getElementById('wl-contract-modal-title').textContent = contract ? 'Modifica Contratto' : 'Nuovo Contratto';
    document.getElementById('wl-contract-id').value = contract?.id || '';
    document.getElementById('wl-contract-partner-id').value = partnerId;
    document.getElementById('wl-contract-type').value = contract?.type || 'nda';
    document.getElementById('wl-contract-title').value = contract?.title || '';
    document.getElementById('wl-contract-start').value = contract?.start_date || '';
    document.getElementById('wl-contract-end').value = contract?.end_date || '';
    document.getElementById('wl-contract-file-url').value = contract?.file_url || '';
    document.getElementById('wl-contract-notes').value = contract?.notes || '';

    const deleteBtn = document.getElementById('wl-delete-contract-btn');
    deleteBtn.style.display = contract ? 'flex' : 'none';
    deleteBtn.onclick = async () => {
        const confirmed = await window.showConfirm('Eliminare questo contratto?', 'Elimina Contratto');
        if (!confirmed) return;
        try {
            await deletePartnerContract(contract.id);
            close();
            window.showAlert('Contratto eliminato', 'success');
            onSaved && onSaved();
        } catch (err) {
            window.showAlert('Errore: ' + err.message, 'error');
        }
    };

    form.onsubmit = async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="loader-sm"></span>';
        const payload = {
            id: document.getElementById('wl-contract-id').value || undefined,
            partner_id: partnerId,
            type: document.getElementById('wl-contract-type').value,
            title: document.getElementById('wl-contract-title').value || null,
            start_date: document.getElementById('wl-contract-start').value || null,
            end_date: document.getElementById('wl-contract-end').value || null,
            file_url: document.getElementById('wl-contract-file-url').value || null,
            notes: document.getElementById('wl-contract-notes').value || null,
        };
        if (!payload.id) delete payload.id;
        try {
            await upsertPartnerContract(payload);
            close();
            window.showAlert('Contratto salvato', 'success');
            onSaved && onSaved();
        } catch (err) {
            window.showAlert('Errore: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    };

    modal.classList.add('active');
}

// ── partner modal (edit anagrafica + quality_rating) ─────────────────────────

export function initWhiteLabelPartnerModals() {
    if (document.getElementById('partner-wl-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'partner-wl-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; width: 90vw;">
            <div class="modal-header">
                <h2 id="partner-wl-modal-title">Nuovo Partner WL</h2>
                <button class="close-modal material-icons-round" id="close-partner-wl-modal">close</button>
            </div>
            <div class="modal-body">
                <form id="partner-wl-form">
                    <input type="hidden" id="partner-wl-id">

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div style="grid-column: span 2;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                                Dati Societari
                            </div>
                            <div class="form-group full-width">
                                <label>Ragione Sociale *</label>
                                <input type="text" id="partner-wl-full-name" required placeholder="Es: Gleeye S.r.l.">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Partita IVA</label>
                            <input type="text" id="partner-wl-vat" placeholder="IT00000000000">
                        </div>
                        <div class="form-group">
                            <label>Codice Fiscale</label>
                            <input type="text" id="partner-wl-fiscal-code" style="text-transform: uppercase;">
                        </div>

                        <div style="grid-column: span 2; margin-top: 1rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                                Configurazione Fiscale
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Regime Fiscale</label>
                            <select id="partner-wl-fiscal-regime">
                                <option value="ordinario">Ordinario</option>
                                <option value="forfettario">Forfettario</option>
                                <option value="minimi">Minimi</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Paese</label>
                            <select id="partner-wl-country">
                                <option value="IT">Italia</option>
                                <option value="UE">UE (Intra)</option>
                                <option value="EXTRA">Extra UE</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>IVA Default %</label>
                            <input type="number" id="partner-wl-vat-rate" value="22">
                        </div>
                        <div class="form-group">
                            <label>Ritenuta %</label>
                            <input type="number" id="partner-wl-withholding" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Cassa Prev. %</label>
                            <input type="number" id="partner-wl-cassa" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>Termini di Pagamento</label>
                            <input type="text" id="partner-wl-payment-terms" placeholder="30gg d.f.">
                        </div>

                        <div style="grid-column: span 2; margin-top: 1rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                                Recapiti & Sede
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Email PEC</label>
                            <input type="email" id="partner-wl-pec">
                        </div>
                        <div class="form-group">
                            <label>Email Amministrazione</label>
                            <input type="email" id="partner-wl-email">
                        </div>
                        <div class="form-group full-width">
                            <label>Indirizzo Sede Legale</label>
                            <input type="text" id="partner-wl-address">
                        </div>

                        <div style="grid-column: span 2; margin-top: 1rem;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--brand-blue); text-transform: uppercase; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                                Rating Qualità
                            </div>
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                ${[1,2,3,4,5].map(n =>
                                    '<span class="material-icons-round modal-star" data-val="' + n + '" style="font-size:1.8rem;color:var(--border-light);cursor:pointer;transition:color 0.15s;">star_border</span>'
                                ).join('')}
                                <span id="partner-wl-rating-label" style="font-size:0.85rem;color:var(--text-tertiary);margin-left:0.5rem;">Non valutato</span>
                            </div>
                            <input type="hidden" id="partner-wl-quality-rating">
                        </div>
                    </div>

                    <div class="form-actions" style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <button type="button" class="primary-btn danger-outline" id="delete-partner-wl-btn" style="display: none;">
                            <span class="material-icons-round">delete</span> Elimina
                        </button>
                        <div style="display: flex; gap: 1rem; margin-left: auto;">
                            <button type="button" class="primary-btn secondary" id="cancel-partner-wl-modal">Annulla</button>
                            <button type="submit" class="primary-btn">Salva Partner</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // star interaction in modal
    const updateModalStars = (val) => {
        modal.querySelectorAll('.modal-star').forEach(s => {
            const n = parseInt(s.dataset.val);
            if (n <= val) {
                s.textContent = 'star';
                s.style.color = 'var(--color-warning, #f59e0b)';
            } else {
                s.textContent = 'star_border';
                s.style.color = 'var(--border-light)';
            }
        });
        const label = document.getElementById('partner-wl-rating-label');
        label.textContent = val > 0 ? val + '/5' : 'Non valutato';
        document.getElementById('partner-wl-quality-rating').value = val || '';
    };

    modal.querySelectorAll('.modal-star').forEach(s => {
        s.addEventListener('click', () => updateModalStars(parseInt(s.dataset.val)));
        s.addEventListener('mouseover', () => {
            modal.querySelectorAll('.modal-star').forEach(s2 => {
                s2.style.color = parseInt(s2.dataset.val) <= parseInt(s.dataset.val) ? 'var(--color-warning, #f59e0b)' : 'var(--border-light)';
            });
        });
        s.addEventListener('mouseout', () => {
            updateModalStars(parseInt(document.getElementById('partner-wl-quality-rating').value) || 0);
        });
    });

    const close = () => modal.classList.remove('active');
    document.getElementById('close-partner-wl-modal').addEventListener('click', close);
    document.getElementById('cancel-partner-wl-modal').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('delete-partner-wl-btn').addEventListener('click', async () => {
        const id = document.getElementById('partner-wl-id').value;
        if (!id) return;
        const confirmed = await window.showConfirm('Sei sicuro di voler eliminare questo partner? L\'operazione è irreversibile.', 'Elimina Partner');
        if (confirmed) {
            try {
                await deleteCollaborator(id);
                close();
                if (state.currentPage === 'white-label-partners') {
                    renderWhiteLabelPartners(document.getElementById('content-area'));
                } else {
                    window.location.hash = '#white-label-partners';
                }
                window.showAlert('Partner eliminato con successo', 'success');
            } catch (err) {
                window.showAlert('Errore durante l\'eliminazione: ' + err.message, 'error');
            }
        }
    });

    document.getElementById('partner-wl-form').addEventListener('submit', async e => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        const id = document.getElementById('partner-wl-id').value;
        const ratingVal = document.getElementById('partner-wl-quality-rating').value;
        const formData = {
            id: id || undefined,
            type: 'white_label',
            full_name: document.getElementById('partner-wl-full-name').value,
            vat_number: document.getElementById('partner-wl-vat').value || null,
            fiscal_code: document.getElementById('partner-wl-fiscal-code').value || null,
            fiscal_regime: document.getElementById('partner-wl-fiscal-regime').value,
            country: document.getElementById('partner-wl-country').value,
            default_vat_rate: document.getElementById('partner-wl-vat-rate').value === '' ? 22 : parseFloat(document.getElementById('partner-wl-vat-rate').value),
            withholding_tax_rate: document.getElementById('partner-wl-withholding').value === '' ? 0 : parseFloat(document.getElementById('partner-wl-withholding').value),
            cassa_previdenziale_rate: document.getElementById('partner-wl-cassa').value === '' ? 0 : parseFloat(document.getElementById('partner-wl-cassa').value),
            payment_terms: document.getElementById('partner-wl-payment-terms').value || '',
            pec: document.getElementById('partner-wl-pec').value || null,
            email: document.getElementById('partner-wl-email').value || null,
            address: document.getElementById('partner-wl-address').value || null,
            quality_rating: ratingVal ? parseFloat(ratingVal) : null,
            is_active: true
        };
        if (!formData.id) delete formData.id;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loader-sm"></span> Salvataggio...';

            await upsertCollaborator(formData);
            close();
            window.showAlert('Partner salvato con successo', 'success');

            if (state.currentPage === 'white-label-partners') {
                renderWhiteLabelPartners(document.getElementById('content-area'));
            } else if (state.currentPage === 'white-label-partner-detail') {
                renderWhiteLabelPartnerDetail(document.getElementById('content-area'));
            }
        } catch (err) {
            console.error('Error saving partner:', err);
            window.showAlert('Errore durante il salvataggio: ' + (err.message || err.details || 'Errore sconosciuto'), 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    window.openWhiteLabelPartnerModal = (id = null) => {
        const title = document.getElementById('partner-wl-modal-title');
        const idInput = document.getElementById('partner-wl-id');
        const form = document.getElementById('partner-wl-form');
        const deleteBtn = document.getElementById('delete-partner-wl-btn');
        form.reset();
        updateModalStars(0);

        if (id) {
            const p = state.collaborators.find(x => x.id == id);
            if (p) {
                title.textContent = 'Modifica Partner WL';
                idInput.value = p.id;
                document.getElementById('partner-wl-full-name').value = p.full_name || '';
                document.getElementById('partner-wl-vat').value = p.vat_number || '';
                document.getElementById('partner-wl-fiscal-code').value = p.fiscal_code || '';
                document.getElementById('partner-wl-fiscal-regime').value = p.fiscal_regime || 'ordinario';
                document.getElementById('partner-wl-country').value = p.country || 'IT';
                document.getElementById('partner-wl-vat-rate').value = p.default_vat_rate || 22;
                document.getElementById('partner-wl-withholding').value = p.withholding_tax_rate || 0;
                document.getElementById('partner-wl-cassa').value = p.cassa_previdenziale_rate || 0;
                document.getElementById('partner-wl-payment-terms').value = p.payment_terms || '';
                document.getElementById('partner-wl-pec').value = p.pec || '';
                document.getElementById('partner-wl-email').value = p.email || '';
                document.getElementById('partner-wl-address').value = p.address || '';
                updateModalStars(parseFloat(p.quality_rating) || 0);
                deleteBtn.style.display = 'flex';
            }
        } else {
            title.textContent = 'Nuovo Partner WL';
            idInput.value = '';
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
    };
}
