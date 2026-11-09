import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  emptyMessage?: string;
  className?: string;
  allowClear?: boolean;
}

export function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'جستجو و انتخاب...', 
  label,
  emptyMessage = 'موردی یافت نشد',
  className,
  allowClear = true
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("space-y-1.5 text-right relative", className)} ref={containerRef}>
      {label && <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 block mr-1">{label}</label>}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border-2 border-transparent dark:border-slate-800 rounded-xl cursor-search flex items-center justify-between transition-all duration-200 text-sm group",
          isOpen ? "border-primary-theme bg-white dark:bg-slate-800" : "hover:border-gray-200 dark:hover:border-slate-700"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {selectedOption ? (
            <>
              <User size={16} className="text-primary-theme shrink-0" />
              <span className="font-bold text-gray-900 dark:text-white truncate">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-[10px] text-gray-400 font-medium truncate">({selectedOption.subLabel})</span>
              )}
            </>
          ) : (
            <span className="text-gray-400 font-medium">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {allowClear && value && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearch('');
              }}
              className="p-1 hover:bg-rose-50 hover:text-rose-500 rounded-lg text-gray-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown 
            size={18} 
            className={cn("text-gray-400 transition-transform duration-300", isOpen && "rotate-180")} 
          />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-[100] w-full mt-2 bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-gray-50 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  autoFocus
                  type="text"
                  className="w-full bg-gray-50 dark:bg-slate-900 pr-10 pl-4 py-2 rounded-xl text-xs font-bold outline-none border-2 border-transparent focus:border-primary-theme transition-all placeholder:text-gray-300 dark:text-white"
                  placeholder="تایپ کنید..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      "w-full text-right px-4 py-3 rounded-xl flex items-center justify-between group/opt transition-all mb-1 last:mb-0",
                      value === opt.id 
                        ? "bg-primary-theme text-white shadow-md shadow-primary-theme/20" 
                        : "hover:bg-accent-theme dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm leading-none mb-1">{opt.label}</span>
                      {opt.subLabel && (
                        <span className={cn(
                          "text-[10px] uppercase tracking-tighter opacity-70",
                          value === opt.id ? "text-white" : "text-gray-400"
                        )}>
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {value === opt.id && <Check size={16} />}
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-gray-400">
                  <User size={32} className="mx-auto opacity-10 mb-2" />
                  <p className="text-xs font-bold">{emptyMessage}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
