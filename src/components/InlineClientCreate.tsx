import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { AppUser } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { Button, Input } from './ui/common';

interface InlineClientCreateProps {
  onCreated: (client: AppUser) => void;
  onCancel: () => void;
  className?: string;
}

/** Small customer form used beside customer selectors throughout the app. */
export function InlineClientCreate({ onCreated, onCancel, className = '' }: InlineClientCreateProps) {
  const { add } = useFirestore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || saving) return;

    setSaving(true);
    try {
      const created = await add('clients', {
        name: cleanName,
        phone: phone.trim(),
        tier: 'bronze',
        balance: 0,
        points: 0,
        totalPlayTime: 0,
        totalPaid: 0,
        isGuest: false,
        createdAt: new Date().toISOString()
      });

      if (!created?.id) throw new Error('شناسه مشتری جدید دریافت نشد.');
      onCreated(created as AppUser);
    } catch (error: any) {
      console.error('Could not create customer:', error);
      alert(error?.message || 'ثبت مشتری جدید انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} dir="rtl" className={`p-3 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-200">
          <UserPlus size={16} />
          <span className="text-xs font-black">ثبت مشتری جدید</span>
        </div>
        <button type="button" onClick={onCancel} className="p-1 rounded-lg text-slate-400 hover:bg-white/70 hover:text-rose-500 dark:hover:bg-slate-900 transition-colors" aria-label="بستن فرم">
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Input
          label="نام و نام خانوادگی *"
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="مثلاً علی محمدی"
          autoFocus
          required
          className="h-10 py-2 text-xs bg-white dark:bg-slate-900"
        />
        <Input
          label="شماره موبایل"
          value={phone}
          onChange={event => setPhone(event.target.value)}
          placeholder="اختیاری"
          type="tel"
          className="h-10 py-2 text-xs bg-white dark:bg-slate-900"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-9 px-3 text-[11px]">انصراف</Button>
        <Button type="submit" size="sm" disabled={saving || !name.trim()} className="h-9 px-3 text-[11px]">
          {saving ? 'در حال ثبت...' : 'ثبت و انتخاب مشتری'}
        </Button>
      </div>
    </form>
  );
}
