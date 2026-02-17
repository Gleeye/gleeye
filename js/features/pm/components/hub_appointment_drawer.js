import { saveAppointment, deleteAppointment, fetchAppointmentTypes } from '../../../modules/pm_api.js';
import { fetchContacts } from '../../../modules/api.js';
import { state } from '../../../modules/state.js';
import { renderUserPicker } from './picker_utils.js?v=317';
import { supabase } from '../../../modules/config.js';

export async function openAppointmentDrawer(inputAppointment, contextId = null, contextType = 'order', options = {}) {
    let overlay = document.getElementById('hub-drawer-overlay');
    let drawer = document.getElementById('hub-drawer');

    if (!overlay || !drawer) {
        console.warn("Drawer elements not found, injecting...");
        const html = `
            <div id="hub-drawer-overlay" class="drawer-overlay hidden" style="
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.4); z-index: 99999;
                display: flex; justify-content: flex-end;
            ">
                <div id="hub-drawer" style="
                    width: 600px; max-width: 100%; height: 100%; 
                    background: white; box-shadow: -10px 0 40px rgba(0,0,0,0.2);
                    display: flex; flex-direction: column;
                "></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('hub-drawer-overlay');
        drawer = document.getElementById('hub-drawer');
    }

    // Load Data (Types, Contacts & Spaces)
    let appointmentTypes = [];
    try {
        const promises = [fetchAppointmentTypes()];
        if (!state.contacts || state.contacts.length === 0) promises.push(fetchContacts());

        // Always fetch if we might only have a partial list (e.g. from current space view)
        // or if we have very few spaces in memory.
        const shouldFetchSpaces = !state.pm_spaces || state.pm_spaces.length < 5;
        if (shouldFetchSpaces) {
            promises.push(supabase.from('pm_spaces').select('*').then(res => {
                if (res.data) state.pm_spaces = res.data;
                return res.data;
            }));
        }
        const [types] = await Promise.all(promises);
        appointmentTypes = types || [];
    } catch (e) { console.error("Error loading drawer data", e); }

    // Resolve Appointment if only ID provided
    let appointment = inputAppointment ? { ...inputAppointment } : null;
    if (appointment && appointment.id && Object.keys(appointment).length === 1) {
        try {
            const { data, error } = await supabase.from('appointments').select(`
                *,
                types:appointment_type_assignments(appointment_types(*)),
                participants:appointment_internal_participants(*)
            `).eq('id', appointment.id).single();

            if (error) throw error;

            appointment = {
                ...data,
                types: data.types?.map(t => t.appointment_types) || [],
                participants: {
                    internal: data.participants || [],
                    client: []
                }
            };

            const { data: cp } = await supabase.from('appointment_client_participants').select('*').eq('appointment_id', appointment.id);
            appointment.participants.client = cp || [];
        } catch (err) {
            console.error("Error fetching appointment:", err);
            alert("Errore nel caricamento dell'appuntamento.");
            return;
        }
    }
    const isCreate = !appointment;
    let viewMode = !isCreate;

    const { defaultRole = 'organizer', defaultNote = '' } = options;

    let targetId = appointment ? (appointment.order_id || appointment.pm_space_id) : contextId;
    let targetType = appointment ? (appointment.pm_space_id ? 'space' : 'order') : contextType;

    let clientContacts = [];
    const refreshContacts = () => {
        let clientId = formState.client_id;
        if (!clientId && formState.context_type === 'order' && formState.context_id) {
            const order = state.orders?.find(o => o.id === formState.context_id);
            clientId = order?.client_id;
        }
        clientContacts = state.contacts?.filter(c => c.client_id === clientId) || [];
    };

    let formState = {
        title: appointment?.title || '',
        start_time: appointment?.start_time ? new Date(appointment.start_time).toISOString().slice(0, 16) : '',
        end_time: appointment?.end_time ? new Date(appointment.end_time).toISOString().slice(0, 16) : '',
        location: appointment?.location || '',
        mode: appointment?.mode || 'in_presenza',
        status: appointment?.status || 'bozza',
        note: appointment?.note || defaultNote,
        types: new Set(appointment?.types?.map(t => t.id) || []),
        participants: {
            internal: appointment?.participants?.internal || [],
            client: appointment?.participants?.client || []
        },
        context_id: targetId,
        context_type: targetType,
        client_id: appointment?.client_id || null
    };
    refreshContacts();

    const render = () => {
        if (viewMode) {
            const types = appointment.types || [];
            drawer.innerHTML = `
                <div class="drawer-header" style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.2rem;">Dettagli Appuntamento</h2>
                    <button class="icon-btn close-drawer-btn"><span class="material-icons-round">close</span></button>
                </div>
                <div class="drawer-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                         <div class="form-group">
                            <label class="label-sm">Titolo</label>
                            <div style="font-size: 1.1rem; font-weight: 600;">${appointment.title}</div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group"><label class="label-sm">Inizio</label><div>${new Date(appointment.start_time).toLocaleString()}</div></div>
                            <div class="form-group"><label class="label-sm">Fine</label><div>${new Date(appointment.end_time).toLocaleString()}</div></div>
                        </div>
                        <div class="form-group">
                            <label class="label-sm">Tipi</label>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                ${types.map(t => `<span style="padding: 4px 10px; border-radius: 20px; background: ${t.color}20; color: ${t.color}; font-size: 0.8rem; font-weight: 600;">${t.name}</span>`).join('')}
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="label-sm">Partecipanti Interni</label>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                ${formState.participants.internal.map(p => {
                const collab = state.collaborators?.find(c => c.id === p.collaborator_id);
                return `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--surface-1); border-radius: 20px; font-size: 0.8rem;">
                                        <img src="${collab?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(collab?.full_name || 'U')}" style="width: 20px; height: 20px; border-radius: 50%;">
                                        <span>${collab?.full_name || 'Collaboratore'}</span>
                                    </div>`;
            }).join('') || '<span style="color: var(--text-tertiary); font-style: italic;">Nessuno</span>'}
                            </div>
                        </div>
                        <div class="form-group"><label class="label-sm">Note</label><div style="white-space: pre-wrap;">${appointment.note || '-'}</div></div>
                    </div>
                </div>
                <div class="drawer-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--surface-2); display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button type="button" class="secondary-btn" id="edit-btn">Modifica</button>
                    <button type="button" class="primary-btn close-drawer-btn">Chiudi</button>
                </div>
            `;
            drawer.querySelectorAll('.close-drawer-btn').forEach(btn => btn.onclick = () => overlay.classList.add('hidden'));
            drawer.querySelector('#edit-btn').onclick = () => { viewMode = false; render(); };
        } else {
            renderEditMode();
        }
    };

    const renderEditMode = () => {
        drawer.innerHTML = `
            <div class="drawer-header" style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; font-size: 1.2rem;">${isCreate ? 'Nuovo Appuntamento' : 'Modifica Appuntamento'}</h2>
                <button class="icon-btn close-drawer-btn"><span class="material-icons-round">close</span></button>
            </div>

            <div class="drawer-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                <form id="appt-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                    
                    <!-- Context Selection -->
                    <div class="form-group">
                        <label class="label-sm">Progetto / Commessa / Cliente</label>
                        ${!isCreate ? `
                            <div style="padding: 8px 12px; background: var(--surface-1); border: 1px solid var(--surface-2); border-radius: 8px; font-size: 0.9rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                                <span class="material-icons-round" style="font-size: 16px; opacity: 0.6;">
                                    ${formState.context_id ? (formState.context_type === 'order' ? 'style' : 'folder_special') : (formState.client_id ? 'person' : 'help_outline')}
                                </span>
                                ${(() => {
                    if (formState.context_id) {
                        if (formState.context_type === 'order') {
                            const o = state.orders?.find(x => x.id === formState.context_id);
                            return o ? `#${o.order_number} ${o.title}` : 'Commessa non trovata';
                        } else {
                            const s = state.pm_spaces?.find(x => x.id === formState.context_id);
                            return s ? s.name : 'Progetto non trovato';
                        }
                    }
                    if (formState.client_id) {
                        const c = state.clients?.find(x => x.id === formState.client_id);
                        return c ? `Cliente: ${c.business_name}` : 'Cliente connesso';
                    }
                    return 'Nessuna associazione';
                })()}
                            </div>
                        ` : `
                            <div style="position: relative;">
                                <div id="context-picker-trigger" style="
                                    padding: 10px 12px; background: white; border: 1px solid var(--surface-3); border-radius: 8px; 
                                    font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                                    transition: all 0.2s;
                                ">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">
                                            ${formState.context_id ? (formState.context_type === 'order' ? 'style' : 'folder_special') : (formState.client_id ? 'person' : 'search')}
                                        </span>
                                        <span style="${!formState.context_id && !formState.client_id ? 'color: var(--text-tertiary); font-style: italic;' : 'font-weight: 500;'}">
                                            ${(() => {
                if (formState.context_id) {
                    if (formState.context_type === 'order') {
                        const o = state.orders?.find(x => x.id === formState.context_id);
                        return o ? `#${o.order_number} ${o.title}` : 'Selezionato';
                    } else {
                        const s = state.pm_spaces?.find(x => x.id === formState.context_id);
                        return s ? s.name : 'Selezionato';
                    }
                }
                if (formState.client_id) {
                    const c = state.clients?.find(x => x.id === formState.client_id);
                    return c ? `Cliente: ${c.business_name}` : 'Cliente Selezionato';
                }
                return 'Cerca Progetto, Commessa o Cliente...';
            })()}
                                        </span>
                                    </div>
                                    <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">expand_more</span>
                                </div>
                                <div id="context-picker-dropdown" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 100%; z-index: 1000; background: white; border: 1px solid var(--surface-3); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); padding: 8px;">
                                    <div style="display: flex; gap: 8px; margin-bottom: 8px;"><input type="text" id="context-search" placeholder="Filtra..." class="input-modern" style="flex: 1; font-size: 0.8rem; height: 32px; padding: 0 10px;"><button type="button" id="clear-context-btn" title="Rimuovi associazione" style="background: var(--surface-1); border: 1px solid var(--surface-3); border-radius: 8px; padding: 0 8px; cursor: pointer; color: var(--text-tertiary);"><span class="material-icons-round" style="font-size: 18px;">backspace</span></button></div>
                                    <div id="context-options-list" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;"></div>
                                </div>
                            </div>
                        `}
                    </div>

                    <div class="form-group"><label class="label-sm">Titolo *</label><input type="text" name="title" required value="${formState.title}" class="input-modern" placeholder="Es. Riunione Kickoff..."></div>

                    <!-- Participants -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="label-sm">Partecipanti Interni</label>
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.5rem; border: 1px solid var(--surface-2); border-radius: 8px; min-height: 42px;">
                                ${formState.participants.internal.map((p, idx) => {
                const collab = state.collaborators?.find(c => c.id === p.collaborator_id);
                return `<div class="pill" style="display: flex; align-items: center; gap: 4px; background: var(--surface-2); padding: 2px 8px; border-radius: 20px; font-size: 0.75rem;">
                                        <span>${collab?.first_name || 'User'}</span>
                                        <span class="material-icons-round remove-int-btn" data-idx="${idx}" style="font-size: 12px; cursor: pointer;">close</span>
                                    </div>`;
            }).join('')}
                                <div style="position: relative;">
                                    <button type="button" id="add-int-btn" style="width: 24px; height: 24px; border-radius: 50%; border: 1px dashed #ccc; background: transparent; cursor: pointer;"><span class="material-icons-round" style="font-size: 14px;">add</span></button>
                                    <div id="int-picker" class="hidden glass-card" style="position: absolute; top: 100%; left: 0; min-width: 200px; z-index: 100; max-height: 250px; overflow-y: auto; background: white; border: 1px solid var(--surface-2); padding: 4px;">
                                        ${state.collaborators?.map(c => `<div class="picker-opt int-opt" data-id="${c.id}" style="padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px;">
                                            <img src="${c.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.full_name)}" style="width: 18px; height: 18px; border-radius: 50%;">
                                            <span>${c.full_name}</span>
                                        </div>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="label-sm">Contatti Cliente</label>
                            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.5rem; border: 1px solid var(--surface-2); border-radius: 8px; min-height: 42px;">
                                ${formState.participants.client.map((p, idx) => {
                const contact = state.contacts?.find(c => c.id === p.contact_id);
                return `<div class="pill" style="display: flex; align-items: center; gap: 4px; background: var(--surface-2); padding: 2px 8px; border-radius: 20px; font-size: 0.75rem;">
                                        <span>${contact?.name || 'Contatto'}</span>
                                        <span class="material-icons-round remove-cli-btn" data-idx="${idx}" style="font-size: 12px; cursor: pointer;">close</span>
                                    </div>`;
            }).join('')}
                                <div style="position: relative;">
                                    <button type="button" id="add-cli-btn" style="width: 24px; height: 24px; border-radius: 50%; border: 1px dashed #ccc; background: transparent; cursor: pointer;"><span class="material-icons-round" style="font-size: 14px;">add</span></button>
                                    <div id="cli-picker" class="hidden glass-card" style="position: absolute; top: 100%; left: 0; min-width: 200px; z-index: 100; max-height: 250px; overflow-y: auto; background: white; border: 1px solid var(--surface-2); padding: 4px;">
                                        ${clientContacts.length > 0 ? clientContacts.map(c => `<div class="picker-opt cli-opt" data-id="${c.id}" style="padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">${c.name}</div>`).join('') : '<div style="padding: 8px; font-size: 0.75rem; color: #999;">Nessun contatto trovato</div>'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="label-sm">Tipo Appuntamento</label>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${appointmentTypes.map(t => {
                const selected = formState.types.has(t.id);
                return `<div class="type-pill ${selected ? 'selected' : ''}" data-id="${t.id}" style="padding: 6px 12px; border-radius: 20px; border: 1px solid ${t.color}; color: ${selected ? 'white' : t.color}; background: ${selected ? t.color : 'transparent'}; cursor: pointer; font-size: 0.85rem; font-weight: 500;">${t.name}</div>`;
            }).join('')}
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group"><label class="label-sm">Inizio *</label><input type="datetime-local" name="start_time" required value="${formState.start_time}" class="input-modern"></div>
                        <div class="form-group"><label class="label-sm">Fine *</label><input type="datetime-local" name="end_time" required value="${formState.end_time}" class="input-modern"></div>
                    </div>

                    <div class="form-group"><label class="label-sm">Posizione</label><input type="text" name="location" value="${formState.location}" class="input-modern" placeholder="Indirizzo o Link..."></div>
                    <div class="form-group"><label class="label-sm">Note</label><textarea name="note" class="input-modern" style="min-height: 80px;">${formState.note}</textarea></div>

                </form>
            </div>

            <div class="drawer-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--surface-2); display: flex; justify-content: flex-end; gap: 0.75rem; align-items: center;">
                ${!isCreate ? `<button type="button" id="delete-btn" class="icon-btn" style="margin-right: auto; color: #ef4444;"><span class="material-icons-round">delete</span></button>` : ''}
                <button type="button" class="secondary-btn" id="cancel-btn">Annulla</button>
                <button type="button" id="save-btn" class="primary-btn">${isCreate ? 'Crea' : 'Salva'}</button>
            </div>
        `;
        attachEditListeners();
    };

    const attachEditListeners = () => {
        const ctxTrigger = drawer.querySelector('#context-picker-trigger');
        const ctxDropdown = drawer.querySelector('#context-picker-dropdown');
        const ctxSearch = drawer.querySelector('#context-search');
        const ctxList = drawer.querySelector('#context-options-list');

        if (ctxTrigger && ctxDropdown) {
            ctxTrigger.onclick = () => { ctxDropdown.classList.toggle('hidden'); if (!ctxDropdown.classList.contains('hidden')) { ctxSearch.focus(); renderContextOptions(); } };
            ctxSearch.oninput = () => renderContextOptions(ctxSearch.value);
            function renderContextOptions(filter = '') {
                const query = filter.toLowerCase();
                const orders = (state.orders || []).filter(o => {
                    const statusOffer = (o.offer_status || '').toLowerCase();
                    const statusWork = (o.status_works || '').toLowerCase();
                    const isActive = statusOffer !== 'offerta rifiutata' && (statusOffer === 'offerta accettata' ? statusWork !== 'completato' : true);
                    const matchesSearch = `#${o.order_number} ${o.title}`.toLowerCase().includes(query) || o.clients?.business_name?.toLowerCase().includes(query);
                    const matchesClient = formState.client_id ? o.client_id === formState.client_id : true;
                    return isActive && matchesSearch && matchesClient;
                }).slice(0, 50);
                const clients = (state.clients || []).filter(c => c.business_name.toLowerCase().includes(query)).slice(0, 15);
                const clusters = (state.pm_spaces || []).filter(s => s.type === 'interno' && s.is_cluster && s.name.toLowerCase().includes(query)).slice(0, 50);
                const projects = (state.pm_spaces || []).filter(s => s.type === 'interno' && !s.is_cluster && s.name.toLowerCase().includes(query)).slice(0, 50);

                let html = '';
                if (clients.length > 0 && !formState.client_id) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid var(--surface-2); margin-top: 4px;">CLIENTI</div>`;
                    clients.forEach(c => {
                        html += `<div class="ctx-option" data-id="${c.id}" data-type="client" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 16px; color: #f59e0b;">person</span><span style="font-size: 0.85rem;">${c.business_name}</span></div>`;
                    });
                }

                if (clusters.length > 0) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid var(--surface-2); margin-top: 4px;">CLUSTER</div>`;
                    clusters.forEach(s => {
                        html += `<div class="ctx-option" data-id="${s.id}" data-type="space" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 16px; color: var(--brand-purple);">folder_special</span><span style="font-size: 0.85rem;">${s.name}</span></div>`;
                    });
                }

                if (projects.length > 0) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid var(--surface-2); margin-top: 4px;">PROGETTI INTERNI</div>`;
                    projects.forEach(s => {
                        const parent = state.pm_spaces?.find(p => p.id === s.parent_ref);
                        html += `
                            <div class="ctx-option" data-id="${s.id}" data-type="space" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                <span class="material-icons-round" style="font-size: 16px; color: var(--brand-purple); opacity: 0.7;">folder</span>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-size: 0.85rem;">${s.name}</span>
                                    ${parent ? `<span style="font-size: 0.7rem; color: var(--text-tertiary);">Cluster: ${parent.name}</span>` : ''}
                                </div>
                            </div>`;
                    });
                }

                if (orders.length > 0) {
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid var(--surface-2); margin-top: 4px;">COMMESSE ATTIVE</div>`;
                    orders.forEach(o => {
                        html += `<div class="ctx-option" data-id="${o.id}" data-type="order" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="font-size: 16px; color: var(--brand-blue);">style</span><div style="display: flex; flex-direction: column;"><span style="font-size: 0.85rem;">#${o.order_number} ${o.title}</span><span style="font-size: 0.7rem; color: var(--text-tertiary);">${o.clients?.business_name || ''}</span></div></div>`;
                    });
                }
                ctxList.innerHTML = html || '<div style="padding: 1rem; color: var(--text-tertiary);">Nessun risultato</div>';
                ctxList.querySelectorAll('.ctx-option').forEach(opt => {
                    opt.onclick = () => {
                        const type = opt.dataset.type;
                        const id = opt.dataset.id;
                        if (type === 'client') { formState.client_id = id; formState.context_id = null; }
                        else { formState.context_id = id; formState.context_type = type; if (type === 'order') { const o = state.orders?.find(x => x.id === id); if (o) formState.client_id = o.client_id; } }
                        refreshContacts();
                        renderEditMode();
                    };
                });
            }
            const clearBtn = drawer.querySelector('#clear-context-btn');
            if (clearBtn) { clearBtn.onclick = () => { formState.client_id = null; formState.context_id = null; refreshContacts(); renderEditMode(); }; }
        }

        drawer.querySelector('.close-drawer-btn').onclick = () => { if (isCreate) overlay.classList.add('hidden'); else { viewMode = true; render(); } };
        drawer.querySelector('#cancel-btn').onclick = () => { if (isCreate) overlay.classList.add('hidden'); else { viewMode = true; render(); } };

        drawer.querySelectorAll('.type-pill').forEach(pill => {
            pill.onclick = () => {
                const tid = pill.dataset.id;
                if (formState.types.has(tid)) formState.types.delete(tid);
                else formState.types.add(tid);
                renderEditMode();
            };
        });

        // Participants Pickers
        const addIntBtn = drawer.querySelector('#add-int-btn');
        const intPicker = drawer.querySelector('#int-picker');
        if (addIntBtn) addIntBtn.onclick = (e) => { e.stopPropagation(); intPicker.classList.toggle('hidden'); };
        drawer.querySelectorAll('.int-opt').forEach(opt => {
            opt.onclick = () => {
                const cid = opt.dataset.id;
                if (!formState.participants.internal.find(p => p.collaborator_id === cid)) {
                    formState.participants.internal.push({ collaborator_id: cid, role: 'participant', status: 'pending' });
                    renderEditMode();
                }
            };
        });
        drawer.querySelectorAll('.remove-int-btn').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); formState.participants.internal.splice(btn.dataset.idx, 1); renderEditMode(); };
        });

        const addCliBtn = drawer.querySelector('#add-cli-btn');
        const cliPicker = drawer.querySelector('#cli-picker');
        if (addCliBtn) addCliBtn.onclick = (e) => { e.stopPropagation(); cliPicker.classList.toggle('hidden'); };
        drawer.querySelectorAll('.cli-opt').forEach(opt => {
            opt.onclick = () => {
                const cid = opt.dataset.id;
                if (!formState.participants.client.find(p => p.contact_id === cid)) {
                    formState.participants.client.push({ contact_id: cid });
                    renderEditMode();
                }
            };
        });
        drawer.querySelectorAll('.remove-cli-btn').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); formState.participants.client.splice(btn.dataset.idx, 1); renderEditMode(); };
        });

        drawer.querySelectorAll('input, select, textarea').forEach(el => {
            el.onchange = (e) => { if (formState.hasOwnProperty(e.target.name)) formState[e.target.name] = e.target.value; };
        });

        drawer.querySelector('#save-btn').onclick = async () => {
            const btn = drawer.querySelector('#save-btn');
            btn.disabled = true;
            try {
                const payload = {
                    id: isCreate ? undefined : appointment.id,
                    order_id: formState.context_type === 'order' ? formState.context_id : null,
                    pm_space_id: formState.context_type === 'space' ? formState.context_id : null,
                    client_id: formState.client_id,
                    title: formState.title,
                    start_time: new Date(formState.start_time).toISOString(),
                    end_time: new Date(formState.end_time).toISOString(),
                    location: formState.location,
                    mode: formState.mode,
                    status: formState.status,
                    note: formState.note,
                    types: Array.from(formState.types),
                    internal_participants: formState.participants.internal,
                    client_participants: formState.participants.client
                };
                const saved = await saveAppointment(payload);
                appointment = saved;
                viewMode = true;
                const detail = { refId: formState.context_id };
                document.dispatchEvent(new CustomEvent('appointment-changed', { detail }));
                render();
            } catch (err) { alert("Errore: " + err.message); btn.disabled = false; }
        };

        const delBtn = drawer.querySelector('#delete-btn');
        if (delBtn) {
            delBtn.onclick = async () => {
                if (!confirm("Eliminare?")) return;
                await deleteAppointment(appointment.id);
                overlay.classList.add('hidden');
                document.dispatchEvent(new CustomEvent('appointment-changed', { detail: { id: appointment.id } }));
            };
        }
    };

    render();
    overlay.classList.remove('hidden');
}
