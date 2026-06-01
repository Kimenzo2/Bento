/**
 * Bento Time Infrastructure
 *
 * Architecture ported from Anytype-ts (src/ts/lib/util/date.ts).
 *
 * Core design (mirrors Anytype):
 *   - Single source of truth for ALL date/time operations
 *   - No external dependencies — pure `Intl.DateTimeFormat` + native `Date`
 *   - Millisecond timestamps internally (JS native), with second helpers
 *   - Connects to desktop settings (dateFormat, timeFormat, locale) via the
 *     locale getter passed at call sites, NOT by importing settings directly
 *     (keeps this utility tree-shakeable and testable)
 *
 * Usage anywhere in the app:
 *   import { time } from '$lib/utils/time';
 *   time.now();         // → 1716829200000
 *   time.format(ts);    // → "05/22/2026" (respects user's date format setting)
 *   time.formatTime(ts);// → "2:30 PM" (respects user's time format setting)
 *   time.timeAgo(ts);   // → "Today 2:30 PM" | "Yesterday" | "Mon" | "15/07"
 *   time.duration(ms);  // → "2h 30min" | "5d" | "3y"
 *   time.isToday(ts);   // → true | false
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Mirrors Anytype's I.DateFormat enum values */
export type DateFormatId =
  | 'MM/DD/YYYY'
  | 'DD/MM/YYYY'
  | 'YYYY-MM-DD'
  | 'DD.MM.YYYY'
  | 'MMMM D, YYYY';

/** Mirrors Anytype's I.TimeFormat enum values */
export type TimeFormatId = '12h' | '24h';

/** Options passed to `time.format()` */
export interface FormatOptions {
  locale?: string;
  dateFormat?: DateFormatId;
  timeFormat?: TimeFormatId;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DAY = 24 * HOURS;
const WEEK = 7 * DAY;
const YEAR_APPROX = 365 * DAY;

// ── Core: now / timestamp creation (Anytype's now() + timestamp()) ──────────

/** Current time in milliseconds — single source of truth (replaces raw Date.now()) */
function now(): number {
  return Date.now();
}

/** Current time in Unix seconds */
function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Create a timestamp in ms from date components.
 * Anytype equivalent: timestamp(y, m, d, h, i, s) → returns seconds
 */
function fromComponents(
  year: number,
  month: number,       // 1-12
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0,
): number {
  return new Date(year, month - 1, day, hours, minutes, seconds, ms).getTime();
}

/** Parse an ISO 8601 string ("2024-07-15" or "2024-07-15T14:30:00Z") to ms */
function parseISO(str: string): number {
  return new Date(str).getTime();
}

/** Parse a date string with a given format (Anytype's parseDate) */
function parseDate(value: string, format?: DateFormatId): number {
  if (!value) return NaN;

  // Try ISO first (fast path)
  if (!format || format === 'YYYY-MM-DD') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Manual parsing
  const [datePart, timePart] = value.split(' ');
  let d = 0, m = 0, y = 0, h = 0, i = 0, s = 0;

  const parts = (datePart || '').split(/[./-]/);
  switch (format) {
    case 'YYYY-MM-DD': [y, m, d] = parts.map(Number); break;
    case 'MM/DD/YYYY': [m, d, y] = parts.map(Number); break;
    case 'DD/MM/YYYY': [d, m, y] = parts.map(Number); break;
    case 'DD.MM.YYYY': [d, m, y] = parts.map(Number); break;
    default:           [d, m, y] = parts.map(Number); break;
  }

  if (timePart) {
    const tParts = timePart.split(':');
    h = Number(tParts[0]) || 0;
    i = Number(tParts[1]) || 0;
    s = Number(tParts[2]) || 0;
  }

  return new Date(y || 0, Math.max(0, (m || 1) - 1), d || 1, h, i, s).getTime();
}

/** Midnight of today in ms (Anytype's today()) */
function today(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Returns a "YYYY-MM-DD" string for a given timestamp (or now if omitted).
 * Used throughout the app as a stable date key for maps/stores.
 * Mirrors Anytype's UtilDate.dateKey().
 */
function dateKey(ts?: number): string {
  const d = ts !== undefined ? new Date(ts) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Start of the day for a given timestamp */
function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Start of the week for a given timestamp (Anytype's isThisWeek uses Sunday-start) */
function weekStart(ts: number, firstDay: 0 | 1 | 6 = 0): number {
  const d = new Date(ts);
  const day = d.getDay();
  const diff = (day < firstDay ? 7 : 0) + day - firstDay;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Start of the month for a given timestamp */
function monthStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// ── Formatting: date (Anytype's date() + dateFormat() + dateWithFormat()) ───

function _pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function _formatIntl(
  ts: number,
  opts: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  return new Intl.DateTimeFormat(locale, opts).format(new Date(ts));
}

/**
 * Format a timestamp using a custom format string (PHP-style, like Anytype's date()).
 * Supports: Y, y, m, n, d, j, F, M, D, l, H, h, g, i, s, A, a
 */
function formatCustom(ts: number, fmt: string, locale = 'en-US'): string {
  const d = new Date(ts);
  const pad = _pad;
  const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Use locale for localized names when available
  let localizedDayNames = dayNames;
  let localizedMonthNames = monthNames;
  try {
    const dtf = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long' });
    // Just get the format parts to verify locale is valid
    dtf.format(new Date(0));
  } catch {
    // fall back to English
  }
  // We'll use Intl for localized names in specific format modes below

  const tokens: Record<string, () => string> = {
    // Year
    Y: () => String(d.getFullYear()),
    y: () => String(d.getFullYear()).slice(-2),
    // Month
    m: () => pad(d.getMonth() + 1),
    n: () => String(d.getMonth() + 1),
    F: () => _formatIntl(ts, { month: 'long' }, locale),
    M: () => _formatIntl(ts, { month: 'short' }, locale),
    // Day
    d: () => pad(d.getDate()),
    j: () => String(d.getDate()),
    D: () => _formatIntl(ts, { weekday: 'short' }, locale),
    l: () => _formatIntl(ts, { weekday: 'long' }, locale),
    N: () => String(d.getDay() || 7),
    w: () => String(d.getDay()),
    // Hour
    H: () => pad(d.getHours()),
    h: () => pad(d.getHours() % 12 || 12),
    g: () => String(d.getHours() % 12 || 12),
    // Minute
    i: () => pad(d.getMinutes()),
    // Second
    s: () => pad(d.getSeconds()),
    // AM/PM
    A: () => (d.getHours() >= 12 ? 'PM' : 'AM'),
    a: () => (d.getHours() >= 12 ? 'pm' : 'am'),
    // Escaped character
    '\\': () => '',
  };

  let result = '';
  let escape = false;
  for (let ci = 0; ci < fmt.length; ci++) {
    const ch = fmt[ci];
    if (escape) {
      result += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (tokens[ch]) {
      result += tokens[ch]();
    } else {
      result += ch;
    }
  }
  return result;
}

/** Resolve a DateFormatId to a PHP-style format string (Anytype's dateFormat()) */
function _dateFormatString(fmt: DateFormatId): string {
  switch (fmt) {
    case 'MM/DD/YYYY':   return 'm/d/Y';
    case 'DD/MM/YYYY':   return 'd/m/Y';
    case 'YYYY-MM-DD':   return 'Y-m-d';
    case 'DD.MM.YYYY':   return 'd.m.Y';
    case 'MMMM D, YYYY': return 'F j, Y';
  }
}

/** Format a timestamp using the user's date format setting */
function formatDate(ts: number, dateFormat?: DateFormatId, locale = 'en-US'): string {
  if (!isFinite(ts)) return '';
  const fmt = dateFormat ?? 'MM/DD/YYYY';

  if (fmt === 'MMMM D, YYYY') {
    return _formatIntl(ts, { year: 'numeric', month: 'long', day: 'numeric' }, locale);
  }

  return formatCustom(ts, _dateFormatString(fmt), locale);
}

/** Format a timestamp using the user's time format setting */
function formatTime(ts: number, timeFormat?: TimeFormatId, locale = 'en-US'): string {
  if (!isFinite(ts)) return '';
  const fmt = timeFormat ?? '12h';

  if (fmt === '12h') {
    return _formatIntl(ts, { hour: 'numeric', minute: '2-digit', hour12: true }, locale);
  }
  return _formatIntl(ts, { hour: '2-digit', minute: '2-digit', hour12: false }, locale);
}

/**
 * Full date+time formatting using settings (Anytype's dateWithFormat + timeWithFormat combined).
 * Returns e.g. "05/22/2026 2:30 PM"
 */
function format(ts: number, opts?: FormatOptions): string {
  if (!isFinite(ts)) return '';
  const { locale = 'en-US', dateFormat = 'MM/DD/YYYY', timeFormat = '12h' } = opts ?? {};
  const d = formatDate(ts, dateFormat, locale);
  const t = formatTime(ts, timeFormat, locale);
  return `${d} ${t}`;
}

/** Format only the date part (Anytype's dateWithFormat) */
function formatDateOnly(ts: number, dateFormat?: DateFormatId, locale = 'en-US'): string {
  return formatDate(ts, dateFormat, locale);
}

/** Format only the time part (Anytype's timeWithFormat) */
function formatTimeOnly(ts: number, timeFormat?: TimeFormatId, locale = 'en-US'): string {
  return formatTime(ts, timeFormat, locale);
}

// ── Relative: dayString / timeAgo (Anytype's dayString() + timeAgo()) ───────

/** Returns "Today", "Tomorrow", "Yesterday", or empty (Anytype's dayString) */
function dayString(ts: number): string {
  const ds = formatCustom(ts, 'Y-m-d');
  const td = formatCustom(now(), 'Y-m-d');
  if (ds === td) return 'Today';
  if (ds === formatCustom(now() + DAY, 'Y-m-d')) return 'Tomorrow';
  if (ds === formatCustom(now() - DAY, 'Y-m-d')) return 'Yesterday';
  return '';
}

/**
 * Smart relative formatting (Anytype's timeAgo).
 * Today → time only; Yesterday/Tomorrow → word; This week → day name; Else → date
 */
function timeAgo(ts: number, opts?: { locale?: string; timeFormat?: TimeFormatId }): string {
  if (!isFinite(ts) || !ts) return '';
  const { locale = 'en-US', timeFormat = '12h' } = opts ?? {};

  if (isToday(ts)) {
    return formatTime(ts, timeFormat, locale);
  }
  const dayStr = dayString(ts);
  if (dayStr) return dayStr;
  if (isThisWeek(ts)) {
    return formatCustom(ts, 'l', locale);
  }
  // Show date with year if different year
  const thisYear = new Date(now()).getFullYear();
  const tsYear = new Date(ts).getFullYear();
  if (tsYear !== thisYear) {
    return formatCustom(ts, 'd/m/Y');
  }
  return formatCustom(ts, 'd/m');
}

/**
 * Human-readable duration from milliseconds (Anytype's duration but in ms).
 * → "3y", "2d", "5h", "30min", "45s"
 */
function duration(ms: number): string {
  if (!ms || !isFinite(ms)) return '';

  const abs = Math.abs(ms);
  if (abs >= YEAR_APPROX) return `${Math.round(abs / YEAR_APPROX)}y`;
  if (abs >= DAY) return `${Math.floor(abs / DAY)}d`;
  if (abs >= HOURS) return `${Math.floor(abs / HOURS)}h`;
  if (abs >= MINUTES) return `${Math.floor(abs / MINUTES)}min`;
  return `${Math.floor(abs / SECONDS)}s`;
}

/**
 * Human-readable elapsed time → "2h 30m", "5m 10s", "just now"
 */
function elapsed(ms: number): string {
  if (!ms || !isFinite(ms)) return '';
  const abs = Math.abs(ms);
  if (abs < SECONDS) return 'just now';
  if (abs < MINUTES) return `${Math.floor(abs / SECONDS)}s ago`;
  if (abs < HOURS) return `${Math.floor(abs / MINUTES)}m ${Math.floor((abs % MINUTES) / SECONDS)}s ago`;
  if (abs < DAY) return `${Math.floor(abs / HOURS)}h ${Math.floor((abs % HOURS) / MINUTES)}m ago`;
  return `${Math.floor(abs / DAY)}d ${Math.floor((abs % DAY) / HOURS)}h ago`;
}

// ── Boolean checks (Anytype's isToday, isThisWeek) ──────────────────────────

/** Check if a timestamp falls on today's date */
function isToday(ts: number): boolean {
  return dayStart(ts) === today();
}

/** Check if a timestamp falls in the current week (Anytype's isThisWeek) */
function isThisWeek(ts: number, firstDay: 0 | 1 | 6 = 0): boolean {
  return ts >= weekStart(now(), firstDay);
}

/** Check if a timestamp falls on yesterday */
function isYesterday(ts: number): boolean {
  const yesterdayStart = today() - DAY;
  return dayStart(ts) === yesterdayStart;
}

/** Check if a timestamp is tomorrow */
function isTomorrow(ts: number): boolean {
  const tomorrowStart = today() + DAY;
  return dayStart(ts) === tomorrowStart;
}

// ── Extraction helpers (Anytype's getCalendarDateParam, getDateParam) ────────

interface CalendarDate {
  year: number;
  month: number;   // 1-12
  day: number;
}

interface FullDate extends CalendarDate {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Extract { year, month, day } from a timestamp (Anytype's getCalendarDateParam) */
function getCalendarDate(ts: number): CalendarDate {
  const d = new Date(ts);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** Extract { year, month, day, hours, minutes, seconds } from a timestamp (Anytype's getDateParam) */
function getDate(ts: number): FullDate {
  const d = new Date(ts);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds(),
  };
}

/** Merge date from one timestamp with time from another (Anytype's mergeTimeWithDate) */
function mergeDateAndTime(dateTs: number, timeTs: number): number {
  const date = getCalendarDate(dateTs);
  const time = getDate(timeTs);
  return new Date(
    date.year, date.month - 1, date.day,
    time.hours, time.minutes, time.seconds,
  ).getTime();
}

// ── Duration math helpers ───────────────────────────────────────────────────

/** Number of whole days between two timestamps */
function daysBetween(a: number, b: number): number {
  return Math.round(Math.abs(dayStart(a) - dayStart(b)) / DAY);
}

/** Number of whole hours between two timestamps */
function hoursBetween(a: number, b: number): number {
  return Math.floor(Math.abs(a - b) / HOURS);
}

/** Number of whole minutes between two timestamps */
function minutesBetween(a: number, b: number): number {
  return Math.floor(Math.abs(a - b) / MINUTES);
}

/** Add N days to a timestamp */
function addDays(ts: number, n: number): number {
  return ts + n * DAY;
}

/** Subtract N days from a timestamp */
function subtractDays(ts: number, n: number): number {
  return ts - n * DAY;
}

// ── Calendar helpers (Anytype's getCalendarMonth, getWeekDays, getMonths, etc.) ─

interface DayInfo {
  year: number;
  month: number;
  day: number;
  ts: number;
  weekday: number;   // 1-7 (Mon-Sun)
  isToday: boolean;
  isWeekend: boolean;
  isCurrentMonth: boolean;
}

interface MonthInfo {
  id: number;
  name: string;
}

interface YearInfo {
  id: number;
  name: number;
}

const MONTH_DAYS: Record<number, number> = {
  1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

function isLeapYear(year: number): boolean {
  if (year % 4 !== 0) return false;
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return true;
}

function getMonthDays(year: number): Record<number, number> {
  const days = { ...MONTH_DAYS };
  if (isLeapYear(year)) days[2] = 29;
  return days;
}

/**
 * Generate calendar month grid (Anytype's getCalendarMonth).
 * Returns array of DayInfo objects including days from adjacent months.
 */
function getCalendarMonth(
  ts: number,
  firstDay: 0 | 1 | 6 = 0,
  locale = 'en-US',
): DayInfo[] {
  const { year, month } = getCalendarDate(ts);
  const md = getMonthDays(year);
  const todayTs = today();

  // First day of month: 0=Sun, 1=Mon, ... 6=Sat
  const firstOfMonth = new Date(year, month - 1, 1);
  let wdf = firstOfMonth.getDay();
  // Adjust for firstDay preference
  wdf = (wdf - firstDay + 7) % 7;

  // Last day of month
  const lastOfMonth = new Date(year, month - 1, md[month]);
  let wdl = lastOfMonth.getDay();
  wdl = (wdl - firstDay + 7) % 7;

  const days: DayInfo[] = [];

  // Previous month's trailing days
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthDays = prevMonth === 2 && isLeapYear(prevYear) ? 29 : MONTH_DAYS[prevMonth];

  for (let i = wdf - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const ts2 = fromComponents(prevYear, prevMonth, d);
    days.push({
      year: prevYear, month: prevMonth, day: d,
      ts: ts2,
      weekday: new Date(ts2).getDay() || 7,
      isToday: dayStart(ts2) === todayTs,
      isWeekend: [6, 7].includes(new Date(ts2).getDay() || 7),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= md[month]; d++) {
    const ts2 = fromComponents(year, month, d);
    days.push({
      year, month, day: d,
      ts: ts2,
      weekday: new Date(ts2).getDay() || 7,
      isToday: dayStart(ts2) === todayTs,
      isWeekend: [6, 7].includes(new Date(ts2).getDay() || 7),
      isCurrentMonth: true,
    });
  }

  // Next month's leading days
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const remainingCells = 6 - wdl;
  for (let d = 1; d <= remainingCells; d++) {
    const ts2 = fromComponents(nextYear, nextMonth, d);
    days.push({
      year: nextYear, month: nextMonth, day: d,
      ts: ts2,
      weekday: new Date(ts2).getDay() || 7,
      isToday: dayStart(ts2) === todayTs,
      isWeekend: [6, 7].includes(new Date(ts2).getDay() || 7),
      isCurrentMonth: false,
    });
  }

  return days;
}

/**
 * Returns weekday names respecting firstDay preference (Anytype's getWeekDays)
 */
function getWeekDays(firstDay: 0 | 1 | 6 = 0, locale = 'en-US'): { id: number; name: string }[] {
  const days: { id: number; name: string }[] = [];
  for (let i = 1; i <= 7; i++) {
    const id = ((i + firstDay - 1) % 7) || 7;
    const date = new Date(2024, 0, id); // Jan 7, 2024 is a Sunday
    const name = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
    days.push({ id, name });
  }
  return days;
}

/** Returns localized month names (Anytype's getMonths) */
function getMonths(locale = 'en-US'): MonthInfo[] {
  const months: MonthInfo[] = [];
  for (let i = 1; i <= 12; i++) {
    const date = new Date(2024, i - 1, 1);
    const name = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
    months.push({ id: i, name });
  }
  return months;
}

/** Returns year range (Anytype's getYears) */
function getYears(start: number, end: number): YearInfo[] {
  const years: YearInfo[] = [];
  for (let i = start; i <= end; i++) {
    years.push({ id: i, name: i });
  }
  return years;
}

// ── ISO string helpers ──────────────────────────────────────────────────────

/** Format a timestamp as ISO date string ("2024-07-15") */
function toISODate(ts: number): string {
  return formatCustom(ts, 'Y-m-d');
}

/** Format a timestamp as ISO month string ("2026-05") */
function toISOMonth(ts: number): string {
  return formatCustom(ts, 'Y-m');
}

/** Format a timestamp as ISO datetime string ("2024-07-15T14:30:00.000Z") */
function toISODateTime(ts: number): string {
  return new Date(ts).toISOString();
}

/** Format a timestamp as RFC 3339 / ISO 8601 */
function toRFC3339(ts: number): string {
  return new Date(ts).toISOString();
}

// ── Export ───────────────────────────────────────────────────────────────────

export const time = {
  // Core
  now,
  nowSecs,
  fromComponents,
  parseISO,
  parseDate,
  today,
  dayStart,
  weekStart,
  monthStart,
  dateKey,

  // Formatting
  format,
  formatDate: formatDateOnly,
  formatTime: formatTimeOnly,
  formatCustom,

  // Relative
  dayString,
  timeAgo,
  duration,
  elapsed,

  // Boolean
  isToday,
  isThisWeek,
  isYesterday,
  isTomorrow,

  // Extraction
  getCalendarDate,
  getDate,
  mergeDateAndTime,

  // Math
  daysBetween,
  hoursBetween,
  minutesBetween,
  addDays,
  subtractDays,

  // Calendar
  isLeapYear,
  getMonthDays,
  getCalendarMonth,
  getWeekDays,
  getMonths,
  getYears,

  // ISO helpers
  toISODate,
  toISOMonth,
  toISODateTime,
  toRFC3339,

  // Constants
  SECONDS,
  MINUTES,
  HOURS,
  DAY,
  WEEK,
  YEAR_APPROX,
} as const;

export type TimeUtil = typeof time;
