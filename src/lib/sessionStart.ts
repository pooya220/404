export const localDateTimeInput = (date = new Date()): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export type SessionStartResolution =
  | { valid: true; startTime: string; isLateStart: boolean; recordedAt: string }
  | { valid: false; error: string };

export const resolveSessionStart = (
  usePastStart: boolean,
  localDateTime: string,
  now = new Date(),
): SessionStartResolution => {
  const recordedAt = now.toISOString();
  if (!usePastStart) return { valid: true, startTime: recordedAt, isLateStart: false, recordedAt };

  const parsed = new Date(localDateTime);
  const startMs = parsed.getTime();
  const nowMs = now.getTime();
  if (!localDateTime || !Number.isFinite(startMs)) {
    return { valid: false, error: 'زمان شروع واردشده معتبر نیست.' };
  }
  if (startMs > nowMs) {
    return { valid: false, error: 'زمان شروع نمی‌تواند در آینده باشد.' };
  }
  if (nowMs - startMs > 24 * 60 * 60 * 1000) {
    return { valid: false, error: 'برای جلوگیری از ثبت اشتباه، زمان شروع حداکثر می‌تواند ۲۴ ساعت قبل باشد.' };
  }
  return { valid: true, startTime: parsed.toISOString(), isLateStart: true, recordedAt };
};
