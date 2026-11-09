// Read-only route smoke test with the locally installed Edge browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
const base = process.env.SMOKE_URL || 'http://localhost:3000';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gamenet-browser-'));
const browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9227', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket: WebSocket | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
const exceptions: string[] = [];
function send(method: string, params: any = {}): Promise<any> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser timeout: ' + method)); }, 15000);
    pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
async function evaluate(expression: string) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
try {
  let targets: any[] = [];
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch('http://127.0.0.1:9227/json/list')).json(); if (targets.length) break; } catch {}
    await delay(250);
  }
  const target = targets.find(t => t.type === 'page');
  assert.ok(target, 'Headless Edge is reachable');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket!.once('open', resolve); socket!.once('error', reject); });
  socket.on('message', raw => {
    const message = JSON.parse(String(raw));
    if (message.id) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task?.reject(message.error) : task?.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(JSON.stringify(message.params.exceptionDetails));
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: base }); await delay(2500);
  const user = await evaluate(`(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:${JSON.stringify(process.env.SMOKE_USER || 'admin')},password:${JSON.stringify(process.env.SMOKE_PASSWORD || '1234')}})});if(!r.ok)throw new Error('Login '+r.status);const u=await r.json();localStorage.setItem('game_net_user',JSON.stringify(u));return {id:u.id,role:u.role};})()`);
  assert.equal(user.role, 'admin');
  const routes: string[] = process.env.SMOKE_ROUTES
    ? JSON.parse(process.env.SMOKE_ROUTES)
    : ['/', '/consoles', '/products', '/clients', '/repairs', '/reports', '/analytics', '/stocks', '/goals', '/reservations', '/settings', '/staff-attendance'];
  for (const route of routes) {
    await send('Page.navigate', { url: base + route });
    for (let attempt = 0; attempt < 60; attempt++) {
      await delay(500);
      if (exceptions.length || await evaluate("(document.querySelector('#root')?.innerText.length||0)>150")) break;
    }
    await delay(2500); // Include asynchronous collection loads, not just the initial page shell.
    assert.equal(exceptions.length, 0, exceptions.join('\n'));
    const result = await evaluate(`({length:document.querySelector('#root')?.innerText.length||0,login:!!document.querySelector('input[type=password]'),path:location.pathname})`);
    assert.ok(result.length > 150, route + ' rendered');
    assert.equal(result.path, route);
    assert.equal(result.login, false, route + ' authenticated');
    assert.equal(exceptions.length, 0, exceptions.join('\n'));
    if (route === '/analytics') {
      const customerSelected = await evaluate(`(()=>{const button=Array.from(document.querySelectorAll('button')).find(item=>item.innerText.includes('جلسه بازی'));if(!button)return false;button.click();return true})()`);
      if (customerSelected) {
        let monthControl = null;
        for (let attempt = 0; attempt < 20 && !monthControl; attempt++) {
          await delay(150);
          monthControl = await evaluate(`(()=>{const select=document.querySelector('#customer-chart-month');return select?{value:select.value,options:select.options.length,label:select.selectedOptions[0]?.textContent||''}:null})()`);
        }
        assert.ok(monthControl, 'customer detail month selector rendered');
        assert.match(monthControl.value, /^\d{4}\/\d{2}$/);
        assert.ok(monthControl.options >= 1, 'customer detail offers at least the current Jalali month');
        const requestedMonth = await evaluate(`(()=>{const select=document.querySelector('#customer-chart-month');if(select.options.length>1){select.selectedIndex=1;select.dispatchEvent(new Event('change',{bubbles:true}))}return select.value})()`);
        await delay(250);
        const activeMonth = await evaluate(`document.querySelector('#customer-chart-month')?.value||''`);
        assert.equal(activeMonth, requestedMonth, 'customer chart accepts a different month selection');
        const chartDom = await evaluate(`({surfaces:document.querySelectorAll('.recharts-surface').length,ticks:document.querySelectorAll('.recharts-cartesian-axis-tick-value').length})`);
        assert.ok(chartDom.surfaces > 0, 'customer detail chart rendered');
        assert.ok(chartDom.ticks > 0, 'daily customer chart rendered its date axis');
        console.log('PASS customer detail month selector and daily chart');
      }
    }
    if (route === '/staff-attendance') {
      const collections = await evaluate(`Promise.all(['staff_members','staff_attendance'].map(async name=>{const response=await fetch('/api/db/'+name);return {name,status:response.status,body:await response.json()}}))`);
      assert.deepEqual(collections.map((item: any) => item.status), [200, 200], JSON.stringify(collections));
      assert.ok(collections.every((item: any) => Array.isArray(item.body)), 'attendance collections return arrays');
      const pageText = await evaluate(`document.querySelector('#root')?.innerText||''`);
      assert.doesNotMatch(pageText, /خطا در دریافت اطلاعات|خطا در ارتباط با سرور MySQL|کد 404|عملیات نامعتبر است/);
      if (process.env.SMOKE_ATTENDANCE_DELETE === 'true') {
        const seeded = await evaluate(`(async()=>{const now=Date.now();const staff={id:'attendance-smoke-staff',fullName:'Smoke Staff',position:'Test',isActive:true};const shift={id:'attendance-smoke-shift',staffId:staff.id,staffName:staff.fullName,staffPosition:staff.position,workDate:new Date(now).toISOString().slice(0,10),checkInAt:new Date(now-3600000).toISOString(),checkOutAt:new Date(now).toISOString()};const response=await fetch('/api/db-transaction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operations:[{table:'staff_members',kind:'add',id:staff.id,data:staff},{table:'staff_attendance',kind:'add',id:shift.id,data:shift}]})});return {status:response.status,body:await response.json()}})()`);
        assert.equal(seeded.status, 200, JSON.stringify(seeded.body));
        await send('Page.navigate', { url: base + route });
        await delay(3000);
        const clicked = await evaluate(`(()=>{window.confirm=()=>true;const button=document.querySelector('[aria-label="حذف Smoke Staff"]');if(!button)throw new Error('Delete staff button not found');button.click();return true})()`);
        assert.equal(clicked, true);
        const saved = await evaluate(`(async()=>{for(let i=0;i<20;i++){const [staffResponse,attendanceResponse]=await Promise.all([fetch('/api/db/staff_members'),fetch('/api/db/staff_attendance')]);const staff=await staffResponse.json(),attendance=await attendanceResponse.json();if(staff.every(person=>person.id!=='attendance-smoke-staff')&&attendance.some(row=>row.id==='attendance-smoke-shift'))return {staff,attendance}}await new Promise(resolve=>setTimeout(resolve,250));throw new Error('Staff deletion/history preservation did not finish')})()`);
        assert.equal(saved.staff.some((person: any) => person.id === 'attendance-smoke-staff'), false);
        assert.equal(saved.attendance.some((row: any) => row.id === 'attendance-smoke-shift'), true);
        const visiblePageText = await evaluate(`(async()=>{for(let i=0;i<20;i++){const root=document.querySelector('#root');const copy=root?.cloneNode(true);copy?.querySelectorAll('[role="status"]').forEach(node=>node.remove());const text=copy?.innerText||'';if(!text.includes('Smoke Staff'))return text;await new Promise(resolve=>setTimeout(resolve,250))}throw new Error('Deleted staff is still visible in attendance UI')})()`);
        assert.doesNotMatch(visiblePageText, /Smoke Staff/);
        console.log('PASS deleted staff attendance remains in MySQL but is hidden in the app');
      }
    }
    console.log('PASS browser route ' + route + ' (' + result.length + ' characters)');
  }
  console.log(`${routes.length} browser routes rendered without uncaught JavaScript exceptions.`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close(); }
  if (browser.exitCode === null) browser.kill();
  console.log('Isolated browser profile retained: ' + profile);
}
