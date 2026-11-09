import { summarizeFinance, sessionAmounts, saleAmounts, repairPaid, repairReceipts, repairDate, repairPartsDate, repairPartsExpenseCost, sessionDate, isRevenueSale, clientSessionShare, money, inPeriod, shareholderPaymentsInPeriod } from '../lib/finance';
import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { Card, Button, Input, SegmentToggle, ToggleOption } from '../components/ui/common';
import { 
  PieChart as PieChartIcon, 
  Plus, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Trash2,
  UserPlus,
  Percent,
  Receipt,
  Edit2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  LineChart,
  Megaphone,
  Target,
  MessageSquare,
  Share2,
  Sparkles,
  ShoppingBag,
  Award,
  Wrench
} from 'lucide-react';
import { 
  formatCurrency, 
  formatPersianNumber, 
  cn 
} from '../lib/utils';
import { 
  getCurrentJalaliDate, 
  getJalaliMonthRange, 
  getJalaliMonths,
  localDateInput
} from '../lib/dateUtils';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface InvestmentRecord {
  amount: number;
  date: string;
  note?: string;
}

interface Shareholder {
  id: string;
  name: string;
  investments: InvestmentRecord[];
  joinedAt: string;
}

interface SharedExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
}

type ExpenseListKind = 'variable' | 'repair' | 'purchase';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const investmentDateToIso = (dateValue: string) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toISOString();
};

export default function Stocks() {
  const { data: shareholders, loading: shLoading } = useCollection<Shareholder>('shareholders');
  const { data: goals } = useCollection<any>('goals');
  const { data: sessions } = useCollection<any>('sessions');
  const { data: sales } = useCollection<any>('sales');
  const { data: repairs } = useCollection<any>('repairs');
  const { data: settings } = useCollection<any>('settings');
  const { data: expenses } = useCollection<SharedExpense>('shared_expenses');
  const { add, update, remove } = useFirestore();

  const [currentView, setCurrentView] = useState<'investment' | 'revenue'>('investment');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingInvestment, setDeletingInvestment] = useState<{ shId: string, index: number } | null>(null);
  const [editingInvestmentRecord, setEditingInvestmentRecord] = useState<{ shId: string, index: number } | null>(null);
  const [paymentShareholderId, setPaymentShareholderId] = useState<string | null>(null);
  const [payoutType, setPayoutType] = useState<'cash' | 'goal' | 'carryover'>('cash');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  
  const currentJalali = getCurrentJalaliDate();
  const [selectedMonth, setSelectedMonth] = useState(currentJalali.month);
  const [selectedYear, setSelectedYear] = useState(currentJalali.year);
  
  // Local state for fixed cost inputs to allow typing
  const [localFixedCosts, setLocalFixedCosts] = useState<Record<string, string>>({});

  const months = getJalaliMonths();

  const { data: fixedExpenses } = useCollection<any>('fixed_expenses');
  const { data: monthlyFixedCosts } = useCollection<any>('monthly_fixed_costs');
  const { data: payments } = useCollection<any>('shareholder_payments');
  const { data: purchases } = useCollection<any>('purchases');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newInvestment, setNewInvestment] = useState<number>(0);
  const [investmentNote, setInvestmentNote] = useState('');
  const [investmentDate, setInvestmentDate] = useState(localDateInput());
  
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState('');
  const [editingExpense, setEditingExpense] = useState<SharedExpense | null>(null);
  const [viewingExpenseList, setViewingExpenseList] = useState<ExpenseListKind | null>(null);

  // Monthly Financial Calculations
  const monthlyFinancials = useMemo(() => {
    const { start: startDate, end: endDate } = getJalaliMonthRange(selectedYear, selectedMonth, settings?.[0]?.dayResetHour || 0, settings?.[0]?.dayResetMinute || 0);
    
    const activeMonthlyFixedCosts = (monthlyFixedCosts || []).filter(f => Number(f.month) === selectedMonth && Number(f.year) === selectedYear);
    const ledger = summarizeFinance({ sessions, sales, repairs, purchases, sharedExpenses: expenses, fixedCosts: activeMonthlyFixedCosts, start: startDate, end: endDate });
    const currentMonthExpenses = (expenses || []).filter(e => new Date(e.date) >= startDate && new Date(e.date) <= endDate);
    const currentMonthRepairExpenses = (repairs || []).filter(r =>
      repairPartsExpenseCost(r) > 0 && inPeriod(repairPartsDate(r), startDate, endDate)
    );
    const currentMonthPurchases = (purchases || []).filter(p => inPeriod(p.timestamp, startDate, endDate));
    const totalRevenueNet = ledger.netRevenue;
    const totalTax = ledger.tax;
    const totalTierDiscounts = ledger.sessions.reduce((sum, s) => sum + money(s.tierDiscountAmount), 0);
    const totalDiscounts = totalTierDiscounts + ledger.sessions.reduce((sum, s) => sum + money(s.promoDiscountAmount) + Math.max(0, -money(s.manualAdjustment)), 0);
    const temporaryExpenses = ledger.shared;
    const purchaseCosts = ledger.purchases;
    const totalFixedCosts = ledger.fixed;
    const totalExpenses = ledger.expenses;
    const netProfit = ledger.profit;

    // Attribute payouts to their selected accounting month; use cash date for legacy records.
    const monthlyPayments = shareholderPaymentsInPeriod(payments || [], startDate, endDate);
    const periodPaidToPartners = monthlyPayments.reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    const monthlyCarryoversIn = (payments || []).filter((p: any) =>
      p.type === 'carryover' && Number(p.targetMonth) === Number(selectedMonth) && Number(p.targetYear) === Number(selectedYear)
    );
    const monthlyCarryoversOut = (payments || []).filter((p: any) =>
      p.type === 'carryover' && Number(p.month) === Number(selectedMonth) && Number(p.year) === Number(selectedYear)
    );

    return { 
      totalRevenue: totalRevenueNet, 
      totalTax,
      totalTierDiscounts,
      totalDiscounts,
      purchaseCosts,
      totalExpenses, 
      netProfit, 
      periodBalance: netProfit - periodPaidToPartners,
      currentMonthExpenses, 
      totalFixedCosts,
      temporaryExpenses,
      currentMonthRepairExpenses,
      currentMonthPurchases,
      repairExpenseTotal: ledger.parts,
      activeMonthlyFixedCosts,
      monthlyPayments,
      monthlyCarryoversIn,
      monthlyCarryoversOut
    };
  }, [sessions, sales, repairs, settings, expenses, fixedExpenses, monthlyFixedCosts, payments, purchases, selectedMonth, selectedYear]);

  const lifetimeBalances = useMemo(() => {
    const lifetimeLedger = summarizeFinance({ sessions, sales, repairs, purchases, sharedExpenses: expenses, fixedCosts: monthlyFixedCosts });
    const paidToPartners = (payments || []).filter((payment: any) => payment.type !== 'carryover')
      .reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    return {
      netProfit: lifetimeLedger.profit,
      storeBalance: lifetimeLedger.profit - paidToPartners,
    };
  }, [sessions, sales, repairs, purchases, expenses, monthlyFixedCosts, payments]);

  const expenseListTitle = viewingExpenseList === 'variable'
    ? 'ریز هزینه‌های متغیر'
    : viewingExpenseList === 'repair'
      ? 'ریز هزینه‌های تعمیر'
      : 'ریز هزینه‌های خرید';
  const expenseListItems: any[] = viewingExpenseList === 'variable'
    ? monthlyFinancials.currentMonthExpenses.map(exp => ({ ...exp, kind: 'shared' }))
    : viewingExpenseList === 'repair'
      ? monthlyFinancials.currentMonthRepairExpenses.map(repair => ({
          id: `repair-${repair.id}`,
          repairId: repair.id,
          title: `قطعهٔ پرونده ${repair.trackingCode || repair.deviceModel || 'تعمیر'}`,
          amount: repairPartsExpenseCost(repair),
          date: repairPartsDate(repair),
          kind: 'repair',
        }))
      : viewingExpenseList === 'purchase'
        ? monthlyFinancials.currentMonthPurchases.map(purchase => ({
            id: `purchase-${purchase.id}`,
            title: `خرید کالا: ${purchase.productName || 'محصول'}`,
            amount: money(purchase.totalCost),
            date: purchase.timestamp,
            details: `${formatPersianNumber(money(purchase.quantity))} عدد × ${formatCurrency(money(purchase.costPrice))}`,
            kind: 'purchase',
          }))
        : [];

  const handleSetMonthlyFixedCost = async (fixedExpId: string, amount: number) => {
    if (isNaN(amount)) return;
    const existing = (monthlyFixedCosts || []).find((f: any) => 
      f.fixedExpenseId === fixedExpId && 
      Number(f.month) === Number(selectedMonth) && 
      Number(f.year) === Number(selectedYear)
    );

    if (existing) {
      await update('monthly_fixed_costs', existing.id, { amount });
    } else {
      await add('monthly_fixed_costs', {
        fixedExpenseId: fixedExpId,
        month: selectedMonth,
        year: selectedYear,
        amount
      });
    }
  };

  const handlePayout = async () => {
    if (!paymentShareholderId || paymentAmount <= 0) return;
    if (payoutType === 'goal' && !selectedGoalId) return;

    const shareholder = shareholdersWithPercentage.find((item: any) => item.id === paymentShareholderId);
    if (!shareholder) return;
    const periodShare = Math.max(0, Math.floor(monthlyFinancials.netProfit * shareholder.percentage / 100));
    const carryoversIn = monthlyFinancials.monthlyCarryoversIn
      .filter((payment: any) => payment.shareholderId === paymentShareholderId)
      .reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    const alreadyPaid = monthlyFinancials.monthlyPayments
      .filter((payment: any) => payment.shareholderId === paymentShareholderId)
      .reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    const alreadyCarried = monthlyFinancials.monthlyCarryoversOut
      .filter((payment: any) => payment.shareholderId === paymentShareholderId)
      .reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    const outstanding = Math.max(0, periodShare + carryoversIn - alreadyPaid - alreadyCarried);
    if (paymentAmount > outstanding) {
      alert('مبلغ واردشده از ماندهٔ قابل تسویه بیشتر است.');
      return;
    }

    try {
      const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
      const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
      await add('shareholder_payments', {
        shareholderId: paymentShareholderId,
        amount: paymentAmount,
        type: payoutType,
        goalId: payoutType === 'goal' ? selectedGoalId : null,
        month: selectedMonth,
        year: selectedYear,
        ...(payoutType === 'carryover' ? { targetMonth: nextMonth, targetYear: nextYear } : {}),
        date: new Date().toISOString()
      });

      setPaymentShareholderId(null);
      setPaymentAmount(0);
      setPayoutType('cash');
      setSelectedGoalId('');
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت پرداخت');
    }
  };

  const totalInvestment = useMemo(() => {
    const { end: periodEndDate } = getJalaliMonthRange(selectedYear, selectedMonth);
    return (shareholders || []).reduce((sum, s) => {
      const shInv = (s.investments || []).reduce((acc, inv) => {
        if (new Date(inv.date) <= periodEndDate) return acc + inv.amount;
        return acc;
      }, 0);
      return sum + shInv;
    }, 0);
  }, [shareholders, selectedMonth, selectedYear]);

  const shareholdersWithPercentage = useMemo(() => {
    if (!shareholders) return [];
    
    const { end: periodEndDate } = getJalaliMonthRange(selectedYear, selectedMonth);

    // 1. Total investment up to the end of this period
    const totalInvInPeriod = (shareholders || []).reduce((sum, s) => {
      const shInv = (s.investments || []).reduce((acc, inv) => {
        if (new Date(inv.date) <= periodEndDate) return acc + inv.amount;
        return acc;
      }, 0);
      return sum + shInv;
    }, 0);

    return shareholders.map(sh => {
      const shInvInPeriod = (sh.investments || []).reduce((acc, inv) => {
        if (new Date(inv.date) <= periodEndDate) return acc + inv.amount;
        return acc;
      }, 0);

      const percentage = totalInvInPeriod > 0 ? (shInvInPeriod / totalInvInPeriod) * 100 : 0;

      return {
        ...sh,
        totalInvestment: shInvInPeriod,
        percentage: percentage,
        periodPercentage: percentage,
        livePercentage: percentage
      };
    }).filter(sh => sh.totalInvestment > 0 || new Date(sh.joinedAt) <= periodEndDate);
  }, [shareholders, selectedMonth, selectedYear]);

  const getShareholderOutstanding = (shareholderId: string, percentage: number) => {
    const periodShare = Math.max(0, Math.floor(monthlyFinancials.netProfit * percentage / 100));
    const carryoversIn = monthlyFinancials.monthlyCarryoversIn
      .filter((payment: any) => payment.shareholderId === shareholderId)
      .reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    const alreadyPaid = monthlyFinancials.monthlyPayments
      .filter((payment: any) => payment.shareholderId === shareholderId)
      .reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    const alreadyCarried = monthlyFinancials.monthlyCarryoversOut
      .filter((payment: any) => payment.shareholderId === shareholderId)
      .reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
    return Math.max(0, periodShare + carryoversIn - alreadyPaid - alreadyCarried);
  };

  const handleSave = async () => {
    if (!newName) return;
    
    if (editingId) {
      await update('shareholders', editingId, {
        name: newName,
      });
    } else {
      const contributionDate = investmentDateToIso(investmentDate);
      if (newInvestment <= 0 || !contributionDate) return;
      await add('shareholders', {
        name: newName,
        investments: [{
          amount: newInvestment,
          date: contributionDate,
          note: investmentNote || 'سرمایه اولیه'
        }],
        joinedAt: contributionDate
      });
    }
    
    setIsAdding(false);
    setEditingId(null);
    setNewName('');
    setNewInvestment(0);
    setInvestmentNote('');
    setInvestmentDate(localDateInput());
  };

  const handleEdit = (sh: any) => {
    setEditingId(sh.id);
    setNewName(sh.name);
    setNewInvestment(sh.totalInvestment || 0);
    setIsAdding(true);
  };

  const handleAddInvestmentToHistory = async (shId: string) => {
    const sh = shareholders?.find(s => s.id === shId);
    const contributionDate = investmentDateToIso(investmentDate);
    if (!sh || newInvestment <= 0 || !contributionDate) return;

    const investments = [...(sh.investments || [])];
    if (editingInvestmentRecord?.shId === shId) {
      const previous = investments[editingInvestmentRecord.index];
      if (!previous) return;
      investments[editingInvestmentRecord.index] = {
        ...previous,
        amount: newInvestment,
        date: contributionDate,
        note: investmentNote.trim() || previous.note || 'تزریق سرمایه نقدی',
      };
    } else {
      investments.push({
        amount: newInvestment,
        date: contributionDate,
        note: investmentNote || 'تزریق سرمایه جدید',
      });
    }

    await update('shareholders', shId, {
      investments
    });
    setEditingInvestmentRecord(null);
    setNewInvestment(0);
    setInvestmentNote('');
    setInvestmentDate(localDateInput());
  };

  const openInvestmentHistory = (shId: string) => {
    setViewingHistoryId(shId);
    setEditingInvestmentRecord(null);
    setNewInvestment(0);
    setInvestmentNote('');
    setInvestmentDate(localDateInput());
  };

  const handleDeleteInvestment = async () => {
    if (!deletingInvestment) return;
    const { shId, index } = deletingInvestment;
    const sh = shareholders?.find(s => s.id === shId);
    if (!sh || !sh.investments) return;
    
    const newInvestments = [...sh.investments];
    newInvestments.splice(index, 1);
    
    await update('shareholders', shId, {
      investments: newInvestments
    });
    if (editingInvestmentRecord?.shId === shId) setEditingInvestmentRecord(null);
    setDeletingInvestment(null);
  };

  const openExpenseEditor = (expense?: SharedExpense) => {
    setEditingExpense(expense || null);
    setExpenseTitle(expense?.title || '');
    setExpenseAmount(expense?.amount || 0);
    if (expense?.date) {
      setExpenseDate(localDateInput(expense.date));
    } else if (selectedYear === currentJalali.year && selectedMonth === currentJalali.month) {
      setExpenseDate(localDateInput());
    } else {
      setExpenseDate('');
    }
    setIsAddingExpense(true);
  };

  const handleAddExpense = async () => {
    if (!expenseTitle.trim() || expenseAmount <= 0 || !expenseDate) return;
    const [year, month, day] = expenseDate.split('-').map(Number);
    const selectedExpenseDate = new Date(year, month - 1, day, 12);
    if (!Number.isFinite(selectedExpenseDate.getTime())) return;
    const { start, end } = getJalaliMonthRange(selectedYear, selectedMonth,
      settings?.[0]?.dayResetHour || 0, settings?.[0]?.dayResetMinute || 0);
    if (selectedExpenseDate < start || selectedExpenseDate > end) {
      alert('تاریخ هزینه باید داخل ماه انتخاب‌شده باشد.');
      return;
    }

    const data = {
      title: expenseTitle.trim(),
      amount: expenseAmount,
      date: selectedExpenseDate.toISOString(),
      year: selectedYear,
      month: selectedMonth
    };
    if (editingExpense) {
      await update('shared_expenses', editingExpense.id, data);
    } else {
      await add('shared_expenses', data);
    }
    setExpenseTitle('');
    setExpenseAmount(0);
    setExpenseDate('');
    setEditingExpense(null);
    setIsAddingExpense(false);
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    
    try {
      await remove('shareholders', id);
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting shareholder:', error);
      alert('خطا در حذف شریک');
    }
  };

  if (shLoading) return <div className="p-10 text-center font-bold">در حال بارگذاری...</div>;

  return (
    <div className="p-6 lg:p-10 space-y-8 font-sans text-right pb-32" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">مدیریت سهام و شرکا</h2>
            <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">توزیع سهم بر اساس سرمایه و هزینه‌ها</p>
          </div>
          
          <div className="flex items-center gap-4">
             <Button 
                onClick={() => {
                  setEditingId(null);
                  setNewName('');
                  setNewInvestment(0);
                  setInvestmentNote('');
                  setInvestmentDate(localDateInput());
                  setIsAdding(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 h-12 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-100"
              >
                <Plus size={20} />
                افزودن شریک جدید
              </Button>

              <SegmentToggle
                options={[
                  { id: 'investment', label: 'سرمایه اولیه', icon: DollarSign },
                  { id: 'revenue', label: 'سهم از درآمد', icon: TrendingUp }
                ]}
                activeId={currentView}
                onChange={(id) => setCurrentView(id as 'investment' | 'revenue')}
                activeColor={currentView === 'investment' ? 'indigo' : 'emerald'}
              />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Calendar size={20} />
             </div>
             <div className="flex items-center gap-3">
                <button 
                   onClick={() => {
                     if (selectedMonth === 0) {
                       setSelectedMonth(11);
                       setSelectedYear(v => v - 1);
                     } else {
                       setSelectedMonth(v => v - 1);
                     }
                   }}
                   className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                   <ChevronRight size={20} />
                </button>
                <span className="text-lg font-black text-gray-900 min-w-[140px] text-center">
                  دوره: {months[selectedMonth]} {formatPersianNumber(selectedYear)}
                </span>
                <button 
                   onClick={() => {
                     if (selectedMonth === 11) {
                       setSelectedMonth(0);
                       setSelectedYear(v => v + 1);
                     } else {
                       setSelectedMonth(v => v + 1);
                     }
                   }}
                   className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                   <ChevronLeft size={20} />
                </button>
             </div>
          </div>
          
          <div className="flex items-center gap-4 px-4 py-2 bg-indigo-50 rounded-2xl border border-indigo-100">
             <Info size={16} className="text-indigo-600" />
             <p className="text-[11px] text-indigo-900 font-bold">تمام محاسبات بر اساس دوره انتخابی بالا انجام می‌شود.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Statistics Cards */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentView === 'revenue' ? (
                  <>
                <Card className="p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-none shadow-xl shadow-emerald-200 overflow-hidden relative group rounded-3xl">
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                      <TrendingUp size={24} />
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-emerald-100 text-[10px] font-bold mb-1 uppercase tracking-wider">موجودی و نقدینگی فعلی مغازه · کل</p>
                        <h3 className="text-3xl font-black">{formatCurrency(Math.floor(lifetimeBalances.storeBalance))}</h3>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-emerald-100 mb-1 opacity-60">سود خالص کل</p>
                        <p className="text-sm font-black">{formatCurrency(Math.floor(lifetimeBalances.netProfit))}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between gap-3">
                      <p className="text-[10px] text-emerald-100 font-bold">ماندهٔ سود دوره‌ای · {months[selectedMonth]} {formatPersianNumber(selectedYear)}</p>
                      <p className="text-sm font-black whitespace-nowrap">{formatCurrency(Math.floor(monthlyFinancials.periodBalance))}</p>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <p className="text-[10px] text-emerald-100 font-medium">برآورد تجمعی بر اساس درآمدها، هزینه‌ها و پرداخت‌های ثبت‌شده</p>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([
                    {
                      id: 'variable' as const,
                      title: 'هزینه‌های متغیر',
                      amount: monthlyFinancials.temporaryExpenses,
                      count: monthlyFinancials.currentMonthExpenses.length,
                      icon: Receipt,
                      color: 'emerald',
                    },
                    {
                      id: 'repair' as const,
                      title: 'هزینهٔ تعمیر',
                      amount: monthlyFinancials.repairExpenseTotal,
                      count: monthlyFinancials.currentMonthRepairExpenses.length,
                      icon: Wrench,
                      color: 'amber',
                    },
                    {
                      id: 'purchase' as const,
                      title: 'هزینهٔ خرید',
                      amount: monthlyFinancials.purchaseCosts,
                      count: monthlyFinancials.currentMonthPurchases.length,
                      icon: ShoppingBag,
                      color: 'rose',
                    },
                  ]).map(item => {
                    const Icon = item.icon;
                    const colorClasses = item.color === 'emerald'
                      ? 'border-emerald-100 hover:border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                      : item.color === 'amber'
                        ? 'border-amber-100 hover:border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                        : 'border-rose-100 hover:border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/40';
                    return (
                      <Card
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setViewingExpenseList(item.id)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') setViewingExpenseList(item.id);
                        }}
                        className={`p-4 bg-white dark:bg-slate-900 border flex items-center justify-between cursor-pointer transition-colors group ${colorClasses}`}
                      >
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold mb-1">{item.title} ({months[selectedMonth]})</p>
                          <p className="text-sm font-black">{formatCurrency(Math.floor(item.amount))}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{formatPersianNumber(item.count)} مورد · برای مشاهده ریز هزینه کلیک کنید</p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses}`}>
                          <Icon size={18} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <Card className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-none shadow-xl shadow-indigo-200 overflow-hidden relative group">
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <p className="text-indigo-100 text-[10px] font-bold mb-1 uppercase tracking-wider">سرمایه ورودی کل</p>
                      <h3 className="text-3xl font-black">{formatCurrency(Math.floor(totalInvestment))}</h3>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-white opacity-40" />
                      <p className="text-[10px] text-indigo-100 font-medium tracking-tight">مجموع سرمایه‌گذاری نقدی شرکا</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-6 bg-indigo-50 dark:bg-slate-900/50 border border-indigo-100 dark:border-slate-800 rounded-3xl flex flex-col justify-center">
                  <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-widest">توزیع سهام</p>
                  <h3 className="text-xl font-black text-indigo-900 dark:text-indigo-200 mb-2">میانگین مالکیت</h3>
                  <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{formatPersianNumber(shareholders?.length ? Math.round(100 / shareholders.length) : 0)}٪</p>
                  <p className="text-[10px] text-indigo-400 font-bold mt-4">بر اساس {formatPersianNumber(shareholders?.length || 0)} نفر شریک اصلی</p>
                </Card>
              </>
            )}
          </div>

          {currentView === 'revenue' && (
            <div className="space-y-8 mt-8">
               {/* Monthly Fixed Costs Listing/Editing */}
               {fixedExpenses && fixedExpenses.length > 0 && (
                 <Card className="p-6 border-indigo-100 dark:border-slate-800 bg-indigo-50/30 dark:bg-slate-900/40">
                    <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200 mb-4 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <Receipt size={16} />
                        ثبت مبلغ هزینه‌های ثابت ({months[selectedMonth]})
                      </span>
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        جمع هزینه: {formatCurrency(Math.floor(monthlyFinancials.totalFixedCosts))}
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {fixedExpenses.map((fe: any) => {
                          const costRecord = monthlyFinancials.activeMonthlyFixedCosts.find((c: any) => c.fixedExpenseId === fe.id);
                          return (
                            <div key={fe.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-850 rounded-xl border border-indigo-100 dark:border-slate-800">
                               <span className="text-xs font-black text-gray-700 dark:text-slate-200">{fe.title}</span>
                               <div className="w-32">
                                  <Input 
                                    className="h-8 text-xs text-left"
                                    type="number"
                                    placeholder="مبلغ..."
                                    value={localFixedCosts[fe.id] ?? (costRecord?.amount || '')}
                                    onChange={(e) => setLocalFixedCosts(prev => ({ ...prev, [fe.id]: e.target.value }))}
                                    onBlur={(e) => {
                                      handleSetMonthlyFixedCost(fe.id, Number(e.target.value));
                                      setLocalFixedCosts(prev => {
                                        const next = { ...prev };
                                        delete next[fe.id];
                                        return next;
                                      });
                                    }}
                                  />
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 </Card>
               )}

            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xl font-black mb-4 flex items-center gap-3">
              <Users className={currentView === 'investment' ? 'text-indigo-600' : 'text-emerald-600'} />
              {currentView === 'investment' ? 'لیست شرکا و جزئیات سرمایه' : 'توزیع سود خالص این ماه'}
            </h3>
            {shareholdersWithPercentage.map((sh, idx) => {
              const incomeShare = Math.floor((monthlyFinancials.totalRevenue * sh.percentage) / 100);
              const expenseShare = Math.floor((monthlyFinancials.totalExpenses * sh.percentage) / 100);
              const carryoverIn = (monthlyFinancials.monthlyCarryoversIn || [])
                .filter((p: any) => p.shareholderId === sh.id)
                .reduce((sum: number, p: any) => sum + money(p.amount), 0);
              const netPayable = Math.max(0, Math.floor(monthlyFinancials.netProfit * sh.percentage / 100)) + carryoverIn;

              const paidThisMonth = (monthlyFinancials.monthlyPayments || [])
                .filter((p: any) => p.shareholderId === sh.id)
                .reduce((sum: number, p: any) => sum + money(p.amount), 0);
              const carriedToNextPeriod = (monthlyFinancials.monthlyCarryoversOut || [])
                .filter((p: any) => p.shareholderId === sh.id)
                .reduce((sum: number, p: any) => sum + money(p.amount), 0);

              const remainingToPay = Math.floor(Math.max(0, netPayable - paidThisMonth - carriedToNextPeriod));
              
              return (
                <Card key={sh.id} className={cn(
                  "p-5 flex items-center justify-between group hover:shadow-md transition-all border-gray-100",
                  currentView === 'revenue' ? "hover:border-emerald-100" : "hover:border-indigo-100"
                )}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length] }}>
                      {sh.name.charAt(0)}
                    </div>
                    <div>
                      <h5 className="font-black text-gray-900">{sh.name}</h5>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-gray-400 font-bold">
                          سهم سود: {formatPersianNumber(Math.round(sh.periodPercentage))}%
                          {sh.livePercentage !== sh.periodPercentage && (
                            <span className="mr-2 text-indigo-400">(سهم جدید: {formatPersianNumber(Math.round(sh.livePercentage))}%)</span>
                          )}
                        </span>
                        {currentView === 'revenue' && paidThisMonth > 0 && (
                          <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md">
                            پرداختی: {formatCurrency(Math.floor(paidThisMonth))}
                          </span>
                        )}
                        {currentView === 'revenue' && carriedToNextPeriod > 0 && (
                          <span className="text-[10px] text-amber-700 font-black bg-amber-50 px-2 py-0.5 rounded-md">
                            منتقل‌شده: {formatCurrency(Math.floor(carriedToNextPeriod))}
                          </span>
                        )}
                        {currentView === 'investment' && (
                           <button 
                             onClick={() => openInvestmentHistory(sh.id)}
                             className="text-[10px] text-indigo-600 font-black bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors"
                           >
                             مشاهده آورده‌ها
                           </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 md:gap-8">
                    <div className="text-left">
                      {currentView === 'investment' ? (
                        <>
                          <p className="text-[10px] text-gray-400 font-bold mb-1">مبلغ کل آورده</p>
                          <p className="text-sm font-black text-gray-700">{formatCurrency(Math.floor(sh.totalInvestment))}</p>
                        </>
                      ) : (
                        <div className="flex items-center gap-6">
                           <div className="text-center hidden md:block">
                            <p className="text-[8px] text-gray-400 font-bold mb-1 uppercase">سهم ناخالص</p>
                            <p className="text-xs font-black text-indigo-400">{formatCurrency(Math.floor(incomeShare))}</p>
                           </div>
                           <div className="text-center hidden md:block">
                            <p className="text-[8px] text-gray-400 font-bold mb-1 uppercase">سهم هزینه</p>
                            <p className="text-xs font-black text-rose-400">{formatCurrency(Math.floor(expenseShare))}</p>
                           </div>
                           <div className="text-left">
                            <p className="text-[10px] text-gray-400 font-bold mb-1">ماندهٔ قابل پرداخت</p>
                            <p className="text-sm font-black text-emerald-600">{formatCurrency(remainingToPay)}</p>
                           </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {currentView === 'revenue' && remainingToPay > 0 && (
                        <Button 
                          onClick={() => {
                            setPaymentShareholderId(sh.id);
                            setPaymentAmount(remainingToPay);
                            setPayoutType('cash');
                            setSelectedGoalId('');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-3 h-8 rounded-lg font-black"
                        >
                          پرداخت سود
                        </Button>
                      )}
                      {currentView === 'investment' && (
                        <Button 
                          onClick={() => openInvestmentHistory(sh.id)}
                          variant="outline" 
                          className="w-10 h-10 p-0 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border-transparent hover:border-indigo-100 transition-colors"
                        >
                          <Receipt size={18} />
                        </Button>
                      )}
                      <Button 
                        onClick={() => handleEdit(sh)}
                        variant="outline" 
                        className="w-10 h-10 p-0 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border-transparent hover:border-indigo-100 transition-colors"
                      >
                        <Edit2 size={18} />
                      </Button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingId(sh.id);
                        }}
                        className="w-10 h-10 flex items-center justify-center text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-colors"
                        title="حذف شریک"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
            
            {(!shareholders || shareholders.length === 0) && (
              <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <Users size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-400 font-black">هنوز شریکی برای کلوپ ثبت نشده است.</p>
              </div>
            )}
          </div>
        </div>

        {/* Chart Column */}
        <div className="space-y-6">
          <Card className="p-8 h-full flex flex-col items-center">
            <h3 className="font-black text-gray-900 mb-8 w-full">نمودار توزیع مالکیت</h3>
            <div className="w-full h-[300px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={shareholdersWithPercentage}
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="percentage"
                    nameKey="name"
                  >
                    {shareholdersWithPercentage.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-8 space-y-3 w-full bg-indigo-50 p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon size={18} className="text-indigo-600" />
                <span className="text-sm font-black text-indigo-900">جزئیات فنی</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-indigo-700">
                <span>تعداد کل شرکا:</span>
                <span>{formatPersianNumber(shareholders?.length || 0)} نفر</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Payout Modal */}
        {paymentShareholderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md"
            >
                <Card className="p-8 shadow-2xl relative overflow-hidden dark:bg-slate-800 border-none rounded-[3rem]">
                   <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-50 dark:bg-emerald-900/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                   <h3 className="text-2xl font-black mb-8 text-gray-900 dark:text-white flex items-center gap-3 relative z-10">
                      <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                        <TrendingUp size={24} />
                      </div>
                      تسویه درآمد شریک
                   </h3>
                   
                   <div className="space-y-6 relative z-10">
                      <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800">
                         <p className="text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">نام شریک تجاری</p>
                         <p className="text-xl font-black text-gray-900 dark:text-white">{shareholders?.find(s => s.id === paymentShareholderId)?.name}</p>
                      </div>

                      <div className="grid grid-cols-3 bg-gray-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1">
                         <button 
                           onClick={() => setPayoutType('cash')}
                           className={cn(
                             "flex-1 py-3 text-[11px] font-black rounded-xl transition-all",
                             payoutType === 'cash' ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-sm" : "text-gray-400"
                           )}
                         >تسویه نقدی</button>
                         <button 
                           onClick={() => setPayoutType('goal')}
                           className={cn(
                             "flex-1 py-3 text-[11px] font-black rounded-xl transition-all",
                             payoutType === 'goal' ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm" : "text-gray-400"
                           )}
                         >واریز به هدف</button>
                         <button
                           onClick={() => setPayoutType('carryover')}
                           className={cn(
                             "py-3 text-[10px] font-black rounded-xl transition-all",
                             payoutType === 'carryover' ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm" : "text-gray-400"
                           )}
                         >انتقال به دوره بعد</button>
                      </div>

                      {payoutType === 'goal' && (
                        <div className="space-y-2">
                           <label className="block text-[10px] font-black text-gray-400 mr-2 uppercase">انتخاب هدف مالی جهت افزایش بودجه</label>
                           <select 
                             className="w-full h-14 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl px-5 text-sm font-black dark:text-white appearance-none cursor-pointer"
                             value={selectedGoalId}
                             onChange={e => setSelectedGoalId(e.target.value)}
                           >
                             <option value="">-- یکی از اهداف را انتخاب کنید --</option>
                             {goals?.map((g: any) => (
                               <option key={g.id} value={g.id}>{g.title} ({formatPersianNumber(Math.round((g.currentAmount/g.targetAmount)*100))}٪ تکمیل شده)</option>
                             ))}
                           </select>
                        </div>
                      )}

                      {payoutType === 'carryover' && (
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-xs font-bold text-amber-700 dark:text-amber-300">
                          این مبلغ به‌عنوان طلب شریک به دورهٔ بعد منتقل می‌شود و پرداخت نقدی محسوب نمی‌شود.
                        </div>
                      )}

                      <div className="space-y-3">
                       <div className="flex justify-between items-center px-1">
                         <label className="block text-[11px] font-black text-gray-400 uppercase">{payoutType === 'carryover' ? 'مبلغ انتقال (تومان)' : 'مبلغ تسویه نهایی (تومان)'}</label>
                         <button 
                           onClick={() => {
                             const sh = shareholdersWithPercentage.find(s => s.id === paymentShareholderId);
                             if (sh) setPaymentAmount(getShareholderOutstanding(sh.id, sh.percentage));
                           }}
                           className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                         >{payoutType === 'carryover' ? 'انتقال تمام مانده' : 'تسویه تمام مانده'}</button>
                       </div>
                       <Input 
                         type="number"
                         placeholder="مبلغ را اینجا وارد کنید..."
                         className="h-16 text-center text-2xl font-black bg-white dark:bg-slate-900 rounded-3xl border-2 border-gray-100 focus:border-emerald-500 transition-all font-mono"
                         value={paymentAmount || ''}
                         onChange={e => setPaymentAmount(Number(e.target.value))}
                       />
                     </div>

                     <div className="grid grid-cols-2 gap-4 mt-10">
                       <Button 
                         onClick={handlePayout}
                         className="text-white font-black h-14 rounded-2xl shadow-xl bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 dark:shadow-none transition-all active:scale-95"
                       >
                         {payoutType === 'carryover' ? 'انتقال به دوره بعد' : 'تایید و ثبت سیستم'}
                       </Button>
                       <Button 
                         onClick={() => setPaymentShareholderId(null)}
                         variant="outline"
                         className="h-14 rounded-2xl font-black border-2 border-gray-100 text-gray-500"
                       >
                         انصراف
                       </Button>
                     </div>
                   </div>
                </Card>
            </motion.div>
          </div>
        )}

        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md"
            >
              <Card className="p-8 shadow-2xl">
                <h3 className="text-xl font-black mb-6 text-indigo-900">{editingId ? 'ویرایش اطلاعات شریک' : 'افزودن شریک جدید'}</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-2">نام و نام خانوادگی</label>
                    <Input 
                      placeholder="نام شریک را وارد کنید"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                    />
                  </div>
                  {!editingId && (
                    <div>
                      <label className="block text-sm font-bold text-gray-500 mb-2">مبلغ سرمایه‌گذاری اولیه (تومان)</label>
                      <Input 
                        type="number"
                        placeholder="مبلغ را وارد کنید"
                        value={newInvestment || ''}
                        onChange={e => setNewInvestment(Number(e.target.value))}
                      />
                    </div>
                  )}
                  {!editingId && (
                    <div>
                      <label className="block text-sm font-bold text-gray-500 mb-2">توضیح کوتاه (نام آورده)</label>
                      <Input 
                        placeholder="مثلاً: بابت خرید سیستم جدید"
                        value={investmentNote}
                        onChange={e => setInvestmentNote(e.target.value)}
                      />
                    </div>
                  )}
                  {!editingId && (
                    <div>
                      <label className="block text-sm font-bold text-gray-500 mb-2">تاریخ آورده اولیه</label>
                      <Input
                        type="date"
                        required
                        value={investmentDate}
                        onChange={e => setInvestmentDate(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={handleSave}
                      className="bg-indigo-600 text-white font-black h-12 rounded-xl"
                    >
                      {editingId ? 'بروزرسانی' : 'تایید و ثبت'}
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsAdding(false);
                        setEditingId(null);
                        setInvestmentDate(localDateInput());
                      }}
                      variant="outline"
                      className="h-12 rounded-xl"
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {viewingExpenseList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-2xl"
            >
              <Card className="max-h-[85vh] flex flex-col p-6 bg-white dark:bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">{expenseListTitle} ({months[selectedMonth]})</h3>
                    <p className="text-xs text-gray-400 mt-1">{formatPersianNumber(expenseListItems.length)} مورد</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {viewingExpenseList === 'variable' && (
                      <Button onClick={() => openExpenseEditor()} className="h-10 px-4 rounded-xl bg-emerald-600 text-white">
                        <Plus size={16} /> افزودن هزینه
                      </Button>
                    )}
                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" onClick={() => setViewingExpenseList(null)}>×</Button>
                  </div>
                </div>
                <div className="overflow-y-auto space-y-3 pr-1">
                  {expenseListItems.length === 0 ? (
                    <div className="py-12 text-center text-sm font-bold text-gray-400">برای این دسته در ماه انتخاب‌شده هزینه‌ای ثبت نشده است.</div>
                  ) : [...expenseListItems]
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</p>
                          <p className="text-[10px] text-gray-400 mt-1">تاریخ: {formatPersianNumber(new Date(item.date).toLocaleDateString('fa-IR'))}</p>
                          {item.details && <p className="text-[10px] text-gray-400 mt-1">{item.details}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-black text-rose-600 text-sm">{formatCurrency(item.amount)}</span>
                          {item.kind === 'repair' && (
                            <Link to={`/repairs?edit=${encodeURIComponent(item.repairId)}`} className="text-gray-400 hover:text-indigo-600" title="مشاهده پرونده تعمیر">
                              <Edit2 size={15} />
                            </Link>
                          )}
                          {item.kind === 'shared' && (
                            <>
                              <button onClick={() => openExpenseEditor(item)} className="text-gray-400 hover:text-indigo-600" title="ویرایش هزینه">
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('آیا از حذف این هزینه مشترک مطمئن هستید؟')) remove('shared_expenses', item.id);
                                }}
                                className="text-gray-300 hover:text-rose-500"
                                title="حذف هزینه"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {isAddingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md"
            >
              <Card className="p-8 shadow-2xl">
                <h3 className="text-xl font-black mb-6 text-rose-900">{editingExpense ? 'ویرایش هزینه مشترک' : 'ثبت هزینه مشترک'}</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-2">عنوان هزینه</label>
                    <Input 
                      placeholder="مثلاً: قبوض، اجاره، تعمیرات"
                      value={expenseTitle}
                      onChange={e => setExpenseTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-2">مبلغ (تومان)</label>
                    <Input 
                      type="number"
                      placeholder="مبلغ را وارد کنید"
                      value={expenseAmount || ''}
                      onChange={e => setExpenseAmount(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-2">تاریخ هزینه</label>
                    <Input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={e => setExpenseDate(e.target.value)}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">تاریخ باید در ماه انتخاب‌شده باشد.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={handleAddExpense}
                      className="bg-rose-600 text-white font-black h-12 rounded-xl"
                    >
                      {editingExpense ? 'ذخیره تغییرات' : 'ثبت هزینه'}
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsAddingExpense(false);
                        setEditingExpense(null);
                        setExpenseTitle('');
                        setExpenseAmount(0);
                        setExpenseDate('');
                      }}
                      variant="outline"
                      className="h-12 rounded-xl"
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {viewingHistoryId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-2xl"
            >
               <Card className="shadow-2xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 rounded-[3.5rem] bg-white dark:bg-slate-900 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
                 <div className="px-8 pt-8 flex justify-between items-center mb-8">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-gray-900">
                          تاریخچه آورده‌های {shareholders?.find(s => s.id === viewingHistoryId)?.name}
                        </h3>
                        <p className="text-xs font-bold text-gray-400 tracking-tight">مشاهده و مدیریت تمام سرمایه‌های تزریق شده توسط این شریک</p>
                      </div>
                   </div>
                   <Button variant="ghost" className="w-10 h-10 p-0 rounded-full hover:bg-gray-100" onClick={() => { setViewingHistoryId(null); setEditingInvestmentRecord(null); }}>×</Button>
                 </div>

                 <div className="flex-1 overflow-y-auto px-8 pr-1 space-y-4 mb-6 custom-scrollbar min-h-0">
                   {shareholders?.find(s => s.id === viewingHistoryId)?.investments?.map((inv, idx) => (
                     <motion.div 
                       key={idx}
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: idx * 0.05 }}
                       className="flex items-center justify-between p-5 bg-gray-50/50 rounded-[2rem] border border-gray-100 group hover:bg-white hover:shadow-md transition-all"
                     >
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                           <DollarSign size={18} />
                         </div>
                         <div>
                           <p className="font-black text-gray-900 text-md mb-0.5">{inv.note || 'تزریق سرمایه نقدی'}</p>
                           <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                           <Calendar size={10} />
                           <span>{formatPersianNumber(new Date(inv.date).toLocaleString('fa-IR', { day: '2-digit', month: 'long', year: 'numeric' }))}</span>
                           </div>
                         </div>
                       </div>
                       <div className="flex items-center gap-2 sm:gap-4">
                         <p className="font-black text-emerald-600 text-lg font-mono">{formatCurrency(Math.floor(inv.amount))}</p>
                         <button
                           onClick={() => {
                             setEditingInvestmentRecord({ shId: viewingHistoryId!, index: idx });
                             setNewInvestment(inv.amount);
                             setInvestmentNote(inv.note || '');
                             setInvestmentDate(localDateInput(inv.date));
                           }}
                           className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all bg-white rounded-xl shadow-sm border border-gray-100"
                           title="ویرایش آورده"
                         >
                           <Edit2 size={15} />
                         </button>
                         <button 
                           onClick={() => setDeletingInvestment({ shId: viewingHistoryId!, index: idx })}
                           className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-rose-500 transition-all bg-white rounded-xl shadow-sm border border-gray-100"
                           title="حذف رکورد"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </motion.div>
                   ))}
                   {(!shareholders?.find(s => s.id === viewingHistoryId)?.investments || shareholders?.find(s => s.id === viewingHistoryId)?.investments?.length === 0) && (
                     <div className="text-center py-20 text-gray-300 font-black bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                       <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                          <DollarSign size={32} />
                       </div>
                       هیچ سابقه‌ای برای این شریک یافت نشد.
                     </div>
                   )}
                 </div>

                 <div className="flex-none p-8 bg-gray-50 dark:bg-slate-900/50 rounded-t-[2.5rem] border-t border-gray-100">
                   <h4 className="text-md font-black mb-4 flex items-center gap-2 text-indigo-600">
                     <Plus className="bg-indigo-600 text-white p-1 rounded-lg" size={20} />
                     {editingInvestmentRecord ? 'ویرایش آورده' : 'افزودن آورده جدید'}
                   </h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase mr-3">مبلغ (تومان)</label>
                        <Input 
                          type="number" 
                          placeholder="مثلاً: ۵۰۰,۰۰۰" 
                          className="h-12 bg-white border-gray-100 text-center font-black rounded-xl"
                          value={newInvestment || ''}
                          onChange={e => setNewInvestment(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase mr-3">توضیحات</label>
                        <Input 
                          placeholder="علت تزریق سرمایه..." 
                          className="h-12 bg-white border-gray-100 font-bold rounded-xl pr-4"
                          value={investmentNote}
                          onChange={e => setInvestmentNote(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase mr-3">تاریخ آورده</label>
                        <Input
                          type="date"
                          required
                          className="h-12 bg-white border-gray-100 font-bold rounded-xl"
                          value={investmentDate}
                          onChange={e => setInvestmentDate(e.target.value)}
                        />
                      </div>
                   </div>
                   <div className={editingInvestmentRecord ? 'grid grid-cols-2 gap-3' : ''}>
                     <Button 
                       onClick={() => handleAddInvestmentToHistory(viewingHistoryId)}
                       className="bg-indigo-600 text-white hover:bg-indigo-700 font-black w-full h-12 rounded-xl shadow-md transition-all active:scale-[0.98]"
                     >
                       {editingInvestmentRecord ? 'ذخیره ویرایش' : 'ثبت نهایی آورده'}
                     </Button>
                     {editingInvestmentRecord && (
                       <Button
                         variant="outline"
                         onClick={() => {
                           setEditingInvestmentRecord(null);
                           setNewInvestment(0);
                           setInvestmentNote('');
                           setInvestmentDate(localDateInput());
                         }}
                         className="w-full h-12 rounded-xl"
                       >
                         انصراف از ویرایش
                       </Button>
                     )}
                   </div>
                 </div>
               </Card>
            </motion.div>
          </div>
        )}

        {deletingInvestment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="w-full max-w-sm"
            >
              <Card className="p-8 shadow-2xl border-none">
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black mb-2 text-gray-900 text-center">حذف آورده</h3>
                <p className="text-sm text-gray-500 font-medium text-center mb-8 leading-relaxed">
                  آیا از حذف این مورد سرمایه ورودی (آورده) مطمئن هستید؟
                </p>
                
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleDeleteInvestment}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-black h-12 rounded-xl text-md shadow-lg shadow-rose-100"
                  >
                    بله، حذف کن
                  </Button>
                  <Button 
                    onClick={() => setDeletingInvestment(null)}
                    variant="ghost"
                    className="h-12 rounded-xl text-gray-500 font-bold hover:bg-gray-50"
                  >
                    انصراف
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {deletingId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="w-full max-w-sm"
            >
              <Card className="p-8 shadow-2xl border-none">
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black mb-2 text-gray-900 text-center">حذف دائمی شریک</h3>
                <p className="text-sm text-gray-500 font-medium text-center mb-8 leading-relaxed">
                  آیا از حذف <span className="text-gray-900 font-bold">{shareholders?.find(s => s.id === deletingId)?.name}</span> و تمام سوابق آورده او مطمئن هستید؟ این عملیات غیرقابل بازگشت است.
                </p>
                
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => handleDelete(deletingId)}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-black h-12 rounded-xl text-md shadow-lg shadow-rose-100"
                  >
                    بله، حذف کن
                  </Button>
                  <Button 
                    onClick={() => setDeletingId(null)}
                    variant="ghost"
                    className="h-12 rounded-xl text-gray-500 font-bold hover:bg-gray-50"
                  >
                    انصراف
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
