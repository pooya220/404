import React, { useState } from 'react';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { Session, Console, SystemSettings, AppUser, Tariff, RepairItem } from '../types';
import { Card, Badge, Button } from '../components/ui/common';
import { 
  Calendar, 
  Clock,
  TrendingUp, 
  ShoppingCart, 
  Gamepad2, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  PieChart as PieChartIcon,
  Package,
  Receipt,
  Filter,
  CalendarRange,
  Edit,
  Plus,
  Coffee,
  Layers,
  Wrench
} from 'lucide-react';
import { formatPersianNumber, formatCurrency, cn, formatPersianDigits } from '../lib/utils';
import { 
  isSameJalaliDay,
  isSameJalaliMonth,
  formatJalali,
  getJalaliMonthName
} from '../lib/dateUtils';
import { InvoiceModal, ReportItem } from '../components/InvoiceModal';
import { InvoiceEditModal } from '../components/InvoiceEditModal';

interface QuickSale {
  id: string;
  items: { id: string, name: string, price: number, quantity: number }[];
  totalAmount: number;
  taxAmount?: number;
  timestamp: string;
  type: 'quick_sale' | 'session_order' | 'manual_invoice';
  userId?: string;
  paymentMethod?: string;
  manualAdjustment?: number;
  manualAdjustmentType?: 'discount' | 'addition';
  manualAdjustmentNote?: string;
  title?: string;
  gameAmount?: number;
  buffetAmount?: number;
  invoiceCategory?: 'game' | 'buffet' | 'both';
}

export default function Reports() {
  const { data: settingsList } = useCollection<SystemSettings>('settings');
  const { data: sessions } = useCollection<Session>('sessions');
  const { data: sales } = useCollection<QuickSale>('sales');
  const { data: consoles } = useCollection<Console>('consoles');
  const { data: purchases } = useCollection<any>('purchases');
  const { data: clients } = useCollection<AppUser>('clients');
  const { data: tariffs } = useCollection<Tariff>('tariffs');
  const { data: repairs } = useCollection<RepairItem>('repairs');
  const { remove } = useFirestore();

  // Modal State for Invoice Viewer
  const [selectedInvoice, setSelectedInvoice] = useState<ReportItem | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const handleDeleteInvoice = async (report: ReportItem) => {
    try {
      if (report.type === 'session') {
        await remove('sessions', report.id);
      } else if (report.type === 'purchase') {
        await remove('purchases', report.id);
      } else if (report.type === 'repair') {
        await remove('repairs', report.id);
      } else {
        await remove('sales', report.id);
      }
      setIsInvoiceOpen(false);
      setSelectedInvoice(null);
    } catch (err) {
      console.error('Error deleting invoice:', err);
    }
  };

  // Modal State for Invoice Editor (Manual date, discount, addition, or new invoice)
  const [editModalConfig, setEditModalConfig] = useState<{
    isOpen: boolean;
    mode: 'edit' | 'create';
    report: ReportItem | null;
  }>({
    isOpen: false,
    mode: 'create',
    report: null
  });
  
  // Everyday selector & Date filter states
  type DatePreset = 'today' | 'yesterday' | 'last7' | 'this_month' | 'day' | 'range' | 'all';
  const [dateFilterMode, setDateFilterMode] = useState<DatePreset>('today');
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'game' | 'buffet' | 'repair' | 'shop' | 'purchase'>('all');

  const getConsoleName = (id: string) => {
    const con = consoles?.find(c => c.id === id);
    return con ? `${con.name} (${con.type})` : 'دستگاه کلوپ';
  };

  const handlePrevDay = () => {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() - 1);
    setSelectedDay(next);
    setDateFilterMode('day');
  };

  const handleNextDay = () => {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + 1);
    setSelectedDay(next);
    setDateFilterMode('day');
  };

  const handleGoToToday = () => {
    setSelectedDay(new Date());
    setDateFilterMode('today');
  };

  // Safe Date Converter
  const safeDate = (val: any): Date | null => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // Time & Duration Formatters
  const formatTime24 = (isoOrDate?: string | Date) => {
    if (!isoOrDate) return '---';
    try {
      const d = new Date(isoOrDate);
      if (isNaN(d.getTime())) return '---';
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return formatPersianDigits(`${h}:${m}`);
    } catch {
      return '---';
    }
  };

  const formatFriendlyDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '۰ دقیقه';
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0 && mins > 0) {
      return `${formatPersianDigits(hours)} ساعت و ${formatPersianDigits(mins)} دقیقه`;
    } else if (hours > 0) {
      return `${formatPersianDigits(hours)} ساعت`;
    } else {
      return `${formatPersianDigits(mins)} دقیقه`;
    }
  };

  const getSessionDurationSeconds = (s: Session): number => {
    if (typeof s.duration === 'number' && s.duration > 0) {
      return s.duration;
    }
    if (s.startTime && s.endTime) {
      const diffMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
      return Math.max(0, Math.floor(diffMs / 1000));
    }
    return 0;
  };

  // Date Matching Filter Engine
  const isDateMatchingFilter = (dateVal: Date | null): boolean => {
    if (!dateVal) return false;

    if (dateFilterMode === 'today') {
      return isSameJalaliDay(dateVal, new Date());
    }
    if (dateFilterMode === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return isSameJalaliDay(dateVal, y);
    }
    if (dateFilterMode === 'last7') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return dateVal >= sevenDaysAgo;
    }
    if (dateFilterMode === 'this_month') {
      return isSameJalaliMonth(dateVal, new Date());
    }
    if (dateFilterMode === 'day') {
      return isSameJalaliDay(dateVal, selectedDay);
    }
    if (dateFilterMode === 'range') {
      if (customStartDate) {
        const s = new Date(customStartDate);
        s.setHours(0, 0, 0, 0);
        if (dateVal < s) return false;
      }
      if (customEndDate) {
        const e = new Date(customEndDate);
        e.setHours(23, 59, 59, 999);
        if (dateVal > e) return false;
      }
      return true;
    }
    if (dateFilterMode === 'all') {
      return true;
    }
    return true;
  };

  // Filtered Collections by Date
  const completedSessions = (sessions || []).filter(s => {
    if (s.status !== 'completed') return false;
    const sessionDate = safeDate(s.endTime) || safeDate(s.startTime);
    return isDateMatchingFilter(sessionDate);
  });

  const dailySales = (sales || []).filter(s => {
    const saleDate = safeDate(s.timestamp);
    return isDateMatchingFilter(saleDate);
  });

  const dailyPurchases = (purchases || []).filter(p => {
    const pDate = safeDate(p.timestamp);
    return isDateMatchingFilter(pDate);
  });

  const dailyRepairs = (repairs || []).filter(r => {
    const rDate = safeDate(r.completedAt) || safeDate(r.receivedAt);
    return isDateMatchingFilter(rDate);
  });

  const getFilterPeriodLabel = () => {
    if (dateFilterMode === 'today') return `امروز (${formatJalali(new Date(), 'EEEE، d MMMM')})`;
    if (dateFilterMode === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `دیروز (${formatJalali(y, 'EEEE، d MMMM')})`;
    }
    if (dateFilterMode === 'last7') return '۷ روز گذشته';
    if (dateFilterMode === 'this_month') return `ماه جاری (${getJalaliMonthName(new Date().getMonth())})`;
    if (dateFilterMode === 'day') return formatJalali(selectedDay, 'EEEE، d MMMM yyyy');
    if (dateFilterMode === 'range') {
      const s = customStartDate ? formatJalali(new Date(customStartDate), 'yyyy/MM/dd') : 'ابتدا';
      const e = customEndDate ? formatJalali(new Date(customEndDate), 'yyyy/MM/dd') : 'اکنون';
      return `بازه زمانی ${s} تا ${e}`;
    }
    if (dateFilterMode === 'all') return 'کل تاریخچه سیستم';
    return '';
  };

  // --- Financial Stats of selectedDay ---
  const gameIncomeGross = completedSessions.reduce((sum, s) => sum + (s.totalSessionAmount || 0), 0) +
    dailySales.reduce((sum, s) => sum + (s.gameAmount || 0), 0);
  const gameTax = completedSessions.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  
  // Buffet items during games + buffet sales
  const buffetIncomeGross = completedSessions.reduce((sum, s) => sum + (s.totalProductsAmount || 0), 0) +
    dailySales.reduce((sum, s) => {
      if (s.type === 'manual_invoice') {
        return sum + (s.buffetAmount || 0);
      }
      return sum + (s.totalAmount || 0) - (s.taxAmount || 0);
    }, 0);
  
  // Shop (quick sales and manual buffet sales)
  const shopIncomeGross = dailySales.reduce((sum, s) => {
    if (s.type === 'manual_invoice') {
      return sum + (s.buffetAmount || 0);
    }
    return sum + (s.totalAmount || 0);
  }, 0);
  const shopTax = dailySales.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  
  const totalTax = gameTax + shopTax;
  const purchaseCosts = dailyPurchases.reduce((sum, p) => sum + (p.totalCost || 0), 0);
  const repairIncomeGross = dailyRepairs.reduce((sum, r) => sum + (Number(r.finalPrice ?? r.estimatedCost) || 0), 0);
  
  const grandTotalGross = completedSessions.reduce((sum, s) => sum + (s.totalCost || 0), 0) +
    dailySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0) +
    repairIncomeGross;
  const totalNetRevenue = grandTotalGross - totalTax;
  const dailyProfit = totalNetRevenue - purchaseCosts;

  const gamePercent = grandTotalGross > 0 ? (gameIncomeGross / grandTotalGross) * 100 : 0;
  const buffetPercent = grandTotalGross > 0 ? (buffetIncomeGross / grandTotalGross) * 100 : 0;
  const shopPercent = grandTotalGross > 0 ? (shopIncomeGross / grandTotalGross) * 100 : 0;
  const repairPercent = grandTotalGross > 0 ? (repairIncomeGross / grandTotalGross) * 100 : 0;

  const profitMarginPercent = grandTotalGross > 0 ? Math.round((dailyProfit / grandTotalGross) * 100) : 0;

  // Combined records for list
  const combinedReports: ReportItem[] = [
    ...completedSessions.map(s => {
      const gameAmt = s.totalSessionAmount || 0;
      const prodAmt = s.totalProductsAmount || 0;
      const taxAmt = s.taxAmount || 0;
      const durSec = getSessionDurationSeconds(s);

      const startTimeStr = s.startTime ? formatTime24(s.startTime) : '';
      const endTimeStr = s.endTime ? formatTime24(s.endTime) : (s.startTime ? formatTime24(s.startTime) : '');
      const timeIntervalText = startTimeStr && endTimeStr ? `ساعت ${startTimeStr} تا ${endTimeStr}` : '';
      const durationText = formatFriendlyDuration(durSec);

      let detailPieces: string[] = [];
      if (timeIntervalText) {
        detailPieces.push(`${timeIntervalText} (${durationText})`);
      } else {
        detailPieces.push(`مدت بازی: ${durationText}`);
      }

      if (s.addedItems && s.addedItems.length > 0) {
        detailPieces.push(`اقلام بوفه: ${s.addedItems.map(i => `${i.name} (×${formatPersianDigits(i.quantity)})`).join('، ')}`);
      }
      
      return {
        id: s.id,
        type: 'session' as const,
        title: `بازی - ${getConsoleName(s.consoleId)}`,
        amount: s.totalCost || (gameAmt + prodAmt + taxAmt),
        gameAmount: gameAmt,
        buffetAmount: prodAmt,
        taxAmount: taxAmt,
        timestamp: s.endTime || s.startTime,
        details: detailPieces.join(' | '),
        manualAdjustment: s.manualAdjustment,
        manualAdjustmentType: s.manualAdjustmentType,
        manualAdjustmentNote: s.manualAdjustmentNote,
        rawSession: s
      };
    }),
    ...dailySales.map(s => {
      const gAmt = s.gameAmount || 0;
      const bAmt = s.buffetAmount !== undefined ? s.buffetAmount : (s.totalAmount - (s.taxAmount || 0));
      const matchedClient = (s.userId || s.customerId) ? clients?.find(c => c.id === (s.userId || s.customerId)) : null;
      const resolvedCustomerName = s.customerName || matchedClient?.name || '';
      return {
        id: s.id,
        type: (s.type === 'manual_invoice' ? 'manual_invoice' : 'sale') as any,
        title: s.title || (s.type === 'manual_invoice' ? (gAmt > 0 && bAmt === 0 ? 'فاکتور دستی بازی' : bAmt > 0 && gAmt === 0 ? 'فاکتور دستی بوفه' : 'فاکتور دستی کلوپ') : 'فروش مستقیم (فروشگاه و بوفه)'),
        amount: s.totalAmount,
        gameAmount: gAmt,
        buffetAmount: bAmt,
        taxAmount: s.taxAmount || 0,
        timestamp: s.timestamp,
        customerName: resolvedCustomerName || undefined,
        userId: s.userId || s.customerId,
        customerId: s.customerId || s.userId,
        customerPhone: s.customerPhone || matchedClient?.phone,
        details: s.items && s.items.length > 0 
          ? s.items.map(i => `${i.name} (×${formatPersianDigits(i.quantity)})`).join('، ') 
          : ((s as any).details || (s.type === 'manual_invoice' ? (gAmt > 0 && bAmt === 0 ? `ثبت دستی بازی: ${formatCurrency(gAmt)}` : bAmt > 0 && gAmt === 0 ? `ثبت دستی بوفه: ${formatCurrency(bAmt)}` : `ثبت دستی بازی و بوفه`) : 'فروش کالا و خدمات')),
        manualAdjustment: s.manualAdjustment,
        manualAdjustmentType: s.manualAdjustmentType,
        manualAdjustmentNote: s.manualAdjustmentNote,
        invoiceCategory: s.invoiceCategory,
        rawSale: s
      };
    }),
    ...dailyPurchases.map(p => ({
      id: p.id,
      type: 'purchase' as const,
      title: `خرید کالا (ورود به انبار) - ${p.productName || 'قفسه انبار'}`,
      amount: -p.totalCost,
      gameAmount: 0,
      buffetAmount: 0,
      taxAmount: 0,
      timestamp: p.timestamp,
      details: `تعداد: ${formatPersianDigits(p.quantity)} عدد | قیمت خرید: ${formatCurrency(p.costPrice)}`,
      rawPurchase: p
    })),
    ...dailyRepairs.map(r => {
      const devTypeFa = r.deviceType === 'console' ? 'کنسول' : r.deviceType === 'controller' ? 'دسته بازی' : r.deviceType === 'accessory' ? 'لوازم جانبی' : 'سایر قطعات';
      const statusFa = r.status === 'delivered' ? 'تحویل داده شد' : r.status === 'ready' ? 'آماده تحویل' : r.status === 'in_progress' ? 'در حال تعمیر' : 'پذیرش اولیه';
      const cost = Number(r.finalPrice ?? r.estimatedCost) || 0;
      return {
        id: r.id,
        type: 'repair' as const,
        title: `تعمیرات سخت‌افزار - ${r.deviceModel} (${devTypeFa})`,
        amount: cost,
        gameAmount: 0,
        buffetAmount: 0,
        repairAmount: cost,
        taxAmount: 0,
        timestamp: r.completedAt || r.receivedAt || new Date().toISOString(),
        details: `کد پیگیری: ${r.trackingCode} | عیب: ${r.issueDescription} | وضعیت: ${statusFa}`,
        customerName: r.clientName,
        customerPhone: r.clientPhone,
        customerId: r.clientId,
        invoiceCategory: 'repair' as const,
        rawRepair: r
      };
    })
  ].filter(report => {
    const searchMatch = !searchTerm || 
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      report.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.customerName && report.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!searchMatch) return false;
    
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'game') return report.type === 'session' || (report.type === 'manual_invoice' && report.gameAmount > 0);
    if (selectedFilter === 'buffet') return (report.type === 'session' && report.buffetAmount > 0) || report.type === 'sale' || (report.type === 'manual_invoice' && report.buffetAmount > 0);
    if (selectedFilter === 'repair') return report.type === 'repair';
    if (selectedFilter === 'shop') return report.type === 'sale' || (report.type === 'manual_invoice' && report.buffetAmount > 0);
    if (selectedFilter === 'purchase') return report.type === 'purchase';
    
    return true;
  }).sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (sortOrder === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (sortOrder === 'amount_high') return b.amount - a.amount;
    if (sortOrder === 'amount_low') return a.amount - b.amount;
    return 0;
  });

  const handleOpenInvoice = (report: ReportItem) => {
    setSelectedInvoice(report);
    setIsInvoiceOpen(true);
  };


  return (
    <div className="p-6 lg:p-10 space-y-8 font-sans text-right pb-32" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">گزارشات مالی کلوپ</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">تراز مالی، تـفکیک درآمد، کنترل اسناد خرید و حسابداری دوره‌ای</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setEditModalConfig({ isOpen: true, mode: 'create', report: null })}
            className="flex items-center gap-2 px-4 h-11 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-black text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>ثبت فاکتور دستی جدید</span>
          </button>

          <div className="flex items-center gap-2 px-4 h-11 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
             <p className="text-[11px] text-emerald-850 dark:text-emerald-300 font-extrabold">
               تراز دوره: {formatCurrency(grandTotalGross - purchaseCosts)}
             </p>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-slate-300 dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-400 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 rounded-xl">
              <CalendarRange size={18} />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 dark:text-white block">فیلتر زمانی گزارش:</span>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{getFilterPeriodLabel()}</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'امروز' },
              { id: 'yesterday', label: 'دیروز' },
              { id: 'last7', label: '۷ روز اخیر' },
              { id: 'this_month', label: 'این ماه' },
              { id: 'day', label: 'روز خاص' },
              { id: 'range', label: 'بازه دلخواه' },
              { id: 'all', label: 'همه زمان‌ها' }
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDateFilterMode(preset.id as DatePreset)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all",
                  dateFilterMode === preset.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Controls when 'day' is active */}
        {dateFilterMode === 'day' && (
          <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-200/80 dark:bg-slate-950 p-1 rounded-2xl border border-slate-300 dark:border-slate-800">
                <button 
                  onClick={handlePrevDay}
                  className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                  title="روز قبل"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="text-xs font-black text-slate-800 dark:text-white px-3 min-w-[140px] text-center">
                  {formatJalali(selectedDay, 'EEEE، d MMMM yyyy')}
                </span>
                <button 
                  onClick={handleNextDay}
                  className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                  title="روز بعد"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToToday}
                className="h-10 text-xs font-bold px-4"
              >
                امروز
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">انتخاب تاریخ تقویم:</span>
              <input
                type="date"
                value={selectedDay.toISOString().split('T')[0]}
                onChange={e => {
                  if (e.target.value) {
                    setSelectedDay(new Date(e.target.value));
                  }
                }}
                className="px-3 py-1.5 bg-slate-200/90 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none dark:[color-scheme:dark]"
              />
            </div>
          </div>
        )}

        {/* Detailed Controls when 'range' is active */}
        {dateFilterMode === 'range' && (
          <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">از تاریخ:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-200/90 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none dark:[color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">تا تاریخ:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-200/90 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none dark:[color-scheme:dark]"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-black px-2 py-1 bg-rose-100 dark:bg-rose-950/40 rounded-lg transition-colors"
              >
                پاک کردن بازه
              </button>
            )}
          </div>
        )}
      </div>

      {/* Two Upgraded Cards: Income Breakdown, Daily Profit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: تفکیک درآمد */}
        <Card className="p-6 border-none shadow-xl bg-white dark:bg-slate-800 relative overflow-hidden rounded-[2.5rem]">
          <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <PieChartIcon size={20} />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">تفکیک درآمد دوره</span>
              </div>
              <Badge variant="info">
                کل: {formatCurrency(grandTotalGross)}
              </Badge>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-[11px] mb-1 font-bold">
                  <span className="text-gray-500 dark:text-slate-400">درآمد بازی‌ها</span>
                  <span className="text-gray-950 dark:text-white font-black">{formatCurrency(gameIncomeGross)}</span>
                </div>
                <div className="w-full bg-gray-150 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, gamePercent)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1 font-bold">
                  <span className="text-gray-500 dark:text-slate-400">فروش بوفه و بوم‌ها</span>
                  <span className="text-gray-950 dark:text-white font-black">{formatCurrency(buffetIncomeGross)}</span>
                </div>
                <div className="w-full bg-gray-150 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, buffetPercent)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1 font-bold">
                  <span className="text-gray-500 dark:text-slate-400">فروش مستقیم (فروشگاه)</span>
                  <span className="text-gray-950 dark:text-white font-black">{formatCurrency(shopIncomeGross)}</span>
                </div>
                <div className="w-full bg-gray-150 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, shopPercent)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1 font-bold">
                  <span className="text-gray-500 dark:text-slate-400">خدمات و تعمیرات سخت‌افزار</span>
                  <span className="text-gray-950 dark:text-white font-black">{formatCurrency(repairIncomeGross)}</span>
                </div>
                <div className="w-full bg-gray-150 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-500 h-full rounded-full" style={{ width: `${Math.min(100, repairPercent)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Card 2: سود خالص */}
        <Card className="p-6 border-none shadow-xl bg-white dark:bg-slate-800 relative overflow-hidden rounded-[2.5rem]">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={20} />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">سود خالص دوره</span>
              </div>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/45 px-2 py-1 rounded-lg">
                ٪{formatPersianDigits(profitMarginPercent)} فایده
              </span>
            </div>

            <div className="space-y-3 pt-1">
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none mb-1">
                {formatCurrency(dailyProfit)}
              </div>
              
              <div className="flex flex-col gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 mt-2">
                <p className="font-bold">مبنا: درآمد دوره منهای مالیات و هـزینه‌های ثبت شده خرید</p>
                
                <div className="flex justify-between pt-1 border-t border-gray-100 dark:border-slate-700">
                  <span>هزینه خرید (فاکتور ورود):</span>
                  <span className="text-rose-500 font-bold">{formatCurrency(purchaseCosts)}</span>
                </div>
                <div className="flex justify-between">
                  <span>درآمد ناخالص:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">{formatCurrency(grandTotalGross)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setSelectedFilter('all')}
              className={cn(
                "px-4 py-2 text-xs font-black rounded-xl transition-all",
                selectedFilter === 'all' 
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" 
                  : "bg-slate-100 text-gray-500 dark:bg-slate-750 hover:bg-slate-200"
              )}
            >همـه</button>
            <button 
              onClick={() => setSelectedFilter('game')}
              className={cn(
                "px-4 py-2 text-xs font-black rounded-xl transition-all",
                selectedFilter === 'game' 
                  ? "bg-indigo-600 text-white" 
                  : "bg-slate-100 text-gray-500 dark:bg-slate-750 hover:bg-slate-200"
              )}
            >فقط بازی</button>
            <button 
              onClick={() => setSelectedFilter('buffet')}
              className={cn(
                "px-4 py-2 text-xs font-black rounded-xl transition-all",
                selectedFilter === 'buffet' 
                  ? "bg-emerald-600 text-white" 
                  : "bg-slate-100 text-gray-500 dark:bg-slate-750 hover:bg-slate-200"
              )}
            >سفارش بوفه</button>
            <button 
              onClick={() => setSelectedFilter('repair')}
              className={cn(
                "px-4 py-2 text-xs font-black rounded-xl transition-all",
                selectedFilter === 'repair' 
                  ? "bg-teal-600 text-white" 
                  : "bg-slate-100 text-gray-500 dark:bg-slate-750 hover:bg-slate-200"
              )}
            >تعمیرات سخت‌افزار</button>
            <button 
              onClick={() => setSelectedFilter('shop')}
              className={cn(
                "px-4 py-2 text-xs font-black rounded-xl transition-all",
                selectedFilter === 'shop' 
                  ? "bg-amber-600 text-white" 
                  : "bg-slate-100 text-gray-500 dark:bg-slate-750 hover:bg-slate-200"
              )}
            >فروش مستقیم</button>
            <button 
              onClick={() => setSelectedFilter('purchase')}
              className={cn(
                "px-4 py-2 text-xs font-black rounded-xl transition-all",
                selectedFilter === 'purchase' 
                  ? "bg-rose-500 text-white" 
                  : "bg-slate-100 text-gray-500 dark:bg-slate-750 hover:bg-slate-200"
              )}
            >سند خرید</button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3.5 top-3 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="جستجو در فاکتورها..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-slate-900 text-xs font-medium rounded-xl outline-none focus:bg-white border-2 border-transparent focus:border-slate-200 dark:focus:border-slate-700 transition-all text-right"
              />
            </div>
            
            <select 
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 dark:bg-slate-900 border-2 border-transparent rounded-xl text-xs font-bold text-gray-500 hover:bg-slate-100 outline-none cursor-pointer"
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="amount_high">بیشترین مبلغ</option>
              <option value="amount_low">کمترین مبلغ</option>
            </select>
          </div>
        </div>

        {/* Transaction detailed list */}
        <Card className="p-0 border-gray-100 dark:border-slate-700 shadow-none overflow-hidden bg-white dark:bg-slate-800/50 mt-6 rounded-[2rem]">
          <div className="p-5 border-b border-gray-50 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/50 dark:bg-slate-800/80">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-gray-400" />
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                تراکنش‌های روز {formatJalali(selectedDay, 'd MMMM')}
              </h3>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-normal mr-2 hidden md:inline">
                (برای مشاهده و چاپ فاکتور روی هر مورد کلیک کنید)
              </span>
            </div>
            {searchTerm && (
              <Badge variant="default">یافته‌ها: {formatPersianNumber(combinedReports.length)}</Badge>
            )}
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700/60">
            {combinedReports.length === 0 ? (
              <div className="p-20 text-center text-gray-400 dark:text-slate-500 italic text-sm">هیچ تراکنشی برای روز جاری یافت نشد.</div>
            ) : (
              combinedReports.map(report => (
                <div 
                  key={report.id} 
                  onClick={() => handleOpenInvoice(report)}
                  className="p-5 flex items-center justify-between hover:bg-indigo-50/50 dark:hover:bg-slate-750/70 cursor-pointer transition-all duration-200 group active:scale-[0.998]"
                  title="کلیک برای مشاهده جزئیات و چاپ فاکتور"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                     <div className={cn(
                       "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105",
                       report.type === 'session' ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" :
                       report.type === 'repair' ? "bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400" :
                       report.type === 'manual_invoice' ? (
                         report.gameAmount > 0 && report.buffetAmount === 0 
                           ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                           : report.buffetAmount > 0 && report.gameAmount === 0 
                             ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                             : "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                       ) :
                       report.type === 'sale' ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400" :
                       "bg-rose-50 dark:bg-rose-950 text-rose-500 dark:text-rose-400"
                     )}>
                      {report.type === 'session' ? <Gamepad2 size={20} /> : 
                       report.type === 'repair' ? <Wrench size={20} /> :
                       report.type === 'manual_invoice' ? (
                         report.gameAmount > 0 && report.buffetAmount === 0 ? <Gamepad2 size={20} /> :
                         report.buffetAmount > 0 && report.gameAmount === 0 ? <Coffee size={20} /> :
                         <Layers size={20} />
                       ) :
                       report.type === 'sale' ? <ShoppingCart size={20} /> : <Package size={20} />}
                     </div>
                     <div className="truncate">
                       <div className="flex items-center gap-2 mb-1">
                         <h5 className="font-black text-gray-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                           {report.title}
                         </h5>
                         {report.customerName && (
                           <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-900/40 shrink-0">
                             {report.customerName}
                           </span>
                         )}
                       </div>
                       <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold leading-relaxed truncate">
                         {report.details}
                       </p>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 md:gap-5 flex-shrink-0 mr-4">
                    <div className="text-left">
                      <p className={cn("font-black text-sm", report.type === 'purchase' ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                        {report.type === 'purchase' ? '' : '+'}{formatCurrency(Math.abs(report.amount))}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <Clock size={11} className="text-gray-400" />
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold font-mono">
                          {formatTime24(report.timestamp)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditModalConfig({ isOpen: true, mode: 'edit', report });
                        }}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 dark:bg-slate-700/80 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                        title="ویرایش تاریخ فاکتور یا اعمال تخفیف و افزایش مبلغ"
                      >
                        <Edit size={14} />
                      </button>

                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-700/80 group-hover:bg-indigo-600 group-hover:text-white text-gray-600 dark:text-slate-300 transition-all text-xs font-black">
                        <Receipt size={13} />
                        <span>مشاهده فاکتور</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Invoice Details & Printable Modal */}
      <InvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        report={selectedInvoice}
        settings={settingsList?.[0]}
        clients={clients || []}
        consoles={consoles || []}
        tariffs={tariffs || []}
        onEditInvoice={(rep) => {
          setIsInvoiceOpen(false);
          setEditModalConfig({ isOpen: true, mode: 'edit', report: rep });
        }}
        onDeleteInvoice={handleDeleteInvoice}
      />

      {/* Manual Invoice Edit & Create Modal */}
      <InvoiceEditModal
        isOpen={editModalConfig.isOpen}
        onClose={() => setEditModalConfig(prev => ({ ...prev, isOpen: false }))}
        mode={editModalConfig.mode}
        reportToEdit={editModalConfig.report}
        onSuccess={() => {
          // Trigger any needed local refresh if necessary
        }}
      />
    </div>
  );
}

