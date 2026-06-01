/**
 * PageShell — layout shell condiviso per tutte le viste.
 * PROPRIETÀ DELLA REGIA: non modificare senza coordinamento.
 *
 * @param {HTMLElement} container - elemento radice della vista
 * @param {Object} config
 * @param {string} config.title - titolo della pagina
 * @param {string} [config.actions=''] - HTML dei bottoni nell'header
 * @param {string} [config.content=''] - HTML del contenuto
 * @param {boolean} [config.fullscreen=false] - rimuove padding, utile per viste CRM/mappa
 */
export function renderPageShell(container, { title, actions = '', content = '', fullscreen = false }) {
  const shellClass = fullscreen ? 'page-shell page-shell--fullscreen' : 'page-shell';
  container.innerHTML = `
    <div class="${shellClass}">
      <div class="page-shell__header">
        <h1 class="page-shell__title">${title}</h1>
        ${actions ? `<div class="page-shell__actions">${actions}</div>` : ''}
      </div>
      <div class="page-shell__content">
        ${content}
      </div>
    </div>
  `;
}
