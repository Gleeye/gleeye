
import { calculateAvailability, AvailabilityContext } from './src/lib/availability';
import { addHours, setHours, setMinutes, startOfDay } from 'date-fns';

// Mock Data
const service = {
    id: 'srv_1',
    durationMinutes: 60,
    bufferMinutes: 0,
    logicType: 'OR' as const
};

const candidates = [
    { id: 'col_1', name: 'Davide' }
];

const day = new Date('2026-01-19T00:00:00'); // Local time
const start = setHours(day, 8);
const end = setHours(day, 23);

const range = { start, end };

const rules = {
    'col_1': [
        { dayOfWeek: 1, startTimeStr: '09:00', endTimeStr: '22:00' } // Monday 19th is day 1
    ]
};

const context: AvailabilityContext = {
    service,
    candidates,
    range,
    recurringRules: rules,
    overrides: {},
    busyTimes: {}
};

console.log("--- Testing Availability Calculation ---");
console.log(`Service Duration: ${service.durationMinutes}m`);
console.log(`Rule: 09:00 - 22:00`);

const slots = calculateAvailability(context);

console.log(`Found ${slots.length} slots:`);
slots.forEach(s => {
    const sTime = s.start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const eTime = s.end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    console.log(`Slot: ${sTime} - ${eTime}`);
});

const lastSlot = slots[slots.length - 1];
if (lastSlot) {
    const lastStart = lastSlot.start.getHours();
    if (lastStart === 21) {
        console.log("SUCCESS: 21:00 slot found.");
    } else {
        console.log("FAILURE: 21:00 slot MISSING. Last detected is " + lastStart + ":00");
    }
} else {
    console.log("FAILURE: No slots found.");
}
