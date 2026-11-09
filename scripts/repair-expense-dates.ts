// Explicit, narrowly scoped repair for dates built with new Date(JalaliYear, month, 15).
// Dry run by default. --apply requires an existing full SQL backup.
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { transaction } from '../server/storage';
import { getJalaliMonthRange } from '../src/lib/dateUtils';

const config = JSON.parse(fs.readFileSync('.mysql_config.json', 'utf8'));
const pool = mysql.createPool({ host: config.host, port: Number(config.port), user: config.user, password: config.password, database: config.database });
const apply = process.argv.includes('--apply');
const backup = process.argv.find(a => a.startsWith('--backup='))?.slice(9);
try {
  if (apply && (!backup || !fs.existsSync(backup) || fs.statSync(backup).size < 100)) throw new Error('An existing SQL backup is required');
  await transaction(pool, ['shared_expenses'], async store => {
    const changes = [];
    for (const before of await store.list('shared_expenses')) {
      const old = new Date(before.date);
      if (!Number.isFinite(old.getTime()) || old.getFullYear() < 1300 || old.getFullYear() > 1500 || old.getDate() !== 15 || before.dateRepair) continue;
      const year = old.getFullYear(), month = old.getMonth();
      const date = getJalaliMonthRange(year, month).start;
      date.setDate(date.getDate() + 14);
      changes.push({ before, after: { ...before, year, month, date: date.toISOString(), dateRepair: { originalDate: before.date, rule: 'jalali-year-used-as-gregorian', at: new Date().toISOString() } } });
    }
    console.log(JSON.stringify({ apply, changes: changes.map(c => ({ id: c.before.id, before: c.before.date, after: c.after.date })) }, null, 2));
    if (apply && changes.length) {
      const audit = path.resolve(path.dirname(backup!), 'expense-date-repair-' + Date.now() + '.json');
      fs.writeFileSync(audit, JSON.stringify(changes, null, 2));
      for (const change of changes) await store.put('shared_expenses', change.after);
      console.log('Audit copy: ' + audit);
    }
  });
} finally { await pool.end(); }
