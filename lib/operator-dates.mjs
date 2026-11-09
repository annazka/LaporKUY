import {jakartaDate} from './rules.mjs';
export function operatorTargetMin(action, startDate, reportStart, now = new Date()) {
 const today = jakartaDate(now);
 const start = action === 'verify' ? startDate : reportStart;
 return start && start > today ? start : today;
}
function validDate(value) {
 return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function operatorDateError(action, startDate, targetDate, reportStart, now = new Date()) {
 if (!['verify','reschedule'].includes(action)) return '';
 if (action === 'verify' && !validDate(startDate)) return 'Isi tanggal mulai yang valid.';
 if (!validDate(targetDate)) return 'Isi target selesai yang valid.';
 if (targetDate < jakartaDate(now)) return 'Target selesai tidak boleh sebelum hari ini (WIB).';
 const start = action === 'verify' ? startDate : reportStart;
 if (start && targetDate < start) return 'Target selesai tidak boleh sebelum tanggal mulai perbaikan.';
 return '';
}
