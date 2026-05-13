/**
 * sales/_modal.js
 * Helper condivisi per modal del Sales Engine.
 *
 * Centralizza:
 * - openOverlay(id) — crea overlay con backdrop scuro+blur, z-index 9999, click fuori = chiude
 * - buildModalShell(title, headerExtra, bodyHTML, footerHTML) — shell html del modal box
 * - closeOverlay(overlay) — rimuove + cleanup listener
 *
 * Pattern: usato da tutti i modal sales (nicchia, prospect, sequence, step, sourcing).
 * Vietato copiare-incollare overlay.style.cssText o background:var(--bg-primary) negli altri file.
 *
 * Bug chiusi:
 * - Modal trasparenti (backdrop debole + bg senza fallback)
 * - z-index conflitti con sidebar/header
 * - Click su contenuto interno chiudeva l'overlay (delegato erroneo)
 */

let _overlayCounter = 0;

/**
 * Crea un overlay vuoto pronto per ricevere il modal box.
 * @param {string} [id] - id custom; se non passato viene generato univoco
 * @returns {HTMLDivElement} overlay node attaccato al body
 */
export function openOverlay(id) {
    const overlayId = id || ('sales-modal-' + (++_overlayCounter));
    // Rimuovi eventuale esistente con stesso id
    const existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = 'sales-modal-overlay';
    overlay.style.cssText =
        'position:fixed;' +
        'inset:0;' +
        'background:rgba(15,23,42,0.75);' +
        'backdrop-filter:blur(6px);' +
        '-webkit-backdrop-filter:blur(6px);' +
        'z-index:9999;' +
        'display:flex;' +
        'align-items:center;' +
        'justify-content:center;' +
        'padding:1rem;' +
        'animation:salesModalFadeIn 0.15s ease-out;';

    // Click fuori dal modal box chiude
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay(overlay);
    });

    // ESC chiude (listener globale finché overlay è in vita)
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeOverlay(overlay);
        }
    };
    document.addEventListener('keydown', escHandler);
    overlay._escHandler = escHandler;

    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Rimuove l'overlay e cleanup listener.
 */
export function closeOverlay(overlay) {
    if (!overlay) return;
    if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
    overlay.remove();
}

/**
 * Costruisce l'HTML del box modal (titolo + body + footer).
 * Il box ha background bianco esplicito (con fallback su var), shadow forte, max-height responsive.
 *
 * @param {object} opts
 * @param {string} opts.title - titolo HTML-safe già (passa escHtml a monte)
 * @param {string} [opts.headerExtra] - HTML aggiuntivo da mettere accanto al close button (es. bottoni elimina)
 * @param {string} opts.body - HTML body
 * @param {string} [opts.footer] - HTML footer (bottoni); se omesso, niente footer
 * @param {string} [opts.maxWidth='760px']
 * @returns {string} HTML completo del modal box
 */
export function buildModalShell(opts) {
    const { title = '', headerExtra = '', body = '', footer = '', maxWidth = '760px' } = opts;
    return (
        '<div class="sales-modal-box" style="' +
            'background:var(--bg-primary, #ffffff);' +
            'border-radius:20px;' +
            'padding:2rem;' +
            'max-width:' + maxWidth + ';' +
            'width:100%;' +
            'max-height:90vh;' +
            'overflow-y:auto;' +
            'box-shadow:0 25px 80px rgba(0,0,0,0.35);' +
            'border:1px solid var(--glass-border, rgba(0,0,0,0.08));' +
            'animation:salesModalSlideUp 0.2s ease-out;' +
        '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;gap:0.6rem;">' +
                '<h2 style="font-size:1.25rem;font-weight:800;font-family:var(--font-titles);margin:0;flex:1;min-width:0;">' + title + '</h2>' +
                '<div style="display:flex;gap:0.4rem;align-items:center;flex-shrink:0;">' +
                    headerExtra +
                    '<button data-modal-close="1" style="background:var(--bg-tertiary);color:var(--text-secondary);border:none;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.78rem;cursor:pointer;line-height:1;">✕</button>' +
                '</div>' +
            '</div>' +
            body +
            (footer
                ? '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--glass-border, rgba(0,0,0,0.08));">' + footer + '</div>'
                : '') +
        '</div>'
    );
}

/**
 * Helper: bind dei bottoni con attributo data-modal-close="1" a chiudere l'overlay.
 * Da chiamare dopo aver settato innerHTML dell'overlay.
 */
export function bindModalCloseButtons(overlay) {
    overlay.querySelectorAll('[data-modal-close="1"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeOverlay(overlay);
        });
    });
}

/**
 * One-shot helper: apre overlay + builda shell + bind close. Restituisce overlay.
 *
 * Esempio:
 *   const overlay = openModal({ title: 'Foo', body: '...', footer: '<button data-modal-close>Annulla</button>' });
 *   // ora puoi fare overlay.querySelector('...') per attaccare ulteriori event listener
 */
export function openModal(opts) {
    const overlay = openOverlay(opts.id);
    overlay.innerHTML = buildModalShell(opts);
    bindModalCloseButtons(overlay);
    return overlay;
}

// ─── Stili globali (animazioni) ──────────────────────────────────────────────
// Inietta una sola volta i keyframes per fade-in / slide-up.
if (typeof document !== 'undefined' && !document.getElementById('sales-modal-keyframes')) {
    const style = document.createElement('style');
    style.id = 'sales-modal-keyframes';
    style.textContent =
        '@keyframes salesModalFadeIn { from { opacity: 0; } to { opacity: 1; } }' +
        '@keyframes salesModalSlideUp { from { transform: translateY(10px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }';
    document.head.appendChild(style);
}
