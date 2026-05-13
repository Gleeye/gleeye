// SAP AI Documentation Generator
// Genera 7 documenti di marketing/sales/operations per un Servizio a Pacchetto.
// Usa ai_client.js (da feature/ai-foundation) + Edge Function ai-proxy → OpenRouter.

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { chat, AI_MODELS } from '../../modules/ai_client.js?v=8000';

const DOC_TYPES = [
    { id: 'brochure',   label: 'Brochure prodotto',        icon: 'picture_as_pdf',  color: '#8b5cf6' },
    { id: 'landing',    label: 'Landing page (HTML)',       icon: 'web',             color: '#3b82f6' },
    { id: 'email',      label: 'Email primo contatto',      icon: 'email',           color: '#10b981' },
    { id: 'brief',      label: 'Brief operativo collab',    icon: 'assignment',      color: '#f59e0b' },
    { id: 'listino',    label: 'Listino strutturato',       icon: 'price_change',    color: '#ef4444' },
    { id: 'faq',        label: 'FAQ (5-7 domande)',         icon: 'help_outline',    color: '#06b6d4' },
    { id: 'clausole',   label: 'Clausole contrattuali',     icon: 'gavel',           color: '#64748b' },
];

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function openDocGenerator(serviceId) {
    const service = state.sapServices?.find(s => s.id === serviceId);
    if (!service) { await window.showAlert('Servizio SAP non trovato.', 'error'); return; }

    const missingFields = [];
    if (!service.value_proposition) missingFields.push('Value Proposition');
    if (!service.target_customer)   missingFields.push('Target Customer');
    if (!(service.package_includes?.length)) missingFields.push('Cosa include il pacchetto');
    if (!(service.pricing_tiers?.length))    missingFields.push('Tier di prezzo');

    if (missingFields.length > 0) {
        await window.showAlert(
            `Prima di generare, compila questi campi nella sezione "Dati per AI":\n• ${missingFields.join('\n• ')}`,
            'warning'
        );
        const body = document.getElementById('sap-ai-section-body');
        if (body) body.classList.remove('hidden');
        return;
    }

    _openGeneratorModal(service);
}

// ─── Modal UI ─────────────────────────────────────────────────────────────────

function _openGeneratorModal(service) {
    const existing = document.getElementById('sap-doc-gen-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sap-doc-gen-modal';
    modal.className = 'modal';
    modal.innerHTML = _buildModalHTML(service);
    document.body.appendChild(modal);
    modal.classList.add('active');
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('sap-docgen-start-btn').addEventListener('click', () => {
        _runGeneration(service, modal);
    });
}

function _buildModalHTML(service) {
    const docList = DOC_TYPES.map(d => `
        <div id="docgen-row-${d.id}" style="display:flex; align-items:center; gap:1rem; padding:0.75rem 1rem; border-radius:12px; background:var(--bg-tertiary); border:1px solid var(--glass-border); transition: all 0.3s;">
            <div style="width:38px; height:38px; border-radius:10px; background:${d.color}22; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="material-icons-round" style="font-size:1.2rem; color:${d.color};">${d.icon}</span>
            </div>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${d.label}</div>
            </div>
            <div id="docgen-status-${d.id}" style="font-size:0.75rem; color:var(--text-tertiary); font-weight:600; display:flex; align-items:center; gap:0.3rem; min-width:90px; justify-content:flex-end;">
                <span class="material-icons-round" style="font-size:1rem;">radio_button_unchecked</span> In attesa
            </div>
        </div>
    `).join('');

    return `
        <div class="modal-content" style="max-width:620px; width:95vw; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl);">
            <div style="padding:1.5rem 2rem; background:var(--brand-gradient); color:white;">
                <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
                    <span class="material-icons-round" style="font-size:1.5rem;">auto_awesome</span>
                    <h2 style="margin:0; font-size:1.25rem; font-weight:800; font-family:var(--font-titles);">AI Documentation Generator</h2>
                </div>
                <div style="font-size:0.85rem; opacity:0.85;">${service.name}</div>
            </div>

            <div style="padding:1.5rem 2rem;">
                <div id="docgen-intro" style="margin-bottom:1.25rem; padding:0.9rem 1.1rem; border-radius:12px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.15); font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
                    Claude genererà <strong>7 documenti</strong> per questo SAP: brochure, landing page, email sales, brief operativo, listino, FAQ e clausole contrattuali. Stima: <strong>~2-4 minuti</strong> · costo ~<strong>0.80–1.50€</strong>.
                </div>

                <div style="display:flex; flex-direction:column; gap:0.6rem;">
                    ${docList}
                </div>

                <div id="docgen-progress-bar-wrap" style="display:none; margin-top:1.25rem;">
                    <div style="height:6px; background:var(--bg-tertiary); border-radius:99px; overflow:hidden;">
                        <div id="docgen-progress-bar" style="height:100%; width:0%; background:var(--brand-gradient); border-radius:99px; transition:width 0.5s ease;"></div>
                    </div>
                    <div id="docgen-progress-label" style="margin-top:0.4rem; font-size:0.75rem; color:var(--text-tertiary); text-align:center; font-weight:600;"></div>
                </div>
            </div>

            <div style="padding:1rem 2rem 1.5rem 2rem; display:flex; align-items:center; justify-content:flex-end; gap:0.75rem; border-top:1px solid var(--glass-border);">
                <button onclick="document.getElementById('sap-doc-gen-modal').remove()" style="padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.875rem; cursor:pointer;">Annulla</button>
                <button id="sap-docgen-start-btn" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.5rem; border-radius:10px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.875rem; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                    <span class="material-icons-round" style="font-size:1rem;">play_arrow</span> Genera tutti i documenti
                </button>
            </div>
        </div>
    `;
}

// ─── Generation engine ────────────────────────────────────────────────────────

async function _runGeneration(service, modal) {
    const startBtn = document.getElementById('sap-docgen-start-btn');
    const intro    = document.getElementById('docgen-intro');
    const progressWrap = document.getElementById('docgen-progress-bar-wrap');
    const progressBar  = document.getElementById('docgen-progress-bar');
    const progressLbl  = document.getElementById('docgen-progress-label');

    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">autorenew</span> Generando…';
    intro.style.display = 'none';
    progressWrap.style.display = 'block';

    // Update ai_doc_status → generating
    await supabase.from('core_services').update({ ai_doc_status: 'generating' }).eq('id', service.id);
    const svc = state.sapServices?.find(s => s.id === service.id);
    if (svc) svc.ai_doc_status = 'generating';

    const results = {};
    let errorOccurred = false;

    for (let i = 0; i < DOC_TYPES.length; i++) {
        const doc = DOC_TYPES[i];
        _setDocStatus(doc.id, 'generating');
        _updateProgress(i, DOC_TYPES.length, `Generando ${doc.label}…`, progressBar, progressLbl);

        try {
            const content = await _generateDocument(service, doc.id);
            results[doc.id] = { doc_type: doc.id, label: doc.label, content, generated_at: new Date().toISOString() };
            _setDocStatus(doc.id, 'done');
        } catch (err) {
            console.error(`[doc_generator] Errore su ${doc.id}:`, err);
            results[doc.id] = { doc_type: doc.id, label: doc.label, content: null, error: err.message, generated_at: new Date().toISOString() };
            _setDocStatus(doc.id, 'error');
            errorOccurred = true;
        }
    }

    _updateProgress(DOC_TYPES.length, DOC_TYPES.length, 'Completato!', progressBar, progressLbl);

    // Persist results in cloud_links (append, don't overwrite existing links)
    const existingLinks = (service.cloud_links || []).filter(l => l.type !== 'ai_doc');
    const aiDocs = Object.values(results).map(r => ({ type: 'ai_doc', ...r }));
    const updatedLinks = [...existingLinks, ...aiDocs];

    const finalStatus = errorOccurred ? 'error' : 'ready';
    await supabase.from('core_services')
        .update({ cloud_links: updatedLinks, ai_doc_status: finalStatus })
        .eq('id', service.id);

    if (svc) { svc.cloud_links = updatedLinks; svc.ai_doc_status = finalStatus; }

    // Switch to viewer
    modal.remove();
    const { openDocViewer } = await import('./doc_viewer.js?v=8000');
    await openDocViewer(service.id, updatedLinks);
}

// ─── Single document prompts ──────────────────────────────────────────────────

async function _generateDocument(service, docType) {
    const context = _buildServiceContext(service);
    const prompt  = _buildPrompt(service, docType);

    const resp = await chat({
        feature: 'doc_generator',
        messages: [
            { role: 'system', content: _systemPrompt() },
            { role: 'user',   content: `${context}\n\n---\n\n${prompt}` },
        ],
        max_tokens: 2400,
        temperature: 0.7,
        feature_context: { entity_type: 'core_service', entity_id: service.id, doc_type: docType },
    });

    const text = resp?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Risposta AI vuota');
    return text;
}

function _systemPrompt() {
    return `Sei il copywriter e content strategist di Gleeye, un'agenzia di comunicazione italiana con base a Genova.
Gleeye vende servizi a pacchetto (SAP) a PMI, imprenditori e professionisti italiani.
Scrivi sempre in italiano, con tono professionale ma diretto. Non usare gergo anglosassone inutile.
Ogni documento deve essere concreto, pratico e pronto per l'uso — non generico.
Fornisci output formattato in Markdown a meno che non sia specificato diversamente.`;
}

function _buildServiceContext(service) {
    const tiers = (service.pricing_tiers || []).map(t =>
        typeof t === 'string' ? t : `${t.name || ''} ${t.price ? '– ' + t.price + '€' : ''}${t.description ? ': ' + t.description : ''}`
    ).join(', ');

    const includes = (service.package_includes || []).map(i =>
        typeof i === 'string' ? i : (i.label || '')
    ).join('; ');

    return `## Servizio SAP: ${service.name}

**Value proposition**: ${service.value_proposition || 'N/D'}
**Target customer**: ${service.target_customer || 'N/D'}
**Cosa include**: ${includes || 'N/D'}
**Pricing**: ${tiers || 'N/D'}
**Tempo di consegna**: ${service.delivery_time_days ? service.delivery_time_days + ' giorni' : 'N/D'}
**Team**: ${service.team_required || 'N/D'}`;
}

function _buildPrompt(service, docType) {
    const prompts = {
        brochure: `Scrivi la **brochure prodotto** per questo SAP.
Struttura (in Markdown, 1-2 pagine):
1. Headline accattivante
2. Value proposition (2-3 righe)
3. "Per chi è" (3-4 bullet)
4. "Cosa ottieni" (lista deliverable)
5. Come funziona (3 step semplici)
6. Pricing (gamma)
7. Call to action
Tono: professionale, concreto, orientato al risultato.`,

        landing: `Scrivi il **testo completo per una landing page** HTML di questo SAP.
Output: HTML semantico con CSS inline (pronto da incollare).
Struttura:
- Hero section con headline + subheadline + CTA button
- Sezione "Per chi è" (3 card)
- Sezione "Cosa ottieni" (lista con icone)
- Sezione "Come funziona" (3 step numerati)
- Pricing tier (card/tabella)
- FAQ (3-5 domande)
- Form contatto (solo HTML, action="#")
Usa colori neutri (bianco/grigio/blu #3b82f6). Responsive con max-width 960px.`,

        email: `Scrivi un **template email di primo contatto** per vendere questo SAP.
Formato:
- **Oggetto**: [proposta oggetto]
- **Preview text**: [testo anteprima]
- **Corpo**: apertura personalizzabile + pitch in 3 punti + soft CTA
Lunghezza: 150-200 parole. Tono: caldo, diretto, non spammy.
Includi variabili segnaposto come [NOME], [AZIENDA] dove appropriato.`,

        brief: `Scrivi il **brief operativo** per il collaboratore che esegue questo SAP.
Struttura:
1. Obiettivo del servizio (1 paragrafo)
2. Step di esecuzione (lista numerata, con timeline relativa al kick-off)
3. Deliverable da produrre (lista con formato richiesto)
4. Checklist qualità (min. 6 punti)
5. Note importanti (aspettative cliente, punti critici)
Tono: interno, pratico, senza marketing.`,

        listino: `Crea il **listino strutturato** per questo SAP.
Formato Markdown con tabelle:
1. **Pacchetto Base** — cosa include, prezzo
2. **Add-on opzionali** — lista con prezzo unitario
3. **Extra** — es. consegna rapida, revisioni aggiuntive
Includi anche note su sconti per volume/frequenza se applicabili.`,

        faq: `Genera **7 FAQ** (domande frequenti) per questo SAP.
Per ogni FAQ:
- **Domanda** (come la farebbe un cliente reale)
- **Risposta** (2-4 righe, chiara e rassicurante)
Anticipa obiezioni su: prezzo, tempi, qualità, cosa succede se non sono soddisfatto, processo di lavoro.`,

        clausole: `Scrivi le **clausole contrattuali base** per questo SAP.
Formato: lista numerata di articoli.
Includi:
1. Oggetto del contratto
2. Modalità di consegna e tempi
3. Modalità di pagamento (acconto/saldo)
4. Revisioni incluse e gestione extra
5. Diritti d'uso e proprietà intellettuale
6. Responsabilità e limitazioni
7. Riservatezza
8. Risoluzione del contratto
Tono: legale ma leggibile. Adatto al diritto italiano.`,
    };

    return prompts[docType] || `Scrivi un documento professionale per il SAP "${service.name}".`;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function _setDocStatus(docId, status) {
    const el = document.getElementById(`docgen-status-${docId}`);
    if (!el) return;
    const configs = {
        generating: { icon: 'autorenew',        color: '#3b82f6', label: 'Generando…',   anim: 'spin 1s linear infinite' },
        done:       { icon: 'check_circle',      color: '#10b981', label: 'Completato',   anim: 'none' },
        error:      { icon: 'error_outline',     color: '#ef4444', label: 'Errore',       anim: 'none' },
    };
    const c = configs[status] || { icon: 'radio_button_unchecked', color: 'var(--text-tertiary)', label: 'In attesa', anim: 'none' };
    el.innerHTML = `<span class="material-icons-round" style="font-size:1rem; color:${c.color}; animation:${c.anim};">${c.icon}</span> <span style="color:${c.color};">${c.label}</span>`;

    const row = document.getElementById(`docgen-row-${docId}`);
    if (row && status === 'done') {
        row.style.background = 'rgba(16,185,129,0.04)';
        row.style.borderColor = 'rgba(16,185,129,0.2)';
    }
}

function _updateProgress(current, total, label, bar, lbl) {
    const pct = Math.round((current / total) * 100);
    if (bar)  bar.style.width = pct + '%';
    if (lbl)  lbl.textContent = label;
}
