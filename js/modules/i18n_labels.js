// i18n Labels — Gleeye ERP
// Mappa centralizzata status enum (DB / API) → etichetta italiana per UI.
// Filosofia: nel DB restano i valori canonici (snake_case, eventuali inglesismi storici),
// in UI mostriamo SEMPRE italiano umano.
//
// Aggiungi qui quando trovi un enum in più. Non duplicare la mappa nei singoli file.
//
// Uso:
//   import { tStatus, tAssignment, tPayment, tOrder } from '../modules/i18n_labels.js?v=8001';
//   `<span>${tAssignment(a.status)}</span>`

// === Assignment status (assignments.status) ===
const ASSIGNMENT = {
    'pending': 'In attesa',
    'active': 'Attivo',
    'Active': 'Attivo',
    'in_progress': 'In corso',
    'In Progress': 'In corso',
    'completed': 'Completato',
    'Completed': 'Completato',
    'cancelled': 'Annullato',
    'canceled': 'Annullato',
    'on_hold': 'In pausa',
    'review': 'In revisione',
};

// === Payment status (payments.status) ===
const PAYMENT = {
    'pending': 'In attesa',
    'Pending': 'In attesa',
    'Da Fare': 'Da fare',
    'Invito Inviato': 'Invito inviato',
    'Fattura Ricevuta': 'Fattura ricevuta',
    'paid': 'Pagato',
    'Pagato': 'Pagato',
    'Saldato': 'Saldato',
    'Completato': 'Completato',
    'completed': 'Completato',
    'partial': 'Parziale',
    'overdue': 'Scaduto',
};

// === Order workflow status (orders.status_works) ===
const ORDER_WORKS = {
    'da_iniziare': 'Da iniziare',
    'in_lavorazione': 'In lavorazione',
    'in_revisione': 'In revisione',
    'completato': 'Completato',
    'chiuso': 'Chiuso',
    'sospeso': 'Sospeso',
};

// === Order offer status (orders.offer_status) ===
const ORDER_OFFER = {
    'in_lavorazione': 'Preventivo in lavorazione',
    'invio_programmato': 'Invio programmato',
    'inviata': 'Offerta inviata',
    'accettata': 'Offerta accettata',
    'rifiutata': 'Offerta rifiutata',
};

// === Order sales status (orders.status_sales) ===
const ORDER_SALES = {
    'lead': 'Lead',
    'qualified': 'Qualificato',
    'proposal': 'Proposta',
    'negotiation': 'Negoziazione',
    'won': 'Vinto',
    'lost': 'Perso',
};

// === Invoice status ===
const INVOICE = {
    'draft': 'Bozza',
    'issued': 'Emessa',
    'sent': 'Inviata',
    'paid': 'Saldata',
    'paid_partial': 'Saldata parzialmente',
    'overdue': 'Scaduta',
    'cancelled': 'Annullata',
};

// === Bank transaction status ===
const BANK_TX = {
    'pending': 'In sospeso',
    'recorded': 'Registrato',
    'reconciled': 'Riconciliato',
    'matched': 'Abbinato',
    'unmatched': 'Da abbinare',
};

// === Lead status ===
const LEAD = {
    'new': 'Nuovo',
    'contacted': 'Contattato',
    'qualified': 'Qualificato',
    'proposal_sent': 'Proposta inviata',
    'won': 'Convertito',
    'lost': 'Perso',
    'unqualified': 'Non qualificato',
};

// === Generic boolean-ish ===
const ACTIVE = {
    'true': 'Attivo',
    'false': 'Inattivo',
    true: 'Attivo',
    false: 'Inattivo',
};

// === Generic capitalizer fallback ===
function fallback(value) {
    if (!value && value !== false) return '-';
    const s = String(value).replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// === API ===

export function tAssignment(v) { return ASSIGNMENT[v] ?? fallback(v); }
export function tPayment(v) { return PAYMENT[v] ?? fallback(v); }
export function tOrderWorks(v) { return ORDER_WORKS[v] ?? fallback(v); }
export function tOrderOffer(v) { return ORDER_OFFER[v] ?? fallback(v); }
export function tOrderSales(v) { return ORDER_SALES[v] ?? fallback(v); }
export function tInvoice(v) { return INVOICE[v] ?? fallback(v); }
export function tBankTx(v) { return BANK_TX[v] ?? fallback(v); }
export function tLead(v) { return LEAD[v] ?? fallback(v); }
export function tActive(v) { return ACTIVE[v] ?? fallback(v); }

/**
 * Wildcard: prova prima il dizionario suggerito, poi cerca in tutti.
 * Utile quando lo status arriva senza sapere a quale entità appartiene.
 */
export function tStatus(value, preferredScope = null) {
    if (!value && value !== false) return '-';
    const scopes = preferredScope ? [preferredScope] : ['ASSIGNMENT', 'PAYMENT', 'ORDER_WORKS', 'ORDER_OFFER', 'ORDER_SALES', 'INVOICE', 'BANK_TX', 'LEAD'];
    const dicts = { ASSIGNMENT, PAYMENT, ORDER_WORKS, ORDER_OFFER, ORDER_SALES, INVOICE, BANK_TX, LEAD };
    for (const scope of scopes) {
        const d = dicts[scope];
        if (d && value in d) return d[value];
    }
    return fallback(value);
}

// Espongo su window per debugging
if (typeof window !== 'undefined') {
    window.glI18n = { tAssignment, tPayment, tOrderWorks, tOrderOffer, tOrderSales, tInvoice, tBankTx, tLead, tActive, tStatus };
}
