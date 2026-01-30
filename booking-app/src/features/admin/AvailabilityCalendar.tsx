import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addHours, startOfDay, eachHourOfInterval, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';

interface Collaborator {
    id: string;
    user_id?: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    role?: string;
    tags?: string[] | string;
}

interface Department {
    id: string;
    name: string;
}

interface AvailabilityRule {
    id: string;
    collaborator_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    service_id?: string;
}

interface AvailabilityOverride {
    id: string;
    collaborator_id: string;
    date: string;
    is_available: boolean;
    start_time?: string;
    end_time?: string;
}

interface GoogleBusy {
    collaborator_id: string;
    start: string;
    end: string;
}

const COLLABORATOR_COLORS = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#6366f1',
    '#f56565', '#48bb78', '#9f7aea', '#4299e1', '#ed8936',
    '#e53e3e', '#38a169', '#805ad5', '#d69e2e', '#dd6b20',
];

const busyCache = new Map<string, GoogleBusy[]>();

export default function AvailabilityCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [rules, setRules] = useState<AvailabilityRule[]>([]);
    const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
    const [googleBusy, setGoogleBusy] = useState<GoogleBusy[]>([]);
    const [activeDept, setActiveDept] = useState<string | 'all'>('all');
    const [activeCollab, setActiveCollab] = useState<string | 'all'>('all');
    const [timezones, setTimezones] = useState<Record<string, string>>({});
    const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const today = new Date();

    const hours = eachHourOfInterval({ start: addHours(startOfDay(new Date()), 7), end: addHours(startOfDay(new Date()), 21) });

    useEffect(() => {
        let mounted = true;

        async function load() {
            if (mounted) setLoading(true);

            const cacheKey = weekStart.toISOString();
            const hasCache = busyCache.has(cacheKey);

            try {
                // Fetch core data first
                const [{ data: deptData }, { data: collabData }, { data: rulesData }, { data: overridesData }] = await Promise.all([
                    supabase.from('departments').select('*').order('name'),
                    supabase.from('collaborators').select('id, user_id, first_name, last_name, avatar_url, role, tags').order('first_name'),
                    supabase.from('availability_rules').select('*'),
                    supabase.from('availability_overrides').select('*').gte('date', format(weekStart, 'yyyy-MM-dd')).lte('date', format(weekEnd, 'yyyy-MM-dd'))
                ]);

                if (!mounted) return;

                // Update Core State immediately
                if (deptData) setDepartments(deptData);
                if (collabData) {
                    setCollaborators(collabData);
                    // Fetch Timezones
                    const userIds = collabData.map(c => c.user_id).filter(Boolean);
                    if (userIds.length > 0) {
                        const { data: profiles } = await supabase.from('profiles').select('id, timezone').in('id', userIds);
                        if (profiles) {
                            const tzMap: Record<string, string> = {};
                            collabData.forEach(c => {
                                const p = profiles.find(x => x.id === c.user_id);
                                if (p && p.timezone) tzMap[c.id] = p.timezone;
                            });
                            setTimezones(tzMap);
                        }
                    }
                }
                if (rulesData) setRules(rulesData);
                if (overridesData) setOverrides(overridesData);

                // Use Cache immediately if available (Stale-While-Revalidate)
                if (hasCache) {
                    setGoogleBusy(busyCache.get(cacheKey)!);
                    setLoading(false); // Stop loading UI as we have data to show
                }

                // Fetch Fresh Google Data (Background or Foreground)
                let busySlots: GoogleBusy[] = [];
                if (collabData && collabData.length > 0) {
                    // Fix timezone: Ensure we cover full start and end days in local time
                    const start = new Date(weekStart);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(weekEnd);
                    end.setHours(23, 59, 59, 999);

                    const timeMin = start.toISOString();
                    const timeMax = end.toISOString();
                    const collaborator_ids = collabData.map(c => c.id);

                    try {
                        const { data, error } = await supabase.functions.invoke('check-google-availability', {
                            body: { collaborator_ids, timeMin, timeMax }
                        });

                        if (!error && data) {
                            if (data[0]?.error === 'AUTH_ERROR') {
                                console.warn('Auth error in availability calendar', data[0]);
                                // Optional: Show toast or indicator
                            } else {
                                busySlots = data.busy || [];
                            }
                        }
                    } catch (e) {
                        console.warn('Google Calendar bulk fetch error', e);
                    }
                }

                if (!mounted) return;

                // Update Cache and State with fresh data
                setGoogleBusy(busySlots);
                busyCache.set(cacheKey, busySlots);

                // If we didn't have cache, stop loading now
                if (!hasCache) {
                    setLoading(false);
                }

            } catch (err) {
                console.error('Error fetching availability data:', err);
                if (mounted) setLoading(false);
            }
        }

        load();

        return () => { mounted = false; };
    }, [currentDate]);

    // Parse tags helper
    function getCollaboratorTags(c: Collaborator): string[] {
        if (Array.isArray(c.tags)) return c.tags;
        if (typeof c.tags === 'string') {
            try { return JSON.parse(c.tags); } catch { return c.tags.split(',').map(t => t.trim()); }
        }
        return [];
    }

    // Filter by department using tags (not role)
    const deptFilteredCollaborators = activeDept === 'all'
        ? collaborators
        : collaborators.filter(c => getCollaboratorTags(c).includes(activeDept));

    const finalFilteredCollaborators = activeCollab === 'all'
        ? deptFilteredCollaborators
        : deptFilteredCollaborators.filter(c => c.id === activeCollab);

    function getCollaboratorColor(collabId: string) {
        const index = collaborators.findIndex(c => c.id === collabId);
        return COLLABORATOR_COLORS[index % COLLABORATOR_COLORS.length];
    }

    function getBlocksForDay(dayOfWeek: number, dateStr: string) {
        const dayRules = rules.filter(r => r.day_of_week === dayOfWeek);
        const dayOverrides = overrides.filter(o => o.date === dateStr);
        const filteredCollabIds = new Set(finalFilteredCollaborators.map(c => c.id));
        const filteredRules = dayRules.filter(r => filteredCollabIds.has(r.collaborator_id));

        // Get busy slots for this day
        const dayBusy = googleBusy.filter(b => {
            const busyDate = new Date(b.start).toISOString().split('T')[0];
            return busyDate === dateStr;
        });

        const result: AvailabilityRule[] = [];

        filteredRules.forEach(rule => {
            const override = dayOverrides.find(o => o.collaborator_id === rule.collaborator_id);
            if (override && !override.is_available) return;

            let startTime = rule.start_time;
            let endTime = rule.end_time;
            if (override && override.is_available && override.start_time && override.end_time) {
                startTime = override.start_time;
                endTime = override.end_time;
            }

            // Get busy intervals for this collaborator on this day
            const collabBusy = dayBusy
                .filter(b => b.collaborator_id === rule.collaborator_id)
                .map(b => {
                    const bStart = new Date(b.start);
                    const bEnd = new Date(b.end);
                    return {
                        start: bStart.getHours() + bStart.getMinutes() / 60,
                        end: bEnd.getHours() + bEnd.getMinutes() / 60
                    };
                });

            // Parse rule times
            const parseTime = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h + m / 60;
            };
            const formatTime = (h: number) => {
                const hours = Math.floor(h);
                const mins = Math.round((h - hours) * 60);
                return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            };

            // Subtract busy intervals
            let freeIntervals = [{ start: parseTime(startTime), end: parseTime(endTime) }];

            collabBusy.forEach(busy => {
                const newIntervals: { start: number; end: number }[] = [];
                freeIntervals.forEach(interval => {
                    // Start logic remains same...
                    if (busy.end <= interval.start || busy.start >= interval.end) {
                        newIntervals.push(interval);
                    } else if (busy.start <= interval.start && busy.end >= interval.end) {
                        // Covered
                    } else if (busy.start > interval.start && busy.end < interval.end) {
                        newIntervals.push({ start: interval.start, end: busy.start });
                        newIntervals.push({ start: busy.end, end: interval.end });
                    } else if (busy.start <= interval.start && busy.end < interval.end) {
                        newIntervals.push({ start: busy.end, end: interval.end });
                    } else if (busy.start > interval.start && busy.end >= interval.end) {
                        newIntervals.push({ start: interval.start, end: busy.start });
                    }
                });
                freeIntervals = newIntervals;
            });

            // Helper to convert normalized hours (e.g. 9.5) to Viewer TZ
            const convertToLocal = (h: number) => {
                const collabTz = timezones[rule.collaborator_id];
                const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

                if (!collabTz || collabTz === viewerTz) return h;

                try {
                    // 1. Construct Date in Collab TZ
                    const hours = Math.floor(h);
                    const minutes = Math.round((h - hours) * 60);

                    const now = new Date();
                    const d = new Date(now);
                    d.setHours(hours, minutes, 0, 0);

                    // 2. Find offset difference
                    // Wall time in CollabTZ: HH:MM. We need to find real timestamp.
                    const getParts = (ts: Date, tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(ts);

                    // Simple offset approximation
                    // This creates a date where "computer local time" matches the source HH:MM.
                    // We need to shift it so that "Wall Time in CollabTZ" matches HH:MM.
                    // ... Actually, `AvailabilityManager` logic was:
                    // Guess = Date with target HH:MM in Local.
                    // Check Guess in SourceTZ. Diff. Shift.

                    const guess = new Date(d);

                    const getRoughMinutes = (dt: Date, tz: string) => {
                        const p = getParts(dt, tz);
                        let _h = parseInt(p.find(x => x.type === 'hour')!.value);
                        if (_h === 24) _h = 0;
                        let _m = parseInt(p.find(x => x.type === 'minute')!.value);
                        return _h * 60 + _m;
                    };

                    const currentMins = getRoughMinutes(guess, collabTz);
                    const targetMins = hours * 60 + minutes;
                    let diff = currentMins - targetMins;

                    if (diff > 720) diff -= 1440;
                    if (diff < -720) diff += 1440;

                    guess.setMinutes(guess.getMinutes() - diff);

                    // Now `guess` is the timestamp where it is HH:MM in CollabTZ.
                    // We just want to display it in ViewerTZ (which is just .getHours()/.getMinutes() of `guess` in browser local).

                    return guess.getHours() + guess.getMinutes() / 60;

                } catch (e) {
                    return h;
                }
            };

            // Create rule entries for each free interval
            freeIntervals.forEach((interval, idx) => {
                if (interval.end - interval.start > 0) {
                    // CONVERT TO LOCAL TIME HERE
                    const localStart = convertToLocal(interval.start);
                    const localEnd = convertToLocal(interval.end);

                    // Check bounds (07:00 - 21:00 view range is handled by CSS/Rendering later? 
                    // No, `timeToPosition` assumes 7-21 range.
                    // If local time is outside range, it might render off-screen or negative.
                    // The UI handles overlapping, so offscreen is fine.)

                    if (localEnd > localStart) { // Ensure validity after conversion (wrapping handled simply)
                        result.push({
                            ...rule,
                            id: `${rule.id}_${idx}`,
                            start_time: formatTime(localStart),
                            end_time: formatTime(localEnd)
                        });
                    }
                }
            });
        });

        // ADD GOOGLE BUSY SLOTS VISUALIZATION (Independent of rules)
        dayBusy.forEach(busy => {
            // Only if collaborator is in current view
            if (!filteredCollabIds.has(busy.collaborator_id)) return;

            const bStart = new Date(busy.start);
            const bEnd = new Date(busy.end);
            // Format to HH:mm
            const formatTime = (d: Date) => {
                const h = d.getHours();
                const m = d.getMinutes();
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            };

            result.push({
                id: `busy_${busy.collaborator_id}_${dateStr}_${busy.start}`,
                collaborator_id: busy.collaborator_id,
                day_of_week: dayOfWeek,
                start_time: formatTime(bStart),
                end_time: formatTime(bEnd),
                service_id: 'busy' // Marker
            });
        });

        return result;
    }

    function timeToPosition(timeStr: string): number {
        const [h, m] = timeStr.split(':').map(Number);
        return (h - 7 + m / 60) * 60;
    }

    function getCollaboratorName(collabId: string): string {
        const c = collaborators.find(col => col.id === collabId);
        return c ? `${c.first_name} ${c.last_name || ''}` : 'N/A';
    }

    function getBlockLayout(blocks: AvailabilityRule[]) {
        if (blocks.length === 0) return [];

        // First, group blocks by collaborator
        const byCollaborator = new Map<string, AvailabilityRule[]>();
        blocks.forEach(block => {
            const collabId = block.collaborator_id;
            if (!byCollaborator.has(collabId)) {
                byCollaborator.set(collabId, []);
            }
            byCollaborator.get(collabId)!.push(block);
        });

        // Determine column assignment based on overlapping collaborators
        const collabIds = Array.from(byCollaborator.keys());
        const collabColumn = new Map<string, number>();
        const collabGroupSize = new Map<string, number>();

        // Find overlapping groups of collaborators
        const processed = new Set<string>();

        for (let i = 0; i < collabIds.length; i++) {
            if (processed.has(collabIds[i])) continue;

            const group = [collabIds[i]];
            processed.add(collabIds[i]);

            // Find all collaborators that overlap with anyone in the group
            for (let j = i + 1; j < collabIds.length; j++) {
                if (processed.has(collabIds[j])) continue;

                // Check if this collaborator overlaps with anyone in the group
                const overlaps = group.some(groupCollabId => {
                    const groupBlocks = byCollaborator.get(groupCollabId)!;
                    const testBlocks = byCollaborator.get(collabIds[j])!;

                    return groupBlocks.some(gBlock =>
                        testBlocks.some(tBlock => {
                            const gStart = timeToPosition(gBlock.start_time);
                            const gEnd = timeToPosition(gBlock.end_time);
                            const tStart = timeToPosition(tBlock.start_time);
                            const tEnd = timeToPosition(tBlock.end_time);
                            return !(tEnd <= gStart || tStart >= gEnd);
                        })
                    );
                });

                if (overlaps) {
                    group.push(collabIds[j]);
                    processed.add(collabIds[j]);
                }
            }

            // Assign columns to this group
            group.forEach((collabId, idx) => {
                collabColumn.set(collabId, idx);
                collabGroupSize.set(collabId, group.length);
            });
        }

        // Build result with correct column assignments
        const result: Array<{ block: AvailabilityRule; column: number; totalColumns: number }> = [];
        blocks.forEach(block => {
            const column = collabColumn.get(block.collaborator_id) ?? 0;
            const totalColumns = collabGroupSize.get(block.collaborator_id) ?? 1;
            result.push({ block, column, totalColumns });
        });

        return result;
    }

    // Get unique collaborators that have rules shown
    const activeCollabsWithRules = new Set<string>();
    daysInWeek.forEach(day => {
        const dayOfWeek = day.getDay();
        const dateStr = format(day, 'yyyy-MM-dd');
        getBlocksForDay(dayOfWeek, dateStr).forEach(b => activeCollabsWithRules.add(b.collaborator_id));
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', position: 'relative' }}>
            {loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 40, height: 40, border: '4px solid #f3f3f3', borderTop: '4px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            )}
            {/* Toolbar */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 500, color: '#1f2937', fontFamily: 'Outfit, system-ui, sans-serif' }}>
                        {format(weekStart, 'd MMM', { locale: it })}
                        <span style={{ color: '#9ca3af' }}>→</span>
                        {format(weekEnd, 'd MMM yyyy', { locale: it })}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Vista Settimanale</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', padding: '6px 12px', borderRadius: 6 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Reparto:</span>
                        <select value={activeDept} onChange={e => { setActiveDept(e.target.value); setActiveCollab('all'); }} style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}>
                            <option value="all">Tutti</option>
                            {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                    </div>
                    <button onClick={() => setCurrentDate(prev => subWeeks(prev, 1))} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, color: '#6b7280', cursor: 'pointer' }}><span className="material-icons-round" style={{ fontSize: 18 }}>chevron_left</span></button>
                    <button onClick={() => setCurrentDate(prev => addWeeks(prev, 1))} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, color: '#6b7280', cursor: 'pointer' }}><span className="material-icons-round" style={{ fontSize: 18 }}>chevron_right</span></button>
                    <button onClick={() => setCurrentDate(new Date())} style={{ height: 32, padding: '0 1rem', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, fontSize: '0.85rem', fontWeight: 500, color: '#1f2937', cursor: 'pointer' }}>Oggi</button>
                </div>
            </div>

            {/* Collaborator Filter - Compact Pills */}
            <div style={{ padding: '0.5rem 1.5rem', background: '#fafafa', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveCollab('all')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 16, border: 'none', background: activeCollab === 'all' ? '#4f46e5' : '#fff', color: activeCollab === 'all' ? '#fff' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <span className="material-icons-round" style={{ fontSize: 14 }}>groups</span> Tutti
                </button>
                {deptFilteredCollaborators.map(c => {
                    const color = getCollaboratorColor(c.id);
                    const isActive = activeCollab === c.id;
                    return (
                        <button key={c.id} onClick={() => setActiveCollab(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 16, border: 'none', background: isActive ? color : '#fff', color: isActive ? '#fff' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#fff' : color }} />
                            {c.first_name}
                        </button>
                    );
                })}
            </div>

            {/* Legend - Color to Name mapping */}
            {activeCollab === 'all' && activeCollabsWithRules.size > 0 && (
                <div style={{ padding: '6px 1.5rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.7rem' }}>
                    <span style={{ color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda:</span>
                    {Array.from(activeCollabsWithRules).map(collabId => {
                        const c = collaborators.find(col => col.id === collabId);
                        const color = getCollaboratorColor(collabId);
                        return (
                            <div key={collabId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                                <span style={{ color: '#374151' }}>{c?.first_name} {c?.last_name?.[0]}.</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Timeline */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb', background: '#fff', paddingLeft: 50 }}>
                    {daysInWeek.map(day => {
                        const isToday = isSameDay(day, today);
                        return (
                            <div key={day.toISOString()} style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderRight: '1px solid #f3f4f6' }}>
                                <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: isToday ? '#4f46e5' : '#9ca3af', fontWeight: 600, marginBottom: 2 }}>{format(day, 'EEE', { locale: it }).toUpperCase()}</span>
                                <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: isToday ? 600 : 300, color: isToday ? '#4f46e5' : '#6b7280', lineHeight: 1 }}>{format(day, 'd')}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Grid Body */}
                <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
                    <div style={{ width: 50, flexShrink: 0, borderRight: '1px solid #e5e7eb', background: '#fff' }}>
                        {hours.map(hour => (
                            <div key={hour.toString()} style={{ height: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontSize: '0.65rem', color: '#9ca3af', paddingTop: 2, transform: 'translateY(-50%)' }}>
                                <span style={{ background: '#fff', padding: '0 2px' }}>{format(hour, 'H:00')}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none', zIndex: 0 }}>
                            {hours.map(hour => <div key={hour.toString()} style={{ height: 50, borderBottom: '1px solid rgba(0,0,0,0.03)' }} />)}
                        </div>

                        {daysInWeek.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayOfWeek = day.getDay();
                            const blocks = getBlocksForDay(dayOfWeek, dateStr);
                            const blockLayout = getBlockLayout(blocks);
                            const isToday = isSameDay(day, today);

                            let nowIndicator = null;
                            if (isToday) {
                                const now = new Date();
                                const nowH = now.getHours() + now.getMinutes() / 60;
                                if (nowH >= 7 && nowH <= 21) {
                                    const topPx = (nowH - 7) * 50;
                                    nowIndicator = <div style={{ position: 'absolute', left: 0, right: 0, top: topPx, borderTop: '2px solid #ef4444', zIndex: 30, pointerEvents: 'none' }}><div style={{ position: 'absolute', left: -4, top: -5, width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} /></div>;
                                }
                            }

                            return (
                                <div key={dateStr} style={{ position: 'relative', borderRight: '1px solid #f3f4f6' }}>
                                    {hours.map(hour => <div key={hour.toString()} style={{ height: 50 }} />)}
                                    {blockLayout.map(({ block, column, totalColumns }) => {
                                        const top = (timeToPosition(block.start_time) / 60) * 50;
                                        const height = ((timeToPosition(block.end_time) - timeToPosition(block.start_time)) / 60) * 50;
                                        if (height <= 0) return null;
                                        const color = getCollaboratorColor(block.collaborator_id);
                                        const widthPercent = 100 / totalColumns;
                                        const leftPercent = column * widthPercent;
                                        const isHovered = hoveredBlock === block.id;
                                        const collabName = getCollaboratorName(block.collaborator_id);

                                        return (
                                            <div
                                                key={block.id}
                                                onMouseEnter={() => setHoveredBlock(block.id)}
                                                onMouseLeave={() => setHoveredBlock(null)}
                                                style={{
                                                    position: 'absolute',
                                                    top,
                                                    height,
                                                    left: `calc(${leftPercent}% + 2px)`,
                                                    width: `calc(${widthPercent}% - 4px)`,
                                                    background: block.service_id === 'busy' ? '#e5e7eb' : color, // Gray for busy
                                                    border: block.service_id === 'busy' ? '1px dashed #9ca3af' : 'none',
                                                    borderRadius: 4,
                                                    opacity: isHovered ? 1 : (block.service_id === 'busy' ? 1 : 0.8), // Busy is opaque
                                                    cursor: block.service_id === 'busy' ? 'default' : 'pointer',
                                                    zIndex: isHovered ? 20 : 10,
                                                    transition: 'all 0.15s',
                                                    transform: isHovered ? 'scale(1.03)' : 'none',
                                                    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.15)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    paddingTop: 3
                                                }}
                                            >
                                                {/* Avatar circle at top */}
                                                {(() => {
                                                    const collab = collaborators.find(c => c.id === block.collaborator_id);
                                                    const initials = collab ? `${collab.first_name[0]}${collab.last_name?.[0] || ''}` : '?';
                                                    const avatarSize = Math.min(height - 6, totalColumns > 3 ? 18 : 24);
                                                    if (avatarSize < 14) return null;
                                                    return (
                                                        <div style={{
                                                            width: avatarSize,
                                                            height: avatarSize,
                                                            borderRadius: '50%',
                                                            background: collab?.avatar_url ? 'transparent' : 'rgba(255,255,255,0.95)',
                                                            border: '2px solid rgba(255,255,255,0.9)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: avatarSize * 0.45,
                                                            fontWeight: 700,
                                                            color: color,
                                                            overflow: 'hidden',
                                                            flexShrink: 0
                                                        }}>
                                                            {collab?.avatar_url ? (
                                                                <img src={collab.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : initials}
                                                        </div>
                                                    );
                                                })()}
                                                {/* Tooltip on hover */}
                                                {isHovered && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        background: '#1f2937',
                                                        color: '#fff',
                                                        padding: '6px 10px',
                                                        borderRadius: 6,
                                                        fontSize: '0.7rem',
                                                        fontWeight: 500,
                                                        whiteSpace: 'nowrap',
                                                        zIndex: 100,
                                                        marginTop: 4,
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                                    }}>
                                                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{collabName}</div>
                                                        <div style={{ opacity: 0.8 }}>{block.start_time.slice(0, 5)} - {block.end_time.slice(0, 5)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {nowIndicator}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
