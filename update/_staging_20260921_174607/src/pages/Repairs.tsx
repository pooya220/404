import React, { useState, useMemo } from 'react';
import { 
  Wrench, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Printer, 
  User, 
  Phone, 
  Gamepad2, 
  Calendar, 
  Receipt, 
  Edit3, 
  Trash2, 
  Package, 
  ArrowUpRight,
  Sparkles,
  Layers,
  FileText,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, Button, Badge } from '../components/ui/common';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { RepairItem, AppUser } from '../types';
import { formatCurrency, formatPersianDigits, cn } from '../lib/utils';

const DEVICE_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  controller: { label: 'دسته بازی (Controller)', icon: Gamepad2, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  console: { label: 'کنسول بازی', icon: Layers, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  vr: { label: 'هدست و واقعیت مجازی', icon: Sparkles, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  pc: { label: 'کیس و کامپیوتر گیمینگ', icon: Package, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  accessory: { label: 'لوازم جانبی و کابل', icon: Wrench, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  other: { label: 'سایر تجهیزات', icon: Wrench, color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any; border: string }> = {
  received: { label: 'پذیرش شده (در نوبت)', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', icon: Clock, border: 'border-blue-200' },
  in_progress: { label: 'در حال بررسی و تعمیر', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', icon: Wrench, border: 'border-amber-200' },
  waiting_parts: { label: 'در انتظار تامین قطعه', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600 dark:text-orange-400', icon: AlertCircle, border: 'border-orange-200' },
  ready: { label: 'آماده تحویل به مشتری', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2, border: 'border-emerald-200' },
  delivered: { label: 'تحویل داده شده و تسویه', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: CheckCircle2, border: 'border-slate-200' },
  cancelled: { label: 'لغو شده / عدم توافق', bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600 dark:text-rose-400', icon: AlertCircle, border: 'border-rose-200' },
};

export default function Repairs() {
  const { data: repairs, loading } = useCollection<RepairItem>('repairs');
  const { data: clients } = useCollection<AppUser>('clients');
  const { add, update, remove } = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairItem | null>(null);
  const [printableRepair, setPrintableRepair] = useState<RepairItem | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    clientId: string;
    clientName: string;
    clientPhone: string;
    deviceType: RepairItem['deviceType'];
    deviceModel: string;
    serialNumber: string;
    issueDescription: string;
    status: RepairItem['status'];
    partsCost: number;
    laborCost: number;
    discount: number;
    paidAmount: number;
    paymentMethod: 'cash' | 'card' | 'account' | 'online';
    technicianNotes: string;
    warrantyDays: number;
  }>({
    clientId: '',
    clientName: '',
    clientPhone: '',
    deviceType: 'controller',
    deviceModel: '',
    serialNumber: '',
    issueDescription: '',
    status: 'received',
    partsCost: 0,
    laborCost: 0,
    discount: 0,
    paidAmount: 0,
    paymentMethod: 'card',
    technicianNotes: '',
    warrantyDays: 7,
  });

  const totalCalculated = Math.max(0, (Number(formData.partsCost) || 0) + (Number(formData.laborCost) || 0) - (Number(formData.discount) || 0));

  const handleOpenNewModal = (prefilledClientId?: string) => {
    let clientObj: AppUser | undefined;
    if (prefilledClientId) {
      clientObj = (clients || []).find(c => c.id === prefilledClientId);
    }
    setEditingRepair(null);
    setFormData({
      clientId: clientObj?.id || '',
      clientName: clientObj?.name || '',
      clientPhone: clientObj?.phone || '',
      deviceType: 'controller',
      deviceModel: '',
      serialNumber: '',
      issueDescription: '',
      status: 'received',
      partsCost: 0,
      laborCost: 150000,
      discount: 0,
      paidAmount: 0,
      paymentMethod: 'card',
      technicianNotes: '',
      warrantyDays: 7,
    });
    setIsModalOpen(true);
  };

  const handleEditModal = (item: RepairItem) => {
    setEditingRepair(item);
    setFormData({
      clientId: item.clientId || '',
      clientName: item.clientName || '',
      clientPhone: item.clientPhone || '',
      deviceType: item.deviceType,
      deviceModel: item.deviceModel || '',
      serialNumber: item.serialNumber || '',
      issueDescription: item.issueDescription || '',
      status: item.status,
      partsCost: item.partsCost || 0,
      laborCost: item.laborCost || 0,
      discount: item.discount || 0,
      paidAmount: item.paidAmount || 0,
      paymentMethod: item.paymentMethod || 'card',
      technicianNotes: item.technicianNotes || '',
      warrantyDays: item.warrantyDays ?? 7,
    });
    setIsModalOpen(true);
  };

  const handleClientSelect = (cId: string) => {
    if (!cId) {
      setFormData(prev => ({ ...prev, clientId: '', clientName: '', clientPhone: '' }));
      return;
    }
    const found = (clients || []).find(c => c.id === cId);
    if (found) {
      setFormData(prev => ({
        ...prev,
        clientId: found.id,
        clientName: found.name,
        clientPhone: found.phone || '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName.trim() || !formData.deviceModel.trim()) {
      alert('لطفاً نام مشتری و مدل دستگاه را وارد فرمایید.');
      return;
    }

    const total = totalCalculated;
    const paid = Number(formData.paidAmount) || 0;
    const paymentStatus: RepairItem['paymentStatus'] = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    if (editingRepair) {
      const updatedItem: Partial<RepairItem> = {
        ...formData,
        totalCost: total,
        paymentStatus,
        deliveryDate: formData.status === 'delivered' ? (editingRepair.deliveryDate || new Date().toISOString()) : editingRepair.deliveryDate,
      };
      await update('repairs', editingRepair.id, updatedItem);
    } else {
      const newTracking = `REP-${Math.floor(1000 + Math.random() * 9000)}`;
      const newItem: Omit<RepairItem, 'id'> = {
        trackingCode: newTracking,
        ...formData,
        totalCost: total,
        paymentStatus,
        receivedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      await add('repairs', newItem);
    }

    setIsModalOpen(false);
  };

  const handleQuickStatusChange = async (repair: RepairItem, newStatus: RepairItem['status']) => {
    const isNowDelivered = newStatus === 'delivered';
    const autoPaid = isNowDelivered ? repair.totalCost : repair.paidAmount;
    await update('repairs', repair.id, {
      status: newStatus,
      deliveryDate: isNowDelivered ? new Date().toISOString() : repair.deliveryDate,
      paidAmount: autoPaid,
      paymentStatus: autoPaid >= repair.totalCost ? 'paid' : autoPaid > 0 ? 'partial' : 'unpaid',
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('آیا از حذف این پرونده تعمیر مطمئن هستید؟')) {
      await remove('repairs', id);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const list = repairs || [];
    const active = list.filter(r => ['received', 'in_progress', 'waiting_parts'].includes(r.status)).length;
    const ready = list.filter(r => r.status === 'ready').length;
    const delivered = list.filter(r => r.status === 'delivered').length;
    const totalRevenue = list.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);
    const totalPartsCost = list.reduce((sum, r) => sum + (Number(r.partsCost) || 0), 0);
    const netProfit = totalRevenue - totalPartsCost;

    return {
      total: list.length,
      active,
      ready,
      delivered,
      totalRevenue,
      netProfit,
    };
  }, [repairs]);

  // Filtered List
  const filteredRepairs = useMemo(() => {
    return (repairs || []).filter(r => {
      const matchSearch = 
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.clientPhone && r.clientPhone.includes(searchTerm)) ||
        r.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.trackingCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.issueDescription && r.issueDescription.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchDevice = deviceFilter === 'all' || r.deviceType === deviceFilter;

      return matchSearch && matchStatus && matchDevice;
    }).sort((a, b) => new Date(b.receivedDate || b.createdAt).getTime() - new Date(a.receivedDate || a.createdAt).getTime());
  }, [repairs, searchTerm, statusFilter, deviceFilter]);

  if (loading) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl m-8 shadow-sm">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-bold">درحال بارگذاری بخش تعمیرات...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 font-sans text-right max-w-7xl mx-auto pb-24" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-l from-indigo-900 via-indigo-800 to-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
              <Wrench size={26} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black">مدیریت پذیرش و تعمیرات تجهیزات</h1>
              <p className="text-xs text-indigo-200 mt-0.5">پذیرش، عیب‌یابی و صدور فاکتور تعمیرات کنسول‌ها، دسته‌ها و لوازم جانبی</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Button 
            onClick={() => handleOpenNewModal()}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-lg shadow-amber-500/20 text-sm flex items-center gap-2"
          >
            <Plus size={18} />
            پذیرش تعمیر جدید
          </Button>
        </div>

        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 border border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400">کل پرونده‌ها</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{formatPersianDigits(stats.total)}</p>
          <span className="text-[10px] text-gray-400">دستگاه ثبت‌شده</span>
        </Card>

        <Card className="p-5 border border-amber-500/20 bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">در حال بررسی و تعمیر</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Wrench size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatPersianDigits(stats.active)}</p>
          <span className="text-[10px] text-amber-600/70">نیازمند اقدام</span>
        </Card>

        <Card className="p-5 border border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">آماده تحویل به مشتری</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatPersianDigits(stats.ready)}</p>
          <span className="text-[10px] text-emerald-600/70">در انتظار مراجعه مشتری</span>
        </Card>

        <Card className="p-5 border border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-400">درآمد حاصل از تعمیرات</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.totalRevenue)}</p>
          <span className="text-[10px] text-gray-400">سود خالص: {formatCurrency(stats.netProfit)}</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-5 border border-slate-200/90 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="جستجو بر اساس کد پیگیری، نام مشتری، شماره تلفن یا مدل دستگاه..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'همه وضعیت‌ها' },
              { id: 'in_progress', label: 'در حال تعمیر' },
              { id: 'ready', label: 'آماده تحویل' },
              { id: 'delivered', label: 'تحویل داده شده' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                  statusFilter === tab.id 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                    : "bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-slate-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub filter by device */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
          <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap">دسته‌بندی دستگاه:</span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'controller', label: 'دسته بازی' },
            { id: 'console', label: 'کنسول' },
            { id: 'vr', label: 'VR / هدست' },
            { id: 'accessory', label: 'لوازم جانبی' },
          ].map(d => (
            <button
              key={d.id}
              onClick={() => setDeviceFilter(d.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap",
                deviceFilter === d.id
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                  : "text-gray-500 hover:text-gray-800 dark:text-slate-400"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Repairs List */}
      {filteredRepairs.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Wrench size={28} />
          </div>
          <h3 className="text-base font-black text-gray-800 dark:text-white mb-1">پرونده تعمیری با این مشخصات یافت نشد</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mb-5">
            می‌توانید با زدن دکمه زیر، اولین پذیرش تعمیر دسته، کنسول یا قطعات را به راحتی ثبت و فاکتور آن را چاپ کنید.
          </p>
          <Button onClick={() => handleOpenNewModal()} className="bg-indigo-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl">
            ثبت اولین پذیرش تعمیر
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRepairs.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.received;
            const StatusIcon = statusCfg.icon;
            const deviceCfg = DEVICE_TYPE_LABELS[item.deviceType] || DEVICE_TYPE_LABELS.other;
            const DeviceIcon = deviceCfg.icon;
            const isRemaining = (item.totalCost - (item.paidAmount || 0)) > 0;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Tracking code & status */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg">
                        {item.trackingCode}
                      </span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", deviceCfg.color)}>
                        {deviceCfg.label.split(' ')[0]}
                      </span>
                    </div>

                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border", statusCfg.bg, statusCfg.text, statusCfg.border)}>
                      <StatusIcon size={12} />
                      <span>{statusCfg.label}</span>
                    </div>
                  </div>

                  {/* Device & Client Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                        <DeviceIcon size={16} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-gray-900 dark:text-white leading-tight">
                          {item.deviceModel}
                        </h4>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {item.serialNumber ? `سریال: ${item.serialNumber}` : 'بدون شماره سریال'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-[11px] flex items-center gap-1">
                          <User size={12} /> مشتری:
                        </span>
                        <span className="font-bold text-gray-800 dark:text-slate-200">{item.clientName}</span>
                      </div>
                      {item.clientPhone && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-[11px] flex items-center gap-1">
                            <Phone size={12} /> تماس:
                          </span>
                          <span className="font-bold text-gray-700 dark:text-slate-300" dir="ltr">{formatPersianDigits(item.clientPhone)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-gray-400 text-[11px] flex items-center gap-1">
                          <Calendar size={12} /> تاریخ پذیرش:
                        </span>
                        <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-300">
                          {new Date(item.receivedDate).toLocaleDateString('fa-IR')}
                        </span>
                      </div>
                    </div>

                    {/* Issue snippet */}
                    <div className="p-2.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/40 text-[11px]">
                      <span className="font-bold text-amber-700 dark:text-amber-400">ایراد: </span>
                      <span className="text-gray-700 dark:text-slate-300">{item.issueDescription || 'شرح ثبت نشده'}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Details & Actions */}
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block">مبلغ کل فاکتور:</span>
                      <span className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(item.totalCost)}</span>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-gray-400 block">وضعیت پرداخت:</span>
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-md",
                        item.paymentStatus === 'paid' ? "bg-emerald-100 text-emerald-700" :
                        item.paymentStatus === 'partial' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {item.paymentStatus === 'paid' ? 'تسویه کامل' : item.paymentStatus === 'partial' ? `باقیمانده: ${formatCurrency(item.totalCost - item.paidAmount)}` : 'پرداخت نشده'}
                      </span>
                    </div>
                  </div>

                  {/* Status Quick Flow */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {item.status !== 'ready' && item.status !== 'delivered' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickStatusChange(item, 'ready')}
                        className="flex-1 text-[10px] py-1.5 h-8 font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50 justify-center"
                      >
                        <CheckCircle2 size={12} className="ml-1" />
                        اعلام آماده تحویل
                      </Button>
                    )}
                    {item.status === 'ready' && (
                      <Button
                        size="sm"
                        onClick={() => handleQuickStatusChange(item, 'delivered')}
                        className="flex-1 text-[10px] py-1.5 h-8 font-bold bg-emerald-600 hover:bg-emerald-500 text-white justify-center shadow-sm"
                      >
                        <CheckCircle2 size={12} className="ml-1" />
                        تحویل و تسویه نهایی
                      </Button>
                    )}
                    <button
                      onClick={() => setPrintableRepair(item)}
                      title="چاپ قبض پذیرش و فاکتور"
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors"
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      onClick={() => handleEditModal(item)}
                      title="ویرایش اطلاعات"
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      title="حذف پرونده"
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Intake / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl text-right max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-gray-900 dark:text-white">
                      {editingRepair ? 'ویرایش پرونده تعمیر' : 'پذیرش تعمیر جدید دستگاه'}
                    </h3>
                    <p className="text-xs text-gray-400">مشخصات دستگاه، مشتری، قطعات و هزینه‌ها را وارد فرمایید.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-gray-500 hover:text-gray-800 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Client Section */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-gray-700 dark:text-slate-300">انتخاب از اعضای باشگاه یا مشتری آزاد:</label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] text-gray-400 block mb-1">عضو باشگاه:</span>
                      <select
                        value={formData.clientId}
                        onChange={e => handleClientSelect(e.target.value)}
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                      >
                        <option value="">مشتری متفرقه / آزاد</option>
                        {(clients || []).filter(c => !c.isGuest).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 block mb-1">نام کامل مشتری:*</span>
                      <input
                        type="text"
                        required
                        value={formData.clientName}
                        onChange={e => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                        placeholder="نام و نام خانوادگی"
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 block mb-1">شماره تماس:</span>
                      <input
                        type="text"
                        value={formData.clientPhone}
                        onChange={e => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                        placeholder="0912..."
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none text-left"
                      />
                    </div>
                  </div>
                </div>

                {/* Device Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">نوع دستگاه:</label>
                    <select
                      value={formData.deviceType}
                      onChange={e => setFormData(prev => ({ ...prev, deviceType: e.target.value as any }))}
                      className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                    >
                      <option value="controller">دسته بازی (Controller)</option>
                      <option value="console">کنسول بازی (PlayStation / Xbox)</option>
                      <option value="vr">هدست واقعیت مجازی (VR)</option>
                      <option value="pc">کامپیوتر / کیس گیمینگ</option>
                      <option value="accessory">لوازم جانبی / کابل</option>
                      <option value="other">سایر</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">مدل دقیق دستگاه:*</label>
                    <input
                      type="text"
                      required
                      placeholder="مثلاً: دسته PS5 DualSense یا کنسول PS4 Pro"
                      value={formData.deviceModel}
                      onChange={e => setFormData(prev => ({ ...prev, deviceModel: e.target.value }))}
                      className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">شماره سریال یا برچسب:</label>
                    <input
                      type="text"
                      placeholder="اختیاری"
                      value={formData.serialNumber}
                      onChange={e => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                      className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none text-left"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">شرح ایراد و مشکل دستگاه:*</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="مثلاً: دریفت آنالوگ چپ به سمت بالا، تعویض رابر L2 و R2، خمیر سیلیکون و سرویس دوره‌ای..."
                    value={formData.issueDescription}
                    onChange={e => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold outline-none"
                  />
                </div>

                {/* Status and Warranty */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">وضعیت پذیرش:</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                    >
                      <option value="received">پذیرش شده (در نوبت)</option>
                      <option value="in_progress">در حال بررسی و تعمیر</option>
                      <option value="waiting_parts">در انتظار قطعه</option>
                      <option value="ready">آماده تحویل به مشتری</option>
                      <option value="delivered">تحویل داده شده و تسویه</option>
                      <option value="cancelled">لغو شده</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">مهلت تست / گارانتی تعمیر (روز):</label>
                    <input
                      type="number"
                      value={formData.warrantyDays}
                      onChange={e => setFormData(prev => ({ ...prev, warrantyDays: Number(e.target.value) }))}
                      className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                  <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-300">محاسبه مالی و دستمزد:</h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1">هزینه قطعات (تومان):</span>
                      <input
                        type="number"
                        value={formData.partsCost || ''}
                        onChange={e => setFormData(prev => ({ ...prev, partsCost: Number(e.target.value) }))}
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1">اجرت و دستمزد (تومان):</span>
                      <input
                        type="number"
                        value={formData.laborCost || ''}
                        onChange={e => setFormData(prev => ({ ...prev, laborCost: Number(e.target.value) }))}
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1">تخفیف (تومان):</span>
                      <input
                        type="number"
                        value={formData.discount || ''}
                        onChange={e => setFormData(prev => ({ ...prev, discount: Number(e.target.value) }))}
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block mb-1">مبلغ کل فاکتور:</span>
                      <div className="h-10 px-3 bg-indigo-600 text-white rounded-xl flex items-center font-black text-xs">
                        {formatCurrency(totalCalculated)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1">مبلغ دریافتی تا الان (پیش‌پرداخت/تسویه):</span>
                      <input
                        type="number"
                        value={formData.paidAmount || ''}
                        onChange={e => setFormData(prev => ({ ...prev, paidAmount: Number(e.target.value) }))}
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-500 block mb-1">روش پرداخت:</span>
                      <select
                        value={formData.paymentMethod}
                        onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                      >
                        <option value="card">کارتخوان / پوز بانکی</option>
                        <option value="cash">نقدی</option>
                        <option value="account">کسر از کیف پول باشگاه</option>
                        <option value="online">انتقال کارت به کارت / آنلاین</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1">یادداشت فنی یا قطعات مصرفی:</label>
                  <input
                    type="text"
                    placeholder="مثلاً: آنالوگ فابریک ALPS اصلی تعویض شد"
                    value={formData.technicianNotes}
                    onChange={e => setFormData(prev => ({ ...prev, technicianNotes: e.target.value }))}
                    className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-xs">
                    {editingRepair ? 'بروزرسانی پرونده تعمیر' : 'ثبت قطعی پذیرش و صدور فاکتور'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl text-xs py-3">
                    انصراف
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Receipt Modal */}
      <AnimatePresence>
        {printableRepair && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white text-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-right font-sans relative"
            >
              <div className="text-center pb-4 border-b-2 border-dashed border-slate-300 mb-4">
                <h3 className="text-lg font-black text-slate-900">قبض پذیرش و فاکتور تعمیرات کلوپ</h3>
                <p className="text-xs text-slate-500 mt-1">سامانه تخصصی تعمیرات کنسول و لوازم جانبی</p>
                <div className="mt-2 inline-block bg-slate-100 px-4 py-1 rounded-full text-xs font-black text-indigo-700">
                  کد رهگیری: {printableRepair.trackingCode}
                </div>
              </div>

              <div className="space-y-3 text-xs mb-6">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">نام مشتری:</span>
                  <span className="font-bold">{printableRepair.clientName}</span>
                </div>
                {printableRepair.clientPhone && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">شماره تماس:</span>
                    <span className="font-bold" dir="ltr">{printableRepair.clientPhone}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">دستگاه / مدل:</span>
                  <span className="font-bold">{printableRepair.deviceModel}</span>
                </div>
                {printableRepair.serialNumber && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">شماره سریال:</span>
                    <span className="font-bold">{printableRepair.serialNumber}</span>
                  </div>
                )}
                <div className="py-1 border-b border-slate-100">
                  <span className="text-slate-500 block mb-1">ایراد ثبت شده:</span>
                  <p className="font-bold bg-slate-50 p-2 rounded-lg">{printableRepair.issueDescription}</p>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">تاریخ پذیرش:</span>
                  <span className="font-bold">{new Date(printableRepair.receivedDate).toLocaleDateString('fa-IR')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">مهلت گارانتی و تست:</span>
                  <span className="font-bold text-emerald-600">{formatPersianDigits(printableRepair.warrantyDays || 7)} روز</span>
                </div>
                
                <div className="pt-2 space-y-1.5 bg-slate-50 p-3 rounded-xl">
                  <div className="flex justify-between">
                    <span>هزینه قطعات:</span>
                    <span className="font-bold">{formatCurrency(printableRepair.partsCost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>اجرت و دستمزد تعمیر:</span>
                    <span className="font-bold">{formatCurrency(printableRepair.laborCost || 0)}</span>
                  </div>
                  {printableRepair.discount ? (
                    <div className="flex justify-between text-rose-600">
                      <span>تخفیف:</span>
                      <span className="font-bold">-{formatCurrency(printableRepair.discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-indigo-900">
                    <span>مجموع قابل پرداخت:</span>
                    <span>{formatCurrency(printableRepair.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-700 font-bold">
                    <span>پرداختی مشتری:</span>
                    <span>{formatCurrency(printableRepair.paidAmount || 0)}</span>
                  </div>
                  {printableRepair.totalCost - (printableRepair.paidAmount || 0) > 0 && (
                    <div className="flex justify-between text-xs text-rose-600 font-black">
                      <span>مانده تسویه نشده:</span>
                      <span>{formatCurrency(printableRepair.totalCost - printableRepair.paidAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center mb-6 leading-relaxed">
                ارائه این برگه یا کد رهگیری جهت تحویل دستگاه الزامی است. پس از تاریخ آماده‌باش، حداکثر تا ۲ هفته جهت تحویل مراجعه فرمایید.
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                >
                  <Printer size={14} />
                  پرینت فاکتور
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setPrintableRepair(null)}
                  className="rounded-xl text-xs py-2.5"
                >
                  بستن
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
