// Help Inline AI — Gleeye ERP
// Pattern riutilizzabile per "spiegami questo" contestuale.
// Differenza vs help_tooltip (statico, glossario fisso):
//   - help_tooltip: spiegazioni FISSE su concetti oggettivi (P.IVA, regime, ecc.)
//   - help_inline_ai: spiegazioni DINAMICHE su contesto specifico (perché questa
//     commessa è in ritardo, cosa devo fare di preciso in questo incarico, ecc.)
//
// Costo per chiamata: ~0.00005 € (Gemini Flash Lite). Logged in ai_usage_log.
//
// Uso:
//   import { attachInlineHelp } from './modules/help_inline_ai.js?v=8001';
//   const triggerHTML = inlineHelpButton({
//       label: 'Cosa devo fare?',
//       context: { type: 'assignment', data: assignmentObject },
//       feature: 'help_inline',
//   });
//   container.insertAdjacentHTML('beforeend', triggerHTML);
//   attachInlineHelp(container); // bind handlers su tutti i .gl-help-ai-btn

import { ai } from './ai_client.js?v=8001';

// ─── CSS ────────────────────────────────────────────────────────────

const STYLE_ID = 'gl-help-ai-style';

function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .gl-help-ai-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.08));
            color: #6366f1;
            font-size: 0.72rem;
            font-weight: 600;
            border: 1px solid rgba(99, 102, 241, 0.2);
            cursor: pointer;
            transition: all 0.15s;
            font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .gl-help-ai-btn:hover {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.14));
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
        }
        .gl-help-ai-btn .icon {
            font-size: 0.85rem;
        }
        .gl-help-ai-btn[disabled] {
            opacity: 0.6;
            cursor: wait;
            transform: none;
        }
        .gl-help-ai-panel {
            position: fixed;
            z-index: 99999;
            max-width: min(420px, calc(100vw - 32px));
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
            border: 1px solid rgba(99, 102, 241, 0.2);
            opacity: 0;
            transform: translateY(4px);
            transition: opacity 0.15s, transform 0.15s;
            font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .gl-help-ai-panel.visible {
            opacity: 1;
            transform: translateY(0);
        }
        .gl-help-ai-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid #f1f5f9;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), transparent);
            border-radius: 12px 12px 0 0;
        }
        .gl-help-ai-panel-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            color: #6366f1;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .gl-help-ai-panel-close {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px;
            color: #94a3b8;
            display: flex;
        }
        .gl-help-ai-panel-body {
            padding: 14px 16px;
            font-size: 0.88rem;
            line-height: 1.55;
            color: #1e293b;
            max-height: 60vh;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .gl-help-ai-panel-body.loading {
            color: #94a3b8;
            font-style: italic;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .gl-help-ai-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(99, 102, 241, 0.2);
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: glHelpSpin 0.8s linear infinite;
        }
        @keyframes glHelpSpin { to { transform: rotate(360deg); } }
        .gl-help-ai-footer {
            padding: 8px 16px;
            font-size: 0.65rem;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
        }
    `;
    document.head.appendChild(style);
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
    } else {
        injectStyle();
    }
}

// ─── Singleton panel ───────────────────────────────────────────────

let panelEl = null;

function ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.createElement('div');
    panelEl.className = 'gl-help-ai-panel';
    panelEl.innerHTML = `
        <div class="gl-help-ai-panel-header">
            <div class="gl-help-ai-panel-title">
                <span class="material-icons-round" style="font-size: 14px;">auto_awesome</span>
                Spiegazione AI
            </div>
            <button class="gl-help-ai-panel-close" aria-label="Chiudi">
                <span class="material-icons-round" style="font-size: 18px;">close</span>
            </button>
        </div>
        <div class="gl-help-ai-panel-body"></div>
        <div class="gl-help-ai-footer">
            <span>Gemini Flash · costo ≈ 0,00005 €</span>
            <span class="gl-help-ai-elapsed"></span>
        </div>
    `;
    document.body.appendChild(panelEl);

    panelEl.querySelector('.gl-help-ai-panel-close').addEventListener('click', hidePanel);
    document.addEventListener('click', (e) => {
        if (!panelEl.classList.contains('visible')) return;
        if (panelEl.contains(e.target)) return;
        if (e.target.closest('.gl-help-ai-btn')) return;
        hidePanel();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelEl.classList.contains('visible')) hidePanel();
    });

    return panelEl;
}

function positionPanel(triggerEl) {
    if (!panelEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const margin = 12;
    const panelRect = panelEl.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;

    let top = rect.bottom + 8;
    if (top + panelRect.height > vh - margin) {
        top = Math.max(margin, rect.top - panelRect.height - 8);
    }
    let left = rect.left;
    if (left + panelRect.width > vw - margin) left = vw - panelRect.width - margin;
    if (left < margin) left = margin;

    panelEl.style.top = `${Math.round(top)}px`;
    panelEl.style.left = `${Math.round(left)}px`;
}

function showPanel(triggerEl, contentText) {
    const panel = ensurePanel();
    panel.querySelector('.gl-help-ai-panel-body').textContent = contentText;
    panel.querySelector('.gl-help-ai-panel-body').classList.remove('loading');
    panel.style.left = '-9999px';
    panel.style.top = '0';
    requestAnimationFrame(() => {
        positionPanel(triggerEl);
        panel.classList.add('visible');
    });
}

function showPanelLoading(triggerEl) {
    const panel = ensurePanel();
    const body = panel.querySelector('.gl-help-ai-panel-body');
    body.classList.add('loading');
    body.innerHTML = `<div class="gl-help-ai-spinner"></div> Sto leggendo il contesto e preparo la spiegazione...`;
    panel.querySelector('.gl-help-ai-elapsed').textContent = '';
    panel.style.left = '-9999px';
    panel.style.top = '0';
    requestAnimationFrame(() => {
        positionPanel(triggerEl);
        panel.classList.add('visible');
    });
}

function hidePanel() {
    if (panelEl) panelEl.classList.remove('visible');
}

// ─── System prompt template ─────────────────────────────────────────

function buildSystemPrompt(contextType) {
    return `Sei l'assistente Gleeye ERP. Devi spiegare in italiano semplice e breve un dato dell'app a un utente non tecnico.

REGOLE:
- Risposta MAX 4 frasi.
- Italiano colloquiale, niente tecnicismi.
- Niente formule, niente bullet point (se non strettamente necessari).
- Inizia con il punto chiave: "Questa commessa è in ritardo di 3 giorni perché..." / "Devi fare le seguenti cose:..."
- Se l'utente è un collaboratore, NON menzionare costi/margini/dati economici interni.
- Se mancano informazioni nel contesto, dillo brevemente: "non ho abbastanza dati per dirti X".

CONTESTO TIPO: ${contextType}`;
}

// ─── API pubblica ───────────────────────────────────────────────────

/**
 * Genera l'HTML di un bottone "spiega" da iniettare nei template.
 * @param {Object} opts
 * @param {string} opts.id - ID univoco (es. assignment.id) per dispatch del click.
 * @param {string} opts.contextType - Stringa libera (es. 'assignment', 'commessa', 'fattura').
 * @param {string} [opts.label='Spiegami'] - Testo del bottone.
 * @param {string} [opts.icon='auto_awesome'] - Icona material.
 * @returns {string} markup HTML.
 */
export function inlineHelpButton({ id, contextType, label = 'Spiegami', icon = 'auto_awesome' }) {
    if (!id || !contextType) return '';
    return `<button type="button" class="gl-help-ai-btn"
        data-help-ai-id="${escapeAttr(id)}"
        data-help-ai-context="${escapeAttr(contextType)}"
        onclick="event.stopPropagation()">
        <span class="material-icons-round icon">${escapeAttr(icon)}</span>
        ${escapeAttr(label)}
    </button>`;
}

/**
 * Collega gli handler ai bottoni .gl-help-ai-btn nel container.
 * Chiama questa funzione DOPO aver renderizzato il template.
 *
 * @param {HTMLElement} container - root dove cercare i bottoni.
 * @param {Function} contextLoader - funzione (id, contextType) => Promise<{text}> che ritorna il testo del contesto da passare a Gemini.
 */
export function attachInlineHelp(container, contextLoader) {
    if (!container) return;
    const buttons = container.querySelectorAll('.gl-help-ai-btn[data-help-ai-id]');
    buttons.forEach(btn => {
        if (btn._glHelpAiBound) return;
        btn._glHelpAiBound = true;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.getAttribute('data-help-ai-id');
            const contextType = btn.getAttribute('data-help-ai-context');
            if (!id || !contextType) return;

            btn.setAttribute('disabled', 'true');
            showPanelLoading(btn);
            const startTime = Date.now();

            try {
                const ctx = await contextLoader(id, contextType);
                const userMessage = typeof ctx === 'string' ? ctx : ctx?.text || '';
                if (!userMessage) {
                    showPanel(btn, 'Non ho informazioni sufficienti per spiegare. Apri il dettaglio per vedere i dati.');
                    return;
                }

                const answer = await ai.complete(userMessage, {
                    feature: 'help_inline',
                    system: buildSystemPrompt(contextType),
                    temperature: 0.3,
                    max_tokens: 280,
                });

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                showPanel(btn, answer);
                const elapsedEl = panelEl?.querySelector('.gl-help-ai-elapsed');
                if (elapsedEl) elapsedEl.textContent = `${elapsed}s`;
            } catch (err) {
                console.error('[help-inline-ai]', err);
                showPanel(btn, `Errore: ${err.message || err}`);
            } finally {
                btn.removeAttribute('disabled');
            }
        });
    });
}

// ─── Utils ──────────────────────────────────────────────────────────

function escapeAttr(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Espongo su window per debug
if (typeof window !== 'undefined') {
    window.glHelpAI = { inlineHelpButton, attachInlineHelp };
}
