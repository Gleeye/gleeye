import { supabase } from '../../modules/config.js';
import {
    listChannels, listConversations, getUnreadCounts,
    joinChannel, createChannel, createDirectMessage,
    listMessages, sendMessage, sendAttachmentMessage, markAsRead,
    toggleReaction, deleteMessage, editMessage, getReplies, searchMessages
} from './chat-api.js';
import { subscribeToMessages, sendTyping, subscribeToTyping, trackPresence } from './chat-rt.js';
import { chatStore } from './chat-store.js';

// State tracks current active chat
let currentState = {
    contextId: null,
    contextType: null, // 'channel' | 'conversation'
    subscription: null,
    typingSubscription: null,
    userId: null,
    unsubscribeStore: null,
    unreadCountSnapshot: 0
};

// Main Render Function called by Router
export async function renderChat(container) {
    container.innerHTML = `
        <div id="chat-module">
            <div class="chat-layout">
                <!-- Mobile Overlay -->
                <div class="mobile-overlay" id="mobile-overlay"></div>

                <!-- Sidebar: Channels & DMs -->
                <aside class="chat-sidebar" id="chat-sidebar">
                    <div class="chat-sidebar-header">
                        <h3>Canali</h3>
                        <div class="actions">
                            <button class="icon-btn-small" id="search-btn" title="Cerca">🔍</button>
                            <button class="icon-btn-small" id="create-channel-btn" title="Nuovo Canale">+</button>
                        </div>
                    </div>
                    <div class="channel-list" id="channel-list">
                        <div style="padding:10px; opacity:0.5">Caricamento...</div>
                    </div>
                    
                    <div class="chat-sidebar-header mt-4">
                        <h3>Messaggi Diretti</h3>
                        <button class="icon-btn-small" id="create-dm-btn" title="Nuovo DM">+</button>
                    </div>
                    <div class="dm-list" id="dm-list"></div>
                </aside>

                <!-- Main Chat Area -->
                <section class="chat-main">
                    <header class="chat-header">
                        <div class="header-left">
                            <button class="icon-btn mobile-only" id="mobile-menu-btn">☰</button>
                            <div class="chat-header-info">
                                <h3 id="chat-title">Seleziona una chat</h3>
                                <span id="chat-topic" class="text-sm text-muted"></span>
                            </div>
                        </div>
                        <div class="chat-header-actions">
                            <button class="icon-btn" id="thread-toggle-btn" title="Thread">
                                <span class="material-icons-round">comment</span>
                            </button>
                             <button class="icon-btn" id="chat-info-btn" title="Info">
                                <span class="material-icons-round">info</span>
                            </button>
                        </div>
                    </header>

                    <div class="message-list" id="message-list">
                        <div class="empty-state">Seleziona un canale o una conversazione per iniziare.</div>
                    </div>

                    <footer class="chat-input-area">
                        <div class="chat-input-wrapper">
                            <button class="icon-btn" id="attach-btn"><span class="material-icons-round">attach_file</span></button>
                            <input type="file" id="file-input" style="display:none">
                            <textarea id="message-input" placeholder="Scrivi un messaggio..." rows="1"></textarea>
                            <button class="icon-btn primary" id="send-btn"><span class="material-icons-round">send</span></button>
                        </div>
                        <div id="typing-indicator" class="typing-indicator"></div>
                    </footer>
                </section>
                
                 <!-- Thread Panel -->
                 <aside class="chat-thread-panel hidden" id="thread-panel">
                     <header class="thread-header">
                        <h3>Thread</h3>
                        <button class="icon-btn" id="close-thread-btn"><span class="material-icons-round">close</span></button>
                    </header>
                    <div class="thread-messages" id="thread-messages"></div>
                     <footer class="thread-input-area">
                        <input type="text" id="thread-input" placeholder="Rispondi...">
                    </footer>
                 </aside>
            </div>
            
            <!-- Search Modal -->
            <div id="search-modal" class="modal-overlay hidden">
                <div class="modal-content search-modal-content">
                    <div class="modal-header">
                        <h3>Cerca Messaggi</h3>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="search-input" placeholder="Cerca..." class="full-width-input">
                        <div id="search-results" class="search-results"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize content
    await initChatUI();
}

export async function initChatUI() {
    console.log("Initializing Chat UI...");
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            currentState.userId = user.id;
            initGlobalPresence(user.id);
        }
    } catch (err) {
        console.error("Auth check failed in chat-ui", err);
    }

    await renderSidebar();
    setupEventListeners();

    // Subscribe to store updates to re-render messages only
    currentState.unsubscribeStore = chatStore.subscribe(() => {
        if (currentState.contextId) {
            renderMessages();
        }
        // Don't re-render sidebar here - it causes infinite loop
    });
}

function initGlobalPresence(userId) {
    trackPresence('global-presence', userId, { status: 'online', last_seen: new Date().toISOString() }, (state) => {
        Object.keys(state).forEach(key => {
            const metadatas = state[key];
            if (metadatas && metadatas.length > 0) {
                const data = metadatas[0];
                if (data.user_id) {
                    chatStore.setPresence(data.user_id, data.status || 'online');
                }
            }
        });
    });
}

async function renderSidebar() {
    const channelList = document.getElementById('channel-list');
    const dmList = document.getElementById('dm-list');
    if (!channelList || !dmList) {
        console.warn('[Chat] Sidebar elements not found');
        return;
    }

    console.log('[Chat] renderSidebar started');

    // Step 1: Use Cache if available for standard render
    if (chatStore.state.channels.length > 0 || chatStore.state.conversations.length > 0) {
        console.log('[Chat] Using cached data for immediate render');
        renderChannelList(chatStore.state.channels, channelList);
        renderDmList(chatStore.state.conversations, dmList);
    } else {
        channelList.innerHTML = '<div style="padding:8px; opacity:0.6; font-size:0.85rem;">Caricamento...</div>';
        dmList.innerHTML = '<div style="padding:8px; opacity:0.6; font-size:0.85rem;">Caricamento...</div>';
    }

    // Step 2: Fetch updates in parallel
    console.log('[Chat] Fetching channels and DMs in parallel...');

    try {
        const [channels, dms] = await Promise.all([
            listChannels().catch(e => { console.error("Error loading channels:", e); return []; }),
            listConversations().catch(e => { console.error("Error loading DMs:", e); return []; })
        ]);

        chatStore.state.channels = channels;
        chatStore.state.conversations = dms;

        renderChannelList(channels, channelList);
        renderDmList(dms, dmList);

        console.log(`[Chat] Loaded ${channels.length} channels and ${dms.length} DMs`);
    } catch (err) {
        console.error('[Chat] Critical error loading sidebar:', err);
    }

    // Step 3: Load unreads
    loadUnreads();
}

function renderChannelList(channels, container) {
    if (channels && channels.length > 0) {
        container.innerHTML = channels.map(c => `
            <div class="chat-nav-item ${currentState.contextId === c.id ? 'active' : ''}" data-type="channel" data-id="${c.id}">
                <span># ${c.name}</span>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<div style="padding:10px; opacity:0.5">Nessun canale</div>';
    }
}

function renderDmList(dms, container) {
    if (dms && dms.length > 0) {
        container.innerHTML = dms.map(c => {
            const otherMember = c.conversation_members?.find(m => m.user_id !== currentState.userId);
            const name = otherMember?.profiles?.full_name || otherMember?.profiles?.email || 'Utente';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            const otherUserId = otherMember?.user_id;
            const isOnline = otherUserId && chatStore.presence.get(otherUserId) === 'online';

            return `
             <div class="chat-nav-item ${currentState.contextId === c.id ? 'active' : ''}" data-type="conversation" data-id="${c.id}">
                <div class="flex items-center gap-2">
                    <div class="message-avatar small" style="width: 24px; height: 24px; font-size: 0.7rem; border-radius: 8px;">${initials}</div>
                    <div class="presence-dot ${isOnline ? 'online' : 'offline'}" style="margin-left: -12px; margin-top: 12px; border: 2px solid var(--bg-secondary);"></div>
                    <span>${name}</span> 
                </div>
            </div>
        `;
        }).join('');
    } else {
        container.innerHTML = '<div style="padding:10px; opacity:0.5">Nessun messaggio diretto</div>';
    }
}

function loadUnreads() {
    getUnreadCounts().then(unreads => {
        if (!unreads || unreads.length === 0) return;

        const getCount = (id) => {
            const entry = unreads.find(u => u.context_id === id);
            return entry ? entry.count : 0;
        };

        // Update badges on channels
        document.querySelectorAll('.chat-nav-item[data-type="channel"]').forEach(item => {
            const id = item.dataset.id;
            const count = getCount(id);
            const existingBadge = item.querySelector('.unread-badge');
            if (count > 0 && !existingBadge) {
                item.insertAdjacentHTML('beforeend', `<span class="unread-badge">${count}</span>`);
            }
        });

        // Update badges on DMs
        document.querySelectorAll('.chat-nav-item[data-type="conversation"]').forEach(item => {
            const id = item.dataset.id;
            const count = getCount(id);
            const existingBadge = item.querySelector('.unread-badge');
            if (count > 0 && !existingBadge) {
                item.insertAdjacentHTML('beforeend', `<span class="unread-badge">${count}</span>`);
            }
        });
    }).catch(err => {
        console.error('[Chat] Error loading unreads:', err);
    });
}

function setupEventListeners() {
    // Navigation
    document.addEventListener('click', (e) => {
        const item = e.target.closest('.chat-nav-item');
        if (item) {
            document.querySelectorAll('.chat-nav-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            const type = item.dataset.type;
            const id = item.dataset.id;
            loadChat(id, type);
            // Mobile: Close sidebar
            document.getElementById('chat-sidebar').classList.remove('open');
            document.getElementById('mobile-overlay').classList.remove('active');
        }
    });

    // Mobile Menu
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('chat-sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (mobileBtn) {
        mobileBtn.onclick = () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        };
    }
    if (overlay) {
        overlay.onclick = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        }
    }

    // Search
    const searchBtn = document.getElementById('search-btn');
    const searchModal = document.getElementById('search-modal');
    if (searchBtn && searchModal) {
        searchBtn.onclick = () => searchModal.classList.remove('hidden');
        searchModal.querySelector('.close-modal-btn').onclick = () => searchModal.classList.add('hidden');

        const sInput = document.getElementById('search-input');
        if (sInput) {
            let debounce;
            sInput.onkeyup = () => {
                clearTimeout(debounce);
                debounce = setTimeout(async () => {
                    const q = sInput.value;
                    if (q.length > 2) {
                        const results = await searchMessages(q);
                        renderSearchResults(results);
                    }
                }, 500);
            };
        }
    }

    // Send actions
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);

    const input = document.getElementById('message-input');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
            if (currentState.contextId) sendTyping(currentState.contextId, currentState.contextType);
        });
    }

    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await handleSendFile(e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    const createChanBtn = document.getElementById('create-channel-btn');
    if (createChanBtn) {
        createChanBtn.onclick = async () => {
            const name = await window.showPrompt("Nome del nuovo canale:");
            if (name) {
                createChannel(name).then(() => renderSidebar()).catch(err => window.showAlert("Errore: " + err.message, "error"));
            }
        };
    }

    const createDmBtn = document.getElementById('create-dm-btn');
    if (createDmBtn) {
        createDmBtn.onclick = async () => {
            const userId = await window.showPrompt("ID Utente per DM (es. copy UUID):");
            if (userId) {
                createDirectMessage(userId).then(() => renderSidebar()).catch(err => window.showAlert("Errore: " + err.message, "error"));
            }
        };
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<div class="pad-10">Nessun risultato</div>';
        return;
    }

    container.innerHTML = results.map(msg => {
        const isChannel = !!msg.channel_id;
        const contextType = isChannel ? 'channel' : 'conversation';
        const contextId = isChannel ? msg.channel_id : msg.conversation_id;

        return `
        <div class="search-result-item" onclick="window.chatActions.jumpToMessage('${msg.id}', '${contextId}', '${contextType}')">
            <strong>${msg.author?.email || 'User'}</strong>: ${msg.body.substring(0, 50)}...
            <div class="text-sm text-secondary">${new Date(msg.created_at).toLocaleDateString()}</div>
        </div>
    `;
    }).join('');
}

function renderMessages() {
    const list = document.getElementById('message-list');
    if (!list || !currentState.contextId) return;

    const messages = chatStore.getMessages(currentState.contextId);

    if (messages.length === 0) {
        list.innerHTML = '<div class="empty-state">Nessun messaggio qui. Inizia la conversazione!</div>';
        return;
    }

    list.innerHTML = '';

    const unreadMarkerIndex = currentState.unreadCountSnapshot > 0
        ? messages.length - currentState.unreadCountSnapshot
        : -1;

    messages.forEach((msg, index) => {
        if (index === unreadMarkerIndex) {
            const marker = document.createElement('div');
            marker.className = 'new-messages-divider';
            marker.innerHTML = '<span>Nuovi Messaggi</span>';
            list.appendChild(marker);
        }
        list.appendChild(createMessageElement(msg));
    });

    scrollToBottom();
}

function createMessageElement(msg) {
    const el = document.createElement('div');
    const isOwn = currentState.userId && msg.author_id === currentState.userId;
    const isPending = msg.status === 'sending';
    const isFailed = msg.status === 'failed';

    el.className = `message-item ${isOwn ? 'own' : ''} ${isPending ? 'pending' : ''} ${isFailed ? 'failed' : ''}`;
    el.dataset.id = msg.id;

    const authorName = msg.author?.full_name || msg.author?.email || (isOwn ? 'Tu' : 'Utente');
    const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

    // Content: Body + Attachments
    let attachmentHtml = '';
    if (msg.attachments && msg.attachments.length > 0) {
        const att = msg.attachments[0];
        const url = supabase.storage.from('chat-attachments').getPublicUrl(att.file_path).data.publicUrl;
        const ext = att.file_path.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

        if (isImage) {
            attachmentHtml = `<div class="attachment-image">
                <a href="${url}" target="_blank"><img src="${url}" alt="Image" loading="lazy" /></a>
            </div>`;
        } else {
            attachmentHtml = `<div class="attachment-file">
                <span class="material-icons-round">description</span>
                <a href="${url}" target="_blank">Allegato (${ext.toUpperCase()})</a>
            </div>`;
        }
    }

    // Reactions Processing
    let reactionsHtml = '';
    if (msg.reactions && msg.reactions.length > 0) {
        const counts = {};
        msg.reactions.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
        reactionsHtml = `<div class="reactions-bar">
            ${Object.entries(counts).map(([emoji, count]) => `
                <button class="reaction-pill" onclick="window.chatActions.toggleReaction('${msg.id}', '${emoji}')">
                    ${emoji} <span class="count">${count}</span>
                </button>
            `).join('')}
        </div>`;
    }

    // Action Bar
    const actionsHtml = `
        <div class="message-actions">
            <button class="action-btn" title="Reazione" onclick="window.chatActions.openEmoji('${msg.id}')">
                <span class="material-icons-round">add_reaction</span>
            </button>
            <button class="action-btn" title="Rispondi" onclick="window.chatActions.openThread('${msg.id}')">
                <span class="material-icons-round">reply</span>
            </button>
            ${isOwn ? `
                <button class="action-btn" title="Modifica" onclick="window.chatActions.edit('${msg.id}')">
                    <span class="material-icons-round">edit</span>
                </button>
                <button class="action-btn" title="Elimina" onclick="window.chatActions.delete('${msg.id}')">
                    <span class="material-icons-round">delete_outline</span>
                </button>
            ` : ''}
        </div>
    `;

    el.innerHTML = `
        <div class="message-avatar">${initials}</div>
        <div class="message-content">
            <div class="message-meta">
                <span class="author">${authorName}</span>
                <span class="time">${time}</span>
            </div>
            <div class="message-bubble">
                ${msg.body || ''}
                ${attachmentHtml}
            </div>
            ${reactionsHtml}
            ${isFailed ? '<div class="message-error" style="color:red; font-size:0.7em;">Invio fallito</div>' : ''}
        </div>
        ${!isPending && !isFailed ? actionsHtml : ''}
    `;
    return el;
}

window.chatActions = {
    toggleReaction: async (msgId, emoji) => {
        if (!currentState.contextId) return;
        chatStore.toggleReaction(currentState.contextId, msgId, emoji, currentState.userId);
        try {
            await toggleReaction(msgId, emoji, currentState.contextId, currentState.contextType);
        } catch (e) { console.error("Reaction failed:", e); }
    },
    openEmoji: async (msgId) => {
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
        const emoji = await window.showPrompt(`Scegli reazione:\n${emojis.join(' ')}`, '', { placeholder: 'Inserisci un emoji...' });
        if (emoji) window.chatActions.toggleReaction(msgId, emoji);
    },
    openThread: (msgId) => {
        openThreadPanel(msgId);
    },
    edit: async (msgId) => {
        const currentMsg = chatStore.getMessages(currentState.contextId).find(m => m.id === msgId);
        const newText = await window.showPrompt("Modifica messaggio:", currentMsg ? currentMsg.body : "");
        if (newText) {
            try { await editMessage(msgId, newText); } catch (e) { window.showAlert("Errore: " + e.message, "error"); }
        }
    },
    delete: async (msgId) => {
        if (await window.showConfirm("Eliminare messaggio?", { type: 'danger', confirmText: 'Elimina' })) {
            try { await deleteMessage(msgId); } catch (e) { window.showAlert("Errore: " + e.message, "error"); }
        }
    },
    jumpToMessage: async (msgId, contextId, contextType) => {
        document.getElementById('search-modal').classList.add('hidden');
        await loadChat(contextId, contextType);
        setTimeout(() => {
            const el = document.querySelector(`.message-item[data-id="${msgId}"]`);
            if (el) {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                el.classList.add('highlight');
                setTimeout(() => el.classList.remove('highlight'), 2000);
            }
        }, 500);
    }
};

async function openThreadPanel(parentMsgId) {
    const panel = document.getElementById('thread-panel');
    const list = document.getElementById('thread-messages');
    if (!panel || !list) return;

    panel.classList.remove('hidden');
    list.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    document.getElementById('close-thread-btn').onclick = () => panel.classList.add('hidden');

    try {
        const replies = await getReplies(parentMsgId);
        list.innerHTML = replies.map(msg => {
            const authorName = msg.author?.full_name || msg.author?.email || 'Utente';
            const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            return `
                <div class="thread-item">
                    <div class="message-avatar small">${initials}</div>
                    <div class="message-content">
                        <strong>${authorName}</strong> ${msg.body}
                    </div>
                </div>
             `;
        }).join('');

        const threadInput = document.getElementById('thread-input');
        threadInput.onkeydown = async (e) => {
            if (e.key === 'Enter') {
                const text = threadInput.value;
                if (!text) return;
                threadInput.value = '';
                await sendMessage(currentState.contextId, text, currentState.contextType, parentMsgId);
                const newReplies = await getReplies(parentMsgId);
                list.innerHTML = newReplies.map(msg => {
                    const authorName = msg.author?.full_name || msg.author?.email || 'Utente';
                    const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                    return `
                        <div class="thread-item">
                            <div class="message-avatar small">${initials}</div>
                            <div class="message-content">
                                <strong>${authorName}</strong> ${msg.body}
                            </div>
                        </div>
                     `;
                }).join('');
            }
        };

    } catch (err) {
        list.innerHTML = 'Errore caricamento thread.';
    }
}

async function loadChat(contextId, contextType) {
    if (currentState.contextId === contextId) return;

    if (currentState.subscription) currentState.subscription.unsubscribe();
    if (currentState.typingSubscription) currentState.typingSubscription.unsubscribe();

    currentState.contextId = contextId;
    currentState.contextType = contextType;
    chatStore.activeContextId = contextId;

    const unreads = await getUnreadCounts();
    const entry = unreads.find(u => u.context_id === contextId);
    currentState.unreadCountSnapshot = entry ? entry.count : 0;

    const titleEl = document.getElementById('chat-title');
    const msgList = document.getElementById('message-list');
    if (titleEl) titleEl.textContent = "Caricamento...";
    if (msgList) msgList.innerHTML = `<div class="loading-state"><span class="loader"></span></div>`;

    try {
        let messages = chatStore.getMessages(contextId);

        if (messages.length === 0) {
            messages = await listMessages(contextId, contextType);
            messages = messages.reverse();
            chatStore.setMessages(contextId, messages);
        }

        renderMessages();

        if (messages.length > 0) {
            markAsRead(messages[messages.length - 1].id, contextId, contextType).then(() => {
                currentState.unreadCountSnapshot = 0;
                // Optimistic clear in sidebar
                const badge = document.querySelector(`.chat-nav-item[data-id="${contextId}"] .unread-badge`);
                if (badge) badge.remove();

                // Re-render sidebar after a delay to sync with server
                setTimeout(() => renderSidebar(), 2000);
            }).catch(console.error);
        }

        // Set proper title
        if (titleEl) {
            if (contextType === 'channel') {
                const channel = chatStore.state.channels.find(c => c.id === contextId);
                titleEl.textContent = channel ? `# ${channel.name}` : '# Canale';
            } else {
                const conv = chatStore.state.conversations.find(c => c.id === contextId);
                const otherMember = conv?.conversation_members?.find(m => m.user_id !== currentState.userId);
                titleEl.textContent = otherMember?.profiles?.full_name || otherMember?.profiles?.email || 'Messaggio Diretto';
            }
        }

        currentState.subscription = subscribeToMessages(contextId, contextType, (newMsg) => {
            chatStore.appendMessage(contextId, newMsg);
            // If we are looking at this chat, mark as read immediately
            if (currentState.contextId === contextId) {
                markAsRead(newMsg.id, contextId, contextType).catch(console.error);
                currentState.unreadCountSnapshot = 0;
            }
        });

        currentState.typingSubscription = subscribeToTyping(contextId, () => {
            const ind = document.getElementById('typing-indicator');
            if (ind) {
                ind.textContent = "Qualcuno sta scrivendo...";
                setTimeout(() => ind.textContent = '', 3000);
            }
        });

    } catch (err) {
        console.error("Load Chat Error:", err);
        msgList.innerHTML = `<div class="empty-state error">Errore caricamento: ${err.message}</div>`;
    }
}

async function handleSendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const tempId = 'temp-' + Date.now();
    const contextId = currentState.contextId;

    const optimisticMsg = {
        id: tempId,
        client_temp_id: tempId,
        body: text,
        created_at: new Date().toISOString(),
        author_id: currentState.userId,
        author: { full_name: 'Tu' },
        status: 'sending'
    };

    chatStore.appendMessage(contextId, optimisticMsg);

    try {
        const realMsg = await sendMessage(contextId, text, currentState.contextType);
        chatStore.replaceOptimisticMessage(contextId, tempId, realMsg);
    } catch (err) {
        console.error("Send failed:", err);
        chatStore.updateMessage(contextId, tempId, { status: 'failed' });
    }
}

async function handleSendFile(file) {
    try {
        await sendAttachmentMessage(currentState.contextId, file, '', currentState.contextType);
    } catch (err) {
        window.showAlert("Errore invio file: " + err.message, "error");
    }
}

function scrollToBottom() {
    const list = document.getElementById('message-list');
    if (list) list.scrollTop = list.scrollHeight;
}
