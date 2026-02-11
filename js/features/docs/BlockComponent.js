/* ==========================================================================
   BLOCK COMPONENT
   ========================================================================== */
import { uploadImage, fetchDocPages } from '../../modules/docs_api.js';


export function createBlockElement(block, docSpaceId) {
    const el = document.createElement('div');
    el.className = 'doc-block';
    el.dataset.id = block.id;
    el.dataset.type = block.type;
    el.style.position = 'relative';
    el.style.marginBottom = '4px'; // Tighter spacing
    el.style.display = 'flex';
    el.style.alignItems = 'flex-start'; // Align top
    el.style.gap = '6px';

    // Handle / Action Menu Trigger
    const handle = document.createElement('div');
    handle.className = 'doc-block-handle';
    handle.contentEditable = false;
    handle.setAttribute('draggable', 'true'); // Only handle is draggable
    handle.style.width = '24px';
    handle.style.height = '24px';
    handle.style.flexShrink = '0';
    handle.style.display = 'flex';
    handle.style.alignItems = 'center';
    handle.style.justifyContent = 'center';
    handle.style.cursor = 'grab';
    handle.style.color = '#cbd5e1';
    handle.style.opacity = '0'; // Hidden by default
    handle.style.borderRadius = '4px';
    handle.style.transition = 'opacity 0.2s, background-color 0.2s';
    handle.innerHTML = '<span class="material-icons-round" style="font-size: 16px;">drag_indicator</span>';

    // Hover effects
    handle.onmouseenter = () => {
        handle.style.backgroundColor = '#f1f5f9';
        handle.style.color = '#64748b';
    };
    handle.onmouseleave = () => {
        handle.style.backgroundColor = 'transparent';
        handle.style.color = '#cbd5e1';
    };

    // Menu Click
    handle.onclick = (e) => {
        e.stopPropagation();
        // Dispatch event to show menu
        el.dispatchEvent(new CustomEvent('block-menu-request', {
            bubbles: true,
            detail: { block, x: e.clientX, y: e.clientY }
        }));
    };

    // Main wrapper for drag events (container logic)
    // We move drag listeners to handle mostly, but drop listeners stay on el



    // Drag Start (on handle)
    handle.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', block.id);
        el.style.opacity = '0.4';
        el.classList.add('dragging');
    };

    // Drop Targets (on EL)
    el.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.style.borderTop = '2px solid #3b82f6'; // Visual cue
    };
    el.ondragleave = () => {
        el.style.borderTop = 'none';
    };
    el.ondrop = (e) => {
        e.preventDefault();
        el.style.borderTop = 'none';
        el.style.opacity = '1';
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== block.id) {
            el.dispatchEvent(new CustomEvent('block-drop', { bubbles: true, detail: { sourceId, targetId: block.id } }));
        }
    };
    el.ondragend = () => {
        el.style.opacity = '1';
        el.classList.remove('dragging');
        document.querySelectorAll('.doc-block').forEach(b => b.style.borderTop = 'none');
    };

    // Show handle on block hover
    el.onmouseenter = () => handle.style.opacity = '1';
    el.onmouseleave = () => handle.style.opacity = '0';

    // Content Wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.style.flex = '1';
    contentWrapper.style.minWidth = '0'; // Flex fix


    // 1. Content Area
    // 1. Content Area
    const content = document.createElement('div');
    content.className = 'doc-block-content';
    content.contentEditable = true;
    content.style.outline = 'none';
    content.style.minHeight = '1.5em';
    content.style.lineHeight = '1.6';

    // Apply styles based on type
    switch (block.type) {
        case 'heading1':
            content.style.fontSize = '2.25em';
            content.style.fontWeight = '700';
            content.style.marginBottom = '0.5em';
            break;
        case 'heading2':
            content.style.fontSize = '1.75em';
            content.style.fontWeight = '600';
            content.style.marginTop = '1em';
            content.style.marginBottom = '0.25em';
            break;
        case 'heading3':
            content.style.fontSize = '1.35em';
            content.style.fontWeight = '600';
            content.style.marginTop = '0.75em';
            break;
        case 'quote':
            content.style.borderLeft = '4px solid #cbd5e1';
            content.style.paddingLeft = '16px';
            content.style.fontStyle = 'italic';
            content.style.color = '#475569';
            break;
        case 'list':
            // Visual trick: bullet outside?
            // For MVP, just simple text with bullet character check or styled div
            el.style.display = 'flex';
            const bullet = document.createElement('span');
            bullet.innerHTML = '&bull;';
            bullet.style.marginRight = '8px';
            bullet.style.marginTop = '0px'; // Visually align
            bullet.contentEditable = false;
            bullet.style.userSelect = 'none';
            el.prepend(bullet);
            break;
        case 'checklist':
            el.style.display = 'flex';
            el.style.alignItems = 'flex-start';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.marginRight = '8px';
            checkbox.style.marginTop = '5px';
            checkbox.style.cursor = 'pointer';
            checkbox.checked = block.content?.checked || false;

            // Visual style for checked state
            if (checkbox.checked) {
                content.style.textDecoration = 'line-through';
                content.style.color = '#94a3b8';
            }

            checkbox.onchange = (e) => {
                block.content.checked = e.target.checked;
                if (e.target.checked) {
                    content.style.textDecoration = 'line-through';
                    content.style.color = '#94a3b8';
                } else {
                    content.style.textDecoration = 'none';
                    content.style.color = 'inherit';
                }
                // Notify parent
                el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
            };

            el.prepend(checkbox);
            break;

        case 'image':
            content.contentEditable = false;

            // Clean slate
            content.innerHTML = '';

            if (block.content?.url) {
                const img = document.createElement('img');
                img.src = block.content.url;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                img.style.display = 'block';
                content.appendChild(img);
            } else {
                const wrapper = document.createElement('div');
                wrapper.className = 'image-upload-wrapper';
                wrapper.style.display = 'flex';
                wrapper.style.gap = '8px';
                wrapper.style.alignItems = 'center';
                wrapper.style.width = '100%';

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Paste image URL or upload...';
                input.style.flex = '1';
                input.style.padding = '8px 12px';
                input.style.borderRadius = '6px';
                input.style.border = '1px solid #cbd5e1';
                input.style.outline = 'none';

                const uploadLabel = document.createElement('label');
                uploadLabel.style.cursor = 'pointer';
                uploadLabel.innerHTML = '<span class="material-icons-round" style="font-size: 18px; margin-right: 4px; vertical-align: middle;">upload</span> Upload';
                uploadLabel.style.display = 'inline-flex';
                uploadLabel.style.alignItems = 'center';
                uploadLabel.style.justifyContent = 'center';
                uploadLabel.style.padding = '8px 12px';
                uploadLabel.style.backgroundColor = '#f1f5f9';
                uploadLabel.style.borderRadius = '6px';
                uploadLabel.style.border = '1px solid #cbd5e1';
                uploadLabel.style.fontSize = '13px';
                uploadLabel.style.color = '#334155';

                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';

                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        wrapper.innerHTML = '<div style="display:flex; alignItems:center; color: #64748b; font-size: 13px;"><span class="material-icons-round spin" style="font-size:16px; margin-right:6px">sync</span> Uploading...</div>';
                        const url = await uploadImage(file);
                        block.content.url = url;

                        content.innerHTML = '';
                        const img = document.createElement('img');
                        img.src = url;
                        img.style.maxWidth = '100%';
                        img.style.borderRadius = '8px';
                        img.style.display = 'block';
                        content.appendChild(img);

                        el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
                    } catch (err) {
                        console.error(err);
                        alert('Upload failed: ' + err.message);
                        wrapper.innerHTML = '<span style="color: red">Error. Try again.</span>';
                    }
                };

                uploadLabel.appendChild(fileInput);

                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (input.value.trim()) {
                            block.content.url = input.value.trim();

                            content.innerHTML = '';
                            const img = document.createElement('img');
                            img.src = input.value;
                            img.style.maxWidth = '100%';
                            img.style.borderRadius = '8px';
                            img.style.display = 'block';
                            content.appendChild(img);

                            el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
                        }
                    }
                };

                wrapper.appendChild(input);
                wrapper.appendChild(uploadLabel);
                content.appendChild(wrapper);
                setTimeout(() => input.focus(), 50);
            }
            break;

        case 'video':
        case 'embed':
            content.contentEditable = false;
            content.innerHTML = '';
            if (block.content?.url) {
                let embedUrl = block.content.url;
                let isVideo = block.type === 'video';

                // Helper to detect YouTube/Vimeo
                if (isVideo) {
                    if (embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')) {
                        const id = embedUrl.split('v=')[1]?.split('&')[0] || embedUrl.split('/').pop();
                        embedUrl = `https://www.youtube.com/embed/${id}`;
                    } else if (embedUrl.includes('vimeo.com')) {
                        const id = embedUrl.split('/').pop();
                        embedUrl = `https://player.vimeo.com/video/${id}`;
                    }
                }

                const iframe = document.createElement('iframe');
                iframe.src = embedUrl;
                iframe.style.width = '100%';
                iframe.style.height = '320px';
                iframe.style.border = 'none';
                iframe.style.borderRadius = '8px';
                iframe.style.backgroundColor = '#f1f5f9';
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                iframe.allowFullscreen = true;
                content.appendChild(iframe);
            } else {
                const wrapper = document.createElement('div');
                wrapper.style.padding = '12px';
                wrapper.style.backgroundColor = '#f8fafc';
                wrapper.style.borderRadius = '6px';
                wrapper.style.border = '1px solid #cbd5e1';
                wrapper.style.display = 'flex';
                wrapper.style.gap = '8px';

                const icon = document.createElement('span');
                icon.className = 'material-icons-round';
                icon.innerText = block.type === 'video' ? 'movie' : 'code';
                icon.style.color = '#64748b';

                const input = document.createElement('input');
                input.placeholder = block.type === 'video' ? 'Paste video link (YouTube, Vimeo)...' : 'Paste embed link...';
                input.style.flex = '1';
                input.style.border = 'none';
                input.style.background = 'transparent';
                input.style.outline = 'none';
                input.style.fontSize = '14px';

                const btn = document.createElement('button');
                btn.innerText = 'Embed';
                btn.className = 'btn-xs btn-primary';

                const submit = () => {
                    if (input.value.trim()) {
                        block.content.url = input.value.trim();
                        // Dispatch save
                        el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
                        // Re-render
                        // Ideally we request re-render from parent, but for now reloading page/editor handles it?
                        // Or we can just reload the content DOM here simple.
                        // Recursive call? No.
                        // Dispatch 'block-update-request' used in PageEditor?
                        // PageEditor listens to 'block-check-change'. It doesn't re-render.
                        // I'll manually replace content.
                        content.innerHTML = `<div style="padding:12px; color:#64748b">Loading... (Refresh to see if stuck)</div>`;
                        // Actually, I can just call createBlockElement again? No circular dependency.
                        // Simple hack: reload page? No.
                        // I'll assume PageEditor handles re-render if I trigger a specific event?
                        // Currently it doesn't.
                        // I will simple reload window for MVP or ask user to refresh? No.
                        // I'll try to re-render iframe logic here.
                        if (block.content.url) {
                            content.innerHTML = '';
                            let embedUrl = block.content.url;
                            if (block.type === 'video') {
                                if (embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')) {
                                    const id = embedUrl.split('v=')[1]?.split('&')[0] || embedUrl.split('/').pop();
                                    embedUrl = `https://www.youtube.com/embed/${id}`;
                                } else if (embedUrl.includes('vimeo.com')) {
                                    const id = embedUrl.split('/').pop();
                                    embedUrl = `https://player.vimeo.com/video/${id}`;
                                }
                            }
                            const iframe = document.createElement('iframe');
                            iframe.src = embedUrl;
                            iframe.style.width = '100%';
                            iframe.style.height = '320px';
                            iframe.style.border = 'none';
                            iframe.style.borderRadius = '8px';
                            content.appendChild(iframe);
                        }
                    }
                };

                btn.onclick = submit;
                input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };

                wrapper.appendChild(icon);
                wrapper.appendChild(input);
                wrapper.appendChild(btn);
                content.appendChild(wrapper);
                setTimeout(() => input.focus(), 50);
            }
            break;

        case 'audio':
            content.contentEditable = false;
            content.innerHTML = '';
            if (block.content?.url) {
                const audio = document.createElement('audio');
                audio.src = block.content.url;
                audio.controls = true;
                audio.style.width = '100%';
                content.appendChild(audio);
            } else {
                const wrapper = document.createElement('div');
                wrapper.style.padding = '12px';
                wrapper.style.backgroundColor = '#f8fafc';
                wrapper.style.borderRadius = '6px';
                wrapper.style.border = '1px solid #cbd5e1';
                wrapper.style.display = 'flex';
                wrapper.style.gap = '8px';

                const input = document.createElement('input');
                input.placeholder = 'Paste audio link (mp3)...';
                input.style.flex = '1';
                input.style.border = 'none';
                input.style.background = 'transparent';
                input.style.outline = 'none';

                const submit = () => {
                    if (input.value.trim()) {
                        block.content.url = input.value.trim();
                        el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));

                        content.innerHTML = '';
                        const audio = document.createElement('audio');
                        audio.src = block.content.url;
                        audio.controls = true;
                        audio.style.width = '100%';
                        content.appendChild(audio);
                    }
                };
                input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };

                wrapper.appendChild(input);
                content.appendChild(wrapper);
                setTimeout(() => input.focus(), 50);
            }
            break;


        case 'table':
            content.contentEditable = false;
            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'doc-table-wrapper';
            tableWrapper.style.overflowX = 'auto'; // Horizontal scroll

            // Format: [['c1', 'c2'], ['c3', 'c4']]
            if (!block.content.data || !Array.isArray(block.content.data)) {
                block.content.data = [['', ''], ['', '']];
            }

            const renderTable = () => {
                tableWrapper.innerHTML = '';
                const table = document.createElement('table');
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';
                table.style.marginTop = '8px';

                block.content.data.forEach((row, rIndex) => {
                    const tr = document.createElement('tr');
                    row.forEach((cell, cIndex) => {
                        const td = document.createElement('td');
                        td.style.border = '1px solid #cbd5e1';
                        td.style.padding = '8px';
                        td.style.minWidth = '100px';
                        td.contentEditable = true;
                        td.innerText = cell;

                        td.oninput = (e) => {
                            block.content.data[rIndex][cIndex] = e.target.innerText;
                            el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
                        };
                        tr.appendChild(td);
                    });
                    table.appendChild(tr);
                });
                tableWrapper.appendChild(table);
            };

            renderTable();

            const controls = document.createElement('div');
            controls.style.marginTop = '8px';
            controls.style.display = 'flex';
            controls.style.gap = '8px';

            const addRowBtn = document.createElement('button');
            addRowBtn.innerText = '+ Row';
            addRowBtn.style.padding = '4px 8px';
            addRowBtn.style.fontSize = '12px';
            addRowBtn.style.borderRadius = '4px';
            addRowBtn.style.border = '1px solid #cbd5e1';
            addRowBtn.style.backgroundColor = '#f1f5f9';
            addRowBtn.style.cursor = 'pointer';
            addRowBtn.onclick = (e) => {
                e.stopPropagation();
                const cols = block.content.data[0]?.length || 1;
                block.content.data.push(new Array(cols).fill(''));
                renderTable();
                el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
            };

            const addColBtn = document.createElement('button');
            addColBtn.innerText = '+ Col';
            addColBtn.style.padding = '4px 8px';
            addColBtn.style.fontSize = '12px';
            addColBtn.style.borderRadius = '4px';
            addColBtn.style.border = '1px solid #cbd5e1';
            addColBtn.style.backgroundColor = '#f1f5f9';
            addColBtn.style.cursor = 'pointer';
            addColBtn.onclick = (e) => {
                e.stopPropagation();
                block.content.data.forEach(row => row.push(''));
                renderTable();
                el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
            };

            controls.appendChild(addRowBtn);
            controls.appendChild(addColBtn);

            content.appendChild(tableWrapper);
            content.appendChild(controls);
            break;

        case 'link_to_page':
            content.contentEditable = false;
            content.innerHTML = '';

            if (block.content?.page_id) {
                // Render Page Link Card
                const linkCard = document.createElement('div');
                linkCard.className = 'page-link-card';
                linkCard.style.display = 'flex';
                linkCard.style.alignItems = 'center';
                linkCard.style.padding = '8px 12px';
                linkCard.style.gap = '8px';
                linkCard.style.borderRadius = '6px';
                linkCard.style.border = '1px solid #cbd5e1';
                linkCard.style.cursor = 'pointer';
                linkCard.style.backgroundColor = 'white';
                linkCard.style.width = 'fit-content';
                linkCard.style.maxWidth = '100%';

                linkCard.innerHTML = `
                    <span class="material-icons-round" style="font-size: 18px; color: #64748b;">description</span>
                    <span style="font-weight: 500; color: #334155; text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;">
                        ${block.content.title || 'Untitled Page'}
                    </span>
                    <span class="material-icons-round" style="font-size: 14px; color: #94a3b8; margin-left: eightpx;">arrow_forward</span>
                `;

                linkCard.onmouseenter = () => {
                    linkCard.style.backgroundColor = '#f8fafc';
                    linkCard.querySelector('span:nth-child(2)').style.textDecorationColor = '#334155';
                };
                linkCard.onmouseleave = () => {
                    linkCard.style.backgroundColor = 'white';
                    linkCard.querySelector('span:nth-child(2)').style.textDecorationColor = 'transparent';
                };

                linkCard.onclick = (e) => {
                    e.stopPropagation();
                    // Navigate to page
                    window.location.hash = `#docs/page/${block.content.page_id}`;
                };

                content.appendChild(linkCard);
            } else {
                // Render Page Selector
                const wrapper = document.createElement('div');
                wrapper.style.padding = '12px';
                wrapper.style.backgroundColor = '#f8fafc';
                wrapper.style.borderRadius = '6px';
                wrapper.style.border = '1px solid #cbd5e1';
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.gap = '8px';

                const searchInput = document.createElement('input');
                searchInput.placeholder = 'Search for a page to link...';
                searchInput.style.padding = '8px';
                searchInput.style.borderRadius = '4px';
                searchInput.style.border = '1px solid #cbd5e1';
                searchInput.style.width = '100%';

                const resultsDiv = document.createElement('div');
                resultsDiv.style.maxHeight = '150px';
                resultsDiv.style.overflowY = 'auto';
                resultsDiv.style.border = '1px solid #e2e8f0';
                resultsDiv.style.display = 'none';
                resultsDiv.style.backgroundColor = 'white';

                const showResults = async (query = '') => {
                    resultsDiv.innerHTML = '<div style="padding:8px; color:#94a3b8;">Loading...</div>';
                    resultsDiv.style.display = 'block';
                    try {
                        const pages = await fetchDocPages(docSpaceId);
                        const filtered = pages.filter(p => !query || p.title.toLowerCase().includes(query.toLowerCase()));

                        resultsDiv.innerHTML = '';
                        if (filtered.length === 0) {
                            resultsDiv.innerHTML = '<div style="padding:8px; color:#94a3b8;">No pages found</div>';
                        }

                        filtered.forEach(p => {
                            const item = document.createElement('div');
                            item.style.padding = '6px 8px';
                            item.style.cursor = 'pointer';
                            item.style.fontSize = '13px';
                            item.innerText = p.title || 'Untitled';
                            item.onmouseenter = () => item.style.backgroundColor = '#f1f5f9';
                            item.onmouseleave = () => item.style.backgroundColor = 'white';
                            item.onclick = (ev) => {
                                ev.stopPropagation();
                                block.content.page_id = p.id;
                                block.content.title = p.title;
                                el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));

                                content.innerHTML = `<div style="padding:8px; border:1px solid #ccc; border-radius:4px; cursor:pointer;">📄 ${p.title}</div>`;
                                // Ideally re-render fully but innerHTML swap is fine for MVP
                            };
                            resultsDiv.appendChild(item);
                        });
                    } catch (err) {
                        resultsDiv.innerText = 'Error loading pages';
                    }
                };

                searchInput.onfocus = () => showResults(searchInput.value);
                searchInput.oninput = (e) => showResults(e.target.value);

                wrapper.appendChild(searchInput);
                wrapper.appendChild(resultsDiv);
                content.appendChild(wrapper);
                setTimeout(() => searchInput.focus(), 50);
            }
            break;

        case 'code':
            content.contentEditable = false;
            const pre = document.createElement('pre');
            pre.style.background = '#f8fafc';
            pre.style.color = '#334155';
            pre.style.fontFamily = 'monospace';
            pre.style.fontSize = '13px';
            pre.style.padding = '12px';
            pre.style.borderRadius = '6px';
            pre.style.border = '1px solid #cbd5e1';
            pre.style.overflowX = 'auto';
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.margin = '4px 0';

            pre.innerText = block.content?.text || '';
            pre.contentEditable = true;
            pre.spellcheck = false;

            pre.oninput = (e) => {
                block.content.text = e.target.innerText;
                // We use check-change to update content
                el.dispatchEvent(new CustomEvent('block-check-change', { bubbles: true, detail: { block } }));
            };

            // Allow tab in code block?
            pre.onkeydown = (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    document.execCommand('insertText', false, '    ');
                }
            };

            content.appendChild(pre);
            break;
        default: // paragraph
            content.style.fontSize = '1em';
            break;
    }

    // Set initial content ONLY for text-based blocks
    // Set initial content ONLY for text-based blocks
    if (!['table', 'image', 'code', 'video', 'embed', 'audio', 'link_to_page'].includes(block.type)) {
        const text = block.content?.text || '';

        if (block.content?.html) {
            content.innerHTML = block.content.html;
        } else {
            content.innerText = text;
        }

        // Placeholder logic
        if (!text && !block.content?.html) {
            content.dataset.placeholder = getPlaceholder(block.type);
        }
    }

    contentWrapper.appendChild(content);
    el.appendChild(handle);
    el.appendChild(contentWrapper);

    return el;
}

function getPlaceholder(type) {
    switch (type) {
        case 'heading1': return 'Heading 1';
        case 'heading2': return 'Heading 2';
        case 'heading3': return 'Heading 3';
        case 'quote': return 'Empty quote';
        default: return "Type '/' for commands";
    }
}
