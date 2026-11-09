import React from 'react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-[#edf2f7] dark:bg-slate-900 rounded-2xl border border-slate-300/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300", className)} {...props}>
      {children}
    </div>
  );
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: "bg-indigo-600 dark:bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 dark:shadow-none",
    secondary: "bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600 shadow-md",
    outline: "border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-500/20",
    ghost: "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800"
  };

  const sizes = {
    sm: "px-4 h-10 text-xs rounded-xl",
    md: "px-6 h-12 text-sm rounded-2xl",
    lg: "px-8 h-14 text-base rounded-[1.25rem]"
  };

  return (
    <button 
      className={cn(
        "font-black tracking-wide transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer select-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface ToggleOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export function SegmentToggle<T extends string>({
  options,
  activeId,
  onChange,
  className,
  activeColor = 'indigo'
}: {
  options: ToggleOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
  activeColor?: 'indigo' | 'emerald' | 'amber' | 'primary';
}) {
  const colorMap = {
    indigo: {
      text: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-white dark:bg-slate-800",
    },
    emerald: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-white dark:bg-slate-800",
    },
    amber: {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-white dark:bg-slate-800",
    },
    primary: {
      text: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-white dark:bg-slate-800",
    }
  };

  return (
    <div className={cn("flex p-1 bg-slate-200/80 dark:bg-slate-950/40 rounded-2xl border border-slate-300/80 dark:border-slate-850 shadow-inner w-full md:w-auto items-center justify-center relative", className)}>
      {options.map((opt) => {
        const isActive = opt.id === activeId;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative px-6 h-10 md:h-11 rounded-xl font-black text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-2 select-none z-10 flex-1 md:flex-none min-w-[110px] cursor-pointer",
              isActive 
                ? cn("font-black shadow-sm", colorMap[activeColor]?.text || "text-indigo-600")
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            {isActive && (
              <motion.div
                layoutId={`active-indicator-${options.map(o => o.id).join('-')}`}
                className={cn("absolute inset-0 rounded-xl z-[-1] border border-slate-200 dark:border-slate-700 shadow-sm", colorMap[activeColor]?.bg || "bg-white dark:bg-slate-800")}
                style={{ contentVisibility: 'auto' }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            
            {Icon && <Icon size={16} />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ children, variant = 'default', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'neutral' }) {
  const variants = {
    default: "bg-slate-150 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/40",
    warning: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/40",
    danger: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/40",
    info: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/40",
    outline: "bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300",
    neutral: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
  };

  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1", variants[variant], className)} {...props}>
      {children}
    </span>
  );
}

export function Input({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="space-y-1.5 text-right">
      {label && <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mr-1">{label}</label>}
      <input 
        className={cn(
          "w-full px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 text-sm placeholder:text-right text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:[color-scheme:dark] shadow-xs",
          className
        )}
        style={{ direction: 'rtl' }}
        {...props}
      />
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[60]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.94, y: 30, x: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, scale: 0.94, y: 30, x: "-50%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed top-1/2 left-1/2 -translate-y-1/2 w-full max-w-lg bg-[#edf2f7] dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl p-6 md:p-8 z-[70] shadow-2xl overflow-hidden text-right flex flex-col max-h-[95vh]"
            dir="rtl"
          >
            <div className="flex justify-between items-center mb-4 md:mb-6 flex-shrink-0">
               <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
               <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-gray-400 transition-colors">
                 <X size={20} />
               </button>
            </div>
            <div className="overflow-y-auto pr-1 md:pr-2 custom-scrollbar flex-1">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
