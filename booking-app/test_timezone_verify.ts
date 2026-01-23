import { calculateAvailability, AvailabilityContext, Slot, AvailabilityRule, AvailabilityOverride } from './src/lib/availability_logic';
import { addDays, set } from 'date-fns';

// Mock Data
const service = {
    id: 'svc_1',
    durationMinutes: 60,
    bufferAfterMinutes: 0,
    bufferBeforeMinutes: 0,
    logicType: 'OR' as const,
    requiredTeamSize: 1
};

const collaborator = {
    id: 'collab_tokyo',
    name: 'Tokyo User',
    timezone: 'Asia/Tokyo'
};

// Test Date: Jan 20th 2026
// Tokyo is UTC+9.
// Rule: 09:00 - 12:00 (Tokyo Time)
// = 00:00 - 03:00 (UTC)
const testDateStr = '2026-01-20';

const recurringRules: Record<string, AvailabilityRule[]> = {
    'collab_tokyo': [
        { dayOfWeek: 2, startTimeStr: '09:00', endTimeStr: '12:00' } // Tuesday
    ]
};

const context: AvailabilityContext = {
    service,
    candidates: [collaborator],
    range: {
        start: new Date('2026-01-20T00:00:00Z'),
        end: new Date('2026-01-20T12:00:00Z')
    },
    recurringRules,
    overrides: {},
    busyTimes: {},
    timezones: {
        'collab_tokyo': 'Asia/Tokyo'
    }
};

console.log('Running Timezone Verification...');
const slots = calculateAvailability(context);

console.log(`Found ${slots.length} slots for Tokyo User (available 9am-12pm JST):`);
slots.forEach(s => {
    console.log(`- UTC: ${s.start.toISOString()} to ${s.end.toISOString()}`);
    // Expected: 00:00Z, 01:00Z, 02:00Z
});

// Check expectations
const has00Z = slots.some(s => s.start.toISOString().includes('T00:00:00'));
const has03Z = slots.some(s => s.start.toISOString().includes('T03:00:00')); // Should NOT exist (end is 3am, so last slot is 2-3)

if (has00Z && !has03Z) {
    console.log('✅ SUCCESS: Slots correctly shifted to UTC matching Tokyo time.');
} else {
    console.error('❌ FAILURE: Slots do not match expected UTC calculation.');
}
