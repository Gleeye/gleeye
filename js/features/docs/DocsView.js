import { ensureDocSpace, fetchVisiblePages, createDocPage, fetchPageBlocks, deleteDocPage, fetchDocSubscription, toggleDocSubscription } from '../../modules/docs_api.js?v=1000';
import { renderDocsSidebar, setupSidebarEvents } from './DocsSidebar.js';
import { renderPageEditor } from './PageEditor.js';
import { renderWhiteboardEditor } from './WhiteboardEditor.js';

let currentSpaceId = null;
let currentDocSpace = null;
let currentPages = [];
let activePageId = null;
let currentContainer = null;

export async function renderDocsView(container, spaceId) {
    currentContainer = container;
    currentSpaceId = spaceId;

    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
        // 1. Ensure Doc Space exists
        currentDocSpace = await ensureDocSpace(spaceId);

        // 2. Fetch Pages (Filtered by permissions)
        currentPages = await fetchVisiblePages(currentDocSpace.id);

        // 3. Render Structure
        container.innerHTML = `
            <div class="docs-layout" style="display: flex; height: 100%; overflow: hidden;">
                <!-- Sidebar -->
                <div id="docs-sidebar" class="docs-sidebar" style="
                    width: 260px; 
                    background: #fdfdfd; 
                    border-right: 1px solid rgba(0,0,0,0.06);
                    display: flex; flex-direction: column;
                    transition: width 0.3s ease;
                    position: relative;
                ">
                    <button id="sidebar-toggle" style="
                        position: absolute; right: 8px; top: 14px; z-index: 10;
                        background: transparent; border: none; cursor: pointer; color: #64748b;
                        padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
                    " title="Toggle Sidebar">
                        <span class="material-icons-round" style="font-size: 20px;">chevron_left</span>
                    </button>

                    <div id="sidebar-content" style="display: flex; flex-direction: column; height: 100%; opacity: 1; transition: opacity 0.2s;">
                        <div class="sidebar-header" style="padding: 16px 40px 16px 12px; display: flex; align-items: center; justify-content: space-between;">
                            <h3 style="font-size: 0.8rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Documenti</h3>
                            <button id="add-page-btn" style="
                                width: 28px; height: 28px; border-radius: 8px; 
                                background: var(--surface-2); border: none; 
                                display: flex; align-items: center; justify-content: center;
                                color: var(--text-secondary); cursor: pointer; transition: all 0.2s;
                            " title="Nuova Pagina" onmouseover="this.style.background='var(--brand-blue)'; this.style.color='white'" onmouseout="this.style.background='var(--surface-2)'; this.style.color='var(--text-secondary)'">
                                <span class="material-icons-round" style="font-size: 18px;">add</span>
                            </button>
                        </div>
                        <div id="docs-tree" style="flex: 1; overflow-y: auto; padding: 0 8px;">
                            <!-- Tree Rendered Here -->
                        </div>
                    </div>
                </div>

                <!-- Main Editor Area -->
                <div id="docs-main" style="flex: 1; display: flex; flex-direction: column; background: white; position: relative;">
                     <div style="padding: 10px 24px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; border-bottom: 1px solid var(--surface-2); background: #fff;">
                         <button id="docs-fullscreen-btn" style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: white; border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; color: var(--text-tertiary); transition: all 0.2s;" title="Espandi a schermo intero" onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.color='var(--brand-blue)'" onmouseout="this.style.borderColor='var(--glass-border)'; this.style.color='var(--text-tertiary)'">
                            <span class="material-icons-round" style="font-size: 18px;">open_in_full</span>
                         </button>
                         <button id="docs-notify-btn" style="display: none; align-items: center; justify-content: center; width: 32px; height: 32px; background: white; border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; color: var(--text-tertiary); transition: all 0.2s;" title="Ricevi notifiche per questa pagina" onmouseover="this.style.borderColor='var(--brand-blue)'; this.style.color='var(--brand-blue)'" onmouseout="if(!this.querySelector('span').innerText.includes('active')){this.style.borderColor='var(--glass-border)'; this.style.color='var(--text-tertiary)'}">
                            <span class="material-icons-round" style="font-size: 18px;">notifications_none</span>
                         </button>
                         <button id="docs-share-btn" style="display: flex; align-items: center; gap: 6px; padding: 0 12px; height: 32px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 8px; cursor: pointer; color: var(--brand-blue); font-weight: 700; transition: all 0.2s; font-size: 0.75rem;" onmouseover="this.style.background='rgba(59, 130, 246, 0.1)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.05)'; this.style.transform='translateY(0)'">
                            <span class="material-icons-round" style="font-size: 16px;">share</span>
                            Condividi
                         </button>
                         <button id="docs-export-btn" style="display: flex; align-items: center; gap: 6px; padding: 0 12px; height: 32px; background: white; border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; color: var(--text-secondary); font-weight: 600; transition: all 0.2s; font-size: 0.75rem;" onmouseover="this.style.borderColor='var(--text-primary)'; this.style.color='var(--text-primary)'" onmouseout="this.style.borderColor='var(--glass-border)'; this.style.color='var(--text-secondary)'">
                            <span class="material-icons-round" style="font-size: 16px;">file_download</span>
                            Esporta
                         </button>
                    </div>
                    <div id="editor-container" style="flex: 1; overflow-y: auto; padding: 0 60px 40px; max-width: 900px; margin: 0 auto; width: 100%;">
                        <div class="empty-state" style="text-align: center; margin-top: 100px; color: #94a3b8;">
                            <span class="material-icons-round" style="font-size: 48px; margin-bottom: 16px;">description</span>
                            <p>Seleziona una pagina o creane una nuova.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 4. Render Sidebar Tree
        refreshSidebar();

        // 5. Setup Events
        setupSidebarEvents({
            onPageSelect: (pageId) => loadPage(pageId),
            onPageCreate: async (type = 'document') => {
                const newPage = await createDocPage(currentDocSpace.id, null, type === 'whiteboard' ? 'Nuova Whiteboard' : 'Pagina senza titolo', type);
                currentPages.push(newPage);
                refreshSidebar();
                loadPage(newPage.id);
            },
            onPageCreateSub: async (parentId, type = 'document') => {
                const newPage = await createDocPage(currentDocSpace.id, parentId, type === 'whiteboard' ? 'Nuova Whiteboard' : 'Pagina senza titolo', type);
                currentPages.push(newPage);
                refreshSidebar();
                loadPage(newPage.id);
            },
            onPageDelete: async (pageId) => {
                try {
                    await deleteDocPage(pageId);
                    currentPages = currentPages.filter(p => p.id !== pageId);
                    if (activePageId === pageId) {
                        activePageId = null;
                        const editorContainer = currentContainer.querySelector('#editor-container');
                        if (editorContainer) {
                            editorContainer.innerHTML = `
                                <div class="empty-state" style="text-align: center; margin-top: 100px; color: #94a3b8;">
                                    <span class="material-icons-round" style="font-size: 48px; margin-bottom: 16px;">delete</span>
                                    <p>Pagina eliminata.</p>
                                </div>
                            `;
                        }
                    }
                    refreshSidebar();
                } catch (err) {
                    alert('Errore cancellazione pagina: ' + err.message);
                }
            }
        });

        // 6. Sidebar Toggle Logic
        const toggleBtn = currentContainer.querySelector('#sidebar-toggle');
        const sidebar = currentContainer.querySelector('#docs-sidebar');
        const content = currentContainer.querySelector('#sidebar-content');
        let isCollapsed = false;

        if (toggleBtn && sidebar && content) {
            toggleBtn.onclick = () => {
                isCollapsed = !isCollapsed;
                if (isCollapsed) {
                    sidebar.style.width = '40px';
                    content.style.opacity = '0';
                    content.style.pointerEvents = 'none';
                    const icon = toggleBtn.querySelector('span');
                    if (icon) icon.innerText = 'chevron_right';
                    toggleBtn.style.right = '4px';
                } else {
                    sidebar.style.width = '260px';
                    content.style.opacity = '1';
                    content.style.pointerEvents = 'all';
                    const icon = toggleBtn.querySelector('span');
                    if (icon) icon.innerText = 'chevron_left';
                    toggleBtn.style.right = '8px';
                }
            };
        }

        // 7. Share Logic
        const shareBtn = currentContainer.querySelector('#docs-share-btn');
        if (shareBtn) {
            shareBtn.onclick = async () => {
                if (!activePageId) {
                    alert('Seleziona una pagina per condividerla.');
                    return;
                }
                const page = currentPages.find(p => p.id === activePageId);
                const { openPageSharingModal } = await import('./PageSharingModal.js');
                openPageSharingModal(page);
            };
        }

        // 8. Export Logic
        const exportBtn = currentContainer.querySelector('#docs-export-btn');
        if (exportBtn) {
            exportBtn.onclick = async () => {
                if (!activePageId) {
                    alert('Seleziona una pagina per esportarla.');
                    return;
                }

                const choice = confirm("Opzioni Export:\nOK: Scarica Markdown\nAnnulla: Stampa / PDF");
                if (choice) {
                    const page = currentPages.find(p => p.id === activePageId);
                    const blocks = await fetchPageBlocks(activePageId);
                    let md = `# ${page.title || 'Untitled'}\n\n`;

                    blocks.forEach(b => {
                        const text = b.content.text || '';
                        if (b.type === 'heading1') md += `# ${text}\n\n`;
                        else if (b.type === 'heading2') md += `## ${text}\n\n`;
                        else if (b.type === 'heading3') md += `### ${text}\n\n`;
                        else if (b.type === 'list') md += `- ${text}\n`;
                        else if (b.type === 'checklist') md += `- [${b.content.checked ? 'x' : ' '}] ${text}\n`;
                        else if (b.type === 'quote') md += `> ${text}\n\n`;
                        else if (b.type === 'code') md += `\`\`\`\n${text}\n\`\`\`\n\n`;
                        else if (b.type === 'divider') md += `---\n\n`;
                        else if (b.type === 'image') md += `![Image](${b.content.url})\n\n`;
                        else md += `${text}\n\n`;
                    });

                    const blob = new Blob([md], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${page.title || 'document'}.md`;
                    a.click();
                } else {
                    window.print();
                }
            };
        }

        // 9. Notify Toggle Logic
        const notifyBtn = currentContainer.querySelector('#docs-notify-btn');
        if (notifyBtn) {
            notifyBtn.onclick = async () => {
                if (!activePageId) return;
                const icon = notifyBtn.querySelector('span');
                const isSubscribed = icon.innerText === 'notifications_active';

                try {
                    notifyBtn.style.opacity = '0.5';
                    notifyBtn.style.pointerEvents = 'none';

                    await toggleDocSubscription(activePageId, !isSubscribed);

                    if (!isSubscribed) {
                        icon.innerText = 'notifications_active';
                        notifyBtn.style.color = 'var(--brand-blue)';
                        notifyBtn.style.borderColor = 'var(--brand-blue)';
                        notifyBtn.title = 'Notifiche attivate';
                    } else {
                        icon.innerText = 'notifications_none';
                        notifyBtn.style.color = '#64748b';
                        notifyBtn.style.borderColor = '#cbd5e1';
                        notifyBtn.title = 'Notifiche disattivate (Clicca per attivare)';
                    }
                } catch (err) {
                    console.error("Toggle sub error:", err);
                } finally {
                    notifyBtn.style.opacity = '1';
                    notifyBtn.style.pointerEvents = 'all';
                }
            };
        }

        // 11. Fullscreen Logic
        const fullscreenBtn = currentContainer.querySelector('#docs-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.onclick = () => {
                const page = currentPages.find(p => p.id === activePageId);
                if (page) openFullscreenEditor(page);
            };
        }

        // 10. Auto-load first page
        if (currentPages.length > 0 && !activePageId) {
            loadPage(currentPages[0].id);
        }

    } catch (err) {
        console.error("Docs View Error:", err);
        container.innerHTML = `<div class="error-state">Errore caricamento documenti: ${err.message}</div>`;
    }
}

function refreshSidebar() {
    if (!currentContainer) return;
    const treeContainer = currentContainer.querySelector('#docs-tree');
    if (!treeContainer) return;
    renderDocsSidebar(treeContainer, currentPages, activePageId);
}

async function loadPage(pageId) {
    activePageId = pageId;
    refreshSidebar();

    if (!currentContainer) return;
    const editorContainer = currentContainer.querySelector('#editor-container');
    if (!editorContainer) return;
    const page = currentPages.find(p => p.id === pageId);

    if (page) {
        // Update notification bell state
        const notifyBtn = currentContainer.querySelector('#docs-notify-btn');
        if (notifyBtn) {
            notifyBtn.style.display = 'flex';
            const icon = notifyBtn.querySelector('span');
            try {
                const sub = await fetchDocSubscription(pageId);
                if (sub) {
                    icon.innerText = 'notifications_active';
                    notifyBtn.style.color = 'var(--brand-blue)';
                    notifyBtn.style.borderColor = 'var(--brand-blue)';
                    notifyBtn.title = 'Notifiche attivate';
                } else {
                    icon.innerText = 'notifications_none';
                    notifyBtn.style.color = '#64748b';
                    notifyBtn.style.borderColor = '#cbd5e1';
                    notifyBtn.title = 'Notifiche disattivate (Clicca per attivare)';
                }
            } catch (err) {
                console.error("Fetch sub error:", err);
            }
        }

        if (page.page_type === 'whiteboard') {
            editorContainer.style.padding = '0';
            editorContainer.style.maxWidth = 'none';
            editorContainer.style.height = '100%';
            editorContainer.style.overflow = 'hidden';
            await renderWhiteboardEditor(editorContainer, page);
        } else {
            editorContainer.style.padding = '0 60px 40px';
            editorContainer.style.maxWidth = '900px';
            editorContainer.style.height = 'auto'; // Depending on flex layout
            editorContainer.style.overflowY = 'auto';
            await renderPageEditor(editorContainer, page);
        }
    }
}

async function openFullscreenEditor(page) {
    const isWhiteboard = page.page_type === 'whiteboard';
    const modalId = 'fullscreen-doc-modal';

    // Create the content based on type
    const wrapperStyle = isWhiteboard
        ? "width: 100vw; height: 100vh; background: white; position: relative;"
        : "width: 100%; max-width: 900px; height: 100vh; background: white; margin: 0 auto; box-shadow: 0 0 100px rgba(0,0,0,0.2); position: relative; animation: paperSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column;";

    const content = `
        <div class="notion-fullscreen-wrapper" style="${wrapperStyle}">
            <!-- Actions Layer -->
            <div style="position: absolute; top: 20px; right: ${isWhiteboard ? '20px' : '-60px'}; z-index: 10000;">
                <button class="close-modal" style="
                    background: rgba(255, 255, 255, 0.2); 
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 50%; 
                    width: 44px; height: 44px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    color: ${isWhiteboard ? '#000' : '#fff'};
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                " onclick="document.getElementById('${modalId}').classList.remove('active'); setTimeout(() => document.getElementById('${modalId}').remove(), 300)" title="Chiudi (ESC)">
                    <span class="material-icons-round" style="font-size: 24px;">close</span>
                </button>
            </div>

            <!-- Editor Surface -->
            <div id="fullscreen-editor-container" style="
                flex: 1; 
                overflow-y: auto; 
                padding: ${isWhiteboard ? '0' : '60px 80px'};
                width: 100%;
                height: 100%;
                background: white;
            ">
                <!-- Page Editor will render here -->
            </div>
        </div>
    `;

    // Dynamic Style Injection for precise modal control
    const styleId = 'fullscreen-portal-css';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            #${modalId} { padding: 0 !important; z-index: 1000000 !important; }
            #${modalId} .modal-content {
                background: transparent !important;
                max-width: none !important;
                width: 100vw !important;
                height: 100vh !important;
                border-radius: 0 !important;
                border: none !important;
                box-shadow: none !important;
                overflow: visible !important;
                display: flex;
                justify-content: center;
                align-items: center;
                backdrop-filter: blur(8px);
                background: rgba(0,0,0,0.6) !important;
            }
            @keyframes paperSlideUp {
                from { transform: translateY(40px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    const { renderModal } = await import('../../modules/utils.js');
    renderModal(modalId, content);

    const container = document.getElementById('fullscreen-editor-container');
    if (isWhiteboard) {
        await renderWhiteboardEditor(container, page);
    } else {
        await renderPageEditor(container, page);
    }

    // Add ESC support
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            const m = document.getElementById(modalId);
            if (m) {
                m.classList.remove('active');
                setTimeout(() => m.remove(), 300);
            }
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

document.addEventListener('doc-page-updated', (e) => {
    if (currentPages && currentPages.some(p => p.id === e.detail.pageId)) {
        refreshSidebar();
    }
});
