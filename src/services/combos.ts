import { db } from '../store/db';
import { Table, TableId, ServiceWindow, SectorId, RestaurantId } from '../domain/types';

export interface ComboSlot {
  start: string;
  end: string;
  tableIds: TableId[];
  tableNames: string[];
  minCapacity: number;
  maxCapacity: number;
}

interface Gap {
  start: number;
  end: number;
}

export function findComboSlots(
  restaurantId: string,
  sectorId: string,
  date: string,
  partySize: number,
  duration: number
): ComboSlot[] {
  const restaurant = db.getRestaurant(restaurantId as RestaurantId);
  if (!restaurant) return [];

  const tables = db.getTablesBySector(sectorId as SectorId);
  if (tables.length < 2) return [];

  const windows = restaurant.windows || [];
  if (windows.length === 0) return [];

  const combos = generateCombos(tables, partySize);
  const slots: ComboSlot[] = [];

  for (const combo of combos) {
    const cap = getComboCapacity(combo);

    const gapSets = combo.map(t => getTableGaps(t, date, windows));
    const intersected = intersectGaps(gapSets);

    for (const gap of intersected) {
      addSlotsFromGap(slots, combo, cap, date, gap, duration);
    }
  }

  slots.sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.tableIds.join(',').localeCompare(b.tableIds.join(','));
  });

  return slots;
}

function generateCombos(tables: Table[], partySize: number): Table[][] {
  const combos: Table[][] = [];

  for (let size = 2; size <= tables.length; size++) {
    for (const combo of combinations(tables, size)) {
      const cap = getComboCapacity(combo);
      if (cap.min <= partySize && cap.max >= partySize) {
        combos.push(combo);
      }
    }
  }

  return combos;
}

function* combinations<T>(arr: T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }

  for (let i = 0; i <= arr.length - size; i++) {
    for (const rest of combinations(arr.slice(i + 1), size - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

export function getComboCapacity(tables: Table[]): { min: number; max: number } {
  return {
    min: tables.reduce((sum, t) => sum + t.minSize, 0),
    max: tables.reduce((sum, t) => sum + t.maxSize, 0),
  };
}

function getTableGaps(table: Table, date: string, windows: ServiceWindow[]): Gap[] {
  const bookings = db.getBookingsByTable(table.id);
  const dayBookings = bookings.filter(b => b.start.startsWith(date));
  dayBookings.sort((a, b) => (a.start < b.start ? -1 : 1));

  const gaps: Gap[] = [];

  for (const window of windows) {
    const wStart = toMinutes(window.start);
    const wEnd = toMinutes(window.end);

    const relevant = dayBookings.filter(b => {
      const bStart = toMinutesFromISO(b.start);
      const bEnd = toMinutesFromISO(b.end);
      return bStart < wEnd && bEnd > wStart;
    });

    let cursor = wStart;

    for (const booking of relevant) {
      const bStart = toMinutesFromISO(booking.start);
      const bEnd = toMinutesFromISO(booking.end);

      if (cursor < bStart) {
        gaps.push({ start: cursor, end: bStart });
      }
      cursor = Math.max(cursor, bEnd);
    }

    if (cursor < wEnd) {
      gaps.push({ start: cursor, end: wEnd });
    }
  }

  return gaps;
}

function intersectGaps(gapSets: Gap[][]): Gap[] {
  if (gapSets.length === 0) return [];
  if (gapSets.length === 1) return gapSets[0];

  let result = gapSets[0];

  for (let i = 1; i < gapSets.length; i++) {
    result = intersectTwo(result, gapSets[i]);
    if (result.length === 0) break;
  }

  return result;
}

function intersectTwo(a: Gap[], b: Gap[]): Gap[] {
  const result: Gap[] = [];
  let i = 0, j = 0;

  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);

    if (start < end) {
      result.push({ start, end });
    }

    // advance pointer with earlier end
    if (a[i].end < b[j].end) i++;
    else j++;
  }

  return result;
}

function addSlotsFromGap(
  slots: ComboSlot[],
  combo: Table[],
  cap: { min: number; max: number },
  date: string,
  gap: Gap,
  duration: number
): void {
  // round up to next 15-min slot
  let start = Math.ceil(gap.start / 15) * 15;

  while (start + duration <= gap.end) {
    slots.push({
      start: toISO(date, start),
      end: toISO(date, start + duration),
      tableIds: combo.map(t => t.id),
      tableNames: combo.map(t => t.name),
      minCapacity: cap.min,
      maxCapacity: cap.max,
    });
    start += 15;
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toMinutesFromISO(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function toISO(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
}
