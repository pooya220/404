import { apiRequest, triggerDatabaseRefresh } from './hooks/useFirestore';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Monitor, 
  ShoppingCart, 
  Users, 
  Calendar, 
  LogOut, 
  User as UserIcon,
  Menu,
  X,
  FileText,
  BarChart3, 
  Clock3,
  Target, 
  PieChart,
  Moon,
  Sun,
  Lock,
  Eye,
  EyeOff,
  Gamepad2,
  ChevronDown,
  ChevronUp,
  Globe,
  Palette,
  Gift,
  Database,
  RefreshCw,
  HardDrive,
  BadgePercent,
  Shield,
  Download,
  Sliders,
  Wallet,
  Heart,
  History,
  Award,
  Sparkles,
  Wrench,
  Settings as SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Input } from './components/ui/common';
import { useCollection } from './hooks/useFirestore';
import { useDatabaseStatus, type DBStatus } from './hooks/useDatabaseStatus';
import { SystemSettings } from './types';

import Consoles from './pages/Consoles';
import Products from './pages/Products';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Reservations from './pages/Reservations';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import StaffAttendance from './pages/StaffAttendance';
import Goals from './pages/Goals';
import Stocks from './pages/Stocks';
import Settings from './pages/Settings';
import UserDashboard from './pages/UserDashboard';
import Repairs from './pages/Repairs';
import { BuffetCriticalStockWatcher } from './components/BuffetCriticalStockWatcher';

function SidebarItem({ to, icon: Icon, label, active, theme }: { to: string, icon: any, label: string, active: boolean, theme?: any, key?: any }) {
  return (
    <Link 
      to={to} 
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-right",
        active 
          ? "text-white shadow-lg" 
          : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
      )}
      style={active ? { backgroundColor: theme?.primary || '#4f46e5' } : {}}
    >
      <Icon size={20} className={active ? "text-white" : "text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"} />
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}

function SidebarGroup({
  label,
  icon: Icon,
  items,
  isOpen,
  onToggle,
  isSelected,
  pageThemes,
  onCloseMobile
}: {
  label: string,
  icon: any,
  items: Array<{ to: string, icon: any, label: string }>,
  isOpen: boolean,
  onToggle: () => void,
  isSelected: (to: string) => boolean,
  pageThemes: any,
  onCloseMobile?: () => void,
  key?: string
}) {
  const hasSelectedChild = items.some(item => isSelected(item.to));

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-150 text-right group",
          hasSelectedChild
            ? "bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-black"
            : "text-gray-700 dark:text-slate-300 hover:bg-gray-50/80 dark:hover:bg-slate-800/60"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon 
            size={18} 
            className={cn(
              "transition-colors",
              hasSelectedChild 
                ? "text-indigo-600 dark:text-indigo-400" 
                : "text-gray-450 group-hover:text-gray-600 dark:group-hover:text-slate-200"
            )} 
          />
          <span className="text-xs md:text-sm font-bold tracking-wide">{label}</span>
        </div>
        
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-gray-400 group-hover:text-gray-650"
        >
          <ChevronDown size={14} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden pr-3 mr-2 border-r border-slate-100 dark:border-slate-800/60 space-y-1 mt-0.5"
          >
            {items.map((item) => {
              const active = isSelected(item.to);
              const itemKey = item.to.split('/')[1]?.split('?')[0] || 'dashboard';
              const theme = pageThemes[itemKey];

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-right group relative",
                    active
                      ? "text-white shadow-sm font-black"
                      : "text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                  style={active ? { backgroundColor: theme?.primary || '#4f46e5' } : {}}
                >
                  <item.icon 
                    size={15} 
                    className={cn(
                      "shrink-0 transition-transform duration-200",
                      active ? "text-white" : "text-gray-400 group-hover:scale-105"
                    )} 
                  />
                  <span className="text-[11px] md:text-xs font-semibold">{item.label}</span>
                  
                  {active && (
                    <span 
                      className="absolute right-0 top-1/4 bottom-1/4 w-1 rounded-l" 
                      style={{ backgroundColor: theme?.accent || '#818cf8' }} 
                    />
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DatabaseStatusControl({
  status,
  details,
  isRefreshing,
  onRefresh
}: {
  status: DBStatus;
  details: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const label = status === 'CONNECTED' ? 'MySQL متصل' : status === 'LOCAL' ? 'ذخیره مرورگر' : 'دیتابیس قطع';

  return (
    <div
      title={details || label}
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 transition-all",
        status === 'CONNECTED' && "bg-emerald-50/80 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
        status === 'LOCAL' && "bg-cyan-50/80 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/60",
        (status === 'DISCONNECTED' || status === 'ERROR') && "bg-rose-50/80 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative flex items-center justify-center shrink-0">
          <Database size={15} />
          <span className={cn(
            "absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900",
            status === 'CONNECTED' && "bg-emerald-500 animate-pulse",
            status === 'LOCAL' && "bg-cyan-500",
            (status === 'DISCONNECTED' || status === 'ERROR') && "bg-rose-500 animate-pulse"
          )} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black leading-none mb-1">اتصال دیتابیس</p>
          <p className="text-[9px] font-bold opacity-75 truncate">{label}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:bg-white/80 dark:hover:bg-slate-800/80 disabled:opacity-50 transition-colors"
        title="بررسی مجدد اتصال و تازه‌سازی اطلاعات"
        aria-label="تازه‌سازی اتصال دیتابیس"
      >
        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}

function Layout({ onLogout, children, currentUser }: { onLogout: () => void, children: React.ReactNode, currentUser: any }) {
  const dbStatus = useDatabaseStatus();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return true; // Gaming Club management defaults to dark mode
  });

  const location = useLocation();
  const { data: settingsList } = useCollection<SystemSettings>('settings');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const settings = settingsList?.[0];
  const pageThemes = settings?.themes || {};
  
  // Map pathname to theme machine name
  const currentPathKey = location.pathname.split('/')[1] || 'dashboard';
  const currentTheme = pageThemes[currentPathKey] || { primary: '#4f46e5', secondary: '#818cf8', accent: '#c7d2fe' };

  useEffect(() => {
    // Dynamically set CSS variables for theme injection
    document.documentElement.style.setProperty('--primary-theme', currentTheme.primary);
    document.documentElement.style.setProperty('--secondary-theme', currentTheme.secondary);
    document.documentElement.style.setProperty('--accent-theme', currentTheme.accent);
  }, [currentTheme]);

  const isSelected = (to: string) => {
    const [toPath, toQuery] = to.split('?');
    if (location.pathname !== toPath) return false;
    if (!toQuery) {
      if (toPath === '/settings') {
        return !location.search || location.search === '?tab=general';
      }
      return true;
    }
    return location.search === `?${toQuery}`;
  };

  const rawGroups = [
    {
      id: 'dashboard',
      label: 'پیشخوان و میزکار',
      icon: Gamepad2,
      items: [
        { to: "/", icon: LayoutDashboard, label: "داشبورد اصلی" },
        { to: "/consoles", icon: Monitor, label: "دستگاه‌ها" },
        { to: "/products", icon: ShoppingCart, label: "بوفه و فروشگاه" },
        { to: "/repairs", icon: Wrench, label: "تعمیرات" },
        { to: "/clients", icon: Users, label: "مشتریان" },
        { to: "/reservations", icon: Calendar, label: "رزرو" },
      ]
    },
    {
      id: 'financial',
      label: 'امور مالی و تحلیل',
      icon: BarChart3,
      items: [
        { to: "/reports", icon: FileText, label: "گزارشات" },
        { to: "/analytics", icon: BarChart3, label: "آمار و عملکرد" },
        { to: "/staff-attendance", icon: Clock3, label: "حضور و غیاب پرسنل" },
        { to: "/stocks", icon: PieChart, label: "سهام و سوددهی" },
        { to: "/goals", icon: Target, label: "هدف‌گذاری مالی" },
      ]
    },
    {
      id: 'user_dashboard',
      label: 'پیشخوان کاربران',
      icon: Users,
      items: [
        { to: "/user-dashboard?tab=dashboard", icon: LayoutDashboard, label: "خلاصه پیشخوان شما" },
        { to: "/user-dashboard?tab=wallet", icon: Wallet, label: "مدیریت کیف پول" },
        { to: "/user-dashboard?tab=points", icon: Award, label: "کلوپ وفاداری و امتیازات" },
        { to: "/user-dashboard?tab=donations", icon: Heart, label: "صندوق حمایت" },
        { to: "/user-dashboard?tab=history", icon: History, label: "تاریخچه بازی شما" },
        { to: "/user-dashboard?tab=profile", icon: Lock, label: "پروفایل و امنیت" },
      ]
    },
    {
      id: 'settings',
      label: 'پیکربندی سیستم',
      icon: SettingsIcon,
      items: [
        { to: "/settings?tab=general", icon: Globe, label: "اطلاعات عمومی" },
        { to: "/settings?tab=promotions", icon: Gift, label: "طرح‌های تشویقی" },
        { to: "/settings?tab=loyalty", icon: Award, label: "کلوپ وفاداری" },
        { to: "/settings?tab=finance", icon: BadgePercent, label: "امور مالی" },
        { to: "/settings?tab=database", icon: Database, label: "دیتابیس و پشتیبان‌گیری" },
        { to: "/settings?tab=users", icon: Users, label: "مدیریت کاربران" },
      ]
    }
  ];

  // Helper for dynamic permissions configuration
  const getDefaultPaths = (role: string) => {
    if (role === 'client') return ['/user-dashboard'];
    if (role === 'operator') return ['/', '/consoles', '/products', '/repairs', '/clients', '/reservations', '/reports', '/analytics', '/staff-attendance', '/goals', '/stocks', '/user-dashboard'];
    return ['/', '/consoles', '/products', '/repairs', '/clients', '/reservations', '/reports', '/analytics', '/staff-attendance', '/goals', '/stocks', '/settings', '/user-dashboard'];
  };

  // Filter groups dynamically according to role and saved database settings:
  const userRole = currentUser?.role || 'admin';
  let allowedPaths: string[] = [];
  if (userRole === 'client') {
    allowedPaths = ['/user-dashboard'];
  } else {
    const rawRolePermissions = settings?.rolePermissions || {};
    allowedPaths = [...(rawRolePermissions[userRole] || getDefaultPaths(userRole))];
    if (['admin', 'operator'].includes(userRole) && !allowedPaths.includes('/staff-attendance')) {
      allowedPaths.push('/staff-attendance');
    }
    if (!allowedPaths.includes('/user-dashboard')) {
      allowedPaths.push('/user-dashboard');
    }
  }

  const groups = rawGroups.map(g => {
    return {
      ...g,
      items: g.items
        .filter(item => {
          const pathPart = item.to.split('?')[0];
          return allowedPaths.includes(pathPart);
        })
    };
  }).filter(g => g.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    return {
      dashboard: false,
      financial: false,
      user_dashboard: false,
      settings: false,
    };
  });

  useEffect(() => {
    let activeGroupId: string | null = null;
    groups.forEach(g => {
      const hasActiveChild = g.items.some(item => isSelected(item.to));
      if (hasActiveChild) {
        activeGroupId = g.id;
      }
    });

    setOpenGroups(() => {
      const next: Record<string, boolean> = {
        dashboard: false,
        financial: false,
        user_dashboard: false,
        settings: false,
      };
      if (activeGroupId) {
        next[activeGroupId] = true;
      }
      return next;
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const faviconUrl = settings?.logo || '/favicon.svg';
    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (link) {
      link.href = faviconUrl;
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl;
      document.head.appendChild(newLink);
    }
    if (settings?.storeName) {
      document.title = settings.storeName;
    }
  }, [settings?.logo, settings?.storeName]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const isCurrentlyOpen = !!prev[id];
      const next: Record<string, boolean> = {
        dashboard: false,
        financial: false,
        user_dashboard: false,
        settings: false,
      };
      next[id] = !isCurrentlyOpen;
      return next;
    });
  };

  const handleDatabaseRefresh = async () => {
    await dbStatus.refresh();
    triggerDatabaseRefresh();
  };

  return (
    <div className="flex h-screen bg-[#dce1e8] dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-[#d7dde6] dark:bg-slate-900 border-l border-slate-300/90 dark:border-slate-800 p-6 flex-shrink-0 z-20 transition-colors overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            {settings?.logo ? (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-slate-105 shadow-md">
                <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Monitor className="text-white" size={22} />
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
              {settings?.storeName || "گیم‌نت پلاس"}
            </h1>
          </div>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <nav className="flex-1 space-y-3.5">
          {groups.map((group) => (
            <SidebarGroup
              key={group.id}
              label={group.label}
              icon={group.icon}
              items={group.items}
              isOpen={!!openGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
              isSelected={isSelected}
              pageThemes={pageThemes}
            />
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 bg-transparent dark:bg-slate-900">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-950/40 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 text-right">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  <UserIcon size={19} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black text-gray-900 dark:text-white truncate">
                    {currentUser?.fullName || "مدیریت کل"}
                  </p>
                  <div className="text-[9px] text-gray-400 dark:text-slate-500 truncate flex items-center gap-1 font-bold">
                    <span>نقش:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {userRole === 'admin' ? 'مدیر سیستم' :
                       userRole === 'operator' ? 'اپراتور کلوپ' :
                       userRole === 'client' ? 'کلاینت / مشتری' :
                       'مدیریت کل'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all text-[10px] font-black shrink-0"
                title="خروج از سیستم"
              >
                <LogOut size={15} />
                <span>خروج</span>
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
              <DatabaseStatusControl
                status={dbStatus.status}
                details={dbStatus.details}
                isRefreshing={dbStatus.isRefreshing}
                onRefresh={handleDatabaseRefresh}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#dce1e8] dark:bg-slate-950">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-[#d7dde6] dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 sticky top-0 z-20 transition-colors">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500 dark:text-slate-400">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            {settings?.logo && (
              <img src={settings.logo} alt="Logo" className="w-6 h-6 object-cover rounded-md" referrerPolicy="no-referrer" />
            )}
            <h1 className="text-lg font-bold dark:text-white">{settings?.storeName || "گیم‌نت پلاس"}</h1>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-gray-500 dark:text-slate-400"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="w-full px-3 md:px-6 py-4 lg:py-6">
          <BuffetCriticalStockWatcher />
          {children}
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
            />
            <motion.aside 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed top-0 right-0 bottom-0 w-80 bg-[#d7dde6] dark:bg-slate-800 border-l border-slate-300 dark:border-slate-700 z-40 lg:hidden flex flex-col p-6 shadow-2xl transition-colors overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3 text-right">
                  {settings?.logo ? (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden border">
                      <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <Monitor className="text-white" size={18} />
                    </div>
                  )}
                  <h1 className="text-lg font-bold dark:text-white truncate max-w-[160px]">{settings?.storeName || "گیم‌نت پلاس"}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 text-gray-500 dark:text-slate-400"
                  >
                    {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                  </button>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-500 dark:text-slate-400">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <nav className="flex-1 space-y-3.5">
                {groups.map((group) => (
                  <SidebarGroup
                    key={group.id}
                    label={group.label}
                    icon={group.icon}
                    items={group.items}
                    isOpen={!!openGroups[group.id]}
                    onToggle={() => toggleGroup(group.id)}
                    isSelected={isSelected}
                    pageThemes={pageThemes}
                    onCloseMobile={() => setIsSidebarOpen(false)}
                  />
                ))}
              </nav>

              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-950/40 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3 text-right">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                        <UserIcon size={19} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-black text-gray-900 dark:text-white truncate">
                          {currentUser?.fullName || "مدیریت کل"}
                        </p>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 truncate flex items-center gap-1 font-bold">
                          <span>نقش:</span>
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {userRole === 'admin' ? 'مدیر سیستم' :
                             userRole === 'operator' ? 'اپراتور کلوپ' :
                             userRole === 'client' ? 'کلاینت / مشتری' :
                             'مدیریت کل'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSidebarOpen(false);
                        onLogout();
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all text-[10px] font-black shrink-0"
                      title="خروج از سیستم"
                    >
                      <LogOut size={15} />
                      <span>خروج</span>
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
                    <DatabaseStatusControl
                      status={dbStatus.status}
                      details={dbStatus.details}
                      isRefreshing={dbStatus.isRefreshing}
                      onRefresh={handleDatabaseRefresh}
                    />
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Login({ onLogin, customSettings, systemUsers }: { 
  onLogin: (user: { id: string; username: string; fullName: string; role: string; clientId?: string }) => void, 
  customSettings?: SystemSettings | null,
  systemUsers?: any[]
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try { const user = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }); onLogin(user); triggerDatabaseRefresh(); }
    catch (err: any) { setError(err.message); }
  };

  const hasLogo = !!customSettings?.logo;
  const brandName = customSettings?.storeName || 'کلوپ بازی و سرگرمی';
  const customTheme = customSettings?.themes?.primary || '#4f46e5';

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-4 md:p-8 font-sans relative overflow-hidden" dir="rtl">
      {/* Soft ambient glowing background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-10 shadow-2xl border border-slate-200 dark:border-slate-800 text-center relative z-10"
      >
        {/* Rounded Launcher Logo Frame */}
        <div className="relative inline-block mb-5">
          <div 
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto overflow-hidden relative group"
            style={{ 
              background: `linear-gradient(135deg, ${customTheme}, #3730a3)`
            }}
          >
            {hasLogo ? (
              <img 
                src={customSettings.logo} 
                alt="Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Gamepad2 className="text-white" size={40} />
            )}
          </div>
          <span className="absolute -bottom-1 -left-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </span>
        </div>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1.5">
          {brandName}
        </h1>
        <p className="text-slate-500 mb-7 font-medium text-xs leading-relaxed max-w-xs mx-auto">
          سامانه یکپارچه مدیریت و حسابداری کلوپ
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          <div className="space-y-1.5">
            <label className="text-right block text-xs font-bold text-slate-700 mr-1">نام کاربری</label>
            <div className="relative rounded-xl overflow-hidden">
              <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                <Users size={18} />
              </div>
              <input 
                type="text"
                placeholder="نام کاربری خود را وارد کنید" 
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                className="w-full bg-slate-50/80 border border-slate-200 text-slate-800 font-bold pr-11 pl-4 rounded-xl outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 h-11 text-xs"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-right block text-xs font-bold text-slate-700 mr-1">رمز عبور سیستم</label>
            <div className="relative rounded-xl overflow-hidden">
              <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="رمز عبور خود را وارد کنید" 
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full bg-slate-50/80 border border-slate-200 text-slate-800 font-bold h-11 pr-11 pl-11 rounded-xl outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-right"
              >
                <p className="text-rose-600 text-xs font-bold leading-normal flex items-center gap-2 justify-start">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse shrink-0" />
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-all text-xs cursor-pointer mt-2"
          >
            ورود به سیستم
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { data: settingsList } = useCollection<SystemSettings>('settings');
  const { data: systemUsers } = useCollection<any>('system_users');
  const customSettings = settingsList && settingsList.length > 0 ? settingsList[0] : null;

  // Dynamic browser tab logo (favicon) and title synchronization
  useEffect(() => {
    if (customSettings?.storeName) {
      document.title = `${customSettings.storeName} | مدیریت گیم‌نت`;
    }

    const faviconElement = (document.getElementById('app-favicon') || document.querySelector("link[rel*='icon']")) as HTMLLinkElement | null;
    if (faviconElement) {
      if (customSettings?.logo) {
        faviconElement.href = customSettings.logo;
        faviconElement.type = customSettings.logo.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png';
      } else {
        faviconElement.href = '/favicon.svg';
        faviconElement.type = 'image/svg+xml';
      }
    }
  }, [customSettings?.logo, customSettings?.storeName]);

  useEffect(() => {
    apiRequest("/api/auth/me").then(user => { setCurrentUser(user); localStorage.setItem("game_net_user", JSON.stringify(user)); triggerDatabaseRefresh(); })
      .catch(() => { localStorage.removeItem("game_net_user"); localStorage.removeItem("game_net_admin"); })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (user: any) => {
    localStorage.setItem('db_mode', 'mysql');
    localStorage.setItem('db_mode_explicit', 'true');
    window.history.pushState(null, '', '/');
    setCurrentUser(user);
    localStorage.setItem('game_net_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    apiRequest("/api/auth/logout", { method: "POST" }).finally(triggerDatabaseRefresh);
    setCurrentUser(null);
    localStorage.removeItem('game_net_user');
    localStorage.removeItem('game_net_admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-slate-950">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none animate-pulse" />
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} customSettings={customSettings} systemUsers={systemUsers} />;
  }

  const userRole = currentUser?.role || 'admin';
  const rawRolePermissions = customSettings?.rolePermissions || {};
  
  const getDefaultPaths = (role: string) => {
    if (role === 'client') return ['/user-dashboard'];
    if (role === 'operator') return ['/', '/consoles', '/products', '/repairs', '/clients', '/reservations', '/reports', '/analytics', '/staff-attendance', '/goals', '/stocks', '/user-dashboard'];
    return ['/', '/consoles', '/products', '/repairs', '/clients', '/reservations', '/reports', '/analytics', '/staff-attendance', '/goals', '/stocks', '/settings', '/user-dashboard'];
  };

  let allowedPaths: string[] = [];
  if (userRole === 'client') {
    allowedPaths = ['/user-dashboard'];
  } else {
    allowedPaths = [...(rawRolePermissions[userRole] || getDefaultPaths(userRole))];
    if (['admin', 'operator'].includes(userRole) && !allowedPaths.includes('/staff-attendance')) {
      allowedPaths.push('/staff-attendance');
    }
    if (!allowedPaths.includes('/user-dashboard')) {
      allowedPaths.push('/user-dashboard');
    }
  }
  const isAllowed = (path: string) => allowedPaths.includes(path);

  return (
    <BrowserRouter>
      <Layout onLogout={handleLogout} currentUser={currentUser}>
        <Routes>
          <Route path="/" element={!isAllowed('/') ? <Navigate to="/user-dashboard" replace /> : <Dashboard />} />
          
          <Route path="/user-dashboard" element={<UserDashboard currentUser={currentUser} />} />
          {isAllowed('/reservations') && <Route path="/reservations" element={<Reservations />} />}
          {isAllowed('/consoles') && <Route path="/consoles" element={<Consoles />} />}
          {isAllowed('/products') && <Route path="/products" element={<Products />} />}
          {isAllowed('/repairs') && <Route path="/repairs" element={<Repairs />} />}
          {isAllowed('/clients') && <Route path="/clients" element={<Clients currentUser={currentUser} />} />}
          {isAllowed('/reports') && <Route path="/reports" element={<Reports />} />}
          {isAllowed('/analytics') && <Route path="/analytics" element={<Analytics />} />}
          {isAllowed('/staff-attendance') && <Route path="/staff-attendance" element={<StaffAttendance currentUser={currentUser} />} />}
          {isAllowed('/goals') && <Route path="/goals" element={<Goals />} />}
          {isAllowed('/stocks') && <Route path="/stocks" element={<Stocks />} />}
          {isAllowed('/settings') && <Route path="/settings" element={<Settings />} />}

          {/* Fallback pattern for unauthorized client/operator routes redirects back to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
