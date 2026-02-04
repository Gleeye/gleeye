import { supabase } from './config.js?v=156';
import { state } from './state.js?v=156';
import { triggerAppointmentNotifications } from '../features/notifications/appointment_notifications.js?v=156';

// --- SPACES ---

export async function fetchProjectSpaceForOrder(orderId) {
    // 1. Try to find existing space
    const { data: spaces, error } = await supabase
        .from('pm_spaces')
        .select('*')
        .eq('type', 'commessa')
        .eq('ref_ordine', orderId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching space:", error);
        return null;
    }

    if (spaces && spaces.length > 0) {
        if (spaces.length > 1) {
            console.warn(`[PM API] Multiple spaces found for order ${orderId}. Picking the most recent one.`, spaces);
        }
        return spaces[0];
    }

    // 2. Lazy Create
    console.log("Space not found for order, attempting lazy creation...", orderId);

    // Default PM is current user for now if they trigger creation (usually PM/Admin opens the page)
    const { data: newSpace, error: createError } = await supabase
        .from('pm_spaces')
        .insert({
            type: 'commessa',
            ref_ordine: orderId,
            default_pm_user_ref: state.profile?.id
        })
        .select()
        .single();

    if (createError) {
        console.error("Lazy creation failed (likely permissions):", createError);
        return null;
    }

    // Auto-assign as PM in the new table too
    if (state.profile?.id) {
        await assignUserToSpace(newSpace.id, state.profile.id, 'pm');
    }

    return newSpace;
}

export async function fetchSpace(spaceId) {
    const { data, error } = await supabase
        .from('pm_spaces')
        .select(`
            *,
            orders:ref_ordine (
                id, order_number, title, 
                clients (business_name)
            )
        `)
        .eq('id', spaceId)
        .single();
    if (error) {
        console.error("Error fetching space:", error);
        return null;
    }
    return data;
}

export async function fetchInternalSpaces() {
    const { data, error } = await supabase
        .from('pm_spaces')
        .select('*')
        .eq('type', 'interno')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching internal spaces:", error);
        return [];
    }
    return data;
}

export async function createInternalSpace(name) {
    const { data, error } = await supabase
        .from('pm_spaces')
        .insert({
            type: 'interno',
            name: name,
            default_pm_user_ref: state.profile?.id
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// --- ITEMS ---

export async function fetchProjectItems(spaceId) {
    // Fetch items and their relations
    // We fetch raw relations and map in UI to avoid complex join issues if any
    const { data, error } = await supabase
        .from('pm_items')
        .select(`
            *,
            pm_item_assignees ( user_ref, role ),
            pm_item_incarichi ( incarico_ref )
        `)
        .eq('space_ref', spaceId)
        .order('created_at', { ascending: true }); // Important for stability, but UI will tree-sort

    if (error) {
        console.error("Error fetching items:", error);
        return [];
    }
    return data || [];
}

export async function createPMItem(itemData) {
    // itemData: { space_ref, title, ... }
    const { data, error } = await supabase
        .from('pm_items')
        .insert({
            ...itemData,
            created_by_user_ref: state.profile?.id
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updatePMItem(itemId, itemData) {
    const { data, error } = await supabase
        .from('pm_items')
        .update({
            ...itemData,
            updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deletePMItem(itemId) {
    const { error } = await supabase
        .from('pm_items')
        .delete()
        .eq('id', itemId);
    if (error) throw error;
    return true;
}

// --- ASSIGNMENTS & LINKS ---

export async function fetchItemAssignees(itemId) {
    // Fetch basic assignee data without FK joins (avoids PGRST200 schema cache issues)
    const { data, error } = await supabase
        .from('pm_item_assignees')
        .select('id, user_ref, collaborator_ref, role, created_at')
        .eq('pm_item_ref', itemId);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return _expandAssignees(data);
}

export async function assignUserToItem(itemId, userIdOrCollabId, role = 'assignee', isCollabId = false) {
    const payload = { pm_item_ref: itemId, role };
    if (isCollabId) {
        payload.collaborator_ref = userIdOrCollabId;
    } else {
        payload.user_ref = userIdOrCollabId;
    }

    const { data, error } = await supabase
        .from('pm_item_assignees')
        .insert(payload)
        .select();
    if (error) throw error;
    return data;
}

export async function removeUserFromItem(itemId, userIdOrCollabId, isCollabId = false) {
    let query = supabase
        .from('pm_item_assignees')
        .delete()
        .eq('pm_item_ref', itemId);

    if (isCollabId) {
        query = query.eq('collaborator_ref', userIdOrCollabId);
    } else {
        query = query.eq('user_ref', userIdOrCollabId);
    }

    const { error } = await query;
    if (error) throw error;
}

export async function linkIncaricoToItem(itemId, incaricoId) {
    // incaricoId is TEXT from assignments.id
    const { data, error } = await supabase
        .from('pm_item_incarichi')
        .insert({ pm_item_ref: itemId, incarico_ref: incaricoId })
        .select();
    if (error) throw error;
    return data;
}

export async function unlinkIncaricoFromItem(itemId, incaricoId) {
    const { error } = await supabase
        .from('pm_item_incarichi')
        .delete()
        .eq('pm_item_ref', itemId)
        .eq('incarico_ref', incaricoId);
    if (error) throw error;
}

// --- SPACE ASSIGNEES ---

export async function fetchSpaceAssignees(spaceId) {
    const { data, error } = await supabase
        .from('pm_space_assignees')
        .select('id, user_ref, collaborator_ref, role, created_at')
        .eq('pm_space_ref', spaceId);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Reusing the same profile/collab expansion logic as fetchItemAssignees
    return _expandAssignees(data);
}

export async function assignUserToSpace(spaceId, userIdOrCollabId, role = 'pm', isCollabId = false) {
    const payload = { pm_space_ref: spaceId, role };
    if (isCollabId) {
        payload.collaborator_ref = userIdOrCollabId;
    } else {
        payload.user_ref = userIdOrCollabId;
    }

    const { data, error } = await supabase
        .from('pm_space_assignees')
        .insert(payload)
        .select();
    if (error) throw error;
    return data;
}

export async function removeUserFromSpace(spaceId, userIdOrCollabId, isCollabId = false) {
    let query = supabase
        .from('pm_space_assignees')
        .delete()
        .eq('pm_space_ref', spaceId);

    if (isCollabId) {
        query = query.eq('collaborator_ref', userIdOrCollabId);
    } else {
        query = query.eq('user_ref', userIdOrCollabId);
    }

    const { error } = await query;
    if (error) throw error;
}

// Internal helper for expanding user/collab data
async function _expandAssignees(data) {
    const userIds = [...new Set(data.filter(r => r.user_ref).map(r => r.user_ref))];
    const collabIds = [...new Set(data.filter(r => r.collaborator_ref).map(r => r.collaborator_ref))];

    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, avatar_url, email')
            .in('id', userIds);
        if (profiles) profiles.forEach(p => profilesMap[p.id] = p);
    }

    let collabsMap = {};
    if (collabIds.length > 0) {
        const { data: collabs } = await supabase
            .from('collaborators')
            .select('id, full_name, first_name, last_name, avatar_url')
            .in('id', collabIds);
        if (collabs) collabs.forEach(c => collabsMap[c.id] = c);
    }

    return data.map(record => {
        let user = null;
        let profile = record.user_ref ? profilesMap[record.user_ref] : null;
        let collaborator = record.collaborator_ref ? collabsMap[record.collaborator_ref] : null;

        // Fallback: Link via State if DB link missing
        if (!collaborator && record.user_ref) {
            collaborator = state.collaborators?.find(c => c.user_id === record.user_ref);
        }

        if (profile) {
            user = { ...profile };
            // If profile has no name but we have a collaborator, try to fill gaps
            if ((!user.first_name || user.first_name === 'Utente') && collaborator) {
                user.first_name = collaborator.first_name || collaborator.full_name?.split(' ')[0] || user.first_name;
                user.last_name = collaborator.last_name || collaborator.full_name?.split(' ').slice(1).join(' ') || user.last_name;

                if (!user.avatar_url && collaborator.avatar_url) {
                    user.avatar_url = collaborator.avatar_url;
                }
            }
        } else if (collaborator) {
            user = {
                id: collaborator.id, // Using collab ID as ID if no user ID
                first_name: collaborator.first_name || collaborator.full_name?.split(' ')[0],
                last_name: collaborator.last_name || collaborator.full_name?.split(' ').slice(1).join(' '),
                full_name: collaborator.full_name,
                avatar_url: collaborator.avatar_url
            };
        }

        return { ...record, user, is_collab_assignment: !!record.collaborator_ref };
    });
}

// --- COMMENTS ---

export async function fetchItemComments(itemId) {
    const { data, error } = await supabase
        .from('pm_item_comments')
        .select('*') // Mapping authors in UI
        .eq('pm_item_ref', itemId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function addComment(itemId, body) {
    const { data, error } = await supabase
        .from('pm_item_comments')
        .insert({
            pm_item_ref: itemId,
            author_user_ref: state.profile?.id,
            body
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// --- MY WORK DASHBOARD ---

export async function fetchMyWorkItems() {
    const userId = state.profile?.id;
    if (!userId) return [];

    // Query Strategy:
    // We cannot easily do complex OR across joins in Supabase directly in one efficient query 
    // without a stored function or complex syntax.
    // "Item where (I am assignee) OR (Item linked to assignment where I am collaborator)"

    // Easier approach for MVP:
    // 1. Fetch items directly assigned
    // 2. Fetch assignments I own -> Fetch items linked to those assignments
    // 3. Merge and dedupe

    // 1. Direct assignments
    const { data: directData, error: directError } = await supabase
        .from('pm_items')
        .select('*, pm_spaces(id, type, name, ref_ordine)')
        .eq('pm_item_assignees.user_ref', userId)
        // Note: filtering on joined table requires correct syntax or inner join. 
        // Supabase: !inner to filter
        .not('archived_at', 'is', 'null'); // active only?

    // Actually, simple client-side logic avoids complex RLS filter wrestling if we trust RLS visibility.
    // IF RLS IS WORKING, `select * from pm_items` will only return items I can see.
    // BUT "My Work" is specific: items I need to ACT on. 
    // "I can see" != "I must do".
    // I can see items linked to my assignment, so 'My Work' ~ 'All items I can see'? 
    // User request: "My Work: item dove sono assignee OR collegati ai miei incarichi"
    // RLS: "Un utente può SELECT un item se vale almeno una: assignee OR collegato a suo incarico OR PM"
    // So if I am NOT PM, `select *` IS EXACTLY "My Work".
    // If I AM PM/Admin, `select *` is EVERYTHING (too much).

    // So "My Work" query needs to be explicit for PMs.

    // Let's implement an explicit check.

    // Step 1: Get my assignments (assignments.id)
    const myCollab = state.collaborators?.find(c => c.user_id === userId);
    let myAssignmentIds = [];
    if (myCollab) {
        const { data: asses } = await supabase.from('assignments').select('id').eq('collaborator_id', myCollab.id);
        if (asses) myAssignmentIds = asses.map(a => a.id);
    }

    // Query
    let query = supabase
        .from('pm_items')
        .select(`
            *,
            pm_spaces (id, type, name, orders:ref_ordine(order_number, title)),
            pm_item_assignees!inner(user_ref)
        `)
        .eq('pm_item_assignees.user_ref', userId)
        .is('archived_at', null);

    // This gets only directly assigned. 
    // We need OR linked to assignments.
    // Supabase OR syntax is tricky with joins.

    // Alternative:
    // `select * from pm_items where id in (select pm_item_ref from pm_item_assignees where user_ref = me) 
    //  OR id in (select pm_item_ref from pm_item_incarichi where incarico_ref in myAssignmentIds)`

    // Since we have `myAssignmentIds` (list of strings), we can facilitate.
    // But `or()` filter in supabase JS client is top-level.

    // Let's rely on 2 separate queries for MVP stability.

    const p1 = supabase
        .from('pm_items')
        .select('*, pm_spaces(id, type, name, orders:ref_ordine(order_number, title))')
        .eq('pm_item_assignees.user_ref', userId) // This requires !inner on assignees? 
    // Actually: .select('*, assignees:pm_item_assignees!inner(user_ref)').eq('assignees.user_ref', userId)

    // Wait, let's look at `pm_item_assignees` filtering.
    const { data: assignedItems } = await supabase
        .from('pm_items')
        .select('*, pm_spaces(id, type, name, orders:ref_ordine(order_number, title)), pm_item_assignees!inner(user_ref)')
        .eq('pm_item_assignees.user_ref', userId)
        .is('archived_at', null);

    let linkedItems = [];
    if (myAssignmentIds.length > 0) {
        const { data: li } = await supabase
            .from('pm_items')
            .select('*, pm_spaces(id, type, name, orders:ref_ordine(order_number, title)), pm_item_incarichi!inner(incarico_ref)')
            .in('pm_item_incarichi.incarico_ref', myAssignmentIds)
            .is('archived_at', null);
        if (li) linkedItems = li;
    }

    // Merge de-dupe
    const map = new Map();
    (assignedItems || []).forEach(i => map.set(i.id, i));
    (linkedItems || []).forEach(i => map.set(i.id, i));

    return Array.from(map.values());
}

// --- TEAM AGGREGATION FOR COMMESSE DASHBOARD ---

export async function fetchCommesseTeamSummary() {
    // 1. Get all spaces linked to orders
    const { data: spaces, error: spaceError } = await supabase
        .from('pm_spaces')
        .select('id, ref_ordine, default_pm_user_ref, pm_space_assignees(user_ref, collaborator_ref, role)')
        .eq('type', 'commessa');

    if (spaceError) {
        console.error("Error fetching spaces for summary:", spaceError);
        return {};
    }

    const spaceIds = spaces.map(s => s.id);
    if (spaceIds.length === 0) return {};

    // 2. Get active items and their assignees/assignments
    // We want to know who is ACTIVELY working.
    // Definition of active worker:
    // - Is a PM of the space
    // - Is assigned to a task that is NOT done/completed
    // - Is linked via an assignment to a task that is NOT done/completed

    const { data: activeItems, error: itemError } = await supabase
        .from('pm_items')
        .select(`
            id, 
            pm_space_ref,
            status,
            pm_item_assignees (user_ref, collaborator_ref),
            pm_item_incarichi (
                incarico_ref,
                assignments (collaborator_id)
            )
        `)
        .in('pm_space_ref', spaceIds)
        .neq('status', 'done')
        .neq('status', 'completed'); // exclude finished tasks

    // 3. Aggregate by Order ID
    const teamByOrder = {}; // { orderId: [ { userId, collabId, role } ] }

    // Helper to get collab info from state (assume state.collaborators is loaded)
    const getCollabInfo = (uid, cid) => {
        if (!state.collaborators) return null;
        return state.collaborators.find(c =>
            (uid && c.user_id === uid) ||
            (cid && c.id === cid)
        );
    };

    spaces.forEach(space => {
        if (!space.ref_ordine) return; // Should not happen for type commessa

        const team = new Map(); // Map<string_key, { ...user }>

        // A. Add PMs (Space Users)
        if (space.pm_space_assignees) {
            space.pm_space_assignees.forEach(u => {
                const key = u.user_ref || u.collaborator_ref;
                if (!key) return;

                // Resolve details
                const c = getCollabInfo(u.user_ref, u.collaborator_ref);
                team.set(String(key), {
                    id: key,
                    user_id: u.user_ref,
                    collab_id: u.collaborator_ref,
                    name: c ? c.full_name : 'PM', // Fallback, will refine in view
                    avatar: c?.avatar_url,
                    role: 'pm',
                    initials: c ? (c.full_name || '').substring(0, 2).toUpperCase() : 'PM'
                });
            });
        }

        // B. Add Active Item Assignees
        const spaceItems = activeItems?.filter(i => i.pm_space_ref === space.id) || [];

        spaceItems.forEach(item => {
            // Direct assignees
            item.pm_item_assignees?.forEach(a => {
                const key = a.user_ref || a.collaborator_ref;
                if (!key) return;
                if (team.has(String(key)) && team.get(String(key)).role === 'pm') return; // PM priority

                const c = getCollabInfo(a.user_ref, a.collaborator_ref);
                team.set(String(key), {
                    id: key,
                    user_id: a.user_ref,
                    collab_id: a.collaborator_ref,
                    name: c ? c.full_name : 'User',
                    avatar: c?.avatar_url,
                    role: 'assignee',
                    initials: c ? (c.full_name || 'U').substring(0, 2).toUpperCase() : 'U'
                });
            });

            // Linked assignments
            item.pm_item_incarichi?.forEach(inc => {
                const collabId = inc.assignments?.collaborator_id;
                if (!collabId) return;
                const key = collabId;
                if (team.has(String(key)) && team.get(String(key)).role === 'pm') return;

                const c = getCollabInfo(null, collabId);
                team.set(String(key), {
                    id: key,
                    user_id: c?.user_id,
                    collab_id: collabId,
                    name: c ? c.full_name : 'Collab',
                    avatar: c?.avatar_url,
                    role: 'assignee',
                    initials: c ? (c.full_name || 'C').substring(0, 2).toUpperCase() : 'C'
                });
            });
        });

        // Convert Map to Array, PMs first
        const sortedTeam = Array.from(team.values()).sort((a, b) => {
            if (a.role === 'pm' && b.role !== 'pm') return -1;
            if (a.role !== 'pm' && b.role === 'pm') return 1;
            return 0;
        });

        teamByOrder[space.ref_ordine] = sortedTeam;
    });


    return teamByOrder;
}

// --- APPOINTMENTS (SPRINT 1) ---

export async function fetchAppointmentTypes() {
    const { data, error } = await supabase
        .from('appointment_types')
        .select('*')
        .order('name');
    if (error) {
        console.error("Error fetching appointment types:", error);
        return [];
    }
    return data || [];
}

export async function fetchAppointments(orderId) {
    if (!orderId) return [];

    // 1. Fetch appointments linked to this order
    const { data, error } = await supabase
        .from('appointments')
        .select(`
            *,
            appointment_type_links (
                appointment_types (id, name, color, icon)
            ),
            appointment_internal_participants (
                collaborator_id, role, status
            ),
            appointment_client_participants (
                contact_id
            )
        `)
        .eq('order_id', orderId)
        .neq('status', 'annullato') // Default filter? Or fetch all? user said "filtri: Futuri/Passati, Tipi... Stato"
        .order('start_time', { ascending: true });

    if (error) {
        console.error("Error fetching appointments:", error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // 2. Expand Participants (Internal & Client)
    // We reuse _expandAssignees logic for internal, but adapted manually here or make generic
    // Let's expand manually to keep it isolated for now.

    // Internal
    const collabIds = new Set();
    data.forEach(a => {
        a.appointment_internal_participants?.forEach(p => collabIds.add(p.collaborator_id));
    });

    let collabsMap = {};
    if (collabIds.size > 0) {
        const { data: collabs } = await supabase
            .from('collaborators')
            .select('id, full_name, avatar_url, role')
            .in('id', Array.from(collabIds));
        if (collabs) collabs.forEach(c => collabsMap[c.id] = c);
    }

    // Client/External
    const contactIds = new Set();
    data.forEach(a => {
        a.appointment_client_participants?.forEach(p => contactIds.add(p.contact_id));
    });

    let contactsMap = {};
    if (contactIds.size > 0) {
        // Assuming 'contacts' table or 'order_contacts' joined with contacts.
        // User said 'order_contacts' table exists. But FK was to 'contacts'.
        // Let's fetch from 'contacts' table directly.
        const { data: contacts } = await supabase
            .from('contacts')
            .select('id, first_name, last_name, email, phone')
            .in('id', Array.from(contactIds));
        if (contacts) contacts.forEach(c => contactsMap[c.id] = c);
    }

    // Map back
    return data.map(appt => {
        // Types
        const types = appt.appointment_type_links?.map(l => l.appointment_types) || [];

        // Internal Parts
        const internal = appt.appointment_internal_participants?.map(p => ({
            ...p,
            user: collabsMap[p.collaborator_id] || { full_name: 'Unknown' }
        })) || [];

        // Client Parts
        const client = appt.appointment_client_participants?.map(p => ({
            ...p,
            contact: contactsMap[p.contact_id] || { first_name: 'Unknown' }
        })) || [];

        return {
            ...appt,
            types,
            participants: { internal, client }
        };
    });
}

export async function fetchAppointment(id) {
    const { data, error } = await supabase
        .from('appointments')
        .select(`
            *,
            appointment_type_links (
                appointment_types (id, name, color, icon)
            ),
            appointment_internal_participants (
                collaborator_id, role, status
            ),
            appointment_client_participants (
                contact_id
            )
        `)
        .eq('id', id)
        .single();

    if (error) return null;
    return data;
}

export async function saveAppointment(apptData) {
    // 1. Prepare Core Data
    const {
        id, order_id, title, start_time, end_time,
        location, mode, note, status,
        types = [], internal_participants = [], client_participants = []
    } = apptData;

    const isUpdate = !!id;
    let oldAppt = null;

    if (isUpdate) {
        oldAppt = await fetchAppointment(id);
    }

    // 2. Upsert Appointment
    const payload = {
        order_id, title, start_time, end_time, location, mode, note, status
    };
    if (id) payload.id = id;

    const { data: saved, error } = await supabase
        .from('appointments')
        .upsert(payload)
        .select()
        .single();

    if (error) throw error;

    // 3. Update Relations (Delete All + Insert New strategy for MVP)
    const apptId = saved.id;

    // A. Types
    await supabase.from('appointment_type_links').delete().eq('appointment_id', apptId);
    if (types.length > 0) {
        await supabase.from('appointment_type_links').insert(
            types.map(tId => ({ appointment_id: apptId, type_id: tId }))
        );
    }

    // B. Internal Participants
    await supabase.from('appointment_internal_participants').delete().eq('appointment_id', apptId);
    if (internal_participants.length > 0) {
        await supabase.from('appointment_internal_participants').insert(
            internal_participants.map(p => ({
                appointment_id: apptId,
                collaborator_id: p.collaborator_id,
                role: p.role || 'participant',
                status: p.status || 'pending'
            }))
        );
    }

    // C. Client Participants
    await supabase.from('appointment_client_participants').delete().eq('appointment_id', apptId);
    if (client_participants.length > 0) {
        await supabase.from('appointment_client_participants').insert(
            client_participants.map(p => ({
                appointment_id: apptId,
                contact_id: p.contact_id
            }))
        );
    }

    // 4. Fetch Fresh Data for Notifications
    const items = await fetchAppointments(order_id);
    const fullAppt = items.find(a => a.id === apptId);

    // 5. Trigger Notifications
    if (fullAppt) {
        let eventType = isUpdate ? 'updated' : 'invited';

        // Check for confirmed state transition
        if (isUpdate && oldAppt && oldAppt.status === 'bozza' && fullAppt.status === 'confermato') {
            eventType = 'confirmed';
        }

        // Suppress draft invites
        if (fullAppt.status === 'bozza' && eventType === 'invited') {
            console.log("Skipping notification for Draft creation");
        } else {
            await triggerAppointmentNotifications(eventType, fullAppt, oldAppt, state.session?.user?.id);
        }
    }

    // 6. Google Sync (Sync-Fire)
    triggerGoogleSync(apptId, isUpdate ? 'update' : 'create');

    return fullAppt;
}

export async function deleteAppointment(id) {
    // 1. Fetch before delete (for notification context)
    const oldAppt = await fetchAppointment(id);

    // 2. Delete
    // Need to delete links first if no CASCADE? Schema has ON DELETE CASCADE usually.
    // Assuming Cascade is set in migration.
    const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

    if (error) throw error;

    // 3. Notify
    if (oldAppt) {
        // Map structure for notification logic
        const mappedAppt = {
            ...oldAppt,
            participants: {
            }
        };
        await triggerAppointmentNotifications('cancelled', mappedAppt, null, state.session?.user?.id);
    }

    // 4. Trigger Google Sync (Delete)
    triggerGoogleSync(id, 'delete');

    return true;
}

// --- GOOGLE SYNC HELPER ---
async function triggerGoogleSync(appointmentId, action) {
    console.log(`[GoogleSync] Triggering ${action} for ${appointmentId}...`);
    try {
        const { data, error } = await supabase.functions.invoke('sync-appointment-google', {
            body: { appointment_id: appointmentId, action: action }
        });

        if (error) throw error;
        console.log("[GoogleSync] Result:", data);
    } catch (err) {
        console.warn("[GoogleSync] Ignored error:", err);
    }
}

// --- UNIFIED CALENDAR UTILS ---

export async function fetchCollaboratorAppointments(collaboratorId) {
    // Determine range (optional optimization, for now fetch all active?)
    // Or just recently updated? 
    // Let's fetch reasonably recent ones (e.g. last 3 months + future)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data, error } = await supabase
        .from('appointments')
        .select(`
            id, title, start_time, end_time, location, mode, note, status,
            order_id, 
            orders:order_id ( order_number, title, clients ( business_name ) ),
            appointment_types ( name, color ),
            appointment_internal_participants!inner ( collaborator_id )
        `)
        .eq('appointment_internal_participants.collaborator_id', collaboratorId)
        .gte('start_time', threeMonthsAgo.toISOString())
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Error fetching collaborator appointments:', error);
        throw error;
    }

    return data;
}
