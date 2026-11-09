import { localDateInput } from '../lib/dateUtils';
import React, { useState, useEffect } from 'react';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { Reservation, Console, AppUser } from '../types';
import { Card, Button, Badge, Input } from '../components/ui/common';
import { 
  Calendar, Plus, Clock, User, Monitor, Trash2, CheckCircle2, ChevronRight, 
  CalendarDays, BarChart3, AlertTriangle, Edit3, Settings2, ShieldAlert, 
  Search, Filter, XCircle, FileText, Check, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatPersianNumber, formatCurrency, cn, formatPersianDigits } from '../lib/utils';
import { SearchableSelect } from '../components/SearchableSelect';
import { InlineClientCreate } from '../components/InlineClientCreate';

const HOUR_SLOTS = [
  "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", 
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", 
  "22:00", "23:00", "24:00"
];

// Conflict logic mode settings
type ConflictMode = 'block' | 'warn' | 'auto_pending';

const parseTimeToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;
  // Convert Persian/Arabic digits to English
  const eng = timeStr.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).trim();
  const parts = eng.split(':');
  if (parts.length === 0) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  if (isNaN(hours)) return null;
  return hours * 60 + (isNaN(minutes) ? 0 : minutes);
};

const checkReservationConflict = (
  consoleId: string,
  date: string,
  startTime: string,
  endTime: string,
  allReservations: Reservation[],
  currentId?: string
) => {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);

  if (startMins === null || endMins === null || startMins >= endMins) {
    return { hasConflict: false, conflictingReservations: [] };
  }

  const conflicts = (allReservations || []).filter(r => {
    if (r.id === currentId) return false;
    if (r.consoleId !== consoleId) return false;
    if (r.date !== date) return false;
    if (r.status === 'canceled') return false;

    const rStart = parseTimeToMinutes(r.startTime);
    const rEnd = parseTimeToMinutes(r.endTime);
    if (rStart === null || rEnd === null) return false;

    // Overlap condition: startMins < rEnd && endMins > rStart
    return startMins < rEnd && endMins > rStart;
  });

  return {
    hasConflict: conflicts.length > 0,
    conflictingReservations: conflicts
  };
};

export default function Reservations() {
  const { data: reservations = [], loading, error } = useCollection<Reservation>('reservations');
  const { data: consoles = [] } = useCollection<Console>('consoles');
  const { data: clients = [] } = useCollection<AppUser>('clients');
  const { add, update, remove } = useFirestore();

  const [selectedDate, setSelectedDate] = useState<string>(
    localDateInput()
  );

  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'canceled' | 'conflict'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineViewMode, setTimelineViewMode] = useState<'density' | 'matrix'>('density');

  // Conflict Logic Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [conflictMode, setConflictMode] = useState<ConflictMode>(() => {
    try {
      return (localStorage.getItem('reservation_conflict_mode') as ConflictMode) || 'warn';
    } catch {
      return 'warn';
    }
  });

  const handleSaveConflictMode = (mode: ConflictMode) => {
    setConflictMode(mode);
    try {
      localStorage.setItem('reservation_conflict_mode', mode);
    } catch (e) {
      // fallback
    }
  };

  // Modal & Edit State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [form, setForm] = useState({ 
    consoleId: '', 
    userId: '', 
    date: localDateInput(),
    startTime: '', 
    endTime: '', 
    status: 'confirmed' as 'pending' | 'confirmed' | 'canceled',
    note: ''
  });

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 dark:bg-rose-950/30 rounded-3xl m-8 border border-red-100 dark:border-rose-900/40" dir="rtl">
        <p className="text-red-600 dark:text-rose-400 font-bold mb-2">خطا در بارگذاری رزروها</p>
        <p className="text-red-400 dark:text-rose-500 text-sm">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>تلاش مجدد</Button>
      </div>
    );
  }

  const getConsoleName = (id: string) => {
    const c = consoles.find(con => con.id === id);
    return c ? `${c.name} (${c.type})` : 'نامشخص';
  };
  
  const getClientName = (id: string) => clients.find(u => u.id === id)?.name || 'مشتری موردی';

  // Active day reservations
  const activeReservations = (reservations || []).filter(r => r.date === selectedDate);

  // Check conflicts for form
  const formConflictCheck = checkReservationConflict(
    form.consoleId,
    form.date,
    form.startTime,
    form.endTime,
    reservations,
    editingId || undefined
  );

  // Calculate conflicts for all active reservations on selected date
  const reservationConflictsMap = new Map<string, Reservation[]>();
  activeReservations.forEach(res => {
    const check = checkReservationConflict(
      res.consoleId,
      res.date,
      res.startTime,
      res.endTime,
      reservations,
      res.id
    );
    if (check.hasConflict) {
      reservationConflictsMap.set(res.id, check.conflictingReservations);
    }
  });

  // Timeline stats with accurate interval overlap [slotStart, slotEnd)
  const timelineStats = HOUR_SLOTS.map(slot => {
    const slotMins = parseTimeToMinutes(slot);
    const slotEndMins = slotMins !== null ? slotMins + 60 : null;

    const overlapping = activeReservations.filter(res => {
      if (res.status === 'canceled') return false;
      const startMins = parseTimeToMinutes(res.startTime);
      const endMins = parseTimeToMinutes(res.endTime);
      if (slotMins === null || slotEndMins === null || startMins === null || endMins === null) return false;
      
      // Reservation overlaps interval [slotMins, slotEndMins) if startMins < slotEndMins && endMins > slotMins
      return startMins < slotEndMins && endMins > slotMins;
    });

    const hasSlotConflict = overlapping.some(res => reservationConflictsMap.has(res.id));

    return {
      time: slot,
      count: overlapping.length,
      reservations: overlapping,
      hasConflict: hasSlotConflict
    };
  });

  // Filtered reservations list
  const filteredReservations = activeReservations.filter(res => {
    // Status Filter
    if (statusFilter === 'confirmed' && res.status !== 'confirmed') return false;
    if (statusFilter === 'pending' && res.status !== 'pending') return false;
    if (statusFilter === 'canceled' && res.status !== 'canceled') return false;
    if (statusFilter === 'conflict' && !reservationConflictsMap.has(res.id)) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const clientName = getClientName(res.userId).toLowerCase();
      const consoleName = getConsoleName(res.consoleId).toLowerCase();
      const note = (res as any).note?.toLowerCase() || '';
      return clientName.includes(q) || consoleName.includes(q) || note.includes(q);
    }

    return true;
  });

  const handleOpenAddModal = () => {
    setEditingId(null);
    setForm({ 
      consoleId: consoles[0]?.id || '', 
      userId: '', 
      date: selectedDate,
      startTime: '16:00', 
      endTime: '18:00', 
      status: 'confirmed',
      note: ''
    });
    setIsCreatingCustomer(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (res: Reservation) => {
    setEditingId(res.id);
    setForm({ 
      consoleId: res.consoleId, 
      userId: res.userId, 
      date: res.date,
      startTime: res.startTime, 
      endTime: res.endTime, 
      status: res.status || 'confirmed',
      note: (res as any).note || ''
    });
    setIsCreatingCustomer(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const start = parseTimeToMinutes(form.startTime), end = parseTimeToMinutes(form.endTime);
    if (start === null || end === null || start < 0 || end > 1440 || start >= end) { alert("زمان پایان باید بعد از شروع همان روز باشد."); return; }
    let finalStatus = form.status;

    // Apply Conflict Logic Settings
    if (formConflictCheck.hasConflict) {
      if (conflictMode === 'block') {
        alert('امکان ثبت وجود ندارد! تنظیمات سیستم روی جلوگیری سخت‌گیرانه از تداخل تنظیم شده است.');
        return;
      } else if (conflictMode === 'auto_pending') {
        finalStatus = 'pending';
      }
    }

    const payload = {
      ...form,
      status: finalStatus
    };

    if (editingId) {
      await update('reservations', editingId, payload);
    } else {
      await add('reservations', payload);
    }

    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setIsCreatingCustomer(false);
    setForm({ 
      consoleId: '', 
      userId: '', 
      date: localDateInput(),
      startTime: '', 
      endTime: '', 
      status: 'confirmed',
      note: ''
    });
  };

  const applyDurationAdd = (hoursToAdd: number) => {
    const startMins = parseTimeToMinutes(form.startTime);
    if (startMins !== null) {
      const endMins = startMins + hoursToAdd * 60;
      const endHours = Math.floor(endMins / 60) % 24;
      const endRem = endMins % 60;
      const formattedEnd = `${endHours.toString().padStart(2, '0')}:${endRem.toString().padStart(2, '0')}`;
      setForm(prev => ({ ...prev, endTime: formattedEnd }));
    }
  };

  const setToday = () => setSelectedDate(localDateInput());
  const setTomorrow = () => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    setSelectedDate(tom.toISOString().split('T')[0]);
  };

  return (
    <div className="p-4 md:p-8 font-sans text-right" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-1">پنل نوبت‌ها و رزروها</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">ثبت، ویرایش و مدیریت زمان‌بندی دستگاه‌ها با سیستم هوشمند تشخیص تداخل</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={() => setShowSettings(!showSettings)} 
            variant="outline"
            className={cn(
              "h-10 px-4 rounded-xl text-xs font-bold transition-all border",
              showSettings 
                ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-400" 
                : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            )}
          >
            <Settings2 size={16} className="ml-1.5" />
            منطق برخورد با تداخل
          </Button>

          <Button 
            onClick={handleOpenAddModal} 
            className="h-10 px-5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20"
          >
            <Plus size={16} className="ml-1.5" />
            ثبت رزرو جدید
          </Button>
        </div>
      </div>

      {/* Logic Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <Card className="p-5 md:p-6 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-indigo-100/60 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-indigo-600 dark:text-indigo-400" size={20} />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">تنظیمات منطق رزرو و اعلام تداخل</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">نحوه برخورد سیستم در زمان مواجهه با رزروهای هم‌زمان برای یک دستگاه</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  onClick={() => handleSaveConflictMode('warn')}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all relative",
                    conflictMode === 'warn'
                      ? "bg-white dark:bg-slate-800 border-amber-400 shadow-md ring-2 ring-amber-400/20"
                      : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                      <AlertTriangle size={16} className="text-amber-500" />
                      هشدار و تایید اپراتور (پیش‌فرض)
                    </span>
                    {conflictMode === 'warn' && <Check size={16} className="text-amber-500 font-bold" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    در صورت وجود تداخل، پیام هشدار نارنجی نمایش داده می‌شود اما اپراتور مجاز به تایید و ثبت نهایی است.
                  </p>
                </div>

                <div 
                  onClick={() => handleSaveConflictMode('block')}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all relative",
                    conflictMode === 'block'
                      ? "bg-white dark:bg-slate-800 border-rose-500 shadow-md ring-2 ring-rose-500/20"
                      : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                      <XCircle size={16} className="text-rose-500" />
                      جلوگیری سخت‌گیرانه (ممانعت)
                    </span>
                    {conflictMode === 'block' && <Check size={16} className="text-rose-500 font-bold" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    سیستم به هیچ وجه اجازه ذخیره رزرو در صورت وجود حتی ۱ دقیقه تداخل زمانی با رزرو دیگری را نمی‌دهد.
                  </p>
                </div>

                <div 
                  onClick={() => handleSaveConflictMode('auto_pending')}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all relative",
                    conflictMode === 'auto_pending'
                      ? "bg-white dark:bg-slate-800 border-cyan-500 shadow-md ring-2 ring-cyan-500/20"
                      : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Clock size={16} className="text-cyan-500" />
                      تغییر خودکار به «در انتظار»
                    </span>
                    {conflictMode === 'auto_pending' && <Check size={16} className="text-cyan-500 font-bold" />}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    رزرو دارای تداخل ثبت می‌شود اما وضعیت آن خودکار روی «در انتظار تایید» قرار می‌گیرد تا بررسی گردد.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date & Filter Control Bar */}
      <div className="mb-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-indigo-600 dark:text-indigo-400 shrink-0" size={18} />
            <span className="text-xs font-bold text-slate-800 dark:text-white">تاریخ:</span>
          </div>

          <div className="flex gap-1">
            <button 
              onClick={setToday}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                selectedDate === localDateInput()
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              امروز
            </button>
            <button 
              onClick={setTomorrow}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                selectedDate === new Date(Date.now() + 86400000).toISOString().split('T')[0]
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              فردا
            </button>
          </div>

          <input 
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filters & Search Input */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="جستجوی رزرو..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pr-9 pl-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl gap-1">
            <button 
              onClick={() => setStatusFilter('all')}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all", statusFilter === 'all' ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500")}
            >
              همه ({formatPersianNumber(activeReservations.length)})
            </button>
            <button 
              onClick={() => setStatusFilter('confirmed')}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all", statusFilter === 'confirmed' ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500")}
            >
              تایید شده
            </button>
            <button 
              onClick={() => setStatusFilter('pending')}
              className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all", statusFilter === 'pending' ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm" : "text-slate-500")}
            >
              در انتظار
            </button>
            {reservationConflictsMap.size > 0 && (
              <button 
                onClick={() => setStatusFilter('conflict')}
                className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1", statusFilter === 'conflict' ? "bg-rose-500 text-white shadow-sm" : "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30")}
              >
                <AlertTriangle size={12} />
                تداخل ({formatPersianNumber(reservationConflictsMap.size)})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hourly Timeline & Console Matrix Chart */}
      <div className="mb-6 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-dashed border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <BarChart3 size={15} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-white">جدول زمان‌بندی و تراکم رزروهای روز</h3>
              <p className="text-[10px] text-slate-400 font-medium">نمایش وضعیت آزاد و رزرو شده دستگاه‌ها در ساعات مختلف</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Legend with distinct colors */}
            <div className="flex gap-3 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 block shadow-sm" /> 
                <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">آزاد (دستگاه موجود)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-600 block shadow-sm" /> 
                <span className="text-indigo-700 dark:text-indigo-400 font-extrabold">رزرو شده</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500 block animate-pulse shadow-sm" /> 
                <span className="text-rose-600 dark:text-rose-400 font-extrabold">تداخل ⚠️</span>
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl gap-1">
              <button 
                onClick={() => setTimelineViewMode('density')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                  timelineViewMode === 'density' 
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                تراکم کلی
              </button>
              <button 
                onClick={() => setTimelineViewMode('matrix')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1",
                  timelineViewMode === 'matrix' 
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <Monitor size={12} />
                ماتریس دستگاه‌ها
              </button>
            </div>
          </div>
        </div>

        {/* View 1: Hourly Density Blocks */}
        {timelineViewMode === 'density' && (
          <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-15 gap-2">
            {timelineStats.map((stat) => {
              const isFree = stat.count === 0;
              const isConflict = stat.hasConflict;

              return (
                <div 
                  key={stat.time} 
                  className={cn(
                    "relative group/timecard flex flex-col items-center p-2 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer",
                    isFree && "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-400",
                    !isFree && !isConflict && "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-400",
                    isConflict && "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 hover:border-rose-500"
                  )}
                >
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 font-mono">{formatPersianNumber(stat.time)}</span>
                  
                  {/* Indicator Bar */}
                  <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 mt-1.5">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isFree && "w-full bg-emerald-500",
                        !isFree && !isConflict && "w-full bg-indigo-600",
                        isConflict && "w-full bg-rose-500 animate-pulse"
                      )} 
                    />
                  </div>

                  {/* Count / Status Label */}
                  <span className={cn(
                    "text-[10px] font-black mt-1.5 font-mono px-1.5 py-0.5 rounded",
                    isFree && "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80",
                    !isFree && !isConflict && "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80",
                    isConflict && "text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 animate-pulse"
                  )}>
                    {isFree ? 'آزاد' : isConflict ? `تداخل` : `${formatPersianNumber(stat.count)} رزرو`}
                  </span>

                  {/* Expanded Hover Details Card */}
                  <div className="absolute top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 hidden group-hover/timecard:block z-30 text-right">
                    <p className="text-[10px] font-bold text-slate-800 dark:text-white mb-2 pb-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span>ساعت {formatPersianNumber(stat.time)}</span>
                      {isConflict ? (
                        <span className="text-rose-500 font-bold flex items-center gap-1"><AlertTriangle size={12} /> تداخل دارد</span>
                      ) : isFree ? (
                        <span className="text-emerald-600 font-bold">دستگاه‌ها آزاد</span>
                      ) : (
                        <span className="text-indigo-600 font-bold">{formatPersianNumber(stat.count)} رزرو</span>
                      )}
                    </p>
                    {stat.count === 0 ? (
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">تمامی دستگاه‌ها در این ساعت آماده رزرو هستند.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {stat.reservations.map((res, i) => (
                          <div key={i} className="text-[9px] font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400 mb-0.5">
                              <span className="font-black">{getConsoleName(res.consoleId)}</span>
                              <span className="font-mono text-[8px] bg-indigo-50 dark:bg-indigo-950/60 px-1 rounded">{formatPersianDigits(res.startTime)} تا {formatPersianDigits(res.endTime)}</span>
                            </div>
                            <div className="text-[8px] text-slate-500 mt-0.5">مشتری: {getClientName(res.userId)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View 2: Console Gantt Matrix */}
        {timelineViewMode === 'matrix' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500">
                  <th className="p-2 w-36 bg-slate-50 dark:bg-slate-950/60 rounded-r-xl">دستگاه / کنسول</th>
                  {HOUR_SLOTS.map(slot => (
                    <th key={slot} className="p-2 text-center font-mono w-12">{formatPersianNumber(slot)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-[10px]">
                {consoles.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="p-4 text-center text-slate-400 font-bold">هیچ کنسولی ثبت نشده است</td>
                  </tr>
                ) : consoles.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30">
                    <td className="p-2 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Monitor size={13} className="text-indigo-500 shrink-0" />
                        <span className="truncate max-w-[120px]">{c.name}</span>
                      </div>
                    </td>
                    {HOUR_SLOTS.map(slot => {
                      const slotMins = parseTimeToMinutes(slot);
                      const slotEndMins = slotMins !== null ? slotMins + 60 : null;

                      // Filter reservations for this exact console and hour slot
                      const consoleReservations = activeReservations.filter(res => {
                        if (res.status === 'canceled') return false;
                        if (res.consoleId !== c.id) return false;
                        const startMins = parseTimeToMinutes(res.startTime);
                        const endMins = parseTimeToMinutes(res.endTime);
                        if (slotMins === null || slotEndMins === null || startMins === null || endMins === null) return false;
                        return startMins < slotEndMins && endMins > slotMins;
                      });

                      const isConsoleFree = consoleReservations.length === 0;
                      const isConsoleConflict = consoleReservations.length > 1;

                      return (
                        <td key={slot} className="p-1 text-center">
                          <div 
                            className={cn(
                              "h-7 rounded-lg flex items-center justify-center font-bold transition-all relative group/cell cursor-pointer border text-[9px]",
                              isConsoleFree && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400",
                              !isConsoleFree && !isConsoleConflict && "bg-indigo-600 border-indigo-700 text-white shadow-sm",
                              isConsoleConflict && "bg-rose-500 border-rose-600 text-white animate-pulse"
                            )}
                          >
                            {isConsoleFree ? (
                              <span className="text-[8px]">آزاد</span>
                            ) : isConsoleConflict ? (
                              <span>⚠️ {formatPersianNumber(consoleReservations.length)}</span>
                            ) : (
                              <span className="truncate px-1 text-[8px]">{getClientName(consoleReservations[0].userId)}</span>
                            )}

                            {/* Hover detail card for cell */}
                            {!isConsoleFree && (
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-48 bg-slate-900 text-white rounded-xl shadow-xl p-2 hidden group-hover/cell:block z-40 text-right">
                                <div className="text-[9px] font-bold text-indigo-300 border-b border-slate-800 pb-1 mb-1">
                                  {c.name} - ساعت {formatPersianNumber(slot)}
                                </div>
                                {consoleReservations.map((res, i) => (
                                  <div key={i} className="text-[8px] space-y-0.5 py-1 border-b border-slate-800/50 last:border-0">
                                    <div className="font-bold text-white">مشتری: {getClientName(res.userId)}</div>
                                    <div className="text-slate-300 font-mono">زمان: {formatPersianDigits(res.startTime)} تا {formatPersianDigits(res.endTime)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Main Reservation Cards Grid */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">لیست رزروهای ثبت‌شده</h3>
            <Badge variant="neutral" className="font-mono text-xs font-bold">
              {formatPersianNumber(filteredReservations.length)} مورد
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-36 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl" />)
          ) : filteredReservations.map(res => {
            const conflicts = reservationConflictsMap.get(res.id);
            const hasConflict = !!conflicts && conflicts.length > 0;

            return (
              <Card 
                key={res.id} 
                className={cn(
                  "p-5 flex flex-col justify-between text-right relative overflow-hidden transition-all duration-200 border rounded-2xl",
                  hasConflict 
                    ? "border-rose-300 dark:border-rose-900/80 bg-rose-50/30 dark:bg-rose-950/10 shadow-sm" 
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                )}
              >
                {/* Conflict Badge Header Banner */}
                {hasConflict && (
                  <div className="mb-3 p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={13} className="shrink-0" />
                      تداخل زمانی با {getClientName(conflicts[0].userId)} ({formatPersianDigits(conflicts[0].startTime)} - {formatPersianDigits(conflicts[0].endTime)})
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border",
                      hasConflict 
                        ? "bg-rose-100 dark:bg-rose-950/50 text-rose-600 border-rose-200 dark:border-rose-900" 
                        : "bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-slate-700"
                    )}>
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{getClientName(res.userId)}</h4>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Monitor size={12} />
                        {getConsoleName(res.consoleId)}
                      </p>
                    </div>
                  </div>

                  <Badge variant={res.status === 'confirmed' ? 'success' : res.status === 'pending' ? 'warning' : 'danger'}>
                    {res.status === 'confirmed' ? 'تایید شده' : res.status === 'pending' ? 'در انتظار' : 'لغو شده'}
                  </Badge>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <Clock size={13} />
                      بازه زمانی:
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      {formatPersianDigits(res.startTime)} تا {formatPersianDigits(res.endTime)}
                    </span>
                  </div>

                  {(res as any).note && (
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <FileText size={12} className="shrink-0" />
                      <span className="truncate">توضیح: {(res as any).note}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex gap-1">
                    {res.status !== 'confirmed' && (
                      <button 
                        title="تایید نوبت"
                        onClick={() => update('reservations', res.id, { status: 'confirmed' })}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        تایید
                      </button>
                    )}
                    {res.status !== 'canceled' && (
                      <button 
                        title="لغو نوبت"
                        onClick={() => update('reservations', res.id, { status: 'canceled' })}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle size={14} />
                        لغو
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button 
                      title="ویرایش رزرو"
                      onClick={() => handleOpenEditModal(res)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 rounded-lg transition-all cursor-pointer"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      title="حذف رزرو"
                      onClick={() => {
                        if (confirm('آیا از حذف این رزرو اطمینان دارید؟')) {
                          remove('reservations', res.id);
                        }
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
          
          {filteredReservations.length === 0 && !loading && (
            <div className="col-span-full py-16 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
               <Calendar className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
               <p className="text-slate-600 dark:text-slate-400 font-bold text-xs mb-1">هیچ رزروی با این مشخصات یافت نشد</p>
               <p className="text-slate-400 text-[11px]">برای ثبت نوبت جدید از دکمه بالای صفحه استفاده کنید.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Reservation Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={closeModal} 
              className="absolute inset-0"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-right z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  {editingId ? <Edit3 className="text-indigo-600" size={20} /> : <Plus className="text-indigo-600" size={20} />}
                  {editingId ? 'ویرایش رزرو دستگاه' : 'ثبت رزرو جدید دستگاه'}
                </h3>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Console Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">انتخاب دستگاه / کنسول</label>
                  <select 
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold focus:border-indigo-500"
                    value={form.consoleId}
                    onChange={e => setForm({...form, consoleId: e.target.value})}
                    required
                  >
                    <option value="">انتخاب دستگاه...</option>
                    {consoles.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                  </select>
                </div>

                {/* Customer Selector */}
                <SearchableSelect 
                  label="مشتری کلوپ"
                  options={(clients || []).map(u => ({
                    id: u.id,
                    label: u.name,
                    subLabel: formatPersianDigits(u.phone || '')
                  }))}
                  value={form.userId}
                  onChange={(val) => setForm({...form, userId: val})}
                  onCreateOption={() => setIsCreatingCustomer(true)}
                />

                {isCreatingCustomer && (
                  <InlineClientCreate
                    onCreated={(client) => {
                      setForm(prev => ({ ...prev, userId: client.id }));
                      setIsCreatingCustomer(false);
                    }}
                    onCancel={() => setIsCreatingCustomer(false)}
                  />
                )}
                
                {/* Date */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">تاریخ انجام رزرو</label>
                  <input 
                    type="date"
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold"
                    value={form.date}
                    onChange={e => setForm({...form, date: e.target.value})}
                    required
                  />
                </div>

                {/* Time range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">ساعت شروع</label>
                    <input 
                      type="text"
                      placeholder="مثال: ۱۶:۰۰"
                      value={form.startTime}
                      onChange={e => setForm({...form, startTime: e.target.value})}
                      required
                      className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">ساعت پایان</label>
                    <input 
                      type="text"
                      placeholder="مثال: ۱۸:۰۰"
                      value={form.endTime}
                      onChange={e => setForm({...form, endTime: e.target.value})}
                      required
                      className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Quick duration presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400">افزایش سریع زمان پایان:</span>
                  <button 
                    type="button" 
                    onClick={() => applyDurationAdd(1)} 
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    +۱ ساعت
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyDurationAdd(2)} 
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    +۲ ساعت
                  </button>
                  <button 
                    type="button" 
                    onClick={() => applyDurationAdd(3)} 
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    +۳ ساعت
                  </button>
                </div>

                {/* Status Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">وضعیت رزرو</label>
                  <select 
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold focus:border-indigo-500"
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value as any})}
                  >
                    <option value="confirmed">تایید شده</option>
                    <option value="pending">در انتظار تایید</option>
                    <option value="canceled">لغو شده</option>
                  </select>
                </div>

                {/* Note */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">توضیحات یا یادداشت اضافی</label>
                  <input 
                    type="text"
                    placeholder="مثلا: بازی فیفا ۲۴ سفارش داده شده"
                    value={form.note}
                    onChange={e => setForm({...form, note: e.target.value})}
                    className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none"
                  />
                </div>

                {/* Live Conflict Warning Banner */}
                {formConflictCheck.hasConflict && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3.5 rounded-2xl border text-xs text-right space-y-1",
                      conflictMode === 'block' 
                        ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300"
                        : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-black">
                      <AlertTriangle size={16} className={conflictMode === 'block' ? "text-rose-600" : "text-amber-600"} />
                      <span>هشدار تداخل زمانی متقاطع!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed font-semibold">
                      این رزرو با {formConflictCheck.conflictingReservations.length} رزرو قبلی روی دستگاه «{getConsoleName(form.consoleId)}» تداخل دارد:
                    </p>
                    <ul className="list-disc list-inside text-[10px] space-y-0.5 pt-1 font-bold">
                      {formConflictCheck.conflictingReservations.map((conf, idx) => (
                        <li key={idx}>
                          مشتری: {getClientName(conf.userId)} ({formatPersianDigits(conf.startTime)} تا {formatPersianDigits(conf.endTime)})
                        </li>
                      ))}
                    </ul>
                    {conflictMode === 'block' && (
                      <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 pt-1 border-t border-rose-200 dark:border-rose-900">
                        🛑 به علت فعال بودن تنظیمات «جلوگیری سخت‌گیرانه»، دکمه ذخیره غیرفعال گردید.
                      </p>
                    )}
                    {conflictMode === 'auto_pending' && (
                      <p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 pt-1 border-t border-amber-200 dark:border-amber-900">
                        ⏳ در صورت ذخیره، وضعیت به صورت خودکار به «در انتظار تایید» تغییر خواهد کرد.
                      </p>
                    )}
                  </motion.div>
                )}

                <div className="flex gap-3 pt-3">
                  <Button 
                    type="submit" 
                    disabled={formConflictCheck.hasConflict && conflictMode === 'block'}
                    className="flex-1 h-10 text-xs font-black bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-indigo-600/20"
                  >
                    {editingId ? 'ذخیره تغییرات رزرو' : 'ثبت رزرو جدید'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={closeModal} 
                    className="flex-1 h-10 text-xs font-bold border-slate-200 dark:border-slate-800 text-slate-500 rounded-xl"
                  >
                    انصراف
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
