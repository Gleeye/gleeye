import { useState, useEffect } from 'react';
import { addMinutes, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '../../lib/supabaseClient';
import { prepareAvailabilityContext, calculateAvailability } from '../../lib/availability';
import { Calendar as CalendarIcon, CheckCircle, ChevronLeft, ChevronRight, Clock, Sparkles } from 'lucide-react';

export default function BookingWizard() {
    const [step, setStep] = useState(1);
    const [services, setServices] = useState<any[]>([]);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [selectedCollab, setSelectedCollab] = useState<any>(null);
    // const [availability, setAvailability] = useState<any[]>([]); // Removed in favor of AvailabilityMap
    const [selectedSlot, setSelectedSlot] = useState<any>(null); // { date, time }
    const [customerForm, setCustomerForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        role: '',
        notes: ''
    });
    const [, setBookingRef] = useState<string | null>(null);
    const [debugContext, setDebugContext] = useState<any>(null); // DEBUG STATE
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [availabilityMap, setAvailabilityMap] = useState<Record<string, any[]>>({});
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Parse URL params on load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const serviceId = params.get('service_id');
        fetchServices(serviceId);
    }, []);

    async function fetchServices(preselectId: string | null) {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('booking_items')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;

            // Map duration_minutes to duration for frontend compatibility if needed
            const mappedData = data?.map(item => ({
                ...item,
                duration: item.duration_minutes // Map for UI consistency
            })) || [];

            setServices(mappedData);

            if (preselectId) {
                const found = mappedData.find(s => s.id === preselectId);
                if (found) {
                    handleServiceSelect(found);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleServiceSelect(service: any) {
        setSelectedService(service);
        setLoading(true);
        // Fetch collaborators for this service
        try {
            const { data, error } = await supabase
                .from('booking_item_collaborators')
                .select('collaborator_id, collaborators(id, first_name, last_name, avatar_url, role)')
                .eq('booking_item_id', service.id);

            if (error) throw error;

            console.log('[BookingWizard] Raw booking_item_collaborators response:', data);
            const collabs = data?.map((d: any) => d.collaborators).filter(Boolean) || [];
            console.log('[BookingWizard] Parsed collaborators:', collabs.length, collabs);
            setCollaborators(collabs);

            if (collabs.length > 0) {
                // Determine display name for the recap
                if (service.assignment_logic === 'AND') {
                    setSelectedCollab({ first_name: 'Team', last_name: `(${collabs.length})` });
                } else {
                    setSelectedCollab({ first_name: 'Pool', last_name: `disponibili` });
                }

                // Auto-advance to Step 3 with ALL collaborators as candidates
                // Auto-advance to Step 3 with ALL collaborators as candidates
                setStep(3);
                await fetchAvailability(service, collabs);
            } else {
                setError("Nessun coordinatore/esperto assegnato a questo servizio.");
            }

        } catch (err: any) {
            console.error(err);
            setError("Errore nel recupero collaboratori.");
        } finally {
            setLoading(false);
        }
    }



    async function fetchAvailability(service: any, candidatesList: any[]) {
        setLoading(true);
        setAvailabilityMap({}); // Clear old data
        try {
            if (!service) return;

            // 1. Prepare Service Object
            const serviceObj: any = { // detailed-type in availability.ts
                id: service.id,
                durationMinutes: service.duration_minutes || 60,
                bufferAfterMinutes: service.buffer_minutes || service.buffer_after_minutes || 0,
                bufferBeforeMinutes: service.buffer_before_minutes || 0,
                logicType: service.assignment_logic || 'OR', // Use DB column
                requiredTeamSize: service.required_team_size || 1
            };

            // 2. Prepare Candidates
            // Map to compact {id, name}
            const candidates = candidatesList.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }));

            // 3. Define Range based on Service Rules
            const now = new Date();

            // Respect Min Notice (default 0)
            const minNotice = Number(service.min_notice_minutes) || 0;
            const start = addMinutes(now, minNotice);

            // Round up to next clean interval based on duration (or 15 min minimum)
            // This prevents "random" slots like 11:15 for a 60m service (snaps to 12:00)
            const serviceDuration = service.duration_minutes || service.duration || 60;
            const grid = serviceDuration > 15 ? serviceDuration : 15;
            const remainder = grid - (start.getMinutes() % grid);
            if (remainder < grid) {
                start.setMinutes(start.getMinutes() + remainder);
            }
            start.setSeconds(0, 0);

            // Respect Max Advance (default 60 days)
            const maxAdvance = Number(service.max_advance_days) || 60;
            const end = new Date();
            end.setDate(end.getDate() + maxAdvance);

            // 4. Prepare Context
            const ctx = await prepareAvailabilityContext(serviceObj, candidates, start, end);
            setDebugContext(ctx); // Set for UI inspection
            console.log("[BookingWizard] Search Start:", start.toISOString(), "End:", end.toISOString());
            console.log("[BookingWizard] Candidates for service:", candidates.map(c => c.name));
            console.log("[BookingWizard] Fetched Rules for candidates:", Object.keys(ctx.recurringRules));

            // 5. Calculate
            const slots = calculateAvailability(ctx);
            console.log("[BookingWizard] Total calculated slots:", slots.length);

            // 6. Map to UI
            const groupedArgs: Record<string, any[]> = {};
            slots.forEach(s => {
                const d = format(s.start, 'yyyy-MM-dd');
                const t = s.start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                if (!groupedArgs[d]) groupedArgs[d] = [];
                groupedArgs[d].push({
                    time: t,
                    start: s.start,
                    availableCollaborators: s.availableCollaborators
                });
            });

            setAvailabilityMap(groupedArgs);
            // setAvailability([]); // Legacy clear removed

            // Auto select first available date if nothing selected? No, user wants calendar.
            // But we can center calendar on first avail date.
            const sortedDates = Object.keys(groupedArgs).sort();
            if (sortedDates.length > 0) {
                setCurrentMonth(new Date(sortedDates[0]));
            }

        } catch (e) {
            console.error(e);
            setError("Errore nel calcolo disponibilità reale.");
        } finally {
            setLoading(false);
        }
    }

    async function submitBooking() {
        setLoading(true);
        try {
            if (!selectedSlot || !selectedService) return;

            // Construct start/end timestamps
            const startDateTime = new Date(`${selectedSlot.date}T${selectedSlot.time}:00`);
            const durationMinutes = selectedService.duration || 60;
            const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

            const bookingId = self.crypto.randomUUID();

            const payload = {
                id: bookingId,
                booking_item_id: selectedService.id,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                status: selectedService.requires_confirmation ? 'hold' : 'confirmed',
                notes: customerForm.notes,
                guest_info: {
                    first_name: customerForm.firstName,
                    last_name: customerForm.lastName,
                    email: customerForm.email,
                    phone: customerForm.phone,
                    company: customerForm.company,
                    role: customerForm.role,
                    selected_collaborator_id: selectedCollab?.id,
                    selected_collaborator_name: `${selectedCollab?.first_name} ${selectedCollab?.last_name}`
                }
            };

            const { error } = await supabase
                .from('bookings')
                .insert([payload]);

            if (error) throw error;

            // Also insert into booking_assignments for sync
            console.log('[BookingWizard] Creating assignments...');
            console.log('[BookingWizard] Assignment Logic:', selectedService.assignment_logic);
            console.log('[BookingWizard] Collaborators available:', collaborators.length, collaborators.map(c => c.id));

            if (selectedService.assignment_logic === 'AND') {
                // Assign ALL collaborators
                const assignments = collaborators.map(c => ({
                    booking_id: bookingId,
                    collaborator_id: c.id,
                    role_in_order: c.role || 'Collaborator'
                }));
                console.log('[BookingWizard] AND mode: inserting', assignments.length, 'assignments');
                if (assignments.length > 0) {
                    const { error: assignError } = await supabase.from('booking_assignments').insert(assignments);
                    if (assignError) console.error("Assignment Error (AND):", assignError);
                    else console.log('[BookingWizard] AND assignments created successfully');
                } else {
                    console.warn('[BookingWizard] No collaborators to assign (AND mode)');
                }

            } else {
                // OR Logic: Pick ONE collaborator automatically from the available ones
                // Fallback to the first collaborator of the service if slots don't have IDs
                const candidateId = selectedSlot?.availableCollaborators?.[0] || collaborators[0]?.id;

                if (candidateId) {
                    const { error: assignError } = await supabase.from('booking_assignments').insert({
                        booking_id: bookingId,
                        collaborator_id: candidateId,
                        role_in_order: 'Collaborator'
                    });
                    if (assignError) console.error("Assignment Error (OR):", assignError);
                } else {
                    console.error("No candidate found for assignment");
                }
            }

            setBookingRef(bookingId);
            setStep(5); // Success

        } catch (err: any) {
            console.error("Booking Error:", err);
            setError(err.message || "Errore durante la prenotazione.");
        } finally {
            setLoading(false);
        }
    }

    // --- RENDER HELPERS ---

    if (step === 5) {
        return (
            <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mt-10 animate-fade-in">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Prenotazione Inviata!</h2>
                <p className="text-slate-500 mb-6">
                    Grazie {customerForm.firstName}, abbiamo ricevuto la tua richiesta per
                    <strong> {selectedService?.name}</strong> con <strong>{selectedCollab?.first_name}</strong>.
                </p>
                <div className="bg-slate-50/80 rounded-2xl p-6 text-left mb-8 border border-slate-100">
                    <div className="flex justify-between mb-4 border-b border-slate-200 pb-2">
                        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Data</span>
                        <span className="font-bold text-slate-800">{selectedSlot?.date}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Ora</span>
                        <span className="font-bold text-slate-800">{selectedSlot?.time}</span>
                    </div>
                </div>
                <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl">
                    Nuova Prenotazione
                </button>
            </div>
        );
    }

    const debugServiceId = new URLSearchParams(window.location.search).get('service_id');

    return (
        <div className="max-w-4xl mx-auto mt-6 px-4 pb-20">
            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-6 flex items-center justify-between animate-fade-in-up text-sm font-medium shadow-sm">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-4 hover:underline opacity-70 hover:opacity-100">Chiudi</button>
                </div>
            )}

            {/* Debug Info */}
            {debugServiceId && (
                <div className="bg-amber-50 text-amber-900 p-3 text-xs font-mono mb-6 rounded-lg border border-amber-200 shadow-sm overflow-auto max-h-60">
                    <strong>DEBUG MODE v1.3 (Aligned):</strong> <br />
                    Service: {selectedService ? selectedService.name : 'None'} ({selectedService?.duration} min) <br />
                    Logic: {selectedService?.assignment_logic} (Required Team: {selectedService?.required_team_size}) <br />
                    Grid Size: {(selectedService?.duration || 60) > 15 ? (selectedService?.duration || 60) : 15} min <br />
                    {debugContext && (
                        <div className="mt-2 pt-2 border-t border-amber-200">
                            <strong>Availability Context:</strong><br />
                            Calc Range: {format(debugContext.range.start, 'dd/MM HH:mm')} - {format(debugContext.range.end, 'dd/MM HH:mm')}<br />
                            Rules Found: {Object.values(debugContext.recurringRules).flat().length}<br />
                            Busy Slots: {Object.values(debugContext.busyTimes).flat().length}<br />

                            <details className="cursor-pointer mt-1">
                                <summary>Show Busy Details</summary>
                                <pre>{JSON.stringify(debugContext.busyTimes, null, 2)}</pre>
                            </details>
                            <details className="cursor-pointer mt-1">
                                <summary>Show Rules</summary>
                                <pre>{JSON.stringify(debugContext.recurringRules, null, 2)}</pre>
                            </details>
                        </div>
                    )}
                </div>
            )}

            {/* Progress Bar */}
            <div className="max-w-lg mx-auto flex items-center justify-between mb-16 text-sm font-medium text-slate-400 relative">
                {/* Progress Bar Background */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
                {/* Active Progress */}
                <div className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-[#4e92d8] to-[#614aa2] -z-10 rounded-full transition-all duration-500 ease-out"
                    style={{ width: step === 1 ? '16%' : step === 2 ? '50%' : step === 3 ? '82%' : '100%' }}></div>

                {/* Step 1 */}
                <div className={`bg-white px-2 transition-colors duration-300 ${step >= 1 ? "text-[#4e92d8] font-bold" : ""}`}>1. Servizio</div>
                {/* Step 2 */}
                <div className={`bg-white px-2 transition-colors duration-300 ${step >= 3 ? "text-[#614aa2] font-bold" : ""}`}>2. Data & Ora</div>
                {/* Step 3 */}
                <div className={`bg-white px-2 transition-colors duration-300 ${step >= 4 ? "text-[#614aa2] font-bold" : ""}`}>3. Dati</div>
            </div>

            {/* MAIN CONTENT (Single Column) */}
            <div className="max-w-3xl mx-auto">
                <div className="lg:w-full">
                    {/* STEP 1: SERVICES */}
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in-up">
                            <h2 className="text-3xl font-bold mb-8 text-slate-900 tracking-tight">Scegli un servizio</h2>
                            {/* Service List */}
                            <div className="grid grid-cols-1 gap-4">
                                {loading ? <div className="p-12 text-center text-slate-400 animate-pulse">Caricamento servizi...</div> :
                                    services.map(srv => (
                                        <div key={srv.id}
                                            onClick={() => handleServiceSelect(srv)}
                                            className={`
                                            p-6 rounded-2xl border cursor-pointer transition-all duration-300 relative overflow-hidden group hover:shadow-lg
                                            ${selectedService?.id === srv.id
                                                    ? 'bg-white border-[#4e92d8] shadow-lg shadow-blue-500/10 ring-1 ring-[#4e92d8]'
                                                    : 'bg-white border-slate-100 hover:border-[#4e92d8]/50'}
                                        `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className={`text-xl font-bold mb-1 group-hover:text-[#4e92d8] transition-colors ${selectedService?.id === srv.id ? 'text-[#4e92d8]' : 'text-slate-800'}`}>{srv.name}</h3>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500">
                                                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                                                            <Clock className="w-3 h-3" /> {srv.duration || 60} min
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${selectedService?.id === srv.id ? 'bg-gradient-to-r from-[#4e92d8] to-[#614aa2] text-white' : 'bg-slate-100 text-slate-300 group-hover:bg-blue-50 group-hover:text-[#4e92d8]'}`}>
                                                    <ChevronRight className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Continue Button Step 1 */}
                            <div className="mt-10 flex justify-end">
                                <button
                                    disabled={!selectedService}
                                    onClick={() => handleServiceSelect(selectedService)}
                                    className={`
                                    px-8 py-4 rounded-xl font-bold shadow-xl transition-all flex items-center gap-2 transform active:scale-95
                                    ${selectedService
                                            ? 'bg-gradient-to-r from-[#4e92d8] to-[#614aa2] text-white hover:shadow-blue-500/30 hover:opacity-90'
                                            : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}
                                `}
                                >
                                    Continua <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: DATE & TIME */}
                    {step === 3 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <button onClick={() => setStep(1)} className="text-slate-400 hover:text-indigo-600 text-sm font-medium flex items-center gap-1 mb-2 transition-colors">
                                <ChevronLeft className="w-4 h-4" /> Indietro
                            </button>
                            <h2 className="text-3xl font-bold mb-8 text-slate-900 tracking-tight">Disponibilità</h2>

                            {/* CALENDAR VIEW */}
                            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 animate-fade-in-up">
                                <h3 className="text-xl font-bold mb-8 text-slate-800 flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 rounded-lg">
                                        <CalendarIcon className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    Seleziona Data e Ora
                                </h3>

                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                        <p className="text-slate-500 font-medium">Sincronizzazione calendari e disponibilità...</p>
                                        <p className="text-xs text-slate-400 mt-2">Stiamo verificando gli slot liberi in tempo reale</p>
                                    </div>
                                ) : Object.keys(availabilityMap).length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                        <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <h4 className="font-bold text-slate-800 mb-1">Nessuna disponibilità</h4>
                                        <p className="text-sm text-slate-500">Non ci sono slot disponibili per i prossimi 60 giorni.</p>
                                        <button onClick={() => setStep(1)} className="mt-6 text-indigo-600 font-bold hover:underline">
                                            Cambia servizio
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col md:flex-row gap-8">
                                        {/* LEFT: Calendar Grid */}
                                        <div className="flex-1">
                                            {/* Header: Month Navigation */}
                                            <div className="flex items-center justify-between mb-4">
                                                <button
                                                    onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <h4 className="text-lg font-semibold text-slate-700 capitalize">
                                                    {format(currentMonth, 'MMMM yyyy', { locale: it })}
                                                </h4>
                                                <button
                                                    onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Weekday Headers */}
                                            <div className="grid grid-cols-7 mb-2 text-center">
                                                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(d => (
                                                    <div key={d} className="text-xs font-bold text-slate-400 py-1">{d}</div>
                                                ))}
                                            </div>

                                            {/* Days Grid */}
                                            <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                                                {eachDayOfInterval({
                                                    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
                                                    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
                                                }).map(day => {
                                                    const dateKey = format(day, 'yyyy-MM-dd');
                                                    const hasSlots = !!availabilityMap[dateKey];
                                                    const isSelected = selectedDate === dateKey;
                                                    const isCurrentMonth = isSameMonth(day, currentMonth);

                                                    return (
                                                        <button
                                                            key={dateKey}
                                                            onClick={() => {
                                                                if (hasSlots) {
                                                                    setSelectedDate(dateKey);
                                                                    setSelectedSlot(null);
                                                                }
                                                            }}
                                                            disabled={!hasSlots}
                                                            className={`
                                                                    h-10 w-10 mx-auto rounded-full flex flex-col items-center justify-center text-sm transition-all duration-300 relative group
                                                                    ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                                                                    ${hasSlots ? 'font-bold hover:bg-blue-50 hover:text-[#4e92d8] cursor-pointer' : 'opacity-30 cursor-default'}
                                                                    ${isSelected ? 'bg-gradient-to-r from-[#4e92d8] to-[#614aa2] text-white shadow-lg shadow-blue-500/40 hover:opacity-90 transform scale-110 z-10' : ''}
                                                                    ${hasSlots && !isSelected ? 'text-slate-900 bg-white' : ''}
                                                                `}
                                                        >
                                                            <span className="relative z-10">{format(day, 'd')}</span>
                                                            {hasSlots && !isSelected && (
                                                                <div className="absolute bottom-1 w-1 h-1 bg-[#4e92d8] rounded-full group-hover:scale-150 transition-transform"></div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* RIGHT: Slots List */}
                                        <div className="w-full md:w-64 border-l border-slate-100 pl-0 md:pl-8">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                                Orari Disponibili
                                            </h4>
                                            {!selectedDate ? (
                                                <div className="h-48 flex items-center justify-center text-center">
                                                    <p className="text-sm text-slate-400 italic">Seleziona un giorno<br />nel calendario.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3 h-64 overflow-y-auto content-start pr-2 custom-scrollbar">
                                                    {availabilityMap[selectedDate]?.map(slotObj => (
                                                        <button
                                                            key={slotObj.time}
                                                            onClick={() => setSelectedSlot({ date: selectedDate, ...slotObj })}
                                                            className={`
                                                            py-2 px-3 rounded-lg text-sm font-medium border transition-all text-center duration-200
                                                            ${selectedSlot?.date === selectedDate && selectedSlot?.time === slotObj.time
                                                                    ? 'bg-gradient-to-r from-[#4e92d8] to-[#614aa2] text-white border-transparent shadow-md shadow-blue-500/20'
                                                                    : 'bg-white text-slate-700 border-slate-100 hover:border-blue-200 hover:text-[#4e92d8] hover:bg-blue-50/50 hover:shadow-sm'}
                                                        `}
                                                        >
                                                            {slotObj.time} - {format(addMinutes(new Date(slotObj.start), selectedService?.duration || 60), 'HH:mm')}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Continue Button */}
                                <div className="mt-8 flex justify-end">
                                    <button
                                        disabled={!selectedSlot}
                                        onClick={() => setStep(4)}
                                        className={`
                                        px-8 py-4 rounded-xl font-bold shadow-xl transition-all flex items-center gap-2 transform active:scale-95
                                        ${selectedSlot
                                                ? 'bg-gradient-to-r from-[#4e92d8] to-[#614aa2] text-white hover:shadow-blue-500/30'
                                                : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}
                                    `}
                                    >
                                        Continua <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: FORM */}
                    {step === 4 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <button onClick={() => setStep(3)} className="text-slate-400 hover:text-[#4e92d8] text-sm font-medium flex items-center gap-1 mb-2 transition-colors">
                                <ChevronLeft className="w-4 h-4" /> Indietro
                            </button>
                            <h2 className="text-3xl font-bold mb-8 text-slate-900 tracking-tight">I tuoi dati</h2>

                            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Row 1: Name & Surname */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome *</label>
                                        <input type="text" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#4e92d8]/20 focus:border-[#4e92d8] outline-none transition-all font-medium"
                                            value={customerForm.firstName} onChange={e => setCustomerForm({ ...customerForm, firstName: e.target.value })} placeholder="Il tuo nome" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Cognome *</label>
                                        <input type="text" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#4e92d8]/20 focus:border-[#4e92d8] outline-none transition-all font-medium"
                                            value={customerForm.lastName} onChange={e => setCustomerForm({ ...customerForm, lastName: e.target.value })} placeholder="Il tuo cognome" />
                                    </div>

                                    {/* Row 2: Email & Phone */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email *</label>
                                        <input type="email" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#4e92d8]/20 focus:border-[#4e92d8] outline-none transition-all font-medium field-icon-email"
                                            value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="nome@azienda.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Telefono *</label>
                                        <input type="tel" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#4e92d8]/20 focus:border-[#4e92d8] outline-none transition-all font-medium"
                                            value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="+39 333 1234567" />
                                    </div>

                                    {/* Row 3: Company & Role */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Azienda *</label>
                                        <input type="text" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#4e92d8]/20 focus:border-[#4e92d8] outline-none transition-all font-medium"
                                            value={customerForm.company} onChange={e => setCustomerForm({ ...customerForm, company: e.target.value })} placeholder="Nome azienda" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Ruolo (Opzionale)</label>
                                        <input type="text" className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#4e92d8]/20 focus:border-[#4e92d8] outline-none transition-all font-medium"
                                            value={customerForm.role} onChange={e => setCustomerForm({ ...customerForm, role: e.target.value })} placeholder="CEO, Manager, etc." />
                                    </div>

                                    {/* Row 4: Notes (Full Width) */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Note (Opzionale)</label>
                                        <textarea className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#4e92d8]/20 focus:border-[#4e92d8] outline-none transition-all font-medium min-h-[120px] resize-y"
                                            value={customerForm.notes} onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })} placeholder="Hai richieste particolari?"></textarea>
                                    </div>
                                </div>

                                <button
                                    onClick={submitBooking}
                                    disabled={loading || !customerForm.firstName || !customerForm.lastName || !customerForm.email || !customerForm.phone || !customerForm.company}
                                    className={`
                                    w-full mt-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-3 transform active:scale-[0.99]
                                    ${(!customerForm.firstName || !customerForm.lastName || !customerForm.email || !customerForm.phone || !customerForm.company)
                                            ? 'opacity-50 cursor-not-allowed hover:bg-slate-900 hover:shadow-none bg-slate-900'
                                            : 'bg-gradient-to-r from-[#4e92d8] to-[#614aa2]'}
                                `}>
                                    {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : 'Conferma Prenotazione'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* FOOTER / SUMMARY SECTION (Moved Bottom) */}
            <div className="max-w-3xl mx-auto mt-12 mb-8">
                {selectedService && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-slate-200/40 border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-500 hover:shadow-xl">
                        <div className="flex items-center gap-4 w-full">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4e92d8] to-[#614aa2] flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 tracking-tight">{selectedService.name}</h3>
                                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                    <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                        <Clock className="w-3 h-3 text-[#4e92d8]" /> {selectedService.duration || 60} min
                                    </span>
                                    {selectedSlot && (
                                        <span className="flex items-center gap-1 text-[#614aa2] font-semibold">
                                            <CalendarIcon className="w-3 h-3" />
                                            {format(new Date(selectedSlot.start), 'd MMM, HH:mm', { locale: it })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Step Indicator (Compact) */}
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#4e92d8] whitespace-nowrap bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100/50">
                            Step {step} di 3
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
