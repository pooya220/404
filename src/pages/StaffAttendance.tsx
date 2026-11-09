import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays, Clock3, UserCheck, Users, LogIn, LogOut, CircleDashed,
  Plus, Pencil, UserX, Trash2, ChevronLeft, ChevronRight, BriefcaseBusiness, Phone, X
} from 'lucide-react';
import { Card } from '../components/ui/common';
import { useCollection, useFirestore } from '../hooks/useFirestore';
import {
  formatJalali, getCurrentJalaliDate, getJalaliMonthName,
  getJalaliMonthRange, localDateInput
} from '../lib/dateUtils';
import { formatPersianDigits, formatPersianNumber } from '../lib/utils';

type StaffDraft = { id?: string; fullName: string; position: string; phone: string; hireDate: string };

const emptyDraft = (): StaffDraft => ({ fullName: '', position: '', phone: '', hireDate: localDateInput() });

const operationalDate = (date: Date, resetHour: number, resetMinute: number) =>
  localDateInput(new Date(date.getTime() - (resetHour * 60 + resetMinute) * 60_000));

const safeTime = (value: unknown) => {
  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const showTime = (value?: string | null) => value
  ? formatPersianDigits(new Date(value).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))
  : '—';

const showDate = (value: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : formatPersianDigits(formatJalali(date, 'yyyy/MM/dd'));
};

const formatDuration = (minutes: number) => {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${formatPersianNumber(hours)} ساعت و ${formatPersianNumber(remainder)} دقیقه`;
};

export default function StaffAttendance({ currentUser }: { currentUser?: any }) {
  const { data: staffMembers = [], loading: loadingStaff, error: staffError } = useCollection<any>('staff_members');
  const { data: attendance = [], loading: loadingAttendance, error: attendanceError } = useCollection<any>('staff_attendance');
  const { data: settings = [] } = useCollection<any>('settings');
  const { add, update, remove } = useFirestore();
  const [now, setNow] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const current = getCurrentJalaliDate();
    return { year: current.year, month: current.month };
  });
  const [draft, setDraft] = useState<StaffDraft | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean } | null>(null);

  const dayResetHour = Number(settings[0]?.dayResetHour || 0);
  const dayResetMinute = Number(settings[0]?.dayResetMinute || 0);
  const todayWorkDate = operationalDate(now, dayResetHour, dayResetMinute);
  const effectiveSelectedDate = selectedDate || todayWorkDate;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentUserName = currentUser?.fullName || currentUser?.username || 'مدیر سیستم';
  const currentUserId = currentUser?.id || '';

  const activeStaff = useMemo(() => staffMembers.filter((person: any) => person.isActive !== false), [staffMembers]);
  const visibleAttendance = useMemo(() => {
    const staffIds = new Set(staffMembers.map((person: any) => String(person.id)));
    return attendance.filter((row: any) => staffIds.has(String(row.staffId)));
  }, [attendance, staffMembers]);
  const openAttendance = useMemo(() => visibleAttendance
    .filter((row: any) => !row.checkOutAt && safeTime(row.checkInAt) !== null)
    .sort((a: any, b: any) => (safeTime(b.checkInAt) || 0) - (safeTime(a.checkInAt) || 0)), [visibleAttendance]);
  const openByStaff = useMemo(() => {
    const map = new Map<string, any>();
    openAttendance.forEach((row: any) => { if (!map.has(row.staffId)) map.set(row.staffId, row); });
    return map;
  }, [openAttendance]);

  const dayRows = useMemo(() => {
    const staffWithOpenShift = new Set(openAttendance.map((row: any) => row.staffId));
    const visibleStaff = staffMembers.filter((person: any) => person.isActive !== false || staffWithOpenShift.has(person.id));
    return visibleStaff.map((person: any) => {
      const shifts = visibleAttendance
        .filter((row: any) => row.staffId === person.id && (row.workDate === effectiveSelectedDate || !row.checkOutAt))
        .sort((a: any, b: any) => (safeTime(b.checkInAt) || 0) - (safeTime(a.checkInAt) || 0));
      return { person, shift: shifts.find((row: any) => !row.checkOutAt) || shifts[0] || null };
    });
  }, [staffMembers, visibleAttendance, effectiveSelectedDate, openAttendance]);

  const monthRange = useMemo(() => getJalaliMonthRange(
    selectedMonth.year, selectedMonth.month, dayResetHour, dayResetMinute
  ), [selectedMonth, dayResetHour, dayResetMinute]);

  const monthlyReport = useMemo(() => {
    const from = monthRange.start.getTime();
    const to = monthRange.end.getTime();
    const validRows = visibleAttendance.filter((row: any) => {
      const started = safeTime(row.checkInAt);
      if (started === null) return false;
      const finished = safeTime(row.checkOutAt) ?? now.getTime();
      return started <= to && finished >= from;
    });
    return staffMembers.map((person: any) => {
      const shifts = validRows.filter((row: any) => row.staffId === person.id);
      let totalMinutes = 0;
      const workDays = new Set<string>();
      shifts.forEach((row: any) => {
        const started = safeTime(row.checkInAt);
        if (started === null) return;
        const finished = safeTime(row.checkOutAt) ?? now.getTime();
        const clippedStart = Math.max(started, from);
        const clippedEnd = Math.min(finished, to, now.getTime());
        if (clippedEnd > clippedStart) totalMinutes += (clippedEnd - clippedStart) / 60_000;
        const workDate = row.workDate || operationalDate(new Date(started), dayResetHour, dayResetMinute);
        workDays.add(workDate);
      });
      return { person, shifts: shifts.length, days: workDays.size, totalMinutes };
    }).sort((a: any, b: any) => b.totalMinutes - a.totalMinutes);
  }, [visibleAttendance, staffMembers, monthRange, now, dayResetHour, dayResetMinute]);

  const monthlyMinutes = monthlyReport.reduce((sum: number, row: any) => sum + row.totalMinutes, 0);
  const monthlyShiftCount = monthlyReport.reduce((sum: number, row: any) => sum + row.shifts, 0);

  const moveMonth = (amount: number) => setSelectedMonth(current => {
    let month = current.month + amount;
    let year = current.year;
    if (month < 0) { month = 11; year -= 1; }
    if (month > 11) { month = 0; year += 1; }
    return { year, month };
  });

  const saveStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft?.fullName.trim()) {
      setFeedback({ message: 'نام و نام خانوادگی پرسنل را وارد کنید.', error: true });
      return;
    }
    setSavingStaff(true);
    try {
      const values = {
        fullName: draft.fullName.trim(),
        position: draft.position.trim(),
        phone: draft.phone.trim(),
        hireDate: draft.hireDate || localDateInput(),
        isActive: draft.id ? staffMembers.find((person: any) => person.id === draft.id)?.isActive !== false : true,
        updatedAt: new Date().toISOString(),
        updatedById: currentUserId,
        updatedByName: currentUserName,
      };
      if (draft.id) await update('staff_members', draft.id, values);
      else await add('staff_members', { ...values, createdAt: new Date().toISOString(), createdById: currentUserId, createdByName: currentUserName });
      setDraft(null);
      setFeedback({ message: draft.id ? 'اطلاعات پرسنل ویرایش شد.' : 'پرسنل جدید اضافه شد.' });
    } catch (error: any) {
      setFeedback({ message: error?.message || 'ذخیره اطلاعات پرسنل انجام نشد.', error: true });
    } finally {
      setSavingStaff(false);
    }
  };

  const toggleStaff = async (person: any) => {
    const nextActive = person.isActive === false;
    if (!nextActive && openByStaff.has(person.id) && !window.confirm('این پرسنل شیفت باز دارد. غیرفعال شود؟ امکان ثبت خروج همچنان باقی می‌ماند.')) return;
    setBusyStaffId(person.id);
    try {
      await update('staff_members', person.id, {
        isActive: nextActive,
        updatedAt: new Date().toISOString(),
        updatedById: currentUserId,
        updatedByName: currentUserName,
      });
      setFeedback({ message: nextActive ? 'پرسنل دوباره فعال شد.' : 'پرسنل غیرفعال شد؛ سوابق حضور او محفوظ است.' });
    } catch (error: any) {
      setFeedback({ message: error?.message || 'تغییر وضعیت پرسنل انجام نشد.', error: true });
    } finally {
      setBusyStaffId('');
    }
  };

  const deleteStaff = async (person: any) => {
    if (attendance.some((row: any) => row.staffId === person.id && !row.checkOutAt)) {
      setFeedback({ message: 'ابتدا خروج این پرسنل را ثبت کنید؛ حذف پرسنل با شیفت باز امکان‌پذیر نیست.', error: true });
      return;
    }
    if (!window.confirm(`پرسنل «${person.fullName}» حذف شود؟ سوابق حضور و غیاب قبلی او حفظ می‌شود.`)) return;
    setBusyStaffId(person.id);
    try {
      await remove('staff_members', person.id);
      if (draft?.id === person.id) setDraft(null);
      setFeedback({ message: `پرسنل ${person.fullName} حذف شد؛ سوابق حضور و غیاب حفظ شدند.` });
    } catch (error: any) {
      setFeedback({ message: error?.message || 'حذف پرسنل انجام نشد.', error: true });
    } finally {
      setBusyStaffId('');
    }
  };

  const registerCheckIn = async (person: any) => {
    if (openByStaff.has(person.id)) {
      setFeedback({ message: 'برای این پرسنل یک شیفت باز ثبت شده است؛ ابتدا خروج همان شیفت را ثبت کنید.', error: true });
      return;
    }
    const checkedAt = new Date();
    setBusyStaffId(person.id);
    try {
      await add('staff_attendance', {
        staffId: person.id,
        staffName: person.fullName,
        staffPosition: person.position || '',
        workDate: operationalDate(checkedAt, dayResetHour, dayResetMinute),
        checkInAt: checkedAt.toISOString(),
        checkOutAt: null,
        createdAt: checkedAt.toISOString(),
        createdById: currentUserId,
        createdByName: currentUserName,
      });
      setFeedback({ message: `ورود ${person.fullName} ثبت شد.` });
      setNow(new Date());
    } catch (error: any) {
      setFeedback({ message: error?.message || 'ثبت ورود به پایگاه داده انجام نشد.', error: true });
    } finally {
      setBusyStaffId('');
    }
  };

  const registerCheckOut = async (person: any) => {
    const openShift = openByStaff.get(person.id);
    if (!openShift) {
      setFeedback({ message: 'برای این پرسنل شیفت بازی پیدا نشد.', error: true });
      return;
    }
    const checkedAt = new Date();
    if ((safeTime(openShift.checkInAt) || 0) > checkedAt.getTime()) {
      setFeedback({ message: 'زمان خروج نمی‌تواند قبل از زمان ورود باشد.', error: true });
      return;
    }
    setBusyStaffId(person.id);
    try {
      await update('staff_attendance', openShift.id, {
        checkOutAt: checkedAt.toISOString(),
        updatedAt: checkedAt.toISOString(),
        updatedById: currentUserId,
        updatedByName: currentUserName,
      });
      setFeedback({ message: `خروج ${person.fullName} ثبت شد.` });
      setNow(new Date());
    } catch (error: any) {
      setFeedback({ message: error?.message || 'ثبت خروج به پایگاه داده انجام نشد.', error: true });
    } finally {
      setBusyStaffId('');
    }
  };

  const isLoading = loadingStaff || loadingAttendance;
  const loadError = staffError || attendanceError;

  return (
    <main className="p-4 md:p-7 lg:p-9 space-y-6 font-sans text-right pb-28" dir="rtl">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 flex items-center justify-center"><CalendarDays size={23} /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">حضور و غیاب پرسنل</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ثبت شیفت، مدیریت کارکنان و گزارش ساعت کاری دوره</p>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          امروز کاری: <span className="text-indigo-600 dark:text-indigo-400">{showDate(todayWorkDate)}</span>
        </div>
      </header>

      {feedback && <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-bold ${feedback.error ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`} role="status">
        <span>{feedback.message}</span><button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100" aria-label="بستن"><X size={16} /></button>
      </div>}
      {loadError && <div className="rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 px-4 py-3 text-sm font-bold">خطا در دریافت اطلاعات: {loadError}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'پرسنل فعال', value: formatPersianNumber(activeStaff.length), icon: Users, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
          { label: 'شیفت‌های باز', value: formatPersianNumber(openAttendance.length), icon: CircleDashed, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'شیفت در این ماه', value: formatPersianNumber(monthlyShiftCount), icon: UserCheck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
          { label: 'ساعت کار ثبت‌شده در ماه', value: formatDuration(monthlyMinutes), icon: Clock3, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
        ].map(item => <Card key={item.label} className="p-5 border-none shadow-sm bg-white dark:bg-slate-900 rounded-2xl">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</p><p className="text-xl font-black text-slate-900 dark:text-white mt-2">{item.value}</p></div><div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${item.color}`}><item.icon size={20} /></div></div>
        </Card>)}
      </section>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)] gap-5 items-start">
        <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
            <div><h2 className="font-black text-slate-900 dark:text-white">ثبت شیفت روزانه</h2><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">ورود یا خروج را برای پرسنل ثبت کن؛ شیفت باز با ساعت جاری محاسبه می‌شود.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                روز کاری
                <input type="date" value={effectiveSelectedDate} onChange={event => setSelectedDate(event.target.value)} className="bg-transparent text-slate-800 dark:text-white outline-none" />
              </label>
              {effectiveSelectedDate !== todayWorkDate && <button type="button" onClick={() => setSelectedDate(todayWorkDate)} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 text-xs font-bold">امروز</button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] text-slate-500 dark:text-slate-400"><tr>
                <th className="px-5 py-3 font-black">نام پرسنل</th><th className="px-5 py-3 font-black">سمت</th><th className="px-5 py-3 font-black">ورود آخر</th><th className="px-5 py-3 font-black">خروج</th><th className="px-5 py-3 font-black">وضعیت</th><th className="px-5 py-3 font-black">عملیات</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dayRows.map(({ person, shift }: any) => {
                  const openShift = openByStaff.get(person.id);
                  const checkedIn = Boolean(openShift);
                  const canCheckIn = effectiveSelectedDate === todayWorkDate && person.isActive !== false && !checkedIn;
                  const displayShift = openShift || shift;
                  return <tr key={person.id} className="text-xs text-slate-700 dark:text-slate-200">
                    <td className="px-5 py-4 font-bold">{person.fullName}{displayShift?.workDate && displayShift.workDate !== effectiveSelectedDate && <span className="block text-[10px] font-medium text-amber-600 mt-1">شیفت از {showDate(displayShift.workDate)}</span>}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{person.position || '—'}</td>
                    <td className="px-5 py-4 font-mono">{showTime(displayShift?.checkInAt)}</td>
                    <td className="px-5 py-4 font-mono">{showTime(openShift ? null : displayShift?.checkOutAt)}</td>
                    <td className="px-5 py-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${checkedIn ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : displayShift ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>{checkedIn ? 'در حال کار' : displayShift ? 'خروج ثبت شده' : person.isActive === false ? 'غیرفعال' : 'بدون ثبت'}</span></td>
                    <td className="px-5 py-3"><div className="flex gap-2">
                      {checkedIn
                        ? <button type="button" disabled={busyStaffId === person.id} onClick={() => registerCheckOut(person)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[10px] font-black"><LogOut size={13} /> ثبت خروج</button>
                        : <button type="button" disabled={!canCheckIn || busyStaffId === person.id} onClick={() => registerCheckIn(person)} title={!canCheckIn ? (person.isActive === false ? 'پرسنل غیرفعال است' : 'برای ثبت ورود، روز جاری را انتخاب کن') : ''} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-black"><LogIn size={13} /> ثبت ورود</button>}
                    </div></td>
                  </tr>;
                })}
                {!isLoading && dayRows.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm font-bold text-slate-400">هنوز پرسنلی ثبت نشده است؛ از کادر مدیریت پرسنل، اولین نفر را اضافه کن.</td></tr>}
                {isLoading && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">در حال دریافت اطلاعات…</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">روز کاری بر اساس ساعت انتقال به روز بعد در تنظیمات محاسبه می‌شود. خروج شیفت باز حتی از روزهای قبل قابل ثبت است.</div>
        </Card>

        <Card className="p-5 md:p-6 border-none shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div><h2 className="font-black text-slate-900 dark:text-white">مدیریت پرسنل</h2><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">فهرست کارکنان مستقل از حساب کاربری سیستم</p></div>
            {!draft && <button type="button" onClick={() => setDraft(emptyDraft())} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black"><Plus size={15} /> افزودن</button>}
          </div>

          {draft && <form onSubmit={saveStaff} className="mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-800 dark:text-white">{draft.id ? 'ویرایش پرسنل' : 'پرسنل جدید'}</h3><button type="button" onClick={() => setDraft(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="لغو"><X size={16} /></button></div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">نام و نام خانوادگی<input autoFocus value={draft.fullName} onChange={event => setDraft({ ...draft, fullName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500" placeholder="مثلاً علی رضایی" /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">سمت<input value={draft.position} onChange={event => setDraft({ ...draft, position: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500" placeholder="مثلاً صندوق‌دار" /></label><label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">تلفن<input dir="ltr" value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500" placeholder="09…" /></label></div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">تاریخ شروع همکاری<input type="date" value={draft.hireDate} onChange={event => setDraft({ ...draft, hireDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none" /></label>
            <button type="submit" disabled={savingStaff} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 text-xs font-black">{savingStaff ? 'در حال ذخیره…' : draft.id ? 'ذخیره تغییرات' : 'ثبت پرسنل'}</button>
          </form>}

          <div className="space-y-2 max-h-[440px] overflow-y-auto">
            {staffMembers.map((person: any) => <div key={person.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${person.isActive === false ? 'border-slate-100 bg-slate-50/60 opacity-70 dark:border-slate-800 dark:bg-slate-950/30' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 flex items-center justify-center font-black">{String(person.fullName || '?').trim().charAt(0)}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-800 dark:text-white">{person.fullName}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1"><BriefcaseBusiness size={11} />{person.position || 'بدون سمت'}</span>{person.phone && <span dir="ltr" className="inline-flex items-center gap-1"><Phone size={10} />{formatPersianDigits(person.phone)}</span>}</div></div>
              <div className="flex shrink-0 gap-1"><button type="button" onClick={() => setDraft({ id: person.id, fullName: person.fullName || '', position: person.position || '', phone: person.phone || '', hireDate: person.hireDate || localDateInput() })} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40" title="ویرایش"><Pencil size={14} /></button><button type="button" disabled={busyStaffId === person.id} onClick={() => toggleStaff(person)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50" title={person.isActive === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'} aria-label={person.isActive === false ? 'فعال‌سازی پرسنل' : 'غیرفعال‌سازی پرسنل'}><UserX size={14} /></button><button type="button" disabled={busyStaffId === person.id} onClick={() => deleteStaff(person)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50" title="حذف پرسنل" aria-label={`حذف ${person.fullName}`}><Trash2 size={14} /></button></div>
            </div>)}
            {!isLoading && staffMembers.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-7 text-center"><Users size={24} className="mx-auto text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">فهرست پرسنل خالی است</p><p className="mt-1 text-[10px] text-slate-400">برای شروع، اولین کارمند را اضافه کن.</p></div>}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900 rounded-3xl">
        <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
          <div><h2 className="font-black text-slate-900 dark:text-white">گزارش ساعت کاری دوره</h2><p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">جمع ساعت از روی فاصلهٔ واقعی ورود تا خروج هر شیفت محاسبه می‌شود.</p></div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 p-1.5">
            <button type="button" onClick={() => moveMonth(-1)} className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500" aria-label="ماه قبل"><ChevronRight size={17} /></button>
            <span className="min-w-32 text-center text-xs font-black text-slate-800 dark:text-white">{getJalaliMonthName(selectedMonth.month)} {formatPersianNumber(selectedMonth.year)}</span>
            <button type="button" onClick={() => moveMonth(1)} disabled={selectedMonth.year === getCurrentJalaliDate().year && selectedMonth.month >= getCurrentJalaliDate().month} className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30" aria-label="ماه بعد"><ChevronLeft size={17} /></button>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-right">
          <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] text-slate-500 dark:text-slate-400"><tr><th className="px-5 py-3 font-black">پرسنل</th><th className="px-5 py-3 font-black">روزهای کاری</th><th className="px-5 py-3 font-black">تعداد شیفت</th><th className="px-5 py-3 font-black">مجموع ساعت کاری</th><th className="px-5 py-3 font-black">میانگین هر شیفت</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {monthlyReport.map((row: any) => <tr key={row.person.id} className="text-xs text-slate-700 dark:text-slate-200"><td className="px-5 py-4 font-bold">{row.person.fullName}<span className="block mt-1 text-[10px] font-medium text-slate-400">{row.person.position || (row.person.isActive === false ? 'غیرفعال' : 'بدون سمت')}</span></td><td className="px-5 py-4">{formatPersianNumber(row.days)} روز</td><td className="px-5 py-4">{formatPersianNumber(row.shifts)}</td><td className="px-5 py-4 font-black text-indigo-600 dark:text-indigo-400">{formatDuration(row.totalMinutes)}</td><td className="px-5 py-4">{row.shifts ? formatDuration(row.totalMinutes / row.shifts) : '—'}</td></tr>)}
            {!isLoading && monthlyReport.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm font-bold text-slate-400">برای این دوره پرسنلی ثبت نشده است.</td></tr>}
          </tbody>
        </table></div>
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">شیفت‌های باز تا همین لحظه در جمع ساعت منظور شده‌اند. غیرفعال‌کردن پرسنل سوابق ماه‌های قبل را حذف نمی‌کند.</div>
      </Card>
    </main>
  );
}
