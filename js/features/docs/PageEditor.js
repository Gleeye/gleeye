import { fetchPageBlocks, createBlock, updateBlock, deleteBlock, updateDocPage, upsertBlocks, uploadImage } from '../../modules/docs_api.js';
import { createBlockElement } from './BlockComponent.js';
import { SlashMenu, BlockActionMenu } from './Menus.js';

let currentBlocks = [];
let currentPageId = null;
let currentSpaceId = null;
let saveTimeout = null;

export async function renderPageEditor(container, page) {
    currentPageId = page.id;
    currentSpaceId = page.space_ref;
    container.innerHTML = '';

    // 0. Cover Image
    const coverContainer = document.createElement('div');
    coverContainer.className = 'group'; // For hover effects if using Tailwind/Custom CSS
    coverContainer.style.position = 'relative';
    coverContainer.style.marginBottom = '24px';

    if (page.cover_image) {
        const img = document.createElement('img');
        img.src = page.cover_image;
        img.style.width = '100%';
        img.style.height = '220px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';

        const changeBtn = document.createElement('button');
        changeBtn.innerText = 'Change Cover';
        changeBtn.className = 'btn-xs btn-secondary';
        changeBtn.style.position = 'absolute';
        changeBtn.style.bottom = '10px';
        changeBtn.style.right = '10px';
        changeBtn.style.opacity = '0.8';
        changeBtn.onmouseover = () => changeBtn.style.opacity = '1';
        changeBtn.onclick = () => triggerCoverUpload(page);

        const removeBtn = document.createElement('button');
        removeBtn.innerText = 'Remove';
        removeBtn.className = 'btn-xs btn-secondary';
        removeBtn.style.position = 'absolute';
        removeBtn.style.bottom = '10px';
        removeBtn.style.right = '110px';
        removeBtn.style.opacity = '0.8';
        removeBtn.onclick = async () => {
            await updateDocPage(page.id, { cover_image: null });
            page.cover_image = null;
            renderPageEditor(container, page); // Re-render
        };

        coverContainer.appendChild(img);
        coverContainer.appendChild(changeBtn);
        coverContainer.appendChild(removeBtn);
    }
    container.appendChild(coverContainer);

    // 0.5 Icon & Meta Controls
    const metaRow = document.createElement('div');
    metaRow.style.marginBottom = '20px';
    metaRow.style.display = 'flex';
    metaRow.style.alignItems = 'flex-end';
    metaRow.style.gap = '16px';

    // Icon
    if (page.icon) {
        const iconDiv = document.createElement('div');
        iconDiv.innerText = page.icon;
        iconDiv.style.fontSize = '64px';
        iconDiv.style.lineHeight = '1';
        iconDiv.style.cursor = 'pointer';
        iconDiv.title = 'Click to change icon';
        iconDiv.onclick = () => {
            const newIcon = prompt("Enter an emoji:", page.icon);
            if (newIcon) updatePageIcon(page, newIcon, container);
        };
        metaRow.appendChild(iconDiv);
    }

    // Add Buttons (if missing items)
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';
    btnGroup.style.color = '#64748b';
    btnGroup.style.fontSize = '14px';
    btnGroup.style.marginBottom = page.icon ? '10px' : '0'; // Align based on icon presence

    if (!page.icon) {
        const addIconBtn = document.createElement('span');
        addIconBtn.innerHTML = '<span class="material-icons-round" style="font-size: 16px; vertical-align: text-bottom;">add_reaction</span> Add Icon';
        addIconBtn.style.cursor = 'pointer';
        addIconBtn.className = 'hover-text';
        addIconBtn.onclick = () => {
            const newIcon = prompt("Enter an emoji:", "📄");
            if (newIcon) updatePageIcon(page, newIcon, container);
        };
        btnGroup.appendChild(addIconBtn);
    }

    if (!page.cover_image) {
        const addCoverBtn = document.createElement('span');
        addCoverBtn.innerHTML = '<span class="material-icons-round" style="font-size: 16px; vertical-align: text-bottom;">image</span> Add Cover';
        addCoverBtn.style.cursor = 'pointer';
        addCoverBtn.className = 'hover-text';
        addCoverBtn.onclick = () => triggerCoverUpload(page, container);
        btnGroup.appendChild(addCoverBtn);
    }
    metaRow.appendChild(btnGroup);
    container.appendChild(metaRow);

    // 1. Page Title
    const titleParams = document.createElement('div');
    titleParams.style.marginBottom = '24px'; // Reduced margin

    const titleInput = document.createElement('h1');
    titleInput.contentEditable = true;
    titleInput.innerText = page.title || 'Untitled';
    titleInput.style.fontSize = '36px';
    titleInput.style.fontWeight = '700';
    titleInput.style.outline = 'none';
    titleInput.style.border = 'none';
    titleInput.style.color = '#1e293b';
    titleInput.style.marginBottom = '24px';
    titleInput.onblur = async () => {
        if (titleInput.innerText !== page.title) {
            await updateDocPage(page.id, { title: titleInput.innerText });
            page.title = titleInput.innerText; // Update local reference
            // Notify Sidebar to refresh
            document.dispatchEvent(new CustomEvent('doc-page-updated', { detail: { pageId: page.id } }));
        }
    };
    /* Placeholder? CSS needed */

    titleParams.appendChild(titleInput);
    container.appendChild(titleParams);

    // 2. Fetch Blocks
    currentBlocks = await fetchPageBlocks(page.id);

    if (!currentBlocks || currentBlocks.length === 0) {
        // Create initial empty block
        const newBlock = await createBlock(page.id, 'paragraph', { text: '' }, 0);
        currentBlocks = [newBlock];
    }

    // 3. Render Blocks Container
    const blocksContainer = document.createElement('div');
    blocksContainer.id = 'blocks-canvas';
    blocksContainer.style.paddingBottom = '100px';
    container.appendChild(blocksContainer);

    // Delegate Checkbox Changes
    blocksContainer.addEventListener('block-check-change', (e) => {
        const block = e.detail.block;
        updateBlock(block.id, { content: block.content });
    });

    // Delegate Drag & Drop
    blocksContainer.addEventListener('block-drop', handleBlockDrop);

    // Delegate Block Menu
    blocksContainer.addEventListener('block-menu-request', (e) => {
        const { block, x, y } = e.detail;
        BlockActionMenu.show(x, y, (action) => handleBlockAction(action, block, x, y));
    });

    // Hide menus on click
    container.addEventListener('click', () => {
        SlashMenu.hide();
        // BlockActionMenu handles its own outside click, but let's be safe
        BlockActionMenu.hide();
    });

    renderBlocks(blocksContainer);

    // 4. Global Event Listener for Editor
    // We attach to container to delegate events
    // Focus management is key.
}

function renderBlocks(container) {
    container.innerHTML = '';
    currentBlocks.forEach((block, index) => {
        const el = createBlockElement(block, currentSpaceId);

        // Attach Interaction Events
        const contentEditable = el.querySelector('.doc-block-content');

        contentEditable.onkeydown = (e) => handleBlockKeyDown(e, block, index);
        contentEditable.oninput = (e) => handleBlockInput(e, block, index);

        container.appendChild(el);
    });
}

// --- Event Handlers ---

async function handleBlockKeyDown(e, block, index) {
    // Cmd+Enter to force new block (useful to exit code block)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const newOrder = block.order_index + 1;
        // Check if next block exists, insert before?
        // Reuse logic below?
        // For simplicity, just let it fall through if I could? No, logic below has !shiftKey check.
        // I'll copy the creation logic or refactor.
        // Refactor: create a function insertBlockAfter(block, index, type)
        // For MVP inline:
        const newBlock = await createBlock(currentPageId, 'paragraph', { text: '' }, newOrder);
        currentBlocks.splice(index + 1, 0, newBlock);

        const container = document.getElementById('blocks-canvas');
        const newEl = createBlockElement(newBlock);
        const newContent = newEl.querySelector('.doc-block-content');
        newContent.onkeydown = (ev) => handleBlockKeyDown(ev, newBlock, index + 1);
        newContent.oninput = (ev) => handleBlockInput(ev, newBlock, index + 1);

        if (index === currentBlocks.length - 2) {
            container.appendChild(newEl);
        } else {
            container.insertBefore(newEl, container.children[index + 1]);
        }
        newContent.focus();
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        if (block.type === 'code') return; // Allow newline in code

        e.preventDefault();
        // Create new block after current
        // Check if current is empty checklist -> toggle to paragraph
        if (block.type === 'checklist' && !block.content.text && !block.content.html) {
            updateBlockType(block, 'paragraph', '');
            return;
        }

        const newOrder = block.order_index + 1;

        // If current is checklist/list, new one should match type
        const newType = (block.type === 'checklist' || block.type === 'list') ? block.type : 'paragraph';

        const newBlock = await createBlock(currentPageId, newType, { text: '' }, newOrder);

        // Insert into local state
        currentBlocks.splice(index + 1, 0, newBlock);

        // Re-render (inefficient but safe for MVP)
        // Optimization: append DOM element manually and focus it
        const container = document.getElementById('blocks-canvas');
        const newEl = createBlockElement(newBlock);

        // IMPORTANT: Move focus to content
        const newContent = newEl.querySelector('.doc-block-content');

        // Attach logic
        newContent.onkeydown = (ev) => handleBlockKeyDown(ev, newBlock, index + 1);
        newContent.oninput = (ev) => handleBlockInput(ev, newBlock, index + 1);

        if (index === currentBlocks.length - 2) { // was last
            container.appendChild(newEl);
        } else {
            container.insertBefore(newEl, container.children[index + 1]);
        }

        newContent.focus();
    }

    if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection.anchorOffset === 0 && selection.isCollapsed) {
            e.preventDefault();
            if (index > 0) {
                // Merge with previous
                const prevBlock = currentBlocks[index - 1];
                const prevEl = document.getElementById('blocks-canvas').children[index - 1];
                const prevContent = prevEl.querySelector('.doc-block-content');

                // Save cursor pos at end of prev
                const originalLength = prevContent.innerText.length;

                // Merge text
                const currentText = block.content?.text || '';
                const newText = (prevBlock.content?.text || '') + currentText;

                // Update prev block
                prevBlock.content.text = newText;
                prevContent.innerText = newText; // Update DOM
                updateBlock(prevBlock.id, { content: { text: newText } });

                // Delete current
                if (saveTimeout) clearTimeout(saveTimeout);
                await deleteBlock(block.id);
                currentBlocks.splice(index, 1);
                e.target.closest('.doc-block').remove();

                // Valid focus handling?
                // Set cursor
                // prevContent.focus(); // Simplified
            }
        }
    }

    // Slash Menu Navigation
    if (SlashMenu.element && SlashMenu.element.style.display !== 'none') {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            SlashMenu.navigate('up');
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            SlashMenu.navigate('down');
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            SlashMenu.selectCurrent();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            SlashMenu.hide();
            return;
        }
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (index > 0) {
            const prev = document.getElementById('blocks-canvas').children[index - 1].querySelector('.doc-block-content');
            prev.focus();
        }
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (index < currentBlocks.length - 1) {
            const next = document.getElementById('blocks-canvas').children[index + 1].querySelector('.doc-block-content');
            next.focus();
        }
    }
}

function handleBlockInput(e, block, index) {
    // Update local state - Use HTML for Rich Text Support
    const text = e.target.innerText;
    block.content.text = text;
    block.content.html = e.target.innerHTML;
    const cleanText = text.replace(/\u00A0/g, ' ');

    // Slash Menu Trigger
    if (cleanText.startsWith('/')) {
        // Remove newlines, non-breaking spaces, zero-width spaces, and trim
        // This regex removes all non-printable/control chars roughly
        let query = cleanText.substring(1).replace(/[\n\r\t\u200B\u00A0]/g, '').trim();
        // Also remove any other weird control chars
        query = query.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

        // Debug
        // console.log("Slash Query:", JSON.stringify(query));

        // Calculate Position
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Only show if we have valid coordinates
            if (rect.bottom > 0) {
                SlashMenu.show(rect.left, rect.bottom + 5, (type) => {
                    // On select
                    updateBlockType(block, type, ''); // Clear content
                });
                SlashMenu.filter(query);
            }
        }
    } else {
        SlashMenu.hide();
    }

    // Direct Commands (keep for speed)
    if (text.startsWith('/h1 ')) return updateBlockType(block, 'heading1', text.substring(4));
    if (text.startsWith('/h2 ')) return updateBlockType(block, 'heading2', text.substring(4));
    if (text.startsWith('[] ')) return updateBlockType(block, 'checklist', text.substring(3));


    // Debounce Save
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        updateBlock(block.id, { content: block.content });
    }, 1000);
}

async function updateBlockType(block, type, text) {
    block.type = type;
    block.content.text = text;
    await updateBlock(block.id, { type, content: block.content });

    // Re-render this block to apply new styles
    // Or just reload page for MVP simplicity if transformations are rare
    // Better: replace DOM element
    // To implement properly requires re-render of single element
    const container = document.getElementById('blocks-canvas');
    const oldEl = container.children[currentBlocks.indexOf(block)]; // Find index again to be safe?
    // Actually we passed index, but index might shift if we insert?
    // Use data-id
    const realIdx = currentBlocks.findIndex(b => b.id === block.id);

    const newEl = createBlockElement(block, currentSpaceId);
    // Attach events...
    const newContent = newEl.querySelector('.doc-block-content');
    newContent.onkeydown = (ev) => handleBlockKeyDown(ev, block, realIdx);
    newContent.oninput = (ev) => handleBlockInput(ev, block, realIdx);

    container.replaceChild(newEl, oldEl);
    newEl.querySelector('.doc-block-content').focus();
}

async function handleBlockDrop(e) {
    const { sourceId, targetId } = e.detail;
    const sourceIndex = currentBlocks.findIndex(b => b.id === sourceId);
    const targetIndex = currentBlocks.findIndex(b => b.id === targetId);

    if (sourceIndex > -1 && targetIndex > -1) {
        // Move block in array
        const [movedBlock] = currentBlocks.splice(sourceIndex, 1);
        currentBlocks.splice(targetIndex, 0, movedBlock);

        // Re-render
        const container = document.getElementById('blocks-canvas');
        renderBlocks(container);

        // Update Order Indices in DB
        // We'll update the order_index of all blocks to be safe and simple (0, 1, 2...)
        const updates = currentBlocks.map((b, idx) => ({
            id: b.id,
            order_index: idx, // Ensure consistent float/int
            page_ref: currentPageId //upsert needs all required fields? No, ID is primary key.
            // But RLS might need it? ID is enough for update.
            // Upsert on ID requires ID.
        }));

        await upsertBlocks(updates);
    }
}

// --- Icons & Covers Helpers ---

async function updatePageIcon(page, icon, container) {
    if (icon) {
        await updateDocPage(page.id, { icon });
        page.icon = icon;
        // Refresh sidebar
        document.dispatchEvent(new CustomEvent('doc-page-updated', { detail: { pageId: page.id } }));
        // Re-render editor
        if (container) renderPageEditor(container, page);
    }
}

function triggerCoverUpload(page, container) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const url = await uploadImage(file, 'covers');
            await updateDocPage(page.id, { cover_image: url });
            page.cover_image = url;

            // Re-render editor
            const editorContainer = document.getElementById('editor-container');
            if (editorContainer) renderPageEditor(editorContainer, page);

        } catch (err) {
            console.error(err);
            alert("Error uploading cover: " + err.message);
        }
    };
    input.click();
}

async function handleBlockAction(action, block, x, y) {
    const idx = currentBlocks.findIndex(b => b.id === block.id);
    if (idx === -1 && action !== 'delete') return; // Should not happen

    if (action === 'delete') {
        if (saveTimeout) clearTimeout(saveTimeout);
        await deleteBlock(block.id);
        if (idx > -1) {
            currentBlocks.splice(idx, 1);
            renderBlocks(document.getElementById('blocks-canvas'));
        }
    } else if (action === 'duplicate') {
        const currentOrder = block.order_index || 0;
        const nextOrder = currentBlocks[idx + 1]?.order_index || (currentOrder + 1000);
        const newOrder = (currentOrder + nextOrder) / 2;

        const newBlock = await createBlock(block.page_ref, block.type, block.content, newOrder);
        currentBlocks.splice(idx + 1, 0, newBlock);
        renderBlocks(document.getElementById('blocks-canvas'));
    } else if (action === 'turn_into') {
        // Show SlashMenu slightly offset
        SlashMenu.show(x + 20, y, async (type) => {
            // Transform
            block.type = type;
            // Ensure content matches structure? For text blocks it's fine.
            // For MVP assume text based.
            await updateBlock(block.id, { type: type, content: block.content });
            renderBlocks(document.getElementById('blocks-canvas'));
        });
    } else if (action === 'insert_above') {
        const currentOrder = block.order_index || 0;
        const prevOrder = idx > 0 ? (currentBlocks[idx - 1].order_index || 0) : (currentOrder - 1000);
        const newOrder = (prevOrder + currentOrder) / 2;

        const newBlock = await createBlock(block.page_ref, 'paragraph', { text: '' }, newOrder);
        currentBlocks.splice(idx, 0, newBlock);
        renderBlocks(document.getElementById('blocks-canvas'));
    } else if (action === 'insert_below') {
        const currentOrder = block.order_index || 0;
        const nextOrder = currentBlocks[idx + 1]?.order_index || (currentOrder + 1000);
        const newOrder = (currentOrder + nextOrder) / 2;

        const newBlock = await createBlock(block.page_ref, 'paragraph', { text: '' }, newOrder);
        currentBlocks.splice(idx + 1, 0, newBlock);
        renderBlocks(document.getElementById('blocks-canvas'));
    }
}
