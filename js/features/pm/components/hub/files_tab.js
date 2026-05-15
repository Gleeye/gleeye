// Tab "📂 File" nell'hub_drawer.
// Gestisce file Dropbox (Categoria B) + link esterni (Categoria C) con
// permessi gerarchici + toggle "Condividi sotto".
//
// Esporta: initFilesTab(drawer, itemId, spaceId)

import { supabase } from '/js/modules/config.js?v=8000';
import { state } from '/js/modules/state.js?v=8000';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB temporary limit

export function initFilesTab(drawer, itemId, spaceId) {
    const pane = drawer.querySelector('#tab-files');
    if (!pane) return;

    pane.innerHTML = renderShell();
    wireUpload(drawer, itemId, spaceId);
    wireAddLink(drawer, itemId, spaceId);
    refresh(drawer, itemId, spaceId);
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
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
                    <h4 style="font-size: 0.7rem; font-weight: 700; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">📎 File caricati</h4>
                    <span id="files-list-count" style="font-size: 0.7rem; color: #94a3b8;"></span>
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

    // Carica file di QUESTO item specifico (RLS filtra automaticamente per ruolo)
    let q = supabase.from('pm_files').select('*');
    if (itemId) q = q.eq('pm_item_ref', itemId);
    else if (spaceId) q = q.eq('pm_space_ref', spaceId).is('pm_item_ref', null);
    const { data, error } = await q.order('uploaded_at', { ascending: false });

    if (error) {
        listEl.innerHTML = `<div style="color: #ef4444; font-size: 0.8rem; padding: 0.5rem;">Errore caricamento: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        listEl.innerHTML = '<div style="font-size: 0.78rem; color: #94a3b8; text-align: center; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #e2e8f0;">Nessun file caricato</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    listEl.innerHTML = data.map(f => renderFileRow(f)).join('');
    if (countEl) countEl.textContent = data.length + ' file';

    // Wire bottoni
    listEl.querySelectorAll('[data-action="download"]').forEach(b => {
        b.onclick = (e) => { e.stopPropagation(); downloadFile(b.dataset.id, b.dataset.name); };
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

function renderFileRow(f) {
    const size = (f.file_size_bytes || 0) / (1024 * 1024);
    const sizeStr = size < 1 ? Math.round(size * 1024) + ' KB' : size.toFixed(1) + ' MB';
    const date = f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
    const icon = fileIcon(f.mime_type, f.file_name);
    return `
        <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.6rem 0.75rem; background: white; border: 1px solid #f1f5f9; border-radius: 10px;">
            <span class="material-icons-round" style="color: #4e92d8; font-size: 1.3rem;">${icon}</span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.85rem; font-weight: 600; color: #1a1f36; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(f.file_name)}</div>
                <div style="font-size: 0.68rem; color: #94a3b8;">${sizeStr} · ${date}</div>
            </div>
            <label title="Condividi anche con i collab di task figlie" style="display: flex; align-items: center; gap: 4px; font-size: 0.65rem; color: #64748b; cursor: pointer;">
                <input type="checkbox" data-action="toggle-share" data-id="${f.id}" ${f.share_with_children ? 'checked' : ''} style="cursor: pointer;">
                <span>Sotto</span>
            </label>
            <button data-action="download" data-id="${f.id}" data-name="${escapeHtml(f.file_name)}" class="icon-btn small" style="background: none; border: 1px solid #e2e8f0; padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer;" title="Scarica">
                <span class="material-icons-round" style="font-size: 1rem; color: #4e92d8;">download</span>
            </button>
            <button data-action="delete" data-id="${f.id}" class="icon-btn small" style="background: none; border: 1px solid #fee2e2; padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer;" title="Elimina">
                <span class="material-icons-round" style="font-size: 1rem; color: #ef4444;">delete_outline</span>
            </button>
        </div>
    `;
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

    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.size > MAX_UPLOAD_BYTES) {
            alert(`"${file.name}" supera 5MB. Limite temporaneo, verrà alzato dopo.`);
            continue;
        }
        if (statusText) statusText.textContent = `Upload ${i + 1}/${fileList.length}: ${file.name}...`;

        try {
            const base64 = await fileToBase64(file);
            const { data, error } = await supabase.functions.invoke('dropbox-proxy', {
                body: {
                    action: 'upload',
                    file_base64: base64,
                    file_name: file.name,
                    mime_type: file.type || 'application/octet-stream',
                    pm_space_ref: itemId ? null : spaceId,
                    pm_item_ref: itemId || null,
                    file_size_bytes: file.size,
                    share_with_children: false,
                },
            });
            if (error || data?.error) {
                throw new Error(error?.message || data?.error || 'upload failed');
            }
        } catch (err) {
            console.error('[files_tab] upload failed', err);
            alert(`Errore upload "${file.name}": ${err.message}`);
        }
    }

    if (statusEl) statusEl.classList.add('hidden');
    refreshFiles(drawer, itemId, spaceId);
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

async function downloadFile(fileId, fileName) {
    const { data, error } = await supabase.functions.invoke('dropbox-proxy', {
        body: { action: 'download', file_id: fileId },
    });
    if (error || data?.error) {
        alert(`Errore download: ${error?.message || data?.error}`);
        return;
    }
    if (data?.url) window.open(data.url, '_blank');
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
