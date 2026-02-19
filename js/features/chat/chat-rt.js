import { supabase } from '../../modules/config.js';

/**
 * Chat System - Realtime Subscriptions
 */

/**
 * Subscribe to new messages and updates in a specific context (channel or conversation)
 * @param {string} contextId - UUID of the channel or conversation
 * @param {string} contextType - 'channel' or 'conversation'
 * @param {function} onMessage - Callback for new messages (INSERT)
 * @param {function} onUpdate - Callback for modified/deleted messages (UPDATE)
 * @returns {object} Subscription object (call .unsubscribe() to clean up)
 */
export function subscribeToMessages(contextId, contextType, onMessage, onUpdate) {
    if (!contextId) return null;

    const filterColumn = contextType === 'channel' ? 'channel_id' : 'conversation_id';

    // Create a channel for this specific context
    const channel = supabase.channel(`chat:${contextId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `${filterColumn}=eq.${contextId}`
            },
            (payload) => {
                if (onMessage) onMessage(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `${filterColumn}=eq.${contextId}`
            },
            (payload) => {
                // Handle soft deletes (checked via deleted_at) or content edits
                if (onUpdate) onUpdate(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*', // INSERT or DELETE mostly
                schema: 'public',
                table: 'reactions',
                filter: `${filterColumn}=eq.${contextId}`
            },
            (payload) => {
                // Return the whole payload so UI can see if it was INSERT or DELETE
                // and which message_id it belongs to.
                if (onUpdate) onUpdate({ type: 'reaction', ...payload });
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Subscribed to chat:${contextId}`);
            }
        });

    return channel;
}

/**
 * Subscribe to generic channel updates (e.g. name change, archived status)
 * @param {string} channelId 
 * @param {function} onUpdate 
 */
export function subscribeToChannelDetails(channelId, onUpdate) {
    return supabase.channel(`channel_details:${channelId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'channels',
                filter: `id=eq.${channelId}`
            },
            (payload) => {
                if (onUpdate) onUpdate(payload.new);
            }
        )
        .subscribe();
}

/**
 * Track user presence in a channel
 * @param {string} userId - Current user ID
 * @param {object} metadata - User metadata (e.g. { status: 'online' })
 * @param {function} onSync - Callback when presence state changes (returns all users)
 */
export function trackPresence(channelId, userId, metadata, onSync) {
    const channel = supabase.channel(`presence:${channelId}`);

    channel
        .on('presence', { event: 'sync' }, () => {
            const newState = channel.presenceState();
            if (onSync) onSync(newState);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: userId, ...metadata });
            }
        });

    return channel;
}

/**
 * Send typing indicator
 * @param {string} contextId 
 */
export async function sendTyping(contextId, userId) {
    const channel = supabase.channel(`chat:${contextId}`);
    return channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: userId }
    });
}

/**
 * Subscribe to typing indicators
 * @param {string} contextId 
 * @param {function} onTyping - Callback({ user_id })
 */
export function subscribeToTyping(contextId, onTyping) {
    return supabase.channel(`chat:${contextId}`)
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (onTyping) onTyping(payload.payload);
        })
        .subscribe();
}
