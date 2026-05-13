/**
 * sales/offer_builder.js
 * Tab "Offerta" nel dettaglio prospect.
 * Genera la OTO Formula personalizzata: "Aiuto [nicchia] a ottenere [X] in [Y] attraverso [Z] senza [W]"
 * Pesca da: prospect + discovery_notes + SAP target (description, value_proposition, process_blueprint).
 */

import { completeJSON, AI_MODELS } from '../../modules/ai_client.js?v=8000';
import { showGlobalAlert } from '../../modules/utils.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';
import { fetchDiscoveryNotes, upsertProspect } from './api.js?v=8000';

const MODEL = AI_MODELS.sales_drafter;

export async function renderOfferBuilderTab(container, prospect) {
    container.innerHTML = buildLoadingHTML();

    try {
        const [notes, sap] = await Promise.all([
            fetchDiscoveryNotes(prospect.id),
            prospect.target_sap_id ? fetchSap(prospect.target_sap_id) : Promise.resolve(null),
        ]);
        container.innerHTML = buildOfferHTML(prospect, notes, sap);
        bindEvents(container, prospect, notes, sap);
    } catch (err) {
        container.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;">Errore: ' + escHtml(err.message) + '</div>';
    }
}

async function fetchSap(sapId) {
    const { data, error } = await supabase
        .from('core_services')
        .select('id, name, description, value_proposition, target_customer, process_blueprint, package_includes, pricing_tiers, delivery_time_days')
        .eq('id', sapId)
        .single();
    if (error) throw error;
    return data;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildLoadingHTML() {
    return '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;color:var(--text-secondary);gap:0.5rem;"><span class="material-icons-round" style="animation:spin 1s linear infinite;">refresh</span>Caricamento…</div>';
}

function buildOfferHTML(prospect, notes, sap) {
    const hasOffer = !!prospect.oto_formula;
    const hasNotes = !!notes;
    const hasSap = !!sap;

    return (
        '<div style="padding:0.5rem 0;">' +
            // Header
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem;">' +
                '<div>' +
                    '<div style="font-size:0.95rem;font-weight:800;color:var(--text-primary);font-family:var(--font-titles);">Offer Builder — ' + escHtml(prospect.business_name) + '</div>' +
                    '<div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:3px;">OTO Formula: "Aiuto X a ottenere Y in Z attraverso W senza K" (Parozzi).</div>' +
                '</div>' +
                '<button id="btn-generate-offer" class="primary-btn" style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;padding:0.5rem 1rem;border-radius:12px;font-weight:700;">' +
                    '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>' +
                    (hasOffer ? 'Rigenera con AI' : 'Genera con AI') +
                '</button>' +
            '</div>' +
            // Context cards
            buildContextCards(hasNotes, hasSap, sap) +
            // Result area
            '<div id="offer-result">' +
                (hasOffer
                    ? buildOfferDisplay(prospect.oto_formula)
                    : buildEmptyState()
                ) +
            '</div>' +
        '</div>'
    );
}

function buildContextCards(hasNotes, hasSap, sap) {
    return (
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.25rem;">' +
            buildContextCard(
                'Discovery Notes',
                hasNotes ? 'Presenti — alimentano l\'offerta' : 'Mancanti — compila il tab Discovery prima',
                hasNotes ? '#10b981' : '#f59e0b',
                hasNotes ? 'check_circle' : 'warning'
            ) +
            buildContextCard(
                'SAP Target',
                hasSap ? escHtml(sap.name) : 'Non selezionato — scegli nel tab Dati',
                hasSap ? '#10b981' : '#f59e0b',
                hasSap ? 'check_circle' : 'warning'
            ) +
        '</div>'
    );
}

function buildContextCard(label, value, color, icon) {
    return (
        '<div style="background:' + color + '08;border:1px solid ' + color + '22;border-radius:12px;padding:0.75rem 1rem;">' +
            '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:3px;">' +
                '<span class="material-icons-round" style="font-size:0.95rem;color:' + color + ';">' + icon + '</span>' +
                '<span style="font-size:0.72rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;">' + label + '</span>' +
            '</div>' +
            '<div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);">' + value + '</div>' +
        '</div>'
    );
}

function buildEmptyState() {
    return (
        '<div style="text-align:center;padding:2.5rem 1rem;color:var(--text-tertiary);border:2px dashed var(--glass-border);border-radius:14px;">' +
            '<span class="material-icons-round" style="font-size:3rem;opacity:0.4;display:block;margin-bottom:0.75rem;">campaign</span>' +
            '<div style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem;">Nessuna offerta ancora generata</div>' +
            '<div style="font-size:0.78rem;">Clicca "Genera con AI" per costruire una OTO Formula partendo da SAP + Discovery Notes.</div>' +
        '</div>'
    );
}

function buildOfferDisplay(otoFormula) {
    let parsed = null;
    try { parsed = JSON.parse(otoFormula); } catch (e) { /* legacy text */ }

    if (parsed && parsed.formula) {
        return (
            '<div style="background:linear-gradient(135deg, #8b5cf608, #3b82f608);border:1px solid #8b5cf622;border-radius:16px;padding:1.5rem;">' +
                // Formula completa
                '<div style="font-size:0.72rem;font-weight:800;color:#8b5cf6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">OTO Formula</div>' +
                '<div style="font-size:1rem;font-weight:700;color:var(--text-primary);line-height:1.5;padding:1rem;background:rgba(255,255,255,0.4);border-radius:10px;margin-bottom:1.25rem;">' +
                    escHtml(parsed.formula) +
                '</div>' +
                // Componenti scomposti
                componentBlock('Target (chi)', parsed.target, '#3b82f6') +
                componentBlock('Risultato (cosa)', parsed.result, '#10b981') +
                componentBlock('Tempo (entro quando)', parsed.timeframe, '#f59e0b') +
                componentBlock('Meccanismo (come)', parsed.mechanism, '#8b5cf6') +
                componentBlock('Senza (cosa elimina)', parsed.without, '#ef4444') +
                componentBlock('Garanzia', parsed.guarantee, '#6366f1') +
                // Pricing suggerito
                (parsed.pricing
                    ? '<div style="margin-top:1rem;padding:0.75rem 1rem;background:rgba(255,255,255,0.4);border-radius:10px;border-left:3px solid #10b981;">' +
                        '<div style="font-size:0.7rem;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">Pricing suggerito</div>' +
                        '<div style="font-size:0.85rem;color:var(--text-primary);font-weight:600;">' + escHtml(parsed.pricing) + '</div>' +
                      '</div>'
                    : '') +
                // Rationale
                (parsed.rationale
                    ? '<div style="margin-top:1rem;padding:0.75rem 1rem;background:rgba(0,0,0,0.03);border-radius:10px;">' +
                        '<div style="font-size:0.7rem;font-weight:800;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">Perché funziona</div>' +
                        '<div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;">' + escHtml(parsed.rationale) + '</div>' +
                      '</div>'
                    : '') +
                // Actions
                '<div style="display:flex;gap:0.5rem;margin-top:1.25rem;justify-content:flex-end;">' +
                    '<button class="btn-copy-offer" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;padding:5px 12px;border-radius:8px;border:none;background:#8b5cf620;color:#8b5cf6;cursor:pointer;font-weight:700;">' +
                        '<span class="material-icons-round" style="font-size:0.85rem;">content_copy</span>Copia formula' +
                    '</button>' +
                '</div>' +
            '</div>'
        );
    }

    // Fallback testo libero (offerta legacy)
    return (
        '<div style="background:#8b5cf608;border:1px solid #8b5cf622;border-radius:14px;padding:1.25rem;font-size:0.85rem;color:var(--text-primary);line-height:1.5;white-space:pre-wrap;">' +
            escHtml(otoFormula) +
        '</div>'
    );
}

function componentBlock(label, value, color) {
    if (!value) return '';
    return (
        '<div style="margin-bottom:0.6rem;display:grid;grid-template-columns:140px 1fr;gap:0.5rem;align-items:flex-start;">' +
            '<div style="font-size:0.72rem;font-weight:800;color:' + color + ';text-transform:uppercase;letter-spacing:0.04em;padding-top:3px;">' + label + '</div>' +
            '<div style="font-size:0.85rem;color:var(--text-primary);line-height:1.5;">' + escHtml(value) + '</div>' +
        '</div>'
    );
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────

function bindEvents(container, prospect, notes, sap) {
    container.querySelector('#btn-generate-offer')?.addEventListener('click', async () => {
        await generateOffer(container, prospect, notes, sap);
    });

    container.querySelector('#offer-result')?.addEventListener('click', (e) => {
        if (e.target.closest('.btn-copy-offer')) {
            const formula = prospect.oto_formula;
            let textToCopy = formula;
            try {
                const parsed = JSON.parse(formula);
                if (parsed.formula) textToCopy = parsed.formula;
            } catch (_) {}
            navigator.clipboard.writeText(textToCopy)
                .then(() => showGlobalAlert('Formula copiata', 'success'))
                .catch(() => showGlobalAlert('Copia manuale', 'error'));
        }
    });
}

async function generateOffer(container, prospect, notes, sap) {
    const btn = container.querySelector('#btn-generate-offer');
    const resultDiv = container.querySelector('#offer-result');

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;animation:spin 1s linear infinite;">refresh</span>Genero…';

    resultDiv.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;padding:2rem;gap:0.75rem;color:var(--text-secondary);">' +
            '<span class="material-icons-round" style="animation:spin 1s linear infinite;">auto_awesome</span>' +
            'Sto costruendo l\'offerta…' +
        '</div>';

    try {
        const prompt = buildPrompt(prospect, notes, sap);
        const schema = {
            formula:    'string — formula completa: "Aiuto X a ottenere Y in Z attraverso W senza K"',
            target:     'string — chi è il cliente (specifico, non generico)',
            result:     'string — risultato numerico/misurabile',
            timeframe:  'string — tempo concreto (es. 90 giorni)',
            mechanism:  'string — il "come" (nome del metodo o approccio distintivo)',
            without:    'string — cosa elimina/non richiede al cliente',
            guarantee:  'string — garanzia proposta (continuiamo gratis / rimborso / ecc.)',
            pricing:    'string — pricing suggerito (es. "€3.000 OTO 3 mesi, poi €1.200/mese MRR")',
            rationale:  'string — 2-3 righe sul perché questa formula funziona per questo prospect',
        };

        const result = await completeJSON(prompt, schema, {
            feature: 'sales_offer_builder',
            model: MODEL,
            system:
                'Sei un consulente di vendita per agenzie B2B italiane, esperto della metodologia Parozzi (OTO Formula) e Bani (Grand Slam Offer). ' +
                'Costruisci offerte concrete, misurabili, con linguaggio della nicchia (non generico). ' +
                'L\'agenzia mittente è Gleeye (Genova, comunicazione & marketing). ' +
                'NON inventare dati che non hai — se manca un\'info, fai una stima sensata basata su benchmark di settore e dichiarala come tale. ' +
                'Pricing: 10-15% del risultato annuo generato, ticket entry €3-6K. ' +
                'Rispondi SOLO in JSON valido.',
        });

        // Persisti l'OTO sul prospect
        const otoJson = JSON.stringify(result);
        await upsertProspect({ id: prospect.id, oto_formula: otoJson });
        prospect.oto_formula = otoJson;

        resultDiv.innerHTML = buildOfferDisplay(otoJson);
        showGlobalAlert('OTO Formula generata e salvata', 'success');
    } catch (err) {
        console.error('[OfferBuilder] error', err);
        resultDiv.innerHTML = '<div style="padding:1rem;color:#ef4444;font-size:0.85rem;">Errore AI: ' + escHtml(err.message) + '</div>';
        showGlobalAlert('Errore: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">auto_awesome</span>Rigenera con AI';
    }
}

function buildPrompt(prospect, notes, sap) {
    const lines = [
        'Costruisci una OTO Formula per questo prospect, formato: "Aiuto [nicchia] a ottenere [risultato misurabile] in [tempo] attraverso [meccanismo distintivo] senza [dolore principale]".',
        '',
        '## PROSPECT TARGET',
        '- Azienda: ' + (prospect.business_name || '?'),
    ];
    if (prospect.industry) lines.push('- Settore: ' + prospect.industry);
    if (prospect.company_size) lines.push('- Dimensione: ' + prospect.company_size);
    if (prospect.contact_name) lines.push('- Referente: ' + prospect.contact_name);

    const enrich = prospect.ai_enrichment_data || {};
    if (enrich.industry && !prospect.industry) lines.push('- Settore (AI): ' + enrich.industry);
    if (enrich.description) lines.push('- Descrizione: ' + enrich.description);
    if (enrich.company_size && !prospect.company_size) lines.push('- Dimensione (AI): ' + enrich.company_size);
    if (enrich.key_info && enrich.key_info.length) lines.push('- Info chiave: ' + enrich.key_info.join('; '));

    if (sap) {
        lines.push('');
        lines.push('## SAP DA PROPORRE');
        lines.push('- Nome servizio: ' + sap.name);
        if (sap.description) lines.push('- Descrizione: ' + sap.description);
        if (sap.value_proposition) lines.push('- Value proposition: ' + sap.value_proposition);
        if (sap.target_customer) lines.push('- Cliente ideale tipo: ' + sap.target_customer);
        if (sap.process_blueprint) lines.push('- Processo (blueprint): ' + sap.process_blueprint.slice(0, 800));
        if (sap.delivery_time_days) lines.push('- Tempo delivery medio: ' + sap.delivery_time_days + ' giorni');
        if (sap.pricing_tiers) {
            try {
                const tiers = typeof sap.pricing_tiers === 'string' ? JSON.parse(sap.pricing_tiers) : sap.pricing_tiers;
                if (tiers && Object.keys(tiers).length) lines.push('- Pricing tiers: ' + JSON.stringify(tiers));
            } catch (_) {}
        }
    } else {
        lines.push('');
        lines.push('## SAP DA PROPORRE');
        lines.push('Nessun SAP target selezionato — proponi un servizio generico di comunicazione/marketing su misura per il prospect.');
    }

    if (notes) {
        lines.push('');
        lines.push('## DISCOVERY NOTES (cosa ha detto il prospect in call)');
        if (notes.cosa_vende) lines.push('- Cosa vende: ' + notes.cosa_vende);
        if (notes.target_clienti) lines.push('- A chi vende: ' + notes.target_clienti);
        if (notes.valore_cliente_annuo) lines.push('- Valore cliente €/anno: ' + notes.valore_cliente_annuo);
        if (notes.clienti_attuali) lines.push('- Clienti attuali: ' + notes.clienti_attuali);
        if (notes.richieste_mese) lines.push('- Richieste/mese: ' + notes.richieste_mese);
        if (notes.canale_acquisizione_oggi) lines.push('- Canale acquisizione oggi: ' + notes.canale_acquisizione_oggi);
        if (notes.pain_principale) lines.push('- ⚠️ PAIN PRINCIPALE: ' + notes.pain_principale);
        if (notes.esperienze_negative) lines.push('- ⚠️ ESPERIENZE NEGATIVE PASSATE (usa nel "senza"): ' + notes.esperienze_negative);
        if (notes.obiettivo_12_mesi) lines.push('- 🎯 OBIETTIVO 12 MESI: ' + notes.obiettivo_12_mesi);
        if (notes.cosa_cambierebbe_business) lines.push('- Cosa cambierebbe se 2x clienti: ' + notes.cosa_cambierebbe_business);
        if (notes.cosa_provato_in_passato) lines.push('- Cosa ha provato in passato: ' + notes.cosa_provato_in_passato);
    } else {
        lines.push('');
        lines.push('## DISCOVERY NOTES');
        lines.push('Discovery non ancora fatta — costruisci comunque un\'offerta basata su settore + SAP. Sarà più generica.');
    }

    lines.push('');
    lines.push('## REGOLE');
    lines.push('1. Il "senza" DEVE derivare dalle esperienze negative del prospect (se disponibili).');
    lines.push('2. Il "risultato" deve essere numerico e misurabile (es. "10 nuovi pazienti/mese"), usando il LINGUAGGIO della loro nicchia (es. "pazienti" per medici, "coperti" per ristoranti).');
    lines.push('3. Il "meccanismo" deve sembrare un metodo distintivo Gleeye (anche se usa strumenti standard).');
    lines.push('4. Il pricing: stima il valore annuo generato (risultato × valore unitario × periodo) e proponi 10-15% di quello. Ticket entry €3-6K.');
    lines.push('5. La garanzia: usa "continuiamo a lavorare gratis fino al risultato" se hai poche info, altrimenti rimborso parziale 50% se sei sicuro.');
    lines.push('6. Rispondi in italiano.');

    return lines.join('\n');
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
