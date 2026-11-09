import { formatJalali } from './dateUtils';

export interface ClientActivityPoint {
  date: string | Date | number;
  amount: number;
  visits?: number;
}

export interface DailyClientActivity {
  date: string;
  spend: number;
  visits: number;
  order: number;
}

export const clientActivityMonthKey = (value: string | Date | number): string | null => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatJalali(date, 'yyyy/MM') : null;
};

export const dailyClientActivityBuckets = (
  activities: ClientActivityPoint[],
  monthStart: Date,
  monthEnd: Date,
): DailyClientActivity[] => {
  if (!Number.isFinite(monthStart.getTime()) || !Number.isFinite(monthEnd.getTime()) || monthStart > monthEnd) return [];

  const days: Record<string, DailyClientActivity> = {};
  const cursor = new Date(monthStart);
  for (let dayCount = 0; cursor <= monthEnd && dayCount < 32; dayCount += 1, cursor.setDate(cursor.getDate() + 1)) {
    const date = formatJalali(cursor, 'yyyy/MM/dd');
    days[date] = {
      date,
      spend: 0,
      visits: 0,
      order: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()).getTime(),
    };
  }

  activities.forEach(activity => {
    const date = new Date(activity.date);
    if (!Number.isFinite(date.getTime()) || date < monthStart || date > monthEnd) return;
    const day = days[formatJalali(date, 'yyyy/MM/dd')];
    if (!day) return;
    day.spend += Number.isFinite(Number(activity.amount)) ? Number(activity.amount) : 0;
    day.visits += Number.isFinite(Number(activity.visits)) ? Number(activity.visits) : 0;
  });

  return Object.values(days).sort((a, b) => a.order - b.order);
};
