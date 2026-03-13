import { fetchOrders, fetchCollaborators } from '../../modules/api.js';
import { state } from '../../modules/state.js';
import { fetchProjectSpaceForOrder, fetchCommesseTeamSummary } from '../../modules/pm_api.js';
import { formatAmount } from '../../modules/utils.js';

// Real status values for PM view
const STATUS_CONFIG = {
    'in_svolgimento': { label: 'In Svolgimento', color: '#3b82f6', bg: '#eff6ff', icon: 'play_circle' },
    'lavoro_in_attesa': { label: 'In Attesa', color: '#f59e0b', bg: '#fffbeb', icon: 'hourglass_empty' },
    'in_pausa': { label: 'In Pausa', color: '#64748b', bg: '#f1f5f9', icon: 'pause_circle' },
    'manutenzione': { label: 'Ongoing', color: '#06b6d4', bg: '#ecfeff', icon: 'published_with_changes' },
    'completato': { label: 'Completato', color: '#10b981', bg: '#ecfdf5', icon: 'check_circle' }
};

function normalizeStatus(status) {
    if (!status) return 'altro';
    const s = status.toLowerCase().trim().replace(/_/g, ' ');
    if (s.includes('completato') || s.includes('concluso') || s.includes('finito')) return 'completato';
    if (s.includes('pausa') || s.includes('sospeso')) return 'in_pausa';
    if (s.includes('manutenzione') || s.includes('assistenza')) return 'manutenzione';
    if (s.includes('svolgimento') || s.includes('in corso')) return 'in_svolgimento';
    if (s.includes('attesa')) return 'lavoro_in_attesa';
    return 'altro';
}

export async function renderCommesseList(container) {
    console.log("[CommesseList] Starting render...");
    container.innerHTML = '<div style="padding:4rem; text-align:center;"><span class="loader"></span> Caricamento Dashboard Commesse...</div>';

    try {
        // --- 1. DATA FETCHING ---
        const fetchPromises = [];
        if (!state.orders || state.orders.length === 0) fetchPromises.push(fetchOrders());
        if (!state.collaborators || state.collaborators.length === 0) fetchPromises.push(fetchCollaborators());
        fetchPromises.push(fetchCommesseTeamSummary());

        const results = await Promise.all(fetchPromises);
        const teamSummary = results[results.length - 1] || {};

        const allProjects = (state.orders || []).filter(o => {
            const s = (o.offer_status || '').toLowerCase();
            return s.includes('accettat') || s === 'vinta' || s === 'accettata';
        });

        // Current internal filters
        let activeStatusFilter = null; // null means "Tutte" conceptually but handled by the cards
        let activeYearFilter = null;
        let activeClientFilter = null;
        let searchTerm = '';

        // Derive unique filters for dropdowns
        const uniqueYears = [...new Set(allProjects.map(o => o.created_at ? new Date(o.created_at).getFullYear() : null).filter(y => y))].sort((a, b) => b - a);
        const uniqueClients = [...new Set(allProjects.map(o => o.clients?.business_name || 'N/D').filter(c => c))].sort();

        // --- 2. SETUP UI SHELL ---
        container.innerHTML = `
            <style>
                .pm-dashboard-root {
                    padding: 1.5rem;
                    max-width: 1600px;
                    margin: 0 auto;
                    width: 100%;
                    box-sizing: border-box;
                    overflow-x: hidden;
                }

                .pm-main-grid {
                    display: grid;
                    grid-template-columns: 360px 1fr;
                    gap: 2rem;
                    align-items: start;
                }

                .pm-summary-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.25rem;
                    margin-bottom: 2rem;
                }

                .pm-card {
                    background: white;
                    border-radius: 16px;
                    padding: 1.25rem;
                    border: 1px solid var(--glass-border);
                    box-shadow: var(--shadow-sm);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border-left: 4px solid transparent;
                    position: relative;
                    overflow: hidden;
                }
                .pm-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
                .pm-card.active { border-color: var(--brand-viola); background: rgba(97, 74, 162, 0.02); }

                .pm-filter-bar {
                    padding: 1rem 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    background: #fcfcfd;
                    border-bottom: 1px solid var(--glass-border);
                }

                .pm-dropdown {
                    position: relative;
                }

                .pm-dropdown-trigger {
                    width: 100%;
                    padding: 0.6rem 0.85rem;
                    background: white;
                    border: 1px solid var(--glass-border);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .pm-dropdown-trigger:hover { border-color: var(--brand-viola); }
                .pm-dropdown-trigger.active { color: var(--brand-viola); font-weight: 700; border-color: var(--brand-viola); }

                .pm-dropdown-menu {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    min-width: 180px;
                    background: white;
                    border: 1px solid var(--glass-border);
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    z-index: 100;
                    display: none;
                    max-height: 250px;
                    overflow-y: auto;
                    padding: 6px;
                    margin-top: 6px;
                }

                .pm-dropdown-item {
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    color: var(--text-primary);
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .pm-dropdown-item:hover { background: var(--bg-secondary); }
                .pm-dropdown-item.selected { background: rgba(97, 74, 162, 0.05); color: var(--brand-viola); font-weight: 700; }

                /* Mobile overrides - Matching dashboard.js */
                @media (max-width: 1100px) {
                    .pm-main-grid { grid-template-columns: 1fr !important; }
                    .pm-sidebar-col { order: 1; margin-bottom: 2rem; }
                    .pm-main-col { order: 2; }
                    .pm-summary-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem; }
                    .pm-card { padding: 0.75rem 0.25rem !important; text-align: center; border-left-width: 3px !important; }
                    .pm-card .material-icons-round { margin: 0 auto 0.25rem !important; font-size: 1.1rem !important; }
                    .pm-card div[style*="font-size: 0.65rem"] { font-size: 0.55rem !important; line-height: 1.1; }
                    .pm-card .card-count { font-size: 1rem !important; margin: 2px 0 !important; }
                }

                @media (max-width: 768px) {
                    .pm-dashboard-root { padding: 0.75rem !important; }
                    .pm-summary-grid { 
                        grid-template-columns: repeat(3, 1fr) !important; 
                        gap: 0.5rem !important; 
                        margin-bottom: 2rem !important; 
                    }
                    
                    .pm-card { 
                        padding: 1rem 0.25rem 0.75rem 0.25rem !important; 
                        min-height: 120px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: flex-start !important;
                        text-align: center !important;
                        border-radius: 12px !important;
                        position: relative;
                        overflow: visible !important;
                    }

                    /* Content Wrapper */
                    .pm-card > div:first-child { 
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: flex-start !important;
                        width: 100% !important;
                        gap: 0px !important;
                        margin: 0 !important;
                    }

                    /* Icon - Move to TOP, restore background circle */
                    .pm-card div[style*="width: 36px"] {
                        order: -2 !important;
                        width: 34px !important;
                        height: 34px !important;
                        border-radius: 50% !important;
                        margin: 0 auto 10px auto !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        background-color: inherit !important; /* This should let the HTML background show */
                        box-shadow: 0 2px 6px rgba(0,0,0,0.05) !important;
                    }
                    .pm-card .material-icons-round { font-size: 1.15rem !important; }

                    /* Count - Middle */
                    .pm-card .card-count {
                        order: -1 !important;
                        font-size: 1.6rem !important;
                        margin: 0 0 2px 0 !important;
                        line-height: 1 !important;
                        font-weight: 800 !important;
                        color: var(--text-primary) !important;
                    }

                    /* Label - Bottom */
                    .pm-card div[style*="font-size: 0.65rem"] {
                        order: 0 !important;
                        font-size: 0.55rem !important;
                        font-weight: 700 !important;
                        color: var(--text-tertiary) !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.05em !important;
                        margin: 0 !important;
                        width: 100%;
                    }

                    .main-table-card { max-height: none !important; }
                    .pm-filter-bar { padding: 0.75rem !important; gap: 0.5rem !important; flex-wrap: wrap !important; }
                    .pm-filter-bar > div:first-child { display: none !important; }
                    .pm-filter-bar > div:last-child { width: 100% !important; }
                    .pm-dropdown { flex: 1 1 calc(50% - 0.25rem); min-width: 0 !important; }
                    .pm-dropdown-trigger { padding: 6px 8px !important; font-size: 0.65rem !important; }
                    #pm-search-container { order: -1; min-width: 100% !important; }
                    
                    /* Sidebar List - Allow more height on mobile since cards are compact */
                    #sidebar-list { max-height: 450px !important; }
                    
                    /* Items wrap fix */
                    .sidebar-item div, .pm-table-wrapper td div { 
                        white-space: normal !important; 
                        word-break: break-word !important; 
                        overflow: visible !important; 
                        text-overflow: clip !important; 
                    }
                    
                    /* TABLE -> CARDS */
                    .pm-table-wrapper table, .pm-table-wrapper thead, .pm-table-wrapper tbody, .pm-table-wrapper tr {
                        display: block; width: 100%;
                    }
                    .pm-table-wrapper thead { display: none; }
                    .pm-table-wrapper tr {
                        background: white;
                        border-bottom: 4px solid var(--bg-secondary) !important;
                        padding: 1rem !important;
                        display: flex;
                        flex-direction: column;
                        gap: 0.4rem;
                        position: relative;
                    }
                    .pm-table-wrapper td {
                        display: flex;
                        align-items: center;
                        padding: 0 !important;
                        border: none !important;
                        text-align: left !important;
                    }
                    .pm-table-wrapper td:nth-child(1) { font-size: 0.75rem !important; color: var(--brand-viola) !important; font-weight: 800 !important; padding: 2px 6px !important; background: rgba(97, 74, 162, 0.05) !important; border-radius: 4px !important; width: auto !important; display: inline-flex !important; }
                    .pm-table-wrapper td:nth-child(2) { flex-direction: column !important; align-items: flex-start !important; gap: 2px !important; margin: 0.25rem 0 !important; }
                    .pm-table-wrapper td:nth-child(2) div:first-child { font-size: 0.95rem !important; font-weight: 800 !important; color: var(--text-primary) !important; }
                    .pm-table-wrapper td:nth-child(3) { font-size: 0.8rem !important; color: var(--text-secondary) !important; margin-bottom: 0.5rem !important; }
                    .pm-table-wrapper td:nth-child(3)::before { content: "CLIENTE: "; font-weight: 900; color: var(--text-tertiary); font-size: 0.6rem; margin-right: 6px; }
                    .pm-table-wrapper td:nth-child(4) { justify-content: flex-start !important; }
                    .pm-table-wrapper td:nth-child(4)::before { content: "TEAM: "; font-weight: 900; color: var(--text-tertiary); font-size: 0.6rem; margin-right: 6px; }
                }
            </style>

            <div class="pm-dashboard-root dashboard-root">
                
                <div class="pm-main-grid">
                    
                    <!-- Sidebar column (Always Visible Svolgimento) -->
                    <div class="pm-sidebar-col" style="display: flex; flex-direction: column; gap: 1.5rem;">
                          <div class="glass-card" style="padding: 0; border-radius: 12px; background: white; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm); overflow: hidden; display: flex; flex-direction: column; position: relative; z-index: 1;">
                            <div style="padding: 1rem; background: var(--brand-gradient); color: white; position: relative; z-index: 2;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                                    <h3 style="margin: 0; font-size: 0.78rem; font-weight: 800; color: white; display: flex; align-items: center; gap: 6px; font-family: var(--font-titles); text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9;">
                                        <span class="material-icons-round" style="font-size: 0.95rem;">rocket_launch</span>
                                        In Svolgimento
                                    </h3>
                                </div>
                            </div>
                            <div id="sidebar-list" style="padding: 0.75rem; display: flex; flex-direction: column; gap: 0.65rem; max-height: 500px; overflow-y: auto;">
                                <div style="text-align:center; padding: 2rem; opacity: 0.5;">Caricamento...</div>
                            </div>
                        </div>
                    </div>

                    <!-- Main column -->
                    <div class="pm-main-col" style="display: flex; flex-direction: column; min-width: 0;">
                        
                        <!-- Top Summary Cards (Funnel Style) -->
                        <div class="pm-summary-grid" id="pm-funnel">
                            <!-- In Attesa Card -->
                            <div class="pm-card funnel-card" data-status="lavoro_in_attesa" style="border-left-color: #f59e0b;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                    <div style="flex: 1;">
                                        <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">In Attesa</div>
                                        <div class="card-count" style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); line-height: 1; font-family: var(--font-titles);">0</div>
                                    </div>
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: #fffbeb; display: flex; align-items: center; justify-content: center;">
                                        <span class="material-icons-round" style="color: #f59e0b; font-size: 1.25rem;">hourglass_empty</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Ongoing Card -->
                            <div class="pm-card funnel-card" data-status="manutenzione" style="border-left-color: #06b6d4;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                    <div style="flex: 1;">
                                        <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">Ongoing</div>
                                        <div class="card-count" style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); line-height: 1; font-family: var(--font-titles);">0</div>
                                    </div>
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: #ecfeff; display: flex; align-items: center; justify-content: center;">
                                        <span class="material-icons-round" style="color: #06b6d4; font-size: 1.25rem;">published_with_changes</span>
                                    </div>
                                </div>
                            </div>

                            <!-- In Pausa Card -->
                            <div class="pm-card funnel-card" data-status="in_pausa" style="border-left-color: #64748b;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                    <div style="flex: 1;">
                                        <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 600; margin-bottom: 0.25rem;">In Pausa</div>
                                        <div class="card-count" style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary); line-height: 1; font-family: var(--font-titles);">0</div>
                                    </div>
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center;">
                                        <span class="material-icons-round" style="color: #64748b; font-size: 1.25rem;">pause_circle</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Main Table Glass Card -->
                        <div class="glass-card main-table-card" style="padding: 0; overflow: hidden; border-radius: 16px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; max-height: 700px;">
                            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border); background: var(--bg-secondary); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary); font-family: var(--font-titles);">Elenco Commesse</h3>
                                    <span id="filter-badge" style="display: none; background: var(--brand-viola); color: white; padding: 3px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">FILTRO ATTIVO</span>
                                </div>
                                <button id="reset-filters" style="display: none; background: white; border: 1px solid var(--brand-viola); color: var(--brand-viola); padding: 6px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--brand-viola)'; this.style.color='white'">Rimuovi Filtri</button>
                            </div>

                            <!-- New Interactive Filter Bar -->
                            <div class="pm-filter-bar">
                                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
                                    <span class="material-icons-round" style="font-size: 1rem;">filter_list</span>
                                    Filtra per:
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                                    <div class="pm-dropdown" id="year-filter" style="min-width: 120px;">
                                        <button class="pm-dropdown-trigger">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span class="material-icons-round" style="font-size: 1.1rem; opacity:0.7;">calendar_today</span>
                                                <span style="white-space: nowrap;">Anno</span>
                                            </div>
                                            <span class="material-icons-round" style="font-size: 1.1rem; opacity:0.5;">expand_more</span>
                                        </button>
                                        <div class="pm-dropdown-menu">
                                            <div class="pm-dropdown-item" data-value="">Tutti</div>
                                            ${uniqueYears.map(y => `<div class="pm-dropdown-item" data-value="${y}">${y}</div>`).join('')}
                                        </div>
                                    </div>

                                    <div class="pm-dropdown" id="client-filter" style="min-width: 160px;">
                                        <button class="pm-dropdown-trigger">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span class="material-icons-round" style="font-size: 1.1rem; opacity:0.7;">corporate_fare</span>
                                                <span style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Cliente</span>
                                            </div>
                                            <span class="material-icons-round" style="font-size: 1.1rem; opacity:0.5;">expand_more</span>
                                        </button>
                                        <div class="pm-dropdown-menu">
                                            <div class="pm-dropdown-item" data-value="">Tutti</div>
                                            ${uniqueClients.map(c => `<div class="pm-dropdown-item" data-value="${c}">${c}</div>`).join('')}
                                        </div>
                                    </div>

                                    <div class="pm-dropdown" id="status-filter" style="min-width: 150px;">
                                        <button class="pm-dropdown-trigger">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span class="material-icons-round" style="font-size: 1.1rem; opacity:0.7;">flag</span>
                                                <span>Stato</span>
                                            </div>
                                            <span class="material-icons-round" style="font-size: 1.1rem; opacity:0.5;">expand_more</span>
                                        </button>
                                        <div class="pm-dropdown-menu">
                                            <div class="pm-dropdown-item" data-value="">Tutti</div>
                                            <div class="pm-dropdown-item" data-value="in_svolgimento">In Svolgimento</div>
                                            <div class="pm-dropdown-item" data-value="lavoro_in_attesa">In Attesa</div>
                                            <div class="pm-dropdown-item" data-value="manutenzione">Ongoing</div>
                                            <div class="pm-dropdown-item" data-value="in_pausa">In Pausa</div>
                                            <div class="pm-dropdown-item" data-value="completato">Completate</div>
                                        </div>
                                    </div>

                                    <!-- Search -->
                                    <div id="pm-search-container" style="position: relative; flex: 1; max-width: 300px;">
                                        <span class="material-icons-round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 1.1rem;">search</span>
                                        <input type="text" id="pm-search" placeholder="Cerca progetto..." 
                                            style="width: 100%; padding: 0.6rem 1rem 0.6rem 2.8rem; border-radius: 100px; border: 1px solid var(--glass-border); background: white; font-size: 0.85rem; outline: none; transition: border-color 0.2s;"
                                            onfocus="this.style.borderColor='var(--brand-viola)'"
                                            onblur="this.style.borderColor='var(--glass-border)'">
                                    </div>
                                </div>
                            </div>

                            <div class="pm-table-wrapper" style="overflow-x: auto; overflow-y: auto; flex: 1;">
                                <table style="width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed;">
                                    <thead>
                                        <tr>
                                            <th style="position: sticky; top: 0; background: white; padding: 1rem 1.5rem; text-align: left; font-size: 0.72rem; color: var(--text-tertiary); text-transform: uppercase; border-bottom: 1px solid var(--glass-border); width: 90px; font-weight: 800; z-index: 10;">ID</th>
                                            <th style="position: sticky; top: 0; background: white; padding: 1rem 1.5rem; text-align: left; font-size: 0.72rem; color: var(--text-tertiary); text-transform: uppercase; border-bottom: 1px solid var(--glass-border); font-weight: 800; z-index: 10;">Progetto</th>
                                            <th style="position: sticky; top: 0; background: white; padding: 1rem 1.5rem; text-align: left; font-size: 0.72rem; color: var(--text-tertiary); text-transform: uppercase; border-bottom: 1px solid var(--glass-border); width: 220px; font-weight: 800; z-index: 10;">Cliente</th>
                                            <th style="position: sticky; top: 0; background: white; padding: 1rem 1.5rem; text-align: center; font-size: 0.72rem; color: var(--text-tertiary); text-transform: uppercase; border-bottom: 1px solid var(--glass-border); width: 130px; font-weight: 800; z-index: 10;">Team</th>
                                            <th style="position: sticky; top: 0; background: white; padding: 1rem 1.5rem; text-align: right; font-size: 0.72rem; color: var(--text-tertiary); text-transform: uppercase; border-bottom: 1px solid var(--glass-border); width: 90px; font-weight: 800; z-index: 10;">Data</th>
                                            <th style="position: sticky; top: 0; background: white; padding: 1rem 1.5rem; width: 50px; border-bottom: 1px solid var(--glass-border); z-index: 10;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="pm-table-body" style="background: white;"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        // --- 3. RENDERING HELPERS ---
        const updateSidebar = () => {
            const list = container.querySelector('#sidebar-list');
            const countEl = container.querySelector('#sidebar-count');
            const totalValueEl = container.querySelector('#sidebar-total-value');
            const filteredSidebar = allProjects.filter(p => normalizeStatus(p.status_works) === 'in_svolgimento');

            if (countEl) countEl.textContent = filteredSidebar.length;
            if (!list) return;

            if (filteredSidebar.length === 0) {
                list.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.75rem;">Nessuna commessa attiva</div>`;
                return;
            }

            list.innerHTML = filteredSidebar.map(o => {
                const team = teamSummary[o.id] || [];
                const activeTeam = team.slice(0, 3);
                const remaining = team.length - 3;

                return `
                <div class="sidebar-item" onclick="window.location.hash='#pm/commessa/${o.id}'" style="
                    padding: 0.85rem 1rem; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s;
                    display: flex; flex-direction: column; gap: 8px; border-left: 4px solid var(--brand-viola);
                " onmouseover="this.style.background='white'; this.style.borderColor='var(--brand-viola)'; this.style.transform='translateX(3px)';" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#f1f5f9'; this.style.transform='none';">
                    <div style="display: flex; justify-content: space-between; font-size: 0.55rem; color: var(--text-tertiary); font-weight: 800;">
                        <span>${o.order_number}</span>
                        <span style="max-width: 65%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${o.clients?.business_name || 'N/D'}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); line-height: 1.25; flex: 1; min-width: 0; word-break: break-word;">${o.title || 'Senza Titolo'}</div>
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                        <div style="display: flex; align-items: center;">
                            ${activeTeam.map((m, i) => `
                                <div title="${m.name}" style="width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; border: 1px solid white; margin-left: ${i === 0 ? '0' : '-6px'}; z-index: ${10 - i}; display: flex; align-items: center; justify-content: center; font-size: 0.45rem; font-weight: 800; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
                                    ${m.avatar ? `<img src="${m.avatar}" style="width:100%; height:100%; object-fit:cover;">` : m.initials}
                                </div>
                            `).join('')}
                            ${remaining > 0 ? `<div style="width: 20px; height: 20px; border-radius: 50%; background: #f1f5f9; border: 1px solid white; margin-left: -6px; display: flex; align-items: center; justify-content: center; font-size: 0.45rem; font-weight: 800; color: #64748b;">+${remaining}</div>` : ''}
                        </div>
                        <span class="material-icons-round" style="font-size: 0.9rem; color: #cbd5e1;">chevron_right</span>
                    </div>
                </div>
                `;
            }).join('');
        };

        const updateTable = () => {
            const tbody = container.querySelector('#pm-table-body');
            const filterBadge = container.querySelector('#filter-badge');
            const resetBtn = container.querySelector('#reset-filters');
            if (!tbody) return;

            const filtered = allProjects.filter(p => {
                const norm = normalizeStatus(p.status_works);

                const matchesStatus = !activeStatusFilter || norm === activeStatusFilter;
                const matchesYear = !activeYearFilter || (p.created_at && new Date(p.created_at).getFullYear() == activeYearFilter);
                const matchesClient = !activeClientFilter || (p.clients?.business_name === activeClientFilter);

                const s = searchTerm.toLowerCase();
                const matchesSearch = !s || (p.title || '').toLowerCase().includes(s) ||
                    (p.order_number || '').toLowerCase().includes(s) ||
                    (p.clients?.business_name || '').toLowerCase().includes(s);

                return matchesStatus && matchesYear && matchesClient && matchesSearch;
            });

            // Sort: prioritize operational if no specific filter
            const sorted = [...filtered].sort((a, b) => {
                const sA = normalizeStatus(a.status_works);
                const sB = normalizeStatus(b.status_works);
                const p = { 'in_svolgimento': 1, 'lavoro_in_attesa': 2, 'manutenzione': 3, 'in_pausa': 4, 'completato': 5, 'altro': 6 };
                if (p[sA] !== p[sB]) return p[sA] - p[sB];
                return new Date(b.created_at) - new Date(a.created_at);
            });

            const hasFilters = activeStatusFilter || activeYearFilter || activeClientFilter;
            if (filterBadge) filterBadge.style.display = hasFilters ? 'block' : 'none';
            if (resetBtn) resetBtn.style.display = hasFilters || searchTerm ? 'block' : 'none';

            if (sorted.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 4rem; color: var(--text-tertiary); font-size: 0.9rem;">Nessuna commessa trovata con i filtri attuali.</td></tr>`;
                return;
            }

            tbody.innerHTML = sorted.map(order => {
                const norm = normalizeStatus(order.status_works);
                const config = STATUS_CONFIG[norm] || STATUS_CONFIG['altro'];
                const team = teamSummary[order.id] || [];
                const activeTeam = team.slice(0, 3);
                const remaining = team.length - 3;

                return `
                    <tr onclick="window.location.hash='#pm/commessa/${order.id}'" style="cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 1rem; font-weight: 700; font-size: 0.8rem; color: var(--text-tertiary); white-space: nowrap;">${order.order_number}</td>
                        <td style="padding: 1rem;">
                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${order.title || 'Senza Titolo'}</div>
                            <div style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 100px; font-size: 0.6rem; font-weight: 800; background: ${config.bg}; color: ${config.color}; margin-top: 4px; border: 1px solid rgba(0,0,0,0.02);">
                                <span class="material-icons-round" style="font-size: 0.7rem; margin-right: 4px;">${config.icon}</span>
                                ${config.label}
                            </div>
                        </td>
                        <td style="padding: 1rem; color: var(--text-secondary); font-size: 0.82rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${order.clients?.business_name || 'N/D'}
                        </td>
                        <td style="padding: 1rem; text-align: center;">
                            <div style="display: flex; align-items: center; justify-content: center;">
                                ${activeTeam.map((m, i) => `
                                    <div title="${m.name}" style="width: 24px; height: 24px; border-radius: 50%; background: #f1f5f9; border: 2px solid white; margin-left: -8px; z-index: ${10 - i}; display: flex; align-items: center; justify-content: center; font-size: 0.55rem; font-weight: 800; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                        ${m.avatar ? `<img src="${m.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : m.initials}
                                    </div>
                                `).join('')}
                                ${remaining > 0 ? `<div style="width: 24px; height: 24px; border-radius: 50%; background: #f8fafc; border: 2px solid white; margin-left: -8px; display: flex; align-items: center; justify-content: center; font-size: 0.55rem; font-weight: 800; color: #64748b;">+${remaining}</div>` : ''}
                                ${activeTeam.length === 0 ? '<span style="font-size:0.65rem; color:#cbd5e1; font-style:italic;">-</span>' : ''}
                            </div>
                        </td>
                        <td style="padding: 1rem; text-align: right; color: var(--text-tertiary); font-size: 0.8rem; font-weight: 600;">
                            ${new Date(order.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                        </td>
                        <td style="padding: 1rem; text-align: right;">
                             <span class="material-icons-round" style="color: #cbd5e1; font-size: 1.1rem;">keyboard_arrow_right</span>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        const updateFunnelStats = () => {
            container.querySelectorAll('.funnel-card').forEach(card => {
                const status = card.dataset.status;
                const filtered = allProjects.filter(p => normalizeStatus(p.status_works) === status);
                const count = filtered.length;
                const total = filtered.reduce((sum, p) => sum + (parseFloat(p.price_final) || 0), 0);

                card.querySelector('.card-count').textContent = count;

                if (status === activeStatusFilter) {
                    card.style.transform = 'translateY(-4px) scale(1.02)';
                    card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)';
                } else {
                    card.style.transform = '';
                    card.style.boxShadow = '';
                }
            });
        };

        // --- 4. INTERACTION LOGIC ---
        const setupDropdown = (id, callback) => {
            const drop = container.querySelector(`#${id}`);
            const trigger = drop.querySelector('.pm-dropdown-trigger');
            const menu = drop.querySelector('.pm-dropdown-menu');

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = menu.style.display === 'block';
                container.querySelectorAll('.pm-dropdown-menu').forEach(m => m.style.display = 'none');
                if (!isOpen) menu.style.display = 'block';
            });

            menu.querySelectorAll('.pm-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const val = item.dataset.value;
                    const label = item.textContent;

                    // Update trigger UI
                    trigger.querySelector('span:nth-child(1)').nextElementSibling.textContent = val ? label : (id.split('-')[0].charAt(0).toUpperCase() + id.split('-')[0].slice(1));
                    if (val) trigger.classList.add('active'); else trigger.classList.remove('active');

                    menu.querySelectorAll('.pm-dropdown-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');

                    menu.style.display = 'none';
                    callback(val);
                });
            });
        };

        setupDropdown('year-filter', (val) => { activeYearFilter = val; updateTable(); });
        setupDropdown('client-filter', (val) => { activeClientFilter = val; updateTable(); });
        setupDropdown('status-filter', (val) => {
            activeStatusFilter = val;
            updateTable();
            updateFunnelStats();
        });

        container.querySelector('#pm-search')?.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            updateTable();
        });

        container.querySelectorAll('.pm-card').forEach(card => {
            card.addEventListener('click', () => {
                const status = card.dataset.status;
                activeStatusFilter = (activeStatusFilter === status) ? null : status;

                // Sync status dropdown
                const statusDrop = container.querySelector('#status-filter');
                const trigger = statusDrop.querySelector('.pm-dropdown-trigger');
                const label = activeStatusFilter ? STATUS_CONFIG[activeStatusFilter].label : 'Stato';
                trigger.querySelector('span:nth-child(1)').nextElementSibling.textContent = label;
                if (activeStatusFilter) trigger.classList.add('active'); else trigger.classList.remove('active');

                updateTable();
                updateFunnelStats();
            });
        });

        container.querySelector('#reset-filters')?.addEventListener('click', () => {
            activeStatusFilter = null;
            activeYearFilter = null;
            activeClientFilter = null;
            searchTerm = '';
            container.querySelector('#pm-search').value = '';

            // Reset triggers
            container.querySelectorAll('.pm-dropdown-trigger').forEach(t => {
                const baseLabel = t.parentElement.id.split('-')[0];
                t.querySelector('span:nth-child(1)').nextElementSibling.textContent = baseLabel.charAt(0).toUpperCase() + baseLabel.slice(1);
                t.classList.remove('active');
            });

            updateTable();
            updateFunnelStats();
        });

        document.addEventListener('click', () => {
            container.querySelectorAll('.pm-dropdown-menu').forEach(m => m.style.display = 'none');
        });

        // Initial render
        updateSidebar();
        updateTable();
        updateFunnelStats();

        // Real-time Listeners
        const refreshHandler = () => {
             console.log('[CommesseList] Change detected, refreshing list...');
             renderCommesseList(container);
        };
        if (window._commesseRefresher) {
            document.removeEventListener('pm-item-changed', window._commesseRefresher);
            document.removeEventListener('pm-space-changed', window._commesseRefresher);
        }
        window._commesseRefresher = refreshHandler;
        document.addEventListener('pm-item-changed', refreshHandler);
        document.addEventListener('pm-space-changed', refreshHandler);

    } catch (err) {
        console.error("renderCommesseList Error:", err);
        container.innerHTML = `<div style="padding:4rem; text-align:center; color:#ef4444;">
            <span class="material-icons-round" style="font-size: 3rem;">error_outline</span>
            <p>Errore durante il caricamento della dashboard PM.</p>
            <small>${err.message}</small>
        </div>`;
    }
}
