import React, { useState } from 'react';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import { Card, Button, Input } from '../components/ui/common';
import { 
  Target, 
  Plus, 
  TrendingUp, 
  CheckCircle2, 
  Trash2, 
  Wallet,
  ArrowRight,
  Gamepad2,
  Hammer,
  Megaphone,
  Layers,
  Edit2
} from 'lucide-react';
import { 
  formatCurrency, 
  formatPersianNumber, 
  cn 
} from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  category: 'hardware' | 'renovation' | 'marketing' | 'other';
  description: string;
  createdAt: string;
}

const CATEGORY_ICONS = {
  hardware: <Gamepad2 size={20} />,
  renovation: <Hammer size={20} />,
  marketing: <Megaphone size={20} />,
  other: <Layers size={20} />
};

const CATEGORY_LABELS = {
  hardware: 'سخت‌افزار و کنسول',
  renovation: 'نوسازی و دکوراسیون',
  marketing: 'تبلیغات و رشد',
  other: 'سایر اهداف'
};

export default function Goals() {
  const { data: goals, loading } = useCollection<Goal>('goals');
  const { data: shareholders } = useCollection<any>('shareholders');
  const { add, update, remove } = useFirestore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    targetAmount: 0,
    category: 'hardware' as Goal['category'],
    description: ''
  });

  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositShareholderId, setDepositShareholderId] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddGoal = async () => {
    if (!newGoal.title || newGoal.targetAmount <= 0) return;
    
    if (editingGoalId) {
      await update('goals', editingGoalId, newGoal);
    } else {
      await add('goals', {
        ...newGoal,
        currentAmount: 0,
        createdAt: new Date().toISOString()
      });
    }
    
    setIsAdding(false);
    setEditingGoalId(null);
    setNewGoal({ title: '', targetAmount: 0, category: 'hardware', description: '' });
  };

  const handleEdit = (goal: Goal) => {
    setNewGoal({
      title: goal.title,
      targetAmount: goal.targetAmount,
      category: goal.category,
      description: goal.description || ''
    });
    setEditingGoalId(goal.id);
    setIsAdding(true);
  };

  const handleDeposit = async () => {
    if (!depositGoalId || !depositShareholderId || depositAmount <= 0) return;
    const goal = goals?.find(g => g.id === depositGoalId);
    const shareholder = shareholders?.find(s => s.id === depositShareholderId);

    if (goal && shareholder) {
      // 1. Update Goal Amount
      await update('goals', depositGoalId, {
        currentAmount: goal.currentAmount + depositAmount
      });

      // 2. Add as investment to shareholder
      await update('shareholders', depositShareholderId, {
        investments: [
          ...(shareholder.investments || []),
          {
            amount: depositAmount,
            date: new Date().toISOString(),
            note: `واریز به هدف: ${goal.title}`
          }
        ]
      });

      setDepositGoalId(null);
      setDepositShareholderId('');
      setDepositAmount(0);
    }
  };

  const handleDelete = async (id: string) => {
    await remove('goals', id);
    setDeletingId(null);
  };

  if (loading) return <div className="p-10 text-center font-bold">در حال بارگذاری...</div>;

  return (
    <div className="p-6 lg:p-10 space-y-8 font-sans text-right pb-32" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">هدف‌گذاری مالی</h2>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold">بودجه‌بندی و پس‌انداز جهت توسعه کلوپ</p>
        </div>
        
        <Button 
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 h-12 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          تعریف هدف جدید
        </Button>
      </div>

      {/* Adding Goal Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-8 border-2 border-indigo-100 bg-indigo-50/30 dark:bg-slate-900/50 dark:border-slate-800">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2 dark:text-white">
                <Target className="text-indigo-600" />
                {editingGoalId ? 'ویرایش هدف' : 'مشخصات هدف جدید'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">عنوان هدف (مثلاً خرید PS5 Pro)</label>
                  <Input 
                    placeholder="مثلاً: صندلی گیمینگ جدید"
                    value={newGoal.title}
                    onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">مبلغ هدف (تومان)</label>
                  <Input 
                    type="number"
                    placeholder="مبلغ مورد نیاز"
                    value={newGoal.targetAmount || ''}
                    onChange={e => setNewGoal({...newGoal, targetAmount: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">دسته‌بندی</label>
                  <select 
                    className="w-full h-11 bg-white border border-gray-200 rounded-xl px-4 text-sm font-bold"
                    value={newGoal.category}
                    onChange={e => setNewGoal({...newGoal, category: e.target.value as any})}
                  >
                    <option value="hardware">سخت‌افزار</option>
                    <option value="renovation">نوسازی</option>
                    <option value="marketing">تبلیغات</option>
                    <option value="other">سایر</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleAddGoal} className="flex-1 bg-indigo-600 text-white font-black h-11 rounded-xl">ذخیره هدف</Button>
                  <Button onClick={() => setIsAdding(false)} variant="outline" className="h-11 rounded-xl">انصراف</Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {(goals || []).map(goal => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const isCompleted = progress >= 100;

          return (
            <Card key={goal.id} className="p-6 group hover:shadow-xl transition-all border-none shadow-sm relative overflow-hidden">
              {isCompleted && (
                <div className="absolute top-4 left-4 text-emerald-500 animate-bounce">
                  <CheckCircle2 size={32} />
                </div>
              )}
              
              <div className="flex items-start gap-4 mb-6">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                  isCompleted ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white"
                )}>
                  {CATEGORY_ICONS[goal.category]}
                </div>
                <div>
                  <h4 className="text-lg font-black text-gray-900">{goal.title}</h4>
                  <p className="text-xs text-gray-400 font-bold">{CATEGORY_LABELS[goal.category]}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold mb-1">جمع‌آوری شده</p>
                    <p className="text-xl font-black text-indigo-600">{formatCurrency(goal.currentAmount)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-400 font-bold mb-1">هدف نهایی</p>
                    <p className="text-sm font-bold text-gray-700">{formatCurrency(goal.targetAmount)}</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isCompleted ? "bg-emerald-500" : "bg-indigo-600"
                      )}
                    />
                  </div>
                  <span className="absolute -top-7 left-0 text-xs font-black text-indigo-600">{formatPersianNumber(progress)}٪</span>
                </div>

              <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={() => setDepositGoalId(goal.id)}
                    className="flex-1 h-10 bg-gray-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Wallet size={16} />
                    واریز به هدف
                  </Button>
                  <Button 
                    onClick={() => handleEdit(goal)}
                    variant="outline" 
                    className="w-10 h-10 p-0 text-gray-400 hover:text-indigo-600"
                  >
                    <Edit2 size={18} />
                  </Button>
                  <Button 
                    onClick={() => setDeletingId(goal.id)}
                    variant="outline" 
                    className="w-10 h-10 p-0 text-rose-500 hover:bg-rose-50 border-rose-100"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm">
              <Card className="p-8 shadow-2xl overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-12 -mt-12 -z-10" />
                 <h3 className="text-xl font-black mb-4 text-gray-900">حذف هدف</h3>
                 <p className="text-sm font-bold text-gray-500 mb-8 leading-relaxed">آیا از حذف این هدف اطمینان دارید؟ این عملیات غیرقابل بازگشت است.</p>
                 <div className="grid grid-cols-2 gap-4">
                    <Button onClick={() => handleDelete(deletingId)} className="bg-rose-600 hover:bg-rose-700 text-white h-11 rounded-xl font-black">بله، حذف شود</Button>
                    <Button onClick={() => setDeletingId(null)} variant="outline" className="h-11 rounded-xl font-black">انصراف</Button>
                 </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deposit Modal */}
      <AnimatePresence>
        {depositGoalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md"
            >
              <Card className="p-8 shadow-2xl dark:bg-slate-800">
                <h3 className="text-xl font-black mb-6 text-indigo-900 dark:text-indigo-400">واریز مبلغ به هدف و ثبت در سرمایه</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-2">انتخاب شریک (واریزکننده)</label>
                    <select 
                      className="w-full h-12 px-4 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl text-sm font-black dark:text-white"
                      value={depositShareholderId}
                      onChange={e => setDepositShareholderId(e.target.value)}
                    >
                      <option value="">انتخاب شریک...</option>
                      {shareholders?.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-500 mb-2">مبلغ واریزی (تومان)</label>
                    <Input 
                      type="number"
                      autoFocus
                      placeholder="مبلغ را وارد کنید"
                      className="text-center text-xl font-black"
                      value={depositAmount || ''}
                      onChange={e => setDepositAmount(Number(e.target.value))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={handleDeposit}
                      className="bg-indigo-600 text-white font-black h-12 rounded-xl"
                    >
                      تایید واریز
                    </Button>
                    <Button 
                      onClick={() => setDepositGoalId(null)}
                      variant="outline"
                      className="h-12 rounded-xl"
                    >
                      بستن
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
