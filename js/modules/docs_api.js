import { supabase } from './config.js';
import { state } from '/js/modules/state.js';

/* ==========================================================================
   DOCS API - Workspace Management
   ========================================================================== */

/**
 * Ensures a Doc Space exists for the given PM Space.
 * If not, creates it.
 * @param {string} pmSpaceId 
 * @returns {Promise<Object>} The doc_space object
 */
export async function ensureDocSpace(pmSpaceId) {
    // 1. Try to fetch existing
    const { data, error } = await supabase
        .from('doc_spaces')
        .select('*')
        .eq('space_ref', pmSpaceId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching doc space:", error);
        throw error;
    }

    if (data) return data;

    // 2. Create if not exists
    const { data: newData, error: createError } = await supabase
        .from('doc_spaces')
        .insert([{ space_ref: pmSpaceId }])
        .select()
        .single();

    if (createError) {
        console.error("Error creating doc space:", createError);
        throw createError;
    }

    return newData;
}

/* ==========================================================================
   PAGES Management
   ========================================================================== */

/**
 * Fetches the entire page tree for a Doc Space.
 * @param {string} docSpaceId 
 * @returns {Promise<Array>} Flat array of pages (to be built into tree by UI)
 */
export async function fetchDocPages(docSpaceId) {
    const { data, error } = await supabase
        .from('doc_pages')
        .select('*')
        .eq('space_ref', docSpaceId)
        .order('order_index', { ascending: true }); // Primary sort

    if (error) throw error;
    return data;
}
/**
 * Fetches pages visible to the current user (Owner, Admin, or Shared).
 * @param {string} docSpaceId 
 */
export async function fetchVisiblePages(docSpaceId) {
    const profile = state.profile;

    // 1. Admin/Superuser sees everything
    if (profile?.role === 'admin' || profile?.email === 'davide@gleeye.eu') {
        return fetchDocPages(docSpaceId);
    }

    const userId = state.session?.user?.id;
    const collabId = profile?.collaborator_id;
    const deptNames = profile?.tags || [];

    // Resolve Dept Names to IDs if needed
    let deptIds = [];
    if (deptNames.length > 0) {
        if (!state.departments || state.departments.length === 0) {
            const { data: allDepts } = await supabase.from('departments').select('*');
            state.departments = allDepts || [];
        }
        deptIds = state.departments
            .filter(d => deptNames.includes(d.name))
            .map(d => d.id);
    }

    // 2. Fetch all pages in space
    let { data: pages, error } = await supabase
        .from('doc_pages')
        .select('*')
        .eq('space_ref', docSpaceId)
        .order('order_index', { ascending: true });

    if (error) throw error;

    // 3. Fetch permissions for these pages
    const { data: perms } = await supabase
        .from('doc_page_permissions')
        .select('page_ref, target_type, target_id')
        .in('page_ref', pages.map(p => p.id));

    // 4. Filter Logic
    const visiblePages = pages.filter(page => {
        // Owner or Public
        if (page.created_by === userId || page.is_public === true) return true;

        // Direct Shared
        const isDirectlyShared = perms?.some(p =>
            p.page_ref === page.id &&
            p.target_type === 'collaborator' &&
            p.target_id === collabId
        );
        if (isDirectlyShared) return true;

        // Dept Shared
        const isDeptShared = perms?.some(p =>
            p.page_ref === page.id &&
            p.target_type === 'department' &&
            deptIds.includes(p.target_id)
        );
        if (isDeptShared) return true;

        return false;
    });

    // Special Case: Ensure children are shown if parent is hidden? 
    // Usually Notion requires top-down sharing. We'll stick to explicit sharing.

    return visiblePages;
}

export async function createDocPage(docSpaceId, parentRef = null, title = 'Pagina senza titolo', pageType = 'document') {
    // Get max order index for the level to append at end
    // (Simplification: just use timestamp or 0 for MVP if strict ordering not critical yet)
    // Proper way: fetch max order. For MVP: use extensive epoch or list length

    const { data, error } = await supabase
        .from('doc_pages')
        .insert([{
            space_ref: docSpaceId,
            parent_ref: parentRef,
            title: title || 'Untitled',
            page_type: pageType,
            created_by: state.session?.user?.id,
            order_index: Date.now() // Simple sorting strategy for MVP
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateDocPage(pageId, updates) {
    const { data, error } = await supabase
        .from('doc_pages')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', pageId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateDocMetadata(pageId, metadata) {
    const { data, error } = await supabase
        .from('doc_pages')
        .update({
            metadata: metadata,
            updated_at: new Date().toISOString()
        })
        .eq('id', pageId)
        .select('id, metadata, updated_at')
        .single();

    if (error) throw error;
    return data;
}

export async function deleteDocPage(pageId) {
    // Cascade delete handles subpages/blocks in DB
    const { error } = await supabase
        .from('doc_pages')
        .delete()
        .eq('id', pageId);

    if (error) throw error;
    return true;
}

/* ==========================================================================
   BLOCKS Management
   ========================================================================== */

export async function fetchPageBlocks(pageId) {
    const { data, error } = await supabase
        .from('doc_blocks')
        .select('*')
        .eq('page_ref', pageId)
        .order('order_index', { ascending: true });

    if (error) throw error;

    // If empty, user might expect at least one empty paragraph?
    // UI can handle that (create local empty block).
    return data;
}

export async function createBlock(pageId, type = 'paragraph', content = {}, orderIndex = 0) {
    const { data, error } = await supabase
        .from('doc_blocks')
        .insert([{
            page_ref: pageId,
            type,
            content: content || {},
            order_index: orderIndex,
            created_by: state.session?.user?.id
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateBlock(blockId, updates) {
    const { data, error } = await supabase
        .from('doc_blocks')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', blockId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBlock(blockId) {
    const { error } = await supabase
        .from('doc_blocks')
        .delete()
        .eq('id', blockId);

    if (error) throw error;
    return true;
}

/**
 * Batch update for reordering blocks (e.g. after Drag & Drop or Enter/Backspace)
 * @param {Array<{id: string, order_index: number}>} updates 
 */
export async function upsertBlocks(blocks) {
    const { data, error } = await supabase
        .from('doc_blocks')
        .upsert(blocks)
        .select();

    if (error) throw error;
    return data;
}

/* ==========================================================================
   STORAGE Management
   ========================================================================== */

export async function uploadImage(file, folder = 'docs') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    // Store in docs/ subfolder in pm-attachments bucket
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await supabase.storage
        .from('pm-attachments')
        .upload(filePath, file, {
            upsert: false
        });

    if (error) {
        console.error('Upload error:', error);
        // If error is bucket not found, user needs to create it.
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('pm-attachments')
        .getPublicUrl(filePath);

    return publicUrl;
}

/* ==========================================================================
   PERMISSIONS Management
   ========================================================================== */

export async function fetchPagePermissions(pageId) {
    const { data, error } = await supabase
        .from('doc_page_permissions')
        .select('*')
        .eq('page_ref', pageId);

    if (error) throw error;
    return data;
}

export async function addPagePermission(pageId, targetType, targetId, accessLevel = 'view') {
    const { data, error } = await supabase
        .from('doc_page_permissions')
        .insert([{
            page_ref: pageId,
            target_type: targetType,
            target_id: targetId,
            access_level: accessLevel
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deletePagePermission(permissionId) {
    const { error } = await supabase
        .from('doc_page_permissions')
        .delete()
        .eq('id', permissionId);

    if (error) throw error;
    return true;
}

/* ==========================================================================
   NOTIFICATIONS / SUBSCRIPTIONS
   ========================================================================== */

export async function fetchDocSubscription(pageId) {
    const userId = state.session?.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
        .from('doc_subscriptions')
        .select('*')
        .eq('page_id', pageId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function toggleDocSubscription(pageId, subscribe) {
    const userId = state.session?.user?.id;
    if (!userId) throw new Error("Utente non autenticato");

    if (subscribe) {
        const { data, error } = await supabase
            .from('doc_subscriptions')
            .upsert([{ page_id: pageId, user_id: userId }], { onConflict: 'page_id,user_id' })
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        const { error } = await supabase
            .from('doc_subscriptions')
            .delete()
            .eq('page_id', pageId)
            .eq('user_id', userId);
        if (error) throw error;
        return null;
    }
}
