import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar, Clock, DollarSign, Percent, PlusCircle, MinusCircle, 
  CheckCircle2, AlertCircle, FileText, User, CreditCard, Tag
} from 'lucide-react';
import { Button, Input } from './ui/common';
import { formatCurrency, formatPersianDigits } from '../lib/utils';
import { formatJalali } from '../lib/dateUtils';
import { useFirestore, triggerDatabaseRefresh } from '../hooks/useFirestore';
import { ReportItem } from './InvoiceModal';

interface InvoiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportToEdit?: ReportItem | null;
  mode: 'edit' | 'create';
  onSuccess?: () => void;
}

export function InvoiceEditModal({
  isOpen,
  onClose,
  reportToEdit,
  mode,
  onSuccess
}: InvoiceEditModalProps) {
  const { update, add } = useFirestore();

  // Common fields
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('12:00');
  const [adjustmentType, setAdjustmentType] = useState<'none' | 'discount' | 'addition'>('none');
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Create Mode Specific fields
  const [newTitle, setNewTitle] = useState('فاکتور دستی کلوپ');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newGameAmount, setNewGameAmount] = useState<string>('0');
  const [newBuffetAmount, setNewBuffetAmount] = useState<string>('0');
  const [newTaxAmount, setNewTaxAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'wallet'>('card');
  const [newDetails, setNewDetails] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && reportToEdit) {
        const rawDate = new Date(reportToEdit.timestamp || Date.now());
        const dStr = !isNaN(rawDate.getTime()) ? rawDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const h = !isNaN(rawDate.getTime()) ? String(rawDate.getHours()).padStart(2, '0') : '12';
        const m = !isNaN(rawDate.getTime()) ? String(rawDate.getMinutes()).padStart(2, '0') : '00';
        
        setDateStr(dStr);
        setTimeStr(`${h}:${m}`);

        const currentAdj = reportToEdit.manualAdjustment || 0;
        if (currentAdj < 0) {
          setAdjustmentType('discount');
          setAdjustmentAmount(String(Math.abs(currentAdj)));
        } else if (currentAdj > 0) {
          setAdjustmentType('addition');
          setAdjustmentAmount(String(currentAdj));
        } else {
          setAdjustmentType('none');
          setAdjustmentAmount('');
        }
        setAdjustmentNote(reportToEdit.manualAdjustmentNote || '');
      } else {
        // Create Mode
        const now = new Date();
        setDateStr(now.toISOString().slice(0, 10));
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        setTimeStr(`${h}:${m}`);
        setAdjustmentType('none');
        setAdjustmentAmount('');
        setAdjustmentNote('');
        setNewTitle('فاکتور دستی کلوپ');
        setNewCustomerName('');
        setNewGameAmount('0');
        setNewBuffetAmount('0');
        setNewTaxAmount('0');
        setNewDetails('');
      }
    }
  }, [isOpen, mode, reportToEdit]);

  if (!isOpen) return null;

  // Compute live amounts for Edit Mode
  const originalAmount = reportToEdit ? Math.abs(reportToEdit.amount) : 0;
  // If the invoice already had an adjustment, find the base before adjustment
  const previousAdjustment = reportToEdit?.manualAdjustment || 0;
  const unadjustedBase = originalAmount - previousAdjustment;

  const adjNum = Number(adjustmentAmount) || 0;
  const netAdjustment = adjustmentType === 'discount' ? -adjNum : adjustmentType === 'addition' ? adjNum : 0;
  const newComputedTotal = Math.max(0, unadjustedBase + netAdjustment);

  // Compute live amounts for Create Mode
  const cGame = Number(newGameAmount) || 0;
  const cBuffet = Number(newBuffetAmount) || 0;
  const cTax = Number(newTaxAmount) || 0;
  const cSubtotal = cGame + cBuffet + cTax;
  const cTotal = Math.max(0, cSubtotal + netAdjustment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build ISO timestamp from selected date and time
      const [year, month, day] = (dateStr || new Date().toISOString().slice(0, 10)).split('-').map(Number);
      const [hour, minute] = (timeStr || '12:00').split(':').map(Number);
      const customTimestamp = new Date(year, month - 1, day, hour, minute, 0).toISOString();

      if (mode === 'edit' && reportToEdit) {
        if (reportToEdit.type === 'session' && reportToEdit.rawSession) {
          const sess = reportToEdit.rawSession;
          await update('sessions', sess.id, {
            endTime: customTimestamp,
            manualAdjustment: netAdjustment,
            manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
            manualAdjustmentNote: adjustmentNote.trim() || null,
            totalCost: newComputedTotal,
            customDate: customTimestamp
          });
        } else if (reportToEdit.type === 'sale' && reportToEdit.rawSale) {
          const sale = reportToEdit.rawSale;
          await update('sales', sale.id, {
            timestamp: customTimestamp,
            manualAdjustment: netAdjustment,
            manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
            manualAdjustmentNote: adjustmentNote.trim() || null,
            totalAmount: newComputedTotal
          });
        } else if (reportToEdit.type === 'purchase' && reportToEdit.rawPurchase) {
          const pur = reportToEdit.rawPurchase;
          await update('purchases', pur.id, {
            timestamp: customTimestamp,
            totalCost: newComputedTotal
          });
        } else {
          // General reports collection update if exists
          await update('reports', reportToEdit.id, {
            timestamp: customTimestamp,
            amount: newComputedTotal,
            manualAdjustment: netAdjustment,
            manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
            manualAdjustmentNote: adjustmentNote.trim() || null
          });
        }
      } else {
        // Create new manual invoice
        await add('sales', {
          title: newTitle.trim() || 'فاکتور دستی کلوپ',
          customerName: newCustomerName.trim() || undefined,
          totalAmount: cTotal,
          gameAmount: cGame,
          buffetAmount: cBuffet,
          taxAmount: cTax,
          timestamp: customTimestamp,
          type: 'manual_invoice',
          paymentMethod: paymentMethod,
          manualAdjustment: netAdjustment,
          manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
          manualAdjustmentNote: adjustmentNote.trim() || null,
          details: newDetails.trim() || `ثبت دستی: بازی ${formatCurrency(cGame)} + بوفه ${formatCurrency(cBuffet)}`,
          items: [
            ...(cGame > 0 ? [{ id: 'manual_game', name: 'خدمات بازی دستی', price: cGame, quantity: 1 }] : []),
            ...(cBuffet > 0 ? [{ id: 'manual_buffet', name: 'خدمات بوفه دستی', price: cBuffet, quantity: 1 }] : [])
          ]
        });
      }

      triggerDatabaseRefresh();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره تغییرات فاکتور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/70 font-sans" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-300 dark:bg-slate-900 rounded-3xl border border-slate-400 dark:border-slate-800 p-6 md:p-8 max-w-lg w-full shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-400 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-black">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {mode === 'edit' ? 'ویرایش و تنظیم دستی فاکتور' : 'ثبت فاکتور دستی جدید'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                  {mode === 'edit' 
                    ? `تنظیم تاریخ، اعمال تخفیف یا اضافه کردن مبلغ به فاکتور #${reportToEdit?.id?.slice(0, 8)}`
                    : 'ثبت صورتحساب برای هر تاریخ دلخواه در گذشته یا امروز'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-5 custom-scrollbar pr-1">
            
            {/* Create Mode: Title and Customer */}
            {mode === 'create' && (
              <div className="space-y-3">
                <Input
                  label="عنوان فاکتور"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: فاکتور بازی و پذیرایی، خدمات ویژه..."
                  required
                />
                <Input
                  label="نام مشتری / شخص پرداخت‌کننده (اختیاری)"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="مثلاً: علی محمدی"
                />
              </div>
            )}

            {/* 1. Date & Time Manual Setting */}
            <div className="p-4 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl border border-slate-300 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Calendar size={15} className="text-indigo-600" />
                  تنظیم تاریخ و ساعت فاکتور:
                </span>
                {dateStr && (
                  <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg">
                    {formatJalali(new Date(dateStr), 'EEEE d MMMM yyyy')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    تاریخ فاکتور:
                  </label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    ساعت ثبت:
                  </label>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            {/* Create Mode: Breakdown amounts */}
            {mode === 'create' && (
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="مبلغ بازی (تومان)"
                  type="number"
                  value={newGameAmount}
                  onChange={(e) => setNewGameAmount(e.target.value)}
                />
                <Input
                  label="مبلغ بوفه (تومان)"
                  type="number"
                  value={newBuffetAmount}
                  onChange={(e) => setNewBuffetAmount(e.target.value)}
                />
                <Input
                  label="مالیات (تومان)"
                  type="number"
                  value={newTaxAmount}
                  onChange={(e) => setNewTaxAmount(e.target.value)}
                />
              </div>
            )}

            {/* 2. Adjustment Section: Discount or Addition */}
            <div className="p-4 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl border border-slate-300 dark:border-slate-700 space-y-3.5">
              <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <DollarSign size={15} className="text-emerald-600" />
                تعدیل مبلغ فاکتور (تخفیف دستی یا اضافه پرداختی):
              </span>

              {/* Toggle adjustment type */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setAdjustmentType('none'); setAdjustmentAmount(''); }}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    adjustmentType === 'none'
                      ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  بدون تغییر
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('discount')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    adjustmentType === 'discount'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <MinusCircle size={14} />
                  کسر تخفیف دستی
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('addition')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    adjustmentType === 'addition'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <PlusCircle size={14} />
                  اضافه کردن مبلغ
                </button>
              </div>

              {adjustmentType !== 'none' && (
                <div className="space-y-3 pt-1">
                  <Input
                    label={adjustmentType === 'discount' ? 'مبلغ تخفیف دستی (تومان)' : 'مبلغ افزایشی / خدمات اضافه (تومان)'}
                    type="number"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    placeholder="مثلاً: 20000"
                    required
                  />
                  <Input
                    label="علت تخفیف یا مبلغ افزایشی (توضیح در فاکتور)"
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    placeholder="مثال: تخفیف مدیریت، بازی طولانی، هزینه دسته اضافه، انعام..."
                  />
                </div>
              )}
            </div>

            {/* Create Mode: Payment Method & Details */}
            {mode === 'create' && (
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  روش پرداخت فاکتور:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                      paymentMethod === 'card'
                        ? 'bg-indigo-100 border-indigo-500 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    کارتخوان (بانکی)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-indigo-100 border-indigo-500 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    نقدی
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                      paymentMethod === 'wallet'
                        ? 'bg-indigo-100 border-indigo-500 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    کیف پول / اعتباری
                  </button>
                </div>

                <Input
                  label="توضیحات و جزئیات فاکتور (اختیاری)"
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  placeholder="ثبت هرگونه توضیحات تکمیلی..."
                />
              </div>
            )}

            {/* Computed Calculation Card */}
            <div className="p-4 bg-slate-200/80 dark:bg-indigo-950/30 rounded-2xl border border-slate-300 dark:border-indigo-900/50 space-y-2 text-xs">
              <div className="flex justify-between text-slate-700 dark:text-slate-300 font-bold">
                <span>مبلغ پایه فاکتور:</span>
                <span>{formatCurrency(mode === 'edit' ? unadjustedBase : cSubtotal)}</span>
              </div>

              {adjustmentType === 'discount' && adjNum > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>کسر تخفیف دستی {adjustmentNote ? `(${adjustmentNote})` : ''}:</span>
                  <span>-{formatCurrency(adjNum)}</span>
                </div>
              )}

              {adjustmentType === 'addition' && adjNum > 0 && (
                <div className="flex justify-between text-indigo-700 dark:text-indigo-400 font-bold">
                  <span>مبلغ اضافه شده {adjustmentNote ? `(${adjustmentNote})` : ''}:</span>
                  <span>+{formatCurrency(adjNum)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-300 dark:border-indigo-800/60">
                <span className="font-black text-slate-900 dark:text-white">مبلغ نهایی تسویه فاکتور:</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatCurrency(mode === 'edit' ? newComputedTotal : cTotal)}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                {mode === 'edit' ? 'ذخیره تغییرات فاکتور' : 'ثبت قطعی فاکتور دستی'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-12 px-5 rounded-2xl text-xs font-bold"
              >
                انصراف
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
