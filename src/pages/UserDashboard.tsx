import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { AppUser, ClientTier, Session } from '../types';
import { ClientPortfolioView, getAvatarEmoji } from './Clients';
import { Card, Button, Badge, Input } from '../components/ui/common';
import { 
  Users, 
  Search, 
  Award, 
  User, 
  ArrowLeft,
  LayoutDashboard,
  Wallet,
  Heart,
  History,
  Lock,
  ChevronLeft,
  Smile,
  ShieldCheck,
  Gamepad2,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatPersianNumber, formatCurrency, formatPersianDigits, toEnglishDigits, cn } from '../lib/utils';

export default function UserDashboard({ currentUser }: { currentUser: any }) {
  const { data: clients, loading: clientsLoading } = useCollection<AppUser>('clients');
  const { data: tiers } = useCollection<ClientTier>('client_tiers');
  const { data: sessions } = useCollection<Session>('sessions');
  const { data: systemUsers } = useCollection<any>('system_users');
  const { data: sales } = useCollection<any>('sales');
  const { data: donations } = useCollection<any>('donations');
  const { data: consoles } = useCollection<any>('consoles');

  const { add, update } = useFirestore();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromQuery = searchParams.get('tab') as 'dashboard' | 'wallet' | 'donations' | 'history' | 'profile' | 'points' | null;
  const initialTab = tabFromQuery || 'dashboard';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<AppUser | null>(null);
  const [activeClient, setActiveClient] = useState<AppUser | null>(null);

  // Sync client profile for current user
  useEffect(() => {
    if (currentUser?.role === 'client' && clients && !clientsLoading) {
      // Login links the authenticated account on the server; never guess by name
      // or create duplicate customer records while collections are still loading.
      setActiveClient(clients.find(c => c.id === currentUser.clientId) || null);
    }
  }, [currentUser, clients, clientsLoading, add, update]);

  // Handle setting tabs through searchParams to ensure deep linking is perfectly reactive
  const handleTabChange = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  // Filter clients for admin/operator selection
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(c => {
      const search = searchTerm.toLowerCase();
      const nameMatch = c.name?.toLowerCase().includes(search);
      const phoneMatch = c.phone?.toLowerCase().includes(search);
      return nameMatch || phoneMatch;
    });
  }, [clients, searchTerm]);

  // Color map helper
  const tierColorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/60',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-955/30 dark:text-amber-400 dark:border-amber-900/60',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-955/30 dark:text-emerald-400 dark:border-emerald-900/60',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-955/30 dark:text-rose-400 dark:border-rose-900/60',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-955/30 dark:text-slate-400 dark:border-slate-800/60',
  };

  // CLIENT ROLE: Render directly their own portfolio panel
  if (currentUser?.role === 'client') {
    if (clientsLoading || !activeClient) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] font-sans" dir="rtl">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500 font-bold text-sm">در حال دریافت و هماهنگ‌سازی حساب اختصاصی شما...</p>
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
          initialTab={initialTab}
          hideHorizontalTabs={false}
        />
      </div>
    );
  }

  // ADMIN / OPERATOR ROLE: Check if client is selected
  if (selectedClient) {
    return (
      <div className="p-4 lg:p-10 font-sans text-right space-y-6" dir="rtl">
        {/* Sticky top action banner representing chosen client */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 rounded-[2rem] bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 backdrop-blur"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl">
              {selectedClient.avatar ? (
                <span>{getAvatarEmoji(selectedClient.avatar)}</span>
              ) : (
                <User size={20} />
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-400 font-bold">در حال مشاهده پیشخوان اختصاصی کلاینت:</p>
              <h2 className="text-lg font-black text-indigo-950 dark:text-indigo-200">
                {selectedClient.name} <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">({formatPersianDigits(selectedClient.phone)})</span>
              </h2>
            </div>
          </div>
          <Button 
            onClick={() => setSelectedClient(null)}
            variant="outline"
            className="rounded-2xl border-indigo-200 text-indigo-700 bg-white hover:bg-rose-50 hover:text-rose-600 transition-all font-bold text-xs shadow-sm h-11"
          >
            <ArrowLeft className="ml-1 text-indigo-500 group-hover:text-rose-500" size={14} />
            انتخاب کاربر دیگر / بازگشت به لیست
          </Button>
        </motion.div>

        {/* Portfolio view */}
        <ClientPortfolioView 
          client={selectedClient} 
          onClose={() => setSelectedClient(null)}
          isOwnProfile={false} 
          systemUsers={systemUsers} 
          sessions={sessions} 
          sales={sales} 
          donations={donations} 
          tiers={tiers} 
          consoles={consoles}
          currentUser={currentUser}
          initialTab={initialTab}
          hideHorizontalTabs={false}
        />
      </div>
    );
  }

  // ADMIN / OPERATOR ROLE: Selection interface
  return (
    <div className="p-6 lg:p-10 font-sans text-right space-y-8" dir="rtl">
      {/* Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">داشبورد و پیشخوان هوشمند کاربران</h1>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-bold mt-2 leading-relaxed">
            جستجو و انتخاب هر یک از مشتریان گرانقدر کلوپ جهت بررسی جزئیات، مدیریت کیف پول دیجیتال، صندوق حمایت، سوابق بازی و تنظیمات پروفایل
          </p>
        </div>
        
        {/* Statistics or summary chip */}
        <div className="flex items-center gap-3 bg-indigo-50/50 dark:bg-slate-900/30 px-5 py-3 rounded-2xl border border-indigo-100/50 dark:border-slate-800">
          <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">تعداد کلاینت‌های رجیستر شده:</span>
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatPersianNumber(clients?.length || 0)}
          </span>
        </div>
      </div>

      {/* Interactive Search Tool */}
      <div className="max-w-2xl bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-md">
        <div className="relative">
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="نام یا شماره تلفن کلاینت را جهت بررسی سریع تایپ کنید..."
            className="w-full pl-4 pr-12 h-14 bg-slate-50 border-none rounded-2xl text-sm font-bold dark:bg-slate-950/60"
          />
          <Search size={22} className="absolute right-4 top-4 text-slate-400 dark:text-slate-500" />
        </div>
      </div>

      {/* Grid of Users to select */}
      {clientsLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 animate-spin rounded-full mb-3" />
          <p className="text-xs font-bold text-gray-400">در حال دریافت لیست کاربران کلوپ...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="p-10 text-center max-w-lg mx-auto rounded-3xl border-gray-100 dark:border-slate-800">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950/40 rounded-2xl flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500 mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">کاربری پیدا نشد!</h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 font-bold leading-relaxed">
            هیچ کلاینت منطبقی با کلمه کلمه کلیدی شما در کل کلاب یافت نشد. لطفاً دقت فرموده یا نام دیگری را جستجو نمایید.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClients.map((client) => {
            const currentTier = tiers?.find(t => t.id === client.tier || t.name === client.tier);
            const isDebtor = (Number(client.balance) || 0) < 0;
            const absoluteBalance = Math.abs(Number(client.balance) || 0);

            return (
              <motion.div
                key={client.id}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => setSelectedClient(client)}
                className="cursor-pointer group relative bg-white dark:bg-slate-900 p-6 rounded-[2.2rem] border border-gray-50 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/60 shadow-sm hover:shadow-lg transition-all duration-300"
              >
                {/* Visual Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/0 to-indigo-500/0 group-hover:from-indigo-50/5 group-hover:to-indigo-500/[0.02] rounded-[2.2rem] transition-all" />

                <div className="flex justify-between items-start mb-5 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner text-xl",
                      client.isGuest ? "bg-amber-500 text-white" : (client.avatar ? "bg-indigo-50 dark:bg-indigo-950/40 text-xl" : (currentTier ? tierColorMap[currentTier.color] : "bg-gray-100 text-gray-400 dark:bg-slate-800"))
                    )}>
                      {client.isGuest ? (
                        <Star size={22} />
                      ) : client.avatar ? (
                        <span className="text-2xl">{getAvatarEmoji(client.avatar)}</span>
                      ) : (
                        currentTier ? <Award size={22} /> : <User size={22} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {client.name}
                      </h4>
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 mt-0.5">
                        {formatPersianDigits(client.phone)}
                      </p>
                    </div>
                  </div>

                  {currentTier && (
                    <Badge className={cn("rounded-lg text-[9.5px] font-black", tierColorMap[currentTier.color])}>
                      {currentTier.name}
                    </Badge>
                  )}
                </div>

                {/* Portfolio Info Summary */}
                <div className="space-y-3 pt-3 border-t border-dashed border-gray-100 dark:border-slate-800 relative z-10">
                  <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-slate-500">
                    <span>کیف پول دیجیتال:</span>
                    <span className={cn(
                      "font-extrabold",
                      isDebtor ? "text-rose-500" : "text-emerald-500"
                    )}>
                      {isDebtor ? '-' : ''}{formatCurrency(absoluteBalance)}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-slate-500">
                    <span>امتیاز کلوپ:</span>
                    <span className="font-extrabold text-indigo-550 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                      {formatPersianDigits(client.points || 0)} <span className="text-[10px] text-gray-400">امتیاز</span>
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex justify-end relative z-10">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                    ورود به پیشخوان کاربری
                    <ChevronLeft size={14} />
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
