import { fetchInternalSpaces, createInternalSpace } from '../../modules/pm_api.js?v=151';
import { state } from '../../modules/state.js?v=151';

export async function renderInternalProjects(container) {
    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    const spaces = await fetchInternalSpaces();

    container.innerHTML = `
        <div style="padding: 2rem;">
             <div class="header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h1>Progetti Interni</h1>
                <button class="primary-btn" id="new-internal-btn">
                    <span class="material-icons-round">add</span>
                    Nuovo Progetto
                </button>
            </div>

            <div class="grid-layout" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                ${spaces.map(space => `
                    <div class="glass-card clickable hover-scale" onclick="window.location.hash='#pm/space/${space.id}'" style="cursor:pointer;">
                        <h3 style="margin-bottom: 0.5rem; font-size:1.25rem;">${space.name}</h3>
                        <p class="text-secondary" style="margin-bottom: 1.5rem;">Creato il: ${new Date(space.created_at).toLocaleDateString()}</p>
                         <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; color: var(--brand-color);">
                            <span class="material-icons-round" style="font-size:1.1rem;">arrow_forward</span>
                            Apri
                        </div>
                    </div>
                `).join('')}
                
                ${spaces.length === 0 ? '<p class="text-secondary">Nessun progetto interno.</p>' : ''}
            </div>
        </div>
    `;

    // Bind Creation
    const btn = container.querySelector('#new-internal-btn');
    if (btn) {
        btn.onclick = async () => {
            const name = prompt("Nome del nuovo progetto interno:");
            if (name) {
                try {
                    const newSpace = await createInternalSpace(name);
                    if (newSpace) {
                        window.location.hash = `#pm/space/${newSpace.id}`;
                    }
                } catch (e) {
                    alert("Errore creazione: " + e.message);
                }
            }
        };
    }
}
