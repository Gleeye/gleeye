
import { addMinutes, areIntervalsOverlapping, isWithinInterval, startOfDay, format } from 'date-fns';

// --- MOCKED LOGIC begin ---

// Types
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

export interface AvailabilityContext {
    service: Service;
    candidates: Collaborator[];
    range: TimeRange;
    recurringRules: Record<string, AvailabilityRule[]>;
    overrides: Record<string, AvailabilityOverride[]>;
    busyTimes: Record<string, TimeRange[]>;
}

// Logic
function calculateAvailability(ctx: AvailabilityContext): Slot[] {
    const { service, candidates, range } = ctx;
    const step = service.durationMinutes > 0 ? service.durationMinutes : 15;
    const durationPlusAfter = service.durationMinutes + (service.bufferAfterMinutes || 0);

    const possibleSlots: Slot[] = [];

    let current = new Date(range.start);
    const endLimit = new Date(range.end);

    console.log(`Debug: Range End Limit: ${endLimit.toLocaleString()}`);

    while (addMinutes(current, durationPlusAfter) <= endLimit) {
        const slotStart = new Date(current);
        const slotEnd = addMinutes(current, service.durationMinutes);

        // Check window: [start - bufferBefore, end + bufferAfter]
        const checkStart = addMinutes(current, -(service.bufferBeforeMinutes || 0));
        const checkEnd = addMinutes(current, durationPlusAfter);

        const freeCollaborators = candidates.filter(collab =>
            isCollaboratorAvailable(collab.id, { start: checkStart, end: checkEnd }, ctx)
        );

        let isSlotValid = false;
        if (service.logicType === 'OR') {
            isSlotValid = freeCollaborators.length > 0;
        }

        if (isSlotValid) {
            possibleSlots.push({
                start: slotStart,
                end: slotEnd,
                availableCollaborators: freeCollaborators.map(c => c.id)
            });
        }
        // else {
        //     console.log(`Slot rejected: ${format(slotStart, 'HH:mm')} - ${format(fullEnd, 'HH:mm')}`);
        // }

        current = addMinutes(current, step);
    }
    return possibleSlots;
}

function isCollaboratorAvailable(collabId: string, interval: TimeRange, ctx: AvailabilityContext): boolean {
    const busyList = ctx.busyTimes[collabId] || [];
    const isBusy = busyList.some(busy => areIntervalsOverlapping(busy, interval));
    if (isBusy) return false;

    const dayDate = startOfDay(interval.start);
    const dayOfWeek = dayDate.getDay();

    const rules = ctx.recurringRules[collabId]?.filter(r => r.dayOfWeek == dayOfWeek);
    if (!rules || rules.length === 0) return false;

    const dailyRanges = rules.map(r => convertRuleToRange(r, dayDate));

    // Debug specific check
    const isOk = checkRanges(interval, dailyRanges);
    // console.log(`Checking ${format(interval.start, 'HH:mm')}-${format(interval.end, 'HH:mm')} against rules: ${JSON.stringify(rules)} -> ${isOk}`);
    return isOk;
}

function checkRanges(needed: TimeRange, available: TimeRange[]): boolean {
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

// --- TEST EXECUTION ---

const service = {
    id: 'srv_1',
    durationMinutes: 60,
    bufferAfterMinutes: 0,
    bufferBeforeMinutes: 30, // Testing the fix: 30 min before
    logicType: 'OR' as const
};

const candidates = [{ id: 'col_1', name: 'Davide' }];

// Monday Jan 19 2026
const day = new Date('2026-01-19T00:00:00');
const start = new Date(day); start.setHours(8, 0, 0, 0);
const end = new Date(day); end.setHours(23, 0, 0, 0);

const rules = {
    'col_1': [
        { dayOfWeek: 1, startTimeStr: '09:00', endTimeStr: '22:00' }
    ]
};

const context: AvailabilityContext = {
    service,
    candidates,
    range: { start, end },
    recurringRules: rules,
    overrides: {},
    busyTimes: {}
};

console.log(`\n\n--- Running Test ---`);
console.log(`Interval: 60m`);
console.log(`Rule: 09:00 - 22:00`);
console.log(`Global Search Range: 08:00 - 23:00`);

const slots = calculateAvailability(context);

console.log(`\nSlots Found:`);
slots.forEach(s => {
    console.log(`${format(s.start, 'HH:mm')} - ${format(s.end, 'HH:mm')}`);
});

const has21 = slots.some(s => s.start.getHours() === 21);
if (has21) {
    console.log("\n✅ SUCCESS: 21:00 slot exists.");
} else {
    console.log("\n❌ FAILURE: 21:00 slot is MISSING.");
}
