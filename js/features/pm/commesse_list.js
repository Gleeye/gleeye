import { fetchOrders, fetchCollaborators } from '../../modules/api.js?v=317';
import { state } from '../../modules/state.js?v=317';
import { fetchProjectSpaceForOrder, fetchCommesseTeamSummary } from '../../modules/pm_api.js?v=317';

// Real status values from "Stato Lavori" multiselect
const STATUS_CONFIG = {
    'in_svolgimento': { label: 'In Svolgimento', color: '#3b82f6', bg: '#eff6ff' },
    'lavoro_in_attesa': { label: 'Lavoro in Attesa', color: '#f59e0b', bg: '#fffbeb' },
    'finito_da_fatturare': { label: 'Finito da Fatturare', color: '#8b5cf6', bg: '#f5f3ff' },
    'completato': { label: 'Completato', color: '#10b981', bg: '#ecfdf5' },
    'contratto_da_inviare': { label: 'Contratto da Inviare', color: '#64748b', bg: '#f1f5f9' },
    'altro': { label: 'Altro', color: '#64748b', bg: '#f1f5f9' }
};

function normalizeStatus(status) {
    if (!status) return 'altro';
    const s = status.toLowerCase().trim().replace(/_/g, ' ');
    if (s.includes('svolgimento') || s.includes('in corso')) return 'in_svolgimento';
    if (s.includes('attesa')) return 'lavoro_in_attesa';
    if (s.includes('fatturare') || s.includes('finito')) return 'finito_da_fatturare';
    if (s.includes('completato')) return 'completato';
    if (s.includes('contratto')) return 'contratto_da_inviare';
    return 'altro';
}

export async function renderCommesseList(container) {
    try {
        // --- STATE MANAGEMENT ---
        let currentFilter = 'in_svolgimento';
        let searchTerm = '';
        let allProjects = [];
        let teamSummary = {};

        // --- 1. INITIAL LAYOUT (Skeleton) ---
        container.innerHTML = `
            <div class="dashboard-container" style="padding: 2rem; max-width: 1600px; margin: 0 auto; min-height: 100vh; background: var(--surface-1); display: flex; flex-direction: column;">
                
                <!-- Header -->
                <div class="header-section" style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; background: white; padding: 1.5rem 2rem; border-radius: 16px; border: 1px solid var(--surface-2); box-shadow: var(--shadow-sm);">
                    <div>
                        <h1 style="font-size: 1.75rem; margin-bottom: 0.25rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em;">Dashboard Commesse</h1>
                        <p style="color: var(--text-secondary); font-size: 0.95rem;">Monitoraggio operativo e team attivi.</p>
                    </div>
                    
                    <div class="search-wrapper" style="position: relative;">
                        <span class="material-icons-round" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">search</span>
                        <input type="text" id="project-search" placeholder="Cerca progetto o cliente..." 
                            style="
                                padding: 0.75rem 1rem 0.75rem 3rem; 
                                border-radius: 12px; 
                                border: 1px solid var(--surface-2); 
                                background: var(--surface-1);
                                min-width: 300px;
                                font-size: 0.9rem;
                                transition: all 0.2s;
                                box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                            "
                        >
                    </div>
                </div>

                <!-- Stats / Filters Row -->
                <div class="stats-grid" id="stats-grid" style="
                    display: grid; 
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
                    gap: 1.25rem; 
                    margin-bottom: 2.5rem; 
                    min-height: 110px;
                ">
                    <div class="shimmer" style="height: 100px; border-radius: 16px;"></div>
                    <div class="shimmer" style="height: 100px; border-radius: 16px;"></div>
                    <div class="shimmer" style="height: 100px; border-radius: 16px;"></div>
                    <div class="shimmer" style="height: 100px; border-radius: 16px;"></div>
                    <div class="shimmer" style="height: 100px; border-radius: 16px;"></div>
                    <div class="shimmer" style="height: 100px; border-radius: 16px;"></div>
                </div>

                <!-- Grid -->
                <div id="projects-grid" style="
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); 
                    gap: 1.5rem; 
                    padding-bottom: 3rem; 
                    flex: 1;
                    align-content: start;
                ">
                    <div style="grid-column: 1/-1; display:flex; justify-content:center; padding-top: 5rem;">
                        <span class="loader"></span>
                    </div>
                </div>
            </div>
        `;

        // --- 2. DATA FETCHING ---
        const fetchPromises = [];
        let teamSummaryIdx = -1;

        if (!state.orders || state.orders.length === 0) fetchPromises.push(fetchOrders());
        if (!state.collaborators || state.collaborators.length === 0) fetchPromises.push(fetchCollaborators());

        teamSummaryIdx = fetchPromises.length;
        fetchPromises.push(fetchCommesseTeamSummary());

        const results = await Promise.all(fetchPromises);
        teamSummary = results[teamSummaryIdx] || {};

        // --- 3. PROCESS DATA ---
        allProjects = (state.orders || []).filter(o => {
            const s = (o.offer_status || '').toLowerCase();
            return s.includes('accettat') || s === 'vinta' || s === 'accettata';
        });

        // Sort: Active > Done, then Date Desc
        allProjects.sort((a, b) => {
            const statA = normalizeStatus(a.status_works);
            const statB = normalizeStatus(b.status_works);
            const isDoneA = statA === 'completato' || statA === 'finito_da_fatturare';
            const isDoneB = statB === 'completato' || statB === 'finito_da_fatturare';

            if (isDoneA && !isDoneB) return 1;
            if (!isDoneA && isDoneB) return -1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        // Calculate Stats
        const stats = {
            total: allProjects.length,
            in_svolgimento: 0,
            lavoro_in_attesa: 0,
            finito_da_fatturare: 0,
            completato: 0,
            contratto_da_inviare: 0,
            altro: 0
        };

        allProjects.forEach(p => {
            const n = normalizeStatus(p.status_works);
            if (stats[n] !== undefined) stats[n]++;
            else stats.altro++;
        });

        // --- 4. RENDER HELPERS ---

        const renderFilters = () => {
            const filterContainer = container.querySelector('#stats-grid');
            if (!filterContainer) return;

            const tabConfig = [
                { key: 'in_svolgimento', label: 'In Svolgimento', count: stats.in_svolgimento, color: '#3b82f6' },
                { key: 'lavoro_in_attesa', label: 'In Attesa', count: stats.lavoro_in_attesa, color: '#f59e0b' },
                { key: 'completato', label: 'Completati', count: stats.completato, color: '#10b981' },
                { key: 'finito_da_fatturare', label: 'Da Fatturare', count: stats.finito_da_fatturare, color: '#8b5cf6' },
                { key: 'contratto_da_inviare', label: 'Contratto da Inviare', count: stats.contratto_da_inviare, color: '#64748b' }
            ];

            // Add 'Altro' only if non-zero
            if (stats.altro > 0) {
                tabConfig.push({ key: 'altro', label: 'Altro', count: stats.altro, color: '#94a3b8' });
            }

            // Always add 'All'
            tabConfig.push({ key: 'all', label: 'Tutti', count: stats.total, color: '#64748b' });

            filterContainer.innerHTML = tabConfig.map(t => {
                const isActive = t.key === currentFilter;
                const border = isActive ? `2.5px solid ${t.color}` : '1px solid var(--surface-2)';
                const bg = '#ffffff';
                const shadow = isActive ? '0 12px 20px -8px rgba(0, 0, 0, 0.15)' : 'var(--shadow-sm)';
                const opacity = isActive ? '1' : '0.75';
                const scale = isActive ? 'scale(1.02)' : 'scale(1)';

                return `
                    <div class="stat-card" data-filter="${t.key}" style="
                        padding: 1.25rem; 
                        border-radius: 16px; 
                        border: ${border};
                        background: ${bg};
                        box-shadow: ${shadow};
                        cursor: pointer;
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex; flex-direction: column; justify-content: space-between;
                        opacity: ${opacity};
                        transform: ${scale};
                        min-height: 100px;
                        position: relative;
                        overflow: hidden;
                    ">
                        ${isActive ? `<div style="position:absolute; left:0; top:0; bottom:0; width:5px; background:${t.color};"></div>` : ''}
                        
                        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">
                            ${t.label}
                        </div>
                        <div style="font-size: 2rem; font-weight: 850; color: var(--text-main); line-height: 1; margin-top: 8px;">
                            ${t.count}
                        </div>
                    </div>
                `;
            }).join('');

            // Attach Listeners
            filterContainer.querySelectorAll('.stat-card').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentFilter = btn.dataset.filter;
                    renderFilters();
                    renderGrid();
                });
            });
        };

        const renderGrid = () => {
            const grid = container.querySelector('#projects-grid');
            if (!grid) return;

            const filtered = allProjects.filter(p => {
                const sTerm = searchTerm.toLowerCase();
                const matchSearch = (p.title || '').toLowerCase().includes(sTerm) ||
                    (p.order_number || '').toLowerCase().includes(sTerm) ||
                    (p.clients?.business_name || '').toLowerCase().includes(sTerm);

                if (!matchSearch) return false;
                if (currentFilter === 'all') return true;
                return normalizeStatus(p.status_works) === currentFilter;
            });

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-secondary);">
                        <span class="material-icons-round" style="font-size: 3rem; opacity: 0.3;">filter_list_off</span>
                        <p>Nessun progetto trovato.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = filtered.map(order => {
                const normalized = normalizeStatus(order.status_works);
                const config = STATUS_CONFIG[normalized] || STATUS_CONFIG['altro'];

                // Team Data
                const team = teamSummary[order.id] || [];
                const activeTeam = team.slice(0, 4);
                const remaining = team.length - 4;
                const dateLabel = new Date(order.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

                return `
                    <div class="glass-card project-card hover-lift" data-id="${order.id}" style="
                        padding: 0; border-radius: 16px; overflow: hidden; 
                        display: flex; flex-direction: column; cursor: pointer; 
                        transition: all 0.2s ease; background: white; border: 1px solid var(--surface-2);
                    ">
                        <div style="padding: 1.5rem; flex: 1; display: flex; flex-direction: column; gap: 1rem;">
                            <!-- Header -->
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div class="status-pill" style="
                                    background: ${config.bg}; color: ${config.color};
                                    font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 12px;
                                    display: inline-flex; align-items: center; gap: 4px;
                                ">
                                    <span style="width: 6px; height: 6px; border-radius: 50%; background: ${config.color}"></span>
                                    ${config.label}
                                </div>
                                <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-tertiary); background: var(--surface-1); padding: 2px 6px; border-radius: 4px;">
                                    ${order.order_number}
                                </span>
                            </div>

                            <!-- Title -->
                            <div>
                                <h3 style="
                                    font-size: 1.15rem; font-weight: 700; color: var(--text-main); 
                                    line-height: 1.4; margin: 0 0 0.25rem 0;
                                    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
                                ">${order.title || 'Senza Titolo'}</h3>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                                    <span class="material-icons-round" style="font-size: 14px;">business</span>
                                    ${order.clients?.business_name || 'Cliente Sconosciuto'}
                                </div>
                            </div>

                            <!-- Team -->
                            <div style="margin-top: auto; padding-top: 0.5rem;">
                                <div style="display: flex; align-items: center;">
                                    ${activeTeam.length > 0 ? activeTeam.map((member, i) => `
                                        <div title="${member.role === 'pm' ? 'PM: ' : ''}${member.name}" style="
                                            width: 32px; height: 32px; border-radius: 50%; 
                                            background: white; border: 2px solid white; 
                                            margin-left: ${i === 0 ? 0 : '-10px'};
                                            position: relative; z-index: ${10 - i};
                                            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                                            display: flex; align-items: center; justify-content: center;
                                            font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);
                                            background-color: var(--surface-2);
                                        ">
                                            ${member.avatar ? `<img src="${member.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : member.initials}
                                        </div>
                                    `).join('') : `
                                        <div style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">Nessun team attivo</div>
                                    `}
                                    ${remaining > 0 ? `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--surface-2); border: 2px solid white; margin-left: -10px; z-index: 0; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">+${remaining}</div>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="padding: 1rem 1.5rem; background: var(--surface-1); border-top: 1px solid var(--surface-2); display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 0.7rem; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Data</span>
                                <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary);">${dateLabel}</span>
                            </div>
                            <button class="icon-btn-mini" style="width: 32px; height: 32px; border-radius: 50%; background: white; border: 1px solid var(--surface-2); color: var(--text-main); display: flex; align-items: center; justify-content: center;">
                                <span class="material-icons-round" style="font-size: 1.1rem;">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Card Listeners
            grid.querySelectorAll('.project-card').forEach(card => {
                card.addEventListener('click', () => window.location.hash = `#pm/commessa/${card.dataset.id}`);
            });
        };

        // --- 5. INITIAL RENDER CALLS ---
        renderFilters();
        renderGrid();

        // Search Listener
        const sInput = container.querySelector('#project-search');
        if (sInput) {
            sInput.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                renderGrid();
            });
        }

    } catch (globalError) {
        console.error("Critical error in renderCommesseList:", globalError);
        container.innerHTML = `<div style="padding:2rem; color:red">Critico: ${globalError.message}</div>`;
    }
}
