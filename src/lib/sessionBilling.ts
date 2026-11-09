import type { Session, Tariff, Console } from '../types';

export interface SessionCostBreakdown {
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

export const calculateSessionLiveCost = (
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
