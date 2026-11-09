import React, { useState, useEffect } from 'react';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { Console, ConsoleStatus, Tariff, AppUser, Session, Product, ClientTier, SystemSettings, Promotion, TariffInterval } from '../types';
import { Card, Button, Badge, Input, Modal, SegmentToggle, ToggleOption } from '../components/ui/common';
import { 
  Monitor, 
  Trash2, 
  Plus, 
  Search,
  Play, 
  Square, 
  ChevronRight, 
  ChevronDown,
  Clock, 
  User, 
  Users,
  Tag, 
  ShoppingCart, 
  ArrowRightLeft,
  ReceiptText,
  X,
  CheckCircle2,
  Edit2,
  Gamepad2,
  Glasses,
  AlertTriangle,
  Volume2,
  Calendar,
  Pause,
  CreditCard,
  Wallet,
  Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatPersianNumber, formatPersianDigits } from '../lib/utils';
import { SearchableSelect } from '../components/SearchableSelect';

// --- Utility Helpers ---
const formatPrice = (p: number) => formatPersianNumber(p) + ' تومان';

const getConsoleIcon = (type: string, size = 28) => {
  const t = type.toUpperCase();
  if (t.includes('PS')) return <Gamepad2 size={size} />;
  if (t.includes('XBOX')) return <Gamepad2 size={size} />;
  if (t.includes('VR')) return <Glasses size={size} />;
  if (t.includes('PC')) return <Monitor size={size} />;
  return <Monitor size={size} />;
};

const calculateLiveCost = (startTime: string, pricePerHour: number) => {
  const start = new Date(startTime).getTime();
  const now = new Date().getTime();
  const seconds = Math.max(0, (now - start) / 1000);
  const cost = (seconds / 3600) * pricePerHour;
  return { seconds, cost };
};

interface SessionCostBreakdown {
  consoleId?: string;
  consoleName?: string;
  tariffId?: string;
  name: string;
  pricePerHour: number;
  durationSeconds: number;
  cost: number;
  isActive: boolean;
  startTime?: string;
  endTime?: string;
}

export const getTariffEffectiveHourlyRate = (tariff?: Tariff, session?: Session): number => {
  if (!tariff) return 0;
  const playerCount = (session?.userIds && session.userIds.length > 0) ? session.userIds.length : 1;
  if (tariff.rates) {
    if (playerCount === 2 && tariff.rates.double) return Number(tariff.rates.double);
    if (playerCount === 3 && tariff.rates.triple) return Number(tariff.rates.triple);
    if (playerCount >= 4 && tariff.rates.quad) return Number(tariff.rates.quad);
    if (tariff.rates.single) return Number(tariff.rates.single);
  }
  return Number(tariff.pricePerHour) || 0;
};

const calculateSessionLiveCost = (
  session: Session, 
  tariffs: Tariff[], 
  consoles: Console[] = [], 
  endTimeOverride?: string
) => {
  const endTimeMs = endTimeOverride ? new Date(endTimeOverride).getTime() : new Date().getTime();
  const currentTariff = tariffs.find(t => t.id === session.tariffId);
  const currentPricePerHour = getTariffEffectiveHourlyRate(currentTariff, session);
  const currentConsole = consoles.find(c => c.id === session.consoleId);

  let totalSeconds = 0;
  let accumulatedCost = 0;
  const intervals: SessionCostBreakdown[] = [];

  // 1. Process history intervals (completed intervals before console transfer or tariff changes)
  if (session.tariffHistory && session.tariffHistory.length > 0) {
    session.tariffHistory.forEach((historyItem: any) => {
      const itemCost = Number(historyItem.cost) || 0;
      const itemDuration = Number(historyItem.durationSeconds) || 0;
      accumulatedCost += itemCost;
      totalSeconds += itemDuration;

      const consoleLabel = historyItem.consoleName ? `${historyItem.consoleName} - ` : '';
      const tariffLabel = historyItem.tariffName || 'تعرفه قبلی';

      intervals.push({
        consoleId: historyItem.consoleId,
        consoleName: historyItem.consoleName,
        tariffId: historyItem.tariffId,
        name: `${consoleLabel}${tariffLabel}`,
        pricePerHour: historyItem.pricePerHour || 0,
        durationSeconds: itemDuration,
        cost: itemCost,
        isActive: false,
        startTime: historyItem.startTime,
        endTime: historyItem.endTime
      });
    });
  }

  // 2. Process current active interval only if session is not already completed
  if (session.status !== 'completed') {
    const currentIntervalStartStr = session.tariffHistory && session.tariffHistory.length > 0
      ? session.tariffHistory[session.tariffHistory.length - 1].endTime || session.startTime
      : session.startTime;
    const currentIntervalStartMs = new Date(currentIntervalStartStr).getTime();

    let currentIntervalSeconds = 0;

    if (session.isPaused) {
      currentIntervalSeconds = session.accumulatedSeconds || 0;
    } else {
      // Check if a pause & resume occurred during THIS active interval
      const lastResumeMs = session.lastResumeTime ? new Date(session.lastResumeTime).getTime() : 0;
      const isResumeInThisInterval = lastResumeMs > currentIntervalStartMs;
      const segmentStartMs = isResumeInThisInterval ? lastResumeMs : currentIntervalStartMs;
      const currentSegmentSeconds = Math.max(0, (endTimeMs - segmentStartMs) / 1000);
      const priorAccumulated = isResumeInThisInterval ? (session.accumulatedSeconds || 0) : 0;
      currentIntervalSeconds = priorAccumulated + currentSegmentSeconds;
    }

    const currentCost = (currentIntervalSeconds / 3600) * currentPricePerHour;
    accumulatedCost += currentCost;
    totalSeconds += currentIntervalSeconds;

    const currentConsoleLabel = currentConsole ? `${currentConsole.name} (${currentConsole.type}) - ` : '';
    const currentTariffLabel = currentTariff ? currentTariff.name : 'تعرفه فعلی';

    intervals.push({
      consoleId: session.consoleId,
      consoleName: currentConsole ? `${currentConsole.name} (${currentConsole.type})` : undefined,
      tariffId: session.tariffId,
      name: `${currentConsoleLabel}${currentTariffLabel}${session.isPaused ? ' (متوقف شده)' : ''}`,
      pricePerHour: currentPricePerHour,
      durationSeconds: currentIntervalSeconds,
      cost: currentCost,
      isActive: true,
      startTime: currentIntervalStartStr,
      endTime: endTimeOverride || new Date().toISOString()
    });
  }

  return {
    seconds: Math.round(totalSeconds),
    cost: Math.round(accumulatedCost),
    intervals
  };
};

// --- Components ---

function ConsoleCard({ 
  console, 
  consoles,
  tariffs,
  clients,
  activeSession,
  settings,
  reservations,
  onStart, 
  onStop,
  onPause,
  onResume,
  onCancel,
  onAction,
  onRemoveItem,
  onDelete,
  onEdit,
  onUpdateSession,
  promotions,
  tiers
}: { 
  console: Console, 
  consoles?: Console[],
  tariffs: Tariff[],
  clients: AppUser[],
  activeSession?: Session,
  settings?: SystemSettings,
  reservations?: any[],
  onStart: (consoleId: string) => void, 
  onStop: (session: Session) => void,
  onPause: (session: Session) => void,
  onResume: (session: Session) => void,
  onCancel: (session: Session) => void,
  onAction: (type: 'change_console' | 'change_tariff' | 'add_product', session: Session) => void,
  onRemoveItem: (session: Session, productId: string) => void,
  onDelete: (id: string) => void,
  onEdit: (console: Console) => void,
  onUpdateSession: (id: string, data: any) => void,
  promotions?: Promotion[],
  tiers?: ClientTier[],
  key?: any
}) {
  const [liveInfo, setLiveInfo] = useState({ seconds: 0, cost: 0, intervals: [] as SessionCostBreakdown[] });
  const [isNearLimit, setIsNearLimit] = useState(false);
  const [upcomingRes, setUpcomingRes] = useState<any>(null);

  const currentTariff = tariffs.find(t => t.id === activeSession?.tariffId);
  const currentUser = clients.find(u => u.id === activeSession?.userId);

  useEffect(() => {
    // Check for reservations every minute
    const checkReservations = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const res = (reservations || []).find(r => 
        r.consoleId === console.id && 
        r.status === 'confirmed' && 
        r.date === todayStr
      );

      if (res) {
        const [h, m] = res.startTime.split(':').map(Number);
        const resTime = new Date();
        resTime.setHours(h, m, 0, 0);
        const diffMs = resTime.getTime() - now.getTime();
        const diffMin = Math.floor(diffMs / (1000 * 60));

        if (diffMin > 0 && diffMin <= 60) {
          setUpcomingRes({ ...res, minutesToStart: diffMin });
        } else {
          setUpcomingRes(null);
        }
      } else {
        setUpcomingRes(null);
      }
    };

    checkReservations();
    const resInterval = setInterval(checkReservations, 30000); // Check every 30s
    return () => clearInterval(resInterval);
  }, [reservations, console.id]);

  useEffect(() => {
    let interval: any;
    if (activeSession && currentTariff) {
      const update = () => {
        const info = calculateSessionLiveCost(activeSession, tariffs, consoles || []);
        
        let discountedCost = info.cost;

        // Apply Tier Discount if client exists
        if (currentUser && !currentUser.isGuest && tiers) {
          const playTime = currentUser.totalPlayTime || 0;
          const sortedTiers = [...tiers].sort((a, b) => b.minPlayTime - a.minPlayTime);
          const matchedTier = sortedTiers.find(t => playTime >= t.minPlayTime);
          if (matchedTier && matchedTier.discountPercentage > 0) {
            discountedCost -= (discountedCost * matchedTier.discountPercentage) / 100;
          }
        }

        // Apply Promotion Discount
        const now = new Date();
        if (promotions) {
          const activePromo = promotions.find(p => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            end.setHours(23, 59, 59, 999);
            return p.isActive && now >= start && now <= end;
          });
          if (activePromo) {
             discountedCost -= (discountedCost * activePromo.discountPercentage) / 100;
          }
        }

        setLiveInfo({ seconds: info.seconds, cost: Math.round(discountedCost), intervals: info.intervals });

        // Limit & Alarm Logic
        if (activeSession.limitType && activeSession.limitType !== 'none' && activeSession.limitValue) {
          let remaining = 0;
          const warningMinutes = settings?.alarmMinuteWarning || 2;
          
          if (activeSession.limitType === 'time') {
            remaining = activeSession.limitValue - (info.seconds / 60);
          } else if (activeSession.limitType === 'amount') {
            const minutesForAmount = (activeSession.limitValue / currentTariff.pricePerHour) * 60;
            remaining = minutesForAmount - (info.seconds / 60);
          }

          if (remaining > 0 && remaining <= warningMinutes) {
            setIsNearLimit(true);
            // Trigger alarm if not already triggered
            if (!activeSession.isAlarmTriggered && settings?.alarmEnabled) {
              onUpdateSession(activeSession.id, { isAlarmTriggered: true });
              // Play a sound if possible (optional, but requested "sound settings")
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.play().catch(() => {});
            }
          } else if (remaining <= 0) {
              setIsNearLimit(true); // Red alert for exceeded
          } else {
            setIsNearLimit(false);
          }
        }
      };
      update();
      interval = setInterval(update, 1000); // Check every 1s for real-time
    }
    return () => clearInterval(interval);
  }, [activeSession, currentTariff, settings, tariffs, currentUser, promotions, tiers]);

  const productTotal = (activeSession?.addedItems || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    idle: 'success',
    active: 'info',
    reserved: 'warning',
    maintenance: 'danger'
  };

  const statusLabels = {
    idle: 'آزاد',
    active: 'در حال بازی',
    reserved: 'رزرو شده',
    maintenance: 'در دست تعمیر'
  };

  return (
    <Card className={cn(
      "relative group overflow-hidden border-2 transition-all duration-300 bg-white dark:bg-slate-800 flex flex-col justify-between h-[560px] p-5 rounded-3xl shadow-sm hover:shadow-md",
      console.status === 'active' ? "border-primary-theme shadow-primary-theme/10" : "border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-slate-600"
    )}>
      {console.status === 'active' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-theme/5 -mr-16 -mt-16 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* ZONE 1: Fixed Header */}
      <div className="shrink-0">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0",
              console.status === 'active' 
                ? "bg-primary-theme text-white shadow-md shadow-primary-theme/20" 
                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-slate-700 dark:group-hover:text-indigo-400"
            )}>
              {getConsoleIcon(console.type)}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                {console.name} <span className="text-gray-400 dark:text-slate-500 text-xs font-medium mr-1">({console.type})</span>
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                {console.status === 'active' ? 'در حال استفاده' : (console.status === 'idle' ? 'آماده پذیرش کاربر' : statusLabels[console.status])}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {console.status === 'idle' && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                <button 
                  onClick={() => onEdit(console)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="ویرایش دستگاه"
                >
                  <Edit2 size={15} />
                </button>
                <button 
                  onClick={() => onDelete(console.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="حذف دستگاه"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
            <Badge variant={statusColors[console.status] as any} className="text-xs px-2.5 py-1">
              {statusLabels[console.status]}
            </Badge>
          </div>
        </div>

        {upcomingRes && (
          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 animate-pulse text-xs">
            <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-800 text-amber-600 flex items-center justify-center shrink-0">
               <Calendar size={13} />
            </div>
            <p className="text-[11px] font-bold text-gray-700 dark:text-amber-200 truncate">
              رزرو ساعت {upcomingRes.startTime} ({formatPersianDigits(upcomingRes.minutesToStart)} دقیقه دیگر)
            </p>
          </div>
        )}
      </div>

      {/* ZONE 2: Fixed-Height Scrollable Body */}
      <div className="flex-1 flex flex-col justify-between my-2 overflow-hidden">
        {console.status === 'active' && activeSession ? (
          <div className="flex flex-col justify-between h-full space-y-2">
            {/* Session Info Rows */}
            <div className="space-y-1.5 pt-2 border-t border-dashed border-gray-100 dark:border-slate-700 text-xs shrink-0">
              {(() => {
                const sessionUserNames = (activeSession.userIds && activeSession.userIds.length > 0)
                  ? activeSession.userIds.map(uid => clients.find(c => c.id === uid)?.name).filter(Boolean)
                  : (currentUser?.name ? [currentUser.name] : []);
                
                if (sessionUserNames.length > 1) {
                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                        <Users size={13} className="text-indigo-600" /> بازیکنان ({formatPersianDigits(sessionUserNames.length)} نفر):
                      </span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-400 truncate max-w-[160px] text-xs" title={sessionUserNames.join('، ')}>
                        {sessionUserNames.join('، ')}
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1 text-[11px]"><User size={13} /> مشتری:</span>
                    <span className="font-bold text-gray-900 dark:text-white text-xs truncate max-w-[160px]">{currentUser?.name || 'مشتری گذری'}</span>
                  </div>
                );
              })()}

              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                  <Clock size={13} /> شروع: {activeSession.startTime ? new Date(activeSession.startTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                </span>
                <button
                  type="button"
                  onClick={() => onAction('change_tariff', activeSession)}
                  className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900 transition-colors flex items-center gap-1 cursor-pointer"
                  title="کلیک برای تغییر یا جابه‌جایی تعرفه"
                >
                  <Tag size={12} className="inline ml-0.5 text-indigo-500" />
                  <span>{currentTariff?.name || 'تعرفه استاندارد'}</span>
                  <ChevronDown size={11} className="text-indigo-400" />
                </button>
              </div>

              {activeSession.isPaused && (
                <div className="py-1 px-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between text-amber-800 dark:text-amber-300 text-[11px]">
                  <span className="font-bold flex items-center gap-1.5">
                    <Pause size={12} className="animate-pulse text-amber-600" /> تایمر متوقف است
                  </span>
                  <span className="text-[10px] bg-amber-200/70 dark:bg-amber-900/60 px-1.5 py-0.5 rounded font-bold">هزینه متوقف</span>
                </div>
              )}
            </div>

            {/* Live Timer & Cost Box */}
            <div className={cn(
              "rounded-2xl p-3 text-center relative shrink-0 transition-colors",
              isNearLimit ? "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/30" : "bg-indigo-50/50 dark:bg-slate-900/60 border border-indigo-100/60 dark:border-slate-800"
            )}>
              {isNearLimit && (
                <div className="absolute top-2 right-2 flex items-center gap-1 text-rose-600 text-[9px] font-black">
                  <AlertTriangle size={12} className="animate-bounce" /> پایان زمان
                </div>
              )}
              
              <div className={cn(
                "flex items-center justify-center gap-2 mb-0.5",
                isNearLimit ? "text-rose-600" : "text-indigo-600 dark:text-indigo-400"
              )}>
                <Clock size={15} className={cn(activeSession.limitType !== 'none' && "animate-pulse")} />
                <span className="font-mono text-2xl font-black">{formatTime(liveInfo.seconds)}</span>
              </div>
              <p className="text-[9px] text-gray-400 dark:text-slate-500 font-bold tracking-wider uppercase mb-2">TIME ELAPSED</p>
              
              {activeSession.limitType && activeSession.limitType !== 'none' && (
                <div className="mb-2 flex items-center justify-center gap-2">
                   <Badge variant="outline" className={cn(
                     "text-[9px] font-black py-0.5 px-2",
                     isNearLimit ? "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-400" : "bg-indigo-100/50 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-400"
                   )}>
                     محدودیت: {activeSession.limitType === 'time' ? `${formatPersianDigits(activeSession.limitValue || 0)} دقیقه` : formatPrice(activeSession.limitValue || 0)}
                   </Badge>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 border-t border-indigo-100/60 dark:border-slate-700/80 pt-2">
                <div>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-none mb-1">{formatPrice(Math.round(liveInfo.cost))}</p>
                  <p className="text-[9px] text-gray-400 dark:text-slate-400 font-bold">هزینه بازی</p>
                </div>
                <div className="border-r border-indigo-100/60 dark:border-slate-700/80">
                  <p className="text-base font-black text-amber-600 dark:text-amber-400 leading-none mb-1">{formatPrice(productTotal)}</p>
                  <p className="text-[9px] text-gray-400 dark:text-slate-400 font-bold">هزینه بوفه</p>
                </div>
              </div>
            </div>

            {/* Added Items / Notes Scroll Box (Fixed Height so buttons never move!) */}
            <div className="h-[80px] shrink-0 overflow-y-auto rounded-xl bg-slate-50/80 dark:bg-slate-900/40 p-2 border border-slate-100 dark:border-slate-800 text-xs">
              {activeSession.addedItems && activeSession.addedItems.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeSession.addedItems.map((item, idx) => (
                    <Badge 
                      key={idx} 
                      variant="default" 
                      className="text-[10px] pr-1.5 pl-2 py-0.5 flex items-center gap-1.5 group/item cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      onClick={() => onRemoveItem(activeSession, item.productId)}
                      title="کلیک برای حذف یک عدد"
                    >
                      <span>{item.name} × {formatPersianDigits(item.quantity)}</span>
                      <Trash2 size={10} className="text-gray-400 group-hover/item:text-red-500" />
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                  سفارشی از بوفه ثبت نشده است
                </div>
              )}
            </div>
          </div>
        ) : console.status === 'idle' ? (
          /* Symmetrical Standby Panel for Idle Consoles */
          <div className="flex flex-col items-center justify-center h-full p-4 bg-slate-50/70 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200/90 dark:border-slate-800/80 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <Gamepad2 size={32} className="animate-pulse" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">دستگاه آماده شروع بازی</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">دستگاه آزاد و آماده پذیرش مشتری جدید است</p>
            </div>
            <div className="w-full bg-white dark:bg-slate-800/80 py-2 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">نرخ تعرفه پایه:</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-xs">
                {formatPrice(currentTariff?.rates?.single || currentTariff?.pricePerHour || 0)} / ساعت
              </span>
            </div>
          </div>
        ) : (
          /* Maintenance / Reserved Standby Panel */
          <div className="flex flex-col items-center justify-center h-full p-4 bg-rose-50/40 dark:bg-rose-950/20 rounded-2xl border border-dashed border-rose-200/80 dark:border-rose-900/40 text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>
            <h4 className="font-extrabold text-rose-900 dark:text-rose-200 text-sm">{statusLabels[console.status]}</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-400 font-medium">این دستگاه در حال حاضر در دسترس نیست</p>
          </div>
        )}
      </div>

      {/* ZONE 3: Fixed-Height Bottom Action Bar */}
      <div className="shrink-0 h-[105px] flex flex-col justify-end pt-2 border-t border-slate-100 dark:border-slate-700/80">
        {console.status === 'idle' ? (
          <div className="flex flex-col justify-between h-full">
            <div className="grid grid-cols-2 gap-2 h-8">
              <button 
                onClick={() => onEdit(console)}
                className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 size={13} /> تنظیمات دستگاه
              </button>
              <button 
                onClick={() => onStart(console.id)}
                className="h-8 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Tag size={13} /> انتخاب تعرفه
              </button>
            </div>
            <Button 
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-md shadow-indigo-500/20 group/btn" 
              onClick={() => onStart(console.id)}
            >
              <Play size={16} className="transition-transform group-hover/btn:scale-110 ml-1.5 fill-current" />
              شروع بازی جدید
            </Button>
          </div>
        ) : console.status === 'active' && activeSession ? (
          <div className="flex flex-col justify-between h-full">
            <div className="grid grid-cols-4 gap-1.5 h-8">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[11px] px-1 hover:border-indigo-600 hover:text-indigo-600"
                onClick={() => onAction('change_console', activeSession)}
                title="جابجایی به دستگاه دیگر"
              >
                <ArrowRightLeft size={13} className="ml-1" /> جابجایی
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[11px] px-1 hover:border-indigo-600 hover:text-indigo-600"
                onClick={() => onAction('add_product', activeSession)}
                title="سفارش از بوفه"
              >
                <ShoppingCart size={13} className="ml-1" /> سفارش
              </Button>
              {activeSession.isPaused ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[11px] px-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  onClick={() => onResume(activeSession)}
                  title="ادامه بازی"
                >
                  <Play size={13} className="ml-1 fill-current" /> ادامه
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[11px] px-1 bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                  onClick={() => onPause(activeSession)}
                  title="توقف موقت زمان"
                >
                  <Pause size={13} className="ml-1" /> توقف
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[11px] px-1 text-slate-500 border-slate-200 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                onClick={() => onCancel(activeSession)}
                title="لغو نشست بدون صورت‌حساب"
              >
                <Trash2 size={13} className="ml-1 text-rose-500" /> لغو
              </Button>
            </div>
            <Button 
              variant="danger" 
              className="w-full h-11 font-black text-xs rounded-2xl shadow-sm group/btn flex items-center justify-center gap-1.5" 
              onClick={() => onStop(activeSession)}
            >
              <Square size={15} className="fill-current ml-1" />
              پایان و تسویه حساب
            </Button>
          </div>
        ) : (
          <div className="flex flex-col justify-between h-full">
            <div className="h-8" />
            <Button variant="outline" className="w-full h-11 text-xs font-bold rounded-2xl" disabled>
              دستگاه در دسترس نیست
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Consoles() {
  const { data: consoles, loading: consolesLoading, error: consolesError } = useCollection<Console>('consoles');
  const { data: tariffs, loading: tariffsLoading, error: tariffsError } = useCollection<Tariff>('tariffs');
  const { data: clients } = useCollection<AppUser>('clients');
  const { data: tiers } = useCollection<ClientTier>('tiers');
  const { data: sessions } = useCollection<Session>('sessions');
  const { data: reservations } = useCollection<any>('reservations');
  const { data: products } = useCollection<Product>('products');
  const { data: settingsList } = useCollection<SystemSettings>('settings');
  const { data: promotions } = useCollection<Promotion>('promotions');
  const { add, update, remove, get } = useFirestore();

  const taxRate = settingsList && settingsList.length > 0 ? settingsList[0].taxRate : 0;

  const [activeTab, setActiveTab] = useState<'consoles' | 'tariffs'>('consoles');
  
  // Modals state
  const [isAddConsoleOpen, setIsAddConsoleOpen] = useState(false);
  const [editingConsoleId, setEditingConsoleId] = useState<string | null>(null);
  const [isAddTariffOpen, setIsAddTariffOpen] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ isOpen: boolean, type: 'console' | 'tariff', id: string }>({ isOpen: false, type: 'console', id: '' });
  const [startSessionModal, setStartSessionModal] = useState<{ isOpen: boolean, consoleId: string }>({ isOpen: false, consoleId: '' });
  const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: string, session: Session | null }>({ isOpen: false, type: '', session: null });
  const [actionModalTab, setActionModalTab] = useState<'tariff' | 'console'>('tariff');
  const [selectedMoveConsoleId, setSelectedMoveConsoleId] = useState<string | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<{ 
    isOpen: boolean, 
    session: Session | null, 
    finalData?: any,
    isTaxApplied: boolean,
    paymentMethod: 'card' | 'cash' | 'wallet',
    sessionUserIds?: string[]
  }>({ 
    isOpen: false, 
    session: null, 
    isTaxApplied: true, 
    paymentMethod: 'card',
    sessionUserIds: []
  });
  const [cancellingSession, setCancellingSession] = useState<Session | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Form states
  const [newConsole, setNewConsole] = useState({ name: '', type: 'PS5' });
  const [newTariff, setNewTariff] = useState({ name: '', pricePerHour: 0, consoleType: '' });
  const [sessionForm, setSessionForm] = useState({ 
    userId: '', 
    userIds: [] as string[],
    tariffId: '', 
    limitType: 'none' as 'none' | 'time' | 'amount', 
    limitValue: 0 
  });

  // Console logic
  const handleAddConsole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingConsoleId) {
      await update('consoles', editingConsoleId, newConsole);
      setEditingConsoleId(null);
    } else {
      await add('consoles', { ...newConsole, status: 'idle' });
    }
    setIsAddConsoleOpen(false);
    setNewConsole({ name: '', type: 'PS5' });
  };

  const handleEditConsole = (con: Console) => {
    setNewConsole({ name: con.name, type: con.type });
    setEditingConsoleId(con.id);
    setIsAddConsoleOpen(true);
  };

  const handleDeleteConsole = (id: string) => {
    setConfirmDeleteModal({ isOpen: true, type: 'console', id });
  };

  const handleDeleteTariff = (id: string) => {
    setConfirmDeleteModal({ isOpen: true, type: 'tariff', id });
  };

  const handleConfirmDelete = async () => {
    const { type, id } = confirmDeleteModal;
    if (type === 'console') {
      await remove('consoles', id);
    } else {
      await remove('tariffs', id);
    }
    setConfirmDeleteModal({ isOpen: false, type: 'console', id: '' });
  };

  // Tariff logic
  const handleAddTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    await add('tariffs', {
      ...newTariff,
      pricePerHour: Number(newTariff.pricePerHour)
    });
    setIsAddTariffOpen(false);
    setNewTariff({ name: '', pricePerHour: 0, consoleType: '' });
  };

  // Session logic
  const handleStartSession = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!sessionForm.tariffId) return alert('لطفا تعرفه را انتخاب کنید');

    const guestUser = clients?.find(c => c.isGuest);
    const chosenUserIds = sessionForm.userIds && sessionForm.userIds.length > 0
      ? sessionForm.userIds
      : (sessionForm.userId ? [sessionForm.userId] : (guestUser?.id ? [guestUser.id] : []));
    const finalUserId = chosenUserIds[0] || '';

    const sessionData: any = {
      consoleId: startSessionModal.consoleId,
      userId: finalUserId,
      userIds: chosenUserIds,
      tariffId: sessionForm.tariffId,
      startTime: new Date().toISOString(),
      lastResumeTime: new Date().toISOString(),
      accumulatedSeconds: 0,
      isPaused: false,
      status: 'running',
      addedItems: [],
      limitType: sessionForm.limitType,
      limitValue: Number(sessionForm.limitValue) || 0,
      isAlarmTriggered: false
    };

    const session = await add('sessions', sessionData);
    if (session) {
      await update('consoles', startSessionModal.consoleId, { 
        status: 'active', 
        currentSessionId: session.id 
      });
    }
    
    setStartSessionModal({ isOpen: false, consoleId: '' });
    setSessionForm({ userId: '', userIds: [], tariffId: '', limitType: 'none', limitValue: 0 });
  };

  const handlePauseSession = async (session: Session) => {
    const now = new Date();
    const currentIntervalStartStr = session.tariffHistory && session.tariffHistory.length > 0
      ? session.tariffHistory[session.tariffHistory.length - 1].endTime || session.startTime
      : session.startTime;
    const currentIntervalStartMs = new Date(currentIntervalStartStr).getTime();

    const lastResumeMs = session.lastResumeTime ? new Date(session.lastResumeTime).getTime() : 0;
    const isResumeInThisInterval = lastResumeMs > currentIntervalStartMs;
    const segmentStartMs = isResumeInThisInterval ? lastResumeMs : currentIntervalStartMs;

    const currentSegmentSeconds = Math.max(0, (now.getTime() - segmentStartMs) / 1000);
    const priorAccumulated = isResumeInThisInterval ? (session.accumulatedSeconds || 0) : 0;
    const totalAccumulated = priorAccumulated + currentSegmentSeconds;

    await update('sessions', session.id, {
      isPaused: true,
      pausedAt: now.toISOString(),
      accumulatedSeconds: Math.round(totalAccumulated)
    });
  };

  const handleResumeSession = async (session: Session) => {
    await update('sessions', session.id, {
      isPaused: false,
      pausedAt: null,
      lastResumeTime: new Date().toISOString()
    });
  };

  const handleCancelSession = (session: Session) => {
    setCancellingSession(session);
  };

  const confirmCancelSession = async () => {
    if (!cancellingSession) return;
    const session = cancellingSession;
    setCancelLoading(true);

    try {
      // Return product stocks if any were added
      if (session.addedItems && session.addedItems.length > 0) {
        for (const item of session.addedItems) {
          const prod = products?.find(p => p.id === item.productId);
          if (prod) {
            if (prod.rawMaterialId && prod.gramsPerServing) {
              const rawProd = products?.find(p => p.id === prod.rawMaterialId);
              if (rawProd) {
                const currentGrams = Number(rawProd.stock) || 0;
                await update('products', rawProd.id, {
                  stock: currentGrams + (prod.gramsPerServing * item.quantity)
                });
              }
            } else {
              await update('products', prod.id, { stock: (prod.stock || 0) + item.quantity });
            }
          }
        }
      }

      await remove('sessions', session.id);
      await update('consoles', session.consoleId, { status: 'idle', currentSessionId: undefined });
      setCancellingSession(null);
    } catch (err) {
      console.error('Error cancelling session:', err);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleStopSession = async (session: Session) => {
    const now = new Date();
    const info = calculateSessionLiveCost(session, safeTariffs, safeConsoles, now.toISOString());
    const baseSessionCost = Math.round(info.cost);
    let sessionCost = baseSessionCost;
    
    // Apply Tier Discount if client exists
    let tierDiscount = 0;
    if (session.userId && clients && tiers) {
      const client = clients.find(c => c.id === session.userId);
      if (client && !client.isGuest) {
        const playTime = client.totalPlayTime || 0;
        const sortedTiers = [...tiers].sort((a, b) => b.minPlayTime - a.minPlayTime);
        const matchedTier = sortedTiers.find(t => playTime >= t.minPlayTime);
        if (matchedTier && matchedTier.discountPercentage > 0) {
          tierDiscount = Math.round((baseSessionCost * matchedTier.discountPercentage) / 100);
          sessionCost -= tierDiscount;
        }
      }
    }

    // Apply Promotion Discount
    let promoDiscount = 0;
    let activePromoName = '';
    if (promotions) {
      const activePromo = promotions.find(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        end.setHours(23, 59, 59, 999); // Make end date inclusive
        return p.isActive && now >= start && now <= end;
      });
      if (activePromo) {
        promoDiscount = Math.round((baseSessionCost * activePromo.discountPercentage) / 100);
        sessionCost -= promoDiscount;
        activePromoName = activePromo.name;
      }
    }

    const productsCost = (session.addedItems || []).reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    const subtotal = Math.max(0, sessionCost) + productsCost;
    const taxAmount = Math.round((subtotal * taxRate) / 100);

    const initialUserIds = (session.userIds && session.userIds.length > 0)
      ? [...session.userIds]
      : (session.userId ? [session.userId] : []);

    setCheckoutModal({ 
      isOpen: true, 
      session,
      isTaxApplied: true,
      paymentMethod: 'card',
      sessionUserIds: initialUserIds,
      finalData: {
        baseSessionCost,
        sessionCost,
        productsCost,
        tierDiscount,
        promoDiscount,
        promoName: activePromoName,
        taxAmount,
        total: subtotal + taxAmount,
        duration: info.seconds,
        intervals: info.intervals
      }
    });
  };

  const toggleTax = () => {
    if (!checkoutModal.finalData) return;
    
    const isNowApplied = !checkoutModal.isTaxApplied;
    const subtotal = checkoutModal.finalData.sessionCost + checkoutModal.finalData.productsCost;
    const newTaxAmount = isNowApplied ? Math.round((subtotal * taxRate) / 100) : 0;
    
    setCheckoutModal({
      ...checkoutModal,
      isTaxApplied: isNowApplied,
      finalData: {
        ...checkoutModal.finalData,
        taxAmount: newTaxAmount,
        total: subtotal + newTaxAmount
      }
    });
  };

  const confirmCheckout = async () => {
    if (!checkoutModal.session || !checkoutModal.finalData) return;
    
    const sess = checkoutModal.session;
    const totalAmountPaid = checkoutModal.finalData.total;
    const method = checkoutModal.paymentMethod || 'card';

    const userIds = (checkoutModal.sessionUserIds && checkoutModal.sessionUserIds.length > 0)
      ? checkoutModal.sessionUserIds
      : (sess.userIds && sess.userIds.length > 0 ? sess.userIds : (sess.userId ? [sess.userId] : []));

    const splitCount = Math.max(1, userIds.length);
    const costPerUser = Math.round(totalAmountPaid / splitCount);

    const additionalMinutes = Math.round((checkoutModal.finalData.duration || 0) / 60);

    // Total Points calculation:
    // 10 points per hour of play
    const playPointsAwarded = Math.floor((additionalMinutes / 60) * 10);
    // 1 point per 5,000 Tomans
    const purchasePointsAwarded = Math.floor(totalAmountPaid / 5000);
    const isDoublePointsActive = true; 
    const multiplier = isDoublePointsActive ? 2 : 1;
    const totalNewPointsAwarded = (playPointsAwarded + purchasePointsAwarded) * multiplier;
    const pointsPerUser = Math.floor(totalNewPointsAwarded / splitCount);

    const finalIntervals = (checkoutModal.finalData.intervals || []).map((inv: any) => {
      let rawTariffName = inv.tariffName || inv.name || 'تعرفه';
      if (inv.consoleName && rawTariffName.startsWith(inv.consoleName)) {
        rawTariffName = rawTariffName.slice(inv.consoleName.length).replace(/^[\s-]+/, '').replace(/\(متوقف شده\)/, '').trim();
      }
      return {
        consoleId: inv.consoleId || sess.consoleId,
        consoleName: inv.consoleName || '',
        tariffId: inv.tariffId || sess.tariffId,
        tariffName: rawTariffName || 'تعرفه',
        pricePerHour: inv.pricePerHour || 0,
        durationSeconds: Math.round(inv.durationSeconds || 0),
        cost: Math.round(inv.cost || 0),
        startTime: inv.startTime || sess.startTime,
        endTime: inv.endTime || new Date().toISOString()
      };
    });

    const baseSessionAmount = checkoutModal.finalData.baseSessionCost 
      || finalIntervals.reduce((sum: number, it: any) => sum + Math.round(it.cost || 0), 0)
      || checkoutModal.finalData.sessionCost;

    await update('sessions', sess.id, { 
      status: 'completed', 
      endTime: new Date().toISOString(),
      userId: userIds[0] || sess.userId || '',
      userIds: userIds,
      splitUserIds: userIds,
      splitCount,
      costPerUser,
      pointsPerUser,
      baseSessionAmount: baseSessionAmount,
      totalSessionAmount: baseSessionAmount, // Gross game cost matching sum of intervals
      netSessionAmount: checkoutModal.finalData.sessionCost, // Net game cost after discounts
      totalProductsAmount: checkoutModal.finalData.productsCost,
      tierDiscountAmount: checkoutModal.finalData.tierDiscount,
      promoDiscountAmount: checkoutModal.finalData.promoDiscount,
      promoName: checkoutModal.finalData.promoName,
      taxAmount: checkoutModal.finalData.taxAmount,
      totalCost: totalAmountPaid,
      duration: checkoutModal.finalData.duration,
      tariffHistory: finalIntervals,
      paymentMethod: method
    });

    // Award points, play time, and cost to each player's account
    for (const uid of userIds) {
      const user = await get('clients', uid) as AppUser | null;
      if (user && !user.isGuest) {
        const updates: Partial<AppUser> = {
          totalPlayTime: (Number(user.totalPlayTime) || 0) + additionalMinutes,
          totalPaid: (Number(user.totalPaid) || 0) + costPerUser,
          points: (Number(user.points) || 0) + pointsPerUser
        };

        if (method === 'wallet') {
          updates.balance = (Number(user.balance) || 0) - costPerUser;
        }

        await update('clients', uid, updates);
      }
    }

    await update('consoles', sess.consoleId, { status: 'idle', currentSessionId: undefined });
    setCheckoutModal(prev => ({ ...prev, isOpen: false, session: null, paymentMethod: 'card', sessionUserIds: [] }));
  };

  const handleSessionAction = async (type: string, data: any) => {
    if (!actionModal.session) return;
    const sess = actionModal.session;
    const liveSess = safeSessions.find(s => s.id === sess.id) || sess;

    if (type === 'change_console') {
      const now = new Date();
      const changeTime = now.toISOString();

      // 1. Calculate duration and cost on current console & tariff up to this moment
      const costInfo = calculateSessionLiveCost(liveSess, safeTariffs, safeConsoles, changeTime);
      const activeInterval = costInfo.intervals.find(i => i.isActive) || costInfo.intervals[costInfo.intervals.length - 1];

      const oldTariff = safeTariffs.find(t => t.id === liveSess.tariffId) || safeTariffs[0];
      const oldPricePerHour = getTariffEffectiveHourlyRate(oldTariff, liveSess);
      const oldConsole = safeConsoles.find(c => c.id === liveSess.consoleId);
      const oldConsoleName = oldConsole ? `${oldConsole.name} (${oldConsole.type})` : '';

      const finishedInterval: TariffInterval = {
        consoleId: liveSess.consoleId,
        consoleName: oldConsoleName,
        tariffId: liveSess.tariffId,
        tariffName: oldTariff ? oldTariff.name : 'تعرفه قبلی',
        pricePerHour: oldPricePerHour,
        startTime: activeInterval?.startTime || liveSess.startTime,
        endTime: changeTime,
        durationSeconds: Math.round(activeInterval?.durationSeconds || 0),
        cost: Math.round(activeInterval?.cost || 0)
      };

      const existingHistory = liveSess.tariffHistory || [];
      const updatedTariffHistory = [...existingHistory, finishedInterval];
      const newTariffId = data.newTariffId || liveSess.tariffId;

      // 2. Free old console and activate new console
      await update('consoles', liveSess.consoleId, { status: 'idle', currentSessionId: undefined });
      await update('consoles', data.newConsoleId, { status: 'active', currentSessionId: liveSess.id });

      // 3. Update session for new console and reset interval timer to transfer moment
      await update('sessions', liveSess.id, { 
        consoleId: data.newConsoleId,
        tariffId: newTariffId,
        tariffHistory: updatedTariffHistory,
        accumulatedSeconds: 0,
        lastResumeTime: changeTime,
        isPaused: liveSess.isPaused || false,
        pausedAt: liveSess.isPaused ? changeTime : null,
        limitType: data.limitType || liveSess.limitType || 'none',
        limitValue: data.limitValue !== undefined ? Number(data.limitValue) : (liveSess.limitValue || 0)
      });
      setSelectedMoveConsoleId(null);
      setActionModal({ isOpen: false, type: '', session: null });
    } else if (type === 'change_tariff') {
      if (!data.newTariffId || data.newTariffId === liveSess.tariffId) {
        setActionModal({ isOpen: false, type: '', session: null });
        return;
      }

      const now = new Date();
      const changeTime = now.toISOString();

      // 1. Calculate duration and cost on current tariff up to this moment
      const costInfo = calculateSessionLiveCost(liveSess, safeTariffs, safeConsoles, changeTime);
      const activeInterval = costInfo.intervals.find(i => i.isActive) || costInfo.intervals[costInfo.intervals.length - 1];

      const oldTariff = safeTariffs.find(t => t.id === liveSess.tariffId) || safeTariffs[0];
      const oldPricePerHour = getTariffEffectiveHourlyRate(oldTariff, liveSess);
      const currentConsole = safeConsoles.find(c => c.id === liveSess.consoleId);
      const currentConsoleName = currentConsole ? `${currentConsole.name} (${currentConsole.type})` : '';

      const finishedInterval: TariffInterval = {
        consoleId: liveSess.consoleId,
        consoleName: currentConsoleName,
        tariffId: liveSess.tariffId,
        tariffName: oldTariff ? oldTariff.name : 'تعرفه قبلی',
        pricePerHour: oldPricePerHour,
        startTime: activeInterval?.startTime || liveSess.startTime,
        endTime: changeTime,
        durationSeconds: Math.round(activeInterval?.durationSeconds || 0),
        cost: Math.round(activeInterval?.cost || 0)
      };

      const existingHistory = liveSess.tariffHistory || [];
      const updatedHistory = [...existingHistory, finishedInterval];

      await update('sessions', liveSess.id, { 
        tariffId: data.newTariffId,
        tariffHistory: updatedHistory,
        accumulatedSeconds: 0,
        lastResumeTime: changeTime,
        isPaused: liveSess.isPaused || false,
        pausedAt: liveSess.isPaused ? changeTime : null
      });
      setActionModal({ isOpen: false, type: '', session: null });
    } else if (type === 'add_product') {
      const addedItems = sess.addedItems || [];
      const existingIdx = addedItems.findIndex(i => i.productId === data.product.id);
      let newItems = [...addedItems];
      if (existingIdx > -1) {
        newItems[existingIdx].quantity += 1;
      } else {
        newItems.push({ 
          productId: data.product.id, 
          name: data.product.name, 
          price: data.product.price, 
          quantity: 1 
        });
      }
      
      // Update session items
      await update('sessions', sess.id, { addedItems: newItems });
      
      // Deduct from product stock (in grams for raw material coffee, or units for normal items)
      if (data.product.rawMaterialId && data.product.gramsPerServing) {
        const rawProd = products?.find(p => p.id === data.product.rawMaterialId);
        if (rawProd) {
          const currentGrams = Number(rawProd.stock) || 0;
          await update('products', rawProd.id, {
            stock: Math.max(0, currentGrams - data.product.gramsPerServing)
          });
        }
      } else {
        const currentStock = parseInt(String(data.product.stock)) || 0;
        await update('products', data.product.id, { 
          stock: Math.max(0, currentStock - 1) 
        });
      }
    }
    setActionModal({ isOpen: false, type: '', session: null });
  };

  const handleRemoveItem = async (session: Session, productId: string) => {
    const addedItems = session.addedItems || [];
    const itemIdx = addedItems.findIndex(i => i.productId === productId);
    if (itemIdx === -1) return;

    let newItems = [...addedItems];
    const item = newItems[itemIdx];
    const removedPrice = item.price;

    if (item.quantity > 1) {
      newItems[itemIdx] = { ...item, quantity: item.quantity - 1 };
    } else {
      newItems.splice(itemIdx, 1);
    }

    // Update session in DB
    await update('sessions', session.id, { addedItems: newItems });

    // Restore stock (in grams for coffee raw material, or units for normal items)
    const product = products?.find(p => p.id === productId);
    if (product) {
      if (product.rawMaterialId && product.gramsPerServing) {
        const rawProd = products?.find(p => p.id === product.rawMaterialId);
        if (rawProd) {
          const currentGrams = Number(rawProd.stock) || 0;
          await update('products', rawProd.id, {
            stock: currentGrams + product.gramsPerServing
          });
        }
      } else {
        await update('products', product.id, { 
          stock: (parseInt(String(product.stock)) || 0) + 1 
        });
      }
    }

    // If checkout modal is open, we need to update its local state too
    if (checkoutModal.isOpen && checkoutModal.session?.id === session.id) {
      const currentFinalData = checkoutModal.finalData;
      if (currentFinalData) {
        const newProductsCost = currentFinalData.productsCost - removedPrice;
        const newSubtotal = currentFinalData.sessionCost + newProductsCost;
        const newTaxAmount = Math.round((newSubtotal * taxRate) / 100);
        
        setCheckoutModal({
          ...checkoutModal,
          session: { ...session, addedItems: newItems },
          finalData: {
            ...currentFinalData,
            productsCost: newProductsCost,
            taxAmount: newTaxAmount,
            total: newSubtotal + newTaxAmount
          }
        });
      }
    }
  };

  if (consolesLoading || tariffsLoading) return (
    <div className="p-8 text-center bg-white rounded-3xl m-8 shadow-sm">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-500 font-bold">درحال بارگذاری اطلاعات...</p>
    </div>
  );

  if (consolesError || tariffsError) return (
    <div className="p-8 text-center bg-red-50 rounded-3xl m-8 border border-red-100">
      <p className="text-red-600 font-bold mb-2">خطا در بارگذاری اطلاعات</p>
      <p className="text-red-400 text-sm whitespace-pre-wrap">{consolesError || tariffsError}</p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>تلاش مجدد</Button>
    </div>
  );

  const safeConsoles = consoles || [];
  const safeTariffs = tariffs || [];
  const safeClients = clients || [];
  const safeSessions = sessions || [];

  return (
    <div className="p-6 lg:p-10 text-right" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">کنترل مرکز سرگرمی</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">مدیریت دستگاه‌ها و سیستم محاسبه زمان</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            {activeTab === 'consoles' ? (
              <div className="flex items-center gap-2.5">
                {/* Unified Reservations Hover Tooltip Button */}
                <div className="relative group/globalres z-40">
                  <button
                    type="button"
                    className="h-10 px-3 md:px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center gap-2 font-bold text-xs cursor-pointer relative shadow-sm"
                  >
                    <Calendar size={16} />
                    <span>نوبت‌های امروز کلوپ</span>
                    {((reservations || []).filter(r => r.date === new Date().toISOString().split('T')[0])).length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse inline-block" />
                    )}
                  </button>

                  <div className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-5 hidden group-hover/globalres:block z-50 text-right">
                    <h5 className="text-xs font-black text-slate-800 dark:text-white mb-3 pb-1.5 border-b border-slate-50 dark:border-slate-800 flex items-center gap-1.5">
                      <Calendar size={14} className="text-indigo-600 dark:text-indigo-400" />
                      لیست رزروهای کلی امروز کلوپ
                    </h5>
                    {((reservations || []).filter(r => r.date === new Date().toISOString().split('T')[0])).length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-extrabold py-2">هیچ نوبتی برای امروز ثبت نشده است.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto">
                        {((reservations || []).filter(r => r.date === new Date().toISOString().split('T')[0])).map((res: any, idx: number) => {
                          const consoleObj = safeConsoles.find(c => c.id === res.consoleId);
                          return (
                            <div key={idx} className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-950 border border-slate-100 dark:border-slate-850">
                              <div className="flex justify-between items-center text-[10px] font-black">
                                <span className="text-slate-800 dark:text-white">{consoleObj ? consoleObj.name : 'دستگاه نامشخص'}</span>
                                <span className="text-indigo-500 dark:text-indigo-400 font-mono">{formatPersianDigits(res.startTime)} تا {formatPersianDigits(res.endTime)}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 font-bold">
                                به‌نام: {safeClients.find(c => c.id === res.userId)?.name || 'مشتری موردی'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={() => setIsAddConsoleOpen(true)} 
                  className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                >
                  <Plus size={18} className="ml-2" /> افزودن دستگاه
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => setIsAddTariffOpen(true)} 
                className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
              >
                <Plus size={18} className="ml-2" /> افزودن تعرفه
              </Button>
            )}
          </div>

          <SegmentToggle<'consoles' | 'tariffs'>
            options={[
              { id: 'consoles', label: 'دستگاه‌ها', icon: Monitor },
              { id: 'tariffs', label: 'تعرفه‌ها', icon: Tag }
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
            activeColor={activeTab === 'consoles' ? 'indigo' : 'emerald'}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'consoles' ? (
          <motion.div 
            key="consoles-grid"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
          >
            {safeConsoles.map(con => (
              <ConsoleCard 
                key={con.id} 
                console={con} 
                consoles={safeConsoles}
                tariffs={safeTariffs}
                clients={safeClients}
                promotions={promotions}
                tiers={tiers}
                settings={settingsList?.[0]}
                activeSession={safeSessions.find(s => s.id === con.currentSessionId && s.status === 'running')}
                reservations={reservations}
                onStart={(id) => {
                  // Check for upcoming reservations to set auto-limit
                  const now = new Date();
                  const todayStr = now.toISOString().split('T')[0];
                  const res = (reservations || []).find(r => 
                    r.consoleId === id && 
                    r.status === 'confirmed' && 
                    r.date === todayStr
                  );

                  if (res) {
                    const [h, m] = res.startTime.split(':').map(Number);
                    const resTime = new Date();
                    resTime.setHours(h, m, 0, 0);
                    const diffMin = Math.floor((resTime.getTime() - now.getTime()) / (1000 * 60));

                    if (diffMin > 0 && diffMin <= 60) {
                      setSessionForm(prev => ({
                        ...prev,
                        limitType: 'time',
                        limitValue: diffMin
                      }));
                    } else {
                      setSessionForm(prev => ({ ...prev, limitType: 'none', limitValue: 0 }));
                    }
                  } else {
                    setSessionForm(prev => ({ ...prev, limitType: 'none', limitValue: 0 }));
                  }

                  setStartSessionModal({ isOpen: true, consoleId: id });
                }}
                onStop={handleStopSession}
                onPause={handlePauseSession}
                onResume={handleResumeSession}
                onCancel={handleCancelSession}
                onRemoveItem={handleRemoveItem}
                onDelete={handleDeleteConsole}
                onEdit={handleEditConsole}
                onAction={(type, sess) => {
                  if (type === 'change_tariff') {
                    setActionModalTab('tariff');
                  } else if (type === 'change_console') {
                    setActionModalTab('console');
                  }
                  setSelectedMoveConsoleId(null);
                  setActionModal({ isOpen: true, type, session: sess });
                }}
                onUpdateSession={(id, data) => update('sessions', id, data)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="tariffs-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto space-y-4"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">لیست تعرفه‌های بازی</h3>
            </div>
            
            {safeTariffs.length === 0 && <div className="text-center py-10 text-gray-400 italic">هیچ تعرفه‌ای تعریف نشده است</div>}

            <div className="grid grid-cols-1 gap-4">
              {safeTariffs.map(t => (
                <Card key={t.id} className="p-6 flex items-center justify-between group">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Tag size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 text-lg">{t.name}</h4>
                        {t.consoleType && (
                          <Badge variant="info" className="text-[8px]">
                            {t.consoleType}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-emerald-600 font-bold">{formatPrice(t.pricePerHour)} <span className="text-xs text-gray-400 font-medium mr-1.5 leading-none mt-1 inline-block">بر هر ساعت</span></p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTariff(t.id)} 
                    className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="حذف تعرفه"
                  >
                    <Trash2 size={20} />
                  </button>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Modals --- */}

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={confirmDeleteModal.isOpen} 
        onClose={() => setConfirmDeleteModal({ ...confirmDeleteModal, isOpen: false })} 
        title="تایید حذف"
      >
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 size={40} />
          </div>
          <p className="text-gray-900 font-bold text-lg mb-2">آیا از حذف این مورد مطمئن هستید؟</p>
          <p className="text-gray-400 text-sm mb-10">این عملیات غیر قابل بازگشت است.</p>
          
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="flex-1 py-4 rounded-2xl"
              onClick={() => setConfirmDeleteModal({ ...confirmDeleteModal, isOpen: false })}
            >
              انصراف
            </Button>
            <Button 
              variant="danger" 
              className="flex-1 py-4 rounded-2xl"
              onClick={handleConfirmDelete}
            >
              حذف شود
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adding Console Modal */}
      <Modal 
        isOpen={isAddConsoleOpen} 
        onClose={() => {
          setIsAddConsoleOpen(false);
          setEditingConsoleId(null);
          setNewConsole({ name: '', type: 'PS5' });
        }} 
        title={editingConsoleId ? "ویرایش اطلاعات دستگاه" : "ثبت دستگاه جدید"}
      >
        <form onSubmit={handleAddConsole} className="space-y-6">
          <Input 
            label="نام دستگاه" placeholder="مثلا: PS5 - میز 1" 
            value={newConsole.name} onChange={e => setNewConsole({...newConsole, name: e.target.value})}
            required
          />
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">نوع پلتفرم</label>
            <select 
              className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-indigo-600 outline-none transition-all appearance-none bg-gray-50 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22currentColor%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%20%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_1rem_center] bg-no-repeat"
              value={newConsole.type} onChange={e => setNewConsole({...newConsole, type: e.target.value})}
            >
              <option value="PS5">PlayStation 5</option>
              <option value="PS4">PlayStation 4</option>
              <option value="XBOX">Xbox Series X</option>
              <option value="PC">Gaming PC</option>
              <option value="VR">Virtual Reality</option>
              <option value="VIP">VIP Room</option>
            </select>
          </div>
          <Button type="submit" className="w-full py-4 rounded-2xl">
            {editingConsoleId ? "ذخیره تغییرات" : "تایید و ثبت دستگاه"}
          </Button>
        </form>
      </Modal>

      {/* Adding Tariff Modal */}
      <Modal isOpen={isAddTariffOpen} onClose={() => setIsAddTariffOpen(false)} title="تعریف تعرفه جدید">
        <form onSubmit={handleAddTariff} className="space-y-6">
          <Input 
            label="نام تعرفه" placeholder="مثلا: دو نفره معمولی" 
            value={newTariff.name} onChange={e => setNewTariff({...newTariff, name: e.target.value})}
            required
          />
          <Input 
            label="قیمت هر ساعت (تومان)" type="number" 
            value={newTariff.pricePerHour} onChange={e => setNewTariff({...newTariff, pricePerHour: Number(e.target.value)})}
            required
          />
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">نوع دستگاه (مثلا PS5 یا PS4)</label>
            <select 
              className="w-full h-12 px-4 rounded-xl border border-gray-200 outline-none bg-gray-50 font-bold text-sm"
              value={newTariff.consoleType || ''} 
              onChange={e => setNewTariff({...newTariff, consoleType: e.target.value})}
            >
              <option value="">همه دستگاه‌ها (عمومی)</option>
              <option value="PS5">PlayStation 5</option>
              <option value="PS4">PlayStation 4</option>
              <option value="XBOX">Xbox Series X</option>
              <option value="PC">Gaming PC</option>
              <option value="VR">Virtual Reality</option>
              <option value="VIP">VIP Room</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">این تعرفه فقط برای دستگاه‌هایی که با این نوع ثبت شده‌اند نمایش داده می‌شود.</p>
          </div>
          <Button type="submit" className="w-full py-4 rounded-2xl">ذخیره تعرفه</Button>
        </form>
      </Modal>

      <Modal 
        isOpen={startSessionModal.isOpen} 
        onClose={() => setStartSessionModal({ isOpen: false, consoleId: '' })} 
        title="شروع نشست بازی"
      >
        <form onSubmit={handleStartSession} className="space-y-6">
          <div className="bg-indigo-50 p-4 rounded-2xl flex items-center gap-3 border border-indigo-100">
            <Monitor className="text-indigo-600" />
            <div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase leading-none mb-1">دستگاه انتخاب شده</p>
              <p className="font-bold text-gray-900">
                {safeConsoles.find(c => c.id === startSessionModal.consoleId)?.name}
                <span className="text-gray-400 text-xs font-medium mr-1 italic">
                  ({safeConsoles.find(c => c.id === startSessionModal.consoleId)?.type})
                </span>
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">انتخاب تعرفه و تعداد نفرات *</label>
            <div className="grid grid-cols-2 gap-3">
              {safeTariffs
                .filter(t => !t.consoleType || t.consoleType === safeConsoles.find(c => c.id === startSessionModal.consoleId)?.type)
                .map(t => (
                <div 
                  key={t.id}
                  onClick={() => setSessionForm({...sessionForm, tariffId: t.id})}
                  className={cn(
                    "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden",
                    sessionForm.tariffId === t.id 
                      ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100" 
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className={cn("font-bold text-sm", sessionForm.tariffId === t.id ? "text-indigo-600" : "text-gray-700")}>{t.name}</span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={cn(
                          "w-1 h-3 rounded-full",
                          i < (parseInt(t.name.match(/\d/)?.[0] || '1')) ? "bg-indigo-400" : "bg-gray-200"
                        )} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-600">{formatPrice(t.pricePerHour)}</span>
                  
                  {sessionForm.tariffId === t.id && (
                    <motion.div layoutId="active-check" className="absolute top-1 right-1">
                      <div className="w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={10} className="text-white" />
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
              {safeTariffs.filter(t => !t.consoleType || t.consoleType === safeConsoles.find(c => c.id === startSessionModal.consoleId)?.type).length === 0 && (
                <p className="text-red-500 text-xs py-2 col-span-2 text-center font-bold">
                  تعرفه‌ای برای این نوع دستگاه ({safeConsoles.find(c => c.id === startSessionModal.consoleId)?.type}) یافت نشد. <br/>
                  <span className="text-[10px] text-gray-400">ابتدا در بخش تعرفه‌ها، تعرفه عمومی یا اختصاصی این گروه را اضافه کنید.</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3 text-right">محدودیت استفاده (اختیاری)</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { id: 'none', label: 'بدون محدودیت' },
                { id: 'time', label: 'زمان (دقیقه)' },
                { id: 'amount', label: 'مبلغ (تومان)' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSessionForm({...sessionForm, limitType: opt.id as any})}
                  className={cn(
                    "py-2 px-1 rounded-xl text-[10px] font-black border-2 transition-all",
                    sessionForm.limitType === opt.id ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-100 text-gray-400"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {sessionForm.limitType !== 'none' && (
              <Input 
                type="number" 
                placeholder={sessionForm.limitType === 'time' ? "مثلا 60 دقیقه" : "مثلا 50,000 تومان"}
                value={sessionForm.limitValue}
                onChange={e => setSessionForm({...sessionForm, limitValue: Number(e.target.value)})}
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 text-right">
              انتخاب مشتریان / بازیکنان (اختیاری):
            </label>
            
            {/* Selected Players Chips */}
            {(sessionForm.userIds || []).length > 0 && (
              <div className="flex flex-wrap gap-2 p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700">
                {(sessionForm.userIds || []).map(uid => {
                  const clientObj = (safeClients || []).find(c => c.id === uid);
                  return (
                    <Badge key={uid} variant="default" className="px-3 py-1.5 flex items-center gap-1.5 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-xs">
                      <User size={12} className="text-indigo-500" />
                      <span className="font-bold text-xs">{clientObj?.name || 'مشتری'}</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          const updated = (sessionForm.userIds || []).filter(id => id !== uid);
                          setSessionForm({
                            ...sessionForm,
                            userIds: updated,
                            userId: updated[0] || ''
                          });
                        }}
                        className="hover:text-red-500 mr-1 p-0.5"
                        title="حذف بازیکن"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            <SearchableSelect 
              placeholder={(sessionForm.userIds || []).length > 0 ? "+ افزودن هم‌بازی / بازیکن بعدی..." : "مشتری گذری / جستجوی عضو باشگاه..."}
              options={(safeClients || [])
                .filter(c => !(sessionForm.userIds || []).includes(c.id))
                .map(c => ({
                  id: c.id,
                  label: c.name,
                  subLabel: formatPersianDigits(c.phone || '')
                }))}
              value=""
              onChange={(val) => {
                if (!val) return;
                const current = sessionForm.userIds || [];
                if (!current.includes(val)) {
                  const updated = [...current, val];
                  setSessionForm({
                    ...sessionForm,
                    userIds: updated,
                    userId: updated[0]
                  });
                }
              }}
            />

            {(sessionForm.userIds || []).length > 1 && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                <Users size={14} />
                {formatPersianDigits((sessionForm.userIds || []).length)} بازیکن انتخاب شدند. هزینه فاکتور و امتیازات این بازی بین همه این افراد تقسیم و ثبت می‌شود.
              </p>
            )}

            {(!safeClients || safeClients.length === 0) && (
              <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                <Users size={12} />
                لیست مشتریان خالی است. می‌توانید از بخش کلوپ مشتریان، عضو جدید ثبت کنید.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full py-4 rounded-2xl text-lg shadow-xl shadow-indigo-100">تایید و شروع بازی</Button>
        </form>
      </Modal>

      {/* Action Modals (Change Console/Tariff/Add Product) */}
      <Modal 
        isOpen={actionModal.isOpen} 
        onClose={() => {
          setActionModal({ isOpen: false, type: '', session: null });
          setSelectedMoveConsoleId(null);
        }} 
        title={
          actionModal.type === 'change_console' || actionModal.type === 'change_tariff'
            ? (selectedMoveConsoleId ? "انتخاب تعرفه دستگاه جدید" : "مدیریت تعرفه و جابه‌جایی دستگاه") 
            : actionModal.type === 'add_product' ? "سفارش از بوفه" : ""
        }
      >
        <div className="space-y-4">
          {(actionModal.type === 'change_console' || actionModal.type === 'change_tariff') && (
            <div className="grid grid-cols-1 gap-2">
              {!selectedMoveConsoleId ? (
                <>
                  {/* Tab Selector between Tariff Change and Console Move */}
                  <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-4 border border-gray-200/60 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setActionModalTab('tariff')}
                      className={cn(
                        "flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
                        actionModalTab === 'tariff'
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-100 dark:border-slate-800"
                          : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                      )}
                    >
                      <Tag size={15} />
                      تغییر تعرفه همین دستگاه
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionModalTab('console')}
                      className={cn(
                        "flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
                        actionModalTab === 'console'
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-100 dark:border-slate-800"
                          : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
                      )}
                    >
                      <ArrowRightLeft size={15} />
                      انتقال به دستگاه دیگر (جابه‌جایی)
                    </button>
                  </div>

                  {actionModalTab === 'tariff' && (() => {
                    const currentCon = safeConsoles.find(c => c.id === actionModal.session?.consoleId);
                    const currentTariffItem = safeTariffs.find(t => t.id === actionModal.session?.tariffId);
                    const compatibleTariffs = safeTariffs.filter(t => 
                      !t.consoleType || !currentCon?.type || t.consoleType.trim().toLowerCase() === currentCon.type.trim().toLowerCase()
                    );
                    const displayTariffs = compatibleTariffs.length > 0 ? compatibleTariffs : safeTariffs;

                    return (
                      <div className="space-y-4">
                        {/* Current console & active tariff card */}
                        <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                              {getConsoleIcon(currentCon?.type || '', 16)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {currentCon?.name || 'کنسول'} <span className="text-[10px] text-gray-400 font-normal">({currentCon?.type})</span>
                              </p>
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                تعرفه فعال: <span className="font-bold">{currentTariffItem?.name || 'تعرفه نامشخص'}</span> ({formatPrice(getTariffEffectiveHourlyRate(currentTariffItem, actionModal.session || undefined))} / ساعت)
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-lg">
                            نشست فعال
                          </span>
                        </div>

                        <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5 pt-1">
                          <Tag size={14} className="text-indigo-600" />
                          تعرفه مورد نظر برای ادامه بازی را انتخاب کنید:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[45vh] overflow-y-auto pr-1">
                          {displayTariffs.map(t => {
                            const isCurrent = actionModal.session?.tariffId === t.id;
                            const effectivePrice = getTariffEffectiveHourlyRate(t, actionModal.session || undefined);

                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleSessionAction('change_tariff', { newTariffId: t.id })}
                                className={cn(
                                  "p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2.5 relative group",
                                  isCurrent
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200 dark:ring-indigo-900"
                                    : "bg-white dark:bg-slate-900 border-gray-150 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm"
                                )}
                              >
                                <div className="flex justify-between items-start w-full">
                                  <span className={cn("font-black text-xs", isCurrent ? "text-white" : "text-gray-900 dark:text-white")}>
                                    {t.name}
                                  </span>
                                  {isCurrent ? (
                                    <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold">
                                      در حال استفاده
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                      انتخاب
                                    </span>
                                  )}
                                </div>

                                <div className="w-full flex items-baseline justify-between border-t pt-2 border-dashed border-gray-200/60 dark:border-slate-800">
                                  <span className={cn("text-[10px]", isCurrent ? "text-white/80" : "text-gray-400")}>
                                    نرخ پایه:
                                  </span>
                                  <span className={cn("font-black text-xs", isCurrent ? "text-white" : "text-indigo-600 dark:text-indigo-400")}>
                                    {formatPrice(effectivePrice)} <span className="text-[9px] font-normal">/ ساعت</span>
                                  </span>
                                </div>

                                {t.rates && (t.rates.double || t.rates.triple || t.rates.quad) && (
                                  <div className={cn("text-[9px] flex flex-wrap gap-1 pt-1", isCurrent ? "text-indigo-100" : "text-gray-400")}>
                                    {t.rates.double && <span>۲ نفره: {formatPrice(t.rates.double)}</span>}
                                    {t.rates.quad && <span>• ۴ نفره: {formatPrice(t.rates.quad)}</span>}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {actionModalTab === 'console' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 font-bold flex items-center gap-2">
                        <ArrowRightLeft size={15} className="text-indigo-600" />
                        دستگاه آزاد مقصد را برای جابه‌جایی انتخاب کنید:
                      </p>
                      <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                        {safeConsoles.filter(c => c.status === 'idle').map(c => (
                          <button 
                            key={c.id} 
                            onClick={() => setSelectedMoveConsoleId(c.id)}
                            className="w-full flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-900 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 border border-gray-100 dark:border-slate-800 transition-all text-right group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 flex items-center justify-center shadow-xs">
                                {getConsoleIcon(c.type, 16)}
                              </div>
                              <span className="font-bold text-xs">{c.name} <span className="text-gray-400 text-[10px] font-normal">({c.type})</span></span>
                            </div>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-[-2px] transition-all" />
                          </button>
                        ))}
                        {safeConsoles.filter(c => c.status === 'idle').length === 0 && (
                          <p className="text-gray-400 text-center py-6 text-xs bg-gray-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
                            در حال حاضر دستگاه آزاد دیگری در کلوپ موجود نیست.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/60">
                    <p className="text-xs text-indigo-900 dark:text-indigo-200 font-bold">
                      انتقال به: <span className="font-black">{safeConsoles.find(c => c.id === selectedMoveConsoleId)?.name}</span> 
                      <span className="text-[10px] text-indigo-400 font-normal"> ({safeConsoles.find(c => c.id === selectedMoveConsoleId)?.type})</span>
                    </p>
                    <button 
                      onClick={() => setSelectedMoveConsoleId(null)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      تغییر دستگاه
                    </button>
                  </div>

                  <p className="text-xs font-bold text-gray-500 mb-2">انتخاب تعرفه برای دستگاه جدید:</p>
                  <div className="grid grid-cols-1 gap-2.5 max-h-[35vh] overflow-y-auto pr-1">
                    {(() => {
                      const targetCon = safeConsoles.find(c => c.id === selectedMoveConsoleId);
                      const targetTariffs = safeTariffs.filter(t => 
                        !t.consoleType || !targetCon?.type || t.consoleType.trim().toLowerCase() === targetCon.type.trim().toLowerCase()
                      );
                      const displayTargetTariffs = targetTariffs.length > 0 ? targetTariffs : safeTariffs;

                      return displayTargetTariffs.map(t => {
                        const effectivePrice = getTariffEffectiveHourlyRate(t, actionModal.session || undefined);
                        return (
                          <button 
                            key={t.id} 
                            onClick={() => {
                              const limitValue = (document.getElementById('move-limit-value') as HTMLInputElement)?.value;
                              const limitType = (document.getElementById('move-limit-type') as HTMLSelectElement)?.value;
                              handleSessionAction('change_console', { 
                                newConsoleId: selectedMoveConsoleId,
                                newTariffId: t.id,
                                limitType: limitType,
                                limitValue: limitValue
                              });
                            }}
                            className="flex items-center justify-between p-3.5 bg-indigo-50/70 dark:bg-slate-900 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-900 rounded-2xl transition-all text-right group"
                          >
                            <span className="font-bold text-xs">{t.name}</span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{formatPrice(effectivePrice)} / ساعت</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
                     <p className="text-xs font-bold text-gray-500">محدودیت جدید برای دستگاه مقصد:</p>
                     <div className="flex gap-2">
                        <select 
                          id="move-limit-type"
                          className="flex-1 h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900 outline-none"
                          defaultValue={actionModal.session?.limitType || 'none'}
                        >
                           <option value="none">بدون محدودیت</option>
                           <option value="time">زمان (دقیقه)</option>
                           <option value="amount">مبلغ (تومان)</option>
                        </select>
                        <input 
                          id="move-limit-value"
                          type="number"
                          className="flex-1 h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900 outline-none"
                          placeholder="مقدار..."
                          defaultValue={actionModal.session?.limitValue || 0}
                        />
                     </div>
                  </div>
                </>
              )}
            </div>
          )}

          {actionModal.type === 'add_product' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500 font-bold">افزودن محصولات بوفه:</p>
                <div className="relative w-48">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input 
                    type="text"
                    placeholder="جستجو..."
                    className="w-full bg-gray-50 pr-7 pl-2 py-1.5 rounded-lg text-[10px] font-bold border border-transparent focus:border-indigo-500 outline-none transition-all"
                    id="product-search-input"
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase();
                      const items = document.querySelectorAll('.product-item');
                      items.forEach((item: any) => {
                        const name = item.getAttribute('data-name').toLowerCase();
                        if (name.includes(val)) {
                          item.style.display = 'flex';
                        } else {
                          item.style.display = 'none';
                        }
                      });
                    }}
                  />
                </div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {products.map(p => (
                  <div key={p.id} data-name={p.name} className="product-item flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                      <p className="text-[10px] text-emerald-600 font-bold">{formatPrice(p.price)}</p>
                    </div>
                    <Button size="sm" onClick={() => handleSessionAction('add_product', { product: p })} className="h-8 text-[10px]">
                      <Plus size={12} className="ml-1" /> افزودن
                    </Button>
                  </div>
                ))}
              </div>
              {products.length === 0 && <p className="text-gray-400 text-center py-4 italic">هیچ محصولی در فروشگاه ثبت نشده است</p>}
            </div>
          )}
        </div>
      </Modal>

      {/* Checkout/Invoice Modal */}
      <Modal 
        isOpen={checkoutModal.isOpen} 
        onClose={() => setCheckoutModal(prev => ({ ...prev, isOpen: false, session: null }))} 
        title="صورتحساب نهایی"
      >
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-150 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-xs">
                <ReceiptText size={26} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">صورتحساب و تسویه بازی</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">مشاهده، تقسیم و تایید نهایی صورتحساب</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-xs px-3 py-1 font-bold">
              {(() => {
                const con = safeConsoles.find(c => c.id === checkoutModal.session?.consoleId);
                return con ? `${con.name} (${con.type})` : 'دستگاه کلوپ';
              })()}
            </Badge>
          </div>

          {/* Quick Metrics Grid: 3 Pillars */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-0.5">شروع نشست</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono" dir="ltr">
                {checkoutModal.session?.startTime ? new Date(checkoutModal.session.startTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '---'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-0.5">پایان نشست</span>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono" dir="ltr">
                {new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-center">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">مدت کل بازی</span>
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                {Math.ceil((checkoutModal.finalData?.duration || 0) / 60)} دقیقه
              </span>
            </div>
          </div>

          {/* Players & Multi-User Split */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-indigo-600" />
                <span>بازیکنان ثبت‌شده در فاکتور:</span>
              </span>
              <span className="text-[11px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full font-black">
                {formatPersianDigits((checkoutModal.sessionUserIds || []).length || 1)} نفر
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(checkoutModal.sessionUserIds || []).map(uid => {
                const cl = (safeClients || []).find(c => c.id === uid);
                return (
                  <Badge key={uid} variant="default" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-2.5 py-1 flex items-center gap-1.5 text-xs shadow-xs">
                    <User size={12} className="text-indigo-500" />
                    <span className="font-bold">{cl?.name || 'مشتری'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const remaining = (checkoutModal.sessionUserIds || []).filter(id => id !== uid);
                        setCheckoutModal({ ...checkoutModal, sessionUserIds: remaining });
                      }}
                      className="text-slate-400 hover:text-red-500 mr-1 p-0.5"
                      title="حذف از تقسیم فاکتور"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                );
              })}
              {(checkoutModal.sessionUserIds || []).length === 0 && (
                <span className="text-xs text-slate-400">مشتری آزاد / گذری</span>
              )}
            </div>

            <SearchableSelect
              placeholder="+ افزودن مشتری دیگر به فاکتور (تقسیم دونگی)..."
              options={(safeClients || [])
                .filter(c => !(checkoutModal.sessionUserIds || []).includes(c.id))
                .map(c => ({
                  id: c.id,
                  label: c.name,
                  subLabel: formatPersianDigits(c.phone || '')
                }))}
              value=""
              onChange={(val) => {
                if (!val) return;
                const current = checkoutModal.sessionUserIds || [];
                if (!current.includes(val)) {
                  setCheckoutModal({ ...checkoutModal, sessionUserIds: [...current, val] });
                }
              }}
            />

            {(checkoutModal.sessionUserIds || []).length > 1 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400">سهم دونگی هر بازیکن:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatPrice(Math.round((checkoutModal.finalData?.total || 0) / (checkoutModal.sessionUserIds?.length || 1)))}
                </span>
              </div>
            )}
          </div>

          {/* Itemized Financial Breakdown */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 text-slate-600 dark:text-slate-400 font-bold">
              <span>هزینه پایه بازی:</span>
              <span className="text-slate-900 dark:text-white font-black">
                {formatPrice(checkoutModal.finalData?.baseSessionCost || (checkoutModal.finalData?.sessionCost || 0) + (checkoutModal.finalData?.tierDiscount || 0) + (checkoutModal.finalData?.promoDiscount || 0))}
              </span>
            </div>

            {/* Tariff Changes / Console Intervals in Checkout Invoice */}
            {checkoutModal.finalData?.intervals && checkoutModal.finalData.intervals.length > 1 && (
              <div className="p-3 bg-indigo-50/60 dark:bg-slate-850 rounded-2xl border border-indigo-150/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-black text-indigo-900 dark:text-indigo-200">
                  <span className="flex items-center gap-1.5">
                    <ArrowRightLeft size={13} className="text-indigo-600 dark:text-indigo-400" />
                    <span>ریز مراحل تغییر تعرفه / دستگاه در فاکتور:</span>
                  </span>
                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px]">
                    {formatPersianDigits(checkoutModal.finalData.intervals.length)} مرحله
                  </span>
                </div>
                <div className="divide-y divide-indigo-100/70 dark:divide-slate-800 pt-1">
                  {checkoutModal.finalData.intervals.map((inv: any, idx: number) => {
                    let cleanName = inv.tariffName || 'تعرفه';
                    if (inv.consoleName && cleanName.startsWith(inv.consoleName)) {
                      cleanName = cleanName.slice(inv.consoleName.length).replace(/^[\s-]+/, '').trim();
                    }
                    const mins = Math.round((inv.durationSeconds || 0) / 60);
                    return (
                      <div key={idx} className="flex justify-between items-start py-1.5 text-[11px]">
                        <div className="flex items-start gap-1.5">
                          <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-1.5 py-0.5 rounded mt-0.5">
                            {idx === 0 ? 'مرحله ۱' : `مرحله ${formatPersianDigits(idx + 1)}`}
                          </span>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {inv.consoleName ? `${inv.consoleName} - ` : ''}{cleanName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              نرخ: {formatPrice(inv.pricePerHour)}/ساعت
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-black text-indigo-700 dark:text-indigo-300">
                            {formatPrice(inv.cost || 0)}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {formatPersianDigits(mins)} دقیقه
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Buffet Products */}
            {checkoutModal.session?.addedItems && checkoutModal.session.addedItems.length > 0 && (
              <div className="p-3 bg-amber-50/50 dark:bg-slate-800/40 rounded-xl border border-amber-100 dark:border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block mb-1">اقلام بوفه:</span>
                {checkoutModal.session.addedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => handleRemoveItem(checkoutModal.session!, item.productId)}
                        className="p-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                        title="حذف از فاکتور"
                      >
                        <Trash2 size={11} />
                      </button>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">{item.name} × {formatPersianDigits(item.quantity)}</span>
                    </div>
                    <span className="text-slate-900 dark:text-white font-black">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Discounts */}
            {checkoutModal.finalData?.tierDiscount > 0 && (
              <div className="flex justify-between items-center py-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <span>تخفیف وفاداری مشتری:</span>
                <span>-{formatPrice(checkoutModal.finalData.tierDiscount)}</span>
              </div>
            )}

            {checkoutModal.finalData?.promoDiscount > 0 && (
              <div className="flex justify-between items-center py-1 text-indigo-600 dark:text-indigo-400 font-bold">
                <span>تخفیف کمپین ({checkoutModal.finalData.promoName}):</span>
                <span>-{formatPrice(checkoutModal.finalData.promoDiscount)}</span>
              </div>
            )}

            {/* Tax */}
            {checkoutModal.finalData?.taxAmount >= 0 && (
              <div className="flex justify-between items-center py-1 text-slate-500 dark:text-slate-400 font-bold">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={toggleTax}
                    className={`p-1 rounded-md transition-colors ${checkoutModal.isTaxApplied ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}
                    title={checkoutModal.isTaxApplied ? "حذف مالیات" : "افزودن مالیات"}
                  >
                    {checkoutModal.isTaxApplied ? <X size={12} /> : <Plus size={12} />}
                  </button>
                  <span>مالیات بر ارزش افزوده ({formatPersianDigits(taxRate)}٪):</span>
                </div>
                <span className={`font-black ${checkoutModal.isTaxApplied ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through text-xs'}`}>
                  {formatPrice(checkoutModal.finalData.taxAmount || 0)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="pt-3 border-t border-slate-150 dark:border-slate-800 space-y-2">
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold block">انتخاب نحوه پرداخت:</span>
            <div className="grid grid-cols-3 gap-2">
              <button 
                type="button"
                onClick={() => setCheckoutModal({ ...checkoutModal, paymentMethod: 'card' })}
                className={cn(
                  "py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  checkoutModal.paymentMethod === 'card' 
                    ? "bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-indigo-300 shadow-xs" 
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <CreditCard size={15} />
                <span>کارت‌خوان</span>
              </button>
              <button 
                type="button"
                onClick={() => setCheckoutModal({ ...checkoutModal, paymentMethod: 'cash' })}
                className={cn(
                  "py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  checkoutModal.paymentMethod === 'cash' 
                    ? "bg-emerald-50 border-emerald-600 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-500 dark:text-emerald-300 shadow-xs" 
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <Banknote size={15} />
                <span>نقدی / واریز</span>
              </button>
              <button 
                type="button"
                onClick={() => setCheckoutModal({ ...checkoutModal, paymentMethod: 'wallet' })}
                className={cn(
                  "py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  checkoutModal.paymentMethod === 'wallet' 
                    ? "bg-amber-50 border-amber-600 text-amber-700 dark:bg-amber-950/50 dark:border-amber-500 dark:text-amber-300 shadow-xs" 
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <Wallet size={15} />
                <span>کیف‌پول (دفتری)</span>
              </button>
            </div>
          </div>

          {/* Grand Total Banner */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl p-4 text-center shadow-lg shadow-indigo-500/20">
            <p className="text-[11px] font-bold text-indigo-200 mb-1 uppercase tracking-wider">مبلغ نهایی قابل پرداخت</p>
            <p className="text-2xl font-black font-mono">{formatPrice(checkoutModal.finalData?.total || 0)}</p>
          </div>

          <Button 
            onClick={confirmCheckout} 
            className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            تسویه حساب و آزادسازی دستگاه
          </Button>
        </div>
      </Modal>

      {/* Confirmation Modal for Session Cancellation */}
      <Modal
        isOpen={!!cancellingSession}
        onClose={() => !cancelLoading && setCancellingSession(null)}
        title="لغو کامل نشست و آزادسازی دستگاه"
      >
        <div className="space-y-5 text-right p-1" dir="rtl">
          <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200/80 dark:border-rose-900/40">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/50 text-rose-600 rounded-xl flex-shrink-0 mt-0.5">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-rose-900 dark:text-rose-200">
                آیا از لغو کامل این نشست اطمینان دارید؟
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                تایمر بدون صدور فاکتور و بدون کسر هزینه کلاً منتفی شده و وضعیت دستگاه بلافاصله به «آزاد» بازمی‌گردد.
              </p>
            </div>
          </div>

          {cancellingSession?.addedItems && cancellingSession.addedItems.length > 0 && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <span className="font-black text-slate-700 dark:text-slate-300 block">اقلام بوفه / فروشگاهی ثبت‌شده:</span>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                اقلام ({cancellingSession.addedItems.map(i => `${i.name} (×${formatPersianDigits(i.quantity)})`).join('، ')}) به صورت خودکار به موجودی انبار بازگردانده می‌شوند.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              disabled={cancelLoading}
              onClick={() => setCancellingSession(null)}
              className="text-xs font-bold"
            >
              انصراف و بازگشت
            </Button>
            <Button
              variant="danger"
              disabled={cancelLoading}
              onClick={confirmCancelSession}
              className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2"
            >
              <Trash2 size={16} />
              {cancelLoading ? 'در حال لغو...' : 'بله، لغو و آزادسازی دستگاه'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
