// Help Tooltip — Gleeye ERP
// Tooltip statici per termini tecnici/fiscali italiani.
// Filosofia: prima si razionalizza il linguaggio (rename label), poi solo dove resta
// un concetto fiscale oggettivo (P.IVA, SDI, Ritenuta, ecc.) si mostra l'icona "?".
// Zero chiamate AI: questi termini hanno spiegazione fissa, non serve un LLM.
//
// Uso:
//   import { glossaryTip, GLOSSARY } from './modules/help_tooltip.js?v=8001';
//   `<label>Codice SDI ${glossaryTip('sdi')}</label>`
//
// Oppure data-attribute diretto:
//   `<span class="gl-help" data-help="Testo libero...">?</span>`

// === Glossario fiscale / amministrativo italiano ===
// Aggiungi qui i termini quando ne servono di nuovi. Mantieni le spiegazioni brevi (1-2 frasi).
export const GLOSSARY = {
    // Anagrafica fiscale
    piva: 'Partita IVA — codice fiscale a 11 cifre delle attività economiche. Obbligatoria per emettere fattura.',
    cf: 'Codice Fiscale — identificativo univoco di persone fisiche (16 caratteri) o aziende (11 cifre, coincide con la P.IVA).',
    pec: 'Posta Elettronica Certificata — email con valore legale, usata per ricevere notifiche ufficiali e fatture elettroniche.',
    sdi: 'Codice SDI (Sistema di Interscambio) — codice di 7 caratteri assegnato dall\'Agenzia delle Entrate per ricevere fatture elettroniche. Se non lo hai, si usa la PEC.',
    iban: 'IBAN — codice bancario internazionale (27 caratteri in Italia, inizia con IT). Identifica univocamente il conto corrente.',
    cap: 'CAP — Codice di Avviamento Postale (5 cifre). Identifica la zona di consegna postale.',
    ateco: 'Codice ATECO — classificazione ISTAT dell\'attività economica (es. 73.11.02 per agenzie di pubblicità).',

    // Regimi fiscali
    regime_ordinario: 'Regime Ordinario — IVA 22% applicata in fattura, ritenuta d\'acconto 20% trattenuta dal cliente, contributi INPS/Cassa secondo categoria.',
    regime_forfettario: 'Regime Forfettario — no IVA in fattura, no ritenuta d\'acconto. Imposta sostitutiva 15% (5% startup). Limite ricavi 85.000 €/anno.',
    regime_occasionale: 'Prestazione Occasionale — attività saltuaria senza P.IVA. Ritenuta d\'acconto 20%, limite 5.000 €/anno per committente.',

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
        .gl-help::after {
            content: attr(data-help);
            position: absolute;
            bottom: calc(100% + 6px);
            left: 50%;
            transform: translateX(-50%);
            background: #1f2937;
            color: white;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.4;
            padding: 8px 12px;
            border-radius: 6px;
            width: max-content;
            max-width: 280px;
            text-align: left;
            white-space: normal;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .gl-help::before {
            content: '';
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #1f2937;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s;
            z-index: 9999;
        }
        .gl-help:hover::after,
        .gl-help:hover::before {
            opacity: 1;
        }
        /* Variante allineata a sinistra (per tooltip lunghi vicino al bordo destro) */
        .gl-help.gl-help--left::after {
            left: auto;
            right: 0;
            transform: none;
        }
        .gl-help.gl-help--left::before {
            left: auto;
            right: 4px;
            transform: none;
        }
    `;
    document.head.appendChild(style);
}

// Inietta CSS al primo import
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
    } else {
        injectStyle();
    }
}

// === API pubblica ===

/**
 * Ritorna markup HTML per un'icona "?" con tooltip da chiave glossario.
 * @param {string} termKey - Chiave in GLOSSARY (es. 'sdi', 'piva')
 * @param {Object} [opts] - { align: 'center' | 'left' }
 * @returns {string} HTML stringa da concatenare in template literal.
 */
export function glossaryTip(termKey, opts = {}) {
    const text = GLOSSARY[termKey];
    if (!text) {
        console.warn(`[help_tooltip] Chiave glossario sconosciuta: "${termKey}"`);
        return '';
    }
    const alignClass = opts.align === 'left' ? ' gl-help--left' : '';
    // Escape doppi apici per uso sicuro in attributo HTML
    const safe = text.replace(/"/g, '&quot;');
    return `<span class="gl-help${alignClass}" data-help="${safe}" aria-label="Aiuto: ${termKey}">?</span>`;
}

/**
 * Ritorna markup HTML per tooltip con testo libero (non da glossario).
 * Usalo per casi unici non standardizzabili.
 * @param {string} helpText - Testo del tooltip.
 * @param {Object} [opts] - { align: 'center' | 'left' }
 * @returns {string} HTML stringa.
 */
export function customTip(helpText, opts = {}) {
    if (!helpText) return '';
    const alignClass = opts.align === 'left' ? ' gl-help--left' : '';
    const safe = String(helpText).replace(/"/g, '&quot;');
    return `<span class="gl-help${alignClass}" data-help="${safe}" aria-label="Aiuto">?</span>`;
}

// Espongo su window per uso da inline handler / debugging
if (typeof window !== 'undefined') {
    window.glHelp = { glossaryTip, customTip, GLOSSARY };
}
