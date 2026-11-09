import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return formatPersianNumber(Math.floor(amount)) + ' تومان';
}

export function formatPersianNumber(num: number | string) {
  const formatted = new Intl.NumberFormat('en-US').format(Number(num)); 
  return formatted.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);
}

export function formatPersianDigits(num: number | string) {
  return String(num).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);
}

export function toEnglishDigits(str: number | string) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
}
