// Tab "📂 File" nell'hub_drawer.
// Gestisce file Dropbox (Categoria B) + link esterni (Categoria C) con
// permessi gerarchici + toggle "Condividi sotto".
//
// Esporta: initFilesTab(drawer, itemId, spaceId)
//          initClientFilesTab(container, clientId)

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

// File piccoli: upload singolo. File grandi: chunked upload session.
// Chunk size 3.5MB raw → ~4.7MB base64 (sotto 6MB Supabase body limit).
const SINGLE_UPLOAD_LIMIT = 3.5 * 1024 * 1024; // 3.5MB raw
const CHUNK_SIZE = 3.5 * 1024 * 1024; // chunk size per upload session
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB limite di sicurezza UI (Dropbox supporta 350GB)

export function initFilesTab(drawer, itemId, spaceId) {
    const pane = drawer.querySelector('#tab-files');
    if (!pane) return;

    pane.innerHTML = renderShell();
    wireUpload(drawer, itemId, spaceId);
    wireAddLink(drawer, itemId, spaceId);
    wireShareFolder(drawer, itemId, spaceId);
    refresh(drawer, itemId, spaceId);
}

function wireShareFolder(drawer, itemId, spaceId) {
    const btn = drawer.querySelector('#files-share-folder-btn');
    if (!btn) return;
    btn.onclick = async () => {
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">sync</span> Generando...';
        try {
            const result = await callDropboxProxy({
                action: 'share-folder',
                pm_space_ref: itemId ? null : spaceId,
                pm_item_ref: itemId || null,
            });
            if (result?.url) {
                // Mostra modal con URL + copy
                document.getElementById('files-share-modal')?.remove();
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="files-share-modal" class="modal active" style="z-index: 11500;">
                        <div class="modal-content glass-card" style="max-width: 560px; padding: 1.5rem;">
                            <h3 style="margin: 0 0 0.5rem; font-size: 1.1rem;">📤 Link cartella Dropbox</h3>
                            <p style="font-size: 0.82rem; color: #64748b; margin: 0 0 1rem;">Chiunque ha questo link può vedere/scaricare i file della cartella. Usalo per condividere con clienti o consulenti esterni.</p>
                            <div style="background: #f1f5f9; border-radius: 8px; padding: 0.7rem; font-family: monospace; font-size: 0.78rem; word-break: break-all; margin-bottom: 0.75rem;">${escapeHtml(result.url)}</div>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 1rem;">📁 ${escapeHtml(result.folder)}</div>
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                <button id="share-modal-copy" class="primary-btn small">
                                    <span class="material-icons-round" style="font-size: 14px;">content_copy</span> Copia link
                                </button>
                                <a href="${escapeAttr(result.url)}" target="_blank" class="primary-btn small secondary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="font-size: 14px;">open_in_new</span> Apri
                                </a>
                                <button class="primary-btn small secondary" onclick="document.getElementById('files-share-modal').remove()">Chiudi</button>
                            </div>
                        </div>
                    </div>
                `);
                document.getElementById('share-modal-copy').onclick = () => {
                    navigator.clipboard.writeText(result.url).then(() => {
                        const b = document.getElementById('share-modal-copy');
                        if (b) {
                            b.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">check</span> Copiato';
                            setTimeout(() => { b.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">content_copy</span> Copia link'; }, 1500);
                        }
                    });
                };
            }
        } catch (err) {
            console.error('[files_tab] share folder failed', err);
            alert(`Errore generazione link: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    };
}

function renderShell() {
    return `
        <div style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem;">
            <!-- Drop zone -->
            <div id="files-drop-zone" style="
                border: 2px dashed rgba(78, 146, 216, 0.3);
                border-radius: 14px;
                padding: 2rem 1rem;
                text-align: center;
                background: #fafbfc;
                cursor: pointer;
                transition: all 0.2s;
            ">
                <span class="material-icons-round" style="font-size: 2.5rem; color: #4e92d8; opacity: 0.5;">cloud_upload</span>
                <div style="font-weight: 600; color: #1a1f36; margin-top: 0.5rem; font-size: 0.95rem;">Trascina qui i file o clicca</div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">Caricamento su Dropbox · max 5MB (per ora)</div>
                <input type="file" id="files-input" multiple style="display:none;">
            </div>

            <!-- Upload progress -->
            <div id="files-upload-status" class="hidden" style="background: #f1f5f9; border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.85rem;">
                <span id="files-upload-status-text">Upload in corso...</span>
            </div>

            <!-- Lista file Dropbox -->
            <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; gap: 0.5rem;">
                    <h4 style="font-size: 0.7rem; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">📎 File caricati</h4>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span id="files-list-count" style="font-size: 0.7rem; color: #94a3b8;"></span>
                        <button id="files-share-folder-btn" class="primary-btn small" title="Genera shared link della cartella Dropbox di questo livello" style="padding: 0.3rem 0.75rem; font-size: 0.7rem; background: #f1f5f9; color: #1a1f36; border: 1px solid #e2e8f0;">
                            <span class="material-icons-round" style="font-size: 14px;">ios_share</span> Cartella Dropbox
                        </button>
                    </div>
                </div>
                <div id="files-list" style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="font-size: 0.8rem; color: #94a3b8; text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px;">Caricamento...</div>
                </div>
            </div>

            <!-- Link esterni -->
            <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
                    <h4 style="font-size: 0.7rem; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">🔗 Link esterni</h4>
                    <button id="files-add-link-btn" class="primary-btn small" style="padding: 0.3rem 0.75rem; font-size: 0.75rem; background: #f1f5f9; color: #1a1f36; border: 1px solid #e2e8f0;">
                        <span class="material-icons-round" style="font-size: 14px;">add</span> Aggiungi
                    </button>
                </div>
                <div id="files-links-list" style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="font-size: 0.8rem; color: #94a3b8; text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px;">Caricamento...</div>
                </div>
            </div>
        </div>
    `;
}

async function refresh(drawer, itemId, spaceId) {
    await Promise.all([
        refreshFiles(drawer, itemId, spaceId),
        refreshLinks(drawer, itemId, spaceId),
    ]);
}

async function refreshFiles(drawer, itemId, spaceId) {
    const listEl = drawer.querySelector('#files-list');
    const countEl = drawer.querySelector('#files-list-count');
    if (!listEl) return;

    let data, error;
    let itemMap = {}; // itemId → title per label di contesto

    if (itemId) {
        // Vista item specifico: solo i suoi file
        ({ data, error } = await supabase.from('pm_files').select('*')
            .eq('pm_item_ref', itemId)
            .order('uploaded_at', { ascending: false }));
    } else if (spaceId) {
        // Vista commessa aggregata: file dello space + file di TUTTE le sue task/attività
        const { data: items } = await supabase.from('pm_items').select('id, title')
            .eq('space_ref', spaceId).is('archived_at', null);
        const itemIds = (items || []).map(i => i.id);
        items?.forEach(i => { itemMap[i.id] = i.title; });

        if (itemIds.length > 0) {
            ({ data, error } = await supabase.from('pm_files').select('*')
                .or('pm_space_ref.eq.' + spaceId + ',pm_item_ref.in.(' + itemIds.join(',') + ')')
                .order('uploaded_at', { ascending: false }));
        } else {
            ({ data, error } = await supabase.from('pm_files').select('*')
                .eq('pm_space_ref', spaceId).is('pm_item_ref', null)
                .order('uploaded_at', { ascending: false }));
        }
    } else {
        listEl.innerHTML = '';
        return;
    }

    if (error) {
        listEl.innerHTML = `<div style="color: #ef4444; font-size: 0.8rem; padding: 0.5rem;">Errore caricamento: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        listEl.innerHTML = '<div style="font-size: 0.78rem; color: #94a3b8; text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #e2e8f0;">Nessun file caricato</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    listEl.innerHTML = data.map(f => renderFileRow(f, itemMap[f.pm_item_ref])).join('');
    if (countEl) countEl.textContent = data.length + ' file';

    // Wire bottoni
    listEl.querySelectorAll('[data-action="preview"]').forEach(b => {
        b.onclick = (e) => {
            e.stopPropagation();
            openFile(b.dataset.id, b.dataset.name, b.dataset.mime);
        };
    });
    listEl.querySelectorAll('[data-action="download"]').forEach(b => {
        b.onclick = (e) => { e.stopPropagation(); downloadFile(b.dataset.id); };
    });
    listEl.querySelectorAll('[data-action="delete"]').forEach(b => {
        b.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm('Cancellare definitivamente?')) return;
            await deleteFile(b.dataset.id);
            refreshFiles(drawer, itemId, spaceId);
        };
    });
    listEl.querySelectorAll('[data-action="toggle-share"]').forEach(b => {
        b.onchange = async () => {
            await supabase.from('pm_files')
                .update({ share_with_children: b.checked })
                .eq('id', b.dataset.id);
        };
    });
}

async function refreshLinks(drawer, itemId, spaceId) {
    const listEl = drawer.querySelector('#files-links-list');
    if (!listEl) return;

    let q = supabase.from('pm_external_links').select('*');
    if (itemId) q = q.eq('pm_item_ref', itemId);
    else if (spaceId) q = q.eq('pm_space_ref', spaceId).is('pm_item_ref', null);
    const { data, error } = await q.order('created_at', { ascending: false });

    if (error) {
        listEl.innerHTML = `<div style="color: #ef4444; font-size: 0.8rem;">Errore: ${error.message}</div>`;
        return;
    }
    if (!data || data.length === 0) {
        listEl.innerHTML = '<div style="font-size: 0.78rem; color: #94a3b8; text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #e2e8f0;">Nessun link esterno</div>';
        return;
    }

    listEl.innerHTML = data.map(l => renderLinkRow(l)).join('');

    listEl.querySelectorAll('[data-action="delete-link"]').forEach(b => {
        b.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm('Rimuovere il link?')) return;
            await supabase.from('pm_external_links').delete().eq('id', b.dataset.id);
            refreshLinks(drawer, itemId, spaceId);
        };
    });
    listEl.querySelectorAll('[data-action="toggle-share-link"]').forEach(b => {
        b.onchange = async () => {
            await supabase.from('pm_external_links')
                .update({ share_with_children: b.checked })
                .eq('id', b.dataset.id);
        };
    });
}

function renderFileRow(f, itemTitle) {
    const size = (f.file_size_bytes || 0) / (1024 * 1024);
    const sizeStr = size < 1 ? Math.round(size * 1024) + ' KB' : size.toFixed(1) + ' MB';
    const date = f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
    const icon = fileIcon(f.mime_type, f.file_name);
    const previewable = isPreviewable(f.mime_type, f.file_name);
    const clickAction = previewable ? 'preview' : 'download';
    const contextLabel = itemTitle
        ? `<span style="display: inline-flex; align-items: center; gap: 3px; background: #f0f4ff; color: #4e92d8; font-size: 0.62rem; font-weight: 600; padding: 1px 6px; border-radius: 4px; border: 1px solid #dbeafe; margin-top: 2px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttr(itemTitle)}">📌 ${escapeHtml(itemTitle)}</span>`
        : '';
    return `
        <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.75rem; background: white; border: 1px solid #f1f5f9; border-radius: 10px;">
            <div data-action="${clickAction}" data-id="${f.id}" data-name="${escapeHtml(f.file_name)}" data-mime="${escapeAttr(f.mime_type || '')}" style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 0; cursor: pointer;" title="${previewable ? 'Apri anteprima' : 'Scarica'}">
                <span class="material-icons-round" style="color: #4e92d8; font-size: 1.3rem; flex-shrink: 0;">${icon}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; font-weight: 600; color: #1a1f36; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(f.file_name)}</div>
                    <div style="font-size: 0.68rem; color: #94a3b8; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">${sizeStr} · ${date}${previewable ? ' · click per anteprima' : ''}${contextLabel}</div>
                </div>
            </div>
            <label title="Condividi anche con i collab di task figlie" style="display: flex; align-items: center; gap: 4px; font-size: 0.65rem; color: #64748b; cursor: pointer;">
                <input type="checkbox" data-action="toggle-share" data-id="${f.id}" ${f.share_with_children ? 'checked' : ''} style="cursor: pointer;">
                <span>Sotto</span>
            </label>
            <button data-action="download" data-id="${f.id}" class="icon-btn small" style="background: none; border: 1px solid #e2e8f0; padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer;" title="Scarica diretto">
                <span class="material-icons-round" style="font-size: 1rem; color: #4e92d8;">download</span>
            </button>
            <button data-action="delete" data-id="${f.id}" class="icon-btn small" style="background: none; border: 1px solid #fee2e2; padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer;" title="Elimina">
                <span class="material-icons-round" style="font-size: 1rem; color: #ef4444;">delete_outline</span>
            </button>
        </div>
    `;
}

function isPreviewable(mime, name) {
    const m = (mime || '').toLowerCase();
    if (m.startsWith('image/')) return true;
    if (m.startsWith('video/')) return true;
    if (m.startsWith('audio/')) return true;
    if (m === 'application/pdf') return true;
    if (name && name.toLowerCase().endsWith('.pdf')) return true;
    return false;
}

function renderLinkRow(l) {
    const date = l.created_at ? new Date(l.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
    const providerLabel = providerDisplay(l.provider);
    return `
        <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.75rem; background: white; border: 1px solid #f1f5f9; border-radius: 10px;">
            <span style="font-size: 1.3rem;">${providerEmoji(l.provider)}</span>
            <div style="flex: 1; min-width: 0;">
                <a href="${escapeAttr(l.url)}" target="_blank" rel="noopener" style="font-size: 0.85rem; font-weight: 600; color: #1a1f36; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(l.label || l.url)}</a>
                <div style="font-size: 0.68rem; color: #94a3b8;">${providerLabel} · ${date}</div>
            </div>
            <label title="Condividi anche con i collab di task figlie" style="display: flex; align-items: center; gap: 4px; font-size: 0.65rem; color: #64748b; cursor: pointer;">
                <input type="checkbox" data-action="toggle-share-link" data-id="${l.id}" ${l.share_with_children ? 'checked' : ''} style="cursor: pointer;">
                <span>Sotto</span>
            </label>
            <button data-action="delete-link" data-id="${l.id}" class="icon-btn small" style="background: none; border: 1px solid #fee2e2; padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer;" title="Rimuovi link">
                <span class="material-icons-round" style="font-size: 1rem; color: #ef4444;">delete_outline</span>
            </button>
        </div>
    `;
}

function wireUpload(drawer, itemId, spaceId) {
    const dropZone = drawer.querySelector('#files-drop-zone');
    const input = drawer.querySelector('#files-input');
    if (!dropZone || !input) return;

    dropZone.onclick = () => input.click();

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.background = '#eef4fb';
        dropZone.style.borderColor = '#4e92d8';
    };
    dropZone.ondragleave = () => {
        dropZone.style.background = '#fafbfc';
        dropZone.style.borderColor = 'rgba(78, 146, 216, 0.3)';
    };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.background = '#fafbfc';
        dropZone.style.borderColor = 'rgba(78, 146, 216, 0.3)';
        handleFiles(e.dataTransfer.files, drawer, itemId, spaceId);
    };
    input.onchange = () => {
        handleFiles(input.files, drawer, itemId, spaceId);
        input.value = ''; // reset
    };
}

async function handleFiles(fileList, drawer, itemId, spaceId) {
    if (!fileList || fileList.length === 0) return;
    const statusEl = drawer.querySelector('#files-upload-status');
    const statusText = drawer.querySelector('#files-upload-status-text');
    if (statusEl) statusEl.classList.remove('hidden');

    const files = Array.from(fileList).filter(f => {
        if (f.size > MAX_FILE_BYTES) {
            alert(`"${f.name}" supera il limite di 5GB.`);
            return false;
        }
        return true;
    });

    let completed = 0;
    const total = files.length;
    const errors = [];
    const updateStatus = () => {
        if (statusText) statusText.textContent = total === 1
            ? `Caricamento ${files[0].name}...`
            : `Caricamento: ${completed}/${total} completati...`;
    };
    updateStatus();

    // Worker pool: max 4 paralleli per file piccoli, max 2 se ci sono file grandi (chunked)
    const hasLarge = files.some(f => f.size > SINGLE_UPLOAD_LIMIT);
    const concurrency = hasLarge ? 2 : 4;
    const queue = [...files];
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, async () => {
        while (queue.length > 0) {
            const file = queue.shift();
            if (!file) break;
            try {
                if (file.size <= SINGLE_UPLOAD_LIMIT) {
                    await uploadSingle(file, itemId, spaceId);
                } else {
                    await uploadChunked(file, itemId, spaceId, () => {});
                }
            } catch (err) {
                console.error('[files_tab] upload failed', err);
                errors.push(`"${file.name}": ${err.message}`);
            }
            completed++;
            updateStatus();
        }
    }));

    if (statusEl) statusEl.classList.add('hidden');
    if (errors.length) alert('Errori upload:\n' + errors.join('\n'));
    refreshFiles(drawer, itemId, spaceId);
}

// ===== Tab File a livello cliente =====
export function initClientFilesTab(container, clientId) {
    container.innerHTML = renderShell();
    // Rimuovi la sezione link esterni (non supportata a livello cliente per ora)
    const linksSection = container.querySelector('#files-links-list')?.closest('div:has(h4)');
    if (linksSection) linksSection.style.display = 'none';
    const addLinkBtn = container.querySelector('#files-add-link-btn');
    if (addLinkBtn) addLinkBtn.closest('div')?.style && (addLinkBtn.closest('div[style]').style.display = 'none');

    wireClientUpload(container, clientId);
    wireClientShareFolder(container, clientId);
    refreshClientFiles(container, clientId);
}

function wireClientUpload(container, clientId) {
    const dropZone = container.querySelector('#files-drop-zone');
    const input = container.querySelector('#files-input');
    if (!dropZone || !input) return;

    dropZone.onclick = () => input.click();
    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.background = '#eef4fb';
        dropZone.style.borderColor = '#4e92d8';
    };
    dropZone.ondragleave = () => {
        dropZone.style.background = '#fafbfc';
        dropZone.style.borderColor = 'rgba(78, 146, 216, 0.3)';
    };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.background = '#fafbfc';
        dropZone.style.borderColor = 'rgba(78, 146, 216, 0.3)';
        handleClientFiles(e.dataTransfer.files, container, clientId);
    };
    input.onchange = () => {
        handleClientFiles(input.files, container, clientId);
        input.value = '';
    };
}

function wireClientShareFolder(container, clientId) {
    const btn = container.querySelector('#files-share-folder-btn');
    if (!btn) return;
    btn.onclick = async () => {
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">sync</span> Generando...';
        try {
            const result = await callDropboxProxy({ action: 'share-folder', client_ref: clientId });
            if (result?.url) {
                document.getElementById('files-share-modal')?.remove();
                document.body.insertAdjacentHTML('beforeend', `
                    <div id="files-share-modal" class="modal active" style="z-index: 11500;">
                        <div class="modal-content glass-card" style="max-width: 560px; padding: 1.5rem;">
                            <h3 style="margin: 0 0 0.5rem; font-size: 1.1rem;">📤 Link cartella Dropbox cliente</h3>
                            <div style="background: #f1f5f9; border-radius: 8px; padding: 0.7rem; font-family: monospace; font-size: 0.78rem; word-break: break-all; margin-bottom: 0.75rem;">${escapeHtml(result.url)}</div>
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-bottom: 1rem;">📁 ${escapeHtml(result.folder)}</div>
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                                <button id="share-modal-copy" class="primary-btn small"><span class="material-icons-round" style="font-size: 14px;">content_copy</span> Copia link</button>
                                <a href="${escapeAttr(result.url)}" target="_blank" class="primary-btn small secondary" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;"><span class="material-icons-round" style="font-size: 14px;">open_in_new</span> Apri</a>
                                <button class="primary-btn small secondary" onclick="document.getElementById('files-share-modal').remove()">Chiudi</button>
                            </div>
                        </div>
                    </div>
                `);
                document.getElementById('share-modal-copy').onclick = () => {
                    navigator.clipboard.writeText(result.url).then(() => {
                        const b = document.getElementById('share-modal-copy');
                        if (b) { b.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">check</span> Copiato'; setTimeout(() => { b.innerHTML = '<span class="material-icons-round" style="font-size: 14px;">content_copy</span> Copia link'; }, 1500); }
                    });
                };
            }
        } catch (err) {
            alert(`Errore generazione link: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    };
}

async function handleClientFiles(fileList, container, clientId) {
    if (!fileList || fileList.length === 0) return;
    const statusEl = container.querySelector('#files-upload-status');
    const statusText = container.querySelector('#files-upload-status-text');
    if (statusEl) statusEl.classList.remove('hidden');

    const files = Array.from(fileList).filter(f => {
        if (f.size > MAX_FILE_BYTES) {
            alert(`"${f.name}" supera il limite di 5GB.`);
            return false;
        }
        return true;
    });

    let completed = 0;
    const total = files.length;
    const errors = [];
    const updateStatus = () => {
        if (statusText) statusText.textContent = total === 1
            ? `Caricamento ${files[0].name}...`
            : `Caricamento: ${completed}/${total} completati...`;
    };
    updateStatus();

    const hasLargeClient = files.some(f => f.size > SINGLE_UPLOAD_LIMIT);
    const concurrencyClient = hasLargeClient ? 2 : 4;
    const queue = [...files];
    await Promise.all(Array.from({ length: Math.min(concurrencyClient, total) }, async () => {
        while (queue.length > 0) {
            const file = queue.shift();
            if (!file) break;
            try {
                if (file.size <= SINGLE_UPLOAD_LIMIT) {
                    const base64 = await fileToBase64(file);
                    await callDropboxProxy({
                        action: 'upload',
                        file_base64: base64,
                        file_name: file.name,
                        mime_type: file.type || 'application/octet-stream',
                        client_ref: clientId,
                        file_size_bytes: file.size,
                        share_with_children: false,
                    });
                } else {
                    await uploadChunkedClient(file, clientId, () => {});
                }
            } catch (err) {
                errors.push(`"${file.name}": ${err.message}`);
            }
            completed++;
            updateStatus();
        }
    }));

    if (statusEl) statusEl.classList.add('hidden');
    if (errors.length) alert('Errori upload:\n' + errors.join('\n'));
    refreshClientFiles(container, clientId);
}

async function uploadChunkedClient(file, clientId, onProgress) {
    const totalSize = file.size;
    let offset = 0;
    let sessionId = null;
    while (offset < totalSize) {
        const end = Math.min(offset + CHUNK_SIZE, totalSize);
        const isLast = end === totalSize;
        const chunk = file.slice(offset, end);
        const base64 = await blobToBase64(chunk);
        if (sessionId === null) {
            const r = await callDropboxProxy({ action: 'upload_session_start', file_base64: base64 });
            sessionId = r.session_id;
            if (!sessionId) throw new Error('session_id non ricevuto');
        } else if (isLast) {
            await callDropboxProxy({
                action: 'upload_session_finish',
                file_base64: base64,
                session_id: sessionId,
                offset,
                file_name: file.name,
                mime_type: file.type || 'application/octet-stream',
                client_ref: clientId,
                file_size_bytes: file.size,
                share_with_children: false,
            });
        } else {
            await callDropboxProxy({ action: 'upload_session_append', file_base64: base64, session_id: sessionId, offset });
        }
        offset = end;
        if (onProgress) onProgress(offset / totalSize);
    }
}

async function refreshClientFiles(container, clientId) {
    const listEl = container.querySelector('#files-list');
    const countEl = container.querySelector('#files-list-count');
    if (!listEl) return;

    const { data, error } = await supabase.from('pm_files')
        .select('*')
        .eq('client_ref', clientId)
        .is('pm_item_ref', null)
        .is('pm_space_ref', null)
        .order('uploaded_at', { ascending: false });

    if (error) {
        listEl.innerHTML = `<div style="color:#ef4444;font-size:0.8rem;padding:0.5rem;">Errore: ${error.message}</div>`;
        return;
    }
    if (!data || data.length === 0) {
        listEl.innerHTML = '<div style="font-size:0.78rem;color:#94a3b8;text-align:center;padding:1rem;background:#f8fafc;border-radius:8px;border:1px dashed #e2e8f0;">Nessun file caricato</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    listEl.innerHTML = data.map(f => renderFileRow(f)).join('');
    if (countEl) countEl.textContent = data.length + ' file';

    listEl.querySelectorAll('[data-action="preview"]').forEach(b => {
        b.onclick = (e) => { e.stopPropagation(); openFile(b.dataset.id, b.dataset.name, b.dataset.mime); };
    });
    listEl.querySelectorAll('[data-action="download"]').forEach(b => {
        b.onclick = (e) => { e.stopPropagation(); downloadFile(b.dataset.id); };
    });
    listEl.querySelectorAll('[data-action="delete"]').forEach(b => {
        b.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm('Cancellare definitivamente?')) return;
            await deleteFile(b.dataset.id);
            refreshClientFiles(container, clientId);
        };
    });
}

function wireAddLink(drawer, itemId, spaceId) {
    const btn = drawer.querySelector('#files-add-link-btn');
    if (!btn) return;
    btn.onclick = () => openAddLinkModal(drawer, itemId, spaceId);
}

function openAddLinkModal(drawer, itemId, spaceId) {
    document.getElementById('files-link-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
        <div id="files-link-modal" class="modal active" style="z-index: 11000;">
            <div class="modal-content glass-card" style="max-width: 500px; padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem; font-size: 1.1rem;">Aggiungi link esterno</h3>
                <label style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Tipo</label>
                <select id="link-provider" class="modal-input" style="width: 100%; margin: 0.3rem 0 0.85rem; padding: 0.6rem; border-radius: 8px;">
                    <option value="canva">🎨 Canva</option>
                    <option value="gdrive_doc">📄 Google Doc</option>
                    <option value="gdrive_sheet">📊 Google Sheet</option>
                    <option value="gdrive_slide">🖼️ Google Slide</option>
                    <option value="gdrive_folder">📁 Google Drive folder</option>
                    <option value="onedrive">☁️ OneDrive</option>
                    <option value="sharepoint">🏢 SharePoint</option>
                    <option value="website">🌐 Sito web</option>
                    <option value="other">🔗 Altro link</option>
                </select>
                <label style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">URL</label>
                <input id="link-url" type="url" placeholder="https://..." class="modal-input" style="width: 100%; margin: 0.3rem 0 0.85rem; padding: 0.6rem; border-radius: 8px;">
                <label style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Etichetta (opzionale)</label>
                <input id="link-label" type="text" placeholder="es. Brief cliente master" class="modal-input" style="width: 100%; margin: 0.3rem 0 0.85rem; padding: 0.6rem; border-radius: 8px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #64748b; margin-bottom: 1rem;">
                    <input id="link-share" type="checkbox">
                    <span>Condividi anche con i collab delle task figlie</span>
                </label>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="primary-btn secondary" onclick="document.getElementById('files-link-modal').remove()">Annulla</button>
                    <button id="link-save-btn" class="primary-btn">Salva</button>
                </div>
            </div>
        </div>
    `);
    document.getElementById('link-save-btn').onclick = async () => {
        const provider = document.getElementById('link-provider').value;
        const url = document.getElementById('link-url').value.trim();
        const label = document.getElementById('link-label').value.trim();
        const share = document.getElementById('link-share').checked;
        if (!url) { alert('URL obbligatorio'); return; }
        const { error } = await supabase.from('pm_external_links').insert({
            pm_space_ref: itemId ? null : spaceId,
            pm_item_ref: itemId || null,
            provider,
            url,
            label: label || null,
            share_with_children: share,
        });
        if (error) { alert('Errore: ' + error.message); return; }
        document.getElementById('files-link-modal').remove();
        refreshLinks(drawer, itemId, spaceId);
    };
}

// ===== Upload singolo (file <= SINGLE_UPLOAD_LIMIT) =====
async function uploadSingle(file, itemId, spaceId) {
    const base64 = await fileToBase64(file);
    const result = await callDropboxProxy({
        action: 'upload',
        file_base64: base64,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        pm_space_ref: itemId ? null : spaceId,
        pm_item_ref: itemId || null,
        file_size_bytes: file.size,
        share_with_children: false,
    });
    return result;
}

// ===== Upload chunked (file > SINGLE_UPLOAD_LIMIT) =====
async function uploadChunked(file, itemId, spaceId, onProgress) {
    const totalSize = file.size;
    let offset = 0;
    let sessionId = null;

    while (offset < totalSize) {
        const end = Math.min(offset + CHUNK_SIZE, totalSize);
        const isLast = end === totalSize;
        const chunk = file.slice(offset, end);
        const base64 = await blobToBase64(chunk);

        if (sessionId === null) {
            // Primo chunk: start session
            const r = await callDropboxProxy({ action: 'upload_session_start', file_base64: base64 });
            sessionId = r.session_id;
            if (!sessionId) throw new Error('session_id non ricevuto');
        } else if (isLast) {
            // Ultimo chunk: finish session + commit
            await callDropboxProxy({
                action: 'upload_session_finish',
                file_base64: base64,
                session_id: sessionId,
                offset,
                file_name: file.name,
                mime_type: file.type || 'application/octet-stream',
                pm_space_ref: itemId ? null : spaceId,
                pm_item_ref: itemId || null,
                file_size_bytes: file.size,
                share_with_children: false,
            });
        } else {
            // Chunk intermedio
            await callDropboxProxy({
                action: 'upload_session_append',
                file_base64: base64,
                session_id: sessionId,
                offset,
            });
        }

        offset = end;
        if (onProgress) onProgress(offset / totalSize);
    }
}

// Helper: chiamata edge function dropbox-proxy con error handling esplicito
async function callDropboxProxy(payload) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const resp = await fetch(
        supabase.supabaseUrl.replace(/\/$/, '') + '/functions/v1/dropbox-proxy',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'apikey': supabase.supabaseKey,
            },
            body: JSON.stringify(payload),
        }
    );
    const respText = await resp.text();
    let respJson = null;
    try { respJson = JSON.parse(respText); } catch { /* */ }
    if (!resp.ok) {
        console.error('[files_tab] DEBUG response JSON:', respJson);
        const parts = [];
        if (respJson?.error) parts.push(respJson.error);
        if (respJson?.missing) parts.push('missing: ' + JSON.stringify(respJson.missing));
        if (respJson?.detail) parts.push(respJson.detail);
        const msg = parts.join(' | ') || respText.slice(0, 300);
        throw new Error(`HTTP ${resp.status}: ${msg}`);
    }
    if (respJson?.error) {
        throw new Error(respJson.error + (respJson.detail ? ' — ' + respJson.detail : ''));
    }
    return respJson;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = String(reader.result).split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function openFile(fileId, fileName, mimeType) {
    // Chiama edge function per ottenere signed URL temporanea
    let data;
    try {
        data = await callDropboxProxy({ action: 'download', file_id: fileId });
    } catch (err) {
        alert(`Errore apertura: ${err.message}`);
        return;
    }
    if (!data?.url) {
        alert('URL non disponibile');
        return;
    }
    // Decide se aprire in modal preview o scaricare diretto
    const mime = (mimeType || data.mime_type || '').toLowerCase();
    if (mime.startsWith('image/')) {
        openPreviewModal(data.url, fileName, 'image');
    } else if (mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        openPreviewModal(data.url, fileName, 'pdf');
    } else if (mime.startsWith('video/')) {
        openPreviewModal(data.url, fileName, 'video');
    } else if (mime.startsWith('audio/')) {
        openPreviewModal(data.url, fileName, 'audio');
    } else {
        // Tipi non previewable: apri in nuova tab (Dropbox di solito scarica)
        window.open(data.url, '_blank');
    }
}

async function downloadFile(fileId) {
    let data;
    try {
        data = await callDropboxProxy({ action: 'download', file_id: fileId });
    } catch (err) {
        alert(`Errore download: ${err.message}`);
        return;
    }
    if (data?.url) window.open(data.url, '_blank');
}

function openPreviewModal(url, fileName, kind) {
    document.getElementById('files-preview-modal')?.remove();
    let mediaHtml = '';
    if (kind === 'image') {
        mediaHtml = `<img src="${escapeAttr(url)}" alt="${escapeAttr(fileName)}" style="max-width: 100%; max-height: 80vh; display: block; margin: 0 auto; border-radius: 8px;">`;
    } else if (kind === 'pdf') {
        mediaHtml = `<iframe src="${escapeAttr(url)}" style="width: 100%; height: 80vh; border: none; background: white;"></iframe>`;
    } else if (kind === 'video') {
        mediaHtml = `<video src="${escapeAttr(url)}" controls autoplay style="max-width: 100%; max-height: 80vh; display: block; margin: 0 auto; border-radius: 8px; background: black;"></video>`;
    } else if (kind === 'audio') {
        mediaHtml = `<div style="padding: 3rem 1rem; text-align: center;"><audio src="${escapeAttr(url)}" controls autoplay style="width: 100%; max-width: 500px;"></audio></div>`;
    }
    document.body.insertAdjacentHTML('beforeend', `
        <div id="files-preview-modal" class="modal active" style="z-index: 12000;">
            <div style="background: rgba(0,0,0,0.85); position: fixed; inset: 0; display: flex; flex-direction: column; padding: 2rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; color: white;">
                    <div style="font-size: 0.9rem; font-weight: 600; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(fileName)}</div>
                    <div style="display: flex; gap: 0.5rem;">
                        <a href="${escapeAttr(url)}" target="_blank" style="background: rgba(255,255,255,0.15); color: white; padding: 0.4rem 0.8rem; border-radius: 8px; text-decoration: none; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 16px;">open_in_new</span> Apri esterno
                        </a>
                        <a href="${escapeAttr(url)}" download="${escapeAttr(fileName)}" style="background: rgba(255,255,255,0.15); color: white; padding: 0.4rem 0.8rem; border-radius: 8px; text-decoration: none; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                            <span class="material-icons-round" style="font-size: 16px;">download</span> Scarica
                        </a>
                        <button onclick="document.getElementById('files-preview-modal').remove()" style="background: rgba(255,255,255,0.15); color: white; border: none; padding: 0.4rem 0.6rem; border-radius: 8px; cursor: pointer; font-size: 0.78rem; display: inline-flex; align-items: center;">
                            <span class="material-icons-round" style="font-size: 18px;">close</span>
                        </button>
                    </div>
                </div>
                <div style="flex: 1; overflow: auto; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 1rem;">
                    ${mediaHtml}
                </div>
            </div>
        </div>
    `);
    // ESC per chiudere
    const onKey = (e) => {
        if (e.key === 'Escape') {
            document.getElementById('files-preview-modal')?.remove();
            document.removeEventListener('keydown', onKey);
        }
    };
    document.addEventListener('keydown', onKey);
}

async function deleteFile(fileId) {
    const { data, error } = await supabase.functions.invoke('dropbox-proxy', {
        body: { action: 'delete', file_id: fileId },
    });
    if (error || data?.error) {
        alert(`Errore eliminazione: ${error?.message || data?.error}`);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            // FileReader returns "data:mime;base64,XXXX". Strip prefix.
            const base64 = String(result).split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function fileIcon(mime, name) {
    const m = (mime || '').toLowerCase();
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('video/')) return 'movie';
    if (m.startsWith('audio/')) return 'audiotrack';
    if (m.includes('pdf')) return 'picture_as_pdf';
    if (m.includes('zip') || m.includes('compressed')) return 'folder_zip';
    if (m.includes('word') || m.includes('document')) return 'description';
    if (m.includes('sheet') || m.includes('excel')) return 'table_chart';
    if (m.includes('presentation') || m.includes('powerpoint')) return 'slideshow';
    return 'insert_drive_file';
}

function providerEmoji(p) {
    const map = {
        canva: '🎨',
        gdrive_doc: '📄',
        gdrive_sheet: '📊',
        gdrive_slide: '🖼️',
        gdrive_folder: '📁',
        onedrive: '☁️',
        sharepoint: '🏢',
        website: '🌐',
        other: '🔗',
    };
    return map[p] || '🔗';
}

function providerDisplay(p) {
    const map = {
        canva: 'Canva',
        gdrive_doc: 'Google Doc',
        gdrive_sheet: 'Google Sheet',
        gdrive_slide: 'Google Slide',
        gdrive_folder: 'Google Drive',
        onedrive: 'OneDrive',
        sharepoint: 'SharePoint',
        website: 'Sito web',
        other: 'Link',
    };
    return map[p] || p;
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}
function escapeAttr(s) {
    return String(s || '').replace(/"/g, '&quot;');
}
