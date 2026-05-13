/**
 * sales/outreach.js
 * Tab "Outreach" nel dettaglio prospect.
 * Genera 3 varianti email personalizzate da copiare.
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';

const MODEL = AI_MODELS.sales_drafter;

const TONES = [
    { key: 'professionale', label: 'Professionale' },
    { key: 'diretto',       label: 'Diretto & conciso' },
    { key: 'creativo',      label: 'Creativo & curioso' },
];

export async function renderOutreachDrafter(container, prospect) {
    container.innerHTML = buildOutreachHTML(prospect);
    bindOutreachEvents(container, prospect);
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildOutreachHTML(prospect) {
    const toneOptions = TONES.map(t =>
        '<option value="' + t.key + '">' + t.label + '</option>'
    ).join('');

    return (
        '<div style="padding:0.5rem 0;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:1.25rem;gap:1rem;flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-size:0.82rem;font-weight:700;color:var(--text-primary);">Email Outreach — ' + escHtml(prospect.business_name) + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:2px;">Genera 3 varianti email pronte da copiare</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:0.75rem;">' +
                    '<select id="outreach-tone" style="font-size:0.78rem;padding:0.4rem 0.7rem;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg-secondary);color:var(--text-primary);">' +
                        toneOptions +
                    '</select>' +
                    '<button id="btn-generate-outreach" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.78rem;padding:0.45rem 0.9rem;border-radius:10px;font-weight:700;">' +
                        '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span>Genera' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div id="outreach-result">' +
                '<div style="text-align:center;padding:2.5rem;color:var(--text-tertiary);">' +
                    '<span class="material-icons-round" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:0.75rem;">mail</span>' +
                    '<div style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem;">Pronto a generare le email</div>' +
                    '<div style="font-size:0.8rem;">Scegli il tono e clicca Genera.</div>' +
                '</div>' +
            '</div>' +
        '</div>'
    );
}

function buildEmailVariantsHTML(variants) {
    return variants.map((v, i) => {
        const variantId = 'variant-' + i;
        const bgColors = ['#3b82f615', '#8b5cf615', '#10b98115'];
        const borderColors = ['#3b82f630', '#8b5cf630', '#10b98130'];
        const headColors = ['#3b82f6', '#8b5cf6', '#10b981'];

        return (
            '<div style="background:' + bgColors[i] + ';border:1px solid ' + borderColors[i] + ';border-radius:14px;padding:1.25rem;margin-bottom:1rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
                    '<div style="font-size:0.78rem;font-weight:800;color:' + headColors[i] + ';text-transform:uppercase;letter-spacing:0.05em;">Variante ' + (i + 1) + ' — ' + escHtml(v.tone_label || '') + '</div>' +
                    '<button class="btn-copy-email" data-variant="' + variantId + '" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.72rem;padding:4px 10px;border-radius:8px;border:none;background:' + headColors[i] + '20;color:' + headColors[i] + ';cursor:pointer;font-weight:700;">' +
                        '<span class="material-icons-round" style="font-size:0.85rem;">content_copy</span>Copia' +
                    '</button>' +
                '</div>' +
                '<div style="font-size:0.78rem;font-weight:700;color:var(--text-tertiary);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.04em;">Oggetto</div>' +
                '<div id="' + variantId + '-subject" style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin-bottom:0.75rem;padding:0.5rem;background:rgba(255,255,255,0.15);border-radius:8px;">' + escHtml(v.subject) + '</div>' +
                '<div style="font-size:0.78rem;font-weight:700;color:var(--text-tertiary);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.04em;">Corpo email</div>' +
                '<div id="' + variantId + '-body" style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap;padding:0.75rem;background:rgba(255,255,255,0.1);border-radius:8px;">' + escHtml(v.body) + '</div>' +
            '</div>'
        );
    }).join('');
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindOutreachEvents(container, prospect) {
    container.querySelector('#btn-generate-outreach')?.addEventListener('click', async () => {
        const tone = container.querySelector('#outreach-tone')?.value || 'professionale';
        await generateEmails(container, prospect, tone);
    });

    // Copy buttons — delegated
    container.querySelector('#outreach-result')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-copy-email');
        if (!btn) return;
        const variantId = btn.dataset.variant;
        const subject = container.querySelector('#' + variantId + '-subject')?.textContent || '';
        const body = container.querySelector('#' + variantId + '-body')?.textContent || '';
        const full = 'OGGETTO: ' + subject + '\n\n' + body;
        navigator.clipboard.writeText(full).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons-round" style="font-size:0.85rem;">check</span>Copiato!';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
        }).catch(() => showGlobalAlert('Copia manuale: seleziona il testo', 'error'));
    });
}

async function generateEmails(container, prospect, tone) {
    const resultDiv = container.querySelector('#outreach-result');
    const btn = container.querySelector('#btn-generate-outreach');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;animation:spin 1s linear infinite;">refresh</span> Generazione…';

    resultDiv.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);">' +
            '<span class="material-icons-round" style="animation:spin 1s linear infinite;">auto_awesome</span>' +
            'Sto scrivendo le email per ' + escHtml(prospect.business_name) + '…' +
        '</div>';

    try {
        const prompt = buildOutreachPrompt(prospect, tone);
        const schema = {
            variants: [
                {
                    tone_label: 'string — nome del tono usato',
                    subject:    'string — oggetto email',
                    body:       'string — corpo email completo, con saluto e firma generica [Nome]',
                },
            ],
        };

        const result = await completeJSON(prompt, schema, {
            feature: 'sales_drafter',
            model:   MODEL,
            system:
                'Sei un esperto di cold email B2B per agenzie di comunicazione italiane. ' +
                'Scrivi email personalizzate, non generiche. Ogni variante deve avere tono diverso. ' +
                'Le email devono essere brevi (max 150 parole), non invasive, con una CTA chiara e morbida. ' +
                'Usa il nome dell\'azienda prospect in modo naturale. ' +
                'Firma sempre con "[Nome]" come placeholder. ' +
                'Rispondi SOLO in JSON valido.',
        });

        if (!result.variants || result.variants.length === 0) throw new Error('Nessuna variante generata');

        resultDiv.innerHTML = buildEmailVariantsHTML(result.variants.slice(0, 3));
        showGlobalAlert('3 email generate con successo', 'success');
    } catch (err) {
        console.error('[Outreach] error', err);
        resultDiv.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;">Errore: ' + escHtml(err.message) + '</div>';
        showGlobalAlert('Errore AI: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:0.95rem;">auto_awesome</span> Rigenera';
    }
}

function buildOutreachPrompt(prospect, tone) {
    const enriched = prospect.ai_enrichment_data || {};
    const toneLabelMap = { professionale: 'Professionale', diretto: 'Diretto & conciso', creativo: 'Creativo & curioso' };

    const parts = [
        'Genera 3 email di cold outreach per questa azienda:',
        '- Azienda target: ' + prospect.business_name,
    ];

    if (prospect.contact_name) parts.push('- Referente: ' + prospect.contact_name);
    if (enriched.industry || prospect.industry) parts.push('- Settore: ' + (enriched.industry || prospect.industry));
    if (enriched.company_size || prospect.company_size) parts.push('- Dimensione: ' + (enriched.company_size || prospect.company_size));
    if (enriched.description) parts.push('- Descrizione: ' + enriched.description);
    if (prospect.target_sap?.name) parts.push('- Servizio da proporre: ' + prospect.target_sap.name);
    if (enriched.key_info && enriched.key_info.length > 0) parts.push('- Note strategiche: ' + enriched.key_info.join('; '));

    parts.push('');
    parts.push('Mittente: Gleeye, agenzia di comunicazione e marketing con sede a Genova.');
    parts.push('Tono richiesto: ' + (toneLabelMap[tone] || tone));
    parts.push('');
    parts.push('Genera esattamente 3 varianti con toni diversi (anche se ne ho richiesto uno specifico, le 3 varianti devono differenziarsi). Includi oggetto + corpo per ciascuna.');

    return parts.join('\n');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
