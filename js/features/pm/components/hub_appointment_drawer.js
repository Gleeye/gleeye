import { saveAppointment, deleteAppointment, fetchAppointmentTypes } from '../../../modules/pm_api.js?v=317';
import { fetchContacts } from '../../../modules/api.js?v=317';
import { state } from '../../../modules/state.js?v=317';
import { renderUserPicker } from './picker_utils.js?v=317';

export async function openAppointmentDrawer(inputAppointment, contextId = null, contextType = 'order') {
    const overlay = document.getElementById('hub-drawer-overlay');
    const drawer = document.getElementById('hub-drawer');

    if (!overlay || !drawer) return;

    // --- STATE ---
    let appointment = inputAppointment ? { ...inputAppointment } : null;
    const isCreate = !appointment;
    let viewMode = !isCreate;

    // Context
    const targetId = appointment ? (appointment.order_id || appointment.pm_space_id) : contextId;
    const targetType = appointment ? (appointment.pm_space_id ? 'space' : 'order') : contextType;

    if (!targetId) {
        console.error("Missing Context ID for appointment");
        return;
    }

    // Load Data (Types & Contacts)
    let appointmentTypes = [];
    try {
        const promises = [fetchAppointmentTypes()];
        if (!state.contacts || state.contacts.length === 0) promises.push(fetchContacts());
        const [types] = await Promise.all(promises);
        appointmentTypes = types || [];
    } catch (e) { console.error("Error loading types/contacts", e); }

    // Resolve Client Contacts
    let clientContacts = [];
    if (targetType === 'order') {
        const order = state.orders?.find(o => o.id === targetId);
        const clientId = order?.client_id;
        clientContacts = state.contacts?.filter(c => c.client_id === clientId) || [];
    }

    // Form State
    let formState = {
        title: '',
        start_time: '',
        end_time: '',
        location: '',
        mode: 'in_presenza',
        status: 'bozza',
        note: '',
        types: [], // Set<id>
        participants: {
            internal: [], // { collaborator_id, role, status }
            client: [] // { contact_id, contact object for display }
        }
    };

    // Initialize Form State
    if (appointment) {
        formState = {
            title: appointment.title,
            start_time: appointment.start_time,
            end_time: appointment.end_time,
            location: appointment.location || '',
            mode: appointment.mode || 'in_presenza',
            status: appointment.status || 'bozza',
            note: appointment.note || '',
            types: new Set(appointment.types?.map(t => t.id) || []),
            participants: {
                internal: [...(appointment.participants?.internal || [])],
                client: [...(appointment.participants?.client || [])].map(p => ({
                    contact_id: p.contact_id,
                    contact: p.contact || state.contacts?.find(c => c.id === p.contact_id)
                }))
            }
        };
    } else {
        // Defaults for Create
        const now = new Date();
        now.setMinutes(0, 0, 0); // Round hour
        const end = new Date(now);
        end.setHours(end.getHours() + 1);

        formState.start_time = now.toISOString();
        formState.end_time = end.toISOString();
        formState.status = 'bozza';
        formState.types = new Set();
        // Add creator
        if (state.profile?.id) {
            const meCollab = state.collaborators?.find(c => c.user_id === state.profile.id);
            if (meCollab) {
                formState.participants.internal.push({
                    collaborator_id: meCollab.id,
                    role: 'organizer',
                    user: meCollab
                });
            }
        }
    }


    // --- RENDER ---
    const render = () => {
        if (viewMode && appointment) {
            renderViewMode();
        } else {
            renderEditMode();
        }
    };

    const renderViewMode = () => {
        const start = new Date(appointment.start_time);
        const end = new Date(appointment.end_time);

        const dateStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')} - ${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`;

        const internalParts = appointment.participants?.internal || [];
        const clientParts = appointment.participants?.client || [];

        drawer.innerHTML = `
            <!-- HEADER -->
            <div class="drawer-header" style="padding: 1.5rem; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: flex-start; background: white;">
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">APPUNTAMENTO</div>
                    <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700; line-height: 1.2;">${appointment.title}</h2>
                    <div style="display: flex; gap: 6px; margin-top: 0.75rem; flex-wrap: wrap;">
                        ${appointment.types.map(t => `
                            <span style="font-size: 0.75rem; background: ${t.color}15; color: ${t.color}; padding: 2px 8px; border-radius: 4px; font-weight: 600; border: 1px solid ${t.color}30;">${t.name}</span>
                        `).join('')}
                        <span style="font-size: 0.75rem; background: var(--surface-2); color: var(--text-secondary); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--surface-3); text-transform: capitalize;">${appointment.status}</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem;">
                    <button id="btn-edit" class="icon-btn" style="width: 36px; height: 36px; border-radius: 50%; background: var(--surface-1);"><span class="material-icons-round">edit</span></button>
                    <button class="icon-btn close-drawer-btn" style="width: 36px; height: 36px; border-radius: 50%; background: var(--surface-1);"><span class="material-icons-round">close</span></button>
                </div>
            </div>

            <!-- BODY -->
            <div class="drawer-body" style="padding: 1.5rem; overflow-y: auto; flex: 1; background: var(--surface-1);">
                <!-- Time/Location -->
                <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1.5rem; background: white; border-radius: 12px; border: 1px solid var(--surface-2);">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center;"><span class="material-icons-round">calendar_today</span></div>
                        <div><div style="font-weight: 600;">${dateStr}</div><div style="color: var(--text-secondary);">${timeStr}</div></div>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: #fdf2f8; color: #db2777; display: flex; align-items: center; justify-content: center;">
                            <span class="material-icons-round">${appointment.mode === 'remoto' ? 'videocam' : 'place'}</span>
                        </div>
                        <div>
                            <div style="font-weight: 600; text-transform: capitalize;">${appointment.mode?.replace('_', ' ') || 'In Presenza'}</div>
                            <div style="color: var(--text-secondary); white-space: pre-wrap;">${appointment.location || 'Nessun luogo'}</div>
                        </div>
                    </div>
                </div>

                <!-- Participants -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                    <div>
                        <h4 style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Team</h4>
                        ${internalParts.length ? internalParts.map(p => {
            const u = p.user || {};
            return `<div style="padding: 0.5rem; background: white; border: 1px solid var(--surface-2); border-radius: 8px; margin-top: 0.5rem; display: flex; align-items: center; gap: 8px;">
                                <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=' + (u.full_name || 'U')}" style="width: 24px; height: 24px; border-radius: 50%;">
                                <div style="font-size: 0.85rem;">${u.full_name || 'Utente'}</div>
                            </div>`;
        }).join('') : '<div style="color: grey; font-size: 0.8rem;">-</div>'}
                    </div>
                    <div>
                        <h4 style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Cliente</h4>
                        ${clientParts.length ? clientParts.map(p => {
            const c = p.contact || {};
            return `<div style="padding: 0.5rem; background: white; border: 1px solid var(--surface-2); border-radius: 8px; margin-top: 0.5rem; display: flex; align-items: center; gap: 8px;">
                                <div style="width: 24px; height: 24px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 10px;">${(c.first_name || 'C')[0]}</div>
                                <div style="font-size: 0.85rem; font-weight: 500;">${c.first_name || ''} ${c.last_name || ''}</div>
                             </div>`;
        }).join('') : '<div style="color: grey; font-size: 0.8rem;">-</div>'}
                    </div>
                </div>

                <!-- Notes -->
                <div>
                     <h4 style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Note</h4>
                     <div style="padding: 1rem; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; margin-top: 0.5rem;">${appointment.note || '-'}</div>
                </div>
            </div>
        `;

        // Listeners
        drawer.querySelector('.close-drawer-btn').addEventListener('click', () => overlay.classList.add('hidden'));
        drawer.querySelector('#btn-edit').addEventListener('click', () => { viewMode = false; render(); });
    };

    const renderEditMode = () => {
        const toInputDate = (iso) => {
            if (!iso) return '';
            const d = new Date(iso);
            const pad = num => String(num).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const internalParts = formState.participants.internal;
        const clientParts = formState.participants.client;

        drawer.innerHTML = `
            <div class="drawer-header" style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 1.2rem;">${isCreate ? 'Nuovo Appuntamento' : 'Modifica Appuntamento'}</h2>
                <button class="icon-btn close-drawer-btn"><span class="material-icons-round">close</span></button>
            </div>

            <div class="drawer-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                <form id="appt-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                    
                    <!-- Title -->
                    <div class="form-group">
                        <label class="label-sm">Titolo *</label>
                        <input type="text" name="title" required value="${formState.title}" class="input-modern" placeholder="Es. Riunione Kickoff...">
                    </div>

                    <!-- Types -->
                    <div class="form-group">
                        <label class="label-sm">Tipo Appuntamento</label>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${appointmentTypes.map(t => {
            const selected = formState.types.has(t.id);
            return `
                                    <div class="type-pill ${selected ? 'selected' : ''}" data-id="${t.id}" style="
                                        padding: 6px 12px; border-radius: 20px; border: 1px solid ${t.color}; 
                                        color: ${selected ? 'white' : t.color}; background: ${selected ? t.color : 'transparent'};
                                        cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
                                    ">
                                        ${t.name}
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>

                    <!-- Date/Time -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="label-sm">Inizio</label>
                            <input type="datetime-local" name="start_time" required value="${toInputDate(formState.start_time)}" class="input-modern">
                        </div>
                        <div class="form-group">
                            <label class="label-sm">Fine</label>
                            <input type="datetime-local" name="end_time" required value="${toInputDate(formState.end_time)}" class="input-modern">
                        </div>
                    </div>

                    <!-- Location/Mode -->
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="label-sm">Modalità</label>
                            <select name="mode" class="input-modern">
                                <option value="in_presenza" ${formState.mode === 'in_presenza' ? 'selected' : ''}>In Presenza</option>
                                <option value="remoto" ${formState.mode === 'remoto' ? 'selected' : ''}>Remoto / Link</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="label-sm">Luogo / Link</label>
                            <input type="text" name="location" value="${formState.location}" class="input-modern" placeholder="Indirizzo o URL...">
                        </div>
                    </div>

                    <!-- Internal Participants -->
                    <div class="form-group">
                        <label class="label-sm">Referenti Interni (Team)</label>
                        <div style="background: white; border: 1px solid var(--surface-2); border-radius: 8px; padding: 0.5rem; min-height: 48px;">
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${internalParts.map((p, idx) => {
            const u = p.user || {};
            const name = u.full_name || u.email || 'Utente';
            return `
                                        <div style="display: flex; align-items: center; gap: 6px; background: var(--surface-2); padding: 4px 8px; border-radius: 16px; font-size: 0.85rem;">
                                            <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name=' + name}" style="width: 20px; height: 20px; border-radius: 50%;">
                                            <span>${name}</span>
                                            <span class="material-icons-round remove-internal-btn" data-idx="${idx}" style="font-size: 14px; cursor: pointer; opacity: 0.6;">close</span>
                                        </div>
                                    `;
        }).join('')}
                                
                                <div style="position: relative;">
                                    <button type="button" id="add-internal-btn" style="width: 28px; height: 28px; border-radius: 50%; border: 1px dashed var(--text-secondary); background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                        <span class="material-icons-round" style="font-size: 16px; color: var(--text-secondary);">add</span>
                                    </button>
                                     <div id="internal-picker" class="hidden" style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); min-width: 280px; background: white; border: 1px solid var(--surface-2); box-shadow: 0 10px 40px rgba(0,0,0,0.25); z-index: 9999; border-radius: 12px; max-height: 350px !important; overflow-y: auto !important; overflow-x: hidden; box-sizing: border-box; padding: 4px 0;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Client Participants -->
                    ${targetType === 'order' ? `
                    <div class="form-group">
                         <label class="label-sm">Referenti Cliente</label>
                         <div style="background: white; border: 1px solid var(--surface-2); border-radius: 8px; padding: 0.5rem;">
                            <!-- Show selected pills -->
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                                ${clientParts.map((p, idx) => {
            const c = p.contact || {};
            return `
                                        <div style="display: flex; align-items: center; gap: 6px; background: #e0f2fe; padding: 4px 8px; border-radius: 16px; font-size: 0.85rem; color: #0369a1;">
                                            <span>${c.first_name || ''} ${c.last_name || ''}</span>
                                            <span class="material-icons-round remove-client-btn" data-idx="${idx}" style="font-size: 14px; cursor: pointer; opacity: 0.6;">close</span>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                            
                            <!-- Available Contacts (Simple Checklist or Add Button) -->
                             ${clientContacts.length > 0 ? `
                                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:4px;">Aggiungi referente:</div>
                                <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                                    ${clientContacts.filter(c => !clientParts.some(p => p.contact_id === c.id)).map(c => `
                                        <button type="button" class="add-client-contact-btn" data-id="${c.id}" style="
                                            background: white; border: 1px solid var(--surface-2); padding: 4px 8px; border-radius: 6px; 
                                            font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 4px;
                                        ">
                                            <span class="material-icons-round" style="font-size: 14px; color: var(--brand-color);">add</span>
                                            ${c.first_name} ${c.last_name}
                                        </button>
                                    `).join('')}
                                </div>
                             ` : `<div style="font-size:0.8rem; color:var(--text-tertiary); font-style:italic;">Nessun contatto trovato.</div>`}
                         </div>
                    </div>
                    ` : ''}

                    <!-- Status -->
                     <div class="form-group">
                        <label class="label-sm">Stato</label>
                        <select name="status" class="input-modern" style="font-weight: 500;">
                            <option value="bozza" ${formState.status === 'bozza' ? 'selected' : ''}>Bozza</option>
                            <option value="confermato" ${formState.status === 'confermato' ? 'selected' : ''}>Confermato</option>
                            <option value="annullato" ${formState.status === 'annullato' ? 'selected' : ''}>Annullato</option>
                        </select>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">Le notifiche vengono inviate solo per gli appuntamenti confermati.</div>
                    </div>

                    <!-- Note -->
                    <div class="form-group">
                        <label class="label-sm">Note</label>
                        <textarea name="note" rows="3" class="input-modern">${formState.note}</textarea>
                    </div>

                </form>
            </div>

            <div class="drawer-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--surface-2); display: flex; justify-content: flex-end; gap: 0.75rem; align-items: center;">
                ${!isCreate ? `<button type="button" id="delete-btn" class="icon-btn" style="margin-right: auto; color: #ef4444;"><span class="material-icons-round">delete</span></button>` : ''}
                <button type="button" class="secondary-btn" id="cancel-btn">Annulla</button>
                <button type="button" id="save-btn" class="primary-btn">${isCreate ? 'Crea Appuntamento' : 'Salva Modifiche'}</button>
            </div>
        `;

        attachEditListeners();
    };

    const attachEditListeners = () => {
        // Cancel/Close
        drawer.querySelector('.close-drawer-btn').addEventListener('click', () => {
            if (isCreate) overlay.classList.add('hidden');
            else { viewMode = true; render(); }
        });
        drawer.querySelector('#cancel-btn').addEventListener('click', () => {
            if (isCreate) overlay.classList.add('hidden');
            else { viewMode = true; render(); }
        });

        // Type Select
        drawer.querySelectorAll('.type-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const tid = pill.dataset.id;
                if (formState.types.has(tid)) formState.types.delete(tid);
                else formState.types.add(tid);
                renderEditMode();
            });
        });

        // Inputs
        drawer.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('change', (e) => {
                if (formState.hasOwnProperty(e.target.name)) {
                    formState[e.target.name] = e.target.value;
                    console.log(`Field ${e.target.name} changed to ${e.target.value}`);
                }
            });
        });

        // --- Internal Picker ---
        const addInternalBtn = drawer.querySelector('#add-internal-btn');
        const internalPicker = drawer.querySelector('#internal-picker');
        if (addInternalBtn && internalPicker) {
            addInternalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!internalPicker.classList.contains('hidden')) {
                    internalPicker.classList.add('hidden');
                    return;
                }

                // If targetType is space, we can fetch space members. But `renderUserPicker` likely expects generic logic.
                // Assuming we want to show current space participants + all collabs potentially.
                const spaceId = targetType === 'space' ? targetId : state.pm_spaces?.find(s => s.ref_ordine === targetId)?.id;

                const assignedIds = new Set([
                    ...formState.participants.internal.map(p => p.collaborator_id),
                    ...formState.participants.internal.map(p => p.user?.user_id).filter(Boolean)
                ]);

                internalPicker.innerHTML = renderUserPicker(spaceId, 'participant', assignedIds);
                internalPicker.classList.remove('hidden');

                // Edge detection
                const rect = internalPicker.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    internalPicker.style.left = 'auto';
                    internalPicker.style.right = '0';
                    internalPicker.style.transform = 'none';
                } else if (rect.left < 0) {
                    internalPicker.style.left = '0';
                    internalPicker.style.transform = 'none';
                }
            });
            internalPicker.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const opt = e.target.closest('.user-option');
                if (!opt) return;

                const collabId = opt.dataset.collabId;
                const uid = opt.dataset.uid;

                let collab = state.collaborators?.find(c => c.id === collabId);
                if (!collab && uid) collab = state.collaborators?.find(c => c.user_id === uid);

                if (collab) {
                    formState.participants.internal.push({
                        collaborator_id: collab.id,
                        role: 'participant',
                        status: 'pending',
                        user: {
                            full_name: collab.full_name || `${collab.first_name} ${collab.last_name}`,
                            avatar_url: collab.avatar_url
                        }
                    });
                    renderEditMode();
                }
            });
        }

        drawer.querySelector('.drawer-body').addEventListener('click', (e) => {
            if (internalPicker && !internalPicker.classList.contains('hidden')) {
                const isClickInside = internalPicker.contains(e.target) || e.target.closest('#add-internal-btn');
                if (!isClickInside) {
                    internalPicker.classList.add('hidden');
                }
            }
        });

        drawer.querySelectorAll('.remove-internal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                formState.participants.internal.splice(e.target.dataset.idx, 1);
                renderEditMode();
            });
        });

        // --- Client Picker ---
        drawer.querySelectorAll('.add-client-contact-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cid = btn.dataset.id;
                const contact = clientContacts.find(c => c.id === cid);
                if (contact) {
                    formState.participants.client.push({
                        contact_id: contact.id,
                        contact: contact
                    });
                    renderEditMode();
                }
            });
        });
        drawer.querySelectorAll('.remove-client-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                formState.participants.client.splice(e.target.dataset.idx, 1);
                renderEditMode();
            });
        });

        // Save
        drawer.querySelector('#save-btn').addEventListener('click', async () => {
            const btn = drawer.querySelector('#save-btn');
            btn.disabled = true;
            btn.textContent = 'Salvataggio...';

            try {
                const payload = {
                    id: isCreate ? undefined : appointment.id,
                    order_id: targetType === 'order' ? targetId : null,
                    pm_space_id: targetType === 'space' ? targetId : null,
                    title: formState.title,
                    start_time: new Date(formState.start_time).toISOString(),
                    end_time: new Date(formState.end_time).toISOString(),
                    location: formState.location,
                    mode: formState.mode,
                    status: formState.status,
                    note: formState.note,
                    types: Array.from(formState.types),
                    internal_participants: formState.participants.internal.map(p => ({
                        collaborator_id: p.collaborator_id,
                        role: p.role,
                        status: p.status
                    })),
                    client_participants: formState.participants.client.map(p => ({
                        contact_id: p.contact_id
                    }))
                };

                const saved = await saveAppointment(payload);
                appointment = saved;
                viewMode = true;

                // Generic listener dispatch
                const evtDetail = {
                    refId: targetId,
                    refType: targetType,
                    orderId: targetType === 'order' ? targetId : null,
                    spaceId: targetType === 'space' ? targetId : null
                };

                document.dispatchEvent(new CustomEvent('appointment-changed', { detail: evtDetail }));
                render();
            } catch (err) {
                console.error("Save failed", err);
                alert("Errore durante il salvataggio: " + err.message);
                btn.disabled = false;
                btn.textContent = 'Riprova';
            }
        });

        // Delete
        const delBtn = drawer.querySelector('#delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                if (!confirm("Eliminare definitivamente l'appuntamento?")) return;
                try {
                    await deleteAppointment(appointment.id);
                    const evtDetail = {
                        refId: targetId,
                        refType: targetType,
                        orderId: targetType === 'order' ? targetId : null,
                        spaceId: targetType === 'space' ? targetId : null
                    };
                    document.dispatchEvent(new CustomEvent('appointment-changed', { detail: evtDetail }));
                    overlay.classList.add('hidden');
                } catch (err) { alert("Errore eliminazione: " + err.message); }
            });
        }
    };


    // Initial Render
    render();
    overlay.classList.remove('hidden');
}
