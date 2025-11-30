export const SLOT_GRID_MINUTES = 15;
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 180;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toMinutesFromISO(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function toISO(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
}
