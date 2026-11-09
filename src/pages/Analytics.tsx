import { summarizeFinance, sessionAmounts, saleAmounts, repairPaid, repairReceipts, repairDate, repairPartsExpenseCost, repairPartsDate, sessionDate, customerSessionDate, isRevenueSale, clientSessionShare, money, inPeriod } from '../lib/finance';
import { clientActivityMonthKey, dailyClientActivityBuckets } from '../lib/clientActivity';
import React, { useMemo, useState } from 'react';
import { useCollection } from '../hooks/useFirestore';
import { Console, Product, Session, AppUser, SystemSettings, RepairItem } from '../types';
import { Card, Button, SegmentToggle, Badge } from '../components/ui/common';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  formatCurrency, 
  formatPersianNumber, 
  formatPersianDigits,
  cn 
} from '../lib/utils';
import { 
  getOperationalDayKey,
  formatJalali, 
  getJalaliMonthRange,
  getCurrentJalaliDate,
  getJalaliMonthName,
  localDateInput
} from '../lib/dateUtils';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Gamepad2, 
  ShoppingCart, 
  Clock, 
  Download,
  Filter,
  ArrowUpRight,
  Monitor,
  Receipt,
  Users,
  Wallet,
  ArrowDownIcon,
  Briefcase,
  PieChart as PieChartIcon,
  Search,
  Award,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Analytics() {
  const { data: settingsList } = useCollection<SystemSettings>('settings');
  const { data: consoles } = useCollection<Console>('consoles');
  const { data: products } = useCollection<Product>('products');
  const { data: clients } = useCollection<AppUser>('clients');
  const { data: sessions } = useCollection<Session>('sessions');
  const { data: sales } = useCollection<any>('sales');
  const { data: repairs } = useCollection<RepairItem>('repairs');
  const { data: purchases } = useCollection<any>('purchases');
  const { data: fixedCosts } = useCollection<any>('monthly_fixed_costs');
  const { data: sharedExpenses } = useCollection<any>('shared_expenses');
  const { data: shareholders } = useCollection<any>('shareholders');
  const { data: payments } = useCollection<any>('shareholder_payments');
  const { data: tiers } = useCollection<any>('client_tiers');

  const initialJalaliDate = getCurrentJalaliDate();
  const initialJalaliMonthRange = getJalaliMonthRange(
    initialJalaliDate.year,
    initialJalaliDate.month,
    settingsList?.[0]?.dayResetHour ?? 0,
    settingsList?.[0]?.dayResetMinute ?? 0
  );
  const [analyticsMode, setAnalyticsMode] = useState<'period' | 'all'>('all');
  const [periodMonth, setPeriodMonth] = useState(() => ({
    year: initialJalaliDate.year,
    month: initialJalaliDate.month,
  }));
  const [periodStartInput, setPeriodStartInput] = useState(() => localDateInput(initialJalaliMonthRange.start));
  const [periodEndInput, setPeriodEndInput] = useState(() => localDateInput(initialJalaliMonthRange.end));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientChartMonth, setSelectedClientChartMonth] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<'performance' | 'shareholders'>('performance');

  const dayResetHour = settingsList?.[0]?.dayResetHour ?? 0;
  const dayResetMinute = settingsList?.[0]?.dayResetMinute ?? 0;
  const currentClientMonthKey = `${initialJalaliDate.year}/${String(initialJalaliDate.month + 1).padStart(2, '0')}`;

  const shiftPeriodMonth = (delta: number) => {
    let year = periodMonth.year;
    let month = periodMonth.month + delta;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    const nextMonth = { year, month };
    const range = getJalaliMonthRange(year, month, dayResetHour, dayResetMinute);
    setPeriodMonth(nextMonth);
    setPeriodStartInput(localDateInput(range.start));
    setPeriodEndInput(localDateInput(range.end));
  };

  const periodBounds = useMemo(() => {
    if (analyticsMode === 'all') return { start: undefined, end: undefined, valid: true };
    const parseDate = (value: string, isEnd: boolean) => {
      const [year, month, day] = value.split('-').map(Number);
      if (!year || !month || !day) return undefined;
      return isEnd
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);
    };
    const start = parseDate(periodStartInput, false);
    const end = parseDate(periodEndInput, true);
    return { start, end, valid: !!start && !!end && start <= end };
  }, [analyticsMode, periodStartInput, periodEndInput]);

  const isWithinAnalyticsPeriod = (date: any) => analyticsMode === 'all'
    || (!!periodBounds.valid && inPeriod(date, periodBounds.start, periodBounds.end));
  const selectedPeriodLabel = analyticsMode === 'all'
    ? 'کل تاریخچه'
    : periodBounds.valid
      ? `${formatJalali(periodBounds.start!, 'yyyy/MM/dd')} تا ${formatJalali(periodBounds.end!, 'yyyy/MM/dd')}`
      : 'بازهٔ تاریخ نامعتبر';

  const completedSessions = useMemo(() => (sessions || []).filter(s => s.status === 'completed'), [sessions]);
  const periodSessions = useMemo(
    () => completedSessions.filter(session => isWithinAnalyticsPeriod(sessionDate(session))),
    [completedSessions, analyticsMode, periodBounds]
  );
  // Customer visits are dated by when play started, not when the session was
  // checked out. This keeps overnight/long sessions on the actual visit day.
  const clientPeriodSessions = useMemo(
    () => completedSessions.filter(session => isWithinAnalyticsPeriod(customerSessionDate(session))),
    [completedSessions, analyticsMode, periodBounds]
  );
  const periodSales = useMemo(
    () => (sales || []).filter((sale: any) => isRevenueSale(sale) && isWithinAnalyticsPeriod(sale.timestamp)),
    [sales, analyticsMode, periodBounds]
  );
  const periodPurchases = useMemo(
    () => (purchases || []).filter((purchase: any) => isWithinAnalyticsPeriod(purchase.timestamp)),
    [purchases, analyticsMode, periodBounds]
  );
  const periodRepairs = useMemo(
    () => {
      if (analyticsMode === 'all') return repairs || [];
      if (!periodBounds.valid) return [];
      return (repairs || []).filter((repair: any) => isWithinAnalyticsPeriod(repairDate(repair))
        || repairPaid(repair, periodBounds.start, periodBounds.end) > 0
        || isWithinAnalyticsPeriod(repairPartsDate(repair)));
    },
    [repairs, analyticsMode, periodBounds]
  );

  const clientChartMonthOptions = useMemo(() => {
    const activityMonths = new Set<string>();
    const currentMonthOrdinal = initialJalaliDate.year * 12 + initialJalaliDate.month + 1;
    const addMonth = (dateValue: any) => {
      if (!dateValue) return;
      const key = clientActivityMonthKey(dateValue);
      if (!key) return;
      const [year, month] = key.split('/').map(Number);
      if (year * 12 + month <= currentMonthOrdinal) activityMonths.add(key);
    };

    if (selectedClientId) {
      completedSessions.forEach(session => {
        const ids = session.userIds?.length ? session.userIds : [session.userId];
        if (ids.includes(selectedClientId)) addMonth(customerSessionDate(session));
      });
      (sales || []).forEach((sale: any) => {
        if (isRevenueSale(sale) && (sale.userId || sale.clientId) === selectedClientId) addMonth(sale.timestamp);
      });
      (repairs || []).forEach((repair: any) => {
        if (repair.clientId === selectedClientId) repairReceipts(repair).forEach(receipt => addMonth(receipt.date));
      });
    }

    const keys = [...new Set([...activityMonths, currentClientMonthKey])];
    const monthOrdinal = (key: string) => {
      const [year, month] = key.split('/').map(Number);
      return year * 12 + month;
    };
    return keys.sort((a, b) => monthOrdinal(b) - monthOrdinal(a)).map(key => {
      const [year, month] = key.split('/').map(Number);
      return {
        key,
        hasActivity: activityMonths.has(key),
        label: `${getJalaliMonthName(month - 1)} ${formatPersianDigits(year)}`,
      };
    });
  }, [selectedClientId, completedSessions, sales, repairs, currentClientMonthKey]);

  const selectedClientChartMonthKey = clientChartMonthOptions.some(option => option.key === selectedClientChartMonth)
    ? selectedClientChartMonth!
    : clientChartMonthOptions.find(option => option.hasActivity)?.key || currentClientMonthKey;
  const selectedClientChartMonthRange = useMemo(() => {
    const [year, month] = selectedClientChartMonthKey.split('/').map(Number);
    return getJalaliMonthRange(year, month - 1);
  }, [selectedClientChartMonthKey]);

  // --- Debtors Statistics (Negative Wallet Balances) ---
  const debtorStats = useMemo(() => {
    if (!clients) return { count: 0, totalDebt: 0 };
    const debtors = clients.filter(c => (Number(c.balance) || 0) < 0);
    const totalDebt = debtors.reduce((sum, c) => sum + Math.abs(Number(c.balance) || 0), 0);
    return { count: debtors.length, totalDebt };
  }, [clients]);

  // --- 0. Customer Performance Analysis ---
  const clientPerformance = useMemo(() => {
    if (!clients || !sessions || !sales || !periodBounds.valid) return [];

    const stats: Record<string, { id: string, name: string, visitCount: number, totalSpend: number, lastVisit: string | null, repairsCount: number }> = {};

    clients.forEach(c => {
      stats[c.id] = { id: c.id, name: c.name, visitCount: 0, totalSpend: 0, lastVisit: null, repairsCount: 0 };
    });

    clientPeriodSessions.forEach(s => {
      for (const uid of s.userIds?.length ? s.userIds : [s.userId]) {
        if (!uid || !stats[uid]) continue;
        stats[uid].visitCount++; stats[uid].totalSpend += clientSessionShare(s, uid);
        const visitDate = customerSessionDate(s);
        if (!stats[uid].lastVisit || new Date(visitDate) > new Date(stats[uid].lastVisit!)) stats[uid].lastVisit = visitDate;
      }
    });

    periodSales.forEach((sale: any) => {
      const uId = sale.userId || sale.clientId;
      if (isRevenueSale(sale) && uId && stats[uId]) {
        stats[uId].totalSpend += (sale.totalAmount || 0);
        if (!stats[uId].lastVisit || new Date(sale.timestamp) > new Date(stats[uId].lastVisit!)) {
           stats[uId].lastVisit = sale.timestamp;
        }
      }
    });

    periodRepairs.forEach((r: any) => {
      const uId = r.clientId;
      if (uId && stats[uId]) {
        const receipts = repairReceipts(r).filter(p => isWithinAnalyticsPeriod(p.date));
        const cost = receipts.reduce((sum, receipt) => sum + money(receipt.amount), 0);
        if (cost <= 0) return;
        stats[uId].totalSpend += cost;
        stats[uId].repairsCount++;
        const d = receipts[receipts.length - 1]?.date || repairDate(r);
        if (d && (!stats[uId].lastVisit || new Date(d) > new Date(stats[uId].lastVisit!))) {
           stats[uId].lastVisit = d;
        }
      }
    });

    return Object.values(stats)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .filter(c => c.totalSpend > 0 || c.visitCount > 0 || c.repairsCount > 0);
  }, [clients, sessions, sales, clientPeriodSessions, periodSales, periodRepairs, periodBounds, analyticsMode]);

  const selectedClientHistory = useMemo(() => {
    if (!selectedClientId) return [];
    const activities: { date: string; amount: number; visits?: number }[] = [];

    completedSessions.forEach(session => {
      const clientIds = session.userIds?.length ? session.userIds : [session.userId];
      if (clientIds.includes(selectedClientId)) activities.push({
        date: customerSessionDate(session),
        amount: clientSessionShare(session, selectedClientId),
        visits: 1,
      });
    });
    (sales || []).forEach((sale: any) => {
      if (isRevenueSale(sale) && (sale.userId || sale.clientId) === selectedClientId) {
        activities.push({ date: sale.timestamp, amount: money(sale.totalAmount) });
      }
    });
    (repairs || []).forEach((repair: any) => {
      if (repair.clientId !== selectedClientId) return;
      repairReceipts(repair).forEach(receipt => activities.push({ date: receipt.date, amount: money(receipt.amount) }));
    });

    return dailyClientActivityBuckets(activities, selectedClientChartMonthRange.start, selectedClientChartMonthRange.end)
      .map(({ order: _order, ...entry }) => entry);
  }, [selectedClientId, completedSessions, sales, repairs, selectedClientChartMonthRange]);

  const selectedClient = useMemo(() => 
    clients?.find(c => c.id === selectedClientId),
  [clients, selectedClientId]);

  // --- 0. Comprehensive Financial Analysis ---
  const financialSummary = useMemo(() => {
    if (!sessions || !sales || !purchases || !fixedCosts || !sharedExpenses || !payments || !periodBounds.valid) return null;

    const calculatePeriodStats = (start?: Date, end?: Date) => {
      const periodFixedCosts = (fixedCosts || []).flatMap((fixed: any) => {
        if (!start || !end) return [fixed];
        const fixedMonth = getJalaliMonthRange(Number(fixed.year), Number(fixed.month), dayResetHour, dayResetMinute);
        const overlapMs = Math.max(0, Math.min(end.getTime(), fixedMonth.end.getTime()) - Math.max(start.getTime(), fixedMonth.start.getTime()) + 1);
        if (overlapMs <= 0) return [];
        const monthDuration = fixedMonth.end.getTime() - fixedMonth.start.getTime() + 1;
        return [{ ...fixed, amount: money(fixed.amount) * Math.min(1, overlapMs / monthDuration) }];
      });
      const ledger = summarizeFinance({ sessions, sales, repairs, purchases, sharedExpenses, fixedCosts: periodFixedCosts, products, start, end });
      const paymentsInPeriod = (payments || []).filter((payment: any) => {
        if (payment.type === 'carryover') return false;
        if (payment.date) return inPeriod(payment.date, start, end);
        if (payment.month == null || payment.year == null) return false;
        const paymentMonth = getJalaliMonthRange(Number(payment.year), Number(payment.month), dayResetHour, dayResetMinute);
        return (!start || paymentMonth.end >= start) && (!end || paymentMonth.start <= end);
      });
      return {
        totalRevenue: ledger.netRevenue, gameGross: ledger.game, buffetGross: ledger.buffet,
        boutiqueGross: ledger.shop, productGross: ledger.buffet + ledger.shop, repairGross: ledger.repair,
        tax: ledger.tax, totalExpenses: ledger.expenses, expPurchases: ledger.purchases,
        expFixed: ledger.fixed, expShared: ledger.shared + ledger.parts, netProfit: ledger.profit,
        paidToPartners: paymentsInPeriod.reduce((sum: number, payment: any) => sum + money(payment.amount), 0),
        sessionCount: ledger.sessions.length, salesCount: ledger.sales.length,
        repairCount: (repairs || []).filter(r => (!start && !end) || inPeriod(repairDate(r), start, end)).length
      };
    };

    const current = calculatePeriodStats(periodBounds.start, periodBounds.end);
    const currentJalaliStr = formatJalali(new Date(), 'yyyy/MM/dd').split('/');
    const currentYear = Number(currentJalaliStr[0]);
    const currentMonth = Number(currentJalaliStr[1]);
    let previous = calculatePeriodStats();

    let growth: number | null = null;
    if (analyticsMode === 'period' && periodBounds.start && periodBounds.end) {
      const periodLength = periodBounds.end.getTime() - periodBounds.start.getTime() + 1;
      const previousEnd = new Date(periodBounds.start.getTime() - 1);
      const previousStart = new Date(previousEnd.getTime() - periodLength + 1);
      previous = calculatePeriodStats(previousStart, previousEnd);
      if (previous.netProfit !== 0) {
        growth = ((current.netProfit - previous.netProfit) / Math.abs(previous.netProfit)) * 100;
      } else if (current.netProfit > 0) {
        growth = 100;
      } else if (current.netProfit < 0) {
        growth = -100;
      } else {
        growth = 0;
      }
    }

    // Yearly History (Last 12 months)
    const yearlyTrend = [];
    for (let i = 11; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const { start, end } = getJalaliMonthRange(y, m - 1, dayResetHour, dayResetMinute);
      const stats = calculatePeriodStats(start, end);
      yearlyTrend.push({
        monthName: `${formatPersianDigits(m.toString())}/${formatPersianDigits(y.toString().slice(2))}`,
        revenue: stats.totalRevenue,
        profit: stats.netProfit,
        expenses: stats.totalExpenses
      });
    }

    return { 
      current, 
      previous, 
      growth,
      yearlyTrend,
      currentYear,
      currentMonth
    };
  }, [sessions, sales, repairs, products, purchases, fixedCosts, sharedExpenses, payments, dayResetHour, dayResetMinute, analyticsMode, periodBounds]);

  const monthlySalesTargetSetting = settingsList && settingsList.length > 0 ? settingsList[0].monthlySalesTarget || 10000000 : 10000000;
  const periodSalesTarget = useMemo(() => {
    if (analyticsMode === 'all' || !periodBounds.valid || !periodBounds.start || !periodBounds.end) return null;
    const [startYear, startMonth] = formatJalali(periodBounds.start, 'yyyy/MM').split('/').map(Number);
    const [endYear, endMonth] = formatJalali(periodBounds.end, 'yyyy/MM').split('/').map(Number);
    let year = startYear;
    let month = startMonth - 1;
    let target = 0;
    let guard = 0;
    while ((year < endYear || (year === endYear && month + 1 <= endMonth)) && guard++ < 1200) {
      const monthRange = getJalaliMonthRange(year, month, dayResetHour, dayResetMinute);
      const overlapMs = Math.max(0, Math.min(periodBounds.end.getTime(), monthRange.end.getTime()) - Math.max(periodBounds.start.getTime(), monthRange.start.getTime()) + 1);
      const monthDuration = monthRange.end.getTime() - monthRange.start.getTime() + 1;
      if (overlapMs > 0 && monthDuration > 0) target += monthlySalesTargetSetting * overlapMs / monthDuration;
      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
    return target;
  }, [analyticsMode, periodBounds, dayResetHour, dayResetMinute, monthlySalesTargetSetting]);
  const targetPercent = periodSalesTarget && periodSalesTarget > 0
    ? Math.min(100, Math.round(((financialSummary?.current.totalRevenue || 0) / periodSalesTarget) * 100))
    : 0;

  // --- 1. Top Performing Products ---
  const productPerformance = useMemo(() => {
    const stats: Record<string, { id: string, name: string, quantity: number, revenue: number, type: 'buffet' | 'sale' }> = {};
    
    periodSales.forEach((sale: any) => {
      (sale.items || []).forEach((item: any) => {
        if (item.id === 'manual_game') return;
        if (!stats[item.productId || item.id || item.name]) stats[item.productId || item.id || item.name] = { id: item.productId || item.id || item.name, name: item.name, quantity: 0, revenue: 0, type: 'sale' };
        stats[item.productId || item.id || item.name].quantity += item.quantity;
        stats[item.productId || item.id || item.name].revenue += (item.price * item.quantity);
      });
    });

    periodSessions.forEach(s => {
      (s.addedItems || []).forEach(item => {
        if (!stats[item.productId || item.id || item.name]) stats[item.productId || item.id || item.name] = { id: item.productId || item.id || item.name, name: item.name, quantity: 0, revenue: 0, type: 'buffet' };
        stats[item.productId || item.id || item.name].quantity += item.quantity;
        stats[item.productId || item.id || item.name].revenue += (item.price * item.quantity);
      });
    });

    return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
  }, [periodSales, periodSessions]);

  // --- 2. Purchase Categories breakdown ---
  const purchaseBreakdown = useMemo(() => {
    const categories: Record<string, number> = {};
    periodPurchases.forEach((p: any) => {
      // Assuming products have category info. We match by productId
      const prod = products?.find(pr => pr.id === p.productId);
      const cat = prod?.category || 'نامشخص';
      categories[cat] = (categories[cat] || 0) + (p.totalCost || 0);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [periodPurchases, products]);

  // --- 1. Revenue Over Time (Daily) ---
  const revenueTrend = useMemo(() => {
    if (analyticsMode === 'period' && !periodBounds.valid) return [];
    const trends: Record<string, { date: string, game: number, buffet: number, repair: number, total: number, order: number }> = {};
    const useMonthlyBuckets = analyticsMode === 'period'
      && !!periodBounds.start && !!periodBounds.end
      && periodBounds.end.getTime() - periodBounds.start.getTime() > 120 * 24 * 60 * 60 * 1000;
    const currentOperationalKey = getOperationalDayKey(new Date(), dayResetHour, dayResetMinute);
    const currentOperationalDay = new Date(currentOperationalKey);
    currentOperationalDay.setHours(0, 0, 0, 0);

    if (analyticsMode === 'all') {
      const transactionDates = [
        ...periodSessions.map(session => sessionDate(session)),
        ...periodSales.map((sale: any) => sale.timestamp),
        ...periodRepairs.flatMap((repair: any) => repairReceipts(repair).map(receipt => receipt.date)),
      ].map(value => new Date(value)).filter(date => Number.isFinite(date.getTime()));
      if (transactionDates.length) {
        const firstTransaction = transactionDates.reduce((first, date) => date < first ? date : first);
        const firstOperationalDay = new Date(getOperationalDayKey(firstTransaction, dayResetHour, dayResetMinute));
        firstOperationalDay.setHours(dayResetHour, dayResetMinute, 0, 0);
        const cursor = new Date(firstOperationalDay);
        const endOfCurrentDay = new Date(currentOperationalKey);
        endOfCurrentDay.setHours(dayResetHour, dayResetMinute, 0, 0);
        while (cursor <= endOfCurrentDay) {
          const key = getOperationalDayKey(cursor, dayResetHour, dayResetMinute);
          trends[key] = {
            date: formatJalali(cursor, 'yyyy/MM/dd'),
            game: 0,
            buffet: 0,
            repair: 0,
            total: 0,
            order: new Date(key).getTime(),
          };
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    } else if (!useMonthlyBuckets && periodBounds.start && periodBounds.end) {
      const cursor = new Date(periodBounds.start);
      cursor.setHours(dayResetHour, dayResetMinute, 0, 0);
      while (cursor <= periodBounds.end) {
        const key = getOperationalDayKey(cursor, dayResetHour, dayResetMinute);
        trends[key] = { date: formatJalali(new Date(key), 'MM/dd'), game: 0, buffet: 0, repair: 0, total: 0, order: new Date(key).getTime() };
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const processDate = (dateStr: string, gameAmt: number, buffetAmt: number, repairAmt = 0) => {
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (!Number.isFinite(date.getTime())) return;
      const operationalKey = getOperationalDayKey(date, dayResetHour, dayResetMinute);
      if (analyticsMode === 'all' && new Date(operationalKey).setHours(0, 0, 0, 0) > currentOperationalDay.getTime()) return;
      const key = useMonthlyBuckets
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : operationalKey;
      const entry = trends[key] || (trends[key] = {
        date: useMonthlyBuckets
          ? formatJalali(date, 'yyyy/MM')
          : formatJalali(new Date(operationalKey), analyticsMode === 'all' ? 'yyyy/MM/dd' : 'MM/dd'),
        game: 0,
        buffet: 0,
        repair: 0,
        total: 0,
        order: useMonthlyBuckets ? new Date(date.getFullYear(), date.getMonth(), 1).getTime() : new Date(operationalKey).getTime(),
      });
      entry.game += gameAmt;
      entry.buffet += buffetAmt;
      entry.repair += repairAmt;
      entry.total += gameAmt + buffetAmt + repairAmt;
    };

    periodSessions.forEach(session => {
      const amounts = sessionAmounts(session);
      processDate(sessionDate(session), amounts.game, amounts.buffet);
    });
    periodSales.forEach((sale: any) => {
      const amounts = saleAmounts(sale, products);
      processDate(sale.timestamp, amounts.game, amounts.buffet + amounts.shop);
    });
    periodRepairs.forEach((repair: any) => repairReceipts(repair)
      .filter(receipt => isWithinAnalyticsPeriod(receipt.date))
      .forEach(receipt => processDate(receipt.date, 0, 0, receipt.amount)));

    return Object.values(trends).sort((a, b) => a.order - b.order).map(({ order: _order, ...entry }) => entry);
  }, [periodSessions, periodSales, periodRepairs, analyticsMode, periodBounds, dayResetHour, dayResetMinute, products]);

  // --- 1.1 Repairs & Hardware Services Performance ---
  const repairPerformance = useMemo(() => {
    if (!repairs) return {
      deviceBreakdown: [], totalRevenue: 0, totalCount: 0, completedCount: 0,
      financialBreakdown: [], invoicedAmount: 0, collectedAmount: 0, receivableAmount: 0
    };
    
    const deviceMap: Record<string, number> = {};
    let totalRevenue = 0;
    let completedCount = 0;
    let partsBilled = 0;
    let partsPurchaseCost = 0;
    let laborAmount = 0;
    let discountAmount = 0;
    let invoicedAmount = 0;
    let receivableAmount = 0;

    periodRepairs.forEach((r: any) => {
      const dev = r.deviceType || 'سایر قطعات';
      const cost = repairPaid(r, periodBounds.start, periodBounds.end);
      if (cost > 0) {
        deviceMap[dev] = (deviceMap[dev] || 0) + cost;
        totalRevenue += cost;
      }
      const repairEnteredInPeriod = isWithinAnalyticsPeriod(repairDate(r));
      if (!repairEnteredInPeriod) {
        if (isWithinAnalyticsPeriod(repairPartsDate(r))) partsPurchaseCost += repairPartsExpenseCost(r);
        return;
      }
      const invoiceTotal = r.totalCost != null
        ? money(r.totalCost)
        : Math.max(0, money(r.partsCost) + money(r.laborCost) - money(r.discount));
      partsBilled += money(r.partsCost);
      if (isWithinAnalyticsPeriod(repairPartsDate(r))) partsPurchaseCost += repairPartsExpenseCost(r);
      laborAmount += money(r.laborCost);
      discountAmount += money(r.discount);
      invoicedAmount += invoiceTotal;
      receivableAmount += Math.max(0, invoiceTotal - cost);
      if (r.status === 'delivered' || r.status === 'ready') {
        completedCount++;
      }
    });

    const deviceLabels: Record<string, string> = {
      console: 'کنسول بازی', controller: 'دسته بازی', vr: 'هدست واقعیت مجازی',
      pc: 'کامپیوتر گیمینگ', accessory: 'لوازم جانبی', game_install: 'نصب بازی', other: 'سایر تجهیزات',
    };
    const deviceBreakdown = Object.entries(deviceMap)
      .map(([name, value]) => ({ name: deviceLabels[name] || name, value }))
      .sort((a, b) => b.value - a.value);

    const totalCount = periodRepairs.filter((repair: any) => isWithinAnalyticsPeriod(repairDate(repair))).length;
    const netProfit = totalRevenue - partsPurchaseCost;

    return {
      deviceBreakdown,
      totalRevenue,
      totalCount,
      completedCount,
      invoicedAmount,
      collectedAmount: totalRevenue,
      receivableAmount,
      financialBreakdown: [
        { name: 'قطعه در فاکتور مشتری', value: partsBilled, color: '#6366f1' },
        { name: 'هزینه واقعی خرید قطعه', value: partsPurchaseCost, color: '#f97316' },
        { name: 'دستمزد خدمات', value: laborAmount, color: '#06b6d4' },
        { name: 'تخفیف', value: discountAmount, color: '#f43f5e' },
        { name: 'سود خالص نقدی', value: netProfit, color: '#10b981' },
      ]
    };
  }, [periodRepairs, periodBounds, analyticsMode]);

  // --- 2. Revenue by Console Type ---
  const consoleRevenue = useMemo(() => {
    if (!consoles) return [];
    const stats: Record<string, number> = {};
    periodSessions.forEach(s => {
      const con = consoles.find(c => c.id === s.consoleId);
      const type = con?.type || 'نامشخص';
      stats[type] = (stats[type] || 0) + (s.totalSessionAmount || 0);
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [consoles, periodSessions]);

  // --- 3. Peak Hours Analysis ---
  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ 
      hour: i, 
      count: 0,
      label: formatPersianDigits(i.toString().padStart(2, '0')) + ':۰۰'
    }));
    
    periodSessions.forEach(s => {
      if (s.startTime) {
        const h = new Date(s.startTime).getHours();
        hours[h].count++;
      }
    });

    return hours;
  }, [periodSessions]);

  // --- 4. Category Performance ---
  const categoryStats = useMemo(() => {
    const stats: Record<string, { name: string, quantity: number, revenue: number }> = {};
    const includedCategories = new Set(['نوشیدنی', 'تنقلات', 'غذا', 'پرینت', 'لوازم جانبی', 'سخت‌افزار', 'لوازم تحریر', 'سایر']);
    // Product ID to Category lookup map
    const prodMap = new Map<string, string>();
    (products || []).forEach((p: any) => {
      if (p.id && p.category) {
        prodMap.set(p.id, p.category);
      }
    });

    const addItem = (item: any) => {
      if (item.id === 'manual_game' || item.productId === 'manual_game') return;
      const cat = String(item.category || (item.productId ? prodMap.get(item.productId) : '') || '').trim();
      // Only catalogued buffet and shop categories belong in this chart.
      if (!includedCategories.has(cat)) return;
      if (!stats[cat]) stats[cat] = { name: cat, quantity: 0, revenue: 0 };
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      stats[cat].quantity += qty;
      stats[cat].revenue += price * qty;
    };

    periodSales.forEach((sale: any) => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      if (items.length > 0) {
        items.forEach(addItem);
      } else if (sale.buffetAmount && Number(sale.buffetAmount) > 0) {
        const cat = 'سایر اقلام بوفه';
        if (!stats[cat]) stats[cat] = { name: cat, quantity: 0, revenue: 0 };
        stats[cat].quantity += 1;
        stats[cat].revenue += Number(sale.buffetAmount);
      }
    });

    periodSessions.forEach(s => {
      (s.addedItems || []).forEach(addItem);
    });

    return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
  }, [periodSales, periodSessions, products]);

  // --- 5. Duration Distribution ---
  const durationStats = useMemo(() => {
    const buckets: Record<string, number> = {
      'زیر ۱ ساعت': 0,
      '۱-۲ ساعت': 0,
      '۲-۴ ساعت': 0,
      'بالای ۴ ساعت': 0,
    };

    periodSessions.forEach(s => {
      if (!s.startTime || !s.endTime) return;
      const duration = (Number(s.duration) || 0) / 3600;
      if (duration < 1) buckets['زیر ۱ ساعت']++;
      else if (duration < 2) buckets['۱-۲ ساعت']++;
      else if (duration < 4) buckets['۲-۴ ساعت']++;
      else buckets['بالای ۴ ساعت']++;
    });

    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [periodSessions]);

  // --- Shareholder & Stock Comprehensive Analytics ---
  const shareholderStats = useMemo(() => {
    if (!shareholders) return [];

    const totalInvestments = (shareholders || []).reduce((sum: number, sh: any) => 
      sum + (sh.investments || []).reduce((acc: number, inv: any) => acc + inv.amount, 0), 0);

    const completedPayments = (payments || []).filter((p: any) => p.type !== 'carryover');
    const totalDividends = completedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return shareholders.map((sh: any) => {
      const personalInvestments = (sh.investments || []).reduce((acc: number, inv: any) => acc + inv.amount, 0);
      const personalDividends = completedPayments.filter((p: any) => p.shareholderId === sh.id).reduce((sum: number, p: any) => sum + p.amount, 0);
      
      const sharePercentage = totalInvestments > 0 ? (personalInvestments / totalInvestments) * 100 : 0;

      // Dividends trend/timeline for this specific shareholder
      const shareholderPayments = completedPayments.filter((p: any) => p.shareholderId === sh.id).map((p: any) => ({
        date: formatJalali(new Date(p.date), 'MM/dd'),
        amount: p.amount,
        type: p.type === 'goal' ? 'هدفمند' : 'نقدی'
      }));

      return {
        id: sh.id,
        name: sh.name,
        totalContributed: personalInvestments,
        totalDividends: personalDividends,
        sharePercentage,
        paymentsCount: shareholderPayments.length,
        paymentsHistory: shareholderPayments
      };
    });
  }, [shareholders, payments]);

  const totalStocksInvestmentSum = useMemo(() => {
    return (shareholders || []).reduce((sum: number, sh: any) => 
      sum + (sh.investments || []).reduce((acc: number, inv: any) => acc + inv.amount, 0), 0);
  }, [shareholders]);

  const totalPaymentsSum = useMemo(() => {
    return (payments || []).filter((p: any) => p.type !== 'carryover').reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  }, [payments]);

  const clubRetainedProfit = useMemo(() => {
    const totalClubNetProfit = summarizeFinance({ sessions, sales, repairs, purchases, sharedExpenses, fixedCosts }).profit;
    return totalClubNetProfit - totalPaymentsSum;
  }, [sessions, sales, repairs, purchases, sharedExpenses, fixedCosts, totalPaymentsSum]);

  // Aggregate monthly/payout dynamic trends for charts
  const payoutAggregateTrend = useMemo(() => {
    const monthsNames = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    
    // Group payments by month index
    const monthlyAllocations: Record<number, number> = {};
    for (let i = 0; i < 12; i++) {
      monthlyAllocations[i] = 0;
    }

    (payments || []).forEach((p: any) => {
      if (p.type === 'carryover') return;
      const monthIdx = Number(p.month || 0);
      if (monthIdx >= 0 && monthIdx < 12) {
        monthlyAllocations[monthIdx] += (p.amount || 0);
      }
    });

    return Object.entries(monthlyAllocations).map(([monthIdx, val]) => ({
      name: monthsNames[Number(monthIdx)],
      payout: val
    }));
  }, [payments]);

  return (
    <div className="p-6 lg:p-10 space-y-8 font-sans text-right pb-32" dir="rtl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-2">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">آمار و عملکرد هوشمند</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">تحلیل داده‌های درآمدی، فروش و سهام‌داران کلوپ</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-wrap animate-fade-in">
          {activeSegment === 'performance' && (
            <div className="space-y-2">
              <div className="bg-gray-50 dark:bg-slate-800 p-1 rounded-2xl flex gap-1 border border-gray-100/50 dark:border-slate-700/50">
                <button
                  onClick={() => setAnalyticsMode('period')}
                  className={cn("px-4 h-9 text-xs font-extrabold rounded-xl transition-all", analyticsMode === 'period' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100/30" : "text-gray-400 hover:bg-gray-100/50 dark:hover:bg-slate-700 dark:text-gray-300")}
                >دوره‌ای</button>
                <button
                  onClick={() => setAnalyticsMode('all')}
                  className={cn("px-4 h-9 text-xs font-extrabold rounded-xl transition-all", analyticsMode === 'all' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100/30" : "text-gray-400 hover:bg-gray-100/50 dark:hover:bg-slate-700 dark:text-gray-300")}
                >آمار کل</button>
              </div>
              {analyticsMode === 'period' && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 dark:border-slate-700 px-2 py-1.5">
                  <button
                    type="button"
                    aria-label="ماه قبل"
                    title="ماه قبل"
                    onClick={() => shiftPeriodMonth(-1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span className="min-w-28 text-center text-xs font-black text-gray-700 dark:text-gray-200">
                    {formatJalali(getJalaliMonthRange(periodMonth.year, periodMonth.month).start, 'MMMM yyyy')}
                  </span>
                  <button
                    type="button"
                    aria-label="ماه بعد"
                    title="ماه بعد"
                    onClick={() => shiftPeriodMonth(1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          <SegmentToggle<'performance' | 'shareholders'>
            options={[
              { id: 'performance', label: 'آمار و عملکرد کلوپ', icon: BarChart },
              { id: 'shareholders', label: 'تحلیل سهام و شرکا', icon: Users }
            ]}
            activeId={activeSegment}
            onChange={setActiveSegment}
            activeColor="indigo"
          />
        </div>
      </div>

      {activeSegment === 'performance' ? (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
             <Card className="p-6 border-none shadow-sm bg-white dark:bg-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 opacity-50" />
            <div className="flex items-center gap-4 mb-4">
               <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <TrendingUp size={20} />
               </div>
               <p className="text-xs font-black text-gray-400">سود خالص ({selectedPeriodLabel})</p>
            </div>
            <div className="flex items-end justify-between">
               <h3 className="text-2xl font-black text-gray-900">{formatCurrency(financialSummary?.current.netProfit || 0)}</h3>
               {financialSummary?.growth == null ? (
                 <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">آمار کل</span>
               ) : (
                 <div className={cn(
                   "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black",
                   financialSummary.growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                 )}>
                   {financialSummary.growth >= 0 ? <ArrowUpRight size={12} /> : <TrendingDown size={12} />}
                   {formatPersianNumber(Math.abs(Math.round(financialSummary.growth)))}٪
                 </div>
               )}
            </div>
         </Card>
         
         <Card className="p-6 border-none shadow-sm bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-12 -mt-12 opacity-50" />
            <div className="flex items-center gap-4 mb-4">
               <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <ArrowDownIcon size={20} />
               </div>
               <p className="text-xs font-black text-gray-400">هزینه‌های دوره</p>
            </div>
            <div className="flex items-end justify-between">
               <h3 className="text-2xl font-black text-gray-900">{formatCurrency(financialSummary?.current.totalExpenses || 0)}</h3>
               <p className="text-[10px] font-bold text-gray-400"> میانگین فاکتور: {formatCurrency(Math.round((financialSummary?.current.totalRevenue || 0) / ((financialSummary?.current.sessionCount || 0) + (financialSummary?.current.salesCount || 1))))}</p>
            </div>
         </Card>

         <Card className="p-6 border-none shadow-sm bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 opacity-50" />
            <div className="flex items-center gap-4 mb-4">
               <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Receipt size={20} />
               </div>
               <p className="text-xs font-black text-gray-400">مالیات بر ارزش افزوده ({selectedPeriodLabel})</p>
            </div>
            <div className="flex items-end justify-between">
               <h3 className="text-2xl font-black text-gray-900">{formatCurrency(financialSummary?.current.tax || 0)}</h3>
               <p className="text-[10px] font-bold text-gray-400">ذخیره مالیاتی</p>
            </div>
         </Card>

         <Card className="p-6 border-none shadow-sm bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-12 -mt-12 opacity-50" />
            <div className="flex items-center gap-4 mb-4">
               <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Users size={20} />
               </div>
               <p className="text-xs font-black text-gray-400">پرداختی به شرکا ({selectedPeriodLabel})</p>
            </div>
            <div className="flex items-end justify-between">
               <h3 className="text-2xl font-black text-gray-900">{formatCurrency(financialSummary?.current.paidToPartners || 0)}</h3>
               <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded-lg font-black">
                  {formatPersianNumber(Math.round(((financialSummary?.current.paidToPartners || 0) / (financialSummary?.current.netProfit || 1)) * 100))}% از سود
                </div>
             </div>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-rose-50/25 dark:bg-rose-950/10 relative overflow-hidden border border-rose-200 dark:border-rose-950">
             <div className="absolute top-0 right-0 w-24 h-24 bg-rose-100 rounded-full -mr-12 -mt-12 opacity-30" />
             <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center dark:bg-rose-950 dark:text-rose-400">
                   <UserX size={20} />
                </div>
                <p className="text-xs font-black text-gray-500 dark:text-slate-400">کل مطالبات دفتری (بدهی مشتریان)</p>
             </div>
             <div className="flex items-end justify-between">
                <h3 className="text-xl font-black text-rose-700 dark:text-rose-400">{formatCurrency(debtorStats.totalDebt)}</h3>
                <div className="flex items-center gap-1 text-[10px] bg-rose-100 text-rose-700 px-2 py-1 rounded-lg font-black dark:bg-rose-950/40 dark:text-rose-400">
                   {formatPersianDigits(debtorStats.count)} بدهکار دفتری ⚠️
                </div>
             </div>
          </Card>
          
          <Card className="hidden">
             <div className="hidden">
                <div className="hidden">
               </div>
            </div>
         </Card>
      </div>

      {/* Detailed Financial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Breakdown */}
        <Card className="p-8 lg:col-span-1">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-black text-gray-900">تفکیک درآمد (ناخالص) · {selectedPeriodLabel}</h3>
          </div>
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-gray-500">درآمد بازی</span>
                <span className="text-sm font-black text-gray-900">{formatCurrency(financialSummary?.current.gameGross || 0)}</span>
              </div>
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${((financialSummary?.current.gameGross || 0) / (financialSummary?.current.totalRevenue || 1)) * 100}%` }} />
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-gray-500">فروش کالا و بوفه</span>
                <span className="text-sm font-black text-gray-900">{formatCurrency(financialSummary?.current.productGross || 0)}</span>
              </div>
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${((financialSummary?.current.productGross || 0) / (financialSummary?.current.totalRevenue || 1)) * 100}%` }} />
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-gray-500">خدمات و تعمیرات سخت‌افزار</span>
                <span className="text-sm font-black text-gray-900">{formatCurrency(financialSummary?.current.repairGross || 0)}</span>
              </div>
              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-teal-500 h-full rounded-full" style={{ width: `${((financialSummary?.current.repairGross || 0) / (financialSummary?.current.totalRevenue || 1)) * 100}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
               <div>
                 <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">درآمد کلوپ (بازی)</p>
                 <p className="text-lg font-black text-indigo-600">{formatCurrency(financialSummary?.current.gameGross || 0)}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">فروش جانبی (فروشگاه)</p>
                 <p className="text-lg font-black text-amber-600">{formatCurrency(financialSummary?.current.boutiqueGross || 0)}</p>
               </div>
            </div>
            <div className="flex items-center justify-between pt-2">
               <div>
                 <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">تعمیرات (سخت‌افزار)</p>
                 <p className="text-lg font-black text-teal-600">{formatCurrency(financialSummary?.current.repairGross || 0)}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">تعداد تعمیرات</p>
                 <p className="text-lg font-black text-gray-900">{formatPersianNumber(financialSummary?.current.repairCount || 0)}</p>
               </div>
            </div>
          </div>
        </Card>

        {/* Expenses Breakdown */}
        <Card className="p-8 lg:col-span-1">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <ArrowDownIcon size={20} />
            </div>
            <h3 className="font-black text-gray-900">تفکیک هزینه‌ها</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white text-rose-500 rounded-lg flex items-center justify-center shadow-sm">
                  <ShoppingCart size={14} />
                </div>
                <span className="text-xs font-black text-gray-700">خرید کالا (انبار)</span>
              </div>
              <span className="text-xs font-black text-rose-600">{formatCurrency(financialSummary?.current.expPurchases || 0)}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white text-rose-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Briefcase size={14} />
                </div>
                <span className="text-xs font-black text-gray-700">هزینه‌های ثابت (اجاره و...)</span>
              </div>
              <span className="text-xs font-black text-rose-600">{formatCurrency(financialSummary?.current.expFixed || 0)}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white text-rose-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Users size={14} />
                </div>
                <span className="text-xs font-black text-gray-700">هزینه‌های مشترک</span>
              </div>
              <span className="text-xs font-black text-rose-600">{formatCurrency(financialSummary?.current.expShared || 0)}</span>
            </div>

            <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between">
               <p className="text-xs font-black text-gray-400">جمع کل هزینه‌ها</p>
               <p className="text-lg font-black text-rose-600">{formatCurrency(financialSummary?.current.totalExpenses || 0)}</p>
            </div>
          </div>
        </Card>

        {/* Profitability Index */}
        <Card className="p-8 lg:col-span-1 bg-indigo-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-indigo-200">
                <Wallet size={20} />
              </div>
              <h3 className="font-black text-indigo-100 text-sm">عملکرد نهایی (سود خالص)</h3>
            </div>

            <div className="space-y-8">
              <div>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-2">سود خالص باقی‌مانده</p>
                <div className="flex items-end gap-2">
                  <h4 className="text-3xl font-black">{formatCurrency(financialSummary?.current.netProfit || 0)}</h4>
                  <div className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg mb-1">
                    {formatPersianNumber(Math.round(((financialSummary?.current.netProfit || 0) / (financialSummary?.current.totalRevenue || 1)) * 100))}% سوددهی
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/10 w-full" />

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[9px] text-indigo-300 font-bold uppercase mb-1">پرداخت شده</p>
                  <p className="text-md font-black">{formatCurrency(financialSummary?.current.paidToPartners || 0)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-indigo-300 font-bold uppercase mb-1">مانده در صندوق</p>
                  <p className="text-md font-black text-emerald-400">{formatCurrency((financialSummary?.current.netProfit || 0) - (financialSummary?.current.paidToPartners || 0))}</p>
                </div>
              </div>

              {periodSalesTarget != null && (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-indigo-200 font-bold mb-3 flex items-center gap-2">
                     <TrendingUp size={12} />
                     هدف فروش این بازه ({formatPersianNumber(Math.round(periodSalesTarget))} تومان): {formatPersianDigits(targetPercent)}٪ تکمیل شده
                  </p>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                     <div className="bg-emerald-400 h-full rounded-full transition-all duration-1000" style={{ width: `${targetPercent}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Main Revenue Trend Chart */}
      <Card className="p-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <TrendingUp size={24} />
            </div>
            <div>
            <h3 className="text-lg font-black text-gray-900">روند درآمد · {selectedPeriodLabel}</h3>
              <p className="text-xs text-gray-400 font-medium">مقایسه تفکیکی درآمد بازی، بوفه و تعمیرات از مبدا صفر</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-[11px] font-bold text-gray-600">بازی</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-[11px] font-bold text-gray-600">بوفه و فروشگاه</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-teal-500" />
              <span className="text-[11px] font-bold text-gray-600">تعمیرات و خدمات</span>
            </div>
          </div>
        </div>
        
        <div className="h-[400px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="colorGame" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorBuffet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRepair" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" interval="preserveStartEnd" minTickGap={32} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis 
                domain={[0, 'auto']}
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(value) => formatPersianNumber(Math.floor(value / 1000)) + 'k'}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const gameItem = payload.find(p => p.dataKey === 'game');
                    const buffetItem = payload.find(p => p.dataKey === 'buffet');
                    const repairItem = payload.find(p => p.dataKey === 'repair');
                    const gameVal = (gameItem?.value as number) || 0;
                    const buffetVal = (buffetItem?.value as number) || 0;
                    const repairVal = (repairItem?.value as number) || 0;
                    const totalVal = gameVal + buffetVal + repairVal;
                    return (
                      <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-2xl border border-gray-800 text-right font-sans" dir="rtl">
                        <p className="text-[10px] text-gray-400 mb-2 font-bold">{payload[0].payload.date}</p>
                        <div className="space-y-1.5 min-w-[170px]">
                          <div className="flex justify-between gap-6">
                            <span className="text-[11px] text-indigo-300">درآمد بازی:</span>
                            <span className="text-[11px] font-black">{formatCurrency(gameVal)}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-[11px] text-amber-300">درآمد بوفه:</span>
                            <span className="text-[11px] font-black">{formatCurrency(buffetVal)}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-[11px] text-teal-300">درآمد تعمیرات:</span>
                            <span className="text-[11px] font-black">{formatCurrency(repairVal)}</span>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex justify-between gap-6">
                            <span className="text-xs font-bold">مجموع کل:</span>
                            <span className="text-xs font-black text-emerald-400">{formatCurrency(totalVal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="game" stroke="#6366f1" strokeWidth={3} fillOpacity={0.35} fill="url(#colorGame)" />
              <Area type="monotone" dataKey="buffet" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.35} fill="url(#colorBuffet)" />
              <Area type="monotone" dataKey="repair" stroke="#0d9488" strokeWidth={3} fillOpacity={0.35} fill="url(#colorRepair)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Row 1: Session Duration Distribution & Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Session Duration Distribution */}
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h3 className="font-black text-gray-900">توزیع مدت زمان نشست‌ها</h3>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-full md:w-1/2 h-[250px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={durationStats}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {durationStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {durationStats.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-xs font-bold text-gray-700">{item.name}</span>
                  <span className="text-xs font-black text-indigo-600">{formatPersianDigits(item.value)} بار</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Peak Hours Chart */}
        <Card className="p-8">
           <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h3 className="font-black text-gray-900">ساعات اوج شلوغی</h3>
          </div>
          <div className="h-[250px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return <div className="bg-gray-900 text-white p-2 rounded-lg text-xs font-bold">{formatPersianDigits(payload[0].value as number)} بار شروع بازی</div>
                  }
                  return null;
                }}/>
                <Bar dataKey="count" fill="#ec4899" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2: Console Profitability & Buffet Category Performance Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue by Type - Console Profitability */}
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Monitor size={20} />
            </div>
            <div>
              <h3 className="font-black text-gray-900">سودآوری بر اساس مدل کنسول</h3>
              <p className="text-xs text-gray-400 font-medium">سهم هر مدل دستگاه از درآمد بازی‌ها</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-full md:w-1/2 h-[250px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={consoleRevenue}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {consoleRevenue.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              {consoleRevenue.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-sm font-bold text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-black text-indigo-600">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Buffet Category Performance - Same size, side-by-side with Console Profitability */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-900">عملکرد دسته‌بندی‌های بوفه و فروشگاه</h3>
                <p className="text-xs text-gray-400 font-medium">سهم و میزان فروش دسته‌های بوفه و کالاهای فروشگاه</p>
              </div>
            </div>
            {categoryStats.length > 0 && (
              <span className="text-xs font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-xl">
                {formatPersianDigits(categoryStats.length)} دسته‌بندی
              </span>
            )}
          </div>

          {categoryStats.length === 0 ? (
            <div className="h-[250px] flex flex-col items-center justify-center text-center p-6 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
              <ShoppingCart size={32} className="mb-2 opacity-40 text-amber-500" />
              <p className="text-sm font-bold">هنوز تراکنشی برای بوفه یا فروشگاه ثبت نشده است.</p>
              <p className="text-xs text-gray-400 mt-1">با ثبت فروش اقلام بوفه یا فروشگاه، نمودار دسته‌ها تشکیل می‌شود.</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="w-full md:w-1/2 h-[250px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={categoryStats.map(c => ({ name: c.name, value: c.revenue, quantity: c.quantity }))}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryStats.map((_, index) => (
                        <Cell key={`cell-cat-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0];
                          const totalBuffetRev = categoryStats.reduce((sum, c) => sum + c.revenue, 0);
                          const pct = totalBuffetRev > 0 ? ((Number(item.value) / totalBuffetRev) * 100).toFixed(1) : '0';
                          return (
                            <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl text-right font-sans" dir="rtl">
                              <p className="text-xs font-black text-amber-400 mb-1">{item.name}</p>
                              <p className="text-[11px] font-bold">درآمد: {formatCurrency(item.value as number)}</p>
                              <p className="text-[10px] text-gray-400 mt-1">سهم: {formatPersianDigits(pct)}٪</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                {categoryStats.map((item, idx) => {
                  const totalBuffetRev = categoryStats.reduce((sum, c) => sum + c.revenue, 0);
                  const pct = totalBuffetRev > 0 ? ((item.revenue / totalBuffetRev) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <div className="truncate">
                          <span className="text-xs font-bold text-gray-800 block truncate">{item.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium">فروش: {formatPersianDigits(item.quantity)} کالا ({formatPersianDigits(pct)}٪)</span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-amber-600 shrink-0 mr-2">{formatCurrency(item.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Repairs & Hardware Services Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Device Type Breakdown */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                <Wrench size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-900">سودآوری بر اساس نوع دستگاه تعمیری</h3>
                <p className="text-xs text-gray-400 font-medium">سهم هر مدل دستگاه یا تجهیز از درآمد خدمات و تعمیرات</p>
              </div>
            </div>
            {repairPerformance.deviceBreakdown.length > 0 && (
              <span className="text-xs font-black text-teal-600 bg-teal-50 px-3 py-1 rounded-xl">
                {formatPersianDigits(repairPerformance.deviceBreakdown.length)} نوع تجهیز
              </span>
            )}
          </div>

          {repairPerformance.deviceBreakdown.length === 0 ? (
            <div className="h-[250px] flex flex-col items-center justify-center text-center p-6 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
              <Wrench size={32} className="mb-2 opacity-40 text-teal-500" />
              <p className="text-sm font-bold">هنوز پذیرش تعمیری ثبت نشده است.</p>
              <p className="text-xs text-gray-400 mt-1">با ثبت دستگاه‌های تعمیری در بخش تعمیرات، تحلیل این بخش فعال می‌شود.</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="w-full md:w-1/2 h-[250px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={repairPerformance.deviceBreakdown}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {repairPerformance.deviceBreakdown.map((_, index) => (
                        <Cell key={`cell-rep-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0];
                          const total = repairPerformance.totalRevenue;
                          const pct = total > 0 ? ((Number(item.value) / total) * 100).toFixed(1) : '0';
                          return (
                            <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl text-right font-sans" dir="rtl">
                              <p className="text-xs font-black text-teal-400 mb-1">{item.name}</p>
                              <p className="text-[11px] font-bold">درآمد: {formatCurrency(item.value as number)}</p>
                              <p className="text-[10px] text-gray-400 mt-1">سهم: {formatPersianDigits(pct)}٪</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                {repairPerformance.deviceBreakdown.map((item, idx) => {
                  const total = repairPerformance.totalRevenue;
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <div className="truncate">
                          <span className="text-xs font-bold text-gray-800 block truncate">{item.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium">سهم از تعمیرات: {formatPersianDigits(pct)}٪</span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-teal-600 shrink-0 mr-2">{formatCurrency(item.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Repair Financial Performance */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-900">تحلیل مالی خدمات تعمیرات</h3>
                <p className="text-xs text-gray-400 font-medium">مقایسه مبلغ قطعه، هزینه خرید، دستمزد، تخفیف و سود</p>
              </div>
            </div>
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">
              {formatPersianDigits(repairPerformance.totalCount)} پرونده تعمیر
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
              <p className="text-[10px] font-bold text-indigo-700 mb-1">جمع مبلغ فاکتورهای تعمیر</p>
              <p className="text-base font-black text-indigo-800">{formatCurrency(repairPerformance.invoicedAmount)}</p>
            </div>
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <p className="text-[10px] font-bold text-emerald-700 mb-1">مبلغ دریافت‌شده از مشتریان</p>
              <p className="text-base font-black text-emerald-800">{formatCurrency(repairPerformance.collectedAmount)}</p>
            </div>
            <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl">
              <p className="text-[10px] font-bold text-amber-700 mb-1">مانده قابل دریافت</p>
              <p className="text-base font-black text-amber-800">{formatCurrency(repairPerformance.receivableAmount)}</p>
            </div>
          </div>

          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={repairPerformance.financialBreakdown} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(value) => formatPersianDigits(formatPersianNumber(value))} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value) => [formatCurrency(Number(value) || 0), 'مبلغ']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12, direction: 'rtl' }}
                />
                <Bar dataKey="value" name="مبلغ" radius={[0, 8, 8, 0]}>
                  {repairPerformance.financialBreakdown.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2">سود خالص نقدی = دریافتی تعمیرات − هزینه واقعی خرید قطعات؛ پرونده‌های قدیمی بدون بهای خرید جداگانه طبق محاسبه قبلی لحاظ می‌شوند.</p>
        </Card>
      </div>

      {/* Customer Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Top Customers List */}
        <Card className="lg:col-span-4 p-8 relative overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Award size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-900">مشتریان برتر</h3>
                <p className="text-[10px] text-gray-400 font-bold italic">رتبه‌بندی بر اساس حجم پرداختی کل</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {clientPerformance.slice(0, 15).map((client, idx) => (
              <button
                key={client.id}
                onClick={() => {
                  setSelectedClientId(client.id);
                  setSelectedClientChartMonth(null);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl transition-all border group",
                  selectedClientId === client.id 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "bg-gray-50 border-transparent hover:border-indigo-200"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black",
                    selectedClientId === client.id ? "bg-white/20" : "bg-white text-indigo-600 shadow-sm"
                  )}>
                    {formatPersianNumber(idx + 1)}
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-black", selectedClientId === client.id ? "text-white" : "text-gray-900")}>
                      {client.name}
                    </p>
                    <p className={cn("text-[9px] font-bold", selectedClientId === client.id ? "text-indigo-200" : "text-gray-400 italic")}>
                      {formatPersianNumber(client.visitCount)} جلسه بازی
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className={cn("text-xs font-black", selectedClientId === client.id ? "text-white text-sm" : "text-indigo-600")}>
                    {formatCurrency(client.totalSpend)}
                  </p>
                </div>
              </button>
            ))}
            {clientPerformance.length === 0 && (
              <div className="py-20 text-center">
                 <Users className="mx-auto text-gray-300 mb-4" size={48} />
                 <p className="text-sm font-bold text-gray-400">داده‌ای یافت نشد</p>
              </div>
            )}
          </div>
        </Card>

        {/* Selected Customer Deep Dive Chart */}
        <Card className="lg:col-span-8 p-10 bg-slate-900 text-white rounded-[2.5rem] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mt-16" />
          
          <AnimatePresence mode="wait">
            {selectedClientId ? (
              <motion.div
                key={selectedClientId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative z-10"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                   <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md">
                         <Users size={32} className="text-white" />
                      </div>
                      <div>
                         <h3 className="text-2xl font-black text-white">{selectedClient?.name}</h3>
                         <div className="flex items-center gap-4 mt-1">
                            {(() => {
                               const totalPlayTime = clientPerformance.find(c => c.id === selectedClientId)?.visitCount || 0; // Or any logic for playtime
                               const currentTier = (tiers || [])
                                 .filter((t: any) => t.minPlayTime <= (selectedClient?.totalPlayTime || 0))
                                 .sort((a: any, b: any) => b.minPlayTime - a.minPlayTime)[0];
                               
                               return (
                                 <span className={cn(
                                    "flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full",
                                    currentTier?.color === 'indigo' ? "text-indigo-300 bg-indigo-500/10" :
                                    currentTier?.color === 'amber' ? "text-amber-300 bg-amber-500/10" :
                                    currentTier?.color === 'emerald' ? "text-emerald-300 bg-emerald-500/10" :
                                    currentTier?.color === 'rose' ? "text-rose-300 bg-rose-500/10" :
                                    currentTier?.color === 'slate' ? "text-slate-300 bg-slate-500/10" :
                                    currentTier?.color === 'orange' ? "text-orange-300 bg-orange-500/10" :
                                    "text-indigo-300 bg-indigo-500/10"
                                 )}>
                                    <Award size={10} />
                                    {currentTier?.name || selectedClient?.tier || 'پایه'}
                                 </span>
                               );
                            })()}
                            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                               <Wallet size={10} />
                               موجودی: {formatCurrency(selectedClient?.balance || 0)}
                            </span>
                         </div>
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                         <p className="text-[9px] text-gray-400 font-bold mb-1 uppercase">کل سودآوری</p>
                         <p className="text-lg font-black text-emerald-400">{formatCurrency(clientPerformance.find(c => c.id === selectedClientId)?.totalSpend || 0)}</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                         <p className="text-[9px] text-gray-400 font-bold mb-1 uppercase">تعداد حضور</p>
                         <p className="text-lg font-black text-white">{formatPersianDigits(clientPerformance.find(c => c.id === selectedClientId)?.visitCount || 0)} بار</p>
                      </div>
                   </div>
                </div>

                <div className="mb-6">
                   <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                     <h4 className="text-xs font-black text-indigo-300 flex items-center gap-2">
                        <TrendingUp size={14} />
                        روند روزانهٔ حضور و هزینه‌کرد
                     </h4>
                     <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300" htmlFor="customer-chart-month">
                       دورهٔ نمودار
                       <select
                         id="customer-chart-month"
                         value={selectedClientChartMonthKey}
                         onChange={event => setSelectedClientChartMonth(event.target.value)}
                         dir="rtl"
                         className="h-10 min-w-36 rounded-xl border border-white/10 bg-slate-800 px-3 text-xs font-bold text-white outline-none focus:border-indigo-400"
                       >
                         {clientChartMonthOptions.map(option => (
                           <option key={option.key} value={option.key}>{option.label}</option>
                         ))}
                       </select>
                     </label>
                   </div>
                   <div className="h-[320px] w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                         <AreaChart data={selectedClientHistory}>
                            <defs>
                               <linearGradient id="colorClientSpend" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis 
                               dataKey="date" 
                               axisLine={false} 
                               tickLine={false} 
                               tickFormatter={(value) => formatPersianDigits(String(value).slice(-2))}
                               tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} 
                            />
                            <YAxis 
                               axisLine={false} 
                               tickLine={false} 
                               tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                               tickFormatter={(value) => formatPersianNumber(Math.floor(value / 1000)) + 'k'}
                            />
                            <Tooltip 
                               content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                     return (
                                        <div className="bg-white text-gray-900 p-4 rounded-2xl shadow-2xl text-right" dir="rtl">
                                           <p className="text-[10px] text-gray-400 mb-2 font-bold">{payload[0].payload.date}</p>
                                           <div className="space-y-1">
                                              <p className="text-xs font-black text-gray-900">هزینه: {formatCurrency(payload[0].value as number)}</p>
                                              <p className="text-[10px] font-bold text-indigo-600">تعداد نشست: {formatPersianDigits(payload[0].payload.visits)}</p>
                                           </div>
                                        </div>
                                     );
                                  }
                                  return null;
                               }}
                            />
                            <Area type="monotone" dataKey="spend" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorClientSpend)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                 <UserCheck size={80} className="mb-6 text-indigo-400 stroke-[1.5]" />
                 <h4 className="text-xl font-black mb-2 tracking-tight">جزئیات مشتری انتخاب نشده است</h4>
                  <p className="text-xs font-bold text-gray-400 italic">برای مشاهده نمودار و ارزش لایف‌تایم، یکی از مشتریان را از لیست کنار انتخاب کنید.</p>
               </div>
            )}
           </AnimatePresence>
        </Card>
      </div>
        </>
      ) : (
        <div className="space-y-8 animate-fade-in font-sans">
          {/* Top 3 KPI Cards for Shareholders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Cumulative Capital Pool */}
            <Card className="p-6 border-none shadow-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white relative overflow-hidden rounded-[2rem]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 opacity-50" />
              <div className="relative z-10 text-right">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-100">سرمایه کل شرکا</span>
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                    <Wallet size={16} />
                  </div>
                </div>
                <div className="text-3xl font-black mb-1">{formatCurrency(totalStocksInvestmentSum)}</div>
                <p className="text-[10px] text-indigo-200 font-bold">مجموع آورده نقدی و غیرنقدی ثبت‌شده</p>
                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-[10px]">
                  <span className="text-indigo-200">تعداد کل شرکا مالک:</span>
                  <span className="font-black text-emerald-300">{formatPersianNumber(shareholders?.length || 0)} نفر</span>
                </div>
              </div>
            </Card>

            {/* Card 2: Distributed Dividends */}
            <Card className="p-6 border-none shadow-sm bg-white dark:bg-slate-800 relative overflow-hidden rounded-[2rem]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-950/20 rounded-full -mr-12 -mt-12 opacity-50" />
              <div className="relative z-10 text-right">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">سود توزیع‌شده نقدی</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/35 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{formatCurrency(totalPaymentsSum)}</div>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">کل مبالغ دیویدند واریزی شرکا</p>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-[10px]">
                  <span className="text-gray-400 dark:text-slate-500">تعداد دفعات پرداخت:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{formatPersianNumber(payments?.length || 0)} تراکنش</span>
                </div>
              </div>
            </Card>

            {/* Card 3: Retained Reserve */}
            <Card className="p-6 border-none shadow-sm bg-white dark:bg-slate-800 relative overflow-hidden rounded-[2rem]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 dark:bg-rose-955/20 rounded-full -mr-12 -mt-12 opacity-50" />
              <div className="relative z-10 text-right">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold font-sans">سود انباشته فعال کلوپ</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-500 dark:text-rose-400">
                    <Briefcase size={16} />
                  </div>
                </div>
                <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{formatCurrency(clubRetainedProfit)}</div>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">باقیمانده سود کلوپ در صندوق مشترک</p>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-[10px]">
                  <span className="text-gray-400 dark:text-slate-500">امنیت صندوق:</span>
                  <span className="font-black text-emerald-500">ایمن و پایدار</span>
                </div>
              </div>
            </Card>

          </div>

          {/* Interactive Recharts Graphics for Shareholders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Chart 1: Equity Allocation */}
            <Card className="p-6 md:p-8 rounded-[2.5rem] bg-white dark:bg-slate-800 border-none shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                    <PieChartIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white text-base">سهم‌الشرکه واقعی شرکا کلوپ</h3>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">توزیع درصد مالکیت بر اساس سرمایه‌گذاری نقدی کل</p>
                  </div>
                </div>
                <Badge variant="default">تراکم سرمایه</Badge>
              </div>

              <div className="h-64 flex items-center justify-center relative justify-end">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={shareholderStats}
                      dataKey="sharePercentage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      fill="#8884d8"
                      paddingAngle={4}
                    >
                      {shareholderStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any) => [`${formatPersianNumber(Math.round(value))}% سهم`, name]}
                      contentStyle={{ direction: 'rtl', textAlign: 'right', borderRadius: '16px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {shareholderStats.map((sh, idx) => (
                  <div key={sh.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <div className="truncate">
                      <p className="text-[10px] font-black text-gray-700 dark:text-slate-200 truncate">{sh.name}</p>
                      <p className="text-[9px] text-gray-400 font-bold">{formatPersianNumber(Math.round(sh.sharePercentage))}% سهم</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 2: Payout Flow over Months */}
            <Card className="p-6 md:p-8 rounded-[2.5rem] bg-white dark:bg-slate-800 border-none shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white text-base">جریان توزیع سود نقدی فصلی</h3>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">بخش سودهای نقدی در طول ماه‌های سال جاری</p>
                  </div>
                </div>
                <Badge variant="success">دیویدندز</Badge>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={payoutAggregateTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" stroke="currentColor" className="text-[10px] text-gray-400 font-bold" tickLine={false} />
                    <YAxis 
                      stroke="currentColor" 
                      className="text-[10px] text-gray-400 font-bold" 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(v) => formatPersianNumber(Math.round(v / 1000000)) + 'M'} 
                    />
                    <Tooltip 
                      formatter={(v: any) => [formatCurrency(v), 'مبلغ سود توزیعی']}
                      contentStyle={{ direction: 'rtl', borderRadius: '16px' }}
                    />
                    <Bar dataKey="payout" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-[10px] text-gray-400 font-bold mt-4">نمودار فوق روند تزریق مستقیم سود نقدی به حساب حقوقی هر سهام‌دار را گواهی می‌دهد.</p>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}
