import React, { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { AppUser, ClientTier, Session, Tariff, SystemSettings } from '../types';
import { UserUnifiedDashboard } from '../components/UserUnifiedDashboard';
import { Card, Button, Badge, Input, Modal, SegmentToggle, ToggleOption } from '../components/ui/common';
import { InvoiceModal, ReportItem } from '../components/InvoiceModal';
import { 
  Users, 
  Search, 
  Plus, 
  Star, 
  Phone, 
  Wallet, 
  Trash2, 
  Edit3, 
  Award, 
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  X,
  ShieldCheck,
  UserX,
  TrendingDown,
  Heart,
  History,
  User,
  CheckCircle2,
  CreditCard,
  ArrowLeftRight,
  ArrowRightLeft,
  Percent,
  Sparkles,
  Gamepad2,
  Shield,
  Lock,
  ShoppingBag,
  Receipt,
  Trophy,
  Crown,
  Medal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatPersianNumber, formatCurrency, formatPersianDigits, cn } from '../lib/utils';
import { resolveSessionIntervals } from '../lib/intervalUtils';

// Props Interface
interface ClientsProps {
  currentUser?: any;
}

export const AVATAR_OPTIONS = [
  { code: 'astro', emoji: '🚀', label: 'فضانورد بازی' },
  { code: 'dragon', emoji: '🐉', label: 'اژدهای سرخ' },
  { code: 'knight', emoji: '🛡️', label: 'شوالیه طلایی' },
  { code: 'mage', emoji: '🧙', label: 'جادوگر کهکشان' },
  { code: 'ninja', emoji: '🥷', label: 'سایه پنهان' },
  { code: 'fox', emoji: '🦊', label: 'روباه سایبر' },
  { code: 'robot', emoji: '🤖', label: 'ربات هوشمند' },
  { code: 'lion', emoji: '🦁', label: 'شیر جنگجو' }
];

export const getAvatarEmoji = (code?: string): string => {
  const match = AVATAR_OPTIONS.find(o => o.code === code);
  return match ? match.emoji : '👤';
};

export const getAvatarLabel = (code?: string): string => {
  const match = AVATAR_OPTIONS.find(o => o.code === code);
  return match ? `${match.emoji} ${match.label}` : '👤 کاربر کلوپ';
};

// --- Helper Component: Confetti Effect ---
function HeartConfetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(20)].map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const size = 15 + Math.random() * 20;
        return (
          <motion.div
            key={i}
            initial={{ y: "110%", opacity: 1, scale: 0.5, rotate: 0 }}
            animate={{ 
              y: "-10%", 
              opacity: 0, 
              scale: 1.2, 
              rotate: Math.random() * 360,
              x: `${(Math.random() - 0.5) * 50}px` 
            }}
            transition={{ duration: 2.5, delay, ease: "easeOut" }}
            className="absolute text-rose-500 text-opacity-80"
            style={{ left: `${left}%`, fontSize: `${size}px` }}
          >
            ❤️
          </motion.div>
        );
      })}
    </div>
  );
}

// Custom Full-Featured Client Portfolio Panel
export function ClientPortfolioView({ 
  client, 
  onClose, 
  isOwnProfile, 
  systemUsers, 
  sessions, 
  sales, 
  donations, 
  tiers, 
  consoles,
  currentUser,
  initialTab,
  hideHorizontalTabs = true
}: { 
  client: any; 
  onClose?: () => void; 
  isOwnProfile: boolean; 
  systemUsers: any[] | null; 
  sessions: any[] | null; 
  sales: any[] | null; 
  donations: any[] | null; 
  tiers: any[] | null; 
  consoles: any[] | null;
  currentUser: any; 
  initialTab?: 'dashboard' | 'wallet' | 'points' | 'donations' | 'history' | 'profile';
  hideHorizontalTabs?: boolean;
}) {
  const { update, add } = useFirestore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'wallet' | 'points' | 'donations' | 'history' | 'profile'>(initialTab || 'dashboard');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // --- Wallet topup state ---
  const [chargeAmount, setChargeAmount] = useState('50000');
  const [isCharging, setIsCharging] = useState(false);
  const [creditCardNumber, setCreditCardNumber] = useState('');
  const [creditCardPin, setCreditCardPin] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timerCount, setTimerCount] = useState(60);
  const [chargeSuccess, setChargeSuccess] = useState(false);

  // --- Points converter state ---
  const [pointsToConvert, setPointsToConvert] = useState('10');
  const [conversionSuccess, setConversionSuccess] = useState(false);

  // --- Donation states ---
  const [donationPreset, setDonationPreset] = useState<number | 'custom'>(25000);
  const [customDonationValue, setCustomDonationValue] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [donationPayMethod, setDonationPayMethod] = useState<'wallet' | 'online'>('wallet');
  const [isDonating, setIsDonating] = useState(false);
  const [donationSuccess, setDonationSuccess] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  // --- Profile states ---
  const [newName, setNewName] = useState(client?.name || '');
  const [newPhone, setNewPhone] = useState(client?.phone || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // --- Points Gamification States & Handlers ---
  const { data: pointsFestivals } = useCollection<any>('points_festivals');
  const { data: pointsRewards } = useCollection<any>('points_rewards');
  const [pointsSubTab, setPointsSubTab] = useState<'earn' | 'spend'>('spend'); // default count is spend
  const [pointsActionSuccess, setPointsActionSuccess] = useState<string | null>(null);
  const [pointsActionError, setPointsActionError] = useState<string | null>(null);

  // --- Small modal shop checkout states ---
  const [activeModal, setActiveModal] = useState<'name_change' | 'avatar_selection' | 'point_transfer' | 'buffet_coupon' | 'free_game' | null>(null);
  const [pendingReward, setPendingReward] = useState<any | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [pointsChangeNameInput, setPointsChangeNameInput] = useState('');
  const [pointsChangeUsernameInput, setPointsChangeUsernameInput] = useState('');
  const [selectedAvatarCode, setSelectedAvatarCode] = useState('');
  const [convertPointsCount, setConvertPointsCount] = useState('10');
  const [customNickname, setCustomNickname] = useState('');
  const [purchasedCoupons, setPurchasedCoupons] = useState<any[]>(() => {
    const saved = localStorage.getItem(`coupons_${client?.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  // --- Invoice Modal States ---
  const [selectedInvoiceSession, setSelectedInvoiceSession] = useState<Session | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const { data: allTariffs } = useCollection<Tariff>('tariffs');
  const { data: allSettings } = useCollection<SystemSettings>('settings');
  const { data: allClients } = useCollection<AppUser>('clients');

  const invoiceReport: ReportItem | null = useMemo(() => {
    if (!selectedInvoiceSession) return null;
    const s = selectedInvoiceSession;
    const cItem = consoles?.find(c => c.id === s.consoleId);
    const totalCost = s.totalCost || (s as any).finalCost || 0;
    const gameCost = s.totalSessionAmount || (s as any).baseSessionAmount || Math.max(0, totalCost - (s.totalProductsAmount || 0));
    return {
      id: s.id,
      type: 'session',
      title: `صورتحساب بازی - ${cItem?.name || 'کنسول کلوپ'}`,
      amount: totalCost,
      gameAmount: gameCost,
      buffetAmount: s.totalProductsAmount || 0,
      taxAmount: s.taxAmount || 0,
      timestamp: s.startTime || new Date().toISOString(),
      details: '',
      rawSession: s
    };
  }, [selectedInvoiceSession, consoles]);

  // --- New Modal-driven shop implementations ---
  const handleOpenModal = (
    modalType: 'name_change' | 'avatar_selection' | 'point_transfer' | 'buffet_coupon' | 'free_game',
    reward?: any
  ) => {
    setActiveModal(modalType);
    setModalError(null);
    setModalSuccess(null);
    setPendingReward(reward || null);

    if (modalType === 'name_change') {
      setPointsChangeNameInput(client?.name || '');
      setPointsChangeUsernameInput(client?.username || '');
    } else if (modalType === 'avatar_selection') {
      setSelectedAvatarCode(client?.avatar || 'astro');
    } else if (modalType === 'point_transfer') {
      setConvertPointsCount(reward ? String(reward.cost) : '10');
    }
  };

  const handleConfirmNameChange = async () => {
    const cost = pendingReward ? pendingReward.cost : 10;
    const cleanName = pointsChangeNameInput.trim();
    const cleanUsername = pointsChangeUsernameInput.trim().toLowerCase();

    if (!cleanName) {
      setModalError('نام نمایشی جدید نمی‌تواند خالی باشد.');
      return;
    }
    if ((client?.points || 0) < cost) {
      setModalError(`امتیاز ناکافی! این جایزه نیاز به ${cost} امتیاز دارد.`);
      return;
    }

    if (cleanUsername && cleanUsername !== (client?.username || '').toLowerCase()) {
      const alreadyExists = systemUsers?.some((u: any) => u.clientId !== client.id && (u.username || '').toLowerCase() === cleanUsername);
      if (alreadyExists) {
        setModalError('این نام کاربری از قبل توسط شخص دیگری ثبت شده است.');
        return;
      }
    }

    try {
      const remainingPoints = (client?.points || 0) - cost;
      
      const updatePayload: any = {
        name: cleanName,
        points: remainingPoints
      };
      if (cleanUsername) {
        updatePayload.username = cleanUsername;
      }

      await update('clients', client.id, updatePayload);

      if (matchingSystemUser?.id) {
        const sysUserUpdate: any = {
          ...matchingSystemUser,
          fullName: cleanName
        };
        if (cleanUsername) {
          sysUserUpdate.username = cleanUsername;
        }
        await update('system_users', matchingSystemUser.id, sysUserUpdate);
      }

      setPointsActionSuccess(`تبریک! نام و نام کاربری با موفقیت به «${cleanName}» / «${cleanUsername || client?.username}» تغییر یافت و ${cost} امتیاز کسر شد.`);
      setActiveModal(null);
      setPendingReward(null);
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 3000);
    } catch (e: any) {
      setModalError('خطا در ذخیره نام جدید: ' + e.message);
    }
  };

  const handleConfirmAvatarSelection = async () => {
    const cost = pendingReward ? pendingReward.cost : 15;
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

      setPointsActionSuccess(`تبریک! آواتار شما با موفقیت به طرح جدید تغییر یافت و ${cost} امتیاز کسر گردید.`);
      setActiveModal(null);
      setPendingReward(null);
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 3000);
    } catch (e: any) {
      setModalError('خطا در به روز رسانی آواتار: ' + e.message);
    }
  };

  const handleConfirmPointTransfer = async () => {
    const pts = pendingReward ? pendingReward.cost : Math.floor(Number(convertPointsCount));
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

      // Record in logs/sales/recharges
      await add('sales', {
        type: 'points_conversion',
        userId: client.id,
        totalAmount: cashAmount,
        description: `انتقال امتیاز به ولت (${costInPoints} امتیاز به اعتبار نقدی)`,
        timestamp: new Date().toISOString(),
        paymentMethod: 'points_exchange'
      });

      setPointsActionSuccess(`تبریک! تعداد ${pts} امتیاز با موفقیت به مبلغ ${formatCurrency(cashAmount)} شارژ کیف‌پول تبدیل گردید.`);
      setActiveModal(null);
      setPendingReward(null);
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 3000);
    } catch (e: any) {
      setModalError('خطا در تبدیل امتیاز: ' + e.message);
    }
  };

  const handleConfirmBuffetCoupon = async () => {
    const cost = pendingReward ? pendingReward.cost : 25;
    const title = pendingReward ? pendingReward.title : 'کوپن تخفیف ۲۰,۰۰0 تومانی بوفه کلوپ';

    if ((client?.points || 0) < cost) {
      setModalError(`امتیاز ناکافی! خرید این جایزه نیاز به ${cost} امتیاز دارد.`);
      return;
    }

    try {
      const remainingPoints = (client?.points || 0) - cost;
      const prefix = pendingReward?.type === 'discount_coupon' ? 'DISC' : 'BUFFET';
      const codeGen = `${prefix}-${Math.random().toString(36).substring(3, 9).toUpperCase()}`;
      
      const newCoupon = {
        code: codeGen,
        type: title,
        cost,
        date: new Date().toISOString()
      };

      await update('clients', client.id, {
        points: remainingPoints
      });

      const updated = [newCoupon, ...purchasedCoupons];
      setPurchasedCoupons(updated);
      localStorage.setItem(`coupons_${client?.id}`, JSON.stringify(updated));

      setPointsActionSuccess(`تبریک! کارت جایزه «${title}» با موفقیت صادر شد. کد تخفیف شما: ${codeGen}`);
      setActiveModal(null);
      setPendingReward(null);
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 3000);
    } catch (e: any) {
      setModalError('خطا در تهیه کوپن تخفیف: ' + e.message);
    }
  };

  const handleConfirmFreeGame = async () => {
    const cost = pendingReward ? pendingReward.cost : 40;
    const title = pendingReward ? pendingReward.title : '۱ ساعت بازی رایگان روی کلیه کنسول‌ها';

    if ((client?.points || 0) < cost) {
      setModalError(`امتیاز ناکافی! دریافت ۱ ساعت بازی رایگان نیاز به ${cost} امتیاز دارد.`);
      return;
    }

    try {
      const remainingPoints = (client?.points || 0) - cost;
      const codeGen = `GAME1HR-${Math.random().toString(36).substring(3, 9).toUpperCase()}`;
      
      const newCoupon = {
        code: codeGen,
        type: title,
        cost,
        date: new Date().toISOString()
      };

      await update('clients', client.id, {
        points: remainingPoints
      });

      const updated = [newCoupon, ...purchasedCoupons];
      setPurchasedCoupons(updated);
      localStorage.setItem(`coupons_${client?.id}`, JSON.stringify(updated));

      setPointsActionSuccess(`تبریک! کارت جایزه «${title}» با موفقیت فعال گردید. کد ارائه به صندوقدار: ${codeGen}`);
      setActiveModal(null);
      setPendingReward(null);
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 3000);
    } catch (e: any) {
      setModalError('خطا در صادر کردن کد بازی رایگان: ' + e.message);
    }
  };

  // Keep compatibility for old dynamic reward clicks if any
  const handleSpendPointsForReward = async (reward: any) => {
    setPointsActionSuccess(null);
    setPointsActionError(null);
    if (reward.type === 'custom_nickname') {
      handleOpenModal('name_change', reward);
    } else if (reward.type === 'profile_avatar_unlock') {
      handleOpenModal('avatar_selection', reward);
    } else if (reward.type === 'wallet_cashback') {
      handleOpenModal('point_transfer', reward);
    } else if (reward.type === 'discount_coupon') {
      handleOpenModal('buffet_coupon', reward);
    } else {
      handleOpenModal('buffet_coupon', reward);
    }
  };

  // Matching system user
  const matchingSystemUser = useMemo(() => {
    if (!systemUsers) return null;
    return systemUsers.find(u => u.clientId === client?.id || u.username === client?.phone);
  }, [systemUsers, client]);

  // Total Play calculations
  const effectivePlayTime = useMemo(() => {
    const baseTime = Number(client?.totalPlayTime) || 0;
    const active = sessions?.find(s => s.userId === client?.id && !s.endTime);
    if (active) {
      const start = new Date(active.startTime).getTime();
      const elapsedMinutes = Math.floor((Date.now() - start) / 60000);
      return baseTime + elapsedMinutes;
    }
    return baseTime;
  }, [client, sessions]);

  // Colors mapping for tiers
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/60',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/60',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/60',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/60',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800/60',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/60',
  };

  // Tier level progression calculations
  const ascendingTiers = useMemo(() => {
    return [...(tiers || [])].sort((a, b) => a.minPlayTime - b.minPlayTime);
  }, [tiers]);

  const currentTier = useMemo(() => {
    if (!ascendingTiers.length || client?.isGuest) return null;
    const matched = [...ascendingTiers].reverse().find(t => effectivePlayTime >= t.minPlayTime);
    return matched || null;
  }, [ascendingTiers, effectivePlayTime, client]);

  const nextTier = useMemo(() => {
    if (!ascendingTiers.length || client?.isGuest) return null;
    return ascendingTiers.find(t => t.minPlayTime > effectivePlayTime);
  }, [ascendingTiers, effectivePlayTime, client]);

  const progressPercent = useMemo(() => {
    if (client?.isGuest) return 0;
    if (!nextTier) return 100;
    const currentMin = currentTier ? currentTier.minPlayTime : 0;
    const nextMin = nextTier.minPlayTime;
    const totalDiff = nextMin - currentMin;
    const userDiff = effectivePlayTime - currentMin;
    if (totalDiff <= 0) return 100;
    return Math.min(100, Math.max(0, Math.floor((userDiff / totalDiff) * 100)));
  }, [currentTier, nextTier, effectivePlayTime, client]);

  // Sessions and Buffet purchases
  const clientSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions
      .filter(s => s.userId === client?.id || (s.userIds && s.userIds.includes(client?.id)))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [sessions, client]);

  const clientSales = useMemo(() => {
    if (!sales || !client) return [];
    return sales
      .filter(s => 
        s.userId === client.id || 
        s.customerId === client.id || 
        (s.customerName && client.name && s.customerName.trim().toLowerCase() === client.name.trim().toLowerCase())
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, client]);

  const clientDonations = useMemo(() => {
    if (!donations) return [];
    return donations
      .filter(d => d.clientId === client?.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [donations, client]);

  const activeSessionItem = useMemo(() => {
    return sessions?.find(s => s.userId === client?.id && !s.endTime) || null;
  }, [sessions, client]);

  const activeConsole = useMemo(() => {
    if (!activeSessionItem || !consoles) return null;
    return consoles.find(c => c.id === activeSessionItem.consoleId) || null;
  }, [activeSessionItem, consoles]);

  // OTP Timer countdown
  useEffect(() => {
    let interval: any;
    if (showOTP && timerCount > 0) {
      interval = setInterval(() => {
        setTimerCount(t => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showOTP, timerCount]);

  // Simulation handlers
  const handleRequestOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (creditCardNumber.replace(/\s+/g, '').length < 16) {
      alert('شماره کارت باید ۱۶ رقم باشد.');
      return;
    }
    setOtpSent(true);
    setShowOTP(true);
    setTimerCount(60);
  };

  const handleCompleteCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      alert('رمز یک‌بار مصرف معتبر وارد کنید.');
      return;
    }
    setIsCharging(true);
    
    // Simulate API delay
    setTimeout(async () => {
      const chargeValue = Number(chargeAmount);
      const newBalance = (client?.balance || 0) + chargeValue;
      
      // Award loyalty points for charging wallet! E.g. 1 point per 50,000 Tomans
      const awardPoints = Math.floor(chargeValue / 50000);
      const newPoints = (client?.points || 0) + awardPoints;

      await update('clients', client.id, {
        balance: newBalance,
        points: newPoints
      });

      // Record in logs/sales/recharges if needed
      await add('sales', {
        type: 'wallet_recharge',
        userId: client.id,
        totalAmount: chargeValue,
        description: 'شارژ آنلاین کیف پول دیجیتال',
        timestamp: new Date().toISOString(),
        paymentMethod: 'online'
      });

      setIsCharging(false);
      setChargeSuccess(true);
      setShowOTP(false);
      setCreditCardNumber('');
      setCreditCardPin('');
      setOtpCode('');
      
      setTimeout(() => {
        setChargeSuccess(false);
      }, 4000);
    }, 1500);
  };

  // Convert points
  const handleConvertPoints = async () => {
    const pointsNum = Number(pointsToConvert);
    if (!pointsNum || pointsNum <= 0 || pointsNum > (client?.points || 0)) {
      alert('تعداد امتیاز نامعتبر یا بیش از موجودی است.');
      return;
    }
    
    // 1 Point = 10,000 Tomans
    const cashValue = pointsNum * 10000;
    const newPoints = (client?.points || 0) - pointsNum;
    const newBalance = (client?.balance || 0) + cashValue;

    await update('clients', client.id, {
      points: newPoints,
      balance: newBalance
    });

    setConversionSuccess(true);
    setTimeout(() => {
      setConversionSuccess(false);
    }, 3000);
  };

  // Submit Donation
  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = donationPreset === 'custom' ? Number(customDonationValue) : Number(donationPreset);
    
    if (!finalAmount || finalAmount <= 0) {
      alert('مبلغ معتبری وارد کنید.');
      return;
    }

    if (donationPayMethod === 'wallet' && (client?.balance || 0) < finalAmount) {
      alert('اعتبار کیف پول شما برای این مبلغ حمایت کافی نیست. لطفا ابتدا کیف پول خود را شارژ کنید.');
      return;
    }

    setIsDonating(true);

    setTimeout(async () => {
      if (donationPayMethod === 'wallet') {
        const newBalance = (client?.balance || 0) - finalAmount;
        await update('clients', client.id, { balance: newBalance });
      }

      // Add points as reward! 1 point for every 20,000 Tomans donation!
      const bonusPoints = Math.floor(finalAmount / 20000);
      if (bonusPoints > 0) {
        const newPoints = (client?.points || 0) + bonusPoints;
        await update('clients', client.id, { points: newPoints });
      }

      await add('donations', {
        clientId: client.id,
        clientName: client.name,
        amount: finalAmount,
        message: donationMessage || 'بدون پیام ویژه',
        timestamp: new Date().toISOString(),
        paymentMethod: donationPayMethod
      });

      setIsDonating(false);
      setDonationSuccess(true);
      setConfettiActive(true);
      setDonationMessage('');
      setCustomDonationValue('');

      setTimeout(() => {
        setConfettiActive(false);
      }, 5000);

      setTimeout(() => {
        setDonationSuccess(false);
      }, 4000);
    }, 1500);
  };

  // Profile management and Password changing
  const handleUpdateProfileAndPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (!newName.trim() || !newPhone.trim()) {
      setProfileError('نام و شماره تماس نباید خالی باشد.');
      return;
    }

    try {
      // 1. Update clients information
      await update('clients', client.id, {
        name: newName,
        phone: newPhone
      });

      // 2. Update system user information (fullName, username)
      if (matchingSystemUser?.id) {
        const systemUpdateData: any = {
          fullName: newName,
          username: newPhone
        };

        // 3. Handle password change if filled
        if (newPassword) {
          if (newPassword !== confirmPassword) {
            setProfileError('رمز عبور جدید و تکرار آن همخوانی ندارند.');
            return;
          }
          if (newPassword.length < 4) {
            setProfileError('رمز کاربری جدید باید حداقل ۴ کاراکتر باشد.');
            return;
          }
          systemUpdateData.password = newPassword;
        }

        await update('system_users', matchingSystemUser.id, systemUpdateData);
      }

      setProfileSuccess('اطلاعات کاربری با موفقیت بروزرسانی شد.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setProfileError('خطا در ذخیره‌ساز اطلاعات: ' + e.message);
    }
  };

  return (
    <div className="relative bg-white dark:bg-[#111827] rounded-[2.5rem] border border-slate-100 dark:border-slate-800/80 shadow-2xl p-6 md:p-10 text-right overflow-hidden" dir="rtl">
      <HeartConfetti active={confettiActive} />

      {/* Close button for admin overlay */}
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 transition-colors z-30"
        >
          <X size={20} />
        </button>
      )}

      {/* Welcome & Tier Progression Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border border-indigo-900/60 rounded-[2rem] p-6 text-white mb-8 relative overflow-hidden shadow-lg">
        {/* Glow backing */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 text-center md:text-right flex-col md:flex-row shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner text-3xl">
              {client?.avatar ? (
                <span>{getAvatarEmoji(client.avatar)}</span>
              ) : (
                <User size={32} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5 justify-center md:justify-start">
                <span className="inline-block relative">
                  <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full inline-block animate-ping" />
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full absolute inset-0 inline-block" />
                </span>
                <h3 className="text-xl md:text-2xl font-black">{client?.name}</h3>
                {client?.isGuest && <Badge className="bg-amber-500 text-white border-none">کاربر مهمان کلوپ</Badge>}
              </div>
              <p className="text-indigo-200/70 text-xs font-semibold mt-1 leading-normal">
                {isOwnProfile ? 'به پنل هوشمند کاربری خود خوش آمدید!' : 'مشاهده پرونده تخصصی کلاینت'}
                <span className="font-mono bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40 text-[10px] text-indigo-300 mr-2">
                  {formatPersianDigits(client?.phone)}
                </span>
              </p>
            </div>
          </div>

          {/* Current Tier progress badge */}
          {!client?.isGuest && (
            <div className="w-full md:w-80 space-y-2 text-right">
              <div className="flex justify-between items-baseline text-xs font-bold text-indigo-200/90">
                <span className="flex items-center gap-1">
                  <Award size={14} className="text-amber-400 animate-pulse" />
                  سطح وفاداری شما: <span className="text-amber-300 font-extrabold">{currentTier?.name || 'آماتور (Amateur)'}</span>
                </span>
                {nextTier && (
                  <span className="text-[10px] text-indigo-300/80">
                     تا {nextTier.name}: {formatPersianNumber(Math.max(0, Math.ceil((nextTier.minPlayTime - effectivePlayTime) / 60)))} ساعت
                  </span>
                )}
              </div>
              
              {nextTier ? (
                <div className="space-y-1">
                  <div className="w-full bg-indigo-950/80 rounded-full h-3 border border-indigo-800/50 overflow-hidden p-0.5">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1 }}
                      className="bg-gradient-to-l from-indigo-500 to-amber-400 h-full rounded-full shadow-inner" 
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-indigo-300/60 font-mono">
                    <span>{formatPersianDigits(effectivePlayTime)} دقیقه بازی</span>
                    <span>{formatPersianDigits(nextTier.minPlayTime)} دقیقه هدف</span>
                  </div>
                </div>
              ) : (
                <div className="text-amber-300 text-xs font-extrabold flex items-center gap-1 justify-end animate-bounce">
                  👑 شما در بالاترین سطح ممکن سیستم هستید! (افسانه جاودان)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {!hideHorizontalTabs && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800/90 pb-3 mb-6 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('dashboard')}
            type="button"
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'dashboard' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            )}
          >
            <Gamepad2 size={15} />
            خلاصه پیشخوان شما
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            type="button"
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'wallet' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            )}
          >
            <Wallet size={15} />
            مدیریت کیف پول دیجیتال
          </button>
          <button
            onClick={() => setActiveTab('points')}
            type="button"
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'points' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            )}
          >
            <Sparkles size={15} />
            امتیازها و خرج امتیاز کلوپ
          </button>
          <button
            onClick={() => setActiveTab('donations')}
            type="button"
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'donations' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            )}
          >
            <Heart size={15} />
            صندوق حمایت و اهدا
          </button>
          <button
            onClick={() => setActiveTab('history')}
            type="button"
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'history' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            )}
          >
            <History size={15} />
            تاریخچه بازی‌ها و خریدها
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            type="button"
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'profile' 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            )}
          >
            <User size={15} />
            پروفایل و امنیت رمز ورود
          </button>
        </div>
      )}

      {/* --- DASHBOARD TAB --- */}
      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' && (
          <motion.div
            key="client-dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Active Session Alert Block */}
            {activeSessionItem && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-dashed border-emerald-500/30 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100 dark:shadow-none">
                    <Gamepad2 size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400 text-right">نشست بازی فعال شناسایی شد!</h4>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-500 font-bold mt-0.5 text-right">
                      اتصال فعال روی دستگاه: <span className="font-extrabold text-slate-800 dark:text-slate-200">{activeConsole?.name || 'دستگاه نامعلوم'}</span>
                    </p>
                  </div>
                </div>
                <div className="text-left font-black text-xs text-emerald-750 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                     زمان شروع: {formatPersianDigits(new Date(activeSessionItem.startTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}
                </div>
              </div>
            )}

            {/* Bento cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Wallet Card */}
              <Card className="p-5 flex flex-col justify-between border-gray-100/60 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-sm relative group overflow-hidden rounded-3xl text-right">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-slate-400 font-black uppercase">موجودی پول نقد</span>
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Wallet size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                    {formatCurrency(client?.balance || 0)}
                  </h3>
                  <button 
                    onClick={() => setActiveTab('wallet')} 
                    type="button"
                    className="text-[10px] text-indigo-600 hover:text-indigo-455 font-black hover:underline mt-0.5 block text-right cursor-pointer bg-transparent border-none"
                  >
                    افزایش اعتبار کیف‌پول ←
                  </button>
                </div>
              </Card>

              {/* Points Card */}
              <Card className="p-5 flex flex-col justify-between border-gray-100/60 dark:border-slate-855 bg-white dark:bg-slate-900 shadow-sm relative group overflow-hidden rounded-3xl text-right">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-slate-400 font-black uppercase">امتیازات باشگاه کلوپ</span>
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-500 dark:text-amber-400">
                    <Star size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mb-1">
                    {formatPersianDigits(client?.points || 0)} <span className="text-xs text-slate-400">امتیاز</span>
                  </h3>
                  <button 
                    onClick={() => setActiveTab('wallet')} 
                    type="button"
                    className="text-[10px] text-amber-600 hover:text-amber-505 font-black hover:underline mt-0.5 block text-right cursor-pointer bg-transparent border-none"
                  >
                    تبدیل امتیازات به پول ←
                  </button>
                </div>
              </Card>

              {/* Playtime Card */}
              <Card className="p-5 flex flex-col justify-between border-gray-100/60 dark:border-slate-855 bg-white dark:bg-slate-900 shadow-sm relative group overflow-hidden rounded-3xl text-right">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-slate-400 font-black uppercase">مجموع زمان بازی شش‌ماهه</span>
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Clock size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
                    {formatPersianDigits(Math.floor(effectivePlayTime / 60))} ساعت و {formatPersianDigits(effectivePlayTime % 60)} دقیقه
                  </h3>
                  <button 
                    onClick={() => setActiveTab('history')} 
                    type="button"
                    className="text-[10px] text-emerald-600 hover:text-emerald-505 font-black hover:underline mt-0.5 block text-right cursor-pointer bg-transparent border-none"
                  >
                    مشاهده لاگ نشست‌ها ←
                  </button>
                </div>
              </Card>

              {/* Discount Card */}
              <Card className="p-5 flex flex-col justify-between border-gray-100/60 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-sm relative group overflow-hidden rounded-3xl text-right">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-slate-400 font-black uppercase">درصد تخفیف دائم شما</span>
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/40 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-450">
                    <Percent size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-rose-600 dark:text-rose-450 mb-1">
                    {formatPersianDigits(currentTier?.discountPercentage || 0)}٪ <span className="text-xs text-slate-400 font-semibold">روی تمام فاکتورها</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 mt-0.5 font-bold">محاسبه خودکار هنگام شارژ نهایی فاکتور</p>
                </div>
              </Card>
            </div>

            {/* Quick Promo banner & Levels list */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 p-6 border-slate-105 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl space-y-4 text-right">
                <h4 className="text-base font-black text-slate-950 dark:text-white">جدول سطوح وفاداری باشگاه کلوپ</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-bold">بگذارید مجموع بازی شما افزایش یابد تا به طور خودکار به سطوح بالاتر ارتقا پیدا کرده و از تخفیف‌های ویژه بر فاکتورها لذت ببرید.</p>
                
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-2">
                  {ascendingTiers.map(t => {
                    const isUserTier = currentTier?.id === t.id;
                    return (
                      <div 
                        key={t.id} 
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-2xl border text-xs font-semibold scale-100 transition-all text-right",
                          isUserTier 
                            ? "bg-slate-50 dark:bg-slate-950/40 border-indigo-400/80 ring-2 ring-indigo-500/20 shadow-sm" 
                            : "bg-white dark:bg-slate-900/10 border-slate-100 dark:border-slate-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold", colorMap[t.color] || "bg-indigo-100")}>
                            <Award size={16} />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white block">{t.name}</span>
                            <span className="text-[9.5px] text-slate-400 dark:text-slate-550 font-semibold block">حداقل {formatPersianDigits(t.minPlayTime)} دقیقه حضور</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5">
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">تخفیف: {formatPersianDigits(t.discountPercentage)}٪</span>
                          {isUserTier && <Badge className="bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none animate-pulse">رنک شما 🎯</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Live Supportive Box */}
              <div className="bg-gradient-to-br from-indigo-950 to-indigo-900/90 border border-indigo-950 py-6 px-6 text-white rounded-3xl flex flex-col justify-between min-h-[300px] text-right">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-rose-450 mb-4 animate-bounce">
                    <Heart size={20} className="fill-current text-rose-400" />
                  </div>
                  <h4 className="text-base font-black">حامیان ارتقای کلوپ بازی!</h4>
                  <p className="text-[11px] text-indigo-200/80 leading-relaxed font-semibold">
                    کلوپ ما بر پایه حمایت قلبی تک‌تک بازیکنان وفادار پابرجا است. اگر از سرویس‌دهی، تجهیزات و محیط ما رضایت دارید، با اهدای مبالغ کوچک ما را در ارتقای دستگاه‌ها همراهی کنید.
                  </p>
                </div>
                
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="text-xs text-indigo-300 font-bold flex items-center justify-between">
                    <span>مجموع مبالغ اهدایی شما:</span>
                    <span className="text-amber-300 font-extrabold text-sm">
                      {formatCurrency(clientDonations.reduce((sum, d) => sum + d.amount, 0))}
                    </span>
                  </div>
                  <button 
                    onClick={() => setActiveTab('donations')} 
                    type="button"
                    className="w-full bg-white hover:bg-slate-100 text-indigo-950 font-black text-xs py-3 rounded-2xl block text-center transition-all shadow-md shadow-indigo-950/40 active:scale-95 cursor-pointer border-none"
                  >
                    انتقال به بخش اهدا و حمایت 💖
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTab === 'points' && (
          <motion.div
            key="client-points"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6 text-right"
            dir="rtl"
          >
            {/* Header / Points balance card */}
            <div className="p-6 md:p-8 rounded-[2rem] bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-xl shadow-amber-500/10 dark:shadow-none flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 p-1.5 rounded-lg">
                    <Sparkles size={18} className="animate-pulse text-amber-100" />
                  </span>
                  <p className="text-xs font-black text-amber-100 uppercase tracking-wider">میزان امتیاز کلوپ شما</p>
                </div>
                <h3 className="text-3xl md:text-4xl font-black font-mono">
                  {formatPersianDigits(client?.points || 0)} <span className="text-lg md:text-xl font-black">امتیاز وفاداری</span>
                </h3>
                <p className="text-xs text-white/80 font-bold leading-relaxed">
                  سطح عضویت کلوپ شما: <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-white font-black">{currentTier ? currentTier.name : 'کاربر آزاد کلوپ'}</span>
                </p>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl text-[11px] font-bold leading-relaxed space-y-1.5 backdrop-blur-sm self-start md:self-center border border-white/15">
                <p className="text-amber-100 flex items-center gap-1.5 font-extrabold">⚡ صندوق خرج امتیازها و دریافت جوایز خودکار:</p>
                <p>امتیازهای خود را به شارژ مستقیم حساب، آواتار لوکس و تخفیف تبدیل کنید</p>
              </div>
            </div>

            {/* DUAL BUTTONS TOGGLE CONTROL - EARN VS SPEND */}
            <div className="flex gap-4 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl max-w-sm md:max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setPointsSubTab('earn')}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl font-black text-xs md:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2",
                  pointsSubTab === 'earn'
                    ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-md"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Award size={16} />
                امتیازگیری و فستیوال‌ها
              </button>
              <button
                type="button"
                onClick={() => setPointsSubTab('spend')}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl font-black text-xs md:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2",
                  pointsSubTab === 'spend'
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <ShoppingBag size={16} />
                خرید با امتیاز و جوایز
              </button>
            </div>

            {/* Main Gamification Hub Content */}
            <div className="space-y-6 pb-2">
              {pointsActionSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="p-4 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-800 rounded-2xl text-xs font-bold text-center text-emerald-800 dark:text-emerald-400"
                >
                  {pointsActionSuccess}
                </motion.div>
              )}
              {pointsActionError && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="p-4 bg-rose-50 dark:bg-rose-950/10 border border-rose-250 dark:border-rose-900 rounded-2xl text-xs font-bold text-center text-rose-800 dark:text-rose-400"
                >
                  {pointsActionError}
                </motion.div>
              )}

              {pointsSubTab === 'earn' ? (
                /* ================= EARN POINTS VIEWS ================= */
                <div className="space-y-6">
                  <Card className="p-6 md:p-8 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/20 rounded-[2rem] space-y-6 text-right">
                    <div className="flex flex-col gap-1.5">
                      <h4 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2 border-r-4 border-amber-500 pr-3">
                        <Sparkles className="text-amber-500" size={18} />
                        امتیازگیری کلوپ وفاداری مراجعین
                      </h4>
                      <p className="text-xs text-slate-400 font-bold font-sans">روش‌های دائم کسب امتیاز وفاداری و جشنواره‌های موقت کلوپ را در زیر مشاهده کنید:</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(!pointsFestivals || pointsFestivals.length === 0) ? (
                        <div className="col-span-full text-center py-10 text-slate-400 text-xs font-semibold italic bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-slate-100">
                          درحال حاضر روش یا جشنواره فعالی در سیستم وجود ندارد.
                        </div>
                      ) : (
                        pointsFestivals.filter((festival: any) => festival.isActive !== false).map((festival: any) => (
                          <div 
                            key={festival.id} 
                            className={cn(
                              "p-5 rounded-[2rem] border space-y-3 flex flex-col justify-between transition-all",
                              festival.isFixed
                                ? "border-slate-100 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-900/10 hover:border-slate-200"
                                : "border-amber-100 dark:border-amber-955/40 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm hover:shadow"
                            )}
                          >
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-sm font-black text-slate-950 dark:text-white leading-snug">{festival.title}</span>
                                <div className="flex gap-1.5 items-center shrink-0">
                                  {festival.isFixed ? (
                                    <Badge className="bg-slate-150 text-slate-600 dark:bg-slate-850 dark:text-slate-350 border-none font-black text-[9px] px-2 py-0.5">فرمول دائم</Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-none font-black text-[9px] px-2 py-0.5">جشنواره موقت</Badge>
                                  )}
                                  <Badge className="bg-amber-500/15 text-amber-600 dark:bg-amber-950 dark:text-amber-400 border-none font-bold text-[9px] px-2 py-0.5 font-sans">
                                    {festival.points && (String(festival.points).includes('امتیاز') ? festival.points : `+${festival.points} امتیاز`)}
                                  </Badge>
                                </div>
                              </div>
                              {festival.description && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed font-sans">{festival.description}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                /* ================= SPEND POINTS VIEWS ================= */
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Dynamic point rewards shop display list (2 columns layout) */}
                  <div className="xl:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2 border-r-4 border-indigo-600 pr-3">
                        <ShoppingBag size={18} className="text-indigo-600" />
                        ویترین جوایز و فروشگاه فکری کلوپ
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 font-sans">برای خرید، روی دکمه امتیاز جایزه بزنید</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {(!pointsRewards || pointsRewards.length === 0) ? (
                        <div className="col-span-full py-12 text-center bg-gray-50/50 dark:bg-slate-900/10 rounded-3xl border border-dashed border-gray-200">
                          <p className="text-gray-400 font-bold text-xs">هیچ جایزه‌ای در فروشگاه تعریف نشده است.</p>
                        </div>
                      ) : (
                        pointsRewards.filter((r: any) => r.isActive !== false).map((reward: any) => (
                          <div key={reward.id} className="p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 space-y-4 flex flex-col justify-between text-right shadow-sm hover:shadow-md transition-shadow">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-slate-900 dark:text-white leading-relaxed">
                                  {reward.type === 'wallet_cashback' && '💰'}
                                  {reward.type === 'custom_nickname' && '✏️'}
                                  {reward.type === 'profile_avatar_unlock' && '🖼️'}
                                  {reward.type === 'discount_coupon' && '🎟️'}
                                  {reward.type === 'free_game' && '🎮'}
                                  {' '}{reward.title}
                                </span>
                                <Badge className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-none font-black text-[9px] font-sans shrink-0">{reward.cost} امتیاز</Badge>
                              </div>
                              {reward.description && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed font-sans">{reward.description}</p>
                              )}
                            </div>
                            <Button
                              onClick={(e) => {
                                handleSpendPointsForReward({ cost: reward.cost, type: reward.type, title: reward.title });
                              }}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-9 rounded-xl border-none cursor-pointer"
                            >
                              خرید با {reward.cost} امتیاز
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sidebar column for Point Reward Code list */}
                  <div className="xl:col-span-1">
                    <Card className="p-5 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl space-y-4">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-350 flex items-center gap-1.5 justify-start border-none">
                        <span>🎟️</span>
                        کدهای تخفیف خریداری‌شده فعال
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed font-sans">
                        این کدها را در مراجعه بعدی خود به صندوقدار کلاب جهت اعمال تخفیف ارائه دهید:
                      </p>
                      
                      {purchasedCoupons.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-[10px] italic font-semibold font-sans">
                          هیچکد فعالی خریداری نکرده‌اید.
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                          {purchasedCoupons.map((c, index) => (
                            <div key={index} className="bg-white dark:bg-slate-905 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1 text-right">
                              <span className="font-extrabold text-[11px] text-slate-900 dark:text-gray-100">{c.title}</span>
                              <div className="flex justify-between items-center mt-1">
                                <span className="font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black px-2 py-1 rounded text-xs select-all">
                                  {c.code}
                                </span>
                                <span className="text-[8px] text-slate-400 font-medium font-mono font-sans">تاریخ خرید: {c.date}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- WALLET TAB --- */}
      <AnimatePresence mode="wait">
        {activeTab === 'wallet' && (
          <motion.div
            key="client-wallet"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8 text-right"
            dir="rtl"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Balance & Score Stats columns */}
              <div className="md:col-span-1 space-y-6">
                <Card className="p-6 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 shadow-inner rounded-3xl space-y-4">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-350">وضعیت دارایی حساب</h4>
                  
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-semibold">موجودی اعتبار نقدی</span>
                      <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">{formatCurrency(client?.balance || 0)}</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-semibold">امتیاز وفاداری باشگاه کلوپ</span>
                      <span className="text-xl font-black text-amber-500 mt-1 block">{formatPersianDigits(client?.points || 0)} امتیاز</span>
                    </div>
                  </div>
                  
                  {/* Convert Club Points Box */}
                  <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                    <h5 className="text-[11px] font-black text-indigo-900 dark:text-indigo-300">تبدیل به اعتبار نقدی</h5>
                    <p className="text-[9.5px] text-indigo-600 dark:text-indigo-400 leading-relaxed font-semibold">
                      هر ۱ امتیاز باشگاه معادل <span className="font-extrabold text-emerald-600 dark:text-emerald-400">۱۰,۰۰۰ تومان</span> اعتبار نقدی می‌باشد.
                    </p>
                    
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        placeholder="تعداد امتیاز" 
                        value={pointsToConvert}
                        onChange={e => setPointsToConvert(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs text-center font-bold outline-none rounded-xl"
                      />
                      <button 
                        onClick={handleConvertPoints}
                        type="button"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3.5 py-2 shrink-0 rounded-xl transition-all cursor-pointer"
                      >
                        تبدیل امتیاز
                      </button>
                    </div>

                    {conversionSuccess && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold text-center animate-bounce mt-1">
                        ✓ امتیاز با موفقیت تبدیل و به کیف پول شما افزوده شد.
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Manual Offline Payment Informational Box */}
              <div className="md:col-span-2">
                <Card className="p-6 md:p-8 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
                  
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold text-2xl">
                      🏦
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">روش‌های فعال اعتباریابی و شارژ کیف پول</h4>
                      <p className="text-xs text-slate-400 font-bold mt-1">
                        امنیت بالا و یکپارچگی کامل با سیستم صندوق فیزیکی کلوپ بازی
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 relative z-10 text-xs text-slate-655 dark:text-slate-305 font-bold leading-relaxed">
                    <p>
                      کاربر گرامی، به منظور افزایش امنیت حساب شما و تطبیق لحظه‌ای با نرم‌افزار مرکزی مدیریت کانتینرها و کنسول‌های کلوپ، درگاه پرداخت آنلاین غیرفعال می‌باشد. کلیه فرآیند تغییر و ارتقای موجودی کیف پول به صورت زیر انجام می‌پذیرد:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 border border-slate-100/70 dark:border-slate-800 rounded-2xl space-y-2">
                        <span className="text-xs font-black text-slate-850 dark:text-slate-200 block">💵 ۱. مراجعه حضوری به گیشه کلوپ</span>
                        <p className="text-[10.5px] text-slate-450 font-semibold leading-normal">
                          تنها با ارائه شماره همراه خود به صندوقدار کلاب، می‌توانید کارت بکشید و نسبت به افزایش شارژ حساب خود با هر مبلغ دلخواه اقدام فرمایید.
                        </p>
                      </div>

                      <div className="bg-slate-55 dark:bg-slate-950/40 p-4 border border-slate-100/70 dark:border-slate-800 rounded-2xl space-y-2">
                        <span className="text-xs font-black text-slate-850 dark:text-slate-200 block">📱 ۲. تماس تلفنی و پرداخت غیرحضوری</span>
                        <p className="text-[10.5px] text-slate-450 font-semibold leading-normal">
                          جهت دریافت شماره کارت مدیریت کلوپ بازی و شارژ غیر حضوری، لطفاً به مسئول پذیرش در باجه مراجعه کرده یا هماهنگی نمایید.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 rounded-2xl border border-amber-200/50 flex items-start gap-3 mt-4 text-[10.5px]">
                      <span className="text-lg">📢</span>
                      <div>
                        <p className="font-extrabold font-sans">استفاده از امتیازات باشگاه وفاداری:</p>
                        <p className="font-semibold text-slate-505 dark:text-slate-400 mt-1 leading-relaxed">
                          در صورتی که در باشگاه جوایز امتیاز کلوپی دارید، می‌توانید با استفاده از بخش تبدیل امتیاز در ستون کناری، سهم امتیازات خود را به طور آنی و مستقل به اعتبار نقدی هدیه کیف پول انتقال دهید!
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DONATIONS TAB --- */}
      <AnimatePresence mode="wait">
        {activeTab === 'donations' && (
          <motion.div
            key="client-donations"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Preset Cards & message input container */}
              <div className="lg:col-span-2">
                <Card className="p-6 border-slate-105 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl space-y-6 text-right">
                  <div>
                    <h4 className="text-base font-black text-slate-950 dark:text-white">انتخاب نوع حمایت و اهدای مبلغ</h4>
                    <p className="text-xs text-slate-400 font-bold mt-1 pr-0.5">یک آیتم یا مبلغ هدیه را به دلخواه انتخاب و سپس پیام ویژه خود را ثبت کنید</p>
                  </div>

                  {donationSuccess ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-8 bg-indigo-50 dark:bg-indigo-995/10 border border-indigo-100 rounded-3xl text-center space-y-4"
                    >
                      <div className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md animate-pulse">
                        <Heart size={36} className="fill-current" />
                      </div>
                      <h4 className="text-base font-black text-rose-600 dark:text-rose-450">حمایت شما با موفقیت ثبت گردید! 💖</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
                        جناب {client?.name}، دبیری حمایت مالی بی‌نظیر شما پردازش شد و به پاس این همدلی، امتیاز وفاداری به باشگاه شما اضافه گردید. دمتان گرم!
                      </p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleDonate} className="space-y-6">
                      
                      {/* Presets Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { value: 5000, label: '🍬 خرید شکلات یا آدامس شیفت', sub: 'یک هدیه کوچک و بسیار صمیمانه' },
                          { value: 15000, label: '🥤 یک نوشیدنی خنک برای اپراتور', sub: 'جهت رفع خستگی پرسنل کلوپ' },
                          { value: 45000, label: '☕ قهوه اسپرسو داغ برای پرسنل کلوپ', sub: 'جهت پر انرژی ماندن پرسنل زحمت‌کش' },
                          { value: 100000, label: '🍕 کمک به تهیه وعده غذایی تیم مستقر', sub: 'جهت شارژ انرژی مضاعف کل اکیپ' }
                        ].map(item => (
                          <div
                            key={item.value}
                            onClick={() => { setDonationPreset(item.value); }}
                            className={cn(
                              "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-right",
                              donationPreset === item.value 
                                ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-md scale-[1.01]" 
                                : "bg-slate-50/25 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800 hover:border-slate-350"
                            )}
                          >
                            <span className="text-xs font-black text-slate-900 dark:text-white block">{item.label}</span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-1">{item.sub}</span>
                            <span className="text-xs font-mono font-black text-indigo-650 dark:text-indigo-400 block mt-3">
                              {formatCurrency(item.value)}
                            </span>
                          </div>
                        ))}

                        {/* Custom choice card */}
                        <div
                          onClick={() => { setDonationPreset('custom'); }}
                          className={cn(
                            "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between text-right col-span-1 sm:col-span-2",
                            donationPreset === 'custom' 
                              ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-md scale-[1.01]" 
                              : "bg-slate-50/25 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800 hover:border-slate-350"
                          )}
                        >
                          <div>
                            <span className="text-xs font-black text-slate-900 dark:text-white block">🔮 مبلغ کاملا دلخواه برای حمایت مالی از مجموعه</span>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-1">کمک برای ارتقاء و پیشرفت همه‌جانبه کلوپ</span>
                          </div>
                          {donationPreset === 'custom' && (
                            <div className="relative mt-3">
                              <input 
                                type="number" 
                                required
                                placeholder="مبلغ مدنظر به تومان"
                                value={customDonationValue}
                                onChange={e => setCustomDonationValue(e.target.value)}
                                className="w-full bg-white dark:bg-slate-950 h-10 border border-slate-200 dark:border-slate-800 text-xs text-center font-bold px-3 py-1.5 rounded-xl outline-none"
                              />
                              <span className="absolute left-3 top-2.5 text-[10px] text-slate-400 font-bold">تومان</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Msg Box */}
                      <div className="space-y-1">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-350 block pr-1">پیام پر انرژی و دلگرم‌کننده شما برای کادر کلوپ (اختیاری):</label>
                        <textarea 
                          placeholder="مثلاً: دمتان گرم بابت فراهم ساختن سیستم‌های فوق سری و مانیتورهای عالی با تاخیر کم. همیشه فوق العاده‌اید!"
                          rows={3}
                          value={donationMessage}
                          onChange={e => setDonationMessage(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl outline-none text-xs font-bold leading-relaxed shadow-inner"
                        />
                      </div>

                      {/* Pay Method */}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-350 block pr-1">نوع بستر پرداخت حمایت:</label>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                            <input 
                              type="radio" 
                              name="donationMethod" 
                              checked={donationPayMethod === 'wallet'} 
                              onChange={() => setDonationPayMethod('wallet')}
                              className="text-indigo-650"
                            />
                            <span>برداشت امن از کیف پول کلوپی (اعتبار نقدی حال حاضر)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                            <input 
                              type="radio" 
                              name="donationMethod" 
                              checked={donationPayMethod === 'online'} 
                              onChange={() => setDonationPayMethod('online')}
                              className="text-indigo-650"
                            />
                            <span>اتصال مستقیم آزمایشی به درگاه شتاب آنلاین</span>
                          </label>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isDonating}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-105 dark:shadow-none cursor-pointer border-none"
                      >
                        <Heart size={16} className="fill-current animate-pulse text-rose-500" />
                        {isDonating ? 'در حال ثبت حمایت قلبی...' : 'تایید اهدای هدیه و ثبت پیام حمایتی'}
                      </button>
                    </form>
                  )}
                </Card>
              </div>

              {/* Sidebar list of recent club donations */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="p-5 border-slate-105 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl space-y-4 text-right">
                  <h4 className="text-xs font-black text-slate-850 dark:text-slate-300">آخرین حمایت‌های ثبت‌شده شما</h4>
                  
                  {clientDonations.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs italic font-semibold">
                      شما هنوز حمایتی ثبت نکرده‌اید. حامی باشگاه ما باشید!
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                      {clientDonations.map((d, index) => (
                        <div key={index} className="bg-white dark:bg-slate-900 p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                          <div className="flex justify-between items-baseline">
                            <span className="font-extrabold text-slate-900 dark:text-white">اهدای {formatCurrency(d.amount)}</span>
                            <span className="text-[9px] text-slate-400 font-bold block">
                              {formatPersianDigits(new Date(d.timestamp).toLocaleDateString('fa-IR'))}
                            </span>
                          </div>
                          
                          {d.message && (
                            <p className="bg-slate-55/80 dark:bg-slate-950 p-2 rounded-lg text-[10px] text-slate-500 dark:text-slate-350 italic leading-relaxed border border-slate-100/50 dark:border-slate-850">
                              « {d.message} »
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HISTORY TAB --- */}
      <AnimatePresence mode="wait">
        {activeTab === 'history' && (
          <motion.div
            key="client-history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Play Sessions History */}
              <Card className="p-6 border-slate-105 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl space-y-5 text-right">
                <div className="flex items-center gap-3 justify-start">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Gamepad2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">تاریخچه نشست‌های بازی</h4>
                    <p className="text-[10px] text-slate-400 font-bold pr-0.5">آرشیو بازی روی دستگاه‌های کلوپ</p>
                  </div>
                </div>

                <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-2">
                  {clientSessions.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 italic text-xs font-bold">نشستی برای این کاربر ثبت نشده است.</div>
                  ) : (
                    clientSessions.map(s => {
                      const cItem = consoles?.find(c => c.id === s.consoleId);
                      const tItem = allTariffs?.find(t => t.id === s.tariffId);
                      const sessionTime = new Date(s.startTime).getTime();
                      const isClientViewer = isOwnProfile || currentUser?.role === 'client';
                      const isCostArchived = isClientViewer && !isNaN(sessionTime) && (Date.now() - sessionTime) > (30 * 24 * 60 * 60 * 1000);
                      const intervals = resolveSessionIntervals(s, allTariffs, consoles);
                      const hasTariffChange = intervals.length > 1;
                      const totalCost = s.totalCost || (s as any).finalCost || 0;
                      const hasDiscount = ((s.tierDiscountAmount || 0) + (s.promoDiscountAmount || 0) > 0) || ((s as any).discountAmount > 0);
                      const totalDiscount = (s.tierDiscountAmount || 0) + (s.promoDiscountAmount || 0) || (s as any).discountAmount || 0;
                      const userSplitShare = s.costPerUser;

                      return (
                        <div key={s.id} className="bg-slate-50/60 dark:bg-slate-950/40 border border-slate-100/90 dark:border-slate-850 p-4 rounded-2xl text-xs space-y-3 text-right">
                          <div className="flex justify-between items-baseline">
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {cItem?.name || 'کنسول کلوپ'} <span className="text-[9px] text-slate-400 font-bold">({cItem?.type || 'سایر'})</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {formatPersianDigits(new Date(s.startTime).toLocaleDateString('fa-IR'))}
                            </span>
                          </div>

                          {/* Tariff info & Tariff changes display */}
                          {hasTariffChange ? (
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl p-2.5 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-black text-indigo-950 dark:text-indigo-200">
                                <span className="flex items-center gap-1.5">
                                  <ArrowRightLeft size={13} className="text-indigo-600 dark:text-indigo-400" />
                                  <span>تغییر تعرفه / دستگاه در این فاکتور:</span>
                                </span>
                                <span className="text-[9.5px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-full">
                                  {formatPersianDigits(intervals.length)} مرحله
                                </span>
                              </div>
                              <div className="divide-y divide-indigo-100/80 dark:divide-slate-800/80 pt-0.5">
                                {intervals.map((inv: any, idx: number) => {
                                  let cleanName = inv.tariffName || 'تعرفه';
                                  if (inv.consoleName && cleanName.startsWith(inv.consoleName)) {
                                    cleanName = cleanName.slice(inv.consoleName.length).replace(/^[\s-]+/, '').trim();
                                  }
                                  const mins = Math.round((inv.durationSeconds || 0) / 60);
                                  return (
                                    <div key={idx} className="flex justify-between items-start py-1.5 text-[10.5px]">
                                      <div className="flex items-start gap-1.5">
                                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 px-1.5 py-0.2 rounded mt-0.5 shrink-0">
                                          {idx === 0 ? 'مرحله ۱' : `مرحله ${formatPersianDigits(idx + 1)}`}
                                        </span>
                                        <div>
                                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                            {inv.consoleName ? `${inv.consoleName} - ` : ''}{cleanName}
                                          </span>
                                          <span className="text-[9px] text-slate-400">
                                            نرخ: {formatCurrency(inv.pricePerHour)}/ساعت
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end shrink-0">
                                        {!isCostArchived && (
                                          <span className="font-black text-indigo-700 dark:text-indigo-300">
                                            {formatCurrency(inv.cost || 0)}
                                          </span>
                                        )}
                                        <span className="text-slate-400 text-[9.5px]">
                                          {formatPersianDigits(mins)} دقیقه
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium bg-slate-100/60 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-slate-150/60 dark:border-slate-800 flex justify-between items-center">
                              <span>تعرفه بازی: <strong className="text-slate-800 dark:text-slate-200">{tItem?.name || 'تعرفه استاندارد'}</strong></span>
                              {tItem?.pricePerHour ? <span className="text-[9.5px] text-slate-400 font-bold">{formatCurrency(tItem.pricePerHour)} / ساعت</span> : null}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-450 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-850/60 font-semibold text-right">
                            <div className="text-right">
                              ساعت بازی: {formatPersianDigits(new Date(s.startTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}
                              {s.endTime && ' الی ' + formatPersianDigits(new Date(s.endTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}
                            </div>
                            <div className="text-left">
                              مدت کل: {s.endTime ? `${formatPersianNumber(Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000))} دقیقه` : 'در حال بازی (فعال)'}
                            </div>
                            <div className="text-right">
                              تخفیف کلوپ: {isCostArchived ? <span className="text-slate-400">---</span> : hasDiscount ? <span className="text-emerald-600 font-bold">-{formatCurrency(totalDiscount)}</span> : 'ندارد'}
                            </div>
                            <div className="text-left">
                              {isCostArchived ? (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                                  بایگانی هزینه (بیش از ۳۰ روز)
                                </span>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs">
                                    هزینه کل: {formatCurrency(totalCost)}
                                  </span>
                                  {userSplitShare && (s.userIds?.length || 0) > 1 && (
                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                      (سهم دونگی: {formatCurrency(userSplitShare)})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Bar: View Full Invoice Button */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 flex items-center justify-between">
                            <span className="text-[9.5px] text-slate-400">
                              {s.addedItems && s.addedItems.length > 0 ? `+ ${formatPersianDigits(s.addedItems.length)} سفارش بوفه` : 'فاکتور الکترونیکی کلوپ'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoiceSession(s);
                                setIsInvoiceModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-[10.5px] font-black transition-all cursor-pointer shadow-2xs"
                            >
                              <Receipt size={13} />
                              <span>مشاهده و چاپ فاکتور</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Buffett Receipts box */}
              <Card className="p-6 border-slate-105 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl space-y-5 text-right">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl flex items-center justify-center">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">آرشیو رسید سفارشات بوفه</h4>
                    <p className="text-[10px] text-slate-400 font-bold pr-0.5">خوراکی‌ها و نوشیدنی‌های تهیه شده در بستر کلوپ</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                  {clientSales.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 italic text-xs font-bold">رسش فروش یا اقلام دفتری ثبت نشده است.</div>
                  ) : (
                    clientSales.map(sale => {
                      const saleTime = new Date(sale.timestamp).getTime();
                      const isClientViewer = isOwnProfile || currentUser?.role === 'client';
                      const isSaleCostArchived = isClientViewer && !isNaN(saleTime) && (Date.now() - saleTime) > (30 * 24 * 60 * 60 * 1000);

                      const isManual = sale.type === 'manual_invoice';
                      const title = sale.title || (isManual ? (sale.gameAmount > 0 ? 'فاکتور دستی بازی و کلوپ' : 'فاکتور دستی بوفه') : `فاکتور بوفه: ${formatPersianDigits(sale.id?.slice(-6) || 'فروش')}`);

                      return (
                        <div key={sale.id} className="bg-slate-50/40 dark:bg-slate-950/30 border border-slate-100/80 dark:border-slate-850 p-4 rounded-2xl space-y-3 text-xs text-right">
                          <div className="flex justify-between items-baseline border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white">{title}</span>
                              {isManual && (
                                <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-900/40">
                                  فاکتور دستی
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold text-left">
                              {formatPersianDigits(new Date(sale.timestamp).toLocaleDateString('fa-IR'))}
                            </span>
                          </div>

                          {/* Order items lists or services */}
                          <div className="space-y-1">
                            {sale.gameAmount > 0 && (
                              <div className="flex justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                                <span>• سهم خدمات بازی و کلوپ:</span>
                                <span>{isSaleCostArchived ? '---' : formatCurrency(sale.gameAmount)}</span>
                              </div>
                            )}
                            {sale.items?.filter((it: any) => it.id !== 'manual_game').map((it: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-[11px] text-slate-500 font-medium">
                                <span>• {it.name} <span className="text-[9px] text-slate-400">({formatPersianDigits(it.quantity)} عدد)</span></span>
                                <span>{isSaleCostArchived ? '---' : formatCurrency(it.price * it.quantity)}</span>
                              </div>
                            ))}
                            {sale.details && (!sale.items || sale.items.length === 0) && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{sale.details}</p>
                            )}
                          </div>

                          <div className="flex justify-between text-[10.5px] font-bold text-slate-450 dark:text-white/60 pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
                            <span>تسویه از: <span className="text-slate-800 dark:text-slate-300 font-black">{sale.paymentMethod === 'wallet' ? 'کیف پول کاربری' : 'نقدی/کارتخوان'}</span></span>
                            {isSaleCostArchived ? (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                                بایگانی هزینه (بیش از ۳۰ روز)
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs">مجموع نهایی: {formatCurrency(sale.totalAmount)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PROFILE TAB --- */}
      <AnimatePresence mode="wait">
        {activeTab === 'profile' && (
          <motion.div
            key="client-profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="p-6 md:p-8 border-slate-105 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl space-y-6 text-right">
              <div>
                <h4 className="text-base font-black text-slate-950 dark:text-white">پیکربندی اطلاعات هویتی و کلمه عبور</h4>
                <p className="text-xs text-slate-400 font-bold mt-1">تغییر نام، شماره تلفن و رمز عبور ورود به پنل کاربری کلاینت</p>
              </div>

              <form onSubmit={handleUpdateProfileAndPass} className="space-y-5">
                
                {/* Visual feedback notifications */}
                {profileSuccess && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-990/10 border border-emerald-150 rounded-2xl text-emerald-600 font-bold text-xs leading-relaxed text-right">
                     ✓ {profileSuccess}
                  </div>
                )}
                {profileError && (
                  <div className="p-4 bg-red-50 dark:bg-red-995/10 border border-red-150 rounded-2xl text-red-600 font-bold text-xs leading-relaxed text-right animate-bounce">
                     ⚠️ {profileError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="نام و نام خانوادگی" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    required 
                  />
                  <Input 
                    label="شماره تلفن همراه (نام کاربری)" 
                    value={newPhone} 
                    onChange={e => setNewPhone(e.target.value)} 
                    required 
                  />
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-850/65 mt-4 space-y-4 text-right">
                  <h5 className="text-xs font-black text-indigo-900 dark:text-indigo-400 flex items-center gap-1 justify-start">
                    <Lock size={14} />
                    بخش تغییر کلمه عبور کاربری
                  </h5>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    در صورتی که مایل به تغییر رمز عبور حال حاضر خود هستید، موارد زیر را کامل نمایید. در غیر این صورت فیلدهای مربوطه را خالی رها سازید.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <Input 
                      label="کلمه عبور جدید" 
                      type="password"
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                    />
                    <Input 
                      label="تکرار کلمه عبور جدید" 
                      type="password"
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2 rounded-2xl transition-all cursor-pointer border-none"
                >
                  ذخیره تغییرات و برورسانی فایل‌ها کاربری
                </button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

       {/* --- Point Spend Checkout Modals inside ClientPortfolioView --- */}
       <AnimatePresence>
         {activeModal === 'name_change' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 text-right">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl text-right">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black text-slate-900 dark:text-white">
                       {pendingReward ? pendingReward.title : 'تغییر لقب و نام کاربری'}
                     </h3>
                     <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                  </div>
                  {modalError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold leading-relaxed">
                       ⚠️ {modalError}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed font-semibold">
                    با پرداخت <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{pendingReward ? pendingReward.cost : 10} امتیاز</span> می‌توانید لقب نمایشی و نام کاربری ورود خود را تغییر دهید:
                  </p>
                  <div className="space-y-4">
                     <Input 
                       label="نام و لقب نمایشی جدید کلوپ" 
                       value={pointsChangeNameInput} 
                       onChange={e => setPointsChangeNameInput(e.target.value)} 
                       placeholder="مثلا: رضا قهرمان"
                     />
                     <Input 
                       label="نام کاربری جدید جهت ورود به سیستم" 
                       value={pointsChangeUsernameInput} 
                       onChange={e => setPointsChangeUsernameInput(e.target.value)} 
                       placeholder="مثلا: reza_hero"
                     />
                     
                     <div className="flex gap-3 pt-4">
                        <Button onClick={handleConfirmNameChange} className="flex-1 h-12 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl">تایید و پرداخت</Button>
                        <Button type="button" variant="outline" onClick={() => setActiveModal(null)} className="flex-1 h-12 text-base font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750">انصراف</Button>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}

         {activeModal === 'avatar_selection' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 text-right">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black text-slate-900 dark:text-white">
                       {pendingReward ? pendingReward.title : 'تغییر کاراکتر و آواتار منو'}
                     </h3>
                     <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                  </div>
                  {modalError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold leading-relaxed">
                       ⚠️ {modalError}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed font-semibold">
                    یکی از آباتار‌های قهرمانان زیر را متناسب با سلیقه خود انتخاب کنید. آزاد کردن این آواتار <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{pendingReward ? pendingReward.cost : 15} امتیاز</span> از شما کسر خواهد کرد:
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto max-h-[300px] p-1 text-center">
                     {AVATAR_OPTIONS.map(opt => (
                       <button
                         key={opt.code}
                         onClick={() => setSelectedAvatarCode(opt.code)}
                         className={cn(
                           "p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer",
                           selectedAvatarCode === opt.code 
                             ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 scale-105" 
                             : "border-slate-100 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-900/40 hover:bg-slate-50"
                         )}
                       >
                         <span className="text-3xl">{opt.emoji}</span>
                         <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{opt.label}</span>
                       </button>
                     ))}
                  </div>

                  <div className="flex gap-3 pt-6 mt-2 border-t border-slate-100 dark:border-slate-800">
                     <Button onClick={handleConfirmAvatarSelection} className="flex-1 h-12 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl">تایید و کسر {pendingReward ? pendingReward.cost : 15} امتیاز</Button>
                     <Button type="button" variant="outline" onClick={() => setActiveModal(null)} className="flex-1 h-12 text-base font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750">انصراف</Button>
                  </div>
               </motion.div>
            </div>
         )}

         {activeModal === 'point_transfer' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 text-right">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black text-slate-900 dark:text-white">
                       {pendingReward ? pendingReward.title : 'انتقال امتیاز به کیف‌پول'}
                     </h3>
                     <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                  </div>
                  {modalError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold leading-relaxed">
                       ⚠️ {modalError}
                    </div>
                  )}
                  
                  {pendingReward ? (
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed font-semibold">
                      آیا مایلید با پرداخت <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{pendingReward.cost} امتیاز</span>، معادل <span className="font-extrabold text-emerald-600">{formatPersianDigits(pendingReward.cost * 10000)} تومان</span> شارژ کیف پول کلوپ به صورت مستقیم دریافت کنید؟
                    </p>
                  ) : (
                    <div className="space-y-4">
                       <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                         بر اساس قوانین کلوپ، هر ۱ امتیاز معادل <span className="font-black text-amber-500">۱۰,۰۰۰ تومان</span> اعتبار کیف پول خواهد بود. مایلید چه تعداد امتیاز را نقدی کنید؟
                       </p>
                       <Input 
                         label="تعداد امتیاز برای تبدیل" 
                         type="number"
                         value={convertPointsCount} 
                         onChange={e => setConvertPointsCount(e.target.value)} 
                       />
                       <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-2xl text-emerald-600 text-xs font-bold flex justify-between items-center border border-emerald-100">
                         <span>مبلغ دریافتی شما در کیف پول:</span>
                         <span className="font-extrabold text-sm">{formatCurrency(Math.floor(Number(convertPointsCount || 0)) * 10000)}</span>
                       </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-6">
                     <Button onClick={handleConfirmPointTransfer} className="flex-1 h-12 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl">تایید و تبدیل امتیازات</Button>
                     <Button type="button" variant="outline" onClick={() => setActiveModal(null)} className="flex-1 h-12 text-base font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750">انصراف</Button>
                  </div>
               </motion.div>
            </div>
         )}

         {activeModal === 'buffet_coupon' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 text-right">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black text-slate-900 dark:text-white">
                       {pendingReward ? pendingReward.title : 'خرید کوپن تخفیف بوفه'}
                     </h3>
                     <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                  </div>
                  {modalError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold leading-relaxed">
                       ⚠️ {modalError}
                    </div>
                  )}
                  
                  <div className="text-center space-y-4 mb-6">
                     <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                       <ShoppingBag size={32} />
                     </div>
                     <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                       شما درحال خرید کارت جایزه <span className="font-extrabold text-indigo-600 dark:text-indigo-400">«{pendingReward ? pendingReward.title : 'کوپن تخفیف بوفه کلوب'}»</span> با ارزش امتیاز <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{pendingReward ? pendingReward.cost : 25} امتیاز</span> هستید.
                     </p>
                     <p className="text-[11px] text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-slate-950/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                       پس از پرداخت، کد جایزه به صورت آنی در پانل کدهای تخفیف شما ذخیره شده و می‌توانید آن را جهت اعمال به صندوق‌دار بوفه ارائه دهید.
                     </p>
                  </div>

                  <div className="flex gap-3">
                     <Button onClick={handleConfirmBuffetCoupon} className="flex-1 h-12 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl">تایید و پرداخت امتیاز</Button>
                     <Button type="button" variant="outline" onClick={() => setActiveModal(null)} className="flex-1 h-12 text-base font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750">انصراف</Button>
                  </div>
               </motion.div>
            </div>
         )}

         {activeModal === 'free_game' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 text-right">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black text-slate-900 dark:text-white">
                       {pendingReward ? pendingReward.title : 'دریافت ۱ ساعت بازی رایگان'}
                     </h3>
                     <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                  </div>
                  {modalError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold leading-relaxed">
                       ⚠️ {modalError}
                    </div>
                  )}
                  
                  <div className="text-center space-y-4 mb-6">
                     <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                       <Gamepad2 size={32} />
                     </div>
                     <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                       شما درحال خرید جایزه <span className="font-extrabold text-amber-600">«{pendingReward ? pendingReward.title : '۱ ساعت بازی رایگان روی کلیه کنسول‌ها'}»</span> با هزینه <span className="font-extrabold text-amber-600">{pendingReward ? pendingReward.cost : 40} امتیاز</span> گرانبها کلوپ هستید.
                     </p>
                     <p className="text-[11px] text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-slate-950/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                       باموفقیت ۱ کارت مینی کلوپ ۲۴ ساعته تایید شده و برای شما صادر خواهد شد تا بتوانید به راحتی یک بازی به مدت کل ساعت هدیه بگیرید!
                     </p>
                  </div>

                  <div className="flex gap-3">
                     <Button onClick={handleConfirmFreeGame} className="flex-1 h-12 text-base font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center gap-1">تایید و کسر امتیاز</Button>
                     <Button type="button" variant="outline" onClick={() => setActiveModal(null)} className="flex-1 h-12 text-base font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750">انصراف</Button>
                  </div>
               </motion.div>
            </div>
         )}
       </AnimatePresence>

       {/* Printable Official Invoice Modal for Client */}
       <InvoiceModal
         isOpen={isInvoiceModalOpen}
         onClose={() => {
           setIsInvoiceModalOpen(false);
           setSelectedInvoiceSession(null);
         }}
         report={invoiceReport}
         settings={allSettings && allSettings.length > 0 ? allSettings[0] : undefined}
         clients={allClients || []}
         consoles={consoles || []}
         tariffs={allTariffs || []}
       />
    </div>
  );
}

const toEnglishDigits = (str: string): string => {
  return String(str || '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export default function Clients({ currentUser }: ClientsProps) {
  const { data: clients, loading: clientsLoading } = useCollection<AppUser>('clients');
  const { data: tiers, loading: tiersLoading } = useCollection<ClientTier>('client_tiers');
  const { data: sessions } = useCollection<Session>('sessions');
  const { data: systemUsers } = useCollection<any>('system_users');
  const { data: sales } = useCollection<any>('sales');
  const { data: donations } = useCollection<any>('donations');
  const { data: consoles } = useCollection<any>('consoles');
  const { add, update, remove } = useFirestore();

  // Seeding Guest and Default Tiers
  useEffect(() => {
    if (!clientsLoading && clients && !clients.some(c => c.isGuest)) {
       add('clients', {
         name: 'مهمان (Guest)',
         phone: '0000000000',
         balance: 0,
         points: 0,
         totalPlayTime: 0,
         totalPaid: 0,
         isGuest: true,
         tier: 'none'
       });
    }

    if (!tiersLoading && tiers && tiers.length === 0) {
      const defaultTiers = [
        { name: 'آماتور (Amateur)', minPlayTime: 0, discountPercentage: 0, color: 'slate' },
        { name: 'پلیر معمولی (Player)', minPlayTime: 600, discountPercentage: 3, color: 'indigo' },
        { name: 'طرفدار کلوپ (Fan)', minPlayTime: 1800, discountPercentage: 5, color: 'emerald' },
        { name: 'گیمر کوشا (Diligence)', minPlayTime: 3000, discountPercentage: 7, color: 'orange' },
        { name: 'پلیر حرفه‌ای (Pro)', minPlayTime: 6000, discountPercentage: 10, color: 'rose' },
        { name: 'وفادار نقره‌ای (Silver)', minPlayTime: 12000, discountPercentage: 12, color: 'slate' },
        { name: 'وفادار طلایی (Gold)', minPlayTime: 30000, discountPercentage: 15, color: 'amber' },
        { name: 'گیمر پلاتینیوم (Platinum)', minPlayTime: 60000, discountPercentage: 20, color: 'indigo' },
        { name: 'افسانه کلوپ (Legend)', minPlayTime: 120000, discountPercentage: 25, color: 'emerald' },
        { name: 'ارباب گیم (Game Lord)', minPlayTime: 300000, discountPercentage: 30, color: 'rose' }
      ];
      
      defaultTiers.forEach(tier => {
        add('client_tiers', tier);
      });
    }
  }, [tiers, tiersLoading, clients, clientsLoading, add]);

  const [activeTab, setActiveTab] = useState<'clients' | 'levels'>('clients');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyDebtors, setShowOnlyDebtors] = useState(false);
  const [now, setNow] = useState(new Date());

  const [selectedDetailClient, setSelectedDetailClient] = useState<AppUser | null>(null);
  const [activeClient, setActiveClient] = useState<AppUser | null>(null);

  // Sync client profile for current user
  useEffect(() => {
    if (currentUser?.role === 'client' && clients && !clientsLoading) {
      // Find matching client
      let match = clients.find(c => c.id === currentUser.clientId);
      if (!match) {
        // Fallback: match by phone or name
        match = clients.find(c => c.name === currentUser.fullName || c.phone === currentUser.username);
      }
      
      if (match) {
        setActiveClient(match);
      } else {
        // Auto-create client entry for this user!
        const newClientData = {
          name: currentUser.fullName || 'کاربر کلوپ',
          phone: currentUser.username || '09120000000',
          balance: 100000, // Give some default trial balance!
          points: 10, // Give some default free points!
          totalPlayTime: 120, // Give some trial play time!
          totalPaid: 100000,
          tier: 'none'
        };
        add('clients', newClientData).then((newClient: any) => {
          // Update system_user's clientId
          if (currentUser.id && newClient?.id) {
            update('system_users', currentUser.id, { clientId: newClient.id });
          }
        });
      }
    }
  }, [currentUser, clients, clientsLoading, add, update]);

  const negativeWalletsStats = useMemo(() => {
    if (!clients) return { count: 0, totalDebt: 0 };
    const debtors = clients.filter(c => (Number(c.balance) || 0) < 0);
    const totalDebt = debtors.reduce((sum, c) => sum + Math.abs(Number(c.balance) || 0), 0);
    return { count: debtors.length, totalDebt };
  }, [clients]);

  // Update "now" every minute to refresh live duration calculations
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getEffectivePlayTime = (client: AppUser) => {
    const baseTime = Number(client.totalPlayTime) || 0;
    
    // Find active session for this client
    const activeSession = sessions?.find(s => s.userId === client.id && !s.endTime);
    if (activeSession) {
      const startTime = new Date(activeSession.startTime).getTime();
      const currentDurationMinutes = Math.floor((now.getTime() - startTime) / 60000);
      return baseTime + currentDurationMinutes;
    }
    
    return baseTime;
  };
  
  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [showAdvancedClientForm, setShowAdvancedClientForm] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, id: string, name: string } | null>(null);

  // Forms
  const [clientForm, setClientForm] = useState({ 
    name: '',
    username: '',
    phone: '', 
    balance: '0', 
    points: '0',
    totalPlayTime: '0',
    totalPaid: '0'
  });

  const [tierForm, setTierForm] = useState<Partial<ClientTier>>({
    name: '',
    minPlayTime: 0,
    discountPercentage: 0,
    color: 'indigo'
  });

  // Helpers
  const getClientTier = (client: AppUser, duration: number) => {
    if (client.isGuest) return null;
    if (!tiers || tiers.length === 0) return null;
    const sortedTiers = [...tiers].sort((a, b) => b.minPlayTime - a.minPlayTime);
    const matched = sortedTiers.find(t => duration >= t.minPlayTime);
    return matched || null; // Return null if no tier is reached
  };

  const getClientTotalPayment = (c: AppUser) => {
    const manualPaid = Number(c.totalPaid) || 0;
    
    const clientSalesPaid = (sales || [])
      .filter((s: any) => s.clientId === c.id || (s.clientName && s.clientName === c.name))
      .reduce((sum: number, s: any) => {
        const amt = Number(s.finalAmount ?? s.totalAmount ?? s.totalPrice ?? s.amount) || 0;
        return sum + amt;
      }, 0);

    const clientSessionsPaid = (sessions || [])
      .filter((s: any) => s.userId === c.id)
      .reduce((sum: number, s: any) => {
        const amt = Number(s.totalCost ?? (s as any).finalCost) || 0;
        return sum + amt;
      }, 0);

    return Math.max(manualPaid, clientSalesPaid + clientSessionsPaid);
  };

  const topProfitableClients = useMemo(() => {
    if (!clients || clients.length === 0) return [];
    
    return clients
      .filter(c => !c.isGuest)
      .map(c => {
        const effectiveTime = getEffectivePlayTime(c);
        const currentTier = getClientTier(c, effectiveTime);
        const totalPayment = getClientTotalPayment(c);
        return {
          client: c,
          totalPayment,
          effectiveTime,
          tier: currentTier
        };
      })
      .sort((a, b) => b.totalPayment - a.totalPayment)
      .slice(0, 3);
  }, [clients, sales, sessions, tiers, now]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(c => {
      const matchSearch = String(c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(c.phone || '').includes(searchTerm);
      const matchDebt = showOnlyDebtors ? (Number(c.balance) || 0) < 0 : true;
      return matchSearch && matchDebt;
    });
  }, [clients, searchTerm, showOnlyDebtors]);

  const sortedTiers = useMemo(() => {
    if (!tiers) return [];
    return [...tiers].sort((a, b) => a.minPlayTime - b.minPlayTime);
  }, [tiers]);

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = toEnglishDigits(clientForm.phone || '').trim();
    const cleanUsername = toEnglishDigits(clientForm.username || cleanPhone || '').trim();
    const composedName = (clientForm.name || '').trim();
    const finalName = composedName || (cleanPhone ? `مشتری ${cleanPhone}` : 'کاربر بدون نام');

    const payload = {
      name: finalName,
      firstName: finalName,
      lastName: '',
      username: cleanUsername,
      phone: cleanPhone,
      balance: Number(clientForm.balance) || 0,
      points: Number(clientForm.points) || 0,
      totalPlayTime: Number(clientForm.totalPlayTime) || 0,
      totalPaid: Number(clientForm.totalPaid) || 0,
      tier: 'bronze'
    };

    if (editingClientId) {
      await update('clients', editingClientId, {
        name: payload.name,
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username,
        phone: payload.phone,
        balance: payload.balance,
        points: payload.points,
        totalPlayTime: payload.totalPlayTime,
        totalPaid: payload.totalPaid
      });

      // Synchronize with existing system_user
      const linkedUser = systemUsers?.find((u: any) => u.clientId === editingClientId);
      if (linkedUser) {
        await update('system_users', linkedUser.id, {
          username: cleanUsername,
          fullName: finalName,
          phone: cleanPhone,
          password: cleanPhone
        });
      } else {
        if (cleanUsername) {
          await add('system_users', {
            username: cleanUsername,
            fullName: finalName,
            password: cleanPhone,
            role: 'client',
            phone: cleanPhone,
            isActive: true,
            clientId: editingClientId,
            createdAt: new Date().toISOString()
          });
        }
      }
    } else {
      const newClient = await add('clients', { 
        name: payload.name,
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username,
        phone: payload.phone,
        balance: payload.balance,
        points: payload.points,
        totalPlayTime: payload.totalPlayTime,
        totalPaid: payload.totalPaid,
        tier: 'bronze'
      }); 

      // Automatically create a system user for login
      const newClientId = newClient?.id || newClient;
      if (newClientId) {
        if (cleanUsername) {
          const alreadyExists = systemUsers?.some((u: any) => toEnglishDigits(u.username || '').toLowerCase().trim() === cleanUsername.toLowerCase().trim());
          if (!alreadyExists) {
            await add('system_users', {
              username: cleanUsername,
              fullName: finalName,
              password: cleanPhone,
              role: 'client',
              phone: cleanPhone,
              isActive: true,
              clientId: newClientId,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }
    closeClientModal();
  };

  const handleTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTierId) {
      await update('client_tiers', editingTierId, tierForm);
    } else {
      await add('client_tiers', tierForm);
    }
    closeTierModal();
  };

  const closeClientModal = () => {
    setShowClientModal(false);
    setEditingClientId(null);
    setShowAdvancedClientForm(false);
    setClientForm({ 
      name: '', 
      username: '', 
      phone: '', 
      balance: '0', 
      points: '0', 
      totalPlayTime: '0',
      totalPaid: '0'
    });
  };

  const closeTierModal = () => {
    setShowTierModal(false);
    setEditingTierId(null);
    setTierForm({ name: '', minPlayTime: 0, discountPercentage: 0, color: 'indigo' });
  };

  const openEditClient = (c: AppUser) => {
    setEditingClientId(c.id);
    const linkedUser = systemUsers?.find((u: any) => u.clientId === c.id);

    setClientForm({ 
      name: c.name || '',
      username: linkedUser?.username || (c as any).username || c.phone || '',
      phone: c.phone || '', 
      balance: String(c.balance || 0), 
      points: String(c.points || 0),
      totalPlayTime: String(c.totalPlayTime || 0),
      totalPaid: String(c.totalPaid || 0)
    });
    setShowClientModal(true);
  };

  const openEditTier = (t: ClientTier) => {
    setEditingTierId(t.id);
    setTierForm(t);
    setShowTierModal(true);
  };

  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  if (currentUser?.role === 'client') {
    if (!activeClient) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] font-sans" dir="rtl">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500 font-bold text-sm">در حال بارگذاری اطلاعات پنل کاربری...</p>
        </div>
      );
    }
    return (
      <div className="p-4 lg:p-10 font-sans text-right" dir="rtl">
        <ClientPortfolioView 
          client={activeClient} 
          isOwnProfile={true} 
          systemUsers={systemUsers} 
          sessions={sessions} 
          sales={sales} 
          donations={donations} 
          tiers={tiers} 
          consoles={consoles}
          currentUser={currentUser} 
        />
      </div>
    );
  }

  if (selectedDetailClient) {
    return (
      <div className="p-4 lg:p-10 font-sans text-right" dir="rtl">
        <ClientPortfolioView 
          client={selectedDetailClient} 
          onClose={() => setSelectedDetailClient(null)}
          isOwnProfile={false} 
          systemUsers={systemUsers} 
          sessions={sessions} 
          sales={sales} 
          donations={donations} 
          tiers={tiers} 
          consoles={consoles}
          currentUser={currentUser} 
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 font-sans text-right" dir="rtl">
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">مدیریت مشتریان</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">باشگاه مشتریان، حساب دفتری و اعتبارات</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={() => activeTab === 'clients' ? setShowClientModal(true) : setShowTierModal(true)}>
             <Plus size={20} className="ml-2" />
             {activeTab === 'clients' ? 'ثبت مشتری جدید' : 'تعریف سطح جدید'}
          </Button>

          <SegmentToggle<'clients' | 'levels'>
            options={[
              { id: 'clients', label: 'لیست مشتریان', icon: Users },
              { id: 'levels', label: 'سطوح کاربری', icon: Layers }
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
            activeColor={activeTab === 'clients' ? 'indigo' : 'emerald'}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'clients' ? (
          <motion.div 
            key="clients-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
             {/* Top 3 Most Profitable Clients by Total Payment */}
             {topProfitableClients.length > 0 && (
               <Card className="p-6 md:p-8 bg-gradient-to-br from-amber-500/5 via-indigo-500/5 to-transparent border-amber-500/20 dark:border-amber-500/10 shadow-sm relative overflow-hidden">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                   <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/20 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-sm">
                       <Trophy size={24} className="animate-pulse" />
                     </div>
                     <div>
                       <div className="flex items-center gap-2">
                         <h3 className="text-lg font-black text-gray-900 dark:text-white">سودآورترین مشتریان باشگاه</h3>
                         <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/20">
                           ۳ رتبه برتر پرداخت
                         </span>
                       </div>
                       <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mt-0.5">
                         رتبه‌بندی اعضای باشگاه بر اساس بیشترین مجموع پرداختی، شارژ و صورتحساب‌ها
                       </p>
                     </div>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                   {topProfitableClients.map((item, index) => {
                     const rank = index + 1;
                     const isFirst = rank === 1;
                     const isSecond = rank === 2;

                     const badgeTheme = isFirst 
                       ? {
                           cardBg: "bg-gradient-to-b from-amber-50/80 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900",
                           borderColor: "border-amber-400/40 dark:border-amber-500/30 shadow-md shadow-amber-500/5",
                           rankBadge: "bg-amber-500 text-white shadow-md shadow-amber-500/20",
                           iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
                           highlightText: "text-amber-600 dark:text-amber-400",
                           title: "قهرمان سودآوری (رتبه اول)"
                         }
                       : isSecond
                       ? {
                           cardBg: "bg-gradient-to-b from-slate-50/80 via-white to-slate-50/30 dark:from-slate-800/30 dark:via-slate-900 dark:to-slate-900",
                           borderColor: "border-slate-300/60 dark:border-slate-700 shadow-sm",
                           rankBadge: "bg-slate-400 text-white",
                           iconBg: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                           highlightText: "text-slate-700 dark:text-slate-300",
                           title: "رتبه دوم سودآوری"
                         }
                       : {
                           cardBg: "bg-gradient-to-b from-orange-50/80 via-white to-orange-50/30 dark:from-orange-950/20 dark:via-slate-900 dark:to-slate-900",
                           borderColor: "border-orange-300/40 dark:border-orange-900/40 shadow-sm",
                           rankBadge: "bg-amber-700 text-white",
                           iconBg: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
                           highlightText: "text-amber-700 dark:text-amber-500",
                           title: "رتبه سوم سودآوری"
                         };

                     return (
                       <div 
                         key={item.client.id}
                         className={cn(
                           "relative p-5 rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between group",
                           badgeTheme.cardBg,
                           badgeTheme.borderColor
                         )}
                       >
                         {/* Rank Marker */}
                         <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center gap-2">
                             <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs", badgeTheme.rankBadge)}>
                               {formatPersianDigits(rank)}
                             </div>
                             <span className="text-[11px] font-black text-gray-500 dark:text-slate-400">
                               {badgeTheme.title}
                             </span>
                           </div>

                           <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", badgeTheme.iconBg)}>
                             {isFirst ? <Crown size={20} /> : isSecond ? <Medal size={20} /> : <Award size={20} />}
                           </div>
                         </div>

                         {/* Client Info */}
                         <div className="space-y-3 mb-5">
                           <div>
                             <h4 className="text-base font-black text-gray-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                               {item.client.name}
                             </h4>
                             <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                               {item.client.phone ? formatPersianDigits(item.client.phone) : 'بدون شماره ثبت‌شده'}
                             </p>
                           </div>

                           {/* Total Paid Highlighting */}
                           <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/60">
                             <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold mb-1">
                               مجموع پرداختی و خرید:
                             </p>
                             <p className={cn("text-xl font-black", badgeTheme.highlightText)}>
                               {formatCurrency(item.totalPayment)}
                             </p>
                           </div>

                           {/* Quick Stats Pills */}
                           <div className="grid grid-cols-2 gap-2 text-center">
                             <div className="p-2 rounded-xl bg-gray-50/80 dark:bg-slate-800/40">
                               <p className="text-[9px] text-gray-400 font-medium mb-0.5">زمان بازی</p>
                               <p className="text-xs font-black text-gray-700 dark:text-slate-300">
                                 {formatPersianDigits(Math.floor(item.effectiveTime / 60))} س و {formatPersianDigits(item.effectiveTime % 60)} د
                               </p>
                             </div>
                             <div className="p-2 rounded-xl bg-gray-50/80 dark:bg-slate-800/40">
                               <p className="text-[9px] text-gray-400 font-medium mb-0.5">امتیاز باشگاه</p>
                               <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                 {formatPersianDigits(item.client.points || 0)} امتیاز
                               </p>
                             </div>
                           </div>

                           {item.tier && (
                             <div className="flex items-center justify-between text-xs pt-1">
                               <span className="text-[10px] text-gray-400">سطح وفاداری:</span>
                               <span className={cn(
                                 "text-[10px] font-black px-2 py-0.5 rounded-lg border",
                                 colorMap[item.tier.color as keyof typeof colorMap] || "bg-indigo-50 text-indigo-600 border-indigo-100"
                               )}>
                                 {item.tier.name}
                               </span>
                             </div>
                           )}
                         </div>

                         {/* Action to view portfolio */}
                         <Button
                           variant="outline"
                           onClick={() => setSelectedDetailClient(item.client)}
                           className="w-full text-xs py-2 rounded-2xl justify-center font-bold group-hover:border-indigo-400 group-hover:text-indigo-600 transition-colors"
                         >
                           <History size={14} className="ml-1.5" />
                           مشاهده پرونده و گردش حساب
                         </Button>
                       </div>
                     );
                   })}
                 </div>
               </Card>
             )}

             {/* Statistics cards for Debtors */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <Card className="p-5 flex items-center justify-between border-gray-100 bg-rose-50/25 dark:bg-rose-950/10 hover:shadow-md transition-all">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900 border border-rose-200 flex items-center justify-center text-rose-600 dark:text-rose-300">
                     <UserX size={24} />
                   </div>
                   <div>
                     <h4 className="text-gray-450 dark:text-slate-500 text-[10px] font-black uppercase mb-1">تعداد بدهکاران دفتری</h4>
                     <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                       {formatPersianDigits(negativeWalletsStats.count)} نفر
                     </span>
                   </div>
                 </div>
               </Card>

               <Card className="p-5 flex items-center justify-between border-gray-100 bg-amber-50/25 dark:bg-amber-950/10 hover:shadow-md transition-all">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900 border border-amber-200 flex items-center justify-center text-amber-600 dark:text-amber-300">
                     <TrendingDown size={24} />
                   </div>
                   <div>
                     <h4 className="text-gray-450 dark:text-slate-500 text-[10px] font-black uppercase mb-1">مجموع مبالغ بدهکاری</h4>
                     <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                       {formatCurrency(negativeWalletsStats.totalDebt)}
                     </span>
                   </div>
                 </div>
               </Card>
             </div>

             {/* Search */}
             <Card className="p-3 shadow-sm border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center flex-1 gap-4">
                 <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 mr-2 dark:bg-slate-800">
                   <Search size={20} />
                 </div>
                 <input 
                   type="text" 
                   placeholder="جستجو در نام، شماره تماس یا سطح..."
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="flex-1 bg-transparent border-none outline-none py-2 font-medium text-sm text-right"
                 />
               </div>

               <div className="flex items-center gap-2 pl-3 border-r md:border-r border-gray-200 dark:border-slate-700 pr-3">
                 <button
                   type="button"
                   onClick={() => setShowOnlyDebtors(!showOnlyDebtors)}
                   className={cn(
                     "flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all",
                     showOnlyDebtors 
                       ? "bg-rose-600 text-white shadow-lg shadow-rose-200" 
                       : "bg-gray-100 text-gray-600 hover:bg-gray-250 dark:bg-slate-800 dark:text-slate-300"
                   )}
                 >
                   <span>فقط نمایش بدهکاران</span>
                   <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                     {formatPersianDigits(negativeWalletsStats.count)}
                   </span>
                 </button>
               </div>
             </Card>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {clientsLoading ? (
                [1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl animate-pulse" />)
              ) : filteredClients.length === 0 ? (
                <div className="col-span-full py-20 text-center text-gray-400 italic">موردی یافت نشد.</div>
              ) : (
                filteredClients.map(client => {
                  const effectiveTime = getEffectivePlayTime(client);
                  const currentTier = getClientTier(client, effectiveTime);
                  const isPlaying = sessions?.some(s => s.userId === client.id && !s.endTime);

                  return (
                    <Card key={client.id} className="p-6 relative group overflow-hidden border-gray-100 hover:border-indigo-200 transition-all duration-300">
                       <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                             <div className={cn(
                               "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 relative text-2xl",
                               client.isGuest ? "bg-amber-500 text-white" : (client.avatar ? "bg-indigo-50 dark:bg-indigo-950/45 text-2xl" : (currentTier ? colorMap[currentTier.color] : "bg-gray-50 text-gray-400"))
                             )}>
                                {client.isGuest ? (
                                  <Star size={28} />
                                ) : client.avatar ? (
                                  <span className="text-3xl">{getAvatarEmoji(client.avatar)}</span>
                                ) : (
                                  currentTier ? <Award size={28} /> : <Users size={28} />
                                )}
                                {isPlaying && (
                                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                                  </span>
                                )}
                             </div>
                             <div>
                                <h4 className="font-black text-gray-900 text-lg leading-tight mb-1">{client.name}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                                   <Phone size={12} />
                                   {formatPersianDigits(client.phone)}
                                </div>
                             </div>
                          </div>
                          {currentTier && (
                             <Badge className={colorMap[currentTier.color]}>
                                {currentTier.name}
                             </Badge>
                          )}
                       </div>

                       <div className="grid grid-cols-2 gap-3 mb-6">
                          <div className="p-3 bg-gray-50 rounded-2xl">
                             <p className="text-[9px] text-gray-400 font-black uppercase mb-1">
                                {(client.balance || 0) < 0 ? "کیف پول (بدهکار ⚠️)" : "کیف پول"}
                             </p>
                             <p className={cn("font-black text-sm", (client.balance || 0) < 0 ? "text-rose-600 animate-pulse font-black" : "text-gray-900")}>
                                {formatCurrency(client.balance)}
                             </p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-2xl">
                             <p className="text-[9px] text-gray-400 font-black uppercase mb-1">مجموع پرداختی</p>
                             <p className="font-black text-emerald-600 text-sm">{formatCurrency(client.totalPaid || 0)}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-2xl col-span-2">
                             <p className="text-[9px] text-gray-400 font-black uppercase mb-1">زمان کل بازی</p>
                             <p className="font-black text-indigo-600 text-sm flex items-center gap-1">
                                {formatPersianDigits(Math.floor(effectiveTime / 60))}س و {formatPersianDigits(effectiveTime % 60)}د
                                {isPlaying && <Clock size={12} className="animate-pulse text-emerald-500" />}
                             </p>
                          </div>
                       </div>

                       <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            className="flex-1 text-xs font-black h-10 border-indigo-100 bg-indigo-50/10 text-indigo-700 hover:bg-rose-50 hover:text-rose-600" 
                            onClick={() => setSelectedDetailClient(client)}
                          >
                               <User size={14} className="ml-1 text-indigo-500" />
                               پرونده کلاینت
                          </Button>
                          {!client.isGuest && (
                            <Button variant="outline" className="w-10 h-10 p-0 rounded-xl" onClick={() => openEditClient(client)}>
                               <Edit3 size={14} />
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            className={cn("p-0 rounded-xl text-red-400 hover:text-white hover:bg-red-500 border-gray-100", client.isGuest ? "flex-1 h-10" : "w-10 h-10")}
                            onClick={() => {
                              if(client.isGuest) {
                                alert('امکان حذف کاربر مهمان وجود ندارد.');
                                return;
                              }
                              setDeleteConfirmation({ isOpen: true, id: client.id, name: client.name });
                            }}
                          >
                             <Trash2 size={16} />
                             {client.isGuest && <span className="mr-2 text-xs font-bold">غیرقابل حذف</span>}
                          </Button>
                       </div>
                    </Card>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="levels-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="max-w-4xl mx-auto space-y-6"
          >
             <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 mb-8 flex items-center gap-6">
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                   <TrendingUp size={32} />
                </div>
                <div>
                   <h4 className="font-bold text-gray-900 mb-1">سطح‌بندی هوشمند</h4>
                   <p className="text-sm text-gray-500 leading-relaxed">
                      در این بخش می‌توانید سطوح مختلف وفاداری را تعریف کنید. اختصاص سطح به مشتریان به صورت خودکار و بر اساس مجموع دقایق بازی آن‌ها انجام می‌شود.
                   </p>
                </div>
             </div>

             <div className="space-y-4">
                {tiersLoading ? (
                  <div className="h-40 bg-white dark:bg-slate-900 animate-pulse rounded-3xl transition-all" />
                ) : sortedTiers.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-200 dark:border-slate-800">
                     <Layers className="mx-auto text-gray-200 dark:text-slate-700 mb-4" size={48} />
                     <p className="text-gray-400 dark:text-slate-500 italic">هنوز سطحی تعریف نکرده‌اید.</p>
                  </div>
                ) : (
                  sortedTiers.map(t => (
                    <Card key={t.id} className="p-6 flex items-center justify-between group hover:shadow-md transition-all">
                       <div className="flex items-center gap-6">
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", colorMap[t.color])}>
                             <ShieldCheck size={28} />
                          </div>
                          <div>
                             <h4 className="font-black text-gray-900 text-lg mb-1">{t.name}</h4>
                             <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">
                                <span className="flex items-center gap-1.5"><Clock size={12} /> از {formatPersianDigits(t.minPlayTime)} دقیقه بازی</span>
                                <span className="flex items-center gap-1.5 text-emerald-600"><Star size={12} /> {formatPersianDigits(t.discountPercentage)}٪ تخفیف</span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="flex gap-2">
                          <Button variant="outline" className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border-gray-100" onClick={() => openEditTier(t)}>
                             <Edit3 size={18} />
                          </Button>
                          <Button 
                            variant="outline" 
                            className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 border-gray-100"
                            onClick={() => {
                              if(confirm('آیا از حذف این سطح مطمئن هستید؟')) remove('client_tiers', t.id);
                            }}
                          >
                             <Trash2 size={18} />
                          </Button>
                       </div>
                    </Card>
                  ))
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Modals --- */}
      <AnimatePresence>
         {showClientModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeClientModal} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {editingClientId ? 'ویرایش مشخصات مشتری' : 'ثبت عضویت مشتری جدید'}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">همگام با حساب کاربری ورود به پنل اختصاصی مشتری</p>
                      </div>
                    </div>
                    <button onClick={closeClientModal} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <X size={18} />
                    </button>
                 </div>

                 {/* Sync Explanatory Callout */}
                 <div className="mb-5 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
                    <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-bold text-[11px]">
                      حساب کاربری ورود به سیستم به صورت همگام با همین شماره همراه فعال می‌شود. مشتری با شماره موبایل خود می‌تواند وارد پنل مشتری شده و سوابق بازی، فاکتورها، شارژ کیف پول و سطوح وفاداری را مشاهده کند.
                    </p>
                 </div>

                 <form onSubmit={handleClientSubmit} className="space-y-4">
                    <Input 
                      label="نام و نام خانوادگی مشتری *" 
                      placeholder="مثلاً: علی محمدی"
                      value={clientForm.name} 
                      onChange={e => setClientForm({...clientForm, name: e.target.value})} 
                      required
                      className="h-12 font-bold bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900"
                    />

                    <Input 
                      label="شماره تلفن همراه (شناسه حساب کاربری و ورود) *" 
                      placeholder="مثلاً: ۰۹۱۲۳۴۵۶۷۸۹"
                      value={clientForm.phone} 
                      onChange={e => setClientForm({...clientForm, phone: e.target.value})} 
                      required
                      className="h-12 font-mono font-bold bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 text-left"
                      dir="ltr"
                    />

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">اعتبار اولیه کیف پول (تومان)</label>
                      <Input 
                        type="number" 
                        placeholder="۰"
                        value={clientForm.balance} 
                        onChange={e => setClientForm({...clientForm, balance: e.target.value})} 
                        className="h-12 font-mono font-black text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900"
                      />
                    </div>

                    {/* Expandable Advanced Fields */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedClientForm(!showAdvancedClientForm)}
                        className="text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors py-1 cursor-pointer"
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", showAdvancedClientForm ? "rotate-180" : "")} />
                        <span>{showAdvancedClientForm ? 'بستن تنظیمات پیشرفته' : 'تنظیمات بیشتر (نام کاربری اختیاری، امتیاز و سوابق اولیه)'}</span>
                      </button>

                      {showAdvancedClientForm && (
                        <div className="mt-3 p-4 bg-slate-50/70 dark:bg-slate-950/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                          <Input 
                            label="نام کاربری دلخواه (در صورت تمایل به تمایز با شماره موبایل)" 
                            placeholder="به صورت خودکار همان شماره موبایل در نظر گرفته می‌شود"
                            value={clientForm.username} 
                            onChange={e => setClientForm({...clientForm, username: e.target.value})} 
                            className="h-10 text-xs font-bold bg-white dark:bg-slate-900"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <Input 
                              label="زمان بازی اولیه (دقیقه)" 
                              type="number" 
                              value={clientForm.totalPlayTime} 
                              onChange={e => setClientForm({...clientForm, totalPlayTime: e.target.value})} 
                              className="h-10 text-xs font-bold bg-white dark:bg-slate-900"
                            />
                            <Input 
                              label="امتیاز وفاداری اولیه" 
                              type="number" 
                              value={clientForm.points} 
                              onChange={e => setClientForm({...clientForm, points: e.target.value})} 
                              className="h-10 text-xs font-bold bg-white dark:bg-slate-900"
                            />
                          </div>
                          <Input 
                            label="مجموع پرداختی‌های قبلی (تومان)" 
                            type="number" 
                            value={clientForm.totalPaid} 
                            onChange={e => setClientForm({...clientForm, totalPaid: e.target.value})} 
                            className="h-10 text-xs font-bold bg-white dark:bg-slate-900"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                       <Button 
                         type="submit" 
                         className="flex-1 h-12 text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-500/20"
                       >
                         {editingClientId ? 'بروزرسانی مشخصات مشتری' : 'ثبت و فعال‌سازی عضویت'}
                       </Button>
                       <Button 
                         type="button" 
                         variant="outline" 
                         onClick={closeClientModal} 
                         className="px-6 h-12 text-sm font-bold rounded-2xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                       >
                         انصراف
                       </Button>
                    </div>
                 </form>
              </motion.div>
           </div>
         )}

         {showTierModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeTierModal} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">{editingTierId ? 'ویرایش سطح کاربری' : 'تعریف سطح جدید'}</h3>
                    <button onClick={closeTierModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X size={20} /></button>
                 </div>
                 <form onSubmit={handleTierSubmit} className="space-y-5">
                    <Input label="عنوان سطح (مثلا: نقره‌ای VIP)" value={tierForm.name} onChange={e => setTierForm({...tierForm, name: e.target.value})} required />
                    <div className="grid grid-cols-2 gap-4">
                       <Input label="حداقل زمان بازی (دقیقه)" type="number" value={tierForm.minPlayTime} onChange={e => setTierForm({...tierForm, minPlayTime: Number(e.target.value)})} required />
                       <Input label="درصد تخفیف" type="number" value={tierForm.discountPercentage} onChange={e => setTierForm({...tierForm, discountPercentage: Number(e.target.value)})} required />
                    </div>

                    <div>
                       <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-3">انتخاب رنگ تم</label>
                       <div className="flex gap-2">
                          {(['indigo', 'amber', 'emerald', 'rose', 'slate', 'orange'] as const).map(c => (
                             <button
                                key={c}
                                type="button"
                                onClick={() => setTierForm({...tierForm, color: c})}
                                className={cn(
                                   "w-10 h-10 rounded-xl transition-all border-4",
                                   tierForm.color === c ? "border-gray-900 dark:border-white scale-110 shadow-lg" : "border-transparent",
                                   c === 'indigo' ? 'bg-indigo-600' : 
                                   c === 'amber' ? 'bg-amber-500' : 
                                   c === 'emerald' ? 'bg-emerald-500' : 
                                   c === 'rose' ? 'bg-rose-500' : 
                                   c === 'slate' ? 'bg-slate-500' : 'bg-orange-500'
                                )}
                             />
                          ))}
                       </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                       <Button type="submit" className="flex-1 h-12 text-base font-black uppercase tracking-widest">{editingTierId ? 'ذخیره تغییرات' : 'ایجاد سطح'}</Button>
                       <Button type="button" variant="outline" onClick={closeTierModal} className="flex-1 h-12 text-base font-bold bg-white dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700">انصراف</Button>
                    </div>
                 </form>
              </motion.div>
           </div>
         )}
      </AnimatePresence>

      <Modal 
        isOpen={!!deleteConfirmation?.isOpen} 
        onClose={() => setDeleteConfirmation(null)} 
        title="تایید حذف مشتری"
      >
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={40} />
          </div>
          <div>
            <h4 className="text-lg font-black text-gray-900 mb-2">آیا از حذف این مشتری مطمئن هستید؟</h4>
            <p className="text-gray-500 text-sm">
              مشتری <span className="font-bold text-gray-900">"{deleteConfirmation?.name}"</span> از لیست حذف خواهد شد. این عمل قابل بازگشت نیست.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button 
              className="flex-1 bg-red-500 hover:bg-red-600 h-12" 
              onClick={async () => {
                if (deleteConfirmation) {
                  await remove('clients', deleteConfirmation.id);
                  setDeleteConfirmation(null);
                }
              }}
            >
              بله، حذف شود
            </Button>
            <Button variant="outline" className="flex-1 h-12" onClick={() => setDeleteConfirmation(null)}>انصراف</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
