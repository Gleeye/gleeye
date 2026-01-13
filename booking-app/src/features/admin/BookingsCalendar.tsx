import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth, addDays, startOfDay, addHours, eachHourOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trash2, Filter, Layers, Users, Grid, List as ListIcon } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

interface Collaborator {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
}

interface Service {
    id: string;
    name: string;
}

interface Booking {
    id: string;
    start_time: string;
    end_time: string;
    status: 'hold' | 'confirmed' | 'cancelled';
    guest_info: {
        first_name: string;
        last_name: string;
        email: string;
    };
    booking_items?: {
        name: string;
    };
}

export default function BookingsCalendar() {
    const { showToast } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [, setLoading] = useState(false);

    // Filters
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [statusFilter, setStatusFilter] = useState<'all' | 'hold' | 'confirmed' | 'cancelled'>('all');
    const [activeCollab, setActiveCollab] = useState<string | 'all'>('all');
    const [activeService, setActiveService] = useState<string | 'all'>('all');

    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; bookingId: string | null }>({ isOpen: false, bookingId: null });

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [currentDate, statusFilter, activeCollab, activeService, viewMode]);

    async function fetchInitialData() {
        try {
            const { data: collabData } = await supabase.from('collaborators').select('id, first_name, last_name, avatar_url').order('first_name');
            if (collabData) setCollaborators(collabData);

            const { data: serviceData } = await supabase.from('booking_items').select('id, name').order('name');
            if (serviceData) setServices(serviceData);
        } catch (err) {
            console.error(err);
        }
    }

    async function fetchBookings() {
        setLoading(true);
        let start, end;

        if (viewMode === 'month') {
            start = startOfMonth(currentDate);
            end = endOfMonth(currentDate);
        } else if (viewMode === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        } else {
            start = startOfDay(currentDate);
            end = addDays(start, 1);
        }

        let query = supabase
            .from('bookings')
            .select('*, booking_items(name), booking_assignments(collaborator_id)')
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .order('start_time', { ascending: true });

        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        if (activeService !== 'all') {
            query = query.eq('booking_item_id', activeService);
        }

        const { data, error } = await query;

        if (!error && data) {
            let filteredData = data;
            if (activeCollab !== 'all') {
                filteredData = data.filter((b: any) =>
                    b.booking_assignments?.some((a: any) => a.collaborator_id === activeCollab)
                );
            }
            setBookings(filteredData as Booking[]);
        }
        setLoading(false);
    }

    async function handleDeleteBooking(id: string) {
        try {
            const { error } = await supabase.from('bookings').delete().eq('id', id);
            if (error) {
                showToast('Errore durante l\'eliminazione', 'error');
            } else {
                showToast('Prenotazione eliminata', 'success');
                fetchBookings();
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Errore di sistema durante l\'eliminazione', 'error');
        } finally {
            setDeleteConfirm({ isOpen: false, bookingId: null });
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'hold': return 'In Attesa';
            case 'confirmed': return 'Confermata';
            case 'cancelled': return 'Annullata';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'hold': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
            case 'cancelled': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const bookingsByDate = bookings.reduce((acc, booking) => {
        const dateKey = format(new Date(booking.start_time), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(booking);
        return acc;
    }, {} as Record<string, Booking[]>);

    const daysInView = viewMode === 'month'
        ? eachDayOfInterval({
            start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
            end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
        })
        : eachDayOfInterval({
            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
            end: endOfWeek(currentDate, { weekStartsOn: 1 })
        });

    const hours = eachHourOfInterval({
        start: addHours(startOfDay(new Date()), 8),
        end: addHours(startOfDay(new Date()), 20)
    });

    const selectedBookings = selectedDate
        ? bookingsByDate[format(selectedDate, 'yyyy-MM-dd')] || []
        : [];

    return (
        <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            {/* Top Toolbar */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                        {[
                            { id: 'month', label: 'Mese', icon: Grid },
                            { id: 'week', label: 'Settimana', icon: Layers },
                            { id: 'day', label: 'Giorno', icon: ListIcon }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => setViewMode(m.id as any)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === m.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 font-medium'
                                    }`}
                            >
                                <m.icon className="w-4 h-4" />
                                {m.label}
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentDate(prev => subMonths(prev, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
                        <span className="text-lg font-bold text-slate-900 min-w-[150px] text-center">
                            {viewMode === 'month'
                                ? format(currentDate, 'MMMM yyyy', { locale: it })
                                : `Settimana ${format(currentDate, 'w', { locale: it })}`}
                        </span>
                        <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">Servizio:</span>
                        <select
                            value={activeService}
                            onChange={e => setActiveService(e.target.value)}
                            className="text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                        >
                            <option value="all">Tutti i Servizi</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Collaborator Filter Row */}
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 flex items-center gap-4 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveCollab('all')}
                    className={`flex flex-col items-center gap-1.5 min-w-[80px] group transition-all`}
                >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${activeCollab === 'all' ? 'border-indigo-600 bg-indigo-50 shadow-md ring-4 ring-indigo-50' : 'border-slate-200 bg-white group-hover:border-slate-300'
                        }`}>
                        <Users className={`w-6 h-6 ${activeCollab === 'all' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-tight ${activeCollab === 'all' ? 'text-indigo-600' : 'text-slate-500'}`}>Tutti</span>
                </button>
                {collaborators.map(c => (
                    <button
                        key={c.id}
                        onClick={() => setActiveCollab(c.id)}
                        className={`flex flex-col items-center gap-1.5 min-w-[80px] group transition-all`}
                    >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 overflow-hidden transition-all ${activeCollab === c.id ? 'border-indigo-600 bg-indigo-50 shadow-md ring-4 ring-indigo-50' : 'border-slate-200 bg-white group-hover:border-slate-300'
                            }`}>
                            {c.avatar_url ? (
                                <img src={c.avatar_url} alt={`${c.first_name} ${c.last_name}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className={`w-full h-full flex items-center justify-center font-bold text-lg ${activeCollab === c.id ? 'text-indigo-600' : 'text-slate-400'
                                    }`}>
                                    {c.first_name[0]}{c.last_name[0]}
                                </div>
                            )}
                        </div>
                        <span className={`text-[11px] font-bold uppercase tracking-tight truncate w-full text-center ${activeCollab === c.id ? 'text-indigo-600' : 'text-slate-500'
                            }`}>
                            {c.first_name}
                        </span>
                    </button>
                ))}
            </div>

            {/* Status Filters */}
            <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-6">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Filter className="w-3 h-3" /> Filtro Stato
                </div>
                <div className="flex gap-2">
                    {[
                        { value: 'all', label: 'Tutte' },
                        { value: 'hold', label: 'In Attesa' },
                        { value: 'confirmed', label: 'Confermate' },
                        { value: 'cancelled', label: 'Annullate' }
                    ].map(f => (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value as any)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${statusFilter === f.value
                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-auto bg-slate-50/30">
                    {viewMode === 'month' ? (
                        <div className="p-6">
                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-t-xl overflow-hidden">
                                {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map(day => (
                                    <div key={day} className="bg-slate-50 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days */}
                            <div className="grid grid-cols-7 gap-px bg-slate-200 border-x border-b border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
                                {daysInView.map(day => {
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const dayBookings = bookingsByDate[dateKey] || [];
                                    const isMonthCurr = isSameMonth(day, currentDate);
                                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                                    const isToday = isSameDay(day, new Date());

                                    return (
                                        <button
                                            key={dateKey}
                                            onClick={() => setSelectedDate(day)}
                                            className={`
                                            min-h-[140px] p-3 text-left transition-all hover:bg-slate-50 relative group
                                            ${isMonthCurr ? 'bg-white' : 'bg-slate-50/50 opacity-40'}
                                            ${isSelected ? 'ring-2 ring-inset ring-indigo-500 z-10' : ''}
                                        `}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`
                                                w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                                                ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'}
                                            `}>
                                                    {format(day, 'd')}
                                                </span>
                                                {dayBookings.length > 0 && (
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {dayBookings.length} app.
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-1.5 overflow-hidden">
                                                {dayBookings.slice(0, 3).map(booking => (
                                                    <div
                                                        key={booking.id}
                                                        className={`
                                                        px-2 py-1 rounded text-[10px] font-bold truncate border shadow-sm transition-transform group-hover:scale-[1.02]
                                                        ${getStatusColor(booking.status)}
                                                    `}
                                                    >
                                                        {format(new Date(booking.start_time), 'HH:mm')} - {booking.guest_info?.last_name || 'Cliente'}
                                                    </div>
                                                ))}
                                                {dayBookings.length > 3 && (
                                                    <div className="text-[10px] text-indigo-600 font-bold pl-1 pt-1">
                                                        + {dayBookings.length - 3} altri
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full">
                            {/* Time Grid (Week View) */}
                            <div className="flex-1 flex flex-col min-w-[800px]">
                                {/* Days Header */}
                                <div className="flex border-b border-slate-200 ml-16 bg-white sticky top-0 z-20">
                                    {eachDayOfInterval({
                                        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                                        end: endOfWeek(currentDate, { weekStartsOn: 1 })
                                    }).map(day => (
                                        <div key={day.toString()} className="flex-1 py-4 text-center border-r border-slate-100 last:border-r-0">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                {format(day, 'EEE', { locale: it })}
                                            </div>
                                            <div className={`
                                            inline-flex w-9 h-9 items-center justify-center rounded-full font-bold text-lg
                                            ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-800'}
                                        `}>
                                                {format(day, 'd')}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Hours Grid */}
                                <div className="flex-1 flex overflow-y-auto no-scrollbar">
                                    {/* Time Labels */}
                                    <div className="w-16 flex-shrink-0 bg-white border-r border-slate-200">
                                        {hours.map(hour => (
                                            <div key={hour.toString()} className="h-20 text-[11px] font-bold text-slate-400 flex justify-center pt-2">
                                                {format(hour, 'HH:mm')}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Columns */}
                                    <div className="flex-1 flex relative">
                                        {eachDayOfInterval({
                                            start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                                            end: endOfWeek(currentDate, { weekStartsOn: 1 })
                                        }).map(day => (
                                            <div key={day.toString()} className="flex-1 border-r border-slate-100 last:border-r-0 relative min-h-[1000px] bg-white group hover:bg-slate-50/30 transition-colors">
                                                {/* Hour horizontal lines */}
                                                {hours.map(hour => (
                                                    <div key={hour.toString()} className="h-20 border-b border-slate-50 last:border-b-0"></div>
                                                ))}

                                                {/* Bookings strictly for this day */}
                                                {bookings.filter(b => isSameDay(new Date(b.start_time), day)).map(booking => {
                                                    const start = new Date(booking.start_time);
                                                    const startHour = start.getHours() + start.getMinutes() / 60;
                                                    const top = (startHour - 8) * 80; // 80px per hour, starting at 8:00
                                                    const duration = (new Date(booking.end_time).getTime() - start.getTime()) / (1000 * 60 * 60);
                                                    const height = Math.max(duration * 80, 4);

                                                    if (startHour < 8 || startHour > 20) return null;

                                                    return (
                                                        <div
                                                            key={booking.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDate(day);
                                                            }}
                                                            className={`
                                                            absolute left-1 right-1 rounded-lg border-l-4 p-2 overflow-hidden shadow-sm flex flex-col cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md z-10
                                                            ${getStatusColor(booking.status)}
                                                        `}
                                                            style={{ top: `${top}px`, height: `${height}px` }}
                                                        >
                                                            <div className="flex justify-between gap-1 mb-0.5">
                                                                <span className="text-[10px] font-bold opacity-80 uppercase">
                                                                    {format(start, 'HH:mm')} - {format(new Date(booking.end_time), 'HH:mm')}
                                                                </span>
                                                                <Trash2
                                                                    className="w-3 h-3 opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeleteConfirm({ isOpen: true, bookingId: booking.id });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="text-[11px] font-bold truncate leading-tight">
                                                                {booking.guest_info?.first_name} {booking.guest_info?.last_name}
                                                            </div>
                                                            {height > 50 && (
                                                                <div className="text-[9px] font-medium opacity-70 mt-1 truncate">
                                                                    {booking.booking_items?.name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar: Selected Day Details */}
                <div className="w-96 border-l border-slate-200 bg-slate-50 flex flex-col">
                    <div className="p-6 border-b border-slate-200 bg-white">
                        <h3 className="font-bold text-slate-900 text-lg">
                            {selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: it }) : 'Seleziona un giorno'}
                        </h3>
                        {selectedDate && (
                            <p className="text-sm text-slate-500 mt-1">
                                {selectedBookings.length} prenotazion{selectedBookings.length === 1 ? 'e' : 'i'}
                            </p>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        {!selectedDate ? (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center">
                                Clicca su un giorno del calendario per vedere i dettagli
                            </div>
                        ) : selectedBookings.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center">
                                Nessuna prenotazione per questo giorno
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedBookings.map(booking => (
                                    <div
                                        key={booking.id}
                                        className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="font-bold text-slate-900">
                                                    {booking.guest_info?.first_name} {booking.guest_info?.last_name}
                                                </div>
                                                <div className="text-sm text-slate-500">
                                                    {booking.guest_info?.email}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setDeleteConfirm({ isOpen: true, bookingId: booking.id })}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Elimina Prenotazione"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-slate-500">Servizio:</span>
                                                <span className="font-medium text-slate-700">
                                                    {booking.booking_items?.name || 'N/D'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-slate-500">Orario:</span>
                                                <span className="font-medium text-slate-700">
                                                    {format(new Date(booking.start_time), 'HH:mm')} - {format(new Date(booking.end_time), 'HH:mm')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-slate-500">Stato:</span>
                                                <span className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(booking.status)}`}>
                                                    {getStatusLabel(booking.status)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Elimina Prenotazione"
                message="Sei sicuro di voler eliminare questa prenotazione? Questa azione non può essere annullata."
                variant="danger"
                confirmText="Elimina"
                cancelText="Annulla"
                onConfirm={() => deleteConfirm.bookingId && handleDeleteBooking(deleteConfirm.bookingId)}
                onCancel={() => setDeleteConfirm({ isOpen: false, bookingId: null })}
            />
        </div >
    );
}
