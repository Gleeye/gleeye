import { fetchPMActivityLogs } from '../../../modules/pm_api.js?v=1002';

/**
 * Render a beautiful, premium Activity Log for a specific space, order, or item
 */
export async function renderActivityLog(container, options = {}) {
    if (!container) return;

    let spaceId = null, itemId = null, orderId = null, itemIds = null, clientId = null, isAccountLevel = null;

    if (typeof options === 'object' && options !== null) {
        spaceId = options.spaceId;
        itemId = options.itemId;
        orderId = options.orderId;
        itemIds = options.itemIds;
        clientId = options.clientId;
        isAccountLevel = options.isAccountLevel;
    } else {
        spaceId = options;
    }

    container.innerHTML = `
        <div class="activity-log-container" style="padding: 2rem; height: 100%; display: flex; flex-direction: column; background: var(--bg-primary); border-radius: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2.5rem; background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); padding: 1rem 1.5rem; border-radius: 16px; border: 1px solid var(--surface-2);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, var(--brand-color), #4f46e5); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(var(--brand-color-rgb), 0.3);">
                        <span class="material-icons-round" style="color: white; font-size: 1.5rem;">history</span>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif;">Log Attività</h3>
                        <p style="margin: 2px 0 0; font-size: 0.8rem; color: var(--text-tertiary); font-weight: 500;">Cronologia eventi e modifiche</p>
                    </div>
                </div>
                <button class="refresh-log-btn" style="background: var(--surface-1); border: 1px solid var(--surface-2); width: 40px; height: 40px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.background='white'; this.style.transform='rotate(90deg)'; this.style.boxShadow='var(--shadow-sm)';" onmouseout="this.style.background='var(--surface-1)'; this.style.transform='none';">
                    <span class="material-icons-round" style="font-size: 20px; color: var(--text-secondary);">refresh</span>
                </button>
            </div>
            
            <div class="activity-log-list" style="flex: 1; overflow-y: auto; padding-right: 0.75rem; position: relative; scroll-behavior: smooth;">
                <div class="loader-container" style="text-align: center; padding: 5rem;"><div class="loading-spinner"></div></div>
            </div>
        </div>
        <style>
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid var(--surface-2);
                border-top: 4px solid var(--brand-color);
                border-radius: 50%;
                animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                margin: 0 auto;
            }
            @keyframes spin { 100% { transform: rotate(360deg); } }
            
            .activity-log-list::-webkit-scrollbar { width: 6px; }
            .activity-log-list::-webkit-scrollbar-track { background: transparent; }
            .activity-log-list::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 10px; }
            
            .log-group-header {
                font-size: 0.85rem;
                font-weight: 800;
                color: var(--text-tertiary);
                text-transform: uppercase;
                letter-spacing: 0.08em;
                margin: 2.5rem 0 1.5rem 0;
                display: flex;
                align-items: center;
                gap: 1.25rem;
                font-family: 'Outfit', sans-serif;
            }
            .log-group-header::after {
                content: '';
                flex: 1;
                height: 1px;
                background: linear-gradient(90deg, var(--surface-2), transparent);
            }
            
            .log-card {
                background: white;
                border: 1px solid var(--surface-2);
                border-radius: 16px;
                padding: 1.25rem;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            }
            .log-card:hover {
                transform: translateX(4px);
                border-color: var(--brand-color);
                box-shadow: 0 10px 20px rgba(0,0,0,0.05);
            }
        </style>
    `;

    const listContainer = container.querySelector('.activity-log-list');
    const refreshBtn = container.querySelector('.refresh-log-btn');

    const loadLogs = async () => {
        listContainer.innerHTML = '<div class="loader-container" style="text-align: center; padding: 5rem;"><div class="loading-spinner"></div></div>';

        try {
            const logs = await fetchPMActivityLogs(spaceId, itemId, orderId, itemIds, clientId, { isAccountLevel });

            if (!logs || logs.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 6rem 2rem; color: var(--text-tertiary); font-family: 'Outfit', sans-serif;">
                        <div style="width: 100px; height: 100px; background: var(--surface-1); border-radius: 35% 65% 70% 30% / 30% 30% 70% 70%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; animation: morph 8s ease-in-out infinite;">
                            <span class="material-icons-round" style="font-size: 3rem; color: var(--brand-color); opacity: 0.6;">auto_awesome</span>
                        </div>
                        <h4 style="margin: 0; color: var(--text-primary); font-size: 1.3rem; font-weight: 700;">Tutto pronto...</h4>
                        <p style="margin-top: 0.75rem; font-size: 1rem; color: var(--text-secondary);">Le interazioni e le modifiche appariranno non appena inizierai a lavorare.</p>
                    </div>
                    <style>
                        @keyframes morph {
                            0% { border-radius: 35% 65% 70% 30% / 30% 30% 70% 70%; }
                            50% { border-radius: 65% 35% 30% 70% / 70% 70% 30% 30%; }
                            100% { border-radius: 35% 65% 70% 30% / 30% 30% 70% 70%; }
                        }
                    </style>
                `;
                return;
            }

            // Grouping logic
            const groups = {};
            const today = new Date().toLocaleDateString('it-IT');
            const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterday = yesterdayDate.toLocaleDateString('it-IT');

            logs.forEach(log => {
                const date = new Date(log.created_at);
                const dStr = date.toLocaleDateString('it-IT');
                let label = dStr;
                if (dStr === today) label = 'Oggi';
                else if (dStr === yesterday) label = 'Ieri';
                else label = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

                if (!groups[label]) groups[label] = [];
                groups[label].push(log);
            });

            let html = '';
            for (const [day, dayLogs] of Object.entries(groups)) {
                html += `<div class="log-group-header">${day}</div>`;
                html += `<div style="display: flex; flex-direction: column; gap: 1rem; padding-left: 0.5rem; border-left: 2px solid var(--surface-1); margin-left: 1rem;">`;

                dayLogs.forEach((log, idx) => {
                    html += renderLogCard(log, idx === dayLogs.length - 1);
                });

                html += `</div>`;
            }

            listContainer.innerHTML = html;
        } catch (err) {
            console.error("Error loading activity logs:", err);
            listContainer.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--error-color); font-weight: 600;">Ouch! Qualcosa è andato storto nel recuperare i log.</div>`;
        }
    };

    refreshBtn.addEventListener('click', loadLogs);
    loadLogs();
}

function renderLogCard(log, isLast) {
    const time = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    // Description Resolution
    let description = log.details?.description || log.details || log.action_type;
    if (typeof description === 'object') {
        description = log.action_type === 'updated' ? 'Modifica dati' : log.action_type;
    }

    // Pretty-ify technical values if they leaked (failsafe)
    description = description
        .replace(/in_progress/g, '<b>In Corso</b>')
        .replace(/todo/g, '<b>Da Fare</b>')
        .replace(/done/g, '<b>Completato</b>')
        .replace(/blocked/g, '<b>Bloccato</b>')
        .replace(/review/g, '<b>In Revisione</b>');

    const authorName = log.actor?.full_name || 'Sistema';
    const avatarUrl = log.actor?.avatar_url || '';

    // Icon set
    let icon = 'info';
    let iconColor = '#64748b';
    let auraColor = 'rgba(100, 116, 139, 0.1)';

    if (log.action_type.includes('create')) {
        icon = 'add_circle'; iconColor = '#10b981'; auraColor = 'rgba(16, 185, 129, 0.1)';
    } else if (log.action_type.includes('status') || log.action_type.includes('progress')) {
        icon = 'auto_awesome'; iconColor = '#f59e0b'; auraColor = 'rgba(245, 158, 11, 0.1)';
    } else if (log.action_type.includes('comment')) {
        icon = 'forum'; iconColor = '#3b82f6'; auraColor = 'rgba(59, 130, 246, 0.1)';
    } else if (log.action_type.includes('document') || log.action_type.includes('file')) {
        icon = 'description'; iconColor = '#ef4444'; auraColor = 'rgba(239, 68, 68, 0.1)';
    } else if (log.action_type.includes('assign')) {
        icon = 'person_add'; iconColor = '#8b5cf6'; auraColor = 'rgba(139, 92, 246, 0.1)';
    }

    return `
        <div class="log-card-wrapper" style="position: relative; margin-left: -17px; display: flex; gap: 1.5rem; align-items: flex-start;">
            <!-- Connection Dot -->
            <div style="width: 10px; height: 10px; border-radius: 50%; background: white; border: 3px solid ${iconColor}; z-index: 5; margin-top: 25px; box-shadow: 0 0 0 4px var(--bg-primary);"></div>
            
            <div class="log-card" style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 38px; height: 38px; border-radius: 50%; padding: 2px; border: 1.5px solid var(--surface-2); background: white;">
                             <img src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: var(--surface-1);" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff&font-size=0.45';">
                        </div>
                        <div>
                            <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary); font-family: 'Outfit', sans-serif; display: block;">${authorName}</span>
                            <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 600;">@${authorName.split(' ')[0].toLowerCase()}</span>
                        </div>
                    </div>
                    <div style="background: var(--surface-1); padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); display: flex; align-items: center; gap: 5px; border: 1px solid var(--surface-2);">
                        <span class="material-icons-round" style="font-size: 14px; color: var(--text-tertiary);">schedule</span>
                        ${time}
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem; align-items: center; padding: 0.5rem 0;">
                    <div style="width: 40px; height: 40px; border-radius: 12px; background: ${auraColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span class="material-icons-round" style="font-size: 20px; color: ${iconColor};">${icon}</span>
                    </div>
                    <div style="font-size: 1rem; color: var(--text-primary); line-height: 1.5; font-family: 'Outfit', sans-serif;">
                        ${description}
                    </div>
                </div>
            </div>
        </div>
    `;
}
