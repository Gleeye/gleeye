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
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">Caricamento su Dropbox · fino a 5GB per file</div>
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
    let itemMap = {}; // itemId → title
    const isSpaceView = !itemId && !!spaceId;

    if (itemId) {
        ({ data, error } = await supabase.from('pm_files').select('*')
            .eq('pm_item_ref', itemId)
            .order('uploaded_at', { ascending: false }));
    } else if (spaceId) {
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

    // Vista commessa: navigatore a cartelle (click per entrare, freccia per tornare)
    if (isSpaceView) {
        initSpaceNavigator(listEl, countEl, data, itemMap, drawer, spaceId);
        return; // il navigator gestisce i bottoni internamente
    }

    listEl.innerHTML = data.map(f => renderFileRow(f)).join('');
    if (countEl) countEl.textContent = data.length + ' file';

    // Wire bottoni (vista item singolo / non-space)
    wireFileActionButtons(listEl, drawer, itemId, spaceId);
}

function initSpaceNavigator(listEl, countEl, allData, itemMap, drawer, spaceId) {
    // Costruisci gruppi: key = pm_item_ref || '__space__'
    const groups = {};
    allData.forEach(f => {
        const key = f.pm_item_ref || '__space__';
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    });

    let currentFolderKey = null; // null = root

    function renderRoot() {
        const keys = Object.keys(groups);
        if (countEl) countEl.textContent = allData.length + ' file';

        listEl.innerHTML = keys.map(key => {
            const isSpace = key === '__space__';
            const title = isSpace ? 'Commessa' : (itemMap[key] || 'Attività');
            const icon = isSpace ? 'folder_special' : 'folder';
            const color = isSpace ? '#f59e0b' : '#4e92d8';
            const count = groups[key].length;
            const sub = count === 1 ? '1 file' : count + ' file';
            return `
                <div data-nav-key="${escapeAttr(key)}" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:white;border:1px solid #e8edf3;border-radius:10px;cursor:pointer;transition:border-color 0.15s;" onmouseover="this.style.borderColor='#4e92d8'" onmouseout="this.style.borderColor='#e8edf3'">
                    <span class="material-icons-round" style="color:${color};font-size:1.8rem;flex-shrink:0;">${icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.9rem;font-weight:600;color:#1a1f36;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title)}</div>
                        <div style="font-size:0.72rem;color:#94a3b8;">${sub}</div>
                    </div>
                    <span class="material-icons-round" style="color:#cbd5e1;font-size:1.2rem;">chevron_right</span>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('[data-nav-key]').forEach(el => {
            el.onclick = () => { currentFolderKey = el.dataset.navKey; renderFolder(); };
        });
    }

    function renderFolder() {
        const files = groups[currentFolderKey] || [];
        const isSpace = currentFolderKey === '__space__';
        const title = isSpace ? 'Commessa' : (itemMap[currentFolderKey] || 'Attività');
        if (countEl) countEl.textContent = files.length + ' file';

        listEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.75rem;">
                <button id="files-nav-back" style="display:flex;align-items:center;gap:3px;background:none;border:none;cursor:pointer;color:#4e92d8;font-size:0.8rem;font-weight:600;padding:0.25rem 0.4rem;border-radius:6px;transition:background 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='none'">
                    <span class="material-icons-round" style="font-size:1rem;">arrow_back_ios</span> Tutti i file
                </button>
                <span class="material-icons-round" style="font-size:0.85rem;color:#cbd5e1;">chevron_right</span>
                <span class="material-icons-round" style="font-size:1rem;color:${isSpace ? '#f59e0b' : '#4e92d8'};">${isSpace ? 'folder_special' : 'folder'}</span>
                <span style="font-size:0.82rem;font-weight:700;color:#1a1f36;">${escapeHtml(title)}</span>
            </div>
            <div id="files-folder-items" style="display:flex;flex-direction:column;gap:5px;">
                ${files.length === 0
                    ? '<div style="font-size:0.78rem;color:#94a3b8;text-align:center;padding:1.25rem;background:#f8fafc;border-radius:8px;border:1px dashed #e2e8f0;">Nessun file in questa cartella</div>'
                    : files.map(f => renderFileRow(f)).join('')}
            </div>
        `;

        listEl.querySelector('#files-nav-back').onclick = () => { currentFolderKey = null; renderRoot(); };

        const folderItems = listEl.querySelector('#files-folder-items');
        if (folderItems) wireFileActionButtons(folderItems, drawer, null, spaceId, () => {
            // dopo delete: re-fetch e riapri stessa cartella
            const savedKey = currentFolderKey;
            refreshFiles(drawer, null, spaceId).then(() => {
                // refreshFiles reinizializza il navigator, tentiamo di rientrare nella cartella se esiste ancora
                // Per semplicità, dopo delete si torna alla root (refreshFiles già fa questo)
            });
        });
    }

    renderRoot();
}

function wireFileActionButtons(container, drawer, itemId, spaceId, onDelete) {
    container.querySelectorAll('[data-action="preview"]').forEach(b => {
        b.onclick = (e) => { e.stopPropagation(); openFile(b.dataset.id, b.dataset.name, b.dataset.mime); };
    });
    container.querySelectorAll('[data-action="download"]').forEach(b => {
        b.onclick = (e) => { e.stopPropagation(); downloadFile(b.dataset.id); };
    });
    container.querySelectorAll('[data-action="delete"]').forEach(b => {
        b.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm('Cancellare definitivamente?')) return;
            await deleteFile(b.dataset.id);
            if (onDelete) onDelete();
            else refreshFiles(drawer, itemId, spaceId);
        };
    });
    container.querySelectorAll('[data-action="toggle-share"]').forEach(b => {
        b.onchange = async () => {
            await supabase.from('pm_files').update({ share_with_children: b.checked }).eq('id', b.dataset.id);
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

function renderFileRow(f) {
    const size = (f.file_size_bytes || 0) / (1024 * 1024);
    const sizeStr = size < 1 ? Math.round(size * 1024) + ' KB' : size.toFixed(1) + ' MB';
    const date = f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
    const icon = fileIcon(f.mime_type, f.file_name);
    const previewable = isPreviewable(f.mime_type, f.file_name);
    const clickAction = previewable ? 'preview' : 'download';
    return `
        <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.75rem 0.55rem 2rem; background: white; border-bottom: 1px solid #f8fafc;">
            <div data-action="${clickAction}" data-id="${f.id}" data-name="${escapeHtml(f.file_name)}" data-mime="${escapeAttr(f.mime_type || '')}" style="display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 0; cursor: pointer;" title="${previewable ? 'Apri anteprima' : 'Scarica'}">
                <span class="material-icons-round" style="color: #4e92d8; font-size: 1.3rem; flex-shrink: 0;">${icon}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; font-weight: 600; color: #1a1f36; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(f.file_name)}</div>
                    <div style="font-size: 0.68rem; color: #94a3b8;">${sizeStr} · ${date}${previewable ? ' · click per anteprima' : ''}</div>
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

    listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem;">Caricamento...</div>';

    // 1. File diretti sul cliente
    const { data: clientFiles } = await supabase.from('pm_files').select('*')
        .eq('client_ref', clientId).is('pm_space_ref', null).is('pm_item_ref', null)
        .order('uploaded_at', { ascending: false });

    // 2. Ordini di questo cliente
    const { data: orders } = await supabase.from('orders').select('id, title, order_number')
        .eq('client_id', clientId);

    const orderIds = (orders || []).map(o => o.id);

    // 3. PM spaces collegati agli ordini
    let spaceMap = {}; // spaceId → label commessa
    let allSpaceIds = [];
    if (orderIds.length > 0) {
        const { data: spaces } = await supabase.from('pm_spaces').select('id, name, ref_ordine')
            .in('ref_ordine', orderIds);
        (spaces || []).forEach(s => {
            const ord = (orders || []).find(o => o.id === s.ref_ordine);
            const num = ord?.order_number ? 'Commessa ' + ord.order_number : '';
            const ttl = ord?.title || s.name || '';
            spaceMap[s.id] = num && ttl ? num + ' — ' + ttl : (num || ttl || 'Commessa');
            allSpaceIds.push(s.id);
        });
    }

    // 4. Items in quegli spaces
    let itemMap = {}; // itemId → { title, spaceId }
    let spaceFiles = [];
    if (allSpaceIds.length > 0) {
        const { data: items } = await supabase.from('pm_items').select('id, title, space_ref')
            .in('space_ref', allSpaceIds).is('archived_at', null);
        (items || []).forEach(i => { itemMap[i.id] = { title: i.title, spaceId: i.space_ref }; });

        const itemIds = Object.keys(itemMap);
        let q = supabase.from('pm_files').select('*');
        if (itemIds.length > 0) {
            q = q.or('pm_space_ref.in.(' + allSpaceIds.join(',') + '),pm_item_ref.in.(' + itemIds.join(',') + ')');
        } else {
            q = q.in('pm_space_ref', allSpaceIds);
        }
        const { data: sf } = await q.order('uploaded_at', { ascending: false });
        spaceFiles = sf || [];
    }

    initClientNavigator(listEl, countEl, clientFiles || [], spaceFiles, spaceMap, itemMap, container, clientId);
}

function initClientNavigator(listEl, countEl, directFiles, spaceFiles, spaceMap, itemMap, container, clientId) {
    // Raggruppa i file delle commesse per space
    const spaceGroups = {}; // spaceId → files[]
    spaceFiles.forEach(f => {
        let sid = f.pm_space_ref;
        if (!sid && f.pm_item_ref) sid = itemMap[f.pm_item_ref]?.spaceId;
        if (!sid) return;
        if (!spaceGroups[sid]) spaceGroups[sid] = [];
        spaceGroups[sid].push(f);
    });

    // Per ogni space: mappa item locale (itemId → title)
    const spaceItemMaps = {}; // spaceId → { itemId: title }
    Object.entries(itemMap).forEach(([itemId, info]) => {
        if (!spaceItemMaps[info.spaceId]) spaceItemMaps[info.spaceId] = {};
        spaceItemMaps[info.spaceId][itemId] = info.title;
    });

    // Stack navigazione: ogni entry ha { label, render }
    const stack = [];

    function pushLevel(label, renderFn) {
        stack.push({ label, render: renderFn });
        renderFn();
    }

    function popLevel() {
        stack.pop();
        if (stack.length > 0) stack[stack.length - 1].render();
    }

    function renderBreadcrumb(currentLabel) {
        const parts = stack.slice(0, -1).map((s, i) => `<span data-stack-idx="${i}" style="color:#4e92d8;cursor:pointer;font-weight:600;font-size:0.78rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(s.label)}</span>`);
        parts.push(`<span style="font-size:0.78rem;font-weight:700;color:#1a1f36;">${escapeHtml(currentLabel)}</span>`);
        const bc = document.createElement('div');
        bc.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:0.75rem;flex-wrap:wrap;';
        bc.innerHTML = parts.join('<span class="material-icons-round" style="font-size:0.85rem;color:#cbd5e1;">chevron_right</span>');
        bc.querySelectorAll('[data-stack-idx]').forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.stackIdx);
                stack.splice(idx + 1);
                stack[idx].render();
            };
        });
        // Back button
        if (stack.length > 1) {
            const back = document.createElement('button');
            back.style.cssText = 'display:flex;align-items:center;gap:3px;background:none;border:none;cursor:pointer;color:#4e92d8;font-size:0.8rem;font-weight:600;padding:0.25rem 0.4rem;border-radius:6px;margin-bottom:0.5rem;';
            back.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">arrow_back_ios</span>' + escapeHtml(stack[stack.length - 2].label);
            back.onmouseover = () => { back.style.background = '#eff6ff'; };
            back.onmouseout = () => { back.style.background = 'none'; };
            back.onclick = popLevel;
            return [back, bc];
        }
        return [bc];
    }

    function renderFolderRow(icon, color, title, subtitle, onClick) {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:white;border:1px solid #e8edf3;border-radius:10px;cursor:pointer;transition:border-color 0.15s;';
        el.innerHTML = `
            <span class="material-icons-round" style="color:${color};font-size:1.8rem;flex-shrink:0;">${icon}</span>
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.9rem;font-weight:600;color:#1a1f36;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title)}</div>
                <div style="font-size:0.72rem;color:#94a3b8;">${escapeHtml(subtitle)}</div>
            </div>
            <span class="material-icons-round" style="color:#cbd5e1;font-size:1.2rem;">chevron_right</span>
        `;
        el.onmouseover = () => { el.style.borderColor = '#4e92d8'; };
        el.onmouseout = () => { el.style.borderColor = '#e8edf3'; };
        el.onclick = onClick;
        return el;
    }

    function renderFileList(files, navHeader) {
        listEl.innerHTML = '';
        navHeader.forEach(el => listEl.appendChild(el));
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
        if (!files || files.length === 0) {
            wrap.innerHTML = '<div style="font-size:0.78rem;color:#94a3b8;text-align:center;padding:1.25rem;background:#f8fafc;border-radius:8px;border:1px dashed #e2e8f0;">Nessun file in questa cartella</div>';
        } else {
            wrap.innerHTML = files.map(f => renderFileRow(f)).join('');
            wireFileActionButtons(wrap, null, null, null, () => refreshClientFiles(container, clientId));
        }
        listEl.appendChild(wrap);
    }

    // ROOT: cartella cliente + cartelle commesse
    function renderRoot() {
        const total = directFiles.length + spaceFiles.length;
        if (countEl) countEl.textContent = total + ' file';
        listEl.innerHTML = '';

        const spacesWithFiles = Object.keys(spaceGroups);
        if (directFiles.length === 0 && spacesWithFiles.length === 0) {
            listEl.innerHTML = '<div style="font-size:0.78rem;color:#94a3b8;text-align:center;padding:1rem;background:#f8fafc;border-radius:8px;border:1px dashed #e2e8f0;">Nessun file caricato</div>';
            return;
        }

        const rows = [];

        // Cartella documenti diretti cliente
        if (directFiles.length > 0) {
            rows.push(renderFolderRow('folder_special', '#f59e0b', 'Documenti cliente',
                directFiles.length + ' file',
                () => pushLevel('Documenti cliente', () => {
                    const header = renderBreadcrumb('Documenti cliente');
                    if (countEl) countEl.textContent = directFiles.length + ' file';
                    renderFileList(directFiles, header);
                })
            ));
        }

        // Cartelle commesse
        spacesWithFiles.forEach(spaceId => {
            const label = spaceMap[spaceId] || 'Commessa';
            const count = spaceGroups[spaceId].length;
            rows.push(renderFolderRow('folder', '#4e92d8', label,
                count + ' file',
                () => pushLevel(label, () => renderCommessaLevel(spaceId, label))
            ));
        });

        rows.forEach(r => listEl.appendChild(r));
    }

    // LIVELLO COMMESSA: sub-cartelle per task (stesso stile di initSpaceNavigator)
    function renderCommessaLevel(spaceId, spaceLabel) {
        const files = spaceGroups[spaceId] || [];
        const localItemMap = spaceItemMaps[spaceId] || {};
        if (countEl) countEl.textContent = files.length + ' file';

        // Raggruppa per item
        const groups = {};
        files.forEach(f => {
            const key = f.pm_item_ref || '__space__';
            if (!groups[key]) groups[key] = [];
            groups[key].push(f);
        });

        const header = renderBreadcrumb(spaceLabel);
        listEl.innerHTML = '';
        header.forEach(el => listEl.appendChild(el));

        const keys = Object.keys(groups);
        if (keys.length === 0) {
            listEl.insertAdjacentHTML('beforeend', '<div style="font-size:0.78rem;color:#94a3b8;text-align:center;padding:1rem;background:#f8fafc;border-radius:8px;border:1px dashed #e2e8f0;">Nessun file</div>');
            return;
        }

        // Se c'è un solo gruppo e sono tutti file di space, mostrali flat (no sub-cartelle)
        if (keys.length === 1 && keys[0] === '__space__') {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
            wrap.innerHTML = groups['__space__'].map(f => renderFileRow(f)).join('');
            wireFileActionButtons(wrap, null, null, null, () => refreshClientFiles(container, clientId));
            listEl.appendChild(wrap);
            return;
        }

        // Altrimenti mostra cartelle per ogni task/attività
        keys.forEach(key => {
            const isSpace = key === '__space__';
            const title = isSpace ? 'File commessa' : (localItemMap[key] || 'Attività');
            const taskFiles = groups[key];
            const row = renderFolderRow(
                isSpace ? 'folder_special' : 'folder',
                isSpace ? '#f59e0b' : '#4e92d8',
                title,
                taskFiles.length + ' file',
                () => pushLevel(title, () => {
                    const hdr = renderBreadcrumb(title);
                    if (countEl) countEl.textContent = taskFiles.length + ' file';
                    renderFileList(taskFiles, hdr);
                })
            );
            listEl.appendChild(row);
        });
    }

    // Inizia dalla root
    stack.push({ label: 'File', render: renderRoot });
    renderRoot();
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
