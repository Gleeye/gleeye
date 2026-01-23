import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { supabase } from './supabaseClient';
import type {
    AvailabilityContext,
    AvailabilityRule,
    AvailabilityOverride,
    TimeRange,
    Service,
    Collaborator
} from './availability_logic';

// Re-export everything from logic so consumers don't break
export * from './availability_logic';

// --- Orchestrator ---
export async function prepareAvailabilityContext(
    service: Service,
    candidates: Collaborator[],
    start: Date,
    end: Date
): Promise<AvailabilityContext> {
    const collabIds = candidates.map(c => c.id);

    // 0. Fetch Timezones
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
