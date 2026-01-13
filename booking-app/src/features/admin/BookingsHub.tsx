import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    Clock,
    Briefcase,
    ArrowRight,
    CalendarDays,
    Users,
    Clock4,
    TrendingUp,
    Settings2,
    PlusCircle
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import BookingCatalog from './BookingCatalog';
import GoogleCalendarConfig from './GoogleCalendarConfig';
import BookingsCalendar from './BookingsCalendar';
import BookingWizard from '../user/BookingWizard';

export default function BookingsHub() {
    const [activeView, setActiveView] = useState<'hub' | 'services' | 'availability' | 'calendars' | 'bookings' | 'new_booking'>('hub');
    const [stats, setStats] = useState({
        todayCount: 0,
        pendingCount: 0,
        weeklyVolume: 0,
        activeStaff: 0
    });
    const [todayBookings, setTodayBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (activeView === 'hub') {
            fetchHubData();
        }
    }, [activeView]);

    async function fetchHubData() {
        setLoading(true);
        try {
            const today = startOfDay(new Date());
            const tomorrow = endOfDay(new Date());

            // Today's bookings
            const { data: todayData } = await supabase
                .from('bookings')
                .select('*, booking_items(name)')
                .gte('start_time', today.toISOString())
                .lte('start_time', tomorrow.toISOString())
                .order('start_time', { ascending: true });

            if (todayData) {
                setTodayBookings(todayData);
                setStats(prev => ({ ...prev, todayCount: todayData.length }));
            }

            // Pending (hold) bookings
            const { count: pendingCount } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'hold');

            // Active collaborators
            const { count: staffCount } = await supabase
                .from('collaborators')
                .select('*', { count: 'exact', head: true });

            setStats(prev => ({
                ...prev,
                pendingCount: pendingCount || 0,
                activeStaff: staffCount || 0
            }));

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (activeView === 'services') {
        return (
            <div className="animate-fade-in">
                <Header onBack={() => setActiveView('hub')} title="Catalogo Servizi" />
                <BookingCatalog />
            </div>
        );
    }

    if (activeView === 'calendars') {
        return <GoogleCalendarConfig onBack={() => setActiveView('hub')} />;
    }

    if (activeView === 'bookings') {
        return (
            <div className="animate-fade-in h-screen flex flex-col -m-8">
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => setActiveView('hub')}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-bold text-sm uppercase tracking-tight"
                    >
                        <ArrowRight className="w-4 h-4 rotate-180" /> Dashboard Hub
                    </button>
                    <h2 className="text-lg font-black text-slate-900">Calendario Operativo</h2>
                    <div className="w-24"></div>
                </div>
                <div className="flex-1 overflow-hidden">
                    <BookingsCalendar />
                </div>
            </div>
        );
    }

    if (activeView === 'new_booking') {
        return (
            <div className="animate-fade-in max-w-3xl mx-auto">
                <Header onBack={() => setActiveView('hub')} title="Nuova Prenotazione Diretta" />
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <BookingWizard />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
            {/* Hero Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Booking Hub</h2>
                    <p className="text-lg text-slate-500 font-medium">Benvenuto nel centro di gestione prenotazioni Gleeye.</p>
                </div>
                <button
                    onClick={() => setActiveView('new_booking')}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <PlusCircle className="w-5 h-5" />
                    Nuova Prenotazione
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={CalendarDays}
                    label="Oggi"
                    value={stats.todayCount}
                    color="bg-indigo-50 text-indigo-600"
                    trend="Prossimi appuntamenti"
                />
                <StatCard
                    icon={Clock4}
                    label="In Attesa"
                    value={stats.pendingCount}
                    color="bg-amber-50 text-amber-600"
                    trend="Richiedono approvazione"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Volume"
                    value="+12%"
                    color="bg-emerald-50 text-emerald-600"
                    trend="Rispetto a scorsa sett."
                />
                <StatCard
                    icon={Users}
                    label="Staff"
                    value={stats.activeStaff}
                    color="bg-blue-50 text-blue-600"
                    trend="Collaboratori attivi"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Action Cards */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-xl font-bold text-slate-900">Strumenti di Gestione</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ActionCard
                            onClick={() => setActiveView('bookings')}
                            icon={CalendarDays}
                            title="Calendario Operativo"
                            description="Gestisci la griglia oraria, sposta appuntamenti e monitora i flussi."
                            color="indigo"
                        />
                        <ActionCard
                            onClick={() => setActiveView('services')}
                            icon={Briefcase}
                            title="Catalogo Servizi"
                            description="Configura tipi di servizio, durate, costi e assegnazioni."
                            color="blue"
                        />
                        <ActionCard
                            onClick={() => setActiveView('availability')}
                            icon={Clock}
                            title="Turni e Disponibilità"
                            description="Imposta gli orari di lavoro del team e i giorni di chiusura."
                            color="emerald"
                        />
                        <ActionCard
                            onClick={() => setActiveView('calendars')}
                            icon={Settings2}
                            title="Integrazioni e Config"
                            description="Sincronizza Google Calendar e gestisci i link di prenotazione."
                            color="purple"
                        />
                    </div>
                </div>

                {/* Today's Timeline */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Timeline di Oggi</h3>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase">
                            {format(new Date(), 'dd MMM', { locale: it })}
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto p-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : todayBookings.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-slate-400 text-sm font-medium">Nessun appuntamento per oggi</p>
                            </div>
                        ) : (
                            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                {todayBookings.map((b) => (
                                    <div key={b.id} className="relative pl-8 group">
                                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm z-10 ${b.status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-400'
                                            }`}></div>
                                        <div>
                                            <div className="text-xs font-black text-slate-400 uppercase mb-1">
                                                {format(new Date(b.start_time), 'HH:mm')}
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-3 group-hover:bg-indigo-50 transition-colors border border-transparent group-hover:border-indigo-100">
                                                <div className="font-bold text-slate-900 text-sm">
                                                    {b.guest_info?.first_name} {b.guest_info?.last_name}
                                                </div>
                                                <div className="text-xs text-slate-500 font-medium">
                                                    {b.booking_items?.name}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color, trend }: any) {
    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">Real-time</span>
            </div>
            <div>
                <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
                <div className="text-sm font-bold text-slate-800">{label}</div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">{trend}</p>
            </div>
        </div>
    );
}

function ActionCard({ onClick, icon: Icon, title, description, color }: any) {
    const colors: any = {
        indigo: "hover:border-indigo-200 hover:bg-indigo-50/10 icon:bg-indigo-50 icon:text-indigo-600",
        blue: "hover:border-blue-200 hover:bg-blue-50/10 icon:bg-blue-50 icon:text-blue-600",
        emerald: "hover:border-emerald-200 hover:bg-emerald-50/10 icon:bg-emerald-50 icon:text-emerald-600",
        purple: "hover:border-purple-200 hover:bg-purple-50/10 icon:bg-purple-50 icon:text-purple-600",
    };

    const colorClass = colors[color];

    return (
        <button
            onClick={onClick}
            className={`text-left p-6 rounded-3xl border border-slate-200 bg-white transition-all group flex flex-col h-full ${colorClass}`}
        >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all group-hover:scale-110 ${colorClass.split('icon:').join('').split(' ').filter((s: string) => s.includes('icon')).map((s: string) => s.replace('icon:', '')).join(' ')} icon-container`}>
                <style dangerouslySetInnerHTML={{ __html: `.icon-container { background: var(--bg); color: var(--text); }` }} />
                {/* Manual color injection for cleaner look */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                    color === 'blue' ? 'bg-blue-50 text-blue-600' :
                        color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-purple-50 text-purple-600'
                    }`}>
                    <Icon className="w-7 h-7" />
                </div>
            </div>
            <h4 className="text-xl font-black text-slate-900 mb-2 group-hover:text-indigo-900 transition-colors uppercase tracking-tight">{title}</h4>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">{description}</p>
            <div className="mt-auto flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                Apri Strumento <ArrowRight className="w-3 h-3" />
            </div>
        </button>
    );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
    return (
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
                    <p className="text-sm text-slate-500 font-medium">Torna alla dashboard principale</p>
                </div>
            </div>
        </div>
    );
}
