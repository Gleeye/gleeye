import { useState, useRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string | number;
    label: string;
    icon?: LucideIcon;
}

interface CustomSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: any) => void;
    placeholder?: string;
    label?: string;
    icon?: LucideIcon;
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Seleziona...', label, icon: Icon }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            {label && (
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {label}
                </label>
            )}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 bg-slate-50 border rounded-xl cursor-pointer transition-all ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50 bg-white' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {Icon && <Icon className={`w-5 h-5 flex-shrink-0 ${selectedOption ? 'text-indigo-500' : 'text-slate-400'}`} />}
                    <span className={`text-sm truncate ${selectedOption ? 'font-bold text-slate-900' : 'text-slate-400 font-medium'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[70] max-h-64 overflow-y-auto animate-fade-in backdrop-blur-md">
                    {options.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                            Nessuna opzione trovata
                        </div>
                    ) : (
                        options.map(opt => {
                            const OptIcon = opt.icon;
                            return (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg cursor-pointer transition-all hover:bg-slate-50 ${value === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                                        }`}
                                >
                                    {OptIcon && <OptIcon className={`w-4 h-4 flex-shrink-0 ${value === opt.value ? 'text-indigo-600' : 'text-slate-400'}`} />}
                                    <span className={`text-sm ${value === opt.value ? 'font-bold' : 'font-medium'}`}>
                                        {opt.label}
                                    </span>
                                    {value === opt.value && <Check className="w-4 h-4 ml-auto text-indigo-600" />}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
