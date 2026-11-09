import { Session, Tariff, Console } from '../types';

export interface ResolvedInterval {
  consoleId?: string;
  consoleName?: string;
  tariffId?: string;
  tariffName?: string;
  pricePerHour: number;
  durationSeconds: number;
  cost: number;
  startTime?: string;
  endTime?: string;
}

export function resolveSessionIntervals(
  session: Session | any,
  tariffs?: Tariff[],
  consoles?: Console[]
): ResolvedInterval[] {
  if (!session) return [];

  const rawHistory: any[] = session.tariffHistory || [];
  const currentTariff = (tariffs || []).find(t => t.id === session.tariffId);
  const currentConsole = (consoles || []).find(c => c.id === session.consoleId);
  const currentConsoleName = currentConsole ? `${currentConsole.name} (${currentConsole.type})` : '';

  // Calculate total session duration in seconds
  let sessionDurationSeconds = Number(session.duration) || 0;
  if (!sessionDurationSeconds && session.startTime && session.endTime) {
    const diff = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
    sessionDurationSeconds = Math.max(0, Math.floor(diff / 1000));
  } else if (!sessionDurationSeconds && session.startTime) {
    const diff = Date.now() - new Date(session.startTime).getTime();
    sessionDurationSeconds = Math.max(0, Math.floor(diff / 1000));
  }

  // Calculate base session game cost (before discounts)
  const tierDiscount = Number(session.tierDiscountAmount) || 0;
  const promoDiscount = Number(session.promoDiscountAmount) || 0;
  let baseGameCost = Number(session.baseSessionAmount) || Number(session.totalSessionAmount) || 0;
  if (!baseGameCost) {
    const totalCost = Number(session.totalCost) || Number(session.finalCost) || 0;
    const prodCost = Number(session.totalProductsAmount) || 0;
    baseGameCost = Math.max(0, totalCost - prodCost) + tierDiscount + promoDiscount;
  }

  // If no tariffHistory recorded at all
  if (rawHistory.length === 0) {
    return [{
      consoleId: session.consoleId,
      consoleName: currentConsoleName,
      tariffId: session.tariffId,
      tariffName: currentTariff?.name || 'تعرفه استاندارد',
      pricePerHour: Number(currentTariff?.pricePerHour) || 0,
      durationSeconds: sessionDurationSeconds,
      cost: baseGameCost,
      startTime: session.startTime,
      endTime: session.endTime || new Date().toISOString()
    }];
  }

  // Clean and map existing history
  const intervals: ResolvedInterval[] = rawHistory.map((h: any) => {
    let cleanTariff = h.tariffName || 'تعرفه';
    if (h.consoleName && cleanTariff.startsWith(h.consoleName)) {
      cleanTariff = cleanTariff.slice(h.consoleName.length).replace(/^[\s-]+/, '').replace(/\(متوقف شده\)/, '').trim();
    }
    return {
      consoleId: h.consoleId || session.consoleId,
      consoleName: h.consoleName || currentConsoleName,
      tariffId: h.tariffId || session.tariffId,
      tariffName: cleanTariff,
      pricePerHour: Number(h.pricePerHour) || 0,
      durationSeconds: Math.round(Number(h.durationSeconds) || 0),
      cost: Math.round(Number(h.cost) || 0),
      startTime: h.startTime,
      endTime: h.endTime
    };
  });

  const historyDuration = intervals.reduce((acc, it) => acc + it.durationSeconds, 0);
  const historyCost = intervals.reduce((acc, it) => acc + it.cost, 0);

  const lastInterval = intervals[intervals.length - 1];
  const isDifferentTariffOrConsole = lastInterval && (
    (session.tariffId && lastInterval.tariffId !== session.tariffId) ||
    (session.consoleId && lastInterval.consoleId !== session.consoleId)
  );

  // If rawHistory has only 1 item, or if final interval is missing
  const isMissingFinal = 
    intervals.length === 1 ||
    isDifferentTariffOrConsole ||
    (sessionDurationSeconds > historyDuration + 20) ||
    (baseGameCost > historyCost + 100);

  if (isMissingFinal) {
    const remainingDuration = Math.max(0, sessionDurationSeconds - historyDuration);
    let remainingCost = Math.max(0, baseGameCost - historyCost);
    if (remainingCost <= 0 && remainingDuration > 0 && currentTariff?.pricePerHour) {
      remainingCost = Math.round((remainingDuration / 3600) * currentTariff.pricePerHour);
    }
    intervals.push({
      consoleId: session.consoleId,
      consoleName: currentConsoleName,
      tariffId: session.tariffId,
      tariffName: currentTariff?.name || 'تعرفه نهایی',
      pricePerHour: Number(currentTariff?.pricePerHour) || 0,
      durationSeconds: remainingDuration > 0 ? remainingDuration : Math.max(60, Math.round(sessionDurationSeconds / 2)),
      cost: remainingCost,
      startTime: lastInterval?.endTime || session.startTime,
      endTime: session.endTime || new Date().toISOString()
    });
  }

  return intervals;
}
