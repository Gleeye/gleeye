// Morning Briefing — widget homepage admin
// Riassunto AI del mattino: cosa è importante oggi.
// Self-inserting: si posiziona prima di #hp-centro-alert-block (o feedBlock se non c'è).
//
// Comportamento:
// - Al primo accesso del giorno → genera briefing AI fresco e lo mostra
// - Accessi successivi dello stesso giorno → mostra cache da localStorage
// - Bottone "Rigenera" → forza nuovo briefing
//
// Costo: 1 chiamata Gemini Flash Lite al giorno per utente ≈ 0,00005 €

import { supabase } from '/js/modules/config.js?v=8000';
import { ai } from '/js/modules/ai_client.js?v=8001';
import { state } from '/js/modules/state.js?v=8000';

const CONTAINER_ID = 'hp-morning-briefing-block';
const LS_PREFIX = 'gleeye_briefing_';

function lsKey(userId) {
    return `${LS_PREFIX}${userId || 'anon'}`;
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function timeOfDay() {
    const h = new Date().getHours();
    if (h < 12) return 'Buongiorno';
    if (h < 18) return 'Buon pomeriggio';
    return 'Buonasera';
}

// ─── Entry point ────────────────────────────────────────────────────

export async function renderMorningBriefing() {
    // Insertion point: prima del centro alert se c'è, altrimenti prima del feed
    const anchor = document.getElementById('hp-centro-alert-block')
        || document.getElementById('hp-activity-feed-block');
    if (!anchor) return;

    // Cleanup eventuale precedente
    document.getElementById(CONTAINER_ID)?.remove();

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.cssText = 'flex-shrink: 0; margin-bottom: 1.25rem;';
    anchor.parentElement.insertBefore(container, anchor);

    const userId = state.profile?.id;
    const userName = (state.profile?.full_name || '').split(' ')[0] || '';
    const cached = loadCached(userId);

    if (cached && cached.date === todayStr()) {
        renderShell(container, cached.text, userName, cached.generatedAt, /*loading=*/false);
        bindRegenerate(container);
        return;
    }

    // Prima volta oggi → genera
    renderShell(container, '', userName, null, /*loading=*/true);
    try {
        const briefing = await generateBriefing();
        const payload = { date: todayStr(), text: briefing, generatedAt: Date.now() };
        saveCached(userId, payload);
        renderShell(container, briefing, userName, payload.generatedAt, /*loading=*/false);
        bindRegenerate(container);
    } catch (err) {
        console.error('[morning_briefing]', err);
        container.remove();
    }
}

// ─── Generazione AI ─────────────────────────────────────────────────

async function generateBriefing() {
    const today = todayStr();
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().slice(0, 10);

    // Raccolgo dati paralleli
    const [
        { data: tasksToday },
        { data: tasksWeek },
        { data: invoicesOverdue },
        { data: paymentsThisWeek },
        { data: apptsToday },
    ] = await Promise.all([
        supabase.from('pm_items')
            .select('id, title, due_date, priority')
            .lte('due_date', today)
            .not('status', 'in', '("done","completed","archived")')
            .order('due_date', { ascending: true })
            .limit(10),
        supabase.from('pm_items')
            .select('id, title, due_date, priority')
            .gt('due_date', today)
            .lte('due_date', in7Str)
            .not('status', 'in', '("done","completed","archived")')
            .order('due_date', { ascending: true })
            .limit(10),
        supabase.from('invoices')
            .select('id, invoice_number, amount_tax_included, due_date, clients(business_name)')
            .lt('due_date', today)
            .neq('status', 'Saldata')
            .order('due_date', { ascending: true })
            .limit(10),
        supabase.from('payments')
            .select('id, title, amount, due_date, collaborators(full_name)')
            .gte('due_date', today)
            .lte('due_date', in7Str)
            .in('status', ['Da Fare', 'Invito Inviato', 'Fattura Ricevuta'])
            .order('due_date', { ascending: true })
            .limit(10),
        supabase.from('appointments')
            .select('id, title, starts_at, location')
            .gte('starts_at', new Date().toISOString())
            .lte('starts_at', new Date(Date.now() + 24 * 3600 * 1000).toISOString())
            .order('starts_at', { ascending: true })
            .limit(8),
    ]);

    // Costruisco contesto compatto
    const ctx = {
        today,
        weekday: new Date().toLocaleDateString('it-IT', { weekday: 'long' }),
        tasks_today_or_overdue: (tasksToday || []).map(t => ({
            title: t.title, due: t.due_date, priority: t.priority,
            overdue: t.due_date && t.due_date < today,
        })),
        tasks_week: (tasksWeek || []).map(t => ({ title: t.title, due: t.due_date, priority: t.priority })),
        invoices_overdue: (invoicesOverdue || []).map(i => ({
            number: i.invoice_number, client: i.clients?.business_name,
            amount: Number(i.amount_tax_included || 0), due: i.due_date,
        })),
        invoices_overdue_total: (invoicesOverdue || []).reduce((s, i) => s + Number(i.amount_tax_included || 0), 0),
        payments_week: (paymentsThisWeek || []).map(p => ({
            title: p.title, collab: p.collaborators?.full_name,
            amount: Number(p.amount || 0), due: p.due_date,
        })),
        appointments_24h: (apptsToday || []).map(a => ({
            title: a.title, when: a.starts_at, location: a.location,
        })),
    };

    const systemPrompt = `Sei un assistente operativo per Davide, founder di un'agenzia di comunicazione italiana.
Ogni mattina gli mandi un briefing di 4-6 frasi in italiano colloquiale che condensi:
- Cosa è urgente OGGI (task scadute, appuntamenti imminenti, fatture scadute con totale)
- 1-2 priorità della settimana
- Eventuale azione concreta consigliata ("oggi chiuderei la fattura X, ricontatterei Y")

REGOLE:
- Max 6 frasi totali.
- Italiano colloquiale, NIENTE bullet point, NIENTE numerazione, scrivi a paragrafo.
- Tonalità: schietta, pragmatica, da socio. Non motivazionale, non da app.
- Inizia con un saluto in base all'ora ("Buongiorno", "Buon pomeriggio").
- Se i dati sono pochi (giornata vuota), dillo: "giornata abbastanza libera, ne approfitterei per X".
- Non inventare dati che non sono nel contesto.
- NON elencare TUTTO, fai una SELEZIONE dei 2-3 fatti più importanti.`;

    const userMessage = `DATI DI OGGI (${ctx.today}, ${ctx.weekday}):\n\n${JSON.stringify(ctx, null, 2)}`;

    return await ai.complete(userMessage, {
        feature: 'help_inline',
        system: systemPrompt,
        temperature: 0.5,
        max_tokens: 400,
    });
}

// ─── Rendering ──────────────────────────────────────────────────────

function renderShell(container, text, userName, generatedAt, loading) {
    const dateLabel = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' });
    const greeting = `${timeOfDay()}${userName ? ' ' + userName : ''}`;
    const generatedLabel = generatedAt
        ? `Generato alle ${new Date(generatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
        : '';

    container.innerHTML = `
        <div class="glass-card" style="
            padding: 1.25rem 1.5rem;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 60%, transparent 100%);
            border: 1px solid rgba(99, 102, 241, 0.18);
            border-radius: 16px;
            position: relative;
        ">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;">
                <span class="material-icons-round" style="color: #6366f1; font-size: 1.3rem;">wb_sunny</span>
                <div style="flex: 1;">
                    <div style="font-family: var(--font-titles); font-size: 1.05rem; font-weight: 700; color: var(--text-primary); line-height: 1.2;">
                        ${escapeHtml(greeting)}
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: capitalize;">
                        ${escapeHtml(dateLabel)}${generatedLabel ? ' · ' + generatedLabel : ''}
                    </div>
                </div>
                <button id="hp-briefing-regenerate" title="Rigenera"
                    style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: #6366f1; padding: 4px 8px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600;">
                    <span class="material-icons-round" style="font-size: 0.95rem;">refresh</span>
                </button>
            </div>
            <div id="hp-briefing-content" style="
                font-size: 0.92rem;
                line-height: 1.6;
                color: var(--text-primary);
                white-space: pre-wrap;
                ${loading ? 'color: var(--text-tertiary); font-style: italic;' : ''}
            ">${loading ? `<span class="loader" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 8px;"></span>Sto preparando il briefing del mattino...` : escapeHtml(text)}</div>
            <div style="font-size: 0.62rem; color: var(--text-tertiary); margin-top: 0.6rem; opacity: 0.8;">
                Briefing AI · Gemini Flash Lite · ≈ 0,00005 €
            </div>
        </div>
    `;
}

function bindRegenerate(container) {
    const btn = container.querySelector('#hp-briefing-regenerate');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const userId = state.profile?.id;
        // Invalida cache
        clearCached(userId);
        // Re-render
        await renderMorningBriefing();
    });
}

// ─── localStorage cache ─────────────────────────────────────────────

function loadCached(userId) {
    try {
        const raw = localStorage.getItem(lsKey(userId));
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveCached(userId, payload) {
    try { localStorage.setItem(lsKey(userId), JSON.stringify(payload)); } catch {}
}

function clearCached(userId) {
    try { localStorage.removeItem(lsKey(userId)); } catch {}
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
