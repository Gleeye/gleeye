import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { X, Calendar, Clock, Trash2, Edit2, User, Building2, Mail, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useState, useEffect } from 'react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

interface BookingDetailsModalProps {
    booking: any;
    onClose: () => void;
    onDelete: (id: string) => void;
    onStatusUpdate?: (id: string, newStatus: string) => void;
}

export default function BookingDetailsModal({ booking, onClose, onDelete, onStatusUpdate }: BookingDetailsModalProps) {
    const [collaborators, setCollaborators] = useState<any[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    useEffect(() => {
        if (booking?.booking_assignments) {
            fetchCollaborators();
        }
    }, [booking]);

    async function fetchCollaborators() {
        const ids = booking.booking_assignments.map((a: any) => a.collaborator_id);
        if (ids.length === 0) return;

        const { data } = await supabase
            .from('collaborators')
            .select('id, first_name, last_name, avatar_url')
            .in('id', ids);

        if (data) setCollaborators(data);
    }

    if (!booking) return null;
    if (!booking.start_time || !booking.end_time) {
        return (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm text-center" onClick={e => e.stopPropagation()}>
                    <p className="text-slate-600 font-medium mb-4">Dati della prenotazione incompleti.</p>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">Chiudi</button>
                </div>
            </div>
        );
    }

    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);

    // Safety check for Invalid Date
    const isValidDate = !isNaN(start.getTime()) && !isNaN(end.getTime());
    const dateStr = isValidDate ? format(start, 'EEEE d MMMM yyyy', { locale: it }) : 'Data non valida';
    const timeStr = isValidDate ? `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}` : '--:--';

    // Status Config
    const statusConfig: any = {
        'confirmed': { label: 'Confermato', bg: '#dcfce7', text: '#166534', icon: 'check_circle' },
        'pending': { label: 'In Attesa', bg: '#fef9c3', text: '#854d0e', icon: 'hourglass_empty' },
        'cancelled': { label: 'Annullato', bg: '#f1f5f9', text: '#64748b', icon: 'cancel' },
        'completed': { label: 'Completato', bg: '#dbeafe', text: '#1e40af', icon: 'task_alt' },
        'hold': { label: 'In Attesa', bg: '#fef9c3', text: '#854d0e', icon: 'hourglass_empty' }
    };
    const s = statusConfig[booking.status] || { label: booking.status, bg: '#f3f4f6', text: '#374151', icon: 'info' };

    // Guest Info - Priority to Company
    const guestFirstName = booking.guest_info?.first_name || '';
    const guestLastName = booking.guest_info?.last_name || '';
    const guestFullName = `${guestFirstName} ${guestLastName}`.trim() || 'Cliente Occasionale';
    const guestEmail = booking.guest_info?.email;
    const guestPhone = booking.guest_info?.phone;
    const guestCompany = booking.guest_info?.company;

    const primaryLabel = guestCompany || guestFullName;
    const guestInitial = primaryLabel.charAt(0).toUpperCase();

    const handleDelete = () => {
        setShowDeleteConfirm(true);
    };

    const handleCancel = () => {
        if (onStatusUpdate) {
            setShowCancelConfirm(true);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-[600px] max-h-[90vh] overflow-hidden shadow-2xl flex flex-col m-4"
                onClick={e => e.stopPropagation()}
                style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
            >
                {/* HEAD (Gradient) */}
                <div className="relative p-8 pb-6 border-b border-slate-200" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)' }}>

                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-500 hover:text-slate-800 transition-all hover:scale-110 active:scale-95 z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Status Pill */}
                    <div
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 shadow-sm"
                        style={{ backgroundColor: s.bg, color: s.text }}
                    >
                        {/* We use simple styling for icon placeholder if Lucide doesn't match perfectly, or just text */}
                        <span className="w-2 h-2 rounded-full" style={{ background: s.text }}></span>
                        {s.label}
                    </div>

                    <h2 className="text-3xl font-bold text-slate-800 mb-6 leading-tight">
                        {booking.booking_items?.name || 'Servizio Generico'}
                    </h2>

                    <div className="flex gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Data</div>
                                <div className="text-[0.95rem] font-semibold text-slate-700 capitalize">{dateStr}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Orario</div>
                                <div className="text-[0.95rem] font-semibold text-slate-700">{timeStr}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BODY */}
                <div className="p-8 overflow-y-auto">

                    <div className="grid grid-cols-1 gap-8 mb-8">
                        {/* Client Card */}
                        <div className="relative">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Building2 className="w-3 h-3" /> Cliente / Azienda
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-start gap-4">
                                <div className="w-14 h-14 min-w-[56px] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                                    {guestInitial}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {guestCompany ? (
                                        <>
                                            <div className="text-xl font-extrabold text-slate-800 leading-tight mb-1">{guestCompany}</div>
                                            <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5 mb-3">
                                                <User className="w-3 h-3" />
                                                {guestFullName}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-xl font-extrabold text-slate-800 leading-tight mb-3">{guestFullName}</div>
                                    )}

                                    <div className="space-y-1 pt-3 border-t border-dashed border-slate-200">
                                        {guestEmail && (
                                            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
                                                <Mail className="w-3 h-3 text-slate-400" />
                                                {guestEmail}
                                            </div>
                                        )}
                                        {guestPhone && (
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <Phone className="w-3 h-3 text-slate-400" />
                                                {guestPhone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Team Section */}
                        {collaborators.length > 0 && (
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Team Assegnato</div>
                                <div className="flex flex-wrap gap-2">
                                    {collaborators.map(c => (
                                        <div key={c.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 pl-1.5 pr-3 py-1.5 rounded-full transition-colors hover:border-blue-300">
                                            {c.avatar_url ? (
                                                <img src={c.avatar_url} className="w-7 h-7 rounded-full object-cover border border-slate-100" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                    {c.first_name[0]}
                                                </div>
                                            )}
                                            <span className="text-sm font-semibold text-slate-700">{c.first_name} {c.last_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Note</div>
                        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 text-slate-600 text-sm leading-relaxed min-h-[80px]">
                            {booking.notes || <span className="text-slate-400 italic">Nessuna nota aggiuntiva.</span>}
                        </div>
                    </div>

                </div>

                {/* FOOTER */}
                <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-600 text-[0.9rem] font-bold hover:bg-red-100 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Elimina
                    </button>

                    <div className="flex items-center gap-3">
                        {booking.status !== 'cancelled' && onStatusUpdate && (
                            <button
                                onClick={handleCancel}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-[0.9rem] font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            >
                                Annulla
                            </button>
                        )}

                        <button
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[0.9rem] font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:translate-y-[-1px] transition-all"
                            onClick={() => alert("Modifica completa in arrivo")}
                        >
                            <Edit2 className="w-4 h-4" />
                            Modifica
                        </button>
                    </div>
                </div>

            </div>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Elimina Prenotazione"
                message="Sei sicuro di voler eliminare questa prenotazione? Questa azione non può essere annullata."
                variant="danger"
                onConfirm={() => {
                    onDelete(booking.id);
                    setShowDeleteConfirm(false);
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            <ConfirmDialog
                isOpen={showCancelConfirm}
                title="Annulla Prenotazione"
                message="Vuoi annullare questa prenotazione? Il cliente riceverà una notifica."
                variant="warning"
                onConfirm={() => {
                    if (onStatusUpdate) onStatusUpdate(booking.id, 'cancelled');
                    setShowCancelConfirm(false);
                }}
                onCancel={() => setShowCancelConfirm(false)}
            />
        </div>
    );
}
