import { useState, useEffect } from 'react';
import { addMinutes, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '../../lib/supabaseClient';
import { prepareAvailabilityContext, calculateAvailability } from '../../lib/availability';
import { Calendar as CalendarIcon, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

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

            const collabs = data?.map((d: any) => d.collaborators).filter(Boolean) || [];
            setCollaborators(collabs);

            if (collabs.length > 0) {
                // Determine display name for the recap
                if (service.assignment_logic === 'AND') {
                    setSelectedCollab({ first_name: 'Team', last_name: `(${collabs.length})` });
                } else {
                    setSelectedCollab({ first_name: 'Pool', last_name: `disponibili` });
                }

                // Auto-advance to Step 3 with ALL collaborators as candidates
                fetchAvailability(collabs);
                setStep(3);
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



    async function fetchAvailability(candidatesList: any[]) {
        setLoading(true);
        try {
            if (!selectedService) return;

            // 1. Prepare Service Object
            const serviceObj: any = { // detailed-type in availability.ts
                id: selectedService.id,
                durationMinutes: selectedService.duration_minutes || 60,
                bufferAfterMinutes: selectedService.buffer_minutes || selectedService.buffer_after_minutes || 0,
                bufferBeforeMinutes: selectedService.buffer_before_minutes || 0,
                logicType: selectedService.assignment_logic || 'OR', // Use DB column
                requiredTeamSize: selectedService.required_team_size || 1
            };

            // 2. Prepare Candidates
            // Map to compact {id, name}
            const candidates = candidatesList.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }));

            // 3. Define Range based on Service Rules
            const now = new Date();

            // Respect Min Notice (default 0)
            const minNotice = Number(selectedService.min_notice_minutes) || 0;
            const start = addMinutes(now, minNotice);

            // Round up to next clean interval based on duration (or 15 min minimum)
            // This prevents "random" slots like 11:15 for a 60m service (snaps to 12:00)
            const grid = (selectedService.duration || 60) > 15 ? (selectedService.duration || 60) : 15;
            const remainder = grid - (start.getMinutes() % grid);
            if (remainder < grid) {
                start.setMinutes(start.getMinutes() + remainder);
            }
            start.setSeconds(0, 0);

            // Respect Max Advance (default 60 days)
            const maxAdvance = Number(selectedService.max_advance_days) || 60;
            const end = new Date();
            end.setDate(end.getDate() + maxAdvance);

            // 4. Prepare Context
            const ctx = await prepareAvailabilityContext(serviceObj, candidates, start, end);
            setDebugContext(ctx); // Set for UI inspection
            console.log("AVILABILITY CTX:", ctx);

            // 5. Calculate
            const slots = calculateAvailability(ctx);
            console.log("CALCULATED SLOTS:", slots);

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
                status: 'hold',
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
            if (selectedService.assignment_logic === 'AND') {
                // Assign ALL collaborators
                const assignments = collaborators.map(c => ({
                    booking_id: bookingId,
                    collaborator_id: c.id,
                    role_in_order: c.role || 'Collaborator'
                }));
                const { error: assignError } = await supabase.from('booking_assignments').insert(assignments);
                if (assignError) console.error("Assignment Error:", assignError);

            } else {
                // OR Logic: Pick ONE collaborator automatically from the available ones
                const candidateId = selectedSlot.availableCollaborators?.[0] || collaborators[0]?.id;

                await supabase.from('booking_assignments').insert({
                    booking_id: bookingId,
                    collaborator_id: candidateId
                });
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
                <div className="bg-slate-50 rounded-lg p-4 text-left mb-6 text-sm">
                    <div className="flex justify-between mb-2">
                        <span className="text-slate-500">Data:</span>
                        <span className="font-medium">{selectedSlot?.date}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Ora:</span>
                        <span className="font-medium">{selectedSlot?.time}</span>
                    </div>
                </div>
                <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium">
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
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 flex items-center justify-between animate-fade-in text-sm font-medium">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-4 hover:underline">Chiudi</button>
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
            <div className="mb-8 flex items-center justify-between text-sm text-slate-500 max-w-2xl mx-auto">
                <div className={step === 1 ? "text-blue-600 font-medium" : ""}>1. Servizio</div>
                <div className="h-[1px] bg-slate-200 flex-1 mx-4"></div>
                <div className={step === 3 ? "text-blue-600 font-medium" : ""}>2. Data & Ora</div>
                <div className="h-[1px] bg-slate-200 flex-1 mx-4"></div>
                <div className={step === 4 ? "text-blue-600 font-medium" : ""}>3. Dati Personali</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* LEFT COLUMN: Sidebar Summary (Visible from Step 2) */}
                <div className="md:col-span-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
                        <h3 className="font-bold text-lg mb-4">Riepilogo</h3>

                        {!selectedService ? (
                            <p className="text-sm text-slate-400 italic">Seleziona un servizio per iniziare</p>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Servizio</div>
                                    <div className="font-medium flex items-center gap-2">
                                        {selectedService.name}
                                    </div>
                                    <div className="text-sm text-slate-500 mt-1">{selectedService.duration || 60} min • {selectedService.price ? `€${selectedService.price}` : 'Prezzo Var.'}</div>
                                </div>

                                {selectedCollab && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Esperto</div>
                                        <div className="font-medium flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-700">
                                                {selectedCollab.first_name[0]}
                                            </div>
                                            {selectedCollab.first_name} {selectedCollab.last_name}
                                        </div>
                                    </div>
                                )}

                                {selectedSlot && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Data & Ora</div>
                                        <div className="font-medium text-blue-600">
                                            {selectedSlot.date} <br /> Ore {selectedSlot.time}
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Steps Content */}
                <div className="md:col-span-2">

                    {/* STEP 1: SERVICES */}
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <h2 className="text-2xl font-bold mb-6">Scegli un servizio</h2>
                            {/* Service List */}
                            <div className="space-y-3">
                                {loading ? <div className="p-8 text-center text-slate-400">Caricamento servizi...</div> :
                                    services.map(srv => (
                                        <div key={srv.id}
                                            onClick={() => setSelectedService(srv)}
                                            className={`
                                                p-5 rounded-xl border cursor-pointer transition-all flex justify-between items-center group
                                                ${selectedService?.id === srv.id
                                                    ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500'
                                                    : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-sm'}
                                            `}>
                                            <div>
                                                <h3 className={`font-bold text-lg transition-colors ${selectedService?.id === srv.id ? 'text-blue-700' : 'group-hover:text-blue-600'}`}>{srv.name}</h3>
                                                <p className="text-slate-500 text-sm mt-1 line-clamp-2">{srv.description || "Nessuna descrizione"}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium text-slate-900">€{srv.price || ' -'}</div>
                                                <div className="text-xs text-slate-400">{srv.duration || 60}m</div>
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Continue Button Step 1 */}
                            <div className="mt-8 flex justify-end">
                                <button
                                    disabled={!selectedService}
                                    onClick={() => handleServiceSelect(selectedService)}
                                    className={`
                                        px-8 py-3 rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2
                                        ${selectedService
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-blue-500/30 hover:scale-[1.02]'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}
                                    `}
                                >
                                    Continua <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: DATE & TIME */}
                    {step === 3 && (
                        <div className="space-y-4 animate-fade-in">
                            <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1 mb-4">
                                <ChevronLeft className="w-4 h-4" /> Indietro
                            </button>
                            <h2 className="text-2xl font-bold mb-6">Disponibilità</h2>

                            {/* CALENDAR VIEW */}
                            <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6 mb-8 animate-fade-in">
                                <h3 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-indigo-600" />
                                    Seleziona Data e Ora
                                </h3>

                                {/* Check if map is empty */}
                                {Object.keys(availabilityMap).length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 italic">
                                        Nessuna disponibilità trovata per i prossimi 60 giorni.
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
                                            <div className="grid grid-cols-7 gap-1">
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
                                                                    setSelectedSlot(null); // Clear slot when date changes
                                                                }
                                                            }}
                                                            disabled={!hasSlots}
                                                            className={`
                                                                h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm transition-all
                                                                ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                                                                ${hasSlots ? 'font-bold hover:bg-indigo-50 cursor-pointer' : 'opacity-40 cursor-default'}
                                                                ${isSelected ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700' : ''}
                                                                ${hasSlots && !isSelected ? 'text-indigo-900 bg-indigo-50/50' : ''}
                                                            `}
                                                        >
                                                            {format(day, 'd')}
                                                            {hasSlots && !isSelected && (
                                                                <div className="absolute w-1 h-1 bg-indigo-500 rounded-full mt-6"></div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* RIGHT: Slots List */}
                                        <div className="w-full md:w-64 border-l border-slate-100 pl-0 md:pl-8">
                                            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                                                Orari Disponibili
                                            </h4>
                                            {!selectedDate ? (
                                                <p className="text-sm text-slate-400 italic">Seleziona una data per vedere gli orari.</p>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3 h-64 overflow-y-auto content-start">
                                                    {availabilityMap[selectedDate]?.map(slotObj => (
                                                        <button
                                                            key={slotObj.time}
                                                            onClick={() => setSelectedSlot({ date: selectedDate, ...slotObj })}
                                                            className={`
                                                                py-2 px-3 rounded-lg text-sm font-medium border transition-all text-center
                                                                ${selectedSlot?.date === selectedDate && selectedSlot?.time === slotObj.time
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}
                                                            `}
                                                        >
                                                            {slotObj.time}
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
                                            px-8 py-3 rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2
                                            ${selectedSlot
                                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-indigo-500/30 hover:scale-[1.02]'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}
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
                        <div className="space-y-4 animate-fade-in">
                            <button onClick={() => setStep(3)} className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1 mb-4">
                                <ChevronLeft className="w-4 h-4" /> Indietro
                            </button>
                            <h2 className="text-2xl font-bold mb-6">I tuoi dati</h2>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Nome *</label>
                                    <input type="text" className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={customerForm.firstName} onChange={e => setCustomerForm({ ...customerForm, firstName: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700">Cognome *</label>
                                    <input type="text" className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={customerForm.lastName} onChange={e => setCustomerForm({ ...customerForm, lastName: e.target.value })} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-sm font-medium text-slate-700">Email *</label>
                                    <input type="email" className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-sm font-medium text-slate-700">Note aggiuntive</label>
                                    <textarea className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-24"
                                        value={customerForm.notes} onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })}></textarea>
                                </div>
                            </div>

                            <button onClick={submitBooking} disabled={loading} className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : 'Conferma Prenotazione'}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
