const { addMinutes, areIntervalsOverlapping, isWithinInterval, startOfDay, format } = require('date-fns');

// --- Mock Data ---
const SERVICE = {
    id: 'mock-service',
    durationMinutes: 60, // 1 hour -> Step should be 60
    bufferMinutes: 0,
    logicType: 'OR',
    requiredTeamSize: 1
};

const COLLAB_ID = 'mock-collab';
const CANDIDATES = [{ id: COLLAB_ID, name: 'Davide' }];

const RULES = {
    [COLLAB_ID]: [{ dayOfWeek: 1, startTimeStr: '09:00', endTimeStr: '18:00' }]
};

const BUSY = { [COLLAB_ID]: [] };
const OVERRIDES = { [COLLAB_ID]: [] };

// --- SIMULATION ENGINE (Updated) ---
function calculateAvailability(ctx) {
    const { service, candidates, range } = ctx;
    // UPDATED: STEP = DURATION
    const step = service.durationMinutes > 0 ? service.durationMinutes : 15;
    const totalDuration = service.durationMinutes + service.bufferMinutes;
    const possibleSlots = [];

    let current = new Date(range.start);
    const endLimit = new Date(range.end);

    console.log(`Step size: ${step} min`);

    while (addMinutes(current, totalDuration) <= endLimit) {
        const slotStart = new Date(current);
        const slotEnd = addMinutes(current, service.durationMinutes);
        const fullEnd = addMinutes(current, totalDuration);

        const freeCollaborators = candidates.filter(collab =>
            isCollaboratorAvailable(collab.id, { start: slotStart, end: fullEnd }, ctx)
        );

        if (freeCollaborators.length > 0) {
            possibleSlots.push({ start: slotStart, end: slotEnd });
        }
        current = addMinutes(current, step);
    }
    return possibleSlots;
}

function isCollaboratorAvailable(collabId, interval, ctx) {
    const dayDate = startOfDay(interval.start);
    // UPDATED: Use format
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const dayOfWeek = dayDate.getDay();

    const rules = ctx.recurringRules[collabId]?.filter(r => r.dayOfWeek == dayOfWeek);
    if (!rules || rules.length === 0) return false;

    const dailyRanges = rules.map(r => convertRuleToRange(r, dayDate));
    return checkRanges(interval, dailyRanges);
}

function checkRanges(needed, available) {
    return available.some(avail =>
        isWithinInterval(needed.start, avail) && isWithinInterval(needed.end, avail)
    );
}

function convertRuleToRange(rule, date) {
    const [startH, startM] = rule.startTimeStr.split(':').map(Number);
    const [endH, endM] = rule.endTimeStr.split(':').map(Number);
    const start = new Date(date); start.setHours(startH, startM, 0, 0);
    const end = new Date(date); end.setHours(endH, endM, 0, 0);
    return { start, end };
}

// --- RUN SIMULATION ---
async function run() {
    // Test Jan 12 2026 (Monday)
    const range = {
        start: new Date(2026, 0, 12, 9, 0, 0),
        end: new Date(2026, 0, 12, 18, 0, 0)
    };

    const ctx = {
        service: SERVICE,
        candidates: CANDIDATES,
        range: range,
        recurringRules: RULES,
        overrides: OVERRIDES,
        busyTimes: BUSY
    };

    const slots = calculateAvailability(ctx);
    console.log(`Found ${slots.length} slots.`);
    slots.forEach(s => console.log(s.start.toLocaleTimeString()));
}

run();
