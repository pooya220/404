import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useCollection } from '../hooks/useFirestore';
import { Product, SystemSettings } from '../types';
import { playAlertSound } from '../utils/soundAlerts';
import { AlertTriangle, ShoppingCart, X, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { formatPersianNumber } from '../lib/utils';

export function BuffetCriticalStockWatcher() {
  const { data: products } = useCollection<Product>('products');
  const { data: settingsList } = useCollection<SystemSettings>('settings');

  const settings = settingsList?.[0];
  const defaultMinStock = settings?.defaultMinStock ?? 5;
  const isBuffetAlertEnabled = settings?.buffetAlertEnabled ?? true;
  const soundType = settings?.buffetAlertSoundType || 'bell';
  const soundVolume = settings?.buffetAlertVolume ?? 80;

  // Track products that are critically low (stock <= minStock)
  const criticalProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      // Don't alert if stock is strictly not tracked or undefined
      if (p.stock === undefined || p.stock === null) return false;
      const min = (p.minStock !== undefined && p.minStock !== null && !isNaN(Number(p.minStock)))
        ? Number(p.minStock)
        : defaultMinStock;
      return Number(p.stock) <= min;
    });
  }, [products, defaultMinStock]);

  const [dismissed, setDismissed] = useState(false);
  const prevCriticalCountRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isBuffetAlertEnabled) return;
    if (criticalProducts.length === 0) {
      prevCriticalCountRef.current = 0;
      return;
    }

    // Only play sound if new items fell into critical status, or upon first user session discovery if newly critical
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      prevCriticalCountRef.current = criticalProducts.length;
      // Alert initially if there are critical items
      if (criticalProducts.length > 0) {
        playAlertSound(soundType, soundVolume);
      }
    } else if (criticalProducts.length > prevCriticalCountRef.current) {
      // Number of critical products increased (e.g. item sold out or reduced)
      playAlertSound(soundType, soundVolume);
      setDismissed(false); // Re-open banner if dismissed
      prevCriticalCountRef.current = criticalProducts.length;
    } else {
      prevCriticalCountRef.current = criticalProducts.length;
    }
  }, [criticalProducts.length, isBuffetAlertEnabled, soundType, soundVolume]);

  if (!isBuffetAlertEnabled || criticalProducts.length === 0 || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        className="mb-4 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-lg border border-rose-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-right"
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-inner">
            <AlertTriangle className="animate-bounce" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">
                هشدار موجودی بحرانی بوفه و فروشگاه!
              </span>
              <span className="bg-white text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                {formatPersianNumber(criticalProducts.length)} کالا
              </span>
            </div>
            <p className="text-xs text-rose-100 font-bold mt-0.5 leading-relaxed">
              موجودی اقلام ({criticalProducts.slice(0, 3).map(p => `${p.name} (${formatPersianNumber(p.stock)} عدد)`).join('، ')}
              {criticalProducts.length > 3 ? ` و ${formatPersianNumber(criticalProducts.length - 3)} قلم دیگر` : ''}) به حداقل یا اتمام رسیده است.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => playAlertSound(soundType, soundVolume)}
            title="تست صدای هشدار بوفه"
            className="p-2 bg-white/15 hover:bg-white/25 rounded-xl text-white transition-colors"
          >
            <Volume2 size={16} />
          </button>
          <Link
            to="/products"
            className="px-3.5 py-1.5 bg-white text-rose-600 hover:bg-rose-50 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <ShoppingCart size={14} />
            <span>مدیریت و شارژ انبار</span>
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="بستن موقت این هشدار"
          >
            <X size={18} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
