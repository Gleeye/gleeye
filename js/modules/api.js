import { supabase } from './config.js?v=123';
import { state } from './state.js?v=123';

export async function fetchProfile() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return null;

    let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile && !error) {
        // Check if this user is a collaborator
        const { data: collab } = await supabase
            .from('collaborators')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

        if (collab) {
            console.log("Creating profile for collaborator:", user.email);
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    role: 'user',
                    full_name: collab.full_name,
                    is_onboarded: true
                })
                .select()
                .single();

            if (!createError) {
                profile = newProfile;
                // Link collaborator to user_id if not already linked
                if (!collab.user_id) {
                    await supabase.from('collaborators').update({ user_id: user.id }).eq('id', collab.id);
                }
            }
        } else {
            console.log("Creating default user profile for:", user.email);
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    role: 'user',
                    full_name: user.email.split('@')[0],
                    is_onboarded: false
                })
                .select()
                .single();
            if (!createError) profile = newProfile;
        }
    }

    // SUPER ADMIN RESCUE: If profile is still null, but it's YOU, force access.
    if (!profile && user?.email === 'davide@gleeye.eu') {
        console.warn("DEBUG: Profile not found for Super Admin. Creating ephemeral admin profile.");
        profile = {
            id: user.id,
            email: user.email,
            role: 'admin',
            full_name: 'Davide Gentile', // Default name
            is_onboarded: true
        };
    }

    if (profile) {
        // EMERGENCY FALLBACK: Force admin for known users if role is missing
        if (profile.email === 'davide@gleeye.eu' && !profile.role) {
            console.warn("DEBUG: Role missing for admin user (davide@gleeye.eu), forcing 'admin'.");
            profile.role = 'admin';
        }

        state.profile = profile;
        return profile;
    } else {
        console.warn("Profile not found and could not be created.");
        // DEBUG ALERT
        if (error) {
            window.alert(`DEBUG PROFILE ERROR:\nCode: ${error.code}\nMsg: ${error.message}\nHint: ${error.hint}`);
        } else {
            window.alert(`DEBUG PROFILE MISSING: No error, but no profile found for ID ${user.id}`);
        }
        return null;
    }
}

export async function fetchClients() {
    console.log("Fetching clients...");
    const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .order('business_name', { ascending: true });

    if (error) {
        console.error("Clients fetch failed:", error);
        return;
    }
    state.clients = clients || [];
}

export async function fetchOrders() {
    console.log("Fetching orders with commercial details...");
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id,
            order_number,
            title,
            status_works,
            offer_status,
            price_planned,
            price_actual,
            cost_planned,
            cost_actual,
            revenue_planned,
            revenue_actual,
            total_price,
            price_final,
            cost_final,
            created_at,
            payment_mode,
            deposit_percentage,
            balance_percentage,
            installment_type,
            installments_count,
            client_id,
            clients (id, business_name, client_code),
             order_collaborators (
                role_in_order,
                collaborators (id, full_name, role)
            )
        `)
        .order('order_number', { ascending: false });

    if (error) {
        console.error("Orders fetch failed:", error);
        return;
    }
    state.orders = orders || [];
}

export async function upsertOrder(order) {
    console.log("Upserting order:", order);
    const dbData = { ...order };
    delete dbData.clients; // remove joined objects
    delete dbData.contacts;
    delete dbData.account;
    delete dbData.order_collaborators;

    // Remove any undefined keys to avoid db errors
    Object.keys(dbData).forEach(key => dbData[key] === undefined && delete dbData[key]);

    const { data, error } = await supabase
        .from('orders')
        .upsert(dbData)
        .select(`
            id,
            order_number,
            title,
            status_works,
            offer_status,
            price_planned,
            price_actual,
            cost_planned,
            cost_actual,
            revenue_planned,
            revenue_actual,
            total_price,
            price_final,
            cost_final,
            created_at,
            payment_mode,
            deposit_percentage,
            balance_percentage,
            installment_type,
            installments_count,
            client_id,
            clients (id, business_name, client_code),
             order_collaborators (
                role_in_order,
                collaborators (id, full_name, role)
            )
        `)
        .single();

    if (error) {
        console.error("Order upsert failed:", error);
        throw error;
    }

    const index = state.orders.findIndex(o => o.id === data.id);
    if (index >= 0) {
        state.orders[index] = data;
    } else {
        state.orders.push(data);
    }
    return data;
}

export async function updateOrder(id, updates) {
    console.log("Updating order partial:", id, updates);
    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select(`
            id,
            order_number,
            title,
            status_works,
            offer_status,
            price_planned,
            price_actual,
            cost_planned,
            cost_actual,
            revenue_planned,
            revenue_actual,
            total_price,
            price_final,
            cost_final,
            created_at,
            payment_mode,
            deposit_percentage,
            balance_percentage,
            installment_type,
            installments_count,
            client_id,
            clients (id, business_name, client_code),
             order_collaborators (
                role_in_order,
                collaborators (id, full_name, role)
            )
        `)
        .single();

    if (error) {
        console.error("Order update failed:", error);
        throw error;
    }

    const index = state.orders.findIndex(o => o.id === data.id);
    if (index >= 0) {
        state.orders[index] = data;
    }
    return data;
}

export async function updateOrderEconomics(id, { price_final, cost_final }) {
    console.log("Updating order economics:", id, { price_final, cost_final });
    const { data, error } = await supabase
        .from('orders')
        .update({ price_final, cost_final })
        .eq('id', id)
        .select('id, price_final, cost_final')
        .single();

    if (error) {
        console.error("Order economics update failed:", error);
        throw error;
    }

    // Update local state
    const index = state.orders.findIndex(o => o.id === data.id);
    if (index >= 0) {
        state.orders[index] = { ...state.orders[index], ...data };
    }
    return data;
}

export async function fetchCollaborators() {
    console.log("Fetching collaborators...");
    const { data: collaborators, error } = await supabase
        .from('collaborators')
        .select('*')
        .order('full_name', { ascending: true });

    if (error) {
        console.error("Collaborators fetch failed:", error);
        return;
    }
    state.collaborators = collaborators || [];
}

export async function fetchContacts() {
    console.log("Fetching contacts...");
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .order('full_name', { ascending: true });

    if (error) {
        console.error("Contacts fetch failed:", error);
        return;
    }
    console.log(`Fetched ${contacts?.length || 0} contacts.`);
    state.contacts = contacts || [];
}

export async function fetchInvoices() {
    console.log("Fetching invoices...");
    const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
            *,
            clients (id, business_name, client_code),
            orders (id, order_number, title)
        `)
        .order('invoice_date', { ascending: false });

    if (error) {
        console.error("Invoices fetch failed:", error);
        return;
    }
    state.invoices = invoices || [];
}

export async function fetchPassiveInvoices() {
    console.log("Fetching passive invoices...");
    const { data: passiveInvoices, error } = await supabase
        .from('passive_invoices')
        .select(`
            *,
            suppliers (name),
            collaborators (full_name)
        `)
        .order('issue_date', { ascending: false });

    if (error) {
        console.error("Passive Invoices fetch failed:", error);
        return;
    }
    state.passiveInvoices = passiveInvoices || [];
}

export async function fetchSuppliers() {
    console.log("Fetching suppliers...");
    const { data: suppliers, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

    if (error) {
        console.error("Suppliers fetch failed:", error);
        return;
    }
    state.suppliers = suppliers || [];
}

export async function fetchDepartments() {
    console.log("Fetching departments...");
    const { data: depts, error } = await supabase.from('departments').select('*').order('name');
    if (!error) state.departments = depts || [];
}

export async function fetchAllProfiles() {
    console.log("Fetching all registered profiles...");
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('email');

    if (error) {
        console.warn("Could not fetch all profiles (RLS?):", error.message);
        state.profiles = state.session ? [{ email: state.session.user.email }] : [];
        return;
    }
    state.profiles = profiles;
}

export async function upsertCollaborator(collaborator) {
    console.log("Upserting collaborator:", collaborator);

    // Clean up data for DB
    const dbData = { ...collaborator };
    delete dbData.is_new; // internal flag if used

    const { data, error } = await supabase
        .from('collaborators')
        .upsert(dbData)
        .select()
        .single();

    if (error) {
        console.error("Collaborator upsert failed:", error);
        throw error;
    }

    // Update local state
    const index = state.collaborators.findIndex(c => c.id === data.id);
    if (index >= 0) {
        state.collaborators[index] = data;
    } else {
        state.collaborators.push(data);
    }

    return data;
}

export async function deleteCollaborator(id) {
    console.log("Deleting collaborator:", id);

    const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Collaborator delete failed:", error);
        throw error;
    }

    // Update local state
    state.collaborators = state.collaborators.filter(c => c.id !== id);
    return true;
}


export async function fetchBankTransactions() {
    console.log("Fetching bank transactions...");
    const { data, error } = await supabase
        .from('bank_transactions')
        .select(`
            *,
            transaction_categories (name, type),
            clients (business_name),
            suppliers (name),
            collaborators (full_name),
            invoices (id, invoice_number),
            passive_invoices (id, invoice_number)
        `)
        .order('date', { ascending: false });

    if (error) {
        console.error("Bank transactions fetch failed:", error);
        return;
    }
    state.bankTransactions = data || [];
}

export async function fetchTransactionCategories() {
    console.log("Fetching transaction categories...");
    const { data, error } = await supabase.from('transaction_categories').select('*').order('name');
    if (!error) state.transactionCategories = data || [];
}

export async function upsertBankTransaction(transaction) {
    console.log("Upserting transaction:", transaction);
    const { data, error } = await supabase
        .from('bank_transactions')
        .upsert(transaction)
        .select(`
            *,
            transaction_categories (name, type),
            clients (business_name),
            suppliers (name),
            collaborators (full_name),
            invoices (id, invoice_number),
            passive_invoices (id, invoice_number)
        `)
        .single();

    if (error) {
        console.error("Transaction upsert failed:", error);
        throw error;
    }

    const index = state.bankTransactions.findIndex(t => t.id === data.id);
    if (index >= 0) {
        state.bankTransactions[index] = data;
    } else {
        state.bankTransactions.push(data);
        // Re-sort
        state.bankTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return data;
}

// --- TRANSACTION CATEGORIES ---

export async function upsertTransactionCategory(category) {
    const { data, error } = await supabase
        .from('transaction_categories')
        .upsert(category)
        .select()
        .single();

    if (error) {
        console.error("Category upsert error:", error);
        throw error;
    }

    // Update local state
    const index = state.transactionCategories.findIndex(c => c.id === data.id);
    if (index >= 0) {
        state.transactionCategories[index] = data;
    } else {
        state.transactionCategories.push(data);
    }
    return data;
}

export async function deleteTransactionCategory(id) {
    const { error } = await supabase
        .from('transaction_categories')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Category delete error:", error);
        throw error;
    }

    state.transactionCategories = state.transactionCategories.filter(c => c.id !== id);
    await refreshCurrentPage();
}

export async function fetchServices() {
    console.log("Fetching services...");
    const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

    if (error) {
        console.error("Services fetch failed:", error);
        return;
    }
    state.services = services || [];
}

export async function upsertService(service) {
    const { data, error } = await supabase
        .from('services')
        .upsert(service)
        .select()
        .single();

    if (error) {
        console.error("Service upsert failed:", error);
        throw error;
    }

    // Update local state
    const index = state.services.findIndex(s => s.id === data.id);
    if (index >= 0) {
        state.services[index] = data;
    } else {
        state.services.push(data);
    }
    // Sort
    state.services.sort((a, b) => a.name.localeCompare(b.name));

    return data;
}
export async function fetchCollaboratorServices() {
    try {
        const { data, error } = await supabase
            .from('collaborator_services')
            .select(`
                *,
                orders (order_number, title),
                services (name),
                collaborators (full_name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        state.collaboratorServices = data || [];
        return state.collaboratorServices;
    } catch (error) {
        console.error('Error fetching collaborator services:', error);
        state.collaboratorServices = [];
        return [];
    }
}

export async function fetchBookingItemCollaborators(collaboratorId) {
    try {
        const { data, error } = await supabase
            .from('booking_item_collaborators')
            .select(`
                *,
                booking_items (id, name)
            `)
            .eq('collaborator_id', collaboratorId);

        if (error) {
            if (error.code === '42P01') return []; // Table doesn't exist yet
            throw error;
        }
        return data || [];
    } catch (error) {
        console.error('Error fetching booking item collaborators:', error);
        return [];
    }
}

export async function fetchCollaboratorSkills(collaboratorId) {
    console.log("Fetching skills for:", collaboratorId);

    // Check if table exists first via a small select
    const { data, error } = await supabase
        .from('service_collaborators')
        .select(`
            service_id,
            services (id, name)
        `)
        .eq('collaborator_id', collaboratorId);

    if (error) {
        console.warn("Error fetching skills (likely table missing):", error.message);
        return [];
    }

    return (data || []).map(item => ({
        service_id: item.service_id,
        services: item.services
    }));
}

export async function upsertCollaboratorService(serviceData) {
    console.log("Upserting Collaborator Service Payload:", JSON.stringify(serviceData, null, 2));
    const { data, error } = await supabase
        .from('collaborator_services')
        .upsert(serviceData)
        .select(`
            *,
            orders (order_number, title),
            services (name),
            collaborators (full_name)
        `)
        .single();

    if (error) {
        console.error("Collaborator Service upsert failed:", error);
        throw error;
    }

    // Update local state
    const index = state.collaboratorServices.findIndex(s => s.id === data.id);
    if (index >= 0) {
        state.collaboratorServices[index] = data;
    } else {
        state.collaboratorServices.unshift(data);
    }
    return data;
}

export async function deleteCollaboratorService(id) {
    const { error } = await supabase
        .from('collaborator_services')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Collaborator Service delete failed:", error);
        throw error;
    }

    // Update local state
    state.collaboratorServices = state.collaboratorServices.filter(s => s.id !== id);
    await refreshCurrentPage();
    return true;
}

export async function updateCollaboratorService(id, updates) {
    console.log("Updating collaborator service:", id, updates);
    const { data, error } = await supabase
        .from('collaborator_services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("Collaborator Service update failed:", error);
        throw error;
    }

    // Update local state
    const index = state.collaboratorServices.findIndex(s => s.id === id);
    if (index >= 0) {
        state.collaboratorServices[index] = { ...state.collaboratorServices[index], ...data };
    }
    return data;
}

export async function fetchAssignments() {
    console.log("Fetching assignments...");
    const { data, error } = await supabase
        .from('assignments')
        .select(`
            *,
            orders (
                order_number,
                title,
                clients (business_name)
            ),
            collaborators (full_name)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Assignments fetch failed:", error);
        return;
    }
    state.assignments = data || [];
}

export async function fetchAssignmentDetail(id) {
    console.log("Fetching assignment detail:", id);
    const { data, error } = await supabase
        .from('assignments')
        .select(`
            *,
            orders (
                id, order_number, title, status_works, client_id,
                clients (business_name)
            ),
            collaborators (id, full_name, role, email, phone)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error("Assignment detail fetch failed:", error);
        return null;
    }
    return data;
}

export async function upsertAssignment(assignmentData) {
    console.log("Upserting assignment:", assignmentData);

    // Generate Custom ID if creating new (and no ID provided)
    // Generate Custom ID if creating new (and no ID provided)
    if (!assignmentData.id) {
        const date = new Date();
        const yy = date.getFullYear().toString().slice(-2);
        // Order Number or '0000'
        const orderNum = assignmentData.order_number || '0000';
        // Random 5 chars
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();

        // Format: YY-OrderNumber-Random (e.g., 25-0015-PC61g)
        assignmentData.id = `${yy}-${orderNum}-${randomStr}`;
    }

    // Sanitize payload: remove fields that don't exist in 'assignments' table
    const dbPayload = { ...assignmentData };
    delete dbPayload.order_number;
    delete dbPayload.client_code;
    // Remove potential joined data if object was reused
    delete dbPayload.orders;
    delete dbPayload.collaborators;
    delete dbPayload.clients;
    delete dbPayload.role_in_order; // Not in assignments table
    delete dbPayload.role; // Not in assignments table

    const { data, error } = await supabase
        .from('assignments')
        .upsert(dbPayload)
        .select(`
            *,
            orders (
                order_number,
                title,
                clients (business_name)
            ),
            collaborators (full_name)
        `)
        .single();

    if (error) {
        console.error("Assignment upsert failed details:", JSON.stringify(error, null, 2));
        return null;
    }

    // Update local state
    if (!state.assignments) state.assignments = [];
    const index = state.assignments.findIndex(a => a.id === data.id);
    if (index >= 0) {
        state.assignments[index] = data;
    } else {
        state.assignments.unshift(data);
    }
    return data;
}
export async function fetchGoogleAuth(collaboratorId) {
    const { data, error } = await supabase
        .from('collaborator_google_auth')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error("Fetch google auth failed:", error);
    }
    return data || null;
}

export async function upsertGoogleAuth(authData) {
    const { data, error } = await supabase
        .from('collaborator_google_auth')
        .upsert(authData, { onConflict: 'collaborator_id' })
        .select();

    if (error) throw error;
    return data?.[0] || null;
}

export async function deleteGoogleAuth(collaboratorId) {
    const { error } = await supabase
        .from('collaborator_google_auth')
        .delete()
        .eq('collaborator_id', collaboratorId);

    if (error) throw error;
    return true;
}

export async function fetchPayments() {
    console.log("Fetching payments...");
    const { data, error } = await supabase
        .from('payments')
        .select(`
            *,
            transaction_id,
            bank_transactions (description, date, amount),
            clients (business_name),
            collaborators (full_name),
            suppliers (name),
            orders (order_number, title),
            assignments (legacy_id, description)
        `)
        .order('due_date', { ascending: true });

    if (error) {
        console.error("Payments fetch failed:", error);
        return;
    }
    state.payments = data || [];
}

export async function upsertPayment(payment) {
    const dbData = { ...payment };
    // Cleanup joined fields that are not columns
    delete dbData.is_new;
    delete dbData.clients;
    delete dbData.collaborators;
    delete dbData.suppliers;
    delete dbData.orders;
    delete dbData.assignments;
    delete dbData.bank_transactions;
    delete dbData.invoices;
    delete dbData.passive_invoices;
    // delete dbData.transaction_id.description; // Dangerous if transaction_id is not object
    if (typeof dbData.transaction_id === 'object') delete dbData.transaction_id; // Clean if object

    const { data, error } = await supabase
        .from('payments')
        .upsert(dbData)
        .select(`
            *,
            transaction_id,
            bank_transactions (description, date, amount),
            clients (business_name),
            collaborators (full_name),
            suppliers (name),
            orders (order_number, title),
            assignments (legacy_id, description)
        `)
        .single();

    if (error) {
        console.error("Payment upsert failed:", error);
        throw error;
    }

    // Update local state
    const index = state.payments.findIndex(p => p.id === data.id);
    if (index >= 0) {
        state.payments[index] = data;
    } else {
        state.payments.push(data);
    }
    return data;
}

export async function deletePayment(id) {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw error;
    state.payments = state.payments.filter(p => p.id !== id);

    // Auto-refresh current page
    await refreshCurrentPage();
    return true;
}

// Global auto-refresh helper
async function refreshCurrentPage() {
    const hash = window.location.hash;
    const container = document.getElementById('content-area');
    if (!container) return;

    if (hash.includes('order-detail/')) {
        const { renderOrderDetail } = await import('../features/orders.js?v=123');
        renderOrderDetail(container);
    } else if (hash.includes('payments')) {
        const { renderPaymentsDashboard } = await import('../features/payments.js?v=123');
        renderPaymentsDashboard(container);
    } else if (hash.includes('bank-transactions')) {
        const { renderBankTransactions } = await import('../features/bank_transactions.js?v=123');
        renderBankTransactions(container);
    } else if (hash.includes('collaborator-services')) {
        const { renderCollaboratorServices } = await import('../features/collaborator_services.js?v=123');
        renderCollaboratorServices(container);
    } else if (hash.includes('assignment-detail/')) {
        const { renderAssignmentDetail } = await import('../features/assignments.js?v=123');
        renderAssignmentDetail(container);
    } else if (hash.includes('collaborator-detail/')) {
        const { renderCollaboratorDetail } = await import('../features/collaborators.js?v=123');
        renderCollaboratorDetail(container);
    } else if (hash.includes('client-detail/')) {
    }
}

// =========================================================
//  PEOPLE: ACCOUNTS & REFERENTS
// =========================================================

export async function addOrderAccount(orderId, collaboratorId) {
    const { data, error } = await supabase
        .from('order_collaborators')
        .upsert({
            order_id: orderId,
            collaborator_id: collaboratorId,
            role_in_order: 'Account'
        }, { on_conflict: 'order_id,collaborator_id' })
        .select();

    if (error) throw error;
    // Update local state if needed
    return data;
}

export async function fetchAvailabilityRules(collaboratorId) {
    try {
        const { data: rules, error } = await supabase
            .from('availability_rules')
            .select('*')
            .eq('collaborator_id', collaboratorId);

        if (error) throw error;
        return rules || [];
    } catch (err) {
        console.error("Fetch availability rules failed:", err);
        return [];
    }
}

export async function saveAvailabilityRules(collaboratorId, rules) {
    console.log("Saving availability rules for:", collaboratorId, rules);

    // STRATEGY: Delete all existing rules for this collaborator and insert new ones.
    // This avoids "duplicate key" errors when the frontend sends rules without IDs (treating them as new).

    // 1. Delete Existing
    const { error: deleteError } = await supabase
        .from('availability_rules')
        .delete()
        .eq('collaborator_id', collaboratorId);

    if (deleteError) {
        if (deleteError.message?.includes('does not exist')) {
            console.warn("Table availability_rules missing. Skipping save.");
            return [];
        }
        console.error("Error clearing old rules:", deleteError);
        throw deleteError;
    }

    // 2. Insert New (if any)
    if (rules && rules.length > 0) {
        // Ensure every rule has the correct collaborator_id
        const payload = rules.map(r => ({
            collaborator_id: collaboratorId,
            day_of_week: r.day_of_week,
            start_time: r.start_time,
            end_time: r.end_time,
            service_id: r.service_id || null
        }));

        const { data, error: insertError } = await supabase
            .from('availability_rules')
            .insert(payload)
            .select();

        if (insertError) {
            console.error("Error inserting new rules:", insertError);
            throw insertError;
        }
        return data;
    }

    return [];
}

// --- REST DAYS ---

export async function fetchRestDays(collaboratorId) {
    const { data, error } = await supabase
        .from('collaborator_rest_days')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .order('start_date', { ascending: true });

    if (error) {
        // Soft fail if table missing
        if (error.message?.includes('does not exist') || error.code === '4P001') {
            console.warn("Table collaborator_rest_days missing. Feature disabled.");
            return [];
        }
        console.error("Rest days fetch failed:", error);
        return []; // Return empty instead of throwing to keep page alive
    }
    return data || [];
}

export async function upsertRestDay(restDay) {
    console.log("Upserting rest day:", restDay);
    const { data, error } = await supabase
        .from('collaborator_rest_days')
        .upsert(restDay)
        .select()
        .single();

    if (error) {
        console.error("Rest Day upsert failed:", error);
        throw error;
    }
    return data;
}

export async function deleteRestDay(id) {
    console.log("Deleting rest day:", id);
    const { error } = await supabase
        .from('collaborator_rest_days')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return true;
}

// --- AVAILABILITY OVERRIDES (EXTRA SLOTS) ---

export async function fetchAvailabilityOverrides(collaboratorId) {
    const { data, error } = await supabase
        .from('availability_overrides')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .eq('is_available', true)
        .order('date', { ascending: true });

    if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
            console.warn("Table availability_overrides missing. Feature disabled.");
            return [];
        }
        console.error("Fetch overrides failed:", error);
        return [];
    }
    return data || [];
}

export async function upsertAvailabilityOverride(override) {
    console.log("Upserting override:", override);

    // Create a copy and remove service_id if it's null/empty 
    // to avoid "column not found" errors on cached schemas
    const cleanData = { ...override };
    if (!cleanData.service_id) {
        delete cleanData.service_id;
    }

    const { error } = await supabase
        .from('availability_overrides')
        .upsert(cleanData);

    if (error) throw error;
    return true;
}

export async function deleteAvailabilityOverride(id) {
    const { error } = await supabase
        .from('availability_overrides')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}


export async function removeOrderAccount(orderId, collaboratorId) {
    const { error } = await supabase
        .from('order_collaborators')
        .delete()
        .eq('order_id', orderId)
        .eq('collaborator_id', collaboratorId);

    if (error) throw error;
    return true;
}

export async function addOrderContact(orderId, contactId) {
    // Requires order_contacts table
    const { data, error } = await supabase
        .from('order_contacts')
        .upsert({
            order_id: orderId,
            contact_id: contactId,
            role: 'Referente'
        }, { on_conflict: 'order_id,contact_id' })
        .select();

    if (error) {
        if (error.code === '42P01') { // undefined_table
            alert("La tabella 'order_contacts' non esiste. Esegui lo script di migrazione!");
        }
        throw error;
    }
    return data;
}

export async function removeOrderContact(orderId, contactId) {
    const { error } = await supabase
        .from('order_contacts')
        .delete()
        .eq('order_id', orderId)
        .eq('contact_id', contactId);

    if (error) throw error;
    return true;
}

export async function fetchOrderContacts(orderId) {
    // Soft fetch - returns empty if table missing
    const { data, error } = await supabase
        .from('order_contacts')
        .select('*, contacts (id, full_name, email, phone)')
        .eq('order_id', orderId);

    if (error) {
        console.warn("Could not fetch order_contacts (table might be missing)", error);
        return [];
    }
    return data || [];
}

// =========================================================
//  SYSTEM CONFIGURATION
// =========================================================

export async function fetchSystemConfig(key) {
    const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', key)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error(`Failed to fetch system config for key: ${key}`, error);
        return null;
    }
    return data?.value || null;
}

export async function upsertSystemConfig(key, value, description = null) {
    const payload = {
        key,
        value,
        updated_at: new Date().toISOString()
    };

    if (description) payload.description = description;

    // Try to get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (user) payload.updated_by = user.id;

    const { data, error } = await supabase
        .from('system_config')
        .upsert(payload, { onConflict: 'key' })
        .select()
        .single();

    if (error) {
        console.error(`Failed to upsert system config for key: ${key}`, error);
        throw error;
    }
    return data;
}

export async function fetchAllSystemConfig() {
    const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .order('key');

    if (error) {
        console.error('Failed to fetch all system config', error);
        return [];
    }
    return data || [];
}

// --- NOTIFICATION PREFERENCES ---

export async function fetchNotificationTypes() {
    const { data, error } = await supabase
        .from('notification_types')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

    if (error) {
        console.error('Failed to fetch notification types:', error);
        return [];
    }
    return data || [];
}

export async function fetchUserNotificationPreferences(userId) {
    const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*, notification_types(*)')
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to fetch user notification preferences:', error);
        return [];
    }
    return data || [];
}

export async function upsertUserNotificationPreference(preference) {
    const { data, error } = await supabase
        .from('user_notification_preferences')
        .upsert(preference, { onConflict: 'user_id,notification_type_id' })
        .select()
        .single();

    if (error) {
        console.error('Failed to upsert user notification preference:', error);
        throw error;
    }
    return data;
}
