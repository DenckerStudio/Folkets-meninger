export type ScheduleMode = 'full' | 'throttle';

export type ScheduleWindow = {
  startHour: number;
  endHour: number;
  mode: ScheduleMode;
};

/** Parse `22-07:full,07-22:throttle` (hours in 0–23, end exclusive wrap). */
export function parseSchedule(spec: string): ScheduleWindow[] {
  const trimmed = spec.trim();
  if (!trimmed) return [];

  const windows: ScheduleWindow[] = [];
  for (const part of trimmed.split(',')) {
    const piece = part.trim();
    if (!piece) continue;
    const match = /^(\d{1,2})-(\d{1,2}):(full|throttle)$/i.exec(piece);
    if (!match) {
      throw new Error(`Ugyldig schedule-del: ${piece}`);
    }
    const startHour = Number(match[1]);
    const endHour = Number(match[2]);
    const mode = match[3].toLowerCase() as ScheduleMode;
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      throw new Error(`Timeområde utenfor 0–23: ${piece}`);
    }
    windows.push({ startHour, endHour, mode });
  }

  if (windows.length === 0) {
    throw new Error('Schedule er tom');
  }
  return windows;
}

function hourInWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

export function scheduleModeAt(
  windows: ScheduleWindow[],
  date: Date,
  timeZone: string,
): ScheduleMode {
  if (windows.length === 0) return 'full';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour');
  const hour = hourPart ? Number(hourPart.value) : date.getUTCHours();

  for (const w of windows) {
    if (hourInWindow(hour, w.startHour, w.endHour)) {
      return w.mode;
    }
  }
  return 'throttle';
}

export function maxBatchesPerMinuteForSchedule(
  mode: ScheduleMode,
  throttleCap: number,
  fullCap: number,
): number {
  return mode === 'full' ? fullCap : throttleCap;
}
