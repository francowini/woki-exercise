import { db } from '../store/db';
import { RestaurantId, SectorId, TableId, Table, ServiceWindow } from '../domain/types';
import { findComboSlots } from './combos';

export interface TimeSlot {
  start: string;
  end: string;
  tableId: TableId;
  tableName: string;
}

export interface AvailableSlot {
  start: string;
  end: string;
  tableIds: TableId[];
  tableNames: string[];
  minCapacity: number;
  maxCapacity: number;
}

export function findAvailableSlots(
  restaurantId: string,
  sectorId: string,
  date: string,
  partySize: number,
  duration: number
): TimeSlot[] {
  const restaurant = db.getRestaurant(restaurantId as RestaurantId);
  if (!restaurant) return [];

  const tables = db.getTablesBySector(sectorId as SectorId);
  const fits = tables.filter(t => t.minSize <= partySize && t.maxSize >= partySize);
  if (fits.length === 0) return [];

  const windows = restaurant.windows || [];
  if (windows.length === 0) return [];

  const slots: TimeSlot[] = [];

  for (const table of fits) {
    const tableSlots = findGapsForTable(table, date, windows, duration);
    slots.push(...tableSlots);
  }

  slots.sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.tableName.localeCompare(b.tableName);
  });

  return slots;
}

function findGapsForTable(
  table: Table,
  date: string,
  windows: ServiceWindow[],
  duration: number
): TimeSlot[] {
  const bookings = db.getBookingsByTable(table.id);
  const dayBookings = bookings.filter(b => b.start.startsWith(date));
  dayBookings.sort((a, b) => (a.start < b.start ? -1 : 1));

  const slots: TimeSlot[] = [];

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

      if (cursor < bStart && bStart - cursor >= duration) {
        addSlotsForGap(slots, table, date, cursor, bStart, duration);
      }
      cursor = Math.max(cursor, bEnd);
    }

    if (cursor < wEnd && wEnd - cursor >= duration) {
      addSlotsForGap(slots, table, date, cursor, wEnd, duration);
    }
  }

  return slots;
}

function addSlotsForGap(
  slots: TimeSlot[],
  table: Table,
  date: string,
  gapStart: number,
  gapEnd: number,
  duration: number
): void {
  let start = Math.ceil(gapStart / 15) * 15;

  while (start + duration <= gapEnd) {
    slots.push({
      start: toISO(date, start),
      end: toISO(date, start + duration),
      tableId: table.id,
      tableName: table.name,
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
  return `${date}T${pad(h)}:${pad(m)}:00Z`;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function findAllAvailableSlots(
  restaurantId: string,
  sectorId: string,
  date: string,
  partySize: number,
  duration: number
): AvailableSlot[] {
  const restaurant = db.getRestaurant(restaurantId as RestaurantId);
  if (!restaurant) return [];

  const tables = db.getTablesBySector(sectorId as SectorId);
  const windows = restaurant.windows || [];
  if (windows.length === 0) return [];

  const slots: AvailableSlot[] = [];

  const singleFits = tables.filter(t => t.minSize <= partySize && t.maxSize >= partySize);
  for (const table of singleFits) {
    const tableSlots = findGapsForTable(table, date, windows, duration);
    for (const s of tableSlots) {
      slots.push({
        start: s.start,
        end: s.end,
        tableIds: [s.tableId],
        tableNames: [s.tableName],
        minCapacity: table.minSize,
        maxCapacity: table.maxSize,
      });
    }
  }

  const comboSlots = findComboSlots(restaurantId, sectorId, date, partySize, duration);
  slots.push(...comboSlots);

  slots.sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return a.tableIds.join(',').localeCompare(b.tableIds.join(','));
  });

  return slots;
}
