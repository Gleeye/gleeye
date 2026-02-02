import { fetchSpace, fetchProjectItems } from '../../modules/pm_api.js?v=151';
import { renderPMTree } from './components/pm_tree.js?v=151';
import { state } from '../../modules/state.js?v=151';

export async function renderSpaceView(container, spaceId) {
    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
        const space = await fetchSpace(spaceId);
        if (!space) {
            container.innerHTML = '<div class="error-state">Progetto non trovato o accesso negato.</div>';
            return;
        }

        const items = await fetchProjectItems(spaceId);

        // Header Info
        const title = space.type === 'commessa' && space.orders
            ? `${space.orders.order_number} - ${space.orders.title}`
            : (space.name || 'Progetto Interno');

        const subtitle = space.type === 'commessa' && space.orders?.clients
            ? space.orders.clients.business_name
            : 'Progetto';

        container.innerHTML = `
            <div class="pm-space-layout" style="height: 100%; display: flex; flex-direction: column;">
                <!-- Header -->
                <div class="pm-header glass-panel" style="margin: 0 0 1rem 0; padding: 1.5rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div class="text-xs text-secondary uppercase tracking-wider">${subtitle}</div>
                        <h1 style="margin:0; font-size:1.5rem;">${title}</h1>
                    </div>
                    <div class="actions">
                        <button class="primary-btn" id="add-item-btn">
                            <span class="material-icons-round">add</span>
                            Nuova Attività
                        </button>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="pm-tabs" style="margin-bottom: 1rem; display:flex; gap: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                    <button class="tab-btn active" data-view="tree">
                        <span class="material-icons-round">account_tree</span> Albero
                    </button>
                    <button class="tab-btn" data-view="list">
                        <span class="material-icons-round">view_list</span> Lista
                    </button>
                    <button class="tab-btn" data-view="people">
                        <span class="material-icons-round">group</span> Persone
                    </button>
                </div>

                <!-- View Content -->
                <div id="pm-view-content" style="flex: 1; overflow-y: auto; position: relative;">
                    <!-- Content will be injected here -->
                </div>
            </div>
            
            <!-- Drawer Container -->
            <div id="pm-drawer-overlay" class="drawer-overlay hidden">
                <div class="drawer" id="pm-drawer">
                    <!-- Drawer Content -->
                </div>
            </div>
        `;

        // Tab Logic
        const tabs = container.querySelectorAll('.tab-btn');
        const viewContent = container.querySelector('#pm-view-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const view = tab.dataset.view;

                if (view === 'tree') {
                    renderPMTree(viewContent, items, space);
                } else {
                    viewContent.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-secondary);">Vista ${view} in arrivo...</div>`;
                }
            });
        });

        // Add Item Handler
        container.querySelector('#add-item-btn').addEventListener('click', () => {
            // Open Drawer for new item
            import('./components/pm_drawer.js').then(mod => {
                mod.openItemDrawer(null, spaceId);
            });
        });

        // Initial Render
        renderPMTree(viewContent, items, space);

    } catch (e) {
        console.error("Error rendering space:", e);
        container.innerHTML = `<div class="error-state">Errore caricamento progetto: ${e.message}</div>`;
    }
}
