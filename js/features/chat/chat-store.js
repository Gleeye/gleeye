
/**
 * Chat Store
 * Centralized state management for the Chat System.
 * Handles caching, optimistic updates, and unreads.
 */

class ChatStore {
    constructor() {
        this.messages = new Map(); // Map<contextId, Message[]>
        this.unreads = new Map(); // Map<contextId, number>
        this.typing = new Map(); // Map<contextId, Set<userId>>
        this.presence = new Map(); // Map<userId, 'online'|'offline'>
        this.listeners = new Set();
        this.activeContextId = null;

        // State for sidebar data
        this.state = {
            channels: [],
            conversations: []
        };
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(l => l(this));
    }

    // --- Messages ---

    getMessages(contextId) {
        return this.messages.get(contextId) || [];
    }

    setMessages(contextId, messages) {
        this.messages.set(contextId, messages);
        this.notify();
    }

    appendMessage(contextId, message) {
        const list = this.getMessages(contextId);
        // Deduplicate based on ID or client_temp_id
        const exists = list.some(m => m.id === message.id || (m.client_temp_id && m.client_temp_id === message.client_temp_id));
        if (!exists) {
            list.push(message);
            this.messages.set(contextId, list);
            this.notify();
        }
    }

    prependMessages(contextId, messages) {
        const list = this.getMessages(contextId);
        // Filter out existing
        const newOnes = messages.filter(m => !list.some(existing => existing.id === m.id));
        this.messages.set(contextId, [...newOnes, ...list]);
        this.notify();
    }

    updateMessage(contextId, messageId, updates) {
        const list = this.getMessages(contextId);
        const index = list.findIndex(m => m.id === messageId || m.client_temp_id === messageId);
        if (index !== -1) {
            list[index] = { ...list[index], ...updates };
            this.messages.set(contextId, [...list]); // primitive array copy to trigger change detection if needed
            this.notify();
        }
    }

    replaceOptimisticMessage(contextId, tempId, actualMessage) {
        const list = this.getMessages(contextId);
        const index = list.findIndex(m => m.client_temp_id === tempId);
        if (index !== -1) {
            list[index] = actualMessage;
            this.messages.set(contextId, [...list]);
            this.notify();
        } else {
            // Should not happen, but if not found, append
            this.appendMessage(contextId, actualMessage);
        }
    }

    toggleReaction(contextId, messageId, emoji, userId) {
        const list = this.getMessages(contextId);
        const index = list.findIndex(m => m.id === messageId);

        if (index !== -1) {
            const msg = { ...list[index] };
            const reactions = msg.reactions || [];

            // Check if user already reacted with this emoji
            const existingIdx = reactions.findIndex(r => r.emoji === emoji && r.user_id === userId);

            if (existingIdx !== -1) {
                // Remove (Optimistic)
                msg.reactions = reactions.filter((_, i) => i !== existingIdx);
            } else {
                // Add (Optimistic)
                msg.reactions = [...reactions, { emoji, user_id: userId }];
            }

            list[index] = msg;
            this.messages.set(contextId, [...list]);
            this.notify();
        }
    }

    // --- Unreads ---

    setUnreadCount(contextId, count) {
        this.unreads.set(contextId, count);
        this.notify();
    }

    // --- Typing ---

    setTyping(contextId, userId, isTyping) {
        if (!this.typing.has(contextId)) {
            this.typing.set(contextId, new Set());
        }
        const set = this.typing.get(contextId);
        if (isTyping) set.add(userId);
        else set.delete(userId);
        this.notify();
    }

    // --- Presence ---

    setPresence(userId, status) {
        this.presence.set(userId, status);
        this.notify();
    }
}

export const chatStore = new ChatStore();
