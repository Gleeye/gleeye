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

    // 0. Cover Image (Removed logic for icons/covers as requested)
    const coverContainer = document.createElement('div');
    coverContainer.style.position = 'relative';
    coverContainer.style.marginBottom = '24px';
    container.appendChild(coverContainer);

    // 1. Page Title
    const titleParams = document.createElement('div');
    titleParams.style.marginBottom = '16px';
    titleParams.style.borderBottom = '1.5px solid rgba(0,0,0,0.08)';
    titleParams.style.paddingBottom = '6px';

    const titleInput = document.createElement('h1');
    titleInput.contentEditable = true;
    titleInput.className = 'page-title-input';
    titleInput.innerText = page.title || 'Untitled';
    titleInput.style.fontSize = '36px';
    titleInput.style.fontWeight = '700';
    titleInput.style.outline = 'none';
    titleInput.style.border = 'none';
    titleInput.style.color = 'var(--text-primary)';
    titleInput.style.margin = '0';
    titleInput.style.marginBottom = '6px';
    titleInput.style.width = '100%';
    titleInput.onblur = async () => {
        if (titleInput.innerText !== page.title) {
            await updateDocPage(page.id, { title: titleInput.innerText });
            page.title = titleInput.innerText;
            document.dispatchEvent(new CustomEvent('doc-page-updated', { detail: { pageId: page.id } }));
        }
    };

    titleParams.appendChild(titleInput);
    container.appendChild(titleParams);

    // 2. Fetch Blocks
    currentBlocks = await fetchPageBlocks(page.id);
    if (!currentBlocks || currentBlocks.length === 0) {
        const newBlock = await createBlock(page.id, 'paragraph', { text: '' }, 0);
        currentBlocks = [newBlock];
    }

    // 3. Render Blocks Container
    const blocksContainer = document.createElement('div');
    blocksContainer.className = 'blocks-canvas';
    blocksContainer.style.paddingBottom = '100px';
    container.appendChild(blocksContainer);

    // Delegate Checkbox Changes
    blocksContainer.addEventListener('block-check-change', (e) => {
        const block = e.detail.block;
        if (!block.id.toString().startsWith('temp-')) {
            updateBlock(block.id, { content: block.content });
        }
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
        BlockActionMenu.hide();
    });

    // Render first block if empty
    if (!currentBlocks || currentBlocks.length === 0) {
        const newBlock = await createBlock(page.id, 'paragraph', { text: '' }, 0);
        currentBlocks = [newBlock];
    }

    currentBlocks.forEach((block, index) => {
        const el = createBlockElement(block, currentSpaceId);
        attachBlockEvents(el, block, index);
        blocksContainer.appendChild(el);
    });

    // Hide menus on click or scroll
    const hideMenus = () => { SlashMenu.hide(); BlockActionMenu.hide(); };
    container.addEventListener('click', hideMenus);

    // In both normal and fullscreen, 'container' is the scrollable parent element
    container.addEventListener('scroll', hideMenus, { passive: true });
}

function attachBlockEvents(el, block, index) {
    const content = el.querySelector('.doc-block-content');
    content.onkeydown = (e) => handleBlockKeyDown(e, block);
    content.oninput = (e) => handleBlockInput(e, block);
}

// Helper to find index of a block by its DOM element
function getBlockIndex(el) {
    const canvas = el.closest('.blocks-canvas');
    if (!canvas) return -1;
    return Array.from(canvas.children).indexOf(el.closest('.doc-block'));
}

// --- Event Handlers ---

async function handleBlockKeyDown(e, block) {
    const index = getBlockIndex(e.target);
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    // 1. Slash Menu Navigation (Priority)
    if (SlashMenu.element && SlashMenu.element.style.display !== 'none') {
        if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
            e.preventDefault();
            if (e.key === 'ArrowUp') SlashMenu.navigate('up');
            else if (e.key === 'ArrowDown') SlashMenu.navigate('down');
            else if (e.key === 'Enter') SlashMenu.selectCurrent();
            else if (e.key === 'Escape') SlashMenu.hide();
            return;
        }
    }

    // 2. Handle Enter (Split Block)
    if (e.key === 'Enter' && !e.shiftKey) {
        if (block.type === 'code') return;
        e.preventDefault();

        const afterRange = range.cloneRange();
        afterRange.selectNodeContents(e.target);
        afterRange.setStart(range.endContainer, range.endOffset);
        const fragment = afterRange.extractContents();
        const afterText = fragment.textContent;

        // Update current block data (DB call in background)
        block.content.text = e.target.innerText;
        block.content.html = e.target.innerHTML;
        if (!block.id.toString().startsWith('temp-')) {
            updateBlock(block.id, { content: block.content });
        }

        const newType = (block.type === 'checklist' || block.type === 'list') ? block.type : 'paragraph';

        // OPTIMISTIC UI: Create and insert element BEFORE DB call
        const canvas = e.target.closest('.blocks-canvas');
        const tempId = 'temp-' + Date.now();
        const tempBlock = { id: tempId, type: newType, content: { text: afterText }, order_index: block.order_index + 1 };

        const newEl = createBlockElement(tempBlock, currentSpaceId);
        attachBlockEvents(newEl, tempBlock);

        if (index === canvas.children.length - 1) canvas.appendChild(newEl);
        else canvas.insertBefore(newEl, canvas.children[index + 1]);

        // Focus IMMEDIATELY
        const nextEl = newEl.querySelector('.doc-block-content');
        nextEl.focus();

        // RUN DB CALL IN BACKGROUND
        createBlock(currentPageId, newType, { text: afterText }, block.order_index + 1).then(realBlock => {
            tempBlock.id = realBlock.id;
            newEl.dataset.id = realBlock.id;
            currentBlocks.splice(index + 1, 0, realBlock);
        });

        return;
    }

    // 3. Handle Backspace (Merge Blocks)
    if (e.key === 'Backspace') {
        if (range.startOffset === 0 && range.collapsed) {
            if (index === 0) return;
            e.preventDefault();

            const currentEl = e.target.closest('.doc-block');
            const canvas = currentEl.closest('.blocks-canvas');
            const prevContainer = currentEl?.previousElementSibling;
            if (!prevContainer) return;

            const prevBlock = currentBlocks[index - 1];
            const prevEl = prevContainer.querySelector('.doc-block-content');
            if (!prevEl) return;

            const prevTextLength = prevEl.innerText.length;

            // OPTIMISTIC UI: Merge text and remove element IMMEDIATELY
            const mergedText = prevEl.innerText + e.target.innerText;
            prevEl.innerText = mergedText;

            currentBlocks.splice(index, 1);
            currentEl.remove();

            // Restore focus and cursor IMMEDIATELY
            prevEl.focus();

            const newRange = document.createRange();
            const newSel = window.getSelection();
            let node = prevEl.firstChild || prevEl;
            while (node.firstChild) node = node.firstChild;

            try {
                newRange.setStart(node, prevTextLength);
                newRange.collapse(true);
                newSel.removeAllRanges();
                newSel.addRange(newRange);
            } catch (err) {
                newRange.selectNodeContents(prevEl);
                newRange.collapse(false);
                newSel.removeAllRanges();
                newSel.addRange(newRange);
            }

            // RUN DB CALLS IN BACKGROUND
            prevBlock.content.text = mergedText;
            if (!prevBlock.id.toString().startsWith('temp-')) {
                updateBlock(prevBlock.id, { content: prevBlock.content });
            }
            if (!block.id.toString().startsWith('temp-')) {
                deleteBlock(block.id);
            }

            return;
        }
    }

    // 4. Handle Navigation (Arrows)
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const currentEl = e.target.closest('.doc-block');
        if (e.key === 'ArrowUp') {
            if (range.startOffset === 0) {
                const prev = currentEl?.previousElementSibling?.querySelector('.doc-block-content');
                if (prev) {
                    e.preventDefault();
                    prev.focus();
                }
            }
        } else if (e.key === 'ArrowDown') {
            if (range.startOffset === e.target.innerText.length) {
                const next = currentEl?.nextElementSibling?.querySelector('.doc-block-content');
                if (next) {
                    e.preventDefault();
                    next.focus();
                }
            }
        }
    }
}

function handleBlockInput(e, block, index) {
    const text = e.target.innerText;
    block.content.text = text;
    block.content.html = e.target.innerHTML;
    const cleanText = text.replace(/\u00A0/g, ' ');

    // Slash Menu Trigger - Logic improved for fluidity
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const contentNode = range.startContainer;

    // Only look at the current text node where the cursor is
    const textBefore = contentNode.textContent.substring(0, range.startOffset);
    const slashMatch = textBefore.match(/\/(\w*)$/);

    if (slashMatch) {
        const query = slashMatch[1].toLowerCase();
        const slashIndex = slashMatch.index;

        // CRITICAL: Get visual position for the EXACT '/' character
        const tempRange = document.createRange();
        try {
            tempRange.setStart(contentNode, slashIndex);
            tempRange.setEnd(contentNode, slashIndex + 1);

            const rects = tempRange.getClientRects();
            const rect = rects.length > 0 ? rects[0] : tempRange.getBoundingClientRect();

            if (rect.bottom > 0) {
                SlashMenu.show(rect.left, rect.bottom + 4, (type) => {
                    // Selection handling
                    const fullText = contentNode.textContent;
                    contentNode.textContent = fullText.substring(0, slashIndex) + fullText.substring(range.startOffset);
                    updateBlockType(block, type, contentNode.textContent);
                });
                SlashMenu.filter(query);
            }
        } catch (e) {
            SlashMenu.hide();
        }
    } else {
        SlashMenu.hide();
    }

    if (text.startsWith('/h1 ')) return updateBlockType(block, 'heading1', text.substring(4));
    if (text.startsWith('/h2 ')) return updateBlockType(block, 'heading2', text.substring(4));
    if (text.startsWith('[] ')) return updateBlockType(block, 'checklist', text.substring(3));

    if (saveTimeout) clearTimeout(saveTimeout);
    if (!block.id.toString().startsWith('temp-')) {
        saveTimeout = setTimeout(() => {
            updateBlock(block.id, { content: block.content });
        }, 1000);
    }
}

async function updateBlockType(block, type, text) {
    block.type = type;
    block.content.text = text;
    block.content.html = text; // reset html on type change

    if (!block.id.toString().startsWith('temp-')) {
        await updateBlock(block.id, { type, content: block.content });
    }

    // SURGICAL REPLACEMENT (Fast) - find canvas via current blocks in DOM
    const canvas = document.querySelector('.notion-fullscreen-wrapper .blocks-canvas') || document.querySelector('.blocks-canvas');
    const idx = currentBlocks.findIndex(b => b.id === block.id);
    if (idx > -1) {
        const oldEl = canvas.children[idx];
        if (!oldEl) return;

        const newEl = createBlockElement(block, currentSpaceId);
        attachBlockEvents(newEl, block, idx);
        canvas.replaceChild(newEl, oldEl);

        // Refocus & place cursor at end
        const contentEl = newEl.querySelector('.doc-block-content');
        contentEl.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(contentEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

async function handleBlockDrop(e) {
    const { sourceId, targetId } = e.detail;
    const sourceIndex = currentBlocks.findIndex(b => b.id === sourceId);
    const targetIndex = currentBlocks.findIndex(b => b.id === targetId);

    if (sourceIndex > -1 && targetIndex > -1) {
        const [movedBlock] = currentBlocks.splice(sourceIndex, 1);
        currentBlocks.splice(targetIndex, 0, movedBlock);

        // Re-calculate all order indices to stay consistent
        const updates = currentBlocks.map((b, idx) => ({ id: b.id, order_index: idx, page_ref: currentPageId }));
        await upsertBlocks(updates);

        // Surgical DOM Reorder:
        const canvas = document.querySelector('.notion-fullscreen-wrapper .blocks-canvas') || document.querySelector('.blocks-canvas');
        const sourceEl = canvas.querySelector(`[data-id="${sourceId}"]`);
        const targetEl = canvas.querySelector(`[data-id="${targetId}"]`);

        if (sourceEl && targetEl) {
            // Notion-like reorder (insert before target)
            canvas.insertBefore(sourceEl, targetEl);
        }
    }
}

async function handleBlockAction(action, block, x, y) {
    // Determine canvas based on action source if possible, or use fallback
    const canvas = document.querySelector('.notion-fullscreen-wrapper .blocks-canvas') || document.querySelector('.blocks-canvas');
    const idx = currentBlocks.findIndex(b => b.id === block.id);
    if (idx === -1 && action !== 'delete') return;

    if (action === 'delete') {
        if (saveTimeout) clearTimeout(saveTimeout);
        if (!block.id.toString().startsWith('temp-')) {
            await deleteBlock(block.id);
        }
        if (idx > -1) {
            currentBlocks.splice(idx, 1);
            canvas.children[idx].remove();
        }
    } else if (action === 'duplicate') {
        const newBlock = await createBlock(block.page_ref, block.type, block.content, block.order_index + 0.5);
        currentBlocks.splice(idx + 1, 0, newBlock);

        const newEl = createBlockElement(newBlock, currentSpaceId);
        attachBlockEvents(newEl, newBlock, idx + 1);
        canvas.insertBefore(newEl, canvas.children[idx + 1]);
    } else if (action === 'turn_into') {
        SlashMenu.show(x + 20, y, async (type) => {
            updateBlockType(block, type, block.content.text);
        });
    } else if (action === 'insert_above') {
        const newBlock = await createBlock(block.page_ref, 'paragraph', { text: '' }, block.order_index - 0.5);
        currentBlocks.splice(idx, 0, newBlock);

        const newEl = createBlockElement(newBlock, currentSpaceId);
        attachBlockEvents(newEl, newBlock, idx);
        canvas.insertBefore(newEl, canvas.children[idx]);
    } else if (action === 'insert_below') {
        const newBlock = await createBlock(block.page_ref, 'paragraph', { text: '' }, block.order_index + 0.5);
        currentBlocks.splice(idx + 1, 0, newBlock);

        const newEl = createBlockElement(newBlock, currentSpaceId);
        attachBlockEvents(newEl, newBlock, idx + 1);
        canvas.insertBefore(newEl, canvas.children[idx + 1]);
    }
}
