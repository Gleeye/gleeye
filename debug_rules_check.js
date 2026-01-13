const { addMinutes, areIntervalsOverlapping, isWithinInterval, startOfDay, format } = require('date-fns');

// --- Mock Data ---
const SERVICE = {
    id: 'mock-service',
    durationMinutes: 60,
    bufferMinutes: 0,
    logicType: 'OR',
    requiredTeamSize: 1
};
const RULES = {
    'mock': [{ dayOfWeek: 1, startTimeStr: '09:00', endTimeStr: '18:00' }] // Monday
};
const BUSY = { 'mock': [] };
const OVERRIDES = { 'mock': [] };

// --- SIMULATION ---
function run() {
    console.log("--- TEST SERVICE RULES ---");
    const now = new Date('2026-01-11T10:00:00'); // Sunday

    // Scenario 1: Min Notice 24h (1440m)
    // Should NOT show Monday (tomorrow) slots if < 24h away?
    // Monday 09:00 is < 24h away from Sunday 10:00 (23h).

    // Logic from BookingWizard:
    const minNotice = 1440;
    let start = addMinutes(now, minNotice);
    // Rounding
    let r = 15 - (start.getMinutes() % 15);
    start.setMinutes(start.getMinutes() + r);
    start.setSeconds(0, 0);

    console.log(`Now: ${now.toISOString()}`);
    console.log(`Min Notice: ${minNotice}m`);
    console.log(`Calc Start: ${start.toISOString()}`);

    // Check Date
    const nextMonday = new Date('2026-01-12T09:00:00'); // Target Slot
    console.log(`Next Monday 09:00 >= Start? ${nextMonday >= start}`);
}

run();
