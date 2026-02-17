import { state } from '../modules/state.js';
import { supabase } from '../modules/config.js';
import {
    fetchSapServices,
    upsertSapService,
    fetchSapServiceAreas,
    upsertSapServiceArea,
    fetchSapServiceTypes,
    upsertSapServiceType,
    fetchDepartments,
    deleteSapService,
    fetchServices
} from '../modules/api.js';
import {
    fetchProjectSpaceForSapService,
    fetchAllProjectSpacesForSapService,
    fetchProjectItems,
    createPMItem,
    updatePMItem,
    deletePMItem
} from '../modules/pm_api.js';
import { formatAmount } from '../modules/utils.js?v=317';
import { CloudLinksManager } from '../features/components/CloudLinksManager.js';

// --- HANDLERS ---

window.deleteSapServiceHandler = async (e, id) => {
    e.stopPropagation();
    const confirmed = await window.showConfirm("Sei sicuro di voler eliminare questo Servizio SAP?", {
        type: 'danger',
        confirmText: 'Elimina',
        cancelText: 'Annulla'
    });

    if (!confirmed) return;

    try {
        await deleteSapService(id);
        state.sapServices = state.sapServices.filter(s => s.id !== id);
        await fetchSapServices();
        renderSapServices(document.getElementById('content-area'));
        await window.showAlert("Servizio SAP eliminato con successo", "success");
    } catch (err) {
        await window.showAlert("Errore eliminazione: " + err.message, "error");
    }
};

export async function renderSapServices(container) {
    if (state.sapServices.length === 0) await fetchSapServices();
    if (state.sapServiceAreas.length === 0) await fetchSapServiceAreas();
    if (state.sapServiceTypes.length === 0) await fetchSapServiceTypes();
    if (state.departments.length === 0) await fetchDepartments();

    const renderGrid = () => {
        const filtered = state.sapServices.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(state.searchTerm.toLowerCase());
            let matchesDept = true;
            if (state.selectedSapServiceDeptId && state.selectedSapServiceDeptId !== 'all') {
                const linkedDepts = (s.core_service_department_links || []).map(l => l.department_id);
                if (s.department_id) linkedDepts.push(s.department_id);
                matchesDept = linkedDepts.includes(state.selectedSapServiceDeptId);
            }
            return matchesSearch && matchesDept;
        }).sort((a, b) => a.name.localeCompare(b.name));

        if (filtered.length === 0) {
            return `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem;">Nessun servizio SAP trovato.</div>`;
        }

        return filtered.map(s => {
            const deptLinks = s.core_service_department_links || [];
            let deptNames = deptLinks.map(l => l.departments?.name).filter(Boolean);
            if (deptNames.length === 0 && s.department_id) {
                const d = state.departments.find(x => x.id === s.department_id);
                if (d) deptNames.push(d.name);
            }
            deptNames = [...new Set(deptNames)];

            const typeName = state.sapServiceTypes.find(t => t.id === s.type_id)?.name || '-';
            const areaNames = (s.core_service_area_links || []).map(link => link.core_service_areas?.name).filter(Boolean);

            return `
            <div class="card service-card" onclick="window.location.hash = '#sap-service-detail/${s.id}'" style="cursor:pointer; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; position: relative; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                    <div style="width: 42px; height: 42px; border-radius: 8px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; color: var(--brand-blue); flex-shrink: 0;">
                        <span class="material-icons-round">diamond</span> 
                    </div>
                    <div style="display:flex; align-items:flex-start; gap:8px;">
                        <div style="display:flex; flex-wrap:wrap; gap:4px; justify-content: flex-end;">
                             ${deptNames.map(d => `<span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--glass-border);">${d}</span>`).join('')}
                        </div>
                        <button class="icon-btn" onclick="deleteSapServiceHandler(event, '${s.id}')" title="Elimina" style="width: 24px; height: 24px; min-width: 24px;">
                            <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">delete</span>
                        </button>
                    </div>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 400; color: var(--text-primary); line-height: 1.3;">${s.name}</h3>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-tertiary);">${typeName}</p>
                </div>
                <div style="margin-top: auto; padding-top: 0.75rem; border-top: 1px solid var(--glass-border); display: flex; flex-wrap: wrap; gap: 0.25rem;">
                    ${areaNames.map(a => `<span style="font-size: 0.7rem; color: var(--text-tertiary); background: var(--bg-secondary); padding: 1px 6px; border-radius: 4px;">${a}</span>`).join('')}
                    ${areaNames.length === 0 ? '<span style="font-size: 0.7rem; color: var(--text-tertiary);">Nessuna area</span>' : ''}
                </div>
            </div>
        `;
        }).join('');
    };

    container.innerHTML = `
        <div class="animate-fade-in">
            <div class="section-header" style="display:block; margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 1.1rem; font-weight: 400; color: var(--text-primary);">Servizi SAP</span>
                        <span id="sap-services-count-badge" style="background: var(--brand-blue); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 400;">${state.sapServices.length}</span>
                    </div>
                    <button class="primary-btn" onclick="openSapServiceModal()">
                        <span class="material-icons-round">add</span>
                        Nuovo Servizio SAP
                    </button>
                </div>
                <div class="pills-container" id="sap-service-dept-pills">
                    <button class="pill-filter ${!state.selectedSapServiceDeptId || state.selectedSapServiceDeptId === 'all' ? 'active' : ''}" data-dept="all">Tutti</button>
                    ${state.departments.map(d => `<button class="pill-filter ${state.selectedSapServiceDeptId === d.id ? 'active' : ''}" data-dept="${d.id}">${d.name}</button>`).join('')}
                </div>
            </div>
            <div class="card-grid" id="sap-services-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
                ${renderGrid()}
            </div>
        </div>
    `;

    const pills = container.querySelector('#sap-service-dept-pills');
    if (pills) {
        pills.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill-filter') && e.target.hasAttribute('data-dept')) {
                state.selectedSapServiceDeptId = e.target.dataset.dept;
                pills.querySelectorAll('.pill-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const grid = document.getElementById('sap-services-grid');
                if (grid) grid.innerHTML = renderGrid();
                const count = state.sapServices.filter(s => {
                    const matchesSearch = s.name.toLowerCase().includes(state.searchTerm.toLowerCase());
                    let matchesDept = true;
                    if (state.selectedSapServiceDeptId && state.selectedSapServiceDeptId !== 'all') {
                        const linkedDepts = (s.core_service_department_links || []).map(l => l.department_id);
                        if (s.department_id) linkedDepts.push(s.department_id);
                        matchesDept = linkedDepts.includes(state.selectedSapServiceDeptId);
                    }
                    return matchesSearch && matchesDept;
                }).length;
                document.getElementById('sap-services-count-badge').textContent = count;
            }
        });
    }
}

export async function renderSapServiceDetail(container, serviceId) {
    if (!serviceId) {
        const hash = window.location.hash;
        const parts = hash.split('/');
        serviceId = parts[parts.length - 1];
    }
    if (!serviceId) return;

    state.currentSapServiceId = serviceId;
    if (state.sapServices.length === 0) await fetchSapServices();
    if (state.sapServiceAreas.length === 0) await fetchSapServiceAreas();
    if (state.sapServiceTypes.length === 0) await fetchSapServiceTypes();
    if (state.departments.length === 0) await fetchDepartments();

    const service = state.sapServices.find(s => s.id === serviceId);
    if (!service) {
        container.innerHTML = `<div style="padding: 2rem; color: var(--text-tertiary);">Servizio SAP non trovato.</div>`;
        return;
    }

    const selectedVariant = state.currentSapVariant || null;
    const allSpaces = await fetchAllProjectSpacesForSapService(serviceId);
    const spacesWithData = await Promise.all(allSpaces.map(async sp => {
        const spItems = await fetchProjectItems(sp.id);
        const totalPrice = spItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
        const totalCost = spItems.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.quantity) || 1), 0);
        const totalCatalogPrice = spItems.reduce((sum, item) => sum + (Number(item.catalog_price || item.price) || 0) * (Number(item.quantity) || 1), 0);
        const totalCatalogCost = spItems.reduce((sum, item) => sum + (Number(item.catalog_cost || item.cost) || 0) * (Number(item.quantity) || 1), 0);
        return {
            ...sp,
            totalPrice,
            totalCost,
            totalCatalogPrice,
            totalCatalogCost,
            margin: totalPrice - totalCost,
            marginPercent: totalPrice > 0 ? Math.round(((totalPrice - totalCost) / totalPrice) * 100) : 0
        };
    }));

    const space = await fetchProjectSpaceForSapService(serviceId, selectedVariant);
    if (!space) {
        container.innerHTML = `<div style="padding: 2rem; color: var(--text-tertiary);">Impossibile caricare o creare lo spazio PM per questo servizio.</div>`;
        return;
    }
    const items = await fetchProjectItems(space.id);

    // Final values: Manual override from space OR Sum from items
    const priceFromItems = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    const costFromItems = items.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.quantity) || 1), 0);

    const priceFinal = (space.price_final !== null && space.price_final !== undefined) ? Number(space.price_final) : priceFromItems;
    const costFinal = (space.cost_final !== null && space.cost_final !== undefined) ? Number(space.cost_final) : costFromItems;

    const revenueFinal = priceFinal - costFinal;
    const marginFinal = priceFinal > 0 ? Math.round((revenueFinal / priceFinal) * 100) : 0;

    // Catalog Sums for "Servizi" card (with fallback to negotiated if catalog is 0)
    const servicesPrice = items.reduce((sum, item) => sum + (Number(item.catalog_price || item.price) || 0) * (Number(item.quantity) || 1), 0);
    const servicesCost = items.reduce((sum, item) => sum + (Number(item.catalog_cost || item.cost) || 0) * (Number(item.quantity) || 1), 0);

    const typeName = state.sapServiceTypes.find(t => t.id === service.type_id)?.name || '-';
    const deptLinks = service.core_service_department_links || [];
    let deptNames = deptLinks.map(l => l.departments?.name).filter(Boolean);
    if (deptNames.length === 0 && service.department_id) {
        const d = state.departments.find(x => x.id === service.department_id);
        if (d) deptNames.push(d.name);
    }
    deptNames = [...new Set(deptNames)];
    const areaNames = (service.core_service_area_links || []).map(link => link.core_service_areas?.name).filter(Boolean);

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.innerHTML = `
            <div onclick="window.history.back()" style="width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.25s;">
                <span class="material-icons-round" style="font-size: 1.4rem; color: var(--text-primary);">arrow_back</span>
            </div>
            <span style="color: var(--text-primary); font-weight: 700; font-size: 1.55rem;">Dettaglio Servizio SAP</span>
        `;
    }

    container.innerHTML = `
        <div class="animate-fade-in" style="max-width: 1400px; margin: 0 auto; padding: 1.5rem;">
            <!-- Header Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; background: var(--bg-secondary); padding: 1.5rem 2rem; border-radius: 16px; border: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 1.25rem;">
                    <div style="width: 56px; height: 56px; border-radius: 14px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; color: white;">
                        <span class="material-icons-round" style="font-size: 2rem;">diamond</span>
                    </div>
                    <div>
                        <div style="font-size: 0.65rem; text-transform: uppercase; font-weight: 700; color: var(--text-tertiary);">${typeName}</div>
                        <h1 style="font-size: 1.75rem; font-weight: 700; margin: 0;">${service.name} ${selectedVariant ? ` - <span style="color: var(--brand-blue);">${selectedVariant}</span>` : ''}</h1>
                        <div style="color: var(--text-tertiary); font-size: 0.85rem;">Creato il ${new Date(service.created_at || Date.now()).toLocaleDateString()}</div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <button onclick="window.openSapServiceDocsModal('${space?.id}')" class="secondary-btn" style="display:flex; align-items:center; gap:0.5rem; background:white; padding:0.6rem 1rem; border-radius:12px; border:1px solid var(--glass-border); cursor:pointer;">
                        <span class="material-icons-round" style="color:var(--brand-blue); font-size:1.2rem;">description</span> <b>Note</b>
                    </button>
                    <button onclick="window.openSapServiceActivitiesModal('${space?.id}')" class="secondary-btn" style="display:flex; align-items:center; gap:0.5rem; background:white; padding:0.6rem 1rem; border-radius:12px; border:1px solid var(--glass-border); cursor:pointer;">
                        <span class="material-icons-round" style="color:var(--brand-blue); font-size:1.2rem;">assignment</span> <b>Attività</b>
                    </button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 300px 1fr 360px; gap: 1.5rem; align-items: start;">
                <!-- Left Column -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div class="glass-card" style="padding: 1.25rem;">
                        <label style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase;">Reparti</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem;">
                            ${deptNames.map(d => `<span style="font-size: 0.75rem; padding: 4px 10px; border-radius: 8px; background: var(--bg-secondary); border: 1px solid var(--glass-border); font-weight: 600;">${d}</span>`).join('')}
                        </div>
                    </div>
                    <div class="glass-card" style="padding: 1.25rem;">
                        <label style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase;">Aree</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem;">
                            ${areaNames.map(a => `<span style="font-size: 0.75rem; padding: 4px 10px; border-radius: 8px; background: var(--bg-secondary); border: 1px solid var(--glass-border); font-weight: 600;">${a}</span>`).join('')}
                        </div>
                    </div>
                </div>

                <!-- Middle Column (Empty for now) -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                </div>

                <!-- Right Column (Economics) -->
                <div style="display: flex; flex-direction: column; gap: 1.25rem; position: sticky; top: 1.5rem;">
                    
                    <!-- Ricavi Finali Card (from orders.js) -->
                    <div class="glass-card" style="padding: 1.25rem; background: linear-gradient(135deg, ${revenueFinal >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'}, transparent); border: 2px solid ${revenueFinal >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                            <div style="flex: 1;">
                                <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">Ricavi Finali (Margine)</div>
                                <div style="font-size: 1.6rem; font-weight: 800; line-height: 1; color: ${revenueFinal >= 0 ? '#10b981' : '#ef4444'}; font-family: var(--font-titles);">
                                    ${priceFinal > 0 && costFinal > 0 ? formatAmount(revenueFinal) + '€' : '—'}
                                </div>
                            </div>
                            <div style="position: relative; width: 60px; height: 60px;">
                                <svg width="60" height="60" style="transform: rotate(-90deg);">
                                    <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="5"></circle>
                                    <circle cx="30" cy="30" r="26" fill="none" 
                                        stroke="${marginFinal >= 20 ? '#10b981' : marginFinal >= 10 ? '#f59e0b' : '#ef4444'}" 
                                        stroke-width="5" 
                                        stroke-dasharray="${(marginFinal / 100) * 163.3} 163.3"
                                        stroke-linecap="round">
                                    </circle>
                                </svg>
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                    <div style="font-size: 0.85rem; font-weight: 800; color: ${marginFinal >= 20 ? '#10b981' : marginFinal >= 10 ? '#f59e0b' : '#ef4444'};">${marginFinal}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Prezzi Finali Card (Mirrored from orders.js) -->
                    <div class="glass-card editable-card" onclick="window.editSapEconomics('${space.id}')" style="padding: 1.5rem; background: var(--bg-secondary); border: 1px solid var(--glass-border); cursor: pointer;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.6rem;">
                                <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1);">
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--brand-blue);">receipt_long</span>
                                </div>
                                <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary); font-family: var(--font-titles);">Prezzi Finali</span>
                            </div>
                            <span class="material-icons-round" style="font-size: 1rem; color: var(--text-tertiary); opacity: 0.5;">edit</span>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                            <!-- Prezzi section -->
                            <div>
                                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 0.05em; margin-bottom: 0.4rem;">Prezzi</div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #10b981; font-family: var(--font-titles); line-height: 1;">
                                    ${priceFinal > 0 ? formatAmount(priceFinal) + '€' : '—'}
                                </div>
                                ${(() => {
            const delta = servicesPrice > 0 ? Math.round(((priceFinal - servicesPrice) / servicesPrice) * 100) : 0;
            if (delta === 0) return '';
            return `
                                        <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: ${delta < 0 ? '#ef4444' : '#10b981'}; font-weight: 600; margin-top: 0.6rem;">
                                            <span class="material-icons-round" style="font-size: 1rem;">${delta < 0 ? 'arrow_downward' : 'arrow_upward'}</span>
                                            <span>${delta > 0 ? '+' : ''}${delta}% vs tariffario</span>
                                        </div>
                                    `;
        })()}
                            </div>

                            <div style="height: 1px; background: var(--glass-border); opacity: 0.6;"></div>

                            <!-- Costi section -->
                            <div>
                                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-tertiary); font-weight: 700; letter-spacing: 0.05em; margin-bottom: 0.4rem;">Costi</div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #ef4444; font-family: var(--font-titles); line-height: 1;">
                                    ${costFinal > 0 ? formatAmount(costFinal) + '€' : '—'}
                                </div>
                                ${(() => {
            const delta = servicesCost > 0 ? Math.round(((costFinal - servicesCost) / servicesCost) * 100) : 0;
            if (delta === 0) return '';
            return `
                                        <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: ${delta > 0 ? '#ef4444' : '#10b981'}; font-weight: 600; margin-top: 0.6rem;">
                                            <span class="material-icons-round" style="font-size: 1rem;">${delta > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                                            <span>${delta > 0 ? '+' : ''}${delta}% vs tariffario</span>
                                        </div>
                                    `;
        })()}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Scenarios Section -->
                    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem; padding: 0 0.5rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase;">Scenari / Taglie dell'Offerta</span>
                            <button onclick="window.openAddSapVariantModal('${service.id}')" style="background:none; border:none; color:var(--brand-blue); font-size:0.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:0.25rem;">
                                <span class="material-icons-round" style="font-size:1rem;">add</span> Aggiungi
                            </button>
                        </div>

                        ${['base', ...(service.variations || []).map(v => v.id)].map(vId => {
            const isBase = vId === 'base';
            const vName = isBase ? 'Servizio Base' : (service.variations.find(v => v.id === vId)?.name || vId);
            const isActive = isBase ? !selectedVariant : selectedVariant === vId;
            const spData = isBase ? spacesWithData.find(s => !s.variant_name) : spacesWithData.find(s => s.variant_name === vId);

            return `
                            <div class="variant-summary-card ${isActive ? 'active' : ''}" 
                                 onclick="window.switchSapVariant('${isBase ? 'base' : vId}')"
                                 style="padding: 1rem 1.25rem; background: ${isActive ? 'white' : 'var(--bg-tertiary)'}; border: 1px solid ${isActive ? 'var(--brand-blue)' : 'var(--glass-border)'}; border-radius: 20px; cursor: pointer; transition: all 0.2s; box-shadow: ${isActive ? 'var(--shadow-md)' : 'none'}; display: flex; flex-direction: column; gap: 0.6rem; position: relative;">
                                
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span class="material-icons-round" style="font-size: 1.1rem; color: ${isActive ? 'var(--brand-blue)' : 'var(--text-secondary)'};">construction</span>
                                        <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); font-family: var(--font-titles);">${vName}</span>
                                    </div>
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">${isActive ? 'expand_less' : 'expand_more'}</span>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Prezzo da Tariffario</span>
                                    <span style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles);">${formatAmount(spData?.totalCatalogPrice || 0)}€</span>
                                </div>

                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.65rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Costi da Tariffario</span>
                                    <span style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles);">${formatAmount(spData?.totalCatalogCost || 0)}€</span>
                                </div>

                                ${isActive ? `
                                    <div class="servizi-details" style="margin-top: 1rem; border-top: 1px dashed var(--glass-border); padding-top: 1rem; cursor: default;" onclick="event.stopPropagation();">
                                        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                                            ${items.length === 0 ? `
                                                <div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem; background: var(--bg-secondary); border-radius: 12px; border: 1px dashed var(--glass-border);">Nessun servizio inserito</div>
                                            ` : items.map(item => `
                                                <div style="padding: 0.6rem; background: var(--bg-secondary); border-radius: 10px; border: 1px solid var(--glass-border); cursor: pointer; display: flex; align-items: center; justify-content: space-between;" onclick="window.openSapItemModal('${item.id}', '${space.id}')">
                                                    <div style="flex: 1;">
                                                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.15rem;">${item.title}</div>
                                                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: var(--text-tertiary);">
                                                            <span>${item.quantity || 1} x ${formatAmount(item.price || 0)}€</span>
                                                            <span style="font-weight: 700; color: #ef4444;">${formatAmount((item.catalog_cost || item.cost) * (item.quantity || 1))}€</span>
                                                        </div>
                                                    </div>
                                                    <div style="display: flex; gap: 0.3rem; margin-left: 0.5rem;">
                                                        <button onclick="event.stopPropagation(); window.openSapItemModal('${item.id}', '${space.id}')" class="icon-btn sm" style="background: white;"><span class="material-icons-round" style="font-size: 1rem;">edit</span></button>
                                                        <button onclick="event.stopPropagation(); window.deleteSapItemHandler('${item.id}', '${space.id}')" class="icon-btn sm danger" style="background: rgba(239, 68, 68, 0.05);"><span class="material-icons-round" style="font-size: 1rem;">delete</span></button>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                        
                                        <button onclick="window.openSapItemModal(null, '${space.id}')" style="width: 100%; border: none; background: var(--brand-gradient); color: white; font-size: 0.75rem; font-weight: 700; padding: 0.75rem; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(var(--brand-blue-rgb), 0.2);">
                                            <span class="material-icons-round" style="font-size: 1rem;">add</span>
                                            <span>Aggiungi Servizio</span>
                                        </button>

                                        <div style="padding-top: 0.75rem; border-top: 1px dashed var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--brand-blue); text-transform: uppercase;">Valore Scenario</div>
                                            <div style="font-size: 1.1rem; font-weight: 900; color: var(--brand-blue);">${formatAmount(priceFinal)}€</div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- WINDOW MODALS & ACTIONS ---

window.switchSapVariant = (variantName) => {
    state.currentSapVariant = (variantName === 'base' || variantName === null) ? null : variantName;
    const contentArea = document.getElementById('content-area');
    if (contentArea) renderSapServiceDetail(contentArea, state.currentSapServiceId);
};

window.openAddSapVariantModal = (serviceId) => {
    const modalId = 'add-sap-variant-modal';
    let modalEl = document.getElementById(modalId);
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal';
        document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
        <div class="modal-content" style="max-width: 400px; padding: 1.5rem; background: var(--card-bg); border-radius: 16px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl);">
            <h3 style="margin: 0 0 1rem 0; font-family: var(--font-titles); font-weight: 700; color: var(--text-primary);">Nuovo Scenario / Taglia</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Inserisci un nome (es. Small, Pro, Enterprise...)</p>
            <div class="form-group" style="margin-bottom: 1.5rem;">
                <input type="text" id="new-variant-name" placeholder="Nome..." 
                       style="width: 100%; padding: 0.75rem; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--bg-color); color: var(--text-primary); font-weight: 600;">
            </div>
            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" class="primary-btn secondary" onclick="document.getElementById('${modalId}').classList.remove('active')" style="padding: 0.6rem 1rem; font-size: 0.85rem;">Annulla</button>
                <button type="button" class="primary-btn" id="save-new-variant-btn" style="padding: 0.6rem 1.5rem; font-size: 0.85rem; background: var(--brand-gradient); border: none; color: white;">Crea</button>
            </div>
        </div>
    `;

    modalEl.classList.add('active');
    setTimeout(() => { document.getElementById('new-variant-name').focus(); }, 100);

    document.getElementById('save-new-variant-btn').onclick = async () => {
        const name = document.getElementById('new-variant-name').value.trim();
        if (!name) return;
        const service = state.sapServices.find(s => s.id === serviceId);
        const variations = service.variations || [];
        const id = name.toLowerCase().replace(/\s+/g, '_');
        if (variations.find(v => v.id === id)) {
            alert("Esiste già.");
            return;
        }
        variations.push({ id, name });
        await supabase.from('core_services').update({ variations }).eq('id', serviceId);
        service.variations = variations;
        state.currentSapVariant = id;
        modalEl.classList.remove('active');
        renderSapServiceDetail(document.getElementById('content-area'), serviceId);
    };
};

window.openSapServiceDocsModal = async (spaceId) => {
    if (!spaceId || spaceId === 'undefined') {
        alert('Spazio PM non trovato.');
        return;
    }
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1200px; width: 95vw; height: 92vh; padding: 0; display: flex; flex-direction: column; overflow: hidden; position: relative;">
            <div style="padding: 1.5rem; background: white; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center; z-index: 10;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);">
                        <span class="material-icons-round" style="font-size: 24px;">edit_note</span>
                    </div>
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-titles); letter-spacing: -0.02em;">Documentazione Servizio</h2>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); font-weight: 500;">Note, file ed editor collaborativo</div>
                    </div>
                </div>
                <button class="close-modal material-icons-round" onclick="this.closest('.modal').remove()" style="background: var(--surface-1); border:none; cursor:pointer; color:var(--text-tertiary); display:flex; align-items:center; padding: 10px; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.background='var(--surface-2)'; this.style.color='var(--text-primary)'" onmouseout="this.style.background='var(--surface-1)'; this.style.color='var(--text-tertiary)'">
                    close
                </button>
            </div>
            <div id="modal-docs-container" style="flex: 1; position: relative; overflow: hidden; background: white;">
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary);">
                    <span class="loader"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('active');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    try {
        const docsContainer = modal.querySelector('#modal-docs-container');
        const { renderDocsView } = await import('./docs/DocsView.js?v=421');
        await renderDocsView(docsContainer, spaceId);
    } catch (err) {
        console.error("Error loading Docs Modal:", err);
        modal.querySelector('#modal-docs-container').innerHTML = `<div style="padding: 2rem; color: #ef4444;">Errore nel caricamento del modulo documentazione: ${err.message}</div>`;
    }
};

window.openSapServiceActivitiesModal = async (spaceId) => {
    if (!spaceId || spaceId === 'undefined') {
        alert('Spazio PM non trovato.');
        return;
    }
    const { openAccountActivitiesModal } = await import('./pm/components/AccountActivitiesModal.js?v=2');
    await openAccountActivitiesModal(null, spaceId);
};

window.openSapServiceCloudResourcesModal = async (serviceId) => {
    const service = state.sapServices.find(s => s.id === serviceId);
    if (!service) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px; padding: 0; display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 1.5rem; background: white; border-bottom: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round">cloud_queue</span>
                    </div>
                    <div>
                        <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0; color: var(--text-primary);">Risorse Cloud</h2>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary);">Link a Drive, Dropbox e altro</div>
                    </div>
                </div>
                <button class="close-modal material-icons-round" onclick="this.closest('.modal').remove()" style="background:none; border:none; cursor:pointer; color:var(--text-tertiary);">close</button>
            </div>
            <div id="cloud-manager-container" style="padding: 1.5rem; max-height: 70vh; overflow-y: auto;"></div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('active');
    const container = modal.querySelector('#cloud-manager-container');
    new CloudLinksManager(container, service.cloud_links || [], async (updatedLinks) => {
        const { error } = await supabase.from('core_services').update({ cloud_links: updatedLinks }).eq('id', serviceId);
        if (error) {
            window.showAlert('Errore nel salvataggio dei link', 'error');
        } else {
            service.cloud_links = updatedLinks;
        }
    });
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

// --- MULTISELECT HELPER ---

function renderMultiselectDropdown(containerId, options, selectedIds, placeholder = 'Seleziona...', onSelectionChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const selectedNames = options.filter(o => selectedIds.includes(o.id)).map(o => o.name);
    const triggerText = selectedNames.length > 0 ? selectedNames.join(', ') : placeholder;
    const triggerClass = selectedNames.length > 0 ? 'text-primary' : 'text-secondary';
    container.innerHTML = `
        <div class="custom-select-wrapper" id="${containerId}-wrapper">
            <div class="custom-select-trigger" onclick="window.toggleDropdown('${containerId}')">
                <span class="${triggerClass}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 1rem;">${triggerText}</span>
                <span class="custom-select-arrow material-icons-round">expand_more</span>
            </div>
            <div class="custom-options" id="${containerId}-options">
                ${options.map(opt => `
                    <label class="custom-option" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem;">
                        <input type="checkbox" value="${opt.id}" ${selectedIds.includes(opt.id) ? 'checked' : ''} style="width: 16px; height: 16px; margin: 0; accent-color: var(--brand-blue);" data-name="${opt.name}">
                        <span>${opt.name}</span>
                    </label>
                `).join('')}
                ${containerId.includes('area') ? `
                    <div style="padding: 0.5rem; border-top: 1px solid var(--glass-border); display: flex; gap: 0.5rem;">
                         <input type="text" id="${containerId}-new-input" placeholder="Nuova..." style="flex:1; padding: 0.4rem; font-size: 0.85rem; border: 1px solid var(--glass-border); border-radius: 6px;">
                         <button type="button" class="primary-btn secondary" id="${containerId}-add-btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Add</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    if (!window[`${containerId}-listener`]) {
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById(`${containerId}-wrapper`);
            if (wrapper && !wrapper.contains(e.target)) wrapper.classList.remove('open');
        });
        window[`${containerId}-listener`] = true;
    }
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const newSelected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
            const newNames = options.filter(o => newSelected.includes(o.id)).map(o => o.name);
            const trigger = container.querySelector('.custom-select-trigger span');
            trigger.textContent = newNames.length > 0 ? newNames.join(', ') : placeholder;
            trigger.className = newNames.length > 0 ? 'text-primary' : 'text-secondary';
            if (onSelectionChange) onSelectionChange(newSelected);
        });
    });
    const addBtn = document.getElementById(`${containerId}-add-btn`);
    if (addBtn) {
        addBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const input = document.getElementById(`${containerId}-new-input`);
            const name = input.value.trim();
            if (!name) return;
            try {
                const newArea = await upsertSapServiceArea(name);
                input.value = '';
                const newOptions = [...options, newArea];
                const currentSel = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
                renderMultiselectDropdown(containerId, newOptions, currentSel, placeholder, onSelectionChange);
                document.getElementById(`${containerId}-wrapper`).classList.add('open');
            } catch (e) { console.error(e); }
        });
    }
}

window.toggleDropdown = (id) => {
    const wrapper = document.getElementById(`${id}-wrapper`);
    if (wrapper) wrapper.classList.toggle('open');
};

// --- SAP SERVICE MODAL (CREATE/EDIT) ---

export function openSapServiceModal(serviceId = null) {
    const service = serviceId ? state.sapServices.find(s => s.id === serviceId) : null;
    const modalId = 'sap-service-modal';
    let modalEl = document.getElementById(modalId);
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal';
        document.body.appendChild(modalEl);
    }
    modalEl.innerHTML = `
        <div class="modal-content" style="max-width: 600px; padding: 2rem;">
            <h2>${service ? 'Modifica' : 'Nuovo'} Servizio SAP</h2>
            <form id="sap-service-form">
                <div class="form-group">
                    <label>Nome Servizio</label>
                    <input type="text" name="name" value="${service?.name || ''}" required>
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Tipo Servizio</label>
                        <select name="type_id" required>
                             <option value="">Seleziona...</option>
                             ${state.sapServiceTypes.map(t => `<option value="${t.id}" ${service?.type_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Aree di Competenza</label>
                    <div id="service-areas-multiselect"></div>
                </div>
                <div class="form-group">
                    <label>Descrizione</label>
                    <textarea name="description" rows="3">${service?.description || ''}</textarea>
                </div>
                <div style="display:flex; gap:1rem; justify-content:flex-end; margin-top:2rem;">
                    <button type="button" class="secondary-btn" onclick="document.getElementById('${modalId}').classList.remove('active')">Annulla</button>
                    <button type="submit" class="primary-btn">Salva</button>
                </div>
            </form>
        </div>
    `;
    const selectedAreas = (service?.core_service_area_links || []).map(l => l.area_id);
    let currentSelectedAreas = [...selectedAreas];
    renderMultiselectDropdown('service-areas-multiselect', state.sapServiceAreas, selectedAreas, 'Seleziona aree...', (newIds) => { currentSelectedAreas = newIds; });
    modalEl.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.area_ids = currentSelectedAreas;
        try {
            await upsertSapService(serviceId, data);
            await fetchSapServices();
            renderSapServices(document.getElementById('content-area'));
            modalEl.classList.remove('active');
            window.showAlert('Servizio SAP salvato', 'success');
        } catch (err) { window.showAlert('Errore: ' + err.message, 'error'); }
    };
    modalEl.classList.add('active');
}



window.deleteSapItemHandler = async (itemId, spaceId) => {
    const confirmed = await window.showConfirm("Eliminare questo servizio?");
    if (!confirmed) return;
    try {
        await deletePMItem(itemId);
        renderSapServiceDetail(document.getElementById('content-area'), state.currentSapServiceId);
        window.showAlert("Servizio rimosso", "success");
    } catch (err) { window.showAlert("Errore: " + err.message, "error"); }
};

// --- SAP ITEM MODAL (PREMIUM REDESIGN) ---

window.toggleSapDropdown = (key, event) => {
    if (event) event.stopPropagation();
    const container = document.getElementById(`sap-item-${key}-container`);
    if (!container) return;

    const isOpen = container.classList.contains('open');

    // Close all others
    document.querySelectorAll('.sap-item-custom-select-container').forEach(c => c.classList.remove('open'));
    document.querySelectorAll('.sap-item-custom-select-options').forEach(o => o.style.display = 'none');

    if (!isOpen) {
        container.classList.add('open');
        const dropdown = document.getElementById(`sap-item-${key}-dropdown`);
        if (dropdown) {
            dropdown.style.display = 'block';
            const search = dropdown.querySelector('input');
            if (search) {
                search.value = '';
                search.focus();
                window.filterSapOptions(key, '');
            }
        }
    }
};

window.filterSapOptions = (key, term) => {
    const list = document.getElementById(`sap-item-${key}-options`);
    const options = list.querySelectorAll('.custom-option');
    const searchLower = (term || '').toLowerCase();

    let found = 0;
    options.forEach(opt => {
        const text = opt.textContent.toLowerCase();
        if (text.includes(searchLower)) {
            opt.style.display = 'flex';
            found++;
        } else {
            opt.style.display = 'none';
        }
    });

    const noResults = list.querySelector('.no-results');
    if (found === 0 && term) {
        if (!noResults) {
            list.insertAdjacentHTML('beforeend', `<div class="no-results" style="padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">Nessun risultato</div>`);
        }
    } else if (noResults) {
        noResults.remove();
    }
};

window.selectSapOption = (key, value, label, metadata = {}) => {
    const hidden = document.getElementById(`sap-item-hidden-${key}`);
    const labelEl = document.getElementById(`sap-item-${key}-label`);

    if (hidden) hidden.value = value;
    if (labelEl) {
        labelEl.textContent = label;
        labelEl.style.color = 'var(--text-primary)';
    }

    if (key === 'dept') {
        window.sapUpdateServiceList(value);
        window.selectSapOption('service', '', 'Seleziona un servizio...', {});
    } else if (key === 'service') {
        const { cost, price, type, desc } = metadata;
        document.getElementById('sap-item-title-input').value = label;
        document.getElementById('sap-item-notes-input').value = desc || '';
        document.getElementById('sap-item-unit-cost').value = cost || 0;
        document.getElementById('sap-item-unit-price').value = price || 0;
        document.getElementById('sap-item-catalog-price').value = price || 0;
        document.getElementById('sap-item-catalog-cost').value = cost || 0;

        const finalType = type || 'tariffa oraria';
        document.getElementById('sap-item-tariff-display').textContent = finalType;

        // Trigger calc
        const q = parseFloat(document.getElementById('sap-item-quantity').value) || 0;
        window.updateSapPreviews(q, cost || 0, price || 0);
    }

    const container = document.getElementById(`sap-item-${key}-container`);
    if (container) container.classList.remove('open');
    const dropdown = document.getElementById(`sap-item-${key}-dropdown`);
    if (dropdown) dropdown.style.display = 'none';
};

window.sapUpdateServiceList = (dept) => {
    const optionsList = document.getElementById('sap-item-service-options');
    const trigger = document.getElementById('sap-item-service-trigger');

    if (!dept) {
        optionsList.innerHTML = '';
        trigger.style.opacity = '0.6';
        trigger.style.pointerEvents = 'none';
        document.getElementById('sap-item-service-label').textContent = 'Seleziona prima un reparto';
        return;
    }

    const filteredServices = (state.services || []).filter(s => {
        const tags = Array.isArray(s.tags) ? s.tags : (typeof s.tags === 'string' ? s.tags.split(',') : []);
        return tags.includes(dept);
    }).sort((a, b) => a.name.localeCompare(b.name));

    trigger.style.opacity = '1';
    trigger.style.pointerEvents = 'auto';
    document.getElementById('sap-item-service-label').textContent = 'Seleziona un servizio...';

    if (filteredServices.length === 0) {
        optionsList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">Nessun servizio in questo reparto</div>';
    } else {
        optionsList.innerHTML = filteredServices.map(s => `
    <div class="custom-option" onclick="window.selectSapOption('service', '${s.id}', '${s.name.replace(/'/g, "\\'")}', { cost: ${s.cost || 0}, price: ${s.price || 0}, type: '${(s.type || '').replace(/'/g, "\\'")}', desc: '${(s.description || '').replace(/'/g, "\\'")}' })" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-radius: 10px; transition: all 0.2s; cursor:pointer;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(var(--brand-blue-rgb), 0.05); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
            <span class="material-icons-round" style="font-size: 1.1rem;">category</span>
        </div>
        <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 2px;">${s.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em;">${s.type || 'prestazione'}</div>
        </div>
    </div>
    `).join('');
    }
};

window.updateSapPreviews = (q, cost, price) => {
    const totalCost = q * cost;
    const totalRevenue = q * price;
    const totalMargin = totalRevenue - totalCost;
    document.getElementById('sap-item-total-cost-preview').textContent = formatAmount(totalCost);
    document.getElementById('sap-item-total-margin-preview').textContent = formatAmount(totalMargin);
};

window.openSapItemModal = async (itemId = null, spaceId) => {
    const items = window.currentSapItems || [];
    const item = itemId ? items.find(i => i.id === itemId) : null;

    if (!state.departments || state.departments.length === 0) await fetchDepartments();
    if (!state.services || state.services.length === 0) await fetchServices();

    const modalId = 'sap-item-edit-modal';
    let modalEl = document.getElementById(modalId);
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal';
        document.body.appendChild(modalEl);
    }

    modalEl.innerHTML = `
        <div class="modal-content" style="max-width: 580px; padding: 0; background: var(--card-bg); border-radius: 16px; overflow: visible; border: 1px solid var(--glass-border); box-shadow: 0 10px 40px rgba(0,0,0,0.2); position: relative; z-index: 1001;">
            <div class="modal-header" style="padding: 0.75rem 1.25rem; background: var(--bg-color); border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--brand-gradient); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(var(--brand-blue-rgb), 0.2);">
                        <span class="material-icons-round" style="color: white; font-size: 1.1rem;">edit_note</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${item ? 'Modifica' : 'Aggiungi'} Servizio</h2>
                </div>
                <button class="material-icons-round" onclick="document.getElementById('${modalId}').classList.remove('active')" style="background: none; border: none; padding: 0.4rem; cursor: pointer; color: var(--text-secondary);">close</button>
            </div>

            <form id="sap-item-edit-form" style="display: flex; flex-direction: column;">
                <div style="padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem;">
                    <input type="hidden" name="id" value="${item?.id || ''}">
                    <input type="hidden" name="space_ref" value="${spaceId}">
                    <input type="hidden" id="sap-item-title-input" name="title" value="${item?.title || ''}">
                    <input type="hidden" id="sap-item-notes-input" name="notes" value="${item?.notes || ''}">
                    <input type="hidden" id="sap-item-catalog-price" name="catalog_price" value="${item?.catalog_price || item?.price || 0}">
                    <input type="hidden" id="sap-item-catalog-cost" name="catalog_cost" value="${item?.catalog_cost || item?.cost || 0}">

                    <!-- Selection Section -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-secondary); font-weight: 600; font-size: 0.65rem; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.02em;">
                                <span class="material-icons-round" style="font-size: 0.85rem; color: var(--brand-blue);">business_center</span> Reparto
                            </label>
                            <div class="sap-item-custom-select-container" id="sap-item-dept-container" style="position: relative;">
                                <div class="custom-select-trigger" onclick="window.toggleSapDropdown('dept', event)" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer;">
                                    <span id="sap-item-dept-label" style="color: var(--text-primary); font-weight: 500; font-size: 0.8rem;">${item?.department || 'Seleziona...'}</span>
                                    <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                                    <input type="hidden" id="sap-item-hidden-dept" name="department" value="${item?.department || ''}">
                                </div>
                                <div class="sap-item-custom-select-options" id="sap-item-dept-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 2000; background: var(--card-bg); border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl); border-radius: 12px; backdrop-filter: blur(10px);">
                                    <div style="padding: 0.4rem; border-bottom: 1px solid var(--glass-border);">
                                        <input type="text" placeholder="Cerca..." oninput="window.filterSapOptions('dept', this.value)" style="padding: 0.4rem 0.6rem; font-size: 0.75rem; border-radius: 6px; width: 100%; border: 1px solid var(--glass-border); background: var(--bg-color); color: var(--text-primary);">
                                    </div>
                                     <div class="options-list" id="sap-item-dept-options" style="padding: 0.25rem; max-height: 160px; overflow-y: auto;">
                                        ${(state.departments || []).length === 0 ? `
                                            <div style="padding: 1rem; text-align: center; color: var(--text-tertiary); font-size: 0.8rem;">Nessun reparto trovato</div>
                                        ` : state.departments.map(d => `
                                            <div class="custom-option" onclick="window.selectSapOption('dept', '${d.name.replace(/'/g, "\\'")}', '${d.name.replace(/'/g, "\\'")}')" style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; border-radius: 10px; transition: all 0.2s; cursor:pointer;">
                                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(var(--brand-blue-rgb), 0.1); color: var(--brand-blue); display: flex; align-items: center; justify-content: center;">
                                                    <span class="material-icons-round" style="font-size: 1.1rem;">business_center</span>
                                                </div>
                                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${d.name}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-secondary); font-weight: 600; font-size: 0.65rem; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.02em;">
                            <span class="material-icons-round" style="font-size: 0.85rem; color: var(--brand-blue);">category</span> Servizio
                        </label>
                        <div class="sap-item-custom-select-container" id="sap-item-service-container" style="position: relative;">
                            <div class="custom-select-trigger" id="sap-item-service-trigger" onclick="window.toggleSapDropdown('service', event)" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer;">
                                <span id="sap-item-service-label" style="color: var(--text-primary); font-weight: 500; font-size: 0.8rem;">${item?.title || 'Seleziona prima un reparto'}</span>
                                <span class="material-icons-round" style="font-size: 1.1rem; color: var(--text-tertiary);">expand_more</span>
                                <input type="hidden" id="sap-item-hidden-service" name="catalog_service_ref" value="${item?.catalog_service_ref || ''}">
                            </div>
                            <div class="sap-item-custom-select-options" id="sap-item-service-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 2000; background: var(--card-bg); border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl); border-radius: 12px; backdrop-filter: blur(10px);">
                                <div style="padding: 0.4rem; border-bottom: 1px solid var(--glass-border);">
                                    <input type="text" placeholder="Cerca..." oninput="window.filterSapOptions('service', this.value)" style="padding: 0.4rem 0.6rem; font-size: 0.75rem; border-radius: 6px; width: 100%; border: 1px solid var(--glass-border); background: var(--bg-color); color: var(--text-primary);">
                                </div>
                                <div class="options-list" id="sap-item-service-options" style="padding: 0.25rem; max-height: 160px; overflow-y: auto;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Economic Details -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; background: var(--bg-color); padding: 0.85rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                        <div class="form-group">
                            <label style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Quantità</label>
                            <div style="position: relative;">
                                <span class="material-icons-round" style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--brand-blue);">layers</span>
                                <input type="number" id="sap-item-quantity" name="quantity" step="0.5" value="${item?.quantity || 1}" required style="padding: 0.4rem 0.6rem 0.4rem 2rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); width: 100%; font-weight: 600; font-size: 0.8rem;">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Costo Un. (€)</label>
                            <div style="position: relative;">
                                <span class="material-icons-round" style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--brand-blue);">payments</span>
                                <input type="number" id="sap-item-unit-cost" name="cost" step="0.01" value="${item?.cost || 0}" required style="padding: 0.4rem 0.6rem 0.4rem 2rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); width: 100%; font-weight: 600; font-size: 0.8rem;">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; display: block;">Prezzo Un. (€)</label>
                            <div style="position: relative;">
                                <span class="material-icons-round" style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); font-size: 0.9rem; color: var(--brand-blue);">sell</span>
                                <input type="number" id="sap-item-unit-price" name="price" step="0.01" value="${item?.price || 0}" required style="padding: 0.4rem 0.6rem 0.4rem 2rem; background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); width: 100%; font-weight: 600; font-size: 0.8rem;">
                            </div>
                        </div>
                    </div>

                    <!-- Result Card -->
                    <div style="background: var(--brand-gradient); padding: 1rem 1.25rem; border-radius: 12px; color: white;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: center;">
                            <div style="border-right: 1px solid rgba(255,255,255,0.2);">
                                <span style="font-size: 0.55rem; color: rgba(255,255,255,0.85); text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; display: block; margin-bottom: 0.3rem;">Piano Tariffario</span>
                                <div style="display: flex; align-items: center; gap: 0.4rem;">
                                    <span class="material-icons-round" style="font-size: 0.9rem; opacity: 0.8;">history_toggle_off</span>
                                    <span id="sap-item-tariff-display" style="font-weight: 700; color: white; font-size: 0.85rem;">-</span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 1.5rem; justify-content: space-around;">
                                <div>
                                    <span style="font-size: 0.55rem; color: rgba(255,255,255,0.85); font-weight: 800; text-transform: uppercase; display: block;">Costo Totale</span>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: white; margin-top: 0.1rem;"><span id="sap-item-total-cost-preview">0,00</span> €</div>
                                </div>
                                <div>
                                    <span style="font-size: 0.55rem; color: rgba(255,255,255,0.85); font-weight: 800; text-transform: uppercase; display: block;">Margine Totale</span>
                                    <div style="font-size: 1.1rem; font-weight: 800; color: white; margin-top: 0.1rem;"><span id="sap-item-total-margin-preview">0,00</span> €</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-actions" style="padding: 0.85rem 1.25rem; background: var(--bg-color); border-top: 1px solid var(--glass-border); display: flex; gap: 0.6rem; justify-content: flex-start;">
                    <button type="button" class="primary-btn secondary" onclick="document.getElementById('${modalId}').classList.remove('active')" style="border-radius: 8px; font-weight: 700; padding: 0.4rem 1.5rem; font-size: 0.8rem; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary);">Annulla</button>
                    <button type="submit" class="primary-btn" style="border-radius: 8px; font-weight: 800; padding: 0.4rem 2rem; font-size: 0.8rem; background: var(--brand-gradient); color: white; border: none; box-shadow: 0 4px 10px rgba(var(--brand-blue-rgb), 0.2);">Salva</button>
                </div>
            </form>
        </div>
    `;

    // Initialize UI if editing
    if (item?.department) {
        window.sapUpdateServiceList(item.department);
        if (item?.catalog_service_ref) {
            const sObj = state.services.find(s => s.id === item.catalog_service_ref);
            if (sObj) {
                modalEl.querySelector('#sap-item-tariff-display').textContent = sObj.type || 'prestazione';
            }
        }
    }

    // Attach local listeners
    ['sap-item-quantity', 'sap-item-unit-cost', 'sap-item-unit-price'].forEach(id => {
        modalEl.querySelector(`#${id}`).addEventListener('input', () => {
            const q = parseFloat(modalEl.querySelector('#sap-item-quantity').value) || 0;
            const c = parseFloat(modalEl.querySelector('#sap-item-unit-cost').value) || 0;
            const p = parseFloat(modalEl.querySelector('#sap-item-unit-price').value) || 0;
            window.updateSapPreviews(q, c, p);
        });
    });

    // Initial calc
    const initialQ = parseFloat(item?.quantity || 1);
    const initialC = parseFloat(item?.cost || 0);
    const initialP = parseFloat(item?.price || 0);
    window.updateSapPreviews(initialQ, initialC, initialP);

    modalEl.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.item_type = 'attivita';

        // Cleanup empty strings for UUID fields
        if (!data.catalog_service_ref) data.catalog_service_ref = null;
        if (!data.id) delete data.id;

        try {
            if (itemId && itemId !== '') {
                await updatePMItem(itemId, data);
            } else {
                delete data.id; // Ensure no empty ID on creation
                await createPMItem(data);
            }
            modalEl.classList.remove('active');
            renderSapServiceDetail(document.getElementById('content-area'), state.currentSapServiceId);
            window.showAlert('Salvato con successo', 'success');
        } catch (err) { window.showAlert('Errore: ' + err.message, 'error'); }
    };

    modalEl.classList.add('active');
};

// --- INITIALIZATION ---

export function initSapServiceModals() {
    window.openSapServiceModal = openSapServiceModal;
    window.renderSapServiceDetail = (id) => renderSapServiceDetail(document.getElementById('content-area'), id);

    // Global Click Listener for SAP Custom Selects
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sap-item-custom-select-container')) {
            document.querySelectorAll('.sap-item-custom-select-container').forEach(c => c.classList.remove('open'));
            document.querySelectorAll('.sap-item-custom-select-options').forEach(o => o.style.display = 'none');
        }
    });

    console.log("SAP Service Modals Initialized");
    initSapEconomicsModal();
}

window.editSapEconomics = async function (spaceId) {
    const { fetchSpace, fetchProjectItems } = await import('../modules/pm_api.js');
    const space = await fetchSpace(spaceId);
    if (!space) return;

    state.currentSapSpaceId = spaceId;
    const modalId = 'sap-economics-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        initSapEconomicsModal();
        modal = document.getElementById(modalId);
    }

    // Calculate sum from items as fallback/default
    const items = await fetchProjectItems(spaceId);
    const sumPrice = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    const sumCost = items.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.quantity) || 1), 0);

    document.getElementById('sap-eco-price').value = (space.price_final !== null && space.price_final !== undefined) ? space.price_final : sumPrice;
    document.getElementById('sap-eco-cost').value = (space.cost_final !== null && space.cost_final !== undefined) ? space.cost_final : sumCost;
    modal.classList.add('active');
};

function initSapEconomicsModal() {
    const id = 'sap-economics-modal';
    if (document.getElementById(id)) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="${id}" class="modal">
            <div class="modal-content" style="max-width: 450px; padding: 2rem; border-radius: 16px; border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl);">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: #10b981;">account_balance_wallet</span>
                    </div>
                    <h2 style="margin: 0; font-family: var(--font-titles); font-weight: 700;">Dati Economici Scenario</h2>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Prezzo Finale Scenario (€)</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #10b981;">trending_up</span>
                            <input type="number" id="sap-eco-price" class="modal-input" style="width: 100%; padding-left: 3rem; border-radius: 10px;" placeholder="0.00">
                        </div>
                        <p style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 0.4rem;">Sovrascrive la somma dei prezzi dei singoli prodotti.</p>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Costo Finale Scenario (€)</label>
                        <div style="position: relative;">
                            <span class="material-icons-round" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #ef4444;">trending_down</span>
                            <input type="number" id="sap-eco-cost" class="modal-input" style="width: 100%; padding-left: 3rem; border-radius: 10px;" placeholder="0.00">
                        </div>
                        <p style="font-size: 0.65rem; color: var(--text-tertiary); margin-top: 0.4rem;">Sovrascrive la somma dei costi dei singoli prodotti.</p>
                    </div>
                </div>

                <div class="flex-end" style="gap: 1rem;">
                    <button class="primary-btn secondary" onclick="document.getElementById('${id}').classList.remove('active')" style="padding: 0.8rem 1.5rem; border-radius: 10px;">Annulla</button>
                    <button class="primary-btn" id="btn-save-sap-economics" style="background: var(--brand-gradient); color: white; padding: 0.8rem 2rem; border-radius: 10px; border: none; font-weight: 700; cursor: pointer;">Salva Modifiche</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById('btn-save-sap-economics').addEventListener('click', async () => {
        const spaceId = state.currentSapSpaceId;
        const price = parseFloat(document.getElementById('sap-eco-price').value);
        const cost = parseFloat(document.getElementById('sap-eco-cost').value);

        try {
            const { updateSpace } = await import('../modules/pm_api.js');
            await updateSpace(spaceId, {
                price_final: isNaN(price) ? null : price,
                cost_final: isNaN(cost) ? null : cost
            });

            window.showAlert('Dati economici aggiornati', 'success');
            document.getElementById(id).classList.remove('active');
            window.renderSapServiceDetail(state.currentSapServiceId);
        } catch (e) {
            console.error(e);
            window.showAlert('Errore nel salvataggio', 'error');
        }
    });
}
