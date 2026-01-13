import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Folder, Check } from 'lucide-react';
import type { BookingCategory } from '../../types';

interface BookingCategorySelectProps {
    categories: BookingCategory[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    showNone?: boolean;
    noneLabel?: string;
}

export default function BookingCategorySelect({
    categories,
    value,
    onChange,
    placeholder = 'Seleziona Categoria',
    showNone = false,
    noneLabel = 'Nessuna (Categoria principale)'
}: BookingCategorySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedCategory = categories.find(c => c.id === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to nest categories
    function nestCategories(cats: BookingCategory[]): any[] {
        const map = new Map<string, any>();
        cats.forEach(c => map.set(c.id, { ...c, subcategories: [] }));
        const result: any[] = [];
        cats.forEach(c => {
            if (c.parent_id && map.has(c.parent_id)) {
                map.get(c.parent_id).subcategories.push(map.get(c.id));
            } else {
                result.push(map.get(c.id));
            }
        });
        return result;
    }

    const nestedCats = nestCategories(categories);

    function renderOptions(cats: any[], depth = 0) {
        return cats.map(cat => (
            <React.Fragment key={cat.id}>
                <div
                    onClick={() => {
                        onChange(cat.id);
                        setIsOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg cursor-pointer transition-all hover:bg-slate-50 ${value === cat.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                        }`}
                    style={{ paddingLeft: `${depth * 20 + 16}px` }}
                >
                    <Folder className={`w-4 h-4 flex-shrink-0 ${value === cat.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className={`text-sm ${value === cat.id ? 'font-bold' : 'font-medium'}`}>
                        {cat.name}
                    </span>
                    {value === cat.id && <Check className="w-4 h-4 ml-auto text-indigo-600" />}
                </div>
                {cat.subcategories.length > 0 && renderOptions(cat.subcategories, depth + 1)}
            </React.Fragment>
        ));
    }

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 bg-slate-50 border rounded-xl cursor-pointer transition-all ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50 bg-white' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <Folder className={`w-5 h-5 flex-shrink-0 ${selectedCategory || (showNone && value === '') ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className={`text-sm truncate ${selectedCategory || (showNone && value === '') ? 'font-bold text-slate-900' : 'text-slate-400 font-medium'}`}>
                        {selectedCategory ? selectedCategory.name : (showNone && value === '' ? noneLabel : placeholder)}
                    </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[70] max-h-64 overflow-y-auto animate-fade-in backdrop-blur-md">
                    {showNone && (
                        <div
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className={`flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg cursor-pointer transition-all hover:bg-slate-50 ${value === '' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                                }`}
                        >
                            <Folder className={`w-4 h-4 flex-shrink-0 ${value === '' ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className={`text-sm ${value === '' ? 'font-bold' : 'font-medium'}`}>
                                {noneLabel}
                            </span>
                            {value === '' && <Check className="w-4 h-4 ml-auto text-indigo-600" />}
                        </div>
                    )}
                    {categories.length === 0 && !showNone ? (
                        <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                            Nessuna categoria trovata
                        </div>
                    ) : (
                        renderOptions(nestedCats)
                    )}
                </div>
            )}
        </div>
    );
}
