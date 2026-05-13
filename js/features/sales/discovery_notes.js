/**
 * sales/discovery_notes.js
 * Tab "Discovery" nel dettaglio prospect.
 * Form strutturato sui 6 blocchi della Discovery Call (metodologia Parozzi).
 */

import { fetchDiscoveryNotes, upsertDiscoveryNotes, upsertProspect } from './api.js?v=8001';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';

export async function renderDiscoveryTab(container, prospect) {
    container.innerHTML = buildLoadingHTML();

    try {
        const notes = await fetchDiscoveryNotes(prospect.id);
        container.innerHTML = buildDiscoveryHTML(prospect, notes);
        bindEvents(container, prospect, notes);
    } catch (err) {
        container.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;">Errore caricamento: ' + escHtml(err.message) + '</div>';
    }
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildLoadingHTML() {
    return '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;color:var(--text-secondary);gap:0.5rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>Caricamento…</div>';
}

function buildDiscoveryHTML(prospect, n) {
    const notes = n || {};

    return (
        '<div style="padding:0.5rem 0;">' +
            // Header
            buildHeader(prospect, notes) +
            // Pre-call video tracker
            buildPreCallSection(notes) +
            // 6 blocchi
            buildBlock(1, 'Situazione attuale',
                row(
                    field('cosa_vende', 'Cosa vende', notes.cosa_vende, 'text', 2),
                    field('target_clienti', 'A chi vende', notes.target_clienti, 'text', 2)
                ) +
                row(
                    field('clienti_attuali', 'Clienti attuali (n.)', notes.clienti_attuali, 'number', 1)
                )
            ) +
            buildBlock(2, 'Numeri economici',
                row(
                    field('valore_cliente_annuo', 'Valore cliente €/anno', notes.valore_cliente_annuo, 'number', 1),
                    field('richieste_mese', 'Richieste al mese', notes.richieste_mese, 'number', 1),
                    field('tasso_conversione_pct', 'Tasso conversione %', notes.tasso_conversione_pct, 'number', 1)
                ) +
                row(
                    field('canale_acquisizione_oggi', 'Canale acquisizione attuale', notes.canale_acquisizione_oggi, 'text', 1)
                )
            ) +
            buildBlock(3, 'Processo attuale',
                textareaField('processo_acquisizione_oggi', 'Come acquisisce nuovi clienti oggi', notes.processo_acquisizione_oggi) +
                textareaField('cosa_provato_in_passato', 'Cosa ha provato in passato (agenzie, soluzioni)', notes.cosa_provato_in_passato)
            ) +
            buildBlock(4, 'Dolori e frustrazioni',
                textareaField('pain_principale', 'Pain principale — cosa lo frena di più', notes.pain_principale) +
                textareaField('esperienze_negative', 'Esperienze negative passate (con agenzie/soluzioni)', notes.esperienze_negative)
            ) +
            buildBlock(5, 'Obiettivi e desideri',
                textareaField('obiettivo_12_mesi', 'Obiettivo a 12 mesi', notes.obiettivo_12_mesi) +
                textareaField('cosa_cambierebbe_business', 'Cosa cambierebbe se avesse 2x i clienti', notes.cosa_cambierebbe_business)
            ) +
            buildBlock(6, 'Struttura decisionale',
                row(
                    '<div>' +
                        '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Tutti i decisori erano presenti?</label>' +
                        '<select name="decisori_presenti" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' +
                            '<option value="">—</option>' +
                            '<option value="true"'  + (notes.decisori_presenti === true  ? ' selected' : '') + '>Sì</option>' +
                            '<option value="false"' + (notes.decisori_presenti === false ? ' selected' : '') + '>No</option>' +
                        '</select>' +
                    '</div>'
                ) +
                textareaField('decisori_mancanti', 'Chi mancava / chi serve coinvolgere', notes.decisori_mancanti) +
                textareaField('soci_o_partner', 'Soci o partner che hanno voce in capitolo', notes.soci_o_partner)
            ) +
            // Sales Call scheduling
            buildBlock('', 'Prossimo step',
                row(
                    field('sales_call_scheduled_at', 'Sales Call schedulata', formatDatetimeLocal(notes.sales_call_scheduled_at), 'datetime-local', 2),
                    field('call_date', 'Data discovery (oggi se vuota)', notes.call_date || formatDateLocal(new Date()), 'date', 1)
                )
            ) +
            buildBlock('', 'Note libere',
                textareaField('note_libere', 'Appunti aggiuntivi', notes.note_libere, 5)
            ) +
            // Actions
            '<div style="display:flex;justify-content:flex-end;gap:0.75rem;padding-top:1rem;border-top:1px solid var(--glass-border);">' +
                '<button id="btn-mark-sales-call-done" style="padding:0.6rem 1.1rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.82rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">' +
                    '<span class="material-icons-round" style="font-size:1rem;">flag</span>Sales Call fatta' +
                '</button>' +
                '<button id="btn-save-discovery" class="primary-btn" style="padding:0.6rem 1.4rem;border-radius:12px;font-size:0.85rem;font-weight:700;display:inline-flex;align-items:center;gap:0.4rem;">' +
                    '<span class="material-icons-round" style="font-size:1rem;">save</span>Salva Discovery' +
                '</button>' +
            '</div>' +
        '</div>'
    );
}

function buildHeader(prospect, notes) {
    const hasNotes = !!notes.id;
    const badge = hasNotes
        ? '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.72rem;padding:3px 9px;border-radius:8px;background:#10b98115;color:#10b981;font-weight:700;"><span class="material-icons-round" style="font-size:0.85rem;">check_circle</span>Discovery completata</span>'
        : '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.72rem;padding:3px 9px;border-radius:8px;background:#f59e0b15;color:#f59e0b;font-weight:700;"><span class="material-icons-round" style="font-size:0.85rem;">edit</span>Da compilare</span>';

    return (
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;">' +
            '<div>' +
                '<div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);">Discovery Call — ' + escHtml(prospect.business_name) + '</div>' +
                '<div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:3px;">6 blocchi strutturati (metodologia Parozzi). Il prospect deve parlare l\'80%.</div>' +
            '</div>' +
            badge +
        '</div>'
    );
}

function buildPreCallSection(notes) {
    const url = notes.pre_call_video_url || '';
    const watched = notes.video_watched;
    const watchPct = notes.video_watch_pct;

    return (
        '<div style="background:linear-gradient(135deg, #3b82f608, #8b5cf608);border:1px solid #3b82f622;border-radius:14px;padding:1rem 1.25rem;margin-bottom:1.5rem;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">' +
                '<span class="material-icons-round" style="font-size:1.1rem;color:#8b5cf6;">videocam</span>' +
                '<span style="font-size:0.78rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.04em;">Pre-call video (Loom)</span>' +
                '<span style="font-size:0.7rem;color:var(--text-tertiary);">+50% close rate (Parozzi)</span>' +
            '</div>' +
            row(
                field('pre_call_video_url', 'URL Loom inviato', url, 'url', 2),
                '<div>' +
                    '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">Guardato?</label>' +
                    '<select name="video_watched" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' +
                        '<option value="">—</option>' +
                        '<option value="true"'  + (watched === true  ? ' selected' : '') + '>Sì</option>' +
                        '<option value="false"' + (watched === false ? ' selected' : '') + '>No</option>' +
                    '</select>' +
                '</div>',
                field('video_watch_pct', '% visto', watchPct, 'number', 1)
            ) +
        '</div>'
    );
}

function buildBlock(number, title, contentHTML) {
    const numberBadge = number !== '' && number !== null
        ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:50%;background:var(--brand-blue);color:#fff;font-size:0.72rem;font-weight:900;">' + number + '</span>'
        : '';

    return (
        '<div style="margin-bottom:1.5rem;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">' +
                numberBadge +
                '<span style="font-size:0.82rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.04em;">' + title + '</span>' +
            '</div>' +
            contentHTML +
        '</div>'
    );
}

function row(...cells) {
    const grid = cells.length === 1 ? '1fr' : cells.length === 2 ? '1fr 1fr' : cells.length === 3 ? '1fr 1fr 1fr' : 'repeat(' + cells.length + ', 1fr)';
    return '<div style="display:grid;grid-template-columns:' + grid + ';gap:0.75rem;margin-bottom:0.6rem;">' + cells.join('') + '</div>';
}

function field(name, label, value, type, span) {
    const spanStyle = span && span > 1 ? 'grid-column:span ' + span + ';' : '';
    const v = value === null || value === undefined ? '' : String(value);
    return (
        '<div style="' + spanStyle + '">' +
            '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">' + label + '</label>' +
            '<input name="' + name + '" type="' + (type || 'text') + '" value="' + escHtml(v) + '"' +
                ' style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;">' +
        '</div>'
    );
}

function textareaField(name, label, value, rows) {
    return (
        '<div style="margin-bottom:0.6rem;">' +
            '<label style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">' + label + '</label>' +
            '<textarea name="' + name + '" rows="' + (rows || 2) + '"' +
                ' style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;resize:vertical;box-sizing:border-box;font-family:inherit;">' +
                escHtml(value || '') +
            '</textarea>' +
        '</div>'
    );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindEvents(container, prospect, existingNotes) {
    container.querySelector('#btn-save-discovery')?.addEventListener('click', async () => {
        await saveDiscovery(container, prospect, existingNotes);
    });

    container.querySelector('#btn-mark-sales-call-done')?.addEventListener('click', async () => {
        await saveDiscovery(container, prospect, existingNotes, { advanceFunnel: true });
    });
}

async function saveDiscovery(container, prospect, existingNotes, opts = {}) {
    const btn = container.querySelector('#btn-save-discovery');
    const btnAdvance = container.querySelector('#btn-mark-sales-call-done');
    const activeBtn = opts.advanceFunnel ? btnAdvance : btn;

    if (activeBtn) {
        activeBtn.disabled = true;
        activeBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;animation:spin 1s linear infinite;">refresh</span>Salvataggio…';
    }

    try {
        const payload = collectPayload(container, prospect, existingNotes);
        const saved = await upsertDiscoveryNotes(payload);

        if (opts.advanceFunnel) {
            await upsertProspect({ id: prospect.id, funnel_segment: 'sales_call_done' });
            showGlobalAlert('Discovery salvata + funnel avanzato a Sales Call fatta', 'success');
        } else {
            showGlobalAlert('Discovery salvata', 'success');
        }

        // Re-render con i nuovi dati
        await renderDiscoveryTab(container, prospect);
    } catch (err) {
        console.error('[Discovery] save error', err);
        showGlobalAlert('Errore salvataggio: ' + err.message, 'error');
        if (activeBtn) {
            activeBtn.disabled = false;
            activeBtn.innerHTML = opts.advanceFunnel
                ? '<span class="material-icons-round" style="font-size:1rem;">flag</span>Sales Call fatta'
                : '<span class="material-icons-round" style="font-size:1rem;">save</span>Salva Discovery';
        }
    }
}

function collectPayload(container, prospect, existingNotes) {
    const get = (name) => container.querySelector('[name="' + name + '"]')?.value;
    const getInt = (name) => {
        const v = get(name);
        return v === '' || v === null || v === undefined ? null : parseInt(v, 10);
    };
    const getFloat = (name) => {
        const v = get(name);
        return v === '' || v === null || v === undefined ? null : parseFloat(v);
    };
    const getBool = (name) => {
        const v = get(name);
        if (v === 'true') return true;
        if (v === 'false') return false;
        return null;
    };
    const getText = (name) => {
        const v = get(name);
        return v && v.trim() ? v.trim() : null;
    };
    const getDatetime = (name) => {
        const v = get(name);
        return v ? new Date(v).toISOString() : null;
    };

    const payload = {
        prospect_id: prospect.id,
        call_date:                  get('call_date') || null,
        cosa_vende:                 getText('cosa_vende'),
        target_clienti:             getText('target_clienti'),
        clienti_attuali:            getInt('clienti_attuali'),
        valore_cliente_annuo:       getFloat('valore_cliente_annuo'),
        richieste_mese:             getInt('richieste_mese'),
        tasso_conversione_pct:      getFloat('tasso_conversione_pct'),
        canale_acquisizione_oggi:   getText('canale_acquisizione_oggi'),
        processo_acquisizione_oggi: getText('processo_acquisizione_oggi'),
        cosa_provato_in_passato:    getText('cosa_provato_in_passato'),
        pain_principale:            getText('pain_principale'),
        esperienze_negative:        getText('esperienze_negative'),
        obiettivo_12_mesi:          getText('obiettivo_12_mesi'),
        cosa_cambierebbe_business:  getText('cosa_cambierebbe_business'),
        decisori_presenti:          getBool('decisori_presenti'),
        decisori_mancanti:          getText('decisori_mancanti'),
        soci_o_partner:             getText('soci_o_partner'),
        pre_call_video_url:         getText('pre_call_video_url'),
        video_watched:              getBool('video_watched'),
        video_watch_pct:            getInt('video_watch_pct'),
        note_libere:                getText('note_libere'),
        sales_call_scheduled_at:    getDatetime('sales_call_scheduled_at'),
    };

    if (existingNotes && existingNotes.id) payload.id = existingNotes.id;

    return payload;
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function formatDateLocal(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function formatDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
