import { supabase } from './config.js';
import { state } from './state.js';

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

export async function createDocPage(docSpaceId, parentRef = null, title = 'Pagina senza titolo') {
    // Get max order index for the level to append at end
    // (Simplification: just use timestamp or 0 for MVP if strict ordering not critical yet)
    // Proper way: fetch max order. For MVP: use extensive epoch or list length

    const { data, error } = await supabase
        .from('doc_pages')
        .insert([{
            space_ref: docSpaceId,
            parent_ref: parentRef,
            title: title || 'Untitled',
            created_by: state.user?.id,
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
            created_by: state.user?.id
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
