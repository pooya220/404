import { useState, useEffect } from 'react';

export type DBStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'LOCAL';

const getDatabaseMode = () => {
  const storedMode = localStorage.getItem('db_mode');
  const explicitChoice = localStorage.getItem('db_mode_explicit') === 'true';
  return explicitChoice && storedMode === 'local' ? 'local' : 'mysql';
};

export function useDatabaseStatus() {
  const [status, setStatus] = useState<DBStatus>('LOCAL');
  const [details, setDetails] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      const dbMode = getDatabaseMode();
      if (dbMode !== 'mysql') {
        if (active) {
          setStatus('LOCAL');
          setDetails('پایگاه داده آفلاین (مرورگر)');
        }
        return;
      }

      try {
        const res = await fetch('/api/mysql/status');
        if (!res.ok) {
          throw new Error('خطا در پاسخ سرور');
        }
        const data = await res.json();
        if (active) {
          if (data.status === 'CONNECTED') {
            setStatus('CONNECTED');
            setDetails('اتصال به دیتابیس MySQL برقرار است');
          } else {
            setStatus('ERROR');
            setDetails(data.error || 'خطا در اتصال به دیتابیس MySQL');
          }
        }
      } catch (err: any) {
        if (active) {
          setStatus('DISCONNECTED');
          setDetails('عدم ارتباط با دیتابیس یا سرور');
        }
      }
    };

    // Check immediately and then every 10 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 10000);

    // Listen to offline/online events for fast feedback
    const handleOnline = () => checkStatus();
    const handleOffline = () => {
      if (localStorage.getItem('db_mode') === 'mysql') {
        setStatus('DISCONNECTED');
        setDetails('دستگاه شما آفلاین است');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { status, details };
}
