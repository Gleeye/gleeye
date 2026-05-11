import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../modules/config.js?v=8000';
import { formatAmount, renderAvatar } from '../modules/utils.js?v=8000';

import { fetchAvailabilityRules, fetchAvailabilityOverrides, fetchCollaborators, fetchAssignments, upsertAssignment, fetchGoogleCalendarBusy } from '../modules/api.js?v=8000';
import { fetchAppointment, updatePMItem, fetchSmartPersonalFeed, fetchPMActivityLogs } from '../modules/pm_api.js?v=8000';
import { humanizeActivity } from '../modules/pm_activity_helper.js?v=8000';
import { openHubDrawer } from './pm/components/hub_drawer.js?v=8000';
import { openAppointmentDrawer } from './pm/components/hub_appointment_drawer.js?v=8000';

// --- VERTICAL TIMELINE HELPERS ---

function renderVerticalTimeline(container, events, date, rules) {
    container.innerHTML = '';
    const pxPerHour = 80; // Standard for readability
    const totalHeight = 24 * pxPerHour;
    const pixelsPerMinute = pxPerHour / 60;
    const isToday = new Date().toDateString() === date.toDateString();

    const timelineContainer = document.createElement('div');
    timelineContainer.className = 'vertical-timeline-track';
    timelineContainer.style.position = 'relative';
    timelineContainer.style.height = `${totalHeight}px`;
    timelineContainer.style.background = '#ffffff';

    // 1. GRID LINES & LABELS (Y-AXIS)
    for (let h = 0; h < 24; h++) {
        // Grid Line
        const row = document.createElement('div');
        row.className = 'v-hour-row';
        row.style.position = 'absolute';
        row.style.top = `${h * pxPerHour}px`;
        row.style.left = '45px';
        row.style.right = '0';
        row.style.height = '1px';
        row.style.background = '#f1f5f9';
        
        // Hour Label
        const label = document.createElement('div');
        label.className = 'v-hour-label';
        label.innerText = `${h.toString().padStart(2, '0')}:00`;
        label.style.position = 'absolute';
        label.style.left = '8px';
        label.style.top = `${(h * pxPerHour) - 8}px`;
        label.style.fontSize = '0.7rem';
        label.style.color = '#94a3b8';
        label.style.fontWeight = '600';
        label.style.fontFamily = 'var(--font-titles)';
        
        timelineContainer.appendChild(row);
        timelineContainer.appendChild(label);
    }

    // Overlay for elements (Slots, Events)
    const overlay = document.createElement('div');
    overlay.className = 'v-timeline-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '45px';
    overlay.style.right = '0';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';

    // 2. RENDER AVAILABILITY SLOTS (Light background)
    const dayId = date.getDay();
    const dayRules = (rules || []).filter(r => r.day_of_week === dayId);
    dayRules.forEach(r => {
        if (!r.start_time || !r.end_time) return;
        const [sh, sm] = r.start_time.split(':').map(Number);
        const [eh, em] = r.end_time.split(':').map(Number);
        const sM = (sh * 60) + sm;
        const eM = (eh * 60) + em;

        const slot = document.createElement('div');
        slot.style.position = 'absolute';
        slot.style.top = `${sM * pixelsPerMinute}px`;
        slot.style.height = `${(eM - sM) * pixelsPerMinute}px`;
        slot.style.left = '0'; slot.style.right = '0';
        slot.style.background = '#fcfaff'; // Very subtle purple
        slot.style.zIndex = '0';
        overlay.appendChild(slot);
    });

    // 3. RENDER EVENTS (PACKING)
    const eventsSafe = events || [];
    const sortedEvents = eventsSafe.map(ev => ({
        ...ev,
        _start: (ev.start.getHours() * 60) + ev.start.getMinutes(),
        _end: (ev.end.getHours() * 60) + ev.end.getMinutes(),
        durationM: (ev.end - ev.start) / (1000 * 60)
    })).sort((a, b) => a._start - b._start);

    sortedEvents.forEach(ev => {
        const top = ev._start * pixelsPerMinute;
        const height = Math.max((ev._end - ev._start) * pixelsPerMinute, 30);

        const card = document.createElement('div');
        card.className = `v-agenda-card ${ev.type}`;
        card.style.position = 'absolute';
        card.style.top = `${top}px`;
        card.style.height = `${height}px`;
        card.style.left = '4px';
        card.style.right = '4px';
        card.style.pointerEvents = 'auto';
        card.style.zIndex = '10';
        
        card.innerHTML = `
            <div class="v-card-inner" style="display: flex; gap: 10px; align-items: flex-start; padding: 6px 10px;">
                <div style="flex-shrink: 0; margin-top: 1px;">
                    <div class="hp-status-toggle" 
                         onclick="event.stopPropagation(); window.quickCompleteTask('${ev.id}', this)" 
                         title="Segna come completata"
                         style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-radius: 5px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;"
                         onmouseover="this.style.background='rgba(78, 146, 216, 0.05)'; this.style.borderColor='#4e92d8';"
                         onmouseout="this.style.background='transparent'; this.style.borderColor='#e2e8f0';"
                    >
                    </div>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div class="v-card-time" style="font-size: 0.62rem; color: #64748b; font-weight: 600; margin-bottom: 1px;">${ev.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    <div class="v-card-title" style="font-size: 0.8rem; font-weight: 700; color: #1e293b; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${ev.title}</div>
                </div>
            </div>
        `;
        card.onclick = () => {
            if (ev.type === 'appointment') openAppointmentDrawer(ev.id);
        };
        overlay.appendChild(card);
    });

    // 4. NOW LINE
    if (isToday) {
        const now = new Date();
        const nowM = (now.getHours() * 60) + now.getMinutes();
        const top = nowM * pixelsPerMinute;

        const nowLine = document.createElement('div');
        nowLine.className = 'v-now-line';
        nowLine.style.position = 'absolute';
        nowLine.style.top = `${top}px`;
        nowLine.style.left = ' -45px'; // Cover labels area too
        nowLine.style.right = '0';
        nowLine.style.height = '0';
        nowLine.style.borderTop = '2px dashed #06b6d4';
        nowLine.style.zIndex = '100';

        const timePill = document.createElement('div');
        timePill.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timePill.className = 'v-now-pill';
        nowLine.appendChild(timePill);
        overlay.appendChild(nowLine);
    }

    timelineContainer.appendChild(overlay);
    container.appendChild(timelineContainer);
}

// --- MAIN RENDER LOGIC ---
// Actually fetchMyBookings stores in `eventsCache` (not exported) or `window`?
// Let's create a dedicated fetch or use the general one if accessible.
// Since `personal_agenda.js` doesn't export the cache cleanly, we'll fetch explicitly here.

async function fetchDateEvents(collaboratorId, startArg, endArg) {
    let start, end;
    if (endArg) {
        start = new Date(startArg);
        end = new Date(endArg);
    } else {
        start = new Date(startArg); start.setHours(0, 0, 0, 0);
        end = new Date(startArg); end.setHours(23, 59, 59, 999);
    }

    // ISO Strings for Queries
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // 1. Fetch Bookings
    const { data: bookings } = await supabase
        .from('bookings')
        .select(`
            *,
            booking_items (name, duration_minutes),
            booking_assignments!inner(collaborator_id)
        `)
        .eq('booking_assignments.collaborator_id', collaboratorId)
        .gte('start_time', startIso)
        .lte('start_time', endIso)
        .neq('status', 'cancelled');

    // 2. Fetch Appointments (Use correct relation table)
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            *,
            appointment_internal_participants!inner(collaborator_id),
            appointment_type_links (
                appointment_types (id, name, color)
            ),
            orders (
                order_number,
                clients (business_name, client_code)
            )
        `)
        .eq('appointment_internal_participants.collaborator_id', collaboratorId)
        .gte('start_time', startIso)
        .lte('start_time', endIso)
        .neq('status', 'cancelled')
        .neq('status', 'annullato');

    // Merge & normalize
    const events = [];
    if (bookings) {
        bookings.forEach(b => {
            // Parse times (UTC -> Local)
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);

            // Extract Client Name safely
            let clientName = 'Cliente';
            if (b.guest_info) {
                if (typeof b.guest_info === 'string') {
                    try { const g = JSON.parse(b.guest_info); clientName = g.company || (g.first_name + ' ' + g.last_name); } catch (e) { }
                } else {
                    clientName = b.guest_info.company || (b.guest_info.first_name + ' ' + b.guest_info.last_name);
                }
            }

            events.push({
                id: b.id,
                title: b.booking_items?.name || 'Prenotazione',
                start: start,
                end: end,
                type: 'booking',
                client: clientName
            });
        });
    }
    if (appointments) {
        appointments.forEach(a => {
            const start = new Date(a.start_time);
            const end = new Date(a.end_time);

            // Extract Client from Order
            const clientName = a.orders?.clients?.business_name || (a.client_name || 'Appuntamento');

            // Extract Color
            let color = null;
            if (a.appointment_type_links?.length > 0) {
                color = a.appointment_type_links[0].appointment_types?.color;
            }

            events.push({
                id: a.id,
                title: a.title || 'Appuntamento',
                start: start,
                end: end,
                type: 'appointment',
                client: clientName,
                color: color,
                // Full attributes for Modal
                orders: a.orders,
                appointment_internal_participants: a.appointment_internal_participants,
                appointment_client_participants: a.appointment_client_participants, // If available
                location: a.location,
                mode: a.mode,
                note: a.note,
                status: a.status
            });
        });
    }

    return events.sort((a, b) => a.start - b.start);
}

async function fetchRecentProjects(collabId, userUuid) {
    try {
        const userId = userUuid || state.session?.user?.id;
        let collaboratorId = collabId || state.profile?.collaborator_id;

        if (!userId) {
            console.log("[Homepage] No user session found for recent projects");
            return [];
        }

        // --- ID RESOLUTION FIX ---
        // If we have a userId but no collaboratorId (common for admin profiles), resolve it
        if (userId && !collaboratorId) {
            const { data: c } = await supabase
                .from('collaborators')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();
            if (c) {
                collaboratorId = c.id;
                console.log("[Homepage] Resolved collaboratorId for current user:", collaboratorId);
            }
        }

        // SECURITY FIX: If we are impersonating or viewing as a specific collab, ensure we ONLY match that ID.
        // We do NOT want to fallback to defaults or show admin data.

        // 1. Identify which orders this user technically "owns" for LINK routing only
        const { data: myManagedSpaces } = await supabase
            .from('pm_spaces')
            .select('ref_ordine')
            .eq('default_pm_user_ref', userId)
            .eq('type', 'commessa');

        const managedOrderIds = new Set((myManagedSpaces || []).map(s => s.ref_ordine).filter(Boolean));

        // ROLE CHECK
        const userTags = state.profile?.tags || [];
        const isPrivileged = userTags.includes('Partner') || userTags.includes('Amministrazione') || userTags.includes('Account') || userTags.some(t => t.toLowerCase() === 'project manager' || t.toLowerCase() === 'pm');

        // Always fetch Tasks (assignments) first for the sidebar
        const { data: myAssignments } = await supabase
            .from('pm_items')
            .select(`
                id, title, status, created_at,
                pm_spaces (
                    orders (id, order_number, title, clients(business_name, client_code))
                ),
                pm_item_assignees!inner(user_ref)
            `)
            .eq('pm_item_assignees.user_ref', userId)
            .order('created_at', { ascending: false })
            .limit(100);

        let finalTasksResults = [];
        if (myAssignments) {
            finalTasksResults = myAssignments.map(t => {
                let ord = null;
                if (t.pm_spaces) {
                    const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                    if (space && space.orders) {
                        ord = Array.isArray(space.orders) ? space.orders[0] : space.orders;
                    }
                }
                return {
                    id: t.id,
                    type: 'task',
                    title: t.title,
                    order_number: ord?.order_number || '',
                    client: ord?.clients?.client_code || ord?.clients?.business_name || 'Incarico',
                    status: t.status,
                    last_active: t.created_at,
                    link: '' // Handled by onclick
                };
            });
        }

        const isOrderActive = (status_works, offer_status) => {
            const sw = (status_works || '').toLowerCase().trim();
            const os = (offer_status || '').toLowerCase().trim();
            // User requested ONLY Accepted Offers AND (Ongoing OR Paused OR Maintenance)
            if (os !== 'accettata') return false;
            return sw === 'in_svolgimento' || sw === 'in_pausa' || sw === 'manutenzione' || sw === 'da_iniziare';
        };

        const projectsMap = new Map();

        // --- STEP 1: Fetch Assigned Orders (order_collaborators) ---
        if (collaboratorId) {
            const { data: assigned } = await supabase
                .from('order_collaborators')
                .select(`
                    role_in_order,
                    orders (id, title, order_number, status_works, offer_status, clients(business_name, client_code), created_at)
                `)
                .eq('collaborator_id', collaboratorId);

            if (assigned) {
                assigned.forEach(item => {
                    const o = item.orders;
                    if (!o) return;

                    // FILTER: Logica Opt-In (Stretta) for PM check
                    const role = (item.role_in_order || '').toLowerCase().trim();
                    const rolesThatArePMMatch = role.includes('pm') || role.includes('project') || role.includes('manager') || role.includes('responsabile') || role.includes('socio') || role.includes('coordinatore') || role.includes('lead');
                    const rolesThatAreAccountMatch = role.includes('account') || role.includes('partner');

                    const existing = projectsMap.get(o.id);
                    if (existing) {
                        if (rolesThatArePMMatch) existing.isPM = true;
                        if (rolesThatAreAccountMatch) existing.isAccount = true;
                    } else if (isOrderActive(o.status_works, o.offer_status)) {
                        projectsMap.set(o.id, {
                            id: o.id,
                            order_number: o.order_number,
                            title: o.title || 'Senza Titolo',
                            client: o.clients?.client_code || o.clients?.business_name || 'No Cliente',
                            status: o.status_works,
                            offer_status: o.offer_status,
                            last_active: o.created_at,
                            link: `#pm/commessa/${o.id}`,
                            isPM: rolesThatArePMMatch,
                            isAccount: rolesThatAreAccountMatch
                        });
                    }
                });
            }
        }


        // --- STEP 3: Fetch Orders where user is PM in related Space or Default PM ---
        if (collaboratorId || userId) {
            const { data: spaceManaged } = await supabase
                .from('pm_space_assignees')
                .select(`
                    role,
                    pm_spaces!inner (
                        ref_ordine,
                        orders!inner (id, title, order_number, status_works, offer_status, clients(business_name, client_code), created_at)
                    )
                `)
                .eq('role', 'pm')
                .or(`user_ref.eq.${userId},collaborator_ref.eq.${collaboratorId}`);

            if (spaceManaged) {
                spaceManaged.forEach(sa => {
                    const o = sa.pm_spaces?.orders;
                    if (!o) return;

                    const existing = projectsMap.get(o.id);
                    if (existing) {
                        existing.isPM = true;
                    } else if (isOrderActive(o.status_works, o.offer_status)) {
                        projectsMap.set(o.id, {
                            id: o.id,
                            order_number: o.order_number,
                            title: o.title || 'Senza Titolo',
                            client: o.clients?.client_code || o.clients?.business_name || 'No Cliente',
                            status: o.status_works,
                            offer_status: o.offer_status,
                            last_active: o.created_at,
                            link: `#pm/commessa/${o.id}`,
                            isPM: true,
                            isAccount: false
                        });
                    }
                });
            }
        }

        // --- STEP 3.5: Fetch Orders where user is Account Manager (orders.account_id) ---
        if (collaboratorId) {
            const { data: accountOrders } = await supabase
                .from('orders')
                .select('id, title, order_number, status_works, offer_status, clients(business_name, client_code), created_at')
                .eq('account_id', collaboratorId)
                .neq('offer_status', 'rifiutata')
                .neq('status_works', 'completato');

            if (accountOrders) {
                accountOrders.forEach(o => {
                    const existing = projectsMap.get(o.id);
                    if (existing) {
                        existing.isAccount = true;
                    } else if (isOrderActive(o.status_works, o.offer_status)) {
                        projectsMap.set(o.id, {
                            id: o.id,
                            order_number: o.order_number,
                            title: o.title || 'Senza Titolo',
                            client: o.clients?.client_code || o.clients?.business_name || 'No Cliente',
                            status: o.status_works,
                            offer_status: o.offer_status,
                            last_active: o.created_at,
                            link: `#pm/commessa/${o.id}`,
                            isPM: false,
                            isAccount: true
                        });
                    }
                });
            }
        }

        // --- STEP 4: Update Last Active from Personal Activity (activity_logs) ---
        // ... (sorting stuff) ...
        // Combined results will be handled after enrichment
        if (collaboratorId || userId) {
            const { data: recentLogs } = await supabase
                .from('pm_activity_logs')
                .select(`
                    created_at,
                    order:order_ref (id)
                `)
                .or(`actor_user_ref.eq.${userId},actor_user_ref.eq.${collaboratorId}`) // Broad actor match
                .order('created_at', { ascending: false })
                .limit(50);

            if (recentLogs) {
                recentLogs.forEach(log => {
                    const oId = log.order?.id;
                    if (!oId) return;

                    if (projectsMap.has(oId)) {
                        const existing = projectsMap.get(oId);
                        if (new Date(log.created_at) > new Date(existing.last_active)) {
                            existing.last_active = log.created_at;
                        }
                    }
                });
            }
        }

        // Final sort and merge with tasks
        const sortedProjects = Array.from(projectsMap.values())
            .sort((a, b) => new Date(b.last_active) - new Date(a.last_active))
            .slice(0, 100);
        
        let finalResults = [...finalTasksResults, ...sortedProjects];

        // ENRICH WITH STATS
        if (sortedProjects.length > 0) {
            const orderIds = sortedProjects.map(r => r.id);

            // 1. Get Spaces for these Orders
            const { data: spaces } = await supabase
                .from('pm_spaces')
                .select('id, ref_ordine')
                .in('ref_ordine', orderIds);

            if (spaces && spaces.length > 0) {
                const spaceIds = spaces.map(s => s.id);
                const orderToSpaces = {};
                spaces.forEach(s => {
                    if (!orderToSpaces[s.ref_ordine]) orderToSpaces[s.ref_ordine] = [];
                    orderToSpaces[s.ref_ordine].push(s.id);
                });

                // 2. Get Items for these Spaces
                const { data: items } = await supabase
                    .from('pm_items')
                    .select('id, space_ref, status, item_type, due_date')
                    .in('space_ref', spaceIds)
                    .neq('status', 'done');

                if (items) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const imminentLimit = new Date();
                    imminentLimit.setDate(today.getDate() + 3);

                    const spaceStats = {};
                    items.forEach(it => {
                        if (!spaceStats[it.space_ref]) spaceStats[it.space_ref] = { tasks: 0, activities: 0, overdue: 0, imminent: 0, in_progress: 0 };
                        const s = spaceStats[it.space_ref];

                        if (it.item_type === 'attivita' || it.item_type === 'activity') {
                            s.activities++;
                            if (it.status === 'in_progress') s.in_progress++;
                        } else {
                            s.tasks++;
                        }

                        if (it.due_date) {
                            const d = new Date(it.due_date);
                            if (d < today) s.overdue++;
                            else if (d <= imminentLimit) s.imminent++;
                        }
                    });

                    // 3. Get Appointments for the current user in these Orders
                    const { data: userAppts } = await supabase
                        .from('appointments')
                        .select('id, order_id, appointment_internal_participants!inner(collaborator_id)')
                        .eq('appointment_internal_participants.collaborator_id', collaboratorId)
                        .in('order_id', orderIds)
                        .gte('start_time', today.toISOString());

                    const orderApptsCount = {};
                    if (userAppts) {
                        userAppts.forEach(a => {
                            if (!orderApptsCount[a.order_id]) orderApptsCount[a.order_id] = 0;
                            orderApptsCount[a.order_id]++;
                        });
                    }

                    sortedProjects.forEach(r => {
                        const relatedSpaces = orderToSpaces[r.id] || [];
                        const stats = { tasks: 0, activities: 0, overdue: 0, imminent: 0, in_progress: 0, appointments: orderApptsCount[r.id] || 0 };
                        relatedSpaces.forEach(sid => {
                            if (spaceStats[sid]) {
                                stats.tasks += spaceStats[sid].tasks;
                                stats.activities += spaceStats[sid].activities;
                                stats.overdue += spaceStats[sid].overdue;
                                stats.imminent += spaceStats[sid].imminent;
                                stats.in_progress += spaceStats[sid].in_progress;
                            }
                        });
                        r.stats = stats;
                    });
                }
            }
        }

        console.log("Activity items enriched with stats:", finalResults.length);
        return finalResults;
    } catch (error) {
        console.error("Error fetching recent projects:", error);
        return [];
    }
}

/**
 * Fetches OPERATIONAL alerts for Amministrazione users.
 *
 * Schema verified from codebase:
 * - invoices: status = 'Bozza' | 'Inviata' | 'Saldata'. payment_date = null se non saldata.
 *   => Non usare due_date (spesso null). Usa status != 'Saldata' AND payment_date IS NULL.
 *
 * - passive_invoices: status = 'Da Pagare' | 'Pagata'. payment_date = null se non pagata.
 *   => Da pagare = status = 'Da Pagare'
 *
 * - payments: payment_type = 'Collaboratore'|'Cliente'|'Fornitore'.
 *   status = 'Da Fare'|'To Do'|'Invito Inviato'|'In Attesa'|'Completato'|'Done'
 *   => Pagato = 'Completato' OR 'Done'. Invito inviato = in attesa di fattura dal collab.
 *
 * Routes verificate da router.js:
 *   Fatture attive → #invoices
 *   Fatture passive collab → #passive-invoices-collab
 *   Fatture passive fornitori → #passive-invoices-suppliers
 *   Pagamenti → #payments
 */
async function fetchAdminOperationalAlerts() {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const alerts = [];

        const isInvoicePaid = (i) => {
            if (!i) return true;
            const s = (i.status || '').toLowerCase();
            return s.includes('saldat') || s.includes('pagat') || !!i.payment_date;
        };

        // --- ENTRATE (SOLDI IN ENTRATA) ---

        // 1. FATTURE ATTIVE DA INCASSARE
        const { data: invData } = await supabase.from('invoices')
            .select('id, status, payment_date')
            .eq('status', 'Inviata');

        if (invData && invData.length > 0) {
            alerts.push({
                id: 'active_invoices',
                priority: 'urgent',
                count: invData.length,
                label: `Fatture attive da incassare`,
                link: '#invoices',
                color: '#ef4444'
            });
        }

        // 2. PAGAMENTI ATTIVI IN RITARDO
        const { data: actPay } = await supabase.from('payments')
            .select('id, status, payment_type, due_date')
            .eq('payment_type', 'Cliente')
            .is('invoice_id', null)
            .neq('status', 'Completato')
            .neq('status', 'Done')
            .lt('due_date', todayStr);

        if (actPay && actPay.length > 0) {
            alerts.push({
                id: 'active_payments',
                priority: 'high',
                count: actPay.length,
                label: `Pagamenti attivi in ritardo`,
                link: '#payments',
                color: '#f59e0b'
            });
        }

        // --- USCITE (SOLDI IN USCITA) ---

        // 3. PAGAMENTI COLLABORATORI SCADUTI (5)
        const { data: collPay } = await supabase.from('payments')
            .select('id, status, payment_type, due_date')
            .eq('payment_type', 'Collaboratore')
            .is('passive_invoice_id', null)
            .neq('status', 'Completato')
            .neq('status', 'Done')
            .lt('due_date', todayStr);

        if (collPay && collPay.length > 0) {
            alerts.push({
                id: 'collab_overdue_payments',
                priority: 'medium',
                count: collPay.length > 5 ? 5 : collPay.length,
                label: `Pagamenti collaboratori scaduti`,
                link: '#payments',
                color: '#8b5cf6'
            });
        }

        // 4. FATTURE PASSIVE DA PAGARE
        const { data: passData } = await supabase.from('passive_invoices')
            .select('id, status, payment_date');

        if (passData) {
            const unpaid = passData.filter(p => !isInvoicePaid(p));
            if (unpaid.length > 0) {
                alerts.push({
                    id: 'passive_overdue_invoices',
                    priority: 'low',
                    count: unpaid.length,
                    label: `Fatture passive da pagare`,
                    link: '#passive-invoices-collab',
                    color: '#64748b'
                });
            }
        }

        return alerts;
    } catch (err) {
        console.error("FetchAdminAlerts Error:", err);
        return [];
    }
}

export async function fetchInternalProjects(collaboratorId, userId, isAdmin = false) {
    try {
        const projectsMap = new Map();

        const { data: rawData, error } = await supabase
            .from('pm_spaces')
            .select(`
                *,
                cluster:parent_ref ( name ),
                pm_space_assignees (*)
            `)
            .eq('type', 'interno')
            .eq('is_cluster', false);

        if (error) throw error;

        // Filter: Staff/Partners see only their involved spaces. 
        const assigned = (rawData || []).filter(s => {
            const assignees = s.pm_space_assignees || [];
            const isAssigned = assignees.some(a => 
                (a.user_ref && String(a.user_ref) === String(userId)) || 
                (a.collaborator_ref && String(a.collaborator_ref) === String(collaboratorId))
            );
            const isPM = s.default_pm_user_ref && String(s.default_pm_user_ref) === String(userId);
            return isAssigned || isPM;
        });

        if (assigned) {
            assigned.forEach(s => {
                const path = s.cluster?.name ? `${s.cluster.name} > ${s.name}` : s.name;
                projectsMap.set(s.id, {
                    id: s.id,
                    order_number: '',
                    title: s.name,
                    client: path,
                    status: 'active',
                    last_active: s.created_at,
                    link: `#pm/space/${s.id}`
                });
            });
        }

        let results = Array.from(projectsMap.values())
            .sort((a, b) => new Date(b.last_active) - new Date(a.last_active));

        // ENRICH WITH STATS
        if (results.length > 0) {
            const spaceIds = results.map(r => r.id);
            const { data: items } = await supabase
                .from('pm_items')
                .select('id, space_ref, status, item_type, due_date')
                .in('space_ref', spaceIds)
                .neq('status', 'done');

            if (items) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const imminentLimit = new Date();
                imminentLimit.setDate(today.getDate() + 3);

                const spaceStats = {};
                items.forEach(it => {
                    if (!spaceStats[it.space_ref]) spaceStats[it.space_ref] = { tasks: 0, activities: 0, overdue: 0, imminent: 0, in_progress: 0 };
                    const s = spaceStats[it.space_ref];

                    if (it.item_type === 'attivita' || it.item_type === 'activity') {
                        s.activities++;
                        if (it.status === 'in_progress') s.in_progress++;
                    } else {
                        s.tasks++;
                    }

                    if (it.due_date) {
                        const d = new Date(it.due_date);
                        if (d < today) s.overdue++;
                        else if (d <= imminentLimit) s.imminent++;
                    }
                });

                // Get User Appointments
                const { data: userAppts } = await supabase
                    .from('appointments')
                    .select('id, pm_space_id, appointment_internal_participants!inner(collaborator_id)')
                    .eq('appointment_internal_participants.collaborator_id', collaboratorId)
                    .in('pm_space_id', spaceIds)
                    .gte('start_time', today.toISOString());

                const spaceApptsCount = {};
                if (userAppts) {
                    userAppts.forEach(a => {
                        if (!spaceApptsCount[a.pm_space_id]) spaceApptsCount[a.pm_space_id] = 0;
                        spaceApptsCount[a.pm_space_id]++;
                    });
                }

                results.forEach(r => {
                    const s = spaceStats[r.id] || { tasks: 0, activities: 0, overdue: 0, imminent: 0, in_progress: 0 };
                    r.stats = { ...s, appointments: spaceApptsCount[r.id] || 0 };
                });
            }
        }

        return results;
    } catch (e) {
        console.error("Error fetching internal projects:", e);
        return [];
    }
}

const getFirstName = (collab, profile) => {
    let name = collab?.first_name || collab?.full_name || profile?.first_name || profile?.full_name;
    
    if (!name || name === 'null' || name === 'undefined') {
        const email = collab?.email || profile?.email || state.session?.user?.email;
        if (email) name = email.split('@')[0];
        else return 'Utente';
    }

    // Clean up technical strings (email prefixes, dots, underscores, exclamation marks)
    const clean = name.split('@')[0].replace(/[._!]/g, ' ').trim();
    const firstWord = clean.split(' ').filter(Boolean)[0] || 'Utente';
    
    // Capitalize properly
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
};

/**
 * Renders the operational Admin alert list on the homepage.
 * Shows actionable items requiring attention, not financial KPIs.
 */
function renderAdminAlerts(alerts) {
    const block = document.getElementById('hp-accounting-alerts-block');
    const grid = document.getElementById('hp-admin-alert-list');
    if (!block || !grid) return;

    // Safety check: skip if user is ONLY account/pm (without higher tier roles)
    const tags = window.normalizedTagsForHtml || [];
    const isTrueAdmin = tags.includes('partner') || tags.includes('amministrazione') || tags.includes('socio') || state.profile?.role === 'admin';
    const isAccountOrPM = tags.includes('account') || tags.includes('project manager') || tags.includes('pm');
    
    if (isAccountOrPM && !isTrueAdmin) {
        block.style.display = 'none';
        return;
    }

    if (alerts.length === 0) {
        grid.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; color: #166534; opacity: 0.7;">
                <span class="material-icons-round" style="font-size: 16px;">check_circle</span>
                <span style="font-size: 0.8rem; font-weight: 500;">Tutto in ordine</span>
            </div>
        `;
    } else {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const sorted = [...alerts].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        grid.innerHTML = sorted.map(alert => `
            <div class="hp-alert-item" onclick="window.location.hash='${alert.link}'" style="
                display: flex; align-items: center; gap: 12px;
                padding: 10px 0; cursor: pointer;
                border-bottom: 1px solid rgba(0, 0, 0, 0.03);
                transition: all 0.2s;">
                <span style="font-size: 1.05rem; font-weight: 800; color: #1e293b; min-width: 24px; line-height: 1; text-align: center;">${alert.count}</span>
                <span style="font-size: 0.75rem; font-weight: 500; color: #475569; flex: 1; line-height: 1.2;">${alert.label}</span>
                <span class="material-icons-round" style="color: #94a3b8; font-size: 16px;">chevron_right</span>
            </div>
        `).join('');
    }

    if (alerts.length > 0) {
        block.style.background = 'linear-gradient(135deg, rgba(255, 241, 242, 0.8), rgba(255, 255, 255, 0.9))';
        block.style.border = '1px solid rgba(251, 113, 133, 0.15)';
        block.style.boxShadow = '0 10px 25px -5px rgba(251, 113, 133, 0.08), 0 8px 10px -6px rgba(251, 113, 133, 0.04)';
    } else {
        block.style.background = 'white';
        block.style.border = '1px solid #f1f5f9';
        block.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
    }

    block.style.display = 'flex';
}

// --- ROLE DETECTION HELPER ---
// --- COLLABORATOR SPECIFIC FETCHERS ---
async function fetchCollaboratorAssignments(collaboratorId) {
    if (!collaboratorId) return [];

    try {
        const { data, error } = await supabase
            .from('assignments')
            .select(`
                id, legacy_id, description, status, total_amount, start_date,
                orders (id, title, order_number, clients(business_name, client_code))
            `)
            .eq('collaborator_id', collaboratorId)
            .neq('status', 'Completato')
            .neq('status', 'Annullato')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(a => ({
            id: a.id,
            legacy_id: a.legacy_id,
            title: a.orders?.title || 'Incarico Senza Titolo',
            order_number: a.orders?.order_number || '',
            client: a.orders?.clients?.client_code || a.orders?.clients?.business_name || 'No Cliente',
            status: a.status,
            amount: a.total_amount,
            start_date: a.start_date,
            link: `#assignment-detail/${a.id}`
        }));
    } catch (err) {
        console.error("Error fetching collaborator assignments:", err);
        return [];
    }
}

async function fetchCollaboratorPayments(collaboratorId) {
    if (!collaboratorId) return { nextPayments: [], nextInvoices: [] };

    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Fetch Next Payments — escludi completati, ordina per scadenza
        const { data: payments, error: pError } = await supabase
            .from('payments')
            .select('id, title, amount, due_date, status, assignment_id, orders(order_number, title, clients(client_code, business_name))')
            .eq('collaborator_id', collaboratorId)
            .neq('status', 'Completato')
            .neq('status', 'Done')
            .order('due_date', { ascending: true })
            .limit(10);

        // 2. Fetch Invoices — tutte, ordinate per data emissione decrescente (riepilogo recenti)
        const { data: invoices, error: iError } = await supabase
            .from('passive_invoices')
            .select('id, invoice_number, amount_tax_included, status, issue_date, due_date, collaborator_name')
            .eq('collaborator_id', collaboratorId)
            .order('issue_date', { ascending: false })
            .limit(10);

        return {
            nextPayments: payments || [],
            nextInvoices: invoices || []
        };
    } catch (err) {
        console.error("Error fetching collaborator payments:", err);
        return { nextPayments: [], nextInvoices: [] };
    }
}

function renderCollaboratorPayments(data) {
    const payContainer = document.getElementById('hp-collab-payments-list');
    const invContainer = document.getElementById('hp-collab-invoices-list');
    if (!payContainer || !invContainer) return;

    const { nextPayments, nextInvoices } = data;

    // --- PAYMENTS BOX ---
    if (nextPayments.length === 0) {
        payContainer.innerHTML = `<div style="padding: 1rem 0; text-align: center; color: #94a3b8; font-size: 0.78rem;">Nessun pagamento in sospeso.</div>`;
    } else {
        payContainer.innerHTML = nextPayments.map(p => {
            const date = p.due_date ? new Date(p.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : 'N.D.';
            const isOverdue = p.due_date && new Date(p.due_date) < new Date();
            const statusLabel = p.status || 'In attesa';
            const statusColor = isOverdue ? '#ef4444' : '#f59e0b';
            const statusBg = isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
            const clientName = p.orders?.clients?.client_code || p.orders?.clients?.business_name || '';
            const orderInfo = p.orders
                ? `${p.orders.order_number || ''}${clientName ? ' · ' + clientName : ''}`
                : (p.assignment_id || '');
            return `
                <div style="padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 0.82rem; font-weight: 600; color: #1e293b; line-height: 1.35;">${p.title || 'Pagamento'}</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #1e293b; flex-shrink: 0; letter-spacing: -0.01em;">${formatAmount(p.amount)} €</span>
                    </div>
                    ${orderInfo ? `<div style="margin-top: 3px; font-size: 0.68rem; color: #64748b; font-weight: 500;">${orderInfo}</div>` : ''}
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px;">
                        <span style="font-size: 0.65rem; color: #94a3b8;">Scad. ${date}</span>
                        <span style="font-size: 0.62rem; font-weight: 700; color: ${statusColor}; background: ${statusBg}; padding: 1px 6px; border-radius: 4px;">${statusLabel}</span>
                    </div>
                </div>`;
        }).join('');
    }

    // --- INVOICES BOX ---
    if (nextInvoices.length === 0) {
        invContainer.innerHTML = `<div style="padding: 1rem 0; text-align: center; color: #94a3b8; font-size: 0.78rem;">Nessuna fattura presente.</div>`;
    } else {
        invContainer.innerHTML = nextInvoices.map(i => {
            const isPaid = i.status === 'Pagata' || i.status === 'Pagato';
            const isPending = i.status === 'Da Pagare';
            const statusColor = isPaid ? '#10b981' : isPending ? '#f59e0b' : '#64748b';
            const statusBg = isPaid ? 'rgba(16,185,129,0.08)' : isPending ? 'rgba(245,158,11,0.08)' : 'rgba(100,116,139,0.08)';
            const issueDate = i.issue_date ? new Date(i.issue_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' }) : 'N.D.';
            return `
                <div style="padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 0.82rem; font-weight: 600; color: #1e293b; line-height: 1.35;">Fattura n.${i.invoice_number || 'N.D.'}</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #1e293b; flex-shrink: 0; letter-spacing: -0.01em;">${formatAmount(i.amount_tax_included)} €</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px;">
                        <span style="font-size: 0.65rem; color: #94a3b8;">${issueDate}</span>
                        <span style="font-size: 0.62rem; font-weight: 700; color: ${statusColor}; background: ${statusBg}; padding: 1px 6px; border-radius: 4px;">${i.status || 'Emessa'}</span>
                    </div>
                </div>`;
        }).join('');
    }
}

function detectUserRole(normalizedTags) {
    if (normalizedTags.includes('partner')) return 'partner';
    if (normalizedTags.includes('amministrazione')) return 'amministrazione';
    if (normalizedTags.includes('account')) return 'account';
    if (normalizedTags.includes('project manager') || normalizedTags.includes('pm')) return 'pm';
    return 'collaboratore';
}

export async function renderHomepageAlt(container) {
    console.log("Rendering Homepage...");
    
    // Inject alt CSS if not present
    if (!document.getElementById('homepage-alt-style')) {
        const link = document.createElement('link');
        link.id = 'homepage-alt-style';
        link.rel = 'stylesheet';
        link.href = 'css/components/homepage-alt.css?v=8000';
        document.head.appendChild(link);
    }

    const user = state.session?.user;
    if (!user) return;

    // Determine which collaborator to show (support impersonation)
    let myCollab;
    
    // 1. If impersonating, we MUST find that person
    if (state.impersonatedCollaboratorId) {
        myCollab = state.collaborators.find(c => c.id == state.impersonatedCollaboratorId);
        
        // If not found in list yet (race condition), try to guess from sidebar or synthesise
        if (!myCollab) {
            console.log("[Homepage] Impersonated collaborator not in state.collaborators yet. Checking sidebar...");
            const sidebarName = document.querySelector('.sidebar-profile h3')?.textContent;
            if (sidebarName && sidebarName !== (state.profile?.full_name || 'Utente')) {
                myCollab = { full_name: sidebarName, first_name: sidebarName.split(' ')[0] };
            }
        }
    }

    // 2. Normal lookup for self
    if (!myCollab) {
        myCollab = state.collaborators.find(c => c.email === user.email);
    }
    
    // 3. Fallback: search by user_id
    if (!myCollab && state.profile) {
        myCollab = state.collaborators.find(c => c.user_id === state.profile.id);
    }

    // 4. Final Fallback: use profile data
    if (!myCollab) {
        myCollab = {
            id: state.profile?.collaborator_id || null,   // ← numeric collaborator ID
            user_id: state.profile?.id || user.id,        // ← UUID auth (corretto per query UUID)
            first_name: state.profile?.first_name || user.user_metadata?.first_name || '',
            last_name: state.profile?.last_name || user.user_metadata?.last_name || '',
            full_name: state.profile?.full_name || 'Utente',
            email: user.email,
            tags: state.profile?.tags || []               // ← aggiungi anche i tags per il role detection
        };
    }

    const firstName = getFirstName(myCollab, state.profile);
    const myId = myCollab.id || state.profile?.collaborator_id || state.profile?.id;

    // --- ROLE DETECTION (Fixed for Impersonation) ---
    let userTagsRaw = [];
    if (myCollab?.tags && (Array.isArray(myCollab.tags) ? myCollab.tags.length > 0 : myCollab.tags)) {
        if (typeof myCollab.tags === 'string') {
            try { userTagsRaw = JSON.parse(myCollab.tags); } catch (e) { userTagsRaw = myCollab.tags.split(',').map(t => t.trim()); }
        } else { userTagsRaw = myCollab.tags || []; }
    } else {
        userTagsRaw = state.profile?.tags || [];
    }

    const normalizedTagsForHtml = Array.isArray(userTagsRaw) ? userTagsRaw.map(t => (t || '').toLowerCase()) : [];
    window.normalizedTagsForHtml = normalizedTagsForHtml; // needed by renderAdminAlerts
    let htmlRole = detectUserRole(normalizedTagsForHtml);
    
    // FORCE PARTNER VIEW FOR ADMINS/SOCI — skip when impersonating
    const isImpersonating = !!state.impersonatedCollaboratorId;
    if (!isImpersonating && (state.profile?.role === 'admin' || normalizedTagsForHtml.includes('socio') || normalizedTagsForHtml.includes('partner'))) {
        htmlRole = 'partner';
    }
    
    // Collaboratore, PM e Account usano il layout con payments box
    // Partner non ce l'ha (i soci non hanno incarichi personali)
    const isCollaborator = htmlRole === 'collaboratore' || htmlRole === 'pm' || htmlRole === 'account';
    const isAccountUser = normalizedTagsForHtml.includes('account');
    const isPmUser = normalizedTagsForHtml.includes('project manager') || normalizedTagsForHtml.includes('pm');
    const showAccountPmToggle = isAccountUser && isPmUser;

    // --- MANAGE TOP BAR GREETING ---
    const pageTitle = document.getElementById('page-title');
    const hours = new Date().getHours();
    let greeting = 'Buongiorno';
    if (hours >= 14 && hours < 19) greeting = 'Buon pomeriggio';
    else if (hours >= 19 || hours < 5) greeting = 'Buonasera';

    window.greetingText = greeting; // Store for inner content

    if (pageTitle) {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            pageTitle.textContent = "Gleeye";
        } else {
            pageTitle.textContent = `${greeting}, ${firstName}!`;
        }
        pageTitle.classList.add('solid-title');
    }

    // --- FETCH DATA FOR "MY ACTIVITIES" ---
    let myTasks = [], activeTimers = [], events = [];
    // Default filter state (User requested: Task, Appuntamenti, Attività)
    if (!window.hpActivityFilter) window.hpActivityFilter = 'task';

    // 1. Initial UI Flush (Skeleton) - This prevents the White Screen
    container.innerHTML = `
        <style>
            /* FORCE FLEX ON GLOBAL ERP AREA */
            #content-area { 
                display: flex !important; 
                flex-direction: row !important; 
                height: calc(100vh - 70px) !important; 
                width: 100% !important;
                overflow: hidden !important; 
                position: relative !important;
                max-width: 100vw !important;
                margin: 0 !important;
                padding: 0 !important;
                background: linear-gradient(135deg, #fdfdfd 0%, #f1f5f9 100%) !important;
            }

            .hp-alt-wrapper { display: flex; width: 100%; height: 100%; background: transparent; font-family: 'Outfit'; position: relative; overflow: hidden; flex: 1; }
            .hp-alt-sidebar-left { width: 320px; flex-shrink: 0; height: 100%; background: white; border-right: 1px solid #eef2f6; display: flex; flex-direction: column; position: relative; box-shadow: 10px 0 30px rgba(0,0,0,0.01); z-index: 10; overflow: hidden; }
            .hp-main-content-area { flex: 1; display: flex; flex-direction: column; gap: 2rem; padding: 1.5rem 2rem; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; position: relative; width: 100%; box-sizing: border-box; background: transparent; }
            .hp-main-columns-container { display: flex; flex-direction: row; gap: 2rem; width: 100%; align-items: stretch; min-height: 0; }
            
            .hp-mobile-banner { display: none; }
            .hp-mobile-agenda-pop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 20000; align-items: center; justify-content: center; padding: 15px; }
            
            @media (max-width: 1150px) {
                /* FORCE GLOBAL UNLOCK FOR MOBILE SCROLL */
                body, #app, .main-content { height: auto !important; overflow: visible !important; min-height: 100vh !important; }
                #content-area { height: auto !important; overflow: visible !important; padding: 0 !important; }

                .hp-alt-wrapper { height: auto !important; overflow: visible !important; min-height: 100vh !important; display: block !important; }
                .hp-alt-sidebar-left { display: none !important; }
                .hp-main-content-area { padding: 0.5rem 1.25rem 2rem 1.25rem !important; overflow: visible !important; width: 100% !important; height: auto !important; box-sizing: border-box; }
                .hp-main-columns-container { flex-direction: column; gap: 1.5rem; width: 100%; border-radius: 0; }
                
                .hp-mobile-banner { 
                    display: flex; 
                    position: sticky;
                    top: env(safe-area-inset-top, 0px); 
                    padding-top: 12px;
                    z-index: 1000;
                    margin-bottom: 1rem;
                    background: rgba(255, 255, 255, 0.9); 
                    backdrop-filter: blur(25px) saturate(180%); 
                    -webkit-backdrop-filter: blur(25px) saturate(180%); 
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    padding: 10px 18px;
                    border-radius: 20px;
                    z-index: 1000;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    justify-content: space-between;
                    align-items: center;
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    cursor: pointer;
                }
                .hp-mobile-banner:active { transform: scale(0.97); }
                
                .hp-widget-panel { border-radius: 26px !important; width: 100% !important; box-sizing: border-box; background: white !important; border: 1px solid #f1f5f9 !important; box-shadow: 0 4px 15px rgba(0,0,0,0.03) !important; }
                #hp-internal-dashboard-block { min-width: 100% !important; padding: 0 !important; width: 100% !important; }
                #hp-internal-clusters-grid { grid-template-columns: repeat(3, 1fr) !important; width: 100% !important; gap: 8px !important; padding-top: 10px !important; }
                #hp-pm-spaces-main-block { min-width: 100% !important; width: 100% !important; }
            }
        </style>

            <!-- 1. LEFT SIDEBAR (Stacked: Tasks -> Agenda) - HIDDEN ON MOBILE -->
            <div class="hp-alt-sidebar-left">
                
                <!-- HEADER (Premium Style - Minimalist) -->
                <div style="padding: 1.75rem 1.75rem 1.25rem 1.75rem; border-bottom: 1px solid #f1f5f9; flex: 0 0 auto;">
                     <!-- Hidden Benvenuto, Visible Data -->
                     <h1 id="page-title" style="display: none;"></h1>
                     <h2 id="hp-date-description" style="font-size: 0.85rem; font-weight: 500; color: #64748b; margin: 0; margin-bottom: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></h2>

                     <div class="hp-nav-controls" style="display: flex; flex-direction: row; gap: 8px; align-items: stretch; height: 38px;">
                         <div class="hp-pill-group" style="display: flex; flex: 1; border-radius: 12px; padding: 3px; background: #f8fafc; border: 1px solid #f1f5f9;">
                             <button onclick="setHomepageMode('today')" id="btn-mode-today" class="nav-pill active-pill" style="flex: 1; border-radius: 9px; font-size: 0.72rem; border: none;">Oggi</button>
                             <button onclick="setHomepageMode('tomorrow')" id="btn-mode-tomorrow" class="nav-pill" style="flex: 1; border-radius: 9px; font-size: 0.72rem; border: none;">Domani</button>
                             <button onclick="setHomepageMode('week')" id="btn-mode-week" class="nav-pill" style="flex: 1; border-radius: 9px; font-size: 0.72rem; border: none;">Settimana</button>
                         </div>

                         <button id="hp-date-picker-btn" onclick="toggleCustomDatePicker(this)" style="width: 38px; height: 38px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                            <span class="material-icons-round" style="font-size: 18px; color: #8b5cf6;">calendar_today</span> 
                         </button>

                         <button id="hp-top-add-btn" onclick="window.toggleHpQuickEntry(this)" style="width: 38px; height: 38px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; color: #111; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                            <span class="material-icons-round" style="font-size: 20px;">add</span>
                         </button>
                     </div>
                </div>

                <!-- 2. TASKS SECTION (Top Block - with faceted switcher) -->
                <div class="hp-sidebar-list-block" style="flex: 0 0 auto; min-height: 380px; max-height: 440px; display: flex; flex-direction: column; padding: 1.5rem 1.75rem; border-bottom: 2px solid #f8fafc; background: #fff; font-family: 'Outfit';">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                         
                         <!-- Segmented Control (Icons Only) -->
                         <div style="display: flex; align-items: center; gap: 2px; background: #f8fafc; padding: 4px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            <div id="hp-filter-task" onclick="window.setHpAltFilter('task')" style="position: relative; cursor: pointer; width: 42px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: ${window.hpActivityFilter === 'task' ? '#fff' : 'transparent'}; color: ${window.hpActivityFilter === 'task' ? '#64748b' : '#64748b'}; border: ${window.hpActivityFilter === 'task' ? '1px solid #e2e8f0' : '1px solid transparent'}; box-shadow: ${window.hpActivityFilter === 'task' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'};">
                                <span class="material-icons-round" style="font-size: 20px;">check_circle</span>
                                <div id="hp-badge-task" style="display: none; position: absolute; top: -3px; right: -3px; background: #ef4444; color: white; font-size: 8px; font-weight: 800; min-width: 15px; height: 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff;">0</div>
                            </div>
                            <div id="hp-filter-event" onclick="window.setHpAltFilter('event')" style="position: relative; cursor: pointer; width: 42px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: ${window.hpActivityFilter === 'event' ? '#fff' : 'transparent'}; color: ${window.hpActivityFilter === 'event' ? '#64748b' : '#64748b'}; border: ${window.hpActivityFilter === 'event' ? '1px solid #e2e8f0' : '1px solid transparent'}; box-shadow: ${window.hpActivityFilter === 'event' ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'};">
                                <span class="material-icons-round" style="font-size: 20px;">calendar_today</span>
                                <div id="hp-badge-event" style="display: none; position: absolute; top: -3px; right: -3px; background: #8b5cf6; color: white; font-size: 8px; font-weight: 800; min-width: 15px; height: 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff;">0</div>
                            </div>
                         </div>

                         <div style="display: flex; align-items: center; gap: 8px;">
                            <a id="hp-task-list-link" href="#tasks-summary" style="text-decoration: none; font-size: 0.7rem; font-weight: 700; color: #1e293b; background: #fff; padding: 7px 14px; border-radius: 10px; border: 1px solid #e2e8f0; transition: all 0.25s; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">Lista</a>
                            <div id="hp-overdue-toggle" onclick="window.toggleHpOverdue()" style="cursor: pointer; position: relative; width: 36px; height: 36px; border-radius: 10px; background: #fff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                                <span class="material-icons-round" style="font-size: 19px; color: #ef4444;">history</span>
                                <div id="hp-overdue-badge" style="display: none; position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 8px; font-weight: 800; min-width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.2);">0</div>
                            </div>
                         </div>
                    </div>
                    
                    <div id="hp-activities-list" style="flex: 1; overflow-y: auto;">
                        <!-- Tasks live here -->
                    </div>
                </div>
                

                <!-- 3. AGENDA SECTION (Bottom Block - Vertical Timeline - No Header) -->
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff;">
                    <div id="hp-timeline-wrapper" style="flex: 1; overflow-y: auto; position: relative;">
                        <!-- Timeline lives here -->
                    </div>
                </div>
            </div>

            <!-- 2. MAIN CONTENT AREA (Projects + Activities) -->
            <div class="hp-main-content-area custom-scrollbar" style="padding-top: 1rem;">
                 
                 <!-- RESPONSIVE DASHBOARD STYLES -->
                 <style>
                     .hp-dash-collab-main {
                         display: flex;
                         gap: 2.5rem;
                         align-items: stretch;
                         width: 100%;
                     }
                     .hp-dash-collab-left {
                         flex: 2.4;
                         display: flex;
                         flex-direction: column;
                         gap: 2.5rem;
                         min-width: 0;
                     }
                     .hp-dash-collab-right {
                         flex: 1;
                         min-width: 260px;
                         display: flex;
                         flex-direction: column;
                         overflow: hidden;
                     }
                     .hp-dash-collab-top {
                         display: grid;
                         grid-template-columns: 0.9fr 1.15fr;
                         grid-template-rows: 1fr;
                         gap: 2.5rem;
                         align-items: stretch; height: 440px;
                         width: 100%;
                     }
                     .hp-dash-collab-fin {
                         display: grid;
                         grid-template-columns: 1fr 1fr;
                         grid-template-rows: 1fr;
                         gap: 2.5rem;
                         align-items: stretch; height: 440px;
                         width: 100%;
                         margin-bottom: 2.5rem;
                     }
                     .hp-dash-partner-main {
                         display: grid;
                         grid-template-columns: 1.15fr 1fr 0.85fr;
                         gap: 2.5rem;
                         align-items: flex-start;

                         width: 100%;
                         min-height: 0;
                     }
                     
                      .hp-dash-collab-top > div, .hp-dash-collab-fin > div, .hp-dash-partner-main > div {
                          display: flex;
                          flex-direction: column;
                          overflow: hidden;
                          min-height: 0;
                          height: 100%;
                      }

                     @media (max-width: 1100px) {
                         .hp-alt-sidebar-left { display: none !important; }
                         .hp-main-content-area { padding: 1rem !important; height: auto !important; overflow-y: visible !important; }
                         .hp-main-columns-container { flex-direction: column !important; height: auto !important; gap: 1.5rem; }
                         .hp-dash-collab-main, .hp-dash-collab-top, .hp-dash-collab-fin, .hp-dash-partner-main {
                             display: flex !important;
                             flex-direction: column !important;
                             grid-template-columns: none !important;
                             height: auto !important;
                             gap: 1.5rem !important;
                         }
                         .hp-dash-collab-top > div, .hp-dash-partner-main > div {
                             max-height: none !important;
                             height: auto !important;
                             width: 100% !important;
                             flex: none !important;
                         }
                         .hp-mobile-banner { display: flex !important; position: sticky; top: 0; z-index: 100; margin-bottom: 20px; }
                     }
                     
                     @media (min-width: 1101px) {
                         .hp-main-columns-container {
                             min-height: 900px;
                         }
                         .hp-dash-collab-top, .hp-dash-collab-fin {
                             height: 440px !important;
                         }
                         #hp-pm-spaces-main-block, #hp-internal-dashboard-block {
                             height: 440px !important;
                             max-height: 440px;
                         }
                         .hp-dash-collab-top > div {
                             height: 100%;
                             max-height: 440px;
                         }
                     }
                 </style>

                 <!-- MOBILE STICKY BANNER -->
                 <div class="hp-mobile-banner" onclick="window.openMobileAgenda()">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="display: flex; flex-direction: column; gap: 0;">
                            <span style="font-size: 0.62rem; font-weight: 800; color: #1e293b; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 2px;">JOURNAL'S VIEW</span>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="color: #8b5cf6; font-size: 13px;">task_alt</span>
                                    <span id="hp-banner-count-tasks" style="font-weight: 800; font-size: 0.9rem; color: #64748b;">0</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="color: #10b981; font-size: 13px;">calendar_today</span>
                                    <span id="hp-banner-count-events" style="font-weight: 800; font-size: 0.9rem; color: #64748b;">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div onclick="event.stopPropagation(); window.toggleHpQuickEntry(this)" style="width: 36px; height: 36px; background: #1e293b; border: none; border-radius: 11px; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 15px rgba(0,0,0,0.15); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <span class="material-icons-round" style="font-size: 20px;">add</span>
                    </div>
                 </div>
                 
                 <div class="hp-main-columns-container">
                     ${isCollaborator ? `
                     <!-- ==================== COLLABORATOR ==================== -->
                     <div class="hp-dash-collab-main">
                         
                         <!-- LEFT SIDE: Tasks, Activities, Financials -->
                         <div class="hp-dash-collab-left">
                             <!-- ROW 1: TOP BLOCKS -->
                             <div class="hp-dash-collab-top">
                                 <!-- Left: Tasks (Collab) -->
                                 <div id="hp-pm-spaces-main-block" style="padding: 0;">
                                    <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.75rem; flex-shrink: 0;">
                                         <div style="display: flex; justify-content: space-between; align-items: center;">
                                             <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                                 <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);">
                                                     <span class="material-icons-round" style="color: #64748b; font-size: 18px;">dashboard</span>
                                                 </div>
                                                 I miei incarichi
                                             </h3>
                                         </div>
                                    </div>
                                    <div id="hp-projects-stats-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; margin-bottom: 0.25rem; flex-shrink: 0;"></div>
                                    <div id="hp-pm-spaces-main-list" class="custom-scrollbar" style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden; padding: 0 8px 30px 0; min-height: 0;"></div>
                                 </div>

                                 <!-- Right: Internal Activities (Collab) -->
                                 <div id="hp-internal-dashboard-block" style="padding: 0;">
                                    <div style="margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                                        <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);">
                                            <span class="material-icons-round" style="color: #64748b; font-size: 18px;">business_center</span>
                                        </div>
                                        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; letter-spacing: -0.01em;">Attività interne</h3>
                                    </div>
                                    <div style="margin-bottom: 2rem; flex-shrink: 0;">
                                        <div id="hp-internal-hubs-buttons" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; -ms-overflow-style: none;"></div>
                                    </div>
                                    <div id="hp-internal-clusters-grid" class="custom-scrollbar" style="flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 1rem; overflow-y: auto; padding: 0 4px 2rem 4px; min-height: 0;"></div>
                                 </div>
                             </div>

                             <!-- ROW 2: FINANCIAL BLOCKS (Collab) -->
                             <div class="hp-dash-collab-fin">
                                 <div id="hp-collaborator-payments-box" class="hp-widget-panel" style="box-sizing: border-box; padding: 1.25rem 1.5rem; background: white; border: 1px solid rgba(0,0,0,0.04); border-radius: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.04);">
                                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.85rem;">
                                          <span class="material-icons-round" style="color: #94a3b8; font-size: 16px;">payment</span>
                                          <h3 style="font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; color: #64748b; margin: 0; letter-spacing: 0.04em; text-transform: uppercase;">Pagamenti</h3>
                                      </div>
                                      <div id="hp-collab-payments-list" class="custom-scrollbar" style="height: 354px; overflow-y: auto; padding-right: 4px;"><div style="padding: 1.5rem 0; text-align: center; color: #94a3b8;"><span class="loader small"></span></div></div>
                                 </div>
                                 <div id="hp-collaborator-invoices-box" class="hp-widget-panel" style="box-sizing: border-box; padding: 1.25rem 1.5rem; background: white; border: 1px solid rgba(0,0,0,0.04); border-radius: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.04);">
                                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.85rem;">
                                          <span class="material-icons-round" style="color: #94a3b8; font-size: 16px;">receipt_long</span>
                                          <h3 style="font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; color: #64748b; margin: 0; letter-spacing: 0.04em; text-transform: uppercase;">Fatture</h3>
                                      </div>
                                      <div id="hp-collab-invoices-list" class="custom-scrollbar" style="height: 354px; overflow-y: auto; padding-right: 4px;"><div style="padding: 1.5rem 0; text-align: center; color: #94a3b8;"><span class="loader small"></span></div></div>
                                 </div>
                             </div>
                         </div>
                         
                         <!-- RIGHT SIDE: FEED -->
                         <div class="hp-dash-collab-right">
                              <!-- FEED BLOCK -->
                              <div id="hp-activity-feed-block" style="flex: 1; display: flex; flex-direction: column; height: 100%; border-radius: 28px; padding: 1.5rem; min-height: 0; overflow: hidden; background: white; border: 1px solid rgba(0,0,0,0.03);">
                                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-shrink: 0;">
                                      <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">rss_feed</span></div>Feed
                                      </h3>
                                      <div id="hp-feed-tabs-container" style="display: flex; gap: 4px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02);"></div>
                                 </div>
                                 <div id="hp-feed-content" class="custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px; min-height: 0;"></div>
                              </div>
                         </div>

                     </div>
                     ` : `
                      <!-- ==================== PARTNER / ADMIN ==================== -->
                      <!-- 3 COLUMNS FLEX GRID -->
                      <div class="hp-dash-partner-main" style="padding-bottom: 0;">
                          
                          <!-- Col 1: Commesse -->
                          <div id="hp-pm-spaces-main-block" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
                             <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 1.25rem; flex-shrink: 0;">
                                  <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 8px;">
                                      <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">dashboard</span></div>
                                          Le mie Commesse
                                      </h3>
                                      ${showAccountPmToggle ? `
                                      <div style="display: flex; gap: 6px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02); margin-right: 8px;">
                                        <button id="hp-filter-account" class="hp-filter-pill active" onclick="togglePmFilter('account')" style="font-family: 'Outfit', sans-serif; padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b;">ACCOUNT</button>
                                        <button id="hp-filter-pm" class="hp-filter-pill active" onclick="togglePmFilter('pm')" style="font-family: 'Outfit', sans-serif; padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b;">PM</button>
                                      </div>
                                      ` : ''}
                                  </div>
                                  <!-- STATS BAR RESTORED -->
                                  <div id="hp-projects-stats-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.65rem; margin-bottom: 0.75rem; flex-shrink: 0; background: rgba(255,255,255,0.4); border-radius: 14px; border: 1px solid rgba(255,255,255,0.5);">
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #3b82f6; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">COMMESSE</span>
                                           <span id="stat-count-projects" style="font-size: 1.25rem; font-weight: 800; color: #3b82f6; line-height: 1;">0</span>
                                       </div>
                                       <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06); margin: 0 8px;"></div>
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">ATTIVITÀ</span>
                                           <span id="stat-count-activities" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">0</span>
                                       </div>
                                       <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06); margin: 0 8px;"></div>
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">TASK</span>
                                           <span id="stat-count-tasks" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">0</span>
                                       </div>
                                       <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06); margin: 0 8px;"></div>
                                       <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                                           <span style="font-size: 0.55rem; font-weight: 700; color: #10b981; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">APPUNTAMENTI</span>
                                           <span id="stat-count-events" style="font-size: 1.25rem; font-weight: 800; color: #10b981; line-height: 1;">0</span>
                                       </div>
                                  </div>
                             </div>
                             <div id="hp-pm-spaces-main-list" class="custom-scrollbar" style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden; padding: 4px 8px 60px 8px; min-height: 0;"></div>
                          </div>

                          <!-- Col 2: Attività Interne -->
                          <div id="hp-internal-dashboard-block" style="display: flex; flex-direction: column; height: 100%; min-height: 0;">
                               <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 8px; margin-bottom: 1.25rem; flex-shrink: 0;">
                                  <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em;">
                                      <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">business_center</span></div>
                                      Attività interne
                                  </h3>
                               </div>
                               <div style="flex-shrink: 0;">
                                   <div id="hp-internal-hubs-buttons" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 24px; scrollbar-width: none; -ms-overflow-style: none; padding-top: 4px; flex-shrink: 0;"></div>
                               </div>
                               <div id="hp-internal-clusters-grid" class="custom-scrollbar" style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; align-content: start; overflow-y: auto; padding-bottom: 2rem; min-height: 0;"></div>
                          </div>

                          <!-- Col 3: FEED & ALERTS -->
                          <div style="display: flex; flex-direction: column; gap: 1rem; height: 820px; min-height: 0;">
                              <!-- ALERT BLOCK -->
                              <div id="hp-accounting-alerts-block" style="display: none; flex-direction: column; background: white; border-radius: 28px; padding: 1.5rem; border: 1px solid rgba(0,0,0,0.03); flex-shrink: 0;">
                                  <div class="flex-start" style="gap: 12px; align-items: center; margin-bottom: 1rem;">
                                      <div style="width: 36px; height: 36px; border-radius: 12px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 20px;">notifications_active</span></div>
                                      <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 600; color: #1e293b; margin: 0; letter-spacing: -0.02em;">Alert Amministrazione</h4>
                                  </div>
                                  <div id="hp-admin-alert-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
                              </div>

                              <!-- FEED BLOCK -->
                              <div id="hp-activity-feed-block" style="flex: 1; display: flex; flex-direction: column; border-radius: 28px; padding: 1.5rem; min-height: 0; background: white; border: 1px solid rgba(0,0,0,0.03); overflow: hidden;">
                                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-shrink: 0;">
                                      <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em;">
                                          <div style="width: 32px; height: 32px; border-radius: 10px; background: rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.5);"><span class="material-icons-round" style="color: #64748b; font-size: 18px;">rss_feed</span></div>Feed
                                      </h3>
                                      <div id="hp-feed-tabs-container" style="display: flex; gap: 4px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.02);"></div>
                                 </div>
                                 <div id="hp-feed-content" class="custom-scrollbar" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px; min-height: 0;"></div>
                              </div>
                          </div>
                      </div>
                      `}
                 </div> <!-- End hp-main-columns-container -->
                 
            </div> <!-- End main-content-area -->
              <!-- 3. MOBILE OVERLAY POPUP (Journal's View) -->
              <div id="hp-mobile-agenda-popup" class="hp-mobile-agenda-pop" onclick="window.closeMobileAgenda()">
                <div onclick="event.stopPropagation()" style="background: white; width: 95%; max-width: 450px; border-radius: 30px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: hpPopSlide 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); max-height: 85vh;">
                    <!-- Popup Header -->
                    <div style="padding: 24px 24px 16px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em;">Journal's View</h3>
                        <button onclick="window.closeMobileAgenda()" style="background: #f1f5f9; border: none; width: 40px; height: 40px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <span class="material-icons-round" style="font-size: 24px; color: #64748b;">close</span>
                        </button>
                    </div>
                    <!-- Popup Body (Dynamically populated) -->
                    <div id="hp-mobile-agenda-list" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;">
                        <!-- Top Controls, Scrollable List, and Fixed Footer injected by syncHomepageActivities -->
                    </div>
                </div>
              </div>

              <style>
                @keyframes hpPopSlide {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
              </style>
    `;
    // --- Interaction Logic ---
    // Store current date for timeline navigation
    window.homepageCurrentDate = new Date();
    window.homepageCollaboratorId = myCollab.id;
    window.hpView = 'daily'; // 'daily' | 'weekly'
    window.hpActivityFilter = 'task'; // Default to tasks
    
    window.openMobileAgenda = () => {
        const pop = document.getElementById('hp-mobile-agenda-popup');
        if (pop) {
            pop.style.display = 'flex';
            document.body.style.overflow = 'hidden'; 
            window.syncHomepageActivities();
        }
    };
    window.closeMobileAgenda = () => {
        const pop = document.getElementById('hp-mobile-agenda-popup');
        if (pop) {
            pop.style.display = 'none';
            document.body.style.overflow = ''; 
        }
    };

    window.toggleOverdueFilter = () => {
        window.hpShowOverdue = !window.hpShowOverdue;
        const btn = document.getElementById('hp-mobile-overdue-filter');
        if (btn) btn.style.color = window.hpShowOverdue ? '#ef4444' : '#94a3b8';
        window.syncHomepageActivities();
    };

    window.syncHomepageActivities = () => {
        if (!window.hpData) return;

        const date = window.homepageCurrentDate || new Date();
        let start = new Date(date);
        let end = new Date(date);

        if (window.hpView === 'weekly') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff); start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
        } else if (window.hpView === 'tomorrow') {
            // Se siamo in hpView 'tomorrow', forziamo la data di domani rispetto a OGGI, 
            // a meno che non siamo già spostati su un'altra data specifica col picker.
            const today = new Date();
            start = new Date(today);
            start.setDate(today.getDate() + 1); start.setHours(0, 0, 0, 0);
            end = new Date(start); end.setHours(23, 59, 59, 999);
        } else {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }

        // Filter Tasks from the master list (window.hpData.tasks contains all pending)
        const parseLocal = (s) => {
            if (!s) return null;
            try {
                if (typeof s === 'string' && s.includes('-') && s.length === 10) {
                    const parts = s.split('-');
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                }
                const d = new Date(s);
                if (isNaN(d.getTime())) return null;
                d.setHours(0, 0, 0, 0);
                return d;
            } catch (e) { return null; }
        };

        const allTasks = window.hpData.tasks || [];
        const pmActivities = allTasks.filter(item => {
            const type = (item.raw_type || '').toLowerCase();
            return type.includes('attivit') || type.includes('activity');
        });
        const realTasksOnly = allTasks.filter(item => {
            const type = (item.raw_type || '').toLowerCase();
            return !(type.includes('attivit') || type.includes('activity'));
        });

        const toYMD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const startStr = toYMD(start);
        const todayStr = toYMD(new Date());
        const isTodayView = (startStr === todayStr) && (window.hpView === 'daily');

        const filteredRealTasks = realTasksOnly.filter(t => {
            if (!t.due_date) return false;
            const d = parseLocal(t.due_date);
            if (isTodayView) {
                if (window.hpShowOverdue) return d <= end;
                return d >= start && d <= end;
            }
            return d >= start && d <= end;
        });

        const filteredPmActivities = pmActivities.filter(t => {
            if (!t.due_date) return true; // Show undated activities in the list
            const d = parseLocal(t.due_date);
            return d >= start && d <= end;
        });

        // Davide wants ONLY tasks, no activities in the main list.
        // Sort tasks by due date (chronological)
        const combinedTasks = filteredRealTasks.sort((a, b) => {
            const dateA = a.due_date ? new Date(a.due_date) : new Date(0);
            const dateB = b.due_date ? new Date(b.due_date) : new Date(0);
            return dateA - dateB;
        });
        window.hpData.filteredTasks = combinedTasks;

        const actContainer = document.getElementById('hp-activities-list');
        if (actContainer) {
            renderMyActivities(actContainer, window.hpData.timers, combinedTasks, window.hpData.events, window.hpActivityFilter);
        }

        const overdueBadge = document.getElementById('hp-overdue-badge');
        const nowAtStartOfDay = new Date(); nowAtStartOfDay.setHours(0,0,0,0);
        const overdueCount = allTasks.filter(t => t.due_date && new Date(t.due_date) < nowAtStartOfDay && t.status !== 'done').length;

        const taskBadge = document.getElementById('hp-badge-task');
        const eventBadge = document.getElementById('hp-badge-event');
        const realTasksCount = filteredRealTasks.length; 

        // Calculate counts for the Current View Range (to prevent flickering)
        const filteredEventsList = (window.hpData?.events || []).filter(e => {
            if (!e.start) return false;
            const d = new Date(e.start);
            return d >= start && d <= end;
        });
        const countEvent = filteredEventsList.length;

        if (taskBadge) { 
            taskBadge.textContent = realTasksCount; 
            taskBadge.style.display = realTasksCount > 0 ? 'flex' : 'none'; 
        }
        if (eventBadge) { 
            eventBadge.textContent = countEvent; 
            eventBadge.style.display = countEvent > 0 ? 'flex' : 'none'; 
            eventBadge.style.background = '#8b5cf6';
        }

        // Update Overdue UI (Desktop)
        if (overdueBadge) {
            overdueBadge.textContent = overdueCount;
            overdueBadge.style.display = overdueCount > 0 ? 'flex' : 'none';
        }

        // --- MOBILE COUNTS FIX ---
        // These badges should reflect the SELECTED period (start to end), not always today.
        const bTasks = document.getElementById('hp-banner-count-tasks');
        const bEvents = document.getElementById('hp-banner-count-events');
        
        // Count tasks and events for the current range (start/end)
        const rangeTasksCount = combinedTasks.length;
        const rangeEventsCount = countEvent;

        if (bTasks) bTasks.textContent = rangeTasksCount;
        if (bEvents) bEvents.textContent = rangeEventsCount;

        // --- NEW POPUP STATS ---
        const popT = document.getElementById('hp-mobile-stat-tasks');
        const popE = document.getElementById('hp-mobile-stat-events');
        const popO = document.getElementById('hp-mobile-stat-overdue');
        const popOBox = document.getElementById('hp-mobile-stat-overdue-box');
        
        if (popT) popT.textContent = rangeTasksCount;
        if (popE) popE.textContent = rangeEventsCount;
        if (popO) {
            popO.textContent = overdueCount;
            if (popOBox) popOBox.style.display = overdueCount > 0 ? 'flex' : 'none';
        }

        const pContent = document.getElementById('hp-mobile-agenda-list');
        const pPopup = document.getElementById('hp-mobile-agenda-popup');
        
        if (pContent && pPopup && pPopup.style.display === 'flex') {
            const isTaskMode = (window.hpActivityFilter === 'task');
            const dayDesc = window.hpView === 'weekly' ? 'Prossimi Giorni' : (window.hpView === 'tomorrow' ? 'Domani' : 'Oggi');

            pContent.innerHTML = `
                <!-- 1. TOP CONTROLS (Sticky) -->
                <div style="padding: 20px 20px 10px 20px; flex-shrink: 0; border-bottom: 1px solid rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                        <div style="flex: 1; background: #f8fafc; padding: 4px; border-radius: 12px; display: flex; gap: 4px; border: 1px solid #f1f5f9;">
                            <button onclick="window.setTimelineMode('today', true)" style="flex: 1; padding: 9px 4px; font-size: 0.7rem; font-weight: 700; border-radius: 9px; border: none; cursor: pointer; transition: all 0.2s; background: ${window.hpView === 'daily' ? 'white' : 'transparent'}; color: ${window.hpView === 'daily' ? '#1e293b' : '#64748b'}; box-shadow: ${window.hpView === 'daily' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'}; border: ${window.hpView === 'daily' ? '1px solid #e2e8f0' : '1px solid transparent'};">OGGI</button>
                            <button onclick="window.setTimelineMode('tomorrow', true)" style="flex: 1; padding: 9px 4px; font-size: 0.7rem; font-weight: 700; border-radius: 9px; border: none; cursor: pointer; transition: all 0.2s; background: ${window.hpView === 'tomorrow' ? 'white' : 'transparent'}; color: ${window.hpView === 'tomorrow' ? '#1e293b' : '#64748b'}; box-shadow: ${window.hpView === 'tomorrow' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'}; border: ${window.hpView === 'tomorrow' ? '1px solid #e2e8f0' : '1px solid transparent'};">DOMANI</button>
                            <button onclick="window.setTimelineMode('week', true)" style="flex: 1; padding: 9px 4px; font-size: 0.7rem; font-weight: 700; border-radius: 9px; border: none; cursor: pointer; transition: all 0.2s; background: ${window.hpView === 'weekly' ? 'white' : 'transparent'}; color: ${window.hpView === 'weekly' ? '#1e293b' : '#64748b'}; box-shadow: ${window.hpView === 'weekly' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'}; border: ${window.hpView === 'weekly' ? '1px solid #e2e8f0' : '1px solid transparent'};">SETTIMANA</button>
                        </div>
                        <div style="position: relative; width: 42px; height: 42px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid #e2e8f0;" onclick="event.stopPropagation()">
                             <span class="material-icons-round" style="color: #64748b; font-size: 20px;">event</span>
                             <input type="date" onchange="window.setHpAlternativeDate(this.value)" onclick="event.stopPropagation()" style="position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer;">
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <div style="display: flex; background: #f8fafc; padding: 4px; border-radius: 12px; gap: 4px; border: 1px solid #f1f5f9;">
                             <button onclick="window.setHpAltFilter('task')" style="position: relative; background: ${isTaskMode ? 'white' : 'transparent'}; color: ${isTaskMode ? '#3b82f6' : '#94a3b8'}; border: none; padding: 7px 10px; border-radius: 10px; display: flex; align-items: center; cursor: pointer; border: 1px solid ${isTaskMode ? '#e2e8f0' : 'transparent'}; box-shadow: ${isTaskMode ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'};">
                                 <span class="material-icons-round" style="font-size: 20px;">check_circle</span>
                                 <span id="hp-mobile-pop-stat-tasks" style="position: absolute; top: -4px; right: -4px; background: #3b82f6; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 5px; border-radius: 10px; border: 2px solid white;">${rangeTasksCount}</span>
                             </button>
                             <button onclick="window.setHpAltFilter('event')" style="position: relative; background: ${!isTaskMode ? 'white' : 'transparent'}; color: ${!isTaskMode ? '#8b5cf6' : '#94a3b8'}; border: none; padding: 7px 10px; border-radius: 10px; display: flex; align-items: center; cursor: pointer; border: 1px solid ${!isTaskMode ? '#e2e8f0' : 'transparent'}; box-shadow: ${!isTaskMode ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'};">
                                 <span class="material-icons-round" style="font-size: 20px;">calendar_today</span>
                                 <span id="hp-mobile-pop-stat-events" style="position: absolute; top: -4px; right: -4px; background: #8b5cf6; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 5px; border-radius: 10px; border: 2px solid white;">${rangeEventsCount}</span>
                             </button>
                        </div>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="position: relative; cursor: pointer;" onclick="window.toggleOverdueFilter()">
                                <span id="hp-mobile-overdue-filter" class="material-icons-round" style="font-size: 24px; color: ${window.hpShowOverdue ? '#ef4444' : '#94a3b8'};">history</span>
                                <span id="hp-mobile-pop-stat-overdue" style="display: ${overdueCount > 0 ? 'block' : 'none'}; position: absolute; top: -4px; right: -6px; background: #ef4444; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 5px; border-radius: 10px; border: 2px solid white;">${overdueCount}</span>
                            </div>
                            <span class="material-icons-round" onclick="window.openPmItemDetails('NEW')" style="font-size: 26px; color: #3b82f6; cursor: pointer;">add_circle</span>
                        </div>
                    </div>
                </div>

                <!-- 2. SCROLLABLE CONTENT AREA -->
                <div style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px; min-height: 0;">
                    <div style="font-size: 0.72rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.08em;">
                        ${dayDesc}
                    </div>
                    <div id="hp-mobile-rows-container"></div>
                </div>

                <!-- 3. FIXED FOOTER (Sticky) -->
                <div style="padding: 16px 20px 24px 20px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; background: white;">
                    <a href="#tasks-summary" onclick="window.closeMobileAgenda()" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f8fafc; border-radius: 12px; text-decoration: none; color: #1e293b; font-size: 0.85rem; font-weight: 700; border: 1px solid #f1f5f9;">
                         <div style="display: flex; align-items: center; gap: 10px;">
                             <span class="material-icons-round" style="color: #3b82f6; font-size: 18px;">assignment</span>
                             Vai a tutte le mie Task
                         </div>
                         <span class="material-icons-round" style="font-size: 18px; color: #94a3b8;">chevron_right</span>
                    </a>
                    <a href="#agenda" onclick="window.closeMobileAgenda()" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f8fafc; border-radius: 12px; text-decoration: none; color: #1e293b; font-size: 0.85rem; font-weight: 700; border: 1px solid #f1f5f9;">
                         <div style="display: flex; align-items: center; gap: 10px;">
                             <span class="material-icons-round" style="color: #8b5cf6; font-size: 18px;">calendar_month</span>
                             Vai all'Agenda completa
                         </div>
                         <span class="material-icons-round" style="font-size: 18px; color: #94a3b8;">chevron_right</span>
                    </a>
                </div>
            `;
            
            const rowsContainer = document.getElementById('hp-mobile-rows-container');
            if (rowsContainer) rowsContainer.style.overflowX = 'hidden'; 

            if (isTaskMode) {
                if (combinedTasks.length === 0) {
                    rowsContainer.innerHTML = `<div style="padding: 3rem 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem; font-weight: 500;">
                        Nessuna task ${window.hpView === 'weekly' ? 'per questa settimana' : (window.hpView === 'tomorrow' ? 'per domani' : 'per oggi')}.
                    </div>`;
                } else {
                    rowsContainer.innerHTML = '';
                    combinedTasks.forEach(t => renderActivityRow(rowsContainer, t));
                }
            } else {
                const dayEvents = (window.hpData?.events || []).filter(e => {
                    if (!e.start) return false;
                    const d = new Date(e.start);
                    return d >= start && d <= end;
                }).sort((a, b) => new Date(a.start) - new Date(b.start));

                if (dayEvents.length === 0) {
                    rowsContainer.innerHTML = `<div style="padding: 3rem 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem; font-weight: 500;">
                        Nessun appuntamento ${window.hpView === 'weekly' ? 'per questa settimana' : (window.hpView === 'tomorrow' ? 'domani' : 'oggi')}.
                    </div>`;
                } else {
                    rowsContainer.innerHTML = '';
                    dayEvents.forEach(e => renderActivityRow(rowsContainer, { ...e, isEvent: true, type: 'event' }));
                }
            }
        }
    };

    window.setHpAlternativeDate = (val) => {
        if (!val) return;
        const d = new Date(val);
        window.homepageCurrentDate = d;
        window.hpView = 'daily';
        
        // Use updateHomepageTimeline to refetch events for the specific date
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.setTimelineMode = (mode, isMobile = false) => {
        if (mode === 'today') {
            window.hpView = 'daily';
            window.homepageCurrentDate = new Date();
        } else if (mode === 'tomorrow') {
            window.hpView = 'tomorrow';
            const d = new Date();
            d.setDate(d.getDate() + 1);
            window.homepageCurrentDate = d;
        } else if (mode === 'week') {
            window.hpView = 'weekly';
            // Current date remains as is, the view logic handles week range
        }
        
        // Refresh everything
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.setHpAltFilter = (filter) => {
        window.hpActivityFilter = filter;
        window.syncHomepageActivities();
    };

    window.toggleHomepageView = (view) => {
        window.hpView = view;

        // UI Update
        const dailyBtn = document.getElementById('view-daily-btn');
        const weeklyBtn = document.getElementById('view-weekly-btn');
        if (view === 'daily') {
            if (dailyBtn) { dailyBtn.classList.add('active-pill'); dailyBtn.style.background = 'white'; dailyBtn.style.color = '#111'; }
            if (weeklyBtn) { weeklyBtn.classList.remove('active-pill'); weeklyBtn.style.background = 'transparent'; weeklyBtn.style.color = '#6b7280'; }
        } else {
            if (weeklyBtn) { weeklyBtn.classList.add('active-pill'); weeklyBtn.style.background = 'white'; weeklyBtn.style.color = '#111'; }
            if (dailyBtn) { dailyBtn.classList.remove('active-pill'); dailyBtn.style.background = 'transparent'; dailyBtn.style.color = '#6b7280'; }
        }

        window.updateHomepageTimeline(window.homepageCurrentDate);
        window.syncHomepageActivities(); // Added to ensure both sections stay in sync
    };

    // Function to update timeline and header date
    window.updateHomepageTimeline = async (date) => {
        const timelineWrapper = document.getElementById('hp-timeline-wrapper');
        const headerTitle = document.getElementById('page-title');
        const headerDate = document.getElementById('hp-date-description');

        // Determine Start/End based on View
        let start = new Date(date);
        let end = new Date(date);
        let dateText = '';

        if (window.hpView === 'weekly') {
            const day = start.getDay(); // 0 (Sun) - 6 (Sat)
            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
            start.setDate(diff); start.setHours(0, 0, 0, 0);

            end = new Date(start);
            end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);

            const startStr = start.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
            const endStr = end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
            dateText = `Settimana dal ${startStr} al ${endStr}.`;
        } else {
            // Daily
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            dateText = `Ecco cosa c'è in programma per ${date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.`;
        }

        // Update header date (with null check)
        if (headerDate) headerDate.innerHTML = dateText;

        // Keep Greeting in sync (especially if time passed or name changed)
        let myCollab;
        if (state.impersonatedCollaboratorId) {
            myCollab = state.collaborators.find(c => c.id == state.impersonatedCollaboratorId);
        }
        
        const currentFirstName = getFirstName(myCollab, state.profile);
        const hours = new Date().getHours();
        let greeting = 'Buongiorno';
        if (hours >= 14 && hours < 19) greeting = 'Buon pomeriggio';
        else if (hours >= 19 || hours < 5) greeting = 'Buonasera';
        if (headerTitle) headerTitle.textContent = `${greeting}, ${currentFirstName}!`;
        
        if (!timelineWrapper) {
            console.log("[Homepage] timelineWrapper not found, aborting update.");
            return;
        }

        timelineWrapper.innerHTML = `<div style="padding: 2rem; width: 100%; text-align: center; color: var(--text-tertiary);"><span class="loader small"></span> Caricamento...</div>`;

        try {
            // Parallel Fetch: Events + Availability + Google + Overrides
            // Now passing (id, start, end)
            const [events, rules, googleBusy, overrides] = await Promise.all([
                fetchDateEvents(window.homepageCollaboratorId, start, end),
                fetchAvailabilityRules(window.homepageCollaboratorId),
                fetchGoogleCalendarBusy(window.homepageCollaboratorId, start, end),
                fetchAvailabilityOverrides(window.homepageCollaboratorId) // from api.js
            ]);

            // Rules filtering needs to be smarter for weekly (pass all rules? or filter inside render?)
            // For now pass all rules, render logic handles day matching

            if (window.hpView === 'weekly') {
                renderWeeklyTimeline(timelineWrapper, events, start, rules, googleBusy, overrides);
            } else {
                // Determine day ID for Daily View
                const dayId = date.getDay();
                const dayRules = rules.filter(r => r.day_of_week === dayId);

                // FORCE VERTICAL TIMELINE
                renderVerticalTimeline(timelineWrapper, events, date, rules);

                // Auto-scroll to now if today
                if (new Date().toDateString() === date.toDateString()) {
                    const now = new Date();
                    const nowM = (now.getHours() * 60) + now.getMinutes();
                    const top = nowM * (80 / 60); // pxPerHour = 80
                    setTimeout(() => {
                        timelineWrapper.scrollTo({ top: top - 100, behavior: 'smooth' });
                    }, 500);
                }
            }

            // Sync My Activities Side Panel (Events Tab AND Tasks) with the new date/range
            if (window.hpData) {
                window.hpData.events = events;
                window.syncHomepageActivities();
            }

        } catch (e) {
            console.error(e);
            timelineWrapper.innerHTML = `<div style="color:red; text-align:center;">Errore caricamento</div>`;
        }
    };

    window.changeHomepageDate = (offset) => {
        window.homepageCurrentDate.setDate(window.homepageCurrentDate.getDate() + offset);
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.resetHomepageDate = () => {
        window.homepageCurrentDate = new Date();
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    // --- MODE SWITCHER LOGIC ---
    window.setHomepageMode = (mode) => {
        // 1. Visual Update
        const modes = ['today', 'tomorrow', 'week'];
        modes.forEach(m => {
            const btn = document.getElementById('btn-mode-' + m);
            if (btn) {
                if (m === mode) {
                    btn.classList.add('active-pill');
                    btn.style.background = 'white';
                    btn.style.color = '#111';
                    btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                } else {
                    btn.classList.remove('active-pill');
                    btn.style.background = 'transparent';
                    btn.style.color = '#6b7280';
                    btn.style.boxShadow = 'none';
                }
            }
        });

        // 2. Logic Update
        if (mode === 'today') {
            window.hpView = 'daily';
            window.homepageCurrentDate = new Date();
        } else if (mode === 'tomorrow') {
            window.hpView = 'tomorrow';
            const d = new Date();
            d.setDate(d.getDate() + 1);
            window.homepageCurrentDate = d;
        } else if (mode === 'week') {
            window.hpView = 'weekly';
        }
        
        window.updateHomepageTimeline(window.homepageCurrentDate);
    };

    window.toggleHpOverdue = () => {
        window.hpShowOverdue = !window.hpShowOverdue;
        
        // Update ONLY the task list, not the whole agenda
        if (window.syncHomepageActivities) {
            window.syncHomepageActivities();
        }
    };

    window.setHpAltFilter = (filter) => {
        window.hpActivityFilter = filter;
        
        // Update UI
        const taskBtn = document.getElementById('hp-filter-task');
        const eventBtn = document.getElementById('hp-filter-event');
        const taskLink = document.getElementById('hp-task-list-link');
        const overdueToggle = document.getElementById('hp-overdue-toggle');

        if (taskBtn && eventBtn) {
            if (filter === 'task') {
                taskBtn.style.background = '#fff'; taskBtn.style.color = '#8b5cf6'; taskBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; taskBtn.style.borderColor = '#e2e8f0';
                eventBtn.style.background = 'transparent'; eventBtn.style.color = '#64748b'; eventBtn.style.boxShadow = 'none'; eventBtn.style.borderColor = 'transparent';
                if (taskLink) {
                    taskLink.textContent = 'Lista task';
                    taskLink.href = '#tasks-summary';
                }
                if (overdueToggle) overdueToggle.style.display = 'flex';
            } else {
                eventBtn.style.background = '#fff'; eventBtn.style.color = '#8b5cf6'; eventBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; eventBtn.style.borderColor = '#e2e8f0';
                taskBtn.style.background = 'transparent'; taskBtn.style.color = '#64748b'; taskBtn.style.boxShadow = 'none'; taskBtn.style.borderColor = 'transparent';
                if (taskLink) {
                    taskLink.textContent = 'Vedi Agenda';
                    taskLink.href = '#agenda';
                }
                if (overdueToggle) overdueToggle.style.display = 'none';
            }
        }
        
        if (window.syncHomepageActivities) {
            window.syncHomepageActivities();
        }
    };

    // --- CUSTOM DATE PICKER ---
    window.hpPickerDate = new Date(); // Use window for global access

    window.toggleCustomDatePicker = (btn) => {
        const existing = document.getElementById('custom-datepicker-popover');
        if (existing) {
            existing.remove();
            return;
        }

        window.hpPickerDate = new Date(window.homepageCurrentDate);

        const rect = btn.getBoundingClientRect();
        const popoverWidth = 300;
        const popover = document.createElement('div');
        popover.id = 'custom-datepicker-popover';
        popover.className = 'glass-card';
        popover.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            left: ${rect.right - popoverWidth}px;
            background: white;
            color: #1f2937;
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            width: ${popoverWidth}px;
            border: 1px solid #e5e7eb;
            font-family: inherit;
        `;

        window.renderHpPickerCalendar(popover);
        document.body.appendChild(popover);

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popover.contains(e.target) && !btn.contains(e.target)) {
                    popover.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    };

    window.renderHpPickerCalendar = (container) => {
        const year = window.hpPickerDate.getFullYear();
        const month = window.hpPickerDate.getMonth();
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <button onclick="window.changeHpPickerMonth(-1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;">
                    <span class="material-icons-round">chevron_left</span>
                </button>
                <div style="font-weight: 700; font-size: 0.95rem; color:#111;">${monthNames[month]} ${year}</div>
                <button onclick="window.changeHpPickerMonth(1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;">
                    <span class="material-icons-round">chevron_right</span>
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px;">
        `;

        const days = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
        days.forEach(d => {
            html += `<div style="text-align: center; font-size: 0.75rem; color: #9ca3af; font-weight: 600;">${d}</div>`;
        });
        html += `</div><div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">`;

        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = (firstDay === 0 ? 6 : firstDay - 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const currentSelected = window.homepageCurrentDate;

        for (let i = 0; i < adjustedFirstDay; i++) { html += `<div></div>`; }

        for (let i = 1; i <= daysInMonth; i++) {
            let bg = 'transparent';
            let color = '#374151';
            let weight = '500';
            if (i === currentSelected.getDate() && month === currentSelected.getMonth() && year === currentSelected.getFullYear()) {
                bg = '#8b5cf6'; color = 'white'; weight = '700';
            } else if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                bg = '#eff6ff'; color = '#3b82f6'; weight = '700';
            }

            html += `
                <button onclick="window.selectHpPickerDate(${i})" style="
                    width: 100%; aspect-ratio: 1; border: none; background: ${bg}; color: ${color};
                    border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: ${weight};
                    display: flex; align-items: center; justify-content: center;
                ">
                    ${i}
                </button>
            `;
        }
        html += `</div>`;
        container.innerHTML = html;
    };

    window.changeHpPickerMonth = (offset) => {
        window.hpPickerDate.setMonth(window.hpPickerDate.getMonth() + offset);
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) window.renderHpPickerCalendar(popover);
    };

    window.selectHpPickerDate = (day) => {
        const newDate = new Date(window.hpPickerDate.getFullYear(), window.hpPickerDate.getMonth(), day);
        const offset = newDate.getTimezoneOffset();
        const localDate = new Date(newDate.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];
        window.updateHomepageDateFromInput(dateStr);
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) popover.remove();
    };

    // --- QUICK ENTRY MENU ---
    window.toggleHpQuickEntry = (btn) => {
        const existing = document.getElementById('hp-quick-entry-popover');
        if (existing) { existing.remove(); return; }

        const rect = btn.getBoundingClientRect();
        const popoverWidth = 240;
        const popover = document.createElement('div');
        popover.id = 'hp-quick-entry-popover';
        popover.className = 'glass-card';
        popover.style.cssText = `
            position: fixed; top: ${rect.bottom + 8}px; left: ${rect.right - popoverWidth}px;
            background: white; color: #1f2937; padding: 8px; border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); z-index: 99999;
            width: ${popoverWidth}px; border: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 4px;
        `;

        const items = [
            { id: 'task', label: 'Nuova Task', description: 'Crea attività operativa', icon: 'check_circle', color: '#3b82f6', action: () => openHubDrawer(null, null, null, 'task') },
            { id: 'appt', label: 'Nuovo Appuntamento', description: 'Segna incontro o evento', icon: 'event', color: '#a855f7', action: () => openAppointmentDrawer() }
        ];

        items.forEach(item => {
            const row = document.createElement('div');
            row.style.cssText = `display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; border-radius: 8px; transition: all 0.2s;`;
            row.onmouseover = () => { row.style.background = '#f3f4f6'; };
            row.onmouseout = () => { row.style.background = 'transparent'; };
            row.onclick = () => { popover.remove(); item.action(); };
            row.innerHTML = `
                <div style="width: 32px; height: 32px; border-radius: 8px; background: ${item.color}15; color: ${item.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-icons-round" style="font-size: 18px;">${item.icon}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 1px;">
                    <div style="font-weight: 700; font-size: 0.85rem; color: #111;">${item.label}</div>
                    <div style="font-size: 0.75rem; color: #6b7280;">${item.description}</div>
                </div>
            `;
            popover.appendChild(row);
        });

        document.body.appendChild(popover);
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popover.contains(e.target) && !btn.contains(e.target)) {
                    popover.remove(); document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    };

    // --- Background Data Fetch & Initial Load ---
    (async () => {
        console.log('[Homepage] htmlRole:', htmlRole, '| isCollaborator:', isCollaborator, '| tags:', normalizedTagsForHtml, '| impersonating:', !!state.impersonatedCollaboratorId);

        // Se collaboratorId non è disponibile, aspetta data:loaded e riprova
        const targetUserId = myCollab.user_id || state.session?.user?.id;
        const collaboratorId = myCollab.id;

        if (!collaboratorId && !targetUserId) {
            console.warn("[Homepage] No collaborator/user ID available yet. Waiting for data:loaded...");
            window.addEventListener('data:loaded', () => renderHomepageAlt(container), { once: true });
            return;
        }

        try {
            // Re-fetch data in background to populate and sync
            const { data: pmTasks, error: pmError } = await supabase
                .from('pm_items')
                .select(`
                    id, title, status, due_date, item_type,
                    parent_ref,
                    parent_task:parent_ref(id, title, item_type),
                    pm_spaces (
                        id, name, type, area, is_cluster, parent_ref,
                        orders (
                            order_number, 
                            title,
                            clients (id, business_name, client_code)
                        ),
                        cluster:parent_ref(id, name)
                    ),
                    pm_item_assignees!inner(user_ref, role),
                    all_assignees:pm_item_assignees(user_ref, role)
                `)
                .eq('pm_item_assignees.user_ref', targetUserId)
                .neq('status', 'done');

            if (pmError) console.error("PM Tasks fetch error:", pmError);

            const fetchedTasks = (pmTasks || []).map(t => {
                const myAssignment = t.pm_item_assignees.find(a => a.user_ref === targetUserId);
                const myRole = myAssignment ? myAssignment.role : 'viewer';
                const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                const clients = space?.orders?.clients;
                let clientCode = '';
                if (clients) {
                    if (Array.isArray(clients)) { clientCode = clients[0]?.client_code || ''; } 
                    else { clientCode = clients.client_code || ''; }
                }
                let ord = space?.orders?.order_number || '';
                
                let breadcrumb = '';
                if (space) {
                    const path = [];
                    const cluster = Array.isArray(space.cluster) ? space.cluster[0] : space.cluster;
                    if (cluster && cluster.name) path.push(cluster.name);
                    if (space && space.name && (!cluster || space.name !== cluster.name)) path.push(space.name);
                    const pTask = Array.isArray(t.parent_task) ? t.parent_task[0] : t.parent_task;
                    if (pTask && pTask.title) path.push(pTask.title);
                    breadcrumb = path.join(' › ');
                }
                const rawType = (t.item_type || 'task').toLowerCase();
                return {
                    id: t.id, title: t.title, status: t.status, due_date: t.due_date,
                    parent_id: t.parent_ref, orders: space?.orders, breadcrumb: breadcrumb,
                    area: space?.area || '', space_type: (space?.type || '').toLowerCase(),
                    raw_type: rawType, type: 'pm_task', role: myRole, all_assignees: t.all_assignees || []
                };
            });

            const rangeEnd = new Date();
            rangeEnd.setDate(rangeEnd.getDate() + 30);

            // Fetch Payments & Invoices for Collaborator
            if (isCollaborator) {
                fetchCollaboratorPayments(myCollab.id).then(payData => {
                    renderCollaboratorPayments(payData);
                });
            }

            // Sync Timeline Initially
            rangeEnd.setDate(rangeEnd.getDate() + 14);
            const fetchedEvents = await fetchDateEvents(myId, new Date(), rangeEnd);

            // 1. Store data for filtering reference
            window.hpData = {
                timers: [],
                tasks: fetchedTasks,
                events: fetchedEvents,
                filteredTasks: fetchedTasks
            };

            // 2. Initial sync for activities
            window.syncHomepageActivities();

            // 3. Timeline (Default Today)
            window.updateHomepageTimeline(window.homepageCurrentDate);

            // 4. Role-Based Dispatch
            // We already parsed this above into 'normalizedTagsForHtml' and 'htmlRole'. We reuse it.
            const normalizedTags = normalizedTagsForHtml;
            const detectedRole = htmlRole;
            const actualTargetUserId = myCollab.user_id || state.session?.user?.id;
            
            await renderMainContent(container, detectedRole, {
                myTasks: fetchedTasks, events: fetchedEvents, activeTimers: [], myCollab, myId,
                normalizedTags, targetUserId: actualTargetUserId
            });

        } catch (e) {
            console.error("Home Data Load Error:", e);
        }
    })();

    // --- GLOBAL REFRESHER FOR DASHBOARD ---
    const setupRefresher = () => {
        const reload = () => {
            // Verify if the element is still in the DOM and visible
            if (!document.getElementById('hp-pm-spaces-main-block')) {
                document.removeEventListener('pm-item-changed', window._hpAltReloadHandler);
                document.removeEventListener('appointment-changed', window._hpAltReloadHandler);
                window._hpAltReloadHandler = null;
                return;
            }
            console.log("[Homepage] Refreshing dashboard data...");
            renderHomepageAlt(container);
        };

        // Prevent double registration
        if (window._hpAltReloadHandler) {
            document.removeEventListener('pm-item-changed', window._hpAltReloadHandler);
            document.removeEventListener('appointment-changed', window._hpAltReloadHandler);
        }
        window._hpAltReloadHandler = reload;
        document.addEventListener('pm-item-changed', reload);
        document.addEventListener('appointment-changed', reload);
    };
    setupRefresher();
}

// --- INTERNAL HUB/CLUSTER ENGINES ---
async function fetchInternalHubsAndClusters(collaboratorId, userId, isPrivileged = false, isPartnerStrict = false) {
    try {
        const { fetchInternalSpaces } = await import('../modules/pm_api.js?v=8000');
        const COMPANY_AREAS = [
            { id: 'amministrazione', label: 'Amministrazione', color: '#6366f1', icon: 'account_balance' },
            { id: 'marketing', label: 'Marketing', color: '#f59e0b', icon: 'campaign' },
            { id: 'produzione', label: 'Produzione', color: '#10b981', icon: 'factory' },
            { id: 'ricerca_sviluppo', label: 'Ricerca e Sviluppo', color: '#8b5cf6', icon: 'biotech' },
            { id: 'risorse_umane', label: 'Risorse Umane', color: '#f97316', icon: 'groups' },
            { id: 'servizi', label: 'Servizi', color: '#64748b', icon: 'cleaning_services' },
            { id: 'vendite', label: 'Vendite', color: '#ef4444', icon: 'shopping_cart' }
        ];

        // 1. Get official Internal Spaces from Gleeye API
        const rawData = await fetchInternalSpaces();

        // 2. Fetch Area Managers for Hubs
        const { data: configData } = await supabase.from('system_config').select('key, value').like('key', 'area_manager_%');
        const areaManagers = {};
        (configData || []).forEach(row => {
            const areaId = row.key.replace('area_manager_', '');
            areaManagers[areaId] = String(row.value);
        });

        // 3. Determine Hubs (Areas)
        // Hubs are always visible for Privileged roles (Account/PM/Partner) to browse,
        // but only marked as "mine" if responsible.
        const hubs = COMPANY_AREAS.map(a => {
             const mng = areaManagers[a.id];
             const isResp = mng && (String(mng) === String(collaboratorId) || String(mng) === String(userId));
             return { ...a, isResponsible: isResp };
        });


        // 4. Hub visibility for Collaborators
        // We filter these AFTER processing clusters to include hubs that contain assigned clusters
        
        // 5. Cluster Logic: Filter + Apply Custom Sort Order + Enhanced Mapping
        const iconMap = {
            'legale': 'gavel', 'social': 'public', 'marketing': 'campaign', 'commercialista': 'calculate',
            'contabil': 'account_balance_wallet', 'erp': 'terminal', 'sviluppo': 'code', 'amministrazione': 'account_balance',
            'vendite': 'trending_up', 'commerciale': 'shopping_cart', 'ricerca': 'biotech', 'risorse': 'diversity_3',
            'produzione': 'factory', 'servizi': 'cleaning_services', 'formazione': 'school', 'sicurezza': 'security',
            'logistica': 'local_shipping', 'business': 'insights', 'progetto': 'folder', 'archivio': 'inventory_2',
            'ufficio': 'apartment', 'tecnico': 'engineering', 'partner': 'handshake', 'web': 'language',
            'design': 'palette', 'creativ': 'token', 'media': 'movie', 'evento': 'celebration', 'task': 'task_alt',
            'agenda': 'event', 'clienti': 'assignment_ind', 'finance': 'payments', 'brand': 'star',
            'auto': 'directions_car', 'form': 'description', 'help': 'help_center', 'cloud': 'cloud_queue',
            'hardware': 'computer', 'infra': 'settings_suggest'
        };

        // Determine final clusters/projects to show in grid
        console.log(`[HP-DEBUG] Filtering clusters. User: ${userId}, Collab: ${collaboratorId}`);

        let clusters = (rawData || []).filter(s => {
            const assignees = s.pm_space_assignees || [];
            const isDirectTeamMember = assignees.some(a => 
                (a.user_ref && String(a.user_ref) === String(userId)) || 
                (a.collaborator_ref && String(a.collaborator_ref) === String(collaboratorId))
            );

            const isNamedManager = String(s.default_pm_user_ref || '') === String(userId);
            const isInvolved = isDirectTeamMember || isNamedManager;

            if (s.is_cluster) {
                // CLUSTERS: Solo se assegnatario o manager nominale.
                if (!isInvolved) {
                    // console.log(`[HP-DEBUG] Skipping cluster: ${s.name} (Not involved)`);
                    return false;
                }
                console.log(`[HP-DEBUG] KEEPING CLUSTER: ${s.name} (isInvolved: ${isInvolved}, isDirect: ${isDirectTeamMember}, isPM: ${isNamedManager})`);
                return true;
            } else {
                // PROJECTS (Surfacing): Solo se assegnato direttamente E il genitore non è già in griglia.
                if (!isInvolved) return false;

                let parentInGrid = false;
                if (s.parent_ref) {
                    const parent = (rawData || []).find(p => p.id === s.parent_ref);
                    const parentAssignees = parent?.pm_space_assignees || [];
                    const isParentInGrid = parentAssignees.some(a => 
                        (a.user_ref && String(a.user_ref) === String(userId)) || 
                        (a.collaborator_ref && String(a.collaborator_ref) === String(collaboratorId))
                    ) || (String(parent?.default_pm_user_ref || '') === String(userId));
                    
                    parentInGrid = isParentInGrid;
                }
                if (!parentInGrid) {
                    console.log(`[HP-DEBUG] SURFACING PROJECT: ${s.name} (Parent not in grid)`);
                }
                return !parentInGrid; 
            }
        }).map(c => {
            const area = COMPANY_AREAS.find(a => 
                (a.label.toLowerCase() === (c.area || '').toLowerCase()) || 
                (a.id.toLowerCase() === (c.area || '').toLowerCase())
            );
            
            let clusterIcon = 'workspaces'; 
            const nameLower = c.name.toLowerCase();
            for (const [key, icon] of Object.entries(iconMap)) {
                if (nameLower.includes(key)) {
                    clusterIcon = icon;
                    break;
                }
            }
            return { ...c, areaInfo: area, clusterIcon };
        });

        // Apply saved order
        const savedOrder = localStorage.getItem(`hp_cluster_order_${userId || collaboratorId}`);
        if (savedOrder) {
            const orderArr = JSON.parse(savedOrder);
            clusters.sort((a, b) => {
                const idxA = orderArr.indexOf(String(a.id));
                const idxB = orderArr.indexOf(String(b.id));
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
        }

        // 5. Finalize Hubs (Filter based on visibility + containing clusters)
        const finalClusters = clusters || [];
        const visibleHubsData = hubs.filter(h => 
            isPrivileged || 
            isPartnerStrict || 
            h.isResponsible || 
            finalClusters.some(c => {
                const areaId = (c.area || '').toLowerCase();
                return areaId === h.id.toLowerCase() || (c.areaInfo && c.areaInfo.id === h.id);
            })
        );

        return { hubs: visibleHubsData, clusters: finalClusters };
    } catch (e) {
        console.error("Error fetching internal hubs/clusters:", e);
        return { hubs: [], clusters: [] };
    }
}

function renderInternalDashboard(hubs, clusters) {
    const hubContainer = document.getElementById('hp-internal-hubs-buttons');
    const clusterContainer = document.getElementById('hp-internal-clusters-grid');
    if (!hubContainer || !clusterContainer) return;

    if (hubs.length === 0 && clusters.length === 0) {
        clusterContainer.innerHTML = `<div style="padding: 1rem; color: #94a3b8; font-size: 0.8rem; font-family: 'Outfit', sans-serif; font-style: italic;">In attesa di Hub e Cluster...</div>`;
        return;
    }

    // --- CLUSTERS ABOVE ---
    if (clusters.length === 0) {
        clusterContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.75rem; font-family: 'Outfit', sans-serif;">Nessun cluster trovato.</div>`;
    } else {
        clusterContainer.innerHTML = clusters.map((c, i) => {
            const color = c.color || c.areaInfo?.color || '#cbd5e1';
            return `
                <div draggable="true" 
                    data-id="${c.id}"
                    data-index="${i}"
                    onclick="window.location.hash='#pm/space/${c.id}'" 
                    class="hp-cluster-card"
                    style="
                        display: flex; flex-direction: column; align-items: center; gap: 6px; 
                        cursor: grab; transition: all 0.2s; padding: 8px; border-radius: 16px;
                    " onmouseover="this.querySelector('.cluster-icon-box').style.transform='scale(1.1)';" onmouseout="this.querySelector('.cluster-icon-box').style.transform='none';">
                    <div class="cluster-icon-box" style="
                        width: 48px; height: 48px; border-radius: 14px; background: white; 
                        display: flex; align-items: center; justify-content: center; 
                        box-shadow: 0 4px 12px ${color}12; border: 1px solid rgba(0,0,0,0.03);
                        transition: all 0.2s; pointer-events: none; position: relative;
                    ">
                        <span class="material-icons-round" style="font-size: 24px; color: ${color};">${c.clusterIcon}</span>
                        <!-- Area Badge Inside Icon Box -->
                        ${c.areaInfo ? `
                            <div style="
                                position: absolute; bottom: -4px; right: -4px; 
                                width: 22px; height: 22px; border-radius: 8px; 
                                background: white; border: 2px solid white;
                                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                                display: flex; align-items: center; justify-content: center;
                            ">
                                <span class="material-icons-round" style="font-size: 12px; color: ${color};">${c.areaInfo.icon}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div style="text-align: center; pointer-events: none;">
                        <div style="font-family: 'Outfit', sans-serif; font-size: 0.78rem; font-weight: 600; color: #1e293b; line-height: 1.1; max-width: 100px; word-wrap: break-word;">${c.name}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Sortable Logic
        initClusterSortable(clusterContainer, clusters);
    }

    // --- HUBS ON TOP (Slim Expandable Pills) ---
    const respHubs = hubs.filter(h => h.isResponsible);
    
    if (respHubs.length === 0) {
        hubContainer.parentElement.style.display = 'none';
        hubContainer.innerHTML = '';
    } else {
        hubContainer.parentElement.style.display = 'block';
        const areaLabel = `<span style="font-family: 'Outfit', sans-serif; font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 8px; display: flex; align-items: center; white-space: nowrap;">AREE:</span>`;
        hubContainer.innerHTML = areaLabel + respHubs.map(h => `
            <button onclick="window.location.hash='#pm/interni?area=${h.id}'" 
                class="hp-hub-pill"
                style="
                    padding: 4px; border-radius: 100px; border: none; 
                    background: transparent; color: #1e293b; font-size: 0.72rem; font-weight: 600;
                    font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.05em;
                    display: flex; align-items: center; gap: 0; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    flex-shrink: 0; overflow: hidden; max-width: 32px; min-width: 32px; height: 32px;
                    justify-content: flex-start;
                " onmouseover="this.style.maxWidth='220px'; this.style.gap='10px'; this.style.padding='4px 14px 4px 4px'; this.style.background='${h.color}10'; this.style.transform='translateY(-1px)';" onmouseout="this.style.maxWidth='32px'; this.style.gap='0'; this.style.padding='4px'; this.style.background='transparent'; this.style.transform='none';">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${h.color}15; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-icons-round" style="font-size: 15px; color: ${h.color};">${h.icon || 'hub'}</span>
                </div>
                <span class="hp-hub-label" style="opacity: 0; transition: opacity 0.2s 0.1s; display: inline-block;">${h.label}</span>
            </button>
        `).join('');

        // Targeted script for the label span
        hubContainer.querySelectorAll('.hp-hub-pill').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                const label = btn.querySelector('.hp-hub-label');
                if (label) label.style.opacity = '1';
            });
            btn.addEventListener('mouseleave', () => {
                const label = btn.querySelector('.hp-hub-label');
                if (label) label.style.opacity = '0';
            });
        });
    }
}

function initClusterSortable(container, clusters) {
    let draggedItem = null;

    container.querySelectorAll('.hp-cluster-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedItem = card;
            card.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            draggedItem = card;
            card.style.opacity = '1';
            
            // Save new order
            const newOrder = Array.from(container.querySelectorAll('.hp-cluster-card')).map(el => el.dataset.id);
            const userId = state.profile?.id || state.profile?.collaborator_id;
            localStorage.setItem(`hp_cluster_order_${userId}`, JSON.stringify(newOrder));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const target = e.target.closest('.hp-cluster-card');
            if (target && target !== draggedItem) {
                const rect = target.getBoundingClientRect();
                const next = (e.clientX - rect.left) > (rect.width / 2);
                container.insertBefore(draggedItem, next ? target.nextSibling : target);
            }
        });
    });
}

// --- ROLE-BASED MAIN CONTENT DISPATCHER ---
async function renderMainContent(container, role, data) {
    try {
        // 1. Common Side-Panel Actions for ALL Roles (Feed, etc.)
        await setupHomepageFeed(data);

        // 2. Dispatch to specific role view
        switch(role) {
            case 'partner':         return await renderMainContent_Partner(container, data);
            case 'amministrazione': return await renderMainContent_Amministrazione(container, data);
            case 'account':         return await renderMainContent_Account(container, data);
            case 'pm':              return await renderMainContent_PM(container, data);
            default:                return await renderMainContent_Collaboratore(container, data);
        }
    } catch (err) {
        console.error("Critical error in renderMainContent:", err);
        const area = document.querySelector('.hp-main-columns-container');
        if (area) area.innerHTML = `<div style="padding: 3rem; text-align: center; color: #94a3b8;">Si è verificato un errore nel caricamento della Dashboard. Per favore ricarica la pagina.</div>`;
    }
}

async function setupHomepageFeed(data) {
    const { myId, targetUserId, normalizedTags } = data;
    const isPartner = normalizedTags.includes('partner') || normalizedTags.includes('amministrazione') || normalizedTags.includes('account');
    
    const feedTabs = document.getElementById('hp-feed-tabs-container');
    if (feedTabs) {
        feedTabs.innerHTML = `
            <button id="hp-feed-tab-mine" onclick="window.setHpFeedTab('mine')" class="hp-filter-pill active" style="padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: white; color: #1e293b; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">PER ME</button>
            ${isPartner ? `<button id="hp-feed-tab-all" onclick="window.setHpFeedTab('all')" class="hp-filter-pill" style="padding: 4px 10px; border-radius: 7px; border: none; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: #94a3b8;">TUTTE</button>` : ''}
        `;
    }

    window.setHpFeedTab = async (tab) => {
        const mineBtn = document.getElementById('hp-feed-tab-mine');
        const allBtn = document.getElementById('hp-feed-tab-all');
        const content = document.getElementById('hp-feed-content');
        if (!content) return;

        // Visual Toggle
        if (mineBtn) {
            mineBtn.style.background = tab === 'mine' ? 'white' : 'transparent';
            mineBtn.style.color = tab === 'mine' ? '#1e293b' : '#94a3b8';
            mineBtn.style.boxShadow = tab === 'mine' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        }
        if (allBtn) {
            allBtn.style.background = tab === 'all' ? 'white' : 'transparent';
            allBtn.style.color = tab === 'all' ? '#1e293b' : '#94a3b8';
            allBtn.style.boxShadow = tab === 'all' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        }

        content.innerHTML = '<span class="loader small"></span>';

        if (tab === 'mine') {
            const activities = await fetchSmartPersonalFeed(20, targetUserId, myId);
            renderActivityFeed(content, activities);
        } else {
            const activities = await fetchPMActivityLogs({ limit: 50, isAccountLevel: true });
            renderActivityFeed(content, activities);
        }
    };

    // Initial load
    window.setHpFeedTab('mine');
}

// --- PARTNER VIEW (Original full homepage logic) ---
async function renderMainContent_Partner(container, data) {
    const { myTasks, events, activeTimers, myCollab, myId, normalizedTags } = data;
    const isPrivileged = normalizedTags.includes('partner') || normalizedTags.includes('amministrazione') || normalizedTags.includes('account') || normalizedTags.includes('project manager') || normalizedTags.includes('pm');

    const bottomTitle = document.getElementById('hp-bottom-title');
    const projectsLabel = document.getElementById('hp-bottom-projects-label');
    if (bottomTitle) bottomTitle.textContent = isPrivileged ? 'Commesse in corso' : 'Incarichi in corso';
    if (projectsLabel) projectsLabel.textContent = isPrivileged ? 'Commesse' : 'Incarichi';

    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;

    // Un utente con partner/amministrazione è sempre admin, anche se ha anche account/pm.
    // Vedi directives/role_hierarchy.md
    const isAdmin = normalizedTags.includes('partner') ||
        normalizedTags.includes('amministrazione') ||
        normalizedTags.includes('socio') ||
        state.profile?.role === 'admin';
    
    // Hide block by default for non-admins (e.g. Accounts/PMs)
    if (isAdmin) {
        const alerts = await fetchAdminOperationalAlerts();
        renderAdminAlerts(alerts);
        const alertBlock = document.getElementById('hp-accounting-alerts-block');
        if (alertBlock) alertBlock.style.display = 'flex';
    } else {
        const alertBlock = document.getElementById('hp-accounting-alerts-block');
        if (alertBlock) alertBlock.style.display = 'none';
    }

    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    const internalProjects = await fetchInternalProjects(myActualCollabId, targetUserId, isAdmin);
    
    // Fetch Hubs/Clusters
    // isPrivileged: True for Partner/Admin/Account/PM (for Hub visibility)
    // isAdmin (isPartnerStrict): ONLY for real Admins/Partners (for full Cluster visibility)
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, isPrivileged, isAdmin);
    renderInternalDashboard(hubs, clusters);

    // Tab switching logic
    window.setHpBottomTab = (tab) => {
        const projectsBtn = document.getElementById('hp-bottom-tab-projects');
        const internalBtn = document.getElementById('hp-bottom-tab-internal');
        const content = document.getElementById('hp-pm-spaces-main-list');
        if (!content) return;

        if (tab === 'projects') {
            projectsBtn?.classList.add('active');
            internalBtn?.classList.remove('active');
            renderProjects(content, projects);
        } else {
            internalBtn?.classList.add('active');
            projectsBtn?.classList.remove('active');
            renderProjects(content, internalProjects);
        }
    };

    // Initial render: show internal if no projects, else show projects
    if (!projects || projects.length === 0) {
        window.setHpBottomTab('internal');
    } else {
        window.setHpBottomTab('projects');
    }

    // --- HIERARCHICAL SORTING ---
    // Helper to put children under parents
    const sortHierarchical = (items) => {
        const result = []; // No need to redeclare results here
        const roots = items.filter(t => !t.parent_id || !items.find(p => p.id === t.parent_id));

        // Sort roots by date
        roots.sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        });

        const addChild = (parent) => {
            result.push(parent);
            const children = items.filter(t => t.parent_id === parent.id);
            children.sort((a, b) => {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            });
            children.forEach(c => addChild(c));
        };

        roots.forEach(root => addChild(root));
        return result;
    };

    // --- ACTIVITIES WIDGET LOGIC ---
    // Include BOTH Activities and Tasks in the right box
    const allFiltered = myTasks;
    const allActivities = sortHierarchical(allFiltered);

    const taskProjects = allActivities.filter(t => t.space_type.includes('commessa') || t.space_type.includes('order'));
    const taskInternal = allActivities.filter(t => t.space_type.includes('interno') || t.space_type.includes('cluster') || t.space_type.includes('space') || t.space_type === '');

    window.setHpActivityTab = (tab) => {
        const pBtn = document.getElementById('hp-act-tab-projects');
        const iBtn = document.getElementById('hp-act-tab-internal');
        const content = document.getElementById('hp-activities-bottom-content');
        if (!content) return;

        if (tab === 'projects') {
            pBtn?.classList.add('active');
            iBtn?.classList.remove('active');
            renderBottomTasks(content, taskProjects);
        } else {
            iBtn?.classList.add('active');
            pBtn?.classList.remove('active');
            renderBottomTasks(content, taskInternal);
        }
    };

    // Glow Effect Handler for Premium Cards
    const handleGlow = (e) => {
        for (const card of document.getElementsByClassName("project-card")) {
            const rect = card.getBoundingClientRect(),
                x = e.clientX - rect.left,
                y = e.clientY - rect.top;

            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);
        }
    };
    container.addEventListener("mousemove", handleGlow);

    // Initial render for activities
    window.setHpActivityTab('projects');

    // Feed is now handled by the shared dispatcher setupHomepageFeed

    // Note: Delegated tasks widget was removed in favor of Activity Feed per user request? 
    // Actually the user said "una card", so I replaced one. 
    // I could also add more rows to the grid if they want both.
    // For now, replacing the less used 'Delegated' is a safe bet for a clean UI.

    // Initial render for delegated (removed)
    // window.setHpDelegatedTab('projects');

    window.openMobileAgenda = () => {
        const el = document.getElementById('hp-mobile-agenda-popup');
        if (el) {
            el.style.display = 'flex';
            window.syncHomepageActivities();
        }
    };

    // Helper for Quick Add from Banner
    window.toggleHpQuickEntry = (btn) => {
        // Show a mini-menu or just default to adding task for now
        // If we have openGlobalQuickAdd or similar, use it.
        if (window.openQuickAddTask) {
            window.openQuickAddTask();
        } else {
            // Fallback: search for existing add buttons
            const addBtn = document.querySelector('[onclick*="openAddTask"]');
            if (addBtn) addBtn.click();
        }
    };
}

// --- STUB VIEWS (Enhanced with correct IDs and initialization) ---
async function renderMainContent_Amministrazione(container, data) {
    const isAdmin = data.normalizedTags.includes('amministrazione') || state.profile?.role === 'admin' || data.normalizedTags.includes('socio') || data.normalizedTags.includes('partner');
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (isAdmin) {
        const alerts = await fetchAdminOperationalAlerts();
        renderAdminAlerts(alerts);
        if (alertBlock) alertBlock.style.display = 'flex';
    } else {
        if (alertBlock) alertBlock.style.display = 'none';
    }
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;
    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    
    // Fetch Hubs/Clusters (Pass true for global access)
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, true);
    renderInternalDashboard(hubs, clusters);
    
    renderProjects(content, projects);
}
async function renderMainContent_Account(container, data) {
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (alertBlock) alertBlock.style.display = 'none';
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;
    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    
    // Account Level: Privileged for Hubs, but NOT PartnerStrict for Clusters
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, true, false);
    renderInternalDashboard(hubs, clusters);
    
    renderProjects(content, projects);
}
async function renderMainContent_PM(container, data) {
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (alertBlock) alertBlock.style.display = 'none';
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const targetUserId = data.targetUserId;
    const myActualCollabId = data.myId;
    const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
    
    // PM Level: Privileged for Hubs, but NOT PartnerStrict for Clusters
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, true, false);
    renderInternalDashboard(hubs, clusters);
    
    renderProjects(content, projects);
}
async function renderMainContent_Collaboratore(container, data) {
    const alertBlock = document.getElementById('hp-accounting-alerts-block');
    if (alertBlock) alertBlock.style.display = 'none';
    const content = document.getElementById('hp-pm-spaces-main-list');
    if (!content) return;
    const myActualCollabId = data.myId;
    const targetUserId = data.targetUserId;

    // Fetch Assignments instead of Projects for Collaborator
    const assignments = await fetchCollaboratorAssignments(myActualCollabId);
    
    // Fetch Hubs/Clusters (False for collaborator - assigned only)
    const { hubs, clusters } = await fetchInternalHubsAndClusters(myActualCollabId, targetUserId, false);
    renderInternalDashboard(hubs, clusters);
    
    // Fetch Appointments for Collaborator (Using relative path)
    const { fetchCollaboratorAppointments } = await import('../modules/pm_api.js?v=8000');
    const events = await fetchCollaboratorAppointments(myActualCollabId) || [];
    
    if (assignments && assignments.length > 0) {
        renderAssignments(content, assignments, clusters, events);
    } else {
        // Fallback or show empty state
        renderProjects(content, []);
    }
}

// --- ASSIGNMENTS RENDERING ---
function renderAssignments(pmList, assignments, clusters = [], events = []) {
    if (!pmList || !assignments) return;
    
    // Reset Stats Bar for Assignments
    const statsBar = document.getElementById('hp-projects-stats-bar');
    if (statsBar) {
        // Calculate unique orders (Commesse)
        const uniqueOrders = new Set(assignments.map(a => a.order_number).filter(Boolean));
        
        statsBar.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #3b82f6; letter-spacing: 0.05em; opacity: 0.8;">COMMESSE</span>
                <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #3b82f6; line-height: 1;">...</span>
            </div>
            <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8;">ATTIVITÀ</span>
                <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
            </div>
            <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8;">TASK</span>
                <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
            </div>
            <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                <span style="font-size: 0.58rem; font-weight: 700; color: #10b981; letter-spacing: 0.05em; opacity: 0.8;">APPUNTAMENTI</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #10b981; line-height: 1;">...</span>
                </div>
            </div>
        `;
    }

    pmList.innerHTML = assignments.map(a => `
        <div class="project-card" onclick="window.location.hash='${a.link}'" style="
            background: white;
            border-radius: 14px;
            padding: 0.75rem 0.85rem;
            border: 1px solid #f1f5f9;
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 10px rgba(0,0,0,0.02);
            position: relative;
            overflow: hidden;
            margin-bottom: 4px;
        ">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(139, 92, 246, 0.06); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                 <span class="material-icons-round" style="color: #8b5cf6; font-size: 18px;">assignment</span>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                     <span style="font-size: 0.6rem; font-weight: 800; color: #8b5cf6; text-transform: uppercase;">${a.legacy_id || 'INC'}</span>
                </div>
                <h4 style="font-size: 0.95rem; font-weight: 700; color: #1e293b; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
                    ${a.title}
                </h4>
                <div style="font-size: 0.72rem; color: #64748b; font-weight: 500;">${a.client}</div>
            </div>
        </div>
    `).join('');
}

// --- SHARED PROJECTS RENDERING ENGINE ---
function renderProjects(pmList, pmProjects) {
    if (!pmList || !pmProjects) return;
    
    // Ensure the block is visible
    const pmBlock = document.getElementById('hp-pm-spaces-main-block');
    if (pmBlock) pmBlock.style.display = 'flex';

    const _internalRender = () => {
        const showAccount = window.hpActiveFilters?.account !== false;
        const showPm = window.hpActiveFilters?.pm !== false;

        // Ensure the stats bar is populated with its internal HTML structure if empty
        const statsBar = document.getElementById('hp-projects-stats-bar');
        if (statsBar && !statsBar.querySelector('#stat-count-projects')) {
            statsBar.innerHTML = `
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #3b82f6; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">COMMESSE</span>
                    <span id="stat-count-projects" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #3b82f6; line-height: 1;">...</span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">ATTIVITÀ</span>
                    <span id="stat-count-activities" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #475569; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">TASK</span>
                    <span id="stat-count-tasks" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1;">...</span>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(0,0,0,0.06);"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: center;">
                    <span style="font-size: 0.55rem; font-weight: 700; color: #10b981; letter-spacing: 0.05em; opacity: 0.8; text-transform: uppercase;">APPUNTAMENTI</span>
                    <span id="stat-count-events" class="stat-loading" style="font-size: 1.25rem; font-weight: 800; color: #10b981; line-height: 1;">...</span>
                </div>
            `;
        }
        
        const filtered = pmProjects.filter(p => {
            if (showAccount && p.isAccount) return true;
            if (showPm && p.isPM) return true;
            return false;
        });

        // Update stats in the bar
        const statProjects = document.getElementById('stat-count-projects');
        const statActivities = document.getElementById('stat-count-activities');
        const statTasks = document.getElementById('stat-count-tasks');
        const statEvents = document.getElementById('stat-count-events');
        
        // Sum up pre-calculated stats from individual projects
        let totalAct = 0;
        let totalTask = 0;
        let totalEvt = 0;
        
        filtered.forEach(p => {
            const s = p.stats || {};
            totalAct += (s.activities || 0);
            totalTask += (s.tasks || 0);
            totalEvt += (s.appointments || 0);
        });
        
        if (statProjects) statProjects.textContent = filtered.length;
        if (statActivities) statActivities.textContent = totalAct;
        if (statTasks) statTasks.textContent = totalTask;
        if (statEvents) statEvents.textContent = totalEvt;

        pmList.innerHTML = filtered.map((p, idx) => {
            const isMaintenance = p.status && p.status.toLowerCase().includes('manutenzione');
            const isPaused = p.status && (p.status.toLowerCase().includes('pausa') || p.status.toLowerCase().includes('hold'));
            
            return `
                <div onclick="window.location.hash = '#pm/commessa/${p.id}'" style="
                    background: rgba(255, 255, 255, 0.92); 
                    backdrop-filter: blur(28px) saturate(190%); 
                    -webkit-backdrop-filter: blur(28px) saturate(190%);
                    border: 1px solid rgba(255, 255, 255, 0.8); 
                    padding: 8px 12px; 
                    border-radius: 14px; 
                    cursor: pointer; 
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); 
                    position: relative;
                    margin-bottom: 2px;
                " onmouseover="this.style.background='#ffffff'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.06)'; this.style.borderColor='#ffffff'" onmouseout="this.style.background='rgba(255, 255, 255, 0.92)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.02)'; this.style.borderColor='rgba(255, 255, 255, 0.8)'">
                    <div style="display: flex; flex-direction: column; gap: 1px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; align-items: center; gap: 4px; min-width: 0;">
                                <span style="font-size: 0.62rem; color: #94a3b8; font-weight: 400; letter-spacing: -0.01em; flex-shrink: 0;">#${p.order_number || '---'}</span>
                                <div style="height: 8px; width: 1px; background: rgba(0,0,0,0.06); flex-shrink: 0;"></div>
                                <span style="font-size: 0.68rem; color: #64748b; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; letter-spacing: -0.01em;">${p.client || 'Gleeye'}</span>
                            </div>
                            <div style="display: flex; gap: 4px; flex-shrink: 0; margin-left: 8px; align-items: center;">
                                ${isMaintenance ? `<span class="material-icons-round" style="font-size: 0.7rem; color: #94a3b8;" title="Manutenzione">settings</span>` : 
                                  (isPaused ? `<span class="material-icons-round" style="font-size: 0.7rem; color: #94a3b8;" title="In Pausa">pause_circle</span>` : 
                                   `<span class="material-icons-round" style="font-size: 0.7rem; color: #94a3b8;" title="In Svolgimento">play_circle</span>`)}
                                
                                <div style="width: 2px;"></div>
                                
                                ${p.isAccount ? `<div title="Account" style="width: 13px; height: 13px; background: transparent; color: #3b82f6; border: 1.25px solid #3b82f630; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 900;">A</div>` : ''}
                                ${p.isPM ? `<div title="Project Manager" style="width: 13px; height: 13px; background: transparent; color: #8b5cf6; border: 1.25px solid #8b5cf630; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 900;">P</div>` : ''}
                            </div>
                        </div>
                        <div style="font-weight: 600; font-size: 0.78rem; color: #1e293b; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; letter-spacing: -0.01em; margin-bottom: 1px;">${p.title}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    _internalRender();
    
    // External hook for filter update
    window._hpCurrentProjectsRenderer = _internalRender; 
}

window.togglePmFilter = (type) => {
    if (!window.hpActiveFilters) window.hpActiveFilters = { account: true, pm: true };
    window.hpActiveFilters[type] = !window.hpActiveFilters[type];
    
    const btnAccount = document.getElementById('hp-filter-account');
    const btnPm = document.getElementById('hp-filter-pm');
    
    // Update visual states
    if (btnAccount) {
        btnAccount.style.background = window.hpActiveFilters.account ? '#fff' : 'transparent';
        btnAccount.style.boxShadow = window.hpActiveFilters.account ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        btnAccount.style.color = window.hpActiveFilters.account ? '#1e293b' : '#94a3b8';
    }
    if (btnPm) {
        btnPm.style.background = window.hpActiveFilters.pm ? '#fff' : 'transparent';
        btnPm.style.boxShadow = window.hpActiveFilters.pm ? '0 2px 6px rgba(0,0,0,0.06)' : 'none';
        btnPm.style.color = window.hpActiveFilters.pm ? '#1e293b' : '#94a3b8';
    }

    if (window._hpCurrentProjectsRenderer) window._hpCurrentProjectsRenderer();
};

// --- WEEKLY RENDER LOGIC ---

function renderWeeklyTimeline(container, events, startDate, rules, googleBusy, overrides) {
    container.innerHTML = '';
    const startOfWeek = new Date(startDate); // Should be Monday

    // Layout: Time Column + 7 Days
    // Grid: [Time 50px] [Day 1fr] ... [Day 1fr]

    // 1. Header Row (Day Names)
    const headerRow = document.createElement('div');
    headerRow.style.display = 'grid';
    headerRow.style.gridTemplateColumns = '50px repeat(7, 1fr)';
    headerRow.style.gap = '8px';
    headerRow.style.padding = '1rem 1rem 0 1rem';
    headerRow.style.marginBottom = '1rem';
    headerRow.style.position = 'sticky';
    headerRow.style.top = '0';
    headerRow.style.zIndex = '10';
    headerRow.style.background = 'white'; // Cover content when scrolling

    // Spacer for time column
    headerRow.innerHTML = `<div></div>`;

    const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const todayStr = new Date().toDateString();

    for (let i = 0; i < 7; i++) {
        const currentD = new Date(startOfWeek);
        currentD.setDate(startOfWeek.getDate() + i);
        const isToday = currentD.toDateString() === todayStr;

        const colHeader = document.createElement('div');
        colHeader.style.textAlign = 'center';

        // Pill Header
        colHeader.innerHTML = `
            <div style="
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                background: ${isToday ? '#1e293b' : 'transparent'};
                color: ${isToday ? 'white' : '#64748b'};
                padding: 6px; border-radius: 12px;
                box-shadow: ${isToday ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'};
            ">
                <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">${dayNames[i]}</div>
                <div style="font-size:1.1rem; font-weight:700;">${currentD.getDate()}</div>
            </div>
        `;
        headerRow.appendChild(colHeader);
    }
    container.appendChild(headerRow);

    // 2. Main Grid (Scrollable)
    const gridBody = document.createElement('div');
    gridBody.style.display = 'grid';
    gridBody.style.gridTemplateColumns = '50px repeat(7, 1fr)';
    gridBody.style.position = 'relative';
    gridBody.style.padding = '0 1rem 2rem 1rem';
    gridBody.style.height = '500px';
    gridBody.style.overflowY = 'auto';
    gridBody.style.background = 'white';
    gridBody.style.borderRadius = '0 0 16px 16px';
    gridBody.style.paddingBottom = '250px'; // Significantly deeper buffer

    // Ensure the content inside pushes boundaries
    const pxPerHour = 60;
    const totalHeight = (24 * pxPerHour) + 50; // Add specific buffer to columns too

    // Time Labels Column
    const timeCol = document.createElement('div');
    timeCol.style.position = 'relative';
    timeCol.style.height = `${totalHeight}px`;
    timeCol.style.borderRight = '1px solid #f1f5f9';

    for (let h = 0; h < 24; h++) {
        const label = document.createElement('div');
        label.innerText = `${h.toString().padStart(2, '0')}:00`;
        label.style.position = 'absolute';
        label.style.top = `${h * pxPerHour}px`;
        label.style.fontSize = '0.7rem';
        label.style.color = '#94a3b8';
        label.style.transform = 'translateY(-50%)';
        label.style.width = '100%';
        label.style.textAlign = 'right';
        label.style.paddingRight = '8px';
        timeCol.appendChild(label);
    }
    gridBody.appendChild(timeCol);

    // Day Columns
    for (let i = 0; i < 7; i++) {
        const currentD = new Date(startOfWeek);
        currentD.setDate(startOfWeek.getDate() + i);

        const dayCol = document.createElement('div');
        dayCol.style.position = 'relative';
        dayCol.style.height = `${totalHeight}px`;
        dayCol.style.borderRight = (i < 6) ? '1px dashed #f1f5f9' : 'none';
        dayCol.style.background = '#f8fafc'; // DEFAULT CLOSED (Gray)

        // 1. RENDER AVAILABILITY (WHITE BLOCKS)
        const dayId = currentD.getDay();
        const dailyRules = (rules || []).filter(r => r.day_of_week === dayId);

        dailyRules.forEach(r => {
            if (!r.start_time || !r.end_time) return;
            const [sh, sm] = r.start_time.split(':').map(Number);
            const [eh, em] = r.end_time.split(':').map(Number);
            const sM = (sh * 60) + sm;
            const eM = (eh * 60) + em;

            const slotEl = document.createElement('div');
            slotEl.style.position = 'absolute';
            slotEl.style.top = `${(sM / 60) * pxPerHour}px`;
            slotEl.style.height = `${((eM - sM) / 60) * pxPerHour}px`;
            slotEl.style.left = '0'; slotEl.style.right = '0';
            slotEl.style.background = 'white';
            slotEl.style.zIndex = '0';
            dayCol.appendChild(slotEl);
        });

        // Background Grid Lines
        for (let h = 1; h < 24; h++) {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = `${h * pxPerHour}px`;
            line.style.left = '0'; line.style.right = '0';
            line.style.height = '1px';
            line.style.background = '#f1f5f9';
            line.style.zIndex = '1';
            dayCol.appendChild(line);
        }

        // 2. RENDER EVENTS - COLUMN PACKING (Google Calendar Style)

        // Define day range for filtering
        const dayStart = new Date(currentD); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentD); dayEnd.setHours(23, 59, 59, 999);

        // Group overlapping events
        const sortedEvents = (events || [])
            .filter(ev => {
                const evStart = new Date(ev.start);
                const evEnd = new Date(ev.end);
                return (evStart < dayEnd && evEnd > dayStart);
            })
            .map(ev => ({
                ...ev,
                _start: new Date(ev.start).getTime(),
                _end: new Date(ev.end).getTime()
            }))
            .sort((a, b) => {
                if (a._start !== b._start) return a._start - b._start;
                return b._end - a._end; // Longer first
            });

        const clusters = [];
        let currentCluster = [];
        let clusterEnd = 0;

        sortedEvents.forEach(ev => {
            if (currentCluster.length === 0) {
                currentCluster.push(ev);
                clusterEnd = ev._end;
            } else {
                if (ev._start < clusterEnd) {
                    currentCluster.push(ev);
                    clusterEnd = Math.max(clusterEnd, ev._end);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [ev];
                    clusterEnd = ev._end;
                }
            }
        });
        if (currentCluster.length > 0) clusters.push(currentCluster);

        // Process clusters
        clusters.forEach(cluster => {
            const columns = [];
            cluster.forEach(ev => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    const col = columns[i];
                    const last = col[col.length - 1];
                    if (ev._start >= last._end) {
                        col.push(ev);
                        placed = true;
                        break;
                    }
                }
                if (!placed) columns.push([ev]);
            });

            const widthPercent = 100 / columns.length;

            columns.forEach((col, colIndex) => {
                col.forEach(ev => {
                    const evStart = new Date(ev.start);
                    const evEnd = new Date(ev.end);

                    // Calculate Top & Height
                    let startMins = evStart.getHours() * 60 + evStart.getMinutes();
                    let endMins = evEnd.getHours() * 60 + evEnd.getMinutes();

                    if (evStart < dayStart) startMins = 0;
                    if (evEnd > dayEnd) endMins = 1440;

                    const top = (startMins / 60) * pxPerHour;
                    const height = Math.max(((endMins - startMins) / 60) * pxPerHour, 20);

                    // Render Card
                    const el = document.createElement('div');
                    el.className = 'timeline-event-card';

                    let bgColor = '#60a5fa';
                    let glowColor = '#3b82f6';

                    if (ev.type === 'appointment') {
                        bgColor = '#c084fc';
                        glowColor = '#a855f7';
                    } else if (ev.type === 'booking') {
                        bgColor = '#60a5fa';
                        glowColor = '#3b82f6';
                    } else if (ev.title && ev.title.toLowerCase().includes('google')) {
                        bgColor = '#fcd34d';
                        glowColor = '#f59e0b';
                    }

                    el.style.cssText = `
                         position: absolute;
                         top: ${top}px;
                         left: calc(${colIndex * widthPercent}% + 2px); 
                         width: calc(${widthPercent}% - 4px);
                         height: ${height}px;
                         background: linear-gradient(135deg, ${bgColor} 0%, ${glowColor} 100%);
                         border-radius: 8px;
                         padding: 4px 6px;
                         color: white;
                         font-size: 0.75rem;
                         overflow: hidden;
                         box-shadow: 0 2px 8px ${glowColor}40;
                         cursor: pointer;
                         z-index: 5;
                         transition: transform 0.2s, z-index 0s;
                         display: flex; flex-direction: column; justify-content: start;
                     `;

                    el.innerHTML = `
                         <div style="font-weight:700; line-height:1.1; margin-bottom:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.75rem;">${ev.title}</div>
                         ${widthPercent > 30 ? `<div style="opacity:0.9; font-size:0.65rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.client || ''}</div>` : ''}
                     `;

                    // Hover Logic for Expanding Z-Index
                    el.onmouseenter = function () {
                        this.style.zIndex = '50';
                        this.style.minWidth = '140px'; // Expand if too small? Na, just tooltip
                        // If width is tiny, maybe expand? no just tooltip is safer.

                        const tooltip = document.createElement('div');
                        tooltip.id = 'timeline-custom-tooltip';
                        tooltip.style.cssText = `
                             position: fixed; z-index: 9999; background: rgba(255,255,255,0.98); color: #1e293b;
                             padding: 8px 12px; border-radius: 8px; font-size: 0.85rem;
                             box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); pointer-events: none;
                             backdrop-filter: blur(4px); border: 1px solid #e2e8f0; max-width: 250px;
                         `;
                        tooltip.innerHTML = `
                             <div style="font-weight: 600; margin-bottom: 2px;">${ev.title}</div>
                             <div style="font-size: 0.75rem; color: #64748b;">${ev.client || ''}</div>
                             <div style="font-size: 0.7rem; color: #94a3b8; margin-top:4px;">${evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                         `;
                        document.body.appendChild(tooltip);
                        const rect = this.getBoundingClientRect();
                        tooltip.style.top = `${rect.bottom + 8}px`;
                        tooltip.style.left = `${rect.left}px`;
                    };

                    el.onmouseleave = function () {
                        this.style.zIndex = '5';
                        this.style.minWidth = '';
                        const t = document.getElementById('timeline-custom-tooltip');
                        if (t) t.remove();
                    };

                    const evtId = `evt_hp_w_${ev.id.replace(/-/g, '_')}`;
                    window[evtId] = ev;
                    el.setAttribute('onclick', `openHomepageEventDetails(window['${evtId}'])`);

                    dayCol.appendChild(el);
                });
            });
        });

        // Availability / Busy Areas?
        // For V1, keep it clean. Maybe shade overrides.

        gridBody.appendChild(dayCol);
    }

    container.appendChild(gridBody);

    // 3. AUTO-SCROLL TO NOW
    const now = new Date();
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    if (now >= startOfWeek && now <= endOfWeek) {
        const nowHour = now.getHours();
        const scrollPos = Math.max(0, (nowHour * pxPerHour) - 150);
        setTimeout(() => {
            gridBody.scrollTo({ top: scrollPos, behavior: 'smooth' });
        }, 500);
    }
}

// --- MAIN RENDER LOGIC ---

function renderMobileAgenda(container, events, date, rules) {
    container.innerHTML = '';

    const agendaContainer = document.createElement('div');
    agendaContainer.className = 'mobile-agenda-list';

    if (!events || events.length === 0) {
        agendaContainer.innerHTML = `
            <div class="empty-agenda">
                <span class="material-icons-round">bedtime</span>
                <p>Nessun impegno programmato per oggi</p>
            </div>
        `;
        container.appendChild(agendaContainer);
        return;
    }

    events.forEach(ev => {
        const card = document.createElement('div');
        card.className = `agenda-mobile-card ${ev.type}`;

        const startTime = ev.start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const endTime = ev.end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        card.innerHTML = `
            <div class="agenda-time">
                <span class="start">${startTime}</span>
                <span class="end">${endTime}</span>
            </div>
            <div class="agenda-content">
                <div class="agenda-header">
                    <span class="type-badge">${ev.type === 'booking' ? 'Prenotazione' : 'Appuntamento'}</span>
                    ${ev.client ? `<span class="client-name">${ev.client}</span>` : ''}
                </div>
                <h4 class="agenda-title">${ev.title}</h4>
                ${ev.location ? `<div class="agenda-meta"><span class="material-icons-round">place</span> ${ev.location}</div>` : ''}
            </div>
            <span class="material-icons-round arrow">chevron_right</span>
        `;

        card.onclick = () => {
            if (ev.type === 'appointment') openAppointmentDrawer(ev.id);
            else if (ev.type === 'booking') { /* Handle booking detail? */ }
        };

        agendaContainer.appendChild(card);
    });

    container.appendChild(agendaContainer);
}

function renderTimeline(container, events, date = new Date(), availabilityRules = [], googleBusy = [], overrides = []) {
    // 1. Range Config: Full Day 00:00 - 24:00 (user request)
    const startHour = 0;
    const endHour = 24;
    const isToday = new Date().toDateString() === date.toDateString();

    // 2. Prepare Data
    const eventsSafe = events || [];

    // 3. Layout Constants
    // We want the whole day to be scrollable but clearly readable.
    // 00-06 is night (condensed?), 07-20 work (expanded?), 21-23 night.
    // For simplicity, consistent width.
    const colWidth = 100; // px per hour
    const totalWidth = (endHour - startHour) * colWidth;
    const pixelsPerMinute = colWidth / 60;
    const viewStartM = startHour * 60;

    // 4. Generate Track (Light Modern Background)
    let html = '';
    for (let h = startHour; h < endHour; h++) {
        html += `
            <div class="timeline-hour-col" data-hour="${h}" style="
                width: ${colWidth}px;
                min-width: ${colWidth}px;
                border-left: 1px solid var(--glass-border);
                position: relative;
            ">
                <div class="timeline-hour-label" style="
                    position: absolute;
                    top: 12px;
                    left: 12px;
                    font-size: 0.85rem;
                    color: var(--text-tertiary);
                    font-weight: 600;
                    font-family: var(--font-titles);
                ">${h}.00</div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="timeline-track" style="
            display: flex;
            position: relative;
            width: ${totalWidth}px;
            min-width: ${totalWidth}px;
            padding-left: 0;
            background: white;
            height: 100%;
        ">
            ${html}
        </div>
    `;
    const track = container.querySelector('.timeline-track');

    // OVERLAY Container for all Blocks
    const overlay = document.createElement('div');
    overlay.className = 'timeline-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.height = '100%';
    overlay.style.width = '100%';
    overlay.style.pointerEvents = 'none';

    // A. RENDER AVAILABILITY (Purple Line at TOP)
    // Rules + Overrides (Extra specific slots for this date)

    // Merge Rules and Overrides into a "Open Slots" list
    let openSlots = [];

    // 1. Weekly Rules
    availabilityRules.forEach(r => {
        if (!r.start_time || !r.end_time) return;
        const [sh, sm] = r.start_time.split(':').map(Number);
        const [eh, em] = r.end_time.split(':').map(Number);
        const sM = (sh * 60) + sm;
        const eM = (eh * 60) + em;
        openSlots.push({ start: sM, end: eM, source: 'rule' });
    });

    // 2. Extra Overrides (Specific Date)
    overrides.forEach(o => {
        if (new Date(o.date).toDateString() !== date.toDateString()) return;
        const [sh, sm] = o.start_time.split(':').map(Number);
        const [eh, em] = o.end_time.split(':').map(Number);
        const sM = (sh * 60) + sm;
        const eM = (eh * 60) + em;
        openSlots.push({ start: sM, end: eM, source: 'override' });
    });

    // 2b. MASK with Google Busy (User request: "lascialo bianco... se su calendar è occupato")
    // This means we remove the "Available" line where Google says it's busy.
    // We do NOT draw gray blocks.

    // Simplify algorithm: We subtract Google Busy intervals from Open Slots.
    let finalSlots = [];

    openSlots.forEach(slot => {
        let pieces = [slot]; // Start with the full slot

        googleBusy.forEach(busy => {
            const startD = new Date(busy.start);
            const endD = new Date(busy.end);

            // Normalize busy time to minutes of current view day
            const viewStartD = new Date(date).setHours(0, 0, 0, 0);
            const viewEndD = new Date(date).setHours(23, 59, 59, 999);

            const bStartMs = Math.max(startD.getTime(), viewStartD);
            const bEndMs = Math.min(endD.getTime(), viewEndD);

            if (bEndMs <= bStartMs) return; // Busy slot not in today

            const bStart = (bStartMs - viewStartD) / 60000;
            const bEnd = (bEndMs - viewStartD) / 60000;

            // Subtract [bStart, bEnd] from current pieces
            let newPieces = [];
            pieces.forEach(p => {
                // No overlap
                if (bEnd <= p.start || bStart >= p.end) {
                    newPieces.push(p);
                    return;
                }

                // Overlap: Split
                if (p.start < bStart) {
                    newPieces.push({ start: p.start, end: bStart });
                }
                if (p.end > bEnd) {
                    newPieces.push({ start: bEnd, end: p.end });
                }
            });
            pieces = newPieces;
        });

        finalSlots.push(...pieces);
    });

    // Render Final Open Slots (Top Purple Line)
    finalSlots.forEach(slot => {
        if (slot.start >= slot.end) return;

        const left = slot.start * pixelsPerMinute;
        const width = (slot.end - slot.start) * pixelsPerMinute;

        // "Magari metterla in alto" + "Più leggera"
        const line = document.createElement('div');
        line.title = "Disponibile";
        line.style.position = 'absolute';
        line.style.left = `${left}px`;
        line.style.width = `${width}px`;
        line.style.top = '0'; // Top
        line.style.height = '3px'; // Thinner
        line.style.background = '#d8b4fe'; // Lighter Purple (Tailwind purple-300)
        line.style.zIndex = '5';
        line.style.borderRadius = '0 0 2px 2px';
        line.style.opacity = '0.8';
        overlay.appendChild(line);
    });

    // B. GOOGLE BUSY -> REMOVED VISUALS (User request: "lascialo in bianco")

    // C. INTERNAL EVENTS (Colorful Cards) - PACKING ALGORITHM
    // 1. Convert to simple objects with M and sort
    const rawEvents = eventsSafe.map(ev => ({
        ...ev,
        _start: (ev.start.getHours() * 60) + ev.start.getMinutes(),
        _end: (ev.end.getHours() * 60) + ev.end.getMinutes(),
        durationM: (ev.end - ev.start) / (1000 * 60)
    })).sort((a, b) => {
        if (a._start !== b._start) return a._start - b._start;
        return b._end - a._end; // Longer first
    });

    // 2. Cluster Overlapping Events
    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    rawEvents.forEach(ev => {
        if (currentCluster.length === 0) {
            currentCluster.push(ev);
            clusterEnd = ev._end;
        } else {
            if (ev._start < clusterEnd) {
                currentCluster.push(ev);
                clusterEnd = Math.max(clusterEnd, ev._end);
            } else {
                clusters.push(currentCluster);
                currentCluster = [ev];
                clusterEnd = ev._end;
            }
        }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // 3. Process Clusters and Render
    clusters.forEach(cluster => {
        const columns = []; // Array of arrays of events
        cluster.forEach(ev => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const last = col[col.length - 1];
                if (ev._start >= last._end) {
                    col.push(ev);
                    placed = true;
                    break;
                }
            }
            if (!placed) columns.push([ev]);
        });

        // The "height" of the row row is now shared.
        // Wait, for horizontal timeline, "stacking" means vertical space sharing.
        // But the previous request asked for "side-by-side" like Google. 
        // In a horizontal timeline, "side-by-side" means vertical stacking (rows) to avoid overlap.
        // Google Horizontal: Events stack vertically.
        // Google Vertical (Weekly): Events stack horizontally (columns).

        // This is the DAILY view (Horizontal Timeline). 
        // Overlap must be handled by stacking vertically (rows).

        // REVERT TO VERTICAL STACKING -- BUT OPTIMIZED
        // My previous logic was pure Row Packing (Correct for Gantt/Horizontal).
        // The User said "Error Loading". 
        // Maybe the error wasn't the logic but something else?
        // Let's re-implement the Row Packing robustly.

        // Actually, let's use the columns logic but map it to 'top' and 'height'.
        // In horizontal view:
        // X-axis = Time
        // Y-axis = Concurrent Events

        // If we have 3 concurrent events, we need 3 "rows" at that time.
        // Calculated total height? Or fixed height cards with dynamic top?

        // Let's use the computed columns as "rows" for the horizontal view.
        // columns.length = number of concurrent rows needed in this cluster.

        columns.forEach((col, colIndex) => {
            col.forEach(ev => {
                const left = ev._start * pixelsPerMinute;
                const width = ev.durationM * pixelsPerMinute;

                // Vertical Position
                // Base Top = 50px.
                // Each "Row" (colIndex) adds height. 
                // Card Height = 46px. Gap = 4px. Total = 50px.
                const rowHeight = 50;
                const top = 50 + (colIndex * rowHeight);

                const el = document.createElement('div');
                el.className = `timeline-event-card ${ev.end < new Date() ? 'past' : ''}`;
                el.style.left = `${left}px`;
                el.style.width = `${Math.max(width - 2, 4)}px`;
                el.style.zIndex = '30';
                el.style.pointerEvents = 'auto';

                // Custom Color Logic
                let bgColor = '#3b82f6';
                let glowColor = '#3b82f6';

                if (ev.type === 'appointment') {
                    bgColor = '#c084fc';
                    glowColor = '#a855f7';
                } else if (ev.type === 'booking') {
                    bgColor = '#60a5fa';
                    glowColor = '#3b82f6';
                }

                el.style.background = `linear-gradient(135deg, ${bgColor} 0%, ${glowColor} 100%)`;
                el.style.boxShadow = `0 4px 15px ${glowColor}60, inset 0 1px 1px rgba(255,255,255,0.3)`;
                el.style.borderRadius = '12px';
                el.style.border = 'none';
                el.style.cursor = 'pointer';
                el.style.color = 'white';
                el.style.position = 'absolute';
                el.style.top = `${top}px`;
                el.style.height = '46px';
                el.style.padding = '0 10px';
                el.style.display = 'flex';
                el.style.flexDirection = 'column';
                el.style.justifyContent = 'center';

                // INTERACTION
                const evtId = `evt_hp_${ev.id.replace(/-/g, '_')}`;
                window[evtId] = ev;
                el.setAttribute('onclick', `openHomepageEventDetails(window['${evtId}'])`);

                // CUSTOM TOOLTIP LOGIC
                el.onmouseenter = function (e) {
                    this.style.zIndex = '100'; // Bring to very front
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = `0 8px 20px ${bgColor}60`;

                    const tooltip = document.createElement('div');
                    tooltip.id = 'timeline-custom-tooltip';
                    tooltip.style.position = 'fixed';
                    tooltip.style.zIndex = '9999';
                    tooltip.style.background = 'rgba(255, 255, 255, 0.98)';
                    tooltip.style.color = '#1e293b';
                    tooltip.style.padding = '8px 12px';
                    tooltip.style.borderRadius = '8px';
                    tooltip.style.fontSize = '0.85rem';
                    tooltip.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
                    tooltip.style.pointerEvents = 'none';
                    tooltip.style.backdropFilter = 'blur(4px)';
                    tooltip.style.border = '1px solid #e2e8f0';
                    tooltip.style.maxWidth = '250px';

                    tooltip.innerHTML = `
                        <div style="font-weight: 600; margin-bottom: 2px;">${ev.title}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${ev.client || ''}</div>
                        <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">
                           ${ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    `;

                    document.body.appendChild(tooltip);

                    const rect = this.getBoundingClientRect();
                    tooltip.style.top = `${rect.bottom + 8}px`;
                    tooltip.style.left = `${rect.left}px`;
                };

                el.onmouseleave = function () {
                    this.style.zIndex = '30';
                    this.style.transform = 'none';
                    this.style.boxShadow = `0 4px 12px ${bgColor}40`;
                    const tooltip = document.getElementById('timeline-custom-tooltip');
                    if (tooltip) tooltip.remove();
                };

                // CONTENT
                let htmlContent = `<div style="font-weight: 700; margin-bottom: 0px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.85rem; line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${ev.title}</div>`;
                if (width > 60) {
                    htmlContent += `<div style="font-size: 0.75rem; font-weight: 500; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ev.client || ''}</div>`;
                }
                el.innerHTML = htmlContent;

                overlay.appendChild(el);
            });
        });
    });

    // D. "NOW" LINE
    let scrollTargetLeft = 0;
    if (isToday) {
        const now = new Date();
        const currentM = (now.getHours() * 60) + now.getMinutes();
        const left = currentM * pixelsPerMinute;

        // "Now" Pill + Dashed Line
        const nowLine = document.createElement('div');
        nowLine.className = 'timeline-now-line';
        nowLine.style.position = 'absolute';
        nowLine.style.left = `${left}px`;
        nowLine.style.top = '0';
        nowLine.style.height = '100%';
        nowLine.style.width = '0';
        nowLine.style.borderLeft = '2px dashed #06b6d4'; // Cyan Dashed
        nowLine.style.zIndex = '50';
        nowLine.style.pointerEvents = 'none';

        // Time Pill at Top
        const timePill = document.createElement('div');
        timePill.style.position = 'absolute';
        timePill.style.top = '10px';
        timePill.style.left = '-26px'; // Center pill (approx width 52px)
        timePill.style.background = '#06b6d4'; // Cyan
        timePill.style.color = 'white';
        timePill.style.padding = '2px 8px';
        timePill.style.borderRadius = '12px';
        timePill.style.fontWeight = '700';
        timePill.style.fontSize = '0.75rem';
        timePill.style.boxShadow = '0 2px 8px rgba(6, 182, 212, 0.4)';
        timePill.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        nowLine.appendChild(timePill);

        overlay.appendChild(nowLine);

        // Auto Scroll to Now - Center
        scrollTargetLeft = Math.max(0, left - (container.clientWidth / 2));
    } else {
        // If tomorrow, scroll to first event or 08:00
        const firstEventM = openSlots.length > 0 ? openSlots[0].start : 8 * 60;
        scrollTargetLeft = Math.max(0, (firstEventM * pixelsPerMinute) - 100);
    }

    track.appendChild(overlay);

    setTimeout(() => {
        container.scrollTo({
            left: scrollTargetLeft,
            behavior: 'smooth'
        });
    }, 100);
}

// --- EVENT DETAIL MODAL (Now unified via agenda_utils.js) ---
import { openEventDetails } from './agenda_utils.js?v=8000';

window.openHomepageEventDetails = openEventDetails; // Compatibility Alias

window.closeHomepageEventModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.remove();
};

// Helper for Filter Switching
window.setHpFilter = function (filter, btn) {
    if (!btn) return;
    window.hpActivityFilter = filter;

    // Update UI buttons
    const container = btn.closest('.hp-v6-controls');
    if (container) {
        container.querySelectorAll('.hp-v6-pill').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    // Update Footer Button and Filter visibility based on tab
    const footerBtn = document.getElementById('hp-footer-action-btn');
    const overdueFilter = document.getElementById('hp-overdue-filter');

    if (footerBtn) {
        if (filter === 'task') {
            footerBtn.innerText = 'Lista task';
            footerBtn.onclick = () => window.location.hash = '#tasks-summary';
            if (overdueFilter) overdueFilter.style.display = 'flex';
        } else if (filter === 'event') {
            footerBtn.innerText = 'Vedi Agenda';
            footerBtn.onclick = () => window.location.hash = '#agenda';
            if (overdueFilter) overdueFilter.style.display = 'none';
        } else {
            footerBtn.innerText = 'Vedi Attività';
            footerBtn.onclick = () => window.location.hash = '#assignments';
            if (overdueFilter) overdueFilter.style.display = 'none';
        }
    }

    // Re-render using the FILTERED tasks (date-filtered), not the full list
    if (window.hpData) {
        const tasksToUse = window.hpData.filteredTasks || window.hpData.tasks;
        renderMyActivities(document.getElementById('hp-activities-list'), window.hpData.timers, tasksToUse, window.hpData.events, filter);
    }
};

function renderMyActivities(container, timers, tasks, events, filter = 'task') {
    if (!container) return;
    container.innerHTML = '';
    let hasContent = false;
    
    // 1. Timers (Prioritized)
    const safeTimers = timers || [];
    if (safeTimers.length > 0) {
        safeTimers.forEach(t => {
            hasContent = true;
            renderActivityRow(container, { ...t, isTimer: true });
        });
    }

    // 2. Filtered Content
    if (filter === 'task') {
        const safeTasks = tasks || [];
        if (safeTasks.length > 0) {
            safeTasks.forEach(t => {
                hasContent = true;
                renderActivityRow(container, t);
            });
        }
    } else {
        const safeEvents = events || [];
        if (safeEvents.length > 0) {
            safeEvents.forEach(e => {
                hasContent = true;
                renderActivityRow(container, { ...e, isEvent: true, type: 'event' });
            });
        }
    }

    if (!hasContent) {
        container.innerHTML = `<div style="padding: 2.5rem 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem; font-weight: 500;">Nessuna attività programmata</div>`;
    }
}

// Helper to render an activity row (tasks/events/timers) - ZERO INVASIVITY VERSION
function renderActivityRow(container, t) {
    let contextHeader = '';
    let spaceId = null;
    
    // Extract info from mapped object
    const tags = window.normalizedTagsForHtml || [];
    const isPrivileged = tags.includes('partner') || tags.includes('socio') || 
                        tags.includes('amministrazione') || tags.includes('account') || 
                        tags.includes('project manager') || tags.includes('pm') || tags.includes('backoffice');

    const ord = t.orders || {};
    const ordNum = ord.order_number || '';
    const clientCode = ord.clients?.client_code || '';
    const itemId = t.id ? t.id.split('-')[0].toUpperCase() : '';

    if (t.isEvent) {
        // Appointments Logic: "APPUNT. ClientCode"
        contextHeader = `APPUNT.${clientCode ? ` • ${clientCode}` : ''}`;
        if (!clientCode && t.location) contextHeader += ` • ${t.location}`;
    } else {
        // Tasks Logic: Role-Based Display
        if (isPrivileged) {
            contextHeader = ordNum ? `#${ordNum}${clientCode ? ` • ${clientCode}` : ''}` : (t.breadcrumb || 'PROGETTO INTERNO');
        } else {
            contextHeader = `#${itemId}${clientCode ? ` • ${clientCode}` : ''}`;
        }
    }

    const row = document.createElement('div');
    row.onclick = () => {
        if (t.isEvent) return; 
        openPmItemDetails(t.id, spaceId || '');
    };
    
    row.style.cssText = `
        padding: 0.8rem 0; 
        border-bottom: 1px solid #f1f5f9; 
        display: flex; 
        gap: 0.75rem; 
        align-items: center; 
        cursor: pointer; 
        transition: all 0.2s;
        background: transparent;
    `;
    row.onmouseover = () => { row.style.background = 'rgba(255,255,255,0.08)'; };
    row.onmouseout = () => { row.style.background = 'transparent'; };
    
    let dateStr = '';
    if (t.due_date) {
        const d = new Date(t.due_date);
        dateStr = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
        const todayStr = new Date().toISOString().split('T')[0];
        if (t.due_date < todayStr) dateStr = '<span style="color: #ef4444; font-weight: 700;">! SCADUTO</span>';
    } else if (t.isEvent && t.start) {
        const dStart = new Date(t.start);
        const dEnd = t.end ? new Date(t.end) : null;
        const startT = dStart.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const endT = dEnd ? dEnd.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
        dateStr = `<span style="display: flex; align-items: center; gap: 4px; color: #8b5cf6; font-weight: 600;">
            <span class="material-icons-round" style="font-size: 14px; opacity: 0.8;">schedule</span> 
            ${startT}${endT ? ` — ${endT}` : ''}
        </span>`;
    }

    row.innerHTML = `
        <div style="flex: 1; min-width: 0;">
            <!-- ROW 1: Context (Order + Short Client or Appuntamento) -->
            <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
                ${contextHeader}
            </div>
            
            <!-- ROW 2: Title -->
            <div style="font-weight: 600; font-size: 0.9rem; color: inherit; line-height: 1.25; margin-bottom: 2px;">
                ${t.title}
            </div>
            
            <!-- ROW 3: Secondary Info (Activity Path or Time Range) -->
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 400; display: flex; align-items: center; gap: 4px;">
                ${t.isEvent ? dateStr : `${t.breadcrumb || 'Attività'}${dateStr ? ` <span style="color: #cbd5e1; margin: 0 2px;">•</span> ${dateStr}` : ''}`}
            </div>
        </div>

        ${!t.isTimer && !t.isEvent ? `
            <div style="flex-shrink: 0; padding-left: 10px;">
                <div class="hp-status-toggle" 
                     onclick="event.stopPropagation(); window.quickCompleteTask('${t.id}', this)" 
                     style="width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 6px; cursor: pointer; transition: all 0.3s; background: white;">
                </div>
            </div>
        ` : ''}
    `;
    container.appendChild(row);
}

// Helper for Task Completion
window.quickCompleteTask = async function (id, element) {
    const row = element.closest('.activity-row') || element.closest('.v-agenda-card');
    const container = row?.parentElement;
    if (row) row.style.opacity = '0.4';

    try {
        await updatePMItem(id, { status: 'done' });
        
        // Notify other modules and the dashboard refresher
        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { itemId: id, action: 'update' } }));

        // Update local data to keep consistency if filters change
        if (window.hpData && window.hpData.tasks) {
            window.hpData.tasks = window.hpData.tasks.filter(t => t.id !== id);
            if (window.hpData.filteredTasks) {
                window.hpData.filteredTasks = window.hpData.filteredTasks.filter(t => t.id !== id);
            }
        }

        if (row) {
            row.style.transform = 'translateX(10px)';
            row.style.opacity = '0';

            // Instantly update the counter in the tab (sidebar)
            const card = row.closest('.glass-card');
            if (card) {
                const tabs = card.querySelectorAll('.hp-v6-pill');
                if (tabs.length > 0) {
                    const countEl = tabs[0].querySelector('.tab-count');
                    if (countEl) {
                        const current = parseInt(countEl.textContent) || 0;
                        countEl.textContent = Math.max(0, current - 1);
                    }
                }
            }

            setTimeout(() => {
                row.remove();
                if (container && container.children.length === 0 && container.classList.contains('hp-activities-list')) {
                    container.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun task da completare.</div>`;
                }
            }, 200);
        }
    } catch (e) {
        console.error("Task completion failed", e);
        if (row) {
             row.style.opacity = '1';
             row.style.transform = 'none';
        }
    }
}



function renderBottomActivities(container) {
    // We use data already fetched for the sidebar if available
    const timers = window.hpData?.timers || [];
    const activities = (window.hpData?.tasks || []).filter(item => {
        const type = (item.raw_type || '').toLowerCase();
        return type.includes('attivit') || type.includes('activity');
    });

    if (timers.length === 0 && activities.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.2; margin-bottom: 1rem;">history</span>
                <p>Nessuna attività recente registrata.</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Timers are currently not supported by the schema

    // Render PM Activities
    activities.forEach(t => {
        let fullTitle = 'Attività';
        let client = '';
        let spaceId = null;
        if (t.pm_spaces) {
            const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
            if (space) {
                spaceId = space.id;
                if (space.orders) {
                    const ord = Array.isArray(space.orders) ? space.orders[0] : space.orders;
                    if (ord) {
                        fullTitle = `#${ord.order_number} - ${ord.title}`;
                        client = ord.clients?.business_name || '';
                    }
                }
            }
        }
        html += `
            <div onclick="openPmItemDetails('${t.id}', '${spaceId || ''}')" style="background: var(--bg-card); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 12px; display: flex; align-items: center; margin-bottom: 0.5rem; cursor: pointer;">
                <div style="width: 44px; height: 44px; background: var(--bg-tertiary); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                    <span class="material-icons-round">assignment</span>
                </div>
                <div style="flex: 1; min-width: 0; margin: 0 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 2px;">${fullTitle}</div>
                    <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${t.title}</div>
                    ${client ? `<div style="font-size: 0.8rem; color: var(--text-tertiary);">${client}</div>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderBottomTasks(container, tasks) {
    if (!tasks || tasks.length === 0) {
        const kpiContainer = document.getElementById('hp-activities-bottom-kpis');
        if (kpiContainer) kpiContainer.innerHTML = '';
        container.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.1; margin-bottom: 1rem;">task_alt</span>
                <p style="font-size: 1.1rem; font-weight: 500;">Tutte le attività completate.</p>
            </div>
        `;
        return;
    }

    // Helper for toggling
    if (!window._hp_collapse_registered) {
        window.toggleActivityGroup = function (parentId, event) {
            event.stopPropagation();
            const btn = event.currentTarget;
            const children = document.querySelectorAll(`[data-parent="${parentId}"]`);
            const isCollapsing = Array.from(children).some(c => c.style.display !== 'none');
            children.forEach(c => {
                c.style.display = isCollapsing ? 'none' : 'grid';
                // Recursive collapse if children are also parents
                if (isCollapsing) {
                    const subId = c.getAttribute('data-id');
                    const subChildren = document.querySelectorAll(`[data-parent="${subId}"]`);
                    subChildren.forEach(sc => sc.style.display = 'none');
                    const subBtn = c.querySelector('.collapse-btn');
                    if (subBtn) subBtn.style.transform = 'rotate(-90deg)';
                }
            });
            btn.style.transform = isCollapsing ? 'rotate(-90deg)' : 'rotate(0deg)';
        };
        window._hp_collapse_registered = true;
    }

    // Calculate overall stats for KPIs correctly
    const activitiesCount = tasks.filter(t => t.is_activity && !t.is_sub_activity).length;
    const subActivitiesCount = tasks.filter(t => t.is_activity && t.is_sub_activity).length;
    const tasksCount = tasks.filter(t => !t.is_activity).length;
    const totalOverdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

    const kpiHtml = `
        <div class="widget-kpi-row">
            <div class="kpi-pill status-info">
                <span class="kpi-label">Attività</span>
                <span class="kpi-value">${activitiesCount}</span>
            </div>
            <div class="kpi-pill">
                <span class="kpi-label">Sotto-Attività</span>
                <span class="kpi-value">${subActivitiesCount}</span>
            </div>
            <div class="kpi-pill">
                <span class="kpi-label">Task</span>
                <span class="kpi-value">${tasksCount}</span>
            </div>
            ${totalOverdue > 0 ? `
                <div class="kpi-pill status-danger">
                    <span class="kpi-label">Scaduti</span>
                    <span class="kpi-value"><i class="material-icons-round">history</i> ${totalOverdue}</span>
                </div>
            ` : ''}
        </div>
    `;

    const kpiContainer = document.getElementById('hp-activities-bottom-kpis');
    if (kpiContainer) kpiContainer.innerHTML = kpiHtml;

    const listHtml = tasks.filter(t => t.is_activity).map((t) => {
        let statusColor = '#94a3b8';
        if (t.status === 'in_progress') statusColor = '#3b82f6';
        else if (t.status === 'review') statusColor = '#f59e0b';
        else if (t.status === 'blocked') statusColor = '#ef4444';

        const isOverdue = t.due_date && new Date(t.due_date) < new Date();
        const dateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
        const dueText = isOverdue ? `Scaduto: ${dateStr}` : (dateStr ? `Scadenza: ${dateStr}` : '');

        const orderCode = t.orders ? `#${t.orders.order_number}` : (t.area || '');
        const clientPart = t.orders?.clients?.client_code || t.orders?.clients?.business_name || '';

        const childActivities = tasks.filter(child => child.parent_id === t.id);
        const childCount = childActivities.length;
        const subOverdue = childActivities.filter(child => child.due_date && new Date(child.due_date) < new Date()).length;

        const hasChildren = childCount > 0;
        const rowClass = t.is_sub_activity ? 'activity-row sub-item' : 'activity-row is-parent';

        return `
            <div class="${rowClass}" 
                 data-id="${t.id}" 
                 data-parent="${t.parent_id || ''}" 
                 onclick="openPmItemDetails('${t.id}', null)">
                
                <div class="collapse-btn" onclick="window.toggleActivityGroup('${t.id}', event)" style="${!hasChildren ? 'opacity: 0; pointer-events: none;' : ''}">
                    <span class="material-icons-round" style="font-size: 18px;">expand_more</span>
                </div>

                <div class="row-main">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${(() => {
                const isPm = t.role === 'pm' || (t.role || '').toLowerCase().includes('manager');
                const roleIcon = isPm ? 'stars' : 'person_outline';
                const roleColor = isPm ? '#f59e0b' : '#94a3b8';
                const roleTitle = isPm ? 'Project Manager' : 'Assegnatario';
                return `<span class="material-icons-round" title="${roleTitle}" style="font-size: 16px; color: ${roleColor}">${roleIcon}</span>`;
            })()}
                        <div class="row-title">${t.title}</div>
                    </div>
                    <div class="row-meta">
                        <span class="row-context">${orderCode}</span>
                        ${clientPart ? `<span> ${clientPart}</span>` : ''}
                        ${t.breadcrumb ? `<span class="row-breadcrumb"> ${t.breadcrumb}</span>` : ''}
                        ${dueText ? `<span style="${isOverdue ? 'color: #ef4444; font-weight: 700;' : ''}"> ${dueText}</span>` : ''}
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    ${subOverdue > 0 ? `
                        <div title="Sotto-attività scadute" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: #fee2e2; color: #ef4444; border-radius: 6px; font-weight: 800; font-size: 0.65rem;">
                            <span class="material-icons-round" style="font-size: 11px;">history</span>
                            <span>${subOverdue}</span>
                        </div>
                    ` : ''}
                    ${childCount > 0 ? `
                        <div title="Sotto-attività" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: var(--bg-tertiary); color: var(--text-tertiary); border-radius: 6px; font-weight: 700; font-size: 0.65rem;">
                            <span class="material-icons-round" style="font-size: 11px;">list_alt</span>
                            <span>${childCount}</span>
                        </div>
                    ` : ''}
                    <span class="material-icons-round" style="color: #94a3b8; font-size: 16px; margin-left: 2px; transition: all 0.2s;" onmouseover="this.style.color='#8b5cf6'; this.style.transform='translateX(2px)'" onmouseout="this.style.color='#94a3b8'; this.style.transform='translateX(0)'">chevron_right</span>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = listHtml;
}

function renderDelegatedTasks(container, tasks) {
    if (!tasks || tasks.length === 0) {
        const kpiContainer = document.getElementById('hp-delegated-bottom-kpis');
        if (kpiContainer) kpiContainer.innerHTML = '';
        container.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.1; margin-bottom: 1rem;">assignment_turned_in</span>
                <p style="font-size: 1.1rem; font-weight: 500;">Nessuna delega attiva.</p>
            </div>
        `;
        return;
    }

    // Calculate KPIs
    const totalDelegated = tasks.length;
    const totalOverdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

    const kpiHtml = `
        <div class="widget-kpi-row">
            <div class="kpi-pill status-info">
                <span class="kpi-label">Gestite</span>
                <span class="kpi-value">${totalDelegated}</span>
            </div>
            ${totalOverdue > 0 ? `
                <div class="kpi-pill status-danger">
                    <span class="kpi-label">Scadute</span>
                    <span class="kpi-value"><i class="material-icons-round">history</i> ${totalOverdue}</span>
                </div>
            ` : ''}
        </div>
    `;

    const kpiContainer = document.getElementById('hp-delegated-bottom-kpis');
    if (kpiContainer) kpiContainer.innerHTML = kpiHtml;

    container.innerHTML = tasks.map(t => {
        const orderCode = t.orders ? `#${t.orders.order_number}` : (t.area || '');
        const clientPart = t.orders?.clients?.business_name || '';

        // Find other assignees (executors)
        const executors = (t.all_assignees || [])
            .filter(a => a.user_ref !== state.session?.user?.id && a.role !== 'pm' && a.role !== 'account')
            .map(a => {
                const collab = state.collaborators?.find(c => c.user_id === a.user_ref) || a.collaborator;
                const name = collab?.first_name || collab?.full_name?.split(' ')[0] || '...';
                const avatar = collab?.avatar_url || null;
                return { name, avatar, id: a.user_ref };
            })
            .filter((v, i, a) => v.name !== '...' && a.findIndex(x => x.id === v.id) === i); // Unique

        const isOverdue = t.due_date && new Date(t.due_date) < new Date();
        const dateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';

        return `
            <div class="activity-row" onclick="openPmItemDetails('${t.id}', null)" style="align-items: flex-start;">
                <!-- 1. Icon Col (24px) -->
                <div style="display: flex; align-items: center; justify-content: center; height: 20px; margin-top: 2px;">
                     <span class="material-icons-round" style="font-size: 16px; color: #f59e0b">stars</span>
                </div>

                <!-- 2. Main Col (1fr) -->
                <div class="row-main">
                    <div class="row-title" title="${t.title}" style="margin-bottom: 2px;">${t.title}</div>
                    <div class="row-meta" style="margin-bottom: 6px;">
                        <span class="row-context">${orderCode}</span>
                        ${clientPart ? `<span> ${clientPart}</span>` : ''}
                        ${t.breadcrumb ? `<span class="row-breadcrumb"> ${t.breadcrumb}</span>` : ''}
                        ${dateStr ? `<span style="${isOverdue ? 'color: #ef4444; font-weight: 700;' : ''}"> ${isOverdue ? 'Scaduto: ' : 'Scadenza: '}${dateStr}</span>` : ''}
                    </div>
                    
                    <!-- EXECUTORS ROW (Avatars) -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${executors.map(ex => `
                            <div style="display: flex; align-items: center; gap: 6px; background: var(--bg-tertiary); padding: 2px 8px 2px 2px; border-radius: 12px; border: 1px solid var(--glass-border);">
                                ${ex.avatar ?
                `<img src="${ex.avatar}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;">` :
                `<div style="width: 18px; height: 18px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700;">${ex.name.charAt(0)}</div>`
            }
                                <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);">${ex.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- 3. Right Col (Auto) - Just Chevron -->
                <div style="display: flex; align-items: center; justify-content: flex-end; height: 100%; padding-top: 4px;">
                    <span class="material-icons-round" style="color: #94a3b8; font-size: 16px; transition: all 0.2s;" onmouseover="this.style.color='#8b5cf6'; this.style.transform='translateX(2px)'" onmouseout="this.style.color='#94a3b8'; this.style.transform='translateX(0)'">chevron_right</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- GLOBAL HELPER HANDLERS ---
// --- GLOBAL HELPER HANDLERS ---
// Attached to window to be accessible from HTML onclick attributes

function timeAgo(date) {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " anni fa";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " mesi fa";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " gg fa";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ore fa";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min fa";
    return "poco fa";
}


function renderActivityFeed(container, activities) {
    if (!activities || activities.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; color: var(--text-tertiary); text-align: center; font-size: 0.85rem;">Nessuna attività recente</div>`;
        return;
    }

    container.innerHTML = `
        <div class="activity-log-list" style="display: flex; flex-direction: column; padding: 1rem 0;">
            ${activities.map(log => {
                const human = humanizeActivity(log);
                const timeStr = timeAgo(log.created_at);

                return `
                    <div class="timeline-item" onclick="window.openPmItemDetails('${log.item_ref}', '${log.space_ref || ''}')" style="display: flex; gap: 0.75rem; position: relative; padding: 0.45rem 0.75rem; cursor: pointer; transition: all 0.2s; border-radius: 14px;">
                        <!-- Timeline Line -->
                        <div style="position: absolute; left: 26px; top: 38px; bottom: 0; width: 1.5px; background: rgba(0,0,0,0.03); z-index: 1;"></div>
                        
                        <div class="actor-avatar" style="flex-shrink: 0; position: relative; z-index: 2;">
                            ${renderAvatar(log.actor || { full_name: human.actorName }, { size: 28, borderRadius: '8px' })}
                        </div>
                        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                            <div style="font-size: 0.82rem; color: inherit; line-height: 1.4; font-weight: 400;">
                                <span style="font-weight: 700; color: var(--text-primary, #0f172a);">${human.actorName}</span>
                                <span style="color: var(--text-secondary, #64748b);">${human.formattedDesc}</span>
                            </div>
                            <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; gap: 5px; font-weight: 500;">
                                <span class="material-icons-round" style="font-size: 0.8rem; color: #cbd5e1;">schedule</span>
                                ${timeStr}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <style>
            .timeline-item:hover { background: rgba(0,0,0,0.02); }
            .timeline-item:last-child div[style*="background: #f1f5f9"] { display: none; }
        </style>
    `;
}

window.openPmItemDetails = function (itemId, spaceId) {
    if (!itemId) return;
    // openHubDrawer is already imported at the top of the module
    openHubDrawer(itemId, spaceId === 'null' ? null : spaceId);
};

window.openHomepageEventDetails = function (evtId, type) {
    if (type === 'appointment') {
        // Find event data from global cache
        const evt = window.hpData?.events?.find(e => e.id == evtId);
        let refId = null;
        let refType = 'order'; // default

        if (evt && evt.orders) {
            refId = evt.orders.id;
        }

        // openAppointmentDrawer is already imported at the top
        openAppointmentDrawer(evtId, refId, refType);
    } else {
        // Fallback for non-appointment events
        window.location.hash = 'agenda';
    }
};


