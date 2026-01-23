import { addMinutes, areIntervalsOverlapping, isWithinInterval, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// --- Types ---
export type TimeRange = { start: Date; end: Date };
export type Slot = TimeRange & { availableCollaborators: string[] };

export interface Collaborator {
    id: string;
    name: string;
    timezone?: string; // Default to 'Europe/Rome' if missing
}

export interface Service {
    id: string;
    durationMinutes: number;
    bufferAfterMinutes: number;
    bufferBeforeMinutes: number;
    logicType: 'OR' | 'AND' | 'TEAM_SIZE';
    requiredTeamSize?: number;
}

export interface AvailabilityRule {
    dayOfWeek: number; // 0-6
    startTimeStr: string; // "HH:MM"
    endTimeStr: string;   // "HH:MM"
}

export interface AvailabilityOverride {
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
    const busyList = ctx.busyTimes[collabId] || [];
    const isBusy = busyList.some(busy => areIntervalsOverlapping(busy, interval));
    if (isBusy) return false;

    // 2. Check Positive Availability
    // Convert the interval start to the collaborator's timezone to find the day/date
    const intervalStartInTz = toZonedTime(interval.start, timezone);
    const dateStr = format(intervalStartInTz, 'yyyy-MM-dd');
    const dayOfWeek = intervalStartInTz.getDay();

    // A. Check for specific Date Override
    const override = ctx.overrides[collabId]?.find(o => o.dateStr === dateStr);

    if (override) {
        if (!override.isAvailable) return false;
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
export function convertRuleToRange(rule: AvailabilityRule, dateStr: string, timezone: string): TimeRange {
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
