import { addMinutes, areIntervalsOverlapping, isWithinInterval, startOfDay, format } from 'date-fns';
import { supabase } from './supabaseClient';

// --- Types ---
type TimeRange = { start: Date; end: Date };
export type Slot = TimeRange & { availableCollaborators: string[] };

interface Collaborator {
    id: string;
    name: string;
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

    // Data Maps (Pre-fetched)
    recurringRules: Record<string, AvailabilityRule[]>; // collabId -> rules
    overrides: Record<string, AvailabilityOverride[]>;  // collabId -> overrides
    busyTimes: Record<string, TimeRange[]>;             // collabId -> [Internal Bookings + External Events]
}

// --- Main Engine ---
export function calculateAvailability(ctx: AvailabilityContext): Slot[] {
    const { service, candidates, range } = ctx;
    // Step matches service duration to create meaningful blocks
    const step = service.durationMinutes > 0 ? service.durationMinutes : 15;
    const durationPlusAfter = service.durationMinutes + (service.bufferAfterMinutes || 0);

    const possibleSlots: Slot[] = [];

    // Iterate strictly by 'step' within the requested range
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
        // Optimization: If totalCandidates is 0 (should not happen), invalid
        if (totalCandidates === 0) break;

        if (service.logicType === 'OR') {
            isSlotValid = freeCollaborators.length > 0;
        } else if (service.logicType === 'AND') {
            // Check if all candidates are free
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
    // 1. Check Busy Times (Bookings + External)
    // If ANY busy time overlaps with the interval, they are NOT available.
    const busyList = ctx.busyTimes[collabId] || [];
    const isBusy = busyList.some(busy => areIntervalsOverlapping(busy, interval));
    if (isBusy) return false;

    // 2. Check Positive Availability (Rules / Overrides)
    // Must be covered by at least one "Available Block"

    const dayDate = startOfDay(interval.start);
    // Use local date string formatting to match override keys which are date-strings
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const dayOfWeek = dayDate.getDay();

    // A. Check for specific Date Override
    const override = ctx.overrides[collabId]?.find(o => o.dateStr === dateStr);

    if (override) {
        if (!override.isAvailable) return false; // Explicitly blocked entire day
        // If available, check if interval fits in specific override ranges (if defined)
        // If no ranges defined but isAvailable=true, assume whole day? usually ranges are required.
        // For MVP assume override replaces recurring.
        return checkRanges(interval, override.ranges || []);
    }

    // B. Fallback to Recurring Rules
    // Use loose equality for dayOfWeek in case of string/number mismatch from DB
    const rules = ctx.recurringRules[collabId]?.filter(r => r.dayOfWeek == dayOfWeek);
    if (!rules || rules.length === 0) return false; // No rule = Not working

    // Convert rules to absolute TimeRanges for that specific day
    const dailyRanges = rules.map(r => convertRuleToRange(r, dayDate));

    return checkRanges(interval, dailyRanges);
}

function checkRanges(needed: TimeRange, available: TimeRange[]): boolean {
    // The 'needed' interval must be fully contained within AT LEAST ONE of the 'available' ranges.
    // (Assuming continuous block needed. If split allowed, logic implies intersection.)
    return available.some(avail =>
        isWithinInterval(needed.start, avail) && isWithinInterval(needed.end, avail)
    );
}

function convertRuleToRange(rule: AvailabilityRule, date: Date): TimeRange {
    const [startH, startM] = rule.startTimeStr.split(':').map(Number);
    const [endH, endM] = rule.endTimeStr.split(':').map(Number);

    const start = new Date(date);
    start.setHours(startH, startM, 0, 0);

    const end = new Date(date);
    end.setHours(endH, endM, 0, 0);

    return { start, end };
}

/**
 * Orchestrator: Fetches all data and prepares the context for calculation
 */
export async function prepareAvailabilityContext(
    service: Service,
    candidates: Collaborator[],
    start: Date,
    end: Date
): Promise<AvailabilityContext> {
    const collabIds = candidates.map(c => c.id);

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

        const dayDate = new Date(o.date);
        let ranges: TimeRange[] = [];
        if (o.is_available && o.start_time && o.end_time) {
            ranges = [convertTimesToRange(o.start_time, o.end_time, dayDate)];
        }

        overrides[o.collaborator_id].push({
            dateStr: o.date,
            isAvailable: o.is_available,
            ranges
        });
    });

    // 3. Fetch Busy Times (Google + Internal)
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
        busyTimes
    };
}

function convertTimesToRange(startStr: string, endStr: string, date: Date): TimeRange {
    const [sH, sM] = startStr.split(':').map(Number);
    const [eH, eM] = endStr.split(':').map(Number);
    const start = new Date(date);
    start.setHours(sH, sM, 0, 0);
    const end = new Date(date);
    end.setHours(eH, eM, 0, 0);
    return { start, end };
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
