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
    PlusCircle,
    MonitorSmartphone
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
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        checkAdmin();
        if (activeView === 'hub') {
            fetchHubData();
        }
    }, [activeView]);

    async function checkAdmin() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email === 'davide@gleeye.com' || session?.user?.email === 'davidegentile91@gmail.com') { // Temporary hardcheck until better role system or use same logic as main app
            // Better: re-use the logic from main app or just check profile role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();
            if (profile?.role === 'admin') setIsAdmin(true);
        }
    }

    async function fetchHubData() {
        setLoading(true);
        try {
            const today = startOfDay(new Date());
            const tomorrow = endOfDay(new Date());

            // Today's bookings
            const { data: todayData } = await supabase
                .from('bookings')
                .select('*, booking_items(name), booking_assignments(collaborator_id)')
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
                <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => setActiveView('hub')}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-all text-xs uppercase tracking-widest font-light"
                    >
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Dashboard
                    </button>
                    <h2 className="text-base font-light text-slate-900">Calendario Operativo</h2>
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
                <Header onBack={() => setActiveView('hub')} title="Nuova Prenotazione" />
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <BookingWizard />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
            {/* Hero Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-light text-slate-900 tracking-tight mb-1">Booking Hub</h2>
                    <p className="text-sm text-slate-400 font-light">Centro di gestione prenotazioni</p>
                </div>
                <button
                    onClick={() => setActiveView('new_booking')}
                    className="bg-gradient-to-r from-blue-500 to-violet-500 text-white px-5 py-2.5 rounded-xl font-light text-sm flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
                >
                    <PlusCircle className="w-4 h-4" />
                    Nuova Prenotazione
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    icon={CalendarDays}
                    label="Oggi"
                    value={stats.todayCount}
                    color="blue"
                    sublabel="appuntamenti"
                />
                <StatCard
                    icon={Clock4}
                    label="In Attesa"
                    value={stats.pendingCount}
                    color="amber"
                    sublabel="da confermare"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Crescita"
                    value="+12%"
                    color="emerald"
                    sublabel="vs. scorsa settimana"
                />
                <StatCard
                    icon={Users}
                    label="Team"
                    value={stats.activeStaff}
                    color="slate"
                    sublabel="collaboratori"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Action Cards */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs uppercase tracking-widest text-slate-400 font-light mb-4">Strumenti</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ActionCard
                            onClick={() => setActiveView('bookings')}
                            icon={CalendarDays}
                            title="Calendario"
                            description="Griglia oraria e gestione appuntamenti"
                            color="blue"
                        />
                        <ActionCard
                            onClick={() => setActiveView('services')}
                            icon={Briefcase}
                            title="Servizi"
                            description="Catalogo, durate e configurazioni"
                            color="violet"
                        />
                        <ActionCard
                            onClick={() => setActiveView('availability')}
                            icon={Clock}
                            title="Disponibilità"
                            description="Turni, orari e chiusure"
                            color="emerald"
                        />
                        <ActionCard
                            onClick={() => window.open(window.location.protocol + '//' + window.location.host + window.location.pathname, '_blank')}
                            icon={MonitorSmartphone}
                            title="Test Modulo"
                            description="Anteprima esperienza cliente"
                            color="amber"
                        />
                        {isAdmin && (
                            <ActionCard
                                onClick={() => setActiveView('calendars')}
                                icon={Settings2}
                                title="Integrazioni"
                                description="Google Calendar e sincronizzazioni"
                                color="slate"
                            />
                        )}
                    </div>
                </div>

                {/* Today's Timeline */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                    <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="text-sm font-light text-slate-900">Oggi</h3>
                        <span className="text-[10px] font-light text-slate-400 uppercase tracking-widest">
                            {format(new Date(), 'dd MMM', { locale: it })}
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto p-5">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="w-5 h-5 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : todayBookings.length === 0 ? (
                            <div className="text-center py-16">
                                <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                                <p className="text-slate-300 text-xs font-light">Nessun appuntamento</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {todayBookings.map((b) => (
                                    <div key={b.id} className="group">
                                        <div className="flex items-start gap-3">
                                            <div className="text-[10px] font-light text-slate-400 uppercase tracking-wider pt-1 w-12 flex-shrink-0">
                                                {format(new Date(b.start_time), 'HH:mm')}
                                            </div>
                                            <div className="flex-1 bg-slate-50 rounded-xl p-3 group-hover:bg-blue-50 transition-colors border border-transparent group-hover:border-blue-100">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${b.status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-400'
                                                        }`}></div>
                                                    <div className="text-sm font-light text-slate-900">
                                                        {b.guest_info?.first_name} {b.guest_info?.last_name}
                                                    </div>
                                                </div>
                                                <div className="text-[11px] text-slate-400 font-light">
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

function StatCard({ icon: Icon, label, value, color, sublabel }: any) {
    const colorClasses: any = {
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        slate: 'bg-slate-50 text-slate-600',
    };

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
            </div>
            <div>
                <div className="text-2xl font-light text-slate-900 mb-0.5">{value}</div>
                <div className="text-xs font-light text-slate-900 mb-1">{label}</div>
                <p className="text-[10px] text-slate-400 font-light">{sublabel}</p>
            </div>
        </div>
    );
}

function ActionCard({ onClick, icon: Icon, title, description, color }: any) {
    const colorClasses: any = {
        blue: 'hover:border-blue-200 hover:bg-blue-50/30 icon-bg:bg-blue-50 icon-text:text-blue-600',
        violet: 'hover:border-violet-200 hover:bg-violet-50/30 icon-bg:bg-violet-50 icon-text:text-violet-600',
        emerald: 'hover:border-emerald-200 hover:bg-emerald-50/30 icon-bg:bg-emerald-50 icon-text:text-emerald-600',
        slate: 'hover:border-slate-200 hover:bg-slate-50/30 icon-bg:bg-slate-50 icon-text:text-slate-600',
        amber: 'hover:border-amber-200 hover:bg-amber-50/30 icon-bg:bg-amber-50 icon-text:text-amber-600',
    };

    const iconBg: any = {
        blue: 'bg-blue-50',
        violet: 'bg-violet-50',
        emerald: 'bg-emerald-50',
        slate: 'bg-slate-50',
        amber: 'bg-amber-50',
    };

    const iconColor: any = {
        blue: 'text-blue-600',
        violet: 'text-violet-600',
        emerald: 'text-emerald-600',
        slate: 'text-slate-600',
        amber: 'text-amber-600',
    };

    return (
        <button
            onClick={onClick}
            className={`text-left p-5 rounded-2xl border border-slate-100 bg-white transition-all group flex flex-col h-full ${colorClasses[color]}`}
        >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all ${iconBg[color]} ${iconColor[color]}`}>
                <Icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h4 className="text-base font-light text-slate-900 mb-1.5">{title}</h4>
            <p className="text-xs text-slate-400 font-light leading-relaxed mb-4">{description}</p>
            <div className="mt-auto flex items-center gap-1.5 text-[10px] font-light uppercase tracking-widest text-slate-300 group-hover:text-blue-500 transition-all">
                Apri <ArrowRight className="w-3 h-3" />
            </div>
        </button>
    );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
    return (
        <div className="flex items-center gap-4 mb-8">
            <button
                onClick={onBack}
                className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-700 hover:border-slate-200 transition-all shadow-sm"
            >
                <ArrowRight className="w-4 h-4 rotate-180" strokeWidth={1.5} />
            </button>
            <div>
                <h2 className="text-xl font-light text-slate-900 tracking-tight">{title}</h2>
                <p className="text-xs text-slate-400 font-light">Torna alla dashboard</p>
            </div>
        </div>
    );
}
