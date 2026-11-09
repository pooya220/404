import express from 'express';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

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
  'repairs'
];

let mysqlConfig: any = null;
let pool: any = null;

// Clean existing config if file is corrupted
try {
  if (fs.existsSync('.mysql_config.json')) {
    mysqlConfig = JSON.parse(fs.readFileSync('.mysql_config.json', 'utf8'));
    console.log("Loaded MySQL Config on startup:", { ...mysqlConfig, password: '****' });
  }
} catch (e) {
  console.error("Failed to read .mysql_config.json", e);
}

// Help create the pool lazily
async function getPool() {
  if (pool) return pool;
  if (!mysqlConfig || !mysqlConfig.enabled) return null;

  try {
    // 1. First connect without a database to make sure details are correct & database is created
    const connection = await mysql.createConnection({
      host: mysqlConfig.host,
      port: parseInt(mysqlConfig.port || '3306'),
      user: mysqlConfig.user,
      password: mysqlConfig.password,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\``);
    await connection.end();

    // 2. Build our actual pool
    pool = mysql.createPool({
      host: mysqlConfig.host,
      port: parseInt(mysqlConfig.port || '3306'),
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      database: mysqlConfig.database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    console.log("Created MySQL connection pool successfully.");
    return pool;
  } catch (error: any) {
    console.error("Failed to establish pool:", error.message);
    pool = null; // reset
    throw error;
  }
}

// API: Get Status
app.get('/api/mysql/status', async (req, res) => {
  if (!mysqlConfig) {
    return res.json({ enabled: false, status: 'NOT_CONFIGURED' });
  }

  if (!mysqlConfig.enabled) {
    return res.json({ enabled: false, status: 'DISABLED' });
  }

  try {
    const activePool = await getPool();
    await activePool.query('SELECT 1');
    res.json({
      enabled: true,
      status: 'CONNECTED',
      config: {
        host: mysqlConfig.host,
        port: mysqlConfig.port,
        user: mysqlConfig.user,
        database: mysqlConfig.database,
      }
    });
  } catch (err: any) {
    res.json({
      enabled: true,
      status: 'ERROR',
      error: err.message,
      config: {
        host: mysqlConfig.host,
        port: mysqlConfig.port,
        user: mysqlConfig.user,
        database: mysqlConfig.database,
      }
    });
  }
});

// API: Configure and Setup MySQL
app.post('/api/mysql/setup', async (req, res) => {
  try {
    const { host, port, user, password, database, enabled } = req.body;
    
    // Save state
    mysqlConfig = {
      host: host || 'localhost',
      port: port || '3306',
      user: user || 'root',
      password: password || '',
      database: database || 'game_net_club',
      enabled: enabled !== undefined ? enabled : true
    };

    // Kill existing pool if running
    if (pool) {
      try {
        await pool.end();
      } catch (e) {}
      pool = null;
    }

    // Write file
    fs.writeFileSync('.mysql_config.json', JSON.stringify(mysqlConfig, null, 2), 'utf8');

    if (!mysqlConfig.enabled) {
      return res.json({ success: true, message: "MySQL database has been disabled. Falling back to local/browser storage." });
    }

    // Establish the database & pool
    const activePool = await getPool();
    await activePool.query('SELECT 1');

    // Run table initializations in parallel or sequentially
    console.log("Initializing MySQL database tables...");
    for (const table of TABLES) {
      await activePool.query(`
        CREATE TABLE IF NOT EXISTS \`${table}\` (
          \`id\` VARCHAR(255) NOT NULL,
          \`data\` LONGTEXT NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }

    res.json({
      success: true,
      message: "MySQL database successfully connected and tables initialized!"
    });
  } catch (err: any) {
    console.error("MySQL Setup error:", err);
    res.status(500).json({
      success: false,
      error: err.message || 'خطا در برقراری ارتباط با پایگاه داده MySQL. اطلاعات وارد شده را مجدداً بررسی کنید.'
    });
  }
});

// API: Disable MySQL & Reset Backend Config
app.post('/api/mysql/clear-config', async (req, res) => {
  mysqlConfig = null;
  if (pool) {
    try {
      await pool.end();
    } catch (e) {}
    pool = null;
  }
  if (fs.existsSync('.mysql_config.json')) {
    fs.unlinkSync('.mysql_config.json');
  }
  res.json({ success: true, message: "MySQL configuration cleared successfully." });
});

// API: Seed and Upload Table Data (Sync localstorage contents into MySQL)
app.post('/api/mysql/seed-collection', async (req, res) => {
  try {
    const { path, data } = req.body;
    if (!TABLES.includes(path)) {
      return res.status(400).json({ error: "نام سرفصل غیرمجاز است." });
    }

    const activePool = await getPool();
    if (!activePool) {
      return res.status(400).json({ error: "پایگاه داده MySQL فعال نیست." });
    }

    if (Array.isArray(data)) {
      console.log(`Seeding table ${path} with ${data.length} records...`);
      for (const item of data) {
        if (!item || !item.id) continue;
        const serialized = JSON.stringify(item);
        await activePool.query(
          `INSERT INTO \`${path}\` (\`id\`, \`data\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`data\` = ?`,
          [String(item.id), serialized, serialized]
        );
      }
    }

    res.json({ success: true, count: Array.isArray(data) ? data.length : 0 });
  } catch (err: any) {
    console.error(`Error seeding ${req.body.path}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Dynamic CRUD API for Collections
app.get('/api/db/:path', async (req, res) => {
  const { path: routePath } = req.params;
  if (!TABLES.includes(routePath)) {
    return res.status(404).json({ error: "Table not found" });
  }

  try {
    const activePool = await getPool();
    if (!activePool) {
      return res.status(400).json({ error: "MySQL integration not enabled" });
    }

    const [rows]: any = await activePool.query(`SELECT \`data\` FROM \`${routePath}\``);
    const parsed = rows.map((r: any) => {
      try {
        return JSON.parse(r.data);
      } catch (e) {
        return null;
      }
    }).filter((item: any) => item !== null);

    res.json(parsed);
  } catch (err: any) {
    console.error(`Get Collection error for ${routePath}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/:path', async (req, res) => {
  const { path: routePath } = req.params;
  if (!TABLES.includes(routePath)) {
    return res.status(404).json({ error: "Table not found" });
  }

  try {
    const activePool = await getPool();
    if (!activePool) {
      return res.status(400).json({ error: "MySQL integration not enabled" });
    }

    const item = req.body;
    if (!item.id) {
      item.id = Math.random().toString(36).substr(2, 9);
    }

    const serialized = JSON.stringify(item);
    await activePool.query(
      `INSERT INTO \`${routePath}\` (\`id\`, \`data\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`data\` = ?`,
      [String(item.id), serialized, serialized]
    );

    res.json(item);
  } catch (err: any) {
    console.error(`Post to ${routePath} failed:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/db/:path/:id', async (req, res) => {
  const { path: routePath, id } = req.params;
  if (!TABLES.includes(routePath)) {
    return res.status(404).json({ error: "Table not found" });
  }

  try {
    const activePool = await getPool();
    if (!activePool) {
      return res.status(400).json({ error: "MySQL integration not enabled" });
    }

    const item = req.body;
    item.id = id; // ensure id aligns

    const serialized = JSON.stringify(item);
    await activePool.query(
      `INSERT INTO \`${routePath}\` (\`id\`, \`data\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`data\` = ?`,
      [String(id), serialized, serialized]
    );

    res.json(item);
  } catch (err: any) {
    console.error(`Put to ${routePath}/${id} failed:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/db/:path/:id', async (req, res) => {
  const { path: routePath, id } = req.params;
  if (!TABLES.includes(routePath)) {
    return res.status(404).json({ error: "Table not found" });
  }

  try {
    const activePool = await getPool();
    if (!activePool) {
      return res.status(400).json({ error: "MySQL integration not enabled" });
    }

    await activePool.query(`DELETE FROM \`${routePath}\` WHERE \`id\` = ?`, [String(id)]);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Delete to ${routePath}/${id} failed:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Vite Setup or Static Delivery
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server loaded as Express middleware.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Serving compiled production build from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}

initServer().catch(err => {
  console.error("Failed to start express server:", err);
});
