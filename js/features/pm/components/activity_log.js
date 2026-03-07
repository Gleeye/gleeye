import { fetchPMActivityLogs } from '../../../modules/pm_api.js?v=1001';

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
        spaceId = options; // Support legacy single arg
    }

    container.innerHTML = `
        <div class="activity-log-container" style="padding: 1.5rem; height: 100%; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid var(--surface-2); padding-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem; font-family: var(--font-titles);">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--surface-1); display: flex; align-items: center; justify-content: center;">
                        <span class="material-icons-round" style="color: var(--brand-color); font-size: 1.25rem;">history</span>
                    </div>
                    Registro Attività
                </h3>
                <button class="refresh-log-btn" style="background: var(--surface-1); border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='var(--surface-2)'; this.style.transform='rotate(45deg)';" onmouseout="this.style.background='var(--surface-1)'; this.style.transform='none';">
                    <span class="material-icons-round" style="font-size: 20px; color: var(--text-secondary);">refresh</span>
                </button>
            </div>
            <div class="activity-log-list" style="flex: 1; overflow-y: auto; padding-right: 0.5rem; position: relative;">
                <div class="loader-container" style="text-align: center; padding: 4rem;"><div class="loading-spinner"></div></div>
            </div>
        </div>
        <style>
            .loading-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid var(--surface-2);
                border-top: 3px solid var(--brand-color);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin: 0 auto;
            }
            @keyframes spin { 100% { transform: rotate(360deg); } }
            
            .activity-log-list::-webkit-scrollbar { width: 6px; }
            .activity-log-list::-webkit-scrollbar-track { background: transparent; }
            .activity-log-list::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 10px; }
            
            .log-group-title {
                font-size: 0.8rem;
                font-weight: 800;
                color: var(--text-tertiary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin: 2rem 0 1.5rem 0;
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            .log-group-title::after {
                content: '';
                flex: 1;
                height: 1px;
                background: var(--surface-1);
            }
        </style>
    `;

    const listContainer = container.querySelector('.activity-log-list');
    const refreshBtn = container.querySelector('.refresh-log-btn');

    const loadLogs = async () => {
        listContainer.innerHTML = '<div class="loader-container" style="text-align: center; padding: 4rem;"><div class="loading-spinner"></div></div>';

        try {
            const logs = await fetchPMActivityLogs(spaceId, itemId, orderId, itemIds, clientId, { isAccountLevel });

            if (!logs || logs.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 5rem 2rem; color: var(--text-tertiary);">
                        <div style="width: 80px; height: 80px; background: var(--surface-1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                            <span class="material-icons-round" style="font-size: 2.5rem; opacity: 0.5;">history_edu</span>
                        </div>
                        <h4 style="margin: 0; color: var(--text-primary); font-size: 1.1rem;">Nessuna attività</h4>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem;">Non ci sono ancora eventi registrati in questo contesto.</p>
                    </div>
                `;
                return;
            }

            // Group by Day
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
                html += `<div class="log-group-title">${day}</div>`;
                html += `<div style="display: flex; flex-direction: column; gap: 0.5rem; padding-left: 0.5rem;">`;

                dayLogs.forEach((log, idx) => {
                    html += renderLogItem(log, idx === dayLogs.length - 1);
                });

                html += `</div>`;
            }

            listContainer.innerHTML = html;
        } catch (err) {
            console.error("Error loading activity logs:", err);
            listContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--error-color);">Errore nel caricamento del registro.</div>`;
        }
    };

    refreshBtn.addEventListener('click', loadLogs);
    loadLogs();
}

function renderLogItem(log, isLast) {
    const time = new Date(log.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    // Extract description from JSON details
    let description = log.details?.description || log.details || log.action_type;
    if (typeof description === 'object') description = log.action_type;

    // Remove legacy prefixes
    description = description.replace(/^Ha /, '').replace(/^Azione: /, '');

    const authorName = log.actor?.full_name || 'Sistema';
    const avatarUrl = log.actor?.avatar_url || '';

    let icon = 'info';
    let iconBg = '#f1f5f9';
    let iconColor = '#64748b';

    if (log.action_type.includes('create')) { icon = 'add_circle'; iconBg = '#f0fdf4'; iconColor = '#10b981'; }
    else if (log.action_type.includes('status')) { icon = 'auto_awesome'; iconBg = '#fffbeb'; iconColor = '#f59e0b'; }
    else if (log.action_type.includes('comment')) { icon = 'forum'; iconBg = '#eff6ff'; iconColor = '#3b82f6'; }
    else if (log.action_type.includes('document')) { icon = 'description'; iconBg = '#fef2f2'; iconColor = '#ef4444'; }
    else if (log.action_type.includes('assign')) { icon = 'person_add'; iconBg = '#f5f3ff'; iconColor = '#8b5cf6'; }

    return `
        <div class="log-item" style="display: flex; gap: 1.25rem; padding-bottom: 2rem; position: relative;">
            <!-- Timeline Visual -->
            <div style="display: flex; flex-direction: column; align-items: center; width: 32px; flex-shrink: 0;">
                <div style="width: 32px; height: 32px; border-radius: 10px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; z-index: 2; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <span class="material-icons-round" style="font-size: 16px;">${icon}</span>
                </div>
                ${!isLast ? `<div style="width: 2px; flex: 1; background: var(--surface-1); margin: 6px 0 -1.5rem 0;"></div>` : ''}
            </div>

            <!-- Content Card -->
            <div style="flex: 1; min-width: 0; padding-top: 2px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; background: var(--surface-1);" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random';">
                        <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${authorName}</span>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); background: var(--surface-1); padding: 2px 8px; border-radius: 6px;">${time}</span>
                </div>
                <div style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; background: var(--surface-1); padding: 1rem; border-radius: 12px; border: 1px solid transparent; transition: all 0.2s;" onmouseover="this.style.background='white'; this.style.borderColor='var(--surface-2)'; this.style.boxShadow='var(--shadow-sm)';" onmouseout="this.style.background='var(--surface-1)'; this.style.borderColor='transparent'; this.style.boxShadow='none';">
                    ${description}
                </div>
            </div>
        </div>
    `;
}
