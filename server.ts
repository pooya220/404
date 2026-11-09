import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import mysql, { type Pool } from 'mysql2/promise';
import { applyMutation, type Mutation, type Store } from './server/ledger';
import { transaction } from './server/storage';
import { money, earnedPoints, POINT_CREDIT } from './src/lib/finance';

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MYSQL_CONFIG_PATH = path.resolve(
  process.env.MYSQL_CONFIG_FILE || path.join(process.cwd(), '.mysql_config.json')
);

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// Keep this list in sync with the collections used by the React application.
// Every collection uses the same lightweight JSON document storage schema.
const TABLES = [
  'consoles',
  'tariffs',
  'clients',
  'client_tiers',
  'sessions',
  'reservations',
  'products',
  'settings',
  'promotions',
  'sales',
  'purchases',
  'shareholders',
  'shareholder_payments',
  'monthly_fixed_costs',
  'fixed_expenses',
  'shared_expenses',
  'goals',
  'system_users',
  'staff_members',
  'staff_attendance',
  'client_transactions',
  'fixed_costs',
  'points_rewards',
  'points_festivals',
  'reports',
  'donations',
  'orders',
  'repairs',
  'wallet_transactions',
  'coupons'
] as const;

type TableName = typeof TABLES[number];
const COLLECTION_ALIASES: Record<string, TableName> = {
  tiers: 'client_tiers',
};

interface MySQLConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  enabled: boolean;
}

let mysqlConfig: MySQLConfig | null = null;
let pool: Pool | null = null;
let poolPromise: Promise<Pool> | null = null;

function isValidDatabaseName(value: string) {
  return /^[A-Za-z0-9_]+$/.test(value) && value.length <= 64;
}

function getConfiguredMySQL(): MySQLConfig | null {
  try {
    if (fs.existsSync(MYSQL_CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(MYSQL_CONFIG_PATH, 'utf8'));
      if (saved && typeof saved === 'object') {
        return {
          host: String(saved.host || '127.0.0.1'),
          port: String(saved.port || '3306'),
          user: String(saved.user || 'root'),
          password: String(saved.password || ''),
          database: String(saved.database || 'game_net_club'),
          enabled: saved.enabled !== false,
        };
      }
    }
  } catch (error) {
    console.error('Failed to read MySQL configuration:', error);
  }

  const hasEnvironmentConfig = Boolean(
    process.env.MYSQL_HOST ||
    process.env.MYSQL_DATABASE ||
    process.env.MYSQL_USER ||
    process.env.MYSQL_ENABLED
  );
  if (!hasEnvironmentConfig) return null;

  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: process.env.MYSQL_PORT || '3306',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'game_net_club',
    enabled: process.env.MYSQL_ENABLED !== 'false',
  };
}

mysqlConfig = getConfiguredMySQL();
if (mysqlConfig) {
  console.log('Loaded MySQL configuration:', { ...mysqlConfig, password: '****' });
}

async function initializeTables(activePool: Pool) {
  for (const table of TABLES) {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS \`${table}\` (
        \`id\` VARCHAR(255) NOT NULL,
        \`data\` LONGTEXT NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }
}

async function closePool() {
  if (!pool) return;
  try {
    await pool.end();
  } finally {
    pool = null;
  }
}

// Create the database and all application tables lazily. This works with the
// default WAMP MySQL installation and also allows the UI to configure MySQL.
async function getPool(): Promise<Pool | null> {
  if (pool) return pool;
  if (poolPromise) return poolPromise;
  if (!mysqlConfig || !mysqlConfig.enabled) return null;
  if (!isValidDatabaseName(mysqlConfig.database)) {
    throw new Error('Invalid MySQL database name. Use only letters, numbers and underscore.');
  }

  poolPromise = (async () => {
    try {
      const connection = await mysql.createConnection({
        host: mysqlConfig!.host,
        port: Number.parseInt(mysqlConfig!.port || '3306', 10),
        user: mysqlConfig!.user,
        password: mysqlConfig!.password,
        connectTimeout: 5000,
      });

      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${mysqlConfig!.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await connection.end();

      const createdPool = mysql.createPool({
        host: mysqlConfig!.host,
        port: Number.parseInt(mysqlConfig!.port || '3306', 10),
        user: mysqlConfig!.user,
        password: mysqlConfig!.password,
        database: mysqlConfig!.database,
        connectTimeout: 5000,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });

      await createdPool.query('SELECT 1');
      await initializeTables(createdPool);
      pool = createdPool;
      console.log(`Connected to MySQL database "${mysqlConfig!.database}".`);
      return createdPool;
    } catch (error: any) {
      console.error('Failed to establish MySQL pool:', error.message);
      throw error;
    } finally {
      poolPromise = null;
    }
  })();

  return poolPromise;
}

function isKnownTable(value: string): value is TableName {
  return (TABLES as readonly string[]).includes(value);
}

function resolveTable(value: unknown): TableName | null {
  if (typeof value !== 'string') return null;
  const resolved = COLLECTION_ALIASES[value] || value;
  return isKnownTable(resolved) ? resolved : null;
}

function getRequestItem(body: unknown, forcedId?: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const item = { ...(body as Record<string, unknown>) };
  const id = forcedId || String(item.id || randomUUID());
  if (!id || id.length > 255) throw new Error('Record id is invalid.');
  item.id = id;
  return item;
}

function publicConfig(config: MySQLConfig) {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gamenet-plus-manager', databaseConfigured: Boolean(mysqlConfig) });
});

// API: Get Status
app.get('/api/mysql/status', async (_req, res) => {
  if (!mysqlConfig) {
    return res.json({ enabled: false, status: 'NOT_CONFIGURED' });
  }

  if (!mysqlConfig.enabled) {
    return res.json({ enabled: false, status: 'DISABLED' });
  }

  try {
    const activePool = await getPool();
    if (!activePool) throw new Error('MySQL integration is disabled.');
    await activePool.query('SELECT 1');
    return res.json({
      enabled: true,
      status: 'CONNECTED',
      config: publicConfig(mysqlConfig),
    });
  } catch (err: any) {
    return res.json({
      enabled: true,
      status: 'ERROR',
      error: err.message,
      config: publicConfig(mysqlConfig),
    });
  }
});

const sessions = new Map<string, { userId: string; expires: number }>();
const loginAttempts = new Map<string, { count: number; since: number }>();
const safeUser = (u: any) => { const { password, passwordHash, ...safe } = u; return safe; };
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
const passwordMatches = (value: string, hash: string) => {
  try { const [salt, encoded] = hash.split(':'); return timingSafeEqual(scryptSync(value, salt, 64), Buffer.from(encoded, 'hex')); } catch { return false; }
};
async function withStore<T>(work: (store: Store) => Promise<T>) {
  const activePool = await getPool();
  if (!activePool) throw new Error('اتصال MySQL غیرفعال است.');
  return transaction(activePool, TABLES, work);
}
const sessionToken = (req: express.Request) => (req.headers.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith('gn_session='))?.slice(11);
async function authenticatedUser(req: express.Request) {
  const token = sessionToken(req);
  const auth = token && sessions.get(token);
  if (!auth || auth.expires < Date.now()) return null;
  const user = await withStore(store => store.get('system_users', auth.userId));
  return user?.isActive !== false && user?.role ? safeUser(user) : null;
}
app.post('/api/auth/login', async (req, res) => {
  try {
    const key = req.ip || 'local';
    const attempt = loginAttempts.get(key);
    if (attempt && Date.now() - attempt.since < 60000 && attempt.count >= 10) return res.status(429).json({ error: 'یک دقیقه صبر کنید و دوباره تلاش کنید.' });
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 256) return res.status(400).json({ error: 'اطلاعات ورود نامعتبر است.' });
    const user = await withStore(async store => {
      const users = await store.list('system_users');
      let candidate = users.find(u => String(u.username || '').trim().toLowerCase() === username.trim().toLowerCase());
      // One real, editable bootstrap account replaces the old permanent client-side bypass.
      if (!users.some(u => u.role === 'admin') && username.trim().toLowerCase() === 'admin' && password === '1234') {
        candidate = { id: 'default_admin', username: 'admin', fullName: 'مدیر سیستم', role: 'admin', isActive: true, passwordHash: hashPassword(password) };
        await store.put('system_users', candidate);
      }
      if (!candidate || candidate.isActive === false) return null;
      const valid = candidate.passwordHash ? passwordMatches(password, candidate.passwordHash) : String(candidate.password) === password;
      if (!valid) return null;
      if (!candidate.passwordHash) {
        candidate.passwordHash = hashPassword(password); delete candidate.password;
        await store.put('system_users', candidate);
      }
      if (candidate.role === 'client' && (!candidate.clientId || !await store.get('clients', candidate.clientId))) {
        const matches = (await store.list('clients')).filter(c =>
          (candidate.phone && c.phone === candidate.phone) || (candidate.username && c.username === candidate.username));
        if (matches.length > 1) throw new Error('چند پرونده مشتری با این مشخصات وجود دارد؛ مدیر باید پرونده درست را متصل کند.');
        const client = matches[0] || { id: randomUUID(), name: candidate.fullName || candidate.username, username: candidate.username, phone: candidate.phone || '', balance: 0, totalPaid: 0, totalPlayTime: 0, points: 0, tier: 'bronze' };
        if (!matches.length) await store.put('clients', client);
        candidate.clientId = client.id; await store.put('system_users', candidate);
      }
      return safeUser(candidate);
    });
    if (!user) {
      loginAttempts.set(key, { count: attempt && Date.now() - attempt.since < 60000 ? attempt.count + 1 : 1, since: attempt && Date.now() - attempt.since < 60000 ? attempt.since : Date.now() });
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
    }
    loginAttempts.delete(key);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expires: Date.now() + 12 * 3600000 });
    res.setHeader('Set-Cookie', `gn_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
    res.json(user);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
app.get('/api/auth/me', async (req, res) => {
  try { const user = await authenticatedUser(req); res.status(user ? 200 : 401).json(user || { error: 'ابتدا وارد شوید.' }); }
  catch { res.status(503).json({ error: 'اتصال پایگاه داده برقرار نیست.' }); }
});
app.post('/api/auth/logout', (req, res) => {
  const token = sessionToken(req); if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'gn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ success: true });
});
app.use('/api', async (req, res, next) => {
  try {
    const user = await authenticatedUser(req);
    if (!user) {
      if (req.method === 'GET' && req.path === '/db/settings') return res.json([]);
      return res.status(401).json({ error: 'نشست ورود منقضی شده است؛ دوباره وارد شوید.' });
    }
    if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'مبدأ درخواست معتبر نیست.' });
    (req as any).user = user;
    if ((req.path.startsWith('/mysql/') || req.path.startsWith('/backup') || req.path.startsWith('/restore')) && user.role !== 'admin') return res.status(403).json({ error: 'این عملیات فقط برای مدیر مجاز است.' });
    next();
  } catch (err: any) { res.status(503).json({ error: err.message }); }
});

// API: Configure and Setup MySQL
app.post('/api/mysql/setup', async (req, res) => {
  try {
    const { host, port, user, password, database, enabled } = req.body || {};
    const normalizedPort = String(port || '3306');
    const parsedPort = Number.parseInt(normalizedPort, 10);
    const normalizedDatabase = String(database || 'game_net_club').trim();

    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      return res.status(400).json({ success: false, error: 'MySQL port is invalid.' });
    }
    if (!isValidDatabaseName(normalizedDatabase)) {
      return res.status(400).json({
        success: false,
        error: 'Database name may contain only letters, numbers and underscore.',
      });
    }

    mysqlConfig = {
      host: String(host || '127.0.0.1').trim(),
      port: normalizedPort,
      user: String(user || 'root').trim(),
      password: String(password || ''),
      database: normalizedDatabase,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
    };

    await closePool();

    fs.mkdirSync(path.dirname(MYSQL_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(MYSQL_CONFIG_PATH, JSON.stringify(mysqlConfig, null, 2), 'utf8');

    if (!mysqlConfig.enabled) {
      return res.json({ success: true, message: "MySQL database has been disabled. Falling back to local/browser storage." });
    }

    const activePool = await getPool();
    if (!activePool) throw new Error('Could not create MySQL connection pool.');
    await activePool.query('SELECT 1');

    return res.json({
      success: true,
      message: "MySQL database successfully connected and tables initialized!"
    });
  } catch (err: any) {
    console.error("MySQL Setup error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || 'خطا در برقراری ارتباط با پایگاه داده MySQL. اطلاعات وارد شده را مجدداً بررسی کنید.'
    });
  }
});

// API: Disable MySQL & Reset Backend Config
app.post('/api/mysql/clear-config', async (req, res) => {
  mysqlConfig = null;
  await closePool();
  if (fs.existsSync(MYSQL_CONFIG_PATH)) fs.unlinkSync(MYSQL_CONFIG_PATH);
  return res.json({ success: true, message: "MySQL configuration cleared successfully." });
});

// API: Seed and Upload Table Data (Sync localstorage contents into MySQL)
app.post('/api/mysql/seed-collection', async (req, res) => {
  try {
    const { path: collectionPath, data } = req.body || {};
    const tableName = resolveTable(collectionPath);
    if (!tableName) {
      return res.status(400).json({ error: "نام سرفصل غیرمجاز است." });
    }

    const activePool = await getPool();
    if (!activePool) {
      return res.status(503).json({ error: "پایگاه داده MySQL فعال نیست." });
    }

    let count = 0;
    if (Array.isArray(data)) {
      console.log(`Seeding table ${collectionPath} with ${data.length} records...`);
      for (const item of data) {
        if (!item || !item.id) continue;
        const serialized = JSON.stringify(item);
        await activePool.query(
          `INSERT INTO \`${tableName}\` (\`id\`, \`data\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`data\` = ?`,
          [String(item.id), serialized, serialized]
        );
        count += 1;
      }
    }

    res.json({ success: true, count });
  } catch (err: any) {
    console.error(`Error seeding ${req.body?.path}:`, err);
    res.status(500).json({ error: err.message });
  }
});

function authorizeTable(user: any, table: string, write = false, id?: string, data?: any) {
  if (user.role === 'admin') return;
  if (!['operator', 'client'].includes(user.role)) throw new Error('نقش کاربر معتبر نیست.');
  if (user.role !== 'client') {
    if (['settings', 'system_users', 'points_rewards', 'points_festivals'].includes(table) && write && !(table === 'system_users' && data?.role === 'client')) throw new Error('دسترسی مدیریتی لازم است.');
    return;
  }
  if (!write) {
    if (['shareholders','shareholder_payments','monthly_fixed_costs','fixed_expenses','shared_expenses','purchases','goals','reports','staff_members','staff_attendance'].includes(table)) throw new Error('دسترسی به این اطلاعات مجاز نیست.');
    return;
  }
  const allowed = table === 'clients' && id === user.clientId ? ['name','phone','avatar','id','_rev']
    : table === 'system_users' && id === user.id ? ['fullName','username','password','id','_rev'] : [];
  if (!allowed.length || Object.keys(data || {}).some(k => !allowed.includes(k))) throw new Error('این تغییر فقط توسط مسئول صندوق مجاز است.');
}
async function prepareMutation(store: Store, op: Mutation, user: any) {
  const previousRecord = await store.get(op.table, op.id);
  if (user.role === 'client' && op.kind !== 'update') throw new Error('ایجاد و حذف پرونده فقط توسط مسئول مجاز است.');
  if (user.role === 'operator' && op.table === 'system_users' && previousRecord && previousRecord.role !== 'client') throw new Error('ویرایش حساب مدیر یا اپراتور مجاز نیست.');
  authorizeTable(user, op.table, true, op.id, user.role === 'operator' && op.table === 'system_users' && previousRecord?.role === 'client' ? { ...op.data, role: op.data?.role || 'client' } : op.data);
  if (op.table === 'staff_members' && op.kind === 'delete' &&
      (await store.list('staff_attendance')).some(row => row.staffId === op.id && !row.checkOutAt)) {
    throw new Error('ابتدا خروج این پرسنل را ثبت کنید؛ حذف پرسنل با شیفت باز امکان‌پذیر نیست.');
  }
  if (op.table === 'system_users' && previousRecord?.role === 'admin' &&
      (op.kind === 'delete' || op.data?.isActive === false || (op.data?.role && op.data.role !== 'admin'))) {
    if (!(await store.list('system_users')).some(u => u.id !== op.id && u.role === 'admin' && u.isActive !== false)) throw new Error('آخرین مدیر فعال سیستم قابل حذف یا غیرفعال‌سازی نیست.');
  }
  if (op.table === 'system_users' && op.data) {
    const previous = await store.get(op.table, op.id);
    const data = { ...op.data };
    delete data.passwordHash;
    if (data.password) { data.passwordHash = hashPassword(String(data.password)); delete data.password; }
    else delete data.password;
    const username = String(data.username ?? previous?.username ?? '').trim();
    if (!username) throw new Error('نام کاربری لازم است.');
    if ((await store.list('system_users')).some(u => u.id !== op.id && String(u.username || '').trim().toLowerCase() === username.toLowerCase())) throw new Error('نام کاربری تکراری است.');
    op.data = { ...data, username };
  }
  if (op.table === 'system_users' && op.kind === 'delete') {
    if (op.id === user.id) throw new Error('حساب فعال خود را نمی‌توانید حذف کنید.');
  }
  return applyMutation(store, op);
}
app.get('/api/db/:path', async (req, res) => {
  const table = resolveTable(req.params.path);
  if (!table) return res.status(404).json({ error: 'جدول یافت نشد.' });
  try {
    const user = (req as any).user;
    authorizeTable(user, table);
    let rows = await withStore(store => store.list(table));
    if (user.role === 'client') {
      if (table === 'clients') rows = rows.filter(r => r.id === user.clientId);
      if (table === 'system_users') rows = rows.filter(r => r.id === user.id);
      if (['sales','sessions','repairs','donations','reservations','orders','wallet_transactions','coupons','client_transactions'].includes(table)) {
        rows = rows.filter(r => r.clientId === user.clientId || r.userId === user.clientId || r.customerId === user.clientId || r.userIds?.includes(user.clientId) || r.splitUserIds?.includes(user.clientId));
      }
    }
    res.json(table === 'system_users' ? rows.map(safeUser) : rows);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/db-transaction', async (req, res) => {
  try {
    const operations = req.body.operations;
    if (!Array.isArray(operations) || !operations.length || operations.length > 300) throw new Error('تراکنش نامعتبر است.');
    const results = await withStore(async store => {
      const results = [];
      for (const raw of operations) {
        const table = resolveTable(raw.table);
        if (!table || !['add','update','delete'].includes(raw.kind) || typeof raw.id !== 'string') throw new Error('عملیات نامعتبر است.');
        results.push(await prepareMutation(store, { ...raw, table }, (req as any).user));
      }
      return results;
    });
    res.json(results.map((r,i)=>operations[i].table === 'system_users' ? safeUser(r) : r));
  } catch (err: any) { res.status(409).json({ error: err.message }); }
});
for (const [method, kind] of [['post','add'], ['put','update'], ['delete','delete']] as const) {
  app[method](kind === 'add' ? '/api/db/:path' : '/api/db/:path/:id', async (req, res) => {
    const table = resolveTable(req.params.path);
    if (!table) return res.status(404).json({ error: 'جدول یافت نشد.' });
    try {
      const { _expected, ...data } = req.body || {};
      const id = String((req.params as any).id || data.id || randomUUID());
      const result = await withStore(store => prepareMutation(store, { table, kind, id, data: kind === 'delete' ? undefined : data, expected: _expected }, (req as any).user));
      res.json(table === 'system_users' ? safeUser(result) : result);
    } catch (err: any) { res.status(409).json({ error: err.message }); }
  });
}
const backupDirectory = process.env.BACKUP_DIRECTORY ? path.resolve(process.env.BACKUP_DIRECTORY) : path.resolve(process.cwd(), '..', 'gamenet-plus-manager-backups', 'database');
async function snapshot(store: Store) {
  const data: Record<string, any[]> = {};
  for (const table of TABLES) data[table] = await store.list(table);
  return { version: '2.0', timestamp: new Date().toISOString(), database: mysqlConfig?.database, data };
}
async function saveSnapshot(store: Store, label: string) {
  const data = await snapshot(store);
  fs.mkdirSync(backupDirectory, { recursive: true });
  const filename = label + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(backupDirectory, filename), JSON.stringify(data, null, 2));
  return data;
}
app.get('/api/backup', async (_req, res) => {
  try { res.json(await withStore(store => saveSnapshot(store, 'manual'))); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});
app.post('/api/restore', async (req, res) => {
  try {
    const raw = req.body?.data;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ساختار بکاپ نامعتبر است.');
    const normalized: Record<string, any[]> = {};
    for (const [key, value] of Object.entries(raw)) {
      const table = resolveTable(key.replace(/^db_/, ''));
      if (!table) continue;
      if (!Array.isArray(value) || value.some(r => !r || typeof r !== 'object' || !r.id)) throw new Error('همه رکوردهای بکاپ باید شناسه معتبر داشته باشند: ' + table);
      if (new Set(value.map(r=>String(r.id))).size !== value.length) throw new Error('شناسه تکراری در بکاپ: ' + table);
      normalized[table] = value;
    }
    if (!Object.keys(normalized).length) throw new Error('بکاپ داده قابل بازیابی ندارد.');
    await withStore(async store => {
      await saveSnapshot(store, 'before-restore');
      // Restore is a snapshot operation: domain effects must NOT run again.
      for (const [table, rows] of Object.entries(normalized)) {
        for (const old of await store.list(table)) await store.delete(table, old.id);
        for (const row of rows) await store.put(table, { ...row, id: String(row.id) });
      }
    });
    sessions.clear();
    res.json({ success: true, tables: Object.keys(normalized).length });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
app.post('/api/client-action', async (req, res) => {
  try {
    const user = (req as any).user;
    const { clientId, action, points, rewardId, message, amount, paymentMethod } = req.body || {};
    if (user.role === 'client' && user.clientId !== clientId) throw new Error('حساب مشتری معتبر نیست.');
    const result = await withStore(async store => {
      const client = await store.get('clients', clientId);
      if (!client || client.isGuest) throw new Error('مشتری معتبر نیست.');
      const now = new Date().toISOString();
      if (action === 'convert') {
        const count = Number(points);
        if (!Number.isInteger(count) || count <= 0 || count > money(client.points)) throw new Error('تعداد امتیاز معتبر نیست.');
        const credit = count * POINT_CREDIT;
        await store.put('clients', { ...client, points: money(client.points) - count, balance: money(client.balance) + credit });
        await store.put('wallet_transactions', { id: randomUUID(), clientId, type: 'points_conversion', amount: credit, points: -count, timestamp: now });
        return { credit };
      }
      if (action === 'reward') {
        const reward = await store.get('points_rewards', rewardId);
        if (!reward || reward.isActive === false || !(money(reward.cost) > 0) || money(client.points) < money(reward.cost)) throw new Error('جایزه یا امتیاز معتبر نیست.');
        const updated = { ...client, points: money(client.points) - money(reward.cost) };
        if (reward.type === 'wallet_cashback') {
          const credit = money(reward.cost) * POINT_CREDIT;
          updated.balance = money(client.balance) + credit;
          await store.put('wallet_transactions', { id: randomUUID(), clientId, type: 'points_conversion', amount: credit, timestamp: now });
        } else if (['discount_coupon','free_game'].includes(reward.type)) {
          await store.put('coupons', { id: randomUUID(), clientId, code: randomBytes(8).toString('hex').toUpperCase(), type: reward.title, title: reward.title, rewardType: reward.type, date: now, usedAt: null });
        } else if (reward.type === 'custom_nickname') {
          if (!String(req.body.name || '').trim()) throw new Error('نام لازم است.');
          updated.name = String(req.body.name).trim();
          const username = String(req.body.username || client.username || '').trim();
          const users = await store.list('system_users');
          const linked = users.find(u => u.clientId === client.id);
          if (username && users.some(u => u.id !== linked?.id && String(u.username || '').trim().toLowerCase() === username.toLowerCase())) throw new Error('نام کاربری تکراری است.');
          if (username) updated.username = username;
          if (linked) await store.put('system_users', { ...linked, fullName: updated.name, username: username || linked.username });
        } else if (reward.type === 'profile_avatar_unlock') updated.avatar = String(req.body.avatar || '');
        else throw new Error('نوع جایزه معتبر نیست.');
        await store.put('clients', updated);
        return { success: true };
      }
      if (action === 'donate') {
        if (paymentMethod !== 'wallet') throw new Error('پرداخت آنلاین فعال نیست؛ پرداخت باید از کیف پول انجام شود.');
        if (!(Number(amount) > 0) || !Number.isFinite(Number(amount)) || money(client.balance) < Number(amount)) throw new Error('مبلغ یا موجودی کافی نیست.');
        await store.put('clients', { ...client, balance: money(client.balance) - Number(amount), points: money(client.points) + earnedPoints(Number(amount)) });
        await store.put('donations', { id: randomUUID(), clientId, clientName: client.name, amount: Number(amount), message: String(message || ''), paymentMethod, timestamp: now });
        await store.put('wallet_transactions', { id: randomUUID(), clientId, type: 'donation', amount: -Number(amount), timestamp: now });
        return { success: true };
      }
      if (action === 'use_coupon') {
        if (user.role === 'client') throw new Error('مصرف کد باید توسط مسئول صندوق تأیید شود.');
        const coupon = await store.get('coupons', String(req.body.couponId || ''));
        if (!coupon || coupon.clientId !== clientId || coupon.usedAt) throw new Error('کد معتبر نیست یا قبلاً استفاده شده است.');
        await store.put('coupons', { ...coupon, usedAt: now, usedBy: user.id });
        return { success: true };
      }
      throw new Error('عملیات نامعتبر است.');
    });
    res.json(result);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
let lastAutomaticBackup = '';
setInterval(() => {
  const day = new Date().toISOString().slice(0, 10);
  if (lastAutomaticBackup === day) return;
  withStore(async store => {
    const settings = (await store.list('settings'))[0];
    if (settings?.autoBackup === false) return;
    await saveSnapshot(store, 'automatic'); lastAutomaticBackup = day;
  }).catch(err => console.error('Automatic backup failed:', err.message));
}, 60000).unref();

// Return JSON for malformed requests instead of an HTML error page.
app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  return next(error);
});

// Vite Setup or Static Delivery
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // ZIP uploads and generated staging files must not be watched by Vite.
        // Windows can briefly lock an uploading ZIP and otherwise crash the
        // development server with an EBUSY watcher error.
        watch: {
          ignored: [
            '**/update/**',
            '**/logs/**',
            '**/dist/**',
            '**/gamenet-plus-manager-backups/**',
          ],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server loaded as Express middleware.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error('dist/index.html not found. Run "npm run build" before starting production.');
    }
    app.use(express.static(distPath));
    app.get('/{*all}', (req, res) => {
      res.sendFile(indexPath);
    });
    console.log("Serving compiled production build from dist.");
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
  });
}

initServer().catch(err => {
  console.error("Failed to start express server:", err);
  process.exitCode = 1;
});

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
