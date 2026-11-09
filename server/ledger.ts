import { clientSessionShare, earnedPoints, isRevenueSale, money, repairDate, sessionAmounts, summarizeFinance } from '../src/lib/finance';
import { getJalaliMonthRange } from '../src/lib/dateUtils';

export interface Store {
  get(table: string, id: string): Promise<any>;
  list(table: string): Promise<any[]>;
  put(table: string, item: any): Promise<void>;
  delete(table: string, id: string): Promise<void>;
}
export type Mutation = { table: string; kind: 'add' | 'update' | 'delete'; id: string; data?: any; expected?: number };
const fail = (message: string) => { throw new Error(message); };
const finite = (v: any) => typeof v === 'number' && Number.isFinite(v);
const ids = (s: any): string[] => [...new Set<string>(s?.splitUserIds?.length ? s.splitUserIds : s?.userIds?.length ? s.userIds : s?.userId ? [s.userId] : [])];

async function adjustClient(store: Store, id: string, delta: Record<string, number>) {
  const client = await store.get('clients', id);
  if (!client || client.isGuest) return;
  for (const [field, amount] of Object.entries(delta)) client[field] = money(client[field]) + amount;
  // Spent points are not silently recreated on refund; a negative points balance is recoverable by future earnings.
  await store.put('clients', client);
}
async function stockDelta(store: Store, before: any[], after: any[]) {
  const quantities = new Map<string, number>();
  for (const [items, sign] of [[before, 1], [after, -1]] as const) {
    for (const item of items || []) {
      if (!item.productId) continue;
      if (!finite(Number(item.quantity)) || Number(item.quantity) <= 0) fail('تعداد کالا باید مثبت باشد.');
      const product = await store.get('products', item.productId);
      if (!product) fail('کالای فاکتور حذف شده است؛ ابتدا کالا را بازیابی کنید.');
      const stockId = item.stockProductId || product.rawMaterialId || product.id;
      const factor = item.stockFactor ?? (product.rawMaterialId ? money(product.gramsPerServing) : 1);
      if (!(factor > 0)) fail('مقدار مصرف ماده اولیه معتبر نیست.');
      quantities.set(stockId, (quantities.get(stockId) || 0) + sign * Number(item.quantity) * factor);
    }
  }
  for (const [id, delta] of quantities) {
    if (!delta) continue;
    const product = await store.get('products', id);
    if (!product) fail('ماده اولیه یافت نشد.');
    const next = money(product.stock) + delta;
    if (next < -0.00001) fail(`موجودی «${product.name}» کافی نیست.`);
    await store.put('products', { ...product, stock: Math.max(0, next) });
  }
}
async function snapshotItems(store: Store, items: any[]) {
  return Promise.all((items || []).map(async item => {
    if (!item.productId) return item;
    const product = await store.get('products', item.productId);
    if (!product) fail('کالای انتخاب‌شده موجود نیست.');
    return { ...item, category: item.category || product.category,
      stockProductId: item.stockProductId || product.rawMaterialId || product.id,
      stockFactor: item.stockFactor ?? (product.rawMaterialId ? money(product.gramsPerServing) : 1) };
  }));
}
function saleEffects(s: any) {
  if (!s || !isRevenueSale(s)) return { totalPaid: 0, balance: 0, points: 0 };
  return { totalPaid: money(s.totalAmount), balance: s.paymentMethod === 'wallet' ? -money(s.totalAmount) : 0,
    points: money(s.pointsAwarded ?? (s.type === 'manual_invoice' ? Math.max(1, earnedPoints(s.totalAmount)) : 0)) };
}
function sessionEffects(s: any, id: string) {
  if (!s || s.status !== 'completed' || !ids(s).includes(id)) return { totalPaid: 0, balance: 0, points: 0, totalPlayTime: 0 };
  const share = clientSessionShare(s, id);
  return { totalPaid: share, balance: s.paymentMethod === 'wallet' ? -share : 0,
    points: money(s.pointsPerUser), totalPlayTime: Math.round(money(s.duration) / 60) };
}
async function reconcileClients(store: Store, old: any, next: any, table: string) {
  const oldIds = table === 'sessions' ? ids(old) : [old?.userId || old?.customerId].filter(Boolean);
  const newIds = table === 'sessions' ? ids(next) : [next?.userId || next?.customerId].filter(Boolean);
  for (const id of new Set([...oldIds, ...newIds])) {
    const before = table === 'sessions' ? sessionEffects(old, id) : saleEffects(oldIds.includes(id) ? old : null);
    const after = table === 'sessions' ? sessionEffects(next, id) : saleEffects(newIds.includes(id) ? next : null);
    const delta: Record<string, number> = {};
    for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) delta[field] = money(after[field]) - money(before[field]);
    await adjustClient(store, id, delta);
  }
}

export async function applyMutation(store: Store, op: Mutation) {
  const old = await store.get(op.table, op.id);
  if (op.kind === 'add' && old) fail('این درخواست قبلاً ثبت شده است.');
  if (op.kind !== 'add' && !old) fail('رکورد یافت نشد؛ صفحه را تازه‌سازی کنید.');
  if (op.expected !== undefined && money(old?._rev) !== op.expected) fail('اطلاعات هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی و دوباره تلاش کنید.');
  let next = op.kind === 'delete' ? null : { ...(old || {}), ...op.data, id: op.id };
  if (op.table === 'system_users' && next?.passwordHash) delete next.password;
  if (next) {
    const walletIds = op.table === 'sales' && next.paymentMethod === 'wallet' ? [next.userId || next.customerId]
      : op.table === 'sessions' && next.status === 'completed' && next.paymentMethod === 'wallet' ? ids(next)
      : op.table === 'repairs' && next.paymentMethod === 'account' ? [next.clientId] : null;
    if (walletIds) {
      if (!walletIds.length) fail('برای پرداخت با کیف پول مشتری معتبر انتخاب کنید.');
      for (const id of walletIds) {
        const client = id && await store.get('clients', id);
        if (!client || client.isGuest) fail('پرداخت با کیف پول برای مشتری مهمان یا حذف‌شده مجاز نیست.');
      }
    }
    for (const field of ['price','quantity','costPrice','totalCost','totalAmount','paidAmount','partsCost','partsPurchaseCost','laborCost','discount','stock','amount','targetAmount']) {
      if (next[field] !== undefined && (!finite(next[field]) || next[field] < 0)) fail(`مقدار ${field} باید عدد غیرمنفی باشد.`);
    }
  }
  if (op.table === 'sales') {
    if (next && !isRevenueSale(next)) fail('تراکنش کیف پول باید از مسیر مخصوص حساب ثبت شود.');
    if (next) {
      if (next.paymentMethod === 'wallet' && !next.userId) fail('برای کیف پول مشتری را انتخاب کنید.');
      next.items = await snapshotItems(store, next.items || []);
      next.pointsAwarded = earnedPoints(next.totalAmount);
      if (!old && next.deductStock === undefined) next.deductStock = true;
    }
    await stockDelta(store, old && old.deductStock !== false ? old.items || [] : [], next && next.deductStock !== false ? next.items || [] : []);
    await reconcileClients(store, old, next, 'sales');
  }
  if (op.table === 'sessions') {
    if (next) {
      if (!next.tariffId || !await store.get('tariffs', next.tariffId)) fail('تعرفه معتبر انتخاب کنید.');
      if (!await store.get('consoles', next.consoleId)) fail('دستگاه یافت نشد.');
      const running = (await store.list('sessions')).find(s => s.id !== op.id && s.status === 'running' && s.consoleId === next.consoleId);
      if (next.status === 'running' && running) fail('این دستگاه نشست فعال دارد.');
      next.addedItems = await snapshotItems(store, next.addedItems || []);
      next.userIds = ids(next);
      if (next.status === 'completed') {
        if (!old || old.status !== 'completed' || money(next.totalCost) !== money(old.totalCost)) {
          next.pointsPerUser = Math.floor(earnedPoints(next.totalCost) / Math.max(1, next.userIds.length));
        }
        next.costPerUser = Math.floor(money(next.totalCost) / Math.max(1, next.userIds.length));
      }
    }
    await stockDelta(store, old?.addedItems || [], next?.addedItems || []);
    await reconcileClients(store, old, next, 'sessions');
    for (const id of new Set([old?.consoleId, next?.consoleId].filter(Boolean))) {
      const con = await store.get('consoles', id);
      if (!con) continue;
      const active = next?.status === 'running' && next.consoleId === id;
      if (active || con.currentSessionId === op.id) await store.put('consoles', { ...con, status: active ? 'active' : 'idle', currentSessionId: active ? op.id : null });
    }
  }
  if (op.table === 'repairs') {
    if (next) {
      next.totalCost = Math.max(0, money(next.partsCost) + money(next.laborCost) - money(next.discount));
      next.finalPrice = next.estimatedCost = next.totalCost;
      if (money(next.paidAmount) > next.totalCost) fail('مبلغ پرداختی بیشتر از مبلغ پرونده است.');
      if (next.paymentMethod === 'account' && !next.clientId) fail('برای کسر از کیف پول مشتری را انتخاب کنید.');
      const previousHistory = old?.paymentHistory || (money(old?.paidAmount) ? [{ amount: money(old.paidAmount), date: repairDate(old) }] : []);
      next.paymentHistory = [...previousHistory];
      const change = money(next.paidAmount) - money(old?.paidAmount);
      if (change) next.paymentHistory.push({ amount: change, date: new Date().toISOString() });
      next.paymentStatus = next.paidAmount >= next.totalCost ? 'paid' : next.paidAmount > 0 ? 'partial' : 'unpaid';
      next.partsCostDate = next.receivedDate || old?.partsCostDate || old?.receivedDate || new Date().toISOString();
    }
    for (const id of new Set([old?.clientId, next?.clientId].filter(Boolean))) {
      const prevPaid = old?.clientId === id ? money(old.paidAmount) : 0;
      const newPaid = next?.clientId === id ? money(next.paidAmount) : 0;
      await adjustClient(store, id, { totalPaid: newPaid - prevPaid,
        balance: (old?.clientId === id && old.paymentMethod === 'account' ? prevPaid : 0) - (next?.clientId === id && next.paymentMethod === 'account' ? newPaid : 0) });
    }
  }
  if (op.table === 'purchases') {
    const changes = new Map<string, number>();
    for (const [record, sign] of [[old, -1], [next, 1]] as const) {
      if (!record?.productId || record.stockManaged === false) continue;
      changes.set(record.productId, (changes.get(record.productId) || 0) + sign * money(record.quantity));
    }
    for (const [productId, delta] of changes) {
      if (!delta) continue;
      const p = await store.get('products', productId);
      if (!p) fail('کالای خرید یافت نشد.');
      const stock = money(p.stock) + delta;
      if (stock < 0) fail('این خرید مصرف شده است و قابل حذف نیست.');
      await store.put('products', { ...p, stock });
    }
  }
  if (op.table === 'reservations' && next) {
    const minutes = (v: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m && +m[1] <= 23 && +m[2] < 60 ? +m[1]*60 + +m[2] : NaN; };
    const start = minutes(next.startTime), end = minutes(next.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) fail('ساعت پایان رزرو باید بعد از ساعت شروع همان روز باشد.');
    if (next.status === 'confirmed') {
      const conflict = (await store.list('reservations')).some(r => r.id !== op.id && r.consoleId === next.consoleId && r.date === next.date && r.status === 'confirmed' && start < minutes(r.endTime) && end > minutes(r.startTime));
      if (conflict) fail('این بازه با یک رزرو تأییدشده تداخل دارد.');
    }
  }
  if (op.table === 'shareholder_payments') {
    if (next) {
      if (!Number.isInteger(next.year) || !Number.isInteger(next.month) || next.month < 0 || next.month > 11 || !(next.amount > 0)) fail('دوره یا مبلغ پرداخت معتبر نیست.');
      const settings = (await store.list('settings'))[0];
      const { start, end } = getJalaliMonthRange(next.year, next.month, settings?.dayResetHour || 0, settings?.dayResetMinute || 0);
      const holders = await store.list('shareholders');
      const invested = (sh: any) => (sh.investments || []).filter((i: any) => new Date(i.date) <= end).reduce((sum: number,i: any) => sum + money(i.amount), 0);
      const holder = holders.find(sh => sh.id === next.shareholderId);
      if (!holder) fail('سهام‌دار یافت نشد.');
      const totalInvestment = holders.reduce((sum, sh) => sum + invested(sh), 0);
      const ledger = summarizeFinance({ sessions: await store.list('sessions'), sales: await store.list('sales'), repairs: await store.list('repairs'), purchases: await store.list('purchases'), sharedExpenses: await store.list('shared_expenses'), fixedCosts: (await store.list('monthly_fixed_costs')).filter(f => Number(f.year) === next.year && Number(f.month) === next.month), start, end });
      const payable = totalInvestment > 0 ? Math.floor(Math.max(0, ledger.profit) * invested(holder) / totalInvestment) : 0;
      const paid = (await store.list('shareholder_payments')).filter(p => p.id !== op.id && p.shareholderId === next.shareholderId && Number(p.year) === next.year && Number(p.month) === next.month).reduce((sum,p) => sum + money(p.amount), 0);
      if (money(next.amount) > Math.max(0, payable - paid)) fail('مبلغ بیشتر از سود قابل پرداخت این دوره است.');
    }
    for (const [record, sign] of [[old, -1], [next, 1]] as const) {
      if (record?.type !== 'goal') continue;
      const goal = await store.get('goals', record.goalId);
      const holder = await store.get('shareholders', record.shareholderId);
      if (!goal || !holder) fail('هدف یا سهام‌دار یافت نشد.');
      await store.put('goals', { ...goal, currentAmount: money(goal.currentAmount) + sign * money(record.amount) });
      const investments = (holder.investments || []).filter((i: any) => i.sourcePaymentId !== op.id);
      if (sign > 0) {
        const year = record.month === 11 ? record.year + 1 : record.year;
        const month = (record.month + 1) % 12;
        investments.push({ amount: record.amount, date: getJalaliMonthRange(year, month).start.toISOString(), note: 'واریز سود به هدف: ' + goal.title, sourcePaymentId: op.id });
      }
      await store.put('shareholders', { ...holder, investments });
    }
  }
  if (op.table === 'clients' && next && old && money(next.balance) !== money(old.balance)) {
    await store.put('wallet_transactions', { id: crypto.randomUUID(), clientId: op.id, type: 'manual_adjustment', amount: money(next.balance) - money(old.balance), timestamp: new Date().toISOString() });
  }
  if (op.table === 'goals' && !next && money(old?.currentAmount) > 0) fail('هدف دارای موجودی است؛ ابتدا واریزهای آن را تعیین تکلیف کنید.');
  if (!next && ['consoles','tariffs','products','clients'].includes(op.table)) {
    const running = (await store.list('sessions')).some(s => s.status === 'running' && (s.consoleId === op.id || s.tariffId === op.id || ids(s).includes(op.id) || s.addedItems?.some((i:any)=>i.productId===op.id)));
    if (running) fail('رکورد به نشست فعال متصل است و قابل حذف نیست.');
    if (op.table === 'products' && (await store.list('products')).some(p => p.rawMaterialId === op.id)) fail('این ماده اولیه در منوی کالاها استفاده شده است.');
  }
  if (next) { await store.put(op.table, next); return await store.get(op.table, op.id); }
  await store.delete(op.table, op.id); return { success: true };
}
