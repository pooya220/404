export const BUFFET_CATEGORIES = ['نوشیدنی', 'تنقلات', 'غذا'] as const;
export const PRINT_CATEGORY = 'پرینت';
export const STATIONERY_CATEGORY = 'لوازم تحریر';
export type PrintService = { id: string; name: string; price: number };
export const PRINT_SERVICES: readonly PrintService[] = [
  { id: 'print-single-sided', name: 'پرینت یک‌رو', price: 10_000 },
  { id: 'print-double-sided', name: 'پرینت دورو', price: 15_000 },
];

// Keep older shop categories reachable in the stationery/store section.
export const LEGACY_SHOP_CATEGORIES = ['لوازم جانبی', 'سخت‌افزار', 'سایر'] as const;

export type ProductSection = 'buffet' | 'print' | 'stationery';

export const productBelongsToSection = (category: string, section: ProductSection): boolean => {
  if (section === 'buffet') return (BUFFET_CATEGORIES as readonly string[]).includes(category);
  if (section === 'print') return category === PRINT_CATEGORY;
  return category === STATIONERY_CATEGORY || (LEGACY_SHOP_CATEGORIES as readonly string[]).includes(category);
};
