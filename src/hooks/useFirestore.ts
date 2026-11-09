import { useState, useEffect, useCallback } from 'react';

// یک سیستم ساده برای ثبت تغییرات و آپدیت کردن بقیه کامپوننت‌ها
const cachedRows = new Map<string, any>();
const listeners: Set<() => void> = new Set();
export const triggerDatabaseRefresh = () => listeners.forEach(l => l());
const notify = () => listeners.forEach(l => l());

// MySQL is the default backend for the installed WAMP setup. Keep the local
// browser store only when the user explicitly disabled MySQL in Settings.
const getDatabaseMode = () => {
  const storedMode = localStorage.getItem('db_mode');
  const explicitChoice = localStorage.getItem('db_mode_explicit') === 'true';
  return explicitChoice && storedMode === 'local' ? 'local' : 'mysql';
};

const SEED_DATA: Record<string, any[]> = {
  points_rewards: [
    {
      id: "reward_1",
      title: "لقب و نام نمای کارت کلوپ",
      cost: 10,
      type: "custom_nickname",
      description: "تغییر نام مستعار دلخواه که روی کارت کلوب دیجیتالی و رنکینگ‌ها نمایش داده می‌شود.",
      isActive: true
    },
    {
      id: "reward_2",
      title: "تغییر کاراکتر و آواتار منو",
      cost: 15,
      type: "profile_avatar_unlock",
      description: "آزاد کردن شخصیت‌های انیمیشنی معتبر بازی‌های تاریخی روی عکس کاربری.",
      isActive: true
    },
    {
      id: "reward_3",
      title: "کوپن تخفیف بوفه کلوب",
      cost: 25,
      type: "discount_coupon",
      description: "دریافت کوپن تخفیف ۲۰,۰۰۰ تومانی بوفاران به صورت خودکار و کسر امتیاز.",
      isActive: true
    },
    {
      id: "reward_4",
      title: "۱ ساعت بازی رایگان کنسول",
      cost: 40,
      type: "free_game",
      description: "صدور آنی کارت ۱ ساعت بازی رایگان روی کلیه کنسول‌های بازی کلوب.",
      isActive: true
    }
  ],
  points_festivals: [
    {
      id: "fest_1",
      title: "خرید نقدی یا اعتباری کلوپ",
      points: "هر ۱۰,۰۰۰ تومان معادل ۱ امتیاز",
      description: "به صورت خودکار با ثبت فاکتور خرید در سیستم اعمال می‌شود.",
      isFixed: true,
      isActive: true
    },
    {
      id: "fest_2",
      title: "حضور و بازی در ایستگاه‌ها",
      points: "هر ۳۰ دقیقه بازی ۱.۵ امتیاز",
      description: "به صورت خودکار با ثبت تایم کنسول یا بردگیم در سیستم اعمال می‌شود.",
      isFixed: true,
      isActive: true
    },
    {
      id: "fest_3",
      title: "شرکت در مینی‌گیم‌های هفتگی",
      points: "کسب رتبه‌های ۱ تا ۳ تا ۲۰ امتیاز",
      description: "توسط ادمین کلوب در زمان قرعه‌کشی یا مسابقات اعمال می‌شود.",
      isFixed: true,
      isActive: true
    }
  ]
};

const getCollectionData = (path: string) => {
  const raw = localStorage.getItem(`db_${path}`);
  if (!raw) {
    if (SEED_DATA[path]) {
      localStorage.setItem(`db_${path}`, JSON.stringify(SEED_DATA[path]));
      return SEED_DATA[path];
    }
    return [];
  }
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data.map((item: any) => {
        if (!item.id) {
          item.id = Math.random().toString(36).substr(2, 9);
        }
        return item;
      });
    }
    return [];
  } catch (e) {
    return [];
  }
};

export function useCollection<T>(path: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let lastData = "";
    let requestNumber = 0;
    const loadData = async () => {
      const request = ++requestNumber;
      try {
        const dbMode = getDatabaseMode();
        if (dbMode === 'mysql') {
          const res = await fetch(`/api/db/${path}`);
          if (!res.ok) {
            throw new Error(`خطا در ارتباط با سرور MySQL: کد ${res.status}`);
          }
          let docs = await res.json();
          // Reading an empty collection must never recreate deleted records or seed accounts.
          if (active && request === requestNumber) {
            if (JSON.stringify(docs) !== lastData) { lastData = JSON.stringify(docs); setData(docs); }
            docs.forEach((doc: any) => cachedRows.set((path === "tiers" ? "client_tiers" : path) + "/" + doc.id, doc));
            setError(null);
          }
        } else {
          const docs = getCollectionData(path);
          if (active && request === requestNumber) {
            setData(docs);
            setError(null);
          }
        }
      } catch (err: any) {
        if (active && request === requestNumber) {
          setError(err.message || 'خطا در بارگذاری اطلاعات');
        }
      } finally {
        if (active && request === requestNumber) {
          setLoading(false);
        }
      }
    };

    loadData();
    listeners.add(loadData);
    const interval = setInterval(() => { if (document.visibilityState === "visible") loadData(); }, 5000);
    window.addEventListener("focus", loadData);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", loadData);
      active = false;
      listeners.delete(loadData);
    };
  }, [path]);

  return { data, loading, error };
}



export async function apiRequest(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'خطا در ارتباط با سرور');
  return body;
}

export function useFirestore() {
  const batch = useCallback(async (operations: any[]) => {
    if (getDatabaseMode() !== 'mysql') throw new Error('برای ثبت امن اطلاعات، اتصال MySQL را از تنظیمات فعال کنید.');
    const result = await apiRequest('/api/db-transaction', { method: 'POST', body: JSON.stringify({ operations }) });
    result.forEach((doc: any, index: number) => {
      if (doc?.id) cachedRows.set(operations[index].table + '/' + doc.id, doc);
      else if (operations[index].kind === 'delete') cachedRows.delete(operations[index].table + '/' + operations[index].id);
    });
    notify(); return result;
  }, []);
  const add = useCallback(async (path: string, item: any) => {
    const table = path === 'tiers' ? 'client_tiers' : path;
    const id = item.id || crypto.randomUUID();
    return (await batch([{ table, kind: 'add', id, data: { ...item, id } }]))[0];
  }, [batch]);
  const update = useCallback(async (path: string, id: string, item: any) => {
    const table = path === 'tiers' ? 'client_tiers' : path;
    const current = cachedRows.get(table + '/' + id);
    return (await batch([{ table, kind: 'update', id, data: item, expected: current ? Number(current._rev) || 0 : undefined }]))[0];
  }, [batch]);
  const remove = useCallback(async (path: string, id: string) => {
    const table = path === 'tiers' ? 'client_tiers' : path;
    const current = cachedRows.get(table + '/' + id);
    return (await batch([{ table, kind: 'delete', id, expected: current ? Number(current._rev) || 0 : undefined }]))[0];
  }, [batch]);
  const get = useCallback(async (path: string, id: string) => {
    const table = path === 'tiers' ? 'client_tiers' : path;
    const rows = await apiRequest('/api/db/' + table);
    rows.forEach((row: any) => cachedRows.set(table + '/' + row.id, row));
    return rows.find((row: any) => row.id === id) || null;
  }, []);
  const clearCollection = useCallback(async (path: string) => {
    const rows = await apiRequest('/api/db/' + path);
    if (rows.length) await batch(rows.map((r: any) => ({ table: path, kind: 'delete', id: r.id, expected: Number(r._rev) || 0 })));
  }, [batch]);
  return { add, update, remove, get, clearCollection, batch };
}
