/**
 * sales/niches.js
 * Niche Research Center (#sales-niches).
 * Pagina dove Davide gestisce le nicchie target del Sales Engine.
 * Ogni nicchia ha: SAP target, ikigai score, 6 criteri Parozzi, status.
 */

import { fetchNiches, upsertNiche, deleteNiche, fetchSapServicesForSales } from './api.js?v=8000';
import { showGlobalAlert, showConfirm } from '../../modules/utils.js?v=8000';

// 6 criteri Parozzi per validazione nicchia
const PAROZZI_CRITERIA = [
    { key: 'growing',          label: 'Mercato in crescita (non morente)',                       hint: 'Verifica Google Trends, news settore' },
    { key: 'size',             label: 'Almeno 8.000-10.000 realtà raggiungibili',                hint: 'Fascia ottimale: 10K-100K' },
    { key: 'profitable',       label: 'Profittevole (margini, non solo fatturato)',              hint: 'Es: dentisti €500K → €200K netti' },
    { key: 'spends_high',      label: 'Abituati a spendere cifre importanti',                    hint: 'Hanno già speso €10K+ per macchinari/SaaS' },
    { key: 'reachable',        label: 'Raggiungibile sistematicamente via canali scalabili',     hint: 'Email, LinkedIn, Google Maps' },
    { key: 'personal_interest', label: 'Interesse personale minimo',                              hint: 'Tieni botta nei momenti difficili' },
];

const STATUS_CONFIG = {
    researching: { label: 'In ricerca',  color: '#f59e0b', icon: 'search' },
    active:      { label: 'Attiva',       color: '#10b981', icon: 'play_circle' },
    paused:      { label: 'In pausa',     color: '#6366f1', icon: 'pause_circle' },
    exhausted:   { label: 'Esaurita',     color: '#94a3b8', icon: 'check_circle' },
};

export async function renderSalesNiches(container) {
    container.innerHTML = buildLoadingHTML();

    try {
        const [niches, sapServices] = await Promise.all([
            fetchNiches(),
            fetchSapServicesForSales(),
        ]);
        container.innerHTML = buildPageHTML(niches, sapServices);
        bindEvents(container, niches, sapServices);
    } catch (err) {
        container.innerHTML = '<p style="padding:2rem;color:red;">Errore: ' + escHtml(err.message) + '</p>';
    }
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildLoadingHTML() {
    return '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary);gap:0.75rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>Caricamento nicchie…</div>';
}

function buildPageHTML(niches, sapServices) {
    const totalNiches = niches.length;
    const activeNiches = niches.filter(n => n.status === 'active').length;
    const totalProspects = niches.reduce((sum, n) => sum + (n.prospects_count || 0), 0);

    return (
        '<div class="animate-fade-in" style="max-width:1200px;margin:0 auto;padding:1.5rem;">' +
            buildHeader(totalNiches, activeNiches, totalProspects) +
            (niches.length === 0
                ? buildEmptyState()
                : '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(360px, 1fr));gap:1rem;">' +
                    niches.map(n => buildNicheCard(n)).join('') +
                  '</div>'
            ) +
        '</div>'
    );
}

function buildHeader(total, active, prospects) {
    return (
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">' +
            '<div>' +
                '<h1 style="font-size:1.75rem;font-weight:800;font-family:var(--font-titles);color:var(--text-primary);margin:0;letter-spacing:-0.02em;">Niche Research</h1>' +
                '<div style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.25rem;">' +
                    total + ' nicchie · ' + active + ' attive · ' + prospects + ' prospect collegati' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;align-items:center;">' +
                '<a href="#sales-pipeline" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:10px;font-weight:600;color:var(--text-secondary);border:1px solid var(--glass-border);text-decoration:none;background:var(--bg-secondary);">' +
                    '<span class="material-icons-round" style="font-size:1rem;">view_kanban</span>Pipeline' +
                '</a>' +
                '<button id="btn-new-niche" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:12px;font-weight:700;">' +
                    '<span class="material-icons-round" style="font-size:1rem;">add</span>Nuova nicchia' +
                '</button>' +
            '</div>' +
        '</div>'
    );
}

function buildEmptyState() {
    return (
        '<div style="text-align:center;padding:4rem 2rem;color:var(--text-tertiary);border:2px dashed var(--glass-border);border-radius:18px;">' +
            '<span class="material-icons-round" style="font-size:4rem;opacity:0.3;display:block;margin-bottom:1rem;">explore</span>' +
            '<div style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-bottom:0.5rem;">Nessuna nicchia ancora</div>' +
            '<div style="font-size:0.88rem;max-width:480px;margin:0 auto 1.5rem;line-height:1.5;">' +
                'Una nicchia è un target specifico per i tuoi SAP. Esempio: "Strutture turistiche liguri" + SAP "Local SEO". ' +
                'Inizia da una sola, valida sui 6 criteri Parozzi, poi scala.' +
            '</div>' +
            '<button id="btn-new-niche-empty" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;padding:0.65rem 1.3rem;border-radius:12px;font-weight:700;">' +
                '<span class="material-icons-round" style="font-size:1rem;">add</span>Crea prima nicchia' +
            '</button>' +
        '</div>'
    );
}

function buildNicheCard(n) {
    const statusConf = STATUS_CONFIG[n.status] || STATUS_CONFIG.researching;
    const criteria = n.criteria || {};
    const criteriaMatchCount = PAROZZI_CRITERIA.filter(c => criteria[c.key]).length;
    const ikigaiBars = Array.from({ length: 5 }, (_, i) =>
        '<div style="height:3px;flex:1;border-radius:2px;background:' + (i < (n.ikigai_score || 0) ? '#8b5cf6' : 'var(--bg-tertiary)') + ';"></div>'
    ).join('');

    return (
        '<div class="niche-card" data-id="' + n.id + '" style="background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:16px;padding:1.25rem;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;">' +
            // Header
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;gap:0.5rem;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:1rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);line-height:1.2;">' + escHtml(n.name) + '</div>' +
                    (n.target_sap
                        ? '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:3px;">→ ' + escHtml(n.target_sap.name) + '</div>'
                        : '<div style="font-size:0.72rem;color:#f59e0b;margin-top:3px;">⚠ SAP non assegnato</div>') +
                '</div>' +
                '<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.7rem;padding:3px 9px;border-radius:8px;background:' + statusConf.color + '15;color:' + statusConf.color + ';font-weight:700;flex-shrink:0;">' +
                    '<span class="material-icons-round" style="font-size:0.8rem;">' + statusConf.icon + '</span>' + statusConf.label +
                '</span>' +
            '</div>' +
            // Description
            (n.description ? '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.75rem;line-height:1.4;">' + escHtml(n.description) + '</div>' : '') +
            // Stats row
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.75rem;padding:0.6rem;background:var(--bg-tertiary);border-radius:10px;">' +
                '<div>' +
                    '<div style="font-size:0.65rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">Prospect</div>' +
                    '<div style="font-size:1.1rem;font-weight:900;color:var(--text-primary);">' + (n.prospects_count || 0) + '</div>' +
                '</div>' +
                '<div>' +
                    '<div style="font-size:0.65rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">Criteri Parozzi</div>' +
                    '<div style="font-size:1.1rem;font-weight:900;color:' + (criteriaMatchCount >= 5 ? '#10b981' : criteriaMatchCount >= 3 ? '#f59e0b' : '#ef4444') + ';">' + criteriaMatchCount + '/6</div>' +
                '</div>' +
            '</div>' +
            // Ikigai bar
            '<div>' +
                '<div style="display:flex;justify-content:space-between;font-size:0.66rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">' +
                    '<span>Ikigai score</span>' +
                    '<span>' + (n.ikigai_score || '–') + '/5</span>' +
                '</div>' +
                '<div style="display:flex;gap:3px;">' + ikigaiBars + '</div>' +
            '</div>' +
        '</div>'
    );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindEvents(container, niches, sapServices) {
    const openNew = () => openNicheModal(null, sapServices, () => renderSalesNiches(container));
    container.querySelector('#btn-new-niche')?.addEventListener('click', openNew);
    container.querySelector('#btn-new-niche-empty')?.addEventListener('click', openNew);

    container.querySelectorAll('.niche-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = 'var(--shadow-lg)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const niche = niches.find(n => n.id === id);
            if (niche) openNicheModal(niche, sapServices, () => renderSalesNiches(container));
        });
    });
}

function openNicheModal(niche, sapServices, onSave) {
    const isNew = !niche;
    const n = niche || { status: 'researching', criteria: {}, ikigai_score: 3 };
    const criteria = n.criteria || {};

    const sapOptions = sapServices.map(s =>
        '<option value="' + s.id + '"' + (n.target_sap_id === s.id ? ' selected' : '') + '>' + escHtml(s.name) + '</option>'
    ).join('');

    const statusOptions = Object.entries(STATUS_CONFIG).map(([k, v]) =>
        '<option value="' + k + '"' + (n.status === k ? ' selected' : '') + '>' + v.label + '</option>'
    ).join('');

    const criteriaHTML = PAROZZI_CRITERIA.map(c =>
        '<label style="display:flex;align-items:flex-start;gap:0.6rem;padding:0.6rem;border-radius:10px;background:' + (criteria[c.key] ? '#10b98108' : 'var(--bg-tertiary)') + ';border:1px solid ' + (criteria[c.key] ? '#10b98133' : 'var(--glass-border)') + ';cursor:pointer;transition:background 0.15s;">' +
            '<input type="checkbox" name="criteria_' + c.key + '"' + (criteria[c.key] ? ' checked' : '') + ' style="margin-top:3px;cursor:pointer;">' +
            '<div style="flex:1;">' +
                '<div style="font-size:0.82rem;font-weight:600;color:var(--text-primary);">' + c.label + '</div>' +
                '<div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:2px;">' + c.hint + '</div>' +
            '</div>' +
        '</label>'
    ).join('');

    const ikigaiOptions = [1, 2, 3, 4, 5].map(v =>
        '<option value="' + v + '"' + ((n.ikigai_score || 3) === v ? ' selected' : '') + '>' + v + ' / 5</option>'
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = 'modal-niche-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.innerHTML =
        '<div style="background:var(--bg-primary);border-radius:20px;padding:2rem;max-width:680px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-xl);border:1px solid var(--glass-border);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">' +
                '<h2 style="font-size:1.25rem;font-weight:800;font-family:var(--font-titles);margin:0;">' +
                    (isNew ? 'Nuova nicchia' : escHtml(n.name)) +
                '</h2>' +
                '<div style="display:flex;gap:0.5rem;align-items:center;">' +
                    (!isNew ? '<button id="btn-delete-niche" style="background:#ef444415;color:#ef4444;border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;font-weight:700;cursor:pointer;">Elimina</button>' : '') +
                    '<button id="btn-close-niche" style="background:var(--bg-tertiary);color:var(--text-secondary);border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;cursor:pointer;">✕</button>' +
                '</div>' +
            '</div>' +
            '<form id="form-niche">' +
                // Nome + status
                '<div style="display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">' +
                    formField('name', 'Nome nicchia *', n.name, 'text', true) +
                    formSelect('status', 'Status', statusOptions) +
                '</div>' +
                // Descrizione
                formTextarea('description', 'Descrizione (chi è il target?)', n.description, 2) +
                // SAP + Ikigai
                '<div style="display:grid;grid-template-columns:2fr 1fr;gap:0.75rem;margin:0.75rem 0;">' +
                    formSelect('target_sap_id', 'SAP target', '<option value="">— scegli SAP —</option>' + sapOptions) +
                    formSelect('ikigai_score', 'Ikigai score', ikigaiOptions) +
                '</div>' +
                // Criteri Parozzi
                '<div style="margin:1.25rem 0 0.75rem;">' +
                    '<div style="font-size:0.78rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.6rem;">Criteri Parozzi (validano la nicchia)</div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">' + criteriaHTML + '</div>' +
                '</div>' +
                // Note
                formTextarea('notes', 'Note operative', n.notes, 3) +
            '</form>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">' +
                '<button id="btn-cancel-niche" style="padding:0.6rem 1.2rem;border-radius:12px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-secondary);font-size:0.85rem;font-weight:600;cursor:pointer;">Annulla</button>' +
                '<button id="btn-save-niche" class="primary-btn" style="padding:0.6rem 1.4rem;border-radius:12px;font-size:0.85rem;font-weight:700;">Salva</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#btn-close-niche').addEventListener('click', close);
    overlay.querySelector('#btn-cancel-niche').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#btn-delete-niche')?.addEventListener('click', async () => {
        const ok = await showConfirm('Eliminare la nicchia "' + n.name + '"?', 'Elimina', 'Annulla');
        if (!ok) return;
        try {
            await deleteNiche(n.id);
            showGlobalAlert('Nicchia eliminata', 'success');
            close();
            onSave && onSave();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
        }
    });

    overlay.querySelector('#btn-save-niche').addEventListener('click', async () => {
        const form = overlay.querySelector('#form-niche');
        const criteriaPayload = {};
        PAROZZI_CRITERIA.forEach(c => {
            criteriaPayload[c.key] = !!form.querySelector('[name="criteria_' + c.key + '"]')?.checked;
        });

        const payload = {
            name:           form.querySelector('[name="name"]')?.value?.trim(),
            description:    form.querySelector('[name="description"]')?.value?.trim() || null,
            status:         form.querySelector('[name="status"]')?.value || 'researching',
            target_sap_id:  form.querySelector('[name="target_sap_id"]')?.value || null,
            ikigai_score:   parseInt(form.querySelector('[name="ikigai_score"]')?.value || '3', 10),
            criteria:       criteriaPayload,
            notes:          form.querySelector('[name="notes"]')?.value?.trim() || null,
        };
        if (!payload.name) { showGlobalAlert('Il nome è obbligatorio', 'error'); return; }
        if (n.id) payload.id = n.id;

        const btn = overlay.querySelector('#btn-save-niche');
        btn.disabled = true;
        btn.textContent = 'Salvataggio…';

        try {
            await upsertNiche(payload);
            showGlobalAlert(isNew ? 'Nicchia creata' : 'Nicchia aggiornata', 'success');
            close();
            onSave && onSave();
        } catch (err) {
            showGlobalAlert('Errore: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Salva';
        }
    });
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function formField(name, label, value, type, required) {
    return (
        '<div>' +
            '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">' + label + '</label>' +
            '<input name="' + name + '" type="' + (type || 'text') + '" value="' + escHtml(value || '') + '"' +
                (required ? ' required' : '') +
                ' style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;box-sizing:border-box;">' +
        '</div>'
    );
}

function formSelect(name, label, optionsHTML) {
    return (
        '<div>' +
            '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">' + label + '</label>' +
            '<select name="' + name + '" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;">' +
                optionsHTML +
            '</select>' +
        '</div>'
    );
}

function formTextarea(name, label, value, rows) {
    return (
        '<div>' +
            '<label style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">' + label + '</label>' +
            '<textarea name="' + name + '" rows="' + (rows || 2) + '"' +
                ' style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;resize:vertical;box-sizing:border-box;font-family:inherit;">' +
                escHtml(value || '') +
            '</textarea>' +
        '</div>'
    );
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
