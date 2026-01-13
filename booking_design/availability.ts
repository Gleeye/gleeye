import { addMinutes, areIntervalsOverlapping, isWithinInterval, startOfDay, addDays } from 'date-fns';

// --- Types ---
type TimeRange = { start: Date; end: Date };
type Slot = TimeRange & { availableCollaborators: string[] };

interface Collaborator {
    id: string;
    name: string;
}

interface Service {
    id: string;
    durationMinutes: number;
    bufferMinutes: number;
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
interface AvailabilityContext {
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
    const step = 15; // Minutes grid
    const totalDuration = service.durationMinutes + service.bufferMinutes;

    const possibleSlots: Slot[] = [];

    // Iterate strictly by 'step' within the requested range
    let current = new Date(range.start);
    const endLimit = new Date(range.end);

    while (addMinutes(current, totalDuration) <= endLimit) {
        const slotStart = new Date(current);
        const slotEnd = addMinutes(current, service.durationMinutes); // Note: Bookable time is duration, buffer is extra check
        const fullEnd = addMinutes(current, totalDuration); // Used for collision check including buffer

        // Check which candidates are free for this specific interval [slotStart, fullEnd]
        const freeCollaborators = candidates.filter(collab =>
            isCollaboratorAvailable(collab.id, { start: slotStart, end: fullEnd }, ctx)
        );

        // Apply Service Logic
        let isSlotValid = false;

        if (service.logicType === 'OR') {
            isSlotValid = freeCollaborators.length > 0;
        } else if (service.logicType === 'AND') {
            isSlotValid = freeCollaborators.length === candidates.length;
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
    const dateStr = dayDate.toISOString().split('T')[0]; // simple YYYY-MM-DD
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
    const rules = ctx.recurringRules[collabId]?.filter(r => r.dayOfWeek === dayOfWeek);
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
