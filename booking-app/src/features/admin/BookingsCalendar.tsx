import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, startOfDay, addHours, eachHourOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
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
    notes?: string;
    guest_info: {
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
    };
    booking_items?: {
        name: string;
    };
    booking_assignments?: { collaborator_id: string }[];
}

const STATUS_COLORS = {
    hold: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
    confirmed: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
    cancelled: { bg: '#f1f5f9', border: '#94a3b8', text: '#64748b' }
};

export default function BookingsCalendar() {
    const { showToast } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'hold' | 'confirmed' | 'cancelled'>('all');
    const [activeCollab, setActiveCollab] = useState<string | 'all'>('all');
    const [activeService, setActiveService] = useState<string | 'all'>('all');
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

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { fetchBookings(); }, [currentDate, statusFilter, activeCollab, activeService]);

    async function fetchInitialData() {
        try {
            const [{ data: collabData }, { data: serviceData }] = await Promise.all([
                supabase.from('collaborators').select('id, first_name, last_name, avatar_url').order('first_name'),
                supabase.from('booking_items').select('id, name').order('name')
            ]);
            if (collabData) setCollaborators(collabData);
            if (serviceData) setServices(serviceData);
        } catch (err) {
            console.error(err);
        }
    }

    async function fetchBookings() {
        let query = supabase
            .from('bookings')
            .select('*, booking_items(name), booking_assignments(collaborator_id)')
            .gte('start_time', weekStart.toISOString())
            .lte('start_time', weekEnd.toISOString())
            .order('start_time', { ascending: true });

        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (activeService !== 'all') query = query.eq('booking_item_id', activeService);

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
    }

    async function handleDeleteBooking(id: string) {
        try {
            const { error } = await supabase.from('bookings').delete().eq('id', id);
            if (error) {
                showToast('Errore durante l\'eliminazione', 'error');
            } else {
                showToast('Prenotazione eliminata', 'success');
                setSelectedBooking(null);
                fetchBookings();
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Errore di sistema', 'error');
        } finally {
            setDeleteConfirm({ isOpen: false, bookingId: null });
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case 'hold': return 'In Attesa';
            case 'confirmed': return 'Confermata';
            case 'cancelled': return 'Annullata';
            default: return status;
        }
    }

    function getBookingsForDay(day: Date) {
        return bookings.filter(b => isSameDay(new Date(b.start_time), day));
    }

    function timeToPosition(date: Date): number {
        const h = date.getHours() + date.getMinutes() / 60;
        return h * 100; // 100px per hour
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 500, color: '#1f2937', fontFamily: 'Outfit, system-ui, sans-serif' }}>
                        {format(weekStart, 'd MMM', { locale: it })}
                        <span style={{ color: '#9ca3af' }}>→</span>
                        {format(weekEnd, 'd MMM yyyy', { locale: it })}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Calendario Prenotazioni</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', padding: '6px 12px', borderRadius: 6 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Servizio:</span>
                        <select value={activeService} onChange={e => setActiveService(e.target.value)} style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}>
                            <option value="all">Tutti</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <button onClick={() => setCurrentDate(prev => subWeeks(prev, 1))} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, color: '#6b7280', cursor: 'pointer' }}>
                        <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_left</span>
                    </button>
                    <button onClick={() => setCurrentDate(prev => addWeeks(prev, 1))} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, color: '#6b7280', cursor: 'pointer' }}>
                        <span className="material-icons-round" style={{ fontSize: 18 }}>chevron_right</span>
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} style={{ height: 32, padding: '0 1rem', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, fontSize: '0.85rem', fontWeight: 500, color: '#1f2937', cursor: 'pointer' }}>Oggi</button>
                </div>
            </div>

            {/* Collaborator Filter Row */}
            <div style={{ padding: '0.5rem 1.5rem', background: '#fafafa', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveCollab('all')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 16, border: 'none', background: activeCollab === 'all' ? '#4f46e5' : '#fff', color: activeCollab === 'all' ? '#fff' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <span className="material-icons-round" style={{ fontSize: 14 }}>groups</span> Tutti
                </button>
                {collaborators.map(c => {
                    const isActive = activeCollab === c.id;
                    return (
                        <button key={c.id} onClick={() => setActiveCollab(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 16, border: 'none', background: isActive ? '#4f46e5' : '#fff', color: isActive ? '#fff' : '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            {c.avatar_url ? (
                                <img src={c.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ width: 18, height: 18, borderRadius: '50%', background: isActive ? 'rgba(255,255,255,0.3)' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{c.first_name[0]}</span>
                            )}
                            {c.first_name}
                        </button>
                    );
                })}
            </div>

            {/* Status Filters */}
            <div style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stato:</span>
                {[
                    { value: 'all', label: 'Tutte' },
                    { value: 'hold', label: 'In Attesa' },
                    { value: 'confirmed', label: 'Confermate' },
                    { value: 'cancelled', label: 'Annullate' }
                ].map(f => (
                    <button key={f.value} onClick={() => setStatusFilter(f.value as any)} style={{ padding: '4px 10px', borderRadius: 12, border: statusFilter === f.value ? 'none' : '1px solid #e5e7eb', background: statusFilter === f.value ? '#1f2937' : '#fff', color: statusFilter === f.value ? '#fff' : '#6b7280', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Timeline */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb', background: '#fff', paddingLeft: 60 }}>
                    {daysInWeek.map(day => {
                        const isToday = isSameDay(day, today);
                        const dayBookings = getBookingsForDay(day);
                        return (
                            <div key={day.toISOString()} style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderRight: '1px solid #f3f4f6' }}>
                                <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: isToday ? '#4f46e5' : '#9ca3af', fontWeight: 600, marginBottom: 2, letterSpacing: '0.03em' }}>{format(day, 'EEE', { locale: it }).toUpperCase()}</span>
                                <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: isToday ? 600 : 300, color: isToday ? '#4f46e5' : '#6b7280', lineHeight: 1 }}>{format(day, 'd')}</span>
                                {dayBookings.length > 0 && (
                                    <span style={{ display: 'inline-block', marginTop: 4, fontSize: '0.65rem', background: '#4f46e5', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{dayBookings.length}</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Grid Body */}
                <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
                    {/* Time Gutter */}
                    <div style={{ width: 60, flexShrink: 0, borderRight: '1px solid #e5e7eb', background: '#fff' }}>
                        {hours.map(hour => (
                            <div key={hour.toString()} style={{ height: 100, position: 'relative' }}>
                                <span style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 8,
                                    transform: 'translateY(-50%)',
                                    fontSize: '0.75rem',
                                    color: '#9ca3af',
                                    background: '#fff',
                                    padding: '0 4px'
                                }}>
                                    {format(hour, 'HH:mm')}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Main Grid */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', position: 'relative' }}>
                        {/* Grid Lines */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none', zIndex: 0 }}>
                            {hours.map(hour => (
                                <div key={hour.toString()} style={{ height: 100, borderBottom: '1px solid rgba(0,0,0,0.04)', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: 50, left: 0, right: 0, borderBottom: '1px dashed rgba(0,0,0,0.03)' }} />
                                </div>
                            ))}
                        </div>

                        {/* Day Columns */}
                        {daysInWeek.map(day => {
                            const dayBookings = getBookingsForDay(day);
                            const isToday = isSameDay(day, today);

                            let nowIndicator = null;
                            if (isToday) {
                                const now = new Date();
                                const nowH = now.getHours() + now.getMinutes() / 60;
                                const topPx = nowH * 100;
                                nowIndicator = (
                                    <div style={{ position: 'absolute', left: 0, right: 0, top: topPx, borderTop: '2px solid #ef4444', zIndex: 30, pointerEvents: 'none' }}>
                                        <div style={{ position: 'absolute', left: -4, top: -5, width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }} />
                                    </div>
                                );
                            }

                            return (
                                <div key={day.toISOString()} style={{ position: 'relative', borderRight: '1px solid #f3f4f6' }}>
                                    {hours.map(hour => <div key={hour.toString()} style={{ height: 100 }} />)}

                                    {/* Booking Cards */}
                                    {dayBookings.map(booking => {
                                        const start = new Date(booking.start_time);
                                        const end = new Date(booking.end_time);
                                        const top = timeToPosition(start);
                                        const height = Math.max(timeToPosition(end) - top, 100);
                                        const colors = STATUS_COLORS[booking.status] || STATUS_COLORS.hold;

                                        // if (start.getHours() < 7 || start.getHours() > 21) return null; // Removed limit

                                        return (
                                            <div
                                                key={booking.id}
                                                onClick={() => setSelectedBooking(booking)}
                                                style={{
                                                    position: 'absolute',
                                                    top,
                                                    left: 4,
                                                    right: 4,
                                                    minHeight: height,
                                                    height: 'auto',
                                                    background: '#fff',
                                                    borderLeft: `5px solid ${colors.border}`,
                                                    borderRadius: 8,
                                                    padding: '6px 10px',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                    cursor: 'pointer',
                                                    zIndex: 20,
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: colors.border, marginBottom: 2 }}>
                                                    {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                                </div>
                                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.2, wordBreak: 'break-word', marginBottom: 2 }}>
                                                    {booking.booking_items?.name || 'Prenotazione'}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {booking.guest_info?.first_name} {booking.guest_info?.last_name}
                                                    {(booking.guest_info as any)?.company && ` - ${(booking.guest_info as any).company}`}
                                                </div>
                                                {height > 120 && (booking.guest_info as any)?.company && (
                                                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {(booking.guest_info as any).company}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {nowIndicator}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Booking Detail Modal */}
            {selectedBooking && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedBooking(null)}>
                    <div style={{ background: '#fff', borderRadius: 12, maxWidth: 500, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>Dettagli Prenotazione</h3>
                            <button onClick={() => setSelectedBooking(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}>
                                <span className="material-icons-round" style={{ fontSize: 20 }}>close</span>
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            {/* Service & Time */}
                            <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: 8, borderLeft: `4px solid ${STATUS_COLORS[selectedBooking.status]?.border || '#6366f1'}`, marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>{selectedBooking.booking_items?.name || 'Prenotazione'}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: '#6b7280' }}>
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>schedule</span>
                                    {format(new Date(selectedBooking.start_time), 'HH:mm')} - {format(new Date(selectedBooking.end_time), 'HH:mm')}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: 4 }}>
                                    {format(new Date(selectedBooking.start_time), 'EEEE d MMMM yyyy', { locale: it })}
                                </div>
                            </div>

                            {/* Client Info */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>Cliente</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, background: '#e0e7ff', color: '#4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                                        {selectedBooking.guest_info?.first_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '1rem' }}>{selectedBooking.guest_info?.first_name} {selectedBooking.guest_info?.last_name}</div>
                                        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>{selectedBooking.guest_info?.email}</div>
                                        {selectedBooking.guest_info?.phone && <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>{selectedBooking.guest_info?.phone}</div>}
                                    </div>
                                </div>
                            </div>

                            {/* Collaborators */}
                            {selectedBooking.booking_assignments && selectedBooking.booking_assignments.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>Collaboratori Assegnati</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {selectedBooking.booking_assignments.map(assignment => {
                                            const collab = collaborators.find(c => c.id === assignment.collaborator_id);
                                            if (!collab) return null;
                                            return (
                                                <div key={assignment.collaborator_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f3f4f6', padding: '6px 12px', borderRadius: 20 }}>
                                                    {collab.avatar_url ? (
                                                        <img src={collab.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                                                            {collab.first_name[0]}{collab.last_name?.[0]}
                                                        </div>
                                                    )}
                                                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>{collab.first_name} {collab.last_name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Status */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>Stato</h4>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: STATUS_COLORS[selectedBooking.status]?.bg, color: STATUS_COLORS[selectedBooking.status]?.text }}>
                                    {getStatusLabel(selectedBooking.status)}
                                </span>
                            </div>

                            {/* Notes */}
                            {selectedBooking.notes && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>Note</h4>
                                    <p style={{ fontSize: '0.9rem', color: '#6b7280', background: '#f9fafb', padding: '0.75rem', borderRadius: 6, margin: 0 }}>{selectedBooking.notes}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 12, marginTop: '1.5rem' }}>
                                <button onClick={() => setSelectedBooking(null)} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}>Chiudi</button>
                                <button onClick={() => { setDeleteConfirm({ isOpen: true, bookingId: selectedBooking.id }); }} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#dc2626', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="material-icons-round" style={{ fontSize: 16 }}>delete</span>
                                    Elimina
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
