import { localDateInput } from '../lib/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar, Percent, PlusCircle, MinusCircle, 
  CheckCircle2, FileText, Gamepad2, Coffee, Plus, Minus, Trash2, PackageCheck,
  User, Users, UserCheck, Phone, Award, ShieldCheck, Sparkles, AlertCircle, AlertTriangle, Wallet
} from 'lucide-react';
import { Button, Input } from './ui/common';
import { formatCurrency, formatPersianDigits, cn } from '../lib/utils';
import { formatJalali } from '../lib/dateUtils';
import { useFirestore, useCollection, triggerDatabaseRefresh } from '../hooks/useFirestore';
import { ReportItem } from './InvoiceModal';
import { Product, AppUser, ClientTier } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { InlineClientCreate } from './InlineClientCreate';

interface InvoiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportToEdit?: ReportItem | null;
  mode: 'edit' | 'create';
  onSuccess?: () => void;
}

interface InvoiceProductItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export function InvoiceEditModal({
  isOpen,
  onClose,
  reportToEdit,
  mode,
  onSuccess
}: InvoiceEditModalProps) {
  const { update, add, batch } = useFirestore();
  const { data: products } = useCollection<Product>('products');
  const { data: clients } = useCollection<AppUser>('clients');
  const { data: clientTiers } = useCollection<ClientTier>('client_tiers');

  // Common fields
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('12:00');
  const [adjustmentType, setAdjustmentType] = useState<'none' | 'discount' | 'addition'>('none');
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Customer Club linkage fields
  const [customerMode, setCustomerMode] = useState<'club' | 'custom'>('club');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [registerNewClient, setRegisterNewClient] = useState(false);
  const [inlineCreatedClient, setInlineCreatedClient] = useState<AppUser | null>(null);
  const [isCreatingInlineClient, setIsCreatingInlineClient] = useState(false);

  // Create Mode Specific fields
  const [newTitle, setNewTitle] = useState('فاکتور دستی');
  const [newGameAmount, setNewGameAmount] = useState<string>('0');
  const [newBuffetAmount, setNewBuffetAmount] = useState<string>('0'); // misc buffet amount
  const [selectedProducts, setSelectedProducts] = useState<InvoiceProductItem[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');
  const [deductStock, setDeductStock] = useState(true);
  const [newTaxAmount, setNewTaxAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'wallet'>('card');
  const [newDetails, setNewDetails] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInlineCreatedClient(null);
      setIsCreatingInlineClient(false);
      if (mode === 'edit' && reportToEdit) {
        const rawDate = new Date(reportToEdit.timestamp || Date.now());
        const dStr = !isNaN(rawDate.getTime()) ? localDateInput(rawDate) : localDateInput();
        const h = !isNaN(rawDate.getTime()) ? String(rawDate.getHours()).padStart(2, '0') : '12';
        const m = !isNaN(rawDate.getTime()) ? String(rawDate.getMinutes()).padStart(2, '0') : '00';
        
        setDateStr(dStr);
        setTimeStr(`${h}:${m}`);

        const currentAdj = reportToEdit.manualAdjustment || 0;
        if (currentAdj < 0) {
          setAdjustmentType('discount');
          setAdjustmentAmount(String(Math.abs(currentAdj)));
        } else if (currentAdj > 0) {
          setAdjustmentType('addition');
          setAdjustmentAmount(String(currentAdj));
        } else {
          setAdjustmentType('none');
          setAdjustmentAmount('');
        }
        setAdjustmentNote(reportToEdit.manualAdjustmentNote || '');

        // Pre-fill customer from existing sale or report
        const sale = reportToEdit.rawSale;
        const uid = sale?.userId || sale?.customerId || reportToEdit.userId || reportToEdit.customerId;
        const cName = sale?.customerName || reportToEdit.customerName || '';
        const cPhone = sale?.customerPhone || reportToEdit.customerPhone || '';
        if (uid) {
          setSelectedClientId(uid);
          setCustomerMode('club');
          const found = clients?.find(c => c.id === uid);
          setNewCustomerName(found?.name || cName);
          setNewCustomerPhone(found?.phone || cPhone);
        } else if (cName) {
          setSelectedClientId('');
          setCustomerMode('custom');
          setNewCustomerName(cName);
          setNewCustomerPhone(cPhone);
        } else {
          setSelectedClientId('');
          setCustomerMode('club');
          setNewCustomerName('');
          setNewCustomerPhone('');
        }
        setRegisterNewClient(false);
      } else {
        // Create Mode
        const now = new Date();
        setDateStr(localDateInput(now));
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        setTimeStr(`${h}:${m}`);
        setAdjustmentType('none');
        setAdjustmentAmount('');
        setAdjustmentNote('');
        setNewTitle('فاکتور دستی کلوپ');
        setSelectedClientId('');
        setNewCustomerName('');
        setNewCustomerPhone('');
        setCustomerMode('club');
        setRegisterNewClient(false);
        setNewGameAmount('0');
        setNewBuffetAmount('0');
        setSelectedProducts([]);
        setSelectedProductToAdd('');
        setDeductStock(true);
        setNewTaxAmount('0');
        setPaymentMethod('card');
        setNewDetails('');
      }
    }
  }, [isOpen, mode, reportToEdit]);

  // Selected client & tier resolution
  const availableClients = useMemo(
    () => [...(clients || []), ...(inlineCreatedClient && !clients?.some(client => client.id === inlineCreatedClient.id) ? [inlineCreatedClient] : [])],
    [clients, inlineCreatedClient]
  );

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return availableClients.find(c => c.id === selectedClientId) || null;
  }, [selectedClientId, availableClients]);

  const selectedClientTier = useMemo(() => {
    if (!selectedClient || !clientTiers) return null;
    return clientTiers.find(t => t.id === selectedClient.tier || t.name === selectedClient.tier) || null;
  }, [selectedClient, clientTiers]);

  const clientOptions = useMemo(() => {
    return availableClients.map(c => {
      const tierName = clientTiers?.find(t => t.id === c.tier || t.name === c.tier)?.name || c.tier || 'برنزی';
      const phoneText = c.phone ? formatPersianDigits(c.phone) : 'بدون شماره';
      const balanceText = `کیف پول: ${formatCurrency(c.balance || 0)}`;
      return {
        id: c.id,
        label: c.name,
        subLabel: `${phoneText} • سطح: ${tierName} • ${balanceText}`
      };
    });
  }, [availableClients, clientTiers]);

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const found = availableClients.find(c => c.id === clientId);
      if (found) {
        setNewCustomerName(found.name);
        setNewCustomerPhone(found.phone || '');
      }
    } else {
      setNewCustomerName('');
      setNewCustomerPhone('');
    }
  };

  if (!isOpen) return null;

  // Handle adding a buffet product
  const handleAddProduct = (productId: string) => {
    if (!productId) return;
    const prod = products?.find(p => p.id === productId);
    if (!prod) return;

    setSelectedProducts(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          price: prod.price,
          quantity: 1
        }
      ];
    });
    setSelectedProductToAdd('');
  };

  const handleUpdateProductQuantity = (productId: string, delta: number) => {
    setSelectedProducts(prev =>
      prev
        .map(item => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as InvoiceProductItem[]
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(item => item.productId !== productId));
  };

  // Compute live amounts for Edit Mode
  const originalAmount = reportToEdit ? Math.abs(reportToEdit.amount) : 0;
  const previousAdjustment = reportToEdit?.manualAdjustment || 0;
  const unadjustedBase = originalAmount - previousAdjustment;

  const adjNum = Number(adjustmentAmount) || 0;
  const netAdjustment = adjustmentType === 'discount' ? -adjNum : adjustmentType === 'addition' ? adjNum : 0;
  const newComputedTotal = Math.max(0, unadjustedBase + netAdjustment);

  // Compute live amounts for Create Mode
  const rawGame = Number(newGameAmount) || 0;
  const buffetProductsTotal = selectedProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const rawMiscBuffet = Number(newBuffetAmount) || 0;
  const totalBuffet = buffetProductsTotal + rawMiscBuffet;

  // Automatically determine category based on entered game amount and buffet items
  const currentCategory: 'game' | 'buffet' | 'both' = (rawGame > 0 && totalBuffet > 0)
    ? 'both'
    : (totalBuffet > 0 ? 'buffet' : 'game');

  const cTax = Number(newTaxAmount) || 0;
  const cSubtotal = rawGame + totalBuffet + cTax;
  const cTotal = Math.max(0, cSubtotal + netAdjustment);

  // Wallet payment sufficiency check
  const isWalletPayment = paymentMethod === 'wallet';
  const effectivePayable = mode === 'edit' ? newComputedTotal : cTotal;
  const hasSelectedClubMember = customerMode === 'club' && !!selectedClient;
  const clientWalletBalance = selectedClient?.balance || 0;
  const isWalletBalanceInsufficient = false;
  const isWalletWithoutMember = isWalletPayment && !hasSelectedClubMember;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isWalletWithoutMember) {
      alert('برای پرداخت از طریق کیف پول، حتماً باید یکی از اعضای باشگاه مشتریان را انتخاب کنید.');
      return;
    }

    if (isWalletBalanceInsufficient) {
      alert(`موجودی کیف پول کاربر (${formatCurrency(clientWalletBalance)}) برای تسویه این فاکتور (${formatCurrency(effectivePayable)}) کافی نیست.`);
      return;
    }

    setLoading(true);

    try {
      // Build ISO timestamp from selected date and time
      const [year, month, day] = (dateStr || localDateInput()).split('-').map(Number);
      const [hour, minute] = (timeStr || '12:00').split(':').map(Number);
      const customTimestamp = new Date(year, month - 1, day, hour, minute, 0).toISOString();

      if (mode === 'edit' && reportToEdit) {
        if (reportToEdit.type === 'session' && reportToEdit.rawSession) {
          const sess = reportToEdit.rawSession;
          await update('sessions', sess.id, {
            customDate: customTimestamp,
            manualAdjustment: netAdjustment,
            manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
            manualAdjustmentNote: adjustmentNote.trim() || null,
            totalCost: newComputedTotal
          });
        } else if (reportToEdit.type === 'sale' || reportToEdit.type === 'manual_invoice') {
          const sale = reportToEdit.rawSale;
          if (sale) {
            const finalClient = (customerMode === 'club' && selectedClientId) 
              ? availableClients.find(c => c.id === selectedClientId) 
              : null;
            await update('sales', sale.id, {
              timestamp: customTimestamp,
              manualAdjustment: netAdjustment,
              manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
              manualAdjustmentNote: adjustmentNote.trim() || null,
              totalAmount: newComputedTotal,
              customerName: (customerMode === 'club' && finalClient) ? finalClient.name : (newCustomerName.trim() || null),
              customerPhone: (customerMode === 'club' && finalClient) ? (finalClient.phone || null) : (newCustomerPhone.trim() || null),
              userId: (customerMode === 'club' && finalClient) ? finalClient.id : null,
              customerId: (customerMode === 'club' && finalClient) ? finalClient.id : null,
              customerTier: finalClient?.tier || null,
            });
          }
        } else if (reportToEdit.type === 'purchase' && reportToEdit.rawPurchase) {
          const pur = reportToEdit.rawPurchase;
          await update('purchases', pur.id, {
            timestamp: customTimestamp,
            totalCost: newComputedTotal
          });
        } else {
          // General reports collection update if exists
          await update('reports', reportToEdit.id, {
            timestamp: customTimestamp,
            amount: newComputedTotal,
            manualAdjustment: netAdjustment,
            manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
            manualAdjustmentNote: adjustmentNote.trim() || null
          });
        }
      } else {
        // Create new manual invoice
        const effectiveGame = rawGame;
        const effectiveBuffet = totalBuffet;
        const effectiveSubtotal = effectiveGame + effectiveBuffet + cTax;
        const effectiveTotal = Math.max(0, effectiveSubtotal + netAdjustment);

        const operations: any[] = [];

        // Customer & Club processing
        let finalClientId: string | null = null;
        let finalCustomerName = '';
        let finalCustomerPhone = '';
        let finalCustomerTier = '';

        if (customerMode === 'club' && selectedClient) {
          finalClientId = selectedClient.id;
          finalCustomerName = selectedClient.name;
          finalCustomerPhone = selectedClient.phone || '';
          finalCustomerTier = selectedClient.tier || 'bronze';

        } else if (customerMode === 'custom' && newCustomerName.trim()) {
          finalCustomerName = newCustomerName.trim();
          finalCustomerPhone = newCustomerPhone.trim();

          if (registerNewClient) {
            const pointsEarned = Math.max(1, Math.floor(effectiveTotal / 10000));
            const newClientData = {
              name: finalCustomerName,
              phone: finalCustomerPhone,
              tier: 'bronze',
              balance: 0,
              points: 0,
              totalPaid: 0,
              totalPlayTime: 0,
              isGuest: false,
              createdAt: new Date().toISOString()
            };
            finalClientId = crypto.randomUUID();
            operations.push({ table: 'clients', kind: 'add', id: finalClientId, data: newClientData });
            finalCustomerTier = 'bronze';
          }
        }

        // Build invoice items
        const invoiceItems = [
          ...selectedProducts.map(p => ({
            productId: p.productId,
            name: p.name,
            price: p.price,
            quantity: p.quantity
          })),
          ...(rawMiscBuffet > 0 ? [{ id: 'manual_buffet_misc', name: 'خدمات متفرقه بوفه', price: rawMiscBuffet, quantity: 1 }] : []),
          ...(effectiveGame > 0 ? [{ id: 'manual_game', name: 'خدمات بازی دستی', price: effectiveGame, quantity: 1 }] : [])
        ];

        // Build summary details string
        const detailParts: string[] = [];
        if (effectiveGame > 0) detailParts.push(`بازی: ${formatCurrency(effectiveGame)}`);
        if (selectedProducts.length > 0) {
          detailParts.push(`کالاهای بوفه: ${selectedProducts.map(i => `${i.name} (×${formatPersianDigits(i.quantity)})`).join('، ')}`);
        }
        if (rawMiscBuffet > 0) detailParts.push(`متفرقه بوفه: ${formatCurrency(rawMiscBuffet)}`);
        const defaultDetails = detailParts.join(' | ') || 'ثبت فاکتور دستی';

        const finalTitle = newTitle.trim() || 
          (currentCategory === 'game' ? 'فاکتور دستی بازی' : currentCategory === 'buffet' ? 'فاکتور دستی بوفه' : 'فاکتور دستی کلوپ');

        operations.push({ table: 'sales', kind: 'add', id: crypto.randomUUID(), data: {
          deductStock,
          title: finalTitle,
          userId: finalClientId || undefined,
          customerId: finalClientId || undefined,
          customerName: finalCustomerName || undefined,
          customerPhone: finalCustomerPhone || undefined,
          customerTier: finalCustomerTier || undefined,
          totalAmount: effectiveTotal,
          gameAmount: effectiveGame,
          buffetAmount: effectiveBuffet,
          taxAmount: cTax,
          invoiceCategory: currentCategory,
          timestamp: customTimestamp,
          type: 'manual_invoice',
          paymentMethod: paymentMethod,
          manualAdjustment: netAdjustment,
          manualAdjustmentType: adjustmentType !== 'none' ? adjustmentType : null,
          manualAdjustmentNote: adjustmentNote.trim() || null,
          details: newDetails.trim() || defaultDetails,
          items: invoiceItems
        }});
        await batch(operations);
      }

      triggerDatabaseRefresh();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره تغییرات فاکتور');
    } finally {
      setLoading(false);
    }
  };

  const productOptions = (products || []).map(p => ({
    id: p.id,
    label: p.name,
    subLabel: `${formatCurrency(p.price)} | موجودی: ${formatPersianDigits(p.stock)} ${p.unit || 'عدد'}`
  }));

  const isSubmitDisabled = loading || (paymentMethod === 'wallet' && (!selectedClient || isWalletBalanceInsufficient));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 min-h-screen w-full z-50 flex items-center justify-center p-3 md:p-6 backdrop-blur-md bg-slate-950/75 font-sans" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 md:p-7 max-w-2xl w-full shadow-2xl relative max-h-[94vh] flex flex-col overflow-hidden"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-150 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {mode === 'edit' ? 'ویرایش و تعدیل فاکتور' : 'ثبت فاکتور دستی جدید (بازی و بوفه)'}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                  {mode === 'edit' 
                    ? `شماره مرجع: ${reportToEdit?.id.slice(-6) || '---'}`
                    : 'ثبت خدمات بازی، اقلام بوفه و اتصال مستقیم به باشگاه مشتریان'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-5 custom-scrollbar pr-1">
            
            {/* 1. Title (Create Mode) */}
            {mode === 'create' && (
              <div>
                <Input
                  label="عنوان فاکتور"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: فاکتور دستی بازی، فاکتور بوفه..."
                  required
                />
              </div>
            )}

            {/* 2. Customer Club Connection Section */}
            <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl border border-indigo-150 dark:border-indigo-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Users size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 block">
                      مشتری و اتصال به باشگاه مشتریان
                    </span>
                    <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400 font-bold">
                      انتخاب از اعضا جهت ثبت امتیاز، سوابق و کسر از کیف پول
                    </span>
                  </div>
                </div>
                {clients && (
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {formatPersianDigits(clients.length)} عضو در باشگاه
                  </span>
                )}
              </div>

              {/* Toggle Mode: Existing Club Member vs Guest / Manual */}
              <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCustomerMode('club')}
                  className={cn(
                    "py-2 px-3 rounded-lg font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    customerMode === 'club'
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Users size={14} />
                  <span>عضو باشگاه مشتریان</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('custom')}
                  className={cn(
                    "py-2 px-3 rounded-lg font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    customerMode === 'custom'
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <User size={14} />
                  <span>مشتری گذری / نام دلخواه</span>
                </button>
              </div>

              {customerMode === 'club' ? (
                <div className="space-y-3 pt-1">
                  <SearchableSelect
                    options={clientOptions}
                    value={selectedClientId}
                    onChange={handleSelectClient}
                    onCreateOption={() => setIsCreatingInlineClient(true)}
                    label="جستجو و انتخاب مشتری از باشگاه"
                    placeholder="جستجو بر اساس نام، شماره موبایل یا سطح..."
                    emptyMessage="هیچ مشتری با این مشخصات در باشگاه یافت نشد"
                    allowClear={true}
                  />

                  {isCreatingInlineClient && (
                    <InlineClientCreate
                      onCreated={(client) => {
                        setInlineCreatedClient(client);
                        setSelectedClientId(client.id);
                        setNewCustomerName(client.name);
                        setNewCustomerPhone(client.phone || '');
                        setIsCreatingInlineClient(false);
                      }}
                      onCancel={() => setIsCreatingInlineClient(false)}
                    />
                  )}

                  {/* Selected Client Card Details */}
                  {selectedClient ? (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                            {selectedClient.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {selectedClient.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-800">
                                {selectedClientTier?.name || selectedClient.tier || 'برنزی'}
                              </span>
                            </div>
                            {selectedClient.phone && (
                              <span className="text-[11px] font-mono text-slate-400 block">
                                {formatPersianDigits(selectedClient.phone)}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectClient('')}
                          className="text-[11px] text-rose-500 hover:text-rose-600 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          تغییر / حذف انتخاب
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                          <span className="text-slate-400 block text-[10px] mb-0.5 flex items-center gap-1">
                            <Wallet size={11} className="text-emerald-500" />
                            موجودی کیف پول:
                          </span>
                          <span className={cn("font-black font-mono", (selectedClient.balance || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500")}>
                            {formatCurrency(selectedClient.balance || 0)}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                          <span className="text-slate-400 block text-[10px] mb-0.5 flex items-center gap-1">
                            <Award size={11} className="text-amber-500" />
                            امتیاز وفاداری:
                          </span>
                          <span className="font-black font-mono text-amber-600 dark:text-amber-400">
                            {formatPersianDigits(selectedClient.points || 0)} امتیاز
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 col-span-2 sm:col-span-1">
                          <span className="text-slate-400 block text-[10px] mb-0.5">
                            مجموع خریدها:
                          </span>
                          <span className="font-black font-mono text-slate-700 dark:text-slate-300">
                            {formatCurrency(selectedClient.totalPaid || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <AlertCircle size={13} className="text-indigo-500" />
                      یک مشتری از لیست انتخاب کنید یا برای مشتریان غیرعضو، تب «مشتری گذری / نام دلخواه» را بزنید.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="نام مشتری / طرف حساب"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="مثال: علیرضا رضایی"
                    />
                    <Input
                      label="شماره موبایل مشتری (اختیاری)"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="۰۹۱۲..."
                      type="tel"
                    />
                  </div>

                  {mode === 'create' && (
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={registerNewClient}
                        onChange={(e) => setRegisterNewClient(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800"
                      />
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <UserCheck size={14} className="text-indigo-600" />
                          عضویت مستقیم این شخص در باشگاه مشتریان
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          با انتخاب این گزینه، این مشتری همزمان با ثبت فاکتور به باشگاه مشتریان کلوپ اضافه شده و امتیاز این فاکتور برای او لحاظ خواهد شد.
                        </p>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* 3. Date & Time Setting */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Calendar size={15} className="text-indigo-600" />
                  تنظیم تاریخ و ساعت فاکتور:
                </span>
                {dateStr && (
                  <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg">
                    {formatJalali(new Date(dateStr), 'EEEE d MMMM yyyy')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاریخ فاکتور:
                  </label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    required
                    className="w-full h-9.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ساعت ثبت:
                  </label>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    required
                    className="w-full h-9.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            {/* 4. Game Amount Section */}
            {mode === 'create' && (
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-150 dark:border-indigo-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Gamepad2 size={15} className="text-indigo-600" />
                    مبلغ خدمات بازی (تومان):
                  </span>
                  {rawGame > 0 && (
                    <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                      {formatCurrency(rawGame)}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  value={newGameAmount}
                  onChange={(e) => setNewGameAmount(e.target.value)}
                  placeholder="مبلغ بازی به تومان (مثلاً: 50000)..."
                  className="h-10 text-sm font-black"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  اگر فاکتور شامل بازی نیست، مبلغ بازی را صفر بگذارید.
                </p>
              </div>
            )}

            {/* 5. Buffet Goods Section (Cart-based Item Selection) */}
            {mode === 'create' && (
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <Coffee size={15} className="text-amber-600" />
                    اقلام و کالاهای بوفه (ثبت مثل فاکتور عادی):
                  </span>
                  <span className="text-xs font-black text-amber-800 dark:text-amber-300">
                    جمع بوفه: {formatCurrency(totalBuffet)}
                  </span>
                </div>

                {/* Search & Add Product */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      options={productOptions}
                      value={selectedProductToAdd}
                      onChange={(val) => {
                        setSelectedProductToAdd(val);
                        if (val) handleAddProduct(val);
                      }}
                      placeholder="جستجوی نام کالا یا بارکد برای افزودن به فاکتور..."
                      emptyMessage="کالایی در بوفه یافت نشد"
                    />
                  </div>
                </div>

                {/* Selected Products Table / List */}
                {selectedProducts.length > 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/60 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedProducts.map((item) => (
                      <div key={item.productId} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <span className="font-black text-slate-900 dark:text-white block truncate">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            فی: {formatCurrency(item.price)}
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleUpdateProductQuantity(item.productId, 1)}
                            className="w-5 h-5 rounded-md bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                          <span className="font-black text-xs font-mono w-5 text-center text-slate-900 dark:text-white">
                            {formatPersianDigits(item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateProductQuantity(item.productId, -1)}
                            className="w-5 h-5 rounded-md bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                        </div>

                        <span className="font-black text-slate-900 dark:text-white font-mono w-20 text-left">
                          {formatCurrency(item.price * item.quantity)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(item.productId)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-2">
                    هیچ کالایی از بوفه انتخاب نشده است.
                  </p>
                )}

                {/* Extra Misc Buffet Amount & Stock deduction option */}
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        مبلغ متفرقه بوفه (خدمات/کالاهای خارج از لیست):
                      </label>
                      <Input
                        type="number"
                        value={newBuffetAmount}
                        onChange={(e) => setNewBuffetAmount(e.target.value)}
                        placeholder="0"
                        className="h-9 text-xs"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pt-5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deductStock}
                        onChange={(e) => setDeductStock(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 dark:bg-slate-800"
                      />
                      <PackageCheck size={16} className="text-amber-600" />
                      <span>کسر از موجودی انبار کالاها</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Discount or Reward / Tip Section */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Percent size={15} className="text-indigo-600" />
                  تخفیف یا پاداش / انعام فاکتور:
                </span>
                {adjustmentType !== 'none' && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                    adjustmentType === 'discount' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  }`}>
                    {adjustmentType === 'discount' ? 'کسر از فاکتور' : 'افزودن به فاکتور'}
                  </span>
                )}
              </div>

              {/* Toggle adjustment type */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setAdjustmentType('none'); setAdjustmentAmount(''); }}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    adjustmentType === 'none'
                      ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  بدون تغییر
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('discount')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    adjustmentType === 'discount'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <MinusCircle size={14} />
                  تخفیف (-)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('addition')}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    adjustmentType === 'addition'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <PlusCircle size={14} />
                  پاداش / انعام (+)
                </button>
              </div>

              {adjustmentType !== 'none' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      {adjustmentType === 'discount' ? 'مبلغ تخفیف (تومان):' : 'مبلغ پاداش / انعام (تومان):'}
                    </label>
                    <Input
                      type="number"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      placeholder="مثلاً: 20000"
                      className="h-9.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      علت {adjustmentType === 'discount' ? 'تخفیف' : 'پاداش / انعام'}:
                    </label>
                    <Input
                      type="text"
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                      placeholder={adjustmentType === 'discount' ? 'مثال: تخفیف مدیریت، مشتری ثابت' : 'مثال: پاداش پرسنل، انعام'}
                      className="h-9.5 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 7. Tax & Payment Method (Create Mode) */}
            {mode === 'create' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="مالیات بر ارزش افزوده (تومان - اختیاری)"
                    type="number"
                    value={newTaxAmount}
                    onChange={(e) => setNewTaxAmount(e.target.value)}
                    placeholder="0"
                  />
                  <Input
                    label="توضیحات تکمیلی فاکتور (اختیاری)"
                    value={newDetails}
                    onChange={(e) => setNewDetails(e.target.value)}
                    placeholder="ثبت هرگونه توضیحات تکمیلی..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    روش پرداخت:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        paymentMethod === 'card'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      کارتخوان
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      نقدی
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === 'wallet'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Wallet size={13} />
                      کیف پول
                    </button>
                  </div>

                  {/* Wallet Payment Status Notice */}
                  {paymentMethod === 'wallet' && (
                    <div className="mt-2.5">
                      {customerMode !== 'club' || !selectedClient ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                          <span>برای تسویه از کیف پول، ابتدا باید یکی از اعضای باشگاه مشتریان را در کادر بالا انتخاب کنید.</span>
                        </div>
                      ) : isWalletBalanceInsufficient ? (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-rose-800 dark:text-rose-300 text-xs">
                          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold">موجودی کیف پول مشتری ناکافی است!</p>
                            <p className="text-[11px] mt-0.5">
                              موجودی فعلی {formatCurrency(selectedClient.balance || 0)} است، در حالی که مبلغ قابل پرداخت {formatCurrency(effectivePayable)} می‌باشد. لطفاً روش پرداخت را تغییر دهید یا کیف پول مشتری را در بخش باشگاه شارژ کنید.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <span>موجودی کافی است (مبلغ از کیف پول عضو کسر می‌شود).</span>
                          </div>
                          <span className="font-black font-mono text-[11px]">
                            باقی‌مانده پس از کسر: {formatCurrency((selectedClient.balance || 0) - effectivePayable)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. Live Breakdown Summary Card */}
            <div className="p-4 bg-slate-50 dark:bg-indigo-950/30 rounded-2xl border border-slate-200 dark:border-indigo-900/50 space-y-2 text-xs">
              {mode === 'create' ? (
                <>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 font-bold">
                    <span>سهم بازی:</span>
                    <span>{formatCurrency(rawGame)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 font-bold">
                    <span>سهم بوفه ({formatPersianDigits(selectedProducts.reduce((c, i) => c + i.quantity, 0))} قلم کالا):</span>
                    <span>{formatCurrency(totalBuffet)}</span>
                  </div>
                  {cTax > 0 && (
                    <div className="flex justify-between text-slate-500 dark:text-slate-400 font-bold">
                      <span>مالیات:</span>
                      <span>+{formatCurrency(cTax)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-bold">
                  <span>مبلغ پایه فاکتور:</span>
                  <span>{formatCurrency(unadjustedBase)}</span>
                </div>
              )}

              {adjustmentType === 'discount' && adjNum > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>تخفیف دستی {adjustmentNote ? `(${adjustmentNote})` : ''}:</span>
                  <span>-{formatCurrency(adjNum)}</span>
                </div>
              )}

              {adjustmentType === 'addition' && adjNum > 0 && (
                <div className="flex justify-between text-indigo-700 dark:text-indigo-400 font-bold">
                  <span>پاداش / انعام یا مبلغ افزایشی {adjustmentNote ? `(${adjustmentNote})` : ''}:</span>
                  <span>+{formatCurrency(adjNum)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 dark:border-indigo-800/60">
                <span className="font-black text-slate-900 dark:text-white text-sm">مبلغ نهایی قابل پرداخت:</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(mode === 'edit' ? newComputedTotal : cTotal)}
                </span>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={16} />
                {mode === 'edit' ? 'ذخیره تغییرات فاکتور' : 'ذخیره'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-12 px-5 rounded-2xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
