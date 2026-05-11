import { fetchMyWorkItems } from '../../modules/pm_api.js?v=8000';
import { state } from '../../modules/state.js?v=8000';

export async function renderMyWork(container) {
    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    // Future: items = await fetchMyWorkItems();

    container.innerHTML = `
        <div style="padding: 2rem;">
            <h1>My Work</h1>
            <p>I tuoi task e attività assegnate.</p>
             <div class="glass-card" style="margin-top:2rem; padding:2rem; text-align:center;">
                <span class="material-icons-round" style="font-size:3rem; opacity:0.5;">check_circle</span>
                <h3>Coming Soon</h3>
            </div>
        </div>
    `;
}
