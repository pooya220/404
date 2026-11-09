import { apiRequest } from '../hooks/useFirestore';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { SystemSettings } from '../types';
import { Card, Button, Input, Badge } from '../components/ui/common';
import { 
  Settings as SettingsIcon, 
  Save, 
  Globe, 
  Shield, 
  Bell, 
  Database, 
  Phone, 
  MapPin, 
  BadgePercent,
  RefreshCw,
  Trash2,
  HardDrive,
  Info,
  Edit2,
  Palette,
  Download,
  Upload,
  FileJson,
  Award,
  Gift,
  ToggleLeft as Toggle,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Lock,
  AlertTriangle,
  Gamepad2,
  Sparkles,
  Check,
  Building,
  Target,
  Sliders,
  PlayCircle,
  Users,
  Plus,
  Trash,
  Eye,
  EyeOff,
  Search,
  ShieldCheck,
  ShieldAlert,
  Table,
  Copy,
  Package,
  ShoppingCart,
  Layers,
  Filter,
  Volume2,
  VolumeX,
  Radio,
  Clock,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { playAlertSound, SOUND_OPTIONS, SoundType } from '../utils/soundAlerts';

export default function Settings() {
  const { data: settingsList, loading } = useCollection<SystemSettings>('settings');
  const { add, update, remove, clearCollection } = useFirestore();

  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const [form, setForm] = useState<Partial<SystemSettings>>({
    storeName: 'گیم‌نت پلاس',
    currency: 'تومان',
    taxRate: 0,
    monthlySalesTarget: 10000000,
    contactPhone: '',
    address: '',
    autoBackup: true,
    alarmMinuteWarning: 2,
    alarmEnabled: true,
    alarmSoundType: 'digital',
    alarmVolume: 80,
    buffetAlertEnabled: true,
    buffetAlertSoundType: 'bell',
    buffetAlertVolume: 80,
    defaultMinStock: 10,
    dayResetHour: 0,
    dayResetMinute: 0,
    themes: {}
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<{
    clientsCount: number;
    salesCount: number;
    sessionsCount: number;
    productsCount: number;
    settingsFound: boolean;
    purchasesCount?: number;
    promotionsCount?: number;
    shareholdersCount?: number;
    goalsCount?: number;
    reservationsCount?: number;
  } | null>(null);
  const [parsedRestoreData, setParsedRestoreData] = useState<Record<string, any> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'promo' | 'fixed' } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [userSubTab, setUserSubTab] = useState<'users' | 'levels'>(() => {
    return searchParams.get('tab') === 'permissions' ? 'levels' : 'users';
  });
  const [dbSubTab, setDbSubTab] = useState<'tables' | 'mysql' | 'maintenance' | 'all'>(() => {
    const rawTab = searchParams.get('tab');
    const sub = searchParams.get('sub');
    if (rawTab === 'backup' || rawTab === 'security' || sub === 'backup' || sub === 'maintenance' || sub === 'purge') return 'maintenance';
    if (rawTab === 'mysql' || sub === 'mysql') return 'mysql';
    if (sub === 'tables' || sub === 'structure') return 'tables';
    return 'tables';
  });

  const getEffectiveTab = (tab: string | null): string => {
    if (!tab) return 'general';
    if (tab === 'security' || tab === 'backup' || tab === 'mysql' || tab === 'database') return 'database';
    if (tab === 'permissions') return 'users';
    if (tab === 'themes' || tab === 'buffet') return 'general';
    if (tab === 'devices') return 'finance';
    return tab;
  };

  const [activeTab, setActiveTabState] = useState<string>(() => {
    return getEffectiveTab(searchParams.get('tab'));
  });

  useEffect(() => {
    const rawTab = searchParams.get('tab');
    const sub = searchParams.get('sub');

    // Handle database subtabs
    if (rawTab === 'backup' || rawTab === 'security' || (rawTab === 'database' && (sub === 'backup' || sub === 'maintenance' || sub === 'purge'))) {
      setDbSubTab('maintenance');
    } else if (rawTab === 'mysql' || (rawTab === 'database' && sub === 'mysql')) {
      setDbSubTab('mysql');
    } else if (rawTab === 'database' && (sub === 'tables' || sub === 'structure')) {
      setDbSubTab('tables');
    } else if (rawTab === 'database' && sub === 'all') {
      setDbSubTab('all');
    }

    // Handle users subtabs
    if (rawTab === 'permissions' || (rawTab === 'users' && sub === 'levels')) {
      setUserSubTab('levels');
    } else if (rawTab === 'users' && sub === 'users') {
      setUserSubTab('users');
    }

    const eff = getEffectiveTab(rawTab);
    if (eff !== activeTab) {
      setActiveTabState(eff);
    }
  }, [searchParams]);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
  };

  const handleSetUserSubTab = (sub: 'users' | 'levels') => {
    setUserSubTab(sub);
    setSearchParams({ tab: 'users', sub });
  };

  const handleSetDbSubTab = (sub: 'tables' | 'mysql' | 'maintenance' | 'all') => {
    setDbSubTab(sub);
    setSearchParams({ tab: 'database', sub });
  };

  // MySQL Integration States
  const [mysqlHost, setMysqlHost] = useState('localhost');
  const [mysqlPort, setMysqlPort] = useState('3306');
  const [mysqlUser, setMysqlUser] = useState('root');
  const [mysqlPassword, setMysqlPassword] = useState('');
  const [mysqlDatabase, setMysqlDatabase] = useState('game_net_club');
  const [mysqlEnabled, setMysqlEnabled] = useState(false);
  const [mysqlStatus, setMysqlStatus] = useState<'NOT_CONFIGURED' | 'DISABLED' | 'CONNECTED' | 'ERROR'>('NOT_CONFIGURED');
  const [mysqlError, setMysqlError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingAutoBackup, setSavingAutoBackup] = useState(false);
  const [syncingData, setSyncingData] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // User Management Form States
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userEditingId, setUserEditingId] = useState<string | null>(null);
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormFullName, setUserFormFullName] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<string>('operator');
  const [userFormPhone, setUserFormPhone] = useState('');
  const [userFormIsActive, setUserFormIsActive] = useState(true);
  const [userFormClientId, setUserFormClientId] = useState('');
  const [showUserPassword, setShowUserPassword] = useState(false);
  
  // Custom states for deletion/permissions custom mechanics
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({
    admin: ['/', '/consoles', '/products', '/clients', '/reservations', '/reports', '/analytics', '/goals', '/stocks', '/settings'],
    operator: ['/', '/consoles', '/products', '/clients', '/reservations', '/reports', '/analytics', '/goals', '/stocks'],
    client: ['/', '/reservations']
  });

  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [roleFormKey, setRoleFormKey] = useState('');
  const [roleFormLabel, setRoleFormLabel] = useState('');
  const [roleEditingKey, setRoleEditingKey] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  // Points Loyalty & Earning Festivals States
  const [festFormOpen, setFestFormOpen] = useState(false);
  const [festEditingId, setFestEditingId] = useState<string | null>(null);
  const [festTitle, setFestTitle] = useState('');
  const [festDescription, setFestDescription] = useState('');
  const [festPoints, setFestPoints] = useState('15');
  const [festIsActive, setFestIsActive] = useState(true);
  const [festIsFixed, setFestIsFixed] = useState(false);

  // Points Rewards / Shop States
  const [rewardFormOpen, setRewardFormOpen] = useState(false);
  const [rewardEditingId, setRewardEditingId] = useState<string | null>(null);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardCost, setRewardCost] = useState('20');
  const [rewardType, setRewardType] = useState<'custom_nickname' | 'profile_avatar_unlock' | 'wallet_cashback' | 'discount_coupon' | 'free_game'>('wallet_cashback');
  const [rewardValue, setRewardValue] = useState('10000'); // e.g. amount of cashback or code
  const [rewardIsActive, setRewardIsActive] = useState(true);

  const rolesList = useMemo(() => {
    const customLabels = (form as any)?.roleLabels || {};
    return {
      admin: 'مدیر سیستم',
      operator: 'اپراتور کلوپ',
      client: 'مشتری کلاینت',
      ...customLabels
    };
  }, [form]);

  useEffect(() => {
    if (form && (form as any).rolePermissions) {
      setPermissions((form as any).rolePermissions);
    }
  }, [(form as any)?.rolePermissions]);

  useEffect(() => {
    const fetchMySQLStatus = async () => {
      try {
        const res = await fetch('/api/mysql/status');
        if (res.ok) {
          const data = await res.json();
          setMysqlStatus(data.status);
          setMysqlEnabled(data.enabled);
          if (data.config) {
            setMysqlHost(data.config.host || 'localhost');
            setMysqlPort(data.config.port || '3306');
            setMysqlUser(data.config.user || 'root');
            setMysqlDatabase(data.config.database || 'game_net_club');
          }
          if (data.error) {
            setMysqlError(data.error);
          }
        }
      } catch (err) {
        console.error("Error fetching mysql status:", err);
      }
    };
    fetchMySQLStatus();
  }, []);

  const handleConnectMySQL = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingConnection(true);
    setMysqlError(null);
    try {
      const res = await fetch('/api/mysql/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: mysqlHost,
          port: mysqlPort,
          user: mysqlUser,
          password: mysqlPassword,
          database: mysqlDatabase,
          enabled: true
         })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMysqlStatus('CONNECTED');
        setMysqlEnabled(true);
        localStorage.setItem('db_mode', 'mysql');
        localStorage.setItem('db_mode_explicit', 'true');
        const { triggerDatabaseRefresh } = await import('../hooks/useFirestore');
        triggerDatabaseRefresh();
        showToast('اتصال به دیتابیس MySQL برقرار شد و کل جدول‌های مورد نیاز کلوپ ایجاد شدند!', 'success');
      } else {
        setMysqlStatus('ERROR');
        setMysqlError(data.error || 'خطا در اتصال به MySQL');
      }
    } catch (err: any) {
      setMysqlStatus('ERROR');
      setMysqlError(err.message || 'خطا در برقراری ارتباط با سرور.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisableMySQL = async () => {
    showToast("در این نصب، ثبت امن حساب‌ها به MySQL متصل است. پیش از جابه‌جایی سرور از دیتابیس بکاپ بگیرید.", "error");
  };

  const handleMigrateToMySQL = async () => {
    setSyncingData(true);
    setSyncMessage('در حال آماده‌سازی اطلاعات جهت انتقال...');
    try {
      const collections = [
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
        'goals', 'repairs', 'system_users', 'staff_members', 'staff_attendance', 'points_rewards', 'points_festivals', 'donations', 'wallet_transactions', 'coupons'
      ];

      for (let i = 0; i < collections.length; i++) {
        const col = collections[i];
        setSyncMessage(`در حال انتقال جدول ${col} (${i + 1}/${collections.length})...`);
        const localDataRaw = localStorage.getItem(`db_${col}`);
        if (localDataRaw) {
          try {
            const data = JSON.parse(localDataRaw);
            if (Array.isArray(data) && data.length > 0) {
              const res = await fetch('/api/mysql/seed-collection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: col, data })
              });
              if (!res.ok) {
                throw new Error("انتقال جدول " + col + " ناموفق بود.");
              }
            }
          } catch (e) {
            throw e;
          }
        }
      }
      setSyncMessage('انتقال و بذرباشی اطلاعات با موفقیت کامل شد!');
      const { triggerDatabaseRefresh } = await import('../hooks/useFirestore');
      triggerDatabaseRefresh();
      showToast('انتقال اطلاعات کلوپ با موفقیت کامل شد و کلوپ کاملاً آماده استفاده تحت پایگاه‌داده MySQL است!', 'success');
    } catch (err: any) {
      setSyncMessage('خطا در حین انتقال اطلاعات: ' + err.message);
      showToast('خطا در حین انتقال اطلاعات: ' + err.message, 'error');
    } finally {
      setSyncingData(false);
    }
  };

  const { data: sessions } = useCollection<any>('sessions');
  const { data: sales } = useCollection<any>('sales');
  const { data: purchases } = useCollection<any>('purchases');
  const { data: clientTransactions } = useCollection<any>('client_transactions');
  const { data: clients } = useCollection<any>('clients');
  const { data: products } = useCollection<any>('products');
  const { data: fixedCosts } = useCollection<any>('fixed_costs');
  const { data: shareholders } = useCollection<any>('shareholders');
  const { data: fixedExpenses } = useCollection<any>('fixed_expenses');
  const { data: promotions } = useCollection<any>('promotions');
  const { data: systemUsers } = useCollection<any>('system_users');
  const { data: staffMembers } = useCollection<any>('staff_members');
  const { data: staffAttendance } = useCollection<any>('staff_attendance');
  const { data: pointsFestivals } = useCollection<any>('points_festivals');
  const { data: pointsRewards } = useCollection<any>('points_rewards');
  const { data: consoles } = useCollection<any>('consoles');
  const { data: tariffs } = useCollection<any>('tariffs');
  const { data: reservations } = useCollection<any>('reservations');
  const { data: reports } = useCollection<any>('reports');

  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [inspectSearch, setInspectSearch] = useState('');
  const [inspectingTable, setInspectingTable] = useState<{
    id: string;
    name: string;
    title: string;
    description: string;
    count: number;
    data: any[];
    primaryKey: string;
    engine: string;
  } | null>(null);

  const handleExportSingleTableJSON = (table: { id: string; name: string; title: string; data: any[] }) => {
    try {
      const jsonString = JSON.stringify(table.data || [], null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `table_${table.id}_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(`خروجی داده‌های جدول «${table.title}» با موفقیت دریافت شد.`);
    } catch (err) {
      showToast('خطا در دریافت خروجی جدول', 'error');
    }
  };

  const handlePurgeTable = async (table: { id: string; name: string; title: string; count?: number }) => {
    const confirmName = window.prompt(
      `هشدار امنیتی انهدام داده‌ها:\nآیا از حذف و پاکسازی کامل تمامی رکوردهای جدول «${table.title}» (${table.name}) اطمینان دارید؟\nاین عملیات برگشت‌ناپذیر بوده و کلیه رکوردهای موجود در این جدول برای همیشه منهدم خواهند شد.\n\nبرای تأیید نهایی، عبارت "تایید" یا نام جدول (${table.name}) را بنویسید:`
    );
    if (confirmName === 'تایید' || confirmName === table.name) {
      try {
        await clearCollection(table.name);
        showToast(`کلیه رکوردهای جدول «${table.title}» با موفقیت منهدم و پاکسازی شدند.`, 'success');
        if (inspectingTable && inspectingTable.name === table.name) {
          setInspectingTable(null);
        }
      } catch (err: any) {
        showToast('خطا در پاکسازی جدول: ' + (err.message || 'خطای سرور'), 'error');
      }
    }
  };

  const handleDeleteSingleRecord = async (tableName: string, recordId: string) => {
    if (window.confirm(`آیا از انهدام و حذف کامل این فاکتور / رکورد (شناسه: ${recordId}) از پایگاه داده اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`)) {
      try {
        await remove(tableName, recordId);
        showToast('رکورد موردنظر با موفقیت از پایگاه داده حذف گردید.', 'success');
        if (inspectingTable && inspectingTable.name === tableName) {
          const updated = inspectingTable.data.filter((it: any) => String(it.id) !== String(recordId));
          setInspectingTable({
            ...inspectingTable,
            data: updated,
            count: updated.length
          });
        }
      } catch (err: any) {
        showToast('خطا در حذف رکورد: ' + (err.message || 'خطای شبکه'), 'error');
      }
    }
  };

  const dbTablesList = useMemo(() => [
    {
      id: 'consoles',
      name: 'consoles',
      title: 'دستگاه‌ها و کنسول‌ها',
      description: 'کنسول‌های بازی (PS5، PS4، Xbox، PC، VR)، وضعیت اتصال و تعداد دسته‌ها',
      count: consoles?.length || 0,
      data: consoles || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Gamepad2,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400'
    },
    {
      id: 'tariffs',
      name: 'tariffs',
      title: 'تعرفه‌های قیمتی و زمانی',
      description: 'نرخ ساعتی دستگاه‌ها، دسته‌های اضافه، حالت دونفره/چهارنفره و بازی‌های خاص',
      count: tariffs?.length || 0,
      data: tariffs || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: BadgePercent,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400'
    },
    {
      id: 'sessions',
      name: 'sessions',
      title: 'فاکتورها و سوابق نشست‌های بازی',
      description: 'سوابق نشست‌های بازی، فاکتورهای صادره کنسول‌ها، زمان بازی و اقلام مصرفی بوفه در نشست',
      count: sessions?.length || 0,
      data: sessions || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: PlayCircle,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400'
    },
    {
      id: 'sales',
      name: 'sales',
      title: 'فاکتورهای فروش مستقیم و بوفه',
      description: 'فروش سریع بارکدی، فاکتورهای دستی، فروش بوفه خارج از کنسول و پرداخت‌های نقدی/کارت',
      count: sales?.length || 0,
      data: sales || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: ShoppingCart,
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400'
    },
    {
      id: 'purchases',
      name: 'purchases',
      title: 'فاکتورها و اسناد خرید اقلام بوفه و مواد اولیه',
      description: 'اسناد خرید بوفه، دانه قهوه و مواد اولیه انبار، تعداد و مبالغ خرید از تأمین‌کنندگان',
      count: purchases?.length || 0,
      data: purchases || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Package,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400'
    },
    {
      id: 'clients',
      name: 'clients',
      title: 'مشتریان و اعضای کلوپ',
      description: 'پرونده اعضا، شماره تلفن، کیف پول، سوابق بازی، اعتبارات و سطوح وفاداری',
      count: clients?.length || 0,
      data: clients || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Users,
      color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/60 dark:text-violet-400'
    },
    {
      id: 'client_transactions',
      name: 'client_transactions',
      title: 'تراکنش‌ها و شارژ کیف پول اعضا',
      description: 'سوابق شارژ حساب، بدهی‌ها، تسویه‌حساب‌ها و گردش مالی کیف پول مشتریان',
      count: clientTransactions?.length || 0,
      data: clientTransactions || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400'
    },
    {
      id: 'products',
      name: 'products',
      title: 'بوفه کالاها، انبار و مواد اولیه',
      description: 'اقلام خوراکی، نوشیدنی‌ها، دانه‌های قهوه گرمی، موجودی انبار، قیمت خرید و قیمت فروش',
      count: products?.length || 0,
      data: products || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: HardDrive,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400'
    },
    {
      id: 'reservations',
      name: 'reservations',
      title: 'رزروهای آینده کنسول‌ها',
      description: 'رزروهای ثبت‌شده برای دستگاه‌ها، ساعت‌های رزرو شده و تلفن رزروکننده',
      count: reservations?.length || 0,
      data: reservations || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Calendar,
      color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-400'
    },
    {
      id: 'reports',
      name: 'reports',
      title: 'گزارش‌های ذخیره‌شده مالی',
      description: 'سوابق تسویه‌حساب‌ها و آرشیو گزارش‌های بسته‌شده دوره‌ای کلوپ',
      count: reports?.length || 0,
      data: reports || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: TrendingUp,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400'
    },
    {
      id: 'system_users',
      name: 'system_users',
      title: 'کاربران و پرسنل سیستم',
      description: 'حساب‌های کاربری مدیران، اپراتورها، نام کاربری، رمز عبور و سطح دسترسی',
      count: systemUsers?.length || 0,
      data: systemUsers || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Shield,
      color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-400'
    },
    {
      id: 'staff_members',
      name: 'staff_members',
      title: 'پرسنل',
      description: 'فهرست کارکنان و اطلاعات شغلی آن‌ها',
      count: staffMembers?.length || 0,
      data: staffMembers || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Users,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400'
    },
    {
      id: 'staff_attendance',
      name: 'staff_attendance',
      title: 'حضور و غیاب پرسنل',
      description: 'سوابق ثبت ورود و خروج و ساعت کاری',
      count: staffAttendance?.length || 0,
      data: staffAttendance || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Clock,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400'
    },
    {
      id: 'promotions',
      name: 'promotions',
      title: 'طرح‌های تشویقی و تخفیف',
      description: 'کدهای تخفیف، تخفیف‌های زمان‌بندی‌شده، ساعات خلوتی و جشنواره‌ها',
      count: promotions?.length || 0,
      data: promotions || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Gift,
      color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/60 dark:text-pink-400'
    },
    {
      id: 'points_rewards',
      name: 'points_rewards',
      title: 'جوایز و باشگاه وفاداری',
      description: 'جوایز کلوپ وفاداری، جشنواره‌های ضریب امتیاز و سوابق اعطای پاداش',
      count: (pointsRewards?.length || 0) + (pointsFestivals?.length || 0),
      data: pointsRewards && pointsRewards.length > 0 ? pointsRewards : pointsFestivals || [],
      primaryKey: 'id (String / UUID)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: Award,
      color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/60 dark:text-orange-400'
    },
    {
      id: 'settings',
      name: 'settings',
      title: 'پیکربندی و تنظیمات مرکزی',
      description: 'تنظیمات نام فروشگاه، تم‌های صفحات، هشدارهای زمان و پارامترهای کلیدی',
      count: settingsList?.length || 0,
      data: settingsList || [],
      primaryKey: 'id (Singleton)',
      engine: mysqlEnabled ? 'InnoDB (MySQL)' : 'LocalStore / Cloud Firestore',
      icon: SettingsIcon,
      color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
    }
  ], [consoles, tariffs, sessions, clients, purchases, clientTransactions, products, reservations, reports, sales, systemUsers, staffMembers, staffAttendance, promotions, pointsRewards, pointsFestivals, settingsList, mysqlEnabled]);

  const filteredDbTables = useMemo(() => {
    if (!dbSearchTerm.trim()) return dbTablesList;
    const term = dbSearchTerm.trim().toLowerCase();
    return dbTablesList.filter(t => 
      t.name.toLowerCase().includes(term) ||
      t.title.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term)
    );
  }, [dbTablesList, dbSearchTerm]);

  const totalDatabaseRecords = useMemo(() => {
    return dbTablesList.reduce((acc, t) => acc + t.count, 0);
  }, [dbTablesList]);

  const filteredSystemUsers = useMemo(() => {
    if (!systemUsers) return [];
    return systemUsers.filter((user: any) => {
      const term = userSearchTerm.trim().toLowerCase();
      if (!term) return true;
      const fn = String(user.fullName || '').toLowerCase();
      const un = String(user.username || '').toLowerCase();
      const ph = String(user.phone || '').toLowerCase();
      const rl = (user.role === 'admin' ? 'مدیر سیستم admin' : user.role === 'operator' ? 'اپراتور کلوپ operator' : 'مشتری کلاینت client').toLowerCase();
      return fn.includes(term) || un.includes(term) || ph.includes(term) || rl.includes(term);
    });
  }, [systemUsers, userSearchTerm]);

  const THEME_PRESETS = [
    { id: 'default', label: 'کلاسیک کلوپ', primary: '#4f46e5', secondary: '#818cf8', accent: '#c7d2fe' },
    { id: 'emerald', label: 'سبز زمرد', primary: '#059669', secondary: '#10b981', accent: '#d1fae5' },
    { id: 'amber', label: 'خورشیدی', primary: '#d97706', secondary: '#f59e0b', accent: '#fef3c7' },
    { id: 'rose', label: 'رز مدرن', primary: '#e11d48', secondary: '#fb7185', accent: '#ffe4e6' },
    { id: 'violet', label: 'بنفش لوکس', primary: '#7c3aed', secondary: '#a78bfa', accent: '#ede9fe' },
    { id: 'dark', label: 'شوالیه تاریکی', primary: '#1e293b', secondary: '#475569', accent: '#f1f5f9' }
  ];

  const PAGES = [
    { id: 'consoles', label: 'میز کار و کنسول' },
    { id: 'products', label: 'بوفه و فروشگاه' },
    { id: 'reports', label: 'گزارشات و تحلیل' },
    { id: 'clients', label: 'لیست مشتریان' },
    { id: 'stocks', label: 'حسابداری و سود' }
  ];

  const exportData = async () => {
    try {
      const data = await apiRequest("/api/backup");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "backup_" + new Date().toISOString().slice(0,10) + ".json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleAutoBackupChange = async (enabled: boolean) => {
    const previous = form.autoBackup !== false;
    setForm(current => ({ ...current, autoBackup: enabled }));
    setSavingAutoBackup(true);
    try {
      if (settingsList?.length) {
        await update('settings', settingsList[0].id, { autoBackup: enabled });
      } else {
        await add('settings', { ...form, autoBackup: enabled });
      }
      showToast(enabled ? 'پشتیبان‌گیری خودکار روزانه روشن شد.' : 'پشتیبان‌گیری خودکار خاموش شد.', 'success');
    } catch (err: any) {
      setForm(current => ({ ...current, autoBackup: previous }));
      showToast('ذخیره تنظیم بکاپ ناموفق بود: ' + (err.message || 'خطای پایگاه داده'), 'error');
    } finally {
      setSavingAutoBackup(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const resultText = event.target?.result as string;
        if (!resultText) throw new Error('فایل بکاپ خالی است');
        
        const backup = JSON.parse(resultText);
        
        let dataToImport: Record<string, any> = {};
        if (backup && typeof backup === 'object') {
          if (backup.data && typeof backup.data === 'object' && !Array.isArray(backup.data)) {
            dataToImport = backup.data;
          } else {
            dataToImport = backup;
          }
        } else {
          throw new Error('فرمت فایل بکاپ نامعتبر است');
        }

        const getLength = (val: any) => {
          if (Array.isArray(val)) return val.length;
          if (val && typeof val === 'object') return 1;
          return 0;
        };

        let clientsCount = 0;
        let salesCount = 0;
        let sessionsCount = 0;
        let productsCount = 0;
        let settingsFound = false;
        
        let purchasesCount = 0;
        let promotionsCount = 0;
        let shareholdersCount = 0;
        let goalsCount = 0;
        let reservationsCount = 0;

        Object.keys(dataToImport).forEach(key => {
          const lowerKey = key.toLowerCase().replace('db_', '');
          const val = dataToImport[key];
          const count = getLength(val);

          if (lowerKey === 'clients' || lowerKey === 'users') clientsCount = count;
          else if (lowerKey === 'sales' || lowerKey === 'quicksales') salesCount = count;
          else if (lowerKey === 'sessions') sessionsCount = count;
          else if (lowerKey === 'products') productsCount = count;
          else if (lowerKey === 'purchases') purchasesCount = count;
          else if (lowerKey === 'promotions') promotionsCount = count;
          else if (lowerKey === 'shareholders' || lowerKey === 'partners') shareholdersCount = count;
          else if (lowerKey === 'goals') goalsCount = count;
          else if (lowerKey === 'reservations') reservationsCount = count;
          else if (lowerKey === 'settings' || lowerKey === 'systemsettings') settingsFound = true;
        });

        if (clientsCount === 0 && salesCount === 0 && sessionsCount === 0 && productsCount === 0 && !settingsFound) {
          // If none matched directly, let's look closer at keys to see if we have valid arrays inside
          let totalItemsFound = 0;
          Object.keys(dataToImport).forEach(k => {
            if (Array.isArray(dataToImport[k])) {
              totalItemsFound += dataToImport[k].length;
            }
          });
          if (totalItemsFound === 0) {
            throw new Error('هیچ داده معتبری در این فایل یافت نشد');
          }
        }

        setRestoreSummary({
          clientsCount,
          salesCount,
          sessionsCount,
          productsCount,
          settingsFound,
          purchasesCount,
          promotionsCount,
          shareholdersCount,
          goalsCount,
          reservationsCount
        });
        setParsedRestoreData(dataToImport);
        setRestoreSuccess(false);
        setShowRestoreModal(true);
      } catch (err) {
        showToast('خطا در خواندن یا پردازش فایل بکاپ: ' + (err instanceof Error ? err.message : 'فرمت نامعتبر'), 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const confirmRestoreData = async () => {
    if (!parsedRestoreData) return;
    try {
      await apiRequest("/api/restore", { method: "POST", body: JSON.stringify({ data: parsedRestoreData }) });
      setRestoreSuccess(true); setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const [newFixedTitle, setNewFixedTitle] = useState('');
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);

  const [newPromo, setNewPromo] = useState({ name: '', discountPercentage: 0, startDate: '', endDate: '', isActive: true });
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);

  const handleAddPromo = async () => {
    if (!newPromo.name || !newPromo.startDate || !newPromo.endDate) return;
    if (editingPromoId) {
      await update('promotions', editingPromoId, newPromo);
      setEditingPromoId(null);
    } else {
      await add('promotions', newPromo);
    }
    setNewPromo({ name: '', discountPercentage: 0, startDate: '', endDate: '', isActive: true });
  };

  const handleEditPromo = (promo: any) => {
    setEditingPromoId(promo.id);
    setNewPromo({
      name: promo.name,
      discountPercentage: promo.discountPercentage,
      startDate: promo.startDate.split('T')[0],
      endDate: promo.endDate.split('T')[0],
      isActive: promo.isActive
    });
  };

  const handleDeletePromo = async (id: string) => {
    setDeleteConfirm({ id, type: 'promo' });
  };

  const handleTogglePromo = async (promo: any) => {
    await update('promotions', promo.id, { isActive: !promo.isActive });
  };

  const handleAddFixed = async () => {
    if (!newFixedTitle) return;
    if (editingFixedId) {
      await update('fixed_expenses', editingFixedId, { title: newFixedTitle });
      setEditingFixedId(null);
    } else {
      await add('fixed_expenses', { title: newFixedTitle, createdAt: new Date().toISOString() });
    }
    setNewFixedTitle('');
  };

  const handleEditFixed = (exp: any) => {
    setEditingFixedId(exp.id);
    setNewFixedTitle(exp.title);
  };

  const handleDeleteFixed = async (id: string) => {
    setDeleteConfirm({ id, type: 'fixed' });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormUsername.trim() || !userFormFullName.trim()) {
      showToast('لطفا اطلاعات نام کاربری و نام کامل را وارد نمائید.', 'error');
      return;
    }

    let finalClientId = userFormRole === 'client' ? userFormClientId : '';

    try {
      if (userFormRole === 'client') {
        if (finalClientId) {
          // Update linked client with synced details
          await update('clients', finalClientId, {
            name: userFormFullName.trim(),
            username: userFormUsername.trim(),
            phone: userFormPhone.trim() || userFormUsername.trim()
          });
        } else {
          // Check if matching client exists
          const cleanUser = userFormUsername.toLowerCase().trim();
          const cleanPhone = userFormPhone.trim();
          const cleanName = userFormFullName.toLowerCase().trim();

          const matchedClient = clients?.find((c: any) => {
            const cUser = (c.username || '').toLowerCase().trim();
            const cPhone = (c.phone || '').trim();
            const cName = (c.name || '').toLowerCase().trim();
            return (cUser && cUser === cleanUser) ||
                   (cPhone && (cPhone === cleanUser || cPhone === cleanPhone)) ||
                   (cName && cName === cleanName);
          });

          if (matchedClient) {
            finalClientId = matchedClient.id;
            await update('clients', matchedClient.id, {
              name: userFormFullName.trim(),
              username: userFormUsername.trim(),
              phone: userFormPhone.trim() || matchedClient.phone
            });
          } else {
            // Auto-create client profile so user and client are unified
            const newClientRes: any = await add('clients', {
              name: userFormFullName.trim(),
              username: userFormUsername.trim(),
              phone: userFormPhone.trim() || userFormUsername.trim(),
              balance: 0,
              points: 10,
              totalPlayTime: 0,
              totalPaid: 0,
              tier: 'bronze'
            });
            finalClientId = newClientRes?.id || newClientRes;
          }
        }
      }

      const userData = {
        username: userFormUsername.trim(),
        fullName: userFormFullName.trim(),
        password: userFormPassword || undefined,
        role: userFormRole,
        phone: userFormPhone.trim(),
        isActive: userFormIsActive,
        clientId: finalClientId,
        createdAt: new Date().toISOString()
      };

      if (userEditingId) {
        await update('system_users', userEditingId, userData);
        showToast('کاربر سیستم و پرونده مشتری متصل با موفقیت بروزرسانی شد.', 'success');
      } else {
        // Check if username already exists
        const exists = systemUsers?.some((u: any) => u.username.toLowerCase() === userFormUsername.toLowerCase().trim());
        if (exists) {
          showToast('این نام کاربری از قبل در سیستم ثبت شده است.', 'error');
          return;
        }
        await add('system_users', userData);
        showToast('کاربر سیستم جدید و پرونده مشتری همگام با موفقیت اضافه شد.', 'success');
      }
      resetUserForm();
    } catch (err: any) {
      showToast('خطا در ثبت کاربر: ' + (err.message || 'خطای پایگاه داده'), 'error');
    }
  };

  const handleEditUser = (user: any) => {
    setUserEditingId(user.id);
    setUserFormUsername(user.username);
    setUserFormFullName(user.fullName || '');
    setUserFormPassword('');
    setUserFormRole(user.role || 'operator');
    setUserFormPhone(user.phone || '');
    setUserFormIsActive(user.isActive !== false);
    setUserFormClientId(user.clientId || '');
    setUserFormOpen(true);
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
  };

  const handleSaveFestival = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!festTitle.trim()) {
      showToast('لطفا عنوان جشنواره امتیازدهی را وارد کنید.', 'error');
      return;
    }
    const payload = {
      title: festTitle.trim(),
      description: festDescription.trim(),
      points: isNaN(Number(festPoints)) ? festPoints : Number(festPoints),
      isActive: festIsActive,
      isFixed: festIsFixed,
      createdAt: new Date().toISOString()
    };
    try {
      if (festEditingId) {
        await update('points_festivals', festEditingId, payload);
        showToast('جشنواره امتیازدهی با موفقیت بروزرسانی شد.', 'success');
      } else {
        await add('points_festivals', payload);
        showToast('جشنواره امتیازدهی جدید با موفقیت ایجاد شد.', 'success');
      }
      setFestTitle('');
      setFestDescription('');
      setFestPoints('15');
      setFestIsActive(true);
      setFestIsFixed(false);
      setFestEditingId(null);
      setFestFormOpen(false);
    } catch (err: any) {
      showToast('خطا در ذخیره‌سازی جشنواره امتیازدهی: ' + err.message, 'error');
    }
  };

  const handleDeleteFestival = async (id: string) => {
    try {
      await remove('points_festivals', id);
      showToast('جشنواره با موفقیت حذف شد.', 'success');
    } catch (err: any) {
      showToast('خطا در حذف جشنواره: ' + err.message, 'error');
    }
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim()) {
      showToast('لطفا عنوان جایزه را وارد کنید.', 'error');
      return;
    }
    const payload = {
      title: rewardTitle.trim(),
      description: rewardDescription.trim(),
      cost: Number(rewardCost) || 20,
      type: rewardType,
      value: rewardType === 'wallet_cashback' ? Number(rewardValue) : rewardValue,
      isActive: rewardIsActive,
      createdAt: new Date().toISOString()
    };
    try {
      if (rewardEditingId) {
        await update('points_rewards', rewardEditingId, payload);
        showToast('جایزه با موفقیت بروزرسانی شد.', 'success');
      } else {
        await add('points_rewards', payload);
        showToast('جایزه کلوپ جدید با موفقیت ایجاد شد.', 'success');
      }
      setRewardTitle('');
      setRewardDescription('');
      setRewardCost('20');
      setRewardType('wallet_cashback');
      setRewardValue('10000');
      setRewardIsActive(true);
      setRewardEditingId(null);
      setRewardFormOpen(false);
    } catch (err: any) {
      showToast('خطا در ذخیره جایزه: ' + err.message, 'error');
    }
  };

  const handleDeleteReward = async (id: string) => {
    try {
      await remove('points_rewards', id);
      showToast('جایزه با موفقیت از سیستم حذف شد.', 'success');
    } catch (err: any) {
      showToast('خطا در حذف جایزه: ' + err.message, 'error');
    }
  };

  const handleTogglePermission = async (role: string, path: string) => {
    if (['admin', 'operator', 'client'].includes(role)) {
      showToast('امکان ویرایش دسترسی‌های نقش‌های اصلی و پیش‌فرض سیستم (مدیر، اپراتور، مشتری) مجاز نمی‌باشد.', 'error');
      return;
    }
    const current = permissions[role] || [];
    const updated = current.includes(path) 
      ? current.filter(p => p !== path) 
      : [...current, path];
    
    const nextPermissions = {
      ...permissions,
      [role]: updated
    };
    
    setPermissions(nextPermissions);
    
    const updatedForm = {
      ...form,
      rolePermissions: nextPermissions
    };
    setForm(updatedForm);
    
    try {
      if (settingsList && settingsList.length > 0) {
        await update('settings', settingsList[0].id, updatedForm);
      } else {
        await add('settings', updatedForm);
      }
      showToast('سطح دسترسی نقش با موفقیت اصلاح گردید.', 'success');
    } catch (e) {
      showToast('خطا در ذخیره‌سازی دسترسی نقش', 'error');
    }
  };

  const handleCreateOrUpdateRole = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const cleanKey = roleFormKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanLabel = roleFormLabel.trim();
    
    if (!cleanLabel) {
      showToast('لطفا عنوان فارسی نقش را وارد کنید.', 'error');
      return;
    }

    let nextPermissions = { ...permissions };
    let nextLabels = { ...((form as any)?.roleLabels || {}) };

    if (roleEditingKey) {
      if (['admin', 'operator', 'client'].includes(roleEditingKey)) {
        showToast('ویرایش عنوان نقش‌های سیستمی پیش‌فرض کلوپ مجاز نیست.', 'error');
        return;
      }
      // Editing Label of an existing key
      nextLabels[roleEditingKey] = cleanLabel;
    } else {
      // Creating a new role
      if (!cleanKey) {
        showToast('لطفا شناسه انگلیسی معتبری وارد کنید.', 'error');
        return;
      }
      if (permissions[cleanKey]) {
        showToast('این شناسه نقش از قبل تعریف شده است.', 'error');
        return;
      }
      nextPermissions[cleanKey] = ['/']; // default to allow home
      nextLabels[cleanKey] = cleanLabel;
    }

    const updatedForm = {
      ...form,
      rolePermissions: nextPermissions,
      roleLabels: nextLabels
    };

    setForm(updatedForm);
    setPermissions(nextPermissions);

    try {
      if (settingsList && settingsList.length > 0) {
        await update('settings', settingsList[0].id, updatedForm);
      } else {
        await add('settings', updatedForm);
      }
      showToast(roleEditingKey ? 'عنوان نقش کاربری بروزرسانی شد.' : 'نقش کاربری جدید با موفقیت ایجاد شد.', 'success');
      setSelectedRole(roleEditingKey || cleanKey);
      
      // reset states
      setRoleFormOpen(false);
      setRoleFormKey('');
      setRoleFormLabel('');
      setRoleEditingKey(null);
    } catch (err: any) {
      showToast('خطا در ذخیره‌سازی اطلاعات نقش جدید: ' + err.message, 'error');
    }
  };

  const handleDeleteRole = async (roleKey: string) => {
    if (['admin', 'operator', 'client'].includes(roleKey)) {
      showToast('حذف نقش‌های سیستمی پیش‌فرض کلوپ مجاز نیست.', 'error');
      return;
    }

    const isAssigned = systemUsers?.some((user: any) => user.role === roleKey);
    if (isAssigned) {
      showToast('این نقش به برخی کاربران فعال سیستم متصل است. ابتدا نقش آن کاربران را تغییر دهید.', 'error');
      return;
    }

    let nextPermissions = { ...permissions };
    delete nextPermissions[roleKey];

    let nextLabels = { ...((form as any)?.roleLabels || {}) };
    delete nextLabels[roleKey];

    const updatedForm = {
      ...form,
      rolePermissions: nextPermissions,
      roleLabels: nextLabels
    };

    setForm(updatedForm);
    setPermissions(nextPermissions);

    if (selectedRole === roleKey) {
      setSelectedRole('admin');
    }

    try {
      if (settingsList && settingsList.length > 0) {
        await update('settings', settingsList[0].id, updatedForm);
      } else {
        await add('settings', updatedForm);
      }
      showToast('نقش کاربری مربوطه با موفقیت حذف گردید.', 'success');
      setRoleToDelete(null);
    } catch (err: any) {
      showToast('خطا در حذف نقش کاربری در پایگاه‌داده: ' + err.message, 'error');
    }
  };

  const resetUserForm = () => {
    setUserEditingId(null);
    setUserFormUsername('');
    setUserFormFullName('');
    setUserFormPassword('');
    setUserFormRole('operator');
    setUserFormPhone('');
    setUserFormIsActive(true);
    setUserFormClientId('');
    setUserFormOpen(false);
  };

  useEffect(() => {
    if (settingsList && settingsList.length > 0) {
      setForm(settingsList[0]);
    }
  }, [settingsList]);

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      if (settingsList && settingsList.length > 0) {
        await update('settings', settingsList[0].id, form);
      } else {
        await add('settings', form);
      }
      showToast('تنظیمات با موفقیت ذخیره شد.', 'success');
    } catch (err: any) {
      showToast('خطا در ذخیره تنظیمات: ' + (err.message || 'خطای پایگاه داده'), 'error');
    }
  };

  const clearData = async () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('db_')) {
        localStorage.removeItem(key);
      }
    });
    setClearSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const sections = [
    { id: 'general', label: 'اطلاعات عمومی', icon: Globe },
    { id: 'promotions', label: 'طرح‌های تشویقی', icon: Gift },
    { id: 'loyalty', label: 'کلوپ وفاداری', icon: Award },
    { id: 'finance', label: 'امور مالی', icon: BadgePercent },
    { id: 'database', label: 'دیتابیس و پشتیبان‌گیری', icon: Database },
    { id: 'users', label: 'مدیریت کاربران', icon: Users },
  ];

  return (
    <div className="p-4 md:p-8 font-sans text-right pb-32 bg-[#f8fafc] dark:bg-slate-950/20 min-h-screen" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="w-full">
          <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
              >
                  {activeTab === 'general' && (
                    <div className="space-y-6">
                      {/* Identity & Branding Card */}
                      <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl">
                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
                        
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-450 rounded-2xl flex items-center justify-center shadow-inner">
                            <Building size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">هویت کلوپ و گیم‌نت</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">شخصی‌سازی مشخصات تجاری، واحد پولی و نماد باشگاه</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5 text-right">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1">نام باشگاه / کلوپ</label>
                            <Input 
                              value={form.storeName}
                              onChange={e => setForm({...form, storeName: e.target.value})}
                              className="h-12 font-bold bg-slate-50/50 dark:bg-slate-950/45 focus:bg-white dark:focus:bg-slate-905 border-slate-100 dark:border-slate-800"
                            />
                          </div>

                          <div className="space-y-1.5 text-right">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1">واحد پولی سیستم</label>
                            <Input 
                              value={form.currency}
                              onChange={e => setForm({...form, currency: e.target.value})}
                              className="h-12 font-bold bg-slate-50/50 dark:bg-slate-950/45 focus:bg-white dark:focus:bg-slate-905 border-slate-100 dark:border-slate-800"
                            />
                          </div>

                          <div className="space-y-1.5 text-right">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1">شماره تلفن مرکزی kلوپ</label>
                            <Input 
                              type="tel"
                              value={form.contactPhone}
                              onChange={e => setForm({...form, contactPhone: e.target.value})}
                              className="h-12 font-bold bg-slate-50/50 dark:bg-slate-950/45 focus:bg-white dark:focus:bg-slate-905 border-slate-100 dark:border-slate-800"
                              placeholder="مثال: ۰۲۱۱۲۳۴۵۶"
                            />
                          </div>

                          <div className="space-y-1.5 text-right">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1">درصد مالیات بر ارزش افزوده (%)</label>
                            <Input 
                              type="number"
                              value={String(form.taxRate)}
                              onChange={e => setForm({...form, taxRate: Number(e.target.value)})}
                              className="h-12 font-bold bg-slate-50/50 dark:bg-slate-950/45 focus:bg-white dark:focus:bg-slate-905 border-slate-100 dark:border-slate-800"
                            />
                          </div>

                          <div className="space-y-1.5 text-right md:col-span-2">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1">هدف درآمد ماهیانه باشگاه (تومان)</label>
                            <Input 
                              type="number"
                              value={String(form.monthlySalesTarget || 10000000)}
                              onChange={e => setForm({...form, monthlySalesTarget: Number(e.target.value)})}
                              className="h-12 font-bold bg-slate-50/50 dark:bg-slate-950/45 focus:bg-white dark:focus:bg-slate-905 border-slate-100 dark:border-slate-800"
                            />
                          </div>
                        </div>

                        {/* Interactive Logo Config Dropzone */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-8">
                          <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-3 block mr-1">نشانه و لوگوی اختصاصی باشگاه</label>
                          <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-3xl p-6 border-2 border-dashed border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row items-center gap-6 group hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                            {form.logo ? (
                              <div className="relative group/logo w-24 h-24 rounded-2xl overflow-hidden border-2 border-indigo-500/20 shadow-md flex-shrink-0 bg-white dark:bg-slate-900">
                                <img src={form.logo} alt="Club Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                                <button
                                  type="button"
                                  onClick={() => setForm(prev => ({ ...prev, logo: '' }))}
                                  className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center text-white"
                                  title="حذف این لوگو"
                                >
                                  <Trash2 size={22} className="text-rose-500" />
                                </button>
                              </div>
                            ) : (
                              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-205 dark:border-slate-800 flex items-center justify-center flex-shrink-0 bg-white dark:bg-slate-900/60 text-slate-400 dark:text-slate-650">
                                <Globe size={28} />
                              </div>
                            )}

                            <div className="flex-1 w-full text-right">
                              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 leading-relaxed mb-4">
                                اندازه مطلوب نشانه حداکثر ۸۰۰ کیلوبایت است. این نشانه در صفحات مانیتور کنسول‌ها، پنل مشتری و فاکتور چاپی اعمال خواهد شد.
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-3">
                                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-950/45 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-100/80 dark:border-indigo-900/80 text-indigo-700 dark:text-indigo-400 rounded-xl cursor-pointer transition-all text-xs font-black shadow-sm">
                                  <Upload size={14} />
                                  <span>انتخاب تصویر نشانه</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 800000) {
                                          showToast("اندازه فایل باید حداکثر ۸۰۰ کیلوبایت باشد.", "error");
                                          return;
                                        }
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          setForm(prev => ({ ...prev, logo: reader.result as string }));
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                                
                                {form.logo && (
                                  <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, logo: '' }))}
                                    className="text-xs text-rose-500 dark:text-rose-400 font-black hover:underline"
                                  >
                                    پاکسازی تصویر و ریست به حالت پیش‌فرض
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Physical Address Section */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-8">
                          <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-3.5 block mr-1 flex items-center gap-1.5">
                            <MapPin size={15} className="text-indigo-500" />
                            <span>نشانی پورتال (آدرس فیزیکی باشگاه)</span>
                          </label>
                          <textarea 
                            rows={3}
                            className="w-full px-5 py-4 bg-slate-50/50 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-800 rounded-2xl focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-905 outline-none transition-all duration-200 text-sm resize-none font-bold text-right dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-4 focus:ring-indigo-500/10"
                            value={form.address || ''}
                            onChange={e => setForm({...form, address: e.target.value})}
                            placeholder="نشانی کامل به همراه جزئیات ساختمان جهت نمایش در پایین برگ فاکتور نهایی..."
                          />
                        </div>

                        {/* Save Button for General Settings at Card Bottom */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-6 flex justify-end">
                          <Button 
                            onClick={handleSave} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-11 px-6 rounded-xl shadow-md flex items-center gap-2"
                          >
                            <Save size={16} />
                            <span>ذخیره تغییرات عمومی کلوپ</span>
                          </Button>
                        </div>
                      </Card>

                      {/* Day Reset & Operational Shift Hour Card */}
                      <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl text-right" dir="rtl">
                        <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
                        
                        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shadow-inner">
                              <Moon size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">ساعت تغییر روز کاری و بستن شیفت شبانه</h3>
                              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">تعیین ساعت مبنا برای انتقال آمار، تراکنش‌ها و نمودارهای درآمدی به روز جدید</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-amber-50/70 dark:bg-amber-950/40 px-3.5 py-1.5 rounded-xl border border-amber-200/60 dark:border-amber-900/50">
                            <Clock size={15} className="text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                              ساعت انتقال فعال: {String(form.dayResetHour ?? 0).padStart(2, '0')}:{String(form.dayResetMinute ?? 0).padStart(2, '0')}
                            </span>
                          </div>
                        </div>

                        {/* Explanation Note */}
                        <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-4 mb-6 flex items-start gap-3.5">
                          <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed space-y-1">
                            <p className="font-bold text-slate-800 dark:text-slate-200">
                              کاربرد در گیم‌نت و کلوپ‌های شبانه‌روزی:
                            </p>
                            <p>
                              در حالت عادی (ساعت ۰۰:۰۰)، با عبور از نیمه‌شب تراکنش‌ها به روز تقویمی بعد منتقل می‌شوند. اگر کلوپ شما تا بامداد (مثلاً ۱ یا ۲ یا ۵ صبح) باز است، با تنظیم ساعت شروع روز جدید بر روی ساعت خروج شبانه، کلیه فاکتورها، نشست‌ها و خریدهای بوفه تا قبل از آن ساعت برای <strong>همان روز کاری (شیفت شب گذشته)</strong> محاسبه شده و با آمدن فردا قاطی نخواهند شد.
                            </p>
                          </div>
                        </div>

                        {/* Preset Quick Select Buttons */}
                        <div className="mb-6">
                          <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-3 block mr-1">
                            انتخاب سریع زمان بستن شیفت روزانه:
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                            {[
                              { label: '۱۲ نیمه‌شب (۰۰:۰۰)', hour: 0, minute: 0, desc: 'حالت استاندارد' },
                              { label: '۱:۰۰ بامداد', hour: 1, minute: 0, desc: 'شیفت شب ۱ صبح' },
                              { label: '۲:۰۰ بامداد', hour: 2, minute: 0, desc: 'شیفت شب ۲ صبح' },
                              { label: '۳:۰۰ بامداد', hour: 3, minute: 0, desc: 'شیفت شب ۳ صبح' },
                              { label: '۴:۰۰ بامداد', hour: 4, minute: 0, desc: 'شیفت شب ۴ صبح' },
                              { label: '۵:۰۰ بامداد', hour: 5, minute: 0, desc: 'شیفت صبحگاهی' },
                            ].map(preset => {
                              const isSelected = (form.dayResetHour ?? 0) === preset.hour && (form.dayResetMinute ?? 0) === preset.minute;
                              return (
                                <button
                                  key={`${preset.hour}-${preset.minute}`}
                                  type="button"
                                  onClick={() => setForm({ ...form, dayResetHour: preset.hour, dayResetMinute: preset.minute })}
                                  className={cn(
                                    "p-3 rounded-2xl border text-right transition-all flex flex-col justify-between",
                                    isSelected
                                      ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-1 ring-amber-400 shadow-sm"
                                      : "border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-100/70 dark:hover:bg-slate-900/50"
                                  )}
                                >
                                  <span className={cn("text-xs font-black", isSelected ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-slate-200")}>
                                    {preset.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                                    {preset.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom Select / Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/60 dark:bg-slate-950/30 p-5 rounded-2xl border border-slate-150 dark:border-slate-800/80">
                          <div className="space-y-2 text-right">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1 flex items-center gap-1.5">
                              <Clock size={15} className="text-amber-500" />
                              <span>ساعت انتقال به روز بعد (۰ تا ۲۳)</span>
                            </label>
                            <select
                              value={form.dayResetHour ?? 0}
                              onChange={e => setForm({ ...form, dayResetHour: Number(e.target.value) })}
                              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                            >
                              {Array.from({ length: 24 }).map((_, i) => (
                                <option key={i} value={i}>
                                  ساعت {String(i).padStart(2, '0')}:00 {i === 0 ? '(۱۲ شب - پیش‌فرض تقویمی)' : i < 6 ? `(${i} بامداد - شیفت شبانه کلوپ)` : i < 12 ? `(${i} صبح)` : i === 12 ? '(۱۲ ظهر)' : `(${i - 12} بعدازظهر)`}
                                </option>
                              ))}
                            </select>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              تا قبل از رسیدن به این ساعت در بامداد، تمام دخل و خروج‌ها برای دیروز حساب می‌شوند.
                            </p>
                          </div>

                          <div className="space-y-2 text-right">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1 flex items-center gap-1.5">
                              <Clock size={15} className="text-amber-500" />
                              <span>دقیقه انتقال به روز بعد (۰ تا ۵۹)</span>
                            </label>
                            <select
                              value={form.dayResetMinute ?? 0}
                              onChange={e => setForm({ ...form, dayResetMinute: Number(e.target.value) })}
                              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                            >
                              {[0, 15, 30, 45].map(min => (
                                <option key={min} value={min}>
                                  دقیقه {String(min).padStart(2, '0')}
                                </option>
                              ))}
                            </select>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              دقیقه دقیق تحویل شیفت و ریست شدن روز آماری.
                            </p>
                          </div>
                        </div>

                        {/* Save Action for Day Reset */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-6 flex justify-end">
                          <Button 
                            onClick={handleSave} 
                            className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-11 px-6 rounded-xl shadow-md flex items-center gap-2"
                          >
                            <Save size={16} />
                            <span>ذخیره ساعت شروع روز کاری</span>
                          </Button>
                        </div>
                      </Card>

                      {/* Session End Warning & Alarm Audio Configuration Card */}
                      <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl text-right" dir="rtl">
                        <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />
                        
                        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shadow-inner">
                              <Bell size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">هشدار اتمام زمان نشست بازی (آلارم صوتی)</h3>
                              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">تنظیم زمان اعلان پیش از پایان محدودیت نشست، نوع صدا، بلندی و تست زنده</p>
                            </div>
                          </div>

                          {/* Enable/Disable Master Toggle */}
                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/50 px-4 py-2.5 rounded-2xl border border-slate-150 dark:border-slate-800">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                              {form.alarmEnabled ? 'هشدار صوتی فعال است' : 'هشدار صوتی غیرفعال است'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, alarmEnabled: !form.alarmEnabled })}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0",
                                form.alarmEnabled ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-700"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                                  form.alarmEnabled ? "translate-x-[-24px]" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Minutes Before Limit Input */}
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1 flex items-center gap-1.5">
                              <Radio size={14} className="text-rose-500" />
                              <span>اعلان هشدار چند دقیقه قبل از اتمام زمان؟ (دقیقه)</span>
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={60}
                              value={form.alarmMinuteWarning !== undefined ? String(form.alarmMinuteWarning) : '2'}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setForm({ ...form, alarmMinuteWarning: isNaN(val) ? 2 : Math.max(1, val) });
                              }}
                              className="h-12 font-black bg-slate-50/50 dark:bg-slate-950/45 focus:bg-white dark:focus:bg-slate-900 border-slate-100 dark:border-slate-800"
                              placeholder="مثلاً: ۲ یا ۵ دقیقه"
                            />
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mr-1">
                              هنگامی که زمان باقیمانده نشست به این مقدار برسد، رنگ کارت قرمز شده و صدای آلارم پخش می‌شود.
                            </p>
                          </div>

                          {/* Sound Volume Slider */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mr-1">
                              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Volume2 size={15} className="text-rose-500" />
                                <span>بلندی صدای هشدار نشست (ولوم)</span>
                              </label>
                              <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-100 dark:border-rose-900/40">
                                {form.alarmVolume ?? 80}٪
                              </span>
                            </div>
                            <div className="h-12 flex items-center gap-3 px-4 bg-slate-50/50 dark:bg-slate-950/45 rounded-2xl border border-slate-100 dark:border-slate-800">
                              <VolumeX size={16} className="text-slate-400 shrink-0" />
                              <input
                                type="range"
                                min={5}
                                max={100}
                                step={5}
                                value={form.alarmVolume ?? 80}
                                onChange={e => setForm({ ...form, alarmVolume: Number(e.target.value) })}
                                className="w-full accent-rose-500 cursor-pointer"
                              />
                              <Volume2 size={16} className="text-rose-500 shrink-0" />
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mr-1">
                              کنترل میزان رسایی و قدرت بلندگوی هشدار در محیط گیم‌نت.
                            </p>
                          </div>
                        </div>

                        {/* Sound Type Selection with Instant Audio Preview */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-6">
                          <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-3 mr-1 flex items-center gap-1.5">
                            <Volume2 size={15} className="text-indigo-500" />
                            <span>انتخاب ملودی و صدای زنگ آلارم (کلیک کنید تا بشنوید)</span>
                          </label>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {SOUND_OPTIONS.map(sound => {
                              const isSelected = (form.alarmSoundType || 'digital') === sound.id;
                              return (
                                <div
                                  key={sound.id}
                                  onClick={() => {
                                    setForm({ ...form, alarmSoundType: sound.id });
                                    playAlertSound(sound.id, form.alarmVolume ?? 80);
                                  }}
                                  className={cn(
                                    "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-right relative group",
                                    isSelected
                                      ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/30 shadow-md ring-1 ring-rose-400/50"
                                      : "border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 hover:bg-slate-100/70 dark:hover:bg-slate-900/50"
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                      {sound.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        playAlertSound(sound.id, form.alarmVolume ?? 80);
                                      }}
                                      className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                                        isSelected
                                          ? "bg-rose-500 text-white shadow-sm"
                                          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-600"
                                      )}
                                      title="پخش آزمایشی این صدا"
                                    >
                                      <Volume2 size={15} />
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                    {sound.description}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Test Button & Save Action */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-6 flex flex-wrap items-center justify-between gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => playAlertSound((form.alarmSoundType as SoundType) || 'digital', form.alarmVolume ?? 80)}
                            className="text-xs font-black h-11 px-5 rounded-xl border-slate-200 dark:border-slate-700 flex items-center gap-2 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                          >
                            <Volume2 size={16} className="text-rose-500" />
                            <span>تست آزمایشی زنگ آلارم با ولوم انتخابی</span>
                          </Button>

                          <Button 
                            onClick={handleSave} 
                            className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs h-11 px-6 rounded-xl shadow-md flex items-center gap-2"
                          >
                            <Save size={16} />
                            <span>ذخیره تنظیمات هشدار نشست</span>
                          </Button>
                        </div>
                      </Card>

                      {/* Visual Themes Customization Card */}
                      <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl">
                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
                        <div className="flex items-center gap-4 mb-8">
                           <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
                              <Palette size={24} />
                           </div>
                           <div>
                              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">سفارشی‌سازی بصری کلوپ</h3>
                              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">تنظیم تنالیته رنگی و تم هر بخش به صورت کاملاً اختصاصی</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {PAGES.map(page => {
                             const activeTheme = form.themes?.[page.id] || { primary: '#4f46e5', secondary: '#818cf8', accent: '#f43f5e' };
                             return (
                               <div key={page.id} className="p-5 bg-slate-50/50 dark:bg-slate-950/40 rounded-3xl border border-slate-100 dark:border-slate-850 hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-all shadow-sm flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                   <span className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                      {page.label}
                                   </span>
                                   <div className="flex items-center gap-1.5">
                                      <span className="w-4 h-4 rounded-full ring-2 ring-white shadow-md relative" style={{ backgroundColor: activeTheme.primary }} />
                                      <span className="w-3 h-3 rounded-full ring-2 ring-white shadow-md relative" style={{ backgroundColor: activeTheme.secondary }} />
                                   </div>
                                </div>
                                 
                                 {/* Interactive miniature page mockup representation inside tab */}
                                 <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 mb-5 select-none pointer-events-none">
                                   <div className="h-2 w-12 rounded bg-slate-200 dark:bg-slate-800" />
                                   <div className="flex items-center gap-1.5">
                                      <div className="h-6 w-full rounded-lg" style={{ backgroundColor: `${activeTheme.primary}15` }}>
                                         <div className="h-full w-1.5 rounded-r-lg" style={{ backgroundColor: activeTheme.primary }} />
                                      </div>
                                      <div className="h-6 w-8 rounded-lg" style={{ backgroundColor: activeTheme.secondary }}></div>
                                   </div>
                                 </div>
                                <div className="grid grid-cols-3 gap-2">
                                   {THEME_PRESETS.map(preset => {
                                     const isSelected = form.themes?.[page.id]?.primary === preset.primary;
                                     return (
                                       <button
                                         key={preset.id}
                                         type="button"
                                         onClick={() => {
                                            const newThemes = { ...(form.themes || {}) };
                                            newThemes[page.id] = { primary: preset.primary, secondary: preset.secondary, accent: preset.accent };
                                            setForm({ ...form, themes: newThemes });
                                         }}
                                         className={cn(
                                           "flex flex-col items-center p-2 rounded-xl border transition-all text-center cursor-pointer",
                                           isSelected 
                                             ? "border-indigo-500 bg-white dark:bg-slate-800 shadow-sm col-span-1 scale-102" 
                                             : "border-transparent bg-white/40 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-850"
                                         )}
                                       >
                                          <div className="flex -space-x-1 mb-1.5 items-center justify-center select-none pointer-events-none">
                                             <div className="w-3.5 h-3.5 rounded-full border border-white select-none pointer-events-none" style={{ backgroundColor: preset.primary }} />
                                             <div className="w-3.5 h-3.5 rounded-full border border-white select-none pointer-events-none" style={{ backgroundColor: preset.secondary }} />
                                          </div>
                                          <span className="text-[9px] font-black leading-none text-slate-500 dark:text-slate-400 select-none pointer-events-none">{preset.label}</span>
                                       </button>
                                     );
                                   })}
                                </div>
                             </div>
                            );
                          })}
                        </div>

                        {/* Save Button for Theme Settings at Card Bottom */}
                        <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-6 flex justify-end">
                          <Button 
                            onClick={handleSave} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-11 px-6 rounded-xl shadow-md flex items-center gap-2"
                          >
                            <Save size={16} />
                            <span>ذخیره شخصی‌سازی تم‌ها</span>
                          </Button>
                        </div>
                      </Card>

                      {/* Smart Inventory & Buffet Alert Card */}
                      <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl text-right" dir="rtl">
                         <div className="absolute top-0 right-0 w-2 h-full bg-orange-500" />
                         
                         <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center shadow-inner">
                                 <Database size={24} />
                              </div>
                              <div>
                                 <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">مدیریت موجودی هوشمند و هشدار بوفه</h3>
                                 <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">آستانه‌های بحرانی، هشدارهای صوتی بوفه و انتخاب ملودی زنگ اعلان موجودی</p>
                              </div>
                            </div>

                            {/* Buffet Alert Enable Toggle */}
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/50 px-4 py-2.5 rounded-2xl border border-slate-150 dark:border-slate-800">
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                {form.buffetAlertEnabled ? 'اعلان صوتی بوفه فعال است' : 'اعلان صوتی بوفه غیرفعال است'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, buffetAlertEnabled: !form.buffetAlertEnabled })}
                                className={cn(
                                  "w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0",
                                  form.buffetAlertEnabled ? "bg-orange-500" : "bg-slate-300 dark:bg-slate-700"
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                                    form.buffetAlertEnabled ? "translate-x-[-24px]" : "translate-x-0"
                                  )}
                                />
                              </button>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1 flex items-center gap-1.5">
                                <AlertTriangle size={15} className="text-orange-500" />
                                <span>حد آستانه پیش‌فرض هشدار موجودی بحرانی (تعداد دستی)</span>
                              </label>
                              <Input 
                                 type="number"
                                 min={1}
                                 placeholder="مثلاً: ۵ یا ۱۰"
                                 value={form.defaultMinStock !== undefined ? String(form.defaultMinStock) : ''}
                                 onChange={e => {
                                   const val = Number(e.target.value);
                                   setForm({ ...form, defaultMinStock: isNaN(val) ? 10 : val });
                                 }}
                                 className="h-12 font-black bg-slate-50/50 dark:bg-slate-950/40 border-2"
                              />
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mr-1">
                                برای تمام اقلامی که آستانه اختصاصی ندارند، رسیدن موجودی به این مقدار موجب ثبت هشدار و پخش صدا خواهد شد.
                              </p>
                            </div>

                            {/* Buffet Sound Volume Slider */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between mr-1">
                                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <Volume2 size={15} className="text-orange-500" />
                                  <span>بلندی صدای هشدار بوفه (ولوم)</span>
                                </label>
                                <span className="text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded-lg border border-orange-100 dark:border-orange-900/40">
                                  {form.buffetAlertVolume ?? 80}٪
                                </span>
                              </div>
                              <div className="h-12 flex items-center gap-3 px-4 bg-slate-50/50 dark:bg-slate-950/45 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <VolumeX size={16} className="text-slate-400 shrink-0" />
                                <input
                                  type="range"
                                  min={5}
                                  max={100}
                                  step={5}
                                  value={form.buffetAlertVolume ?? 80}
                                  onChange={e => setForm({ ...form, buffetAlertVolume: Number(e.target.value) })}
                                  className="w-full accent-orange-500 cursor-pointer"
                                />
                                <Volume2 size={16} className="text-orange-500 shrink-0" />
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mr-1">
                                تنظیم سطح بلندی صدای بوق اعلان کسری انبار برای اپراتور یا مسئول بوفه.
                              </p>
                            </div>
                         </div>

                         {/* Sound Type Selection for Buffet Alert */}
                         <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-6">
                            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-3 mr-1 flex items-center gap-1.5">
                              <Volume2 size={15} className="text-orange-500" />
                              <span>انتخاب زنگ هشدار کمبود موجودی بوفه (کلیک کنید تا تست کنید)</span>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {SOUND_OPTIONS.map(sound => {
                                const isSelected = (form.buffetAlertSoundType || 'bell') === sound.id;
                                return (
                                  <div
                                    key={sound.id}
                                    onClick={() => {
                                      setForm({ ...form, buffetAlertSoundType: sound.id });
                                      playAlertSound(sound.id, form.buffetAlertVolume ?? 80);
                                    }}
                                    className={cn(
                                      "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-right relative group",
                                      isSelected
                                        ? "border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 shadow-md ring-1 ring-orange-400/50"
                                        : "border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 hover:bg-slate-100/70 dark:hover:bg-slate-900/50"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                        {sound.label}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          playAlertSound(sound.id, form.buffetAlertVolume ?? 80);
                                        }}
                                        className={cn(
                                          "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                                          isSelected
                                            ? "bg-orange-500 text-white shadow-sm"
                                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-600"
                                        )}
                                        title="پخش آزمایشی این صدا"
                                      >
                                        <Volume2 size={15} />
                                      </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                      {sound.description}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                         </div>

                         {/* Save Button for Buffet Settings at Card Bottom */}
                         <div className="mt-8 border-t border-slate-100 dark:border-slate-800/80 pt-6 flex flex-wrap items-center justify-between gap-3">
                           <Button
                             type="button"
                             variant="outline"
                             onClick={() => playAlertSound((form.buffetAlertSoundType as SoundType) || 'bell', form.buffetAlertVolume ?? 80)}
                             className="text-xs font-black h-11 px-5 rounded-xl border-slate-200 dark:border-slate-700 flex items-center gap-2 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200"
                           >
                             <Volume2 size={16} className="text-orange-500" />
                             <span>تست صدای هشدار انبار بوفه</span>
                           </Button>

                           <Button 
                             onClick={handleSave} 
                             className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs h-11 px-6 rounded-xl shadow-md flex items-center gap-2"
                           >
                             <Save size={16} />
                             <span>ذخیره تنظیمات انبار و بوفه</span>
                           </Button>
                         </div>
                      </Card>
                    </div>
                  )}

                  {(activeTab === 'finance' || activeTab === 'devices') && (
                    <div className="space-y-6">
                      <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl">
                        <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
                        
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 rounded-xl flex items-center justify-center shadow-inner">
                            <BadgePercent size={22} />
                          </div>
                          <div>
                            <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">سرفصل‌های هزینه‌های ثابت باشگاه</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">ثبت و مدیریت عناوینی که هر ماه به عنوان هزینه‌های ثابت تسویه می‌شوند</p>
                          </div>
                        </div>

                        {/* Interactive Receipt Adding Box */}
                        <div className="bg-slate-50/60 dark:bg-slate-950/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 mb-6 flex flex-col sm:flex-row items-end gap-3">
                          <div className="flex-1 w-full text-right">
                            <label className="text-xs font-black text-slate-600 dark:text-slate-400 mb-2 block mr-1">نام سرفصل هزینه جدید</label>
                            <Input 
                              placeholder="مثال: هزینه قبض برق کلوپ، اجاره ماهیانه..." 
                              value={newFixedTitle}
                              onChange={e => setNewFixedTitle(e.target.value)}
                              className="h-12 bg-white dark:bg-slate-900 font-bold border-slate-200 dark:border-slate-800"
                            />
                          </div>
                          <Button 
                            type="button"
                            onClick={handleAddFixed} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-12 px-6 rounded-xl w-full sm:w-auto shadow-sm"
                          >
                            {editingFixedId ? 'اعمال تغییرات سرفصل' : 'ایجاد سرفصل جدید'}
                          </Button>
                        </div>

                        {/* Custom Financial items list */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {fixedExpenses && fixedExpenses.length > 0 ? (
                            fixedExpenses.map((exp: any) => (
                              <div 
                                key={exp.id} 
                                className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-105 dark:border-slate-850 hover:border-indigo-250 dark:hover:border-indigo-900 transition-all group shadow-inner"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-450 rounded-xl flex items-center justify-center">
                                    <TrendingUp size={16} />
                                  </div>
                                  <span className="font-extrabold text-slate-900 dark:text-slate-250 text-xs tracking-tight">{exp.title}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    type="button"
                                    onClick={() => handleEditFixed(exp)} 
                                    className="p-2 text-slate-400 hover:text-indigo-650 transition-colors"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteFixed(exp.id)} 
                                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20">
                              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">هیچ سرفصل هزینه ثابتی هنوز ثبت نشده است.</p>
                            </div>
                          )}
                        </div>
                      </Card>

                      {/* Devices Pricing Guide Card */}
                      <Card className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl">
                        <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />
                        
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shadow-inner">
                            <Gamepad2 size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">راهنمای هوشمند نرخ‌گذاری دستگاه‌ها و تعرفه‌ها</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">تعیین و مدیریت تخصصی دستگاه‌ها، زمان‌ها و شیفت بازی‌ها</p>
                          </div>
                        </div>

                        {/* Interactive Warning banner */}
                        <div className="bg-amber-50/50 dark:bg-amber-955/20 p-5 rounded-2xl border border-amber-105 dark:border-amber-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                            <div>
                              <p className="text-xs font-black text-amber-900 dark:text-amber-400 leading-normal">
                                نرخ محاسباتی دستگاه‌های مختلف به صورت مستقل تنظیم می‌شود
                              </p>
                              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-1 leading-relaxed">
                                برای شخصی‌سازی یا ویرایش نرخ محاسباتی دستگاه‌های PS4، PS5، VIP و غیره، کافیست مستقیماً به بخش مدیریت دستگاه‌ها در میزکار مراجعه کنید.
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {activeTab === 'promotions' && (
                    <div className="space-y-10 text-right" dir="rtl">
                       <div className="flex flex-col gap-2">
                         <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">جشنواره‌ها و طرح‌های تخفیف</h3>
                         <p className="text-gray-500 font-medium">مدیریت بازه‌های زمانی تخفیف گروهی روی تمام خدمات کلوپ</p>
                       </div>

                       <Card className="p-6 md:p-8 border border-gray-100 dark:border-slate-800/80 shadow-md bg-white dark:bg-slate-900 rounded-3xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                          <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-8">
                               <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                  <Gift size={24} />
                               </div>
                               <h4 className="text-xl font-black text-gray-900">تعریف جشنواره جدید</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                               <div className="lg:col-span-2">
                                 <Input 
                                    label="نام جشنواره" 
                                    placeholder="مثلاً: تخفیف ویژه عید نوروز"
                                    value={newPromo.name}
                                    onChange={e => setNewPromo({...newPromo, name: e.target.value})}
                                    className="h-14 bg-gray-50 border-gray-100 font-bold"
                                 />
                               </div>
                               <Input 
                                  label="درصد تخفیف" 
                                  type="number"
                                  placeholder="۲۰"
                                  value={String(newPromo.discountPercentage)}
                                  onChange={e => setNewPromo({...newPromo, discountPercentage: Number(e.target.value)})}
                                  className="h-14 bg-gray-50 border-gray-100 font-black text-indigo-600"
                               />
                               <div className="flex flex-col gap-2">
                                  <label className="text-sm font-black text-slate-700 dark:text-slate-300 mr-2">وضعیت اولیه</label>
                                  <button 
                                    onClick={() => setNewPromo({...newPromo, isActive: !newPromo.isActive})}
                                    className={cn(
                                      "h-14 px-6 rounded-2xl flex items-center justify-between border-2 transition-all font-bold",
                                      newPromo.isActive 
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                        : "bg-gray-50 border-gray-200 text-gray-400"
                                    )}
                                  >
                                    <span>{newPromo.isActive ? 'فعال و خودکار' : 'غیرفعال (رزرو)'}</span>
                                    <Toggle size={20} className={newPromo.isActive ? "text-emerald-500" : "text-gray-300"} />
                                  </button>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                               <Input 
                                  label="تاریخ شروع طرح" 
                                  type="date"
                                  value={newPromo.startDate}
                                  onChange={e => setNewPromo({...newPromo, startDate: e.target.value})}
                                  className="h-14 bg-gray-50 border-gray-100 font-bold"
                               />
                               <Input 
                                  label="تاریخ اتمام طرح" 
                                  type="date"
                                  value={newPromo.endDate}
                                  onChange={e => setNewPromo({...newPromo, endDate: e.target.value})}
                                  className="h-14 bg-gray-50 border-gray-100 font-bold"
                               />
                            </div>

                            <div className="flex gap-4">
                               <Button onClick={handleAddPromo} className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100 transition-all hover:scale-[1.01] hover:bg-indigo-700">
                                  {editingPromoId ? 'بروزرسانی اطلاعات جشنواره' : 'ثبت و انتشار جشنواره'}
                               </Button>
                               {editingPromoId && (
                                 <Button variant="outline" onClick={() => { setEditingPromoId(null); setNewPromo({ name: '', discountPercentage: 0, startDate: '', endDate: '', isActive: true }); }} className="px-10 h-14 rounded-2xl font-black border-2">
                                    انصراف
                                 </Button>
                               )}
                            </div>
                          </div>
                       </Card>

                       <div className="space-y-6">
                          <h4 className="text-xl font-black text-gray-900 dark:text-white border-r-4 border-rose-500 pr-4">لیست جشنواره‌های ثبت شده</h4>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                             {promotions?.length === 0 && (
                                <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                                   <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                      <Gift size={40} className="text-gray-200" />
                                   </div>
                                   <p className="text-gray-400 font-black">تاکنون هیچ طرح تخفیفی ثبت نشده است.</p>
                                </div>
                             )}
                             {promotions?.map((promo: any) => {
                               const isActiveInTime = new Date() >= new Date(promo.startDate) && new Date() <= new Date(promo.endDate);
                               const isLive = promo.isActive && isActiveInTime;

                               return (
                                 <motion.div 
                                   key={promo.id}
                                   layout
                                   className={cn(
                                     "group relative p-8 rounded-3xl border-2 transition-all duration-500 overflow-hidden",
                                     isLive 
                                       ? "bg-white border-indigo-200 shadow-xl shadow-indigo-50 ring-4 ring-indigo-50/50" 
                                       : "bg-gray-50/50 border-gray-100 grayscale-[0.5] opacity-80 shadow-sm"
                                   )}
                                 >
                                    {isLive && (
                                      <div className="absolute top-0 left-0 bg-indigo-600 text-white px-6 py-2 rounded-br-2xl text-[10px] font-black uppercase tracking-widest animate-pulse shadow-lg">
                                        در حال اجرا (LIVE)
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between mb-8">
                                       <div className={cn(
                                         "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                                         isLive ? "bg-indigo-600 text-white rotate-6" : "bg-white text-gray-400"
                                       )}>
                                          <Gift size={28} />
                                       </div>
                                       <div className="flex items-center gap-1">
                                           <button 
                                            onClick={() => handleTogglePromo(promo)} 
                                            className={cn(
                                              "p-3 rounded-xl transition-all",
                                              promo.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-200 text-gray-500"
                                            )}
                                            title={promo.isActive ? "غیرفعال کردن" : "فعال کردن"}
                                          >
                                             <Toggle size={20} className={promo.isActive ? "" : "rotate-180"} />
                                          </button>
                                          <button onClick={() => handleEditPromo(promo)} className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-500 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700"><Edit2 size={18} /></button>
                                          <button onClick={() => handleDeletePromo(promo.id)} className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-500 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700"><Trash2 size={18} /></button>
                                       </div>
                                    </div>

                                    <div className="mb-8">
                                      <h5 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 group-hover:text-indigo-600 transition-colors">{promo.name}</h5>
                                      <div className="flex items-center gap-3 text-sm font-bold text-gray-400">
                                         <Calendar size={16} className="text-indigo-400" />
                                         <span dir="ltr">{new Date(promo.startDate).toLocaleDateString('fa-IR')}</span>
                                         <span className="mx-1">تا</span>
                                         <span dir="ltr">{new Date(promo.endDate).toLocaleDateString('fa-IR')}</span>
                                      </div>
                                    </div>

                                    <div className={cn(
                                      "p-6 rounded-3xl flex items-center justify-between transition-all",
                                      isLive ? "bg-indigo-50 border border-indigo-100" : "bg-white border border-gray-100"
                                    )}>
                                       <div className="flex flex-col">
                                          <span className={cn("text-[11px] font-black uppercase mb-1", isLive ? "text-indigo-400" : "text-gray-400")}>میزان تخفیف کل</span>
                                          <span className={cn("text-3xl font-black", isLive ? "text-indigo-600" : "text-gray-500")}>%{promo.discountPercentage || 0}</span>
                                       </div>
                                       <div className={cn(
                                         "w-12 h-12 rounded-full border-4 border-white shadow-inner flex items-center justify-center",
                                         isLive ? "bg-emerald-500" : "bg-gray-200"
                                       )}>
                                          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                                       </div>
                                    </div>
                                 </motion.div>
                               );
                             })}
                          </div>
                       </div>
                    </div>
                  )}

                  {(activeTab === 'database' || activeTab === 'mysql' || activeTab === 'backup' || activeTab === 'security') && (
                    <div className="space-y-8">
                      {/* 3-Part Database Sub-Navigation */}
                      <div className="bg-white dark:bg-slate-900 p-2 md:p-3 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => handleSetDbSubTab('tables')}
                            className={cn(
                              "flex-1 min-w-[170px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all duration-200 cursor-pointer",
                              dbSubTab === 'tables'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            )}
                          >
                            <Table size={17} />
                            <span>بخش ۱: ساختار و جداول پایگاه داده</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetDbSubTab('mysql')}
                            className={cn(
                              "flex-1 min-w-[170px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all duration-200 cursor-pointer",
                              dbSubTab === 'mysql'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            )}
                          >
                            <Database size={17} />
                            <span>بخش ۲: اتصال سرور و پایگاه داده MySQL</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetDbSubTab('maintenance')}
                            className={cn(
                              "flex-1 min-w-[170px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all duration-200 cursor-pointer",
                              dbSubTab === 'maintenance'
                                ? "bg-rose-600 text-white shadow-md shadow-rose-500/25"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            )}
                          >
                            <Trash2 size={17} />
                            <span>بخش ۳: انهدام داده‌ها، حذف فاکتورها و بکاپ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetDbSubTab('all')}
                            className={cn(
                              "px-4 py-2.5 rounded-2xl font-black text-xs transition-all duration-200 cursor-pointer",
                              dbSubTab === 'all'
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            )}
                            title="نمایش هر ۳ بخش همزمان"
                          >
                            <span>نمایش همه بخش‌ها</span>
                          </button>
                        </div>
                      </div>

                      {/* Section 1: جدول ساختار و داده‌های پایگاه داده (جدول پایگاه داده) */}
                      {(dbSubTab === 'tables' || dbSubTab === 'all') && (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm shadow-inner">
                                ۱
                              </div>
                              <div>
                                <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <Table size={20} className="text-indigo-600 dark:text-indigo-400" />
                                  بخش اول: جدول ساختار و وضعیت جداول پایگاه داده
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                                  نمای کلی کالکشن‌ها و جداول اطلاعاتی نرم‌افزار، تعداد رکوردهای ثبت‌شده، بازرسی و انهدام جداول
                                </p>
                              </div>
                            </div>

                            {/* Search inside tables */}
                            <div className="relative w-full sm:w-72">
                              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={dbSearchTerm}
                                onChange={(e) => setDbSearchTerm(e.target.value)}
                                placeholder="جستجو در جداول یا شرح..."
                                className="w-full h-10 pr-10 pl-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 outline-none transition-all"
                              />
                            </div>
                          </div>

                          {/* Quick Database Stat Widgets */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <Table size={22} />
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500">تعداد جداول فعال</div>
                                <div className="text-lg font-black text-slate-900 dark:text-white">{dbTablesList.length} جدول سیستم</div>
                              </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <HardDrive size={22} />
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500">مجموع رکوردهای ذخیره</div>
                                <div className="text-lg font-black text-slate-900 dark:text-white">{totalDatabaseRecords.toLocaleString('fa-IR')} رکورد</div>
                              </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Database size={22} />
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500">موتور ذخیره‌سازی فعال</div>
                                <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  {mysqlEnabled && mysqlStatus === 'CONNECTED' ? 'MySQL متصل به سرور' : 'ذخیره محلی مرورگر'}
                                </div>
                              </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                                <ShieldCheck size={22} />
                              </div>
                              <div>
                                <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500">وضعیت سلامت دیتابیس</div>
                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  سالم و همگام
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* The Database Table view */}
                          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-right border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-500 dark:text-slate-400">
                                    <th className="py-4 px-5">نام جدول / کالکشن</th>
                                    <th className="py-4 px-5">عنوان و شرح محتوا</th>
                                    <th className="py-4 px-4 hidden md:table-cell">کلید اصلی (PK)</th>
                                    <th className="py-4 px-4 hidden lg:table-cell">موتور پایگاه داده</th>
                                    <th className="py-4 px-5 text-center">تعداد رکوردها</th>
                                    <th className="py-4 px-4 text-center">وضعیت</th>
                                    <th className="py-4 px-5 text-left">عملیات جدول</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                                  {filteredDbTables.map((tbl) => {
                                    const Icon = tbl.icon;
                                    return (
                                      <tr key={tbl.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="py-4 px-5">
                                          <div className="flex items-center gap-3">
                                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", tbl.color)}>
                                              <Icon size={18} />
                                            </div>
                                            <div>
                                              <div className="font-mono font-black text-xs text-slate-900 dark:text-white" dir="ltr">
                                                {tbl.name}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-bold md:hidden mt-0.5">
                                                {tbl.title}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-4 px-5">
                                          <div className="font-black text-slate-900 dark:text-white text-xs mb-0.5">
                                            {tbl.title}
                                          </div>
                                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-relaxed max-w-sm">
                                            {tbl.description}
                                          </div>
                                        </td>
                                        <td className="py-4 px-4 hidden md:table-cell">
                                          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                            {tbl.primaryKey}
                                          </span>
                                        </td>
                                        <td className="py-4 px-4 hidden lg:table-cell">
                                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                            {tbl.engine}
                                          </span>
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                          <span className={cn(
                                            "inline-flex items-center px-3 py-1 rounded-xl font-black text-xs font-mono",
                                            tbl.count > 0 
                                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                                              : "bg-slate-100 text-slate-400 dark:bg-slate-800/80 dark:text-slate-500"
                                          )}>
                                            {tbl.count.toLocaleString('fa-IR')}
                                          </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            همگام و سالم
                                          </span>
                                        </td>
                                        <td className="py-4 px-5 text-left">
                                          <div className="flex items-center justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => setInspectingTable(tbl)}
                                              title="مشاهده و بازرسی داده‌های جدول و فاکتورها"
                                              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                              <Eye size={14} />
                                              <span>مشاهده و حذف</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleExportSingleTableJSON(tbl)}
                                              title="دانلود خروجی JSON این جدول"
                                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-white rounded-xl transition-all cursor-pointer shadow-sm"
                                            >
                                              <Download size={15} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handlePurgeTable(tbl)}
                                              title={`پاکسازی و انهدام کلیه رکوردهای جدول ${tbl.title}`}
                                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 rounded-xl transition-all cursor-pointer shadow-sm"
                                            >
                                              <Trash2 size={15} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Section 2: تنظیمات پایگاه داده MySQL */}
                      {(dbSubTab === 'mysql' || dbSubTab === 'all') && (
                        <div className="space-y-6 pt-2">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm shadow-inner">
                                ۲
                              </div>
                              <div>
                                <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <Database size={20} className="text-indigo-600 dark:text-indigo-400" />
                                  بخش دوم: تنظیمات پایگاه داده MySQL
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                                  پیکربندی MySQL، وضعیت اتصال سرور و انتقال اطلاعات
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* MySQL Configuration Form Card */}
                          <Card className="p-6 md:p-8 border border-gray-100 dark:border-slate-800/80 shadow-sm relative bg-white dark:bg-slate-900 rounded-3xl">
                            <div className="flex items-center justify-between mb-8 border-b border-gray-100 dark:border-slate-800 pb-4">
                              <h4 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                                <Database className="text-indigo-600 dark:text-indigo-400" size={20} />
                                مشخصات اتصال سرور MySQL
                              </h4>
                              <div className="flex items-center gap-2">
                                {mysqlStatus === 'CONNECTED' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    متصل فعال
                                  </span>
                                ) : mysqlStatus === 'DISABLED' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                    غیر فعال (ذخیره‌ساز کلاینت)
                                  </span>
                                ) : mysqlStatus === 'ERROR' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                                    خطای برقراری ارتباط
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                                    تنظیم نشده
                                  </span>
                                )}
                              </div>
                            </div>

                            <form onSubmit={handleConnectMySQL} className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Input 
                                  label="آدرس سرور MySQL (Host / IP)" 
                                  value={mysqlHost} 
                                  onChange={(e) => setMysqlHost(e.target.value)} 
                                  placeholder="مثال: localhost یا 127.0.0.1" 
                                  required
                                  className="h-12 bg-gray-50/50 dark:bg-slate-950/40 dark:text-white"
                                />
                                <Input 
                                  label="پورت اتصال (Port)" 
                                  value={mysqlPort} 
                                  onChange={(e) => setMysqlPort(e.target.value)} 
                                  placeholder="پیش‌فرض: 3306" 
                                  required
                                  className="h-12 bg-gray-50/50 dark:bg-slate-950/40 dark:text-white"
                                />
                                <Input 
                                  label="نام پایگاه داده (Database Name)" 
                                  value={mysqlDatabase} 
                                  onChange={(e) => setMysqlDatabase(e.target.value)} 
                                  placeholder="مثال: game_net_club" 
                                  required
                                  className="h-12 bg-gray-50/50 dark:bg-slate-950/40 dark:text-white"
                                />
                                <Input 
                                  label="نام کاربری (Username)" 
                                  value={mysqlUser} 
                                  onChange={(e) => setMysqlUser(e.target.value)} 
                                  placeholder="مثال: root" 
                                  required
                                  className="h-12 bg-gray-50/50 dark:bg-slate-950/40 dark:text-white"
                                />
                                <Input 
                                  label="رمز عبور دیتابیس (Password)" 
                                  type="password"
                                  value={mysqlPassword} 
                                  onChange={(e) => setMysqlPassword(e.target.value)} 
                                  placeholder="در صورت وجود رمز عبور وارد کنید..." 
                                  className="h-12 bg-gray-50/50 dark:bg-slate-950/40 dark:text-white"
                                />
                              </div>

                              {mysqlError && (
                                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2 leading-relaxed">
                                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                  <div>
                                    <p className="font-extrabold mb-1 text-rose-800 dark:text-rose-300">خطا در اتصال به پایگاه داده:</p>
                                    <p className="font-mono text-[10px] break-all text-rose-600 dark:text-rose-400">{mysqlError}</p>
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-3 pt-2">
                                <Button 
                                  type="submit" 
                                  disabled={testingConnection} 
                                  className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                >
                                  {testingConnection ? (
                                    <>
                                      <RefreshCw size={16} className="animate-spin" />
                                      در حال تست و راه‌اندازی...
                                    </>
                                  ) : (
                                    <>
                                      <Save size={16} />
                                      ذخیره تنظیمات و اتصال به MySQL
                                    </>
                                  )}
                                </Button>

                                {mysqlEnabled && (
                                  <Button 
                                    type="button"
                                    onClick={handleDisableMySQL} 
                                    variant="outline"
                                    className="h-12 px-6 border border-gray-200 text-slate-700 hover:bg-gray-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 rounded-2xl font-bold flex items-center gap-2"
                                  >
                                    غیرفعال‌سازی MySQL و برگشت به کلاینت
                                  </Button>
                                )}
                              </div>
                            </form>
                          </Card>

                          {/* Migration and Seeding Tools Card */}
                          {mysqlEnabled && mysqlStatus === 'CONNECTED' && (
                            <Card className="p-6 md:p-8 border border-gray-100 dark:border-slate-800/80 shadow-sm relative bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-600" />
                              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                <RefreshCw className="text-emerald-600 dark:text-emerald-450" size={24} />
                                انتقال و بذرپاشی دیتابیس (Database Seed & Sync)
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold mb-6">
                                نرم‌افزار هم‌اکنون از موتور مستقل MySQL جهت نگهداری اطلاعات استفاده می‌کند. در صورتی که قبلاً اطلاعاتی شامل لیست مشتریان، بوفه کالاها، حساب‌ها و تنظیمات مبالغ را در مرورگر خود ثبت کرده بودید، می‌توانید با فرآیند «انتقال و بذرپاشی» تمامی آن‌ها را با یک کلیک به دیتابیس MySQL خود منتقل و سینک کنید.
                              </p>

                              {syncingData && (
                                <div className="mb-6 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center gap-3">
                                  <RefreshCw size={18} className="animate-spin text-indigo-600" />
                                  <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400">{syncMessage}</span>
                                </div>
                              )}

                              <Button 
                                type="button"
                                onClick={handleMigrateToMySQL} 
                                disabled={syncingData} 
                                className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                              >
                                <Upload size={16} />
                                انتقال تمامی اطلاعات جاری مرورگر به MySQL (بذرپاشی)
                              </Button>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Section 3 (تکه سوم): پشتیبان‌گیری، بازیابی و انهدام تفکیکی داده‌ها */}
                      {(dbSubTab === 'maintenance' || dbSubTab === 'all') && (
                        <div className="space-y-6 pt-2">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black text-sm shadow-inner">
                                ۳
                              </div>
                              <div>
                                <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
                                  بخش سوم: انهدام داده‌ها، حذف تفکیکی فاکتورها و پشتیبان‌گیری
                                </h3>
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                                  حذف و انهدام تفکیکی جداول و فاکتورها، استخراج نسخه پشتیبان JSON و بازیابی پایگاه داده
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Individual Table & Invoice Purge Center */}
                          <Card className="p-6 md:p-8 border border-rose-100/90 dark:border-rose-950/50 shadow-sm relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl">
                            <div className="absolute top-0 right-0 w-2 h-full bg-rose-600" />
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                              <div>
                                <h4 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                                  <Trash2 className="text-rose-600" size={22} />
                                  مرکز انهدام و پاکسازی تفکیکی جداول و فاکتورها
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                                  شما می‌توانید هر جدول یا فاکتور را به‌صورت مجزا و بدون آسیب به سایر بخش‌ها پاکسازی کرده یا فاکتورهای آن را بازرسی و دانه دانه منهدم نمایید:
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* 1. Sales Invoices Purge */}
                              <div className="p-5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300 flex items-center justify-center">
                                        <ShoppingCart size={16} />
                                      </div>
                                      <span className="font-black text-xs text-slate-900 dark:text-white">فاکتورهای فروش بوفه (sales)</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-rose-200/60 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 font-mono font-black text-xs">
                                      {(sales?.length || 0).toLocaleString('fa-IR')} فاکتور
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4 leading-relaxed">
                                    کلیه فاکتورهای فروش سریع، خریدهای نقدی و اقلام سفارش داده شده در بوفه کلوپ.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-rose-100/60 dark:border-rose-900/40">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'sales');
                                      if (tbl) setInspectingTable(tbl);
                                    }}
                                    variant="outline"
                                    className="flex-1 h-9 rounded-xl text-xs font-black border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                  >
                                    بازرسی و حذف تکی
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'sales');
                                      if (tbl) handlePurgeTable(tbl);
                                    }}
                                    className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1"
                                  >
                                    <Trash2 size={13} />
                                    انهدام کامل
                                  </Button>
                                </div>
                              </div>

                              {/* 2. Sessions Invoices Purge */}
                              <div className="p-5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300 flex items-center justify-center">
                                        <PlayCircle size={16} />
                                      </div>
                                      <span className="font-black text-xs text-slate-900 dark:text-white">فاکتورهای نشست بازی (sessions)</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-200/60 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200 font-mono font-black text-xs">
                                      {(sessions?.length || 0).toLocaleString('fa-IR')} نشست
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4 leading-relaxed">
                                    سوابق نشست‌های کنسول‌ها، زمان‌های بازی محاسبه‌شده و مبالغ ثبت‌شده نشست‌ها.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-blue-100/60 dark:border-blue-900/40">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'sessions');
                                      if (tbl) setInspectingTable(tbl);
                                    }}
                                    variant="outline"
                                    className="flex-1 h-9 rounded-xl text-xs font-black border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                  >
                                    بازرسی و حذف تکی
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'sessions');
                                      if (tbl) handlePurgeTable(tbl);
                                    }}
                                    className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1"
                                  >
                                    <Trash2 size={13} />
                                    انهدام کامل
                                  </Button>
                                </div>
                              </div>

                              {/* 3. Purchases Invoices Purge */}
                              <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300 flex items-center justify-center">
                                        <Package size={16} />
                                      </div>
                                      <span className="font-black text-xs text-slate-900 dark:text-white">فاکتورهای خرید اقلام (purchases)</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-200/60 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200 font-mono font-black text-xs">
                                      {(purchases?.length || 0).toLocaleString('fa-IR')} سند
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4 leading-relaxed">
                                    فاکتورهای تأمین اجناس بوفه، خرید دانه قهوه و مواد اولیه اضافه شده به انبار.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-amber-100/60 dark:border-amber-900/40">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'purchases');
                                      if (tbl) setInspectingTable(tbl);
                                    }}
                                    variant="outline"
                                    className="flex-1 h-9 rounded-xl text-xs font-black border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                  >
                                    بازرسی و حذف تکی
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'purchases');
                                      if (tbl) handlePurgeTable(tbl);
                                    }}
                                    className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1"
                                  >
                                    <Trash2 size={13} />
                                    انهدام کامل
                                  </Button>
                                </div>
                              </div>

                              {/* 4. Client Transactions Purge */}
                              <div className="p-5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center justify-center">
                                        <TrendingUp size={16} />
                                      </div>
                                      <span className="font-black text-xs text-slate-900 dark:text-white">تراکنش‌های کیف پول مشتریان</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200 font-mono font-black text-xs">
                                      {(clientTransactions?.length || 0).toLocaleString('fa-IR')} رکورد
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4 leading-relaxed">
                                    تاریخچه شارژ حساب، بستانکاری‌ها و تراکنش‌های ریالی پرونده مشتریان.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-emerald-100/60 dark:border-emerald-900/40">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'client_transactions');
                                      if (tbl) setInspectingTable(tbl);
                                    }}
                                    variant="outline"
                                    className="flex-1 h-9 rounded-xl text-xs font-black border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                  >
                                    بازرسی و حذف تکی
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'client_transactions');
                                      if (tbl) handlePurgeTable(tbl);
                                    }}
                                    className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1"
                                  >
                                    <Trash2 size={13} />
                                    انهدام کامل
                                  </Button>
                                </div>
                              </div>

                              {/* 5. Reservations Purge */}
                              <div className="p-5 rounded-2xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/50 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-900/60 dark:text-cyan-300 flex items-center justify-center">
                                        <Calendar size={16} />
                                      </div>
                                      <span className="font-black text-xs text-slate-900 dark:text-white">رزروهای کنسول‌ها (reservations)</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-cyan-200/60 text-cyan-800 dark:bg-cyan-900/80 dark:text-cyan-200 font-mono font-black text-xs">
                                      {(reservations?.length || 0).toLocaleString('fa-IR')} رزرو
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4 leading-relaxed">
                                    رزروهای ثبت‌شده دستگاه‌ها، زمان‌های آینده و شماره تماس مشتریان.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-cyan-100/60 dark:border-cyan-900/40">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'reservations');
                                      if (tbl) setInspectingTable(tbl);
                                    }}
                                    variant="outline"
                                    className="flex-1 h-9 rounded-xl text-xs font-black border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                  >
                                    بازرسی و حذف تکی
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'reservations');
                                      if (tbl) handlePurgeTable(tbl);
                                    }}
                                    className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1"
                                  >
                                    <Trash2 size={13} />
                                    انهدام کامل
                                  </Button>
                                </div>
                              </div>

                              {/* 6. Reports Purge */}
                              <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300 flex items-center justify-center">
                                        <TrendingUp size={16} />
                                      </div>
                                      <span className="font-black text-xs text-slate-900 dark:text-white">گزارش‌های ذخیره‌شده (reports)</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-200/60 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200 font-mono font-black text-xs">
                                      {(reports?.length || 0).toLocaleString('fa-IR')} گزارش
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-4 leading-relaxed">
                                    سوابق مالی بسته‌شده و آرشیو دوره‌ای بیلان عملکرد کلوپ.
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-indigo-100/60 dark:border-indigo-900/40">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'reports');
                                      if (tbl) setInspectingTable(tbl);
                                    }}
                                    variant="outline"
                                    className="flex-1 h-9 rounded-xl text-xs font-black border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                  >
                                    بازرسی و حذف تکی
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      const tbl = dbTablesList.find(t => t.id === 'reports');
                                      if (tbl) handlePurgeTable(tbl);
                                    }}
                                    className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1"
                                  >
                                    <Trash2 size={13} />
                                    انهدام کامل
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>

                          <Card className="p-6 border border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                  <HardDrive size={20} />
                                </div>
                                <div>
                                  <h4 className="font-black text-slate-900 dark:text-white">پشتیبان‌گیری خودکار روزانه</h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-6">
                                    سرور هر روز یک نسخه از دیتابیس را در پوشهٔ بکاپ ذخیره می‌کند؛ این گزینه بلافاصله ذخیره می‌شود.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={form.autoBackup !== false}
                                disabled={savingAutoBackup}
                                onClick={() => handleAutoBackupChange(form.autoBackup === false)}
                                className={cn(
                                  'relative inline-flex h-8 w-14 items-center rounded-full transition-colors disabled:opacity-60 shrink-0',
                                  form.autoBackup !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                                )}
                              >
                                <span className={cn('inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform', form.autoBackup !== false ? 'translate-x-1' : 'translate-x-7')} />
                                <span className="sr-only">{form.autoBackup !== false ? 'روشن' : 'خاموش'}</span>
                              </button>
                            </div>
                          </Card>

                          {/* Backup & Restore Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <Card className="p-8 md:p-10 border-none shadow-sm text-center flex flex-col items-center bg-indigo-600 text-white rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24" />
                                <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 shadow-2xl group-hover:rotate-6 transition-transform">
                                   <Download size={40} className="text-indigo-100" />
                                </div>
                                <h4 className="text-xl font-black mb-3">استخراج نسخه پشتیبان</h4>
                                <p className="text-xs font-bold mb-8 px-6 text-indigo-100/70 leading-relaxed">دریافت تمامی داده‌های سیستم در قالب یک فایل استاندارد JSON</p>
                                <Button onClick={exportData} className="w-full h-14 rounded-2xl bg-white text-indigo-700 font-extrabold text-base transition-all hover:bg-indigo-50 cursor-pointer">بارگیری فایل دیتابیس</Button>
                             </Card>

                             <Card className="p-8 md:p-10 border border-gray-100 dark:border-slate-800 shadow-sm text-center flex flex-col items-center bg-white dark:bg-slate-900 rounded-3xl relative overflow-hidden group hover:scale-[1.01] transition-all">
                                <div className="absolute top-0 left-0 w-48 h-48 bg-gray-50 rounded-full -ml-24 -mt-24" />
                                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:-rotate-6 transition-transform">
                                   <Upload size={40} />
                                </div>
                                <h4 className="text-xl font-black text-gray-900 dark:text-white mb-3">بازیابی اطلاعات کلوپ</h4>
                                <p className="text-xs font-bold text-gray-400 mb-8 px-6 leading-relaxed">بارگذاری فایل JSON بکاپ قبلی و بازگردانی کلیه سوابق.</p>
                                <label className="w-full">
                                   <div className="w-full h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-extrabold text-base shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 cursor-pointer transition-all">انتخاب فایل از سیستم</div>
                                   <input type="file" className="hidden" accept=".json" onChange={handleFileChange} />
                                </label>
                             </Card>
                          </div>

                          {/* Hard Reset Card */}
                          <Card className="p-6 md:p-8 border border-gray-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-3xl">
                              <div className="absolute top-0 right-0 w-2 h-full bg-rose-600" />
                              <h4 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2.5">
                                 <Trash2 className="text-rose-600" size={22} />
                                 پاکسازی و بازگشت به تنظیمات کارخانه (Reset کل پایگاه داده)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                 <div className="p-6 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-500/20 flex items-center justify-between group hover:bg-rose-700 transition-all cursor-pointer" onClick={() => setShowClearModal(true)}>
                                    <div className="text-right">
                                       <p className="font-black mb-1 text-base">انهدام کامل تمامی جداول دیتابیس (Reset)</p>
                                       <p className="text-xs opacity-80 font-bold leading-relaxed">تمامی اطلاعات کلوپ و جداول به حالت خام اولیه برمی‌گردند</p>
                                     </div>
                                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:rotate-12 transition-transform shrink-0">
                                       <Trash2 size={26} />
                                    </div>
                                 </div>
                              </div>
                          </Card>
                        </div>
                      )}
                    </div>
                  )}

                  {(activeTab === 'users' || activeTab === 'permissions') && (
                    <div className="space-y-8">
                      {/* 2-Part Sub-navigation: کاربران و سطوح دسترسی */}
                      <div className="bg-white dark:bg-slate-900 p-2 md:p-3 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleSetUserSubTab('users')}
                            className={cn(
                              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all duration-200 cursor-pointer",
                              userSubTab === 'users'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            )}
                          >
                            <Users size={17} />
                            <span>کاربران ({systemUsers?.length || 0})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetUserSubTab('levels')}
                            className={cn(
                              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all duration-200 cursor-pointer",
                              userSubTab === 'levels'
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            )}
                          >
                            <ShieldCheck size={17} />
                            <span>سطوح دسترسی و نقش‌ها</span>
                          </button>
                        </div>

                        <div className="text-xs text-slate-400 dark:text-slate-500 font-bold hidden md:block px-2">
                          {userSubTab === 'users' ? 'تعریف پرسنل، ویرایش مشخصات، کلمه عبور و اتصال به مشتری' : 'پیکربندی دقیق سطح دسترسی هر نقش به بخش‌های سیستم'}
                        </div>
                      </div>

                      {userSubTab === 'users' && (
                      /* Main system users list and create form */
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                        {/* Users grid list (8 cols on XL) */}
                        <div className="xl:col-span-8 space-y-6">
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                لیست کاربران فعال سیستم
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full font-mono">
                                  {systemUsers?.length || 0} کاربر
                                </span>
                              </h3>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-805">
                              <div className="relative flex-1 w-full">
                                <span className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 pointer-events-none">
                                  <Search size={16} />
                                </span>
                                <input
                                  type="text"
                                  placeholder="جستجوی کاربر بر اساس نام، شناسه کاربری، تلفن همراه یا نقش سیستم..."
                                  value={userSearchTerm}
                                  onChange={(e) => setUserSearchTerm(e.target.value)}
                                  className="w-full h-11 pr-10 pl-4 bg-slate-50 dark:bg-slate-950/45 border border-slate-150 dark:border-slate-800 rounded-xl outline-none text-xs md:text-sm font-bold text-slate-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 block text-right"
                                />
                              </div>
                              <Button
                                onClick={() => {
                                  resetUserForm();
                                  setUserFormOpen(true);
                                }}
                                className="h-11 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs shrink-0"
                              >
                                <Plus size={16} />
                                کاربر سیستم جدید
                              </Button>
                            </div>
                          </div>

                          {(!systemUsers || systemUsers.length === 0) ? (
                            <div className="p-12 text-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users size={28} className="text-slate-400" />
                              </div>
                              <h5 className="font-black text-slate-700 dark:text-slate-200 text-sm mb-1.5">هیچ کاربری ثبت نشده است</h5>
                              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                                هم‌اکنون از حساب پیش‌فرض <span className="font-mono bg-slate-950 text-white px-1 py-0.5 rounded border border-slate-800">admin</span> استفاده می‌شود. با ایجاد کاربر جدید، امکانات اختصاصی برای هر ادمین یا اپراتور فعال می‌شود.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {filteredSystemUsers.length === 0 ? (
                                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                                    <Search size={22} />
                                  </div>
                                  <h5 className="text-sm font-black text-slate-700 dark:text-slate-300">نتیجه‌ای یافت نشد</h5>
                                  <p className="text-xs text-slate-400 mt-1">با عبارت جستجوی وارد شده هیچ یک از کاربران سیستم مطابقت ندارد.</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {filteredSystemUsers.map((user: any) => {
                                    const linkedClient = clients?.find((c: any) => c.id === user.clientId);
                                    return (
                                      <Card key={user.id} className="p-5 border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-right">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
                                    
                                    <div className="flex justify-between items-start">
                                      <div className="flex gap-3">
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                                          <Users size={20} />
                                        </div>
                                        <div>
                                          <h4 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                            {user.fullName}
                                            {user.isActive === false && (
                                              <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-black dark:bg-red-950/30 dark:text-red-400">غیرفعال</span>
                                            )}
                                          </h4>
                                          <span className="text-xs font-bold text-slate-450 block mt-0.5 font-mono">
                                            @{user.username}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                        <button 
                                          type="button"
                                          onClick={() => handleEditUser(user)}
                                          className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:scale-110 transition-all dark:bg-indigo-950/40 dark:text-indigo-400 cursor-pointer"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleDeleteUser(user)}
                                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:scale-110 transition-all dark:bg-rose-950/40 dark:text-rose-400 cursor-pointer"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/60 flex items-center justify-between text-xs font-bold">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-slate-400">نقش سیستم:</span>
                                        <span className={cn(
                                          "px-2 py-0.5 rounded-full text-[10px] font-black",
                                          user.role === 'admin' ? "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" :
                                          user.role === 'operator' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                          user.role === 'client' ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" :
                                          "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                                        )}>
                                          {rolesList[user.role] || user.role}
                                        </span>
                                      </div>

                                      {user.role === 'client' && linkedClient && (
                                        <div className="text-[10px] text-slate-450 flex items-center gap-1">
                                          <span>متصل به:</span>
                                          <span className="text-indigo-600 dark:text-indigo-400 underline font-black">{linkedClient.name}</span>
                                        </div>
                                      )}
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                        {/* Expandable Form panel (4 cols on XL) */}
                        <div className="xl:col-span-4">
                          <AnimatePresence mode="wait">
                            {(userFormOpen || userEditingId) && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm"
                              >
                                <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100 dark:border-slate-800">
                                  <h4 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
                                    {userEditingId ? 'ویرایش اطلاعات کاربر' : 'تعریف کاربر سیستم جدید'}
                                  </h4>
                                  <button type="button" onClick={resetUserForm} className="text-xs text-slate-400 hover:text-red-500 font-bold cursor-pointer">بستن</button>
                                </div>

                                <form onSubmit={handleSaveUser} className="space-y-4 text-right">
                                  <Input
                                    label="نام کاربری (جهت ورود به سیستم) *"
                                    value={userFormUsername}
                                    onChange={e => setUserFormUsername(e.target.value)}
                                    placeholder="مثلاً: 09123456789 یا admin"
                                    required
                                    className="h-11 bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                                  />
                                  <Input
                                    label="نام و نام خانوادگی کاربر *"
                                    value={userFormFullName}
                                    onChange={e => setUserFormFullName(e.target.value)}
                                    placeholder="مثلاً: علی رضایی"
                                    required
                                    className="h-11 bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                                  />

                                  <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1.5">رمز عبور اختصاصی *</label>
                                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                      <input
                                        type={showUserPassword ? 'text' : 'password'}
                                        placeholder="رمز عبور جهت ورود به حساب (پیش‌فرض: 1234)"
                                        value={userFormPassword}
                                        onChange={e => setUserFormPassword(e.target.value)}
                                        className="w-full h-11 bg-slate-50/70 dark:bg-slate-950/40 outline-none text-right pr-4 pl-12 rounded-2xl text-xs md:text-sm font-bold text-slate-900 dark:text-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowUserPassword(!showUserPassword)}
                                        className="absolute inset-y-0 left-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                      >
                                        {showUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1.5">نقش دسترسی کاربر *</label>
                                    <select
                                      value={userFormRole}
                                      onChange={(e) => setUserFormRole(e.target.value)}
                                      className="w-full h-11 px-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 outline-none text-xs md:text-sm font-bold text-slate-800 dark:text-white"
                                    >
                                      {Object.keys(permissions).map((key) => {
                                        const label = rolesList[key] || key;
                                        return (
                                          <option key={key} value={key}>
                                            {label}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>

                                  {userFormRole === 'client' && (
                                    <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 text-[11px] font-bold text-indigo-900 dark:text-indigo-200 leading-relaxed">
                                      ✓ اطلاعات این حساب به صورت خودکار با لیست مشتریان کلوپ، سوابق بازی‌ها، شارژ کیف پول و سطوح وفاداری همگام‌سازی می‌شود.
                                    </div>
                                  )}

                                  <Input
                                    label="تلفن همراه کاربر"
                                    value={userFormPhone}
                                    onChange={e => setUserFormPhone(e.target.value)}
                                    placeholder="مثال: 09123456789"
                                    className="h-11 bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                                  />

                                  <div className="flex items-center gap-3 pt-2 text-right justify-start">
                                    <input
                                      type="checkbox"
                                      id="user_active_chk"
                                      checked={userFormIsActive}
                                      onChange={e => setUserFormIsActive(e.target.checked)}
                                      className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-800 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <label htmlFor="user_active_chk" className="text-xs font-extrabold text-slate-700 dark:text-slate-300 cursor-pointer">
                                      حساب کاربری فعال باشد
                                    </label>
                                  </div>

                                  <div className="flex gap-2.5 pt-4">
                                    <Button
                                      type="submit"
                                      className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-md shadow-indigo-500/20"
                                    >
                                      {userEditingId ? 'بروزرسانی کاربر' : 'ثبت کاربر سیستم'}
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={resetUserForm}
                                      variant="outline"
                                      className="h-11 px-4 text-slate-500 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold"
                                    >
                                      لغو
                                    </Button>
                                  </div>
                                </form>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      )}

                      {userSubTab === 'levels' && (
                        <div className="space-y-6">

                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        {/* Right Column: Roles list and Role creation form */}
                        <div className="xl:col-span-5 space-y-6">
                          <Card className="p-6 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl text-right shadow-sm">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                              <div>
                                <h4 className="text-sm md:text-base font-black text-slate-900 dark:text-white">نقش‌های تعریف شده</h4>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5 font-sans">برای تنظیم دسترسی روی نقش ضربه بزنید</p>
                              </div>

                              {!roleFormOpen && (
                                <Button 
                                  onClick={() => {
                                    setRoleEditingKey(null);
                                    setRoleFormKey('');
                                    setRoleFormLabel('');
                                    setRoleFormOpen(true);
                                  }}
                                  className="h-8 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Plus size={14} />
                                  نقش جدید
                                </Button>
                              )}
                            </div>

                            {/* Dynamic Role Create/Edit Form */}
                            {roleFormOpen && (
                              <form onSubmit={handleCreateOrUpdateRole} className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 mb-6 space-y-4">
                                <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                                  {roleEditingKey ? <Edit2 size={13} className="text-indigo-600" /> : <Plus size={13} className="text-indigo-600" />}
                                  {roleEditingKey ? `ویرایش عنوان نقش «${rolesList[roleEditingKey] || roleEditingKey}»` : 'ثبت نقش کاربری جدید'}
                                </h5>

                                <div className="space-y-1.5 text-right">
                                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-350 mr-1.5 block">عنوان نقش (به فارسی)</label>
                                  <input
                                    type="text"
                                    placeholder="مثلا: حسابدار یا سرپرست شیفت"
                                    value={roleFormLabel}
                                    onChange={e => setRoleFormLabel(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 outline-none text-xs font-bold text-slate-800 dark:text-white"
                                    required
                                  />
                                </div>

                                {!roleEditingKey && (
                                  <div className="space-y-1.5 text-right">
                                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-350 mr-1.5 block">شناسه لاتین نقش (بدون فاصله)</label>
                                    <input
                                      type="text"
                                      placeholder="مثال: supervisor"
                                      value={roleFormKey}
                                      onChange={e => setRoleFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 outline-none text-xs font-bold font-mono text-slate-800 dark:text-white text-left ltr-input"
                                      required
                                    />
                                    <p className="text-[9px] text-slate-400 block mr-1 leading-normal">این شناسه در پایگاه‌داده ذخیره شده و پس از ایجاد غیرقابل ویرایش است.</p>
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <Button 
                                    type="submit"
                                    className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer"
                                  >
                                    {roleEditingKey ? 'بروزرسانی' : 'ثبت قطعی'}
                                  </Button>
                                  <Button 
                                    type="button" 
                                    onClick={() => {
                                      setRoleFormOpen(false);
                                      setRoleFormKey('');
                                      setRoleFormLabel('');
                                      setRoleEditingKey(null);
                                    }}
                                    variant="outline"
                                    className="h-9 px-3 text-slate-550 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black cursor-pointer"
                                  >
                                    لغو
                                  </Button>
                                </div>
                              </form>
                            )}

                            {/* Active roles cards list */}
                            <div className="space-y-3">
                              {Object.keys(permissions).map((roleKey) => {
                                const label = rolesList[roleKey] || roleKey;
                                const isSelected = selectedRole === roleKey;
                                const isDefault = ['admin', 'operator', 'client'].includes(roleKey);
                                const allowedCount = (permissions[roleKey] || []).length;

                                return (
                                  <div 
                                    key={roleKey}
                                    onClick={() => setSelectedRole(roleKey)}
                                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-right flex items-center justify-between ${
                                      isSelected 
                                        ? 'bg-indigo-50/45 dark:bg-indigo-950/20 border-indigo-500 dark:border-indigo-400/80 shadow-sm' 
                                        : 'bg-slate-50/20 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800/85 hover:border-indigo-200 dark:hover:border-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                        isSelected 
                                          ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' 
                                          : 'bg-slate-105 dark:bg-slate-800/85 text-slate-450 dark:text-slate-400'
                                      }`}>
                                        <Shield size={18} />
                                      </div>
                                      <div>
                                        <h5 className="font-extrabold text-slate-900 dark:text-white text-xs md:text-sm flex items-center gap-1.5">
                                          {label}
                                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                                        </h5>
                                        <div className="flex items-center gap-1.5 mt-1 font-sans">
                                          <span className="text-[10px] text-slate-400 font-mono">@{roleKey}</span>
                                          <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-black">{allowedCount} بخش مجاز</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                                      {isDefault ? (
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-450 dark:text-slate-400 text-[8px] font-black flex items-center gap-1">
                                          <Lock size={10} />
                                          پیش‌فرض
                                        </span>
                                      ) : (
                                        <div className="flex gap-0.5">
                                          <button 
                                            type="button"
                                            onClick={() => {
                                              setRoleEditingKey(roleKey);
                                              setRoleFormLabel(label);
                                              setRoleFormKey(roleKey);
                                              setRoleFormOpen(true);
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-500 hover:text-indigo-650 transition-colors cursor-pointer"
                                            title="ویرایش عنوان"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => setRoleToDelete(roleKey)}
                                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="حذف کامل نقش"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        </div>

                        {/* Left Column: Permissions Matrix for the chosen role */}
                        <div className="xl:col-span-7">
                          <Card className="p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl text-right shadow-sm">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2.5">
                                <Shield size={24} className="text-indigo-650 dark:text-indigo-400 animate-pulse" />
                                <div>
                                  <h4 className="text-sm md:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                    مجوزها و دسترسی منوی: {rolesList[selectedRole] || selectedRole}
                                    {['admin', 'operator', 'client'].includes(selectedRole) && (
                                      <Lock size={14} className="text-amber-500" />
                                    )}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                    {['admin', 'operator', 'client'].includes(selectedRole)
                                      ? 'دسترسی‌های این نقش سیستمی قفل شده و غیرقابل تغییر است'
                                      : 'منوهای مجاز این نقش را فعال یا غیرفعال سازید'}
                                  </p>
                                </div>
                              </div>

                              <span className="text-[10px] font-mono text-slate-405 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg">
                                @{selectedRole}
                              </span>
                            </div>

                            <div className="space-y-3">
                              {[
                                { path: '/', label: 'داشبورد اصلی و پیشخوان مرکزی', description: 'نمای کلی آمار کلوپ، خلاصه شیفت، نمودار نقدینگی و وضعیت کلی بازی‌ها', icon: Globe },
                                { path: '/consoles', label: 'مدیریت و کنترل دستگاه‌ها', description: 'کنترل زنده وضعیت سیستم‌ها، محاسبه خودکار مبلغ بازی، جابجایی تعرفه و کنترل زمان', icon: HardDrive },
                                { path: '/products', label: 'بوفه و فروشگاه دیجیتال کلوپ', description: 'ثبت و مدیریت فاکتور کالاهای فروخته شده بوفه متصل به سیستم و موجودی کالا', icon: Sliders },
                                { path: '/clients', label: 'حقوقی و مدیریت مستقیم مشتریان', description: 'مدیریت حساب اعتباری مشتریان، ریز تراکنش‌های اعضا، باشگاه تخفیف‌ها و سوابق بازی', icon: Users },
                                { path: '/reservations', label: 'سامانه رزرواسیون و نوبت‌دهی', description: 'ثبت و کنترل نوبت‌ها در شیفت‌های مختلف برای کلاینت‌ها و پیشگیری از تداخل سیستم‌ها', icon: Calendar },
                                { path: '/reports', label: 'گزارش تفصیلی صندوق و جریان مالی', description: 'گزارش دقیق سود، زیان، واریز و برداشت صندوق‌های نقدی، درآمد کل سیستم و جزئیات شیفت', icon: Info },
                                { path: '/analytics', label: 'آمار و تحلیل گرافیکی عملکرد کلوپ', description: 'گزارش مصور آماری از پرفروش‌ترین ساعات بازی، محبوب‌ترین بازی بوفه و بهینه‌سازی درآمد', icon: TrendingUp },
                                { path: '/staff-attendance', label: 'حضور و غیاب پرسنل', description: 'مدیریت پرسنل، ثبت ورود و خروج و گزارش دوره‌ای ساعت کاری', icon: Clock },
                                { path: '/goals', label: 'تعیین هدف مالی کلوپ و بازدهی', description: 'هدف‌گذاری درآمدی کلوپ و مشاهده گرافیکی میزان تحقق آن برای هدایت اهداف تجاری', icon: Target },
                                { path: '/stocks', label: 'مدیریت شرکا، سهامداری و هزینه‌ها', description: 'ثبت هزینه‌های جاری، پرداخت سود شرکا، حسابداری سهامداری و کنترل هزینه‌های ثابت', icon: Database },
                                { path: '/settings', label: 'پیکربندی سیستم و مدیریت تنظیمات کلوپ', description: 'تنظیم تیک‌های بوفه، تعریف تخفیف کلاینت، اتصال پایگاه داده، قفل سیستم و مدیریت سطوح دسترسی', icon: SettingsIcon }
                              ].map((module) => {
                                const IconComponent = module.icon;
                                const isAllowed = (permissions[selectedRole] || []).includes(module.path);
                                const isDefaultRole = ['admin', 'operator', 'client'].includes(selectedRole);

                                return (
                                  <div 
                                    key={module.path}
                                    onClick={() => handleTogglePermission(selectedRole, module.path)}
                                    className={`p-3.5 rounded-2xl border transition-all duration-150 flex items-center justify-between group ${
                                      isDefaultRole ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'
                                    } ${
                                      isAllowed 
                                        ? 'bg-emerald-50/15 dark:bg-emerald-950/10 border-emerald-500/30' 
                                        : 'bg-slate-50/20 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800'
                                    }`}
                                  >
                                    <div className="flex gap-4 items-start text-right">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                        isAllowed 
                                          ? 'bg-emerald-100/90 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' 
                                          : 'bg-slate-100 text-slate-450 dark:bg-slate-800 dark:text-slate-400'
                                      }`}>
                                        <IconComponent size={18} />
                                      </div>
                                      <div>
                                        <h5 className="font-extrabold text-slate-850 dark:text-slate-200 text-xs md:text-sm">{module.label}</h5>
                                        <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-1 leading-relaxed max-w-sm md:max-w-md font-medium">{module.description}</p>
                                      </div>
                                    </div>

                                    <div className="pr-4 shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={isAllowed}
                                        disabled={isDefaultRole}
                                        onChange={() => {}} // handled by parent div click
                                        className="w-4 h-4 text-emerald-600 border-slate-350 dark:border-slate-800 rounded focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

                  {activeTab === 'loyalty' && (
                    <div className="space-y-10 text-right" dir="rtl">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">کلوپ وفاداری و جشنواره‌ها</h3>
                        <p className="text-slate-500 font-medium text-xs">مدیریت فستیوال‌های موقت و دائم کسب امتیاز اضافه باشگاه مراجعین و ویترین جوایز کلوپ</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        {/* FIRST SECTION: FESTIVALS MANAGEMENT */}
                        <div className="space-y-6">
                          <Card className="p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                                  <Award size={20} />
                                </div>
                                <div>
                                  <h4 className="text-base font-black text-slate-950 dark:text-white">جشنواره‌های امتیازگیری</h4>
                                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تعریف کمپین بازی و شارژ و کسب امتیاز اضافه</p>
                                </div>
                              </div>

                              <Button
                                onClick={() => {
                                  setFestEditingId(null);
                                  setFestTitle('');
                                  setFestDescription('');
                                  setFestPoints('15');
                                  setFestIsActive(true);
                                  setFestIsFixed(false);
                                  setFestFormOpen(!festFormOpen);
                                }}
                                className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 font-bold text-xs text-white"
                              >
                                {festFormOpen ? 'بستن فرم' : 'جشنواره جدید'}
                              </Button>
                            </div>

                            <AnimatePresence>
                              {festFormOpen && (
                                <motion.form
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  onSubmit={handleSaveFestival}
                                  className="space-y-4 overflow-hidden mb-6 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850"
                                >
                                  <h5 className="text-xs font-black text-amber-600 block mb-2">
                                    {festEditingId ? '⚠️ ویرایش جشنواره امتیازدهی' : '✨ ثبت جشنواره انتیاز دهی کلوپ'}
                                  </h5>

                                  <Input
                                    label="عنوان جشنواره"
                                    placeholder="مثلاً: بونوس شارژ کلاب طلایی"
                                    value={festTitle}
                                    onChange={e => setFestTitle(e.target.value)}
                                    className="h-11 bg-white dark:bg-slate-900 border-slate-100 font-bold"
                                    required
                                  />

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input
                                      label="فرمول یا مقدار امتیاز"
                                      placeholder="مثلاً: ۱۵ یا هر ۱۰,۰۰۰ تومان ۱ امتیاز"
                                      value={festPoints}
                                      onChange={e => setFestPoints(e.target.value)}
                                      className="h-11 bg-white dark:bg-slate-900 border-slate-100 font-black text-amber-500 font-sans"
                                      required
                                    />

                                    <div className="flex flex-col gap-1 text-right">
                                      <label className="text-xs font-black text-slate-700 dark:text-slate-350 block mr-1 mt-1">نوع جشنواره</label>
                                      <button
                                        type="button"
                                        onClick={() => setFestIsFixed(!festIsFixed)}
                                        className={cn(
                                          "h-11 px-4 rounded-xl flex items-center justify-between border transition-all font-bold text-xs bg-white dark:bg-slate-900",
                                          festIsFixed
                                            ? "border-indigo-250 text-indigo-600 dark:text-indigo-400"
                                            : "border-amber-250 text-amber-600 dark:text-amber-500"
                                        )}
                                      >
                                        <span>{festIsFixed ? 'ثابت (فرمول دائم)' : 'جشنواره موقت'}</span>
                                        <div className={cn("w-3 h-3 rounded-full", festIsFixed ? "bg-indigo-500" : "bg-amber-500")} />
                                      </button>
                                    </div>

                                    <div className="flex flex-col gap-1 text-right">
                                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1 mt-1">وضعیت فعال</label>
                                      <button
                                        type="button"
                                        onClick={() => setFestIsActive(!festIsActive)}
                                        className={cn(
                                          "h-11 px-4 rounded-xl flex items-center justify-between border transition-all font-bold text-xs bg-white dark:bg-slate-900",
                                          festIsActive
                                            ? "border-emerald-250 text-emerald-600 dark:text-emerald-450"
                                            : "border-slate-100 text-slate-400"
                                        )}
                                      >
                                        <span>{festIsActive ? 'فعال و زنده' : 'غیرفعال موقت'}</span>
                                        <div className={cn("w-3 h-3 rounded-full", festIsActive ? "bg-emerald-500" : "bg-gray-300")} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1">توضیحات و قوانین کمپین</label>
                                    <textarea
                                      rows={3}
                                      value={festDescription}
                                      onChange={e => setFestDescription(e.target.value)}
                                      placeholder="توضیح دهید کاربر چطور این امتیاز را بدست می آورد..."
                                      className="w-full text-xs font-bold text-right p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none"
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs h-10 rounded-xl">
                                      {festEditingId ? 'بروزرسانی جشنواره' : 'ذخیره جشنواره'}
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        setFestFormOpen(false);
                                        setFestEditingId(null);
                                        setFestIsFixed(false);
                                      }}
                                      variant="outline"
                                      className="h-10 rounded-xl font-bold text-xs"
                                    >
                                      انصراف
                                    </Button>
                                  </div>
                                </motion.form>
                              )}
                            </AnimatePresence>

                            <div className="space-y-3">
                              <h5 className="text-xs font-black text-slate-900 dark:text-white">جشنواره‌های جاری مراجعین:</h5>
                              {pointsFestivals?.length === 0 && (
                                <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-100">
                                  <p className="text-xs text-slate-400 font-bold">هیچ جشنواره امتیازی در سیستم تعریف نشده است.</p>
                                </div>
                              )}
                              {pointsFestivals?.map((fest: any) => (
                                <div key={fest.id} className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 flex items-start justify-between gap-3 text-right">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", fest.isActive ? "bg-amber-500 animate-pulse" : "bg-gray-300")} />
                                      <span className="text-xs font-black text-slate-950 dark:text-white">{fest.title}</span>
                                      {fest.isFixed ? (
                                        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-350 border-none font-black text-[9px] px-2 py-0.5">فرمول دائم</Badge>
                                      ) : (
                                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-none font-black text-[9px] px-2 py-0.5">جشنواره موقت</Badge>
                                      )}
                                      <Badge className="bg-amber-500/10 text-amber-600 border-none font-sans font-bold text-[9px] px-2 py-0.5">{fest.points} امتیاز</Badge>
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed max-w-sm">{fest.description}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setFestEditingId(fest.id);
                                        setFestTitle(fest.title);
                                        setFestDescription(fest.description || '');
                                        setFestPoints(String(fest.points));
                                        setFestIsActive(fest.isActive !== false);
                                        setFestIsFixed(!!fest.isFixed);
                                        setFestFormOpen(true);
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-slate-950 rounded-lg h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                                      title="ویرایش"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteFestival(fest.id)}
                                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                                      title="حذف"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </div>

                        {/* SECOND SECTION: REWARDS / WEETRIN GOZINEHAYE KHARID */}
                        <div className="space-y-6">
                          <Card className="p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                  <Gift size={20} />
                                </div>
                                <div>
                                  <h4 className="text-base font-black text-slate-950 dark:text-white">فروشگاه جوایز (خرید با امتیاز)</h4>
                                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تعریف جوایز نفیس و اعمال خودکار به کلاینت</p>
                                </div>
                              </div>

                              <Button
                                onClick={() => {
                                  setRewardEditingId(null);
                                  setRewardTitle('');
                                  setRewardDescription('');
                                  setRewardCost('30');
                                  setRewardType('wallet_cashback');
                                  setRewardValue('10000');
                                  setRewardIsActive(true);
                                  setRewardFormOpen(!rewardFormOpen);
                                }}
                                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white"
                              >
                                {rewardFormOpen ? 'بستن فرم' : 'جایزه جدید'}
                              </Button>
                            </div>

                            <AnimatePresence>
                              {rewardFormOpen && (
                                <motion.form
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  onSubmit={handleSaveReward}
                                  className="space-y-4 overflow-hidden mb-6 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850"
                                >
                                  <h5 className="text-xs font-black text-indigo-600 block mb-2">
                                    {rewardEditingId ? '⚠️ ویرایش هدیه فاداری' : '🎁 تعریف هدیه و جایزه جدید'}
                                  </h5>

                                  <div className="grid grid-cols-2 gap-4">
                                    <Input
                                      label="عنوان جایزه"
                                      placeholder="مثلاً: شارژ ۵۰ هزاری کیف پول"
                                      value={rewardTitle}
                                      onChange={e => setRewardTitle(e.target.value)}
                                      className="h-11 bg-white dark:bg-slate-900 border-slate-100 font-bold"
                                      required
                                    />
                                    <div className="flex flex-col gap-1 text-right">
                                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1 mt-1">نوع عملیات هدیه (نوع جایزه)</label>
                                      <select
                                        value={rewardType}
                                        onChange={e => {
                                          const val = e.target.value as any;
                                          setRewardType(val);
                                          if (val === 'wallet_cashback') setRewardValue('10000');
                                          else if (val === 'custom_nickname') setRewardValue('10');
                                          else if (val === 'profile_avatar_unlock') setRewardValue('30');
                                          else if (val === 'free_game') setRewardValue('1_hour_free');
                                          else setRewardValue('COUPON-' + Math.random().toString(36).substring(3,8).toUpperCase());
                                        }}
                                        className="h-11 w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-2.5 text-xs font-black text-slate-800 dark:text-gray-300 focus:outline-none"
                                      >
                                        <option value="wallet_cashback">💰 شارژ کیف‌پول هوشمند (نقدی)</option>
                                        <option value="custom_nickname">✏️ تغییر نام مستعار و لقب کارت کلوپ</option>
                                        <option value="profile_avatar_unlock">🖼️ فعال‌سازی منوی تغییر عکس (premium)</option>
                                        <option value="discount_coupon">🎟️ کد تخفیف کادویی بوفه/ساعت بازی</option>
                                        <option value="free_game">🎮 بازی رایگان یا تفریح کلوپ</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-4">
                                    <Input
                                      label="امتیاز لازم"
                                      type="number"
                                      placeholder="30"
                                      value={rewardCost}
                                      onChange={e => setRewardCost(e.target.value)}
                                      className="h-11 bg-white dark:bg-slate-900 border-slate-105 font-black text-indigo-500"
                                      required
                                    />

                                    <div className="col-span-2">
                                      <Input
                                        label={
                                          rewardType === 'wallet_cashback' 
                                            ? 'مبلغ شارژ (تومان)' 
                                            : rewardType === 'discount_coupon' 
                                              ? 'کد تخفیف اختصاصی یا درصد' 
                                              : 'مقدار فرعی'
                                        }
                                        placeholder={rewardType === 'wallet_cashback' ? 'مثال: ۵۰۰۰۰' : 'مثال: DISC20'}
                                        value={rewardValue}
                                        onChange={e => setRewardValue(e.target.value)}
                                        disabled={rewardType === 'custom_nickname' || rewardType === 'profile_avatar_unlock' || rewardType === 'free_game'}
                                        className="h-11 bg-white dark:bg-slate-900 border-slate-105 font-bold"
                                        required
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mr-1">توضیح کوتاه ویترین</label>
                                    <textarea
                                      rows={2}
                                      value={rewardDescription}
                                      onChange={e => setRewardDescription(e.target.value)}
                                      placeholder="به عنوان مثال: شارژ فورا روی کیف پول الکترونیکی کارت شما هدیه داده می شود."
                                      className="w-full text-xs font-bold text-right p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none"
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-10 rounded-xl">
                                      {rewardEditingId ? 'بروزرسانی جایزه کلوپ' : 'ذخیره جایزه کلوپ'}
                                    </Button>
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        setRewardFormOpen(false);
                                        setRewardEditingId(null);
                                      }}
                                      variant="outline"
                                      className="h-10 rounded-xl font-bold text-xs"
                                    >
                                      انصراف
                                    </Button>
                                  </div>
                                </motion.form>
                              )}
                            </AnimatePresence>

                            <div className="space-y-3">
                              <h5 className="text-xs font-black text-slate-900 dark:text-white">جوایز ویترین کلوپ:</h5>
                              {pointsRewards?.length === 0 && (
                                <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-100">
                                  <p className="text-xs text-slate-400 font-bold">هیچ جایزه‌ای در فروشگاه جوایز ثبت نشده است.</p>
                                </div>
                              )}
                              {pointsRewards?.map((reward: any) => (
                                <div key={reward.id} className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 flex items-start justify-between gap-3 text-right">
                                  <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                                      <span className="text-xs font-black text-slate-950 dark:text-white">{reward.title}</span>
                                      <Badge className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-none font-black text-[9px] px-2">{reward.cost} امتیاز کلوپ</Badge>
                                      <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        {reward.type === 'wallet_cashback' && '💰 نقدی کیف‌پول'}
                                        {reward.type === 'custom_nickname' && '✏️ تغییر لقب'}
                                        {reward.type === 'profile_avatar_unlock' && '🖼️ آنلاک عکس پروفایل'}
                                        {reward.type === 'discount_coupon' && '🎟️ کدهای هماهنگ'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-505 font-bold leading-relaxed max-w-sm">{reward.description}</p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setRewardEditingId(reward.id);
                                        setRewardTitle(reward.title);
                                        setRewardDescription(reward.description || '');
                                        setRewardCost(String(reward.cost));
                                        setRewardType(reward.type);
                                        setRewardValue(String(reward.value || ''));
                                        setRewardIsActive(reward.isActive !== false);
                                        setRewardFormOpen(true);
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-slate-950 rounded-lg h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                                      title="ویرایش"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteReward(reward.id)}
                                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg h-8 w-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                                      title="حذف"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Custom User Deletion Confirmation Modal */}
             <AnimatePresence>
               {userToDelete && (
                 <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/40 transition-all font-sans" dir="rtl">
                   <motion.div 
                     initial={{ scale: 0.95, opacity: 0, y: 15 }}
                     animate={{ scale: 1, opacity: 1, y: 0 }}
                     exit={{ scale: 0.95, opacity: 0, y: -15 }}
                     className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 text-right overflow-hidden relative"
                   >
                     <div className="absolute top-0 right-0 w-full h-2 bg-rose-600" />
                     
                     <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/45 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                       <Trash2 size={24} />
                     </div>
                     
                     <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">تأیید حذف کاربر سیستم</h4>
                     <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                       آیا از حذف حساب کاربری <span className="text-slate-900 dark:text-white font-black">{userToDelete.fullName} (username: @{userToDelete.username})</span> اطمینان کامل دارید؟ این عمل غیرقابل بازگشت است.
                     </p>
                     
                     <div className="flex gap-3">
                       <Button
                         onClick={async () => {
                           try {
                             await remove('system_users', userToDelete.id);
                             showToast('کاربر سیستم با موفقیت حذف شد.', 'success');
                           } catch (err: any) {
                             showToast('خطا در حذف کاربر: ' + (err.message || 'خطا'), 'error');
                           } finally {
                             setUserToDelete(null);
                           }
                         }}
                         className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs cursor-pointer"
                       >
                         بله، حذف شود
                       </Button>
                       <Button
                         onClick={() => setUserToDelete(null)}
                         variant="outline"
                         className="flex-1 h-11 text-slate-500 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black cursor-pointer"
                       >
                         انصراف
                       </Button>
                     </div>
                   </motion.div>
                 </div>
               )}
             </AnimatePresence>

             {/* Custom Role Deletion Confirmation Modal */}
              <AnimatePresence>
                {roleToDelete && (
                  <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-slate-950/40 transition-all font-sans" dir="rtl">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: -15 }}
                      className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 text-right overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-full h-2 bg-rose-600" />
                      
                      <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/45 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
                        <Trash2 size={24} />
                      </div>
                      
                      <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">تأیید حذف نقش کاربری</h4>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        آیا از حذف کامل نقش کاربری <span className="text-slate-900 dark:text-white font-black">«{rolesList[roleToDelete] || roleToDelete}» (شناسه: @{roleToDelete})</span> و لغو همیشگی سطوح دسترسی مربوط به آن اطمینان دارید؟
                      </p>
                      
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          onClick={() => handleDeleteRole(roleToDelete)}
                          className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs cursor-pointer"
                        >
                          بله، حذف نقش
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setRoleToDelete(null)}
                          variant="outline"
                          className="flex-1 h-11 text-slate-500 border border-slate-201 dark:border-slate-800 rounded-2xl text-xs font-black cursor-pointer"
                        >
                          انصراف
                        </Button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Custom Database Annihilation Confirmation Modal */}
             <AnimatePresence>
               {showClearModal && (
                 <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 transition-all font-sans" dir="rtl">
                   <motion.div 
                     initial={{ scale: 0.95, opacity: 0, y: 10 }}
                     animate={{ scale: 1, opacity: 1, y: 0 }}
                     exit={{ scale: 0.95, opacity: 0, y: -10 }}
                     className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-rose-100 dark:border-rose-950 text-right overflow-hidden relative"
                   >
                     <div className="absolute top-0 right-0 w-full h-2 bg-rose-600" />
                     
                     {!clearSuccess ? (
                       <>
                         <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                           <Trash2 size={32} />
                         </div>
                         <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-none">تأیید نهایی انهدام پایگاه داده</h4>
                         <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-6 leading-relaxed">
                           با اجرای این دستور، تمامی اطلاعات کلوپ شامل: نشست‌ها، فاکتورهای فروشگاهی، موجودی کالاها، حساب صندوق، مشتریان و اهداف مالی به صورت کامل و غیرقابل بازگشت حذف خواهند شد.
                         </p>
                         
                         <div className="flex gap-3">
                           <Button 
                             onClick={clearData} 
                             className="flex-1 h-12 rounded-[1rem] bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-lg shadow-rose-200 dark:shadow-none"
                           >
                             بله، انهدام کامل
                           </Button>
                           <Button 
                             onClick={() => setShowClearModal(false)} 
                             variant="outline" 
                             className="flex-1 h-12 rounded-[1rem] bg-gray-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm hover:bg-gray-100"
                           >
                             لغو و انصراف
                           </Button>
                         </div>
                       </>
                     ) : (
                       <div className="text-center py-6 flex flex-col items-center">
                         <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
                           <CheckCircle2 size={32} />
                         </div>
                         <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2">انهدام موفقیت‌آمیز</h4>
                         <p className="text-xs font-bold text-emerald-605 dark:text-emerald-400">تمام داده‌ها ریست شدند. سیستم در حال بارگذاری مجدد...</p>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Custom Database Restore Confirmation Modal */}
              <AnimatePresence>
                {showRestoreModal && (
                  <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 transition-all font-sans" dir="rtl">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: -10 }}
                      className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-emerald-100 dark:border-emerald-950 text-right overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-full h-2 bg-emerald-600" />
                      
                      {!restoreSuccess ? (
                        <>
                          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                            <Upload size={32} />
                          </div>
                          <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-none">تأیید نهایی بازیابی اطلاعات</h4>
                          <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-6 leading-relaxed">
                            با بازیابی این فایل بکاپ، تمامی اطلاعات فعلی کلوپ بازنویسی خواهند شد. خلاصه داده‌های شناسایی شده در فایل به شرح زیر است:
                          </p>

                          {restoreSummary && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl mb-6 space-y-2 text-xs font-sans">
                              {restoreSummary.clientsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">تعداد مشتریان:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.clientsCount} نفر</span>
                                </div>
                              )}
                              {restoreSummary.productsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">تعداد کالاها و تنقلات:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.productsCount} قلم</span>
                                </div>
                              )}
                              {restoreSummary.salesCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">تعداد فاکتورهای ثبت شده:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.salesCount} عدد</span>
                                </div>
                              )}
                              {restoreSummary.sessionsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">تعداد نشست‌های بازی:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.sessionsCount} نشست</span>
                                </div>
                              )}
                              {restoreSummary.purchasesCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">آیتم‌های فاکتور خرید بوفه:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.purchasesCount} عدد</span>
                                </div>
                              )}
                              {restoreSummary.promotionsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">طرح‌های جشنواره و تشویقی:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.promotionsCount} طرح</span>
                                </div>
                              )}
                              {restoreSummary.shareholdersCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">تعداد شرکا و سرمایه داران:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.shareholdersCount} نفر</span>
                                </div>
                              )}
                              {restoreSummary.goalsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">خدمات هدف‌گذاری مالی:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.goalsCount} هدف</span>
                                </div>
                              )}
                              {restoreSummary.reservationsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">رزرو نوبت‌های بازی:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.reservationsCount} مورد</span>
                                </div>
                              )}
                              {restoreSummary.purchasesCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">آیتم‌های فاکتور خرید بوفه:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.purchasesCount} عدد</span>
                                </div>
                              )}
                              {restoreSummary.promotionsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">طرح‌های جشنواره و تشویقی:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.promotionsCount} طرح</span>
                                </div>
                              )}
                              {restoreSummary.shareholdersCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">تعداد شرکا و سرمایه داران:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.shareholdersCount} نفر</span>
                                </div>
                              )}
                              {restoreSummary.goalsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">خدمات هدف‌گذاری مالی:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.goalsCount} هدف</span>
                                </div>
                              )}
                              {restoreSummary.reservationsCount > 0 && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">رزرو نوبت‌های بازی:</span>
                                  <span className="font-black text-emerald-600">{restoreSummary.reservationsCount} مورد</span>
                                </div>
                              )}
                              {restoreSummary.settingsFound && (
                                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                  <span className="font-bold">تنظیمات عمومی کلوپ:</span>
                                  <span className="font-black text-emerald-600">آماده راه‌اندازی</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex gap-3">
                            <Button 
                              onClick={confirmRestoreData} 
                              className="flex-1 h-12 rounded-[1rem] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-200 dark:shadow-none"
                            >
                              بله، بازیابی اطلاعات
                            </Button>
                            <Button 
                              onClick={() => {
                                setShowRestoreModal(false);
                                setParsedRestoreData(null);
                              }} 
                              variant="outline" 
                              className="flex-1 h-12 rounded-[1rem] bg-gray-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm hover:bg-gray-100"
                            >
                              انصراف
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6 flex flex-col items-center">
                          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <CheckCircle2 size={32} />
                          </div>
                          <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2">بازیابی موفقیت‌آمیز</h4>
                          <p className="text-xs font-bold text-emerald-605 dark:text-emerald-400">تمامی اطلاعات به درستی بارگذاری شدند. سیستم در حال بارگذاری مجدد...</p>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Custom Generic Delete Confirmation Modal */}
              <AnimatePresence>
                {deleteConfirm && (
                  <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 transition-all font-sans" dir="rtl">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: -10 }}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 text-right"
                    >
                      <h4 className="text-lg font-black text-slate-950 dark:text-white mb-2">تأیید حذف اطلاعات</h4>
                      <p className="text-xs text-slate-550 dark:text-slate-400 mb-6 font-bold leading-relaxed">
                        {deleteConfirm.type === 'promo' 
                          ? 'آیا از حذف این طرح تشویقی مطمئن هستید؟ این عمل غیرقابل بازگشت است.' 
                          : 'آیا از حذف این هزینه ثابت مطمئن هستید؟ این عمل غیرقابل بازگشت است.'}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={async () => {
                            if (deleteConfirm.type === 'promo') {
                              await remove('promotions', deleteConfirm.id);
                            } else {
                              await remove('fixed_expenses', deleteConfirm.id);
                            }
                            setDeleteConfirm(null);
                          }} 
                          className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-200 dark:shadow-none"
                        >
                          بله، حذف شود
                        </Button>
                        <Button 
                          onClick={() => setDeleteConfirm(null)} 
                          variant="outline" 
                          className="flex-1 h-10 rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs hover:bg-gray-100"
                        >
                          انصراف
                        </Button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Database Table Inspection Modal */}
              <AnimatePresence>
                {inspectingTable && (() => {
                  const filteredRecords = (inspectingTable.data || []).filter((item: any) => {
                    if (!inspectSearch.trim()) return true;
                    const term = inspectSearch.trim().toLowerCase();
                    return JSON.stringify(item).toLowerCase().includes(term);
                  });

                  return (
                    <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 transition-all font-sans" dir="rtl">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 max-w-3xl w-full shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                              <Table size={22} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white">
                                  {inspectingTable.title}
                                </h3>
                                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold" dir="ltr">
                                  {inspectingTable.name}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-bold mt-0.5">
                                {inspectingTable.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              onClick={() => handlePurgeTable(inspectingTable)}
                              className="h-9 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors"
                            >
                              <Trash2 size={13} />
                              انهدام کل این جدول
                            </Button>
                            <button
                              onClick={() => {
                                setInspectingTable(null);
                                setInspectSearch('');
                              }}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Status & Key Info Banner */}
                        <div className="grid grid-cols-3 gap-3 my-4 shrink-0">
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                            <div className="text-[10px] text-slate-400 font-bold mb-1">تعداد کل رکوردها</div>
                            <div className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400">
                              {inspectingTable.count.toLocaleString('fa-IR')}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                            <div className="text-[10px] text-slate-400 font-bold mb-1">کلید اصلی</div>
                            <div className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300" dir="ltr">
                              {inspectingTable.primaryKey}
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                            <div className="text-[10px] text-slate-400 font-bold mb-1">موتور ذخیره</div>
                            <div className="font-bold text-xs text-slate-700 dark:text-slate-300">
                              {inspectingTable.engine}
                            </div>
                          </div>
                        </div>

                        {/* Search & Actions toolbar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3 shrink-0">
                          <div className="relative w-full sm:w-80">
                            <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={inspectSearch}
                              onChange={(e) => setInspectSearch(e.target.value)}
                              placeholder="جستجو در فاکتورها، شناسه‌ها یا جزئیات..."
                              className="w-full h-9 pr-9 pl-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            <span className="text-[11px] font-bold text-slate-400">
                              نمایش {filteredRecords.length.toLocaleString('fa-IR')} از {inspectingTable.count.toLocaleString('fa-IR')} رکورد
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(inspectingTable.data || [], null, 2));
                                showToast('داده‌های JSON جدول در کلیپ‌بورد کپی شد.');
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-black text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Copy size={13} />
                              کپی کل JSON
                            </button>
                          </div>
                        </div>

                        {/* Content area: Individual Invoices/Records */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                          {filteredRecords.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 font-bold">
                              {inspectSearch.trim() ? 'هیچ رکوردی مطابق جستجوی شما یافت نشد.' : 'این جدول در حال حاضر هیچ رکوردی ندارد.'}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredRecords.slice(0, 50).map((item: any, idx: number) => {
                                const recordId = String(item.id || idx);
                                const hasPrice = item.finalTotal !== undefined || item.totalAmount !== undefined || item.totalCost !== undefined || item.amount !== undefined;
                                const priceVal = item.finalTotal ?? item.totalAmount ?? item.totalCost ?? item.amount;
                                const recordTitle = item.customerName || item.clientName || item.consoleName || item.productName || item.title || item.name || item.description || `رکورد #${idx + 1}`;
                                const dateVal = item.createdAt || item.date || item.startTime || item.timestamp;

                                return (
                                  <div 
                                    key={recordId} 
                                    className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 transition-all hover:border-slate-300 dark:hover:border-slate-600"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-700/70">
                                      <div className="flex items-center gap-2.5">
                                        <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-black text-[10px]">
                                          {idx + 1}
                                        </span>
                                        <div>
                                          <span className="font-black text-xs text-slate-900 dark:text-white">
                                            {recordTitle}
                                          </span>
                                          {dateVal && (
                                            <span className="text-[10px] text-slate-400 font-bold mr-2">
                                              ({new Date(dateVal).toLocaleDateString('fa-IR')} - {new Date(dateVal).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })})
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 justify-end">
                                        {hasPrice && (
                                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black font-mono text-xs">
                                            {Number(priceVal).toLocaleString('fa-IR')} تومان
                                          </span>
                                        )}
                                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300" dir="ltr">
                                          ID: {recordId.slice(0, 14)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSingleRecord(inspectingTable.name, item.id || recordId)}
                                          title="حذف و انهدام این فاکتور یا رکورد از پایگاه داده"
                                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Trash2 size={12} />
                                          <span>حذف این فاکتور</span>
                                        </button>
                                      </div>
                                    </div>

                                    <details className="text-[11px] font-mono text-slate-600 dark:text-slate-300 group cursor-pointer" dir="ltr">
                                      <summary className="font-sans text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline select-none mb-1 text-right" dir="rtl">
                                        مشاهده جزئیات داده‌های خام JSON ▾
                                      </summary>
                                      <pre className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[10px] overflow-x-auto max-h-36 leading-relaxed">
                                        {JSON.stringify(item, null, 2)}
                                      </pre>
                                    </details>
                                  </div>
                                );
                              })}

                              {filteredRecords.length > 50 && (
                                <div className="text-center text-[11px] text-slate-400 font-bold pt-2">
                                  + {(filteredRecords.length - 50).toLocaleString('fa-IR')} رکورد دیگر مطابق با جستجو وجود دارد.
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between gap-3 shrink-0">
                          <Button
                            onClick={() => handleExportSingleTableJSON(inspectingTable)}
                            className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2"
                          >
                            <Download size={14} />
                            دانلود خروجی کامل JSON
                          </Button>
                          <Button
                            onClick={() => {
                              setInspectingTable(null);
                              setInspectSearch('');
                            }}
                            variant="outline"
                            className="h-10 px-6 rounded-xl text-xs font-black"
                          >
                            بستن
                          </Button>
                        </div>
                      </motion.div>
                    </div>
                  );
                })()}
              </AnimatePresence>

               {/* Toast Notification */}
               <AnimatePresence>
                 {toast.show && (
                   <motion.div
                     initial={{ opacity: 0, y: 50, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 20, scale: 0.95 }}
                     className={cn(
                       "fixed bottom-6 left-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border font-sans text-xs md:text-sm font-black",
                       toast.type === 'success' 
                         ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 shadow-emerald-500/5" 
                         : toast.type === 'error'
                           ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border-rose-105 dark:border-rose-800 shadow-rose-500/5" 
                           : "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800 shadow-indigo-500/5"
                     )}
                     dir="rtl"
                   >
                     {toast.type === 'success' ? (
                       <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                     ) : toast.type === 'error' ? (
                       <AlertTriangle size={18} className="text-rose-500 shrink-0" />
                     ) : (
                       <Info size={18} className="text-indigo-505 shrink-0" />
                     )}
                     <span>{toast.message}</span>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
         </div>
       </div>
     </div>
  );
}
