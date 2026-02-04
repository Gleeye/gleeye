import { state } from '../modules/state.js?v=156';
import { fetchAppointment } from '../modules/pm_api.js?v=156';
import { fetchCollaborators } from '../modules/api.js?v=156';

// Shared Event Detail Modal Logic
export async function openEventDetails(event) {
    console.log("[AgendaUtils] Opening details for event:", event);

    const isAppt = event.type === 'appointment' || event.isAppointment; // Handle both structures
    const start = new Date(event.start_time || event.start); // Handle both structures
    const end = new Date(event.end_time || event.end || event.start);

    // Formatting
    const dateStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = `${start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    const capDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    // Common Modal Structure (Backbone)
    const modalId = 'event-detail-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const title = isAppt ? (event.title || 'Appuntamento') : (event.booking_items?.name || 'Prenotazione');
    const modalTitle = isAppt ? 'Dettagli Appuntamento' : 'Dettagli Prenotazione';

    // 1. HEADER (Fixed)
    const headerHtml = `
        <div class="modal-header" style="flex: 0 0 auto; display:flex !important; justify-content:space-between !important; align-items:flex-start !important; margin-bottom: 0; padding-bottom: 1rem; border-bottom: 1px solid var(--glass-border); width: 100%;">
            <div style="text-align: left !important; flex: 1;">
                <h3 style="margin:0; font-size:1.1rem; color:var(--text-primary); font-family:var(--font-titles); line-height: 1.3; text-align: left !important;">${modalTitle}</h3>
                ${isAppt ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; text-align: left !important;">${dateStr}</div>` : ''}
            </div>
            <button class="icon-btn" onclick="closeEventModal()" style="margin-left: 1rem; flex: 0 0 auto;">
                <span class="material-icons-round">close</span>
            </button>
        </div>
    `;

    // 2. BODY (Scrollable)
    let bodyHtml = '';

    if (isAppt) {
        // --- APPOINTMENT BODY (V269 GRID LAYOUT) ---
        const accentColor = event.color || '#a855f7';
        const clientName = event.orders?.clients?.business_name || event.client_name || '-';
        const orderRef = event.orders ? `#${event.orders.order_number} ${event.orders.title}` : '';
        const status = event.status || 'programmato';

        // Badge Status
        let statusBg = '#e2e8f0'; let statusColor = '#64748b';
        if (status === 'confermato') { statusBg = '#dcfce7'; statusColor = '#16a34a'; }
        if (status === 'annullato') { statusBg = '#fee2e2'; statusColor = '#dc2626'; }
        if (status === 'bozza') { statusBg = '#fef9c3'; statusColor = '#ca8a04'; }

        bodyHtml = `
            <div id="appt-modal-content-loader" style="display: flex; justify-content: center; padding: 2rem;">
                <div class="loader"></div>
            </div>
            
            <div id="appt-modal-content" style="display: none; flex-direction: column; gap: 1rem; padding-top: 1rem;">
                
                <!-- Main Info Card (Full Width) -->
                <div style="background: white; border: 1px solid var(--glass-border); border-radius: 12px; padding: 1rem; border-left: 4px solid ${accentColor}; box-shadow: var(--shadow-sm);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <span class="badge" style="background: ${statusBg}; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.6rem; padding: 2px 6px;">${status}</span>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.4rem;">
                           ${timeStr}
                        </div>
                    </div>
                    <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); line-height: 1.4; text-align: left !important;">${title}</div>
                </div>

                <!-- GRIGLIA 2 COLONNE (Context & Details) -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    
                    <!-- Col 1: Cliente -->
                    <div class="glass-card" style="padding: 0.75rem; display: flex; align-items: flex-start; gap: 0.75rem;">
                        <div style="width: 32px; height: 32px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                             <span class="material-icons-round" style="font-size: 16px; color: var(--text-tertiary);">business</span>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-tertiary); text-align: left;">Cliente</div>
                            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: normal; line-height: 1.3; text-align: left;" title="${clientName}">${clientName}</div>
                        </div>
                    </div>

                    <!-- Col 2: Commessa -->
                    <div class="glass-card" style="padding: 0.75rem; display: flex; align-items: flex-start; gap: 0.75rem;">
                         <div style="width: 32px; height: 32px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                             <span class="material-icons-round" style="font-size: 16px; color: var(--text-tertiary);">style</span>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-tertiary); text-align: left;">Commessa</div>
                            <div style="font-size: 0.85rem; font-weight: 600; color: var(--brand-blue); white-space: normal; line-height: 1.3; text-align: left;" title="${orderRef}">${orderRef || '-'}</div>
                        </div>
                    </div>

                    <!-- Col 1: Luogo -->
                    <div class="glass-card" style="padding: 0.75rem; display: flex; align-items: flex-start; gap: 0.75rem;">
                        <div style="width: 32px; height: 32px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                          <span class="material-icons-round" style="font-size: 18px; color: var(--brand-purple);">location_on</span>
                        </div>
                        <div style="min-width: 0; flex: 1;">
                             <div style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-tertiary); text-align: left;">Luogo</div>
                             <div style="font-size: 0.85rem; color: var(--text-primary); white-space: normal; text-align: left; line-height: 1.3;">${event.location || 'Nessun luogo'}</div>
                        </div>
                    </div>

                    <!-- Col 2: Modalità -->
                     <div class="glass-card" style="padding: 0.75rem; display: flex; align-items: flex-start; gap: 0.75rem;">
                         <div style="width: 32px; height: 32px; background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                              <span class="material-icons-round" style="font-size: 18px; color: var(--text-tertiary);">videocam</span>
                         </div>
                         <div style="min-width: 0; flex: 1;">
                             <div style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-tertiary); text-align: left;">Modalità</div>
                             <div style="font-size: 0.85rem; font-weight: 500; text-align: left;">${event.mode || '-'}</div>
                        </div>
                    </div>

                </div>

                <!-- People Section (Async) - Full Width -->
                <div class="glass-card" style="padding: 1rem;">
                     <div style="font-size: 0.65rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.75rem; text-align: left;">Partecipanti</div>
                     
                     <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <!-- Internal -->
                        <div>
                            <div style="font-size: 0.6rem; color: var(--text-tertiary); margin-bottom: 4px; text-align: left;">Interni</div>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="modal-utils-internal-participants">
                                <span style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">Caricamento...</span>
                            </div>
                        </div>

                         <!-- External -->
                         <div>
                             <div style="font-size: 0.6rem; color: var(--text-tertiary); margin-bottom: 4px; text-align: left;">Referenti</div>
                             <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="modal-utils-external-participants">
                                 <span style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">Caricamento...</span>
                            </div>
                        </div>
                     </div>
                </div>

                <!-- Notes Section (MANDATORY) - Full Width -->
                <div class="glass-card" style="padding: 1rem;">
                    <div style="font-size: 0.65rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.5rem; text-align: left;">Note / Appunti</div>
                    ${event.note ? `
                        <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; text-align: left;">${event.note}</div>
                    ` : `
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic; text-align: left;">Nessuna nota presente.</div>
                    `}
                </div>
                
                <!-- Spacer for Footer safety -->
                <div style="height: 20px;"></div>
            </div>
        `;

    } else {
        // BOOKING LAYOUT (Original)
        const guestName = event.guest_info ? `${event.guest_info.first_name} ${event.guest_info.last_name || ''}` : 'Nessun ospite';
        const guestEmail = event.guest_info?.email || '-';
        const guestPhone = event.guest_info?.phone || '-';

        bodyHtml = `
            <div style="display:flex; flex-direction:column; gap:1rem; padding-top: 1rem;">
                <!-- Main Card -->
                <div style="background:var(--bg-secondary); padding:1rem; border-radius:8px; border-left: 4px solid #3b82f6;">
                    <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary); margin-bottom:0.25rem;">${title}</div>
                    <div style="font-size:0.9rem; color:var(--text-secondary); display:flex; align-items:center; gap:0.5rem;">
                            <span class="material-icons-round" style="font-size:16px;">schedule</span>
                            ${timeStr}
                    </div>
                        <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:0.25rem;">
                            ${capDate}
                    </div>
                </div>

                <!-- Client -->
                <div class="detail-section">
                    <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Cliente</h4>
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div style="width:36px; height:36px; background:#e0e7ff; color:#4f46e5; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:600;">
                            ${guestName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:500; color:var(--text-primary);">${guestName}</div>
                            <div style="font-size:0.85rem; color:var(--text-secondary);">${guestEmail}</div>
                            <div style="font-size:0.85rem; color:var(--text-secondary);">${guestPhone}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Notes -->
                <div class="detail-section">
                    <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.5rem;">Note</h4>
                    <p style="font-size:0.9rem; color:var(--text-secondary); background:var(--bg-secondary); padding:0.75rem; border-radius:6px; margin:0; line-height:1.5;">
                        ${event.notes || 'Nessuna nota.'}
                    </p>
                </div>
                
                <div style="height: 20px;"></div>
            </div>
        `;
    }

    // 3. FOOTER (Fixed) with White Background & Separation
    // Left: Delete (if appt). Right: Actions
    const footerHtml = `
        <div class="modal-footer" style="flex: 0 0 auto; display:flex !important; justify-content:space-between !important; align-items:center !important; padding-top: 1rem; border-top: 1px solid var(--glass-border); margin-top: auto; background: white; width: 100%;">
             
             <!-- Left: Delete -->
             <div style="flex: 0 0 auto; margin-right: auto;">
                 ${isAppt ? `
                     <button class="icon-btn-danger" onclick="window.deleteAppointment && window.deleteAppointment('${event.id}')" title="Elimina" style="border: 1px solid #fee2e2; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                        <span class="material-icons-round" style="font-size:18px;">delete</span>
                     </button>
                 ` : ''}
             </div>

             <!-- Right: Actions -->
             <div style="flex: 0 0 auto; display: flex; gap: 0.75rem;">
                 <button class="btn btn-secondary" onclick="closeEventModal()">Chiudi</button>
                 ${isAppt ? `
                     <button class="btn btn-primary" onclick="alert('Modifica in arrivo...')" title="Modifica" style="gap: 0.5rem; display: flex !important; align-items: center !important;">
                        <span class="material-icons-round" style="font-size:16px;">edit</span>
                        Modifica
                     </button>
                 ` : ''}
             </div>
        </div>
    `;


    // ASSEMBLE MODAL - FIXED FLEX STRUCTURE
    const modalHtml = `
        <div class="system-modal active" id="${modalId}" style="z-index: 10000; display: flex; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
            <div class="system-modal-content" style="
                display: flex; 
                flex-direction: column; 
                max-width: ${isAppt ? '700px' : '450px'}; /* Expanded Width for Appts */
                width: 90%; 
                max-height: 85vh; 
                background: white; 
                border-radius: 16px; 
                padding: 1.5rem; 
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                overflow: hidden;"> 
                
                ${headerHtml}
                
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding-right: 4px; min-height: 0;">
                    ${bodyHtml}
                </div>
                
                ${footerHtml}
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // --- ASYNC DATA FETCHING FOR APPOINTMENTS ---
    if (isAppt) {
        (async () => {
            try {
                const loader = document.getElementById('appt-modal-content-loader');
                const content = document.getElementById('appt-modal-content');

                // Fetch FULL details (participants, etc)
                const fullEvent = await fetchAppointment(event.id);
                if (!fullEvent) throw new Error("Appointment not found");

                // --- LAZY LOAD COLLABORATORS ---
                if (!state.collaborators || state.collaborators.length === 0) {
                    try {
                        await fetchCollaborators();
                    } catch (e) {
                        console.error("Failed to lazy load collaborators:", e);
                    }
                }

                // --- RENDER PARTICIPANTS ---
                const internals = fullEvent.appointment_internal_participants || [];

                const internalHtml = internals.length > 0 ? internals.map(p => {
                    // Check if P has collaborator_id directly or nested
                    const cId = p.collaborator_id;
                    const collab = state.collaborators?.find(c => c.id === cId);

                    const name = collab ? (collab.full_name || `${collab.first_name || ''} ${collab.last_name || ''}`.trim() || collab.short_name || 'Staff') : 'Staff';
                    const avatar = collab?.avatar_url;
                    const initials = name.substring(0, 2).toUpperCase();

                    return `
                        <div class="participant-chip" style="display:flex; align-items:center; gap:0.5rem; background: var(--bg-secondary); padding: 0.3rem 0.6rem; padding-right: 0.8rem; border-radius: 20px; border: 1px solid var(--glass-border);">
                            <div style="width: 24px; height: 24px; border-radius: 50%; background: #e0e7ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; overflow: hidden;">
                                ${avatar ? `<img src="${avatar}" style="width:100%; height:100%; object-fit:cover;">` : initials}
                            </div>
                            <span style="font-size: 0.8rem; font-weight: 500;">${name}</span>
                        </div>
                    `;
                }).join('') : '<span style="font-size: 0.8rem; color: var(--text-tertiary);">Nessun partecipante interno</span>';

                const internalContainer = document.getElementById('modal-utils-internal-participants');
                if (internalContainer) internalContainer.innerHTML = internalHtml;

                // Process External
                const externals = fullEvent.appointment_client_participants || [];
                const externalHtml = externals.length > 0 ? externals.map(p => {
                    return `
                         <div style="display:flex; align-items:center; gap:0.3rem; background: var(--bg-secondary); padding: 0.3rem 0.6rem; border-radius: 20px; border: 1px solid var(--glass-border);">
                            <span class="material-icons-round" style="font-size: 14px; color: var(--text-tertiary);">perm_contact_calendar</span>
                            <span style="font-size: 0.8rem;">Contatto Esterno</span> 
                        </div>
                    `;
                }).join('') : '<span style="font-size: 0.8rem; color: var(--text-tertiary);">Nessun referente esterno</span>';

                const externalContainer = document.getElementById('modal-utils-external-participants');
                if (externalContainer) externalContainer.innerHTML = externalHtml;

                // Switch View
                if (loader) loader.style.display = 'none';
                if (content) content.style.display = 'flex';

            } catch (err) {
                console.error("Error loading appt details", err);
                const loader = document.getElementById('appt-modal-content-loader');
                if (loader) loader.innerHTML = '<div style="color:red; font-size:0.9rem;">Errore nel caricamento dettagli.</div>';
            }
        })();
    }
}

export function closeEventModal() {
    const modalId = 'event-detail-modal';
    const m = document.getElementById(modalId);
    if (m) m.remove();
}

// Global expose for close button
window.closeEventModal = closeEventModal;
window.openEventDetails = openEventDetails; // Expose for legacy access if needed
