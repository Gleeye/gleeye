import { ensureDocSpace, fetchDocPages, createDocPage, fetchPageBlocks, deleteDocPage } from '../../modules/docs_api.js';
import { renderDocsSidebar, setupSidebarEvents } from './DocsSidebar.js';
import { renderPageEditor } from './PageEditor.js';

let currentSpaceId = null;
let currentDocSpace = null;
let currentPages = [];
let activePageId = null;

export async function renderDocsView(container, spaceId) {
    currentSpaceId = spaceId;
    container.innerHTML = '<div class="loading-state"><span class="loader"></span></div>';

    try {
        // 1. Ensure Doc Space exists
        currentDocSpace = await ensureDocSpace(spaceId);

        // 2. Fetch Pages
        currentPages = await fetchDocPages(currentDocSpace.id);

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
                    <div style="padding: 12px 24px; display: flex; justify-content: flex-end; border-bottom: 1px solid #f1f5f9;">
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
                    // Remove from local array
                    currentPages = currentPages.filter(p => p.id !== pageId);
                    // If active page deleted, clear editor
                    if (activePageId === pageId) {
                        activePageId = null;
                        document.getElementById('editor-container').innerHTML = `
                            <div class="empty-state" style="text-align: center; margin-top: 100px; color: #94a3b8;">
                                <span class="material-icons-round" style="font-size: 48px; margin-bottom: 16px;">delete</span>
                                <p>Pagina eliminata.</p>
                            </div>
                        `;
                    }
                    refreshSidebar();
                } catch (err) {
                    alert('Errore cancellazione pagina: ' + err.message);
                }
            }
        });

        // 6. Sidebar Toggle Logic
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('docs-sidebar');
        const content = document.getElementById('sidebar-content');
        let isCollapsed = false;

        toggleBtn.onclick = () => {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                sidebar.style.width = '40px';
                content.style.opacity = '0';
                content.style.pointerEvents = 'none';
                toggleBtn.querySelector('span').innerText = 'chevron_right';
                toggleBtn.style.right = '4px'; // Center
            } else {
                sidebar.style.width = '260px';
                content.style.opacity = '1';
                content.style.pointerEvents = 'all';
                toggleBtn.querySelector('span').innerText = 'chevron_left';
                toggleBtn.style.right = '8px';
            }
        };

        // 7. Export Logic
        document.getElementById('docs-export-btn').onclick = async () => {
            if (!activePageId) {
                alert('Select a page first.');
                return;
            }

            const choice = confirm("Export options:\nOK: Download Markdown\nCancel: Print / PDF");
            if (choice) {
                // Markdown
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
                // Print / PDF
                window.print();
            }
        };

        // 6. Mobile Toggle (if needed, simplified for MVP)
        // Check if no pages, maybe create one automatically?
        if (currentPages.length === 0) {
            // Optional: Create "Getting Started"?
        } else {
            // Select first page
            // loadPage(currentPages[0].id);
        }

    } catch (err) {
        console.error("Docs View Error:", err);
        container.innerHTML = `<div class="error-state">Errore caricamento documenti: ${err.message}</div>`;
    }
}

function refreshSidebar() {
    const treeContainer = document.getElementById('docs-tree');
    if (!treeContainer) return;
    renderDocsSidebar(treeContainer, currentPages, activePageId);
}

async function loadPage(pageId) {
    activePageId = pageId;
    refreshSidebar(); // Update active state

    // Pass container to Editor
    const editorContainer = document.getElementById('editor-container');
    const page = currentPages.find(p => p.id === pageId);

    if (page) {
        await renderPageEditor(editorContainer, page);
    }
}

// Global Listener for Updates (Sidebar Sync)
document.addEventListener('doc-page-updated', (e) => {
    // If the updated page is in currentPages, refresh.
    if (currentPages && currentPages.some(p => p.id === e.detail.pageId)) {
        refreshSidebar();
    }
});
