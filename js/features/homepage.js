import { state } from '/js/modules/state.js';
import { supabase } from '../modules/config.js';
import { formatAmount } from '../modules/utils.js?v=317';

import { fetchAvailabilityRules, fetchAvailabilityOverrides, fetchCollaborators, fetchAssignments, upsertAssignment, fetchGoogleCalendarBusy } from '../modules/api.js';
import { fetchAppointment, updatePMItem } from '../modules/pm_api.js?v=385';
import { openHubDrawer } from './pm/components/hub_drawer.js?v=385';
import { openAppointmentDrawer } from './pm/components/hub_appointment_drawer.js?v=317';

// We reuse fetchMyBookings but we might need a tighter scoped fetch for "Today"
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
            booking_assignments!inner(collaborator_id),
            guest_info
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
                clients (business_name)
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
        const collaboratorId = collabId || state.profile?.id;

        if (!userId) {
            console.log("[Homepage] No user session found for recent projects");
            return [];
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

        // FOR STANDARD COLLABORATORS: Fetch Tasks (assignments), NOT Projects
        if (!isPrivileged) {
            const { data: myAssignments } = await supabase
                .from('pm_items')
                .select(`
                    id, title, status, created_at,
                    pm_spaces (
                        orders (id, order_number, title, clients(business_name))
                    ),
                    pm_item_assignees!inner(user_ref)
                `)
                .eq('pm_item_assignees.user_ref', userId)
                .neq('status', 'done')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!myAssignments) return [];

            return myAssignments.map(t => {
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
                    client: ord?.clients?.business_name || 'Incarico',
                    status: t.status,
                    last_active: t.created_at,
                    link: '' // Handled by onclick
                };
            });
        }

        // 2. Filter for "In Svolgimento" only (as requested)
        const isInSvolgimento = (status) => {
            if (!status) return false;
            const s = status.toLowerCase();
            return s.includes('svolgimento') || s.includes('in corso');
        };

        const projectsMap = new Map();

        // --- STEP 1: Fetch Assigned Orders (order_collaborators) ---
        if (collaboratorId) {
            const { data: assigned } = await supabase
                .from('order_collaborators')
                .select(`
                    role_in_order,
                    orders (id, title, order_number, status_works, clients(business_name), created_at)
                `)
                .eq('collaborator_id', collaboratorId);

            if (assigned) {
                assigned.forEach(item => {
                    const o = item.orders;
                    if (!o || projectsMap.has(o.id)) return;
                    if (!isInSvolgimento(o.status_works)) return;

                    // FILTER: Logica Opt-In (Stretta)
                    // Mostriamo la commessa SOLO se il ruolo è esplicitamente PM o Tecnico/Operativo.
                    // Se il ruolo è generico ("collaboratore"), vuoto, o puramente amministrativo ("account", "partner"), LO SALTIAMO.
                    const role = (item.role_in_order || '').toLowerCase().trim();

                    // Whitelist operational roles
                    const isPM = role.includes('pm') || role.includes('project') || role.includes('manager');
                    const isTech = role.includes('svilupp') || role.includes('dev') || role.includes('social') || role.includes('ads') || role.includes('seo') || role.includes('copy') || role.includes('design') || role.includes('grafic') || role.includes('tecni');

                    // STRICT CHECK: Must be PM or Tech. Everything else (Account, Partner, empty, generic collaborator) is hidden in this view.
                    if (!isPM && !isTech) {
                        return;
                    }

                    projectsMap.set(o.id, {
                        id: o.id,
                        order_number: o.order_number,
                        title: o.title || 'Senza Titolo',
                        client: o.clients?.business_name || 'No Cliente',
                        status: o.status_works,
                        last_active: o.created_at,
                        link: `#pm/commessa/${o.id}`
                    });
                });
            }
        }

        // --- STEP 2: Fetch Orders where user is PM (orders.pm_id) ---
        if (collaboratorId || userId) {
            const { data: managed } = await supabase
                .from('orders')
                .select('id, title, order_number, status_works, clients(business_name), created_at')
                .or(`pm_id.eq.${collaboratorId},pm_id_uuid.eq.${userId}`); // Handle both potential ID types if they exist

            if (managed) {
                managed.forEach(o => {
                    if (projectsMap.has(o.id)) return;
                    if (!isInSvolgimento(o.status_works)) return;

                    projectsMap.set(o.id, {
                        id: o.id,
                        order_number: o.order_number,
                        title: o.title || 'Senza Titolo',
                        client: o.clients?.business_name || 'No Cliente',
                        status: o.status_works,
                        last_active: o.created_at,
                        link: `#pm/commessa/${o.id}`
                    });
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
                        orders!inner (id, title, order_number, status_works, clients(business_name), created_at)
                    )
                `)
                .eq('role', 'pm')
                .or(`user_ref.eq.${userId},collaborator_ref.eq.${collaboratorId}`);

            if (spaceManaged) {
                spaceManaged.forEach(sa => {
                    const o = sa.pm_spaces?.orders;
                    if (!o || projectsMap.has(o.id)) return;
                    if (!isInSvolgimento(o.status_works)) return;

                    projectsMap.set(o.id, {
                        id: o.id,
                        order_number: o.order_number,
                        title: o.title || 'Senza Titolo',
                        client: o.clients?.business_name || 'No Cliente',
                        status: o.status_works,
                        last_active: o.created_at,
                        link: `#pm/commessa/${o.id}`
                    });
                });
            }

            // REMOVED: default_pm_user_ref check.
            // This field often defaults to the creator or an admin, causing "false positives"
            // where a user sees a project they technically "own" in the DB but don't manage.
        }

        // --- STEP 4: Update Last Active from Personal Activity (activity_logs) ---
        // We only use logs to sort existing projects, NOT to add new ones.
        // This prevents accidental "views" from cluttering the home list.
        if (collaboratorId) {
            const { data: recentLogs } = await supabase
                .from('activity_logs')
                .select(`
                    created_at,
                    orders (id)
                `)
                .eq('collaborator_id', collaboratorId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (recentLogs) {
                recentLogs.forEach(log => {
                    const oId = log.orders?.id;
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

        // Final sort by activity date
        let results = Array.from(projectsMap.values())
            .sort((a, b) => new Date(b.last_active) - new Date(a.last_active))
            .slice(0, 200);

        // ENRICH WITH STATS
        if (results.length > 0) {
            const orderIds = results.map(r => r.id);

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

                    results.forEach(r => {
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

        console.log("[Homepage] Verified Personal Projects:", results.length, results);
        return results;

    } catch (e) {
        console.error("Error fetching recent projects:", e);
        return [];
    }
}

export async function fetchInternalProjects(collaboratorId, userId) {
    try {
        const projectsMap = new Map();

        // 1. Fetch Internal Spaces (Clusters and Projects)
        // We look for spaces assigned to the user or where PM
        const { data: assigned } = await supabase
            .from('pm_spaces')
            .select(`
                id, name, type, area, is_cluster, parent_ref, created_at,
                cluster:parent_ref ( name ),
                pm_space_assignees!inner ( user_ref, collaborator_ref )
            `)
            .eq('type', 'interno')
            .eq('is_cluster', false)
            .or(`pm_space_assignees.user_ref.eq.${userId},pm_space_assignees.collaborator_ref.eq.${collaboratorId}`);

        if (assigned) {
            assigned.forEach(s => {
                const path = s.cluster?.name ? `${s.cluster.name} > ${s.name}` : s.name;
                projectsMap.set(s.id, {
                    id: s.id,
                    order_number: '', // Removed prefix
                    title: s.name,
                    client: path, // Full path
                    status: 'active',
                    last_active: s.created_at,
                    link: `#pm/space/${s.id}`
                });
            });
        }

        // Also fetch where is PM by default
        const { data: managed } = await supabase
            .from('pm_spaces')
            .select('id, name, type, area, is_cluster, parent_ref, created_at, cluster:parent_ref ( name )')
            .eq('type', 'interno')
            .eq('is_cluster', false)
            .eq('default_pm_user_ref', userId);

        if (managed) {
            managed.forEach(s => {
                if (projectsMap.has(s.id)) return;
                const path = s.cluster?.name ? `${s.cluster.name} > ${s.name}` : s.name;
                projectsMap.set(s.id, {
                    id: s.id,
                    order_number: '', // Removed prefix
                    title: s.name,
                    client: path, // Full path
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

                // Get User Appointments in these Spaces
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
    if (collab?.first_name) return collab.first_name;
    if (collab?.full_name) return collab.full_name.split(' ')[0];
    if (profile?.first_name) return profile.first_name;
    if (profile?.full_name) return profile.full_name.split(' ')[0];
    return 'Utente';
};

export async function renderHomepage(container) {
    console.log("Rendering Homepage...");

    const user = state.session?.user;
    if (!user) return;

    // Determine which collaborator to show (support impersonation)
    let myCollab;
    if (state.impersonatedCollaboratorId) {
        myCollab = state.collaborators.find(c => c.id === state.impersonatedCollaboratorId);
    }
    if (!myCollab) {
        myCollab = state.collaborators.find(c => c.email === user.email);
    }
    // Fallback: search by user_id
    if (!myCollab && state.profile) {
        myCollab = state.collaborators.find(c => c.user_id === state.profile.id);
    }

    // Graceful fallback if still not found: synthesize a minimal profile
    if (!myCollab) {
        console.warn("[Homepage] Collaborator profile not found for current user. Using fallback.");
        myCollab = {
            id: state.profile?.id || user.id,
            user_id: state.profile?.id || user.id,
            first_name: state.profile?.first_name || user.user_metadata?.first_name || 'Utente',
            last_name: state.profile?.last_name || user.user_metadata?.last_name || '',
            full_name: state.profile ? `${state.profile.first_name} ${state.profile.last_name || ''}`.trim() : 'Utente',
            email: user.email
        };
    }

    const firstName = getFirstName(myCollab, state.profile);
    const myId = myCollab.id;

    // --- MANAGE TOP BAR GREETING ---
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        const hours = new Date().getHours();
        let greeting = 'Buongiorno';
        if (hours >= 14 && hours < 19) greeting = 'Buon pomeriggio';
        else if (hours >= 19 || hours < 5) greeting = 'Buonasera';

        pageTitle.textContent = `${greeting}, ${firstName}!`;
        pageTitle.classList.add('solid-title');
    }

    // --- FETCH DATA FOR "MY ACTIVITIES" ---
    let myTasks = [], activeTimers = [], events = [];
    // Default filter state (User requested: Task, Appuntamenti, Attività)
    if (!window.hpActivityFilter) window.hpActivityFilter = 'task';

    try {
        // 1. TIMERS (Reserved for future use)
        activeTimers = [];

        // 2. TASKS (From PM Items)
        // Use user_ref (Auth ID) for assignment check.
        const targetUserId = myCollab.user_id || state.session?.user?.id;

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

        myTasks = (pmTasks || [])
            .map(t => {
                // Determine user's role for this item
                const myAssignment = t.pm_item_assignees.find(a => a.user_ref === targetUserId);
                const myRole = myAssignment ? myAssignment.role : 'viewer';

                // Robustly extract order and breadcrumb
                let ord = null;
                let breadcrumb = '';
                if (t.pm_spaces) {
                    const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                    if (space && space.orders) {
                        ord = Array.isArray(space.orders) ? space.orders[0] : space.orders;
                    }

                    const path = [];
                    // Removed area from breadcrumb to display it more clearly on the bottom line
                    const cluster = Array.isArray(space.cluster) ? space.cluster[0] : space.cluster;
                    if (cluster && cluster.name) path.push(cluster.name);

                    if (space && space.name && (!cluster || space.name !== cluster.name)) path.push(space.name);

                    const parentTask = Array.isArray(t.parent_task) ? t.parent_task[0] : t.parent_task;
                    if (parentTask && parentTask.title) path.push(parentTask.title);

                    breadcrumb = path.join(' › ');
                }

                const spaceObj = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                const parentTask = Array.isArray(t.parent_task) ? t.parent_task[0] : t.parent_task;

                const rawType = (t.item_type || 'task').toLowerCase();
                const parentRawType = (parentTask?.item_type || '').toLowerCase();

                const isActivity = rawType === 'activity' || rawType.includes('attivit');
                const isParentActivity = parentRawType === 'activity' || parentRawType.includes('attivit');
                const isSubActivity = isActivity && isParentActivity;

                return {
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    due_date: t.due_date,
                    parent_id: t.parent_ref,
                    orders: ord,
                    breadcrumb: breadcrumb,
                    area: spaceObj?.area || '',
                    space_type: (spaceObj?.type || '').toLowerCase(),
                    raw_type: rawType,
                    is_activity: isActivity,
                    is_sub_activity: isSubActivity,
                    type: 'pm_task',
                    role: myRole,
                    all_assignees: t.all_assignees || []
                };
            });
        // Removed strict role filter. 
        // The inner join on pm_item_assignees.user_ref ensures we only fetch items assigned to the user.
        // If they are assigned (even as PM), they should see it.

        // 3. EVENTS (Next 14 days for "surely see future appointments")
        const rangeEnd = new Date();
        rangeEnd.setDate(rangeEnd.getDate() + 14);
        events = await fetchDateEvents(myId, new Date(), rangeEnd);

    } catch (err) {
        console.error("Error fetching My Activities data:", err);
    }

    // Skeleton
    container.innerHTML = `
        <div class="homepage-container">
            <!-- Content raised: Greeting in top-bar, context in timeline header -->
            <div style="margin-top: 1rem;"></div>

            <!-- Top Grid: Timeline + My Activities -->
            <div style="height: 380px; display: flex; gap: 2rem; margin-top: 1rem;">
                <!-- LEFT: TIMELINE (Main) -->
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <!-- HEADER (Date Nav) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex: 0 0 auto;">
                         <h2 id="hp-date-description" style="font-size: 1.2rem; font-weight: 300; color: var(--text-primary); font-family: var(--font-base);">Ecco cosa c'è in programma per oggi, ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                         
                         <div style="display: flex; align-items: center; gap: 12px;">
                             <!-- Main Group -->
                             <div style="display: flex; background: #e5e7eb; border-radius: 14px; padding: 4px; gap: 2px;">
                                 <button onclick="setHomepageMode('today')" id="btn-mode-today" class="nav-pill active-pill" style="padding: 6px 16px; border-radius: 10px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: white; color: #111; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">Oggi</button>
                                 <button onclick="setHomepageMode('tomorrow')" id="btn-mode-tomorrow" class="nav-pill" style="padding: 6px 16px; border-radius: 10px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: transparent; color: #6b7280;">Domani</button>
                                 <div style="width: 1px; background: #d1d5db; margin: 4px 2px;"></div>
                                 <button onclick="setHomepageMode('week')" id="btn-mode-week" class="nav-pill" style="padding: 6px 16px; border-radius: 10px; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; background: transparent; color: #6b7280;">Settimana</button>
                             </div>

                             <!-- Separated Date Button -->
                             <div style="position: relative;">
                                <button id="hp-date-picker-btn" onclick="toggleCustomDatePicker(this)"
                                   style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 6px 14px; font-weight: 600; font-size: 0.85rem; color: #4b5563; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.2s;"
                                   onmouseover="this.style.borderColor='#d1d5db'; this.style.color='#111'"
                                   onmouseout="this.style.borderColor='#e5e7eb'; this.style.color='#4b5563'">
                                   <span class="material-icons-round" style="font-size: 18px; color: #8b5cf6;">calendar_today</span> 
                                   <span>Data</span>
                                </button>
                             </div>
                         </div>
                    </div>

                    <style>
                        .nav-pill:hover { background: rgba(255,255,255,0.5); }
                        .active-pill { background: white !important; color: #111 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
                        /* Helper to update UI state specifically for pill highlighting would require more JS, simple toggle for now */
                    </style>

                    <!-- TIMELINE WRAPPER -->
                    <div id="hp-timeline-wrapper" style="flex: 1; position: relative; background: white; border-radius: 16px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm); overflow-x: auto; overflow-y: hidden;">
                        <!-- Rendered by JS -->
                    </div>
                </div>

                <!-- RIGHT: MY ACTIVITIES (Side Panel) -->
                <div style="width: 340px; flex: 0 0 auto; display: flex; flex-direction: column;">
                    <!-- "MY ACTIVITIES" CARD -->
                    <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; height: 100%; overflow: hidden; background: #1e293b; color: white; border-radius: 16px;">
                        <!-- SEGMENTED CONTROL TABS (Icons) -->
                        <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 4px; display: flex; gap: 4px; flex-shrink: 0; align-items: stretch;">
                            <button onclick="window.setHpFilter('task', this)" class="tab-pill ${window.hpActivityFilter === 'task' ? 'active' : ''}" title="Task">
                                <span class="material-icons-round" style="font-size: 18px;">check_circle</span>
                                <span class="tab-count" style="margin-left: 4px;"></span>
                            </button>
                            <button onclick="window.setHpFilter('event', this)" class="tab-pill ${window.hpActivityFilter === 'event' ? 'active' : ''}" title="Appuntamenti">
                                <span class="material-icons-round" style="font-size: 18px;">event</span>
                                <span class="tab-count" style="margin-left: 4px;"></span>
                            </button>
                            <button id="hp-top-add-btn" onclick="window.toggleHpQuickEntry(this)" class="hp-add-event-btn" title="Crea Nuovo" style="flex: 1; border: none; background: var(--brand-blue); color: white; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);" onmouseover="this.style.transform='scale(1.05)'; this.style.background='#3b82f6'" onmouseout="this.style.transform='scale(1)'; this.style.background='var(--brand-blue)'" onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform='scale(1.05)'">
                                <span class="material-icons-round" style="font-size: 20px;">add</span>
                            </button>
                        </div>
                        
                        <style>
                            .tab-pill {
                                flex: 1;
                                border: none;
                                background: transparent;
                                color: rgba(255,255,255,0.4); /* Dimmer inactive */
                                padding: 8px 0;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            }
                            .tab-pill:hover {
                                color: white;
                                background: rgba(255,255,255,0.05);
                            }
                            .tab-pill.active {
                                background: rgba(255,255,255,0.15) !important;
                                color: white !important;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                            }
                            .tab-count {
                                font-size: 0.75rem;
                                font-weight: 700;
                                opacity: 0.8;
                            }
                        </style>

                        <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-right: 4px; min-height: 0;" id="hp-activities-list">
                            <!-- Content Injected Below -->
                        </div>

                        <button class="btn btn-primary" style="width: 100%; justify-content: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;" onclick="window.location.hash='agenda'">
                            Vedi Agenda
                        </button>
                    </div>
                </div>
            </div>

            <!-- Bottom Grid -->
            <div class="bottom-grid" style="margin-top: 3rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;">

                <!-- LEFT: PROJECTS -->
                <div class="dashboard-widget" style="padding: 2rem;">
                    <div class="widget-header" style="justify-content: flex-start; gap: 1.5rem; margin-bottom: 2rem;">
                        <h3 class="widget-title" id="hp-bottom-title">Progetti</h3>
                        
                        <div style="background: var(--bg-tertiary); padding: 5px; border-radius: 12px; display: flex; gap: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
                            <button id="hp-bottom-tab-projects" onclick="window.setHpBottomTab('projects')" class="timeline-btn active" style="font-weight: 700;">
                                <span id="hp-bottom-projects-label">Commesse</span>
                            </button>
                            <button id="hp-bottom-tab-internal" onclick="window.setHpBottomTab('internal')" class="timeline-btn" style="font-weight: 700;">
                                Progetti Interni
                            </button>
                        </div>
                        
                        <div style="flex: 1;"></div>
                        <button class="timeline-btn" onclick="window.location.hash='dashboard'" style="color: var(--brand-blue); font-weight: 700;">Vedi Tutti</button>
                    </div>
                    
                    <div id="hp-bottom-kpis"></div>
                    <div id="hp-bottom-content" class="premium-card-list custom-scrollbar" style="height: 420px; overflow-y: auto; padding-right: 8px;">
                         <span class="loader small"></span>
                    </div>
                </div>

                <!-- RIGHT: ACTIVITIES -->
                <div class="dashboard-widget" style="padding: 2rem;">
                    <div class="widget-header" style="justify-content: flex-start; gap: 1.5rem; margin-bottom: 2rem;">
                        <h3 class="widget-title">Le mie attività</h3>
                        
                        <div style="background: var(--bg-tertiary); padding: 5px; border-radius: 12px; display: flex; gap: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
                            <button id="hp-act-tab-projects" onclick="window.setHpActivityTab('projects')" class="timeline-btn active" style="font-weight: 700;">
                                Commesse
                            </button>
                            <button id="hp-act-tab-internal" onclick="window.setHpActivityTab('internal')" class="timeline-btn" style="font-weight: 700;">
                                Progetti Interni
                            </button>
                        </div>
                    </div>
                    
                    <div id="hp-activities-bottom-kpis"></div>
                    <div id="hp-activities-bottom-content" class="premium-card-list custom-scrollbar" style="height: 420px; overflow-y: auto; padding-right: 8px;">
                         <span class="loader small"></span>
                    </div>
                </div>

                <!-- NEW: DELEGATED TASKS -->
                <div class="dashboard-widget" style="padding: 2rem;">
                    <div class="widget-header" style="justify-content: flex-start; gap: 1.5rem; margin-bottom: 2rem;">
                        <h3 class="widget-title">Task Gestite</h3>
                        <div style="background: var(--bg-tertiary); padding: 5px; border-radius: 12px; display: flex; gap: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
                            <button id="hp-delegated-tab-projects" onclick="window.setHpDelegatedTab('projects')" class="timeline-btn active" style="font-weight: 700;">
                                Commesse
                            </button>
                            <button id="hp-delegated-tab-internal" onclick="window.setHpDelegatedTab('internal')" class="timeline-btn" style="font-weight: 700;">
                                Progetti Interni
                            </button>
                        </div>
                    </div>
                    
                    <div id="hp-delegated-bottom-kpis"></div>
                    <div id="hp-delegated-bottom-content" class="premium-card-list custom-scrollbar" style="height: 420px; overflow-y: auto; padding-right: 8px;">
                         <span class="loader small"></span>
                    </div>
                </div>

            </div>
        </div>
    `;

    // --- Interaction Logic ---
    // Store current date for timeline navigation
    window.homepageCurrentDate = new Date();
    window.homepageCollaboratorId = myCollab.id;
    window.hpView = 'daily'; // 'daily' | 'weekly'

    window.toggleHomepageView = (view) => {
        window.hpView = view;

        // UI Update
        const dailyBtn = document.getElementById('view-daily-btn');
        const weeklyBtn = document.getElementById('view-weekly-btn');
        if (view === 'daily') {
            dailyBtn.classList.add('active-pill'); dailyBtn.style.background = 'white'; dailyBtn.style.color = '#111';
            weeklyBtn.classList.remove('active-pill'); weeklyBtn.style.background = 'transparent'; weeklyBtn.style.color = '#6b7280';
        } else {
            weeklyBtn.classList.add('active-pill'); weeklyBtn.style.background = 'white'; weeklyBtn.style.color = '#111';
            dailyBtn.classList.remove('active-pill'); dailyBtn.style.background = 'transparent'; dailyBtn.style.color = '#6b7280';
        }

        window.updateHomepageTimeline(window.homepageCurrentDate);
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

        // Update header date
        headerDate.innerHTML = dateText;

        // Keep Greeting in sync (especially if time passed or name changed)
        const currentFirstName = getFirstName(null, state.profile);
        const hours = new Date().getHours();
        let greeting = 'Buongiorno';
        if (hours >= 14 && hours < 19) greeting = 'Buon pomeriggio';
        else if (hours >= 19 || hours < 5) greeting = 'Buonasera';
        if (headerTitle) headerTitle.textContent = `${greeting}, ${currentFirstName}!`;

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
                renderTimeline(timelineWrapper, events, date, dayRules, googleBusy, overrides);
            }

            // Sync My Activities Side Panel (Events Tab AND Tasks) with the new date/range
            if (window.hpData) {
                window.hpData.events = events; // Update events data

                // Filter Tasks from the master list (window.hpData.tasks contains all pending)
                // Robust Date Parsing
                const parseLocal = (s) => {
                    if (!s) return null;
                    try {
                        // Standard YYYY-MM-DD
                        if (typeof s === 'string' && s.includes('-') && s.length === 10) {
                            const parts = s.split('-');
                            return new Date(parts[0], parts[1] - 1, parts[2]); // Local midnight
                        }
                        // Fallback/Timestamp
                        const d = new Date(s);
                        if (isNaN(d.getTime())) return null;
                        // Normalize to local midnight
                        d.setHours(0, 0, 0, 0);
                        return d;
                    } catch (e) {
                        return null;
                    }
                };

                const allTasks = window.hpData.tasks || [];

                // Separate PM Activities from Real Tasks BEFORE filtering by date
                const pmActivities = allTasks.filter(item => {
                    const type = (item.raw_type || '').toLowerCase();
                    return type.includes('attivit') || type.includes('activity');
                });
                const realTasksOnly = allTasks.filter(item => {
                    const type = (item.raw_type || '').toLowerCase();
                    return !(type.includes('attivit') || type.includes('activity'));
                });

                // Compare simple local strings to avoid timestamp drift
                const toYMD = (date) => {
                    return date.getFullYear() + '-' +
                        String(date.getMonth() + 1).padStart(2, '0') + '-' +
                        String(date.getDate()).padStart(2, '0');
                };

                const startStr = toYMD(start);
                const todayStr = toYMD(new Date());
                const isTodayView = (startStr === todayStr) && (window.hpView === 'daily');

                // Filter ONLY realTasks by date, PM Activities remain unfiltered
                const filteredRealTasks = realTasksOnly.filter(t => {
                    if (!t.due_date) return false;
                    const d = parseLocal(t.due_date);

                    if (isTodayView) {
                        // Today: Include overdue (d < today) and today (d == today)
                        return d <= end;
                    }

                    // Strict Range for other days/weeks
                    return d >= start && d <= end;
                });

                // Combine: filtered real tasks + all PM Activities
                const combinedTasks = [...filteredRealTasks, ...pmActivities];

                // Store for tab switching
                window.hpData.filteredTasks = combinedTasks;

                const actContainer = document.getElementById('hp-activities-list');
                if (actContainer) {
                    renderMyActivities(actContainer, window.hpData.timers, combinedTasks, window.hpData.events, window.hpActivityFilter);
                }
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
            window.updateHomepageTimeline(window.homepageCurrentDate);
        } else if (mode === 'tomorrow') {
            window.hpView = 'daily';
            const d = new Date();
            d.setDate(d.getDate() + 1);
            window.homepageCurrentDate = d;
            window.updateHomepageTimeline(window.homepageCurrentDate);
        } else if (mode === 'week') {
            window.hpView = 'weekly';
            // Keep current date reference for week calculation
            window.updateHomepageTimeline(window.homepageCurrentDate);
        }
    };

    // --- CUSTOM DATE PICKER ---
    let pickerCurrentDate = new Date(); // Tracks the displayed month

    window.toggleCustomDatePicker = (btn) => {
        const existing = document.getElementById('custom-datepicker-popover');
        if (existing) {
            existing.remove();
            return;
        }

        // Initialize picker date to current selected date
        pickerCurrentDate = new Date(window.homepageCurrentDate);

        // Create Popover
        const rect = btn.getBoundingClientRect();
        const popoverWidth = 300;
        const popover = document.createElement('div');
        popover.id = 'custom-datepicker-popover';
        popover.className = 'glass-card'; // Reuse global class
        popover.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            left: ${rect.right - popoverWidth}px; /* Align Right Edge */
            background: white; /* Light Theme */
            color: #1f2937; /* Gray-800 */
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); /* Soft shadow */
            z-index: 9999;
            width: ${popoverWidth}px;
            border: 1px solid #e5e7eb; /* Light border */
            font-family: var(--font-base, sans-serif);
        `;

        // Render Initial View
        renderCalendar(popover);
        document.body.appendChild(popover);

        // Click Outside to Close
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

    // --- QUICK ENTRY MENU ---
    window.toggleHpQuickEntry = (btn) => {
        const existing = document.getElementById('hp-quick-entry-popover');
        if (existing) {
            existing.remove();
            return;
        }

        const rect = btn.getBoundingClientRect();
        const popoverWidth = 240;
        const popover = document.createElement('div');
        popover.id = 'hp-quick-entry-popover';
        popover.className = 'glass-card';
        popover.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            left: ${rect.right - popoverWidth}px;
            background: white;
            color: #1f2937;
            padding: 8px;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            z-index: 99999;
            width: ${popoverWidth}px;
            border: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-family: var(--font-base, sans-serif);
        `;

        const items = [
            { id: 'task', label: 'Nuova Task', description: 'Crea attività operativa', icon: 'check_circle', color: '#3b82f6', action: () => openHubDrawer(null, null, null, 'task') },
            { id: 'appt', label: 'Nuovo Appuntamento', description: 'Segna incontro o evento', icon: 'event', color: '#a855f7', action: () => openAppointmentDrawer() }
        ];

        items.forEach(item => {
            const row = document.createElement('div');
            row.style.cssText = `
                display: flex; align-items: center; gap: 12px; padding: 10px 12px;
                cursor: pointer; border-radius: 8px; transition: all 0.2s;
            `;
            row.onmouseover = () => { row.style.background = '#f3f4f6'; };
            row.onmouseout = () => { row.style.background = 'transparent'; };
            row.onclick = () => {
                popover.remove();
                item.action();
            };

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
                    popover.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    };

    function renderCalendar(container) {
        const year = pickerCurrentDate.getFullYear();
        const month = pickerCurrentDate.getMonth(); // 0-11
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        // Header
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <button onclick="changePickerMonth(-1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">
                    <span class="material-icons-round">chevron_left</span>
                </button>
                <div style="font-weight: 700; font-size: 0.95rem; color:#111;">${monthNames[month]} ${year}</div>
                <button onclick="changePickerMonth(1)" style="background:transparent; border:none; color:#374151; cursor:pointer; padding:4px; border-radius:4px;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'">
                    <span class="material-icons-round">chevron_right</span>
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px;">
        `;

        // Weekdays
        const days = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
        days.forEach(d => {
            html += `<div style="text-align: center; font-size: 0.75rem; color: #9ca3af; font-weight: 600;">${d}</div>`;
        });
        html += `</div><div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">`;

        // Days Grid
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun (need adjustment to Mon=0)
        const adjustedFirstDay = (firstDay === 0 ? 6 : firstDay - 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date(); // To highlight today
        const currentSelected = window.homepageCurrentDate;

        // Empty slots
        for (let i = 0; i < adjustedFirstDay; i++) {
            html += `<div></div>`;
        }

        // Day slots
        for (let i = 1; i <= daysInMonth; i++) {
            let bg = 'transparent';
            let color = '#374151'; // Gray-700
            let weight = '500';

            // Highlight Selected (Prioritize over today)
            if (i === currentSelected.getDate() && month === currentSelected.getMonth() && year === currentSelected.getFullYear()) {
                bg = 'var(--brand-purple, #a855f7)';
                color = 'white';
                weight = '700';
            }
            // Highlight Today (secondary)
            else if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                bg = '#eff6ff'; // Blue-50
                color = '#3b82f6'; // Blue-500
                weight = '700';
            }

            html += `
                <button onclick="selectPickerDate(${i})" style="
                    width: 100%; aspect-ratio: 1; border: none; background: ${bg}; color: ${color};
                    border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: ${weight};
                    display: flex; align-items: center; justify-content: center; transition: background 0.2s;
                " onmouseover="this.style.background = '${bg === 'transparent' ? '#f3f4f6' : bg}'"
                  onmouseout="this.style.background = '${bg}'">
                    ${i}
                </button>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    // Global helpers for pure HTML interaction
    window.changePickerMonth = (offset) => {
        pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() + offset);
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) renderCalendar(popover);
    };

    window.selectPickerDate = (day) => {
        const newDate = new Date(pickerCurrentDate.getFullYear(), pickerCurrentDate.getMonth(), day);
        // Date input needs YYYY-MM-DD usually, but our logic handles Date obj
        const offset = newDate.getTimezoneOffset();
        const localDate = new Date(newDate.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];

        window.updateHomepageDateFromInput(dateStr);

        // Remove popover
        const popover = document.getElementById('custom-datepicker-popover');
        if (popover) popover.remove();
    };

    // --- Initial Load ---
    try {
        // Date Input Handler
        window.updateHomepageDateFromInput = (val) => {
            if (!val) return;
            window.homepageCurrentDate = new Date(val);
            window.updateHomepageTimeline(window.homepageCurrentDate);

            // Clear visual active state from mode buttons since we are on custom date
            ['today', 'tomorrow', 'week'].forEach(m => {
                const btn = document.getElementById('btn-mode-' + m);
                if (btn) {
                    btn.classList.remove('active-pill');
                    btn.style.background = 'transparent';
                    btn.style.color = '#6b7280';
                }
            });
            // Ensure Daily View
            window.hpView = 'daily';
        };

        // 1. Store data for filtering reference BEFORE timeline update
        window.hpData = {
            timers: activeTimers,
            tasks: myTasks,  // Full list, filtering happens in updateHomepageTimeline
            events: events,
            filteredTasks: myTasks // Will be overwritten by updateHomepageTimeline
        };

        // 2. Timeline (Default Today) - This also renders My Activities with filtered data
        window.updateHomepageTimeline(window.homepageCurrentDate);

        // 3. Load Bottom Section
        const userTags = state.profile?.tags || [];
        const isPrivileged = userTags.includes('Partner') || userTags.includes('Amministrazione') || userTags.includes('Account') || userTags.some(t => t.toLowerCase() === 'project manager' || t.toLowerCase() === 'pm');

        const bottomTitle = document.getElementById('hp-bottom-title');
        const projectsLabel = document.getElementById('hp-bottom-projects-label');
        if (bottomTitle) bottomTitle.textContent = isPrivileged ? 'Commesse in corso' : 'Incarichi in corso';
        if (projectsLabel) projectsLabel.textContent = isPrivileged ? 'Commesse' : 'Incarichi';

        const targetUserId = state.session?.user?.id;
        const myActualCollabId = state.profile?.collaborator_id;

        const projects = await fetchRecentProjects(myActualCollabId, targetUserId);
        const internalProjects = await fetchInternalProjects(myActualCollabId, targetUserId);

        // Tab switching logic
        window.setHpBottomTab = (tab) => {
            const projectsBtn = document.getElementById('hp-bottom-tab-projects');
            const internalBtn = document.getElementById('hp-bottom-tab-internal');
            const content = document.getElementById('hp-bottom-content');
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
            const result = [];
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

        // --- DELEGATED TASKS LOGIC ---
        const delegatedItems = allActivities.filter(t => {
            const isManager = t.role === 'pm' || (t.role || '').toLowerCase().includes('account');
            if (!isManager) return false;

            // At least one other person assigned
            const otherAssignees = t.all_assignees?.filter(a => a.user_ref !== targetUserId);
            // Must be a TASK, not an Activity
            return !t.is_activity && otherAssignees && otherAssignees.length > 0;
        });

        const delegatedProjects = delegatedItems.filter(t => t.space_type.includes('commessa') || t.space_type.includes('order'));
        const delegatedInternal = delegatedItems.filter(t => t.space_type.includes('interno') || t.space_type.includes('cluster') || t.space_type.includes('space') || t.space_type === '');

        window.setHpDelegatedTab = (tab) => {
            const pBtn = document.getElementById('hp-delegated-tab-projects');
            const iBtn = document.getElementById('hp-delegated-tab-internal');
            const content = document.getElementById('hp-delegated-bottom-content');
            if (!content) return;

            if (tab === 'projects') {
                pBtn?.classList.add('active');
                iBtn?.classList.remove('active');
                renderDelegatedTasks(content, delegatedProjects);
            } else {
                iBtn?.classList.add('active');
                pBtn?.classList.remove('active');
                renderDelegatedTasks(content, delegatedInternal);
            }
        };

        // Initial render for delegated
        window.setHpDelegatedTab('projects');

        // Event Listener for Refresh (Sync with drawers)
        const reloadHandler = (e) => {
            // Check if we are still on homepage
            if (!document.querySelector('.homepage-header')) return;

            console.log("[Homepage] External change detected:", e.type, e.detail);
            if (window.updateHomepageTimeline) {
                window.updateHomepageTimeline(window.homepageCurrentDate);
            }
        };

        if (window._hpReloadHandler) {
            document.removeEventListener('appointment-changed', window._hpReloadHandler);
            document.removeEventListener('pm-item-changed', window._hpReloadHandler);
        }
        window._hpReloadHandler = reloadHandler;
        document.addEventListener('appointment-changed', reloadHandler);
        document.addEventListener('pm-item-changed', reloadHandler);

    } catch (e) {
        console.error("Home Data Load Error:", e);
    }
}

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
import { openEventDetails } from './agenda_utils.js?v=317';

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
    const container = btn.closest('div');
    if (container) {
        container.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    // Re-render using the FILTERED tasks (date-filtered), not the full list
    if (window.hpData) {
        const tasksToUse = window.hpData.filteredTasks || window.hpData.tasks;
        renderMyActivities(document.getElementById('hp-activities-list'), window.hpData.timers, tasksToUse, window.hpData.events, filter);
    }
};

function renderMyActivities(container, timers, tasks, events, filter = 'task') {
    if (!container) return;

    // Data Safety & Counts
    const safeTimers = timers || [];
    const allPmItems = tasks || [];
    const safeEvents = events || [];

    // Separate PM Items into "Real Tasks" and "PM Activities"
    // Assumption: 'activity' type or similar distinguishes them. 
    // If not found, rely on title keywords or user feedback.
    // For now assuming 'attivita' or 'activity' in raw_type.
    const realTasks = [];
    const pmActivities = [];

    allPmItems.forEach(item => {
        const type = (item.raw_type || '').toLowerCase();
        if (type.includes('attivit') || type.includes('activity')) {
            pmActivities.push(item);
        } else {
            realTasks.push(item);
        }
    });

    // Total counts for tabs
    const countTask = realTasks.length;
    const countEvent = safeEvents.length;
    const countActivity = safeTimers.length + pmActivities.length;

    // Filter Logic
    const showTimers = filter === 'timer'; // Attività (Timers + PM Activities)
    const showEvents = filter === 'event'; // Appuntamenti (Agenda)
    const showTasks = filter === 'task';  // Task

    let html = '';
    let hasContent = false;
    const now = new Date();

    try {
        // 1. ACTIVE TIMERS & PM ACTIVITIES (Attività Tab)
        if (showTimers) {
            // A. Timers
            safeTimers.forEach(t => {
                hasContent = true;
                let title = 'Senza Commessa';
                let clientShort = '';
                let orderId = null;
                if (t.orders) {
                    const ord = Array.isArray(t.orders) ? t.orders[0] : t.orders;
                    if (ord) {
                        title = `#${ord.order_number || '?'} - ${ord.title || '...'}`;
                        orderId = ord.id;
                        if (ord.clients) {
                            clientShort = ord.clients.client_code || ord.clients.business_name || '';
                        }
                    }
                }
                if (!clientShort && t.area) clientShort = t.area;
                html += `
                    <div onclick="window.location.hash = '#pm/commessa/${orderId || ''}'" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.75rem; border-radius: 8px; display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.5rem; cursor: pointer;">
                        <div style="width: 32px; height: 32px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
                            <span class="material-icons-round" style="font-size: 18px;">play_arrow</span>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.65rem; color: #6ee7b7; font-weight: 700; text-transform: uppercase;">In Corso (Timer)</div>
                            <div style="font-weight: 600; font-size: 0.85rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
                            ${clientShort ? `<div style="font-size: 0.7rem; color: #94a3b8; font-weight: 500; margin-top: 1px;">${clientShort}</div>` : ''}
                        </div>
                    </div>
                `;
            });

            // B. PM Activities (Static)
            pmActivities.forEach(t => {
                hasContent = true;
                let fullTitle = 'Attività';
                let clientShort = '';
                let spaceId = null;
                if (t.pm_spaces) {
                    const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                    if (space) {
                        spaceId = space.id;
                        if (space.orders) {
                            const ord = Array.isArray(space.orders) ? space.orders[0] : space.orders;
                            if (ord) {
                                fullTitle = `#${ord.order_number} - ${ord.title}`;
                                if (ord.clients) {
                                    clientShort = ord.clients.client_code || ord.clients.business_name || '';
                                }
                            }
                        }
                        if (!clientShort && space.area) clientShort = space.area;
                    }
                }

                const isPm = t.role === 'pm' || (t.role || '').toLowerCase().includes('manager');
                const roleIcon = isPm ? 'stars' : 'person_outline';
                const roleColor = isPm ? '#f59e0b' : 'rgba(255,255,255,0.4)';
                const roleTitle = isPm ? 'Project Manager' : 'Assegnatario';

                html += `
                    <div onclick="openPmItemDetails('${t.id}', '${spaceId || ''}')" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem; border-radius: 8px; display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 0.5rem; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; position: relative;">
                            <span class="material-icons-round" style="font-size: 18px;">assignment</span>
                            <span class="material-icons-round" title="${roleTitle}" style="position: absolute; bottom: -2px; right: -2px; font-size: 12px; color: ${roleColor}; background: #1e293b; border-radius: 50%; padding: 1px;">${roleIcon}</span>
                        </div>
                         <div style="flex: 1; min-width: 0;">
                             <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                                 ${fullTitle}
                            </div>
                            <div style="font-weight: 500; font-size: 0.9rem; color: white; line-height: 1.3;">${t.title}</div>
                            ${clientShort ? `<div style="font-size: 0.7rem; color: #64748b; font-weight: 500; margin-top: 2px;">${clientShort}</div>` : ''}
                        </div>
                    </div>
                `;
            });

            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessuna attività.</div>`;
        }

        // 2. EVENTS (Agenda)
        if (showEvents) {
            if (safeEvents.length > 0) {
                safeEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

                // Group by date
                const grouped = {};
                safeEvents.forEach(evt => {
                    const d = new Date(evt.start);
                    d.setHours(0, 0, 0, 0);
                    const key = d.getTime();
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(evt);
                });

                const sortedDates = Object.keys(grouped).sort((a, b) => a - b);

                sortedDates.forEach(dateKey => {
                    const d = new Date(parseInt(dateKey));
                    const isToday = d.toDateString() === now.toDateString();
                    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();

                    let dateLabel = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
                    if (isToday) dateLabel = "OGGI";
                    else if (isTomorrow) dateLabel = "DOMANI";

                    html += `
                        <div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; margin: 1rem 0 0.5rem 0; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
                            ${dateLabel}
                        </div>
                    `;

                    grouped[dateKey].forEach(evt => {
                        hasContent = true;
                        const startDate = new Date(evt.start);
                        const endDate = new Date(evt.end);
                        const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        const isPast = endDate < now;
                        const isNow = startDate <= now && endDate > now;

                        let opacity = '1';
                        let border = '1px solid rgba(255, 255, 255, 0.05)';
                        let bg = 'transparent';

                        if (isPast) opacity = '0.4';
                        if (isNow) {
                            border = '1px solid var(--brand-blue)';
                            bg = 'rgba(59, 130, 246, 0.15)';
                        }

                        html += `
                            <div style="background: ${bg}; border-bottom: ${border}; opacity: ${opacity}; padding: 0.6rem 0.5rem; display: flex; gap: 0.75rem; align-items: center; cursor: pointer; border-radius: 6px; margin-bottom: 2px;" onclick="openHomepageEventDetails('${evt.id}', '${evt.type}')">
                                <div style="display: flex; flex-direction: column; align-items: center; width: 42px; flex-shrink: 0; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 4px;">
                                    <span style="font-size: 0.75rem; font-weight: 700; color: white;">${timeStr}</span>
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; font-size: 0.85rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${evt.title}</div>
                                    <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); font-weight: 500;">${evt.client || ''}</div>
                                </div>
                            </div>
                        `;
                    });
                });
            }
            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun appuntamento oggi.</div>`;
        }

        // 3. TASKS
        if (showTasks) {
            if (realTasks.length > 0) {
                // Sort by Due Date
                realTasks.sort((a, b) => {
                    const da = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
                    const db = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
                    return da - db;
                });

                realTasks.forEach(t => {
                    hasContent = true;
                    // Correctly access nested Order fields
                    let fullTitle = t.breadcrumb || 'Generico';
                    let clientShort = '';
                    if (t.orders) {
                        const ord = Array.isArray(t.orders) ? t.orders[0] : t.orders;
                        if (ord) {
                            // If we have an order, the breadcrumb is still useful for sub-structure
                            fullTitle = `#${ord.order_number} - ${ord.title}`;
                        }
                    }
                    if (!clientShort && t.area) clientShort = t.area;

                    const breadcrumb = t.breadcrumb ? ` ${t.breadcrumb}` : '';

                    const isLate = t.due_date && new Date(t.due_date) < new Date();
                    const dateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '';

                    let spaceId = null;
                    if (t.pm_spaces) {
                        const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
                        if (space) spaceId = space.id;
                    }

                    const isPm = t.role === 'pm' || (t.role || '').toLowerCase().includes('manager');
                    const roleIcon = isPm ? 'stars' : 'person_outline';
                    const roleColor = isPm ? '#f59e0b' : 'rgba(255,255,255,0.4)';
                    const roleTitle = isPm ? 'Project Manager' : 'Assegnatario';

                    html += `
                        <div class="activity-row" style="background: transparent; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 0.5rem 0; display: flex; gap: 0.75rem; align-items: center; justify-content: space-between;">
                            <div onclick="openPmItemDetails('${t.id}', '${spaceId || ''}')" style="flex: 1; min-width: 0; cursor: pointer; display: flex; gap: 10px; align-items: flex-start;">
                                 <div style="margin-top: 2px; color: ${roleColor}" title="${roleTitle}">
                                     <span class="material-icons-round" style="font-size: 18px;">${roleIcon}</span>
                                 </div>
                                 <div style="flex: 1; min-width: 0;">
                                     <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 500; margin-bottom: 2px;">
                                        ${fullTitle}
                                    </div>
                                    <div style="font-weight: 500; font-size: 0.9rem; color: white; line-height: 1.2;">${t.title}</div>
                                    <div style="font-size: 0.65rem; color: #64748b; margin-top: 2px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                                        ${clientShort ? `<span style="color: var(--brand-blue); font-weight: 700;">${clientShort}</span>` : ''}
                                        ${t.breadcrumb ? `<span style="opacity: 0.7;">· ${t.breadcrumb}</span>` : ''}
                                        ${dateStr ? `<span style="color: ${isLate ? '#f87171' : 'inherit'}">· ${isLate ? 'Scaduto: ' : ''}${dateStr}</span>` : ''}
                                    </div>
                                 </div>
                            </div>
                             <div style="padding-left: 8px;">
                                <input type="checkbox" style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer; border-radius: 4px;" onclick="window.quickCompleteTask('${t.id}', this)" title="Segna come completata">
                            </div>
                        </div>
                    `;
                });
            }
            if (!hasContent) html += `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun task da completare.</div>`;
        }

        container.innerHTML = html;

        // Try to update Tab Counts if buttons exist in parent
        // This is a bit of a hack to avoid re-rendering the whole header, but effective.
        try {
            const card = container.closest('.glass-card');
            if (card) {
                const tabs = card.querySelectorAll('.tab-pill');
                if (tabs.length >= 2) {
                    // Update counts safely without killing icons
                    const setCnt = (btn, n) => {
                        const s = btn.querySelector('.tab-count');
                        if (s) s.textContent = n;
                    };
                    setCnt(tabs[0], countTask);
                    setCnt(tabs[1], countEvent);
                }
            }
        } catch (e) {/* ignore */ }

    } catch (e) {
        console.error("Render Activities Error:", e);
        container.innerHTML = `<div style="color: #f87171; padding: 1rem;">Errore visualizzazione: ${e.message}</div>`;
    }
}

// Helper for Task Completion
window.quickCompleteTask = async function (id, element) {
    const row = element.closest('.activity-row');
    const container = row?.parentElement;
    if (row) row.style.opacity = '0.4';

    try {
        await updatePMItem(id, { status: 'done' });

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

            // Instantly update the counter in the tab
            const card = row.closest('.glass-card');
            if (card) {
                const tabs = card.querySelectorAll('.tab-pill');
                if (tabs.length > 0) {
                    const countEl = tabs[0].querySelector('.tab-count'); // Task count is always first
                    if (countEl) {
                        const current = parseInt(countEl.textContent) || 0;
                        countEl.textContent = Math.max(0, current - 1);
                    }
                }
            }

            setTimeout(() => {
                row.remove();
                if (container && container.children.length === 0) {
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
        alert("Errore nel completamento task.");
    }
};

function renderProjects(container, projects) {
    if (!projects || !projects.length) {
        const kpiContainer = document.getElementById('hp-bottom-kpis');
        if (kpiContainer) kpiContainer.innerHTML = '';
        container.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 4rem; opacity: 0.1; margin-bottom: 1rem;">folder_open</span>
                <p style="font-size: 1.1rem; font-weight: 500;">Nessun progetto attivo in questa categoria.</p>
            </div>
        `;
        return;
    }

    // Calculate overall stats for KPIs
    const activeTab = document.getElementById('hp-bottom-tab-projects')?.classList.contains('active') ? 'Commesse' : 'Progetti';
    const totalProjects = projects.length;
    const totalActivities = projects.reduce((acc, p) => acc + (p.stats?.activities || 0), 0);
    const totalTasks = projects.reduce((acc, p) => acc + (p.stats?.tasks || 0), 0);
    const totalAppts = projects.reduce((acc, p) => acc + (p.stats?.appointments || 0), 0);
    const totalOverdue = projects.reduce((acc, p) => acc + (p.stats?.overdue || 0), 0);

    const kpiHtml = `
        <div class="widget-kpi-row">
            <div class="kpi-pill status-info">
                <span class="kpi-label">${activeTab}</span>
                <span class="kpi-value">${totalProjects}</span>
            </div>
            <div class="kpi-pill">
                <span class="kpi-label">Attività</span>
                <span class="kpi-value">${totalActivities}</span>
            </div>
            <div class="kpi-pill">
                <span class="kpi-label">Task</span>
                <span class="kpi-value">${totalTasks}</span>
            </div>
            ${totalAppts > 0 ? `
                <div class="kpi-pill status-success">
                    <span class="kpi-label">Appuntamenti</span>
                    <span class="kpi-value"><i class="material-icons-round">event</i> ${totalAppts}</span>
                </div>
            ` : ''}
            ${totalOverdue > 0 ? `
                <div class="kpi-pill status-danger">
                    <span class="kpi-label">In Ritardo</span>
                    <span class="kpi-value"><i class="material-icons-round">history</i> ${totalOverdue}</span>
                </div>
            ` : ''}
        </div>
    `;

    const kpiContainer = document.getElementById('hp-bottom-kpis');
    if (kpiContainer) kpiContainer.innerHTML = kpiHtml;

    container.innerHTML = projects.map(p => {
        const isTask = p.type === 'task';
        const clickAction = isTask ? `openPmItemDetails('${p.id}', null)` : `window.location.hash='${p.link.replace('#', '')}'`;

        const s = p.stats || { tasks: 0, activities: 0, overdue: 0, imminent: 0, appointments: 0 };

        return `
        <div class="project-card" onclick="${clickAction}">
            <div class="card-main">
                <div class="card-meta">
                    ${p.order_number ? `<span class="card-badge-id">#${p.order_number}</span>` : ''}
                    ${p.client ? `<span>${p.client}</span>` : ''}
                </div>
                <div class="card-title">${p.title}</div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                <!-- Granular Stats with Icons -->
                ${s.overdue > 0 ? `
                    <div title="In Ritardo" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: #fee2e2; color: #ef4444; border-radius: 6px; font-weight: 800; font-size: 0.65rem;">
                        <span class="material-icons-round" style="font-size: 11px;">history</span>
                        <span>${s.overdue}</span>
                    </div>
                ` : ''}
                ${s.activities > 0 ? `
                    <div title="Attività" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: #f3f4f6; color: #4b5563; border-radius: 6px; font-weight: 800; font-size: 0.65rem;">
                        <span class="material-icons-round" style="font-size: 11px;">assignment</span>
                        <span>${s.activities}</span>
                    </div>
                ` : ''}
                ${s.tasks > 0 ? `
                    <div title="Task" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: #f3e8ff; color: #7e22ce; border-radius: 6px; font-weight: 800; font-size: 0.65rem;">
                        <span class="material-icons-round" style="font-size: 11px;">task_alt</span>
                        <span>${s.tasks}</span>
                    </div>
                ` : ''}
                ${s.appointments > 0 ? `
                    <div title="Appuntamenti" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: #dcfce7; color: #15803d; border-radius: 6px; font-weight: 800; font-size: 0.65rem;">
                        <span class="material-icons-round" style="font-size: 11px;">event</span>
                        <span>${s.appointments}</span>
                    </div>
                ` : ''}

                <span class="material-icons-round" style="color: var(--text-tertiary); opacity: 0.3; font-size: 16px; margin-left: 2px;">chevron_right</span>
            </div>
        </div>
    `}).join('');
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
                        ${clientPart ? `<span>· ${clientPart}</span>` : ''}
                        ${t.breadcrumb ? `<span class="row-breadcrumb">· ${t.breadcrumb}</span>` : ''}
                        ${dueText ? `<span style="${isOverdue ? 'color: #ef4444; font-weight: 700;' : ''}">· ${dueText}</span>` : ''}
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
                    <span class="material-icons-round" style="color: var(--text-tertiary); opacity: 0.3; font-size: 16px; margin-left: 2px;">chevron_right</span>
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
                        ${clientPart ? `<span>· ${clientPart}</span>` : ''}
                        ${t.breadcrumb ? `<span class="row-breadcrumb">· ${t.breadcrumb}</span>` : ''}
                        ${dateStr ? `<span style="${isOverdue ? 'color: #ef4444; font-weight: 700;' : ''}">· ${isOverdue ? 'Scaduto: ' : 'Scadenza: '}${dateStr}</span>` : ''}
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
                    <span class="material-icons-round" style="color: var(--text-tertiary); opacity: 0.3; font-size: 16px;">chevron_right</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- GLOBAL HELPER HANDLERS ---
// --- GLOBAL HELPER HANDLERS ---
// Attached to window to be accessible from HTML onclick attributes

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


