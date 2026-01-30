import {
    fetchAvailabilityRules,
    saveAvailabilityRules,
    fetchRestDays,
    upsertRestDay,
    deleteRestDay,
    fetchCollaboratorServices,
    fetchCollaboratorSkills,
    fetchAvailabilityOverrides,
    upsertAvailabilityOverride,
    deleteAvailabilityOverride,
    fetchBookingItemCollaborators,
    fetchGoogleAuth,
    upsertGoogleAuth,
    deleteGoogleAuth,
    fetchSystemConfig
} from '../modules/api.js?v=148';
import { state } from '../modules/state.js?v=148';
import { supabase } from '../modules/config.js?v=148';
import { supabase } from '../modules/config.js?v=148';

// Reusable function to open availability in a system modal
export async function openAvailabilityModal(collaboratorId, onCloseCallbacks = []) {
    // 1. Create Modal Structure
    const modalId = 'availability-manager-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
        <div class="modal active" id="${modalId}" style="z-index: 9999;">
            <div class="modal-content" style="max-width: 1100px; width: 95%; height: 85vh; padding: 0; display: flex; flex-direction: column; overflow: hidden;">
                
                <!-- HEADER -->
                <div class="modal-header" style="padding: 1.5rem 2rem; margin: 0; border-bottom: 1px solid var(--glass-border); flex-shrink: 0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(var(--brand-blue-rgb, 78, 146, 216), 0.1); display: flex; align-items: center; justify-content: center;">
                             <span class="material-icons-round" style="color: var(--brand-blue); font-size: 24px;">event_available</span>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.4rem; font-weight: 600; color: var(--text-primary);">Gestione Disponibilità</h2>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Imposta orari settimanali e giorni di chiusura</p>
                        </div>
                    </div>
                    <button class="icon-btn close-modal-btn" style="width: 36px; height: 36px; border-radius: 50%; background: var(--bg-secondary);">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>

                <!-- BODY -->
                <div class="modal-body" id="availability-modal-body" style="padding: 2rem; overflow-y: auto; flex: 1; background: var(--bg-main);">
                    <div style="text-align: center; padding: 2rem;"><span class="loader"></span></div>
                </div>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById(modalId);
    const bodyContainer = modal.querySelector('#availability-modal-body');

    // Close Handler
    const closeBtn = modal.querySelector('.close-modal-btn');
    const close = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300); // Allow transition

        if (onCloseCallbacks) {
            if (typeof onCloseCallbacks === 'function') {
                onCloseCallbacks();
            } else if (Array.isArray(onCloseCallbacks)) {
                onCloseCallbacks.forEach(cb => cb());
            }
        }
    };
    closeBtn.onclick = close;

    // 2. Load Data & Render
    await loadAvailabilityIntoContainer(bodyContainer, collaboratorId);

    // 3. Google Calendar Integration (Appended to body via helper)
    // We create the container but let the helper init it
    const googleSection = document.createElement('div');
    googleSection.className = 'google-cal-section';
    googleSection.style.marginTop = '2rem';
    googleSection.style.paddingTop = '2rem';
    googleSection.style.borderTop = '1px solid var(--glass-border)';
    googleSection.innerHTML = `
        <div class="glass-card" style="padding: 2rem; background: rgba(66, 133, 244, 0.05); border: 1px solid rgba(66, 133, 244, 0.2);">
            <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: #4285F4;">
                <span class="material-icons-round">calendar_month</span>
                Integrazione Google Calendar
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
                Sincronizza i tuoi calendari per bloccare automaticamente gli slot in cui sei occupato.
            </p>
            <div id="google-calendar-status">
                <div style="padding: 1rem; text-align: center;"><span class="loader small"></span></div>
            </div>
        </div>
    `;
    bodyContainer.appendChild(googleSection);

    // Init Logic
    initGoogleCalendarManager(googleSection.querySelector('#google-calendar-status'), collaboratorId);
}

// --- GOOGLE CALENDAR LOGIC (Ported from user_dashboard.js) ---
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar'; // Full access required for sync

export async function checkAndHandleGoogleCallback(collaboratorId) {
    // Check for OAuth code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        // Clear code from URL
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        await handleGoogleCallback(collaboratorId, code);
        return true;
    }
    return false;
}

async function initGoogleCalendarManager(container, collaboratorId) {
    if (!container) return;

    try {
        const auth = await fetchGoogleAuth(collaboratorId);
        renderGoogleCalendarStatus(container, auth, collaboratorId);
    } catch (err) {
        console.error("Failed to load google auth:", err);
        container.innerHTML = `<div style="color: var(--error-color);">Errore nel caricamento dell'integrazione.</div>`;
    }
}

function renderGoogleCalendarStatus(container, auth, collaboratorId) {
    if (!auth) {
        container.innerHTML = `
            <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" style="width: 32px; height: 32px;" alt="Google Calendar">
                    <div>
                        <div style="font-weight: 600; font-size: 0.95rem;">Non collegato</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary);">Collega il tuo account per sincronizzare gli impegni.</div>
                    </div>
                </div>
                <button id="connect-google-btn" class="primary-btn" style="background: white; color: var(--text-primary); border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 8px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" style="width: 18px; height: 18px;">
                    Collega Google
                </button>
            </div>
        `;
        container.querySelector('#connect-google-btn').onclick = () => startGoogleOAuth();
    } else {
        const selectedCount = Array.isArray(auth.selected_calendars) ? auth.selected_calendars.length : 0;
        container.innerHTML = `
            <div style="background: #E8F0FE; padding: 1.5rem; border-radius: 12px; border-left: 4px solid #4285F4;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" style="width: 32px; height: 32px;">
                        <div>
                            <div style="font-weight: 600; color: #1967D2;">Account Collegato</div>
                            <div style="font-size: 0.8rem; color: #4285F4;">${selectedCount > 0 ? `${selectedCount} calendar${selectedCount > 1 ? 'i' : 'io'} in sincro` : 'Nessun calendario selezionato'}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button id="manage-google-calendars-btn" class="primary-btn" style="background: white; color: #1967D2; border: 1px solid rgba(66, 133, 244, 0.3); font-size: 0.85rem; padding: 0.5rem 1rem;">
                            Gestisci
                        </button>
                        <button id="disconnect-google-btn" class="icon-btn" title="Scollega Account" style="color: var(--error-color); background: white; width: 36px; height: 36px;">
                            <span class="material-icons-round" style="font-size: 20px;">link_off</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.querySelector('#manage-google-calendars-btn').onclick = () => openGoogleCalendarModal(collaboratorId, auth);
        container.querySelector('#disconnect-google-btn').onclick = async () => {
            if (await window.showConfirm("Sei sicuro di voler scollegare Google Calendar?")) {
                try {
                    await deleteGoogleAuth(collaboratorId);
                    window.showAlert('Account scollegato.', 'success');
                    initGoogleCalendarManager(container, collaboratorId);
                } catch (err) {
                    console.error(err);
                    window.showAlert('Errore: ' + err.message, 'error');
                }
            }
        };
    }
}

async function startGoogleOAuth() {
    try {
        // Fallback hardcoded ID to ensure it works NOW immediately for the user
        const hardcodedId = '167545062244-81joujmp8m4hgdd3oogn1v2309g6ldai.apps.googleusercontent.com';
        let clientId = await fetchSystemConfig('google_client_id'); // Use string key

        if (!clientId) {
            console.warn("Config not found in DB, using fallback");
            clientId = hardcodedId;
        }

        let redirectUri = window.location.origin + window.location.pathname;
        if (redirectUri.endsWith('/')) {
            redirectUri = redirectUri.slice(0, -1);
        }

        // We preserve full URL including hash in state if we wanted, but for now mirror user_dashboard
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(GOOGLE_SCOPES)}&access_type=offline&prompt=consent`;
        window.location.href = url;
    } catch (err) {
        console.error("OAuth Init Error:", err);
        window.showAlert('Errore: ' + err.message, 'error');
    }
}

async function handleGoogleCallback(collaboratorId, code) {
    window.showAlert('Collegamento Google in corso...', 'loading');

    try {
        const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
            body: {
                collaborator_id: collaboratorId,
                code,
                redirect_uri: (window.location.origin + window.location.pathname).endsWith('/')
                    ? (window.location.origin + window.location.pathname).slice(0, -1)
                    : (window.location.origin + window.location.pathname)
            }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        window.showAlert('Google Calendar collegato con successo!', 'success');
        // We don't have container ref here easily, so we rely on modal re-opening or caller behavior
    } catch (err) {
        console.error("OAuth Exchange failed:", err);
        window.showAlert('Errore nel collegamento Google: ' + err.message, 'error');
    }
}

async function openGoogleCalendarModal(collaboratorId, auth) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-fade-in';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center;`;

    overlay.innerHTML = `
        <div class="glass-card animate-slide-up" style="width: 100%; max-width: 450px; padding: 2rem; position: relative; background:white; border-radius:12px;">
            <h2 style="margin: 0 0 0.5rem 0;">Seleziona Calendari</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">Scegli i calendari da cui leggere gli impegni (occupato).</p>
            
            <div id="calendar-list-loading" style="padding: 2rem; text-align: center;">
                <span class="loader small"></span>
                <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.5rem;">Caricamento calendari...</p>
            </div>

            <div id="calendar-list-container" style="max-height: 300px; overflow-y: auto; display: none; margin: 1rem 0;">
                <!-- Calendars will be listed here -->
            </div>

            <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
                <button type="button" class="secondary-btn" id="close-cal-modal">Annulla</button>
                <button type="button" class="primary-btn" id="save-cal-selection">Salva Selezione</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#close-cal-modal').onclick = close;

    try {
        const { data, error } = await supabase.functions.invoke('list-google-calendars', {
            body: { collaborator_id: collaboratorId }
        });

        if (error) throw error;

        const loading = overlay.querySelector('#calendar-list-loading');
        const list = overlay.querySelector('#calendar-list-container');
        loading.style.display = 'none';
        list.style.display = 'block';

        const selectedIds = new Set(auth.selected_calendars || []);

        list.innerHTML = data.items.map(cal => `
            <label style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px; cursor: pointer; transition: background 0.2s; border: 1px solid var(--glass-border); margin-bottom: 8px;">
                <input type="checkbox" class="cal-checkbox" value="${cal.id}" ${selectedIds.has(cal.id) ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #4285F4;">
                <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 0.95rem;">${cal.summary}</div>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary);">${cal.id}</div>
                </div>
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${cal.backgroundColor || '#4285F4'};"></div>
            </label>
        `).join('');

        overlay.querySelector('#save-cal-selection').onclick = async () => {
            const checkboxes = overlay.querySelectorAll('.cal-checkbox:checked');
            const newSelection = Array.from(checkboxes).map(cb => cb.value);

            const saveBtn = overlay.querySelector('#save-cal-selection');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Salvataggio...';

            try {
                await upsertGoogleAuth({
                    collaborator_id: collaboratorId,
                    selected_calendars: newSelection
                });
                window.showAlert('Impostazioni salvate!', 'success');
                close();
                // Refresh parent container
                const parentContainer = document.querySelector('#google-calendar-status');
                if (parentContainer) initGoogleCalendarManager(parentContainer, collaboratorId);
            } catch (err) {
                console.error(err);
                window.showAlert('Errore nel salvataggio.', 'error');
                saveBtn.disabled = false;
                saveBtn.innerText = 'Salva Selezione';
            }
        };

    } catch (err) {
        console.error(err);
        overlay.querySelector('#calendar-list-loading').innerHTML = `
            <span class="material-icons-round" style="color: var(--error-color); font-size: 2rem;">error_outline</span>
            <p style="color: var(--error-color); font-size: 0.9rem; margin-top: 0.5rem;">Errore nel recupero dei calendari.</p>
        `;
    }
}

export async function loadAvailabilityIntoContainer(container, collaboratorId) {
    if (!container) return;

    container.innerHTML = '<div style="padding:2rem; text-align:center;"><span class="loader"></span></div>';

    try {
        const [rules, restDays, _, skills, extraSlots, bookingAssignments] = await Promise.all([
            fetchAvailabilityRules(collaboratorId),
            fetchRestDays(collaboratorId),
            fetchCollaboratorServices(),
            fetchCollaboratorSkills(collaboratorId),
            fetchAvailabilityOverrides(collaboratorId),
            fetchBookingItemCollaborators(collaboratorId)
        ]);

        console.log("[AvailabilityManager] Extra Slots Fetched:", extraSlots.length);

        // Synthesize Services List
        // 1. Services from Active Orders (Historical/Current)
        const orderServices = (state.collaboratorServices || [])
            .filter(cs => cs.collaborator_id === collaboratorId)
            .map(cs => ({
                id: cs.service_id,
                name: cs.services?.name || 'Servizio sconosciuto'
            }));

        // 2. Services from Competencies (Assigned Skills)
        const skillServices = skills.map(s => ({
            id: s.service_id,
            name: s.services?.name || 'Servizio sconosciuto'
        }));

        // 3. Services from Booking Module (Prenotazioni)
        const bookingServices = bookingAssignments.map(ba => ({
            id: ba.booking_item_id,
            name: ba.booking_items?.name || 'Servizio Booking'
        }));

        // Merge and Deduplicate - ONLY Booking Services
        const allServices = [...bookingServices];
        const uniqueServices = [];
        const seen = new Set();

        allServices.forEach(s => {
            if (s.id && !seen.has(s.id)) {
                uniqueServices.push(s);
                seen.add(s.id);
            }
        });

        // Fetch Collaborator Timezone
        const { data: collabUser } = await supabase.from('collaborators').select('user_id').eq('id', collaboratorId).single();
        let fetchedTimezone = null;
        if (collabUser && collabUser.user_id) {
            const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', collabUser.user_id).single();
            if (profile) fetchedTimezone = profile.timezone;
        }

        renderAvailabilityEditor(container, collaboratorId, rules, restDays, uniqueServices, extraSlots, fetchedTimezone);

    } catch (err) {
        container.innerHTML = `
            <div style="padding:2rem; text-align:center; color: var(--error-color);">
                <span class="material-icons-round">error_outline</span>
                <p>Errore caricamento: ${err.message}</p>
                <button class="secondary-btn reload-btn">Riprova</button>
            </div>`;

        const reloadBtn = container.querySelector('.reload-btn');
        if (reloadBtn) reloadBtn.onclick = () => loadAvailabilityIntoContainer(container, collaboratorId);

        console.error(err);
    }
}

function renderAvailabilityEditor(container, collaboratorId, existingRules, restDays, myServices, extraSlots = [], collabTz = null) {
    const days = [
        { id: 1, name: 'Lun', fullName: 'Lunedì' },
        { id: 2, name: 'Mar', fullName: 'Martedì' },
        { id: 3, name: 'Mer', fullName: 'Mercoledì' },
        { id: 4, name: 'Gio', fullName: 'Giovedì' },
        { id: 5, name: 'Ven', fullName: 'Venerdì' },
        { id: 6, name: 'Sab', fullName: 'Sabato' },
        { id: 0, name: 'Dom', fullName: 'Domenica' }
    ];

    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const effectiveCollabTz = collabTz || viewerTz; // Default to viewer if not set
    const shouldConvert = effectiveCollabTz !== viewerTz;

    // Helper to convert time string (HH:MM or HH:MM:SS) between timezones
    const convertTime = (t, fromTz, toTz, dateRef = new Date()) => {
        if (!t || !fromTz || !toTz || fromTz === toTz) return t ? t.slice(0, 5) : '';
        try {
            const [h, m] = t.split(':').map(Number);
            let guess = new Date(dateRef);
            guess.setHours(h, m, 0, 0);

            // We need to Find Timestamp where WallTime in FromTZ == HH:MM
            // Iterative approach
            const getParts = (date, tz) => {
                return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(date);
            };

            const getRoughMinutes = (date, tz) => {
                const p = getParts(date, tz);
                let _h = parseInt(p.find(x => x.type === 'hour').value);
                if (_h === 24) _h = 0;
                let _m = parseInt(p.find(x => x.type === 'minute').value);
                return _h * 60 + _m;
            };

            // Initial alignment attempt
            let currentMinutesInFromTz = getRoughMinutes(guess, fromTz);
            let targetMinutes = h * 60 + m;
            let diff = currentMinutesInFromTz - targetMinutes;

            // Handle wrap
            if (diff > 720) diff -= 1440;
            if (diff < -720) diff += 1440;

            // Apply correction
            guess.setMinutes(guess.getMinutes() - diff);

            // Double check
            currentMinutesInFromTz = getRoughMinutes(guess, fromTz);
            diff = currentMinutesInFromTz - targetMinutes;
            if (diff > 720) diff -= 1440;
            if (diff < -720) diff += 1440;
            if (Math.abs(diff) > 0) guess.setMinutes(guess.getMinutes() - diff);

            // Now guess is the timestamp. Return it in ToTz string.
            const p = getParts(guess, toTz);
            let finalH = p.find(x => x.type === 'hour').value;
            if (finalH === '24') finalH = '00';
            let finalM = p.find(x => x.type === 'minute').value;
            return `${finalH.padStart(2, '0')}:${finalM.padStart(2, '0')}`;

        } catch (e) {
            console.warn("TZ Convert Error", e);
            return t.slice(0, 5);
        }
    };

    const rulesMap = {};
    days.forEach(d => rulesMap[d.id] = []);

    existingRules.forEach(r => {
        // Convert FROM Collab TO Viewer for display
        // Use a generic date for the day of week? 
        // We use current date but aligned to the day of week in current week to be precise?
        // Actually, just use today is fine for generic offset.
        const s = convertTime(r.start_time, effectiveCollabTz, viewerTz);
        const e = convertTime(r.end_time, effectiveCollabTz, viewerTz);

        if (rulesMap[r.day_of_week]) {
            rulesMap[r.day_of_week].push({ ...r, start_time: s, end_time: e });
        }
    });

    const html = `
        <style>
            /* New Dropdown Styles */
            .av-manager input[type="time"] {
                appearance: none;
                background: white; border: 1.5px solid #e2e8f0; border-radius: 8px;
                padding: 8px 12px; font-size: 0.9rem; font-family: inherit;
                color: var(--text-primary); cursor: pointer;
            }
            .time-slot {
                background: white; border: 1px solid #e2e8f0; border-radius: 10px;
                padding: 12px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s;
            }
            .time-slot:hover { border-color: #667eea; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1); }

            /* Custom Select */
            .custom-select-wrapper { position: relative; width: 100%; }
            .custom-select-trigger {
                background: white; border: 1.5px solid #e2e8f0; border-radius: 8px;
                padding: 8px 12px; font-size: 0.9rem; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center; min-height: 38px;
            }

            .custom-select-options {
                position: absolute; top: calc(100% + 4px); left: 0; width: 100%;
                background: white; border: 1px solid #e2e8f0; border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                z-index: 50; display: none !important; overflow: hidden;
                opacity: 1 !important; visibility: visible !important; transform: none !important;
            }
            .custom-select-options.open { display: block !important; }
            .custom-select-options.open-top { 
                top: auto !important; 
                bottom: calc(100% + 4px) !important; 
                box-shadow: 0 -10px 15px -3px rgba(0, 0, 0, 0.1) !important;
            }
            .cs-scroll-area { max-height: 200px; overflow-y: auto; padding: 4px; }
            
            .cs-option {
                display: flex; align-items: center; gap: 10px; padding: 8px 12px;
                cursor: pointer; border-radius: 6px; transition: background 0.1s; user-select: none;
            }
            .cs-option:hover { background: #f1f5f9; }
            .cs-option input[type="checkbox"] {
                width: 16px; height: 16px; accent-color: #667eea; cursor: pointer;
            }
            .cs-separator {
                border-bottom: 1px dashed #cbd5e1; margin: 6px 0;
            }
            .cs-label { font-size: 0.9rem; color: var(--text-secondary); margin-left:8px; font-weight:600; font-size:0.75rem; padding: 4px 12px; text-transform:uppercase; letter-spacing:0.05em; }
        </style>

        <div class="av-manager" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; height: 100%; overflow: hidden;">
             <!-- Left: Weekly -->
             <section style="background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--glass-border); display: flex; flex-direction: column; overflow: hidden;">
                <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round" style="color: var(--brand-blue);">calendar_month</span>
                            Orario Settimanale
                        </h3>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 400;">Fasce ricorrenti ogni settimana</p>
                    </div>
                    <button class="primary-btn btn-save-rules" style="padding: 0.6rem 1.25rem; font-size: 0.9rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);">
                        <span class="material-icons-round" style="font-size: 18px;">save</span>
                        Salva
                    </button>
                </div>

                <div class="schedule-grid" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-right: 0.5rem;">
                    ${days.map(day => `
                        <div class="day-row" data-day="${day.id}" style="background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--glass-border); padding: 1rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                                <strong style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${day.fullName}</strong>
                                <button type="button" class="icon-btn add-slot-btn" title="Aggiungi Fascia" style="width: 28px; height: 28px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <span class="material-icons-round" style="font-size: 16px; color: var(--brand-blue);">add</span>
                                </button>
                            </div>
                            <div class="slots-container" style="display: flex; flex-direction: column; gap: 0.6rem;"></div>
                        </div>
                    `).join('')}
                </div>
             </section>

             <!-- Right: Extra & Rest -->
             <div style="display: flex; flex-direction: column; gap: 1.5rem; overflow: hidden; min-height: 0;">
                <!-- Extra -->
                <section style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 1.5rem; border-radius: 16px; border: 2px solid #667eea30; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;">
                    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 600; color: #667eea; display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 20px;">event_available</span>
                                Disponibilità Extra
                            </h3>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 400;">Date specifiche aggiuntive</p>
                        </div>
                        <button class="primary-btn btn-add-extra" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                            <span class="material-icons-round" style="font-size: 16px;">add</span>
                            Aggiungi
                        </button>
                    </div>
                    <div class="extra-slots-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem; min-height: 0;"></div>
                </section>

                <!-- Rest -->
                <section style="background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--glass-border); flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;">
                    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-start;">
                         <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="color: #ef4444;">event_busy</span>
                                Giorni di Riposo
                            </h3>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 400;">Ferie e permessi</p>
                        </div>
                        <button class="secondary-btn btn-add-rest" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: white; border: 1px solid var(--glass-border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                            <span class="material-icons-round" style="font-size: 16px;">add</span>
                            Aggiungi
                        </button>
                    </div>
                    <div class="rest-days-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem; min-height: 0;"></div>
                </section>
             </div>
        </div>
    `;

    container.innerHTML = html;

    // --- RENDER SLOT WITH NEW DROPDOWN ---
    const renderSlot = (slotContainer, start = '09:00', end = '18:00', serviceIds = [], isOnCall = false) => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'time-slot';

        slotDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
                    <input type="time" class="slot-start" value="${start}" style="flex: 1; min-width: 0;">
                    <span style="color: var(--text-tertiary); font-weight: 500;">→</span>
                    <input type="time" class="slot-end" value="${end}" style="flex: 1; min-width: 0;">
                </div>
                <button type="button" class="icon-btn remove-slot-btn" style="color: var(--error-color); width: 28px; height: 28px; background: var(--bg-secondary); border-radius: 6px; flex-shrink: 0;">
                    <span class="material-icons-round" style="font-size: 16px;">close</span>
                </button>
            </div>
            <div class="slot-services-wrapper"></div>
        `;

        slotDiv.querySelector('.remove-slot-btn').onclick = () => slotDiv.remove();
        slotContainer.appendChild(slotDiv);

        // Mount Custom Dropdown
        const wrapper = slotDiv.querySelector('.slot-services-wrapper');
        const state = { ids: [...(serviceIds || [])], isOnCall: !!isOnCall };

        slotDiv.dataset.jsonState = JSON.stringify(state);

        const updateTrigger = () => {
            const triggerText = wrapper.querySelector('.custom-select-trigger .trigger-text');
            if (!triggerText) return;

            let text = 'Tutti i servizi';
            if (state.isOnCall) {
                text = 'Reperibilità Lavorativa';
                if (state.ids.length > 0) text += ` + ${state.ids.length} Servizi`;
            } else if (state.ids.length > 0) {
                if (state.ids.length === 1) {
                    const s = myServices.find(x => x.id === state.ids[0]);
                    text = s ? s.name : '1 Servizio';
                } else {
                    text = `${state.ids.length} Servizi selezionati`;
                }
            }
            triggerText.textContent = text;
            slotDiv.dataset.jsonState = JSON.stringify(state);
        };

        const dropdownHtml = `
            <div class="custom-select-wrapper">
                <div class="custom-select-trigger">
                    <span class="trigger-text">Tutti i servizi</span>
                    <span class="material-icons-round" style="font-size:18px; color:#64748b;">expand_more</span>
                </div>
                <div class="custom-select-options">
                    <div class="cs-scroll-area">
                        <!-- Reperibilità -->
                        <div class="cs-option" data-type="on_call">
                            <input type="checkbox" ${state.isOnCall ? 'checked' : ''}>
                            <span style="font-weight:500; color:#4f46e5;">Reperibilità Lavorativa</span>
                        </div>
                        
                        <div class="cs-separator"></div>
                        
                        <!-- All Services -->
                        <div class="cs-option" data-type="all">
                             <input type="checkbox" ${!state.isOnCall && state.ids.length === 0 ? 'checked' : ''}>
                             <span style="font-weight:500;">Tutti i servizi</span>
                        </div>
                        
                        ${myServices.map(s => `
                            <div class="cs-option" data-id="${s.id}" data-type="service">
                                <input type="checkbox" ${state.ids.includes(s.id) ? 'checked' : ''}>
                                <span>${s.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        wrapper.innerHTML = dropdownHtml;

        updateTrigger();

        const trigger = wrapper.querySelector('.custom-select-trigger');
        const options = wrapper.querySelector('.custom-select-options');

        trigger.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select-options.open').forEach(el => {
                if (el !== options) el.classList.remove('open');
            });

            // Smart Position Check
            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 250) { // If less than 250px below, open top
                options.classList.add('open-top');
            } else {
                options.classList.remove('open-top');
            }

            options.classList.toggle('open');
        };

        wrapper.querySelectorAll('.cs-option').forEach(opt => {
            opt.onclick = (e) => {
                e.preventDefault(); // Prevent double toggle if hitting label
                e.stopPropagation(); // Keep open

                const type = opt.dataset.type;
                const cb = opt.querySelector('input');
                let isChecked = !cb.checked; // Toggle

                // Logic
                if (type === 'on_call') {
                    state.isOnCall = isChecked;
                } else if (type === 'all') {
                    if (isChecked) {
                        state.ids = []; // Clear specific
                    } else {
                        // Unchecking all means what? Nothing selected? 
                        // Usually keep empty. 
                    }
                } else if (type === 'service') {
                    const id = opt.dataset.id;
                    if (isChecked) {
                        state.ids.push(id);
                    } else {
                        state.ids = state.ids.filter(x => x !== id);
                    }
                }

                // Sync UI checkboxes
                // If specific service selected, uncheck "All"
                if (state.ids.length > 0 && type !== 'all') {
                    const allCb = wrapper.querySelector('.cs-option[data-type="all"] input');
                    if (allCb) allCb.checked = false;
                }
                // If "All" selected, uncheck specific
                if (type === 'all' && isChecked) {
                    wrapper.querySelectorAll('.cs-option[data-type="service"] input').forEach(i => i.checked = false);
                }

                // Re-render specific checkbox state based on state.ids
                wrapper.querySelectorAll('.cs-option[data-type="service"]').forEach(o => {
                    o.querySelector('input').checked = state.ids.includes(o.dataset.id);
                });
                wrapper.querySelector('.cs-option[data-type="all"] input').checked = (state.ids.length === 0);
                wrapper.querySelector('.cs-option[data-type="on_call"] input').checked = state.isOnCall;

                updateTrigger();
            };
        });
    };

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrapper')) {
            container.querySelectorAll('.custom-select-options.open').forEach(el => el.classList.remove('open'));
        }
    });

    days.forEach(day => {
        const dayRow = container.querySelector(`.day-row[data-day="${day.id}"]`);
        const slotsContainer = dayRow.querySelector('.slots-container');
        const dayRules = rulesMap[day.id];

        if (dayRules && dayRules.length > 0) {
            dayRules.forEach(r => {
                let ids = r.service_ids || [];
                if (r.service_id && ids.length === 0) ids = [r.service_id];
                renderSlot(slotsContainer, r.start_time.slice(0, 5), r.end_time.slice(0, 5), ids, r.is_on_call);
            });
        }

        dayRow.querySelector('.add-slot-btn').onclick = () => renderSlot(slotsContainer);
    });

    const saveBtn = container.querySelector('.btn-save-rules');
    saveBtn.onclick = async () => {
        saveBtn.innerHTML = 'Salvataggio...';
        saveBtn.disabled = true;

        const newRules = [];
        container.querySelectorAll('.day-row').forEach(row => {
            const dayId = parseInt(row.dataset.day);
            row.querySelectorAll('.time-slot').forEach(slot => {
                const start = slot.querySelector('.slot-start').value;
                const end = slot.querySelector('.slot-end').value;
                const stateString = slot.dataset.jsonState;
                if (start && end && stateString) {
                    const state = JSON.parse(stateString);
                    newRules.push({
                        day_of_week: dayId,
                        start_time: convertTime(start, viewerTz, effectiveCollabTz), // Convert BACK to CollabTZ
                        end_time: convertTime(end, viewerTz, effectiveCollabTz),     // Convert BACK to CollabTZ
                        service_ids: state.ids,
                        is_on_call: state.isOnCall
                    });
                }
            });
        });

        try {
            await saveAvailabilityRules(collaboratorId, newRules);
            window.showAlert('Disponibilità salvata con successo!', 'success');
        } catch (err) {
            window.showAlert('Errore salvataggio: ' + err.message, 'error');
        } finally {
            saveBtn.innerHTML = '<span class="material-icons-round" style="font-size: 18px;">save</span> Salva';
            saveBtn.disabled = false;
        }
    };

    // --- RENDER HELPERS (Extra & Rest) ---
    const renderExtraSlot = (slot) => {
        const startDate = new Date(slot.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        const endDate = slot.end_date ? new Date(slot.end_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : null;
        const dateDisplay = endDate ? `${startDate} - ${endDate}` : startDate;

        let servicesText = 'Tutti i servizi';
        if (slot.is_on_call) {
            servicesText = 'Reperibilità';
            if (slot.service_ids && slot.service_ids.length > 0) servicesText += ` + ${slot.service_ids.length} Servizi`;
        } else if (slot.service_ids && slot.service_ids.length > 0) {
            if (slot.service_ids.length === 1) {
                const s = myServices.find(x => x.id === slot.service_ids[0]);
                servicesText = s ? s.name : (slot.booking_items?.name || '1 Servizio');
            } else {
                servicesText = `${slot.service_ids.length} Servizi`;
            }
        } else if (slot.booking_items) { // Fallback for old single relation
            servicesText = slot.booking_items.name;
        }

        return `
            <div style="background: white; border-radius: 10px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #667eea; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 2px;">
                        ${dateDisplay}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>${convertTime(slot.start_time, effectiveCollabTz, viewerTz)} - ${convertTime(slot.end_time, effectiveCollabTz, viewerTz)}</span>
                        <span style="color: #667eea;">• ${servicesText}</span>
                    </div>
                </div>
                <button class="icon-btn delete-override-btn" data-id="${slot.id}" title="Elimina" style="background: var(--bg-secondary); border-radius: 6px; width: 28px; height: 28px; flex-shrink: 0;">
                    <span class="material-icons-round" style="color: var(--error-color); font-size: 16px;">delete_outline</span>
                </button>
            </div>
        `;
    };

    const extrasList = container.querySelector('.extra-slots-list');
    if (extrasList) {
        if (extraSlots && extraSlots.length > 0) {
            extrasList.innerHTML = extraSlots.map(renderExtraSlot).join('');
        } else {
            extrasList.innerHTML = '<p style="text-align:center; color:var(--text-tertiary); padding: 1rem;">Nessuna disponibilità extra aggiunta.</p>';
        }

        extrasList.querySelectorAll('.delete-override-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await window.showConfirm('Eliminare questa disponibilità extra?')) {
                    try {
                        await deleteAvailabilityOverride(btn.dataset.id);
                        loadAvailabilityIntoContainer(container, collaboratorId);
                    } catch (err) {
                        window.showAlert('Errore: ' + err.message, 'error');
                    }
                }
            });
        });
    }

    container.querySelector('.btn-add-extra').addEventListener('click', () => {
        openExtraSlotModal(collaboratorId, myServices, () => loadAvailabilityIntoContainer(container, collaboratorId), effectiveCollabTz, viewerTz, convertTime);
    });

    const renderRestDay = (rd) => {
        const startDate = new Date(rd.start_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const endDate = new Date(rd.end_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return `
            <div style="background: white; border-radius: 10px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #ef4444; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 2px;">
                        ${rd.name}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="font-size:14px; color:var(--text-tertiary)">calendar_today</span>
                        <span>${startDate} - ${endDate}</span>
                    </div>
                </div>
                <button class="icon-btn delete-rest-day-btn" data-id="${rd.id}" title="Elimina" style="background: var(--bg-secondary); border-radius: 6px; width: 28px; height: 28px; flex-shrink: 0;">
                    <span class="material-icons-round" style="color: var(--error-color); font-size: 16px;">delete_outline</span>
                </button>
            </div>
         `;
    };

    const restList = container.querySelector('.rest-days-list');
    if (restList) {
        if (restDays && restDays.length > 0) {
            restList.innerHTML = restDays.map(renderRestDay).join('');
        } else {
            restList.innerHTML = '<p style="text-align:center; color:var(--text-tertiary); padding: 1rem;">Nessun giorno di riposo.</p>';
        }

        restList.querySelectorAll('.delete-rest-day-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (await window.showConfirm('Eliminare questo giorno di riposo?')) {
                    try {
                        await deleteRestDay(btn.dataset.id);
                        loadAvailabilityIntoContainer(container, collaboratorId);
                    } catch (err) {
                        window.showAlert('Errore eliminazione: ' + err.message, 'error');
                    }
                }
            });
        });
    }

    container.querySelector('.btn-add-rest').addEventListener('click', () => {
        openRestDayModal(collaboratorId, () => loadAvailabilityIntoContainer(container, collaboratorId));
    });
}

// Sub-modals (Extra & Rest) 
function openRestDayModal(collaboratorId, onSuccess) {
    const modalId = 'rest-day-sub-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const content = `
        <h3 style="margin-top:0;">Aggiungi Periodo di Riposo</h3>
        <form id="rest-day-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
                <label style="display:block; margin-bottom:5px; font-weight:500;">Nome (es. Ferie Estive)</label>
                <input type="text" name="name" required style="width:100%; padding: 8px; border:1px solid #ddd; border-radius:6px;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <label style="display:block; margin-bottom:5px; font-weight:500;">Dal</label>
                    <input type="date" name="start_date" required style="width:100%; padding: 8px; border:1px solid #ddd; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; margin-bottom:5px; font-weight:500;">Al</label>
                    <input type="date" name="end_date" required style="width:100%; padding: 8px; border:1px solid #ddd; border-radius:6px;">
                </div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" name="repeat_annually">
                <span>Ripeti ogni anno</span>
            </label>
            <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
                <button type="button" class="secondary-btn close-sub-modal">Annulla</button>
                <button type="submit" class="primary-btn">Salva</button>
            </div>
        </form>
    `;

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'modal active';
    overlay.style.zIndex = '10000'; // Higher than manager modal
    overlay.innerHTML = `<div class="modal-content animate-scale-in" style="max-width: 500px;">${content}</div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.close-sub-modal').addEventListener('click', close);

    overlay.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            collaborator_id: collaboratorId,
            name: formData.get('name'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            repeat_annually: formData.get('repeat_annually') === 'on'
        };

        const btn = overlay.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerText = 'Salvataggio...';

        try {
            await upsertRestDay(data);
            window.showAlert('Salvato!', 'success');
            close();
            onSuccess();
        } catch (err) {
            console.error(err);
            btn.disabled = false;
            btn.innerText = 'Salva';
            window.showAlert('Errore: ' + err.message, 'error');
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
}

function openExtraSlotModal(collaboratorId, services, onSuccess, collabTz, viewerTz, convertFn) {
    const serviceOptions = `
        <option value="">Tutti i servizi</option>
        ${services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    `;

    const modalId = 'extra-slot-sub-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const content = `
        <div class="modal-header-premium" style="margin-bottom: 0.75rem; position: relative;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); flex-shrink: 0;">
                    <span class="material-icons-round" style="font-size: 20px;">event_available</span>
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text-primary);">Aggiungi Disponibilità</h2>
                    <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 400;">Definisci un giorno o un periodo specifico</p>
                </div>
            </div>
            <button class="icon-btn close-sub-modal" style="position: absolute; top: -0.25rem; right: -0.25rem; background: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid var(--glass-border); transition: all 0.2s;">
                <span class="material-icons-round" style="font-size: 18px; color: var(--text-secondary);">close</span>
            </button>
        </div>

        <form id="extra-slot-form" class="premium-form">
            <div style="background: var(--bg-secondary); border-radius: 16px; padding: 0.85rem 1rem; margin-bottom: 0.6rem;">
                <h3 style="margin: 0 0 0.6rem 0; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="font-size: 16px;">date_range</span>
                    Periodo
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem; display: block;">Data Inizio</label>
                        <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}"
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem; display: block;">Data Fine <span style="font-weight: 400; color: var(--text-tertiary);">(Opzionale)</span></label>
                        <input type="date" name="end_date"
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-secondary); border-radius: 16px; padding: 0.85rem 1rem; margin-bottom: 0.6rem;">
                <h3 style="margin: 0 0 0.6rem 0; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="font-size: 16px;">schedule</span>
                    Orario
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem; display: block;">Dalle</label>
                        <input type="time" name="start_time" value="09:00" required
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem; display: block;">Alle</label>
                        <input type="time" name="end_time" value="18:00" required
                            style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-secondary); border-radius: 16px; padding: 0.85rem 1rem; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 0.6rem 0; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons-round" style="font-size: 16px;">work_outline</span>
                    Servizio
                </h3>
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.4rem; display: block;">Servizio Dedicato <span style="font-weight: 400; color: var(--text-tertiary);">(Opzionale)</span></label>
                        <div id="extra-services-wrapper"></div>
                    </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding: 0.5rem 0 3rem 0;">
                <button type="submit" class="primary-btn" style="min-width: 160px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.2s; border: none; color: white; cursor: pointer; font-size: 0.9rem;">
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round" style="font-size: 18px;">check</span>
                        Salva Disponibilità
                    </span>
                </button>
            </div>
        </form>
    `;

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'modal active';
    overlay.style.zIndex = '10000';
    overlay.innerHTML = `<div class="modal-content animate-scale-in" style="max-width: 600px; max-height: 90vh; overflow-y:auto;">${content}</div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.close-sub-modal').addEventListener('click', close);

    // --- Custom Select Logic ---
    const wrapper = overlay.querySelector('#extra-services-wrapper');
    const state = { ids: [], isOnCall: false };

    // Function to render/update dropdown
    const updateDropdown = () => {
        let text = 'Tutti i servizi';
        if (state.isOnCall) {
            text = 'Reperibilità Lavorativa';
            if (state.ids.length > 0) text += ` + ${state.ids.length} Servizi`;
        } else if (state.ids.length > 0) {
            if (state.ids.length === 1) {
                const s = services.find(x => x.id === state.ids[0]);
                text = s ? s.name : '1 Servizio';
            } else {
                text = `${state.ids.length} Servizi selezionati`;
            }
        }

        wrapper.innerHTML = `
            <div class="custom-select-wrapper">
                <div class="custom-select-trigger" style="padding: 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 10px; background: white; justify-content: space-between; display: flex; align-items: center; cursor: pointer;">
                    <span class="trigger-text" style="font-size: 0.9rem; color: var(--text-primary);">${text}</span>
                    <span class="material-icons-round" style="font-size:18px; color:#64748b;">expand_more</span>
                </div>
                <div class="custom-select-options">
                    <div class="cs-scroll-area">
                        <div class="cs-option" data-type="on_call" style="padding: 10px 12px;">
                            <input type="checkbox" ${state.isOnCall ? 'checked' : ''}>
                            <span style="font-weight:500; color:#4f46e5; margin-left: 8px;">Reperibilità Lavorativa</span>
                        </div>
                        <div class="cs-separator"></div>
                        <div class="cs-option" data-type="all" style="padding: 10px 12px;">
                             <input type="checkbox" ${!state.isOnCall && state.ids.length === 0 ? 'checked' : ''}>
                             <span style="font-weight:500; margin-left: 8px;">Tutti i servizi</span>
                        </div>
                        ${services.map(s => `
                            <div class="cs-option" data-id="${s.id}" data-type="service" style="padding: 10px 12px;">
                                <input type="checkbox" ${state.ids.includes(s.id) ? 'checked' : ''}>
                                <span style="margin-left: 8px;">${s.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Bind events
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const options = wrapper.querySelector('.custom-select-options');

        trigger.onclick = (e) => {
            e.stopPropagation();

            // Smart Position Check
            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 220) {
                options.classList.add('open-top');
            } else {
                options.classList.remove('open-top');
            }

            options.classList.toggle('open');
        };

        wrapper.querySelectorAll('.cs-option').forEach(opt => {
            opt.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const type = opt.dataset.type;
                const cb = opt.querySelector('input');
                let isChecked = !cb.checked; // Toggle

                if (type === 'on_call') {
                    state.isOnCall = isChecked;
                } else if (type === 'all') {
                    if (isChecked) state.ids = [];
                } else if (type === 'service') {
                    const id = opt.dataset.id;
                    if (isChecked) state.ids.push(id);
                    else state.ids = state.ids.filter(x => x !== id);
                }

                if (state.ids.length > 0 && type !== 'all') {
                    state.isOnCall = (type === 'on_call' ? isChecked : state.isOnCall); // Keep on_call as is or update
                }

                // Re-render to reflect state
                updateDropdown();
                // Keep open
                wrapper.querySelector('.custom-select-options').classList.add('open');
            };
        });
    };

    // Initial Render
    updateDropdown();

    // Close on outside click
    const outsideClick = (e) => {
        if (!wrapper.contains(e.target)) {
            const openOpts = wrapper.querySelector('.custom-select-options.open');
            if (openOpts) openOpts.classList.remove('open');
        }
    };
    document.addEventListener('click', outsideClick);

    // Cleanup listener on close
    const originalClose = close;
    const cleanupClose = () => {
        document.removeEventListener('click', outsideClick);
        originalClose();
    };
    overlay.querySelector('.close-sub-modal').onclick = cleanupClose;
    overlay.onclick = (e) => { if (e.target === overlay) cleanupClose(); };

    overlay.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Map state to DB fields
        const data = {
            collaborator_id: collaboratorId,
            start_time: convertFn ? convertFn(formData.get('start_time'), viewerTz, collabTz, new Date(formData.get('date'))) : formData.get('start_time'),
            end_time: convertFn ? convertFn(formData.get('end_time'), viewerTz, collabTz, new Date(formData.get('date'))) : formData.get('end_time'),
            date: formData.get('date'),
            end_date: formData.get('end_date') || null,
            service_ids: state.ids, // Multi-select array
            is_on_call: state.isOnCall, // Boolean
            is_available: true
        };

        const btn = overlay.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Salvataggio...';

        try {
            await upsertAvailabilityOverride(data);
            window.showAlert('Disponibilità extra aggiunta!', 'success');
            cleanupClose(); // Use cleanupClose to remove listeners
            onSuccess();
        } catch (err) {
            console.error(err);
            btn.disabled = false;
            btn.innerHTML = originalText;
            window.showAlert('Errore: ' + err.message, 'error');
        }
    });
}
