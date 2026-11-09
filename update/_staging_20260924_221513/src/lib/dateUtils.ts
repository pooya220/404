import { 
  format, 
  getYear, 
  getMonth, 
  getDate, 
  parseISO, 
  startOfMonth, 
  endOfMonth,
  setYear,
  setMonth,
  setDate,
  startOfDay,
  endOfDay
} from 'date-fns-jalali';

export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

export const getCurrentJalaliDate = (): JalaliDate => {
  const now = new Date();
  return {
    year: getYear(now),
    month: getMonth(now),
    day: getDate(now)
  };
};

export const getJalaliMonthRange = (year: number, month: number) => {
  let d = new Date();
  d = setYear(d, year);
  d = setMonth(d, month);
  d = setDate(d, 1);
  
  const start = startOfMonth(d);
  const end = endOfMonth(d);
  
  return { start, end };
};

export const formatJalali = (date: Date | string | number, formatStr: string = 'yyyy/MM/dd'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
};

export const getJalaliMonthName = (monthIndex: number): string => {
  const months = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  return months[monthIndex] || '';
};

export const getJalaliMonths = () => [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const isSameJalaliDay = (d1: Date, d2: Date): boolean => {
  return getYear(d1) === getYear(d2) &&
         getMonth(d1) === getMonth(d2) &&
         getDate(d1) === getDate(d2);
};

export const isSameJalaliMonth = (d1: Date, d2: Date): boolean => {
  return getYear(d1) === getYear(d2) &&
         getMonth(d1) === getMonth(d2);
};

export const getTodayRange = (resetHour: number = 0, resetMinute: number = 0) => {
  const now = new Date();
  
  // Calculate the shift start date for 'today'
  // If current time is before resetHour:resetMinute, today belongs to the previous calendar day's shift
  const start = new Date(now);
  start.setHours(resetHour, resetMinute, 0, 0);

  if (now.getTime() < start.getTime()) {
    // We are in the early hours before reset (e.g. 01:30 AM when reset is 03:00 AM)
    // The current operational day started yesterday at resetHour:resetMinute
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1); // 1 ms before the next shift reset

  return {
    start,
    end
  };
};

/**
 * Returns a stable string key representing the operational shift day for any given timestamp,
 * taking into account the club's custom day reset hour (e.g. 02:00 AM or 04:00 AM).
 */
export const getOperationalDayKey = (dateInput: Date | string | number, resetHour: number = 0, resetMinute: number = 0): string => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  // Shift back by the reset offset so normal calendar date formatting maps to the correct operational day
  const offsetMs = (resetHour * 60 + resetMinute) * 60 * 1000;
  const shiftedDate = new Date(d.getTime() - offsetMs);
  return shiftedDate.toDateString();
};
