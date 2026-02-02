import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import BookingCatalog from './BookingCatalog';
import GoogleCalendarConfig from './GoogleCalendarConfig';
import BookingsCalendar from './BookingsCalendar';
import AvailabilityCalendar from './AvailabilityCalendar';
import BookingWizard from '../user/BookingWizard';
import BookingDetailsModal from './BookingDetailsModal';
import { useToast } from '../../components/ui/Toast';

export default function BookingsHub() {
    const { showToast } = useToast();
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
    const [selectedBooking, setSelectedBooking] = useState<any>(null);

    useEffect(() => {
        checkAdmin();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) checkAdmin();
        });

        if (activeView === 'hub') {
            fetchHubData();
        }

        return () => {
            subscription.unsubscribe();
        };
    }, [activeView]);

    async function checkAdmin() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const isHardcodedAdmin = session.user.email === 'davide@gleeye.com' || session.user.email === 'davidegentile91@gmail.com';

        if (isHardcodedAdmin) {
            setIsAdmin(true);
        } else {
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
            const now = new Date();

            const { data: upcomingData } = await supabase
                .from('bookings')
                .select('*, booking_items(name), booking_assignments(collaborator_id)')
                .gte('start_time', now.toISOString())
                .order('start_time', { ascending: true })
                .limit(20);

            if (upcomingData) {
                setTodayBookings(upcomingData);
                setStats(prev => ({ ...prev, todayCount: upcomingData.length }));
            }

            const { count: pendingCount } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'hold');

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

    // Actions for Modal
    const handleBookingDelete = async (id: string) => {
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) {
            showToast('Errore durante l\'eliminazione', 'error');
        } else {
            showToast('Prenotazione eliminata', 'success');
            setSelectedBooking(null);
            fetchHubData();
        }
    };

    const handleStatusUpdate = async (id: string, status: string) => {
        const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
        if (error) {
            showToast('Errore aggiornamento', 'error');
        } else {
            showToast('Stato aggiornato', 'success');
            setSelectedBooking(null);
            fetchHubData();
        }
    };

    // --- SUB-VIEWS ---
    if (activeView === 'services') {
        return (
            <div className="animate-fade-in" style={{ padding: '0 1.5rem 3rem', maxWidth: 1400, margin: '0 auto' }}>
                <Header onBack={() => setActiveView('hub')} title="Catalogo Servizi" />
                <BookingCatalog />
            </div>
        );
    }

    if (activeView === 'calendars') {
        return <GoogleCalendarConfig onBack={() => setActiveView('hub')} />;
    }

    if (activeView === 'availability') {
        return (
            <div className="animate-fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    background: 'white',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <button
                        onClick={() => setActiveView('hub')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            color: '#6b7280',
                            fontWeight: 500
                        }}
                    >
                        <span className="material-icons-round" style={{ fontSize: 18 }}>arrow_back</span>
                        Dashboard
                    </button>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: 0, fontFamily: 'Outfit, system-ui, sans-serif' }}>Disponibilità Team</h2>
                    <div style={{ width: 100 }}></div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <AvailabilityCalendar />
                </div>
            </div>
        );
    }

    if (activeView === 'bookings') {
        return (
            <div className="animate-fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    background: 'white',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <button
                        onClick={() => setActiveView('hub')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            color: '#6b7280',
                            fontWeight: 500
                        }}
                    >
                        <span className="material-icons-round" style={{ fontSize: 18 }}>arrow_back</span>
                        Dashboard
                    </button>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: 0, fontFamily: 'Outfit, system-ui, sans-serif' }}>Calendario Operativo</h2>
                    <div style={{ width: 100 }}></div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <BookingsCalendar />
                </div>
            </div>
        );
    }

    if (activeView === 'new_booking') {
        return (
            <div className="animate-fade-in" style={{ padding: '0 1.5rem 3rem', maxWidth: 800, margin: '0 auto' }}>
                <Header onBack={() => setActiveView('hub')} title="Nuova Prenotazione" />
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <BookingWizard />
                </div>
            </div>
        );
    }

    // --- MAIN HUB ---
    return (
        <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 1.5rem 3rem' }}>

            {selectedBooking && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onDelete={handleBookingDelete}
                    onStatusUpdate={handleStatusUpdate}
                />
            )}

            {/* Header - matching ERP style */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        margin: 0,
                        color: '#1f2937',
                        fontFamily: 'Outfit, system-ui, sans-serif'
                    }}>Booking Hub</h2>
                </div>
                {/* Primary button matching ERP style exactly */}
                <button
                    onClick={() => setActiveView('new_booking')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        borderRadius: 50,
                        border: 'none',
                        background: 'linear-gradient(90deg, #4f7df3 0%, #7c5ce0 50%, #9061d8 100%)',
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'Outfit, system-ui, sans-serif',
                        boxShadow: '0 4px 14px rgba(124, 92, 224, 0.35)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 92, 224, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 92, 224, 0.35)';
                    }}
                >
                    <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
                    Nuova Prenotazione
                </button>
            </div>

            {/* Stats Grid - matching Funnel Commerciale cards style */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2.5rem'
            }}>
                <StatCard icon="event_available" label="Oggi" value={stats.todayCount} color="#1976d2" bgColor="#e3f2fd" />
                <StatCard icon="hourglass_empty" label="In Attesa" value={stats.pendingCount} color="#f59e0b" bgColor="#fef3c7" />
                <StatCard icon="trending_up" label="Crescita" value="+12%" color="#388e3c" bgColor="#e8f5e9" />
                <StatCard icon="groups" label="Team" value={stats.activeStaff} color="#6b7280" bgColor="#f3f4f6" />
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* Tools Section */}
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#f8f9fa'
                    }}>
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            fontFamily: 'Outfit, system-ui, sans-serif',
                            color: '#1f2937'
                        }}>Strumenti</h3>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isAdmin ? 5 : 4}, 1fr)`, gap: '1rem' }}>
                            <ToolCard onClick={() => setActiveView('bookings')} icon="calendar_month" label="Calendario" color="#1976d2" bgColor="#e3f2fd" />
                            <ToolCard onClick={() => setActiveView('services')} icon="work" label="Servizi" color="#7c3aed" bgColor="#ede9fe" />
                            <ToolCard onClick={() => setActiveView('availability')} icon="schedule" label="Disponibilità" color="#059669" bgColor="#d1fae5" />
                            <ToolCard
                                onClick={() => window.open(window.location.protocol + '//' + window.location.host + window.location.pathname, '_blank')}
                                icon="devices"
                                label="Test Modulo"
                                color="#d97706"
                                bgColor="#fef3c7"
                            />
                            {isAdmin && (
                                <ToolCard onClick={() => setActiveView('calendars')} icon="settings" label="Integrazioni" color="#6b7280" bgColor="#f3f4f6" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Today's Timeline */}
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden', minHeight: 400 }}>
                    <div style={{
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid #e5e7eb',
                        background: '#f8f9fa',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Outfit, system-ui, sans-serif', color: '#1f2937' }}>Prossimi</h3>
                        <span style={{
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: '#9ca3af',
                            fontWeight: 500
                        }}>Appuntamenti</span>
                    </div>

                    <div style={{ padding: '1rem 1.5rem', maxHeight: 350, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#9ca3af' }}>
                                <span className="material-icons-round" style={{ fontSize: 24, animation: 'spin 1s linear infinite' }}>sync</span>
                            </div>
                        ) : todayBookings.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <span className="material-icons-round" style={{ fontSize: 48, color: '#d1d5db', marginBottom: '0.75rem' }}>event_busy</span>
                                <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>Nessun appuntamento per oggi</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {todayBookings.map((b) => (
                                    <BookingCard key={b.id} booking={b} onClick={() => setSelectedBooking(b)} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- SUB-COMPONENTS matching ERP style ---

function StatCard({ icon, label, value, color, bgColor }: { icon: string; label: string; value: number | string; color: string; bgColor: string }) {
    return (
        <div className="glass-card" style={{
            padding: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderLeft: `4px solid ${color}`,
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 600, marginBottom: '0.5rem' }}>{label}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', lineHeight: 1, fontFamily: 'Outfit, system-ui, sans-serif' }}>{value}</div>
                </div>
                <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 12px ${color}20`
                }}>
                    <span className="material-icons-round" style={{ color: color, fontSize: 24 }}>{icon}</span>
                </div>
            </div>
        </div>
    );
}

function ToolCard({ onClick, icon, label, color, bgColor }: { onClick: () => void; icon: string; label: string; color: string; bgColor: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.25rem 0.75rem',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = bgColor;
                e.currentTarget.style.borderColor = color;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
            }}>
                <span className="material-icons-round" style={{ fontSize: 24, color: color }}>{icon}</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#4b5563', fontFamily: 'Outfit, system-ui, sans-serif' }}>{label}</span>
        </button>
    );
}

function BookingCard({ booking, onClick }: { booking: any; onClick?: () => void }) {
    const isConfirmed = booking.status === 'confirmed';

    return (
        <div
            onClick={onClick}
            className="glass-card clickable-card"
            style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
        >
            {/* Time Badge */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem 0.65rem',
                borderRadius: 12,
                background: '#f8f9fa',
                border: '1px solid #e5e7eb',
                minWidth: 52
            }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1, color: '#1f2937' }}>
                    {format(new Date(booking.start_time), 'dd/MM')}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2, color: '#6b7280', marginTop: 2 }}>
                    {format(new Date(booking.start_time), 'HH:mm')}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937', marginBottom: '0.1rem' }}>
                    {booking.guest_info?.company || 'Privato'}
                </div>
                <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                    {booking.guest_info?.first_name} {booking.guest_info?.last_name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    {booking.booking_items?.name}
                </div>
            </div>

            {/* Status dot */}
            <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isConfirmed ? 'rgba(16, 185, 129, 0.6)' : 'rgba(245, 158, 11, 0.6)'
            }}></div>
        </div>
    );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingTop: '1rem' }}>
            <button
                onClick={onBack}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                <span className="material-icons-round" style={{ fontSize: 20, color: '#6b7280' }}>arrow_back</span>
            </button>
            <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#1f2937', fontFamily: 'Outfit, system-ui, sans-serif' }}>{title}</h2>
            </div>
        </div>
    );
}
