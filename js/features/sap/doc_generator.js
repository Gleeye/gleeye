// SAP-2 — AI Documentation Generator
//
// Genera 12 documenti per ogni SAP, derivati dal Processo Operativo (process_blueprint).
// Se il blueprint non esiste, usa i campi strutturati come fallback.
//
// Documenti:
//   COMMERCIALI: brochure, pitch_vendita, landing_html, email_sales
//   OPERATIVI:   brief_operativo, briefing_collaboratore, onboarding_cliente, cronoprogramma
//   LEGALI/AMM:  listino, clausole, scheda_economica_interna
//   SUPPORTO:    faq

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';
import { chat, parseAiJson } from '../../modules/ai_client.js?v=8000';

// ─── Catalogo documenti ───────────────────────────────────────────────────────

const DOC_CATALOG = [
    // COMMERCIALI
    { type: 'brochure',               label: 'Brochure commerciale',      icon: 'description',    category: 'Commerciali' },
    { type: 'pitch_vendita',          label: 'Pitch di vendita',          icon: 'present_to_all', category: 'Commerciali' },
    { type: 'landing_html',           label: 'Landing page HTML',         icon: 'web',            category: 'Commerciali' },
    { type: 'email_sales',            label: 'Email di vendita',          icon: 'email',          category: 'Commerciali' },
    // OPERATIVI
    { type: 'brief_operativo',        label: 'Brief operativo',           icon: 'assignment',     category: 'Operativi' },
    { type: 'briefing_collaboratore', label: 'Briefing collaboratore',    icon: 'group',          category: 'Operativi' },
    { type: 'onboarding_cliente',     label: 'Onboarding cliente',        icon: 'how_to_reg',     category: 'Operativi' },
    { type: 'cronoprogramma',         label: 'Cronoprogramma standard',   icon: 'calendar_month', category: 'Operativi' },
    // LEGALI / AMM
    { type: 'listino',                label: 'Listino prezzi',            icon: 'euro',           category: 'Legali/Amm' },
    { type: 'clausole',               label: 'Clausole contrattuali',     icon: 'gavel',          category: 'Legali/Amm' },
    { type: 'scheda_economica_interna', label: 'Scheda economica interna', icon: 'analytics',     category: 'Legali/Amm' },
    // SUPPORTO
    { type: 'faq',                    label: 'FAQ',                       icon: 'quiz',           category: 'Supporto' },
];

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function openDocGenerator(serviceId) {
    const service = state.sapServices?.find(s => s.id === serviceId);
    if (!service) { await window.showAlert('Servizio SAP non trovato.', 'error'); return; }

    const missingFields = [];
    if (!service.value_proposition) missingFields.push('Value Proposition');
    if (!service.package_includes?.length) missingFields.push('Cosa include il pacchetto');

    if (missingFields.length > 0) {
        const ok = await window.showConfirm(
            `Mancano alcuni dati consigliati:\n• ${missingFields.join('\n• ')}\n\nPuoi comunque generare i documenti, ma saranno meno precisi. Procedere?`,
            { confirmText: 'Sì, genera comunque', type: 'warning' }
        );
        if (!ok) return;
    }

    const existing = document.getElementById('sap-docgen-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sap-docgen-modal';
    modal.className = 'modal active';
    modal.innerHTML = _buildShellHTML(service);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('sap-docgen-start-btn').addEventListener('click', () => _runGeneration(service, modal));
}

// ─── Generation engine ────────────────────────────────────────────────────────

async function _runGeneration(service, modal) {
    const startBtn = document.getElementById('sap-docgen-start-btn');
    startBtn.style.display = 'none';

    const progressEl = document.getElementById('sap-docgen-progress');
    progressEl.style.display = 'flex';

    await supabase.from('core_services').update({ ai_doc_status: 'generating' }).eq('id', service.id);

    const existingLinks = (service.cloud_links || []).filter(l => l.type !== 'ai_doc');
    const newLinks = [...existingLinks];
    let generated = 0;
    let errors = 0;

    for (const doc of DOC_CATALOG) {
        _updateProgress(progressEl, doc.label, generated, DOC_CATALOG.length);
        try {
            const content = await _generateDoc(service, doc.type);
            newLinks.push({
                type: 'ai_doc',
                doc_type: doc.type,
                label: doc.label,
                content,
                generated_at: new Date().toISOString(),
            });
            generated++;
        } catch (err) {
            console.error(`[doc_generator] ${doc.type}`, err);
            errors++;
        }
    }

    await supabase.from('core_services').update({
        cloud_links: newLinks,
        ai_doc_status: errors === 0 ? 'ready' : (generated > 0 ? 'partial' : 'error'),
    }).eq('id', service.id);

    service.cloud_links = newLinks;
    service.ai_doc_status = errors === 0 ? 'ready' : 'partial';

    modal.remove();

    const { openDocViewer } = await import('./doc_viewer.js?v=8000');
    await openDocViewer(service.id, newLinks);
}

// ─── Doc prompts ──────────────────────────────────────────────────────────────

async function _generateDoc(service, docType) {
    const includes = (service.package_includes || [])
        .map(i => typeof i === 'string' ? i : (i.label || ''))
        .filter(Boolean).join('; ');

    const baseCtx = `
## SAP: ${service.name}
- Value Proposition: ${service.value_proposition || 'N/D'}
- Target: ${service.target_customer || 'N/D'}
- Deliverable: ${includes || 'N/D'}
- Team: ${service.team_required || 'N/D'}
- Tempo consegna: ${service.delivery_time_days ? service.delivery_time_days + ' giorni' : 'N/D'}`;

    const blueprintCtx = service.process_blueprint
        ? `\n\n## Processo Operativo\n${service.process_blueprint}`
        : '';

    const context = baseCtx + blueprintCtx;

    const prompts = {
        brochure: `Scrivi una brochure commerciale professionale per questo SAP.
${context}
Struttura: headline (beneficio principale), problema che risolve, cosa include (bullet), perché sceglierci, call-to-action.
Tono: professionale ma diretto, orientato al beneficio per il cliente. Max 400 parole.`,

        pitch_vendita: `Scrivi uno script/guida per il pitch di vendita di questo SAP da usare in una riunione commerciale.
${context}
Includi: apertura (aggancio), domande di qualifica, presentazione del SAP, gestione delle 3 obiezioni più comuni, chiusura proposta.
Tono: consulenziale, non aggressivo. Scrivi come se parlassi al commerciale che userà questo script.`,

        landing_html: `Scrivi il codice HTML completo per una landing page di questo SAP.
${context}
Struttura: hero con headline e CTA, sezione problema, soluzione (il SAP), cosa include, a chi è rivolto, processo in 3 step, testimonianza placeholder, CTA finale.
HTML semantico, CSS inline minimalista, nessun framework. Mobile-friendly.`,

        email_sales: `Scrivi una email di vendita per prospect freddi/tiepidi per questo SAP.
${context}
Struttura: oggetto irresistibile, apertura personalizzabile, problema specifico del target, come il SAP lo risolve, prova sociale, CTA chiara.
Max 200 parole nel corpo. Tono: umano, non da newsletter, come se scrivesse Davide in persona.`,

        brief_operativo: `Scrivi il brief operativo interno per avviare una commessa di questo SAP.
${context}
Includi: contesto del servizio, obiettivi di progetto, ruoli e responsabilità, input necessari dal cliente, output attesi, milestone principali, rischi comuni e come gestirli.
Tono: operativo, diretto, per uso interno del team.`,

        briefing_collaboratore: `Scrivi il briefing per il collaboratore che eroga questo SAP.
${context}
Includi: cos'è il servizio e perché esiste, cosa deve fare in concreto (fase per fase), standard di qualità attesi, come interfacciarsi col cliente, cosa NON fare, domande frequenti dal campo.
Tono: pratico, come una guida da leggere prima di iniziare il lavoro.`,

        onboarding_cliente: `Scrivi la guida di onboarding per il cliente che acquista questo SAP.
${context}
Includi: benvenuto e cosa aspettarsi, cosa il cliente deve preparare/fornire prima del kick-off, come funziona la comunicazione durante il progetto, tempi di risposta attesi, come vengono gestite le revisioni, contatti di riferimento placeholder.
Tono: rassicurante, chiaro, professionale.`,

        cronoprogramma: `Scrivi un cronoprogramma standard per questo SAP dalla firma al deliverable finale.
${context}
Formato: tabella testuale o elenco strutturato con Giorno/Settimana, Attività, Responsabile (team/cliente), Output.
Template tipo, non un piano specifico. Adattalo al tempo di consegna dichiarato.`,

        listino: `Scrivi il listino prezzi e le condizioni commerciali per questo SAP.
${context}
Includi: prezzo base, eventuali varianti/fasce, cosa è incluso, cosa è escluso (e relativo costo aggiuntivo), modalità di pagamento standard, validità del preventivo, sconti applicabili e condizioni.
Tono: formale ma leggibile.`,

        clausole: `Scrivi le clausole contrattuali specifiche per questo SAP da inserire nel contratto di servizio.
${context}
Includi: oggetto del contratto, deliverable e specifiche, tempi e penali, revisioni incluse e iter approvazione, proprietà intellettuale, limitazione di responsabilità, recesso.
Nota finale: da far revisionare da un legale prima dell'uso.`,

        scheda_economica_interna: `Scrivi una scheda economica interna per questo SAP (solo uso interno, non per il cliente).
${context}
Includi: stima ore per ruolo (account, PM, esecutivi, supervisione), costo orario medio di riferimento, costo totale stimato, prezzo listino suggerito, margine target %, breakeven, note su come ottimizzare il margine.
Tono: analitico, numeri ipotetici ma plausibili per un'agenzia italiana.`,

        faq: `Scrivi le FAQ per questo SAP destinate al team commerciale.
${context}
Almeno 10 domande reali che fa un cliente prima di acquistare, con risposte complete.
Organizza per categorie: sul servizio, sui tempi, sui prezzi, sul processo, sulle garanzie.`,
    };

    const prompt = prompts[docType];
    if (!prompt) throw new Error(`Tipo documento non supportato: ${docType}`);

    const resp = await chat({
        feature: 'doc_generator',
        messages: [
            {
                role: 'system',
                content: `Sei un copywriter e consulente strategico per agenzie di comunicazione italiane. Scrivi contenuti professionali, concreti e immediatamente utilizzabili. Rispondi in italiano.`
            },
            { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.4,
        feature_context: { entity_type: 'core_service', entity_id: service.id, doc_type: docType },
    });

    const content = resp?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Risposta AI vuota');
    return content;
}

// ─── Progress UI ──────────────────────────────────────────────────────────────

function _updateProgress(el, currentDoc, done, total) {
    if (!el) return;
    const pct = Math.round((done / total) * 100);
    el.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; gap:0.75rem;">
            <div style="font-size:0.88rem; color:var(--text-secondary);">
                Generando <strong>${currentDoc}</strong>… (${done + 1}/${total})
            </div>
            <div style="height:6px; background:var(--bg-secondary); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:var(--brand-gradient); transition:width 0.4s ease; border-radius:3px;"></div>
            </div>
        </div>
    `;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function _buildShellHTML(service) {
    const hasBlueprint = !!service.process_blueprint;
    const categories = [...new Set(DOC_CATALOG.map(d => d.category))];

    const docList = categories.map(cat => {
        const docs = DOC_CATALOG.filter(d => d.category === cat);
        return `
            <div>
                <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">${cat}</div>
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                    ${docs.map(d => `
                        <div style="display:flex; align-items:center; gap:0.6rem; padding:0.4rem 0.6rem; background:var(--bg-secondary); border-radius:8px;">
                            <span class="material-icons-round" style="font-size:1rem; color:var(--brand-blue);">${d.icon}</span>
                            <span style="font-size:0.82rem; color:var(--text-primary); font-weight:500;">${d.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="modal-content" style="max-width:560px; width:95vw; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl);">
            <div style="padding:1.25rem 1.75rem; background:var(--brand-gradient); color:white; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span class="material-icons-round" style="font-size:1.4rem;">auto_awesome</span>
                    <div>
                        <div style="font-weight:800; font-size:1.05rem; font-family:var(--font-titles);">Genera documentazione AI</div>
                        <div style="font-size:0.8rem; opacity:0.85;">${service.name}</div>
                    </div>
                </div>
                <button onclick="document.getElementById('sap-docgen-modal').remove()" style="background:rgba(255,255,255,0.2); border:none; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <span class="material-icons-round" style="font-size:1.1rem;">close</span>
                </button>
            </div>

            <div style="padding:1.5rem 1.75rem; display:flex; flex-direction:column; gap:1.25rem; max-height:70vh; overflow-y:auto;">

                ${!hasBlueprint ? `
                    <div style="padding:0.75rem 1rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:10px; font-size:0.82rem; color:#b45309; display:flex; align-items:flex-start; gap:0.5rem;">
                        <span class="material-icons-round" style="font-size:1rem; flex-shrink:0; margin-top:1px;">warning</span>
                        Nessun Processo Operativo definito — i documenti saranno generati dai dati base e risulteranno meno precisi.
                    </div>
                ` : `
                    <div style="padding:0.75rem 1rem; background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.2); border-radius:10px; font-size:0.82rem; color:#065f46; display:flex; align-items:center; gap:0.5rem;">
                        <span class="material-icons-round" style="font-size:1rem;">check_circle</span>
                        Processo Operativo presente — tutti i documenti saranno derivati da esso.
                    </div>
                `}

                <div>
                    <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.75rem;">${DOC_CATALOG.length} documenti che verranno generati</div>
                    <div style="display:flex; flex-direction:column; gap:0.75rem;">${docList}</div>
                </div>

                <div id="sap-docgen-progress" style="display:none; padding:1rem; background:var(--bg-secondary); border-radius:12px;"></div>

            </div>

            <div style="padding:1rem 1.75rem 1.5rem; display:flex; gap:0.75rem; justify-content:flex-end; border-top:1px solid var(--glass-border);">
                <button onclick="document.getElementById('sap-docgen-modal').remove()" style="padding:0.6rem 1.25rem; border-radius:10px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.875rem; cursor:pointer;">Annulla</button>
                <button id="sap-docgen-start-btn" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 1.5rem; border-radius:10px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.875rem; cursor:pointer; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                    <span class="material-icons-round" style="font-size:1rem;">rocket_launch</span>
                    Genera ${DOC_CATALOG.length} documenti
                </button>
            </div>
        </div>
    `;
}
