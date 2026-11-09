import { useState, useEffect, useCallback } from 'react';

// یک سیستم ساده برای ثبت تغییرات و آپدیت کردن بقیه کامپوننت‌ها
const listeners: Set<() => void> = new Set();
export const triggerDatabaseRefresh = () => listeners.forEach(l => l());
const notify = () => listeners.forEach(l => l());

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
    const loadData = async () => {
      try {
        const dbMode = localStorage.getItem('db_mode') || 'local';
        if (dbMode === 'mysql') {
          const res = await fetch(`/api/db/${path}`);
          if (!res.ok) {
            throw new Error(`خطا در ارتباط با سرور MySQL: کد ${res.status}`);
          }
          let docs = await res.json();
          if (docs.length === 0 && SEED_DATA[path]) {
            for (const item of SEED_DATA[path]) {
              await fetch(`/api/db/${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
              });
            }
            const reFetch = await fetch(`/api/db/${path}`);
            docs = await reFetch.json();
          }
          if (active) {
            setData(docs);
            setError(null);
          }
        } else {
          const docs = getCollectionData(path);
          if (active) {
            setData(docs);
            setError(null);
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'خطا در بارگذاری اطلاعات');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();
    listeners.add(loadData);
    return () => {
      active = false;
      listeners.delete(loadData);
    };
  }, [path]);

  return { data, loading, error };
}

export function useFirestore() {
  const getRaw = useCallback((path: string) => getCollectionData(path), []);

  const saveRaw = useCallback((path: string, data: any[]) => {
    localStorage.setItem(`db_${path}`, JSON.stringify(data));
    notify(); // خبر دادن به همه کامپوننت‌ها برای بروزرسانی
  }, []);

  const add = useCallback(async (path: string, item: any) => {
    const dbMode = localStorage.getItem('db_mode') || 'local';
    
    if (dbMode === 'mysql') {
      const newItem = { ...item, id: item.id || Math.random().toString(36).substr(2, 9) };
      const res = await fetch(`/api/db/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newItem)
      });
      if (!res.ok) {
        throw new Error('خطا در ثبت اطلاعات در MySQL');
      }
      const savedDoc = await res.json();
      notify();
      return savedDoc;
    } else {
      const current = getRaw(path);
      const newItem = { ...item, id: Math.random().toString(36).substr(2, 9) };
      saveRaw(path, [...current, newItem]);
      return newItem;
    }
  }, [getRaw, saveRaw]);

  const update = useCallback(async (path: string, id: string, item: any) => {
    const dbMode = localStorage.getItem('db_mode') || 'local';

    if (dbMode === 'mysql') {
      const newItem = { ...item, id: id };
      const res = await fetch(`/api/db/${path}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newItem)
      });
      if (!res.ok) {
        throw new Error('خطا در بروزرسانی اطلاعات در MySQL');
      }
      notify();
    } else {
      const current = getRaw(path);
      let changed = false;
      const updated = current.map((doc: any) => {
        if (doc.id === id) {
          const isDifferent = Object.keys(item).some(key => doc[key] !== item[key]);
          if (isDifferent) {
            changed = true;
            return { ...doc, ...item };
          }
        }
        return doc;
      });
      if (changed) {
        saveRaw(path, updated);
      }
    }
  }, [getRaw, saveRaw]);

  const remove = useCallback(async (path: string, id: string) => {
    if (!id) return;
    const dbMode = localStorage.getItem('db_mode') || 'local';

    if (dbMode === 'mysql') {
      const res = await fetch(`/api/db/${path}/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error('خطا در حذف اطلاعات در MySQL');
      }
      notify();
    } else {
      const current = getRaw(path);
      const filtered = current.filter((doc: any) => String(doc.id) !== String(id));
      
      if (current.length !== filtered.length) {
        saveRaw(path, filtered);
      }
    }
  }, [getRaw, saveRaw]);

  const get = useCallback(async (path: string, id: string) => {
    const dbMode = localStorage.getItem('db_mode') || 'local';

    if (dbMode === 'mysql') {
      const res = await fetch(`/api/db/${path}`);
      if (!res.ok) return null;
      const list = await res.json();
      return list.find((doc: any) => String(doc.id) === String(id)) || null;
    } else {
      const current = getRaw(path);
      return current.find((doc: any) => doc.id === id) || null;
    }
  }, [getRaw]);

  const clearCollection = useCallback(async (path: string) => {
    const dbMode = localStorage.getItem('db_mode') || 'local';
    if (dbMode === 'mysql') {
      try {
        const res = await fetch(`/api/db/${path}`);
        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item.id) {
                await fetch(`/api/db/${path}/${item.id}`, { method: 'DELETE' });
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error clearing mysql table ${path}:`, err);
      }
      notify();
    } else {
      localStorage.removeItem(`db_${path}`);
      saveRaw(path, []);
    }
  }, [saveRaw]);

  return { add, update, remove, get, clearCollection };
}
