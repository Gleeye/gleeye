export class CloudLinksManager {
    constructor(container, links = [], onUpdate) {
        this.container = container;
        this.links = JSON.parse(JSON.stringify(links || [])); // Deep copy
        this.onUpdate = onUpdate;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="cloud-links-manager">
                <div class="links-list">
                    ${this.links.length === 0 ? `
                        <div class="empty-state">
                            <span class="material-icons-round">cloud_off</span>
                            <p>Nessuna risorsa collegata</p>
                        </div>
                    ` : this.links.map((link, index) => `
                        <div class="link-item">
                            <div class="link-icon ${link.type}">
                                ${this.getIcon(link.type)}
                            </div>
                            <div class="link-info">
                                <a href="${link.url}" target="_blank" class="link-label">${link.label}</a>
                                <span class="link-url">${this.formatUrl(link.url)}</span>
                            </div>
                            <button class="delete-btn" data-index="${index}" title="Rimuovi">
                                <span class="material-icons-round">close</span>
                            </button>
                        </div>
                    `).join('')}
                </div>

                <div class="add-link-form">
                    <div class="form-row">
                        <select id="new-link-type" class="form-select">
                            <option value="drive">Google Drive</option>
                            <option value="dropbox">Dropbox</option>
                            <option value="onedrive">OneDrive</option>
                            <option value="resource">Link Generico</option>
                        </select>
                        <input type="text" id="new-link-label" class="form-input" placeholder="Etichetta (es. Cartella Progetto)">
                    </div>
                    <div class="form-row">
                        <input type="url" id="new-link-url" class="form-input full-width" placeholder="https://...">
                        <button id="add-link-btn" class="primary-btn-icon">
                            <span class="material-icons-round">add</span>
                        </button>
                    </div>
                </div>

                <style>
                    .cloud-links-manager { display: flex; flex-direction: column; gap: 1rem; }
                    
                    .links-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; }
                    .empty-state { 
                        display: flex; flex-direction: column; align-items: center; justify-content: center; 
                        padding: 1.5rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; color: #94a3b8;
                    }
                    .empty-state .material-icons-round { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5; }
                    .empty-state p { margin: 0; font-size: 0.85rem; }

                    .link-item { 
                        display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; 
                        background: white; border: 1px solid #e2e8f0; border-radius: 8px; transition: 0.2s;
                    }
                    .link-item:hover { border-color: #cbd5e1; transform: translateY(-1px); }

                    .link-icon { 
                        width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; 
                        background: #f1f5f9; color: #64748b; font-size: 1.2rem;
                    }
                    .link-icon.drive { background: #e8f0fe; color: #1a73e8; }
                    .link-icon.dropbox { background: #e0f2fe; color: #0284c7; }
                    .link-icon.onedrive { background: #eff6ff; color: #2563eb; }

                    .link-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                    .link-label { font-weight: 600; font-size: 0.85rem; color: #1e293b; text-decoration: none; }
                    .link-label:hover { color: var(--brand-blue); text-decoration: underline; }
                    .link-url { font-size: 0.7rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                    .delete-btn { 
                        background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 4px; border-radius: 4px; transition: 0.2s;
                    }
                    .delete-btn:hover { background: #fef2f2; color: #ef4444; }

                    .add-link-form { 
                        display: flex; flex-direction: column; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid #f1f5f9; 
                    }
                    .form-row { display: flex; gap: 0.5rem; }
                    
                    .form-input, .form-select { 
                        padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none; transition: 0.2s;
                    }
                    .form-input:focus, .form-select:focus { border-color: var(--brand-blue); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
                    .form-input.full-width { flex: 1; }
                    
                    .primary-btn-icon {
                        background: var(--brand-blue); color: white; border: none; border-radius: 6px; width: 34px; height: 34px;
                        display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;
                    }
                    .primary-btn-icon:hover { background: #1d4ed8; }
                </style>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // Delete
        this.container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = () => {
                const index = parseInt(btn.dataset.index);
                this.links.splice(index, 1);
                this.render();
                if (this.onUpdate) this.onUpdate(this.links);
            };
        });

        // Add
        const addBtn = this.container.querySelector('#add-link-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                const type = this.container.querySelector('#new-link-type').value;
                const label = this.container.querySelector('#new-link-label').value.trim();
                const url = this.container.querySelector('#new-link-url').value.trim();

                if (!url) {
                    alert("Inserisci un URL valido");
                    return;
                }
                if (!label) {
                    alert("Inserisci un'etichetta");
                    return;
                }

                this.links.push({ type, label, url });
                this.render();
                if (this.onUpdate) this.onUpdate(this.links);
            };
        }
    }

    getIcon(type) {
        switch (type) {
            case 'drive': return '<span class="material-icons-round">add_to_drive</span>'; // Or custom SVG
            case 'dropbox': return '<span class="material-icons-round">folder_shared</span>';
            case 'onedrive': return '<span class="material-icons-round">cloud_queue</span>';
            default: return '<span class="material-icons-round">link</span>';
        }
    }

    formatUrl(url) {
        try {
            const u = new URL(url);
            return u.hostname + u.pathname;
        } catch {
            return url;
        }
    }
}
