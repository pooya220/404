import React, { useState, useEffect, useRef } from 'react';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { Product, SystemSettings, Sale } from '../types';
import { Card, Button, Badge, Input, Modal, SegmentToggle, ToggleOption } from '../components/ui/common';
import { 
  Plus, Search, ShoppingBag, Package, Trash2, Edit3, Coffee, IceCream, 
  ReceiptText, ShoppingCart, X, ChevronRight, Percent, Coins, CreditCard, 
  Wallet, AlertCircle, TrendingUp, CheckCircle, Barcode, ClipboardList, 
  Tag, RefreshCw, ArrowUpRight, BellRing, BellOff, Volume2, VolumeX,
  ChevronDown, ChevronUp, Sparkles, AlertTriangle, Scale, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatPersianNumber, formatCurrency, cn, formatPersianDigits } from '../lib/utils';
import { SearchableSelect } from '../components/SearchableSelect';
import { InlineClientCreate } from '../components/InlineClientCreate';
import { LEGACY_SHOP_CATEGORIES, PRINT_CATEGORY, PRINT_SERVICES, STATIONERY_CATEGORY, productBelongsToSection, type PrintService, type ProductSection } from '../lib/productCategories';

type CartItem = { id: string; name: string; price: number; quantity: number; category: string; isService?: boolean };

// Get matching category icon
function getCategoryIcon(category: string, size = 18) {
  switch (category) {
    case 'نوشیدنی':
      return <Coffee size={size} />;
    case 'تنقلات':
    case 'غذا':
      return <IceCream size={size} />;
    default:
      return <Package size={size} />;
  }
}

function ProductRow({ product, displayStock, onEdit, onDelete, defaultMinStock = 10 }: { 
  product: Product, 
  displayStock?: number,
  onEdit: (p: Product) => void, 
  onDelete: (id: string) => void,
  defaultMinStock?: number,
  key?: any
}) {
  const stock = Number.isFinite(displayStock) ? Number(displayStock) : Number(product.stock) || 0;
  const unit = product.unit || 'عدد';
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= (product.minStock !== undefined ? product.minStock : defaultMinStock);
  
  return (
    <div className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors group">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
        product.category === 'نوشیدنی' ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" :
        product.category === 'تنقلات' || product.category === 'غذا' ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" :
        "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
      )}>
        {getCategoryIcon(product.category, 22)}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-900 dark:text-white truncate">{product.name}</h4>
        <p className="text-xs text-gray-400 dark:text-slate-500">{product.category}</p>
      </div>

      <div className="text-left px-4">
        <p className="text-xs text-gray-400 dark:text-slate-500 mr-1 mb-0.5">قیمت فروش</p>
        <p className="text-sm font-black text-gray-900 dark:text-white">{formatCurrency(product.price)}</p>
      </div>

      <div className="text-center w-28 flex flex-col items-center">
        <Badge variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}>
          {isOutOfStock ? 'ناموجود' : `${formatPersianNumber(stock)} ${unit}`}
        </Badge>
        {isLowStock && !isOutOfStock && (
          <span className="text-[9px] text-amber-500 font-bold mt-1">نیاز به خرید</span>
        )}
      </div>

      <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" onClick={() => onEdit(product)} className="p-2 aspect-square rounded-xl">
          <Edit3 size={16} />
        </Button>
        <Button variant="ghost" onClick={() => onDelete(product.id)} className="p-2 aspect-square rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20">
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}

export default function Products() {
  const { data: products, loading, error } = useCollection<Product>('products');
  const { data: clients } = useCollection<any>('clients');
  const { data: settingsList } = useCollection<SystemSettings>('settings');
  const { add, update, remove, batch } = useFirestore();
  
  const [activeTab, setActiveTab] = useState<ProductSection>('buffet');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [printServices, setPrintServices] = useState<PrintService[]>(() => PRINT_SERVICES.map(service => ({ ...service })));
  const [editingPrintService, setEditingPrintService] = useState<PrintService | null>(null);
  const [printServiceForm, setPrintServiceForm] = useState({ name: '', price: '' });
  const [savingPrintService, setSavingPrintService] = useState(false);

  // --- Purchase/Replenishment Modal (Unified) ---
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseMode, setPurchaseMode] = useState<'standard' | 'bulk_split'>('standard');
  
  // Unified product purchase/creation form (Standard)
  const [existPurchaseForm, setExistPurchaseForm] = useState({
    productId: '',
    newName: '',
    category: 'نوشیدنی',
    quantity: '',
    costPrice: '',
    newPrice: '',
    minStock: '10'
  });

  // Bulk Purchase & Sub-Item Splitter (e.g. Coffee Beans to single/double espresso)
  interface BulkSubItem {
    id: string;
    productId: string; // 'new' or existing product id
    name: string;
    category: string;
    portionGrams: number;
    price: number;
  }

  const [bulkForm, setBulkForm] = useState({
    bulkName: 'دانه قهوه اسپرسو',
    category: 'نوشیدنی',
    totalGrams: 1000,
    totalCost: '',
    subItems: [
      {
        id: 'sub-1',
        productId: 'new',
        name: 'قهوه تک شات (۱۵ گرم)',
        category: 'نوشیدنی',
        portionGrams: 15,
        price: 35000
      },
      {
        id: 'sub-2',
        productId: 'new',
        name: 'قهوه دابل شات (۲۰ گرم)',
        category: 'نوشیدنی',
        portionGrams: 20,
        price: 45000
      }
    ] as BulkSubItem[]
  });

  // Edit Product Modal (purely meta editing)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: 'نوشیدنی', price: '', minStock: '10' });

  // Delete product confirmation
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // --- Point-of-Sale (POS) Direct Sale Modal ---
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
  const [quickSaleSearch, setQuickSaleSearch] = useState('');
  const [posCategory, setPosCategory] = useState<string>('همه');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [applyTax, setApplyTax] = useState(true);
  
  // Advanced POS Features
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'wallet'>('card');
  const [discountType, setDiscountType] = useState<'percent' | 'cash'>('percent');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [saleLoading, setSaleLoading] = useState(false);

  // Ignore malformed legacy rows so one bad product cannot crash the buffet
  // page while the record is being repaired from the database.
  const safeProducts = (products || []).filter((product: any) =>
    product &&
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    typeof product.category === 'string' &&
    product.category.trim().length > 0
  );

  useEffect(() => {
    const configuredServices = settingsList?.find(setting => Array.isArray(setting.printServices))?.printServices;
    if (!configuredServices) return;
    setPrintServices(PRINT_SERVICES.map(defaultService => {
      const saved = configuredServices.find(service => service.id === defaultService.id);
      return {
        ...defaultService,
        name: saved?.name?.trim() || defaultService.name,
        price: Number.isFinite(Number(saved?.price)) ? Number(saved?.price) : defaultService.price,
      };
    }));
  }, [settingsList]);

  const availableStock = (product: Product) => {
    if (product.rawMaterialId && Number(product.gramsPerServing) > 0) {
      const rawMaterial = safeProducts.find(item => String(item.id) === String(product.rawMaterialId));
      return Math.max(0, Math.floor((Number(rawMaterial?.stock) || 0) / Number(product.gramsPerServing)));
    }
    return Math.max(0, Number(product.stock) || 0);
  };

  // Linked menu products share one raw-material balance. The cart must reserve
  // sibling portions together instead of treating each SKU's capacity separately.
  const maxCartQuantity = (product: Product, cartItems: { id: string; quantity: number }[]) => {
    if (!product.rawMaterialId || !(Number(product.gramsPerServing) > 0)) return Math.max(0, Math.floor(Number(product.stock) || 0));
    const rawMaterial = safeProducts.find(item => String(item.id) === String(product.rawMaterialId));
    const rawStock = Math.max(0, Number(rawMaterial?.stock) || 0);
    const siblingUsage = cartItems.reduce((sum, cartItem) => {
      if (cartItem.id === product.id) return sum;
      const sibling = safeProducts.find(item => item.id === cartItem.id);
      return String(sibling?.rawMaterialId || '') === String(product.rawMaterialId)
        ? sum + Number(cartItem.quantity || 0) * Number(sibling?.gramsPerServing || 0)
        : sum;
    }, 0);
    return Math.max(0, Math.floor((rawStock - siblingUsage) / Number(product.gramsPerServing)));
  };

  // --- Auto Alert System States ---
  const [isAlertMuted, setIsAlertMuted] = useState(() => localStorage.getItem('alert_muted') === 'true');
  const [hasPlayedAlarmOnLoad, setHasPlayedAlarmOnLoad] = useState(false);
  const [isAlertsPanelOpen, setIsAlertsPanelOpen] = useState(true);

  // Helper sound player (Standard Web Audio API Chime)
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (time: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.08, time); // quiet, polite chime
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + duration);
      };
      const now = audioCtx.currentTime;
      playTone(now, 587.33, 0.15); // D5
      playTone(now + 0.12, 880.00, 0.25); // A5
    } catch (e) {
      // Audio notification blocked by browser before user interaction (expected behavior)
    }
  };

  const toggleAlertMute = () => {
    const newVal = !isAlertMuted;
    setIsAlertMuted(newVal);
    localStorage.setItem('alert_muted', String(newVal));
  };

  const handleQuickReplenish = (product: Product) => {
    setExistPurchaseForm({
      productId: product.id,
      newName: product.name,
      category: product.category,
      quantity: '',
      costPrice: '',
      newPrice: String(product.price),
      minStock: String(product.minStock !== undefined ? product.minStock : defaultMinStock)
    });
    setShowPurchaseModal(true);
  };

  const defaultMinStock = settingsList && settingsList.length > 0 && settingsList[0].defaultMinStock !== undefined 
    ? Number(settingsList[0].defaultMinStock) 
    : 10;

  const lowStockProducts = safeProducts.filter(p =>
    !p.rawMaterialId && Number(p.stock) <= (p.minStock !== undefined ? p.minStock : defaultMinStock)
  );

  useEffect(() => {
    if (lowStockProducts.length > 0 && !isAlertMuted && !hasPlayedAlarmOnLoad && !loading) {
      playAlertSound();
      setHasPlayedAlarmOnLoad(true);
    }
  }, [lowStockProducts.length, isAlertMuted, hasPlayedAlarmOnLoad, loading]);

  // Auto-focus search input inside POS
  const posSearchRef = useRef<HTMLInputElement>(null);

  const taxRate = settingsList && settingsList.length > 0 ? settingsList[0].taxRate : 0;

  // Sync edit form/cost factors when selecting an existing product
  useEffect(() => {
    if (existPurchaseForm.productId) {
      const selectedProd = safeProducts.find(p => p.id === existPurchaseForm.productId);
      if (selectedProd) {
        setExistPurchaseForm(prev => ({
          ...prev,
          newPrice: String(selectedProd.price)
        }));
      }
    }
  }, [existPurchaseForm.productId]);

  // Handle opening direct sale modal
  useEffect(() => {
    if (isQuickSaleOpen) {
      setTimeout(() => {
        posSearchRef.current?.focus();
      }, 150);
    }
  }, [isQuickSaleOpen]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const requestedQuantity = (existing?.quantity || 0) + 1;
      if (requestedQuantity > maxCartQuantity(product, prev)) return prev;
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, category: product.category }];
    });
  };

  const addPrintServiceToCart = (service: PrintService) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === service.id);
      if (existing) return prev.map(item => item.id === service.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...service, quantity: 1, category: PRINT_CATEGORY, isService: true }];
    });
  };

  const startPrintSale = (service: PrintService) => {
    addPrintServiceToCart(service);
    setPosCategory(PRINT_CATEGORY);
    setQuickSaleSearch('');
    setIsQuickSaleOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        const product = safeProducts.find(candidate => candidate.id === id);
        if (item.isService) return { ...item, quantity: newQty };
        if (!product || newQty > maxCartQuantity(product, prev)) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const confirmDelete = async () => {
    if (isDeletingId) {
      await remove('products', isDeletingId);
      setIsDeletingId(null);
    }
  };

  // Safe tab categorization
  const filteredProducts = safeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSection = productBelongsToSection(p.category, activeTab);
    const matchesStoreCategory = activeTab !== 'stationery'
      || storeCategoryFilter === 'all'
      || p.category === storeCategoryFilter;
    return matchesSearch && matchesSection && matchesStoreCategory;
  });
  const visiblePrintServices = printServices.filter(service =>
    !searchTerm || service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const showPrintServices = activeTab === 'stationery'
    && (storeCategoryFilter === 'all' || storeCategoryFilter === PRINT_CATEGORY);

  const openPrintServiceEditor = (service: PrintService) => {
    setEditingPrintService(service);
    setPrintServiceForm({ name: service.name, price: String(service.price) });
  };

  const handlePrintServiceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPrintService || savingPrintService) return;
    const name = printServiceForm.name.trim();
    const price = Number(printServiceForm.price);
    if (!name || !Number.isSafeInteger(price) || price < 0) {
      alert('نام خدمت را وارد کنید و قیمت معتبر (عدد صحیح و صفر یا بیشتر) بنویسید.');
      return;
    }

    const nextServices = printServices.map(service => service.id === editingPrintService.id
      ? { ...service, name, price }
      : service
    );
    setSavingPrintService(true);
    try {
      const settings = settingsList?.[0];
      if (settings) {
        await update('settings', settings.id, { printServices: nextServices });
      } else {
        await add('settings', {
          currency: 'تومان',
          taxRate: 0,
          contactPhone: '',
          address: '',
          autoBackup: false,
          alarmMinuteWarning: 5,
          alarmEnabled: false,
          printServices: nextServices,
        });
      }
      setPrintServices(nextServices);
      setEditingPrintService(null);
    } catch (error) {
      console.error('Could not save print service settings:', error);
      alert('ذخیره تغییرات پرینت انجام نشد. اتصال سرور و دیتابیس را بررسی کنید.');
    } finally {
      setSavingPrintService(false);
    }
  };

  // Get active client for direct sales
  const activeClient = clients?.find((c: any) => c.id === selectedCustomerId);

  // Calculations for Direct Sale Invoice
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let calculatedDiscount = 0;
  if (discountAmount && Number(discountAmount) > 0) {
    if (discountType === 'percent') {
      calculatedDiscount = Math.round((subtotal * Math.min(100, Number(discountAmount))) / 100);
    } else {
      calculatedDiscount = Math.min(subtotal, Number(discountAmount));
    }
  }

  const taxAmount = applyTax ? Math.round(((subtotal - calculatedDiscount) * taxRate) / 100) : 0;
  const totalAmountPayable = Math.max(0, subtotal - calculatedDiscount + taxAmount);

  // We allow wallet balance to go negative
  const isWalletInsufficient = false;
  const isWalletGoingNegative = paymentMethod === 'wallet' && activeClient && (activeClient.balance || 0) < totalAmountPayable;

  // Complete point of sale invoice
  const handleCompleteQuickSale = async () => {
    if (cart.length === 0 || saleLoading) return;

    setSaleLoading(true);
    try {
      // 1. Record the sale
      await add('sales', {
        items: cart.map(item => ({
          ...(!item.isService ? { productId: item.id } : {}),
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          category: item.category
        })),
        totalAmount: totalAmountPayable,
        taxAmount,
        taxRate: applyTax ? taxRate : 0,
        discountAmount: calculatedDiscount,
        timestamp: new Date().toISOString(),
        type: 'quick_sale',
        userId: selectedCustomerId || null,
        paymentMethod: paymentMethod
      });
      
      // Reset
      setCart([]);
      setSelectedCustomerId('');
      setDiscountAmount('');
      setIsQuickSaleOpen(false);
      setPaymentMethod('card');
    } catch (err) {
      console.error(err);
      alert("خطا در ثبت فروش");
    } finally {
      setSaleLoading(false);
    }
  };

  // --- Purchase Submit (Inventory Replenishment & Initial entries - Unified Form) ---
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { productId, newName, category, quantity, costPrice, newPrice, minStock } = existPurchaseForm;
    if (!productId || !quantity || !costPrice) return;

    try {
      const qtyNum = Number(quantity);
      const costNum = Number(costPrice);

      if (productId === 'new_product') {
        if (!newName || !newPrice) {
          alert('لطفاً نام کالا و قیمت فروش کالا را مشخص کنید.');
          return;
        }

        const sellPriceNum = Number(newPrice);

        const newProductId = crypto.randomUUID();
        await batch([
          { table: "products", kind: "add", id: newProductId, data: { name: newName, category, price: sellPriceNum, stock: 0, minStock: Number(minStock || 10) } },
          { table: "purchases", kind: "add", id: crypto.randomUUID(), data: { productId: newProductId, productName: newName, quantity: qtyNum, costPrice: costNum, totalCost: qtyNum * costNum, timestamp: new Date().toISOString() } }
        ]);
      } else {
        const product = safeProducts.find(p => p.id === productId);
        if (!product) return;

        const updatedSellPrice = newPrice ? Number(newPrice) : product.price;

        await batch([
          { table: "purchases", kind: "add", id: crypto.randomUUID(), data: { productId, productName: product.name, quantity: qtyNum, costPrice: costNum, totalCost: qtyNum * costNum, timestamp: new Date().toISOString() } },
          { table: "products", kind: "update", id: productId, data: { price: updatedSellPrice } }
        ]);
      }

      setShowPurchaseModal(false);
      setExistPurchaseForm({
        productId: '',
        newName: '',
        category: 'نوشیدنی',
        quantity: '',
        costPrice: '',
        newPrice: '',
        minStock: '10'
      });
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت سند خرید کالا');
    }
  };

  // --- Sub-Item Helpers for Bulk Purchase (Coffee, etc.) ---
  const handleAddBulkSubItem = () => {
    const newId = `sub-${Date.now()}`;
    setBulkForm(prev => ({
      ...prev,
      subItems: [
        ...prev.subItems,
        {
          id: newId,
          productId: 'new',
          name: `کالای تفکیکی ${formatPersianDigits(prev.subItems.length + 1)}`,
          category: 'نوشیدنی',
          portionGrams: 15,
          price: 30000
        }
      ]
    }));
  };

  const handleRemoveBulkSubItem = (id: string) => {
    if (bulkForm.subItems.length <= 1) return;
    setBulkForm(prev => ({
      ...prev,
      subItems: prev.subItems.filter(item => item.id !== id)
    }));
  };

  const handleBulkPurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { bulkName, totalGrams, totalCost, subItems } = bulkForm;

    if (!bulkName.trim()) {
      alert('لطفاً نام ماده فله (مثلاً: دانه قهوه) را وارد کنید.');
      return;
    }
    const gramsNum = Number(totalGrams);
    const costNum = Number(totalCost);
    if (!gramsNum || gramsNum <= 0 || !costNum || costNum <= 0) {
      alert('لطفاً مقدار کل فله (گرم) و مبلغ کل خرید را به درستی وارد کنید.');
      return;
    }

    if (!subItems || subItems.length === 0) {
      alert('حداقل یک کالای منو برای تعیین مصرف هر سهم اضافه کنید.');
      return;
    }

    for (let i = 0; i < subItems.length; i++) {
      const item = subItems[i];
      if (!item.name.trim()) {
        alert(`لطفاً نام کالای تفکیکی ردیف ${formatPersianDigits(i + 1)} را مشخص کنید.`);
        return;
      }
      if (!item.portionGrams || Number(item.portionGrams) <= 0) {
        alert(`وزن هر سهم (گرم) برای «${item.name}» باید بیشتر از صفر باشد.`);
        return;
      }
    }

    try {
      const bulkOperations: any[] = [];
      const stageAdd = async (table: string, data: any) => { const id = crypto.randomUUID(); bulkOperations.push({ table, kind: "add", id, data }); return { ...data, id }; };
      const stageUpdate = async (table: string, id: string, data: any) => { bulkOperations.push({ table, kind: "update", id, data, expected: (products?.find(p => p.id === id) as any)?._rev || 0 }); };
      // 1. Check or create raw material entry
      let rawMaterial = safeProducts.find(p => p.isRawMaterial && p.name.trim().toLowerCase() === bulkName.trim().toLowerCase());
      let rawMaterialId = rawMaterial?.id;

      if (rawMaterial) {
        // Increase existing raw material stock
        await stageUpdate('products', rawMaterial.id, {
          costPrice: Math.round(costNum / gramsNum)
        });
      } else {
        const rawRef: any = await stageAdd('products', {
          name: bulkName.trim(),
          category: 'مواد اولیه',
          price: 0,
          costPrice: Math.round(costNum / gramsNum),
          stock: 0,
          unit: 'گرم',
          isRawMaterial: true,
          minStock: 200
        });
        rawMaterialId = rawRef?.id;
      }

      const subItemsSummary = [];

      for (const item of subItems) {
        const portionGrams = Number(item.portionGrams);
        const unitCost = Math.round(portionGrams * (costNum / gramsNum));
        const sellPriceNum = Number(item.price || 0);

        if (item.productId === 'new') {
          const newProdRef: any = await stageAdd('products', {
            name: item.name.trim(),
            category: item.category || 'نوشیدنی',
            price: sellPriceNum,
            costPrice: unitCost,
            stock: 999, // Prepared from bulk raw material on demand
            unit: 'فنجان',
            rawMaterialId: rawMaterialId,
            gramsPerServing: portionGrams,
            minStock: 10
          });
          subItemsSummary.push({
            productId: newProdRef?.id || 'new',
            name: item.name.trim(),
            portionGrams,
            unitCost,
            sellPrice: sellPriceNum
          });
        } else {
          const existing = safeProducts.find(p => p.id === item.productId);
          if (existing) {
            await stageUpdate('products', existing.id, {
              rawMaterialId: rawMaterialId || existing.rawMaterialId,
              gramsPerServing: portionGrams,
              costPrice: unitCost,
              ...(sellPriceNum > 0 ? { price: sellPriceNum } : {})
            });
            subItemsSummary.push({
              productId: existing.id,
              name: existing.name,
              portionGrams,
              unitCost,
              sellPrice: sellPriceNum > 0 ? sellPriceNum : existing.price
            });
          }
        }
      }

      await stageAdd('purchases', {
        isBulkSplit: true,
        productId: rawMaterialId,
        productName: `خرید فله ${bulkName} (تنظیم ${subItems.length} کالای منو)`,
        rawBulkName: bulkName,
        quantity: gramsNum,
        totalGrams: gramsNum,
        costPrice: costNum / gramsNum,
        totalCost: costNum,
        subItemsSummary,
        timestamp: new Date().toISOString()
      });

      await batch(bulkOperations);

      setShowPurchaseModal(false);
      setBulkForm({
        bulkName: 'دانه قهوه اسپرسو',
        category: 'نوشیدنی',
        totalGrams: 1000,
        totalCost: '',
        subItems: [
          {
            id: 'sub-1',
            productId: 'new',
            name: 'قهوه تک شات (۱۵ گرم)',
            category: 'نوشیدنی',
            portionGrams: 15,
            price: 35000
          },
          {
            id: 'sub-2',
            productId: 'new',
            name: 'قهوه دابل شات (۲۰ گرم)',
            category: 'نوشیدنی',
            portionGrams: 20,
            price: 45000
          }
        ]
      });
    } catch (err) {
      console.error(err);
      alert('خطا در ثبت فاکتور خرید فله');
    }
  };

  // Edit meta handler (Title, Category, Min Stock adjustments)
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      minStock: String(p.minStock || 10)
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    await update('products', editingId, {
      name: editForm.name,
      category: editForm.category,
      price: Number(editForm.price),
      minStock: Number(editForm.minStock || 10)
    });

    setShowEditModal(false);
    setEditingId(null);
  };

  // Dynamic profit margin calculator
  const calculateMargin = (sell: number, cost: number) => {
    if (!sell || !cost) return 0;
    return (((sell - cost) / sell) * 100);
  };

  return (
    <div className="p-6 lg:p-10 pb-32" dir="rtl">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">مدیریت غرفه و بوفه</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">تامین کالاها، کنترل موجودی و صندوق فروش بوفه</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-wrap">
          {/* Action buttons (Brought completely out of card frame & grouped on the right of tabs in RTL) */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button 
              onClick={() => {
                setExistPurchaseForm({
                  productId: '',
                  newName: '',
                  category: 'نوشیدنی',
                  quantity: '',
                  costPrice: '',
                  newPrice: '',
                  minStock: '10'
                });
                setShowPurchaseModal(true);
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-500/10 flex items-center gap-2"
            >
              <Plus size={18} className="ml-1" />
              خرید
            </Button>
            
            <Button 
               variant="outline" 
               onClick={() => {
                 setPosCategory('همه');
                 setQuickSaleSearch('');
                 setIsQuickSaleOpen(true);
               }}
               className="border-2 border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/45 dark:bg-indigo-950/20 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white flex items-center gap-2 relative"
            >
              <ReceiptText size={18} className="ml-1" />
              فروش
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -left-1.5 w-4.5 h-4.5 bg-rose-500 text-white text-[9px] rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center font-black">
                  {cart.length}
                </span>
              )}
            </Button>
          </div>

          {/* Division Toggling tabs (Moved to the left corner) */}
          <SegmentToggle<ProductSection>
            options={[
              { id: 'buffet', label: 'خوراکی و نوشیدنی', icon: Coffee },
              { id: 'stationery', label: 'لوازم‌التحریر', icon: ShoppingCart }
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
            activeColor={activeTab === 'buffet' ? 'indigo' : 'emerald'}
          />
        </div>
      </div>

      {activeTab === 'stationery' && (
        <div className="mb-5 flex flex-wrap items-center gap-2" dir="rtl" aria-label="فیلتر دسته‌بندی فروشگاه">
          {[{ id: STATIONERY_CATEGORY, label: STATIONERY_CATEGORY }, { id: PRINT_CATEGORY, label: PRINT_CATEGORY }, ...LEGACY_SHOP_CATEGORIES.map(category => ({ id: category, label: category })), { id: 'all', label: 'همهٔ فروشگاه' }].map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStoreCategoryFilter(option.id)}
              className={cn(
                'rounded-xl px-3 py-2 text-xs font-bold transition-colors',
                storeCategoryFilter === option.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* --- AUTOMATIC INVENTORY ALERT SYSTEM PANEL --- */}
      <AnimatePresence>
        {lowStockProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8 overflow-hidden rounded-[2rem] border border-rose-100 dark:border-rose-950/30 bg-rose-50/50 dark:bg-rose-950/10 shadow-lg shadow-rose-500/5 text-right"
            dir="rtl"
          >
            {/* Header of the warning box */}
            <div className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100/60 dark:border-rose-950/25">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 flex-shrink-0 animate-pulse">
                  <BellRing size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-900 dark:text-rose-400 mb-1 flex items-center gap-2">
                    سیستم هوشمند هشدار خودکار انبار کلوپ
                    <Badge variant="danger" className="mr-2 text-[9px]">
                      بحرانی
                    </Badge>
                  </h3>
                  <p className="text-xs text-rose-700/80 dark:text-rose-405/80 font-semibold">
                    تعداد <span className="font-black text-rose-600 dark:text-rose-300">{formatPersianNumber(lowStockProducts.length)} کالا</span> با کاهش شدید انبار زیر حد مجاز مواجه شده‌اند. جهت تامین موجودی اقدام نمایید.
                  </p>
                </div>
              </div>

              {/* Action buttons inside warning banner */}
              <div className="flex items-center gap-2.5 mr-auto sm:mr-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={toggleAlertMute}
                  className={cn(
                    "flex items-center gap-2 h-9 px-4.5 rounded-xl font-bold text-xs border transition-all active:scale-95",
                    isAlertMuted
                      ? "bg-white text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-gray-50"
                      : "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900 hover:opacity-90"
                  )}
                  title={isAlertMuted ? "فعال کردن لرزش صدا" : "بی‌صدا کردن سیستم"}
                >
                  {isAlertMuted ? (
                    <>
                      <VolumeX size={14} className="text-gray-400" />
                      <span>بی‌صدا شده</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={14} className="text-rose-600 dark:text-rose-400 animate-bounce" />
                      <span>صدا روشن</span>
                    </>
                  )}
                </button>

                <Button
                  type="button"
                  onClick={() => setIsAlertsPanelOpen(!isAlertsPanelOpen)}
                  variant="outline"
                  className="h-9 px-3.5 border-rose-200/50 hover:bg-rose-100 text-rose-800 dark:border-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/20"
                >
                  {isAlertsPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
              </div>
            </div>

            {/* Expanded section view: detailed list of critically low items */}
            {isAlertsPanelOpen && (
              <div className="p-4 md:p-6 bg-white/40 dark:bg-slate-900/10 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lowStockProducts.map(p => {
                    const isZero = p.stock <= 0;
                    return (
                      <motion.div
                        key={p.id}
                        layoutId={`alert-card-${p.id}`}
                        className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-850 shadow-sm hover:border-rose-100 dark:hover:border-rose-950/30 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse",
                            isZero 
                              ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400" 
                              : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                          )}>
                            {isZero ? <AlertTriangle size={18} /> : <ShoppingCart size={18} />}
                          </div>
                          <div className="min-w-0 text-right mr-1">
                            <h4 className="font-bold text-gray-900 dark:text-white text-xs md:text-sm truncate leading-snug">{p.name}</h4>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">دسته‌بندی: {p.category}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-left font-black">
                            <span className={cn(
                              "text-xs block mb-0.5",
                              isZero ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                            )}>
                              {isZero ? "ناموجود" : `${formatPersianNumber(p.stock)} ${p.unit || 'عدد'} مقدور`}
                            </span>
                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold block">
                              حداقل نیاز: {formatPersianNumber(p.minStock !== undefined ? p.minStock : defaultMinStock)} {p.unit || 'عدد'}
                            </span>
                          </div>

                          <Button
                            type="button"
                            onClick={() => handleQuickReplenish(p)}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-100 hover:border-transparent dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white dark:border-emerald-900/30 h-8 px-3.5 rounded-lg text-[10px] font-black flex items-center gap-1 shrink-0 transition-all duration-200 active:scale-95 shadow-none"
                          >
                            <Plus size={12} />
                            <span>شارژ سریع</span>
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Product Catalog Display */}
      <Card className="overflow-hidden mb-16">
        <div className="p-4 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="جستجوی همزمان بر اساس نام کالا، دسته‌بندی و ویژگی..."
              className="w-full bg-slate-50 dark:bg-slate-900 pr-10 pl-4 py-2.5 rounded-xl text-xs font-bold border-2 border-transparent focus:border-primary-theme dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all dark:text-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 font-bold">
            <span>تعداد کالاها:</span>
            <Badge variant="info">
              {formatPersianNumber(filteredProducts.length + (showPrintServices ? visiblePrintServices.length : 0))} قلم و خدمت
            </Badge>
          </div>
        </div>

        <>
        {showPrintServices && visiblePrintServices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
            {visiblePrintServices.map(service => (
              <div
                key={service.id}
                className="rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/15 p-5 text-right hover:border-amber-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                    <ReceiptText size={21} />
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(service.price)}</span>
                    <button
                      type="button"
                      onClick={() => openPrintServiceEditor(service)}
                      title={`ویرایش ${service.name}`}
                      aria-label={`ویرایش ${service.name}`}
                      className="p-2 rounded-lg text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    >
                      <Edit3 size={17} />
                    </button>
                  </div>
                </div>
                <h3 className="mt-4 text-base font-black text-gray-900 dark:text-white">{service.name}</h3>
                <p className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400">قیمت هر برگ · بدون کسر موجودی انبار</p>
                <button
                  type="button"
                  onClick={() => startPrintSale(service)}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-black text-white"
                >
                  افزودن به فاکتور فروش <ChevronRight size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="hidden md:flex items-center gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/20 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800">
          <div className="w-12" />
          <div className="flex-1">نام و گروه بندی کالا</div>
          <div className="text-left px-4">قیمت واحد (تومان)</div>
          <div className="text-center w-28">وضعیت موجودی انبار</div>
          <div className="w-20" />
        </div>
        
        {loading ? (
          <div className="p-10 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 dark:bg-slate-800 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {filteredProducts.map(p => (
              <ProductRow 
                key={p.id} 
                product={p} 
                displayStock={availableStock(p)}
                onEdit={openEdit} 
                onDelete={id => setIsDeletingId(id)} 
                defaultMinStock={defaultMinStock}
              />
            ))}
            {filteredProducts.length === 0 && (!showPrintServices || visiblePrintServices.length === 0) && (
              <div className="p-20 text-center text-gray-400 dark:text-slate-500">
                کالایی با فیلتر کنونی پیدا نشد.
              </div>
            )}
          </div>
        )}
        </>
      </Card>

      {/* --- MODAL 1: Point of Sale (POS) Client Direct Sale --- */}
      <AnimatePresence>
        {isQuickSaleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsQuickSaleOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative bg-white dark:bg-slate-800 w-full max-w-6xl rounded-[2rem] shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden max-h-[95vh] md:max-h-[92vh] z-50 transition-colors"
            >
               {/* Right side: Product catalog grid with categories */}
               <div className="flex-1 p-5 md:p-8 overflow-y-auto border-l border-gray-100 dark:border-slate-700/80 flex flex-col">
                  
                  {/* Category badged horizontal selector */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
                       <ShoppingBag className="text-primary-theme" />
                       {posCategory === PRINT_CATEGORY ? 'خدمات پرینت' : 'فهرست خدمات و خوراک بوفه'}
                    </h3>
                  </div>

                  {/* Customer Quick lookup container */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                     <div className="space-y-2">
                       <SearchableSelect 
                         label="انتخاب مراجع یا مهمان"
                         placeholder="جستجوی نام یا تلفن مشتری..."
                         options={(clients || []).map((c: any) => ({
                           id: c.id,
                           label: c.name,
                           subLabel: c.isGuest ? 'مشتری پیش‌فرض' : `کیف پول: ${formatCurrency(c.balance || 0)}`
                         }))}
                         value={selectedCustomerId}
                         onChange={(val) => {
                           setSelectedCustomerId(val);
                           // If paying from wallet and no wallet or guest is chosen, default back to CARD
                           const found = clients?.find((c: any) => c.id === val);
                           if (!found || found.isGuest) {
                             setPaymentMethod('card');
                           }
                         }}
                         onCreateOption={() => setIsCreatingCustomer(true)}
                       />

                       {isCreatingCustomer && (
                         <InlineClientCreate
                           onCreated={(client) => {
                             setSelectedCustomerId(client.id);
                             setIsCreatingCustomer(false);
                             setPaymentMethod('card');
                           }}
                           onCancel={() => setIsCreatingCustomer(false)}
                         />
                       )}
                     </div>
                     
                     <div className="relative text-right h-12 mt-auto">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                          ref={posSearchRef}
                          type="text"
                          placeholder="کد کالا، نام محصول یا دسته‌بندی..."
                          className="w-full h-full bg-slate-50 dark:bg-slate-900 pr-11 pl-4 rounded-xl text-xs font-bold border-2 border-transparent focus:border-primary-theme dark:focus:border-indigo-500 outline-none transition-all dark:text-white"
                          value={quickSaleSearch}
                          onChange={e => setQuickSaleSearch(e.target.value)}
                        />
                     </div>
                  </div>

                  {/* Quick POS Categories Slider */}
                  <div className="flex gap-2 pb-4 overflow-x-auto select-none border-b border-gray-50 dark:border-slate-800/80 mb-5 scrollbar-thin">
                    {['همه', 'نوشیدنی', 'تنقلات', 'غذا', PRINT_CATEGORY, STATIONERY_CATEGORY, ...LEGACY_SHOP_CATEGORIES].map(cat => {
                      const isActive = posCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setPosCategory(cat)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-all",
                            isActive 
                              ? "bg-primary-theme text-white shadow-md shadow-primary-theme/10" 
                              : "bg-slate-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Product Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto flex-1 pr-1" style={{ maxHeight: '42vh' }}>
                    {posCategory === PRINT_CATEGORY ? (
                      printServices
                        .filter(service => !quickSaleSearch || service.name.toLowerCase().includes(quickSaleSearch.toLowerCase()))
                        .map(service => {
                          const inCart = cart.find(item => item.id === service.id);
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => addPrintServiceToCart(service)}
                              className={cn(
                                'relative group p-4 rounded-2xl border text-right transition-all flex flex-col justify-between h-32 select-none',
                                inCart
                                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                                  : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:border-amber-500 hover:shadow-lg'
                              )}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center"><ReceiptText size={16} /></span>
                                {inCart && <Badge variant="warning">{formatPersianNumber(inCart.quantity)} در سبد</Badge>}
                              </div>
                              <div className="mt-3">
                                <p className="font-black text-gray-900 dark:text-white text-xs">{service.name}</p>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-extrabold mt-1">{formatCurrency(service.price)} هر برگ</p>
                              </div>
                            </button>
                          );
                        })
                    ) : (
                    <>
                    {safeProducts
                      .filter(p => !p.isRawMaterial)
                      .filter(p => p.category !== PRINT_CATEGORY)
                      .filter(p => posCategory === 'همه' || p.category === posCategory)
                      .filter(p => !quickSaleSearch || p.name.toLowerCase().includes(quickSaleSearch.toLowerCase()))
                      .map(p => {
                        const inCart = cart.find(item => item.id === p.id);
                        const sharedRawMaterial = p.rawMaterialId
                          ? safeProducts.find(item => String(item.id) === String(p.rawMaterialId))
                          : null;
                        const orderLimit = maxCartQuantity(p, cart);
                        const canAdd = orderLimit > (inCart?.quantity || 0);
                        const isOutOfStock = orderLimit <= 0 && !inCart;
                        const isLowOnStock = orderLimit > 0 && orderLimit <= (p.minStock !== undefined ? p.minStock : defaultMinStock);

                        return (
                          <button
                            key={p.id}
                            onClick={() => addToCart(p)}
                            disabled={!canAdd}
                            className={cn(
                              "relative group p-4 rounded-2xl border text-right transition-all flex flex-col justify-between h-32 select-none",
                              isOutOfStock 
                                ? "bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed" 
                                : inCart 
                                  ? "bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900" 
                                  : "bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-850 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-lg hover:translate-y-[-2px]"
                            )}
                          >
                            {/* Card badge header info */}
                            <div className="flex justify-between items-start w-full">
                              <span className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-sm",
                                p.category === 'نوشیدنی' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" : "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
                              )}>
                                {getCategoryIcon(p.category, 14)}
                              </span>
                              
                              <div>
                                {isOutOfStock ? (
                                  <Badge variant="danger">اتمام موجودی</Badge>
                                ) : (
                                  <Badge variant={isLowOnStock ? 'warning' : 'default'} className="text-[9px]">
                                    {inCart ? `${formatPersianNumber(inCart.quantity)} در سبد` : `${formatPersianNumber(orderLimit)} ${p.unit || 'موجود'}`}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="mt-3">
                              <p className="font-bold text-gray-900 dark:text-white text-xs truncate leading-snug">{p.name}</p>
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold mt-1">{formatCurrency(p.price)}</p>
                              {sharedRawMaterial && <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">موجودی مشترک: {formatPersianDigits(sharedRawMaterial.stock)} {sharedRawMaterial.unit || 'واحد'}</p>}
                            </div>

                            {/* In cart badge quantity indicator overlay */}
                            {inCart && (
                              <div className="absolute top-2 left-2 bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black animate-scale-in">
                                {formatPersianDigits(inCart.quantity)}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </>
                    )}
                  </div>
               </div>

               {/* Left side: Sale register/Invoice/Checkout panel */}
               <div className="w-full md:w-[380px] bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden h-full border-r border-gray-100 dark:border-slate-800/60 flex-shrink-0">
                  <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
                     <div className="flex items-center justify-between mb-5 select-none">
                       <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                         <ShoppingCart className="text-emerald-500" />
                         سبد خرید کالای مراجع
                       </h3>
                       <button onClick={() => setIsQuickSaleOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white dark:bg-slate-800 p-1.5 rounded-full border border-gray-100 dark:border-slate-800/50">
                         <X size={16} />
                       </button>
                     </div>

                     {/* Cart Items List */}
                     <div className="space-y-3 mb-6 max-h-[25vh] overflow-y-auto pr-1">
                       {cart.length === 0 ? (
                         <div className="py-12 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 select-none">
                           <ShoppingBag size={42} className="opacity-15 mb-2" />
                           <p className="text-xs font-black">کالایی ثبت نشده است.</p>
                         </div>
                       ) : (
                         cart.map(item => (
                           <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-gray-100 dark:border-slate-850 shadow-sm flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                 <p className="text-xs font-black text-gray-800 dark:text-white truncate">{item.name}</p>
                                 <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-1">واحد: {formatCurrency(item.price)}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                 <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg scale-90">
                                   <button 
                                     onClick={() => updateCartQuantity(item.id, 1)} 
                                     className="w-7 h-7 flex items-center justify-center text-indigo-600 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-r-lg"
                                   >
                                     +
                                   </button>
                                   <span className="w-6 text-center text-xs font-black text-gray-800 dark:text-white">
                                     {formatPersianDigits(item.quantity)}
                                   </span>
                                   <button 
                                     onClick={() => updateCartQuantity(item.id, -1)} 
                                     disabled={item.quantity <= 1}
                                     className="w-7 h-7 flex items-center justify-center text-rose-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-l-lg disabled:opacity-45"
                                   >
                                     -
                                   </button>
                                 </div>
                                 <button 
                                   onClick={() => removeFromCart(item.id)} 
                                   className="text-gray-300 hover:text-red-500 p-1 bg-slate-50 dark:bg-slate-900 rounded-lg hover:border-red-105 border border-transparent transition-colors"
                                 >
                                   <X size={14} />
                                 </button>
                              </div>
                           </div>
                         ))
                       )}
                     </div>

                     {/* Advanced Checkout Details */}
                     {cart.length > 0 && (
                       <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4">
                         
                         {/* Discount section */}
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 dark:text-slate-550 block mb-1 uppercase tracking-wider">اعمال تخفیف فروشگاهی</label>
                            <div className="flex gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-100 dark:border-slate-850">
                              <select 
                                className="h-9 px-2 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-xs font-black text-gray-700 dark:text-slate-300 outline-none"
                                value={discountType}
                                onChange={e => setDiscountType(e.target.value as 'percent' | 'cash')}
                              >
                                <option value="percent">درصد %</option>
                                <option value="cash">تومان</option>
                              </select>
                              <input 
                                type="number"
                                placeholder={discountType === 'percent' ? 'مثلا ۱۰...' : 'مثلا ۵۰۰۰...'}
                                className="flex-1 bg-transparent border-0 px-2 text-xs font-black dark:text-white outline-none text-left"
                                value={discountAmount}
                                onChange={e => setDiscountAmount(e.target.value)}
                              />
                            </div>
                         </div>

                         {/* Payment Method Group */}
                         <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 dark:text-slate-550 block uppercase tracking-wider">شیوه تسویه فاکتور</label>
                           <div className="grid grid-cols-3 gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-100 dark:border-slate-850">
                             <button
                               onClick={() => setPaymentMethod('card')}
                               className={cn(
                                 "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-black transition-all gap-1",
                                 paymentMethod === 'card' ? "bg-indigo-650 text-white shadow" : "text-gray-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                               )}
                             >
                               <CreditCard size={14} />
                               کارت خوان
                             </button>

                             <button
                               onClick={() => setPaymentMethod('cash')}
                               className={cn(
                                 "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-black transition-all gap-1",
                                 paymentMethod === 'cash' ? "bg-indigo-650 text-white shadow" : "text-gray-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                               )}
                             >
                               <Coins size={14} />
                               نقدی
                             </button>

                             <button
                               onClick={() => setPaymentMethod('wallet')}
                               disabled={!selectedCustomerId || activeClient?.isGuest}
                               className={cn(
                                 "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-black transition-all gap-1 disabled:opacity-40 disabled:cursor-not-allowed",
                                 paymentMethod === 'wallet' ? "bg-indigo-650 text-white shadow" : "text-gray-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                               )}
                             >
                               <Wallet size={14} />
                               کیف پول
                             </button>
                           </div>

                           {/* Show Wallet balance when Wallet payment is requested */}
                           {selectedCustomerId && activeClient && (
                             <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-gray-100 dark:border-slate-850 flex items-center justify-between text-[11px] font-black">
                               <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                                 <Wallet size={12} className="text-gray-400" />
                                 <span>موجودی کیف پول:</span>
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className={cn(
                                   isWalletGoingNegative ? "text-rose-500 font-extrabold animate-pulse" : "text-emerald-500"
                                 )}>
                                   {formatCurrency(activeClient.balance || 0)}
                                 </span>
                                 {paymentMethod === 'wallet' && (
                                   isWalletGoingNegative ? (
                                     <span className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-md font-black">خرید نسیه (منفی شدن حساب)</span>
                                   ) : (
                                     <span className="text-[9px] bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md font-black">باقیمانده کافی</span>
                                   )
                                 )}
                               </div>
                             </div>
                           )}
                         </div>

                       </div>
                     )}
                  </div>

                  {/* Sticky Summary Footer */}
                  {cart.length > 0 && (
                    <div className="p-5 md:p-6 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 space-y-3 flex-shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
                       <div className="space-y-2 text-xs font-bold text-gray-400 dark:text-slate-500 select-none">
                         <div className="flex justify-between">
                           <span>جمع اقلام:</span>
                           <span className="text-gray-800 dark:text-slate-300">{formatCurrency(subtotal)}</span>
                         </div>
                         {calculatedDiscount > 0 && (
                           <div className="flex justify-between text-rose-500">
                             <span>کاهش بابت تخفیف:</span>
                             <span>-{formatCurrency(calculatedDiscount)}</span>
                           </div>
                         )}
                         {taxRate > 0 && (
                           <div className="flex justify-between items-center">
                             <div className="flex items-center gap-1.5">
                               <button 
                                 onClick={() => setApplyTax(!applyTax)}
                                 className={cn(
                                   "p-0.5 rounded transition-all",
                                   applyTax ? "bg-rose-50 text-rose-500 dark:bg-rose-950/20" : "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20"
                                 )}
                                 title={applyTax ? "حذف موقت مالیات" : "افزودن مالیات به فاکتور"}
                               >
                                 <X size={10} />
                               </button>
                               <span>مالیات فروشگاهی ({formatPersianDigits(taxRate)}٪):</span>
                             </div>
                             <span className={applyTax ? "text-gray-600 dark:text-slate-450" : "line-through text-slate-300 dark:text-slate-700"}>
                               {formatCurrency(taxAmount)}
                             </span>
                           </div>
                         )}
                       </div>

                       <div className="flex items-center justify-between py-2 border-y border-dashed border-gray-200 dark:border-slate-800">
                         <span className="text-xs font-black text-gray-500 dark:text-slate-400">مجموع نهایی فاکتور:</span>
                         <span className="text-lg font-black text-primary-theme dark:text-indigo-400">
                           {formatCurrency(totalAmountPayable)}
                         </span>
                       </div>

                       <Button
                         onClick={handleCompleteQuickSale}
                         disabled={cart.length === 0 || isWalletInsufficient || saleLoading}
                         className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-slate-800 text-white flex items-center justify-center gap-2 group shadow-lg shadow-indigo-650/15"
                       >
                         {saleLoading ? (
                           <span className="flex items-center gap-2 text-xs font-black">
                             <RefreshCw size={14} className="animate-spin" />
                             در حال ثبت فاکتور...
                           </span>
                         ) : (
                           <>
                             <span className="font-black text-sm">ثبت و صدور فاکتور نهایی</span>
                             <ChevronRight size={16} className="transition-transform group-hover:-translate-x-1" />
                           </>
                         )}
                       </Button>
                    </div>
                  )}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: INVENTORY RESTOCKING / PURCHASE REGISTRATION (Unified Entry) --- */}
      <AnimatePresence>
        {showPurchaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPurchaseModal(false)} className="absolute inset-0 bg-black/50 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "relative bg-white dark:bg-slate-800 w-full rounded-3xl p-6 md:p-8 shadow-2xl z-50 text-right overflow-y-auto max-h-[90vh] transition-all",
                purchaseMode === 'bulk_split' ? "max-w-2xl" : "max-w-lg"
              )}
            >
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <ClipboardList className="text-emerald-500" />
                ثبت سند خرید فاکتور ورودی انبار
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mb-5 font-medium">اسناد خرید را برای مدیریت سود، زیان و همگام‌سازی خودکار انبار ثبت کنید.</p>

              {/* Purchase Mode Switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-2xl mb-6 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPurchaseMode('standard')}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2",
                    purchaseMode === 'standard'
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                  )}
                >
                  <Package size={16} />
                  خرید مستقیم / عددی
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseMode('bulk_split')}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2",
                    purchaseMode === 'bulk_split'
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                  )}
                >
                  <Coffee size={16} />
                  خرید فله و تفکیک به سهمیه (قهوه و...)
                </button>
              </div>

              {purchaseMode === 'standard' ? (
                /* Standard Single Product Purchase Form */
                <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                  {/* Unified Selection Field */}
                  <div>
                    <label className="text-xs font-black text-gray-600 dark:text-slate-400 block mr-1 mb-2">انتخاب کالا برای خرید</label>
                    <SearchableSelect 
                      options={[
                        { id: 'new_product', label: '➕ تعریف و خرید کالای جدید (کالای غیرموجود در سیستم)', subLabel: 'ثبت و تعریف همزمان محصول جدید در انبار' },
                        ...safeProducts.filter(p => p.category !== PRINT_CATEGORY).map(p => ({
                          id: p.id,
                          label: p.name,
                          subLabel: `موجودی فعلی: ${formatPersianDigits(p.stock)} عدد | قیمت فروش: ${formatCurrency(p.price)}`
                        }))
                      ]}
                      value={existPurchaseForm.productId}
                      onChange={val => setExistPurchaseForm(prev => ({ ...prev, productId: val }))}
                      placeholder="جستجو و انتخاب کالا یا تعریف محصول جدید..."
                    />
                  </div>

                  {existPurchaseForm.productId === 'new_product' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 p-4 bg-indigo-50/40 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100/40 dark:border-indigo-950/20"
                    >
                      <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mb-1">مشخصات کاتالوگ کالای جدید:</div>
                      
                      <Input 
                        label="نام کالا" 
                        value={existPurchaseForm.newName} 
                        onChange={e => setExistPurchaseForm(prev => ({...prev, newName: e.target.value}))} 
                        required 
                      />

                      <div className="grid grid-cols-2 gap-4 text-right">
                        <div>
                          <label className="text-xs font-black text-gray-600 dark:text-slate-400 block mr-1 mb-2">دسته‌بندی کالا</label>
                          <select 
                            className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-900 border-2 border-transparent dark:border-slate-800 rounded-xl focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all duration-200 text-xs font-black dark:text-white"
                            value={existPurchaseForm.category}
                            onChange={e => setExistPurchaseForm(prev => ({...prev, category: e.target.value}))}
                          >
                            <optgroup label="بوفه و تنقلات" className="dark:bg-slate-850">
                              <option value="نوشیدنی">نوشیدنی</option>
                              <option value="تنقلات">تنقلات</option>
                              <option value="غذا">غذا / ساندویچ</option>
                            </optgroup>
                            <optgroup label="فروشگاه قطعات و خدمات" className="dark:bg-slate-850">
                              <option value="لوازم جانبی">لوازم جانبی (موبایل/کامپیوتر)</option>
                              <option value="سخت‌افزار">قطعات سخت‌افزاری</option>
                              <option value="لوازم تحریر">لوازم تحریر</option>
                              <option value="سایر">سایر موارد</option>
                            </optgroup>
                          </select>
                        </div>

                        <Input 
                          label="حداقل موجودی هشدار" 
                          type="number" 
                          value={existPurchaseForm.minStock} 
                          onChange={e => setExistPurchaseForm(prev => ({...prev, minStock: e.target.value}))} 
                        />
                      </div>
                    </motion.div>
                  )}

                  {existPurchaseForm.productId && existPurchaseForm.productId !== 'new_product' && (() => {
                    const selectedProd = safeProducts.find(p => p.id === existPurchaseForm.productId);
                    if (!selectedProd) return null;
                    const hasInputs = existPurchaseForm.quantity && existPurchaseForm.costPrice;
                    const marginValue = calculateMargin(Number(existPurchaseForm.newPrice || selectedProd.price), Number(existPurchaseForm.costPrice));

                    return (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 rounded-2xl text-[11px] font-bold">
                        <div className="space-y-1">
                          <span className="text-gray-400 block">شبیه‌سازی موجودی جدید:</span>
                          <span className="text-gray-800 dark:text-white">
                            {formatPersianDigits(selectedProd.stock)} عدد ➔{' '}
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                              {formatPersianDigits(Number(selectedProd.stock) + Number(existPurchaseForm.quantity || 0))} عدد
                            </span>
                          </span>
                        </div>
                        
                        {hasInputs && (
                          <div className="space-y-1 text-left">
                            <span className="text-gray-400 block">حاشیه سود ناخالص:</span>
                            <Badge variant={marginValue < 0 ? 'danger' : marginValue > 30 ? 'success' : 'warning'}>
                              {formatPersianNumber(marginValue.toFixed(1))}% سود
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {existPurchaseForm.productId ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Input 
                          label="تعداد خرید جدید" 
                          type="number" 
                          value={existPurchaseForm.quantity} 
                          onChange={e => setExistPurchaseForm(prev => ({...prev, quantity: e.target.value}))} 
                          required 
                        />
                        <Input 
                          label="قیمت خرید واحد (تومان)" 
                          type="number" 
                          value={existPurchaseForm.costPrice} 
                          onChange={e => setExistPurchaseForm(prev => ({...prev, costPrice: e.target.value}))} 
                          required 
                        />
                      </div>

                      <Input 
                        label={existPurchaseForm.productId === 'new_product' ? "قیمت فروش واحد (تومان)" : "بروزرسانی قیمت فروش واحد (تومان) - اختیاری"} 
                        type="number" 
                        placeholder={existPurchaseForm.productId === 'new_product' ? "قیمتی که مایلید به مشتری بفروشید..." : "اگر مایل به تغییر نرخ فروش هستید..."}
                        value={existPurchaseForm.newPrice} 
                        onChange={e => setExistPurchaseForm(prev => ({...prev, newPrice: e.target.value}))} 
                        required={existPurchaseForm.productId === 'new_product'}
                      />

                      {/* Margin review dynamically for new product */}
                      {existPurchaseForm.productId === 'new_product' && existPurchaseForm.newPrice && existPurchaseForm.costPrice && (() => {
                        const m = calculateMargin(Number(existPurchaseForm.newPrice), Number(existPurchaseForm.costPrice));
                        return (
                          <div className="flex justify-between items-center text-xs font-black p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-850">
                            <span className="text-gray-400 flex items-center gap-1.5">
                              <TrendingUp size={14} className="text-neutral-400" />
                              حاشیه سود ناخالص برآورد شده:
                            </span>
                            <Badge variant={m < 0 ? 'danger' : m > 35 ? 'success' : 'warning'}>
                              {formatPersianNumber(m.toFixed(1))}% سود ناخالص
                            </Badge>
                          </div>
                        );
                      })()}

                      {/* Summary cost feedback box */}
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                         <div className="flex justify-between items-center text-xs font-black text-emerald-800 dark:text-emerald-400">
                            <span>جمع کل سرمایه خرید فاکتور:</span>
                            <span>{formatCurrency(Number(existPurchaseForm.quantity || 0) * Number(existPurchaseForm.costPrice || 0))}</span>
                         </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-gray-200 dark:border-slate-850 rounded-2xl">
                      <ClipboardList className="mx-auto text-gray-300 dark:text-slate-700 mb-2 animate-pulse" size={36} />
                      <p className="text-xs font-bold text-gray-400 dark:text-slate-500">لطفاً ابتدا کالا را انتخاب کرده یا بر روی "تعریف محصول جدید" کلیک کنید.</p>
                    </div>
                  )}

                  {/* Foot Action Buttons */}
                  <div className="flex gap-3 pt-6">
                    <Button 
                      type="submit" 
                      disabled={!existPurchaseForm.productId}
                      className={cn(
                        "flex-1 py-3 text-sm text-white font-black",
                        existPurchaseForm.productId === 'new_product' ? "bg-indigo-650 hover:bg-slate-900" : "bg-emerald-600 hover:bg-emerald-700"
                      )}
                    >
                      {existPurchaseForm.productId === 'new_product' ? 'ثبت و خرید کالای جدید' : 'ثبت فاکتور خرید'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowPurchaseModal(false)} 
                      className="flex-1 py-3 text-sm font-black"
                    >
                      انصراف
                    </Button>
                  </div>
                </form>
              ) : (
                /* Bulk Split Purchase Form (Coffee, Tea, Syrups, etc.) */
                <form onSubmit={handleBulkPurchaseSubmit} className="space-y-5">
                  <div className="p-4 bg-amber-50/80 dark:bg-amber-950/25 rounded-2xl border border-amber-200/80 dark:border-amber-900/30 flex items-start gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl mt-0.5">
                      <Coffee size={18} />
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="font-black text-amber-950 dark:text-amber-200">
                        خرید ماده فله و تفکیک خودکار به چند کالای منو:
                      </p>
                      <p className="text-amber-800/90 dark:text-amber-300/80 text-[11px] leading-relaxed">
                        با خرید ۱ کیلوگرم (۱۰۰۰ گرم) قهوه، می‌توانید سهم‌ها را به کالاهایی مانند «اسپرسو تک (۱۵ گرم)» و «اسپرسو دوبل (۲۰ گرم)» تفکیک نمایید تا تعداد فنجان‌ها و بهای تمام‌شده هر کدام خودکار به انبار شارژ گردد.
                      </p>
                    </div>
                  </div>

                  {/* Bulk Material Specifications */}
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                      ۱. مشخصات فاکتور فله (ماده خام ورودی):
                    </span>

                    <Input 
                      label="نام ماده فله" 
                      placeholder="مثلاً: دانه قهوه اسپرسو ۱۰۰٪ عربیکا"
                      value={bulkForm.bulkName} 
                      onChange={e => setBulkForm(prev => ({ ...prev, bulkName: e.target.value }))} 
                      required 
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        label="مقدار کل خرید فله (گرم)" 
                        type="number" 
                        placeholder="1000"
                        value={bulkForm.totalGrams} 
                        onChange={e => setBulkForm(prev => ({ ...prev, totalGrams: Number(e.target.value) || 0 }))} 
                        required 
                      />

                      <Input 
                        label="مبلغ کل فاکتور خرید (تومان)" 
                        type="number" 
                        placeholder="مثلاً: 600000"
                        value={bulkForm.totalCost} 
                        onChange={e => setBulkForm(prev => ({ ...prev, totalCost: e.target.value }))} 
                        required 
                      />
                    </div>

                    {Number(bulkForm.totalCost) > 0 && Number(bulkForm.totalGrams) > 0 && (
                      <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 pt-1">
                        <Scale size={13} />
                        نرخ بهای هر گرم ماده فله: {formatCurrency(Math.round(Number(bulkForm.totalCost) / Number(bulkForm.totalGrams)))}
                      </div>
                    )}
                  </div>

                  {/* Sub-Items Splitter Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Layers size={16} className="text-indigo-600" />
                        ۲. کالاهای منو و مصرف هر سهم ({formatPersianDigits(bulkForm.subItems.length)} کالا):
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddBulkSubItem}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1"
                        >
                          <Plus size={13} />
                          افزودن کالای دیگر
                        </button>
                      </div>
                    </div>

                    {/* Sub-Items Cards */}
                    <div className="space-y-3">
                      {bulkForm.subItems.map((item, index) => {
                        const bulkCostPerGram = Number(bulkForm.totalGrams) > 0 ? (Number(bulkForm.totalCost) / Number(bulkForm.totalGrams)) : 0;
                        const maxServings = item.portionGrams > 0 ? Math.floor(Number(bulkForm.totalGrams || 0) / Number(item.portionGrams)) : 0;
                        const unitCost = Math.round(Number(item.portionGrams || 0) * bulkCostPerGram);
                        const margin = item.price > 0 && unitCost > 0 ? Math.round(((Number(item.price) - unitCost) / Number(item.price)) * 100) : 0;

                        return (
                          <div 
                            key={item.id} 
                            className="p-4 bg-slate-100/90 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-sm space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2">
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                کالای منو ردیف {formatPersianDigits(index + 1)}
                              </span>
                              {bulkForm.subItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBulkSubItem(item.id)}
                                  className="text-rose-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1"
                                >
                                  <Trash2 size={13} />
                                  حذف
                                </button>
                              )}
                            </div>

                            {/* Existing or New Selector */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-bold text-slate-500 block mb-1">اتصال به کالا</label>
                                <select
                                  className="w-full h-10 px-3 bg-slate-200/70 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                                  value={item.productId}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === 'new') {
                                      setBulkForm(prev => ({
                                        ...prev,
                                        subItems: prev.subItems.map(s => s.id === item.id ? { ...s, productId: 'new', name: `کالای تفکیکی ${formatPersianDigits(index + 1)}` } : s)
                                      }));
                                    } else {
                                      const found = safeProducts.find(p => p.id === val);
                                      if (found) {
                                        setBulkForm(prev => ({
                                          ...prev,
                                          subItems: prev.subItems.map(s => s.id === item.id ? { ...s, productId: found.id, name: found.name, price: found.price, category: found.category } : s)
                                        }));
                                      }
                                    }
                                  }}
                                >
                                  <option value="new">➕ ایجاد کاتالوگ کالای جدید در منو</option>
                                  <optgroup label="انتخاب از کالاهای موجود در انبار">
                                    {safeProducts.map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} (موجودی فعلی: {formatPersianDigits(p.stock)})
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-slate-500 block mb-1">نام کالا در فاکتور/منو</label>
                                <input
                                  type="text"
                                  value={item.name}
                                  disabled={item.productId !== 'new'}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setBulkForm(prev => ({
                                      ...prev,
                                      subItems: prev.subItems.map(s => s.id === item.id ? { ...s, name: val } : s)
                                    }));
                                  }}
                                  placeholder="مثلاً: قهوه تک شات (۱۵ گرم)"
                                  className="w-full h-10 px-3 bg-slate-200/70 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none disabled:opacity-60"
                                  required
                                />
                              </div>
                            </div>

                            {/* 2 Metric Inputs: Portion Grams & Sell Price */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                  وزن مصرف در هر سهم / فنجان (گرم)
                                </label>
                                <input
                                  type="number"
                                  value={item.portionGrams}
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    setBulkForm(prev => ({
                                      ...prev,
                                      subItems: prev.subItems.map(s => s.id === item.id ? { ...s, portionGrams: val } : s)
                                    }));
                                  }}
                                  placeholder="15"
                                  className="w-full h-10 px-2.5 bg-slate-200/70 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-200 outline-none text-center"
                                  required
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                  نرخ فروش هر سهم در منو (تومان)
                                </label>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    setBulkForm(prev => ({
                                      ...prev,
                                      subItems: prev.subItems.map(s => s.id === item.id ? { ...s, price: val } : s)
                                    }));
                                  }}
                                  placeholder="35000"
                                  className="w-full h-10 px-2.5 bg-slate-200/70 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-200 outline-none text-center"
                                  required
                                />
                              </div>
                            </div>

                            {/* Live calculation banner inside card */}
                            <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-200/50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border border-slate-300/60 dark:border-slate-800">
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">بهای تمام‌شده هر سهم:</span>
                                <span className="text-slate-800 dark:text-slate-200 font-black">
                                  {formatCurrency(unitCost)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">حاشیه سود:</span>
                                <span className={cn("font-black", margin > 30 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                                  ٪{formatPersianDigits(margin)} سود
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">ظرفیت از کل فله:</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-black text-xs">
                                  تا {formatPersianDigits(maxServings)} سرو
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Foot Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      className="flex-1 py-3.5 text-sm text-white font-black bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20"
                    >
                      ثبت فاکتور خرید فله و ثبت در انبار
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowPurchaseModal(false)} 
                      className="flex-1 py-3.5 text-sm font-black"
                    >
                      انصراف
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: META EDIT PRODUCT DETAILS --- */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="ویرایش اطلاعات کاتالوگ کالا">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input 
            label="نام کالا" 
            value={editForm.name} 
            onChange={e => setEditForm({...editForm, name: e.target.value})} 
            required 
          />
          
          <div>
            <label className="text-xs font-black text-gray-600 dark:text-slate-450 block mr-1 mb-2">دسته‌بندی</label>
            <select 
              className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-900 border-2 border-transparent dark:border-slate-800 rounded-xl focus:border-indigo-650 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all duration-200 text-xs font-black dark:text-white"
              value={editForm.category}
              onChange={e => setEditForm({...editForm, category: e.target.value})}
            >
              <optgroup label="بوفه و تنقلات" className="dark:bg-slate-850">
                <option value="نوشیدنی">نوشیدنی</option>
                <option value="تنقلات">تنقلات</option>
                <option value="غذا">غذا / ساندویچ</option>
              </optgroup>
              <optgroup label="فروشگاه قطعات و خدمات" className="dark:bg-slate-850">
                <option value="لوازم جانبی">لوازم جانبی (موبایل/کامپیوتر)</option>
                <option value="سخت‌افزار">قطعات سخت‌افزاری</option>
                <option value="لوازم تحریر">لوازم تحریر</option>
                <option value="سایر">سایر موارد</option>
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="قیمت فروش واحد (تومان)" 
              type="number" 
              value={editForm.price} 
              onChange={e => setEditForm({...editForm, price: e.target.value})} 
              required 
            />
            <Input 
              label="حداقل موجودی آلارم" 
              type="number" 
              value={editForm.minStock} 
              onChange={e => setEditForm({...editForm, minStock: e.target.value})} 
              required 
            />
          </div>

          <div className="flex gap-3 pt-6">
            <Button type="submit" className="flex-1 py-3 text-sm">بروزرسانی مشخصات</Button>
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-sm">انصراف</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(editingPrintService)}
        onClose={() => !savingPrintService && setEditingPrintService(null)}
        title="ویرایش خدمت پرینت"
      >
        <form onSubmit={handlePrintServiceSubmit} className="space-y-4">
          <Input
            label="نام خدمت"
            value={printServiceForm.name}
            onChange={event => setPrintServiceForm(current => ({ ...current, name: event.target.value }))}
            required
          />
          <Input
            label="قیمت هر برگ (تومان)"
            type="number"
            min="0"
            step="1"
            value={printServiceForm.price}
            onChange={event => setPrintServiceForm(current => ({ ...current, price: event.target.value }))}
            required
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={savingPrintService} className="flex-1 py-3 text-sm">
              {savingPrintService ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </Button>
            <Button type="button" variant="outline" disabled={savingPrintService} onClick={() => setEditingPrintService(null)} className="flex-1 py-3 text-sm">
              انصراف
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 4: DELETE PRODUCT CONFIRMATION --- */}
      <AnimatePresence>
        {isDeletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDeletingId(null)} className="absolute inset-0 bg-black/45 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 md:p-8 shadow-2xl text-center z-50 transition-colors"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/25 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Trash2 size={28} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">تایید حذف کالا از سیستم</h3>
              <p className="text-gray-500 dark:text-slate-400 font-bold text-xs mb-8 leading-relaxed">آیا مطمئن هستید که این کالا را می‌خواهید حذف کنید؟ تمامی رکوردهای موجودی همراه آن از بین خواهند رفت.</p>
              <div className="flex gap-4">
                <Button onClick={confirmDelete} className="flex-1 bg-rose-550 hover:bg-rose-600 h-11 rounded-xl text-white font-black text-xs">بله، حذف شود</Button>
                <Button onClick={() => setIsDeletingId(null)} variant="outline" className="flex-1 h-11 rounded-xl font-black text-xs">انصراف</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
