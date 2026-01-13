import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Calendar, Clock, Briefcase, ArrowLeft, CalendarDays } from 'lucide-react';
import BookingCatalog from './BookingCatalog';
import GoogleCalendarConfig from './GoogleCalendarConfig';
import BookingsCalendar from './BookingsCalendar';

export default function AdminDashboard() {
    const [activeView, setActiveView] = useState<'dashboard' | 'services' | 'availability' | 'calendars' | 'bookings'>('dashboard');
    const [recentBookings, setRecentBookings] = useState<any[]>([]);
    const [loadingBookings, setLoadingBookings] = useState(false);

    // Simple fetch for dashboard preview
    useEffect(() => {
        if (activeView === 'dashboard') {
            fetchRecentBookings();
        }
    }, [activeView]);

    async function fetchRecentBookings() {
        setLoadingBookings(true);
        // We might need to join with booking_items to get names
        // Note: Supabase join syntax: booking_items(name)
        const { data, error } = await supabase
            .from('bookings')
            .select('*, booking_items(name)')
            .order('created_at', { ascending: false })
            .limit(5);

        if (!error && data) {
            setRecentBookings(data);
        }
        setLoadingBookings(false);
    }

    if (activeView === 'services') {
        return (
            <div className="animate-fade-in">
                <button
                    onClick={() => setActiveView('dashboard')}
                    className="mb-4 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
                >
                    <ArrowLeft className="w-4 h-4" /> Torna alla Dashboard
                </button>
                <BookingCatalog />
            </div>
        );
    }

    if (activeView === 'calendars') {
        return <GoogleCalendarConfig onBack={() => setActiveView('dashboard')} />;
    }

    if (activeView === 'bookings') {
        return (
            <div className="animate-fade-in h-full flex flex-col">
                <button
                    onClick={() => setActiveView('dashboard')}
                    className="mb-4 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
                >
                    <ArrowLeft className="w-4 h-4" /> Torna alla Dashboard
                </button>
                <BookingsCalendar />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Configurazione Prenotazioni</h2>
                    <p className="text-slate-500">Gestisci servizi, disponibilità e regole.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Bookings Calendar Card */}
                <div
                    onClick={() => setActiveView('bookings')}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-indigo-200"
                >
                    <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                        <CalendarDays className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Calendario Prenotazioni</h3>
                    <p className="text-slate-500 text-sm">Visualizza e gestisci tutte le prenotazioni in un calendario.</p>
                </div>

                {/* Services Card */}
                <div
                    onClick={() => setActiveView('services')}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-blue-200"
                >
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                        <Briefcase className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Servizi</h3>
                    <p className="text-slate-500 text-sm">Crea e modifica i servizi prenotabili, imposta durate e prezzi.</p>
                </div>

                {/* Availability Card */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-emerald-200">
                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                        <Clock className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Disponibilità</h3>
                    <p className="text-slate-500 text-sm">Gestisci orari, turni e giorni di chiusura del team.</p>
                </div>

                {/* Calendar Sync Card */}
                <div
                    onClick={() => setActiveView('calendars')}
                    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-purple-200"
                >
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                        <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Calendari Esterni</h3>
                    <p className="text-slate-500 text-sm">Configura le integrazioni con Google e Apple Calendar.</p>
                </div>
            </div>

            <div className="mt-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Prossime Prenotazioni</h3>

                {loadingBookings ? (
                    <div className="text-center py-8 text-slate-400">Caricamento...</div>
                ) : recentBookings.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        Nessuna prenotazione recente da mostrare.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentBookings.map(b => (
                            <div key={b.id} className="bg-white p-4 rounded-lg border border-slate-100 flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-900">
                                        {b.guest_info?.first_name} {b.guest_info?.last_name}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        {b.booking_items?.name || 'Servizio'} • {new Date(b.start_time).toLocaleString('it-IT')}
                                    </div>
                                    {b.booking_items?.name && <div className="text-xs text-blue-600 mt-1 bg-blue-50 inline-block px-1.5 py-0.5 rounded">{b.booking_items.name}</div>}
                                </div>
                                <div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border
                                        ${b.status === 'confirmed' ? 'bg-green-100 text-green-700 border-green-200' :
                                            b.status === 'hold' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        {b.status === 'hold' ? 'In Attesa' : b.status === 'confirmed' ? 'Confermata' : 'Annullata'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
