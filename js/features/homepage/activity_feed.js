// Activity-feed widgets used by the homepage role-based dispatcher.
// Extracted from homepage-alt.js (Fase split-monstro step 1).
//
// Public exports:
//   - timeAgo(date)                            relative-time formatter (IT)
//   - renderActivityRow(container, t)          single task/event/timer row
//   - renderMyActivities(c, timers, tasks, events, filter)  sidebar orchestrator
//   - renderBottomActivities(container)        bottom widget reading window.hpData
//   - renderBottomTasks(container, tasks)      grouped task list with KPIs and collapse
//   - renderDelegatedTasks(container, tasks)   tasks delegated to other collaborators
//   - renderActivityFeed(container, activities) chronological activity log
//
// Side effect on import:
//   - Defines `window.quickCompleteTask` so HTML inline `onclick` handlers work.

import { state } from '/js/modules/state.js?v=8000';
import { renderAvatar } from '../../modules/utils.js?v=8000';
import { updatePMItem } from '../../modules/pm_api.js?v=8000';
import { humanizeActivity } from '../../modules/pm_activity_helper.js?v=8000';

export function renderMyActivities(container, timers, tasks, events, filter = 'task') {
    if (!container) return;
    container.innerHTML = '';
    let hasContent = false;

    // 1. Timers (Prioritized)
    const safeTimers = timers || [];
    if (safeTimers.length > 0) {
        safeTimers.forEach(t => {
            hasContent = true;
            renderActivityRow(container, { ...t, isTimer: true });
        });
    }

    // 2. Filtered Content
    if (filter === 'task') {
        const safeTasks = tasks || [];
        if (safeTasks.length > 0) {
            safeTasks.forEach(t => {
                hasContent = true;
                renderActivityRow(container, t);
            });
        }
    } else {
        const safeEvents = events || [];
        if (safeEvents.length > 0) {
            safeEvents.forEach(e => {
                hasContent = true;
                renderActivityRow(container, { ...e, isEvent: true, type: 'event' });
            });
        }
    }

    if (!hasContent) {
        container.innerHTML = `<div style="padding: 2.5rem 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem; font-weight: 500;">Nessuna attività programmata</div>`;
    }
}

// Helper to render an activity row (tasks/events/timers) - ZERO INVASIVITY VERSION
export function renderActivityRow(container, t) {
    let contextHeader = '';
    let spaceId = null;

    // Extract info from mapped object
    const tags = window.normalizedTagsForHtml || [];
    const isPrivileged = tags.includes('partner') || tags.includes('socio') ||
        tags.includes('amministrazione') || tags.includes('account') ||
        tags.includes('project manager') || tags.includes('pm') || tags.includes('backoffice');

    const ord = t.orders || {};
    const ordNum = ord.order_number || '';
    const clientCode = ord.clients?.client_code || '';
    const itemId = t.id ? t.id.split('-')[0].toUpperCase() : '';

    if (t.isEvent) {
        // Appointments Logic: "APPUNT. ClientCode"
        contextHeader = `APPUNT.${clientCode ? ` • ${clientCode}` : ''}`;
        if (!clientCode && t.location) contextHeader += ` • ${t.location}`;
    } else {
        // Tasks Logic: Role-Based Display
        if (isPrivileged) {
            contextHeader = ordNum ? `#${ordNum}${clientCode ? ` • ${clientCode}` : ''}` : (t.breadcrumb || 'PROGETTO INTERNO');
        } else {
            contextHeader = `#${itemId}${clientCode ? ` • ${clientCode}` : ''}`;
        }
    }

    const row = document.createElement('div');
    row.onclick = () => {
        if (t.isEvent) return;
        window.openPmItemDetails(t.id, spaceId || '');
    };

    row.style.cssText = `
        padding: 0.8rem 0;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        gap: 0.75rem;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s;
        background: transparent;
    `;
    row.onmouseover = () => { row.style.background = 'rgba(255,255,255,0.08)'; };
    row.onmouseout = () => { row.style.background = 'transparent'; };

    let dateStr = '';
    if (t.due_date) {
        const d = new Date(t.due_date);
        dateStr = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
        const todayStr = new Date().toISOString().split('T')[0];
        if (t.due_date < todayStr) dateStr = '<span style="color: #ef4444; font-weight: 700;">! SCADUTO</span>';
    } else if (t.isEvent && t.start) {
        const dStart = new Date(t.start);
        const dEnd = t.end ? new Date(t.end) : null;
        const startT = dStart.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const endT = dEnd ? dEnd.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
        dateStr = `<span style="display: flex; align-items: center; gap: 4px; color: #8b5cf6; font-weight: 600;">
            <span class="material-icons-round" style="font-size: 14px; opacity: 0.8;">schedule</span>
            ${startT}${endT ? ` — ${endT}` : ''}
        </span>`;
    }

    row.innerHTML = `
        <div style="flex: 1; min-width: 0;">
            <!-- ROW 1: Context (Order + Short Client or Appuntamento) -->
            <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
                ${contextHeader}
            </div>

            <!-- ROW 2: Title -->
            <div style="font-weight: 600; font-size: 0.9rem; color: inherit; line-height: 1.25; margin-bottom: 2px;">
                ${t.title}
            </div>

            <!-- ROW 3: Secondary Info (Activity Path or Time Range) -->
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 400; display: flex; align-items: center; gap: 4px;">
                ${t.isEvent ? dateStr : `${t.breadcrumb || 'Attività'}${dateStr ? ` <span style="color: #cbd5e1; margin: 0 2px;">•</span> ${dateStr}` : ''}`}
            </div>
        </div>

        ${!t.isTimer && !t.isEvent ? `
            <div style="flex-shrink: 0; padding-left: 10px;">
                <div class="hp-status-toggle"
                     onclick="event.stopPropagation(); window.quickCompleteTask('${t.id}', this)"
                     style="width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 6px; cursor: pointer; transition: all 0.3s; background: white;">
                </div>
            </div>
        ` : ''}
    `;
    container.appendChild(row);
}

// Helper for Task Completion — defined on window so HTML inline `onclick=` handlers can find it.
window.quickCompleteTask = async function (id, element) {
    const row = element.closest('.activity-row') || element.closest('.v-agenda-card');
    const container = row?.parentElement;
    if (row) row.style.opacity = '0.4';

    try {
        await updatePMItem(id, { status: 'done' });

        // Notify other modules and the dashboard refresher
        document.dispatchEvent(new CustomEvent('pm-item-changed', { detail: { itemId: id, action: 'update' } }));

        // Update local data to keep consistency if filters change
        if (window.hpData && window.hpData.tasks) {
            window.hpData.tasks = window.hpData.tasks.filter(t => t.id !== id);
            if (window.hpData.filteredTasks) {
                window.hpData.filteredTasks = window.hpData.filteredTasks.filter(t => t.id !== id);
            }
        }

        if (row) {
            row.style.transform = 'translateX(10px)';
            row.style.opacity = '0';

            // Instantly update the counter in the tab (sidebar)
            const card = row.closest('.glass-card');
            if (card) {
                const tabs = card.querySelectorAll('.hp-v6-pill');
                if (tabs.length > 0) {
                    const countEl = tabs[0].querySelector('.tab-count');
                    if (countEl) {
                        const current = parseInt(countEl.textContent) || 0;
                        countEl.textContent = Math.max(0, current - 1);
                    }
                }
            }

            setTimeout(() => {
                row.remove();
                if (container && container.children.length === 0 && container.classList.contains('hp-activities-list')) {
                    container.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding: 2rem;">Nessun task da completare.</div>`;
                }
            }, 200);
        }
    } catch (e) {
        console.error("Task completion failed", e);
        if (row) {
            row.style.opacity = '1';
            row.style.transform = 'none';
        }
    }
};

export function renderBottomActivities(container) {
    // We use data already fetched for the sidebar if available
    const timers = window.hpData?.timers || [];
    const activities = (window.hpData?.tasks || []).filter(item => {
        const type = (item.raw_type || '').toLowerCase();
        return type.includes('attivit') || type.includes('activity');
    });

    if (timers.length === 0 && activities.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.2; margin-bottom: 1rem;">history</span>
                <p>Nessuna attività recente registrata.</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Timers are currently not supported by the schema

    // Render PM Activities
    activities.forEach(t => {
        let fullTitle = 'Attività';
        let client = '';
        let spaceId = null;
        if (t.pm_spaces) {
            const space = Array.isArray(t.pm_spaces) ? t.pm_spaces[0] : t.pm_spaces;
            if (space) {
                spaceId = space.id;
                if (space.orders) {
                    const ord = Array.isArray(space.orders) ? space.orders[0] : space.orders;
                    if (ord) {
                        fullTitle = `#${ord.order_number} - ${ord.title}`;
                        client = ord.clients?.business_name || '';
                    }
                }
            }
        }
        html += `
            <div onclick="openPmItemDetails('${t.id}', '${spaceId || ''}')" style="background: var(--bg-card); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 12px; display: flex; align-items: center; margin-bottom: 0.5rem; cursor: pointer;">
                <div style="width: 44px; height: 44px; background: var(--bg-tertiary); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                    <span class="material-icons-round">assignment</span>
                </div>
                <div style="flex: 1; min-width: 0; margin: 0 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 2px;">${fullTitle}</div>
                    <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${t.title}</div>
                    ${client ? `<div style="font-size: 0.8rem; color: var(--text-tertiary);">${client}</div>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

export function renderBottomTasks(container, tasks) {
    if (!tasks || tasks.length === 0) {
        const kpiContainer = document.getElementById('hp-activities-bottom-kpis');
        if (kpiContainer) kpiContainer.innerHTML = '';
        container.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.1; margin-bottom: 1rem;">task_alt</span>
                <p style="font-size: 1.1rem; font-weight: 500;">Tutte le attività completate.</p>
            </div>
        `;
        return;
    }

    // Helper for toggling
    if (!window._hp_collapse_registered) {
        window.toggleActivityGroup = function (parentId, event) {
            event.stopPropagation();
            const btn = event.currentTarget;
            const children = document.querySelectorAll(`[data-parent="${parentId}"]`);
            const isCollapsing = Array.from(children).some(c => c.style.display !== 'none');
            children.forEach(c => {
                c.style.display = isCollapsing ? 'none' : 'grid';
                // Recursive collapse if children are also parents
                if (isCollapsing) {
                    const subId = c.getAttribute('data-id');
                    const subChildren = document.querySelectorAll(`[data-parent="${subId}"]`);
                    subChildren.forEach(sc => sc.style.display = 'none');
                    const subBtn = c.querySelector('.collapse-btn');
                    if (subBtn) subBtn.style.transform = 'rotate(-90deg)';
                }
            });
            btn.style.transform = isCollapsing ? 'rotate(-90deg)' : 'rotate(0deg)';
        };
        window._hp_collapse_registered = true;
    }

    // Calculate overall stats for KPIs correctly
    const activitiesCount = tasks.filter(t => t.is_activity && !t.is_sub_activity).length;
    const subActivitiesCount = tasks.filter(t => t.is_activity && t.is_sub_activity).length;
    const tasksCount = tasks.filter(t => !t.is_activity).length;
    const totalOverdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

    const kpiHtml = `
        <div class="widget-kpi-row">
            <div class="kpi-pill status-info">
                <span class="kpi-label">Attività</span>
                <span class="kpi-value">${activitiesCount}</span>
            </div>
            <div class="kpi-pill">
                <span class="kpi-label">Sotto-Attività</span>
                <span class="kpi-value">${subActivitiesCount}</span>
            </div>
            <div class="kpi-pill">
                <span class="kpi-label">Task</span>
                <span class="kpi-value">${tasksCount}</span>
            </div>
            ${totalOverdue > 0 ? `
                <div class="kpi-pill status-danger">
                    <span class="kpi-label">Scaduti</span>
                    <span class="kpi-value"><i class="material-icons-round">history</i> ${totalOverdue}</span>
                </div>
            ` : ''}
        </div>
    `;

    const kpiContainer = document.getElementById('hp-activities-bottom-kpis');
    if (kpiContainer) kpiContainer.innerHTML = kpiHtml;

    const listHtml = tasks.filter(t => t.is_activity).map((t) => {
        let statusColor = '#94a3b8';
        if (t.status === 'in_progress') statusColor = '#3b82f6';
        else if (t.status === 'review') statusColor = '#f59e0b';
        else if (t.status === 'blocked') statusColor = '#ef4444';

        const isOverdue = t.due_date && new Date(t.due_date) < new Date();
        const dateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
        const dueText = isOverdue ? `Scaduto: ${dateStr}` : (dateStr ? `Scadenza: ${dateStr}` : '');

        const orderCode = t.orders ? `#${t.orders.order_number}` : (t.area || '');
        const clientPart = t.orders?.clients?.client_code || t.orders?.clients?.business_name || '';

        const childActivities = tasks.filter(child => child.parent_id === t.id);
        const childCount = childActivities.length;
        const subOverdue = childActivities.filter(child => child.due_date && new Date(child.due_date) < new Date()).length;

        const hasChildren = childCount > 0;
        const rowClass = t.is_sub_activity ? 'activity-row sub-item' : 'activity-row is-parent';

        return `
            <div class="${rowClass}"
                 data-id="${t.id}"
                 data-parent="${t.parent_id || ''}"
                 onclick="openPmItemDetails('${t.id}', null)">

                <div class="collapse-btn" onclick="window.toggleActivityGroup('${t.id}', event)" style="${!hasChildren ? 'opacity: 0; pointer-events: none;' : ''}">
                    <span class="material-icons-round" style="font-size: 18px;">expand_more</span>
                </div>

                <div class="row-main">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${(() => {
                const isPm = t.role === 'pm' || (t.role || '').toLowerCase().includes('manager');
                const roleIcon = isPm ? 'stars' : 'person_outline';
                const roleColor = isPm ? '#f59e0b' : '#94a3b8';
                const roleTitle = isPm ? 'Project Manager' : 'Assegnatario';
                return `<span class="material-icons-round" title="${roleTitle}" style="font-size: 16px; color: ${roleColor}">${roleIcon}</span>`;
            })()}
                        <div class="row-title">${t.title}</div>
                    </div>
                    <div class="row-meta">
                        <span class="row-context">${orderCode}</span>
                        ${clientPart ? `<span> ${clientPart}</span>` : ''}
                        ${t.breadcrumb ? `<span class="row-breadcrumb"> ${t.breadcrumb}</span>` : ''}
                        ${dueText ? `<span style="${isOverdue ? 'color: #ef4444; font-weight: 700;' : ''}"> ${dueText}</span>` : ''}
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    ${subOverdue > 0 ? `
                        <div title="Sotto-attività scadute" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: #fee2e2; color: #ef4444; border-radius: 6px; font-weight: 800; font-size: 0.65rem;">
                            <span class="material-icons-round" style="font-size: 11px;">history</span>
                            <span>${subOverdue}</span>
                        </div>
                    ` : ''}
                    ${childCount > 0 ? `
                        <div title="Sotto-attività" style="display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: var(--bg-tertiary); color: var(--text-tertiary); border-radius: 6px; font-weight: 700; font-size: 0.65rem;">
                            <span class="material-icons-round" style="font-size: 11px;">list_alt</span>
                            <span>${childCount}</span>
                        </div>
                    ` : ''}
                    <span class="material-icons-round" style="color: #94a3b8; font-size: 16px; margin-left: 2px; transition: all 0.2s;" onmouseover="this.style.color='#8b5cf6'; this.style.transform='translateX(2px)'" onmouseout="this.style.color='#94a3b8'; this.style.transform='translateX(0)'">chevron_right</span>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = listHtml;
}

export function renderDelegatedTasks(container, tasks) {
    if (!tasks || tasks.length === 0) {
        const kpiContainer = document.getElementById('hp-delegated-bottom-kpis');
        if (kpiContainer) kpiContainer.innerHTML = '';
        container.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center; color: var(--text-tertiary);">
                <span class="material-icons-round" style="font-size: 3rem; opacity: 0.1; margin-bottom: 1rem;">assignment_turned_in</span>
                <p style="font-size: 1.1rem; font-weight: 500;">Nessuna delega attiva.</p>
            </div>
        `;
        return;
    }

    // Calculate KPIs
    const totalDelegated = tasks.length;
    const totalOverdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

    const kpiHtml = `
        <div class="widget-kpi-row">
            <div class="kpi-pill status-info">
                <span class="kpi-label">Gestite</span>
                <span class="kpi-value">${totalDelegated}</span>
            </div>
            ${totalOverdue > 0 ? `
                <div class="kpi-pill status-danger">
                    <span class="kpi-label">Scadute</span>
                    <span class="kpi-value"><i class="material-icons-round">history</i> ${totalOverdue}</span>
                </div>
            ` : ''}
        </div>
    `;

    const kpiContainer = document.getElementById('hp-delegated-bottom-kpis');
    if (kpiContainer) kpiContainer.innerHTML = kpiHtml;

    container.innerHTML = tasks.map(t => {
        const orderCode = t.orders ? `#${t.orders.order_number}` : (t.area || '');
        const clientPart = t.orders?.clients?.business_name || '';

        // Find other assignees (executors)
        const executors = (t.all_assignees || [])
            .filter(a => a.user_ref !== state.session?.user?.id && a.role !== 'pm' && a.role !== 'account')
            .map(a => {
                const collab = state.collaborators?.find(c => c.user_id === a.user_ref) || a.collaborator;
                const name = collab?.first_name || collab?.full_name?.split(' ')[0] || '...';
                const avatar = collab?.avatar_url || null;
                return { name, avatar, id: a.user_ref };
            })
            .filter((v, i, a) => v.name !== '...' && a.findIndex(x => x.id === v.id) === i); // Unique

        const isOverdue = t.due_date && new Date(t.due_date) < new Date();
        const dateStr = t.due_date ? new Date(t.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';

        return `
            <div class="activity-row" onclick="openPmItemDetails('${t.id}', null)" style="align-items: flex-start;">
                <!-- 1. Icon Col (24px) -->
                <div style="display: flex; align-items: center; justify-content: center; height: 20px; margin-top: 2px;">
                     <span class="material-icons-round" style="font-size: 16px; color: #f59e0b">stars</span>
                </div>

                <!-- 2. Main Col (1fr) -->
                <div class="row-main">
                    <div class="row-title" title="${t.title}" style="margin-bottom: 2px;">${t.title}</div>
                    <div class="row-meta" style="margin-bottom: 6px;">
                        <span class="row-context">${orderCode}</span>
                        ${clientPart ? `<span> ${clientPart}</span>` : ''}
                        ${t.breadcrumb ? `<span class="row-breadcrumb"> ${t.breadcrumb}</span>` : ''}
                        ${dateStr ? `<span style="${isOverdue ? 'color: #ef4444; font-weight: 700;' : ''}"> ${isOverdue ? 'Scaduto: ' : 'Scadenza: '}${dateStr}</span>` : ''}
                    </div>

                    <!-- EXECUTORS ROW (Avatars) -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${executors.map(ex => `
                            <div style="display: flex; align-items: center; gap: 6px; background: var(--bg-tertiary); padding: 2px 8px 2px 2px; border-radius: 12px; border: 1px solid var(--glass-border);">
                                ${ex.avatar ?
                `<img src="${ex.avatar}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;">` :
                `<div style="width: 18px; height: 18px; border-radius: 50%; background: var(--brand-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700;">${ex.name.charAt(0)}</div>`
            }
                                <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);">${ex.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- 3. Right Col (Auto) - Just Chevron -->
                <div style="display: flex; align-items: center; justify-content: flex-end; height: 100%; padding-top: 4px;">
                    <span class="material-icons-round" style="color: #94a3b8; font-size: 16px; transition: all 0.2s;" onmouseover="this.style.color='#8b5cf6'; this.style.transform='translateX(2px)'" onmouseout="this.style.color='#94a3b8'; this.style.transform='translateX(0)'">chevron_right</span>
                </div>
            </div>
        `;
    }).join('');
}

export function timeAgo(date) {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " anni fa";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " mesi fa";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " gg fa";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ore fa";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min fa";
    return "poco fa";
}

export function renderActivityFeed(container, activities) {
    if (!activities || activities.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; color: var(--text-tertiary); text-align: center; font-size: 0.85rem;">Nessuna attività recente</div>`;
        return;
    }

    container.innerHTML = `
        <div class="activity-log-list" style="display: flex; flex-direction: column; padding: 1rem 0;">
            ${activities.map(log => {
                const human = humanizeActivity(log);
                const timeStr = timeAgo(log.created_at);

                return `
                    <div class="timeline-item" onclick="window.openPmItemDetails('${log.item_ref}', '${log.space_ref || ''}')" style="display: flex; gap: 0.75rem; position: relative; padding: 0.45rem 0.75rem; cursor: pointer; transition: all 0.2s; border-radius: 14px;">
                        <!-- Timeline Line -->
                        <div style="position: absolute; left: 26px; top: 38px; bottom: 0; width: 1.5px; background: rgba(0,0,0,0.03); z-index: 1;"></div>

                        <div class="actor-avatar" style="flex-shrink: 0; position: relative; z-index: 2;">
                            ${renderAvatar(log.actor || { full_name: human.actorName }, { size: 28, borderRadius: '8px' })}
                        </div>
                        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                            <div style="font-size: 0.82rem; color: inherit; line-height: 1.4; font-weight: 400;">
                                <span style="font-weight: 700; color: var(--text-primary, #0f172a);">${human.actorName}</span>
                                <span style="color: var(--text-secondary, #64748b);">${human.formattedDesc}</span>
                            </div>
                            <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; gap: 5px; font-weight: 500;">
                                <span class="material-icons-round" style="font-size: 0.8rem; color: #cbd5e1;">schedule</span>
                                ${timeStr}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <style>
            .timeline-item:hover { background: rgba(0,0,0,0.02); }
            .timeline-item:last-child div[style*="background: #f1f5f9"] { display: none; }
        </style>
    `;
}
