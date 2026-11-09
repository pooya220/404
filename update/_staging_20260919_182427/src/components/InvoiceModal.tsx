import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, 
  X, 
  Printer, 
  Clock, 
  Gamepad2, 
  ShoppingCart, 
  Package, 
  User, 
  Users, 
  Calendar, 
  Phone, 
  MapPin, 
  CheckCircle2,
  CreditCard,
  Wallet,
  Coins,
  ArrowRightLeft,
  Edit,
  Trash2,
  Coffee,
  Layers
} from 'lucide-react';
import { formatPersianNumber, formatCurrency, formatPersianDigits, cn } from '../lib/utils';
import { formatJalali } from '../lib/dateUtils';
import { SystemSettings, AppUser, Console, Tariff, Session } from '../types';
import { resolveSessionIntervals } from '../lib/intervalUtils';

export interface ReportItem {
  id: string;
  type: 'session' | 'sale' | 'purchase' | 'manual_invoice';
  title: string;
  amount: number;
  gameAmount: number;
  buffetAmount: number;
  taxAmount: number;
  timestamp: string;
  details: string;
  customerName?: string;
  userId?: string;
  customerId?: string;
  customerPhone?: string;
  manualAdjustment?: number;
  manualAdjustmentType?: 'discount' | 'addition';
  manualAdjustmentNote?: string;
  invoiceCategory?: 'game' | 'buffet' | 'both';
  rawSession?: Session;
  rawSale?: any;
  rawPurchase?: any;
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportItem | null;
  settings?: SystemSettings;
  clients?: AppUser[];
  consoles?: Console[];
  tariffs?: Tariff[];
  onEditInvoice?: (report: ReportItem) => void;
  onDeleteInvoice?: (report: ReportItem) => void;
}

export function InvoiceModal({
  isOpen,
  onClose,
  report,
  settings,
  clients = [],
  consoles = [],
  tariffs = [],
  onEditInvoice,
  onDeleteInvoice
}: InvoiceModalProps) {
  if (!isOpen || !report) return null;

  const handlePrint = () => {
    window.print();
  };

  const storeName = settings?.storeName || 'گیم‌نت و کلوپ بازی پلاس';
  const storePhone = settings?.contactPhone || '';
  const storeAddress = settings?.address || '';

  const formatClockTime = (dateInput?: string | Date) => {
    if (!dateInput) return '---';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '---';
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return formatPersianDigits(`${h}:${m}`);
    } catch {
      return '---';
    }
  };

  const formatFullDate = (dateInput?: string | Date) => {
    if (!dateInput) return '---';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '---';
      return formatJalali(d, 'EEEE d MMMM yyyy');
    } catch {
      return '---';
    }
  };

  const formatDurationText = (seconds?: number) => {
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

  const session = report.rawSession;
  const sale = report.rawSale;
  const purchase = report.rawPurchase;

  // Resolve customer for sales or manual invoices
  const saleCustomerName = sale?.customerName || report.customerName || '';
  const saleCustomerId = sale?.userId || sale?.customerId || report.userId || report.customerId;
  const saleCustomerPhone = sale?.customerPhone || report.customerPhone || '';
  const saleCustomerClient = saleCustomerId 
    ? clients.find(c => c.id === saleCustomerId) 
    : (saleCustomerName ? clients.find(c => c.name.trim().toLowerCase() === saleCustomerName.trim().toLowerCase()) : null);

  // Resolve session data
  const consoleObj = session ? consoles.find(c => c.id === session.consoleId) : null;
  const tariffObj = session ? tariffs.find(t => t.id === session.tariffId) : null;

  // Resolve clients
  const sessionUserIds: string[] = session 
    ? (session.userIds && session.userIds.length > 0 
        ? session.userIds 
        : (session.userId ? [session.userId] : []))
    : [];

  const sessionClients = sessionUserIds.map(uid => clients.find(c => c.id === uid)).filter(Boolean) as AppUser[];

  // Session duration calculation
  let sessionDurationSeconds = session?.duration || 0;
  if (!sessionDurationSeconds && session?.startTime && session?.endTime) {
    const diffMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
    sessionDurationSeconds = Math.max(0, Math.floor(diffMs / 1000));
  }

  // Build intervals list for display using unified resolver
  const displayIntervals = resolveSessionIntervals(session, tariffs, consoles);
  const sessionBaseGameCost = session ? (
    (session as any)?.baseSessionAmount ||
    session.totalSessionAmount ||
    displayIntervals.reduce((sum: number, it: any) => sum + (Number(it.cost) || 0), 0) ||
    report.gameAmount ||
    0
  ) : 0;

  // Invoice Number
  const invoiceNumber = `INV-${report.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || '001'}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 overflow-y-auto" dir="rtl">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm print:hidden"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-10 my-auto text-right font-sans"
        >
          {/* Top Actions Bar (Close, Edit & Print) */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-850/60 print:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black transition-all shadow-sm shadow-indigo-200 dark:shadow-none cursor-pointer"
              >
                <Printer size={15} />
                <span>چاپ فاکتور</span>
              </button>

              {onEditInvoice && (
                <button
                  type="button"
                  onClick={() => onEditInvoice(report)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 text-xs font-black transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <Edit size={14} />
                  <span>ویرایش و تنظیم دستی</span>
                </button>
              )}

              {onDeleteInvoice && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`آیا از انهدام و حذف کامل فاکتور «${report.title}» از پایگاه داده اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`)) {
                      onDeleteInvoice(report);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 text-xs font-black transition-all border border-rose-200 dark:border-rose-900 cursor-pointer"
                  title="حذف و انهدام کامل این فاکتور از پایگاه داده"
                >
                  <Trash2 size={13} />
                  <span>حذف فاکتور</span>
                </button>
              )}

              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-bold mr-2 hidden sm:inline">
                شناسه: {invoiceNumber}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Printable Invoice Container */}
          <div id="printable-invoice" className="p-6 md:p-8 space-y-6 max-h-[82vh] overflow-y-auto custom-scrollbar">
            
            {/* Header: Store Identity & Receipt Badge */}
            <div className="text-center pb-6 border-b border-dashed border-gray-200 dark:border-slate-700">
              <div className={cn(
                "w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center shadow-xs",
                report.type === 'session' ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400" :
                report.type === 'manual_invoice' ? (
                  (report.gameAmount || 0) > 0 && (report.buffetAmount || 0) === 0 ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400" :
                  (report.buffetAmount || 0) > 0 && (report.gameAmount || 0) === 0 ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400" :
                  "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                ) :
                report.type === 'sale' ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400" :
                "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
              )}>
                {report.type === 'session' ? <Gamepad2 size={28} /> : 
                 report.type === 'manual_invoice' ? (
                   (report.gameAmount || 0) > 0 && (report.buffetAmount || 0) === 0 ? <Gamepad2 size={28} /> :
                   (report.buffetAmount || 0) > 0 && (report.gameAmount || 0) === 0 ? <Coffee size={28} /> :
                   <Layers size={28} />
                 ) :
                 report.type === 'sale' ? <ShoppingCart size={28} /> : <Package size={28} />}
              </div>
              <h3 className="text-xl font-black text-gray-950 dark:text-white mb-1">{storeName}</h3>
              <p className="text-[11px] font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">
                {report.type === 'session' ? 'صورتحساب رسمی بازی و بوفه' : 
                 report.type === 'manual_invoice' ? (
                   (report.gameAmount || 0) > 0 && (report.buffetAmount || 0) === 0 ? 'فاکتور دستی اختصاصی بازی' :
                   (report.buffetAmount || 0) > 0 && (report.gameAmount || 0) === 0 ? 'فاکتور دستی اختصاصی بوفه' :
                   'فاکتور دستی بازی و بوفه (ترکیبی)'
                 ) :
                 report.type === 'sale' ? 'فاکتور فروش مستقیم بوفه' : 'سند خرید و ورود به انبار'}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-[10px] font-bold text-gray-500 dark:text-slate-400">
                <span className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
                  <Calendar size={12} className="text-gray-400" />
                  {formatFullDate(report.timestamp)}
                </span>
                <span className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
                  <Clock size={12} className="text-gray-400" />
                  ثبت ساعت {formatClockTime(report.timestamp)}
                </span>
                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg font-mono">
                  {invoiceNumber}
                </span>
              </div>
            </div>

            {/* Type Specific Info Section */}
            {report.type === 'session' && session && (
              <div className="space-y-4">
                {/* Console & Tariff Overview */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-gray-400 dark:text-slate-400">
                      {displayIntervals.length > 1 ? 'دستگاه مقصد (نهایی):' : 'دستگاه و کنسول:'}
                    </span>
                    <span className="text-gray-900 dark:text-white font-black">
                      {consoleObj ? `${consoleObj.name} (${consoleObj.type})` : 'دستگاه کلوپ'}
                    </span>
                  </div>

                  {tariffObj && (
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-gray-400 dark:text-slate-400">
                        {displayIntervals.length > 1 ? 'تعرفه نهایی:' : 'تعرفه مبنا:'}
                      </span>
                      <div className="flex items-center gap-2">
                        {displayIntervals.length > 1 && (
                          <span className="text-[9.5px] bg-amber-500 text-white px-2 py-0.5 rounded-md font-black">
                            تغییر تعرفه ({formatPersianDigits(displayIntervals.length)} مرحله)
                          </span>
                        )}
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                          {tariffObj.name} ({formatCurrency(tariffObj.pricePerHour)} / ساعت)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Start, End, and Duration Times */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-150 dark:border-slate-700 text-center">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl">
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mb-0.5">ساعت شروع</p>
                      <p className="text-xs font-black text-gray-900 dark:text-white font-mono">
                        {formatClockTime(session.startTime)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl">
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mb-0.5">ساعت پایان</p>
                      <p className="text-xs font-black text-gray-900 dark:text-white font-mono">
                        {formatClockTime(session.endTime || session.startTime)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-indigo-100 dark:border-indigo-950">
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mb-0.5">کل مدت بازی</p>
                      <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                        {formatDurationText(sessionDurationSeconds)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Multi-Customer Split if applicable */}
                {sessionClients.length > 0 && (
                  <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-800/40 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <Users size={14} className="text-indigo-600" />
                        بازیکنان فاکتور:
                      </span>
                      <span className="text-[10px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-full">
                        {formatPersianDigits(sessionClients.length)} بازیکن
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {sessionClients.map(c => (
                        <span key={c.id} className="text-[11px] font-bold px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                          {c.name} {c.phone ? `(${formatPersianDigits(c.phone)})` : ''}
                        </span>
                      ))}
                    </div>

                    {sessionClients.length > 1 && (session.costPerUser || report.amount) && (
                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-indigo-150 dark:border-slate-700 font-bold">
                        <span className="text-indigo-900 dark:text-indigo-300">سهم دونگی هر بازیکن:</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(session.costPerUser || Math.round(report.amount / sessionClients.length))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Intervals breakdown if console transferred or tariffs changed */}
                {displayIntervals && displayIntervals.length > 1 && (
                  <div className="p-4 bg-indigo-50/70 dark:bg-slate-800/80 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                        <ArrowRightLeft size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>ریز تغییر تعرفه و مراحل بازی این فاکتور:</span>
                      </span>
                      <span className="text-[10px] bg-indigo-600 text-white font-black px-2.5 py-0.5 rounded-full shadow-xs">
                        {formatPersianDigits(displayIntervals.length)} مرحله تعرفه
                      </span>
                    </div>

                    <div className="divide-y divide-indigo-100 dark:divide-slate-700/60 pt-1">
                      {displayIntervals.map((item: any, idx: number) => {
                        let cleanTariff = item.tariffName || 'تعرفه';
                        if (item.consoleName && cleanTariff.startsWith(item.consoleName)) {
                          cleanTariff = cleanTariff.slice(item.consoleName.length).replace(/^[\s-]+/, '').replace(/\(متوقف شده\)/, '').trim();
                        }
                        const hasIntervalTime = item.startTime && item.endTime;
                        return (
                          <div key={idx} className="flex justify-between items-start py-2.5 text-xs text-slate-700 dark:text-slate-300 gap-2">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 px-2 py-0.5 rounded-md shrink-0 mt-0.5">
                                {idx === 0 ? 'مرحله ۱ (تعرفه اولیه)' : `مرحله ${formatPersianDigits(idx + 1)} (تغییر تعرفه)`}
                              </span>
                              <div>
                                <div className="font-black text-gray-900 dark:text-white">
                                  {item.consoleName ? `${item.consoleName} - ` : ''}
                                  {cleanTariff || 'تعرفه'}
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-slate-400 font-bold space-x-reverse space-x-1.5 mt-0.5">
                                  <span>نرخ: {formatCurrency(item.pricePerHour)} / ساعت</span>
                                  {hasIntervalTime && (
                                    <span>• از ساعت {formatClockTime(item.startTime)} تا {formatClockTime(item.endTime)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <span className="font-black text-indigo-950 dark:text-indigo-200">
                                {formatCurrency(item.cost || 0)}
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">
                                {formatDurationText(item.durationSeconds)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Buffet items added to session */}
                {session.addedItems && session.addedItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                      <ShoppingCart size={14} className="text-amber-500" />
                      سفارشات بوفه در حین بازی:
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                      <table className="w-full text-right text-xs" dir="rtl">
                        <thead className="bg-slate-100/70 dark:bg-slate-800 text-[10px] font-black text-gray-400 dark:text-slate-400">
                          <tr>
                            <th className="p-2.5 pr-4">نام کالا</th>
                            <th className="p-2.5 text-center">تعداد</th>
                            <th className="p-2.5 text-left">قیمت فی</th>
                            <th className="p-2.5 pl-4 text-left">مجموع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {session.addedItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-2.5 pr-4 font-bold text-gray-800 dark:text-slate-200">{item.name}</td>
                              <td className="p-2.5 text-center font-black text-gray-900 dark:text-white">{formatPersianDigits(item.quantity)}</td>
                              <td className="p-2.5 text-left text-gray-500 dark:text-slate-400 font-bold">{formatCurrency(item.price)}</td>
                              <td className="p-2.5 pl-4 text-left font-black text-gray-900 dark:text-white">{formatCurrency(item.price * item.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customer Information (Club member or Guest) for Manual Invoices & Sales */}
            {(report.type === 'manual_invoice' || report.type === 'sale') && (saleCustomerClient || saleCustomerName) && (
              <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-800/60 rounded-2xl border border-indigo-150 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <User size={14} className="text-indigo-600" />
                    مشتری / طرف حساب:
                  </span>
                  {saleCustomerClient ? (
                    <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                      <CheckCircle2 size={11} />
                      عضو باشگاه مشتریان
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded-md">
                      مشتری گذری / آزاد
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {saleCustomerClient?.name || saleCustomerName}
                    </span>
                    {(saleCustomerClient?.phone || saleCustomerPhone) && (
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        ({formatPersianDigits(saleCustomerClient?.phone || saleCustomerPhone)})
                      </span>
                    )}
                  </div>
                  {saleCustomerClient?.tier && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                      سطح {saleCustomerClient.tier}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Manual invoice game service card */}
            {report.type === 'manual_invoice' && (report.gameAmount || 0) > 0 && (
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-150 dark:border-indigo-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Gamepad2 size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 block">خدمات و بازی کلوپ</span>
                    <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400 font-bold">ثبت دستی سهم بازی</span>
                  </div>
                </div>
                <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                  {formatCurrency(report.gameAmount)}
                </span>
              </div>
            )}

            {/* Quick Sale direct products OR Manual Invoice products */}
            {(report.type === 'sale' || report.type === 'manual_invoice') && sale && sale.items && sale.items.length > 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                    <ShoppingCart size={14} className="text-amber-500" />
                    اقلام فروشگاه و بوفه:
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-right text-xs" dir="rtl">
                      <thead className="bg-slate-100/70 dark:bg-slate-800 text-[10px] font-black text-gray-400 dark:text-slate-400">
                        <tr>
                          <th className="p-2.5 pr-4">کالا</th>
                          <th className="p-2.5 text-center">تعداد</th>
                          <th className="p-2.5 text-left">قیمت واحد</th>
                          <th className="p-2.5 pl-4 text-left">جمع کل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {(sale.items || []).filter((item: any) => item.id !== 'manual_game').map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2.5 pr-4 font-bold text-gray-800 dark:text-slate-200">{item.name}</td>
                            <td className="p-2.5 text-center font-black text-gray-900 dark:text-white">{formatPersianDigits(item.quantity)}</td>
                            <td className="p-2.5 text-left text-gray-500 dark:text-slate-400 font-bold">{formatCurrency(item.price)}</td>
                            <td className="p-2.5 pl-4 text-left font-black text-gray-900 dark:text-white">{formatCurrency(item.price * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Purchase */}
            {report.type === 'purchase' && purchase && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-400 dark:text-slate-400">کالای خریداری شده:</span>
                  <span className="text-gray-900 dark:text-white font-black">{purchase.productName || 'قفسه انبار'}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-400 dark:text-slate-400">تعداد ورودی:</span>
                  <span className="text-gray-900 dark:text-white font-black">{formatPersianDigits(purchase.quantity)} عدد</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-gray-400 dark:text-slate-400">قیمت خرید هر واحد (فی):</span>
                  <span className="text-gray-900 dark:text-white font-black">{formatCurrency(purchase.costPrice)}</span>
                </div>
              </div>
            )}

            {/* Financial Totals & Breakdown */}
            <div className="pt-4 border-t-2 border-dashed border-gray-200 dark:border-slate-700 space-y-2 text-xs">
              {report.type === 'session' && session && (
                <>
                  <div className="flex justify-between text-gray-500 dark:text-slate-400 font-bold">
                    <span>هزینه پایه بازی:</span>
                    <span>{formatCurrency(sessionBaseGameCost)}</span>
                  </div>

                  {(session.totalProductsAmount || report.buffetAmount) > 0 && (
                    <div className="flex justify-between text-gray-500 dark:text-slate-400 font-bold">
                      <span>سفارشات بوفه:</span>
                      <span>{formatCurrency(session.totalProductsAmount || report.buffetAmount)}</span>
                    </div>
                  )}

                  {(session as any)?.tierDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>تخفیف وفاداری مشتری:</span>
                      <span>-{formatCurrency((session as any).tierDiscountAmount)}</span>
                    </div>
                  )}

                  {(session as any)?.promoDiscountAmount > 0 && (
                    <div className="flex justify-between text-indigo-600 font-bold">
                      <span>جشنواره تخفیف ({(session as any).promoName || 'کمپین'}):</span>
                      <span>-{formatCurrency((session as any).promoDiscountAmount)}</span>
                    </div>
                  )}
                </>
              )}

              {report.type === 'manual_invoice' && (
                <>
                  {(report.gameAmount || 0) > 0 && (
                    <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-bold">
                      <span>سهم خدمات بازی:</span>
                      <span>{formatCurrency(report.gameAmount || 0)}</span>
                    </div>
                  )}
                  {(report.buffetAmount || 0) > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                      <span>سهم خدمات بوفه:</span>
                      <span>{formatCurrency(report.buffetAmount || 0)}</span>
                    </div>
                  )}
                </>
              )}

              {report.taxAmount > 0 && (
                <div className="flex justify-between text-gray-500 dark:text-slate-400 font-bold">
                  <span>مالیات بر ارزش افزوده:</span>
                  <span>+{formatCurrency(report.taxAmount)}</span>
                </div>
              )}

              {/* Manual Adjustments: Custom Discount or Surcharge */}
              {(() => {
                const manualAdj = (session as any)?.manualAdjustment ?? (sale as any)?.manualAdjustment ?? report.manualAdjustment;
                const manualNote = (session as any)?.manualAdjustmentNote ?? (sale as any)?.manualAdjustmentNote ?? report.manualAdjustmentNote;
                if (!manualAdj) return null;
                if (manualAdj < 0) {
                  return (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>تخفیف {manualNote ? `(${manualNote})` : ''}:</span>
                      <span>-{formatCurrency(Math.abs(manualAdj))}</span>
                    </div>
                  );
                }
                return (
                  <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-bold">
                    <span>پاداش / انعام یا مبلغ افزایشی {manualNote ? `(${manualNote})` : ''}:</span>
                    <span>+{formatCurrency(manualAdj)}</span>
                  </div>
                );
              })()}

              {/* Grand Total Highlight */}
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-150 dark:border-slate-700">
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  {report.type === 'purchase' ? 'مجموع بهای پرداخت‌شده:' : 'مبلغ نهایی فاکتور:'}
                </span>
                <span className={`text-xl font-black ${report.type === 'purchase' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {report.type === 'purchase' ? '' : ''}{formatCurrency(Math.abs(report.amount))}
                </span>
              </div>
            </div>

            {/* Footer Notes & Store Address/Phone */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
                <span>تسویه حساب شده و ثبت در سیستم کلوپ</span>
              </div>

              {(storePhone || storeAddress) && (
                <div className="text-[10px] text-gray-400 dark:text-slate-500 space-y-1 pt-1">
                  {storePhone && (
                    <p className="flex items-center justify-center gap-1">
                      <Phone size={11} />
                      شماره تماس: {formatPersianDigits(storePhone)}
                    </p>
                  )}
                  {storeAddress && (
                    <p className="flex items-center justify-center gap-1">
                      <MapPin size={11} />
                      {storeAddress}
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Bottom Action in Modal (Close) */}
          <div className="p-4 bg-gray-50/70 dark:bg-slate-850 border-t border-gray-100 dark:border-slate-800 flex justify-end print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              بستن
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
