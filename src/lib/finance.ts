import { formatJalali, getJalaliMonthRange } from './dateUtils';
// Shared ledger rules. Amounts are tomans; tax is never business income.
export const money = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
export const isRevenueSale = (sale: any) =>
  ['quick_sale', 'session_order', 'manual_invoice'].includes(sale.type);
export const sessionDate = (s: any) => s.customDate || s.endTime || s.startTime;
// Customer attendance belongs to the time play began; financial reports keep
// using sessionDate, which intentionally attributes a session to checkout.
export const customerSessionDate = (s: any) => s.customDate || s.startTime || s.endTime;
const sameLocalDate = (left: any, right: any) => {
  const a = new Date(left), b = new Date(right);
  return Number.isFinite(a.getTime()) && Number.isFinite(b.getTime())
    && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};
export const repairDate = (r: any) => {
  const originalIntakeDate = r.receivedAt || r.createdAt;
  const correctedIntakeDate = r.receivedDate || originalIntakeDate;
  const deliveryDate = r.deliveryDate || (r.status === 'delivered' ? r.completedAt : undefined);
  // Older delivered records got today's date automatically. If that still
  // matches their creation day but intake was corrected, use the corrected date.
  if (deliveryDate && correctedIntakeDate && sameLocalDate(deliveryDate, originalIntakeDate)
    && !sameLocalDate(correctedIntakeDate, originalIntakeDate)) return correctedIntakeDate;
  return deliveryDate || correctedIntakeDate || r.receivedAt || r.createdAt;
};
export const repairPartsDate = (r: any) => {
  const recordedPartsDate = r.partsCostDate;
  const originalIntakeDate = r.receivedAt || r.createdAt;
  const correctedIntakeDate = r.receivedDate || originalIntakeDate;
  // Before editable intake dates existed, this field was auto-copied from the
  // creation date. Follow a corrected intake date only for that auto-generated value.
  if (recordedPartsDate && correctedIntakeDate && sameLocalDate(recordedPartsDate, originalIntakeDate)
    && !sameLocalDate(correctedIntakeDate, originalIntakeDate)) return correctedIntakeDate;
  return recordedPartsDate || correctedIntakeDate || r.createdAt;
};
export const inPeriod = (date: any, start?: Date, end?: Date) => {
  const time = new Date(date).getTime();
  return Number.isFinite(time) && (!start || time >= +start) && (!end || time <= +end);
};
export const shareholderPaymentsInPeriod = (payments: any[] = [], start?: Date, end?: Date) => {
  const isFullJalaliMonth = (() => {
    if (!start || !end) return false;
    const startParts = formatJalali(start, 'yyyy/MM/dd').split('/').map(Number);
    const endParts = formatJalali(end, 'yyyy/MM/dd').split('/').map(Number);
    if (startParts[0] !== endParts[0] || startParts[1] !== endParts[1]) return false;
    const monthRange = getJalaliMonthRange(startParts[0], startParts[1] - 1);
    return formatJalali(start, 'yyyy/MM/dd') === formatJalali(monthRange.start, 'yyyy/MM/dd')
      && formatJalali(end, 'yyyy/MM/dd') === formatJalali(monthRange.end, 'yyyy/MM/dd');
  })();

  return payments.filter((payment: any) => {
    if (payment.type === 'carryover') return false;
    if (!start && !end) return true;

    const hasAccountingPeriod = payment.month != null && payment.year != null
      && Number.isFinite(Number(payment.month)) && Number.isFinite(Number(payment.year));
    if (isFullJalaliMonth && hasAccountingPeriod) {
      const [year, month] = formatJalali(start!, 'yyyy/MM').split('/').map(Number);
      return Number(payment.year) === year && Number(payment.month) === month - 1;
    }
    if (payment.date) return inPeriod(payment.date, start, end);
    if (!hasAccountingPeriod) return false;

    const paymentMonth = getJalaliMonthRange(Number(payment.year), Number(payment.month));
    return (!start || paymentMonth.end >= start) && (!end || paymentMonth.start <= end);
  });
};
export function sessionAmounts(s: any) {
  const tax = money(s.taxAmount);
  const products = money(s.totalProductsAmount);
  const game = Math.max(0, s.netSessionAmount != null ? money(s.netSessionAmount)
    : money(s.totalSessionAmount) - money(s.tierDiscountAmount) - money(s.promoDiscountAmount));
  const gross = s.totalCost != null ? money(s.totalCost) : game + products + tax + money(s.manualAdjustment);
  const net = gross - tax;
  const buffet = game + products > 0 ? Math.round(net * products / (game + products)) : 0;
  return { gross, tax, net, game: net - buffet, buffet, shop: 0 };
}
export function saleAmounts(s: any, products: any[] = []) {
  if (!isRevenueSale(s)) return { gross: 0, tax: 0, net: 0, game: 0, buffet: 0, shop: 0 };
  const gross = money(s.totalAmount);
  const tax = money(s.taxAmount);
  const net = gross - tax;
  const gameBase = s.gameAmount != null ? money(s.gameAmount) : s.invoiceCategory === 'game' ? Math.max(0, net) : 0;
  let buffetBase = 0, shopBase = 0;
  for (const item of s.items || []) {
    if (item.id === 'manual_game') continue;
    const category = item.category || products.find(p => p.id === item.productId)?.category;
    const amount = money(item.price) * money(item.quantity);
    if (['لوازم جانبی', 'سخت‌افزار', 'لوازم تحریر', 'پرینت', 'سایر'].includes(category)) shopBase += amount;
    else buffetBase += amount;
  }
  if (s.buffetAmount != null) buffetBase = Math.max(0, money(s.buffetAmount) - shopBase);
  if (!(gameBase + buffetBase + shopBase)) buffetBase = Math.max(0, net);
  const base = gameBase + buffetBase + shopBase;
  const game = base ? Math.round(net * gameBase / base) : 0;
  const shop = base ? Math.round(net * shopBase / base) : 0;
  return { gross, tax, net, game, shop, buffet: net - game - shop };
}
export function repairReceipts(r: any): { amount: number; date: string }[] {
  if (Array.isArray(r.paymentHistory)) {
    const receipts = r.paymentHistory.map((p: any) => ({ amount: money(p.amount), date: p.date }));
    const originalIntakeDate = r.receivedAt || r.createdAt;
    const initialPaymentIndex = receipts.findIndex(p => sameLocalDate(p.date, originalIntakeDate));
    const correctedRepairDate = repairDate(r);
    // The first payment is recorded automatically when an old repair is entered.
    // If its date is still the record-creation day, align it with the corrected
    // delivery/intake date; later, separately recorded payments keep their dates.
    if (initialPaymentIndex >= 0 && correctedRepairDate && !sameLocalDate(receipts[initialPaymentIndex].date, correctedRepairDate)) {
      receipts[initialPaymentIndex] = { ...receipts[initialPaymentIndex], date: correctedRepairDate };
    }
    return receipts;
  }
  // A legacy paidAmount of zero means unpaid, not the quoted price.
  return money(r.paidAmount) !== 0 ? [{ amount: money(r.paidAmount), date: repairDate(r) }] : [];
}
export const repairPaid = (r: any, start?: Date, end?: Date) =>
  repairReceipts(r).filter(p => inPeriod(p.date, start, end)).reduce((sum, p) => sum + p.amount, 0);
// Legacy repair records only had partsCost; retain that historical expense until the
// actual purchase cost is explicitly captured on the record.
export const repairPartsExpenseCost = (r: any) =>
  r.partsPurchaseCost == null ? money(r.partsCost) : money(r.partsPurchaseCost);
export function summarizeFinance(input: {
  sessions?: any[]; sales?: any[]; repairs?: any[]; purchases?: any[];
  sharedExpenses?: any[]; fixedCosts?: any[]; products?: any[]; start?: Date; end?: Date;
}) {
  const { start, end } = input;
  const sessions = (input.sessions || []).filter(s => s.status === 'completed' && inPeriod(sessionDate(s), start, end));
  const sales = (input.sales || []).filter(s => isRevenueSale(s) && inPeriod(s.timestamp, start, end));
  const amounts = [...sessions.map(sessionAmounts), ...sales.map(s => saleAmounts(s, input.products))];
  const sum = (field: string) => amounts.reduce((total, a) => total + money(a[field]), 0);
  const repairs = input.repairs || [];
  const repair = repairs.reduce((total, r) => total + repairPaid(r, start, end), 0);
  const parts = repairs.filter(r => inPeriod(repairPartsDate(r), start, end))
    .reduce((total, r) => total + repairPartsExpenseCost(r), 0);
  const purchases = (input.purchases || []).filter(p => inPeriod(p.timestamp, start, end)).reduce((total, p) => total + money(p.totalCost), 0);
  const shared = (input.sharedExpenses || []).filter(e => inPeriod(e.date, start, end)).reduce((total, e) => total + money(e.amount), 0);
  const fixed = (input.fixedCosts || []).reduce((total, e) => total + money(e.amount), 0);
  const netRevenue = sum('net') + repair;
  const expenses = purchases + shared + fixed + parts;
  return { game: sum('game'), buffet: sum('buffet'), shop: sum('shop'), repair, tax: sum('tax'),
    gross: sum('gross') + repair, netRevenue, purchases, shared, fixed, parts, expenses,
    profit: netRevenue - expenses, sessions, sales };
}
export function clientSessionShare(session: any, clientId: string) {
  const ids: string[] = [...new Set<string>(session.splitUserIds?.length ? session.splitUserIds : session.userIds?.length ? session.userIds : [session.userId].filter(Boolean))];
  if (session.status !== 'completed' || !ids.includes(clientId)) return 0;
  const total = Math.round(sessionAmounts(session).gross);
  const base = Math.floor(total / ids.length);
  return base + (ids.indexOf(clientId) < total - base * ids.length ? 1 : 0);
}
export const earnedPoints = (amount: number) => Math.max(0, Math.floor(money(amount) / 10000));
export const POINT_CREDIT = 100; // Maximum 1% purchase cashback, including wallet-funded purchases.

export function dailyFixedCosts(costs: any[], resetHour = 0, resetMinute = 0) {
  return costs.flatMap(cost => {
    if (!Number.isInteger(Number(cost.year)) || !Number.isInteger(Number(cost.month))) return [];
    const { start, end } = getJalaliMonthRange(Number(cost.year), Number(cost.month), resetHour, resetMinute);
    const days = Math.round((+end + 1 - +start) / 86400000);
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(start); date.setDate(date.getDate() + i);
      return { ...cost, date: date.toISOString(), amount: money(cost.amount) / days };
    });
  });
}
export function clientSpend(clientId: string, sessions: any[], sales: any[], repairs: any[]) {
  return sessions.reduce((sum, s) => sum + clientSessionShare(s, clientId), 0)
    + sales.filter(s => isRevenueSale(s) && (s.userId || s.customerId || s.clientId) === clientId).reduce((sum, s) => sum + money(s.totalAmount), 0)
    + repairs.filter(r => r.clientId === clientId).reduce((sum, r) => sum + repairPaid(r), 0);
}
