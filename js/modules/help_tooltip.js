// Help Tooltip — Gleeye ERP
// Tooltip statici per termini tecnici/fiscali italiani.
// Filosofia: prima si razionalizza il linguaggio (rename label), poi solo dove resta
// un concetto fiscale oggettivo (P.IVA, SDI, Ritenuta, ecc.) si mostra l'icona "?".
// Zero chiamate AI: questi termini hanno spiegazione fissa, non serve un LLM.
//
// Uso:
//   import { glossaryTip, GLOSSARY } from './modules/help_tooltip.js?v=8002';
//   `<label>Codice SDI ${glossaryTip('sdi')}</label>`
//
// Positioning: il tooltip è un elemento DOM creato al hover (NON pseudo-element),
// quindi si auto-flip up/down e si shifta dentro al viewport.

// === Glossario fiscale / amministrativo italiano ===
export const GLOSSARY = {
    // Anagrafica fiscale
    piva: 'Partita IVA — codice fiscale a 11 cifre delle attività economiche. Obbligatoria per emettere fattura.',
    cf: 'Codice Fiscale — identificativo univoco di persone fisiche (16 caratteri) o aziende (11 cifre, coincide con la P.IVA).',
    pec: 'Posta Elettronica Certificata — email con valore legale, usata per ricevere notifiche ufficiali e fatture elettroniche.',
    sdi: 'Codice SDI (Sistema di Interscambio) — codice di 7 caratteri assegnato dall\'Agenzia delle Entrate per ricevere fatture elettroniche. Se non lo hai, si usa la PEC.',
    iban: 'IBAN — codice bancario internazionale (27 caratteri in Italia, inizia con IT). Identifica univocamente il conto corrente.',
    cap: 'CAP — Codice di Avviamento Postale (5 cifre). Identifica la zona di consegna postale.',
    ateco: 'Codice ATECO — classificazione ISTAT dell\'attività economica (es. 73.11.02 per agenzie di pubblicità).',

    // Regimi fiscali singoli
    regime_ordinario: 'Regime Ordinario — IVA 22% applicata in fattura, ritenuta d\'acconto 20% trattenuta dal cliente, contributi INPS/Cassa secondo categoria.',
    regime_forfettario: 'Regime Forfettario — no IVA in fattura, no ritenuta d\'acconto. Imposta sostitutiva 15% (5% startup). Limite ricavi 85.000 €/anno.',
    regime_occasionale: 'Prestazione Occasionale — attività saltuaria senza P.IVA. Ritenuta d\'acconto 20%, limite 5.000 €/anno per committente.',

    // Overview composito per il select "Regime fiscale"
    regime_fiscale_overview: `Indica come il fornitore emette fattura:
• Ordinario: IVA 22% + Ritenuta 20%
• Forfettario: no IVA, no Ritenuta, bollo 2 € sopra 77,47 €
• Occasionale: no P.IVA, Ritenuta 20%, limite 5.000 €/anno/committente
• Estero / Reverse Charge: no IVA, IVA liquidata dal committente
• Parcella / Notula: professionisti con cassa, IVA + Ritenuta + Cassa`,

    // Overview composito per il blocco "Dati Fiscali" del cliente
    dati_fiscali_overview: `Identificativi fiscali del cliente:
• Partita IVA: 11 cifre, obbligatoria per emettere fattura
• Codice Fiscale: 16 caratteri (persona fisica) o 11 cifre (azienda)
• Codice SDI: 7 caratteri per ricevere fatture elettroniche, oppure PEC se non disponibile`,

    // Componenti fattura
    ritenuta_acconto: 'Ritenuta d\'Acconto — il 20% del compenso viene trattenuto dal cliente e versato all\'Erario per conto tuo. Si recupera in dichiarazione.',
    rivalsa_inps: 'Rivalsa INPS 4% — integrazione contributi INPS a carico del cliente (gestione separata). Calcolata sul compenso lordo.',
    cassa_previdenza: 'Cassa Previdenza — contributo per la cassa professionale di appartenenza (es. INARCASSA architetti 4%). Deducibile.',
    bollo_virtuale: 'Bollo Virtuale 2 € — imposta di bollo sulle fatture senza IVA superiori a 77,47 € (forfettari, occasionali, fuori campo IVA). Si applica con dicitura "Assolto in modo virtuale".',
    esigibilita_iva: 'Esigibilità IVA — momento in cui l\'IVA diventa dovuta. "Immediata": all\'emissione. "Differita": al pagamento (es. enti pubblici).',
    split_payment: 'Split Payment — meccanismo per PA: il committente versa l\'IVA direttamente all\'Erario, tu ricevi solo l\'imponibile.',
    reverse_charge: 'Reverse Charge — fattura senza IVA emessa a UE/extra-UE o per servizi specifici. L\'IVA la liquida il committente nel proprio paese.',

    // Sigle Gleeye / business
    sap: 'Servizio a Pacchetto — offerta pre-confezionata con scope, deliverable e prezzo fissi. Si vende come prodotto, non come ore.',
    pm: 'Project Management — area dove si gestiscono commesse, attività, task, file, appuntamenti.',
    wl: 'White Label — partner che esegue lavori per noi rivendendoli con il nostro marchio (o viceversa).',
    oda: 'Ordine di Acquisto — documento interno che formalizza l\'incarico al collaboratore prima della fattura passiva.',

    // Stati
    lead: 'Lead — contatto interessato ai nostri servizi ma non ancora cliente. Diventa cliente al primo ordine.',
    potenziale: 'Cliente Potenziale — anagrafica con preventivo aperto, non ancora confermato.',
    dormiente: 'Cliente Dormiente — cliente storico senza ordini negli ultimi 12 mesi.',
};

// === CSS injection ===
const TOOLTIP_STYLE_ID = 'gl-help-tooltip-style';

function injectStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(TOOLTIP_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = TOOLTIP_STYLE_ID;
    style.textContent = `
        .gl-help {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: rgba(99, 102, 241, 0.12);
            color: #6366f1;
            font-size: 10px;
            font-weight: 700;
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            cursor: help;
            margin-left: 4px;
            vertical-align: middle;
            transition: background 0.15s, color 0.15s;
            position: relative;
            user-select: none;
        }
        .gl-help:hover {
            background: #6366f1;
            color: white;
        }
        .gl-help-popup {
            position: fixed;
            background: #1f2937;
            color: white;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.5;
            padding: 10px 14px;
            border-radius: 8px;
            max-width: min(320px, calc(100vw - 24px));
            white-space: pre-line;
            text-align: left;
            pointer-events: none;
            z-index: 99999;
            box-shadow: 0 8px 24px rgba(0,0,0,0.25);
            opacity: 0;
            transform: translateY(2px);
            transition: opacity 0.12s, transform 0.12s;
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .gl-help-popup.gl-help-popup--visible {
            opacity: 1;
            transform: translateY(0);
        }
        .gl-help-popup::before {
            content: '';
            position: absolute;
            border: 6px solid transparent;
        }
        .gl-help-popup[data-placement="top"]::before {
            top: 100%;
            left: var(--arrow-x, 50%);
            transform: translateX(-50%);
            border-top-color: #1f2937;
        }
        .gl-help-popup[data-placement="bottom"]::before {
            bottom: 100%;
            left: var(--arrow-x, 50%);
            transform: translateX(-50%);
            border-bottom-color: #1f2937;
        }
    `;
    document.head.appendChild(style);
}

// === Runtime tooltip element (singleton) ===
let popupEl = null;
let currentTrigger = null;

function ensurePopup() {
    if (popupEl) return popupEl;
    popupEl = document.createElement('div');
    popupEl.className = 'gl-help-popup';
    popupEl.setAttribute('role', 'tooltip');
    document.body.appendChild(popupEl);
    return popupEl;
}

function showPopup(triggerEl) {
    const text = triggerEl.getAttribute('data-help');
    if (!text) return;
    ensurePopup();
    currentTrigger = triggerEl;
    popupEl.textContent = text;
    popupEl.style.opacity = '0';
    popupEl.classList.remove('gl-help-popup--visible');

    // Render off-screen to measure
    popupEl.style.left = '-9999px';
    popupEl.style.top = '0px';

    // Force layout
    requestAnimationFrame(() => {
        if (currentTrigger !== triggerEl) return; // Già cambiato
        positionPopup(triggerEl);
        popupEl.classList.add('gl-help-popup--visible');
    });
}

function positionPopup(triggerEl) {
    if (!popupEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const popupRect = popupEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const gap = 8;

    // Vertical: prefer top, flip to bottom if not enough space
    let placement = 'top';
    let top = rect.top - popupRect.height - gap;
    if (top < margin) {
        placement = 'bottom';
        top = rect.bottom + gap;
    }
    if (top + popupRect.height > vh - margin) {
        // Se anche sotto sfora, lo clampiamo dentro
        top = Math.max(margin, vh - popupRect.height - margin);
    }

    // Horizontal: center on trigger, clamp to viewport
    let triggerCenter = rect.left + rect.width / 2;
    let left = triggerCenter - popupRect.width / 2;
    left = Math.max(margin, Math.min(left, vw - popupRect.width - margin));

    // Arrow position: relativa al popup
    const arrowX = triggerCenter - left;
    const arrowXClamped = Math.max(12, Math.min(arrowX, popupRect.width - 12));

    popupEl.style.left = `${Math.round(left)}px`;
    popupEl.style.top = `${Math.round(top)}px`;
    popupEl.setAttribute('data-placement', placement);
    popupEl.style.setProperty('--arrow-x', `${Math.round(arrowXClamped)}px`);
}

function hidePopup() {
    if (!popupEl) return;
    popupEl.classList.remove('gl-help-popup--visible');
    currentTrigger = null;
}

function bindGlobalListeners() {
    if (typeof document === 'undefined') return;
    if (document._glHelpBound) return;
    document._glHelpBound = true;

    document.addEventListener('mouseover', (e) => {
        const trigger = e.target.closest?.('.gl-help');
        if (trigger) showPopup(trigger);
    });
    document.addEventListener('mouseout', (e) => {
        const trigger = e.target.closest?.('.gl-help');
        if (trigger && currentTrigger === trigger) hidePopup();
    });
    document.addEventListener('focusin', (e) => {
        const trigger = e.target.closest?.('.gl-help');
        if (trigger) showPopup(trigger);
    });
    document.addEventListener('focusout', (e) => {
        const trigger = e.target.closest?.('.gl-help');
        if (trigger && currentTrigger === trigger) hidePopup();
    });
    document.addEventListener('scroll', () => {
        if (currentTrigger) positionPopup(currentTrigger);
    }, true);
    window.addEventListener('resize', () => {
        if (currentTrigger) positionPopup(currentTrigger);
    });
}

// Init
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyle();
            bindGlobalListeners();
        }, { once: true });
    } else {
        injectStyle();
        bindGlobalListeners();
    }
}

// === API pubblica ===

/**
 * Ritorna markup HTML per un'icona "?" con tooltip da chiave glossario.
 * @param {string} termKey - Chiave in GLOSSARY (es. 'sdi', 'piva')
 * @returns {string} HTML stringa da concatenare in template literal.
 */
export function glossaryTip(termKey) {
    const text = GLOSSARY[termKey];
    if (!text) {
        console.warn(`[help_tooltip] Chiave glossario sconosciuta: "${termKey}"`);
        return '';
    }
    const safe = text.replace(/"/g, '&quot;');
    return `<span class="gl-help" data-help="${safe}" tabindex="0" aria-label="Aiuto: ${termKey}">?</span>`;
}

/**
 * Ritorna markup HTML per tooltip con testo libero (non da glossario).
 * @param {string} helpText - Testo del tooltip.
 * @returns {string} HTML stringa.
 */
export function customTip(helpText) {
    if (!helpText) return '';
    const safe = String(helpText).replace(/"/g, '&quot;');
    return `<span class="gl-help" data-help="${safe}" tabindex="0" aria-label="Aiuto">?</span>`;
}

// Espongo su window per debugging
if (typeof window !== 'undefined') {
    window.glHelp = { glossaryTip, customTip, GLOSSARY };
}
