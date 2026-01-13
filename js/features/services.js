import { state } from '../modules/state.js?v=116';
import { formatAmount } from '../modules/utils.js?v=116';
import { supabase } from '../modules/config.js?v=116';
// Actually, usually upsert functions are imported from api.js. I'll add upsertService to api.js later.
import { upsertService } from '../modules/api.js?v=116';

export function renderServices(container) {
    const renderGrid = () => {
        const filtered = state.services.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
                (s.type && s.type.toLowerCase().includes(state.searchTerm.toLowerCase()));

            const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
            const matchesDept = !state.selectedServiceDepartment || tags.includes(state.selectedServiceDepartment);

            return matchesSearch && matchesDept;
        }).sort((a, b) => a.name.localeCompare(b.name));

        const html = filtered.map(s => `
        <div class="card service-card" onclick="openServiceModal('${s.id}')" style="cursor:pointer; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; position: relative; height: 100%;">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="width: 42px; height: 42px; border-radius: 8px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; color: var(--brand-blue);">
                    <span class="material-icons-round">category</span>
                </div>
                <span style="font-size: 0.8rem; padding: 2px 8px; border-radius: 12px; background: var(--bg-secondary); color: var(--text-secondary);">${s.type || 'Servizio'}</span>
            </div>
            
            <div>
                <h3 style="margin: 0; font-size: 1rem; font-weight: 400; color: var(--text-primary); line-height: 1.3;">${s.name}</h3>
                ${s.details ? `<p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-tertiary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${s.details}</p>` : ''}
            </div>

            <div style="margin-top: auto; padding-top: 0.75rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Prezzo</span>
                    <span style="font-weight: 400; color: var(--text-primary);">€ ${formatAmount(s.price)}</span>
                </div>
                 <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Margine</span>
                    <span style="font-weight: 500; color: ${s.margin > 0 ? 'var(--success-color)' : 'var(--error-color)'};">
                        ${s.margin_percent ? s.margin_percent + '%' : '-'}
                    </span>
                </div>
            </div>
            
            <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                ${(s.tags || []).slice(0, 3).map(t => `<span style="font-size: 0.7rem; color: var(--text-tertiary); background: var(--bg-secondary); padding: 1px 6px; border-radius: 4px;">${t}</span>`).join('')}
            </div>
        </div>
    `).join('');
        return html;
    };

    container.innerHTML = `
    <div class="animate-fade-in">
        <div class="section-header" style="display:block; margin-bottom: 2rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-size: 1.1rem; font-weight: 400; color: var(--text-primary);">Catalogo Servizi</span>
                    <span id="services-count-badge" style="background: var(--brand-blue); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 400;">${state.services.length}</span>
                </div>
                <button class="primary-btn" onclick="openServiceModal()">
                    <span class="material-icons-round">add</span>
                    Nuovo Servizio
                </button>
            </div>

            <div class="pills-container" id="service-dept-pills">
                <button class="pill-filter ${!state.selectedServiceDepartment ? 'active' : ''}" data-dept="">Tutti</button>
                ${state.departments.map(d => `<button class="pill-filter ${state.selectedServiceDepartment === d.name ? 'active' : ''}" data-dept="${d.name}">${d.name}</button>`).join('')}
            </div>
        </div>
        
        <div class="card-grid" id="services-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
            ${renderGrid() || `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem;">Nessun servizio trovato.</div>`}
        </div>
    </div>
    `;

    const pills = container.querySelector('#service-dept-pills');
    if (pills) {
        pills.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill-filter') && e.target.hasAttribute('data-dept')) {
                state.selectedServiceDepartment = e.target.dataset.dept;
                pills.querySelectorAll('.pill-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const grid = document.getElementById('services-grid');
                if (grid) grid.innerHTML = renderGrid();
                updateBadge();
            }
        });
    }

    function updateBadge() {
        const badge = document.getElementById('services-count-badge');
        if (badge) {
            const count = state.services.filter(s => {
                const matchesSearch = s.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
                    (s.type && s.type.toLowerCase().includes(state.searchTerm.toLowerCase()));
                const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
                const matchesDept = !state.selectedServiceDepartment || tags.includes(state.selectedServiceDepartment);
                return matchesSearch && matchesDept;
            }).length;
            badge.textContent = count;
        }
    }
}

// Modal Logic
window.openServiceModal = (id = null) => {
    const modal = document.getElementById('service-modal');
    if (!modal) return;

    modal.classList.add('active');
    const form = document.getElementById('service-form');
    form.reset();
    document.getElementById('service-id').value = '';

    if (id) {
        const s = state.services.find(x => x.id === id);
        if (s) {
            document.getElementById('service-modal-title').textContent = 'Modifica Servizio';
            document.getElementById('service-id').value = s.id;
            document.getElementById('service-name').value = s.name || '';
            document.getElementById('service-type').value = s.type || 'tariffa oraria';
            document.getElementById('service-cost').value = s.cost || 0;
            document.getElementById('service-price').value = s.price || 0;
            document.getElementById('service-details').value = s.details || '';

            const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
            document.getElementById('service-tags').value = JSON.stringify(tags);
            document.getElementById('service-tags-field').querySelector('span').textContent = tags.length ? tags.join(', ') : 'Seleziona Reparti...';
        }
    } else {
        document.getElementById('service-modal-title').textContent = 'Nuovo Servizio';
        document.getElementById('service-tags').value = '[]';
        document.getElementById('service-tags-field').querySelector('span').textContent = 'Seleziona Reparti...';
    }
};

export function initServiceModals() {
    if (!document.getElementById('service-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="service-modal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 id="service-modal-title">Nuovo Servizio</h2>
                        <button class="close-modal material-icons-round" onclick="document.getElementById('service-modal').classList.remove('active')">close</button>
                    </div>
                    <form id="service-form">
                        <input type="hidden" id="service-id">
                        <div class="form-grid">
                            <div class="form-group full-width"><label>Nome Servizio *</label><input type="text" id="service-name" required></div>
                            <div class="form-group">
                                <label>Tipo Tariffa</label>
                                <select id="service-type" style="appearance: auto !important; -webkit-appearance: auto !important; opacity: 1 !important; position: relative !important; width: 100% !important; height: 42px !important; pointer-events: auto !important; display: block !important;">
                                    <option value="tariffa oraria">tariffa oraria</option>
                                    <option value="tariffa giornaliera">tariffa giornaliera</option>
                                    <option value="tariffa mensile">tariffa mensile</option>
                                    <option value="tariffa annuale">tariffa annuale</option>
                                    <option value="tariffa spot">tariffa spot</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Reparto (Multiselect)</label>
                                <div class="tag-input-container" onclick="openServiceDeptSelector()"><div id="service-tags-field" class="tag-field" tabindex="0" style="min-height: 42px; display: flex; align-items: center; padding: 0.5rem 1rem; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--bg-primary);"><span>Seleziona Reparti...</span></div></div>
                                <input type="hidden" id="service-tags">
                            </div>
                            
                            <div class="form-group"><label>Costo Stimato (€)</label><input type="number" step="0.01" id="service-cost"></div>
                            <div class="form-group"><label>Prezzo al Cliente (€)</label><input type="number" step="0.01" id="service-price" required></div>
                            
                            <div class="form-group full-width"><label>Dettagli / Note</label><textarea id="service-details" rows="3"></textarea></div>
                        </div>
                        
                        <div class="form-actions" style="margin-top: 1.5rem;">
                             <button type="button" class="btn-secondary" onclick="document.getElementById('service-modal').classList.remove('active')">Annulla</button>
                            <button type="submit" class="primary-btn">Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        `);

        // Selector logic
        window.openServiceDeptSelector = () => {
            renderDeptSelectorModal();
        };

        function renderDeptSelectorModal() {
            // Remove existing if any
            const existing = document.getElementById('dept-selector-modal');
            if (existing) existing.remove();

            const current = JSON.parse(document.getElementById('service-tags').value || '[]');
            const depts = state.departments;

            const modalHtml = `
                <div id="dept-selector-modal" class="modal active" style="z-index: 200000; display: flex !important;">
                    <div class="modal-content" style="max-width: 400px; padding: 1.5rem; z-index: 200001; transform: scale(1) translateY(0); opacity: 1;">
                        <div class="modal-header" style="margin-bottom: 1.5rem; justify-content: space-between; display: flex; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 1rem;">
                            <h3 style="margin:0; font-size:1.1rem; color:var(--brand-blue);">Seleziona Reparti</h3>
                            <button type="button" class="close-modal material-icons-round" onclick="document.getElementById('dept-selector-modal').remove()" style="background:none; border:none; cursor:pointer; color:var(--text-tertiary); position: static;">close</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto; padding-right: 5px;">
                            ${depts.map(d => `
                                <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 10px; cursor: pointer; border: 1px solid var(--glass-border); transition: all 0.2s;">
                                    <input type="checkbox" value="${d.name}" ${current.includes(d.name) ? 'checked' : ''} class="dept-checkbox" style="width: 18px !important; height: 18px !important; opacity: 1 !important; position: static !important; pointer-events: auto !important; accent-color: var(--brand-blue);">
                                    <span style="font-size: 0.95rem; color: var(--text-primary);">${d.name}</span>
                                </label>
                            `).join('')}
                            ${depts.length === 0 ? '<p style="text-align:center; color:var(--text-tertiary);">Nessun reparto configurato.</p>' : ''}
                        </div>
                        <div class="form-actions" style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--glass-border); display: flex; gap: 0.75rem;">
                            <button type="button" class="btn-secondary" onclick="document.getElementById('dept-selector-modal').remove()" style="flex:1;">Annulla</button>
                            <button type="button" class="primary-btn" id="confirm-depts-btn" style="flex:1;">Conferma</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('confirm-depts-btn').addEventListener('click', () => {
                const selected = Array.from(document.querySelectorAll('.dept-checkbox:checked')).map(cb => cb.value);
                document.getElementById('service-tags').value = JSON.stringify(selected);
                document.getElementById('service-tags-field').querySelector('span').textContent = selected.length ? selected.join(', ') : 'Seleziona Reparti...';
                document.getElementById('dept-selector-modal').remove();
            });
        }

        document.getElementById('service-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('service-id').value;
            const cost = parseFloat(document.getElementById('service-cost').value) || 0;
            const price = parseFloat(document.getElementById('service-price').value) || 0;
            const margin = price - cost;
            const margin_percent = price > 0 ? Math.round((margin / price) * 100) : 0;

            const data = {
                id: id || undefined,
                name: document.getElementById('service-name').value,
                type: document.getElementById('service-type').value,
                cost: cost,
                price: price,
                margin: margin,
                margin_percent: margin_percent,
                details: document.getElementById('service-details').value,
                tags: JSON.parse(document.getElementById('service-tags').value || '[]')
            };

            try {
                await upsertService(data);
                document.getElementById('service-modal').classList.remove('active');
                if (state.currentPage === 'services') {
                    renderServices(document.getElementById('content-area'));
                }
            } catch (err) {
                window.showAlert('Errore: ' + err.message, 'error');
            }
        });
    }
}
