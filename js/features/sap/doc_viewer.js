// SAP Doc Viewer
// Panel di review post-generazione: mostra i 7 documenti generati dall'AI,
// permette editing inline e salvataggio approvato in cloud_links.

import { supabase } from '../../modules/config.js?v=8000';
import { state } from '../../modules/state.js?v=8000';

const DOC_TYPE_META = {
    brochure:  { label: 'Brochure',          icon: 'picture_as_pdf', color: '#8b5cf6' },
    landing:   { label: 'Landing page',       icon: 'web',            color: '#3b82f6' },
    email:     { label: 'Email sales',        icon: 'email',          color: '#10b981' },
    brief:     { label: 'Brief collab',       icon: 'assignment',     color: '#f59e0b' },
    listino:   { label: 'Listino',            icon: 'price_change',   color: '#ef4444' },
    faq:       { label: 'FAQ',                icon: 'help_outline',   color: '#06b6d4' },
    clausole:  { label: 'Clausole',           icon: 'gavel',          color: '#64748b' },
};

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function openDocViewer(serviceId, cloudLinks) {
    const aiDocs = (cloudLinks || []).filter(l => l.type === 'ai_doc' && l.content);

    if (aiDocs.length === 0) {
        await window.showAlert('Nessun documento generato trovato. Riprova la generazione.', 'warning');
        return;
    }

    const existing = document.getElementById('sap-doc-viewer-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sap-doc-viewer-modal';
    modal.className = 'modal';
    modal.innerHTML = _buildViewerHTML(serviceId, aiDocs);
    document.body.appendChild(modal);
    modal.classList.add('active');
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    _activateTab(aiDocs[0].doc_type, aiDocs);
    _bindActions(serviceId, aiDocs, modal);
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function _buildViewerHTML(serviceId, docs) {
    const tabs = docs.map((d, i) => {
        const meta = DOC_TYPE_META[d.doc_type] || { label: d.doc_type, icon: 'article', color: '#64748b' };
        return `
            <button class="docview-tab" data-doc="${d.doc_type}" onclick="window._sapDocViewerActivateTab('${d.doc_type}')"
                style="display:flex; align-items:center; gap:0.4rem; padding:0.5rem 0.85rem; border-radius:8px; border:none; cursor:pointer; font-size:0.8rem; font-weight:700; background:${i === 0 ? 'white' : 'transparent'}; color:${i === 0 ? meta.color : 'var(--text-secondary)'}; white-space:nowrap; transition:all 0.2s; box-shadow:${i === 0 ? 'var(--shadow-sm)' : 'none'};">
                <span class="material-icons-round" style="font-size:0.95rem;">${meta.icon}</span>
                ${meta.label}
            </button>`;
    }).join('');

    return `
        <div class="modal-content" style="max-width:900px; width:96vw; height:92vh; padding:0; border-radius:20px; overflow:hidden; background:var(--card-bg); border:1px solid var(--glass-border); box-shadow:var(--shadow-xl); display:flex; flex-direction:column;">

            <!-- Header -->
            <div style="padding:1rem 1.5rem; background:var(--bg-secondary); border-bottom:1px solid var(--glass-border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div style="width:36px; height:36px; border-radius:10px; background:var(--brand-gradient); display:flex; align-items:center; justify-content:center; color:white;">
                        <span class="material-icons-round" style="font-size:1.1rem;">auto_awesome</span>
                    </div>
                    <div>
                        <div style="font-weight:800; font-size:1rem; color:var(--text-primary); font-family:var(--font-titles);">Documenti AI generati</div>
                        <div style="font-size:0.75rem; color:var(--text-tertiary);">${docs.length} documenti · revisiona, modifica e approva</div>
                    </div>
                </div>
                <button onclick="document.getElementById('sap-doc-viewer-modal').remove()" style="background:var(--bg-tertiary); border:none; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--text-tertiary);">
                    <span class="material-icons-round" style="font-size:1.1rem;">close</span>
                </button>
            </div>

            <!-- Tabs -->
            <div style="display:flex; gap:0.35rem; padding:0.75rem 1.5rem; background:var(--bg-tertiary); border-bottom:1px solid var(--glass-border); overflow-x:auto; flex-shrink:0; scrollbar-width:none;">
                ${tabs}
            </div>

            <!-- Content area -->
            <div id="docview-content" style="flex:1; overflow:hidden; display:flex; flex-direction:column;"></div>

            <!-- Footer -->
            <div style="padding:0.85rem 1.5rem; border-top:1px solid var(--glass-border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; background:var(--bg-secondary);">
                <div style="font-size:0.8rem; color:var(--text-tertiary);">
                    <span id="docview-saved-indicator" style="display:none; color:#10b981; font-weight:700; display:flex; align-items:center; gap:0.25rem;">
                        <span class="material-icons-round" style="font-size:1rem;">check_circle</span> Salvato
                    </span>
                </div>
                <div style="display:flex; gap:0.6rem;">
                    <button id="docview-regen-btn" style="display:flex; align-items:center; gap:0.4rem; padding:0.55rem 1rem; border-radius:9px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.82rem; cursor:pointer;">
                        <span class="material-icons-round" style="font-size:0.95rem;">refresh</span> Rigenera questo
                    </button>
                    <button id="docview-copy-btn" style="display:flex; align-items:center; gap:0.4rem; padding:0.55rem 1rem; border-radius:9px; border:1px solid var(--glass-border); background:white; color:var(--text-primary); font-weight:700; font-size:0.82rem; cursor:pointer;">
                        <span class="material-icons-round" style="font-size:0.95rem;">content_copy</span> Copia
                    </button>
                    <button id="docview-save-btn" style="display:flex; align-items:center; gap:0.4rem; padding:0.55rem 1.25rem; border-radius:9px; border:none; background:var(--brand-gradient); color:white; font-weight:700; font-size:0.82rem; cursor:pointer; box-shadow:0 3px 10px rgba(99,102,241,0.25);">
                        <span class="material-icons-round" style="font-size:0.95rem;">save</span> Salva modifiche
                    </button>
                </div>
            </div>
        </div>
    `;
}

function _buildDocContent(doc) {
    const meta = DOC_TYPE_META[doc.doc_type] || { label: doc.doc_type, icon: 'article', color: '#64748b' };
    const isHTML = doc.doc_type === 'landing';
    const genDate = doc.generated_at ? new Date(doc.generated_at).toLocaleString('it-IT') : '';

    return `
        <div style="display:flex; flex-direction:column; height:100%;">
            <div style="padding:0.75rem 1.5rem; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--glass-border); flex-shrink:0; background:white;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="material-icons-round" style="color:${meta.color}; font-size:1.1rem;">${meta.icon}</span>
                    <span style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${meta.label}</span>
                    ${doc.error ? `<span style="font-size:0.72rem; padding:2px 8px; background:rgba(239,68,68,0.1); color:#ef4444; border-radius:6px; font-weight:700;">Errore</span>` : ''}
                </div>
                <span style="font-size:0.72rem; color:var(--text-tertiary);">Generato: ${genDate}</span>
            </div>
            <div style="flex:1; overflow:auto; padding:1.5rem;">
                ${doc.error
                    ? `<div style="padding:1.5rem; background:rgba(239,68,68,0.06); border-radius:12px; border:1px solid rgba(239,68,68,0.2); color:#ef4444; font-size:0.875rem;">Errore durante la generazione: ${doc.error}.<br>Usa "Rigenera questo" per riprovare.</div>`
                    : `<div style="position:relative;">
                        ${isHTML ? `
                            <div style="margin-bottom:0.75rem; display:flex; gap:0.5rem;">
                                <button onclick="window._sapDocViewerTogglePreview()" style="font-size:0.75rem; padding:4px 10px; border-radius:7px; border:1px solid var(--glass-border); background:white; cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.25rem;">
                                    <span class="material-icons-round" style="font-size:0.85rem;">preview</span> Anteprima
                                </button>
                            </div>
                            <div id="docview-html-preview" style="display:none; border:1px solid var(--glass-border); border-radius:12px; overflow:hidden; margin-bottom:0.75rem; height:400px;">
                                <iframe id="docview-iframe" style="width:100%; height:100%; border:none;"></iframe>
                            </div>
                        ` : ''}
                        <textarea id="docview-editor" style="width:100%; min-height:500px; padding:1rem; border:1px solid var(--glass-border); border-radius:12px; font-family:ui-monospace, monospace; font-size:0.82rem; line-height:1.6; color:var(--text-primary); background:var(--bg-color); resize:vertical; box-sizing:border-box;" spellcheck="false">${_escapeHtml(doc.content || '')}</textarea>
                    </div>`
                }
            </div>
        </div>
    `;
}

// ─── Interactions ─────────────────────────────────────────────────────────────

let _activeDocType = null;
let _docsMap = {};

function _activateTab(docType, docs) {
    _activeDocType = docType;
    _docsMap = Object.fromEntries(docs.map(d => [d.doc_type, d]));

    const content = document.getElementById('docview-content');
    if (content) content.innerHTML = _buildDocContent(_docsMap[docType] || { doc_type: docType, content: '', error: 'Documento non trovato' });

    document.querySelectorAll('.docview-tab').forEach(btn => {
        const isActive = btn.dataset.doc === docType;
        const meta = DOC_TYPE_META[btn.dataset.doc] || { color: '#64748b' };
        btn.style.background = isActive ? 'white' : 'transparent';
        btn.style.color      = isActive ? meta.color : 'var(--text-secondary)';
        btn.style.boxShadow  = isActive ? 'var(--shadow-sm)' : 'none';
    });
}

function _bindActions(serviceId, docs, modal) {
    window._sapDocViewerActivateTab = (docType) => _activateTab(docType, docs);

    window._sapDocViewerTogglePreview = () => {
        const preview = document.getElementById('docview-html-preview');
        const iframe  = document.getElementById('docview-iframe');
        const editor  = document.getElementById('docview-editor');
        if (!preview) return;
        const showing = preview.style.display !== 'none';
        if (!showing && iframe && editor) {
            iframe.srcdoc = editor.value;
        }
        preview.style.display = showing ? 'none' : 'block';
    };

    document.getElementById('docview-copy-btn')?.addEventListener('click', () => {
        const editor = document.getElementById('docview-editor');
        if (!editor) return;
        navigator.clipboard.writeText(editor.value).then(() => {
            window.showAlert('Copiato negli appunti', 'success');
        });
    });

    document.getElementById('docview-save-btn')?.addEventListener('click', async () => {
        const editor = document.getElementById('docview-editor');
        if (!editor || !_activeDocType) return;

        const docInMap = _docsMap[_activeDocType];
        if (docInMap) docInMap.content = editor.value;

        const service = state.sapServices?.find(s => s.id === serviceId);
        const existingLinks = (service?.cloud_links || []).filter(l => l.type !== 'ai_doc');
        const updatedLinks = [...existingLinks, ...Object.values(_docsMap).map(d => ({ type: 'ai_doc', ...d }))];

        const { error } = await supabase.from('core_services').update({ cloud_links: updatedLinks }).eq('id', serviceId);
        if (error) { await window.showAlert('Errore salvataggio: ' + error.message, 'error'); return; }
        if (service) service.cloud_links = updatedLinks;

        const indicator = document.getElementById('docview-saved-indicator');
        if (indicator) { indicator.style.display = 'flex'; setTimeout(() => { indicator.style.display = 'none'; }, 2500); }
    });

    document.getElementById('docview-regen-btn')?.addEventListener('click', async () => {
        if (!_activeDocType) return;
        const confirmed = await window.showConfirm(`Rigenerare il documento "${DOC_TYPE_META[_activeDocType]?.label}"?\nIl contenuto attuale sarà sovrascritto.`, { confirmText: 'Rigenera', type: 'warning' });
        if (!confirmed) return;

        const { openDocGenerator } = await import('./doc_generator.js?v=8000');
        modal.remove();
        await openDocGenerator(serviceId);
    });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
