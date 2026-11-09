import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  Award, 
  Gamepad2, 
  Heart, 
  Smile, 
  SmilePlus, 
  User, 
  Lock, 
  ShieldCheck, 
  ChevronLeft,
  Search,
  CheckCircle2,
  LockKeyhole,
  PiggyBank
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, Input, Badge } from './ui/common';

interface UserUnifiedDashboardProps {
  client: any;
  isOwnProfile: boolean;
  systemUsers: any[] | null;
  sessions: any[] | null;
  sales: any[] | null;
  donations: any[] | null;
  tiers: any[] | null;
  consoles: any[] | null;
  currentUser: any;
  currentTier: any;
  nextTier: any;
  progressPercent: number;
  effectivePlayTime: number;
  matchingSystemUser: any;
  purchasedCoupons: any[];
  setPurchasedCoupons: React.Dispatch<React.SetStateAction<any[]>>;
  update: (collection: string, id: string, data: any) => Promise<void>;
  add: (collection: string, data: any) => Promise<string>;
  formatCurrency: (amount: number) => string;
  formatPersianNumber: (num: number) => string;
  formatPersianDigits: (str: string | number) => string;
  AVATAR_OPTIONS: Array<{ code: string; emoji: string; label: string }>;
  getAvatarEmoji: (code?: string) => string;
  onConfettiTrigger: () => void;
}

export function UserUnifiedDashboard({
  client,
  isOwnProfile,
  systemUsers,
  sessions,
  sales,
  donations,
  tiers,
  consoles,
  currentUser,
  currentTier,
  nextTier,
  progressPercent,
  effectivePlayTime,
  matchingSystemUser,
  purchasedCoupons,
  setPurchasedCoupons,
  update,
  add,
  formatCurrency,
  formatPersianNumber,
  formatPersianDigits,
  AVATAR_OPTIONS,
  getAvatarEmoji,
  onConfettiTrigger
}: UserUnifiedDashboardProps) {

  // --- Modals state ---
  const [activeModal, setActiveModal] = useState<'name_change' | 'avatar_selection' | 'point_transfer' | 'buffet_coupon' | 'free_game' | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  
  // Specific inputs for modals
  const [pointsChangeNameInput, setPointsChangeNameInput] = useState('');
  const [selectedAvatarCode, setSelectedAvatarCode] = useState('');
  const [convertPointsCount, setConvertPointsCount] = useState('10');

  // --- Profile state overrides ---
  const [newName, setNewName] = useState(client?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Global alerts for actions
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleOpenModal = (modalType: 'name_change' | 'avatar_selection' | 'point_transfer' | 'buffet_coupon' | 'free_game') => {
    setActiveModal(modalType);
    setModalError(null);
    if (modalType === 'name_change') {
      setPointsChangeNameInput(client?.name || '');
    } else if (modalType === 'avatar_selection') {
      setSelectedAvatarCode(client?.avatar || 'astro');
    } else if (modalType === 'point_transfer') {
      setConvertPointsCount('10');
    }
  };

  const handleConfirmNameChange = async () => {
    const cost = 10;
    const cleanName = pointsChangeNameInput.trim();
    if (!cleanName) {
      setModalError('نام جدید نمی‌تواند خالی باشد.');
      return;
    }
    if ((client?.points || 0) < cost) {
      setModalError(`امتیاز ناکافی! تغییر نام نیاز به ${cost} امتیاز دارد.`);
      return;
    }

    try {
      const remainingPoints = (client?.points || 0) - cost;
      await update('clients', client.id, {
        name: cleanName,
        points: remainingPoints
      });

      if (matchingSystemUser?.id) {
        await update('system_users', matchingSystemUser.id, {
          ...matchingSystemUser,
          fullName: cleanName
        });
      }

      setActionSuccess(`نام شما با موفقیت به «${cleanName}» تغییر یافت و ${cost} امتیاز از حساب شما کسر شد.`);
      setActiveModal(null);
      onConfettiTrigger();
    } catch (e: any) {
      setModalError('خطا در ذخیره نام جدید: ' + e.message);
    }
  };

  const handleConfirmAvatarSelection = async () => {
    const cost = 15;
    if ((client?.points || 0) < cost) {
      setModalError(`امتیاز ناکافی! دریافت آواتار نیاز به ${cost} امتیاز دارد.`);
      return;
    }

    try {
      const remainingPoints = (client?.points || 0) - cost;
      await update('clients', client.id, {
        avatar: selectedAvatarCode,
        points: remainingPoints
      });

      setActionSuccess(`آواتار جدید شما فعال گردید و ${cost} امتیاز کسر شد.`);
      setActiveModal(null);
      onConfettiTrigger();
    } catch (e: any) {
      setModalError('خطا در به روز رسانی آواتار: ' + e.message);
    }
  };

  const handleConfirmPointTransfer = async () => {
    const pts = Math.floor(Number(convertPointsCount));
    if (!pts || pts <= 0) {
      setModalError('لطفاً تعداد امتیاز معتبری وارد کنید.');
      return;
    }
    if (pts > (client?.points || 0)) {
      setModalError('تعداد امتیاز انتخابی بیشتر از موجودی شماست.');
      return;
    }

    try {
      const costInPoints = pts;
      // 1 Point = 10,000 Tomans
      const cashAmount = costInPoints * 10000; 
      const remainingPoints = (client?.points || 0) - costInPoints;
      const newBalance = (client?.balance || 0) + cashAmount;

      await update('clients', client.id, {
        points: remainingPoints,
        balance: newBalance
      });

      await add('sales', {
        type: 'points_conversion',
        userId: client.id,
        totalAmount: cashAmount,
        description: `انتقال امتیاز به ولت (${costInPoints} امتیاز به اعتبار نقدی کاربری)`,
        timestamp: new Date().toISOString(),
        paymentMethod: 'points_exchange'
      });

      setActionSuccess(`تعداد ${pts} امتیاز با موفقیت به مبلغ ${formatCurrency(cashAmount)} شارژ کیف‌پول تبدیل گردید.`);
      setActiveModal(null);
      onConfettiTrigger();
    } catch (e: any) {
      setModalError('خطا در تبدیل امتیاز: ' + e.message);
    }
  };

  const handleConfirmBuffetCoupon = async () => {
    const cost = 25;
    if ((client?.points || 0) < cost) {
      setModalError(`امتیاز ناکافی! این بلیط نیاز به ${cost} امتیاز دارد.`);
      return;
    }

    try {
      const remainingPoints = (client?.points || 0) - cost;
      const codeGen = `BUFFET-${Math.random().toString(36).substring(3, 9).toUpperCase()}`;
      
      const newCoupon = {
        code: codeGen,
        type: 'کوپن تخفیف ۲۰,۰۰۰ تومانی بوفه کلوپ',
        cost,
        date: new Date().toISOString()
      };

      await update('clients', client.id, {
        points: remainingPoints
      });

      const updated = [newCoupon, ...purchasedCoupons];
      setPurchasedCoupons(updated);
      localStorage.setItem(`coupons_${client?.id}`, JSON.stringify(updated));

      setActionSuccess(`کوپن با موفقیت صادر شد. کد ارائه به صندوق: ${codeGen}`);
      setActiveModal(null);
      onConfettiTrigger();
    } catch (e: any) {
      setModalError('خطا در صدور کوپن: ' + e.message);
    }
  };

  const handleConfirmFreeGame = async () => {
    const cost = 40;
    if ((client?.points || 0) < cost) {
      setModalError(`امتیاز ناکافی! دریافت این لایسنس نیاز به ${cost} امتیاز دارد.`);
      return;
    }

    try {
      const remainingPoints = (client?.points || 0) - cost;
      const codeGen = `GAME1HR-${Math.random().toString(36).substring(3, 9).toUpperCase()}`;
      
      const newCoupon = {
        code: codeGen,
        type: '۱ ساعت بازی رایگان روی کلیه کنسول‌ها',
        cost,
        date: new Date().toISOString()
      };

      await update('clients', client.id, {
        points: remainingPoints
      });

      const updated = [newCoupon, ...purchasedCoupons];
      setPurchasedCoupons(updated);
      localStorage.setItem(`coupons_${client?.id}`, JSON.stringify(updated));

      setActionSuccess(`۱ ساعت بازی رایگان روی کلیه دستگاه‌ها صادر شد. کد: ${codeGen}`);
      setActiveModal(null);
      onConfettiTrigger();
    } catch (e: any) {
      setModalError('خطا در صدور کارت بازی رایگان: ' + e.message);
    }
  };

  const handleUpdateProfileAndPassOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    const cleanName = newName.trim();
    if (!cleanName) {
      setProfileError('نام و نام خانوادگی نباید خالی باشد.');
      return;
    }

    try {
      await update('clients', client.id, {
        name: cleanName
      });

      if (matchingSystemUser?.id) {
        const systemUpdateData: any = {
          fullName: cleanName
        };

        if (newPassword) {
          if (newPassword !== confirmPassword) {
            setProfileError('کلمه عبور جدید و تکرار آن یکسان نیستند.');
            return;
          }
          if (newPassword.length < 4) {
            setProfileError('رمز عبور باید حداقل ۴ نویسه داشته باشد.');
            return;
          }
          systemUpdateData.password = newPassword;
        }

        await update('system_users', matchingSystemUser.id, systemUpdateData);
      }

      setProfileSuccess('اطلاعات هویتی و رمز عبور شما با موفقیت بروزرسانی شد.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setProfileError('خطا در بروزرسانی پرونده: ' + err.message);
    }
  };

  // Filter sessions & sales relative to current client
  const clientRecharges = useMemo(() => {
    if (!sales) return [];
    return sales.filter(s => s.userId === client?.id || s.paymentMethod === 'points_exchange');
  }, [sales, client]);

  const clientDonationsMatched = useMemo(() => {
    if (!donations) return [];
    return donations.filter(d => d.userId === client?.id || d.username === client?.phone);
  }, [donations, client]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-right font-sans" dir="rtl">
      
      {/* Global Success Banner */}
      {actionSuccess && (
        <div className="lg:col-span-12 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-emerald-850 dark:text-emerald-300 font-extrabold text-xs">
          ✓ {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="lg:col-span-12 p-4 bg-red-50 dark:bg-red-950/20 border border-red-500/30 rounded-2xl text-red-850 dark:text-red-300 font-extrabold text-xs">
          ⚠️ {actionError}
        </div>
      )}

      {/* COLUMN 1: Loyaly Info & Operator-handled Logs (size: 5/12) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Bento stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Wallet credit balance */}
          <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-900 dark:to-slate-950 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-550/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950 text-emerald-650 rounded-xl flex items-center justify-center">
                <Wallet size={18} />
              </div>
              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md font-black">کیف پول</span>
            </div>
            <h4 className="text-xs font-bold text-slate-400 mt-4">اعتبار کیف پول کلوپی شما</h4>
            <p className="text-base md:text-lg font-black text-slate-900 dark:text-white mt-1">
              {formatCurrency(client?.balance || 0)}
            </p>
          </div>

          {/* Loyalty points card */}
          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-550/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-xl flex items-center justify-center">
                <Award size={18} />
              </div>
              <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md font-black">باشگاه</span>
            </div>
            <h4 className="text-xs font-bold text-slate-400 mt-4">امتیاز کلوپ شما</h4>
            <p className="text-base md:text-lg font-black text-indigo-650 dark:text-indigo-400 mt-1">
              {formatPersianDigits(client?.points || 0)} <span className="text-xs font-bold text-slate-400">امتیاز</span>
            </p>
          </div>

          {/* Play time tracker */}
          <div className="bg-gradient-to-br from-amber-50 to-white dark:from-slate-900 dark:to-slate-950 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-550/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-xl flex items-center justify-center">
                <Gamepad2 size={18} />
              </div>
              <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md font-black">زمان کل</span>
            </div>
            <h4 className="text-xs font-bold text-slate-400 mt-4">زمان ثبت‌شده در کلوپ</h4>
            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-2">
              {formatPersianNumber(Math.floor(effectivePlayTime / 60))} ساعت و {formatPersianNumber(effectivePlayTime % 60)} دقیقه
            </p>
          </div>

          {/* Sum payments tracker */}
          <div className="bg-gradient-to-br from-rose-50 to-white dark:from-slate-900 dark:to-slate-950 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-550/5 rounded-full blur-xl" />
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 bg-rose-100 dark:bg-rose-950 text-rose-650 rounded-xl flex items-center justify-center">
                <Heart size={18} />
              </div>
              <span className="text-[9px] bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-md font-black">مجموع</span>
            </div>
            <h4 className="text-xs font-bold text-slate-400 mt-4">مجموع مبالغ پرداختی شما</h4>
            <p className="text-base md:text-lg font-black text-slate-900 dark:text-white mt-1">
              {formatCurrency(client?.totalPaid || 0)}
            </p>
          </div>

        </div>

        {/* Read-only notification banner to replace online charging form */}
        <Card className="p-5 border border-dashed border-indigo-200 dark:border-indigo-900 bg-indigo-50/15 dark:bg-indigo-950/10 rounded-3xl space-y-2">
          <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-400 flex items-center gap-1.5">
            <PiggyBank size={15} />
            سیستم پرداخت آفلاین و ثبت توسط متصدی گیشه
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
            تمامی امور شارژ کیف‌پول کلوپی، تسویه استفاده از سیستم‌ها و خرید محصولات بوفه تماماً به صورت خارجی (خارج از این تارنما) و حضوری توسط متصدی کلوپ انجام می‌شود. پنل شما فاقد درگاه مستقیم پرداخت کارت شتاب می‌باشد و تغییرات مستقیماً از سیستم مدیریت کلاب بارگیری می‌شود.
          </p>
        </Card>

        {/* Sales Logs */}
        <Card className="p-6 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2rem] space-y-4">
          <h4 className="text-xs font-black text-slate-850 dark:text-slate-300">آخرین تراکنش‌های کیف پول شما</h4>
          
          <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
            {clientRecharges.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic font-semibold">
                تراکنشی برای کیف پول کاربری شما گزارش نشده است.
              </div>
            ) : (
              clientRecharges.slice(0, 10).map((s, index) => (
                <div key={index} className="bg-slate-50/60 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100/70 dark:border-slate-850 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-extrabold text-slate-850 dark:text-slate-300 block">{s.description || 'افزایش/کاهش موجودی توسط مدیریت'}</span>
                    <span className="text-[9px] text-slate-400 font-bold block mt-1">
                      {formatPersianDigits(new Date(s.timestamp).toLocaleDateString('fa-IR'))}
                    </span>
                  </div>
                  <span className={`font-mono font-black ${s.type === 'points_conversion' ? 'text-emerald-600' : 'text-indigo-650 dark:text-indigo-400'}`}>
                    {formatCurrency(s.totalAmount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Donation logs */}
        <Card className="p-6 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2rem] space-y-4">
          <h4 className="text-xs font-black text-slate-850 dark:text-slate-300">حمایت‌های ثبت‌شده شما در کلوپ</h4>
          
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {clientDonationsMatched.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic font-semibold">
                شما هنوز حمایتی برای کادر کلوپ ثبت نکرده‌اید.
              </div>
            ) : (
              clientDonationsMatched.map((d, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-950 p-3 border border-slate-100/60 dark:border-slate-850 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">مبلغ اهدایی: {formatCurrency(d.amount)}</span>
                    <span className="text-[9px] text-slate-400 font-bold">
                      {formatPersianDigits(new Date(d.timestamp).toLocaleDateString('fa-IR'))}
                    </span>
                  </div>
                  {d.message && (
                    <p className="bg-white dark:bg-slate-900 p-2 rounded-lg text-[10px] text-slate-500 italic pr-1">
                      « {d.message} »
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

      </div>

      {/* COLUMN 2: Loyalty Rewards Store and Profile Update Form (size: 7/12) */}
      <div className="lg:col-span-7 space-y-8">
        
        {/* Loyalty club store title */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white">باشگاه جوایز و خرج امتیازات</h3>
            <p className="text-[11px] text-slate-450 dark:text-slate-400 font-bold mt-1">
              با پرداخت آنلاین امتیازات وفاداری کلوپ، نسبت به شخصی‌سازی یا ارتقا موجودی به صورت کارت‌های خرید اقدام نمایید:
            </p>
          </div>
          <div className="bg-indigo-600/10 px-4 py-2 rounded-2xl flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
            <SmilePlus size={16} />
            <span className="text-xs font-black">{formatPersianDigits(client?.points || 0)} امتیاز</span>
          </div>
        </div>

        {/* Shopper cards layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Card: Username Change */}
          <div className="bg-white dark:bg-slate-900/50 rounded-[2.2rem] border border-slate-150 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 rounded-2xl flex items-center justify-center font-bold text-2xl">
                ✏️
              </div>
              <h4 className="text-sm font-black text-slate-850 dark:text-white">تغییر نام و نام خانوادگی</h4>
              <p className="text-[10.5px] text-slate-400 font-bold leading-relaxed">
                تغییر هویت نمایشی در کلاب با کسر ۱۰ امتیاز بدون نیاز به تایید دستی متصدی گیشه.
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <span className="text-[11px] text-amber-500 font-extrabold font-mono">۱۰ امتیاز کلوپی</span>
              <button
                onClick={() => handleOpenModal('name_change')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 rounded-xl cursor-pointer transition-all border-none"
              >
                انتخاب و خرید اسم
              </button>
            </div>
          </div>

          {/* Card: Avatar selection */}
          <div className="bg-white dark:bg-slate-900/50 rounded-[2.2rem] border border-slate-150 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 rounded-2xl flex items-center justify-center font-bold text-2xl">
                {getAvatarEmoji(client?.avatar)}
              </div>
              <h4 className="text-sm font-black text-slate-850 dark:text-white">انتخاب و خرید آواتار اختصاصی کلوپ</h4>
              <p className="text-[10.5px] text-slate-400 font-bold leading-relaxed">
                تنظیم یکی از ۸ آواتار با پرستیژ کلوپ جهت نمایش به همه متصدیان و بازیکنان کلاب.
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <span className="text-[11px] text-amber-500 font-extrabold font-mono">۱۵ امتیاز کلوپی</span>
              <button
                onClick={() => handleOpenModal('avatar_selection')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 rounded-xl cursor-pointer transition-all border-none"
              >
                انتخاب و خرید طرح
              </button>
            </div>
          </div>

          {/* Card: Points convertible transfer */}
          <div className="bg-white dark:bg-slate-900/50 rounded-[2.2rem] border border-slate-150 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-2xl">
                🔄
              </div>
              <h4 className="text-sm font-black text-slate-850 dark:text-white">انتقال امتیاز به کیف پول کلوپی</h4>
              <p className="text-[10.5px] text-slate-400 font-bold leading-relaxed">
                انتقال مستقیم دارایی امتیازی کلوپیان به کیف‌پول شما با ارزش نقدی هر امتیاز ۱۰,۰۰۰ تومان.
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <span className="text-[10px] text-emerald-600 font-extrabold">هر ۱ امتیاز = ۱۰,۰۰۰ تومان</span>
              <button
                onClick={() => handleOpenModal('point_transfer')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-3 py-1.5 rounded-xl cursor-pointer transition-all border-none"
              >
                انتقال امتیاز به والت
              </button>
            </div>
          </div>

          {/* Card: Buffet coupon */}
          <div className="bg-white dark:bg-slate-900/50 rounded-[2.2rem] border border-slate-150 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 rounded-2xl flex items-center justify-center font-bold text-2xl">
                🍔
              </div>
              <h4 className="text-sm font-black text-slate-850 dark:text-white">کوپن بوفه سرد و گرم</h4>
              <p className="text-[10.5px] text-slate-400 font-bold leading-relaxed">
                تهیه بلیط تخفیف ۲۰هزار تومانی بوفه کلوپ در ازای کسر ۲۵ امتیاز کلوپ وفاداری.
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <span className="text-[11px] text-amber-500 font-extrabold font-mono">۲۵ امتیاز کلوپی</span>
              <button
                onClick={() => handleOpenModal('buffet_coupon')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 rounded-xl cursor-pointer transition-all border-none"
              >
                تهیه کد خرید بوفه
              </button>
            </div>
          </div>

          {/* Card: Free game license */}
          <div className="bg-white dark:bg-slate-900/50 rounded-[2.2rem] border border-slate-150 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3" style={{ gridColumn: 'span 1 / span 2' }}>
            <div className="space-y-2">
              <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 rounded-2xl flex items-center justify-center font-bold text-2xl">
                🎮
              </div>
              <h4 className="text-sm font-black text-slate-850 dark:text-white">۱ ساعت بازی رایگان روی کنسول‌های برتر کلوپ</h4>
              <p className="text-[10.5px] text-slate-400 font-bold leading-relaxed">
                صدور بلیط رایگان نشست بازی به سبک کلوپی‌های وفادار با پرداخت ۴۰ امتیاز.
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center">
              <span className="text-[11px] text-amber-500 font-extrabold font-mono">۴۰ امتیاز کلوپی</span>
              <button
                onClick={() => handleOpenModal('free_game')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-3 py-1.5 rounded-xl cursor-pointer transition-all border-none"
              >
                خرید کارت بازی رایگان
              </button>
            </div>
          </div>

        </div>

        {/* Gift code codes logs */}
        <Card className="p-6 border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[2rem] space-y-4">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-300">🎫 کدهای فعال و جوایز صادرشده شما</h4>
          
          {purchasedCoupons.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-[11px] font-bold italic">
              شما کدی در حال حاضر تهیه نکرده‌اید. با خرج کردن اولین امتیازات خود از کارتها فوق، لایسنس جدید خود را صادر فرمایید.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[170px] overflow-y-auto pr-1">
              {purchasedCoupons.map((coupon, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-950 p-3 border border-slate-100 dark:border-slate-850 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10.5px] font-black text-slate-900 dark:text-white">{coupon.type}</span>
                    <span className="text-[8.5px] text-slate-400 font-bold">{formatPersianDigits(new Date(coupon.date).toLocaleDateString('fa-IR'))}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                    <span className="text-[9.5px] text-indigo-600 dark:text-indigo-400 font-bold">کد فعال هدیه:</span>
                    <code className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-mono text-[10.5px] font-extrabold px-2 py-0.5 rounded border border-indigo-200/50">
                      {coupon.code}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Profile Password changes widget within same dashboard */}
        <Card className="p-6 border-slate-105 dark:border-slate-850 bg-white dark:bg-slate-900 rounded-3xl space-y-4 shadow-sm">
          <div>
            <h4 className="text-sm font-black text-slate-950 dark:text-white">پیکربندی هویت و امنیت کلاینت</h4>
            <p className="text-[11px] text-slate-400 font-bold mt-1">تغییر نام و کلمه عبور اختصاصی ورود به پیشخوان کلوپ</p>
          </div>

          <form onSubmit={handleUpdateProfileAndPassOverride} className="space-y-4">
            
            {profileSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-150 rounded-xl text-emerald-600 text-xs font-bold leading-normal">
                ✓ {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-150 rounded-xl text-red-600 text-xs font-bold leading-normal">
                ⚠️ {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="نام و نام کاربری کامل" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                required 
              />
              <Input 
                label="شماره تلفن همراه" 
                value={client?.phone || ''} 
                disabled 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Input 
                label="رمز عبور عبور جدید" 
                type="password"
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="حداقل ۴ نویسه"
              />
              <Input 
                label="تکرار رمز عبور جدید" 
                type="password"
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs py-2.5 rounded-2xl transition-all cursor-pointer border-none"
            >
              به‌روزرسانی هویتی و ثبت کلمه عبور
            </button>
          </form>
        </Card>

      </div>

      {/* RENDER POPUP DIALOGS */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-right font-sans" dir="rtl">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl relative"
            >
              
              {/* Close standard top button */}
              <button 
                onClick={() => setActiveModal(null)}
                type="button"
                className="absolute top-5 left-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 transition-colors border-none cursor-pointer text-lg font-bold"
              >
                ×
              </button>

              <div className="space-y-4">
                
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {activeModal === 'name_change' && '✏️ کارت هدیه تغییر نام'}
                    {activeModal === 'avatar_selection' && '🎭 کارت خرید آواتار اختصاصی'}
                    {activeModal === 'point_transfer' && '🔄 کارت تبدیل امتیاز به کیف‌پول'}
                    {activeModal === 'buffet_coupon' && '🍔 صدور کوپن تخفیف بوفه'}
                    {activeModal === 'free_game' && '🎮 صدور کارت بازی رایگان'}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1 leading-relaxed">
                    {activeModal === 'name_change' && 'با اهدای ۱۰ امتیاز کلوپی نام جدید خود را در کل کلاب ثبت نمایید.'}
                    {activeModal === 'avatar_selection' && 'با پرداخت ۱۵ امتیاز، یکی از آواتارهای نفیس زیر را کسر و فعال سازید.'}
                    {activeModal === 'point_transfer' && 'تعیین میزان امتیاز کلوپ وفاداری جهت انتقال خودکار به والت کارتی شما.'}
                    {activeModal === 'buffet_coupon' && 'افزایش کوپن نقدی ۲۰,۰۰۰ تومانی بوفاران با اهدای ۲۵ امتیاز.'}
                    {activeModal === 'free_game' && 'صدور کارت ۱ ساعت بازی رایگان روی به کنسول دستگاه‌ها در ازای ۴۰ امتیاز.'}
                  </p>
                </div>

                {modalError && (
                  <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-600 text-xs font-bold font-sans">
                    ⚠️ {modalError}
                  </div>
                )}

                {/* Sub modal content loaders */}
                {activeModal === 'name_change' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 block pr-0.5">نام مستعار یا نام و نام خانوادگی جدید:</label>
                    <input 
                      type="text" 
                      value={pointsChangeNameInput}
                      onChange={e => setPointsChangeNameInput(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 h-11 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold outline-none"
                      placeholder="مثلاً: آرش گیمر"
                    />
                  </div>
                )}

                {activeModal === 'avatar_selection' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 block pr-0.5">کلیک کنید و آواتار خود را گزینش کنید:</label>
                    <div className="grid grid-cols-4 gap-2.5">
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av.code}
                          type="button"
                          onClick={() => setSelectedAvatarCode(av.code)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all hover:scale-105 cursor-pointer ${
                            selectedAvatarCode === av.code 
                              ? "bg-indigo-600 text-white border-indigo-600" 
                              : "bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-slate-100 dark:border-slate-800"
                          }`}
                        >
                          <span className="text-xl">{av.emoji}</span>
                          <span className="text-[7.5px] font-black truncate max-w-full mt-1">{av.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeModal === 'point_transfer' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 block pr-0.5">تعداد امتیاز مدنظر جهت کسر و تبدیل:</label>
                    <input 
                      type="number" 
                      min="1"
                      max={client?.points || 1}
                      value={convertPointsCount}
                      onChange={e => setConvertPointsCount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 h-11 border border-slate-200 dark:border-slate-800 px-4 text-center text-xs font-black outline-none rounded-xl"
                    />
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-center text-xs text-emerald-800 dark:text-emerald-300 font-extrabold border border-emerald-100 rounded-xl">
                      مبلغ تبدیل شده نقدی والت: {formatCurrency(Math.max(0, Number(convertPointsCount || 0)) * 10000)}
                    </div>
                  </div>
                )}

                {/* Confirm actions buttons in footer */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setActiveModal(null)}
                    type="button"
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-2xl text-xs transition-all border-none cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    onClick={() => {
                      if (activeModal === 'name_change') handleConfirmNameChange();
                      if (activeModal === 'avatar_selection') handleConfirmAvatarSelection();
                      if (activeModal === 'point_transfer') handleConfirmPointTransfer();
                      if (activeModal === 'buffet_coupon') handleConfirmBuffetCoupon();
                      if (activeModal === 'free_game') handleConfirmFreeGame();
                    }}
                    type="button"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-2xl text-xs transition-all border-none cursor-pointer animate-pulse"
                  >
                    تایید و کسر امتیاز
                  </button>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
