import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { BookingItem, BookingCategory } from '../../types';
import { Plus, Briefcase, ChevronRight, Folder, FolderOpen, Loader2, Edit2, Trash2, ChevronDown } from 'lucide-react';
import BookingItemModal from './BookingItemModal';
import BookingCategoryModal from './BookingCategoryModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

export default function BookingCatalog() {
    const { showToast } = useToast();
    const [categories, setCategories] = useState<BookingCategory[]>([]);
    const [nestedCategories, setNestedCategories] = useState<BookingCategory[]>([]);
    const [items, setItems] = useState<BookingItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<BookingCategory | null>(null);
    const [editingItem, setEditingItem] = useState<BookingItem | null>(null);
    const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

    // Confirm Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchData();
    }, [selectedCategory]);

    async function fetchData() {
        setLoading(true);
        try {
            const { data: catData } = await supabase
                .from('booking_categories')
                .select('*')
                .order('name');

            if (catData) {
                setCategories(catData);
                setNestedCategories(nestCategories(catData));
            }

            let query = supabase.from('booking_items').select('*').order('name');
            if (selectedCategory) {
                query = query.eq('category_id', selectedCategory);
            }
            const { data: itemData } = await query;
            if (itemData) setItems(itemData);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    function nestCategories(cats: BookingCategory[]): BookingCategory[] {
        const map = new Map<string, any>();
        cats.forEach(c => map.set(c.id, { ...c, subcategories: [] }));
        const result: BookingCategory[] = [];
        cats.forEach(c => {
            if (c.parent_id && map.has(c.parent_id)) {
                map.get(c.parent_id).subcategories.push(map.get(c.id));
            } else {
                result.push(map.get(c.id));
            }
        });
        return result;
    }

    async function deleteCategory(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        setConfirmDialog({
            isOpen: true,
            title: 'Elimina Categoria',
            message: 'Sei sicuro di voler eliminare questa categoria? Le voci collegate verranno scolligate.',
            variant: 'danger',
            onConfirm: async () => {
                const { error } = await supabase.from('booking_categories').delete().eq('id', id);
                if (error) {
                    showToast('Errore durante l\'eliminazione', 'error');
                } else {
                    showToast('Categoria eliminata', 'success');
                    if (selectedCategory === id) setSelectedCategory(null);
                    fetchData();
                }
                setConfirmDialog({ ...confirmDialog, isOpen: false });
            }
        });
    }

    async function deleteItem(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        setConfirmDialog({
            isOpen: true,
            title: 'Elimina Servizio',
            message: 'Sei sicuro di voler eliminare questo servizio? Questa azione non può essere annullata.',
            variant: 'danger',
            onConfirm: async () => {
                const { error } = await supabase.from('booking_items').delete().eq('id', id);
                if (error) {
                    showToast('Errore durante l\'eliminazione del servizio', 'error');
                } else {
                    showToast('Servizio eliminato', 'success');
                    fetchData();
                }
                setConfirmDialog({ ...confirmDialog, isOpen: false });
            }
        });
    }

    const toggleExpand = (id: string) => {
        setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderCategory = (cat: any, depth = 0) => {
        const isSelected = selectedCategory === cat.id;
        const hasSubs = cat.subcategories && cat.subcategories.length > 0;
        const isExpanded = expandedCats[cat.id];

        return (
            <div key={cat.id} className="space-y-1">
                <div
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'
                        }`}
                    style={{ marginLeft: `${depth * 12}px` }}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {hasSubs && (
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
                                className={`p-0.5 hover:bg-slate-200 rounded transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                            >
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        )}
                        {!hasSubs && <div className="w-4" />}
                        {isSelected ? <FolderOpen className="w-4 h-4 flex-shrink-0" /> : <Folder className="w-4 h-4 flex-shrink-0" />}
                        <span className="truncate">{cat.name}</span>
                    </div>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setIsCategoryModalOpen(true); }}
                            className="p-1 hover:text-blue-600"
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => deleteCategory(e, cat.id)}
                            className="p-1 hover:text-red-600"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
                {hasSubs && isExpanded && (
                    <div className="space-y-1">
                        {cat.subcategories.map((sub: any) => renderCategory(sub, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-[calc(100vh-100px)] animate-fade-in bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Left Sidebar: Categories */}
            <div className="w-1/4 min-w-[280px] border-r border-slate-200 bg-slate-50 flex flex-col">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white sticky top-0">
                    <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Categorie</h3>
                    <button
                        onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors"
                        title="Aggiungi Categoria"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${selectedCategory === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'
                            }`}
                    >
                        <Folder className="w-4 h-4" />
                        Tutte le Voci
                    </button>

                    <div className="pt-2 border-t border-slate-100 mt-2 space-y-1">
                        {nestedCategories.map(cat => renderCategory(cat))}
                    </div>

                    {categories.length === 0 && !loading && (
                        <div className="text-xs text-slate-400 p-4 text-center italic">
                            Nessuna categoria creata.
                        </div>
                    )}
                </div>
            </div>

            {/* Right Content: Grid */}
            <div className="flex-1 flex flex-col bg-slate-50/50">
                {/* Toolbar */}
                <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'Listino Completo'}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {items.length} voci attive
                        </p>
                    </div>
                    <button
                        onClick={() => setIsItemModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Nuova Voce
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mr-2" /> Caricamento...
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 m-4">
                            <Briefcase className="w-12 h-12 mb-4 text-slate-300" />
                            <p>Nessuna voce in questa categoria</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }}
                                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer hover:border-blue-200"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors text-slate-500">
                                            <Briefcase className="w-5 h-5" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => deleteItem(e, item.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Elimina Servizio"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                {item.duration_minutes} min
                                            </span>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-1">{item.name}</h3>
                                    <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px]">
                                        {item.description || 'Nessuna descrizione.'}
                                    </p>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                        <span className="font-bold text-slate-900">
                                            € {item.price?.toFixed(2) || '0.00'}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                variant={confirmDialog.variant}
                confirmText="Elimina"
                cancelText="Annulla"
            />

            <BookingItemModal
                isOpen={isItemModalOpen}
                onClose={() => { setIsItemModalOpen(false); setEditingItem(null); }}
                onSuccess={fetchData}
                preselectedCategoryId={selectedCategory}
                editItem={editingItem}
            />

            <BookingCategoryModal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onSuccess={fetchData}
                categories={categories}
                editCategory={editingCategory}
            />
        </div>
    );
}
