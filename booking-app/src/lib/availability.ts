import { addMinutes, areIntervalsOverlapping, isWithinInterval, startOfDay, format } from 'date-fns';
import { toZonedTime, customToDate } from 'date-fns-tz'; // Renamed imports for clarity if needed, checking docs
import { fromZonedTime } from 'date-fns-tz';
import { supabase } from './supabaseClient';

// --- Types ---
type TimeRange = { start: Date; end: Date };
export type Slot = TimeRange & { availableCollaborators: string[] };

interface Collaborator {
    id: string;
    name: string;
    timezone?: string; // Default to 'Europe/Rome' if missing
}

interface Service {
    id: string;
    durationMinutes: number;
    bufferAfterMinutes: number;
    bufferBeforeMinutes: number;
    logicType: 'OR' | 'AND' | 'TEAM_SIZE';
    requiredTeamSize?: number;
}

interface AvailabilityRule {
    dayOfWeek: number; // 0-6
    startTimeStr: string; // "HH:MM"
    endTimeStr: string;   // "HH:MM"
}

interface AvailabilityOverride {
    dateStr: string; // "YYYY-MM-DD"
    isAvailable: boolean;
    ranges?: TimeRange[];
}

// --- Inputs ---
export interface AvailabilityContext {
    service: Service;
    candidates: Collaborator[];
    range: TimeRange;

    // Data Maps
    recurringRules: Record<string, AvailabilityRule[]>;
    overrides: Record<string, AvailabilityOverride[]>;
    busyTimes: Record<string, TimeRange[]>;
    timezones: Record<string, string>; // collabId -> timezone
}

// --- Main Engine ---
export function calculateAvailability(ctx: AvailabilityContext): Slot[] {
    const { service, candidates, range } = ctx;
    const step = service.durationMinutes > 0 ? service.durationMinutes : 15;
    const durationPlusAfter = service.durationMinutes + (service.bufferAfterMinutes || 0);

    const possibleSlots: Slot[] = [];

    // Iterate strictly by 'step' within the requested range (Range is in UTC/Client Time)
    let current = new Date(range.start);
    const endLimit = new Date(range.end);

    console.log(`[AvailabilityEngine] Starting calculation: start=${current.toISOString()}, endLimit=${endLimit.toISOString()}, step=${step}`);

    while (addMinutes(current, durationPlusAfter) <= endLimit) {
        const slotStart = new Date(current);
        const slotEnd = addMinutes(current, service.durationMinutes);

        // Check window: [start - bufferBefore, end + bufferAfter]
        const checkStart = addMinutes(current, -(service.bufferBeforeMinutes || 0));
        const checkEnd = addMinutes(current, durationPlusAfter);

        // Check which candidates are free for this specific interval [checkStart, checkEnd]
        const freeCollaborators = candidates.filter(collab =>
            isCollaboratorAvailable(collab.id, { start: checkStart, end: checkEnd }, ctx)
        );

        // Apply Service Logic
        let isSlotValid = false;
        const totalCandidates = candidates.length;
        if (totalCandidates === 0) break;

        if (service.logicType === 'OR') {
            isSlotValid = freeCollaborators.length > 0;
        } else if (service.logicType === 'AND') {
            isSlotValid = freeCollaborators.length === totalCandidates;
        } else if (service.logicType === 'TEAM_SIZE') {
            isSlotValid = freeCollaborators.length >= (service.requiredTeamSize || 1);
        }

        if (isSlotValid) {
            possibleSlots.push({
                start: slotStart,
                end: slotEnd,
                availableCollaborators: freeCollaborators.map(c => c.id)
            });
        }

        current = addMinutes(current, step);
    }

    return possibleSlots;
}

// --- Helper: Single Collaborator Check ---
function isCollaboratorAvailable(collabId: string, interval: TimeRange, ctx: AvailabilityContext): boolean {
    const timezone = ctx.timezones[collabId] || 'Europe/Rome';

    // 1. Check Busy Times (Stored in UTC in DB/Memory)
    // Busy times are absolute timestamps, so simple overlap check works regardless of IZ
    const busyList = ctx.busyTimes[collabId] || [];
    const isBusy = busyList.some(busy => areIntervalsOverlapping(busy, interval));
    if (isBusy) return false;

    // 2. Check Positive Availability (Rules are in Collab's Timezone)
    // We need to determine "What day is it for the collaborator?" at the start of the interval.

    // Convert the interval start to the collaborator's timezone to find the day/date
    const intervalStartInTz = toZonedTime(interval.start, timezone);
    const dateStr = format(intervalStartInTz, 'yyyy-MM-dd');
    const dayOfWeek = intervalStartInTz.getDay();

    // A. Check for specific Date Override
    const override = ctx.overrides[collabId]?.find(o => o.dateStr === dateStr);

    if (override) {
        if (!override.isAvailable) return false;
        // Check ranges (assumed absolute/UTC already converted during prep? No, overrides usually just date. 
        // We will assume overrides ranges are also in Collab Time if defined, but current schema looks generic)
        // For MVP overrides replace recurring rules logic.
        // If overrides has specific ranges, we'd need to convert them too. 
        // Assuming override just opens the whole day for now if ranges undefined.
        if (!override.ranges || override.ranges.length === 0) return true;
        return checkRanges(interval, override.ranges);
    }

    // B. Fallback to Recurring Rules
    const rules = ctx.recurringRules[collabId]?.filter(r => r.dayOfWeek == dayOfWeek);
    if (!rules || rules.length === 0) return false;

    // Convert rules (e.g. "09:00" in Tokyo) to Absolute UTC Ranges for the specific day
    const dailyRanges = rules.map(r => convertRuleToRange(r, dateStr, timezone));

    return checkRanges(interval, dailyRanges);
}

function checkRanges(needed: TimeRange, available: TimeRange[]): boolean {
    return available.some(avail =>
        isWithinInterval(needed.start, avail) && isWithinInterval(needed.end, avail)
    );
}

/**
 * Converts a rule like "09:00 - 17:00" on "2026-01-20" in "Asia/Tokyo"
 * into an absolute UTC TimeRange.
 */
function convertRuleToRange(rule: AvailabilityRule, dateStr: string, timezone: string): TimeRange {
    // Construct string like "2026-01-20T09:00:00"
    // Then interpret it in the specific timezone
    const [startH, startM] = rule.startTimeStr.split(':');
    const [endH, endM] = rule.endTimeStr.split(':');

    // Create ISO-like strings without Z
    const startIso = `${dateStr}T${startH.padStart(2, '0')}:${startM.padStart(2, '0')}:00`;
    const endIso = `${dateStr}T${endH.padStart(2, '0')}:${endM.padStart(2, '0')}:00`;

    // Convert to Absolute Date (UTC) treating the string as being in 'timezone'
    const start = fromZonedTime(startIso, timezone);
    const end = fromZonedTime(endIso, timezone);

    return { start, end };
}

// --- Orchestrator ---
export async function prepareAvailabilityContext(
    service: Service,
    candidates: Collaborator[],
    start: Date,
    end: Date
): Promise<AvailabilityContext> {
    const collabIds = candidates.map(c => c.id);

    // 0. Fetch Timezones (if not already on candidates, but we should fetch from profiles to be sure)
    const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, timezone')
        .in('id', collabIds);

    const timezones: Record<string, string> = {};
    profilesData?.forEach(p => {
        timezones[p.id] = p.timezone || 'Europe/Rome';
    });
    // Fallback for missing profiles
    candidates.forEach(c => {
        if (!timezones[c.id]) timezones[c.id] = c.timezone || 'Europe/Rome';
    });

    // 1. Fetch Recurring Rules
    const { data: rulesData } = await supabase
        .from('availability_rules')
        .select('*')
        .in('collaborator_id', collabIds);

    const recurringRules: Record<string, AvailabilityRule[]> = {};
    (rulesData || []).forEach(r => {
        if (!recurringRules[r.collaborator_id]) recurringRules[r.collaborator_id] = [];
        recurringRules[r.collaborator_id].push({
            dayOfWeek: r.day_of_week,
            startTimeStr: r.start_time,
            endTimeStr: r.end_time
        });
    });

    // 2. Fetch Overrides
    const { data: overridesData } = await supabase
        .from('availability_overrides')
        .select('*')
        .in('collaborator_id', collabIds)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));

    const overrides: Record<string, AvailabilityOverride[]> = {};
    (overridesData || []).forEach(o => {
        if (!overrides[o.collaborator_id]) overrides[o.collaborator_id] = [];

        // For Overrides with manual times, we assume the inputs are also in Collab Timezone for now
        // But handling overrides specific hours + timezone matching needs care. 
        // We'll treat date string as stable.
        const tz = timezones[o.collaborator_id] || 'Europe/Rome';
        let ranges: TimeRange[] = [];

        if (o.is_available && o.start_time && o.end_time) {
            const [sH, sM] = o.start_time.split(':');
            const [eH, eM] = o.end_time.split(':');
            const dateStr = o.date;

            const startIso = `${dateStr}T${sH.padStart(2, '0')}:${sM.padStart(2, '0')}:00`;
            const endIso = `${dateStr}T${eH.padStart(2, '0')}:${eM.padStart(2, '0')}:00`;

            ranges = [{
                start: fromZonedTime(startIso, tz),
                end: fromZonedTime(endIso, tz)
            }];
        }

        overrides[o.collaborator_id].push({
            dateStr: o.date,
            isAvailable: o.is_available,
            ranges
        });
    });

    // 3. Fetch Busy Times (UTC)
    const busyTimes: Record<string, TimeRange[]> = {};
    await Promise.all(collabIds.map(async (id) => {
        const [internal, external] = await Promise.all([
            fetchInternalBusyTimes(id, start, end),
            fetchExternalBusyTimes(id, start, end)
        ]);
        busyTimes[id] = [...internal, ...external];
    }));

    return {
        service,
        candidates,
        range: { start, end },
        recurringRules,
        overrides,
        busyTimes,
        timezones
    };
}


/**
 * Fetches busy slots from the Google Calendar Edge Function
 */
export async function fetchExternalBusyTimes(
    collaboratorId: string,
    start: Date,
    end: Date
): Promise<TimeRange[]> {
    try {
        const { data, error } = await supabase.functions.invoke('check-google-availability', {
            body: {
                collaborator_id: collaboratorId,
                timeMin: start.toISOString(),
                timeMax: end.toISOString()
            }
        });

        if (error) throw error;
        if (!data || !data.busy) return [];

        return data.busy.map((b: any) => ({
            start: new Date(b.start),
            end: new Date(b.end)
        }));
    } catch (err) {
        console.error(`Failed to fetch Google busy slots for ${collaboratorId}:`, err);
        return [];
    }
}

/**
 * Fetches internal ERP bookings that are confirmed
 */
export async function fetchInternalBusyTimes(
    collaboratorId: string,
    start: Date,
    end: Date
): Promise<TimeRange[]> {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select(`
                start_time,
                end_time,
                booking_assignments!inner(collaborator_id)
            `)
            .eq('booking_assignments.collaborator_id', collaboratorId)
            .gte('end_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .neq('status', 'cancelled');

        if (error) throw error;

        return (data || []).map(b => ({
            start: new Date(b.start_time),
            end: new Date(b.end_time)
        }));
    } catch (err) {
        console.error(`Failed to fetch internal bookings for ${collaboratorId}:`, err);
        return [];
    }
}
