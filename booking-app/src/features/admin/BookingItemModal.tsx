import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { BookingCategory } from '../../types';
import { X, Loader2, Clock, CreditCard, Eye, Home, Globe, LayoutGrid, Users, Settings, ShieldCheck, Calendar, AlertCircle, Trash2 } from 'lucide-react';
import BookingCategorySelect from './BookingCategorySelect';
import CollaboratorMultiSelect from './CollaboratorMultiSelect';
import CustomSelect from './CustomSelect';

interface BookingItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    preselectedCategoryId?: string | null;
    editItem?: any; // Pass item for editing
}

type Tab = 'details' | 'rules' | 'staff';
import { useToast } from '../../components/ui/Toast';

export default function BookingItemModal({ isOpen, onClose, onSuccess, preselectedCategoryId, editItem }: BookingItemModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<BookingCategory[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('details');

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState('30');
    const [categoryId, setCategoryId] = useState(preselectedCategoryId || '');

    // Rule Options
    const minNoticeOptions = [
        { value: 0, label: 'Nessun preavviso', icon: AlertCircle },
        { value: 60, label: '1 Ora prima', icon: Clock },
        { value: 120, label: '2 Ore prima', icon: Clock },
        { value: 1440, label: '1 Giorno prima', icon: Clock },
        { value: 2880, label: '2 Giorni prima', icon: Clock },
    ];

    const cancellationOptions = [
        { value: 'flexible', label: "Flessibile (fino all'inizio)", icon: ShieldCheck },
        { value: 'standard', label: 'Standard (fino a 24h prima)', icon: ShieldCheck },
        { value: 'strict', label: 'Rigida (fino a 48h prima)', icon: ShieldCheck },
    ];

    const recurrenceOptions = [
        { value: 'none', label: 'Non Ricorrente (Singolo)', icon: Calendar },
        { value: 'daily', label: 'Ogni Giorno', icon: Calendar },
        { value: 'weekly', label: 'Ogni Settimana', icon: Calendar },
        { value: 'monthly', label: 'Ogni Mese', icon: Calendar },
    ];

    // New Fields
    const [isActive, setIsActive] = useState(true); // Visibilità Online
    const [paymentRequired, setPaymentRequired] = useState(false); // Pagamento
    const [locationType, setLocationType] = useState<'in_person' | 'remote' | 'other'>('in_person');
    const [locationAddress, setLocationAddress] = useState('');

    // Rules Tab Fields
    const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);
    const [minNoticeMinutes, setMinNoticeMinutes] = useState(1440); // 1 day
    const [cancellationPolicy, setCancellationPolicy] = useState('standard');
    const [bufferBefore, setBufferBefore] = useState(0);
    const [bufferAfter, setBufferAfter] = useState(0);
    const [requiresConfirmation, setRequiresConfirmation] = useState(false);
    const [recurrenceRule, setRecurrenceRule] = useState('none');

    // Staff Tab Fields
    const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
    const [logicType, setLogicType] = useState<'OR' | 'AND'>('OR');

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            if (editItem) {
                // Populate state
                setName(editItem.name || '');
                setDescription(editItem.description || '');
                setPrice(editItem.price?.toString() || '');
                setDuration(editItem.duration_minutes?.toString() || '30');
                setCategoryId(editItem.category_id || preselectedCategoryId || '');
                setIsActive(editItem.is_active !== false);
                setPaymentRequired(editItem.payment_required || false);
                setLocationType(editItem.location_type || 'in_person');
                setLocationAddress(editItem.location_address || '');
                setMaxAdvanceDays(editItem.max_advance_days || 60);
                setMinNoticeMinutes(editItem.min_notice_minutes || 1440);
                setCancellationPolicy(editItem.cancellation_policy || 'standard');
                setBufferBefore(editItem.buffer_before_minutes || 0);
                setBufferAfter(editItem.buffer_after_minutes || 0);
                setRequiresConfirmation(editItem.requires_confirmation || false);
                setRecurrenceRule(editItem.recurrence_rule || 'none');
                setLogicType(editItem.logic_type || 'OR');

                // Fetch assigned collaborators
                fetchAssignments(editItem.id);
            } else {
                setCategoryId(preselectedCategoryId || '');
            }
        }
    }, [isOpen, preselectedCategoryId, editItem]);

    async function fetchAssignments(itemId: string) {
        const { data } = await supabase
            .from('booking_item_collaborators')
            .select('collaborator_id')
            .eq('booking_item_id', itemId);

        if (data) {
            setSelectedCollaborators(data.map(c => c.collaborator_id));
        }
    }

    async function fetchCategories() {
        const { data } = await supabase.from('booking_categories').select('*').order('name');
        if (data) setCategories(data);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                name,
                description,
                price: paymentRequired ? (parseFloat(price) || 0) : 0,
                duration_minutes: parseInt(duration) || 30,
                category_id: categoryId || null,
                is_active: isActive,
                payment_required: paymentRequired,
                location_type: locationType,
                location_address: locationType === 'other' ? locationAddress : (locationType === 'in_person' ? 'Sede' : 'Remoto'),
                max_advance_days: maxAdvanceDays,
                min_notice_minutes: minNoticeMinutes,
                cancellation_policy: cancellationPolicy,
                buffer_before_minutes: bufferBefore,
                buffer_after_minutes: bufferAfter,
                requires_confirmation: requiresConfirmation,
                recurrence_rule: recurrenceRule,
                logic_type: logicType
            };

            let itemData, itemError;

            if (editItem) {
                const { data, error } = await supabase
                    .from('booking_items')
                    .update(payload)
                    .eq('id', editItem.id)
                    .select()
                    .single();
                itemData = data;
                itemError = error;
            } else {
                const { data, error } = await supabase
                    .from('booking_items')
                    .insert(payload)
                    .select()
                    .single();
                itemData = data;
                itemError = error;
            }

            if (itemError) throw itemError;

            // 2. Manage Collaborator Assignments
            if (itemData) {
                // Remove old assignments if editing
                if (editItem) {
                    await supabase.from('booking_item_collaborators').delete().eq('booking_item_id', itemData.id);
                }

                if (selectedCollaborators.length > 0) {
                    const collabInserts = selectedCollaborators.map(collabId => ({
                        booking_item_id: itemData.id,
                        collaborator_id: collabId
                    }));

                    const { error: collabError } = await supabase
                        .from('booking_item_collaborators')
                        .insert(collabInserts);

                    if (collabError) throw collabError;
                }
            }

            showToast(editItem ? "Servizio aggiornato!" : "Servizio creato con successo!", "success");
            onSuccess();
            handleClose();
        } catch (error: any) {
            console.error('Error creating item:', error);
            showToast(error.message || 'Errore durante il salvataggio', "error");
        } finally {
            setLoading(false);
        }
    }

    function handleClose() {
        setName('');
        setDescription('');
        setPrice('');
        setDuration('30');
        setIsActive(true);
        setPaymentRequired(false);
        setLocationType('in_person');
        setLocationAddress('');
        // Reset Rules
        setMaxAdvanceDays(60);
        setMinNoticeMinutes(1440);
        setCancellationPolicy('standard');
        setBufferBefore(0);
        setBufferAfter(0);
        setRequiresConfirmation(false);
        setRecurrenceRule('none');
        // Reset Staff
        setSelectedCollaborators([]);
        setLogicType('OR');

        setActiveTab('details');
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-900">{editItem ? 'Modifica Servizio' : 'Crea Nuovo Servizio'}</h2>
                            {editItem && (
                                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 pr-3 border border-slate-200">
                                    <div className="bg-white px-2 py-1 rounded border border-slate-200 text-[10px] font-mono text-slate-500 select-all">
                                        http://localhost:5173/?service_id={editItem.id}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const url = `http://localhost:5173/?service_id=${editItem.id}`;
                                            navigator.clipboard.writeText(url);
                                            showToast('Link copiato!', 'success');
                                        }}
                                        className="text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md"
                                        title="Copia negli appunti"
                                    >
                                        <Globe className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'details'
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                    }`}
                            >
                                <LayoutGrid className="w-4 h-4" /> Dettagli
                            </button>
                            <button
                                onClick={() => setActiveTab('rules')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'rules'
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                    }`}
                            >
                                <Settings className="w-4 h-4" /> Regole
                            </button>
                            <button
                                onClick={() => setActiveTab('staff')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'staff'
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                    }`}
                            >
                                <Users className="w-4 h-4" /> Staff
                            </button>
                        </div>
                    </div>

                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
                    {activeTab === 'details' && (
                        <div className="flex gap-8 h-full">
                            {/* Left Column: Main Info */}
                            <div className="flex-1 space-y-6">
                                {/* Service Name */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome del Servizio</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full px-5 py-4 text-lg font-medium bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                                        placeholder="Es. Consulenza Strategica"
                                    />
                                </div>

                                {/* Description */}
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Globe className="w-3 h-3" /> Descrizione Pubblica
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full px-5 py-4 h-40 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-slate-600"
                                        placeholder="Descrivi cosa include il servizio, i benefici e cosa deve aspettarsi il cliente..."
                                    />
                                </div>

                                {/* Toggles Row */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Visibility Card */}
                                    <div className={`p-5 rounded-xl border flex flex-col justify-between h-32 transition-colors ${isActive ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
                                        }`}>
                                        <div className="flex justify-between items-start">
                                            <div className={`p-2 rounded-lg ${isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Eye className="w-5 h-5" />
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                            </label>
                                        </div>
                                        <div>
                                            <h4 className={`font-bold ${isActive ? 'text-green-800' : 'text-slate-700'}`}>Visibilità Online</h4>
                                            <p className={`text-xs ${isActive ? 'text-green-600' : 'text-slate-400'}`}>Visibile nel Widget</p>
                                        </div>
                                    </div>

                                    {/* Payment Card */}
                                    <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between h-32">
                                        <div className="flex justify-between items-start">
                                            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={paymentRequired} onChange={e => setPaymentRequired(e.target.checked)} />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                            </label>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">Pagamento</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                {paymentRequired ? (
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                                                        <input
                                                            type="number"
                                                            value={price}
                                                            onChange={e => setPrice(e.target.value)}
                                                            className="w-24 pl-5 py-1 text-sm border rounded bg-slate-50"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400">Gratuito / In Loco</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Parameters Sidebar */}
                            <div className="w-1/3 min-w-[320px]">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 h-full">
                                    <div className="flex items-center gap-2 mb-6 text-slate-800 border-b border-slate-100 pb-4">
                                        <Settings className="w-5 h-5" />
                                        <h3 className="font-bold text-lg">Parametri</h3>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Category */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categoria</label>
                                            <BookingCategorySelect
                                                categories={categories}
                                                value={categoryId}
                                                onChange={setCategoryId}
                                                placeholder="Scegli Categoria"
                                            />
                                        </div>

                                        {/* Duration */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Durata (min)</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input
                                                    type="number"
                                                    value={duration}
                                                    onChange={e => setDuration(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700"
                                                    placeholder="30"
                                                />
                                            </div>
                                        </div>

                                        {/* Location */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dove Avviene?</label>
                                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                                <button
                                                    type="button"
                                                    onClick={() => setLocationType('remote')}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${locationType === 'remote'
                                                        ? 'bg-white text-indigo-600 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    <Globe className="w-3.5 h-3.5" /> Remoto
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLocationType('in_person')}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${locationType === 'in_person'
                                                        ? 'bg-white text-indigo-600 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    <Home className="w-3.5 h-3.5" /> In Sede
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLocationType('other')}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${locationType === 'other'
                                                        ? 'bg-white text-indigo-600 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    <LayoutGrid className="w-3.5 h-3.5" /> Altrove
                                                </button>
                                            </div>

                                            {locationType === 'other' && (
                                                <div className="mt-3 animate-slide-down">
                                                    <input
                                                        type="text"
                                                        value={locationAddress}
                                                        onChange={e => setLocationAddress(e.target.value)}
                                                        placeholder="Inserisci indirizzo o luogo..."
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'rules' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* Booking Window */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 text-slate-800">
                                    <Clock className="w-5 h-5" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Finestra di Prenotazione</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Max Advance */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-slate-700 text-sm mb-1">Anticipo Massimo</h4>
                                            <p className="text-xs text-slate-400">Quanto in futuro si può prenotare?</p>
                                        </div>
                                        <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setMaxAdvanceDays(Math.max(1, maxAdvanceDays - 1))}
                                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded transition-all"
                                            >
                                                -
                                            </button>
                                            <span className="font-bold text-slate-900 text-sm whitespace-nowrap min-w-[3rem] text-center">{maxAdvanceDays} GG</span>
                                            <button
                                                type="button"
                                                onClick={() => setMaxAdvanceDays(maxAdvanceDays + 1)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded transition-all"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Min Notice */}
                                        <CustomSelect
                                            label="Minimo Preavviso"
                                            value={minNoticeMinutes}
                                            onChange={setMinNoticeMinutes}
                                            options={minNoticeOptions}
                                        />

                                        {/* Cancellation Policy */}
                                        <CustomSelect
                                            label="Policy Cancellazione"
                                            value={cancellationPolicy}
                                            onChange={setCancellationPolicy}
                                            options={cancellationOptions}
                                        />
                                    </div>
                                </div>
                            </section>

                            <div className="grid grid-cols-2 gap-8">
                                {/* Technical Buffers */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4 text-slate-800">
                                        <div className="w-5 h-5 flex items-center justify-center font-serif italic text-slate-900 font-bold">∑</div>
                                        <h3 className="font-bold text-sm uppercase tracking-wider">Buffer Tecnici</h3>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Prima (Min)</label>
                                                <input
                                                    type="number"
                                                    value={bufferBefore}
                                                    onChange={e => setBufferBefore(parseInt(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-800"
                                                />
                                            </div>
                                            <div className="text-slate-300">-</div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dopo (Min)</label>
                                                <input
                                                    type="number"
                                                    value={bufferAfter}
                                                    onChange={e => setBufferAfter(parseInt(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-800"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            Tempo extra aggiunto automaticamente per preparare la sala o spostarsi tra appuntamenti.
                                        </p>
                                    </div>
                                </section>

                                {/* Approval */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4 text-slate-800">
                                        <div className="w-5 h-5 flex items-center justify-center border border-slate-800 rounded-full pb-[2px]">!</div>
                                        <h3 className="font-bold text-sm uppercase tracking-wider">Approvazione</h3>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between h-[155px]">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-slate-800">Richiedi Conferma Manuale</h4>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={requiresConfirmation}
                                                    onChange={e => setRequiresConfirmation(e.target.checked)}
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                            </label>
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            {requiresConfirmation
                                                ? "Le prenotazioni richiedono la tua approvazione prima di essere confermate."
                                                : "Le prenotazioni vengono confermate immediatamente appena il cliente prenota."}
                                        </p>
                                    </div>
                                </section>
                            </div>

                            {/* Recurrence */}
                            <section>
                                <div className="flex items-center gap-2 mb-4 text-slate-800">
                                    <Clock className="w-5 h-5 rotate-180" />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Regole Ricorrenza</h3>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                                    <CustomSelect
                                        label="Frequenza Ripetizione"
                                        value={recurrenceRule}
                                        onChange={setRecurrenceRule}
                                        options={recurrenceOptions}
                                    />
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'staff' && (
                        <div className="space-y-10 animate-fade-in max-w-4xl mx-auto">
                            {/* Collaborator Selection */}
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Chi esegue il servizio?</h3>
                                <p className="text-slate-500 mb-6">Seleziona i collaboratori abilitati per questo servizio.</p>

                                <div className="space-y-4">
                                    <div className="p-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">COLLABORATORI ASSEGNATI</label>
                                        <CollaboratorMultiSelect
                                            value={selectedCollaborators}
                                            onChange={setSelectedCollaborators}
                                        />
                                    </div>

                                    {selectedCollaborators.length === 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm font-medium">
                                                Importante: Se non selezioni nessun collaboratore, il servizio <span className="font-bold">non sarà prenotabile</span> dai clienti.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Assignment Logic */}
                            <section className="pt-8 border-t border-slate-100">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-2">LOGICA DI ASSEGNAZIONE</h3>
                                <p className="text-slate-400 text-sm mb-6">Definisci come gestire la disponibilità se ci sono più operatori selezionati.</p>

                                <div className="grid grid-cols-2 gap-6">
                                    {/* OR Logic */}
                                    <div
                                        onClick={() => setLogicType('OR')}
                                        className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all ${logicType === 'OR'
                                            ? 'border-indigo-600 bg-indigo-50/50'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className={`font-bold text-lg ${logicType === 'OR' ? 'text-indigo-900' : 'text-slate-800'}`}>Qualsiasi (OR)</h4>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${logicType === 'OR' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                                                }`}>
                                                {logicType === 'OR' && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Il cliente può prenotare se <span className="font-bold">ALMENO UNO</span> degli staff selezionati è libero. (Standard)
                                        </p>
                                    </div>

                                    {/* AND Logic */}
                                    <div
                                        onClick={() => setLogicType('AND')}
                                        className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all ${logicType === 'AND'
                                            ? 'border-indigo-600 bg-indigo-50/50'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className={`font-bold text-lg ${logicType === 'AND' ? 'text-indigo-900' : 'text-slate-800'}`}>Tutti Insieme (AND)</h4>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${logicType === 'AND' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                                                }`}>
                                                {logicType === 'AND' && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Il cliente può prenotare solo se <span className="font-bold">TUTTI</span> gli staff selezionati sono liberi contemporaneamente. (Equipe)
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center">
                    <div>
                        {editItem && (
                            <button
                                onClick={async () => {
                                    if (confirm('Sei sicuro di voler eliminare questo servizio?')) {
                                        setLoading(true);
                                        const { error } = await supabase.from('booking_items').delete().eq('id', editItem.id);
                                        if (error) {
                                            showToast('Errore durante l\'eliminazione', 'error');
                                            setLoading(false);
                                        } else {
                                            showToast('Servizio eliminato', 'success');
                                            onSuccess();
                                            handleClose();
                                        }
                                    }
                                }}
                                disabled={loading}
                                className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Elimina
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleClose}
                            className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            Annulla
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            Salva Modifiche
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
