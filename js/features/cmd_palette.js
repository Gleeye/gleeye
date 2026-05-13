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
            name: 'recap_today',
            description: "Mostra un riassunto della giornata: task urgenti/scadute/oggi, pagamenti collab in arrivo, fatture cliente scadute. Usa quando l'utente chiede 'cosa devo fare oggi', 'situazione', 'urgenze', 'recap'.",
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'overdue_overview',
            description: "Mostra tutto ciò che è scaduto in un colpo solo: fatture clienti, pagamenti collab, task. Usa quando l'utente chiede 'cosa è scaduto', 'arretrati'.",
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'client_summary',
            description: "Riepilogo finanziario+operativo di un cliente: ricavi totali, fatture aperte/scadute, commesse attive, ultime attività. Usa quando l'utente chiede 'come sta cliente X', 'riepilogo X', 'situazione X'.",
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Nome o parte del nome del cliente.' },
                },
                required: ['name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_task',
            description: "Crea una task PM nuova. Usa quando l'utente dice 'crea task X', 'aggiungi task per Y', 'devo ricordarmi di X'. Estrai titolo, scadenza (se menzionata), priorità, e space/commessa se nominata.",
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Titolo conciso della task (es. "Chiamare Mario Rossi").' },
                    due_date: { type: 'string', description: "Data scadenza in formato YYYY-MM-DD. Se l'utente dice 'domani' calcola la data effettiva. Lascia vuoto se non specificata." },
                    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priorità inferita dal tono. Default: medium.' },
                    space_hint: { type: 'string', description: "Nome commessa/cliente/area se menzionata (es. 'commessa Acme', 'cluster comunicazione'). Lascia vuoto se non specificato." },
                },
                required: ['title'],
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
- Se chiede "cosa devo fare", "urgenze", "situazione di oggi", "recap" → recap_today.
- Se chiede "cosa è scaduto", "arretrati", "fatture/pagamenti scaduti tutti" → overdue_overview.
- Se chiede "come sta cliente X", "riepilogo X", "situazione X" → client_summary.
- Se dice "crea task", "aggiungi task", "ricordami di", "devo fare X domani" → create_task.
  Per "domani" calcola la data: oggi è ${new Date().toISOString().slice(0,10)} quindi domani è ${new Date(Date.now()+86400000).toISOString().slice(0,10)}.
  Per "prossima settimana" usa lunedì prossimo.
  Per "venerdì" usa il prossimo venerdì.
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
        case 'recap_today': {
            const html = await renderRecapToday();
            showFeedback(html);
            setLoading(false);
            return;
        }
        case 'overdue_overview': {
            const html = await renderOverdueOverview();
            showFeedback(html);
            setLoading(false);
            return;
        }
        case 'client_summary': {
            const html = await renderClientSummary(args.name);
            showFeedback(html);
            setLoading(false);
            return;
        }
        case 'create_task': {
            const result = await createTaskFromCmdK(args);
            showFeedback(result.html);
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

// ─── Rich rendering helpers (recap / overdue / client_summary) ──────

function fmtEur(n) {
    return '€ ' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateIT(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function sectionHeader(icon, title, color = '#6366f1') {
    return `<div style="display:flex; align-items:center; gap:8px; padding:10px 16px 6px; font-size:0.7rem; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:0.06em;">
        <span class="material-icons-round" style="font-size:14px;">${icon}</span>${title}
    </div>`;
}
function row(html) {
    return `<div style="padding:8px 16px; border-bottom:1px solid #f1f5f9; font-size:0.85rem; display:flex; justify-content:space-between; gap:12px; align-items:center;">${html}</div>`;
}
function emptyHint(text) {
    return `<div style="padding:10px 16px; font-size:0.78rem; color:#94a3b8; font-style:italic;">${text}</div>`;
}
function wrapRich(content) {
    return `<div style="margin:-16px -20px; max-height:380px; overflow-y:auto;">${content}</div>`;
}

async function renderRecapToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

    // Task scadute + oggi (top 5)
    const { data: tasks } = await supabase
        .from('pm_items')
        .select('id, title, due_date, priority')
        .lte('due_date', in7.toISOString().slice(0, 10))
        .not('status', 'in', '("done","archived","completed")')
        .order('due_date', { ascending: true })
        .limit(8);

    // Pagamenti collab in arrivo (settimana)
    const { data: payments } = await supabase
        .from('payments')
        .select('id, title, amount, due_date, status, collaborators(full_name)')
        .lte('due_date', in7.toISOString().slice(0, 10))
        .gte('due_date', todayStr)
        .in('status', ['Da Fare', 'Invito Inviato', 'Fattura Ricevuta'])
        .order('due_date', { ascending: true })
        .limit(8);

    // Fatture clienti scadute (top 5)
    const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount_tax_included, due_date, clients(business_name)')
        .lt('due_date', todayStr)
        .neq('status', 'Saldata')
        .order('due_date', { ascending: true })
        .limit(8);

    let content = '';

    content += sectionHeader('today', `Task entro 7 giorni (${tasks?.length || 0})`, '#3b82f6');
    if (tasks?.length) {
        content += tasks.map(t => {
            const overdue = t.due_date < todayStr;
            const prio = t.priority === 'urgent' || t.priority === 'high' ? '🔴' : '';
            return row(`
                <div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${prio} <span style="color:#1e293b;">${escapeHtml(t.title || 'Senza titolo')}</span>
                </div>
                <div style="color:${overdue ? '#ef4444' : '#64748b'}; font-size:0.75rem; font-weight:600; flex-shrink:0;">${fmtDateIT(t.due_date)}</div>
            `);
        }).join('');
    } else content += emptyHint('Nessuna task in scadenza nei prossimi 7 giorni.');

    content += sectionHeader('payments', `Pagamenti settimana (${payments?.length || 0})`, '#8b5cf6');
    if (payments?.length) {
        content += payments.map(p => row(`
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.title || 'Pagamento')}</div>
                <div style="font-size:0.7rem; color:#94a3b8;">${escapeHtml(p.collaborators?.full_name || '')} · ${fmtDateIT(p.due_date)}</div>
            </div>
            <div style="font-weight:700; color:#8b5cf6;">${fmtEur(p.amount)}</div>
        `)).join('');
    } else content += emptyHint('Nessun pagamento collaboratori in scadenza.');

    content += sectionHeader('warning', `Fatture clienti scadute (${invoices?.length || 0})`, '#ef4444');
    if (invoices?.length) {
        const totOverdue = invoices.reduce((s, i) => s + (Number(i.amount_tax_included) || 0), 0);
        content += invoices.map(i => row(`
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; color:#1e293b;">${escapeHtml(i.invoice_number || '')} · ${escapeHtml(i.clients?.business_name || '')}</div>
                <div style="font-size:0.7rem; color:#ef4444;">scaduta il ${fmtDateIT(i.due_date)}</div>
            </div>
            <div style="font-weight:700; color:#ef4444;">${fmtEur(i.amount_tax_included)}</div>
        `)).join('');
        content += `<div style="padding:8px 16px; font-size:0.8rem; font-weight:700; color:#ef4444; background:rgba(239,68,68,0.05);">Totale scaduto: ${fmtEur(totOverdue)}</div>`;
    } else content += emptyHint('Tutte le fatture sono in pari. 👍');

    return wrapRich(content);
}

async function renderOverdueOverview() {
    const today = new Date().toISOString().slice(0, 10);

    const [invRes, payRes, taskRes] = await Promise.all([
        supabase.from('invoices')
            .select('id, invoice_number, amount_tax_included, due_date, clients(business_name)')
            .lt('due_date', today).neq('status', 'Saldata')
            .order('due_date', { ascending: true }).limit(10),
        supabase.from('payments')
            .select('id, title, amount, due_date, status, collaborators(full_name)')
            .lt('due_date', today)
            .in('status', ['Da Fare', 'Invito Inviato', 'Fattura Ricevuta'])
            .order('due_date', { ascending: true }).limit(10),
        supabase.from('pm_items')
            .select('id, title, due_date, priority')
            .lt('due_date', today)
            .not('status', 'in', '("done","archived","completed")')
            .order('due_date', { ascending: true }).limit(10),
    ]);

    const invoices = invRes.data || [];
    const payments = payRes.data || [];
    const tasks = taskRes.data || [];

    let content = '';

    content += sectionHeader('receipt_long', `Fatture clienti (${invoices.length})`, '#ef4444');
    if (invoices.length) {
        const tot = invoices.reduce((s, i) => s + (Number(i.amount_tax_included) || 0), 0);
        content += invoices.map(i => row(`
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600;">${escapeHtml(i.invoice_number || '')} · ${escapeHtml(i.clients?.business_name || '')}</div>
                <div style="font-size:0.7rem; color:#ef4444;">${fmtDateIT(i.due_date)}</div>
            </div>
            <div style="font-weight:700; color:#ef4444;">${fmtEur(i.amount_tax_included)}</div>
        `)).join('');
        content += `<div style="padding:6px 16px; font-size:0.75rem; color:#ef4444; font-weight:700; background:rgba(239,68,68,0.04);">Totale: ${fmtEur(tot)}</div>`;
    } else content += emptyHint('Niente fatture scadute.');

    content += sectionHeader('payments', `Pagamenti collab in ritardo (${payments.length})`, '#f59e0b');
    if (payments.length) {
        const tot = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        content += payments.map(p => row(`
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600;">${escapeHtml(p.title || 'Pagamento')}</div>
                <div style="font-size:0.7rem; color:#f59e0b;">${escapeHtml(p.collaborators?.full_name || '')} · ${fmtDateIT(p.due_date)}</div>
            </div>
            <div style="font-weight:700; color:#f59e0b;">${fmtEur(p.amount)}</div>
        `)).join('');
        content += `<div style="padding:6px 16px; font-size:0.75rem; color:#f59e0b; font-weight:700; background:rgba(245,158,11,0.04);">Totale: ${fmtEur(tot)}</div>`;
    } else content += emptyHint('Nessun pagamento collab in ritardo.');

    content += sectionHeader('assignment_late', `Task scadute (${tasks.length})`, '#3b82f6');
    if (tasks.length) {
        content += tasks.map(t => row(`
            <div style="flex:1; min-width:0;">${escapeHtml(t.title || 'Senza titolo')}</div>
            <div style="font-size:0.75rem; color:#3b82f6;">${fmtDateIT(t.due_date)}</div>
        `)).join('');
    } else content += emptyHint('Tutte le task in pari. 👍');

    return wrapRich(content);
}

async function renderClientSummary(query) {
    // Find client
    const { data: clients } = await supabase.from('clients')
        .select('id, business_name, client_code, city, email, phone')
        .or(`business_name.ilike.%${query}%,client_code.ilike.%${query}%`)
        .limit(5);

    if (!clients || clients.length === 0) {
        return `<div style="padding:16px;"><span class="material-icons-round icon">search_off</span> Nessun cliente trovato per "${escapeHtml(query)}".</div>`;
    }

    if (clients.length > 1) {
        const html = clients.map(c => `
            <div style="padding:10px 16px; cursor:pointer; border-bottom:1px solid #f1f5f9; display:flex; gap:10px; align-items:center;" onclick="window.cmdK?._summary?.('${c.id}')">
                <span class="material-icons-round" style="font-size:18px; color:#3b82f6;">business</span>
                <div style="flex:1;"><div style="font-weight:600;">${escapeHtml(c.business_name)}</div>
                <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(c.city || '')} · ${escapeHtml(c.client_code || '')}</div></div>
            </div>
        `).join('');
        return wrapRich(sectionHeader('contacts', `${clients.length} clienti match`, '#3b82f6') + html);
    }

    const c = clients[0];
    return await renderClientSummaryById(c);
}

async function renderClientSummaryById(c) {
    const today = new Date().toISOString().slice(0, 10);

    const [ordRes, invRes, payRes] = await Promise.all([
        supabase.from('orders')
            .select('id, order_number, short_name, total_price, offer_status, status_works, created_at')
            .eq('client_id', c.id)
            .order('created_at', { ascending: false }).limit(50),
        supabase.from('invoices')
            .select('id, invoice_number, amount_tax_included, status, issue_date, due_date')
            .eq('client_id', c.id)
            .order('issue_date', { ascending: false }).limit(50),
        supabase.from('app_activity_log')
            .select('id, action_type, created_at')
            .or(`metadata->>client_id.eq.${c.id}`)
            .order('created_at', { ascending: false }).limit(5),
    ]);

    const orders = ordRes.data || [];
    const invoices = invRes.data || [];

    const revenueTotal = invoices.reduce((s, i) => s + (Number(i.amount_tax_included) || 0), 0);
    const openInvoices = invoices.filter(i => i.status !== 'Saldata');
    const openInvoicesTotal = openInvoices.reduce((s, i) => s + (Number(i.amount_tax_included) || 0), 0);
    const overdueInvoices = openInvoices.filter(i => i.due_date && i.due_date < today);
    const activeOrders = orders.filter(o => {
        const off = (o.offer_status || '').toLowerCase();
        const works = (o.status_works || '').toLowerCase();
        return ['in_lavorazione', 'invio_programmato', 'inviata'].includes(off)
            || (off === 'accettata' && !['completato', 'chiuso'].includes(works));
    });

    let content = '';

    content += `<div style="padding:12px 16px; background:linear-gradient(135deg, rgba(59,130,246,0.06), transparent); border-bottom:1px solid #e2e8f0;">
        <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons-round" style="color:#3b82f6; font-size:22px;">business</span>
            <div style="flex:1;">
                <div style="font-weight:700; color:#1e293b; font-size:1rem;">${escapeHtml(c.business_name)}</div>
                <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(c.client_code || '')} · ${escapeHtml(c.city || '-')}</div>
            </div>
            <button onclick="window.location.hash='client-detail/${c.id}'; document.getElementById('cmdk-overlay')?.remove();" style="padding:4px 10px; border-radius:6px; background:#3b82f6; color:white; border:none; font-size:0.7rem; font-weight:600; cursor:pointer;">apri</button>
        </div>
    </div>`;

    content += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:1px; background:#e2e8f0; padding:0;">
        <div style="background:white; padding:10px 16px;">
            <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; font-weight:700;">Fatturato totale</div>
            <div style="font-weight:700; color:#10b981; font-size:1rem;">${fmtEur(revenueTotal)}</div>
        </div>
        <div style="background:white; padding:10px 16px;">
            <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; font-weight:700;">Fatture aperte</div>
            <div style="font-weight:700; color:${openInvoices.length ? '#f59e0b' : '#94a3b8'}; font-size:1rem;">${openInvoices.length} · ${fmtEur(openInvoicesTotal)}</div>
        </div>
        <div style="background:white; padding:10px 16px;">
            <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; font-weight:700;">Commesse attive</div>
            <div style="font-weight:700; color:#3b82f6; font-size:1rem;">${activeOrders.length}</div>
        </div>
        <div style="background:white; padding:10px 16px;">
            <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; font-weight:700;">Fatture scadute</div>
            <div style="font-weight:700; color:${overdueInvoices.length ? '#ef4444' : '#10b981'}; font-size:1rem;">${overdueInvoices.length}</div>
        </div>
    </div>`;

    if (activeOrders.length) {
        content += sectionHeader('work', `Commesse attive (${activeOrders.length})`, '#3b82f6');
        content += activeOrders.slice(0, 5).map(o => row(`
            <div style="flex:1; min-width:0; overflow:hidden;">
                <div style="font-weight:600; color:#1e293b;">${escapeHtml(o.order_number || '')} · ${escapeHtml(o.short_name || 'Senza nome')}</div>
                <div style="font-size:0.7rem; color:#64748b;">${escapeHtml(o.offer_status || '')} · ${escapeHtml(o.status_works || '')}</div>
            </div>
            <div style="font-weight:700; color:#1e293b;">${fmtEur(o.total_price)}</div>
        `)).join('');
    }

    if (overdueInvoices.length) {
        content += sectionHeader('warning', `Fatture scadute (${overdueInvoices.length})`, '#ef4444');
        content += overdueInvoices.slice(0, 5).map(i => row(`
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600;">${escapeHtml(i.invoice_number || '')}</div>
                <div style="font-size:0.7rem; color:#ef4444;">${fmtDateIT(i.due_date)}</div>
            </div>
            <div style="font-weight:700; color:#ef4444;">${fmtEur(i.amount_tax_included)}</div>
        `)).join('');
    }

    return wrapRich(content);
}

// Helper esposto per il drill-down quando ci sono più match
if (typeof window !== 'undefined') {
    window.cmdK = window.cmdK || {};
    window.cmdK._summary = async (id) => {
        const { data } = await supabase.from('clients').select('id, business_name, client_code, city, email, phone').eq('id', id).maybeSingle();
        if (!data) return;
        setLoading(true);
        const html = await renderClientSummaryById(data);
        showFeedback(html);
        setLoading(false);
    };
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── Create task action ─────────────────────────────────────────────

async function createTaskFromCmdK(args) {
    const { title, due_date, priority, space_hint } = args;
    if (!title || !title.trim()) {
        return { html: `<span class="material-icons-round icon">error</span>Mi serve almeno un titolo per la task.` };
    }

    // Match space (commessa/cluster/area) se hint fornito
    let spaceId = null;
    let spaceName = null;
    if (space_hint && space_hint.trim()) {
        const q = space_hint.trim();
        // 1) Cerca per ordine (commessa) via order_number o titolo
        const { data: orders } = await supabase.from('orders')
            .select('id, order_number, title, short_name')
            .or(`order_number.ilike.%${q}%,title.ilike.%${q}%,short_name.ilike.%${q}%`)
            .limit(1);
        if (orders?.[0]) {
            const order = orders[0];
            const { data: sp } = await supabase.from('pm_spaces').select('id, name').eq('ref_ordine', order.id).limit(1).maybeSingle();
            if (sp) { spaceId = sp.id; spaceName = sp.name || order.short_name || order.title; }
        }
        // 2) Cerca per nome space direttamente (cluster / interno / area)
        if (!spaceId) {
            const { data: sp } = await supabase.from('pm_spaces')
                .select('id, name')
                .ilike('name', `%${q}%`)
                .limit(1)
                .maybeSingle();
            if (sp) { spaceId = sp.id; spaceName = sp.name; }
        }
    }

    // Recupero user corrente per pm_user_ref / created_by
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Insert task
    const payload = {
        title: title.trim(),
        status: 'todo',
        item_type: 'task',
        priority: (priority || 'medium').toLowerCase(),
        due_date: due_date || null,
        space_id: spaceId,
        pm_user_ref: userId,
        created_by_user_ref: userId,
    };

    const { data: created, error } = await supabase
        .from('pm_items')
        .insert(payload)
        .select('id, title, due_date, priority')
        .single();

    if (error) {
        console.error('[cmd-k create_task]', error);
        return { html: `<span class="material-icons-round icon">error</span>Errore creazione task: ${escapeHtml(error.message)}` };
    }

    // Auto-assign me come assignee
    try {
        await supabase.from('pm_item_assignees').insert({
            pm_item_id: created.id,
            user_ref: userId,
            role: 'assignee',
        });
    } catch (e) {
        console.warn('[cmd-k assign self]', e);
    }

    const dueLabel = created.due_date
        ? new Date(created.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'senza data';
    const prioLabel = { low: 'bassa', medium: 'media', high: 'alta', urgent: 'urgente' }[created.priority] || created.priority;
    const spaceLabel = spaceName ? ` · ${escapeHtml(spaceName)}` : space_hint ? ` · <span style="color:#f59e0b;">commessa "${escapeHtml(space_hint)}" non trovata</span>` : '';

    return {
        html: `
            <div style="padding: 4px 0;">
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                    <span class="material-icons-round" style="color:#10b981;">check_circle</span>
                    <strong style="color:#10b981;">Task creata</strong>
                </div>
                <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.3rem;">${escapeHtml(created.title)}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                    Scadenza: ${dueLabel} · Priorità: ${prioLabel}${spaceLabel}
                </div>
                <button onclick="window.location.hash='pm/task/${created.id}'; document.getElementById('cmdk-overlay')?.remove();" style="margin-top: 0.6rem; padding: 4px 10px; border-radius: 6px; background: #3b82f6; color: white; border: none; font-size: 0.75rem; font-weight: 600; cursor: pointer;">apri</button>
            </div>
        `
    };
}
