import { saveAppointment, deleteAppointment, fetchAppointmentTypes } from '../../../modules/pm_api.js';
import { fetchContacts } from '../../../modules/api.js';
import { state } from '../../../modules/state.js';
import { renderUserPicker } from './picker_utils.js?v=1000';
import { supabase } from '../../../modules/config.js';
import { renderAvatar, joinNames } from '../../../modules/utils.js?v=1000';

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

    const { defaultRole = 'organizer', defaultNote = '', is_account_level = false } = options;

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
        status: appointment?.status || 'confermato',
        note: appointment?.note || defaultNote,
        is_account_level: appointment?.is_account_level ?? is_account_level,
        types: appointment?.types?.map(t => t.id) || [],
        participants: {
            internal: appointment?.participants?.internal || [],
            client: appointment?.participants?.client || []
        },
        context_id: targetId,
        context_type: targetType,
        client_id: appointment?.client_id || null,
        // Recurrence State
        rec_freq: '',
        rec_interval: 1,
        rec_unit: 'day',
        rec_start: '',
        rec_until: '',
        rec_limit_active: false,
        rec_limit_count: 0,
        rec_advance_active: false,
        rec_advance_count: 1
    };
    refreshContacts();

    const render = () => {
        if (viewMode) {
            const types = appointment.types || [];
            drawer.innerHTML = `
                <div class="drawer-header" style="padding: 1.25rem 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: white; flex-shrink: 0; position: sticky; top: 0; z-index: 10;">
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-primary); letter-spacing: -0.01em; font-family: var(--font-titles);">Dettagli Appuntamento</h2>
                    <button class="icon-btn close-drawer-btn" style="width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 20px;">close</span></button>
                </div>
                <div class="drawer-body" style="flex: 1; overflow-y: auto; padding: 2rem 2rem;">
                    <div style="display: flex; flex-direction: column; gap: 1.75rem; max-width: 580px; margin: 0 auto;">
                         <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem;">Titolo</label>
                            <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${appointment.title}</div>
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem;">Inizio</label>
                                <div style="font-weight: 500;">${new Date(appointment.start_time).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem;">Fine</label>
                                <div style="font-weight: 500;">${new Date(appointment.end_time).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                            </div>
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem;">Tipi</label>
                            <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                                ${types.map(t => `<span style="padding: 4px 12px; border-radius: 20px; background: ${t.color}15; color: ${t.color}; font-size: 0.75rem; font-weight: 700; border: 1px solid ${t.color}30;">${t.name}</span>`).join('') || '<span style="color: var(--text-tertiary); font-style: italic;">Nessun tipo</span>'}
                            </div>
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem;">Partecipanti Interni</label>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    ${formState.participants.internal.map(p => {
                const collab = state.collaborators?.find(c => c.id === p.collaborator_id);
                return `<div style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: white; border: 1.2px solid #e2e8f0; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                                            <img src="${collab?.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(collab?.full_name || 'U')}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
                                            <span>${collab?.full_name && collab.full_name !== 'null' ? collab.full_name : joinNames(collab?.first_name, collab?.last_name) || 'User'}</span>
                                        </div>`;
            }).join('') || '<span style="color: var(--text-tertiary); font-size: 0.85rem;">Nessuno</span>'}
                                </div>
                            </div>
                            <div class="form-group">
                                <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem;">Contatti Cliente</label>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    ${formState.participants.client.map(p => {
                const contact = state.contacts?.find(c => c.id === p.contact_id);
                return `<div style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: white; border: 1.2px solid #e2e8f0; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">
                                            <span class="material-icons-round" style="font-size: 16px; color: var(--text-tertiary);">person</span>
                                            <span>${contact?.name || 'Contatto'}</span>
                                        </div>`;
            }).join('') || '<span style="color: var(--text-tertiary); font-size: 0.85rem;">Nessuno</span>'}
                                </div>
                            </div>
                        </div>

                        <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                        <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem;">Descrizione o Note</label>
                            <div style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.6; white-space: pre-wrap;">${appointment.note || '-'}</div>
                        </div>
                    </div>
                </div>
                <div class="drawer-footer" style="padding: 1.25rem 2rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; background: white; flex-shrink: 0; position: sticky; bottom: 0; z-index: 10;">
                    <button type="button" class="secondary-btn" id="edit-btn" style="padding: 0.6rem 1.25rem; font-weight: 500; border-radius: 8px; border: 1.2px solid #e2e8f0; background: white; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;">Modifica</button>
                    <button type="button" class="primary-btn close-drawer-btn" style="padding: 0.6rem 1.5rem; font-weight: 600; border-radius: 8px; background: var(--brand-blue); color: white; border: none; cursor: pointer; transition: all 0.2s;">Chiudi</button>
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
            <div class="drawer-header" style="padding: 1.25rem 2rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: white; flex-shrink: 0; position: sticky; top: 0; z-index: 10;">
                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-primary); letter-spacing: -0.01em; font-family: var(--font-titles);">${isCreate ? 'Nuovo' : 'Modifica'} Appuntamento</h2>
                <button class="icon-btn close-drawer-btn" style="width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 20px;">close</span></button>
            </div>

            <div class="drawer-body" style="flex: 1; overflow-y: auto; padding: 1.5rem 2rem;">
                <form id="appt-form" style="display: flex; flex-direction: column; gap: 1.75rem; max-width: 580px; margin: 0 auto;">
                    
                    <!-- Context Selection -->
                    ${!targetId && !formState.client_id ? `
                    <div class="form-group">
                        <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Progetto o Commessa</label>
                        <div style="position: relative;">
                            <div id="context-picker-trigger" style="
                                padding: 0 14px; height: 44px; background: #f8fafc; border: 1.2px solid #e2e8f0; border-radius: 10px; 
                                font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                                transition: all 0.2s;
                            ">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">
                                        search
                                    </span>
                                    <span style="color: var(--text-tertiary);">
                                        Cerca Progetto, Commessa o Cliente...
                                    </span>
                                </div>
                                <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">expand_more</span>
                            </div>
                            <div id="context-picker-dropdown" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; width: 100%; z-index: 1000; background: white; border: 1.2px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.12); padding: 10px;">
                                <div style="display: flex; gap: 8px; margin-bottom: 8px;"><input type="text" id="context-search" placeholder="Filtra..." class="input-modern" style="flex: 1; font-size: 0.85rem; height: 36px; padding: 0 12px; border-radius: 8px; border: 1.2px solid #e2e8f0;"><button type="button" id="clear-context-btn" title="Rimuovi associazione" style="background: #f8fafc; border: 1.2px solid #e2e8f0; border-radius: 8px; padding: 0 8px; cursor: pointer; color: var(--text-tertiary);"><span class="material-icons-round" style="font-size: 18px;">backspace</span></button></div>
                                <div id="context-options-list" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;"></div>
                            </div>
                        </div>
                    </div>

                    <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>
                    ` : ''}

                    <div class="form-group">
                        <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Titolo</label>
                        <input type="text" name="title" required value="${formState.title}" class="input-modern" style="height: 44px; padding: 0 14px; border-radius: 10px; font-weight: 500; font-size: 1rem; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; background: white;">
                    </div>

                    <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                    <!-- Participants -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Partecipanti Interni</label>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px; border: 1.2px solid #e2e8f0; border-radius: 10px; min-height: 44px; background: white;">
                                ${formState.participants.internal.map((p, idx) => {
            const collab = state.collaborators?.find(c => c.id === p.collaborator_id);
            return `<div class="pill" style="display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; border: 1.2px solid #e2e8f0; color: var(--text-primary);">
                                        <span>${collab?.full_name && collab.full_name !== 'null' ? collab.full_name : joinNames(collab?.first_name, collab?.last_name) || 'User'}</span>
                                        <span class="material-icons-round remove-int-btn" data-idx="${idx}" style="font-size: 14px; cursor: pointer; color: var(--text-tertiary);">close</span>
                                    </div>`;
        }).join('')}
                                <div style="position: relative;">
                                    <button type="button" id="add-int-btn" style="width: 28px; height: 28px; border-radius: 50%; border: 1px dashed var(--brand-blue); background: transparent; color: var(--brand-blue); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 16px;">add</span></button>
                                    <div id="int-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; min-width: 220px; z-index: 1000; max-height: 250px; overflow-y: auto; background: white; border: 1.2px solid #e2e8f0; padding: 6px; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.12);">
                                        ${state.collaborators?.map(c => `<div class="picker-opt int-opt" data-id="${c.id}" style="padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; transition: background 0.2s;">
                                            <img src="${c.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.full_name)}" style="width: 20px; height: 20px; border-radius: 50%;">
                                            <span style="font-weight: 500;">${c.full_name}</span>
                                        </div>`).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Contatti Cliente</label>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px; border: 1.2px solid #e2e8f0; border-radius: 10px; min-height: 44px; background: white;">
                                ${formState.participants.client.map((p, idx) => {
            const contact = state.contacts?.find(c => c.id === p.contact_id);
            return `<div class="pill" style="display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; border: 1.2px solid #e2e8f0; color: var(--text-primary);">
                                        <span>${contact?.name || 'Contatto'}</span>
                                        <span class="material-icons-round remove-cli-btn" data-idx="${idx}" style="font-size: 14px; cursor: pointer; color: var(--text-tertiary);">close</span>
                                    </div>`;
        }).join('')}
                                <div style="position: relative;">
                                    <button type="button" id="add-cli-btn" style="width: 28px; height: 28px; border-radius: 50%; border: 1px dashed var(--brand-blue); background: transparent; color: var(--brand-blue); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 16px;">add</span></button>
                                    <div id="cli-picker" class="hidden glass-card" style="position: absolute; top: calc(100% + 6px); left: 0; min-width: 220px; z-index: 1000; max-height: 250px; overflow-y: auto; background: white; border: 1.2px solid #e2e8f0; padding: 6px; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.12);">
                                        ${clientContacts.length > 0 ? clientContacts.map(c => `<div class="picker-opt cli-opt" data-id="${c.id}" style="padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s; font-weight: 500;">${c.name}</div>`).join('') : '<div style="padding: 12px; font-size: 0.85rem; color: var(--text-tertiary); font-style: italic; text-align: center;">Nessun contatto trovato</div>'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                    <div class="form-group">
                        <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.6rem;">Tipo Appuntamento</label>
                        <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                            ${appointmentTypes.map(t => {
            const selected = formState.types.has(t.id);
            return `<div class="type-pill ${selected ? 'selected' : ''}" data-id="${t.id}" style="padding: 6px 14px; border-radius: 20px; border: 1.5px solid ${t.color}; color: ${selected ? 'white' : t.color}; background: ${selected ? t.color : 'transparent'}; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.2s;">${t.name}</div>`;
        }).join('') || '<span style="color: var(--text-tertiary); font-size: 0.85rem; font-style: italic;">Nessun tipo disponibile</span>'}
                        </div>
                    </div>

                    <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Inizio</label>
                            <input type="datetime-local" name="start_time" required value="${formState.start_time}" class="input-modern" style="height: 44px; padding: 0 14px; border-radius: 10px; font-weight: 500; font-size: 0.95rem; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; background: white;">
                        </div>
                        <div class="form-group">
                            <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Fine</label>
                            <input type="datetime-local" name="end_time" required value="${formState.end_time}" class="input-modern" style="height: 44px; padding: 0 14px; border-radius: 10px; font-weight: 500; font-size: 0.95rem; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; background: white;">
                        </div>
                    </div>

                    <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                    <!-- Recurrence -->
                    ${isCreate ? `
                    <div class="recurrence-section">
                        <button type="button" id="toggle-recurrence-btn" style="
                            width: 100%; padding: 0.75rem 1rem; background: #f8fafc; border: 1.2px solid #e2e8f0; 
                            border-radius: 10px; display: flex; align-items: center; justify-content: space-between;
                            cursor: pointer; transition: all 0.2s;
                        ">
                            <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-weight: 500; font-size: 0.85rem;">
                                <span class="material-icons-round" style="font-size: 18px; color: var(--brand-blue);">cached</span>
                                Pianifica come Ricorrente
                            </div>
                            <span class="material-icons-round toggle-icon" style="color: var(--text-tertiary); transition: transform 0.3s;">expand_more</span>
                        </button>
                        
                        <div id="recurrence-settings-content" class="hidden" style="
                            padding: 1.5rem; background: #fff; border: 1.2px solid #e2e8f0; border-top: none; 
                            border-bottom-left-radius: 10px; border-bottom-right-radius: 10px; margin-top: -1px;
                        ">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.25rem;">
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Frequenza</label>
                                    <select name="rec_freq" style="height: 38px; width: 100%; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 8px; font-size: 0.9rem;">
                                        <option value="">Nessuna</option>
                                        <option value="DAILY">Ogni giorno</option>
                                        <option value="WEEKLY">Ogni settimana</option>
                                        <option value="MONTHLY">Ogni mese</option>
                                        <option value="YEARLY">Ogni anno</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Ogni quanto</label>
                                    <div style="display: flex; gap: 8px;">
                                        <input type="number" name="rec_interval" value="1" min="1" style="width: 50px; height: 38px; text-align: center; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0;">
                                        <select name="rec_unit" style="flex: 1; height: 38px; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 8px; font-size: 0.85rem;">
                                            <option value="day">giorno</option>
                                            <option value="workday">giorno lav.</option>
                                            <option value="week">settimana</option>
                                            <option value="month">mese</option>
                                            <option value="year">anno</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.25rem;">
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Dalla data</label>
                                    <div id="form-rec-start-trigger" style="cursor: pointer; display: flex; align-items: center; gap: 8px; height: 38px; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 10px; font-size: 0.9rem; background: white;">
                                        <span class="material-icons-round" style="font-size: 16px; color: var(--text-tertiary);">event</span>
                                        <span class="val" style="color: var(--text-primary); font-weight: 500;">Seleziona...</span>
                                        <input type="hidden" name="rec_start">
                                    </div>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.4rem;">Fino al</label>
                                    <div id="form-rec-until-trigger" style="cursor: pointer; display: flex; align-items: center; gap: 8px; height: 38px; border-radius: 8px; border: 1.2px solid #e2e8f0; padding: 0 10px; font-size: 0.9rem; background: white;">
                                        <span class="material-icons-round" style="font-size: 16px; color: var(--text-tertiary);">event_available</span>
                                        <span class="val" style="color: var(--text-primary); font-weight: 500;">Senza fine</span>
                                        <input type="hidden" name="rec_until">
                                    </div>
                                </div>
                            </div>

                            <div style="height: 1px; background: #f1f5f9; margin: 1.25rem 0;"></div>

                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; flex-direction: column;">
                                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Termina dopo</span>
                                        <span style="font-size: 0.7rem; color: var(--text-tertiary);">Numero massimo di ricorrenze</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <input type="checkbox" name="rec_limit_active" style="width: 18px; height: 18px; cursor: pointer;">
                                        <input type="number" name="rec_limit_count" value="10" min="1" style="width: 60px; height: 32px; text-align: center; border-radius: 6px; border: 1.2px solid #e2e8f0;">
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; flex-direction: column;">
                                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Crea in anticipo</span>
                                        <span style="font-size: 0.7rem; color: var(--text-tertiary);">Quanti eventi creare subito</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <input type="checkbox" name="rec_advance_active" style="width: 18px; height: 18px; cursor: pointer;">
                                        <input type="number" name="rec_advance_count" value="5" min="1" style="width: 60px; height: 32px; text-align: center; border-radius: 6px; border: 1.2px solid #e2e8f0;">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>
                    ` : ''}

                    <div class="form-group">
                        <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Posizione</label>
                        <input type="text" name="location" value="${formState.location}" class="input-modern" placeholder="Indirizzo o Link..." style="height: 44px; padding: 0 14px; border-radius: 10px; font-weight: 500; font-size: 0.95rem; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; background: white;">
                    </div>

                    <div style="height: 1px; background: #f1f5f9; margin: 0.5rem 0;"></div>

                    <div class="form-group">
                        <label style="display: block; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem;">Note</label>
                        <textarea name="note" class="input-modern" style="min-height: 100px; padding: 12px; font-size: 0.95rem; line-height: 1.6; border-radius: 10px; border: 1.2px solid #e2e8f0; width: 100%; box-sizing: border-box; resize: vertical; background: white;" placeholder="Aggiungi dettagli...">${formState.note}</textarea>
                    </div>

                </form>
            </div>

            <div class="drawer-footer" style="padding: 1.25rem 2rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem; background: white; flex-shrink: 0; position: sticky; bottom: 0; z-index: 10; align-items: center;">
                ${!isCreate ? `<button type="button" id="delete-btn" class="icon-btn" style="width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: white; border: 1.2px solid #fee2e2; color: #ef4444; cursor: pointer; transition: all 0.2s; margin-right: auto;"><span class="material-icons-round" style="font-size: 1.2rem;">delete_outline</span></button>` : ''}
                <button type="button" class="secondary-btn" id="cancel-btn" style="padding: 0.6rem 1.25rem; font-weight: 500; border-radius: 8px; border: 1.2px solid #e2e8f0; background: white; color: var(--text-secondary); cursor: pointer; transition: all 0.2s;">Annulla</button>
                <button type="button" id="save-btn" class="primary-btn" style="padding: 0.6rem 1.5rem; font-weight: 600; border-radius: 8px; background: var(--brand-blue); color: white; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(78, 146, 216, 0.2);">${isCreate ? 'Crea Appuntamento' : 'Salva Modifiche'}</button>
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
            ctxTrigger.onclick = (e) => {
                e.stopPropagation();
                const isHidden = ctxDropdown.classList.toggle('hidden');
                if (!isHidden) {
                    ctxSearch.focus();
                    renderContextOptions();
                    // Close others
                    drawer.querySelectorAll('.glass-card, #int-picker, #cli-picker').forEach(el => {
                        if (el !== ctxDropdown) el.classList.add('hidden');
                    });
                }
            };
            ctxSearch.onclick = (e) => e.stopPropagation();
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
                    html += `<div style="padding: 12px 8px 4px; font-size: 0.65rem; color: var(--text-tertiary); font-weight: 700; border-top: 1px solid #e2e8f0; margin-top: 4px;">COMMESSE ATTIVE</div>`;
                    orders.forEach(o => {
                        html += `<div class="ctx-option" data-id="${o.id}" data-type="order" style="padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"><span class="material-icons-round" style="font-size: 16px; color: var(--brand-blue);">style</span><div style="display: flex; flex-direction: column;"><span style="font-size: 0.85rem; font-weight: 500;">#${o.order_number} ${o.title}</span><span style="font-size: 0.7rem; color: var(--text-tertiary);">${o.clients?.business_name || ''}</span></div></div>`;
                    });
                }
                ctxList.innerHTML = html || '<div style="padding: 1rem; color: var(--text-tertiary); font-style: italic; text-align: center; font-size: 0.85rem;">Nessun risultato</div>';
                ctxList.querySelectorAll('.ctx-option').forEach(opt => {
                    opt.onmouseover = () => opt.style.background = '#f8fafc';
                    opt.onmouseout = () => opt.style.background = 'transparent';
                    opt.onclick = (e) => {
                        e.stopPropagation();
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
        if (addIntBtn) {
            addIntBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = intPicker.classList.toggle('hidden');
                if (!isHidden) {
                    // Close others
                    drawer.querySelectorAll('.glass-card, #cli-picker, #context-picker-dropdown').forEach(el => {
                        if (el !== intPicker) el.classList.add('hidden');
                    });
                }
            };
        }
        drawer.querySelectorAll('.int-opt').forEach(opt => {
            opt.onmouseover = () => opt.style.background = '#f8fafc';
            opt.onmouseout = () => opt.style.background = 'transparent';
            opt.onclick = (e) => {
                e.stopPropagation();
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
        if (addCliBtn) {
            addCliBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = cliPicker.classList.toggle('hidden');
                if (!isHidden) {
                    // Close others
                    drawer.querySelectorAll('.glass-card, #int-picker, #context-picker-dropdown').forEach(el => {
                        if (el !== cliPicker) el.classList.add('hidden');
                    });
                }
            };
        }
        drawer.querySelectorAll('.cli-opt').forEach(opt => {
            opt.onmouseover = () => opt.style.background = '#f8fafc';
            opt.onmouseout = () => opt.style.background = 'transparent';
            opt.onclick = (e) => {
                e.stopPropagation();
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

        const setupFormDate = (triggerId, hiddenName) => {
            const trigger = drawer.querySelector(`#${triggerId}`);
            if (trigger) {
                trigger.onclick = () => {
                    const input = document.createElement('input');
                    input.type = 'date';
                    input.onchange = () => {
                        trigger.querySelector('.val').innerText = new Date(input.value).toLocaleDateString('it-IT');
                        trigger.querySelector('input').value = input.value;
                    };
                    input.click();
                };
            }
        };
        setupFormDate('form-rec-start-trigger', 'rec_start');
        setupFormDate('form-rec-until-trigger', 'rec_until');

        // Recurrence Toggle Logic
        const toggleBtn = drawer.querySelector('#toggle-recurrence-btn');
        const recurrenceContent = drawer.querySelector('#recurrence-settings-content');
        if (toggleBtn && recurrenceContent) {
            toggleBtn.onclick = () => {
                const isHidden = recurrenceContent.classList.toggle('hidden');
                const icon = toggleBtn.querySelector('.toggle-icon');
                if (icon) {
                    icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                }
                toggleBtn.style.borderBottomLeftRadius = isHidden ? '10px' : '0';
                toggleBtn.style.borderBottomRightRadius = isHidden ? '10px' : '0';
            };
        }

        // Global Click-Outside Listener for Appointment Drawer
        const closeAllPickers = (e) => {
            const dropdowns = drawer.querySelectorAll('.glass-card, #int-picker, #cli-picker, #context-picker-dropdown');
            dropdowns.forEach(el => {
                if (!el.classList.contains('hidden') && !el.contains(e.target)) {
                    el.classList.add('hidden');
                }
            });
        };
        drawer.removeEventListener('click', closeAllPickers);
        drawer.addEventListener('click', closeAllPickers);

        drawer.querySelectorAll('input, select, textarea').forEach(el => {
            el.onchange = (e) => { if (formState.hasOwnProperty(e.target.name)) formState[e.target.name] = e.target.value; };
        });

        drawer.querySelector('#save-btn').onclick = async () => {
            const btn = drawer.querySelector('#save-btn');
            btn.disabled = true;
            try {
                const rawData = Object.fromEntries(new FormData(drawer.querySelector('#appt-form')).entries());

                const payload = {
                    id: isCreate ? undefined : appointment.id,
                    order_id: formState.context_type === 'order' ? formState.context_id : null,
                    pm_space_id: formState.context_type === 'space' ? formState.context_id : null,
                    client_id: formState.client_id,
                    title: rawData.title,
                    start_time: new Date(rawData.start_time).toISOString(),
                    end_time: new Date(rawData.end_time).toISOString(),
                    location: rawData.location,
                    mode: formState.mode,
                    status: formState.status,
                    note: rawData.note,
                    is_account_level: formState.is_account_level,
                    types: Array.from(formState.types),
                    internal_participants: formState.participants.internal,
                    client_participants: formState.participants.client
                };

                // Build recurrence rule if any
                if (rawData.rec_freq) {
                    const rule = {
                        freq: rawData.rec_freq,
                        interval: parseInt(rawData.rec_interval) || 1,
                        unit: rawData.rec_unit || 'day'
                    };

                    if (rawData.rec_until) rule.until = rawData.rec_until;

                    if (rawData.rec_limit_active === 'on') {
                        rule.count = parseInt(rawData.rec_limit_count) || 0;
                    }

                    if (rawData.rec_advance_active === 'on') {
                        rule.create_advance = parseInt(rawData.rec_advance_count) || 1;
                    } else {
                        rule.create_advance = 1;
                    }

                    payload.recurrence_rule = rule;

                    if (rawData.rec_start) {
                        const startD = new Date(rawData.start_time);
                        const endD = new Date(rawData.end_time);
                        const duration = endD - startD;

                        const newStart = new Date(rawData.rec_start);
                        newStart.setHours(startD.getHours(), startD.getMinutes());

                        payload.start_time = newStart.toISOString();
                        payload.end_time = new Date(newStart.getTime() + duration).toISOString();
                    }
                }
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
