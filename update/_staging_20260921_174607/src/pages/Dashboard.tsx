import { useCollection } from '../hooks/useFirestore';
import { useDatabaseStatus } from '../hooks/useDatabaseStatus';
import { Console, Product, Session, AppUser, Promotion, Tariff, SystemSettings, RepairItem } from '../types';
import { Card, Badge, Button } from '../components/ui/common';
import React, { useMemo } from 'react';
import { 
  Monitor, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  AlertCircle,
  Clock,
  CheckCircle2,
  Gamepad2,
  Target,
  PieChart as PieChartIcon,
  Glasses,
  TrendingDown,
  Award,
  ReceiptText,
  Wallet,
  Gift,
  Database,
  X,
  Wrench
} from 'lucide-react';
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
  Area
} from 'recharts';
import { formatPersianNumber, formatCurrency, cn, formatPersianDigits } from '../lib/utils';
import { getTodayRange, getOperationalDayKey, formatJalali, getJalaliMonthRange } from '../lib/dateUtils';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

function StatCard({ icon: Icon, label, value, subtext, trend, color, className }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 border-rose-100 dark:border-rose-800",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-800"
  };

  return (
    <Card className={cn("p-3.5 md:p-4 rounded-2xl relative overflow-hidden group border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between", className)}>
      <div className="flex items-start justify-between mb-2">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border shrink-0", colors[color])}>
          <Icon size={16} />
        </div>
        {trend !== undefined && (
          <div className={cn("flex items-center gap-1 font-black text-[10px] px-1.5 py-0.5 rounded-lg border", trend >= 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900" : "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/40 dark:border-rose-900")}>
            {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span>{formatPersianDigits(Math.abs(trend))}%</span>
          </div>
        )}
      </div>
      <div className="text-right">
        <h3 className="text-gray-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider mb-1 truncate">{label}</h3>
        <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white leading-tight truncate">{value}</p>
        <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-1 font-bold truncate">{subtext}</p>
      </div>
      <div className={cn("absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-500", colors[color])} />
    </Card>
  );
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const dbStatus = useDatabaseStatus();
  const { data: consoles, loading: consolesLoading } = useCollection<Console>('consoles');
  const { data: products, loading: productsLoading } = useCollection<Product>('products');
  const { data: clients, loading: clientsLoading } = useCollection<AppUser>('clients');
  const { data: sessions, loading: sessionsLoading } = useCollection<Session>('sessions');
  const { data: sales, loading: salesLoading } = useCollection<any>('sales');
  const { data: purchases, loading: purchasesLoading } = useCollection<any>('purchases');
  const { data: repairs, loading: repairsLoading } = useCollection<RepairItem>('repairs');
  const { data: shareholders } = useCollection<any>('shareholders');
  const { data: payments } = useCollection<any>('shareholder_payments');
  const { data: fixedCosts } = useCollection<any>('monthly_fixed_costs');
  const { data: sharedExpenses } = useCollection<any>('shared_expenses');
  const { data: promotions } = useCollection<Promotion>('promotions');
  const { data: tariffs } = useCollection<Tariff>('tariffs');
  const { data: settingsList } = useCollection<SystemSettings>('settings');

  const defaultMinStock = settingsList?.[0]?.defaultMinStock ?? 5;
  const dayResetHour = settingsList?.[0]?.dayResetHour ?? 0;
  const dayResetMinute = settingsList?.[0]?.dayResetMinute ?? 0;
  const getProductMinStock = (p: Product) => {
    if (p.minStock !== undefined && p.minStock !== null && !isNaN(Number(p.minStock))) {
      return Number(p.minStock);
    }
    return defaultMinStock;
  };
  const isCriticalStock = (p: Product) => {
    const min = getProductMinStock(p);
    return Number(p.stock) <= min;
  };

  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [activeNoteIndex, setActiveNoteIndex] = React.useState<number | null>(null);
  const [user, setUser] = React.useState<any>(null);
  const [showGreetingPopup, setShowGreetingPopup] = React.useState(() => {
    try {
      return !sessionStorage.getItem('greeting_popup_dismissed');
    } catch (e) {
      return true;
    }
  });

  const handleDismissGreeting = () => {
    setShowGreetingPopup(false);
    try {
      sessionStorage.setItem('greeting_popup_dismissed', 'true');
    } catch (e) {}
  };

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('game_net_user');
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const currentJalali = React.useMemo(() => {
    const today = new Date();
    const jalali = formatJalali(today, 'yyyy/MM/dd').split('/');
    return {
      year: parseInt(jalali[0]),
      month: parseInt(jalali[1]) - 1 // Make 0-indexed to match Stocks.tsx
    };
  }, []);

  const currentMonthRange = useMemo(() => {
    return getJalaliMonthRange(currentJalali.year, currentJalali.month);
  }, [currentJalali]);

  const completedSessions = useMemo(() => 
    (sessions || []).filter(s => 
      s.status === 'completed' && 
      new Date(s.endTime || s.startTime) >= currentMonthRange.start && 
      new Date(s.endTime || s.startTime) <= currentMonthRange.end
    ), 
  [sessions, currentMonthRange]);

  const monthSales = useMemo(() => 
    (sales || []).filter(s => 
      new Date(s.timestamp) >= currentMonthRange.start && 
      new Date(s.timestamp) <= currentMonthRange.end
    ), 
  [sales, currentMonthRange]);

  const monthPurchases = useMemo(() => 
    (purchases || []).filter(p => 
      new Date(p.timestamp) >= currentMonthRange.start && 
      new Date(p.timestamp) <= currentMonthRange.end
    ), 
  [purchases, currentMonthRange]);

  const monthFixedCosts = useMemo(() => 
    (fixedCosts || []).filter(f => 
       Number(f.year) === currentJalali.year && Number(f.month) === currentJalali.month
    ), 
  [fixedCosts, currentJalali]);

  const monthSharedExpenses = useMemo(() => 
    (sharedExpenses || []).filter(e => 
      new Date(e.date) >= currentMonthRange.start && 
      new Date(e.date) <= currentMonthRange.end
    ), 
  [sharedExpenses, currentMonthRange]);

  const activeSessions = useMemo(() => (sessions || []).filter(s => s.status === 'running' || (s.status as any) === 'active'), [sessions]);

  const activeSessionsList = useMemo(() => {
    return activeSessions.map(s => {
      const userObj = clients?.find(c => c.id === s.userId);
      const consoleObj = consoles?.find(c => c.id === s.consoleId);
      
      const start = new Date(s.startTime).getTime();
      const now = currentTime.getTime();
      let elapsedSeconds = 0;
      if (s.isPaused) {
        elapsedSeconds = s.accumulatedSeconds || 0;
      } else {
        const resumePoint = (s as any).lastResumeTime ? new Date((s as any).lastResumeTime).getTime() : start;
        elapsedSeconds = (s.accumulatedSeconds || 0) + Math.max(0, (now - resumePoint) / 1000);
      }
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      
      let timeString = '';
      if (elapsedMinutes >= 60) {
        const hours = Math.floor(elapsedMinutes / 60);
        const minutes = elapsedMinutes % 60;
        timeString = `${formatPersianNumber(hours)} ساعت و ${formatPersianNumber(minutes)} دقیقه`;
      } else {
        timeString = `${formatPersianNumber(elapsedMinutes)} دقیقه`;
      }

      const startTimeFormatted = s.startTime ? new Date(s.startTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '---';

      let clientNames = userObj?.name || 'کاربر مهمان کلوپ';
      if (s.userIds && s.userIds.length > 1) {
        const names = s.userIds.map(uid => clients?.find(c => c.id === uid)?.name).filter(Boolean);
        if (names.length > 0) {
          clientNames = `${names.join(' و ')} (${formatPersianDigits(s.userIds.length)} نفر)`;
        }
      }
      
      return {
        session: s,
        user: userObj,
        clientNames,
        console: consoleObj,
        elapsedMinutes,
        timeString,
        startTimeFormatted,
        isPaused: !!s.isPaused,
      };
    });
  }, [activeSessions, clients, consoles, currentTime]);

  // --- Calculations ---
  const todayStats = useMemo(() => {
    if (!sessions || !sales || !purchases || !sharedExpenses) return { total: 0, count: 0, netProfit: 0, gameIncome: 0, buffetIncome: 0, transactionTrend: 0, netProfitPercent: 0 };
    const { start, end } = getTodayRange(dayResetHour, dayResetMinute);
    
    const todaySessions = (sessions || []).filter(s => 
      s.status === 'completed' && new Date(s.endTime || s.startTime) >= start && new Date(s.endTime || s.startTime) <= end
    );
    
    const todaySales = (sales || []).filter(s => 
      new Date(s.timestamp) >= start && new Date(s.timestamp) <= end
    );

    const todayPurchases = (purchases || []).filter(p => 
      new Date(p.timestamp) >= start && new Date(p.timestamp) <= end
    );

    const todayShared = (sharedExpenses || []).filter(e => 
      new Date(e.date) >= start && new Date(e.date) <= end
    );

    const todayRepairs = (repairs || []).filter(r => {
      const rDate = new Date(r.completedAt || r.receivedAt || r.createdAt);
      return rDate >= start && rDate <= end;
    });
    const repairIncome = todayRepairs.reduce((sum, r) => sum + (Number(r.finalPrice ?? r.estimatedCost) || 0), 0);
    
    const gameIncome = todaySessions.reduce((sum, s) => sum + (s.totalSessionAmount || 0), 0) +
      todaySales.reduce((sum, s) => sum + ((s as any).gameAmount || 0), 0);
    const buffetSessionsIncome = todaySessions.reduce((sum, s) => sum + (s.totalProductsAmount || 0), 0);
    const directSalesIncome = todaySales.reduce((sum, s) => {
      if ((s as any).type === 'manual_invoice') {
        return sum + ((s as any).buffetAmount || 0);
      }
      return sum + (s.totalAmount || 0) - (s.taxAmount || 0);
    }, 0);
    
    const totalRevenue = todaySessions.reduce((sum, s) => sum + (s.totalCost || 0), 0) + 
                         todaySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0) + 
                         repairIncome;
    
    const gameTax = todaySessions.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
    const shopTax = todaySales.reduce((sum: any, s: any) => sum + (s.taxAmount || 0), 0);
    const totalTax = gameTax + shopTax;

    const todayExpense = todayPurchases.reduce((sum: any, p: any) => sum + (p.totalCost || 0), 0) + 
                         todayShared.reduce((sum: any, e: any) => sum + (e.amount || 0), 0);

    // Approximate daily fixed cost
    const monthFixed = (fixedCosts || []).filter(f => 
       Number(f.year) === currentJalali.year && Number(f.month) === currentJalali.month
    ).reduce((sum: any, f: any) => sum + (f.amount || 0), 0);
    const dailyFixedPortion = monthFixed / 30;

    const netProfit = totalRevenue - totalTax - todayExpense - dailyFixedPortion;
    
    // Yesterday for trend calculation
    const yesterdayStart = new Date(start);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(end);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    
    const yesterdaySessions = (sessions || []).filter(s => 
      s.status === 'completed' && new Date(s.endTime || s.startTime) >= yesterdayStart && new Date(s.endTime || s.startTime) <= yesterdayEnd
    );
    const yesterdaySales = (sales || []).filter(s => 
      new Date(s.timestamp) >= yesterdayStart && new Date(s.timestamp) <= yesterdayEnd
    );
    const yesterdayRepairs = (repairs || []).filter(r => {
      const rDate = new Date(r.completedAt || r.receivedAt || r.createdAt);
      return rDate >= yesterdayStart && rDate <= yesterdayEnd;
    });
    
    const todayCount = todaySessions.length + todaySales.length + todayRepairs.length;
    const yesterdayCount = yesterdaySessions.length + yesterdaySales.length + yesterdayRepairs.length;
    const transactionTrend = yesterdayCount > 0 
      ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100) 
      : (todayCount > 0 ? 100 : 0);

    const netProfitPercent = totalRevenue > 0 ? Math.round((Math.max(0, netProfit) / totalRevenue) * 100) : 0;
    
    return {
      total: totalRevenue,
      count: todayCount,
      netProfit: Math.max(0, netProfit),
      gameIncome,
      buffetIncome: buffetSessionsIncome + directSalesIncome,
      repairIncome,
      transactionTrend,
      netProfitPercent
    };
  }, [sessions, sales, purchases, sharedExpenses, fixedCosts, currentJalali, dayResetHour, dayResetMinute, repairs]);

  const stats = useMemo(() => {
    if (!consoles || !products || !clients || !sessions || !sales || !purchases || !fixedCosts || !sharedExpenses || !tariffs) return null;

    const gameIncomeGross = completedSessions.reduce((sum, s) => sum + (s.totalSessionAmount || 0), 0) +
      (monthSales || []).reduce((sum: any, s: any) => sum + (s.gameAmount || 0), 0);
    const gameTax = completedSessions.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
    
    const buffetIncomeFromSalesGross = (monthSales || []).reduce((sum: any, s: any) => {
      if (s.type === 'manual_invoice') {
        return sum + (s.buffetAmount || 0);
      }
      return sum + (s.totalAmount || 0) - (s.taxAmount || 0);
    }, 0);
    const shopTax = (monthSales || []).reduce((sum: any, s: any) => sum + (s.taxAmount || 0), 0);
    
    const buffetIncomeFromSessions = completedSessions.reduce((sum, s) => sum + (s.totalProductsAmount || 0), 0);
    const salesTotalGross = buffetIncomeFromSalesGross + buffetIncomeFromSessions;

    const monthRepairs = (repairs || []).filter(r => {
      const d = new Date(r.completedAt || r.receivedAt || r.createdAt);
      return d >= currentMonthRange.start && d <= currentMonthRange.end;
    });
    const repairIncomeGross = monthRepairs.reduce((sum, r) => sum + (Number(r.finalPrice ?? r.estimatedCost) || 0), 0);
    
    const taxTotal = gameTax + shopTax;
    const grandTotalGross = gameIncomeGross + salesTotalGross + repairIncomeGross + taxTotal;
    
    const purchaseCosts = (monthPurchases || []).reduce((sum: any, p: any) => sum + (p.totalCost || 0), 0);
    
    // Add missing expenses for a more accurate net profit
    const totalFixedCosts = (monthFixedCosts || []).reduce((sum: any, f: any) => sum + (f.amount || 0), 0);
    const totalSharedExpenses = (monthSharedExpenses || []).reduce((sum: any, e: any) => sum + (e.amount || 0), 0);

    const netProfit = (gameIncomeGross + salesTotalGross + repairIncomeGross) - taxTotal - purchaseCosts - totalFixedCosts - totalSharedExpenses;

    const gamePercent = grandTotalGross > 0 ? (gameIncomeGross / grandTotalGross) * 100 : 0;
    const salesPercent = grandTotalGross > 0 ? (salesTotalGross / grandTotalGross) * 100 : 0;

    // --- Revenue in Transit ---
    const transitRevenue = activeSessions.reduce((sum, s) => {
      const tariff = tariffs.find(t => t.id === s.tariffId);
      if (!tariff) return sum;
      
      const start = new Date(s.startTime).getTime();
      const now = new Date().getTime();
      const seconds = Math.max(0, (now - start) / 1000);
      const cost = (seconds / 3600) * tariff.pricePerHour;
      
      const productCost = (s.addedItems || []).reduce((pSum, item) => pSum + (item.price * item.quantity), 0);
      return sum + cost + productCost;
    }, 0);

    // Most Popular Console (by session count)
    const consoleUsage: Record<string, number> = {};
    completedSessions.forEach(s => {
      consoleUsage[s.consoleId] = (consoleUsage[s.consoleId] || 0) + 1;
    });
    const mostPopularConsoleId = Object.entries(consoleUsage).sort((a,b) => b[1] - a[1])[0]?.[0];
    const mostPopularConsole = consoles.find(c => c.id === mostPopularConsoleId);

    // Most Popular Product (by quantity sold)
    const productUsage: Record<string, { name: string, qty: number }> = {};
    (monthSales || []).forEach((sale: any) => {
      sale.items.forEach((item: any) => {
        if (!productUsage[item.productId]) productUsage[item.productId] = { name: item.name, qty: 0 };
        productUsage[item.productId].qty += item.quantity;
      });
    });
    completedSessions.forEach(s => {
      (s.addedItems || []).forEach(item => {
        if (!productUsage[item.productId]) productUsage[item.productId] = { name: item.name, qty: 0 };
        productUsage[item.productId].qty += item.quantity;
      });
    });
    const mostPopularProduct = Object.values(productUsage).sort((a,b) => b.qty - a.qty)[0];

    return {
      gameIncome: gameIncomeGross,
      taxIncome: taxTotal,
      gameTax,
      shopTax,
      salesTotal: salesTotalGross,
      grandTotal: grandTotalGross,
      purchaseCosts,
      netProfit,
      gamePercent,
      salesPercent,
      transitRevenue,
      activeConsolesCount: (consoles || []).filter(c => c.status === 'active').length,
      lowStockProducts: (products || []).filter(isCriticalStock),
      mostPopularConsoleName: mostPopularConsole ? `${mostPopularConsole.name} (${mostPopularConsole.type})` : '---',
      mostPopularProductName: mostPopularProduct?.name || '---'
    };
  }, [consoles, products, clients, sessions, sales, purchases, completedSessions, activeSessions, tariffs, settingsList]);

  // --- Alerts & Notifications ---
  const notifications = useMemo(() => {
    const alerts: any[] = [];

    // 0. Database Disconnection Alert
    if (dbStatus.status === 'DISCONNECTED' || dbStatus.status === 'ERROR') {
      alerts.push({
        type: 'danger',
        icon: Database,
        message: `خطای پایگاه داده: اتصال سیستم با پایگاه داده ابری قطع شده است! لطفاً وضعیت اینترنت یا وب‌سرور دیتابیس را بررسی کنید.`,
        link: '/settings'
      });
    }

    // 1. Low Stock Alerts
    const lowStock = (products || []).filter(isCriticalStock);
    if (lowStock.length > 0) {
      alerts.push({
        type: 'danger',
        icon: ShoppingCart,
        message: `${formatPersianNumber(lowStock.length)} کالا در وضعیت موجودی بحرانی (رسیده به حد آستانه تنظیم شده در بوفه) هستند.`,
        link: '/products'
      });
    }

    // 2. Session Time Limits (Active sessions ending within 15 mins)
    activeSessions.forEach(s => {
      if (s.limitMinutes) {
        const startTime = new Date(s.startTime);
        const endTime = new Date(startTime.getTime() + s.limitMinutes * 60000);
        const remainingMs = endTime.getTime() - currentTime.getTime();
        const remainingMins = Math.floor(remainingMs / 60000);

        if (remainingMins > 0 && remainingMins <= 15) {
          const consoleName = consoles?.find(c => c.id === s.consoleId)?.name || 'دستگاه';
          alerts.push({
            type: 'warning',
            icon: Clock,
            message: `زمان ${consoleName} تا ${formatPersianNumber(remainingMins)} دقیقه دیگر به اتمام می‌رسد.`,
            link: '/gaming'
          });
        }
      }
    });

    // 3. Payment Audits (Partners who haven't received full profit for the current month)
    if (shareholders && payments && sessions && sales && purchases && fixedCosts && sharedExpenses && currentJalali) {
      const { start: monthStart, end: monthEnd } = getJalaliMonthRange(currentJalali.year, currentJalali.month);
      
      // Calculate this month's financials
      const mSessions = (sessions || []).filter(s => s.status === 'completed' && new Date(s.startTime) >= monthStart && new Date(s.startTime) <= monthEnd);
      const mSales = (sales || []).filter(s => new Date(s.timestamp) >= monthStart && new Date(s.timestamp) <= monthEnd);
      const mPurchases = (purchases || []).filter(p => new Date(p.timestamp) >= monthStart && new Date(p.timestamp) <= monthEnd);
      const mFixed = (fixedCosts || []).filter(f => Number(f.year) === currentJalali.year && Number(f.month) === currentJalali.month);
      const mShared = (sharedExpenses || []).filter(e => new Date(e.date) >= monthStart && new Date(e.date) <= monthEnd);

      const mGameGross = mSessions.reduce((sum, s) => sum + (s.totalSessionAmount || 0), 0);
      const mSalesGross = mSales.reduce((sum: any, s: any) => sum + (s.totalAmount || 0) - (s.taxAmount || 0), 0) + 
                          mSessions.reduce((sum, s) => sum + (s.totalProductsAmount || 0), 0);
      const mTax = mSessions.reduce((sum, s) => sum + (s.taxAmount || 0), 0) + mSales.reduce((sum: any, s: any) => sum + (s.taxAmount || 0), 0);
      const mPurc = mPurchases.reduce((sum: any, p: any) => sum + (p.totalCost || 0), 0);
      const mFC = mFixed.reduce((sum: any, f: any) => sum + (f.amount || 0), 0);
      const mSE = mShared.reduce((sum: any, e: any) => sum + (e.amount || 0), 0);

      const monthlyNetProfit = (mGameGross + mSalesGross) - mTax - mPurc - mFC - mSE;
      
      shareholders.forEach((sh: any) => {
        // Calculate sh percentage (total sh inv / total inv)
        // We use all-time investment ratio as per Stock calculations
        const shTotalInv = (sh.investments || []).reduce((acc: number, inv: any) => acc + inv.amount, 0);
        const totalInvestment = shareholders.reduce((sum: number, s: any) => 
          sum + (s.investments || []).reduce((acc: number, inv: any) => acc + inv.amount, 0), 0);
        
        const percentage = totalInvestment > 0 ? (shTotalInv / totalInvestment) * 100 : 0;
        const expectedProfit = Math.floor((monthlyNetProfit * percentage) / 100);
        
        const shPaymentsThisMonth = (payments || []).filter((p: any) => 
          p.shareholderId === sh.id && p.year === currentJalali.year && p.month === currentJalali.month
        ).reduce((sum: number, p: any) => sum + p.amount, 0);

        if (expectedProfit > 1000 && shPaymentsThisMonth < expectedProfit) { 
          alerts.push({
            type: 'info',
            icon: ReceiptText,
            message: `حسابرسی: سهم سود ${sh.name} برای این ماه هنوز به طور کامل تسویه نشده است.`,
            link: '/stocks'
          });
        }
      });
    }

    // 4. Active Promotions
    if (promotions) {
      const activePromo = promotions.find(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        end.setHours(23, 59, 59, 999);
        return p.isActive && currentTime >= start && currentTime <= end;
      });
      if (activePromo) {
        alerts.push({
          type: 'info',
          icon: Gift,
          message: `طرح تشویقی فعال: "${activePromo.name}" با تخفیف %${activePromo.discountPercentage} در حال اجراست.`,
          link: '/settings'
        });
      }
    }

    return alerts;
  }, [products, activeSessions, currentTime, consoles, shareholders, payments, stats, currentJalali, dbStatus.status]);

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Console Performance ---
  const consolePerfStats = useMemo(() => {
    if (!consoles || !completedSessions) return [];
    return consoles.map(c => {
      const cSessions = completedSessions.filter(s => s.consoleId === c.id);
      return {
        name: `${c.name} (${c.type})`,
        revenue: cSessions.reduce((sum, s) => sum + (s.totalSessionAmount || 0), 0)
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [consoles, completedSessions]);

  // --- Product Performance ---
  const productPerfStats = useMemo(() => {
    const pStats: Record<string, { name: string, quantity: number, revenue: number }> = {};
    (monthSales || []).forEach((sale: any) => {
      sale.items.forEach((item: any) => {
        if (!pStats[item.name]) pStats[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        pStats[item.name].quantity += item.quantity;
        pStats[item.name].revenue += item.price * item.quantity;
      });
    });
    completedSessions.forEach(s => {
      (s.addedItems || []).forEach(item => {
        if (!pStats[item.name]) pStats[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        pStats[item.name].quantity += item.quantity;
        pStats[item.name].revenue += item.price * item.quantity;
      });
    });
    return Object.values(pStats).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [monthSales, completedSessions]);

  // --- Repair Performance ---
  const repairPerfStats = useMemo(() => {
    if (!repairs) return { count: 0, revenue: 0, activeCount: 0, completedCount: 0, devices: [] as { name: string, count: number }[] };
    const count = repairs.length;
    const revenue = repairs.reduce((sum, r) => sum + (Number(r.finalPrice ?? r.estimatedCost) || 0), 0);
    const activeCount = repairs.filter(r => r.status === 'in_progress' || r.status === 'received').length;
    const completedCount = repairs.filter(r => r.status === 'delivered' || r.status === 'ready').length;

    const deviceMap: Record<string, number> = {};
    repairs.forEach(r => {
      const typeLabel = r.deviceType === 'ps4' ? 'پلی‌استیشن ۴' :
                        r.deviceType === 'ps5' ? 'پلی‌استیشن ۵' :
                        r.deviceType === 'xbox' ? 'ایکس‌باکس' :
                        r.deviceType === 'controller' ? 'دسته بازی' :
                        r.deviceType === 'pc' ? 'کیس / مانیتور' : 'سایر قطعات';
      deviceMap[typeLabel] = (deviceMap[typeLabel] || 0) + 1;
    });
    const devices = Object.entries(deviceMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    return { count, revenue, activeCount, completedCount, devices };
  }, [repairs]);

  // --- Daily Trend ---
  const dailyTrend = useMemo(() => {
    const trends: Record<string, { date: string, revenue: number }> = {};
    const { start: todayShiftStart } = getTodayRange(dayResetHour, dayResetMinute);
    
    // 7 operational shift days ending at today's shift
    for(let i = 6; i >= 0; i--) {
      const d = new Date(todayShiftStart);
      d.setDate(d.getDate() - i);
      const dayKey = getOperationalDayKey(d, dayResetHour, dayResetMinute);
      trends[dayKey] = { 
        date: d.toLocaleDateString('fa-IR', { weekday: 'short' }), 
        revenue: 0 
      };
    }
    
    const process = (dateStr: string, amt: number) => {
      if (!dateStr) return;
      const key = getOperationalDayKey(dateStr, dayResetHour, dayResetMinute);
      if (trends[key]) {
        trends[key].revenue += amt;
      }
    };
    
    const sevenShiftsAgoStart = new Date(todayShiftStart);
    sevenShiftsAgoStart.setDate(sevenShiftsAgoStart.getDate() - 6);

    const last7DaysSessions = (sessions || []).filter(s => 
      s.status === 'completed' && new Date(s.endTime || s.startTime) >= sevenShiftsAgoStart
    );
    const last7DaysSales = (sales || []).filter(s => 
      new Date(s.timestamp) >= sevenShiftsAgoStart
    );
    const last7DaysRepairs = (repairs || []).filter(r => {
      const d = new Date(r.completedAt || r.receivedAt || r.createdAt);
      return d >= sevenShiftsAgoStart;
    });

    last7DaysSessions.forEach(s => process(s.endTime || '', s.totalCost || 0));
    last7DaysSales.forEach((s: any) => process(s.timestamp, s.totalAmount));
    last7DaysRepairs.forEach(r => process(r.completedAt || r.receivedAt || r.createdAt, Number(r.finalPrice ?? r.estimatedCost) || 0));
    
    return Object.values(trends);
  }, [sessions, sales, repairs, dayResetHour, dayResetMinute]);

  // --- Client Loyalty & Top Customers (Synced with Analytics) ---
  const topClients = useMemo(() => {
    if (!clients) return [];
    
    return clients
      .filter(c => !c.isGuest) // Exclude guest from "Top Clients" leaderboard
      .map(c => {
        const cSessions = (sessions || []).filter(s => s.userId === c.id && s.status === 'completed');
        const sessionSpent = cSessions.reduce((sum, s) => sum + (s.totalCost || ((s.totalSessionAmount || 0) + (s.totalProductsAmount || 0))), 0);

        const cSales = (sales || []).filter(s => s.userId === c.id || s.clientId === c.id || (s.clientName && s.clientName === c.name));
        const salesSpent = cSales.reduce((sum, s) => sum + (Number(s.finalAmount ?? s.totalAmount ?? s.amount) || 0), 0);

        const cRepairs = (repairs || []).filter(r => r.clientId === c.id || (r.clientName && r.clientName === c.name));
        const repairsSpent = cRepairs.reduce((sum, r) => sum + (Number(r.finalPrice ?? r.estimatedCost) || 0), 0);

        const totalSpent = Math.max(Number(c.totalPaid) || 0, sessionSpent + salesSpent + repairsSpent);

        return { 
          id: c.id,
          name: c.name, 
          phone: c.phone,
          visits: cSessions.length, 
          repairsCount: cRepairs.length,
          spent: totalSpent 
        };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);
  }, [clients, sessions, sales, repairs]);

  if (consolesLoading || productsLoading || clientsLoading || sessionsLoading || salesLoading || purchasesLoading || repairsLoading) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl m-8 shadow-sm">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-bold">درحال بارگذاری داشبورد تجاری...</p>
      </div>
    );
  }

  const getConsoleIcon = (type: string, size = 24) => {
    const t = type.toUpperCase();
    if (t.includes('PS') || t.includes('XBOX')) return <Gamepad2 size={size} />;
    if (t.includes('VR')) return <Glasses size={size} />;
    return <Monitor size={size} />;
  };

  return (
    <div className="p-3 md:p-5 space-y-6 font-sans text-right pb-24 w-full" dir="rtl">
      {/* Active Promotion Banner */}
      {(() => {
        const activePromo = (promotions || []).find(p => {
          const start = new Date(p.startDate);
          const end = new Date(p.endDate);
          end.setHours(23, 59, 59, 999);
          return p.isActive && currentTime >= start && currentTime <= end;
        });

        if (!activePromo) return null;

        return (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-600 rounded-2xl p-5 text-white shadow-xl shadow-indigo-200 relative overflow-hidden mb-6"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-6 text-right">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-xl animate-pulse">
                  <Gift size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-black mb-1">یک جشنواره فعال در حال اجراست!</h3>
                  <p className="text-indigo-100 text-xs font-medium">
                    جشنواره "{activePromo.name}" هم‌اکنون فعال است و تمامی محاسبات با تخفیف %{formatPersianNumber(activePromo.discountPercentage)} اعمال می‌شوند.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-sm shadow-lg">
                  %{formatPersianNumber(activePromo.discountPercentage)} تخفیف ویژه
                </div>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-1">داشبورد هوشمند</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">خلاصه وضعیت لحظه‌ای کلوپ</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 relative z-40">
          {notifications.length > 0 && (
            <div className="flex gap-2 items-center">
              {notifications.map((note, i) => (
                <motion.div 
                   key={i} 
                   className="relative"
                   animate={note.type === 'danger' || note.type === 'warning' ? {
                     scale: [1, 1.03, 1],
                   } : {}}
                   transition={{
                     duration: 2.5,
                     repeat: Infinity,
                     ease: "easeInOut"
                   }}
                >
                  <button 
                    onClick={() => setActiveNoteIndex(activeNoteIndex === i ? null : i)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center border transition-all hover:scale-110 active:scale-95 shadow-sm relative overflow-hidden",
                      note.type === 'danger' && "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800",
                      note.type === 'warning' && "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800",
                      note.type === 'info' && (note.icon === Gift ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-200 ring-4 ring-indigo-50/50" : "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800"),
                      activeNoteIndex === i && "ring-2 ring-offset-2 ring-indigo-500"
                    )}
                  >
                    <AnimatePresence>
                        {((note.type === 'danger' || note.type === 'warning') || (note.icon === Gift)) && (
                          <motion.div 
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: note.icon === Gift ? 0.2 : 0.3, scale: 2 }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className={cn(
                                  "absolute inset-0 rounded-full",
                                  note.type === 'danger' ? "bg-rose-400" : note.type === 'warning' ? "bg-amber-400" : "bg-white"
                              )}
                          />
                        )}
                    </AnimatePresence>
                    <note.icon size={18} className="relative z-10" />
                    
                    {/* Exclamation Mark Indicator */}
                    { (note.type === 'danger' || note.type === 'warning') && (
                      <motion.div 
                          animate={{ 
                              scale: [1, 1.2, 1],
                              opacity: [1, 0.7, 1] 
                          }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className={cn(
                              "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800",
                              note.type === 'danger' ? "bg-rose-500" : "bg-amber-500"
                          )}
                      >
                          <span className="text-white text-[8px] font-black italic">!</span>
                      </motion.div>
                    )}

                    {activeNoteIndex === i && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full border border-current" />
                    )}
                  </button>

                  <AnimatePresence>
                    {activeNoteIndex === i && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="absolute top-12 left-0 z-50 w-72 bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 text-right"
                      >
                         <p className={cn(
                           "text-xs font-black leading-relaxed mb-4",
                           note.type === 'danger' ? "text-rose-600" : note.type === 'warning' ? "text-amber-600" : (note.icon === Gift ? "text-indigo-600" : "text-indigo-600")
                         )}>
                           {note.message}
                         </p>
                         <Link 
                           to={note.link}
                           onClick={() => setActiveNoteIndex(null)}
                           className="flex items-center justify-center w-full py-2.5 bg-gray-50 dark:bg-slate-900/50 rounded-xl text-[11px] font-black text-gray-500 hover:bg-gray-100 transition-colors"
                         >
                           مشاهده جزئیات
                         </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
          <div className="flex gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 items-center">
            <div className="relative ml-2 flex items-center">
               <motion.div 
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }} 
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-emerald-400 rounded-full"
               />
               <div className="w-2 h-2 bg-emerald-500 rounded-full relative z-10" />
            </div>
            <Clock size={16} className="ml-1" />
            <span>{formatJalali(currentTime, 'yyyy/MM/dd')} | {currentTime.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Smart Welcoming Popup Dialog */}
      <AnimatePresence>
        {showGreetingPopup && (() => {
          const hour = currentTime.getHours();
          let greeting = '';
          let greetingIcon = '☀️';
          let greetingSub = '';
          
          const welcomeName = user?.fullName ? `جناب آقای ${user.fullName}` : 'مدیر محترم کلوپ';

          if (hour >= 5 && hour < 12) {
            greeting = `صبح زیبایتان بخیر، ${welcomeName}!`;
            greetingIcon = '☀️';
            greetingSub = 'امروز روز پرانرژی برای ثبت بازی‌ها و مدیریت کلوپ است. بیایید شروعی پرانرژی داشته باشیم!';
          } else if (hour >= 12 && hour < 17) {
            greeting = `ظهرتان سرشار از انرژی، ${welcomeName}!`;
            greetingIcon = '🌤️';
            greetingSub = 'خسته نباشید؛ ساعات شلوغ کلوپ در حال شروع شدن است. بیایید نگاهی به وضعیت فعلی دستگاه‌ها بیندازیم.';
          } else if (hour >= 17 && hour < 22) {
            greeting = `عصرتان شاد و پرنشاط، ${welcomeName}!`;
            greetingIcon = '🌙';
            greetingSub = 'کلوپ هم‌اکنون در ساعات اوج هیجان خود قرار دارد. از میزبانی عالی شما و مدیریت روان دستگاه‌ها سپاسگزاریم!';
          } else {
            greeting = `آخر وقتتان به خیر و نیکی، ${welcomeName}!`;
            greetingIcon = '🚀';
            greetingSub = 'یک روز کاری پر از رقابت و نشاط دیگر سپری شد. امیدواریم از نتایج مالی و پیشرفت کلوپ رضایت داشته باشید.';
          }

          const activeCount = activeSessions.length;
          const earningsToday = formatCurrency(todayStats.total);
          const profitToday = formatCurrency(todayStats.netProfit);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden text-right max-w-2xl w-full"
              >
                <button
                  onClick={handleDismissGreeting}
                  className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="space-y-6 relative z-10">
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl animate-bounce">{greetingIcon}</span>
                      <h3 className="text-xl md:text-2xl font-black bg-gradient-to-l from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">
                        {greeting}
                      </h3>
                    </div>
                    <p className="text-xs md:text-sm text-indigo-100/80 leading-relaxed font-semibold">
                      {greetingSub}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-center backdrop-blur-sm">
                      <span className="text-[10px] text-indigo-300 font-bold mb-0.5">بازیکنان هم‌اکنون</span>
                      <span className="text-sm font-black text-white flex items-center gap-1.5 justify-end">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {formatPersianNumber(activeCount)} نفر
                      </span>
                    </div>
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-center backdrop-blur-sm">
                      <span className="text-[10px] text-indigo-300 font-bold mb-0.5">درآمد امروز</span>
                      <span className="text-sm font-black text-emerald-400">{earningsToday}</span>
                    </div>
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-center backdrop-blur-sm">
                      <span className="text-[10px] text-indigo-300 font-bold mb-0.5">سود خالص امروز</span>
                      <span className="text-sm font-black text-cyan-400">{profitToday}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleDismissGreeting}
                      className="w-full py-3 px-6 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <span>متوجه شدم و ورود به سیستم</span>
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Stats Summary - 6 in a single row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Card 1: Revenue Overview */}
        <Card className="p-3.5 md:p-4 relative overflow-hidden group bg-indigo-600 text-white border border-indigo-500 shadow-md dark:shadow-none rounded-2xl flex flex-col justify-between">
           <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0">
                 <Wallet size={16} />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-wider text-indigo-100 truncate">درآمد امروز</h3>
           </div>
           <div className="space-y-1.5 relative z-10">
              <div>
                 <p className="text-lg md:text-xl font-black truncate">{formatCurrency(todayStats.total)}</p>
                 <p className="text-[9px] font-bold text-indigo-200 mt-0.5 truncate">مجموع کل دریافتی</p>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-white/10 text-[8.5px] leading-tight">
                 <span className="text-indigo-200 truncate" title={`بازی: ${formatCurrency(todayStats.gameIncome || 0)}`}>بازی: {formatCurrency(todayStats.gameIncome || 0)}</span>
                 <span className="text-indigo-200 truncate" title={`بوفه: ${formatCurrency(todayStats.buffetIncome || 0)}`}>بوفه: {formatCurrency(todayStats.buffetIncome || 0)}</span>
                 <span className="text-indigo-200 truncate" title={`تعمیرات: ${formatCurrency(todayStats.repairIncome || 0)}`}>تعمیرات: {formatCurrency(todayStats.repairIncome || 0)}</span>
              </div>
           </div>
           <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-xl" />
        </Card>

        {/* NEW Card 2: Today's Net Profit */}
        <Card className="p-3.5 md:p-4 relative overflow-hidden group border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800 rounded-2xl flex flex-col justify-between">
           <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
                 <TrendingUp size={16} />
              </div>
              <h3 className="text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">سود خالص امروز</h3>
           </div>
           <div className="space-y-1.5 relative z-10">
              <div className="flex items-baseline justify-between gap-1">
                 <p className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate">{formatCurrency(todayStats.netProfit)}</p>
                 <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/45 px-1 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/50 shrink-0">
                    ٪{formatPersianNumber(todayStats.netProfitPercent)}
                 </span>
              </div>
              <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 truncate">کسر هزینه‌های روزانه</p>
           </div>
           <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-full blur-2xl" />
        </Card>

        {/* Card 3: Monthly Net Profit */}
        <Card className="p-3.5 md:p-4 relative overflow-hidden group border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800 rounded-2xl flex flex-col justify-between">
           <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shrink-0">
                 <ReceiptText size={16} />
              </div>
              <h3 className="text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">سود خالص ماهانه</h3>
           </div>
           <div className="space-y-1.5 relative z-10">
              <p className="text-lg md:text-xl font-black text-indigo-600 dark:text-indigo-400 truncate">{formatCurrency(stats?.netProfit || 0)}</p>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold block truncate">عملکرد ماه جاری</span>
           </div>
           <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-full blur-2xl" />
        </Card>

        {/* Card 4: Operations */}
        <StatCard 
          icon={CheckCircle2} 
          label="تراکنش‌های امروز" 
          value={formatPersianNumber(todayStats.count)} 
          subtext={`گردش: ${formatCurrency(stats?.transitRevenue || 0)}`}
          trend={todayStats.transactionTrend}
          color="amber"
          className="rounded-2xl"
        />

        {/* Card 5: Clients */}
        <StatCard 
          icon={Users} 
          label="کل مشتریان کلوپ" 
          value={formatPersianNumber(clients?.length || 0)} 
          subtext="مشتریان ثبت‌شده"
          color="indigo"
          className="rounded-2xl"
        />

        {/* Card 6: Most Used Console Icon */}
        <Card className="p-3.5 md:p-4 relative overflow-hidden group border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800 rounded-2xl flex flex-col justify-between">
           <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100 shrink-0">
                 <Award size={16} />
              </div>
              <h3 className="text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">محبوب‌ترین دستگاه</h3>
           </div>
           <div className="space-y-1.5 relative z-10">
              <div className="flex items-center gap-1.5">
                 <Gamepad2 size={14} className="text-rose-500 shrink-0" />
                 <p className="text-sm font-black text-gray-800 dark:text-gray-200 truncate">{stats?.mostPopularConsoleName || '---'}</p>
              </div>
              <p className="text-[9px] text-gray-400 font-bold truncate">بیشترین رکورد ماه</p>
           </div>
           <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-rose-50/50 dark:bg-rose-900/10 rounded-full blur-2xl" />
        </Card>
      </div>

      {/* Revenue Trend Chart - Swapped to prominent upper position */}
      <Card className="p-6 md:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60">
              <TrendingUp size={22} />
            </div>
            <div>
              <h4 className="font-black text-base md:text-lg text-gray-900 dark:text-white">روند درآمد ۷ روز اخیر</h4>
              <p className="text-xs text-gray-400 dark:text-slate-500 font-semibold mt-0.5">تحلیل پیوسته و مقایسه‌ای درآمد کل کلوپ طی یک هفته گذشته</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50/80 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/60 text-xs font-bold text-emerald-700 dark:text-emerald-300 self-start sm:self-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>۷ روز گذشته کلوپ</span>
          </div>
        </div>
        <div className="w-full h-[260px]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" className="dark:stroke-slate-700/60" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
              <YAxis 
                orientation="left"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                tickFormatter={(val: number) => {
                  if (val === 0) return '۰';
                  if (val >= 1000000) {
                    const m = val / 1000000;
                    return formatPersianNumber(Number.isInteger(m) ? m : m.toFixed(1)) + ' م';
                  }
                  if (val >= 1000) {
                    return formatPersianNumber(Math.floor(val / 1000)) + ' هـ';
                  }
                  return formatPersianNumber(val);
                }}
                width={50}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl text-xs font-black">
                        {formatCurrency(payload[0].value as number)}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Active Users and Connection Status Monitor - Swapped to lower section */}
          <Card className="p-6 md:p-8 border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-100 dark:border-emerald-900 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Users size={24} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">وضعیت اتصال و بازیکنان فعال کلوپ</h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500 font-semibold mt-0.5">نمای زنده دستگاه‌های متصل، مانیتورینگ اتصال و مدت زمان سپری شده</p>
                </div>
              </div>
              <Link 
                to="/consoles" 
                className="self-start md:self-center px-5 py-2.5 bg-gray-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl text-xs font-black transition-colors border border-gray-100 dark:border-slate-700"
              >
                مدیریت ردیف‌های بازی و نشست‌ها
              </Link>
            </div>

            {activeSessionsList.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-right">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                   <Gamepad2 size={28} />
                </div>
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-1">هیچ بازیکنی هم‌اکنون وارد نشده است</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mb-4 leading-relaxed max-w-sm mx-auto">
                  تمامی دستگاه‌های کلوپ در وضعیت آماده‌به‌کار هستند. با متصل کردن بازیکنان به کنسول‌ها، نشست جدید ثبت کنید.
                </p>
                <Link 
                  to="/consoles" 
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  شروع اولین نشست بازی جدید
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {activeSessionsList.map(({ session, user: player, clientNames, console: gameConsole, elapsedMinutes, timeString, startTimeFormatted, isPaused }) => (
                  <motion.div 
                    key={session.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-50/60 hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl transition-all duration-200 shadow-sm relative overflow-hidden text-right"
                  >
                    {/* Visual Accent Line */}
                    <div className={cn("absolute top-0 right-0 left-0 h-[3px]", isPaused ? "bg-amber-400" : "bg-gradient-to-l from-emerald-500/80 via-indigo-500/30 to-transparent")} />

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/45 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm">
                            {clientNames[0] || 'م'}
                          </div>
                          <span className="absolute bottom-[-2px] left-[-2px] flex h-3 w-3">
                            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isPaused ? "bg-amber-400" : "bg-emerald-400")}></span>
                            <span className={cn("relative inline-flex rounded-full h-3 w-3 border border-white dark:border-slate-800", isPaused ? "bg-amber-500" : "bg-emerald-500")}></span>
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[170px]" title={clientNames}>
                            {clientNames}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-semibold truncate">
                            {player?.phone ? formatPersianDigits(player.phone) : 'ثبت اختصاصی کلوپ'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Status Tag */}
                      <div className="text-left">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black border shadow-inner",
                          isPaused 
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60" 
                            : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60"
                        )}>
                          {isPaused ? 'توقف موقت (Pause)' : 'اتصال فعال'}
                        </span>
                      </div>
                    </div>

                    {/* Connection stats info */}
                    <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Gamepad2 size={13} className="text-slate-400" />
                          دستگاه متصل شده:
                        </span>
                        <span className="font-extrabold text-[#312E81] dark:text-indigo-300">
                          {gameConsole?.name || 'دستگاه نامعلوم'} <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">({gameConsole?.type || 'سایر'})</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Clock size={13} className="text-slate-400" />
                          ساعت شروع بازی:
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {startTimeFormatted}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold flex items-center gap-1">
                          <Clock size={13} className="text-slate-400" />
                          مدت بازی تا اکنون:
                        </span>
                        <span className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full", isPaused ? "bg-amber-500" : "bg-indigo-500 animate-ping")} />
                          {timeString}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* Tax Breakdown */}
          <Card className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400">
                <ReceiptText size={20} />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white">گزارش مالیات‌های پرداختی</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
                  <p className="text-[10px] text-gray-400 font-bold mb-1">مالیات بازی‌ها</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(stats?.gameTax || 0)}</p>
               </div>
               <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
                  <p className="text-[10px] text-gray-400 font-bold mb-1">مالیات بوفه و فروشگاه</p>
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400">{formatCurrency(stats?.shopTax || 0)}</p>
               </div>
            </div>
          </Card>
        </div>

        {/* Sidebar: Inventory, Loyalty */}
        <div className="space-y-8">
          {/* Low Stock Items */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center justify-between">
              موجودی بحرانی (بوفه)
              <AlertCircle size={18} className="text-rose-500" />
            </h3>
            <div className="space-y-4">
              {stats?.lowStockProducts.slice(0, 5).sort((a,b) => a.stock - b.stock).map(p => (
                <div key={p.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-gray-400 group-hover:bg-rose-50 dark:group-hover:bg-rose-900/30 group-hover:text-rose-500 transition-colors">
                      <ShoppingCart size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        {p.category} • حداقل مجاز: {formatPersianNumber(getProductMinStock(p))} عدد
                      </p>
                    </div>
                  </div>
                  <Badge variant={p.stock <= 0 ? "danger" : "warning"}>
                    {p.stock <= 0 ? "ناموجود" : `${formatPersianNumber(p.stock)} عدد`}
                  </Badge>
                </div>
              ))}
              {stats?.lowStockProducts.length === 0 && (
                <div className="text-center py-6">
                   <CheckCircle2 size={32} className="mx-auto text-emerald-100 mb-2" />
                   <p className="text-xs text-gray-400 font-bold">موجودی تمام کالاها بالاتر از حداقل آستانه است.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Top Clients */}
          <Card className="p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60">
                  <Award size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">سودآورترین مشتریان</h4>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 font-semibold">۵ مشتری برتر بر اساس بیشترین پرداختی کل (بازی، بوفه و تعمیرات)</p>
                </div>
              </div>
              <Link to="/clients" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                مشاهده همه
              </Link>
            </div>
            <div className="space-y-2.5">
              {topClients.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs font-bold">مشتری با سابقه پرداخت ثبت نشده است.</div>
              ) : (
                topClients.map((client, idx) => {
                  const rankColors = [
                    'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300',
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300',
                    'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-300',
                    'bg-slate-50 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200',
                    'bg-slate-50 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200',
                  ];
                  return (
                    <div key={client.id || idx} className="flex items-center justify-between p-3 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-3">
                        <span className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black border", rankColors[idx] || rankColors[4])}>
                          {formatPersianDigits(idx + 1)}
                        </span>
                        <div>
                          <span className="text-sm font-black text-gray-900 dark:text-white block">{client.name}</span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">
                            {formatPersianDigits(client.visits)} نشست بازی {client.repairsCount > 0 ? `• ${formatPersianDigits(client.repairsCount)} سفارش تعمیر` : ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                        {formatCurrency(client.spent)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Performance Charts: Game, Buffet, Repairs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pillar 1: Games & Consoles */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Gamepad2 size={20} className="text-indigo-600" />
              سودآوری بازی و دستگاه‌ها
            </h4>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg">
              بازی
            </span>
          </div>
          <div className="h-[250px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={consolePerfStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return <div className="bg-gray-900 text-white p-2 rounded-lg text-[10px]">{formatCurrency(payload[0].value as number)}</div>
                  }
                  return null;
                }}/>
                <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pillar 2: Buffet */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart size={20} className="text-amber-600" />
              محصولات پرفروش بوفه
            </h4>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
              بوفه
            </span>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="w-full h-[160px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={productPerfStats}
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="revenue"
                  >
                    {productPerfStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full space-y-2">
               {productPerfStats.slice(0, 4).map((stat, idx) => (
                 <div key={idx} className="flex items-center justify-between text-xs">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-bold text-gray-700 dark:text-gray-300">{stat.name}</span>
                   </div>
                   <span className="font-black text-gray-900 dark:text-white">{formatPersianDigits(stat.quantity)} عدد</span>
                 </div>
               ))}
            </div>
          </div>
        </Card>

        {/* Pillar 3: Repairs & Services */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wrench size={20} className="text-purple-600" />
                وضعیت و عملکرد تعمیرات
              </h4>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg">
                تعمیرات
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 block">درآمد کل خدمات</span>
                <span className="text-sm font-black text-gray-900 dark:text-white mt-1 block">{formatCurrency(repairPerfStats.revenue)}</span>
              </div>
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 block">کل سفارشات ثبت‌شده</span>
                <span className="text-sm font-black text-gray-900 dark:text-white mt-1 block">{formatPersianDigits(repairPerfStats.count)} سفارش</span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-gray-500 font-bold">درحال عیب‌یابی و تعمیر:</span>
                <span className="font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                  {formatPersianDigits(repairPerfStats.activeCount)} دستگاه
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-gray-500 font-bold">آماده تحویل یا تحویل‌شده:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                  {formatPersianDigits(repairPerfStats.completedCount)} دستگاه
                </span>
              </div>
            </div>

            {repairPerfStats.devices.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-gray-400 block mb-1">تفکیک دستگاه‌ها:</span>
                {repairPerfStats.devices.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{d.name}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formatPersianDigits(d.count)} عدد</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Link to="/repairs" className="w-full block">
              <Button variant="outline" className="w-full text-xs font-bold gap-2 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200">
                <Wrench size={14} />
                مدیریت سفارشات تعمیرات
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
