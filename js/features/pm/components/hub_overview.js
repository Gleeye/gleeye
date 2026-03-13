// Hub Overview Tab - Progress, Urgenze, Appuntamenti, Azioni Rapide

const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#64748b', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completata', color: '#10b981', bg: '#ecfdf5' }
};

const COMMESSA_STATUS = {
    'in_svolgimento': { label: 'In Svolgimento', color: '#3b82f6' },
    'lavoro_in_attesa': { label: 'In Attesa', color: '#f59e0b' },
    'in_pausa': { label: 'In Pausa', color: '#64748b' },
    'manutenzione': { label: 'Ongoing', color: '#06b6d4' },
    'completato': { label: 'Completato', color: '#10b981' }
};

function getCommessaStatusInfo(status) {
    if (!status) return { label: 'Non impostato', color: 'var(--text-secondary)' };
    const s = status.toLowerCase().trim().replace(/_/g, ' ');
    let key = null;
    if (s.includes('completato') || s.includes('concluso') || s.includes('finito')) key = 'completato';
    else if (s.includes('pausa') || s.includes('sospeso')) key = 'in_pausa';
    else if (s.includes('ongoing') || s.includes('manutenzione') || s.includes('assistenza')) key = 'manutenzione';
    else if (s.includes('svolgimento') || s.includes('in corso')) key = 'in_svolgimento';
    else if (s.includes('attesa')) key = 'lavoro_in_attesa';

    if (key && COMMESSA_STATUS[key]) return COMMESSA_STATUS[key];
    return { label: status, color: 'var(--text-primary)' };
}

export async function renderHubOverview(container, items, kpis, spaceId) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const orderId = window._hubContext?.orderId;
    const space = window._hubContext?.space;

    // Fetch overview data
    let appointments = [];
    let activityLogs = [];
    let recentComments = [];
    let docPages = [];

    try {
        const api_v = Date.now();
        const { fetchAppointments, fetchPMActivityLogs } = await import('/js/modules/pm_api.js?v=' + api_v);
        const { ensureDocSpace, fetchVisiblePages } = await import('/js/modules/docs_api.js?v=' + api_v);
        const { supabase } = await import('/js/modules/config.js');

        const refId = orderId || spaceId;
        const refType = orderId ? 'order' : 'space';

        // 1. Appointments, Logs & Comments
        const [appts, logs, docSpace, { data: comms }] = await Promise.all([
            refId ? fetchAppointments(refId, refType) : [],
            spaceId ? fetchPMActivityLogs(spaceId) : [],
            spaceId ? ensureDocSpace(spaceId) : null,
            spaceId ? supabase.from('pm_item_comments').select(`
                id, body, created_at, pm_item_ref,
                profiles!author_user_ref ( full_name, avatar_url ),
                item:pm_item_ref!inner ( title, space_ref )
            `).eq('item.space_ref', spaceId).order('created_at', { ascending: false }).limit(8) : { data: [] }
        ]);

        // Filter and clip
        appointments = appts.filter(appt => {
            const isAccount = appt.is_account_level || appt.appointment_internal_participants?.some(p => p.role === 'account') || appt.note?.toLowerCase().includes('[account]');
            return !isAccount;
        });
        activityLogs = logs.slice(0, 8);
        recentComments = comms || [];

        // 2. Docs
        if (docSpace) {
            docPages = await fetchVisiblePages(docSpace.id);
            docPages = docPages.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8);
        }

    } catch (err) {
        console.error("Error fetching data for overview:", err);
    }

    // Resources from context
    const resources = (() => {
        try {
            const raw = space?.cloud_links;
            if (!raw) return [];
            return (typeof raw === 'string' ? JSON.parse(raw) : raw).slice(0, 8);
        } catch { return []; }
    })();

    // Get overdue + soon items merged into "Urgenze"
    const urgentItems = items
        .filter(i => {
            if (!i.due_date || i.status === 'done') return false;
            const due = new Date(i.due_date);
            return due <= weekFromNow;
        })
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 10);

    // Get upcoming appointments
    const upcomingAppts = appointments
        .filter(a => a.status !== 'annullato' && new Date(a.end_time) >= now)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 5);

    container.innerHTML = `
        <style>
            /* === BASE DESKTOP STYLES === */
            #hub-tab-content .hub-overview, 
            #hub-tab-content .hub-overview * {
                box-sizing: border-box !important;
            }
            #hub-tab-content .hub-overview {
                display: grid;
                grid-template-columns: 1.35fr 1fr 1fr;
                gap: 1.5rem;
                height: calc(100vh - 280px);
                min-height: 600px;
                padding-bottom: 2rem;
                width: 100%;
                max-width: 1300px; /* Cap width to prevent infinite stretching */
            }
            .overview-card {
                background: white;
                border-radius: 16px;
                padding: 1.25rem;
                box-shadow: var(--shadow-sm);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid var(--surface-2);
                min-width: 0;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 0.5rem;
            }
            .sub-column-grid {
                display: grid;
                grid-template-rows: 1fr 1fr;
                gap: 1.25rem;
                overflow: hidden;
                min-width: 0;
            }
            #hub-tab-content .custom-scrollbar::-webkit-scrollbar {
                width: 3px;
            }
            #hub-tab-content .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            #hub-tab-content .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(var(--brand-color-rgb, 78, 146, 216), 0.15);
                border-radius: 10px;
            }
            #hub-tab-content .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(var(--brand-color-rgb, 78, 146, 216), 0.3);
            }

            /* === TABLET / MEDIUM DESKTOP === */
            @media (max-width: 1550px) {
                #hub-tab-content .hub-overview {
                    grid-template-columns: 1fr 340px;
                    height: auto;
                    min-height: 0;
                }
                .sub-column-grid {
                    height: calc(100vh - 280px);
                    min-height: 600px;
                }
            }

            @media (max-width: 1350px) {
                #hub-tab-content .hub-overview {
                    grid-template-columns: 1fr;
                    display: block;
                    height: auto;
                    min-height: 0;
                }
                .sub-column-grid {
                    display: grid;
                    height: auto;
                    min-height: 0;
                    grid-template-rows: none;
                    grid-template-columns: 1fr 1fr;
                    margin-top: 1.25rem;
                    gap: 1rem;
                }
                .overview-card {
                    height: 480px;
                    margin-bottom: 1.25rem;
                    width: 100%;
                }
            }

            /* === MOBILE — COMPLETE RETHINK === */
            @media (max-width: 768px) {
                #hub-tab-content .hub-overview {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 0 !important;
                    height: auto !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                }

                /* Cards become invisible containers for vertical sections */
                .overview-card {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    border-radius: 0 !important;
                    padding: 1rem 0 !important; /* Edge to edge vertical padding */
                    height: auto !important;
                    margin-bottom: 0 !important;
                    overflow: visible !important;
                    border-bottom: 8px solid var(--surface-1) !important; /* Thick separator */
                }
                .overview-card:last-child { border-bottom: none !important; }

                /* Headers need some padding to not touch the absolute edge but items should be full width */
                .overview-card > div:first-child {
                    padding: 0 0.5rem !important;
                    margin-bottom: 0.75rem !important;
                }

                /* Stats strip */
                .stats-grid {
                    display: flex !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    gap: 0.4rem !important;
                    padding: 0 0.5rem 0.5rem 0.5rem !important;
                    -webkit-overflow-scrolling: touch;
                }
                .stats-grid::-webkit-scrollbar { display: none; }
                .stats-grid > div {
                    flex-shrink: 0 !important;
                    min-width: 60px !important;
                    padding: 0.5rem 0.4rem !important;
                    border-radius: 6px !important;
                }

                /* Items (Urgenze, Appuntamenti, ecc) become edge-to-edge list rows */
                .urgent-item, .appointment-item, .preview-item, .comment-preview-item {
                    background: transparent !important;
                    border: none !important;
                    border-bottom: 1px solid var(--surface-2) !important;
                    border-radius: 0 !important;
                    padding: 0.85rem 0.5rem !important;
                    margin-bottom: 0 !important;
                    box-shadow: none !important;
                    width: 100% !important;
                }
                
                /* Sub-column grids flatten */
                .sub-column-grid { display: contents !important; }

                /* Peek & Expand: clipped lists */
                .peek-clipped {
                    max-height: 220px !important;
                    overflow: hidden !important;
                    position: relative !important;
                }
                .peek-clipped::after {
                    content: '';
                    position: absolute;
                    bottom: 0; left: 0; right: 0;
                    height: 50px;
                    background: linear-gradient(transparent, white);
                    pointer-events: none;
                }
                .peek-toggle-btn {
                    display: flex !important;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    width: 100%;
                    padding: 0.6rem;
                    border: none;
                    border-top: 1px solid var(--surface-2);
                    background: var(--surface-1);
                    color: var(--brand-color);
                    font-size: 0.75rem;
                    font-weight: 700;
                    font-family: 'Outfit', sans-serif;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .peek-toggle-btn .material-icons-round {
                    font-size: 1rem;
                    transition: transform 0.2s;
                }
                .peek-toggle-btn.expanded .material-icons-round {
                    transform: rotate(180deg);
                }
            }
        </style>
        <div class="hub-overview">
            
            <!-- Column 1: Board Overview (Stats + Urgencies) -->
            <div class="overview-card">
                
                <!-- Header with Stats -->
                <div style="margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <div style="width: 32px; height: 32px; border-radius: 9px; background: var(--surface-1); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: var(--brand-color); font-size: 1.15rem;">analytics</span>
                            </div>
                            <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">Stato delle Attività</span>
                        </div>
                        <button class="nav-to-tab-btn" data-target="board" title="Vai alla Board" style="
                            padding: 6px; border-radius: 8px; border: 1px solid var(--surface-2); 
                            background: white; color: var(--text-secondary); cursor: pointer;
                            display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'; this.style.color='var(--brand-color)';" onmouseout="this.style.background='white'; this.style.color='var(--text-secondary)';">
                            <span class="material-icons-round" style="font-size: 1.2rem;">arrow_forward</span>
                        </button>
                    </div>

                    <!-- Horizontal Stats Grid -->
                    <div class="stats-grid">
                        <div style="background: var(--surface-1); padding: 0.5rem; border-radius: 10px; border: 1px solid var(--surface-2); text-align: center;">
                            <div style="font-size: 0.55rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 2px;">Totale</div>
                            <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">${items.length}</div>
                        </div>
                        <div style="background: #ecfdf5; padding: 0.5rem; border-radius: 10px; border: 1px solid #d1fae5; text-align: center;">
                            <div style="font-size: 0.55rem; font-weight: 700; color: #059669; text-transform: uppercase; margin-bottom: 2px;">Comp.</div>
                            <div style="font-size: 1rem; font-weight: 800; color: #065f46;">${kpis.done}</div>
                        </div>
                        <div style="background: #eff6ff; padding: 0.5rem; border-radius: 10px; border: 1px solid #dbeafe; text-align: center;">
                            <div style="font-size: 0.55rem; font-weight: 700; color: #2563eb; text-transform: uppercase; margin-bottom: 2px;">Corso</div>
                            <div style="font-size: 1rem; font-weight: 800; color: #1e40af;">${items.filter(i => ['in_progress', 'review'].includes(i.status)).length}</div>
                        </div>
                        <div style="background: #f8fafc; padding: 0.5rem; border-radius: 10px; border: 1px solid #f1f5f9; text-align: center;">
                            <div style="font-size: 0.55rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Fare</div>
                            <div style="font-size: 1rem; font-weight: 800; color: #334155;">${items.filter(i => (i.status === 'todo' || !i.status)).length}</div>
                        </div>
                        <div style="background: #f1f5f9; padding: 0.5rem; border-radius: 10px; border: 1px solid #e2e8f0; text-align: center;">
                            <div style="font-size: 0.55rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Pausa</div>
                            <div style="font-size: 1rem; font-weight: 800; color: #334155;">${kpis.blocked}</div>
                        </div>
                    </div>
                </div>

                <div style="width: 100%; display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: #fef2f2; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-icons-round" style="color: #ef4444; font-size: 1.1rem;">assignment_late</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                        <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Urgenze & Scadenze</span>
                        ${urgentItems.length > 0 ? `<span style="background: #fef2f2; color: #ef4444; padding: 2px 8px; border-radius: 8px; font-size: 0.7rem; font-weight: 700;">${urgentItems.length}</span>` : ''}
                    </div>
                </div>
                
                <div style="flex: 1; overflow-y: auto; padding-right: 0.5rem;" class="custom-scrollbar">
                    ${urgentItems.length === 0 ? `
                        <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary); height: 100%; display: flex; flex-direction: column; justify-content: center;">
                            <div style="width: 56px; height: 56px; border-radius: 50%; background: #f0fdf4; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                                <span class="material-icons-round" style="color: #10b981; font-size: 1.75rem;">done_all</span>
                            </div>
                            <p style="font-weight: 600; color: var(--text-primary); margin: 0;">Tutto sotto controllo!</p>
                            <p style="font-size: 0.8rem; margin: 0.25rem 0 0;">Nessun task in scadenza immediata.</p>
                        </div>
                    ` : `
                        <div class="urgenze-list">
                            ${urgentItems.map(item => renderUrgentItem(item, items)).join('')}
                        </div>
                    `}
                </div>
            </div>

            <!-- Column 2: Appointments & Comments -->
            <div class="sub-column-grid">
                <!-- Top: Appointments -->
                <div class="overview-card">
                    <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: #f5f3ff; display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: #8b5cf6; font-size: 1.15rem;">event_available</span>
                            </div>
                            <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Appuntamenti</span>
                        </div>
                        <button class="nav-to-tab-btn" data-target="appointments" title="Vai al Calendario" style="
                            padding: 4px; border-radius: 6px; border: 1px solid var(--surface-2); 
                            background: white; color: var(--text-tertiary); cursor: pointer;
                            display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'; this.style.color='var(--brand-color)';" onmouseout="this.style.background='white'; this.style.color='var(--text-tertiary)';">
                            <span class="material-icons-round" style="font-size: 1.1rem;">arrow_forward</span>
                        </button>
                    </div>
                    
                    <div style="flex: 1; overflow-y: auto;" class="custom-scrollbar">
                        ${upcomingAppts.length === 0 ? `
                            <div style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary);">
                                <p style="font-size: 0.75rem; margin: 0;">Nessun impegno in programma.</p>
                            </div>
                        ` : `
                            <div class="appointments-list">
                                ${upcomingAppts.map(appt => renderAppointmentItem(appt)).join('')}
                            </div>
                        `}
                    </div>
                </div>

                <!-- Bottom: Recent Comments -->
                <div class="overview-card">
                    <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: #ecfeff; display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: #06b6d4; font-size: 1.15rem;">chat_bubble_outline</span>
                            </div>
                            <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Commenti Recenti</span>
                        </div>
                        <button class="nav-to-tab-btn" data-target="feed" title="Vai al Feed" style="
                            padding: 4px; border-radius: 6px; border: 1px solid var(--surface-2); 
                            background: white; color: var(--text-tertiary); cursor: pointer;
                            display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'; this.style.color='var(--brand-color)';" onmouseout="this.style.background='white'; this.style.color='var(--text-tertiary)';">
                            <span class="material-icons-round" style="font-size: 1.1rem;">arrow_forward</span>
                        </button>
                    </div>

                    <div style="flex: 1; overflow-y: auto;" class="custom-scrollbar">
                        ${renderCommentsPreview(recentComments, spaceId)}
                    </div>
                </div>
            </div>

            <!-- Column 3: Docs/Resources & Feed -->
            <div class="sub-column-grid">
                <!-- Top: Docs or Resources -->
                <div class="overview-card">
                    <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div id="docs-res-icon" style="width: 32px; height: 32px; border-radius: 8px; background: var(--surface-1); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: var(--brand-color); font-size: 1.15rem;">folder</span>
                            </div>
                            <span id="docs-res-title" style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); transition: all 0.2s;">Documenti Recenti</span>
                        </div>
                        <button id="toggle-docs-res-btn" title="Passa a Risorse/Documenti" style="
                            padding: 4px; border-radius: 6px; border: 1px solid var(--surface-2); 
                            background: white; color: var(--text-tertiary); cursor: pointer;
                            display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'; this.style.color='var(--brand-color)';" onmouseout="this.style.background='white'; this.style.color='var(--text-tertiary)';">
                            <span class="material-icons-round" style="font-size: 1.1rem;">swap_horiz</span>
                        </button>
                    </div>
                    
                    <div id="docs-res-content" style="flex: 1; overflow-y: auto;" class="custom-scrollbar">
                         ${renderDocsPreview(docPages)}
                    </div>
                </div>

                <!-- Bottom: Activity Feed -->
                <div class="overview-card">
                    <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: #fff7ed; display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="color: #f59e0b; font-size: 1.15rem;">history</span>
                            </div>
                            <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Attività Recenti</span>
                        </div>
                        <button class="nav-to-tab-btn" data-target="feed" title="Vai al Feed" style="
                            padding: 4px; border-radius: 6px; border: 1px solid var(--surface-2); 
                            background: white; color: var(--text-tertiary); cursor: pointer;
                            display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                        " onmouseover="this.style.background='var(--surface-1)'; this.style.color='var(--brand-color)';" onmouseout="this.style.background='white'; this.style.color='var(--text-tertiary)';">
                            <span class="material-icons-round" style="font-size: 1.1rem;">arrow_forward</span>
                        </button>
                    </div>

                    <div style="flex: 1; overflow-y: auto;" class="custom-scrollbar">
                        ${renderFeedPreview(activityLogs)}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event handlers
    container.querySelectorAll('.urgent-item').forEach(el => {
        el.addEventListener('click', () => {
            const itemId = el.dataset.id;
            import('/js/features/pm/components/hub_drawer.js?v=1000').then(mod => {
                mod.openHubDrawer(itemId, spaceId);
            });
        });
    });

    container.querySelectorAll('.appointment-item').forEach(el => {
        el.addEventListener('click', () => {
            const apptId = el.dataset.id;
            import('/js/features/pm/components/hub_appointment_drawer.js?v=1000').then(mod => {
                mod.openAppointmentDrawer({ id: apptId }, orderId);
            });
        });
    });

    container.querySelectorAll('.comment-preview-item').forEach(el => {
        el.addEventListener('click', () => {
            const itemId = el.dataset.item;
            import('/js/features/pm/components/hub_drawer.js?v=1000').then(mod => {
                mod.openHubDrawer(itemId, spaceId);
            });
        });
    });

    // Navigation Buttons logic
    container.querySelectorAll('.nav-to-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.target;
            const mainTabBtn = document.querySelector(`.hub-tab[data-tab="${targetTab}"]`);
            if (mainTabBtn) mainTabBtn.click();
        });
    });

    // Docs/Resources Toggle logic
    let currentThirdTop = 'docs';
    const toggleBtn = container.querySelector('#toggle-docs-res-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            currentThirdTop = currentThirdTop === 'docs' ? 'res' : 'docs';
            const titleEl = container.querySelector('#docs-res-title');
            const iconEl = container.querySelector('#docs-res-icon span');
            const contentEl = container.querySelector('#docs-res-content');

            if (currentThirdTop === 'docs') {
                titleEl.innerText = 'Documenti Recenti';
                iconEl.innerText = 'folder';
                contentEl.innerHTML = renderDocsPreview(docPages);
            } else {
                titleEl.innerText = 'Risorse Cloud';
                iconEl.innerText = 'cloud_queue';
                contentEl.innerHTML = renderResourcesPreview(resources);
            }
        });
    }

    // === MOBILE: Peek & Expand logic ===
    if (window.innerWidth <= 768) {
        const PEEK_LIMITS = [3, 3, 2, 2, 2]; // items to show per section
        const scrollAreas = container.querySelectorAll('.custom-scrollbar');

        scrollAreas.forEach((area, idx) => {
            const items = area.querySelectorAll('.urgent-item, .appointment-item, .comment-preview-item, [style*="border-bottom"], .preview-item');
            const limit = PEEK_LIMITS[idx] || 2;
            const totalItems = items.length;

            if (totalItems <= limit) return; // No need to clip

            // Clip the list
            area.classList.add('peek-clipped');

            // Create toggle button
            const btn = document.createElement('button');
            btn.className = 'peek-toggle-btn';
            btn.innerHTML = `Mostra tutte (${totalItems}) <span class="material-icons-round">expand_more</span>`;
            area.parentNode.insertBefore(btn, area.nextSibling);

            btn.addEventListener('click', () => {
                const isExpanded = btn.classList.toggle('expanded');
                if (isExpanded) {
                    area.classList.remove('peek-clipped');
                    btn.innerHTML = `Mostra meno <span class="material-icons-round">expand_more</span>`;
                } else {
                    area.classList.add('peek-clipped');
                    btn.innerHTML = `Mostra tutte (${totalItems}) <span class="material-icons-round">expand_more</span>`;
                    // Scroll the section header into view
                    area.parentNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

}

function renderDocsPreview(pages) {
    if (!pages || pages.length === 0) return `<div style="padding: 2rem 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem;">Nessun documento</div>`;
    return pages.map(page => `
        <div class="preview-item" style="padding: 0.5rem 0.65rem; border-radius: 9px; background: var(--surface-1); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.65rem; cursor: pointer; border: 1px solid transparent; transition: all 0.2s;" onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-color)';" onmouseout="this.style.background='var(--surface-1)'; this.style.borderColor='transparent';">
            <span class="material-icons-round" style="font-size: 1rem; color: #64748b;">${page.type === 'whiteboard' ? 'auto_awesome_motion' : 'description'}</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${page.title}</div>
                <div style="font-size: 0.6rem; color: var(--text-tertiary); opacity: 0.8;">${new Date(page.updated_at).toLocaleDateString('it-IT')}</div>
            </div>
        </div>
    `).join('');
}

function renderResourcesPreview(links) {
    if (!links || links.length === 0) return `<div style="padding: 2rem 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem;">Nessuna risorsa cloud</div>`;
    return links.map(link => `
        <a href="${link.url}" target="_blank" class="preview-item" style="text-decoration: none; padding: 0.5rem 0.65rem; border-radius: 9px; background: var(--surface-1); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.65rem; cursor: pointer; border: 1px solid transparent; transition: all 0.2s;" onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-color)';" onmouseout="this.style.background='var(--surface-1)'; this.style.borderColor='transparent';">
            <span class="material-icons-round" style="font-size: 1rem; color: #3b82f6;">link</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${link.label}</div>
                <div style="font-size: 0.6rem; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8;">${link.url}</div>
            </div>
        </a>
    `).join('');
}

function renderFeedPreview(logs) {
    if (!logs || logs.length === 0) return `<div style="padding: 2rem 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem;">Nessuna attività recente</div>`;

    const vocabulary = {
        'todo': 'Da Fare', 'in_progress': 'In Corso', 'review': 'In Revisione', 'done': 'Completata', 'blocked': 'In Pausa',
        'attivita': 'Attività', 'task': 'Task'
    };
    const t = (val) => vocabulary[val?.toLowerCase()] || val;

    return logs.map(log => {
        const actorName = log.actor?.full_name || 'Sistema';
        const avatarUrl = log.actor?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=random&size=64`;
        const details = log.details || {};
        let description = details.description || (typeof details === 'string' ? details : '');
        const actionType = (log.action_type || '').toLowerCase();
        
        const entityName = log.item?.title || details.entity_name || 'una risorsa';
        const entityBold = `**${entityName}**`;

        // 1. Rebuild description if missing (Fallback Logic)
        if (!description || description === 'UPDATE') {
            if (actionType.includes('status')) {
                const oldVal = t(details.old);
                const newVal = t(details.new);
                description = `ha cambiato lo stato di ${entityBold} ${oldVal && newVal ? `da **${oldVal}** a **${newVal}**` : `in **${newVal}**`}`;
            } else if (actionType.includes('pm_user_ref') || actionType.includes('user_ref')) {
                const targetUser = details.new_value || details.new || 'un utente';
                description = `ha assegnato ${entityBold} a **${targetUser}**`;
            } else if (actionType.includes('created')) {
                description = `ha creato l'attività ${entityBold}`;
            } else if (actionType.includes('comment')) {
                description = `ha aggiunto un commento in ${entityBold}`;
            } else {
                description = `ha effettuato una modifica a ${entityBold}`;
            }
        }

        // 2. Natural Language: Handle self-assignments
        if (log.actor_user_ref && (details.user_ref === log.actor_user_ref || details.new === log.actor_user_ref)) {
            description = description.replace(/ha assegnato \*\*(.*?)\*\*/g, 'si è assegnato');
            const actorRegex = new RegExp(`\\*\\*${actorName}\\*\\*`, 'g');
            description = description.replace(actorRegex, 'se stesso');
        }

        // 3. Final Vocabulary translation pass (targeted bolded keys)
        Object.entries(vocabulary).forEach(([key, value]) => {
            const regex = new RegExp(`\\*\\*${key}\\*\\*`, 'gi');
            description = description.replace(regex, `**${value}**`);
        });

        // Format Markdown to HTML
        const actionTxt = description.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>');
        const date = new Date(log.created_at);
        const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="feed-item" style="padding: 0.85rem 0; border-bottom: 1px solid var(--surface-1); display: flex; gap: 0.85rem; align-items: flex-start; cursor: pointer; transition: opacity 0.2s;" onclick="window.openPmItemDetails('${log.item_ref || ''}', '${log.space_ref || ''}')" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'">
                <img src="${avatarUrl}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; box-shadow: 0 0 0 2px white, 0 0 0 3px var(--surface-1);" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=random';" />
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.45;">
                        <span style="font-weight: 700; color: var(--text-primary);">${actorName}</span> ${actionTxt}
                    </div>
                    <div style="font-size: 0.6rem; color: var(--text-tertiary); margin-top: 3px; font-weight: 500;">
                        ${timeStr} • ${date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
function renderCommentsPreview(comments, spaceId) {
    if (!comments || comments.length === 0) return `<div style="padding: 2rem 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem;">Nessun commento recente</div>`;
    return comments.map(comment => renderCommentItem(comment)).join('');
}

function renderCommentItem(comment) {
    const profile = comment.profiles || { full_name: 'Sistema', avatar_url: null };
    const date = new Date(comment.created_at);
    const dateStr = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const itemName = comment.item?.title || 'Attività';

    return `
        <div class="comment-preview-item" data-item="${comment.pm_item_ref}" style="padding: 0.85rem 0; border-bottom: 1px solid var(--surface-1); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.opacity='0.8';" onmouseout="this.style.opacity='1';">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                <img src="${profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=random`}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${profile.full_name}</span>
                        <span style="font-size: 0.6rem; color: var(--text-tertiary); flex-shrink: 0;">${dateStr} • ${timeStr}</span>
                    </div>
                    <div style="font-size: 0.65rem; font-weight: 700; color: var(--brand-color); text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 4px;">Su: ${itemName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${comment.body}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAppointmentItem(appt) {
    const start = new Date(appt.start_time);
    const day = start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const time = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="appointment-item" data-id="${appt.id}" style="
            display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--surface-1); 
            border-radius: 12px; margin-bottom: 0.6rem; cursor: pointer; transition: all 0.2s;
            border: 1px solid transparent;
        " onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-color)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='var(--surface-1)'; this.style.borderColor='transparent'; this.style.transform='none';">
            <div style="text-align: center; min-width: 40px; padding-right: 8px; border-right: 2px solid var(--surface-2);">
                <div style="font-size: 0.85rem; font-weight: 800; color: var(--brand-color); text-transform: uppercase;">${day}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 600;">${time}</div>
            </div>
            
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${appt.title}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.65rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                        <span class="material-icons-round" style="font-size: 0.8rem;">${appt.mode === 'online' ? 'videocam' : 'place'}</span>
                        ${appt.location || (appt.mode === 'online' ? 'Videochiamata' : 'In presenza')}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderUrgentItem(item, allItems = []) {
    const dueDate = item.due_date ? new Date(item.due_date) : null;
    const now = new Date();
    const isOverdue = dueDate && dueDate < now;
    const dueDateStr = dueDate ? dueDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '';

    const statusKey = item.status || 'todo';
    const statusCfg = ITEM_STATUS[statusKey] || { label: statusKey, color: '#64748b', bg: '#f1f5f9' };

    // Resolve path
    const path = [];
    let current = item;

    // Iterate up the tree
    while (current && current.parent_ref) {
        const parent = allItems.find(i => String(i.id) === String(current.parent_ref));
        if (parent) {
            path.unshift(parent.title);
            current = parent;
        } else break;
    }

    const pathStr = path.join(' › ');

    return `
        <div class="urgent-item" data-id="${item.id}" style="
            display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.75rem; background: #fafafa; 
            border-radius: 10px; margin-bottom: 0.45rem; cursor: pointer; transition: all 0.2s;
            border: 1px solid ${isOverdue ? '#fef2f2' : 'var(--surface-1)'};
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 1px 2px rgba(0,0,0,0.02)';">
            <div style="
                width: 28px; height: 28px; border-radius: 7px; 
                background: ${isOverdue ? '#fef2f2' : 'var(--surface-1)'}; 
                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
            ">
                <span class="material-icons-round" style="color: ${isOverdue ? '#ef4444' : '#64748b'}; font-size: 1rem;">
                    ${item.item_type === 'attivita' ? 'folder' : 'check_circle'}
                </span>
            </div>
            
            <div style="flex: 1; min-width: 0;">
                ${pathStr ? `<div style="font-size: 0.55rem; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 1px;">${pathStr}</div>` : ''}
                <div style="font-weight: 600; font-size: 0.8rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${item.title}</div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="
                        font-size: 0.55rem; padding: 1px 5px; border-radius: 4px; 
                        background: ${statusCfg.bg}; color: ${statusCfg.color}; 
                        font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em;
                    ">${statusCfg.label}</span>
                    <span style="font-size: 0.65rem; font-weight: 700; color: ${isOverdue ? '#ef4444' : '#f59e0b'}; display: flex; align-items: center; gap: 3px;">
                        <span class="material-icons-round" style="font-size: 0.8rem;">${isOverdue ? 'history' : 'event'}</span>
                        ${dueDateStr}
                    </span>
                </div>
            </div>
        </div>
    `;
}

