export function parseFlexibleDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  let cleaned = String(dateInput).trim();
  // Strip ordinal suffixes like 1st, 2nd, 3rd, 15th
  cleaned = cleaned.replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
  // Remove leading words like "on ", "by "
  cleaned = cleaned.replace(/^(?:on|by|before|until)\s+/i, '').trim();

  // Handle DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY first (common on European/international scholarship portals)
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1], 10);
    const second = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    // If first > 12 it is definitely DD/MM/YYYY; default to DD/MM/YYYY unless second > 12
    const day = second > 12 ? second : first;
    const month = (second > 12 ? first : second) - 1;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Handle YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = cleaned.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2035) {
    return parsed;
  }

  return null;
}

export function formatIsoDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function getDaysUntilDeadline(deadline) {
  const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
  if (!d || isNaN(d.getTime())) return -999;
  const now = new Date();
  const diffTime = d.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isDeadlineExpired(deadline) {
  return getDaysUntilDeadline(deadline) < 0;
}

export function getDeadlineUrgency(deadline) {
  const days = getDaysUntilDeadline(deadline);
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'normal';
}
