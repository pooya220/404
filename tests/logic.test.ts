import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFinance, sessionAmounts, saleAmounts, repairPaid, dailyFixedCosts, clientSessionShare, earnedPoints, POINT_CREDIT, customerSessionDate, shareholderPaymentsInPeriod } from '../src/lib/finance';
import { resolveSessionIntervals } from '../src/lib/intervalUtils';
import { calculateSessionLiveCost } from '../src/lib/sessionBilling';
import { localDateTimeInput, resolveSessionStart } from '../src/lib/sessionStart';
import { PRINT_CATEGORY, PRINT_SERVICES, productBelongsToSection } from '../src/lib/productCategories';
import { clientActivityMonthKey, dailyClientActivityBuckets } from '../src/lib/clientActivity';
import { getJalaliMonthRange, localDateInput, formatJalali } from '../src/lib/dateUtils';
import { applyMutation, type Store, type Mutation } from '../server/ledger';

const date = '2026-09-24T12:00:00Z';
const sale = { id:'s', type:'quick_sale', timestamp:date, totalAmount:110000, taxAmount:10000, items:[] };
test('tax is deducted exactly once and all financial views share the same totals', () => {
  const result = summarizeFinance({ sales:[sale] });
  assert.equal(result.gross,110000); assert.equal(result.netRevenue,100000); assert.equal(result.profit,100000);
});
test('discounts and manual adjustments are reflected in revenue allocation', () => {
  const s = { totalSessionAmount:100000, netSessionAmount:80000, totalProductsAmount:20000, totalCost:99000, taxAmount:9000 };
  const a = sessionAmounts(s);
  assert.equal(a.game + a.buffet,90000);
  assert.equal(a.net,90000);
});
test('zero-cost invoice stays zero', () => assert.equal(sessionAmounts({totalSessionAmount:100000,totalCost:0}).net,0));
test('shop, buffet and game allocations never count an invoice twice, including print sales', () => {
  const a = saleAmounts({ ...sale, totalAmount:150000, taxAmount:0, items:[{productId:'print',price:50000,quantity:1},{productId:'stationery',price:50000,quantity:1},{productId:'tea',price:50000,quantity:1}] }, [{id:'print',category:'پرینت'},{id:'stationery',category:'لوازم تحریر'},{id:'tea',category:'نوشیدنی'}]);
  assert.equal(a.shop,100000); assert.equal(a.buffet,50000); assert.equal(a.shop+a.buffet+a.game,a.net);
});
test('product sections separate food, print and stationery without hiding legacy store categories', () => {
  assert.equal(productBelongsToSection('نوشیدنی','buffet'),true);
  assert.equal(productBelongsToSection('پرینت','print'),true);
  assert.equal(productBelongsToSection('لوازم تحریر','stationery'),true);
  assert.equal(productBelongsToSection('لوازم جانبی','stationery'),true);
  assert.equal(productBelongsToSection('پرینت','buffet'),false);
});
test('print section has fixed one-sided and two-sided service prices', () => {
  assert.deepEqual(PRINT_SERVICES.map(service => [service.name, service.price]), [['پرینت یک‌رو',10000],['پرینت دورو',15000]]);
  const amounts=saleAmounts({ ...sale, totalAmount:25000, taxAmount:0, items:PRINT_SERVICES.map(service => ({name:service.name,price:service.price,quantity:1,category:PRINT_CATEGORY})) });
  assert.equal(amounts.shop,25000); assert.equal(amounts.buffet,0);
});
test('customer visit charts use session start date, while custom corrected dates still take priority', () => {
  assert.equal(customerSessionDate({startTime:'2026-09-24T22:00:00Z',endTime:'2026-09-25T01:00:00Z'}),'2026-09-24T22:00:00Z');
  assert.equal(customerSessionDate({customDate:'2026-09-23T10:00:00Z',startTime:'2026-09-24T10:00:00Z'}),'2026-09-23T10:00:00Z');
});
test('customer history month selection uses Jalali month boundaries and returns a point for every day', () => {
  const {start,end}=getJalaliMonthRange(1405,6);
  assert.equal(clientActivityMonthKey(start),'1405/07');
  const days=dailyClientActivityBuckets([{date:start,amount:1200,visits:1}],start,end);
  assert.equal(days.length,30);
  assert.equal(days[0].date,'1405/07/01');
  assert.equal(days[0].spend,1200); assert.equal(days[0].visits,1);
  assert.equal(days[1].spend,0); assert.equal(days[1].visits,0);
});
test('wallet credit and reward conversion are not sales income', () => {
  assert.equal(summarizeFinance({ sales:[{...sale,type:'wallet_recharge'},{...sale,type:'points_conversion'}] }).gross,0);
});
test('unpaid repair is zero income; partial payments use payment dates', () => {
  assert.equal(repairPaid({totalCost:500000,paidAmount:0,receivedDate:date}),0);
  const r={paidAmount:200000,paymentHistory:[{amount:50000,date:'2026-09-23T12:00:00Z'},{amount:150000,date}]};
  assert.equal(repairPaid(r,new Date('2026-09-24T00:00:00Z'),new Date('2026-09-24T23:59:59Z')),150000);
});
test('losses are visible and repair parts are included in expenses', () => {
  const r=summarizeFinance({repairs:[{receivedDate:date,paidAmount:0,partsCost:120000}]});
  assert.equal(r.profit,-120000);
});
test('shared invoice rounding preserves the exact total', () => {
  const s={status:'completed',totalCost:100,userIds:['a','b','c']};
  assert.deepEqual(['a','b','c'].map(id=>clientSessionShare(s,id)),[34,33,33]);
});
test('points do not create an increasing wallet-credit loop', () => {
  assert.equal(earnedPoints(100000)*POINT_CREDIT,1000);
  assert.equal(earnedPoints(0),0);
});
test('Jalali month range and daily fixed cost allocation preserve a full month', () => {
  const {start,end}=getJalaliMonthRange(1405,6,3,30);
  assert.equal(formatJalali(start,'yyyy/MM/dd'),'1405/07/01'); assert.equal(start.getHours(),3);
  assert.equal(+end+1-+start,30*86400000);
  assert.equal(dailyFixedCosts([{year:1405,month:6,amount:300000}],3,30).reduce((s,c)=>s+c.amount,0),300000);
});
test('shareholder payouts in a full Jalali month follow their accounting period, not a later cash date', () => {
  const {start,end}=getJalaliMonthRange(1405,5);
  const [year,month]=formatJalali(start,'yyyy/MM').split('/').map(Number);
  const payout={month:month-1,year,amount:50000,date:new Date(end.getTime()+86400000).toISOString()};
  assert.deepEqual(shareholderPaymentsInPeriod([payout],start,end),[payout]);
  const followingMonth=getJalaliMonthRange(year,month);
  assert.deepEqual(shareholderPaymentsInPeriod([payout],followingMonth.start,followingMonth.end),[]);
  assert.deepEqual(shareholderPaymentsInPeriod([{...payout,type:'carryover'}],start,end),[]);
});
test('custom-day payment filters use the actual payment date', () => {
  const start=new Date(2026,8,24,0,0,0,0), end=new Date(2026,8,24,23,59,59,999);
  const payout={month:0,year:1405,amount:50000,date:'2026-09-24T12:00:00'};
  assert.deepEqual(shareholderPaymentsInPeriod([payout],start,end),[payout]);
  assert.deepEqual(shareholderPaymentsInPeriod([{...payout,date:'2026-09-25T12:00:00'}],start,end),[]);
  const legacyPayout={amount:25000,date:'2026-09-24T15:00:00'};
  assert.deepEqual(shareholderPaymentsInPeriod([legacyPayout],start,end),[legacyPayout]);
});
test('invoice date input uses the local calendar date', () => {
  const d=new Date(2026,8,25,1,0); assert.equal(localDateInput(d),'2026-09-25');
});
test('a complete single tariff interval never acquires a phantom extra interval', () => {
  const s={status:'completed',consoleId:'c',tariffId:'t',duration:3600,baseSessionAmount:100000,tariffHistory:[{consoleId:'c',tariffId:'t',durationSeconds:3600,cost:100000}]};
  assert.equal(resolveSessionIntervals(s,[],[]).reduce((sum,i)=>sum+i.durationSeconds,0),3600);
});
test('pause, resume, tariff change and multiple players use the same billing clock', () => {
  const tariff:any={id:'t',pricePerHour:3600,rates:{double:7200}};
  const s:any={status:'running',tariffId:'t',startTime:'2026-09-24T10:00:00Z',lastResumeTime:'2026-09-24T11:00:00Z',accumulatedSeconds:600,userIds:['a','b']};
  const a=calculateSessionLiveCost(s,[tariff],[],'2026-09-24T11:10:00Z'); assert.equal(a.seconds,1200); assert.equal(a.cost,2400);
  const b=calculateSessionLiveCost({...s,isPaused:true},[tariff],[],'2026-09-24T12:00:00Z');assert.equal(b.seconds,600);assert.equal(b.cost,1200);
});
test('forgotten session start records a valid backdated start and bills from it', () => {
  const now = new Date();
  now.setSeconds(0, 0);
  const earlier = new Date(now.getTime() - 30 * 60 * 1000);
  const resolution = resolveSessionStart(true, localDateTimeInput(earlier), now);
  assert.equal(resolution.valid,true);
  if (!resolution.valid) return;
  assert.equal(resolution.isLateStart,true);
  assert.ok(Math.abs(now.getTime() - new Date(resolution.startTime).getTime() - 30 * 60 * 1000) < 60_000);
  const cost = calculateSessionLiveCost({status:'running',tariffId:'t',startTime:resolution.startTime,lastResumeTime:resolution.startTime} as any,[{id:'t',name:'test',pricePerHour:6000}],[] ,now.toISOString());
  assert.ok(Math.abs(cost.seconds - 1800) <= 1);
  assert.equal(cost.cost,3000);
});
test('forgotten session start rejects future, invalid and excessively old times', () => {
  const now = new Date();
  assert.equal(resolveSessionStart(true,localDateTimeInput(new Date(now.getTime()+60_000)),now).valid,false);
  assert.equal(resolveSessionStart(true,'not-a-date',now).valid,false);
  assert.equal(resolveSessionStart(true,localDateTimeInput(new Date(now.getTime()-25*60*60*1000)),now).valid,false);
  const normal = resolveSessionStart(false,'',now);
  assert.equal(normal.valid,true);
  if (normal.valid) assert.equal(normal.isLateStart,false);
});

function memory(initial: Record<string, any[]> = {}) {
  let data = structuredClone(initial);
  const store: Store = {
    async get(t,id){return structuredClone((data[t]||[]).find(r=>r.id===id)||null);},
    async list(t){return structuredClone(data[t]||[]);},
    async put(t,r){const old=await this.get(t,r.id);data[t]=[...(data[t]||[]).filter(i=>i.id!==r.id),structuredClone({...r,_rev:(old?._rev||0)+1})];},
    async delete(t,id){data[t]=(data[t]||[]).filter(r=>r.id!==id);}
  };
  return {store, async run(...ops: Mutation[]){const before=structuredClone(data);try{const result=[];for(const op of ops)result.push(await applyMutation(store,op));return result;}catch(e){data=before;throw e;}}};
}
const create=(table:string,id:string,data:any):Mutation=>({table,id,kind:'add',data});
const update=(table:string,id:string,data:any):Mutation=>({table,id,kind:'update',data});
test('a sale commits stock, wallet, loyalty and totals together; deleting reverses it', async () => {
  const m=memory({products:[{id:'p',name:'P',price:10000,stock:4}],clients:[{id:'c',balance:50000,points:0,totalPaid:0}]});
  await m.run(create('sales','s',{...sale,totalAmount:20000,taxAmount:0,userId:'c',paymentMethod:'wallet',items:[{productId:'p',quantity:2,price:10000}]}));
  assert.equal((await m.store.get('products','p')).stock,2);assert.equal((await m.store.get('clients','c')).balance,30000);
  assert.equal((await m.store.get('clients','c')).points,2);
  await m.run({table:'sales',id:'s',kind:'delete'});
  assert.equal((await m.store.get('products','p')).stock,4);assert.equal((await m.store.get('clients','c')).balance,50000);assert.equal((await m.store.get('clients','c')).totalPaid,0);
});
test('print service sales need no inventory product and do not deduct stock', async () => {
  const m=memory();
  const item={name:'پرینت یک‌رو',quantity:1,price:10000,category:PRINT_CATEGORY};
  await m.run(create('sales','print-sale',{type:'quick_sale',totalAmount:10000,taxAmount:0,items:[item]}));
  assert.deepEqual((await m.store.get('sales','print-sale')).items,[item]);
  assert.deepEqual(await m.store.list('products'),[]);
});
test('insufficient stock rolls back the whole invoice',async()=>{
  const m=memory({products:[{id:'p',name:'P',stock:1}],clients:[{id:'c',balance:50000}]});
  await assert.rejects(()=>m.run(create('sales','s',{...sale,userId:'c',items:[{productId:'p',quantity:2,price:10}]})));
  assert.equal(await m.store.get('sales','s'),null);assert.equal((await m.store.get('products','p')).stock,1);
});
test('two menu items consuming the same raw material accumulate their usage',async()=>{
  const m=memory({products:[{id:'raw',name:'Coffee',stock:1000},{id:'single',rawMaterialId:'raw',gramsPerServing:15},{id:'double',rawMaterialId:'raw',gramsPerServing:20}]});
  await m.run(create('sales','s',{...sale,items:[{productId:'single',quantity:1,price:10},{productId:'double',quantity:1,price:10}]}));
  assert.equal((await m.store.get('products','raw')).stock,965);
});
test('editing a wallet invoice refunds the difference; moving to another client reconciles both',async()=>{
  const m=memory({clients:[{id:'a',balance:20000},{id:'b',balance:20000}]});
  await m.run(create('sales','s',{...sale,totalAmount:10000,taxAmount:0,userId:'a',paymentMethod:'wallet'}));
  await m.run(update('sales','s',{totalAmount:5000,userId:'b'}));
  assert.equal((await m.store.get('clients','a')).balance,20000);assert.equal((await m.store.get('clients','b')).balance,15000);
});
test('repair wallet payments and refunds update both accounts and receipt history',async()=>{
  const m=memory({clients:[{id:'c',balance:100000,totalPaid:0}]});
  await m.run(create('repairs','r',{clientId:'c',partsCost:20000,laborCost:30000,paidAmount:40000,paymentMethod:'account',receivedDate:date}));
  assert.equal((await m.store.get('clients','c')).balance,60000);
  await m.run(update('repairs','r',{status:'delivered'}));assert.equal((await m.store.get('repairs','r')).paidAmount,40000);
  await m.run(update('repairs','r',{paidAmount:0}));
  assert.equal((await m.store.get('clients','c')).balance,100000);assert.equal((await m.store.get('clients','c')).totalPaid,0);
  assert.equal(repairPaid(await m.store.get('repairs','r')),0);
});
test('creating two sessions on one console is rejected and completion is idempotent for account balances',async()=>{
  const m=memory({consoles:[{id:'c',status:'idle'}],tariffs:[{id:'t',pricePerHour:10000}],clients:[{id:'u',balance:20000,points:0}]});
  await m.run(create('sessions','s',{consoleId:'c',tariffId:'t',status:'running',userId:'u',addedItems:[]}));
  await assert.rejects(()=>m.run(create('sessions','s2',{consoleId:'c',tariffId:'t',status:'running'})));
  await m.run(update('sessions','s',{status:'completed',duration:3600,totalCost:10000,paymentMethod:'wallet'}));
  await m.run(update('sessions','s',{status:'completed',duration:3600,totalCost:10000,paymentMethod:'wallet'}));
  assert.equal((await m.store.get('clients','u')).balance,10000);assert.equal((await m.store.get('clients','u')).totalPlayTime,60);
  assert.equal((await m.store.get('consoles','c')).currentSessionId,null);
});
test('stale updates are rejected',async()=>{
  const m=memory({products:[{id:'p',stock:2,_rev:3}]});
  await assert.rejects(()=>m.run({...update('products','p',{stock:1}),expected:2}));assert.equal((await m.store.get('products','p')).stock,2);
});
test('reservation rejects reversed hours and overlapping confirmed bookings',async()=>{
  const m=memory(); const r={consoleId:'c',date:'2026-09-25',status:'confirmed',startTime:'16:00',endTime:'17:00'};
  await assert.rejects(()=>m.run(create('reservations','x',{...r,startTime:'18:00'})));
  await m.run(create('reservations','r',r));await assert.rejects(()=>m.run(create('reservations','r2',r)));
});
test('editing only a consumed purchase price does not subtract its stock again',async()=>{
  const m=memory({products:[{id:'p',stock:0}]});
  await m.run(create('purchases','buy',{productId:'p',quantity:5,totalCost:50}));
  await m.run(update('products','p',{stock:0}));
  await m.run(update('purchases','buy',{totalCost:60}));
  assert.equal((await m.store.get('products','p')).stock,0);
  await assert.rejects(()=>m.run({table:'purchases',id:'buy',kind:'delete'}));
});
