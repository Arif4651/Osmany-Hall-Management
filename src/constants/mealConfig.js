export const CUTOFF_STORAGE_KEY = 'admin_meal_cutoff_time';
export const DEFAULT_CUTOFF_TIME = '17:00';

export const DAY_CONFIG = [
  { id: 'sun', label: 'Sunday', order: 0 },
  { id: 'mon', label: 'Monday', order: 1 },
  { id: 'tue', label: 'Tuesday', order: 2 },
  { id: 'wed', label: 'Wednesday', order: 3 },
  { id: 'thu', label: 'Thursday', order: 4 },
  { id: 'fri', label: 'Friday', order: 5 },
  { id: 'sat', label: 'Saturday', order: 6 },
];

const JS_DAY_TO_CONFIG_ID = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function parseTimeToMinutes(timeValue) {
  if (!timeValue || !timeValue.includes(':')) return null;

  const [hourRaw, minuteRaw] = timeValue.split(':').map(Number);
  if (Number.isNaN(hourRaw) || Number.isNaN(minuteRaw)) return null;

  return (hourRaw * 60) + minuteRaw;
}

export function formatCutoffTimeLabel(timeValue) {
  const minutes = parseTimeToMinutes(timeValue);
  if (minutes == null) return timeValue || 'N/A';

  const hourRaw = Math.floor(minutes / 60);
  const minuteRaw = minutes % 60;
  const period = hourRaw >= 12 ? 'PM' : 'AM';
  const hour12 = hourRaw % 12 || 12;

  return `${String(hour12).padStart(2, '0')}:${String(minuteRaw).padStart(2, '0')} ${period}`;
}

export function isAfterDailyCutoff(timeValue, currentDate = new Date()) {
  const cutoffMinutes = parseTimeToMinutes(timeValue);
  if (cutoffMinutes == null) return false;

  const currentMinutes = (currentDate.getHours() * 60) + currentDate.getMinutes();
  return currentMinutes >= cutoffMinutes;
}

export function getMinutesUntilCutoff(timeValue, currentDate = new Date()) {
  const cutoffMinutes = parseTimeToMinutes(timeValue);
  if (cutoffMinutes == null) return 0;

  const currentMinutes = (currentDate.getHours() * 60) + currentDate.getMinutes();
  return Math.max(0, cutoffMinutes - currentMinutes);
}

export function getDayIdFromDate(currentDate = new Date()) {
  return JS_DAY_TO_CONFIG_ID[currentDate.getDay()];
}

export function getTomorrowDayId(currentDate = new Date()) {
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(currentDate.getDate() + 1);
  return getDayIdFromDate(tomorrow);
}
