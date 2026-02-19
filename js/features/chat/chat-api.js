import { supabase } from '../../modules/config.js';

/**
 * Chat System API
 * Includes features from Sprints 1, 2, 3, and 4.
 */

// Helper to ensure session is ready
async function ensureSession() {
    try {
        console.log('[Chat API] Checking session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('[Chat API] Session error:', error);
            return false;
        }
        if (!session) {
            console.warn('[Chat API] No active session');
            return false;
        }
        console.log('[Chat API] Session OK');
        return true;
    } catch (err) {
        console.error('[Chat API] Session check failed:', err.message);
        return false;
    }
}

// --- Channels ---

export async function listChannels() {
    const hasSession = await ensureSession();
    if (!hasSession) return [];

    try {
        console.log('[Chat API] Fetching channels...');
        const startTime = Date.now();

        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .order('name');

        console.log(`[Chat API] Channels fetched in ${Date.now() - startTime}ms:`, data?.length || 0);

        if (error) {
            console.error('Error listing channels:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('[Chat API] listChannels failed:', err.message);
        return [];
    }
}

export async function createChannel(name, options = {}) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const { isPrivate = false, topic = '', description = '' } = options;
    const { data, error } = await supabase
        .from('channels')
        .insert([{
            name,
            is_private: isPrivate,
            topic,
            description,
            created_by: user.id
        }])
        .select()
        .single();

    if (error) throw error;

    if (data) {
        await joinChannel(data.id, 'owner');
    }
    return data;
}

export async function joinChannel(channelId, role = 'member') {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
        .from('channel_members')
        .insert([{ channel_id: channelId, user_id: user.id, role }]);

    if (error) throw error;
}

export async function leaveChannel(channelId) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
        .from('channel_members')
        .delete()
        .match({ channel_id: channelId, user_id: user.id });

    if (error) throw error;
}

// --- Conversations (DM/Group) ---

export async function listConversations() {
    const hasSession = await ensureSession();
    if (!hasSession) return [];

    const { data, error } = await supabase
        .from('conversations')
        .select(`
            *,
            conversation_members(
                user_id,
                profiles:user_id(id, full_name, email)
            )
        `);

    if (error) {
        console.error('Error listing conversations:', error);
        return [];
    }
    return data || [];
}

export async function createDirectMessage(targetUserId) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    // 1. Create conversation
    const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert([{ type: 'dm', created_by: user.id }])
        .select()
        .single();

    if (convError) throw convError;

    // 2. Add members
    const { error: membersError } = await supabase
        .from('conversation_members')
        .insert([
            { conversation_id: conv.id, user_id: user.id },
            { conversation_id: conv.id, user_id: targetUserId }
        ]);

    if (membersError) throw membersError;
    return conv;
}

export async function createGroupConversation(name, memberUserIds) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert([{ type: 'group', created_by: user.id }])
        .select()
        .single();

    if (convError) throw convError;

    // Add members
    const members = [user.id, ...memberUserIds].map(uid => ({
        conversation_id: conv.id,
        user_id: uid
    }));

    const { error: membersError } = await supabase
        .from('conversation_members')
        .insert(members);

    if (membersError) throw membersError;
    return conv;
}

// --- Messages ---

export async function listMessages(contextId, contextType = 'channel', limit = 50, lastCreatedAt = null) {
    let query = supabase
        .from('messages')
        .select(`
            *,
            author:profiles(id, full_name, email),
            attachments:message_attachments(*),
            reactions(emoji, user_id)
        `)

        .order('created_at', { ascending: false })
        .limit(limit)
        .is('parent_message_id', null) // Exclude replies
        .is('deleted_at', null); // Exclude soft deleted if handled here (or in UI)

    if (contextType === 'channel') {
        query = query.eq('channel_id', contextId);
    } else {
        query = query.eq('conversation_id', contextId);
    }

    if (lastCreatedAt) {
        query = query.lt('created_at', lastCreatedAt);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error listing messages:', error);
        return [];
    }
    return data.reverse();
}

export async function getReplies(parentMessageId) {
    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            author:profiles!messages_author_id_fkey(id, full_name, email),
            reactions(emoji, user_id)
        `)
        .eq('parent_message_id', parentMessageId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error getting replies:', error);
        return [];
    }
    return data;
}

export async function sendMessage(contextId, text, contextType = 'channel', parentMessageId = null) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const payload = {
        author_id: user.id,
        body: text,
        created_at: new Date().toISOString(),
        parent_message_id: parentMessageId
    };

    if (contextType === 'channel') {
        payload.channel_id = contextId;
    } else {
        payload.conversation_id = contextId;
    }

    const { data, error } = await supabase
        .from('messages')
        .insert([payload])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function editMessage(messageId, newBody) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('messages')
        .update({
            body: newBody,
            edited_at: new Date().toISOString()
        })
        .match({ id: messageId, author_id: user.id })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteMessage(messageId) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .match({ id: messageId, author_id: user.id })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// --- Reactions ---

export async function toggleReaction(messageId, emoji, contextId, contextType = 'channel') {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .match({ message_id: messageId, user_id: user.id, emoji })
        .maybeSingle();

    if (existing) {
        const { error } = await supabase.from('reactions').delete().match({ id: existing.id });
        if (error) throw error;
        return { action: 'removed' };
    } else {
        const payload = { message_id: messageId, user_id: user.id, emoji };
        if (contextType === 'channel') payload.channel_id = contextId;
        else payload.conversation_id = contextId;

        const { error } = await supabase.from('reactions').insert([payload]);
        if (error) throw error;
        return { action: 'added' };
    }
}

// --- Unread & Read Status ---

export async function markAsRead(messageId, contextId, contextType = 'channel') {
    const args = {
        p_message_id: messageId,
        p_channel_id: contextType === 'channel' ? contextId : null,
        p_conversation_id: contextType === 'channel' ? null : contextId
    };

    const { error } = await supabase.rpc('mark_message_read', args);
    if (error) {
        console.error('Error marking as read:', error);
        throw error;
    }
}

export async function getUnreadCounts() {
    const { data, error } = await supabase.rpc('get_unread_counts');
    if (error) {
        console.error('Error getting unread counts:', error);
        return [];
    }
    return data;
}

export async function getLastRead(contextId, contextType = 'channel') {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) return null;

    let query = supabase
        .from('message_reads')
        .select('last_read_message_id, last_read_at')
        .eq('user_id', user.id);

    if (contextType === 'channel') {
        query = query.eq('channel_id', contextId);
    } else {
        query = query.eq('conversation_id', contextId);
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 is no rows, which is fine
        console.error("Error fetching last read:", error);
        return null;
    }
    return data; // { last_read_message_id, last_read_at }
}

// --- Files & Search ---

export async function uploadAttachment(file) {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

    return { path: filePath, publicUrl: data.publicUrl };
}

export async function sendAttachmentMessage(contextId, file, caption = '', contextType = 'channel') {
    const { user } = (await supabase.auth.getUser()).data;
    if (!user) throw new Error("Not authenticated");

    // 1. Upload
    const { path } = await uploadAttachment(file);

    // 2. Insert Message (with Caption or Body)
    // Does our message table allow empty body? Yes.
    // However, our spec said "message_attachments" as a separate table.
    // Ideally we insert message first, then attachment.

    // Create Message
    const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert([{
            author_id: user.id,
            body: caption, // Optional caption
            created_at: new Date().toISOString(),
            [contextType === 'channel' ? 'channel_id' : 'conversation_id']: contextId
        }])
        .select()
        .single();

    if (msgError) throw msgError;

    // Insert Attachment Record
    const { error: attachError } = await supabase
        .from('message_attachments')
        .insert([{
            message_id: message.id,
            file_path: path,
            file_type: file.type,
            file_size: file.size
        }]);

    if (attachError) throw attachError;
    return message;
}

export async function searchMessages(queryText) {
    const { data, error } = await supabase.rpc('search_messages', { query_text: queryText });
    if (error) {
        console.error('Error searching messages:', error);
        return [];
    }
    return data;
}
