// Cmd+K Palette — Gleeye ERP
// Interfaccia conversational globale. Apri ovunque con Cmd+K (Mac) / Ctrl+K (Windows).
// Scrivi una frase naturale. Gemini Flash Lite interpreta e fa l'azione (apre vista, crea task, cerca, risponde).
//
// Architettura:
// - Tool calling: AI riceve definitions di N azioni che può chiamare
// - Esegue azione lato client (navigate, query, ecc.)
// - Tutto loggato in ai_usage_log via ai-proxy
// - Costo medio per call: ~0.000005€ (gratis di fatto)

import { ai } from '../modules/ai_client.js?v=8001';
import { state } from '../modules/state.js?v=8000';
import { supabase } from '../modules/config.js?v=8000';

// ─── Tool definitions ───────────────────────────────────────────────
// Ogni tool è un'azione che l'AI può chiamare in risposta alla frase utente.
// Aggiungere tool nuovi è facile: definisci qui + implementa il case in `executeAction()`.

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'navigate_to',
            description: "Naviga a una vista specifica dell'app. Usa solo quando l'utente vuole APRIRE una sezione.",
            parameters: {
                type: 'object',
                properties: {
                    target: {
                        type: 'string',
                        description: "Identificativo vista. Valori validi: 'home', 'agenda', 'tasks-summary', 'my-assignments', 'clients', 'contacts', 'collaborators', 'suppliers', 'partners', 'orders', 'assignments', 'leads', 'booking', 'invoices', 'invoices-dashboard', 'passive-invoices-collab', 'passive-invoices-partners', 'passive-invoices-suppliers', 'bank-transactions', 'bank-statements', 'payments', 'pm-commesse', 'pm-interni', 'services', 'sap-services', 'notifications', 'chat', 'profile', 'admin', 'settings'.",
                    },
                },
                required: ['target'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_entity',
            description: "Cerca un'entità (cliente, commessa, collaboratore, ecc.) per nome e mostra i primi risultati.",
            parameters: {
                type: 'object',
                properties: {
                    entity_type: {
                        type: 'string',
                        enum: ['client', 'order', 'collaborator', 'supplier', 'assignment', 'lead', 'invoice'],
                        description: 'Tipo di entità da cercare.',
                    },
                    query: { type: 'string', description: 'Testo di ricerca.' },
                },
                required: ['entity_type', 'query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'open_entity_detail',
            description: 'Apre direttamente il dettaglio di una singola entità (cliente, commessa, ecc.) se conosci il nome esatto.',
            parameters: {
                type: 'object',
                properties: {
                    entity_type: {
                        type: 'string',
                        enum: ['client', 'order', 'collaborator', 'assignment', 'lead'],
                    },
                    name_or_code: {
                        type: 'string',
                        description: "Nome azienda, codice ordine, nome collaboratore, ecc.",
                    },
                },
                required: ['entity_type', 'name_or_code'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'quick_stat',
            description: "Mostra una statistica veloce dell'azienda. Usa solo quando l'utente fa una domanda numerica.",
            parameters: {
                type: 'object',
                properties: {
                    metric: {
                        type: 'string',
                        enum: [
                            'overdue_invoices_count',
                            'overdue_invoices_total',
                            'pending_payments_count',
                            'pending_payments_total',
                            'orders_in_progress',
                            'orders_accepted_this_year',
                            'leads_count',
                            'active_assignments',
                            'monthly_revenue_current',
                            'monthly_revenue_last',
                        ],
                        description: 'Quale metrica calcolare.',
                    },
                },
                required: ['metric'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'answer_question',
            description: "Rispondi direttamente all'utente con una spiegazione testuale. Usa SOLO quando le altre tool non sono applicabili (es. l'utente fa una domanda generica, chiede aiuto, vuole una spiegazione su come funziona l'app).",
            parameters: {
                type: 'object',
                properties: {
                    answer: { type: 'string', description: 'La risposta in italiano semplice (max 3 frasi).' },
                },
                required: ['answer'],
            },
        },
    },
];

// ─── System prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sei l'assistente Cmd+K dell'app gestionale Gleeye ERP, un'agenzia di comunicazione italiana.
L'utente preme Cmd+K e scrive una frase naturale per fare qualcosa rapidamente.
Tu interpreti la frase e chiami la tool giusta per eseguire l'azione.

REGOLE:
- Rispondi sempre chiamando UNA tool (non rispondere in testo libero, usa la tool answer_question se serve).
- Se l'intent non è chiaro, chiedi chiarimento via answer_question.
- Se l'utente dice "vai a X" o "apri X" → naviga.
- Se dice "cerca X" o "trovami X" → search_entity.
- Se dice "apri [cliente/commessa specifica]" → open_entity_detail.
- Se chiede numeri (quanto, quanti, totale) → quick_stat.
- Per domande generiche su come funziona l'app → answer_question.

Lingua: italiano. Conciso. Esegui, non ti dilungare.`;

// ─── UI state ───────────────────────────────────────────────────────
let isOpen = false;
let isLoading = false;

// ─── Open / Close ───────────────────────────────────────────────────
function open() {
    if (isOpen) return;
    isOpen = true;

    const overlay = document.createElement('div');
    overlay.id = 'cmdk-overlay';
    overlay.innerHTML = `
        <style>
            #cmdk-overlay {
                position: fixed; inset: 0; z-index: 99999;
                background: rgba(15, 23, 42, 0.55);
                backdrop-filter: blur(8px);
                display: flex; align-items: flex-start; justify-content: center;
                padding-top: 15vh;
                animation: cmdkFadeIn 0.15s ease-out;
            }
            @keyframes cmdkFadeIn { from { opacity: 0; } to { opacity: 1; } }
            #cmdk-panel {
                width: 92%; max-width: 640px;
                background: white;
                border-radius: 18px;
                box-shadow: 0 30px 60px rgba(0,0,0,0.3);
                overflow: hidden;
                animation: cmdkSlideIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes cmdkSlideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            #cmdk-input-wrap {
                display: flex; align-items: center; gap: 12px;
                padding: 18px 20px;
                border-bottom: 1px solid rgba(0,0,0,0.06);
            }
            #cmdk-input-icon {
                color: #94a3b8; font-size: 22px;
            }
            #cmdk-input {
                flex: 1; border: none; outline: none;
                font-size: 1.05rem; font-family: 'Outfit', sans-serif;
                color: #1e293b; background: transparent;
            }
            #cmdk-input::placeholder { color: #94a3b8; }
            #cmdk-loader {
                width: 18px; height: 18px;
                border: 2px solid rgba(59,130,246,0.2);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: cmdkSpin 0.7s linear infinite;
                display: none;
            }
            #cmdk-loader.visible { display: block; }
            @keyframes cmdkSpin { to { transform: rotate(360deg); } }
            #cmdk-hint {
                padding: 12px 20px;
                font-size: 0.78rem;
                color: #64748b;
                background: #f8fafc;
                border-top: 1px solid rgba(0,0,0,0.04);
                display: flex; gap: 16px; align-items: center; justify-content: space-between;
            }
            #cmdk-hint .left { display: flex; gap: 14px; }
            #cmdk-hint kbd {
                background: white; border: 1px solid rgba(0,0,0,0.1);
                padding: 2px 6px; border-radius: 5px;
                font-family: 'SF Mono', monospace; font-size: 0.7rem;
                box-shadow: 0 1px 0 rgba(0,0,0,0.05);
            }
            #cmdk-feedback {
                padding: 16px 20px;
                font-size: 0.92rem;
                line-height: 1.5;
                color: #1e293b;
                background: white;
                display: none;
            }
            #cmdk-feedback.visible { display: block; }
            #cmdk-feedback .icon { color: #3b82f6; font-size: 18px; vertical-align: middle; margin-right: 6px; }
            #cmdk-feedback.error { color: #ef4444; background: #fef2f2; }
            #cmdk-suggestions {
                padding: 8px 0;
                max-height: 280px; overflow-y: auto;
            }
            .cmdk-suggestion {
                padding: 10px 20px;
                font-size: 0.85rem; color: #475569;
                cursor: pointer; transition: background 0.1s;
                display: flex; align-items: center; gap: 10px;
            }
            .cmdk-suggestion:hover { background: #f1f5f9; color: #1e293b; }
            .cmdk-suggestion .material-icons-round { font-size: 18px; color: #94a3b8; }
        </style>
        <div id="cmdk-panel">
            <div id="cmdk-input-wrap">
                <span id="cmdk-input-icon" class="material-icons-round">auto_awesome</span>
                <input id="cmdk-input" type="text" placeholder="Chiedi qualcosa o cerca... (es. apri clienti, crea task, fatturato del mese)" autocomplete="off" />
                <div id="cmdk-loader"></div>
            </div>
            <div id="cmdk-feedback"></div>
            <div id="cmdk-suggestions">
                <div class="cmdk-suggestion" data-prefill="apri clienti">
                    <span class="material-icons-round">arrow_outward</span>
                    <span>Apri clienti</span>
                </div>
                <div class="cmdk-suggestion" data-prefill="apri agenda">
                    <span class="material-icons-round">arrow_outward</span>
                    <span>Apri agenda</span>
                </div>
                <div class="cmdk-suggestion" data-prefill="quanti pagamenti in ritardo ho?">
                    <span class="material-icons-round">query_stats</span>
                    <span>Quanti pagamenti in ritardo ho?</span>
                </div>
                <div class="cmdk-suggestion" data-prefill="trovami il cliente Confindustria">
                    <span class="material-icons-round">search</span>
                    <span>Trovami il cliente Confindustria</span>
                </div>
                <div class="cmdk-suggestion" data-prefill="fatturato di questo mese">
                    <span class="material-icons-round">euro</span>
                    <span>Fatturato di questo mese</span>
                </div>
            </div>
            <div id="cmdk-hint">
                <div class="left">
                    <span><kbd>↵</kbd> esegui</span>
                    <span><kbd>esc</kbd> chiudi</span>
                </div>
                <span style="opacity: 0.7;">Powered by Gemini Flash 2.5</span>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('cmdk-input');
    setTimeout(() => input?.focus(), 50);

    // Click outside closes
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Suggestion click prefills
    overlay.querySelectorAll('.cmdk-suggestion').forEach((el) => {
        el.addEventListener('click', () => {
            input.value = el.dataset.prefill;
            input.focus();
            handleSubmit(input.value);
        });
    });

    // Enter to submit
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim() && !isLoading) {
            e.preventDefault();
            handleSubmit(input.value.trim());
        }
    });
}

function close() {
    if (!isOpen) return;
    isOpen = false;
    isLoading = false;
    const overlay = document.getElementById('cmdk-overlay');
    if (overlay) overlay.remove();
}

function setLoading(value) {
    isLoading = value;
    const loader = document.getElementById('cmdk-loader');
    const input = document.getElementById('cmdk-input');
    if (loader) loader.classList.toggle('visible', value);
    if (input) input.disabled = value;
}

function showFeedback(html, isError = false) {
    const feedback = document.getElementById('cmdk-feedback');
    const suggestions = document.getElementById('cmdk-suggestions');
    if (!feedback) return;
    feedback.innerHTML = html;
    feedback.classList.add('visible');
    if (isError) feedback.classList.add('error');
    else feedback.classList.remove('error');
    if (suggestions) suggestions.style.display = 'none';
}

// ─── Submit handler ─────────────────────────────────────────────────
async function handleSubmit(userText) {
    setLoading(true);

    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userText },
        ];

        const resp = await ai.chat({
            feature: 'cmd_k',
            messages,
            tools: TOOLS,
            tool_choice: 'auto',
            temperature: 0.2,
            feature_context: { user_input: userText },
        });

        const toolCalls = ai.extractToolCalls(resp);
        if (toolCalls.length === 0) {
            // Niente tool call → mostra testo come fallback
            const text = ai.extractText(resp) || 'Non ho capito, riprova con altre parole.';
            showFeedback(`<span class="material-icons-round icon">info</span>${text}`);
            setLoading(false);
            return;
        }

        // Eseguo la prima tool call (MVP — gestione singola action per ora)
        const call = toolCalls[0];
        let args = {};
        try {
            args = JSON.parse(call.function.arguments || '{}');
        } catch (_) {
            args = {};
        }
        await executeAction(call.function.name, args);
    } catch (err) {
        console.error('[cmdk] error', err);
        showFeedback(`<span class="material-icons-round icon">error_outline</span>Errore: ${err.message || err}`, true);
        setLoading(false);
    }
}

// ─── Action execution ───────────────────────────────────────────────
async function executeAction(name, args) {
    switch (name) {
        case 'navigate_to': {
            const map = {
                'home': 'home',
                'agenda': 'agenda',
                'tasks-summary': 'tasks-summary',
                'my-assignments': 'my-assignments',
                'clients': 'sales',
                'sales': 'sales',
                'contacts': 'contacts',
                'collaborators': 'employees',
                'employees': 'employees',
                'suppliers': 'suppliers',
                'partners': 'white-label-partners',
                'orders': 'dashboard',
                'assignments': 'assignments',
                'leads': 'leads',
                'booking': 'booking',
                'invoices': 'invoices',
                'invoices-dashboard': 'invoices-dashboard',
                'passive-invoices-collab': 'passive-invoices-collab',
                'passive-invoices-partners': 'passive-invoices-partners',
                'passive-invoices-suppliers': 'passive-invoices-suppliers',
                'bank-transactions': 'bank-transactions',
                'bank-statements': 'bank-statements',
                'payments': 'payments',
                'pm-commesse': 'pm/commesse',
                'pm-interni': 'pm/interni',
                'services': 'services',
                'sap-services': 'sap-services',
                'notifications': 'notifications',
                'chat': 'chat',
                'profile': 'profile',
                'admin': 'admin',
                'settings': 'settings',
            };
            const route = map[args.target] || args.target;
            window.location.hash = route;
            close();
            return;
        }
        case 'search_entity': {
            const results = await searchEntity(args.entity_type, args.query);
            if (results.length === 0) {
                showFeedback(`<span class="material-icons-round icon">search_off</span>Nessun risultato per "${args.query}".`);
                setLoading(false);
                return;
            }
            const html = results.map(r => `
                <div class="cmdk-result" style="padding:10px 16px; cursor:pointer; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:10px;" onclick="window.location.hash='${r.hash}'; document.getElementById('cmdk-overlay')?.remove();">
                    <span class="material-icons-round" style="font-size:18px; color:#3b82f6;">${r.icon}</span>
                    <div style="flex:1;">
                        <div style="font-weight:600; color:#1e293b;">${r.title}</div>
                        ${r.subtitle ? `<div style="font-size:0.78rem; color:#64748b;">${r.subtitle}</div>` : ''}
                    </div>
                    <span class="material-icons-round" style="font-size:16px; color:#94a3b8;">chevron_right</span>
                </div>
            `).join('');
            showFeedback(`<div style="margin:-16px -20px;">${html}</div>`);
            setLoading(false);
            return;
        }
        case 'open_entity_detail': {
            const results = await searchEntity(args.entity_type, args.name_or_code);
            if (results.length === 0) {
                showFeedback(`<span class="material-icons-round icon">search_off</span>Non ho trovato "${args.name_or_code}".`);
                setLoading(false);
                return;
            }
            // Apre il primo risultato (assume match esatto)
            window.location.hash = results[0].hash;
            close();
            return;
        }
        case 'quick_stat': {
            const value = await computeStat(args.metric);
            showFeedback(`<span class="material-icons-round icon">query_stats</span>${value}`);
            setLoading(false);
            return;
        }
        case 'answer_question': {
            showFeedback(`<span class="material-icons-round icon">auto_awesome</span>${args.answer}`);
            setLoading(false);
            return;
        }
        default:
            showFeedback(`<span class="material-icons-round icon">help_outline</span>Azione non riconosciuta: ${name}`, true);
            setLoading(false);
    }
}

// ─── Search helpers ─────────────────────────────────────────────────
async function searchEntity(type, query) {
    const q = query.toLowerCase();
    switch (type) {
        case 'client': {
            const { data } = await supabase.from('clients')
                .select('id, business_name, client_code, city')
                .or(`business_name.ilike.%${query}%,client_code.ilike.%${query}%`)
                .limit(5);
            return (data || []).map(c => ({
                title: c.business_name,
                subtitle: [c.client_code, c.city].filter(Boolean).join(' · '),
                icon: 'business',
                hash: `client-detail/${c.id}`,
            }));
        }
        case 'order': {
            const { data } = await supabase.from('orders')
                .select('id, order_number, title, clients(business_name)')
                .or(`order_number.ilike.%${query}%,title.ilike.%${query}%`)
                .limit(5);
            return (data || []).map(o => ({
                title: `${o.order_number} — ${o.title || 'Senza titolo'}`,
                subtitle: o.clients?.business_name || '',
                icon: 'shopping_cart',
                hash: `order-detail/${o.id}`,
            }));
        }
        case 'collaborator': {
            const { data } = await supabase.from('collaborators')
                .select('id, full_name, role, type')
                .or(`full_name.ilike.%${query}%`)
                .eq('type', 'individual')
                .limit(5);
            return (data || []).map(c => ({
                title: c.full_name,
                subtitle: c.role || 'Collaboratore',
                icon: 'person',
                hash: `collaborator-detail/${c.id}`,
            }));
        }
        case 'supplier': {
            const { data } = await supabase.from('suppliers')
                .select('id, name')
                .ilike('name', `%${query}%`)
                .limit(5);
            return (data || []).map(s => ({
                title: s.name,
                subtitle: 'Fornitore',
                icon: 'local_shipping',
                hash: `suppliers`,
            }));
        }
        case 'assignment': {
            const { data } = await supabase.from('assignments')
                .select('id, description, collaborators(full_name)')
                .ilike('description', `%${query}%`)
                .limit(5);
            return (data || []).map(a => ({
                title: a.description?.slice(0, 60) || 'Incarico',
                subtitle: a.collaborators?.full_name || '',
                icon: 'assignment_ind',
                hash: `assignment-detail/${a.id}`,
            }));
        }
        case 'lead': {
            const { data } = await supabase.from('leads')
                .select('id, company_name, lead_code')
                .or(`company_name.ilike.%${query}%,lead_code.ilike.%${query}%`)
                .limit(5);
            return (data || []).map(l => ({
                title: l.company_name || l.lead_code,
                subtitle: l.lead_code,
                icon: 'contact_mail',
                hash: `lead-detail/${l.id}`,
            }));
        }
        case 'invoice': {
            const { data } = await supabase.from('invoices')
                .select('id, invoice_number, amount_tax_included')
                .ilike('invoice_number', `%${query}%`)
                .limit(5);
            return (data || []).map(i => ({
                title: `Fattura ${i.invoice_number}`,
                subtitle: `€ ${i.amount_tax_included}`,
                icon: 'receipt_long',
                hash: `invoices`,
            }));
        }
        default:
            return [];
    }
}

// ─── Stat helpers ──────────────────────────────────────────────────
async function computeStat(metric) {
    switch (metric) {
        case 'overdue_invoices_count': {
            const { count } = await supabase.from('invoices')
                .select('id', { count: 'exact', head: true })
                .neq('status', 'Pagato').neq('status', 'Pagata')
                .lt('due_date', new Date().toISOString().slice(0, 10));
            return `<strong>${count ?? 0}</strong> fatture in ritardo da incassare.`;
        }
        case 'overdue_invoices_total': {
            const { data } = await supabase.from('invoices')
                .select('amount_tax_included')
                .neq('status', 'Pagato').neq('status', 'Pagata')
                .lt('due_date', new Date().toISOString().slice(0, 10));
            const total = (data || []).reduce((s, i) => s + (parseFloat(i.amount_tax_included) || 0), 0);
            return `<strong>€ ${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong> da incassare su fatture in ritardo.`;
        }
        case 'pending_payments_count': {
            const { count } = await supabase.from('payments')
                .select('id', { count: 'exact', head: true })
                .in('status', ['Da Fare', 'Invito Inviato', 'Fattura Ricevuta']);
            return `<strong>${count ?? 0}</strong> pagamenti pendenti.`;
        }
        case 'pending_payments_total': {
            const { data } = await supabase.from('payments').select('amount')
                .in('status', ['Da Fare', 'Invito Inviato', 'Fattura Ricevuta']);
            const total = (data || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            return `<strong>€ ${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong> di pagamenti pendenti.`;
        }
        case 'orders_in_progress': {
            const { count } = await supabase.from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('offer_status', 'accettata').neq('status_works', 'completato');
            return `<strong>${count ?? 0}</strong> commesse in corso.`;
        }
        case 'orders_accepted_this_year': {
            const year = new Date().getFullYear();
            const { count } = await supabase.from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('offer_status', 'accettata')
                .gte('order_date', `${year}-01-01`);
            return `<strong>${count ?? 0}</strong> commesse accettate nel ${year}.`;
        }
        case 'leads_count': {
            const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true });
            return `<strong>${count ?? 0}</strong> lead totali.`;
        }
        case 'active_assignments': {
            const { count } = await supabase.from('assignments')
                .select('id', { count: 'exact', head: true })
                .in('status', ['Da Fare', 'In Corso']);
            return `<strong>${count ?? 0}</strong> incarichi attivi.`;
        }
        case 'monthly_revenue_current': {
            const now = new Date();
            const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const { data } = await supabase.from('invoices').select('amount_tax_included')
                .gte('issue_date', monthStart);
            const total = (data || []).reduce((s, i) => s + (parseFloat(i.amount_tax_included) || 0), 0);
            return `<strong>€ ${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong> fatturati questo mese.`;
        }
        case 'monthly_revenue_last': {
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const monthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
            const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const { data } = await supabase.from('invoices').select('amount_tax_included')
                .gte('issue_date', monthStart).lt('issue_date', monthEnd);
            const total = (data || []).reduce((s, i) => s + (parseFloat(i.amount_tax_included) || 0), 0);
            return `<strong>€ ${total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong> fatturati il mese scorso.`;
        }
        default:
            return `Metrica "${metric}" non implementata ancora.`;
    }
}

// ─── Keyboard binding global ────────────────────────────────────────
function bindGlobalShortcut() {
    document.addEventListener('keydown', (e) => {
        const isMod = e.metaKey || e.ctrlKey;
        if (isMod && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            if (isOpen) close();
            else open();
        } else if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            close();
        }
    });
}

bindGlobalShortcut();

// Espongo per debug + invocazione programmatica
if (typeof window !== 'undefined') {
    window.cmdK = { open, close };
}
