import { createPMItem, updatePMItem, fetchSpace } from '../../../modules/pm_api.js?v=317';
// NOTE: Removed static import of space_view to avoid circular dependency
// Using event dispatch instead for view refresh

export function openItemDrawer(itemId, spaceId, parentId = null, itemType = 'task') {
    const overlay = document.getElementById('pm-drawer-overlay');
    const drawer = document.getElementById('pm-drawer');

    if (!overlay || !drawer) {
        console.error("Drawer elements not found");
        return;
    }

    // TODO: If itemId is present, fetch details. For now assume creation.
    const isEdit = !!itemId;
    const typeLabel = itemType === 'attivita' ? 'Attività' : (itemType === 'milestone' ? 'Milestone' : 'Task');

    drawer.innerHTML = `
        <div class="drawer-header" style="padding:1.5rem; border-bottom:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin:0;">${isEdit ? 'Modifica' : 'Nuova'} ${typeLabel}</h2>
            <button class="icon-btn close-drawer-btn"><span class="material-icons-round">close</span></button>
        </div>
        
        <div class="drawer-content" style="padding:1.5rem; overflow-y:auto; height: calc(100% - 80px);">
            <form id="pm-item-form" style="display:flex; flex-direction:column; gap:1.5rem;">
                <input type="hidden" name="space_ref" value="${spaceId}">
                ${parentId ? `<input type="hidden" name="parent_ref" value="${parentId}">` : ''}
                
                <div class="form-group">
                    <label class="label">Titolo</label>
                    <input type="text" name="title" required class="input-field" placeholder="Es. Preparazione Bozza">
                </div>
                
                <div class="row" style="display:flex; gap:1rem;">
                    <div class="form-group" style="flex:1;">
                        <label class="label">Tipo</label>
                        <select name="item_type" class="input-field">
                            <option value="task" ${itemType === 'task' ? 'selected' : ''}>Task</option>
                            <option value="attivita" ${itemType === 'attivita' ? 'selected' : ''}>Attività (Gruppo)</option>
                            <option value="milestone" ${itemType === 'milestone' ? 'selected' : ''}>Milestone</option>
                        </select>
                    </div>
                     <div class="form-group" style="flex:1;">
                        <label class="label">Stato</label>
                        <select name="status" class="input-field">
                            <option value="todo">Da Fare</option>
                            <option value="in_progress">In Corso</option>
                            <option value="blocked">Bloccato</option>
                            <option value="review">Revisione</option>
                            <option value="done">Completato</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="label">Note / Descrizione</label>
                    <textarea name="notes" class="input-field" rows="4" placeholder="Dettagli..."></textarea>
                </div>
                
                <div class="row" style="display:flex; gap:1rem;">
                    <div class="form-group" style="flex:1;">
                         <label class="label">Data Inizio</label>
                         <input type="date" name="start_date" class="input-field">
                    </div>
                     <div class="form-group" style="flex:1;">
                         <label class="label">Scadenza</label>
                         <input type="date" name="due_date" class="input-field">
                    </div>
                </div>

                <div style="margin-top:1rem; display:flex; justify-content:flex-end; gap:1rem;">
                    <button type="button" class="secondary-btn close-drawer-btn">Annulla</button>
                    <button type="submit" class="primary-btn">Salva</button>
                </div>
            </form>
        </div>
    `;

    overlay.classList.remove('hidden');

    // Event Handlers
    const closeBtns = drawer.parentElement.querySelectorAll('.close-drawer-btn');
    closeBtns.forEach(btn => btn.onclick = closeDrawer);

    const form = drawer.querySelector('#pm-item-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        // Fix dates if empty string -> null
        if (!payload.start_date) payload.start_date = null;
        if (!payload.due_date) payload.due_date = null;
        if (!payload.parent_ref) payload.parent_ref = null;

        try {
            if (isEdit) {
                await updatePMItem(itemId, payload);
            } else {
                await createPMItem(payload);
            }
            closeDrawer();

            // Dispatch event to refresh parent view (avoids circular import)
            document.dispatchEvent(new CustomEvent('pm-item-changed', {
                detail: {
                    spaceId: spaceId,
                    action: isEdit ? 'update' : 'create',
                    itemId: itemId
                }
            }));

        } catch (err) {
            console.error(err);
            alert("Errore salvataggio: " + err.message);
        }
    };
}

function closeDrawer() {
    const overlay = document.getElementById('pm-drawer-overlay');
    overlay.classList.add('hidden');
}
