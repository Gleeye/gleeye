import { supabase } from '../modules/config.js';
import { showGlobalAlert, showConfirm, renderModal, closeModal } from '../modules/utils.js?v=1001';

let currentForms = [];

export async function renderContactForms(container) {
    container.innerHTML = `
        <div class="header-actions-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h3>Gestione Moduli Contatto</h3>
            <button class="primary-btn" id="btn-new-form">
                <span class="material-icons-round">add</span> Nuovo Modulo
            </button>
        </div>
        <div class="card-grid" id="forms-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            <div class="loading-state"><span class="loader"></span></div>
        </div>
    `;

    document.getElementById('btn-new-form').addEventListener('click', () => openFormModal());

    await loadForms();
    renderGrid(container.querySelector('#forms-grid'));
}

async function loadForms() {
    const { data, error } = await supabase.from('contact_forms').select('*').order('created_at', { ascending: false });
    if (error) {
        showGlobalAlert('Errore caricamento moduli: ' + error.message, 'error');
        return;
    }
    currentForms = data || [];
}

function renderGrid(gridEl) {
    if (currentForms.length === 0) {
        gridEl.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-secondary); background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--glass-border);">Nessun modulo configurato. Clicca su "Nuovo Modulo" per iniziare.</div>`;
        return;
    }

    gridEl.innerHTML = currentForms.map(f => `
        <div class="data-card" style="display: flex; flex-direction: column; justify-content: space-between; background: var(--bg-surface); padding: 20px; border-radius: 16px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm);">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <h4 style="margin: 0;">${f.name}</h4>
                    <span class="status-badge ${f.is_active ? 'success' : 'neutral'}" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 20px;">${f.is_active ? 'Attivo' : 'Inattivo'}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 24px; min-height: 40px;">${f.description || 'Nessuna descrizione'}</p>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: auto;">
                <button class="btn-submissions" data-id="${f.id}" style="grid-column: span 3; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800; background: var(--brand-blue); border: none; padding: 14px; border-radius: 14px; color: white; cursor: pointer; box-shadow: 0 4px 12px rgba(var(--brand-blue-rgb), 0.2); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(var(--brand-blue-rgb), 0.3)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(var(--brand-blue-rgb), 0.2)'">
                    <span class="material-icons-round" style="font-size: 1.2rem;">list_alt</span> 
                    Vedi Risposte
                </button>
                <button class="btn-edit" data-id="${f.id}" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; background: rgba(var(--brand-blue-rgb), 0.08); color: var(--brand-blue); border: 1px solid rgba(var(--brand-blue-rgb), 0.1); border-radius: 12px; padding: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(var(--brand-blue-rgb), 0.12)'" onmouseout="this.style.background='rgba(var(--brand-blue-rgb), 0.08)'" title="Modifica">
                    <span class="material-icons-round" style="font-size: 1.1rem;">edit</span>
                </button>
                <button class="btn-preview" data-id="${f.id}" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; background: rgba(var(--brand-success-rgb, 34, 197, 94), 0.08); color: var(--brand-success, #22c55e); border: 1px solid rgba(var(--brand-success-rgb, 34, 197, 94), 0.1); border-radius: 12px; padding: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(var(--brand-success-rgb, 34, 197, 94), 0.12)'" onmouseout="this.style.background='rgba(var(--brand-success-rgb, 34, 197, 94), 0.08)'" title="Anteprima">
                    <span class="material-icons-round" style="font-size: 1.1rem;">visibility</span>
                </button>
                <button class="btn-embed" data-id="${f.id}" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; background: rgba(var(--brand-viola-rgb), 0.08); color: var(--brand-viola); border: 1px solid rgba(var(--brand-viola-rgb), 0.1); border-radius: 12px; padding: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(var(--brand-viola-rgb), 0.12)'" onmouseout="this.style.background='rgba(var(--brand-viola-rgb), 0.08)'" title="Codice Embed">
                    <span class="material-icons-round" style="font-size: 1.1rem;">code</span>
                </button>
            </div>
        </div>
    `).join('');

    gridEl.querySelectorAll('.btn-preview').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const url = `${window.location.origin}/form.html?id=${id}`;
        window.open(url, '_blank');
    }));

    gridEl.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openFormModal(currentForms.find(f => f.id === id));
    }));

    gridEl.querySelectorAll('.btn-submissions').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openSubmissionsModal(currentForms.find(f => f.id === id));
    }));

    gridEl.querySelectorAll('.btn-embed').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        showEmbedCode(id);
    }));
}

function showEmbedCode(formId) {
    const domain = window.location.origin;
    const iframeId = 'gleeye-form-' + formId;
    const snippet = `<!-- Gleeye Contact Form Embed -->
<iframe id="${iframeId}" src="${domain}/form.html?id=${formId}" width="100%" height="500" frameborder="0" style="border:none; border-radius: 12px; background: transparent;"></iframe>
<script>
(function() {
    const iframe = document.getElementById('${iframeId}');
    const syncStyles = () => {
        const computed = window.getComputedStyle(document.body);
        const styles = {
            fontFamily: computed.fontFamily,
            textColor: computed.color,
            bgColor: computed.backgroundColor,
            primaryColor: computed.getPropertyValue('--primary-color') || computed.getPropertyValue('--brand-color') || null
        };
        iframe.contentWindow.postMessage({ type: 'apply_styles', styles }, '*');
    };
    window.addEventListener('message', (e) => {
        if (e.data.type === 'ready_for_styles') syncStyles();
        if (e.data.type === 'resize_iframe' && e.data.height) iframe.height = e.data.height;
    });
})();
</script>`;

    const content = `
        <div class="modal-header">
            <h3>Codice di Incorporamento</h3>
            <button class="icon-btn close-modal"><span class="material-icons-round">close</span></button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom: 24px; color: var(--text-secondary);">Copia il seguente codice per inserire il modulo nel tuo sito. Il modulo cercherà di <strong>adattarsi automaticamente</strong> al font e ai colori del tuo sito:</p>
            <textarea readonly style="width: 100%; height: 180px; padding: 12px; font-family: monospace; font-size: 0.75rem; margin-bottom: 24px; border: 1px solid var(--glass-border); border-radius: 8px; background: var(--bg-surface-hover); resize: none; color: var(--text-primary);">${snippet}</textarea>
            <button class="primary-btn btn-copy" style="width: 100%;"><span class="material-icons-round">content_copy</span> Copia Codice</button>
        </div>
    `;
    renderModal('embed-code-modal', content);

    const modal = document.getElementById('embed-code-modal');
    modal.querySelector('.btn-copy').onclick = () => {
        navigator.clipboard.writeText(snippet);
        showGlobalAlert('Codice copiato negli appunti!', 'success');
        closeModal('embed-code-modal');
    };
}

let tempFields = [];

function openFormModal(form = null) {
    tempFields = form ? [...(form.fields || [])] : [];
    let expandedIndex = null;


    const modalId = 'contact-form-builder-modal';
    const content = `
        <div class="modal-header" style="padding: 24px 32px; border-bottom: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.3); backdrop-filter: blur(10px);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, var(--brand-blue), var(--brand-viola)); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 16px rgba(97, 74, 162, 0.2);">
                    <span class="material-icons-round" style="font-size: 1.4rem;">dashboard_customize</span>
                </div>
                <div>
                    <h3 style="margin: 0; font-family: var(--font-titles); font-weight: 800; font-size: 1.25rem; letter-spacing: -0.02em;">${form ? 'Modifica Modulo' : 'Crea Nuovo Modulo'}</h3>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500;">Configura i campi e lo stile del tuo modulo pubblico</p>
                </div>
            </div>
            <button class="icon-btn close-modal" style="background: var(--bg-surface-hover); border-radius: 10px; width: 36px; height: 36px;"><span class="material-icons-round">close</span></button>
        </div>
        
        <div class="modal-body" style="padding: 32px; background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%);">
            <form id="contact-form-builder">
                <!-- Sezione Info Base -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <div class="form-group" style="grid-column: span 2;">
                        <label style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: block;">Identificativo Modulo *</label>
                        <input type="text" id="cf-name" class="app-input" value="${form ? form.name.replace(/"/g, '&quot;') : ''}" required placeholder="es: Form Contatti Sito Indaco" style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg-surface); font-size: 0.95rem; transition: all 0.2s;">
                    </div>
                    
                    <div class="form-group" style="grid-column: span 2;">
                        <label style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: block;">Descrizione Interna</label>
                        <textarea id="cf-desc" class="app-input" rows="2" placeholder="Note per uso interno..." style="width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg-surface); font-size: 0.95rem; resize: vertical; min-height: 60px;">${form ? (form.description || '') : ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: block;">Messaggio di Successo</label>
                        <input type="text" id="cf-success" class="app-input" value="${form ? (form.success_message || 'Grazie!') : 'Grazie per averci contattato!'}" style="width:100%; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg-surface);">
                    </div>
                    
                    <div class="form-group">
                        <label style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: block;">Colore Pulsante Action</label>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <input type="color" id="cf-color" value="${form ? (form.primary_color || '#0d6efd') : '#0d6efd'}" style="height: 48px; width: 64px; padding: 4px; border-radius: 10px; border: 1px solid var(--glass-border); cursor: pointer; background: var(--bg-surface);">
                            <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">Scegli il colore principale del modulo</div>
                        </div>
                    </div>
                </div>
                
                <div class="form-group" style="background: rgba(var(--brand-blue-rgb), 0.05); padding: 16px; border-radius: 16px; border: 1px solid rgba(var(--brand-blue-rgb), 0.1); margin-bottom: 32px;">
                    <label style="display: flex; align-items: center; gap: 12px; margin: 0; cursor: pointer;">
                        <input type="checkbox" id="cf-active" ${(!form || form.is_active) ? 'checked' : ''} style="width: 22px; height: 22px; border-radius: 6px; cursor: pointer;">
                        <div style="flex: 1;">
                            <span style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem; display: block;">Modulo Attivo</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Se attivo, il modulo sarà accessibile pubblicamente tramite il link di incorporamento.</span>
                        </div>
                    </label>
                </div>

                    </div>
                </div>

                <!-- Sezione Configurazione Step (Globale) -->
                <div style="background: rgba(var(--brand-blue-rgb), 0.03); padding: 20px; border-radius: 16px; border: 1px solid var(--glass-border); margin-bottom: 32px;">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-round" style="color: var(--brand-blue);">settings</span> Impostazioni Step (Globali)
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Tipo Indicatore</label>
                            <select id="cf-step-type" class="app-input" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: white;">
                                <option value="none" ${form?.step_settings?.type === 'none' ? 'selected' : ''}>Nessuno</option>
                                <option value="text" ${form?.step_settings?.type === 'text' ? 'selected' : ''}>Testo</option>
                                <option value="icon" ${form?.step_settings?.type === 'icon' ? 'selected' : ''}>Icona</option>
                                <option value="number" ${(!form?.step_settings?.type || form?.step_settings?.type === 'number') ? 'selected' : ''}>Numero</option>
                                <option value="progress" ${form?.step_settings?.type === 'progress' ? 'selected' : ''}>Barra di progressione</option>
                                <option value="number_text" ${form?.step_settings?.type === 'number_text' ? 'selected' : ''}>Numero e testo</option>
                                <option value="icon_text" ${form?.step_settings?.type === 'icon_text' ? 'selected' : ''}>Icona e testo</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Forma Indicatore</label>
                            <select id="cf-step-shape" class="app-input" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: white;">
                                <option value="circle" ${(!form?.step_settings?.shape || form?.step_settings?.shape === 'circle') ? 'selected' : ''}>Cerchio</option>
                                <option value="square" ${form?.step_settings?.shape === 'square' ? 'selected' : ''}>Quadrato</option>
                                <option value="rounded" ${form?.step_settings?.shape === 'rounded' ? 'selected' : ''}>Arrotondato</option>
                                <option value="none" ${form?.step_settings?.shape === 'none' ? 'selected' : ''}>None</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Sezione Campi -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-top: 12px; border-top: 1px dashed var(--glass-border);">
                    <div>
                        <h4 style="margin: 0; font-family: var(--font-titles); font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">Configura Campi</h4>
                        <p style="font-size: 0.8rem; color: var(--text-tertiary); margin: 0; font-weight: 500;">Definisci i dati che vuoi raccogliere dagli utenti.</p>
                    </div>
                    <button type="button" class="btn-add-field" style="display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-size: 0.85rem; font-weight: 700; background: var(--brand-blue); color: white; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(13, 110, 253, 0.2); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                        <span class="material-icons-round" style="font-size: 1.2rem;">add_circle</span> 
                        Nuovo Campo
                    </button>
                </div>
                
                <div id="fields-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
            </form>
        </div>
        
        <div class="modal-footer" style="padding: 24px 32px; border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 16px; background: rgba(255,255,255,0.3); backdrop-filter: blur(10px);">
            ${form ? `<button type="button" class="btn-delete" style="background: none; border: none; color: #ef4444; font-weight: 700; font-size: 0.85rem; cursor: pointer; margin-right: auto; display: flex; align-items: center; gap: 6px; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'"><span class="material-icons-round" style="font-size: 1.2rem;">delete_outline</span> Elimina Modulo</button>` : ''}
            <button type="button" class="close-modal" style="background: var(--bg-surface-hover); border: 1px solid var(--glass-border); color: var(--text-secondary); padding: 10px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 0.9rem;">Annulla</button>
            <button type="button" class="btn-save" style="background: linear-gradient(135deg, var(--brand-blue), var(--brand-viola)); color: white; border: none; padding: 10px 32px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 0.9rem; box-shadow: 0 8px 16px rgba(13, 110, 253, 0.2); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">Salva Modulo</button>
        </div>
    `;

    renderModal(modalId, content);

    const modal = document.getElementById(modalId);
    const container = modal.querySelector('#fields-container');

    const welcomeToggle = modal.querySelector('#cf-has-welcome');
    const welcomeSettings = modal.querySelector('#welcome-settings');
    welcomeToggle.addEventListener('change', (e) => {
        welcomeSettings.style.display = e.target.checked ? 'block' : 'none';
        welcomeToggle.closest('label').style.marginBottom = e.target.checked ? '16px' : '0';
    });

    const getTypeIcon = (t) => {
        const map = { text: 'short_text', email: 'email', textarea: 'notes', url: 'link', tel: 'phone', number: '123', radio: 'radio_button_checked', select: 'arrow_drop_down_circle', checkbox: 'check_box', acceptance: 'done_all', date: 'calendar_today', time: 'schedule', file: 'upload_file', password: 'password', html: 'code', hidden: 'visibility_off', recaptcha: 'security', recaptcha_v3: 'security', honeypot: 'bug_report', step: 'view_day' };
        return map[t] || 'input';
    };

    const getTypeLabel = (t) => {
        const map = { text: 'Testo', email: 'Email', textarea: 'Area testo', url: 'URL', tel: 'Tel', number: 'Numero', radio: 'Radio', select: 'Seleziona', checkbox: 'Checkbox', acceptance: 'Accettazione', date: 'Data', time: 'Orario', file: 'Upload file', password: 'Password', html: 'HTML', hidden: 'Nascosto', recaptcha: 'reCAPTCHA', recaptcha_v3: 'reCAPTCHA V3', honeypot: 'Honeypot', step: 'Step (Separatore)' };
        return map[t] || t;
    };

    const renderFields = () => {
        if (tempFields.length === 0) {
            container.innerHTML = `
                <div style="background: rgba(var(--brand-blue-rgb), 0.02); color: var(--text-tertiary); padding: 40px 24px; text-align: center; border-radius: 16px; font-size: 0.9rem; border: 2px dashed var(--glass-border); display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <span class="material-icons-round" style="font-size: 2.5rem; opacity: 0.3;">post_add</span>
                    <div>
                        <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">Nessun campo configurato</div>
                        <div style="font-weight: 500; font-size: 0.8rem;">Verrà mostrato un modulo vuoto! Aggiungi almeno un campo per iniziare.</div>
                    </div>
                </div>`;
            return;
        }

        container.innerHTML = tempFields.map((f, i) => {
            const showOptions = ['select', 'radio', 'checkbox'].includes(f.type);
            const isTextarea = f.type === 'textarea';
            const isFile = f.type === 'file';
            const isStep = f.type === 'step';
            const isExpanded = i === expandedIndex;

            const headerHtml = `
                <div class="field-header" data-index="${i}" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: ${isExpanded ? '#f8fafc' : 'white'}; cursor: pointer; border-radius: ${isExpanded ? '16px 16px 0 0' : '16px'}; border-bottom: ${isExpanded ? '1px solid var(--glass-border)' : 'none'}; transition: all 0.2s;">
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <div style="display: flex; flex-direction: column; opacity: 0.6;" onclick="event.stopPropagation();">
                            <button type="button" class="btn-move-up" data-index="${i}" style="background:none; border:none; padding:0; cursor:pointer; height: 16px; color: var(--text-tertiary); transition: color 0.2s; ${i === 0 ? 'visibility:hidden' : ''}" onmouseover="this.style.color='var(--brand-blue)'" onmouseout="this.style.color='var(--text-tertiary)'">
                                <span class="material-icons-round" style="font-size: 1.2rem;">expand_less</span>
                            </button>
                            <button type="button" class="btn-move-down" data-index="${i}" style="background:none; border:none; padding:0; cursor:pointer; height: 16px; color: var(--text-tertiary); transition: color 0.2s; ${i === tempFields.length - 1 ? 'visibility:hidden' : ''}" onmouseover="this.style.color='var(--brand-blue)'" onmouseout="this.style.color='var(--text-tertiary)'">
                                <span class="material-icons-round" style="font-size: 1.2rem;">expand_more</span>
                            </button>
                        </div>
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(var(--brand-blue-rgb), 0.1); display: flex; align-items: center; justify-content: center; color: var(--brand-blue);">
                            <span class="material-icons-round" style="font-size: 1.2rem;">${getTypeIcon(f.type)}</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${f.label || 'Nuovo Campo'} ${f.required ? '<span style="color: #ef4444;">*</span>' : ''}</div>
                            <div style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500;">${getTypeLabel(f.type)}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn-remove-field" data-index="${i}" style="background: none; color: #ff5c5c; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; opacity: 0.7;" onmouseover="this.style.opacity='1'; this.style.background='#fff5f5';" onmouseout="this.style.opacity='0.7'; this.style.background='none';" onclick="event.stopPropagation();">
                            <span class="material-icons-round" style="font-size: 1.1rem;">delete_outline</span>
                        </button>
                        <span class="material-icons-round" style="color: var(--text-tertiary); transition: transform 0.3s; transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0)'};">expand_more</span>
                    </div>
                </div>
            `;

            const bodyHtml = isExpanded ? `
                <div class="field-body animate-fade-in" style="padding: 24px 20px; background: white; border-radius: 0 0 16px 16px;">
                    <!-- Prima Riga: Label e Tipo -->
                    <div style="display: grid; grid-template-columns: 2fr 1.5fr 80px; gap: 16px; align-items: flex-end;">
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Etichetta Campo</label>
                            <input type="text" class="fi-label app-input" data-index="${i}" value="${f.label.replace(/"/g, '&quot;')}" placeholder="es: Il tuo nome" style="margin: 0; width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd;">
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Tipo Input</label>
                            <select class="fi-type app-input" data-index="${i}" style="margin: 0; width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd;">
                                <optgroup label="Base">
                                    <option value="text" ${f.type === 'text' ? 'selected' : ''}>Testo</option>
                                    <option value="email" ${f.type === 'email' ? 'selected' : ''}>Email</option>
                                    <option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>Area testo</option>
                                    <option value="url" ${f.type === 'url' ? 'selected' : ''}>URL</option>
                                    <option value="tel" ${f.type === 'tel' ? 'selected' : ''}>Tel</option>
                                    <option value="number" ${f.type === 'number' ? 'selected' : ''}>Numero</option>
                                </optgroup>
                                <optgroup label="Scelta">
                                    <option value="radio" ${f.type === 'radio' ? 'selected' : ''}>Radio</option>
                                    <option value="select" ${f.type === 'select' ? 'selected' : ''}>Seleziona</option>
                                    <option value="checkbox" ${f.type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
                                    <option value="acceptance" ${f.type === 'acceptance' ? 'selected' : ''}>Accettazione</option>
                                </optgroup>
                                <optgroup label="Avanzati">
                                    <option value="date" ${f.type === 'date' ? 'selected' : ''}>Data</option>
                                    <option value="time" ${f.type === 'time' ? 'selected' : ''}>Orario</option>
                                    <option value="file" ${f.type === 'file' ? 'selected' : ''}>Upload di file</option>
                                    <option value="password" ${f.type === 'password' ? 'selected' : ''}>Password</option>
                                    <option value="html" ${f.type === 'html' ? 'selected' : ''}>HTML</option>
                                    <option value="hidden" ${f.type === 'hidden' ? 'selected' : ''}>Nascosto</option>
                                </optgroup>
                                <optgroup label="Sicurezza & Altro">
                                    <option value="recaptcha" ${f.type === 'recaptcha' ? 'selected' : ''}>reCAPTCHA</option>
                                    <option value="recaptcha_v3" ${f.type === 'recaptcha_v3' ? 'selected' : ''}>reCAPTCHA V3</option>
                                    <option value="honeypot" ${f.type === 'honeypot' ? 'selected' : ''}>Honeypot</option>
                                    <option value="step" ${f.type === 'step' ? 'selected' : ''}>Step (Separatore)</option>
                                </optgroup>
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin: 0; display: flex; flex-direction: column; align-items: center;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: block;">Richiesto</label>
                            <div style="height: 38px; display: flex; align-items: center;">
                                <input type="checkbox" class="fi-req" data-index="${i}" ${f.required ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                            </div>
                        </div>
                    </div>

                    <!-- Seconda Riga: Config Avanzata -->
                    <div style="display: grid; grid-template-columns: 2fr 1fr ${isTextarea ? '80px' : '0px'}; gap: 16px; align-items: flex-end; padding-top: 16px; margin-top: 16px; border-top: 1px dashed var(--glass-border);">
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Segnaposto (Placeholder)</label>
                            <input type="text" class="fi-placeholder app-input" data-index="${i}" value="${(f.placeholder || '').replace(/"/g, '&quot;')}" placeholder="Testo suggerito..." style="margin: 0; width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd;">
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Larghezza Colonna</label>
                            <select class="fi-width app-input" data-index="${i}" style="margin: 0; width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd;">
                                <option value="100%" ${f.width === '100%' ? 'selected' : ''}>100% (Riga Intera)</option>
                                <option value="50%" ${f.width === '50%' ? 'selected' : ''}>50% (Mezza Riga)</option>
                                <option value="33%" ${f.width === '33%' ? 'selected' : ''}>33% (Un terzo)</option>
                                <option value="25%" ${f.width === '25%' ? 'selected' : ''}>25% (Un quarto)</option>
                                <option value="20%" ${f.width === '20%' ? 'selected' : ''}>20% (Un quinto)</option>
                            </select>
                        </div>

                        ${isTextarea ? `
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Righe</label>
                            <input type="number" class="fi-rows app-input" data-index="${i}" value="${f.rows || 4}" min="1" max="20" style="margin: 0; width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd;">
                        </div>
                        ` : ''}

                        ${isFile ? `
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Limite MB</label>
                            <input type="number" class="fi-max-size app-input" data-index="${i}" value="${f.max_size || 10}" min="1" max="50" style="margin: 0; width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd;">
                        </div>
                        ` : ''}
                    </div>

                    ${showOptions ? `
                    <div class="form-group" style="margin: 0; padding-top: 16px; margin-top: 16px; border-top: 1px dashed var(--glass-border);">
                        <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Opzioni (una per riga)</label>
                        <textarea class="fi-options app-input" data-index="${i}" rows="2" placeholder="es:\nOpzione 1\nOpzione 2" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd; font-size: 0.85rem;">${f.options ? f.options.join('\n') : ''}</textarea>
                    </div>
                    ` : ''}

                    ${f.type === 'html' ? `
                    <div class="form-group" style="margin: 0; padding-top: 16px; margin-top: 16px; border-top: 1px dashed var(--glass-border);">
                        <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block;">Codice HTML Custom</label>
                        <textarea class="fi-html-code app-input" data-index="${i}" rows="3" placeholder="<p>Inserisci qui il tuo HTML custom...</p>" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--glass-border); background: #fcfcfd; font-size: 0.85rem; font-family: monospace;">${f.html_content || ''}</textarea>
                    </div>
                    ` : ''}
                </div>
            ` : '';

            return `
            <div class="field-accordion" style="display: flex; flex-direction: column; margin-bottom: ${isExpanded ? '20px' : '12px'}; background: white; border-radius: 16px; border: 1px solid var(--glass-border); position: relative; box-shadow: ${isExpanded ? 'var(--shadow-premium)' : 'var(--shadow-sm)'}; transition: all 0.2s;">
                <div style="position: absolute; left: -1px; top: ${isExpanded ? '24px' : '12px'}; bottom: ${isExpanded ? '24px' : '12px'}; width: 4px; background: var(--brand-blue); border-radius: 0 4px 4px 0; opacity: ${isExpanded ? '0.8' : '0'}; transition: all 0.2s;"></div>
                ${headerHtml}
                ${bodyHtml}
            </div>
            `;
        }).join('');

        // Bind events
        container.querySelectorAll('.field-header').forEach(el => el.addEventListener('click', e => {
            const idx = parseInt(e.currentTarget.dataset.index);
            expandedIndex = expandedIndex === idx ? null : idx;
            renderFields();
        }));

        container.querySelectorAll('.btn-move-up').forEach(el => el.addEventListener('click', e => {
            const idx = parseInt(e.currentTarget.dataset.index);
            if (idx > 0) {
                const temp = tempFields[idx];
                tempFields[idx] = tempFields[idx - 1];
                tempFields[idx - 1] = temp;
                expandedIndex = expandedIndex === idx ? idx - 1 : expandedIndex === idx - 1 ? idx : expandedIndex;
                renderFields();
            }
        }));

        container.querySelectorAll('.btn-move-down').forEach(el => el.addEventListener('click', e => {
            const idx = parseInt(e.currentTarget.dataset.index);
            if (idx < tempFields.length - 1) {
                const temp = tempFields[idx];
                tempFields[idx] = tempFields[idx + 1];
                tempFields[idx + 1] = temp;
                expandedIndex = expandedIndex === idx ? idx + 1 : expandedIndex === idx + 1 ? idx : expandedIndex;
                renderFields();
            }
        }));

        container.querySelectorAll('.fi-label').forEach(el => el.addEventListener('input', e => {
            tempFields[e.target.dataset.index].label = e.target.value;
            // Removed real-time renderFields here so user doesn't lose focus while typing.
            // Accordion header won't update fully instantly, but that's standard.
        }));
        // Update header on change (blur)
        container.querySelectorAll('.fi-label').forEach(el => el.addEventListener('change', e => {
            renderFields();
        }));

        container.querySelectorAll('.fi-type').forEach(el => el.addEventListener('change', e => {
            tempFields[e.target.dataset.index].type = e.target.value;
            renderFields();
        }));

        container.querySelectorAll('.fi-req').forEach(el => el.addEventListener('change', e => tempFields[e.target.dataset.index].required = e.target.checked));

        container.querySelectorAll('.fi-placeholder').forEach(el => el.addEventListener('input', e => {
            tempFields[e.target.dataset.index].placeholder = e.target.value;
        }));

        container.querySelectorAll('.fi-width').forEach(el => el.addEventListener('change', e => {
            tempFields[e.target.dataset.index].width = e.target.value;
        }));

        container.querySelectorAll('.fi-rows').forEach(el => el.addEventListener('input', e => {
            tempFields[e.target.dataset.index].rows = parseInt(e.target.value) || 4;
        }));

        container.querySelectorAll('.fi-max-size').forEach(el => el.addEventListener('input', e => {
            tempFields[e.target.dataset.index].max_size = parseInt(e.target.value) || 10;
        }));

        container.querySelectorAll('.fi-options').forEach(el => el.addEventListener('input', e => {
            tempFields[e.target.dataset.index].options = e.target.value.split('\n').map(s => s.trim()).filter(s => s);
        }));

        container.querySelectorAll('.fi-html-code').forEach(el => el.addEventListener('input', e => {
            tempFields[e.target.dataset.index].html_content = e.target.value;
        }));

        container.querySelectorAll('.btn-remove-field').forEach(el => el.addEventListener('click', e => {
            const idx = parseInt(e.currentTarget.dataset.index);
            tempFields.splice(idx, 1);
            if (expandedIndex === idx) expandedIndex = null;
            else if (expandedIndex > idx) expandedIndex--;
            renderFields();
        }));
    };

    renderFields();

    renderFields();

    modal.querySelector('.btn-add-field').onclick = () => {
        tempFields.push({ id: 'field_' + Math.random().toString(36).substr(2, 9), label: '', type: 'text', required: true });
        expandedIndex = tempFields.length - 1;
        renderFields();
        setTimeout(() => container.scrollTo(0, container.scrollHeight), 50);
    };

    const saveBtn = modal.querySelector('.btn-save');
    saveBtn.onclick = async () => {
        const name = modal.querySelector('#cf-name').value.trim();
        if (!name) return showGlobalAlert('Il nome del modulo è obbligatorio', 'error');

        for (let fi of tempFields) {
            if (!fi.label.trim()) return showGlobalAlert('Tutte le etichette dei campi devono essere compilate', 'error');
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loader small"></span>';

        const payload = {
            name,
            description: modal.querySelector('#cf-desc').value.trim(),
            success_message: modal.querySelector('#cf-success').value.trim(),
            primary_color: modal.querySelector('#cf-color').value,
            is_active: modal.querySelector('#cf-active').checked,
            has_welcome_screen: modal.querySelector('#cf-has-welcome').checked,
            welcome_title: modal.querySelector('#cf-welcome-title').value.trim(),
            welcome_description: modal.querySelector('#cf-welcome-desc').value.trim(),
            welcome_button_text: modal.querySelector('#cf-welcome-btn').value.trim(),
            step_settings: {
                type: modal.querySelector('#cf-step-type').value,
                shape: modal.querySelector('#cf-step-shape').value
            },
            fields: tempFields
        };

        if (form) {
            const { error } = await supabase.from('contact_forms').update(payload).eq('id', form.id);
            if (error) {
                showGlobalAlert(error.message, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Salva Modulo';
            } else {
                showGlobalAlert('Modulo aggiornato', 'success');
                closeModal(modalId);
            }
        } else {
            const { error } = await supabase.from('contact_forms').insert([payload]);
            if (error) {
                showGlobalAlert(error.message, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Salva Modulo';
            } else {
                showGlobalAlert('Modulo creato', 'success');
                closeModal(modalId);
            }
        }

        await loadForms();
        renderGrid(document.getElementById('forms-grid'));
    };

    if (form) {
        modal.querySelector('.btn-delete').onclick = async () => {
            if (await showConfirm('Sei sicuro? Tutte le risposte associate verranno eliminate irrimediabilmente.', 'Elimina Modulo')) {
                const { error } = await supabase.from('contact_forms').delete().eq('id', form.id);
                if (error) showGlobalAlert(error.message, 'error');
                else {
                    showGlobalAlert('Modulo eliminato', 'success');
                    closeModal(modalId);
                    await loadForms();
                    renderGrid(document.getElementById('forms-grid'));
                }
            }
        };
    }
}

async function openSubmissionsModal(form) {
    const modalId = 'submissions-list-modal';
    const content = `
        <div class="modal-header">
            <div>
                <h3 style="margin-bottom: 4px;">Risposte Modulo: ${form.name}</h3>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Consulta le submission ricevute da questo modulo online.</p>
            </div>
            <button class="icon-btn close-modal"><span class="material-icons-round">close</span></button>
        </div>
        <div class="modal-body" style="padding: 0; min-height: 300px;">
            <div id="subs-container">
                <div class="loading-state" style="padding: 40px;"><span class="loader"></span></div>
            </div>
        </div>
    `;

    renderModal(modalId, content);
    const modal = document.getElementById(modalId);
    const container = modal.querySelector('#subs-container');

    const { data, error } = await supabase.from('contact_submissions').select('*').eq('form_id', form.id).order('created_at', { ascending: false });
    if (error) {
        container.innerHTML = `<div style="padding:24px; color:var(--error-color);">Errore caricamento: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="padding:60px; text-align:center; color: var(--text-secondary);">Nessuna risposta ricevuta finora per questo modulo.</div>';
        return;
    }

    const fields = form.fields || [];
    let headers = ['Data', ...fields.map(f => f.label)];

    let html = `
        <div class="table-container" style="border-radius: 0; border: none; border-top: 1px solid var(--glass-border);">
            <table class="data-table" style="margin: 0;">
                <thead style="position: sticky; top: 0; background: var(--bg-surface); z-index: 10;">
                    <tr>
                        ${headers.map(h => `<th style="padding: 16px;">${h}</th>`).join('')}
                        <th style="width: 50px; text-align: center;">Vedi</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(sub => {
        const payload = sub.data || {};
        const dateStr = new Date(sub.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

        let cols = [`<td style="white-space: nowrap; padding: 14px 16px; color: var(--text-secondary); font-size: 0.85rem;">${dateStr}</td>`];

        fields.forEach(f => {
            const val = payload[f.id] || payload[f.label] || '';
            cols.push(`<td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 14px 16px; font-size: 0.9rem;" title="${val}">${val}</td>`);
        });

        html += `
            <tr class="${sub.is_read ? '' : 'unread'}" style="transition: background 0.2s; ${sub.is_read ? '' : 'font-weight: 500; background: rgba(var(--brand-blue-rgb, 78, 146, 216), 0.05); border-left: 3px solid var(--brand-blue);'}">
                ${cols.join('')}
                <td style="padding: 14px 16px; text-align: center;">
                    <button class="icon-btn btn-view-sub" data-id="${sub.id}" title="Vedi Dettaglio" style="color: var(--brand-blue);"><span class="material-icons-round">open_in_new</span></button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    container.querySelectorAll('.btn-view-sub').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const s = data.find(x => x.id === id);
            viewSubmissionDetails(s, form, () => {
                if (!s.is_read) {
                    s.is_read = true;
                    const tr = btn.closest('tr');
                    tr.style.fontWeight = 'normal';
                    tr.style.background = 'transparent';
                    tr.style.borderLeft = 'none';
                    supabase.from('contact_submissions').update({ is_read: true }).eq('id', id).then();
                }
            });
        };
    });
}

function viewSubmissionDetails(sub, form, onRead) {
    onRead();
    const payload = sub.data || {};
    const dateStr = new Date(sub.created_at).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });

    const fieldsHtml = (form.fields || []).map(f => {
        const val = payload[f.id] || payload[f.label] || '- Nessun valore -';
        return `
            <div style="margin-bottom: 24px;">
                <label style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${f.label}</label>
                <div style="background: var(--bg-surface-hover); padding: 16px; border-radius: 12px; border: 1px solid var(--glass-border); white-space: pre-wrap; font-size: 0.95rem; line-height: 1.6; color: var(--text-primary);">${val}</div>
            </div>
        `;
    }).join('');

    const modalId = 'submission-detail-modal';
    const content = `
        <div class="modal-header" style="border-top: 4px solid var(--brand-blue); margin: -2rem -2rem 2.5rem -2rem; padding: 2rem 2rem 1.5rem 2rem;">
            <h3>Dettaglio Risposta</h3>
            <button class="icon-btn close-modal"><span class="material-icons-round">close</span></button>
        </div>
        <div class="modal-body">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 32px; padding: 12px; border-radius: 8px; background: rgba(var(--brand-blue-rgb, 78, 146, 216), 0.05); color: var(--brand-blue);">
                <span class="material-icons-round" style="font-size: 1.2rem;">calendar_today</span>
                <span style="font-size: 0.9rem; font-weight: 500;">Ricevuta ${dateStr}</span>
            </div>
            ${fieldsHtml}
        </div>
        <div class="modal-footer" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--glass-border); text-align: right;">
            <button class="primary-btn close-modal" style="min-width: 120px;">Chiudi</button>
        </div>
    `;

    renderModal(modalId, content);
}
