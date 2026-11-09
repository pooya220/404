// Isolated MySQL/API regression checks. Never writes application records to the live database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

const config = JSON.parse(fs.readFileSync('.mysql_config.json', 'utf8'));
const database = 'gamenet_test_' + randomBytes(8).toString('hex');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gamenet-check-'));
const connection = await mysql.createConnection({ host: config.host, port: Number(config.port), user: config.user, password: config.password });
let child: ReturnType<typeof spawn> | undefined;
let output = '';
let cookie = '';
const base = 'http://127.0.0.1:3107';
let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, name); passed++; console.log('PASS ' + name);
}
async function api(route: string, method = 'GET', body?: unknown, auth = cookie) {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Cookie: auth }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
try {
  // Fail rather than connecting to an unrelated process already on our test port.
  await assert.rejects(fetch(base + '/api/health'));
  await connection.query('CREATE DATABASE `' + database + '` CHARACTER SET utf8mb4');
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '3107', MYSQL_CONFIG_FILE: path.join(temporary, 'no-config.json'),
      MYSQL_HOST: config.host, MYSQL_PORT: String(config.port), MYSQL_USER: config.user, MYSQL_PASSWORD: config.password,
      MYSQL_DATABASE: database, MYSQL_ENABLED: 'true', BACKUP_DIRECTORY: temporary,
    },
  });
  child.stdout?.on('data', d => { output += String(d); });
  child.stderr?.on('data', d => { output += String(d); });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  check('homepage', (await fetch(base)).status, 200);
  check('SPA repair route', (await fetch(base + '/repairs')).status, 200);
  check('unauthenticated database rejected', (await api('/api/db/clients')).status, 401);
  const login = await api('/api/auth/login', 'POST', { username: 'admin', password: '1234' });
  check('bootstrap login', login.status, 200); cookie = login.cookie;
  check('session cookie', Boolean(cookie), true);
  check('password never returned', 'passwordHash' in login.data || 'password' in login.data, false);
  const add = async (table: string, data: any) => {
    const r = await api('/api/db/' + table, 'POST', data);
    assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data;
  };
  const rows = async (table: string) => (await api('/api/db/' + table)).data;
  check('staff members table initialized', await rows('staff_members'), []);
  check('staff attendance table initialized', await rows('staff_attendance'), []);
  const staffCreate = await api('/api/db-transaction', 'POST', { operations: [
    { table: 'staff_members', kind: 'add', id: 'staff-test', data: { id: 'staff-test', fullName: 'Test Staff', position: 'Cashier', isActive: true } },
  ] });
  check('staff member transaction', staffCreate.status, 200);
  const staff = staffCreate.data[0];
  check('staff member creation', staff.fullName, 'Test Staff');
  check('staff member readback', (await rows('staff_members'))[0].id, 'staff-test');
  const shiftCreate = await api('/api/db-transaction', 'POST', { operations: [
    { table: 'staff_attendance', kind: 'add', id: 'shift-test', data: {
      id: 'shift-test', staffId: staff.id, staffName: staff.fullName,
      workDate: '2026-09-26', checkInAt: '2026-09-26T08:00:00.000Z', checkOutAt: null,
    } },
  ] });
  check('attendance shift transaction', shiftCreate.status, 200);
  const shift = shiftCreate.data[0];
  check('attendance shift creation', shift.staffId, 'staff-test');
  check('attendance shift readback', (await rows('staff_attendance'))[0].id, 'shift-test');
  const blockedStaffDelete = await api('/api/db-transaction', 'POST', { operations: [
    { table: 'staff_members', kind: 'delete', id: 'staff-test' },
  ] });
  check('staff with open shift cannot be deleted', blockedStaffDelete.status, 409);
  check('blocked delete preserves staff', (await rows('staff_members')).length, 1);
  const checkout = await api('/api/db-transaction', 'POST', { operations: [
    { table: 'staff_attendance', kind: 'update', id: 'shift-test', data: { checkOutAt: '2026-09-26T16:00:00.000Z' } },
  ] });
  check('attendance shift checkout transaction', checkout.status, 200);
  check('attendance checkout persisted', (await rows('staff_attendance'))[0].checkOutAt, '2026-09-26T16:00:00.000Z');
  const deletedStaff = await api('/api/db-transaction', 'POST', { operations: [
    { table: 'staff_members', kind: 'delete', id: 'staff-test' },
  ] });
  check('staff delete transaction', deletedStaff.status, 200);
  check('deleted staff removed from roster', (await rows('staff_members')).length, 0);
  check('attendance history retained after staff deletion', (await rows('staff_attendance'))[0].staffName, 'Test Staff');
  await add('clients', { id: 'buyer', name: 'Test buyer', balance: 100000, points: 0, totalPaid: 0 });
  await add('products', { id: 'item', name: 'Test item', price: 10000, stock: 1 });
  const sale = { type: 'quick_sale', userId: 'buyer', paymentMethod: 'wallet', totalAmount: 10000, timestamp: new Date().toISOString(), items: [{ productId: 'item', quantity: 1, price: 10000 }] };
  const concurrent = await Promise.all(['one','two'].map(id => api('/api/db/sales', 'POST', { ...sale, id })));
  check('concurrent oversell blocked', concurrent.map(r => r.status).sort(), [200,409]);
  check('stock deducted once', (await rows('products'))[0].stock, 0);
  check('wallet deducted once', (await rows('clients'))[0].balance, 90000);
  const saved = (await rows('sales'))[0];
  check('delete invoice', (await api('/api/db/sales/' + saved.id, 'DELETE')).status, 200);
  check('refund wallet', (await rows('clients'))[0].balance, 100000);
  check('return stock', (await rows('products'))[0].stock, 1);
  const rollback = await api('/api/db-transaction', 'POST', { operations: [
    { table: 'clients', kind: 'add', id: 'rollback-client', data: { name: 'Must not survive' } },
    { table: 'sales', kind: 'add', id: 'bad-sale', data: { ...sale, items: [{ productId: 'item', quantity: 2, price: 10000 }] } },
  ] });
  check('batch failure', rollback.status, 409);
  check('batch rollback', (await rows('clients')).length, 1);
  await add('repairs', { id: 'repair', clientId: 'buyer', partsCost: 2000, laborCost: 8000, discount: 0, paidAmount: 4000, paymentMethod: 'account', status: 'received' });
  check('repair partial debit', (await rows('clients'))[0].balance, 96000);
  check('delivery update', (await api('/api/db/repairs/repair', 'PUT', { status: 'delivered' })).status, 200);
  check('delivery does not invent payment', (await rows('repairs'))[0].paidAmount, 4000);
  await api('/api/db/repairs/repair', 'PUT', { paidAmount: 0 });
  check('repair zero payment refund', (await rows('clients'))[0].balance, 100000);
  await add('system_users', { id: 'user', username: 'buyer', password: 'test-password', role: 'client', clientId: 'buyer' });
  const clientLogin = await api('/api/auth/login', 'POST', { username: 'buyer', password: 'test-password' });
  check('client login', clientLogin.status, 200);
  check('client cannot create money', (await api('/api/db/clients/buyer', 'PUT', { balance: 900000 }, clientLogin.cookie)).status, 409);
  check('client cannot read business accounts', (await api('/api/db/shareholders', 'GET', undefined, clientLogin.cookie)).status, 400);
  check('client cannot export all accounts', (await api('/api/backup', 'GET', undefined, clientLogin.cookie)).status, 403);
  const users = await rows('system_users');
  check('user list contains no secrets', users.some((u: any) => 'password' in u || 'passwordHash' in u), false);
  const backup = await api('/api/backup');
  check('database backup', backup.status, 200);
  await api('/api/db/clients/buyer', 'PUT', { balance: 123 });
  check('snapshot restore', (await api('/api/restore', 'POST', backup.data)).status, 200);
  check('restore invalidates login', (await api('/api/auth/me')).status, 401);
  cookie = (await api('/api/auth/login', 'POST', { username: 'admin', password: '1234' })).cookie;
  check('restore does not replay wallet effects', (await rows('clients'))[0].balance, 100000);
  check('restore does not replay stock effects', (await rows('products'))[0].stock, 1);
  console.log(`${passed} isolated MySQL/API checks passed.`);
} finally {
  if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child!.once('exit', resolve)); }
  // Only the exact random database created by this process can be removed.
  if (!/^gamenet_test_[a-f0-9]{16}$/.test(database) || database === config.database) throw new Error('Unsafe test database cleanup');
  await connection.query('DROP DATABASE IF EXISTS `' + database + '`');
  await connection.end();
  console.log('Temporary test database removed; diagnostic backups retained at ' + temporary);
}
