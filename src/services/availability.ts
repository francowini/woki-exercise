import { Database } from '../store/db';
import { RestaurantId, SectorId, TableId, Table, ServiceWindow } from '../domain/types';
import { createComboService } from './combos';
import { toMinutes, toMinutesFromISO, toISO, SLOT_GRID_MINUTES } from '../utils/time';

interface TimeSlot {
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

export function createAvailabilityService(db: Database) {
  const comboService = createComboService(db);

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
    let start = Math.ceil(gapStart / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;

    while (start + duration <= gapEnd) {
      slots.push({
        start: toISO(date, start),
        end: toISO(date, start + duration),
        tableId: table.id,
        tableName: table.name,
      });
      start += SLOT_GRID_MINUTES;
    }
  }

  function findAllAvailableSlots(
    restaurantId: RestaurantId,
    sectorId: SectorId,
    date: string,
    partySize: number,
    duration: number
  ): AvailableSlot[] {
    const restaurant = db.getRestaurant(restaurantId);
    if (!restaurant) return [];

    const tables = db.getTablesBySector(sectorId);
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

    const comboSlots = comboService.findComboSlots(restaurantId, sectorId, date, partySize, duration);
    slots.push(...comboSlots);

    slots.sort((a, b) => {
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return a.tableIds.join(',').localeCompare(b.tableIds.join(','));
    });

    return slots;
  }

  return { findAllAvailableSlots };
}
