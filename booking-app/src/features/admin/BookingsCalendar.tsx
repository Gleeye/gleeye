import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, startOfDay, addHours, eachHourOfInterval, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BookingDetailsModal from './BookingDetailsModal';
import { ChevronLeft, ChevronRight, Filter, Search, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface Collaborator {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
}

interface Service {
    id: string;
    name: string;
    color?: string; // Future proofing
}

interface Booking {
    id: string;
    start_time: string;
    end_time: string;
    status: 'hold' | 'confirmed' | 'cancelled';
    notes?: string;
    guest_info: {
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        company?: string;
    };
    booking_items?: {
        name: string;
        color?: string;
    };
    booking_assignments?: { collaborator_id: string }[];
}

const STATUS_YELLOLW = { bg: '#FFFCF2', border: '#F59E0B', text: '#B45309', light: '#FEF3C7' }; // Hold
const STATUS_GREEN = { bg: '#F0FDF4', border: '#10B981', text: '#065F46', light: '#D1FAE5' };   // Confirmed
const STATUS_GRAY = { bg: '#F8FAFC', border: '#94A3B8', text: '#475569', light: '#F1F5F9' };     // Cancelled

function getStatusStyle(status: string) {
    switch (status) {
        case 'confirmed': return STATUS_GREEN;
        case 'cancelled': return STATUS_GRAY;
        default: return STATUS_YELLOLW;
    }
}

// --- MINI CALENDAR COMPONENT ---
function MiniCalendar({ currentMonth, onMonthChange, selectedDate, onSelectDate }: { currentMonth: Date, onMonthChange: (d: Date) => void, selectedDate: Date, onSelectDate: (d: Date) => void }) {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

    return (
        <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-700 capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: it })}
                </span>
                <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(day => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => onSelectDate(day)}
                            className={`
                                h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium transition-all
                                ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'hover:bg-slate-100'}
                                ${!isSelected && isToday ? 'text-indigo-600 font-bold bg-indigo-50' : ''}
                                ${!isSelected && !isCurrentMonth ? 'text-slate-300' : ''}
                                ${!isSelected && isCurrentMonth && !isToday ? 'text-slate-600' : ''}
                            `}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function BookingsCalendar() {
    const { showToast } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [miniCalMonth, setMiniCalMonth] = useState(new Date());

    // Data State
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

    // Filter State
    const [statusFilters, setStatusFilters] = useState({ hold: true, confirmed: true, cancelled: false });
    const [activeCollab, setActiveCollab] = useState<string | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // UI State
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; bookingId: string | null }>({ isOpen: false, bookingId: null });

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const today = new Date();

    const hours = eachHourOfInterval({
        start: startOfDay(new Date()),
        end: addHours(startOfDay(new Date()), 23)
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchBookings();
        setMiniCalMonth(currentDate);
    }, [currentDate]);

    async function fetchInitialData() {
        try {
            const { data: collabData } = await supabase
                .from('collaborators')
                .select('id, first_name, last_name, avatar_url')
                .eq('is_active', true)
                .order('first_name');

            if (collabData) setCollaborators(collabData);
        } catch (err) {
            console.error(err);
        }
    }

    async function fetchBookings() {
        const { data, error } = await supabase
            .from('bookings')
            .select('*, booking_items(name), booking_assignments(collaborator_id)')
            .gte('start_time', weekStart.toISOString())
            .lte('start_time', weekEnd.toISOString())
            .order('start_time', { ascending: true });

        if (!error && data) {
            setBookings(data as Booking[]);
        }
    }

    // --- Computed / Filtered Bookings ---
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            // Status Filter
            if (b.status === 'hold' && !statusFilters.hold) return false;
            if (b.status === 'confirmed' && !statusFilters.confirmed) return false;
            if (b.status === 'cancelled' && !statusFilters.cancelled) return false;

            // Collaborator Filter
            if (activeCollab !== 'all') {
                const hasCollab = b.booking_assignments?.some(a => a.collaborator_id === activeCollab);
                if (!hasCollab) return false;
            }

            // Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const clientName = `${b.guest_info?.first_name} ${b.guest_info?.last_name}`.toLowerCase();
                const company = b.guest_info?.company?.toLowerCase() || '';
                const service = b.booking_items?.name?.toLowerCase() || '';
                return clientName.includes(term) || company.includes(term) || service.includes(term);
            }

            return true;
        });
    }, [bookings, statusFilters, activeCollab, searchTerm]);

    const getBookingsForDay = (day: Date) => filteredBookings.filter(b => isSameDay(new Date(b.start_time), day));

    function timeToPosition(date: Date): number {
        const h = date.getHours() + date.getMinutes() / 60;
        return h * 100; // 100px per hour
    }

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) {
            showToast('Errore durante l\'eliminazione', 'error');
        } else {
            showToast('Prenotazione eliminata', 'success');
            setSelectedBooking(null);
            fetchBookings();
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] gap-6 animate-fade-in font-sans">

            {/* --- MAIN CALENDAR GRID (LEFT) --- */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">

                {/* Header Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-20">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-100 rounded-lg p-1">
                            <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-white hover:shadow-sm rounded-md transition-all">
                                Oggi
                            </button>
                            <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 capitalize">
                            {format(weekStart, 'd MMMM', { locale: it })} - {format(weekEnd, 'd MMMM yyyy', { locale: it })}
                        </h2>
                    </div>
                </div>

                {/* The Grid Scroller */}
                <div className="flex-1 flex overflow-hidden relative">

                    {/* Time Gutter (Left Edge) - Added PL-4 for spacing */}
                    <div className="w-[70px] flex-shrink-0 border-r border-slate-100 bg-slate-50/50 flex flex-col pt-10 overflow-hidden relative z-10 pl-4">
                        <div className="absolute top-0 left-0 right-0 h-10 bg-slate-50 border-b border-slate-100"></div> {/* Corner */}
                        <div className="overflow-hidden flex-1 relative">
                            {/* Sync scroll with JS or just absolute render? simple map is enough if outer scrolls */}
                            {/* Actually, to sync scroll properly we need the parent to scroll. 
                                 Let's make the whole Grid Body scrollable, including time gutter.
                             */}
                        </div>
                    </div>

                    {/* Scrollable Container */}
                    <div className="flex-1 overflow-y-auto flex relative" id="calendar-scroll-area">

                        {/* Time Column (Sticky) */}
                        <div className="sticky left-0 w-[70px] min-w-[70px] bg-slate-50/80 backdrop-blur-sm border-r border-slate-100 z-10 pt-[100px] flex flex-col gap-[100px] items-end pr-3 pb-10">
                            {hours.map(h => (
                                <span key={h.toString()} className="text-xs font-semibold text-slate-400 -mt-2.5 bg-slate-50/80 px-1 rounded transform -translate-y-[calc(100%-12px)]">
                                    {format(h, 'HH:mm')}
                                </span>
                            ))}
                        </div>

                        {/* Days Columns */}
                        <div className="flex-1 min-w-[800px] flex flex-col">
                            {/* Days Header (Sticky Top) */}
                            <div className="sticky top-0 z-20 flex bg-white border-b border-slate-100 h-[100px] shadow-sm">
                                {daysInWeek.map(day => {
                                    const isToday = isSameDay(day, today);
                                    return (
                                        <div key={day.toISOString()} className={`flex-1 flex flex-col items-center justify-center border-r border-slate-50 last:border-0 relative overflow-hidden group ${isToday ? 'bg-indigo-50/30' : ''}`}>
                                            {isToday && <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>}
                                            <span className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                {format(day, 'EEE', { locale: it })}
                                            </span>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'text-slate-700 group-hover:bg-slate-50'}`}>
                                                {format(day, 'd')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Grid Body */}
                            <div className="relative flex-1" style={{ height: 2400 }}> {/* 24h * 100px */}
                                {/* Horizontal Guidelines */}
                                {hours.map(h => (
                                    <div key={h.toString()} className="absolute w-full border-b border-slate-100 border-dashed" style={{ top: timeToPosition(h), height: 1 }}></div>
                                ))}

                                {/* Day Columns content */}
                                <div className="absolute inset-0 flex">
                                    {daysInWeek.map(day => {
                                        const isToday = isSameDay(day, today);
                                        const dayBookings = getBookingsForDay(day);

                                        return (
                                            <div key={day.toISOString()} className={`flex-1 border-r border-slate-50 last:border-0 relative h-full group transition-colors ${isToday ? 'bg-indigo-50/10' : 'hover:bg-slate-50/30'}`}>
                                                {/* Now Indicator */}
                                                {isToday && (
                                                    <div
                                                        className="absolute w-full border-t-2 border-red-500 z-30 pointer-events-none flex items-center"
                                                        style={{ top: timeToPosition(new Date()) }}
                                                    >
                                                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[5px]"></div>
                                                    </div>
                                                )}

                                                {/* Bookings */}
                                                {dayBookings.map(b => {
                                                    const start = new Date(b.start_time);
                                                    const end = new Date(b.end_time);
                                                    const top = timeToPosition(start);
                                                    const height = Math.max(timeToPosition(end) - top, 45); // Min height 45px for readability
                                                    const style = getStatusStyle(b.status);

                                                    return (
                                                        <div
                                                            key={b.id}
                                                            onClick={() => setSelectedBooking(b)}
                                                            className="absolute left-1 right-1 rounded-lg border-l-4 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] hover:z-40 transition-all overflow-hidden flex flex-col px-3 py-2"
                                                            style={{
                                                                top,
                                                                height,
                                                                backgroundColor: style.light, // Using light bg
                                                                borderLeftColor: style.border,
                                                                zIndex: 10
                                                            }}
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-xs font-bold font-mono opacity-70 mb-0.5" style={{ color: style.text }}>
                                                                    {format(start, 'HH:mm')}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm font-bold leading-tight truncate" style={{ color: '#1e293b' }}>
                                                                {b.booking_items?.name || 'Prenotazione'}
                                                            </div>
                                                            {height > 60 && (
                                                                <div className="text-xs font-medium truncate mt-0.5 opacity-80" style={{ color: style.text }}>
                                                                    {b.guest_info?.company || `${b.guest_info?.first_name} ${b.guest_info?.last_name}`}
                                                                </div>
                                                            )}
                                                            {height > 90 && (
                                                                <div className="mt-auto pt-2 flex items-center gap-1 opacity-60">
                                                                    {b.booking_assignments?.length ? <User className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- RIGHT SIDEBAR (CONTROLS) --- */}
            <div className="w-[300px] flex-shrink-0 flex flex-col gap-6 animate-fade-in delay-100">

                {/* Mini Calendar Card */}
                <MiniCalendar
                    currentMonth={miniCalMonth}
                    onMonthChange={setMiniCalMonth}
                    selectedDate={currentDate}
                    onSelectDate={setCurrentDate}
                />

                {/* Filters Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex-1 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-4 text-slate-800 border-b border-slate-100 pb-3">
                        <Filter className="w-4 h-4" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Filtri</h3>
                    </div>

                    <div className="space-y-6">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Cerca cliente o servizio..."
                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                            />
                        </div>

                        {/* Status Checkboxes */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 block">Stato</label>
                            <div className="space-y-2.5">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${statusFilters.confirmed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 group-hover:border-emerald-300'}`}>
                                        {statusFilters.confirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={statusFilters.confirmed} onChange={() => setStatusFilters(p => ({ ...p, confirmed: !p.confirmed }))} />
                                    <span className="text-sm font-medium text-slate-700">Confermate</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${statusFilters.hold ? 'bg-amber-400 border-amber-400' : 'bg-white border-slate-300 group-hover:border-amber-300'}`}>
                                        {statusFilters.hold && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={statusFilters.hold} onChange={() => setStatusFilters(p => ({ ...p, hold: !p.hold }))} />
                                    <span className="text-sm font-medium text-slate-700">In Attesa</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${statusFilters.cancelled ? 'bg-slate-400 border-slate-400' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                                        {statusFilters.cancelled && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={statusFilters.cancelled} onChange={() => setStatusFilters(p => ({ ...p, cancelled: !p.cancelled }))} />
                                    <span className="text-sm font-medium text-slate-700">Annullate</span>
                                </label>
                            </div>
                        </div>

                        {/* Staff Filters */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 block">Collaboratori</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setActiveCollab('all')}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeCollab === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                                >
                                    Tutti
                                </button>
                                {collaborators.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setActiveCollab(c.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeCollab === c.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'}`}
                                    >
                                        {c.first_name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {selectedBooking && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onDelete={(id) => {
                        setSelectedBooking(null);
                        setDeleteConfirm({ isOpen: true, bookingId: id });
                    }}
                    onStatusUpdate={async (id, status) => {
                        const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
                        if (!error) {
                            showToast('Stato aggiornato', 'success');
                            fetchBookings();
                            setSelectedBooking(null);
                        }
                    }}
                />
            )}

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Elimina Prenotazione"
                message="Sei sicuro di voler eliminare questa prenotazione?"
                variant="danger"
                onConfirm={() => {
                    if (deleteConfirm.bookingId) handleDelete(deleteConfirm.bookingId);
                    setDeleteConfirm({ isOpen: false, bookingId: null });
                }}
                onCancel={() => setDeleteConfirm({ isOpen: false, bookingId: null })}
            />
        </div>
    );
}
