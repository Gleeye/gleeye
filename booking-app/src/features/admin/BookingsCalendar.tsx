import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Trash2, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

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
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'hold' | 'confirmed' | 'cancelled'>('all');
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; bookingId: string | null }>({ isOpen: false, bookingId: null });

    useEffect(() => {
        fetchBookings();
    }, [currentMonth, statusFilter]);

    async function fetchBookings() {
        setLoading(true);
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);

        let query = supabase
            .from('bookings')
            .select('*, booking_items(name)')
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .order('start_time', { ascending: true });

        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (!error && data) {
            setBookings(data as Booking[]);
        }
        setLoading(false);
    }

    async function handleDeleteBooking(id: string) {
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) {
            showToast('Errore durante l\'eliminazione', 'error');
        } else {
            showToast('Prenotazione eliminata', 'success');
            fetchBookings();
        }
        setDeleteConfirm({ isOpen: false, bookingId: null });
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

    const daysInMonth = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });

    const selectedBookings = selectedDate
        ? bookingsByDate[format(selectedDate, 'yyyy-MM-dd')] || []
        : [];

    return (
        <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header with Filters */}
            <div className="p-6 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <CalendarIcon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Prenotazioni</h2>
                            <p className="text-sm text-slate-500">Gestisci e visualizza tutte le prenotazioni</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Filter className="w-4 h-4" />
                        <span className="font-medium">Stato:</span>
                    </div>
                    <div className="flex gap-2">
                        {[
                            { value: 'all', label: 'Tutte' },
                            { value: 'hold', label: 'In Attesa' },
                            { value: 'confirmed', label: 'Confermate' },
                            { value: 'cancelled', label: 'Annullate' }
                        ].map(filter => (
                            <button
                                key={filter.value}
                                onClick={() => setStatusFilter(filter.value as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === filter.value
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Calendar Grid */}
                <div className="flex-1 p-6 overflow-auto">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <h3 className="text-xl font-bold text-slate-900 capitalize">
                            {format(currentMonth, 'MMMM yyyy', { locale: it })}
                        </h3>
                        <button
                            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>

                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                            <div key={day} className="text-center text-xs font-bold text-slate-500 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-2">
                        {daysInMonth.map(day => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const dayBookings = bookingsByDate[dateKey] || [];
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isSelected = selectedDate && isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());

                            return (
                                <button
                                    key={dateKey}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        min-h-[100px] p-2 rounded-xl border-2 transition-all text-left
                                        ${!isCurrentMonth ? 'opacity-30' : ''}
                                        ${isSelected ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200 bg-white'}
                                        ${isToday && !isSelected ? 'border-blue-300 bg-blue-50' : ''}
                                    `}
                                >
                                    <div className={`text-sm font-bold mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                                        {format(day, 'd')}
                                    </div>
                                    <div className="space-y-1">
                                        {dayBookings.slice(0, 2).map(booking => (
                                            <div
                                                key={booking.id}
                                                className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusColor(booking.status)}`}
                                            >
                                                {format(new Date(booking.start_time), 'HH:mm')}
                                            </div>
                                        ))}
                                        {dayBookings.length > 2 && (
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                +{dayBookings.length - 2} altre
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
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
        </div>
    );
}
