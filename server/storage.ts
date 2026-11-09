import type { Pool, PoolConnection } from 'mysql2/promise';
import type { Store } from './ledger';

export function makeStore(connection: PoolConnection, tables: readonly string[]): Store {
  const check = (name: string) => { if (!tables.includes(name)) throw new Error('جدول نامعتبر است.'); return name; };
  return {
    async get(table, id) {
      const [rows]: any = await connection.query(`SELECT data FROM \`${check(table)}\` WHERE id = ?`, [id]);
      return rows.length ? JSON.parse(rows[0].data) : null;
    },
    async list(table) {
      const [rows]: any = await connection.query(`SELECT data FROM \`${check(table)}\``);
      return rows.map((row: any) => JSON.parse(row.data));
    },
    async put(table, item) {
      const previous = await this.get(table, item.id);
      const updated = { ...item, _rev: (Number(previous?._rev) || 0) + 1 };
      await connection.query(`INSERT INTO \`${check(table)}\` (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?`, [item.id, JSON.stringify(updated), JSON.stringify(updated)]);
    },
    async delete(table, id) { await connection.query(`DELETE FROM \`${check(table)}\` WHERE id = ?`, [id]); },
  };
}

export async function transaction<T>(pool: Pool, tables: readonly string[], work: (store: Store) => Promise<T>) {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [lock]: any = await connection.query("SELECT GET_LOCK(CONCAT(DATABASE(), ':ledger'), 15) AS acquired");
    if (Number(lock[0]?.acquired) !== 1) throw new Error('سیستم در حال ثبت تراکنش دیگری است؛ دوباره تلاش کنید.');
    locked = true;
    await connection.beginTransaction();
    const result = await work(makeStore(connection, tables));
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':ledger'))");
    connection.release();
  }
}
