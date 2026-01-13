import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Check, ChevronDown, User, Search, X } from 'lucide-react';

interface Collaborator {
    id: string;
    full_name: string;
    role?: string;
    avatar_url?: string;
}

interface CollaboratorMultiSelectProps {
    value: string[];
    onChange: (ids: string[]) => void;
    label?: string;
}

export default function CollaboratorMultiSelect({ value, onChange, label }: CollaboratorMultiSelectProps) {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchCollaborators();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function fetchCollaborators() {
        const { data } = await supabase
            .from('collaborators')
            .select('id, full_name, role') // Avatar URL if it exists, but simplified for now
            .order('full_name');

        if (data) setCollaborators(data);
    }

    const toggleSelection = (id: string) => {
        const newValue = value.includes(id)
            ? value.filter(v => v !== id)
            : [...value, id];
        onChange(newValue);
    };

    const removeSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== id));
    };

    const filteredCollaborators = collaborators.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedCollaborators = collaborators.filter(c => value.includes(c.id));

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {label}
                    </label>
                    {value.length > 0 && (
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {value.length} Selezionati
                        </span>
                    )}
                </div>
            )}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`min-h-[50px] w-full px-3 py-2 bg-slate-50 border rounded-xl cursor-pointer transition-all flex flex-wrap gap-2 items-center ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50 bg-white' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                {selectedCollaborators.length === 0 ? (
                    <span className="text-slate-400 text-sm font-medium px-1">Seleziona staff...</span>
                ) : (
                    selectedCollaborators.map(c => (
                        <span
                            key={c.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-sm text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px]">
                                {c.full_name.charAt(0)}
                            </div>
                            {c.full_name}
                            <div
                                onClick={(e) => removeSelection(e, c.id)}
                                className="ml-1 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </div>
                        </span>
                    ))
                )}
                <div className="ml-auto pl-2">
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[70] max-h-80 flex flex-col overflow-hidden animate-fade-in backdrop-blur-md">
                    <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cerca collaboratore..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto p-2 space-y-1">
                        {filteredCollaborators.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                <p className="text-sm text-slate-400 italic">Nessun collaboratore trovato</p>
                            </div>
                        ) : (
                            filteredCollaborators.map(c => {
                                const isSelected = value.includes(c.id);
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => toggleSelection(c.id)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-110' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {c.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm truncate ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                {c.full_name}
                                            </p>
                                            {c.role && (
                                                <p className="text-xs text-slate-400 truncate">{c.role}</p>
                                            )}
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                                            }`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
