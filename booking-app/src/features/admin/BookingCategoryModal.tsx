import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { BookingCategory } from '../../types';
import { X, Loader2, Save } from 'lucide-react';
import BookingCategorySelect from './BookingCategorySelect';

interface BookingCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    categories: BookingCategory[];
    editCategory?: BookingCategory | null;
}

export default function BookingCategoryModal({ isOpen, onClose, onSuccess, categories, editCategory }: BookingCategoryModalProps) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            if (editCategory) {
                setName(editCategory.name);
                setParentId(editCategory.parent_id || '');
            } else {
                setName('');
                setParentId('');
            }
        }
    }, [isOpen, editCategory]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                name,
                parent_id: parentId || null
            };

            if (editCategory) {
                const { error } = await supabase
                    .from('booking_categories')
                    .update(payload)
                    .eq('id', editCategory.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('booking_categories')
                    .insert(payload);
                if (error) throw error;
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Errore durante il salvataggio');
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    // Filter out the current category and its children to avoid circular references (simple version: just current)
    const availableParents = categories.filter(c => !editCategory || c.id !== editCategory.id);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">
                        {editCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome Categoria</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700"
                            placeholder="Es. Servizi Corporate"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Categoria Genitore (opzionale)</label>
                        <BookingCategorySelect
                            categories={availableParents}
                            value={parentId}
                            onChange={setParentId}
                            showNone={true}
                            noneLabel="Nessuna (Categoria principale)"
                        />
                        <p className="text-[10px] uppercase font-bold text-slate-400 mt-2 tracking-wide px-1">
                            Seleziona un genitore per creare una sottocategoria.
                        </p>
                    </div>

                    <div className="pt-4 flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editCategory ? 'Aggiorna' : 'Crea'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
