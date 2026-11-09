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

export const getTodayRange = () => {
  const now = new Date();
  return {
    start: startOfDay(now),
    end: endOfDay(now)
  };
};
