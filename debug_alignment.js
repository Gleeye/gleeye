const { addMinutes, areIntervalsOverlapping, isWithinInterval, startOfDay, format } = require('date-fns');

// --- Mock Data ---
const SERVICE = {
    id: 'mock-service',
    durationMinutes: 60,
    min_notice_minutes: 1440
};

// --- SIMULATION of Alignment ---
function run() {
    console.log("--- TEST ALIGNMENT ---");
    const now = new Date('2026-01-11T12:00:00'); // Sunday noon

    // Min Notice 24h -> Monday 12:00
    // But what if Min Notice + Now = Monday 12:15?

    // Test Case: Notice lands on :15
    const now2 = new Date('2026-01-11T12:15:00');

    const minNotice = Number(SERVICE.min_notice_minutes) || 0;
    let start = addMinutes(now2, minNotice);
    // start is Monday 12:15

    console.log(`Raw Start: ${start.toISOString()}`);

    // Alignment Logic
    const grid = (SERVICE.durationMinutes || 60) > 15 ? SERVICE.durationMinutes : 15;
    const remainder = grid - (start.getMinutes() % grid);
    if (remainder < grid) {
        start.setMinutes(start.getMinutes() + remainder);
    }
    start.setSeconds(0, 0);

    console.log(`Aligned Start: ${start.toISOString()}`);
    // Should be 13:00 because 12:15 + 45min = 13:00

    // Verify Grid is 60
    console.log(`Grid used: ${grid}`);
}

run();
