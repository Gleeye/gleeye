import { ensureDocSpace, fetchVisiblePages, createDocPage, fetchPageBlocks, deleteDocPage, fetchDocSubscription, toggleDocSubscription } from '../../modules/docs_api.js?v=1000';
import { renderDocsSidebar, setupSidebarEvents } from './DocsSidebar.js';
import { renderPageEditor } from './PageEditor.js';

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
                        <div class="sidebar-header" style="padding: 16px; display: flex; align-items: center;">
                            <h3 style="font-size: 14px; font-weight: 600; color: #334155; flex: 1;">Documenti</h3>
                            <button id="add-page-btn" class="icon-btn-sm" title="Nuova Pagina" style="margin-right: 20px;">
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
                     <div style="padding: 12px 24px; display: flex; justify-content: flex-end; align-items: center; gap: 10px; border-bottom: 1px solid #f1f5f9;">
                         <button id="docs-notify-btn" class="btn-sm" style="display: none; align-items: center; justify-content: center; padding: 6px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; color: #64748b;" title="Ricevi notifiche per questa pagina">
                            <span class="material-icons-round" style="font-size: 20px;">notifications_none</span>
                         </button>
                         <button id="docs-share-btn" class="btn-sm" style="display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: white; border: 1px solid var(--brand-blue); border-radius: 6px; cursor: pointer; color: var(--brand-blue); font-weight: 600;">
                            <span class="material-icons-round" style="font-size: 16px;">share</span>
                            <span style="font-size: 13px;">Condividi</span>
                         </button>
                         <button id="docs-export-btn" class="btn-sm" style="display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; color: #475569;">
                            <span class="material-icons-round" style="font-size: 16px;">file_download</span>
                            <span style="font-size: 13px;">Export</span>
                         </button>
                    </div>
                    <div id="editor-container" style="flex: 1; overflow-y: auto; padding: 40px 60px; max-width: 900px; margin: 0 auto; width: 100%;">
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
            onPageCreate: async () => {
                const newPage = await createDocPage(currentDocSpace.id);
                currentPages.push(newPage);
                refreshSidebar();
                loadPage(newPage.id);
            },
            onPageCreateSub: async (parentId) => {
                const newPage = await createDocPage(currentDocSpace.id, parentId);
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
        await renderPageEditor(editorContainer, page);
    }
}

document.addEventListener('doc-page-updated', (e) => {
    if (currentPages && currentPages.some(p => p.id === e.detail.pageId)) {
        refreshSidebar();
    }
});
