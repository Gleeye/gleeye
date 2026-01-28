import { state } from '../modules/state.js?v=148';
import { supabase } from '../modules/config.js?v=148';
import { fetchCollaborators, upsertCollaborator, fetchAvailabilityRules, saveAvailabilityRules, fetchPayments, fetchRestDays, upsertRestDay, deleteRestDay, fetchCollaboratorServices, fetchCollaboratorSkills, fetchAvailabilityOverrides, upsertAvailabilityOverride, deleteAvailabilityOverride, fetchBookingItemCollaborators, fetchGoogleAuth, deleteGoogleAuth, fetchSystemConfig, upsertGoogleAuth, fetchNotificationTypes, fetchUserNotificationPreferences, upsertUserNotificationPreference } from '../modules/api.js?v=148';
import { formatAmount } from '../modules/utils.js?v=148';
import { loadAvailabilityIntoContainer } from './availability_manager.js?v=148';


export async function renderUserProfile(container) {
    console.log("User Dashboard v999 loaded"); // Debug version
    const session = state.session;
    if (!session) {
        container.innerHTML = '<div style="padding:2rem;">Sessione scaduta. Effettua il login.</div>';
        return;
    }

    // Ensure we have the user's collaborator data
    if (!state.collaborators || state.collaborators.length === 0) {
        await fetchCollaborators();
    }

    // Determine which collaborator to show
    let myCollab;

    if (state.impersonatedCollaboratorId) {
        myCollab = state.collaborators.find(c => c.id === state.impersonatedCollaboratorId);
        if (!myCollab) {
            console.error("Impersonated collaborator not found in state");
            // Fallback to real user
            myCollab = state.collaborators.find(c => c.email === session.user.email);
        } else {
            console.log(`[User Dashboard] Showing impersonated profile: ${myCollab.full_name}`);
        }
    } else {
        myCollab = state.collaborators.find(c => c.email === session.user.email);
    }

    if (!myCollab) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center;">
                <span class="material-icons-round" style="font-size: 3rem; color: var(--text-tertiary);">person_off</span>
                <h3>Profilo non trovato</h3>
                <p>Non risulta nessun collaboratore associato all'email <strong>${session.user.email}</strong>.</p>
                <p>Contatta un amministratore per creare il tuo profilo.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="animate-fade-in">
            <!-- Header -->
            <div style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1.5rem;">
                <div id="avatar-container" style="position: relative; width: 80px; height: 80px; border-radius: 50%; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; font-weight: 400; box-shadow: var(--shadow-premium); cursor: pointer; overflow: hidden; group;">
                    ${myCollab.avatar_url ? `<img id="my-avatar-img" src="${myCollab.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : `<span id="my-avatar-placeholder">${myCollab.first_name?.[0] || 'U'}</span>`}
                    <div class="avatar-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;">
                        <span class="material-icons-round" style="font-size: 1.5rem; color: white;">photo_camera</span>
                    </div>
                    <input type="file" id="avatar-input" accept="image/*" hidden>
                </div>
                <style>
                    #avatar-container:hover .avatar-overlay { opacity: 1 !important; }
                </style>
                <div>
                    <h1 style="margin: 0; font-size: 2rem;">Ciao, ${myCollab.first_name || 'Utente'}</h1>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary);">Gestisci il tuo profilo e le tue attività</p>
                    
                    ${state.impersonatedCollaboratorId ? `
                        <div style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem; background: #FFF3E0; border: 1px solid #FFCC80; padding: 0.5rem 1rem; border-radius: 8px;">
                            <span class="material-icons-round" style="font-size: 1.2rem; color: #EF6C00;">visibility</span>
                            <span style="font-size: 0.9rem; font-weight: 500; color: #E65100;">Sei in modalità vista per: <strong>${myCollab.full_name}</strong></span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="tabs-container" style="margin-bottom: 2rem; border-bottom: 1px solid var(--glass-border); display: flex; gap: 1.5rem;">
                <button class="tab-btn active" data-tab="dashboard" style="padding: 0.8rem 1rem; background: none; border: none; border-bottom: 2px solid var(--brand-blue); color: var(--brand-blue); font-weight: 500; cursor: pointer;">
                    Dashboard
                </button>
                <button class="tab-btn" data-tab="settings" style="padding: 0.8rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">
                    Dati & Impostazioni
                </button>
                <button class="tab-btn" data-tab="availability" style="padding: 0.8rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">
                    Disponibilità
                </button>
                <button class="tab-btn" data-tab="notifications" style="padding: 0.8rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); cursor: pointer;">
                    Notifiche
                </button>
            </div>

            <!-- Tab Content: Dashboard -->
            <div id="tab-dashboard" class="tab-content">
                <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                    <!-- Quick Stats -->
                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="margin-top:0;">Le tue attività</h3>
                        <p style="color:var(--text-secondary);">Riepilogo ordini e pagamenti</p>
                        <!-- TODO: Insert Stats Here -->
                    </div>
                </div>
            </div>

            <!-- Tab Content: Settings -->
            <div id="tab-settings" class="tab-content hidden">
                <div class="glass-card" style="padding: 0; max-width: 1000px; overflow: hidden; background: linear-gradient(145deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6)); border: 1px solid var(--glass-border);">
                    
                    <!-- Form Header -->
                    <div style="padding: 2rem; background: linear-gradient(to right, rgba(239, 246, 255, 0.5), transparent); border-bottom: 1px solid var(--glass-border);">
                        <h2 style="margin: 0; font-size: 1.5rem; color: var(--brand-blue);">Dati & Impostazioni</h2>
                        <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.95rem;">Gestisci le tue informazioni personali, fiscali e i documenti necessari.</p>
                    </div>

                    <form id="profile-settings-form" style="padding: 2rem;">
                        <style>
                            .modern-form-group { position: relative; margin-bottom: 0.5rem; }
                            .modern-label { 
                                display: block; font-size: 0.75rem; font-weight: 600; 
                                text-transform: uppercase; letter-spacing: 0.05em; 
                                color: var(--text-tertiary); margin-bottom: 0.5rem; 
                            }
                            .modern-input { 
                                width: 100%; padding: 0.9rem 1rem; 
                                background: white; border: 1px solid #e2e8f0; 
                                border-radius: 12px; font-size: 0.95rem; color: var(--text-primary);
                                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                            }
                            .modern-input:focus { 
                                outline: none; border-color: var(--brand-blue); 
                                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); 
                                transform: translateY(-1px);
                            }
                            .settings-section { margin-bottom: 3rem; animation: slideIn 0.3s ease-out; }
                            .settings-section-title { 
                                font-size: 1.1rem; font-weight: 600; color: var(--text-primary); 
                                margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;
                            }
                            .upload-zone {
                                background: white; border: 2px dashed #cbd5e1; border-radius: 16px;
                                padding: 2rem; text-align: center; cursor: pointer;
                                transition: all 0.2s ease; position: relative;
                            }
                            .upload-zone:hover { border-color: var(--brand-blue); background: #f8fafc; transform: translateY(-2px); }
                            .upload-zone.has-file { border-style: solid; border-color: #10B981; background: #ecfdf5; }
                            
                            .doc-status-badge {
                                position: absolute; top: 1rem; right: 1rem;
                                padding: 0.25rem 0.75rem; border-radius: 20px;
                                font-size: 0.75rem; font-weight: 600;
                                background: #e2e8f0; color: #64748b;
                            }
                            .upload-zone.has-file .doc-status-badge { background: #d1fae5; color: #059669; }
                        </style>

                        <!-- Personal Info -->
                        <div class="settings-section">
                            <h4 class="settings-section-title">
                                <span class="material-icons-round" style="color: var(--brand-blue); background: #eff6ff; padding: 6px; border-radius: 8px;">person</span>
                                Anagrafica
                            </h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                                <div class="modern-form-group">
                                    <label class="modern-label">Nome</label>
                                    <input type="text" class="modern-input" id="my-first-name" value="${myCollab.first_name || ''}" required>
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">Cognome</label>
                                    <input type="text" class="modern-input" id="my-last-name" value="${myCollab.last_name || ''}" required>
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">Data di Nascita</label>
                                    <input type="date" class="modern-input" id="my-birth-date" value="${myCollab.birth_date || ''}">
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">Luogo di Nascita</label>
                                    <input type="text" class="modern-input" id="my-birth-place" value="${myCollab.birth_place || ''}" placeholder="Es. Roma (RM)">
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">Email</label>
                                    <input type="email" class="modern-input" value="${myCollab.email || ''}" disabled style="opacity: 0.7; cursor: not-allowed; background: #f1f5f9;">
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">Telefono</label>
                                    <input type="text" class="modern-input" id="my-phone" value="${myCollab.phone || ''}">
                                </div>
                            </div>
                        </div>

                        <!-- Address -->
                        <div class="settings-section">
                            <h4 class="settings-section-title">
                                <span class="material-icons-round" style="color: var(--brand-blue); background: #eff6ff; padding: 6px; border-radius: 8px;">home</span>
                                Residenza
                            </h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                                <div class="modern-form-group" style="grid-column: 1/-1;">
                                    <label class="modern-label">Indirizzo</label>
                                    <input type="text" class="modern-input" id="my-address" value="${myCollab.address || ''}" placeholder="Via/Piazza, Civico">
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">Città</label>
                                    <input type="text" class="modern-input" id="my-address-city" value="${myCollab.address_city || ''}">
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">Provincia</label>
                                    <input type="text" class="modern-input" id="my-address-province" value="${myCollab.address_province || ''}" maxlength="2" style="text-transform: uppercase;" placeholder="RM">
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">CAP</label>
                                    <input type="text" class="modern-input" id="my-address-cap" value="${myCollab.address_cap || ''}" maxlength="5">
                                </div>
                            </div>
                        </div>

                        <!-- Fiscal & Bank -->
                        <div class="settings-section">
                            <h4 class="settings-section-title">
                                <span class="material-icons-round" style="color: var(--brand-blue); background: #eff6ff; padding: 6px; border-radius: 8px;">account_balance_wallet</span>
                                Dati Fiscali & Bancari
                            </h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                                <div class="modern-form-group">
                                    <label class="modern-label">Codice Fiscale</label>
                                    <input type="text" class="modern-input" id="my-fiscal-code" value="${myCollab.fiscal_code || ''}" style="text-transform: uppercase;">
                                </div>
                                <div class="modern-form-group">
                                    <label class="modern-label">P.IVA</label>
                                    <input type="text" class="modern-input" id="my-vat" value="${myCollab.vat_number || ''}">
                                </div>
                                <div class="modern-form-group" style="grid-column: 1/-1;">
                                    <label class="modern-label">PEC</label>
                                    <input type="email" class="modern-input" id="my-pec" value="${myCollab.pec || ''}">
                                </div>
                                <div class="modern-form-group" style="grid-column: 1/-1;">
                                    <label class="modern-label">Banca</label>
                                    <input type="text" class="modern-input" id="my-bank-name" value="${myCollab.bank_name || ''}">
                                </div>
                                <div class="modern-form-group" style="grid-column: 1/-1;">
                                    <label class="modern-label">IBAN</label>
                                    <input type="text" class="modern-input" id="my-iban" value="${myCollab.iban || ''}" style="font-family: monospace; letter-spacing: 1px;">
                                </div>
                            </div>
                        </div>

                        <!-- Documents -->
                        <div class="settings-section">
                            <h4 class="settings-section-title">
                                <span class="material-icons-round" style="color: var(--brand-blue); background: #eff6ff; padding: 6px; border-radius: 8px;">folder_shared</span>
                                Documenti Personali
                            </h4>
                            <p style="margin: -1rem 0 1.5rem 0; color: var(--text-secondary); font-size: 0.9rem;">
                                Carica i documenti necessari. I file sono protetti e visibili solo all'amministrazione.
                            </p>
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                                <!-- Helper to create dropzone -->
                                ${(() => {
            // NEW RENDER LOGIC
            const renderCard = (id, label, currentUrl, fieldKey) => {
                const hasFile = !!currentUrl;
                if (hasFile) {
                    return `
                                                <div class="upload-zone has-file" id="zone-${id}" style="cursor: default; background: #f0fdf4; border: 2px solid #10B981;">
                                                    <div class="doc-status-badge" style="background: #d1fae5; color: #059669;">
                                                        <span style="display:flex;align-items:center;gap:4px;"><span class="material-icons-round" style="font-size:14px;">check_circle</span> CARICATO</span>
                                                    </div>
                                                    <div style="margin-bottom: 1rem;"><span class="material-icons-round" style="font-size: 3rem; color: #10B981;">description</span></div>
                                                    <h5 style="margin: 0 0 0.2rem 0; font-size: 1rem; color: var(--text-primary);">${label}</h5>
                                                    <div style="display:flex; gap: 0.5rem; justify-content: center;">
                                                        <button type="button" class="secondary-btn small btn-doc-action" data-action="view" data-path="${currentUrl}" style="background:white; border:1px solid #cbd5e1; padding:0.4rem 0.8rem;">Vedi</button>
                                                        <button type="button" class="secondary-btn small btn-doc-action" data-action="delete" data-field="${fieldKey}" style="background:white; border:1px solid #cbd5e1; color:#ef4444; padding:0.4rem 0.8rem;">Elimina</button>
                                                        <button type="button" class="secondary-btn small btn-doc-action" data-action="replace" data-target="${id}" style="background:white; border:1px solid #cbd5e1; padding:0.4rem 0.8rem;">Sostituisci</button>
                                                    </div>
                                                    <input type="file" id="${id}" hidden accept="image/*,.pdf,.heic">
                                                </div>
                                            `;
                } else {
                    return `
                                                <div class="upload-zone" id="zone-${id}" data-target="${id}">
                                                    <input type="file" id="${id}" hidden accept="image/*,.pdf,.heic">
                                                    <div class="doc-status-badge">MANCANTE</div>
                                                    <div style="margin-bottom: 1rem;"><span class="material-icons-round" style="font-size: 3rem; color: #94a3b8;">cloud_upload</span></div>
                                                    <h5 style="margin: 0; font-size: 1rem; color: var(--text-primary);">${label}</h5>
                                                    <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">Trascina o clicca per caricare</div>
                                                </div>
                                            `;
                }
            };
            return `
                                        ${renderCard('upload-doc-id-front', "Carta d'Identità (Fronte)", myCollab.document_id_front_url, 'document_id_front_url')}
                                        ${renderCard('upload-doc-id-back', "Carta d'Identità (Retro)", myCollab.document_id_back_url, 'document_id_back_url')}
                                        ${renderCard('upload-doc-health', "Tessera Sanitaria (Fronte)", myCollab.document_health_card_url, 'document_health_card_url')}
                                        ${renderCard('upload-doc-health-back', "Tessera Sanitaria (Retro)", myCollab.document_health_card_back_url, 'document_health_card_back_url')}
                                    `;

        })()}
                            </div>
                        </div>

                         <!-- System -->
                        <div class="settings-section" style="margin-bottom: 0;">
                            <h4 class="settings-section-title">
                                <span class="material-icons-round" style="color: var(--text-secondary); background: #f1f5f9; padding: 6px; border-radius: 8px;">settings</span>
                                Sistema
                            </h4>
                            <div class="modern-form-group">
                                <label class="modern-label">Fuso Orario</label>
                                <div style="position: relative;">
                                    <select id="my-timezone" class="modern-input" style="appearance: none; cursor: pointer;">
                                        <option value="Europe/Rome">Europe/Rome (GMT+1/GMT+2)</option>
                                        <option value="Europe/London">Europe/London (GMT+0/GMT+1)</option>
                                        <option value="America/New_York">America/New_York (GMT-5/GMT-4)</option>
                                        <option value="America/Los_Angeles">America/Los_Angeles (GMT-8/GMT-7)</option>
                                        <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                                        <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                                        <option value="Australia/Sydney">Australia/Sydney (GMT+10/GMT+11)</option>
                                        <option value="UTC">UTC (GMT+0)</option>
                                    </select>
                                    <span class="material-icons-round" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-secondary);">expand_more</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Floating Save Bar (Visible when changes made? For now permanent) -->
                        <div style="position: sticky; bottom: -2rem; margin: 0 -2rem -2rem -2rem; padding: 1.5rem; background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; align-items: center; gap: 1rem;">
                            <span style="font-size: 0.85rem; color: var(--text-tertiary);">Le modifiche vengono salvate automaticamente? No, clicca Salva.</span>
                            <button type="submit" class="primary-btn" style="padding: 0.8rem 2.5rem; font-size: 1rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);">
                                Salva Modifiche
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Tab Content: Availability -->
            <div id="tab-availability" class="tab-content hidden" style="padding: 0 1rem;">
                <div class="card-grid" style="grid-template-columns: 1fr;">
                    <div id="availability-wrapper"></div>
                </div>

                <!-- Google Calendar Integration Section -->
                <div class="glass-card" style="margin-top: 2rem; padding: 2rem; max-width: 100%;">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round" style="color: #4285F4;">calendar_month</span>
                        Integrazione Google Calendar
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
                        Sincronizza i tuoi calendari per bloccare automaticamente gli slot in cui sei occupato.
                    </p>
                    <div id="google-calendar-status">
                        <div style="padding: 1rem; text-align: center;"><span class="loader small"></span></div>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Notifications -->
            <div id="tab-notifications" class="tab-content hidden" style="padding: 0 1rem;">
                <div class="glass-card" style="padding: 2rem; max-width: 800px;">
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">notifications_active</span>
                        Preferenze Notifiche
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
                        Scegli quali notifiche ricevere e su quale canale.
                    </p>
                    <div id="notification-prefs-list">
                        <div style="padding: 2rem; text-align: center;"><span class="loader"></span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize Timezone Select
    setTimeout(() => {
        const tzSelect = document.getElementById('my-timezone');
        if (tzSelect && state.profile?.timezone) {
            tzSelect.value = state.profile.timezone;
        } else if (tzSelect) {
            // Default check
            tzSelect.value = 'Europe/Rome';
        }
    }, 0);

    // Tabs Logic
    const tabs = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
            });
            contents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--brand-blue);'; // Note: inline style might need check
            tab.style.borderBottomColor = 'var(--brand-blue)';
            tab.style.color = 'var(--brand-blue)';

            const target = document.getElementById('tab-' + tab.dataset.tab);
            if (target) target.classList.remove('hidden');

            if (tab.dataset.tab === 'availability') {
                const availWrapper = document.getElementById('availability-wrapper');
                loadAvailabilityIntoContainer(availWrapper, myCollab.id);
                initGoogleCalendar(myCollab.id);
            }

            if (tab.dataset.tab === 'notifications') {
                loadNotificationPreferences();
            }
        });
    });

    // Initial Load for Active Tab
    const activeTab = container.querySelector('.tab-btn.active');
    if (activeTab && activeTab.dataset.tab === 'availability') {
        const availWrapper = document.getElementById('availability-wrapper');
        loadAvailabilityIntoContainer(availWrapper, myCollab.id);
        initGoogleCalendar(myCollab.id);
    }

    // Form Submit Logic
    const form = document.getElementById('profile-settings-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Salvataggio...';
            btn.disabled = true;

            const updates = {
                id: myCollab.id,
                first_name: document.getElementById('my-first-name').value,
                last_name: document.getElementById('my-last-name').value,
                phone: document.getElementById('my-phone').value,

                // New Fields
                birth_date: document.getElementById('my-birth-date').value || null,
                birth_place: document.getElementById('my-birth-place').value,
                address: document.getElementById('my-address').value,
                address_city: document.getElementById('my-address-city').value,
                address_province: document.getElementById('my-address-province').value,
                address_cap: document.getElementById('my-address-cap').value,

                fiscal_code: document.getElementById('my-fiscal-code').value,
                vat_number: document.getElementById('my-vat').value,
                pec: document.getElementById('my-pec').value,

                bank_name: document.getElementById('my-bank-name').value,
                iban: document.getElementById('my-iban').value,

                full_name: `${document.getElementById('my-first-name').value} ${document.getElementById('my-last-name').value}`,

                // Keep existing required fields
                email: myCollab.email,
                role: myCollab.role,
                tags: myCollab.tags
            };

            const timezone = document.getElementById('my-timezone').value;

            try {
                // Update Collaborators Table
                await upsertCollaborator(updates);

                // Update Profiles Table (Timezone)
                if (timezone) {
                    const { error: tzError } = await supabase
                        .from('profiles')
                        .update({ timezone: timezone })
                        .eq('id', state.profile.id); // Use profile ID (Auth ID)

                    if (tzError) throw tzError;
                    state.profile.timezone = timezone; // Update local state
                }

                window.showAlert('Profilo aggiornato con successo!', 'success');
                // Could refresh state here
            } catch (err) {
                console.error(err);
                window.showAlert('Errore: ' + err.message, 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // Photo Upload Logic
    const avatarContainer = container.querySelector('#avatar-container');
    const avatarInput = container.querySelector('#avatar-input');
    if (avatarContainer && avatarInput) {
        avatarContainer.onclick = () => avatarInput.click();
        avatarInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Show preview or loader
            const overlay = avatarContainer.querySelector('.avatar-overlay');
            overlay.innerHTML = '<span class="material-icons-round rotating" style="font-size: 1.5rem; color: white;">sync</span>';
            overlay.style.opacity = '1';

            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${myCollab.id}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `avatars/${fileName}`;

                // Upload to Storage (Using 'media' bucket which exists)
                const { error: uploadError } = await supabase.storage
                    .from('media')
                    .upload(filePath, file, { cacheControl: '3600', upsert: true });

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('media')
                    .getPublicUrl(filePath);

                // Update Database (Both Collaborators and Profiles)
                const updateData = { avatar_url: publicUrl };

                await Promise.all([
                    upsertCollaborator({ ...myCollab, ...updateData }),
                    supabase.from('profiles').update(updateData).eq('id', state.profile.id)
                ]);

                // Update local state and UI
                myCollab.avatar_url = publicUrl;
                if (state.profile) state.profile.avatar_url = publicUrl;

                const img = avatarContainer.querySelector('#my-avatar-img');
                if (img) {
                    img.src = publicUrl;
                } else {
                    avatarContainer.innerHTML = `
                        <img id="my-avatar-img" src="${publicUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">
                        <div class="avatar-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;">
                            <span class="material-icons-round" style="font-size: 1.5rem; color: white;">photo_camera</span>
                        </div>
                        <input type="file" id="avatar-input" accept="image/*" hidden>
                    `;
                    // Re-bind since we innerHTMLed
                    renderUserProfile(container);
                }

                window.showAlert('Foto profilo aggiornata!', 'success');

                // Refresh sidebar/layout if needed
                if (window.refreshSidebar) window.refreshSidebar();

            } catch (err) {
                console.error("Upload error:", err);
                window.showAlert('Errore nel caricamento della foto: ' + err.message, 'error');
            } finally {
                overlay.innerHTML = '<span class="material-icons-round" style="font-size: 1.5rem; color: white;">photo_camera</span>';
                overlay.style.opacity = '0';
            }
        };
    }

    // --- Document Upload Logic (New Actions) ---
    // Defined separately to be accessible or just scoped here since rendered HTML uses data attributes
    const openSignedDoc = async (path) => {
        try {
            const { data, error } = await supabase.storage
                .from('secure_collaborator_documents')
                .createSignedUrl(path, 60 * 60); // 1 hour

            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (err) {
            console.error("Error signing URL:", err);
            window.showAlert('Impossibile aprire il documento: ' + err.message, 'error');
        }
    };

    // Make it global if needed by older inline code, though we removed inline onclicks
    window.openSignedUrl = openSignedDoc;

    // Safe Confirm Helper
    const confirmAction = async (msg) => {
        if (window.showConfirm) return await window.showConfirm(msg);
        return confirm(msg);
    };

    const deleteDoc = async (field, docName) => {
        if (!await confirmAction(`Sei sicuro di voler eliminare ${docName || 'questo documento'}?`)) return;

        try {
            const updateData = { [field]: null };
            await upsertCollaborator({ ...myCollab, ...updateData });

            window.showAlert('Documento eliminato.', 'success');

            // Capture active tab
            const activeTab = container.querySelector('.tab-btn.active')?.dataset.tab;

            await renderUserProfile(container);

            // Restore active tab
            if (activeTab) {
                const tabBtn = container.querySelector(`.tab-btn[data-tab="${activeTab}"]`);
                if (tabBtn) tabBtn.click();
            }
        } catch (err) {
            console.error(err);
            window.showAlert('Errore eliminazione: ' + err.message, 'error');
        }
    };

    const docInputs = [
        { id: 'upload-doc-id-front', field: 'document_id_front_url', type: 'id_front', label: "Carta d'Identità (Fronte)" },
        { id: 'upload-doc-id-back', field: 'document_id_back_url', type: 'id_back', label: "Carta d'Identità (Retro)" },
        { id: 'upload-doc-health', field: 'document_health_card_url', type: 'health_card', label: "Tessera Sanitaria (Fronte)" },
        { id: 'upload-doc-health-back', field: 'document_health_card_back_url', type: 'health_card_back', label: "Tessera Sanitaria (Retro)" }
    ];

    const processingUpload = async (file, docConfig, zoneElement) => {
        if (!file) return;

        // UI Loading State (Simplified for just the zone or notification)
        // If zone has complex HTML (card), replacing innerHTML is tricky if we want to preserve layout?
        // But we re-render profile on success anyway.
        // Let's just show a global spinner or modify the zone temporarily.
        const originalContent = zoneElement.innerHTML;
        zoneElement.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height: 150px;">
                <span class="material-icons-round rotating" style="font-size: 3rem; color: var(--brand-blue);">sync</span>
                <p style="margin-top:1rem; color:var(--brand-blue); font-weight:500;">Caricamento...</p>
            </div>
        `;
        zoneElement.style.pointerEvents = 'none';

        try {
            const userId = state.session.user.id;
            const fileExt = file.name.split('.').pop();
            const filePath = `${userId}/${docConfig.type}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('secure_collaborator_documents')
                .upload(filePath, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            // Update Database
            const updateData = { [docConfig.field]: filePath };
            await upsertCollaborator({ ...myCollab, ...updateData });

            window.showAlert('Documento caricato con successo!', 'success');

            // Capture active tab
            const activeTab = container.querySelector('.tab-btn.active')?.dataset.tab;

            await renderUserProfile(container);

            // Restore active tab
            if (activeTab) {
                const tabBtn = container.querySelector(`.tab-btn[data-tab="${activeTab}"]`);
                if (tabBtn) tabBtn.click();
            }

        } catch (err) {
            console.error("Doc upload error:", err);
            window.showAlert('Errore upload: ' + err.message, 'error');
            // Restore? Render profile is safer.
            renderUserProfile(container);
        }
    };

    docInputs.forEach(doc => {
        const input = document.getElementById(doc.id);
        const zone = container.querySelector(`[data-target="${doc.id}"]`); // logic for empty state
        // If "has-file", the ID is `zone-${doc.id}`? No, HTML template uses `id="zone-${id}"` for both?
        // Let's check HTML again.
        // Yes: `<div class="upload-zone ..." id="zone-${id}" ...>`

        const zoneElement = document.getElementById(`zone-${doc.id}`);

        if (!input || !zoneElement) return;

        // Attach Action Listeners (Delegation inside the zone)
        zoneElement.addEventListener('click', (e) => {
            const target = e.target.closest('button');

            if (target && target.dataset.action) {
                e.stopPropagation();
                const action = target.dataset.action;

                if (action === 'view') {
                    openSignedDoc(target.dataset.path);
                } else if (action === 'delete') {
                    // data-field was set to doc.fieldKey (db column)
                    deleteDoc(target.dataset.field, doc.label);
                } else if (action === 'replace') {
                    input.click();
                }
            } else {
                // If clicking the zone itself (and not a button)
                // If it is empty state, we want to trigger upload.
                // If it is 'has-file', we do nothing or maybe just nothing.
                if (!zoneElement.classList.contains('has-file')) {
                    input.click();
                }
            }
        });

        // Input Change
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            processingUpload(file, doc, zoneElement);
        });

        // Drag & Drop
        zoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!zoneElement.classList.contains('has-file')) {
                zoneElement.style.borderColor = 'var(--brand-blue)';
                zoneElement.style.backgroundColor = '#f0f9ff';
            }
        });

        zoneElement.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!zoneElement.classList.contains('has-file')) {
                zoneElement.style.borderColor = '#cbd5e1'; // default
                zoneElement.style.backgroundColor = 'white'; // default
            } // If has-file, we leave it as is (green border)
        });

        zoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!zoneElement.classList.contains('has-file')) {
                zoneElement.style.borderColor = '#cbd5e1';
                zoneElement.style.backgroundColor = 'white';
            }

            const file = e.dataTransfer.files[0];
            if (file) {
                processingUpload(file, doc, zoneElement);
            }
        });
    });

    // Impersonation Logic
    const impersonateSelect = container.querySelector('#impersonate-role-select');
    if (impersonateSelect) {
        impersonateSelect.addEventListener('change', (e) => {
            const newRole = e.target.value;
            console.log(`[Impersonation] Switching view to: ${newRole}`);

            // Update State
            state.impersonatedRole = newRole;

            // Update UI
            import('../features/layout.js?v=148').then(({ updateSidebarVisibility }) => {
                updateSidebarVisibility();

                // If switching to collaborator and currently on a restricted page, redirect
                if (newRole === 'collaborator') {
                    // Force navigation to booking if on dashboard
                    if (state.currentPage === 'dashboard') {
                        window.location.hash = 'booking';
                    }
                }
            });
        });
    }
}

async function loadAvailability(collaboratorId) {
    const container = document.getElementById('availability-wrapper');
    if (!container) return;

    container.innerHTML = '<div style="padding:2rem; text-align:center;"><span class="loader"></span></div>';

    try {
        console.log("Loading availability...");
        const [rules, restDays, _, skills, extraSlots, bookingAssignments] = await Promise.all([
            fetchAvailabilityRules(collaboratorId),
            fetchRestDays(collaboratorId),
            fetchCollaboratorServices(), // Keep for other logic if needed
            fetchCollaboratorSkills(collaboratorId), // New: Get assigned competencies
            fetchAvailabilityOverrides(collaboratorId), // New: Get extra slots
            fetchBookingItemCollaborators(collaboratorId) // New: Booking Items
        ]);

        // 1. Services from Active Orders (Historical/Current)
        const orderServices = state.collaboratorServices
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

        // Merge and Deduplicate
        const allServices = [...bookingServices];
        const uniqueServices = [];
        const seen = new Set();

        allServices.forEach(s => {
            if (s.id && !seen.has(s.id)) {
                uniqueServices.push(s);
                seen.add(s.id);
            }
        });

        console.log("Availability Dropdown Services:", uniqueServices);

        renderAvailabilityEditor(container, collaboratorId, rules, restDays, uniqueServices, extraSlots);
    } catch (err) {
        container.innerHTML = `
            <div style="padding:2rem; text-align:center; color: var(--error-color);">
                <span class="material-icons-round">error_outline</span>
                <p>Errore caricamento: ${err.message}</p>
                <button class="secondary-btn" onclick="document.querySelector('[data-tab=availability]').click()">Riprova</button>
            </div>`;
        console.error(err);
    }
}

function renderAvailabilityEditor(container, collaboratorId, existingRules, restDays, myServices, extraSlots = []) {
    console.log("Rendering Availability. Extra Slots:", extraSlots);
    const days = [
        { id: 1, name: 'Lun', fullName: 'Lunedì' },
        { id: 2, name: 'Mar', fullName: 'Martedì' },
        { id: 3, name: 'Mer', fullName: 'Mercoledì' },
        { id: 4, name: 'Gio', fullName: 'Giovedì' },
        { id: 5, name: 'Ven', fullName: 'Venerdì' },
        { id: 6, name: 'Sab', fullName: 'Sabato' },
        { id: 0, name: 'Dom', fullName: 'Domenica' }
    ];

    // Prepare rules map: Day -> Array of Rules
    const rulesMap = {};
    days.forEach(d => rulesMap[d.id] = []);
    existingRules.forEach(r => {
        if (rulesMap[r.day_of_week]) rulesMap[r.day_of_week].push(r);
    });

    // Helper to generate service options
    const getServiceOptions = (selectedId) => {
        return `
            <option value="" ${!selectedId ? 'selected' : ''}>Tutti i servizi</option>
            ${myServices.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name}</option>`).join('')}
        `;
    };

    const html = `
        <style>
            /* Custom styling for native inputs */
            .availability-section input[type="time"],
            .availability-section input[type="date"],
            .availability-section select {
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                background: white;
                border: 1.5px solid #e2e8f0;
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 0.9rem;
                font-family: inherit;
                color: var(--text-primary);
                transition: all 0.2s;
                cursor: pointer;
            }
            
            .availability-section input[type="time"]:hover,
            .availability-section input[type="date"]:hover,
            .availability-section select:hover {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .availability-section input[type="time"]:focus,
            .availability-section input[type="date"]:focus,
            .availability-section select:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
            }
            
            .availability-section select {
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667eea' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 10px center;
                padding-right: 32px;
            }
            
            .time-slot {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                transition: all 0.2s;
            }
            
            .time-slot:hover {
                border-color: #667eea;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
            }
        </style>
        
        <div class="availability-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; height: calc(100vh - 280px); overflow: hidden;">
            
            <!-- LEFT COLUMN: WEEKLY SCHEDULE -->
            <section style="background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--glass-border); display: flex; flex-direction: column; overflow: hidden;">
                <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round" style="color: var(--brand-blue);">calendar_month</span>
                            Orario Settimanale
                        </h3>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 400;">Fasce ricorrenti ogni settimana</p>
                    </div>
                    <button class="primary-btn" id="save-availability-btn" style="padding: 0.6rem 1.25rem; font-size: 0.9rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);">
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
                            <div class="slots-container" style="display: flex; flex-direction: column; gap: 0.6rem;">
                                <!-- Slots injected here -->
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>

            <!-- RIGHT COLUMN: EXTRA & REST DAYS -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem; overflow: hidden;">
                
                <!-- EXTRA AVAILABILITY -->
                <section style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 1.5rem; border-radius: 16px; border: 2px solid #667eea30; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;">
                    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 600; color: #667eea; display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 20px;">event_available</span>
                                Disponibilità Extra
                            </h3>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 400;">Date specifiche aggiuntive</p>
                        </div>
                        <button class="primary-btn" id="add-extra-slot-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                            <span class="material-icons-round" style="font-size: 16px;">add</span>
                            Aggiungi
                        </button>
                    </div>

                    <div id="extra-slots-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem; min-height: 0;">
                         <!-- List injected via JS -->
                    </div>
                </section>

                <!-- REST DAYS -->
                <section style="background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid var(--glass-border); flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;">
                    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="color: #ef4444;">event_busy</span>
                                Giorni di Riposo
                            </h3>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 400;">Ferie e permessi</p>
                        </div>
                        <button class="secondary-btn" id="add-rest-day-btn" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: white; border: 1px solid var(--glass-border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                            <span class="material-icons-round" style="font-size: 16px;">add</span>
                            Aggiungi
                        </button>
                    </div>

                    <div id="rest-days-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem; min-height: 0;">
                        <!-- List injected via JS -->
                    </div>
                </section>
            </div>
        </div>
    `;

    container.innerHTML = html;



    // --- LOGIC: SLOTS RENDERER ---
    const renderSlot = (slotContainer, start = '09:00', end = '18:00', serviceId = null) => {
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
            <select class="slot-service" style="width: 100%;">
                ${getServiceOptions(serviceId)}
            </select>
        `;

        // Bind Remove
        slotDiv.querySelector('.remove-slot-btn').addEventListener('click', () => {
            slotDiv.remove();
        });

        slotContainer.appendChild(slotDiv);
    };

    // Initialize Slots
    days.forEach(day => {
        const dayRow = container.querySelector(`.day-row[data-day="${day.id}"]`);
        const slotsContainer = dayRow.querySelector('.slots-container');
        const dayRules = rulesMap[day.id];

        if (dayRules && dayRules.length > 0) {
            dayRules.forEach(r => renderSlot(slotsContainer, r.start_time.slice(0, 5), r.end_time.slice(0, 5), r.service_id));
        }

        // Bind Add Button
        dayRow.querySelector('.add-slot-btn').addEventListener('click', () => {
            renderSlot(slotsContainer);
        });
    });

    // --- LOGIC: SAVE AVAILABILITY ---
    const saveBtn = container.querySelector('#save-availability-btn');
    saveBtn.addEventListener('click', async () => {
        saveBtn.innerHTML = 'Salvataggio...';
        saveBtn.disabled = true;

        const newRules = [];
        container.querySelectorAll('.day-row').forEach(row => {
            const dayId = parseInt(row.dataset.day);
            row.querySelectorAll('.time-slot').forEach(slot => {
                const start = slot.querySelector('.slot-start').value;
                const end = slot.querySelector('.slot-end').value;
                const serviceId = slot.querySelector('.slot-service').value || null;

                if (start && end) {
                    newRules.push({
                        day_of_week: dayId,
                        start_time: start,
                        end_time: end,
                        service_id: serviceId
                    });
                }
            });
        });

        try {
            await saveAvailabilityRules(collaboratorId, newRules);
            window.showAlert('Disponibilità salvata con successo!', 'success');
        } catch (err) {
            console.error(err);
            window.showAlert('Errore salvataggio: ' + err.message, 'error');
        } finally {
            saveBtn.innerHTML = 'Salva Disponibilità';
            saveBtn.disabled = false;
        }
    });

    // --- LOGIC: EXTRA AVAILABILITY (OVERRIDES) ---
    const renderExtraSlot = (slot) => {
        const startDate = new Date(slot.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        const endDate = slot.end_date ? new Date(slot.end_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : null;
        const dateDisplay = endDate ? `${startDate} - ${endDate}` : startDate;

        return `
            <div style="background: white; border-radius: 10px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #667eea; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 2px;">
                        ${dateDisplay}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span>${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}</span>
                        <span style="color: #667eea;">• ${slot.services?.name || 'Tutti i servizi'}</span>
                    </div>
                </div>
                <button class="icon-btn delete-override-btn" data-id="${slot.id}" title="Elimina" style="background: var(--bg-secondary); border-radius: 6px; width: 28px; height: 28px; flex-shrink: 0;">
                    <span class="material-icons-round" style="color: var(--error-color); font-size: 16px;">delete_outline</span>
                </button>
            </div>
        `;
    };

    const extrasList = container.querySelector('#extra-slots-list');
    if (extraSlots && extraSlots.length > 0) {
        extrasList.innerHTML = extraSlots.map(renderExtraSlot).join('');
    } else {
        extrasList.innerHTML = '<p style="text-align:center; color:var(--text-tertiary); padding: 1rem;">Nessuna disponibilità extra aggiunta.</p>';
    }

    // Handlers
    container.querySelectorAll('.delete-override-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await window.showConfirm('Eliminare questa disponibilità extra?')) {
                try {
                    await deleteAvailabilityOverride(btn.dataset.id);
                    loadAvailability(collaboratorId);
                } catch (err) {
                    window.showAlert('Errore: ' + err.message, 'error');
                }
            }
        });
    });

    container.querySelector('#add-extra-slot-btn').addEventListener('click', () => {
        openExtraSlotModal(collaboratorId, myServices, () => loadAvailability(collaboratorId));
    });

    // --- LOGIC: REST DAYS ---

    // Delete Handlers
    container.querySelectorAll('.delete-rest-day-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (await window.showConfirm('Eliminare questo giorno di riposo?')) {
                try {
                    await deleteRestDay(btn.dataset.id);
                    loadAvailability(collaboratorId); // Reload to refresh list
                } catch (err) {
                    window.showAlert('Errore eliminazione: ' + err.message, 'error');
                }
            }
        });
    });

    // Add Handler (Simple Prompt or Modal - Improving to Custom Modal)
    container.querySelector('#add-rest-day-btn').addEventListener('click', () => {
        openRestDayModal(collaboratorId, () => loadAvailability(collaboratorId));
    });
}

function openRestDayModal(collaboratorId, onSuccess) {
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
                        <button type="button" class="secondary-btn close-modal">Annulla</button>
                        <button type="submit" class="primary-btn">Salva</button>
                    </div>
                </form>
                `;

    // Use global render helper
    const modalId = 'rest-day-modal';
    // Small hack: we need to access the renderModal from utils or just implement it here if not available
    // importing renderModal from user_dashboard? No, it's in utils. 
    // We didn't import renderModal in imports. 
    // Let's rely on a simple dynamic creation or existing global if any.
    // Actually, let's just append to body as we did in ModalUtils (system modals are usually global, but custom forms...)

    // We'll Create a Quick Modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal active';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `<div class="modal-content animate-scale-in" style="max-width: 500px;">${content}</div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.close-modal').addEventListener('click', close);

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

function openExtraSlotModal(collaboratorId, services, onSuccess) {
    const serviceOptions = `
                <option value="">Tutti i servizi</option>
                ${services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                `;

    const content = `
                <div class="modal-header-premium" style="margin-bottom: 2rem; position: relative;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                            <span class="material-icons-round">event_available</span>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.3rem; font-weight: 600; color: var(--text-primary);">Aggiungi Disponibilità</h2>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); font-weight: 400;">Definisci un giorno o un periodo specifico</p>
                        </div>
                    </div>
                    <button class="icon-btn close-modal" style="position: absolute; top: -0.5rem; right: -0.5rem; background: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid var(--glass-border); transition: all 0.2s;">
                        <span class="material-icons-round" style="font-size: 20px; color: var(--text-secondary);">close</span>
                    </button>
                </div>

                <form id="extra-slot-form" class="premium-form">
                    <!-- Periodo -->
                    <div style="background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round" style="font-size: 16px;">date_range</span>
                            Periodo
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Data Inizio</label>
                                <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}"
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Data Fine <span style="font-weight: 400; color: var(--text-tertiary);">(Opzionale)</span></label>
                                <input type="date" name="end_date"
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                            </div>
                        </div>
                    </div>

                    <!-- Orario -->
                    <div style="background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round" style="font-size: 16px;">schedule</span>
                            Orario
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Dalle</label>
                                <input type="time" name="start_time" value="09:00" required
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Alle</label>
                                <input type="time" name="end_time" value="18:00" required
                                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; font-family: inherit;">
                            </div>
                        </div>
                    </div>

                    <!-- Servizio -->
                    <div style="background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); display: flex; align-items: center; gap: 0.5rem;">
                            <span class="material-icons-round" style="font-size: 16px;">work_outline</span>
                            Servizio
                        </h3>
                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">Servizio Dedicato <span style="font-weight: 400; color: var(--text-tertiary);">(Opzionale)</span></label>
                            <select name="service_id"
                                style="width: 100%; padding: 0.75rem; border: 1px solid var(--glass-border); border-radius: 10px; font-size: 0.9rem; background: white; transition: all 0.2s; cursor: pointer; font-family: inherit;">
                                ${serviceOptions}
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem;">
                        <button type="submit" class="primary-btn" style="min-width: 160px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0.875rem 2rem; border-radius: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.2s; border: none; color: white; cursor: pointer; font-size: 0.95rem;">
                            <span style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons-round" style="font-size: 18px;">check</span>
                                Salva Disponibilità
                            </span>
                        </button>
                    </div>
                </form>
                `;

    const overlay = document.createElement('div');
    overlay.className = 'modal active glass-modal-overlay';
    overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(12px);
                display: flex; align-items: center; justify-content: center; z-index: 9999;
                animation: fadeIn 0.3s ease;
                `;

    overlay.innerHTML = `
                <div class="modal-content animate-scale-in" style="
            background: white;
            border-radius: 24px;
            padding: 2.5rem;
            width: 100%;
            max-width: 650px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            max-height: 90vh;
            overflow-y: auto;
        ">
                    ${content}
                </div>
                `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    overlay.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', close));

    overlay.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        if (formData.get('start_time') >= formData.get('end_time')) {
            window.showAlert('L\'orario di fine deve essere dopo quello di inizio.', 'error');
            return;
        }

        const data = {
            collaborator_id: collaboratorId,
            date: formData.get('date'),
            end_date: formData.get('end_date') || null,
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            service_id: formData.get('service_id') || null,
            is_available: true
        };

        const btn = overlay.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="loader small white"></span>';

        try {
            await upsertAvailabilityOverride(data);
            window.showAlert('Disponibilità salvata!', 'success');
            close();
            onSuccess();
        } catch (err) {
            console.error(err);
            btn.disabled = false;
            btn.innerText = 'Salva Apertura';
            window.showAlert('Errore: ' + err.message, 'error');
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
}

// --- GOOGLE CALENDAR INTEGRATION ---
// Google Client ID is now fetched dynamically from system_config
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar'; // Full access required for sync

async function initGoogleCalendar(collaboratorId) {
    const statusContainer = document.getElementById('google-calendar-status');
    if (!statusContainer) return;

    // Check for OAuth code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        // Clear code from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        await handleGoogleCallback(collaboratorId, code);
    }

    try {
        const auth = await fetchGoogleAuth(collaboratorId);
        renderGoogleCalendarStatus(statusContainer, auth, collaboratorId);
    } catch (err) {
        console.error("Failed to load google auth:", err);
        statusContainer.innerHTML = `<div style="color: var(--error-color);">Errore nel caricamento dell'integrazione.</div>`;
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
                    initGoogleCalendar(collaboratorId);
                    // Reload window to clear parameters if any
                    window.location.reload();
                } catch (err) {
                    console.error(err);
                    window.showAlert('Errore: ' + err.message, 'error');
                }
            }
        };
    }
}

async function openGoogleCalendarModal(collaboratorId, auth) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay animate-fade-in';
    overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center;`;

    overlay.innerHTML = `
        <div class="glass-card animate-slide-up" style="width: 100%; max-width: 450px; padding: 2rem; position: relative;">
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
                initGoogleCalendar(collaboratorId);
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

async function startGoogleOAuth() {
    try {
        // Fallback hardcoded ID to ensure it works NOW immediately for the user
        const hardcodedId = '167545062244-81joujmp8m4hgdd3oogn1v2309g6ldai.apps.googleusercontent.com';
        let clientId = await fetchSystemConfig('google_client_id');

        if (!clientId) {
            console.warn("Config not found in DB, using fallback");
            clientId = hardcodedId;
        }

        let redirectUri = window.location.origin + window.location.pathname;
        if (redirectUri.endsWith('/')) {
            redirectUri = redirectUri.slice(0, -1);
        }
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
        initGoogleCalendar(collaboratorId);
    } catch (err) {
        console.error("OAuth Exchange failed:", err);
        window.showAlert('Errore nel collegamento Google: ' + err.message, 'error');
    }
}

// --- NOTIFICATION PREFERENCES ---

async function loadNotificationPreferences() {
    const container = document.getElementById('notification-prefs-list');
    if (!container) return;

    container.innerHTML = '<div style="padding: 2rem; text-align: center;"><span class="loader"></span></div>';

    try {
        const session = state.session;
        if (!session) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-tertiary);">Sessione non valida.</p>';
            return;
        }

        const [types, userPrefs] = await Promise.all([
            fetchNotificationTypes(),
            fetchUserNotificationPreferences(session.user.id)
        ]);

        if (types.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-tertiary);">Nessun tipo di notifica configurato.</p>';
            return;
        }

        // Build a map of user preferences keyed by notification_type_id
        const prefsMap = {};
        userPrefs.forEach(pref => {
            prefsMap[pref.notification_type_id] = pref;
        });

        // Group types by category
        const grouped = {};
        types.forEach(t => {
            if (!grouped[t.category]) grouped[t.category] = [];
            grouped[t.category].push(t);
        });

        const categoryLabels = {
            'booking': 'Prenotazioni',
            'payment': 'Pagamenti',
            'invoice': 'Fatture',
            'order': 'Ordini',
            'general': 'Generali'
        };

        let html = '';
        for (const category in grouped) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">
                        ${categoryLabels[category] || category}
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            `;

            grouped[category].forEach(type => {
                const pref = prefsMap[type.id];
                const emailEnabled = pref ? pref.email_enabled : type.default_email;
                const webEnabled = pref ? pref.web_enabled : type.default_web;

                html += `
                    <div class="notification-pref-row" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--glass-border);">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; color: var(--text-primary);">${type.label_it}</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary);">${type.description || ''}</div>
                        </div>
                        <div style="display: flex; gap: 1.5rem; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Ricevi notifica in-app">
                                <input type="checkbox" class="pref-toggle" data-type-id="${type.id}" data-channel="web" ${webEnabled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--brand-blue);">
                                <span class="material-icons-round" style="font-size: 1.2rem; color: var(--text-secondary);">notifications</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Ricevi email">
                                <input type="checkbox" class="pref-toggle" data-type-id="${type.id}" data-channel="email" ${emailEnabled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--brand-blue);">
                                <span class="material-icons-round" style="font-size: 1.2rem; color: var(--text-secondary);">email</span>
                            </label>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Bind toggle handlers
        container.querySelectorAll('.pref-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const typeId = e.target.dataset.typeId;
                const channel = e.target.dataset.channel;
                const enabled = e.target.checked;

                // Find current prefs for this type
                const row = e.target.closest('.notification-pref-row');
                const webToggle = row.querySelector('[data-channel="web"]');
                const emailToggle = row.querySelector('[data-channel="email"]');

                const preference = {
                    user_id: session.user.id,
                    notification_type_id: typeId,
                    web_enabled: webToggle.checked,
                    email_enabled: emailToggle.checked,
                    updated_at: new Date().toISOString()
                };

                try {
                    await upsertUserNotificationPreference(preference);
                    // Visual feedback (brief)
                    e.target.style.outline = '2px solid var(--success-color)';
                    setTimeout(() => e.target.style.outline = 'none', 500);
                } catch (err) {
                    console.error('Failed to save preference:', err);
                    window.showAlert('Errore nel salvataggio preferenza.', 'error');
                    // Revert toggle
                    e.target.checked = !enabled;
                }
            });
        });

    } catch (err) {
        console.error('Error loading notification preferences:', err);
        container.innerHTML = `<p style="text-align:center; color:var(--error-color);">Errore: ${err.message}</p>`;
    }
}

