/**
 * Shop & Hotel Scheduled Closure Calculation Utility
 * Handles weekly closing days, special closing dates, manual closures, and business hours.
 */

export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';

export const VALID_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Safely format time string (e.g., "09:00" -> "09:00 AM", "21:30" -> "09:30 PM")
 */
export function formatTimeAMPM(timeStr) {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();
  if (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM')) {
    return trimmed;
  }
  const parts = trimmed.split(':');
  if (parts.length < 2) return trimmed;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return trimmed;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? '0' + hours : hours;
  return `${strHours}:${minutes} ${ampm}`;
}

/**
 * Returns YYYY-MM-DD date string, full weekday name, and HH:mm in the business timezone.
 */
export function getLocalTimeInfo(date = new Date(), timeZone = BUSINESS_TIMEZONE) {
  try {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date); // "YYYY-MM-DD"

    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
    }).format(date); // "Tuesday"

    const timeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date); // "HH:mm"

    return { dateStr, dayName, timeStr };
  } catch (err) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return {
      dateStr: `${y}-${m}-${d}`,
      dayName: VALID_WEEKDAYS[date.getDay()],
      timeStr: `${h}:${min}`,
    };
  }
}

/**
 * Given a "YYYY-MM-DD" date string, returns the day of the week (e.g. "Tuesday")
 * in the configured business timezone without UTC date shift.
 */
export function getWeekdayFromDateString(dateStr, timeZone = BUSINESS_TIMEZONE) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

  // Use noon UTC to avoid any DST or edge boundary shifts
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
    }).format(d);
  } catch {
    return VALID_WEEKDAYS[d.getUTCDay()];
  }
}

/**
 * Parse time string to minutes from midnight
 */
export function parseTimeToMinutes(tStr) {
  if (!tStr) return null;
  let time = String(tStr).trim();
  let isPM = false;
  let isAM = false;
  if (time.toUpperCase().includes('PM')) {
    isPM = true;
    time = time.replace(/PM/i, '').trim();
  }
  if (time.toUpperCase().includes('AM')) {
    isAM = true;
    time = time.replace(/AM/i, '').trim();
  }
  const parts = time.split(':');
  if (parts.length < 2) return null;
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Calculates complete closure status for a Shop/Hotel.
 *
 * Checks in order:
 * 1. Special closing date matching current date (overrides weekly reason if both coincide).
 * 2. Weekly closing days matching current weekday (if weeklyClosingEnabled is true).
 * 3. Manual toggle (isOpen === false).
 * 4. Operating hours window (openingTime / closingTime).
 *
 * @param {Object} shop Shop document or plain object
 * @param {Date} targetDate Date object to evaluate (defaults to now)
 * @param {string} timeZone Timezone identifier
 * @returns {Object} Closure status details
 */
export function getShopClosureStatus(shop, targetDate = new Date(), timeZone = BUSINESS_TIMEZONE) {
  if (!shop) {
    return {
      isOpen: false,
      isClosed: true,
      closureType: 'NOT_FOUND',
      reason: 'Shop not found',
      displayReason: 'Unavailable',
      notificationMessage: 'This shop is currently unavailable.',
    };
  }

  // If shop is deactivated or unapproved by admin
  if (shop.isActive === false || shop.isApproved === false) {
    return {
      isOpen: false,
      isClosed: true,
      closureType: 'INACTIVE',
      reason: 'Shop is currently unavailable',
      displayReason: 'Unavailable',
      notificationMessage: 'This shop is currently not active or available on NearCart.',
    };
  }

  const { dateStr, dayName, timeStr } = getLocalTimeInfo(targetDate, timeZone);

  // 1. Special closing date check (highest priority: overrides weekly message)
  if (Array.isArray(shop.specialClosingDates) && shop.specialClosingDates.length > 0) {
    const specialEntry = shop.specialClosingDates.find((entry) => {
      if (!entry) return false;
      const d = typeof entry === 'string' ? entry : entry.date;
      if (!d) return false;
      const cleanDate = String(d).trim().split('T')[0];
      return cleanDate === dateStr;
    });

    if (specialEntry) {
      const rawReason = (typeof specialEntry === 'object' && specialEntry.reason)
        ? specialEntry.reason.trim()
        : '';
      const reasonText = rawReason ? rawReason : 'Scheduled special closure';
      const displayReason = rawReason ? `Closed today: ${rawReason}` : 'Closed today';
      const notificationMessage = rawReason
        ? `Sorry! This shop is currently closed. Reason: ${rawReason}. Please visit again when the shop reopens.`
        : 'Sorry! This shop is currently closed for a scheduled holiday. Please visit again when the shop reopens.';

      return {
        isOpen: false,
        isClosed: true,
        closureType: 'SPECIAL_DATE',
        reason: reasonText,
        displayReason,
        notificationMessage,
        date: dateStr,
        dayName,
      };
    }
  }

  // 2. Weekly closing day check
  const weeklyEnabled = shop.weeklyClosingEnabled !== false;
  if (weeklyEnabled && Array.isArray(shop.weeklyClosingDays) && shop.weeklyClosingDays.length > 0) {
    const isWeeklyClosed = shop.weeklyClosingDays.some((day) => {
      if (!day || typeof day !== 'string') return false;
      const d = day.trim().toLowerCase();
      const currentFull = dayName.toLowerCase();
      const currentShort = currentFull.slice(0, 3);
      return d === currentFull || d === currentShort;
    });

    if (isWeeklyClosed) {
      return {
        isOpen: false,
        isClosed: true,
        closureType: 'WEEKLY_DAY',
        reason: `Closed every ${dayName}`,
        displayReason: `Closed every ${dayName}`,
        notificationMessage: `This shop is closed every ${dayName}. Please visit again on its next opening day.`,
        date: dateStr,
        dayName,
      };
    }
  }

  // 3. Manual closure check
  if (shop.isOpen === false) {
    return {
      isOpen: false,
      isClosed: true,
      closureType: 'MANUAL',
      reason: 'Shop is temporarily closed by owner',
      displayReason: 'Temporarily Closed',
      notificationMessage: 'Sorry! This shop is temporarily closed by the owner. Please visit again later.',
      date: dateStr,
      dayName,
    };
  }

  // 4. Operating hours check
  if (shop.openingTime && shop.closingTime) {
    const openMin = parseTimeToMinutes(shop.openingTime);
    const closeMin = parseTimeToMinutes(shop.closingTime);

    if (openMin !== null && closeMin !== null) {
      const currentMin = parseTimeToMinutes(timeStr);
      let withinHours = false;

      if (openMin < closeMin) {
        withinHours = currentMin >= openMin && currentMin < closeMin;
      } else if (openMin > closeMin) {
        // Crosses midnight
        withinHours = currentMin >= openMin || currentMin < closeMin;
      } else {
        withinHours = true;
      }

      if (!withinHours) {
        const openFormatted = formatTimeAMPM(shop.openingTime);
        const closeFormatted = formatTimeAMPM(shop.closingTime);
        return {
          isOpen: false,
          isClosed: true,
          closureType: 'HOURS',
          reason: `Closed • Opens at ${openFormatted}`,
          displayReason: `Closed • Opens at ${openFormatted}`,
          notificationMessage: `This shop is currently closed. Normal business hours: ${openFormatted} – ${closeFormatted}. Please visit again when the shop opens.`,
          date: dateStr,
          dayName,
        };
      }
    }
  }

  // Shop is currently OPEN
  return {
    isOpen: true,
    isClosed: false,
    closureType: null,
    reason: null,
    displayReason: null,
    notificationMessage: null,
    date: dateStr,
    dayName,
  };
}

/**
 * Validates weeklyClosingDays, weeklyClosingEnabled, and specialClosingDates payloads.
 */
export function validateClosingSchedule({ weeklyClosingDays, weeklyClosingEnabled, specialClosingDates }) {
  if (weeklyClosingDays !== undefined) {
    if (!Array.isArray(weeklyClosingDays)) {
      return { valid: false, message: 'weeklyClosingDays must be an array.' };
    }
    const invalidDays = weeklyClosingDays.filter((d) => !VALID_WEEKDAYS.includes(d));
    if (invalidDays.length > 0) {
      return { valid: false, message: `Invalid day(s): ${invalidDays.join(', ')}. Use full day names.` };
    }
  }

  if (weeklyClosingEnabled !== undefined && typeof weeklyClosingEnabled !== 'boolean') {
    return { valid: false, message: 'weeklyClosingEnabled must be a boolean.' };
  }

  if (specialClosingDates !== undefined) {
    if (!Array.isArray(specialClosingDates)) {
      return { valid: false, message: 'specialClosingDates must be an array.' };
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const seenDates = new Set();
    const cleanList = [];

    for (let i = 0; i < specialClosingDates.length; i++) {
      const entry = specialClosingDates[i];
      if (!entry || typeof entry !== 'object') {
        return { valid: false, message: `Invalid entry at index ${i}. Must be an object with date and reason.` };
      }
      const rawDate = typeof entry.date === 'string' ? entry.date.trim() : '';
      if (!rawDate || !dateRegex.test(rawDate)) {
        return { valid: false, message: `Invalid date format "${entry.date}". Use YYYY-MM-DD.` };
      }

      // Check calendar date validity (month 1-12, days in month)
      const parts = rawDate.split('-').map(Number);
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
      ) {
        return { valid: false, message: `Invalid calendar date "${rawDate}".` };
      }

      // Prevent duplicates
      if (seenDates.has(rawDate)) {
        return { valid: false, message: `Duplicate closing date "${rawDate}" is not allowed.` };
      }
      seenDates.add(rawDate);

      // Mandatory reason
      const rawReason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
      if (!rawReason) {
        return { valid: false, message: `A closure reason is mandatory for date ${rawDate}.` };
      }
      if (rawReason.length > 200) {
        return { valid: false, message: `Closure reason for date ${rawDate} cannot exceed 200 characters.` };
      }

      cleanList.push({
        date: rawDate,
        reason: rawReason,
      });
    }

    return { valid: true, cleanSpecialClosingDates: cleanList };
  }

  return { valid: true };
}

