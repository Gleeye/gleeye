// Async data fetchers used by the homepage role-based dispatcher.
// Extracted from homepage-alt.js (Fase split-monstro step 2).
//
// Public exports:
//   - fetchDateEvents(collaboratorId, startArg, endArg?)
//   - fetchRecentProjects(collabId, userUuid)
//   - fetchAdminOperationalAlerts()
//   - fetchInternalProjects(collaboratorId, userId, isAdmin?)
//   - fetchCollaboratorAssignments(collaboratorId)
//   - fetchCollaboratorPayments(collaboratorId)
//   - fetchInternalHubsAndClusters(collaboratorId, userId, isPrivileged?, isPartnerStrict?)
//
// External deps: only `state` (singleton) and `supabase` (client).

import { state } from '/js/modules/state.js?v=8000';
import { supabase } from '../../modules/config.js?v=8000';

export async function fetchDateEvents(collaboratorId, startArg, endArg) {
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

export async function fetchRecentProjects(collabId, userUuid) {
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
export async function fetchAdminOperationalAlerts() {
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

export async function fetchCollaboratorAssignments(collaboratorId) {
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

export async function fetchCollaboratorPayments(collaboratorId) {
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


export async function fetchInternalHubsAndClusters(collaboratorId, userId, isPrivileged = false, isPartnerStrict = false) {
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

