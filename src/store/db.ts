import {
  Restaurant,
  RestaurantId,
  Sector,
  SectorId,
  Table,
  TableId,
  Booking,
  BookingId,
  now,
} from '../domain/types';
import seedData from '../data/seed.json';

class Database {
  private restaurants = new Map<RestaurantId, Restaurant>();
  private sectors = new Map<SectorId, Sector>();
  private tables = new Map<TableId, Table>();
  private bookings = new Map<BookingId, Booking>();
  private tablesBySector = new Map<SectorId, TableId[]>();

  constructor() {
    this.loadSeed();
  }

  private loadSeed(): void {
    const ts = now();

    for (const r of seedData.restaurants) {
      const id = r.id as RestaurantId;
      this.restaurants.set(id, { ...r, id, createdAt: ts, updatedAt: ts } as Restaurant);
    }

    for (const s of seedData.sectors) {
      const id = s.id as SectorId;
      const restaurantId = s.restaurantId as RestaurantId;
      this.sectors.set(id, { ...s, id, restaurantId, createdAt: ts, updatedAt: ts } as Sector);
    }

    for (const t of seedData.tables) {
      const id = t.id as TableId;
      const sectorId = t.sectorId as SectorId;
      this.tables.set(id, { ...t, id, sectorId, createdAt: ts, updatedAt: ts } as Table);

      const existing = this.tablesBySector.get(sectorId) || [];
      this.tablesBySector.set(sectorId, [...existing, id]);
    }
  }

  getRestaurant(id: RestaurantId): Restaurant | undefined {
    return this.restaurants.get(id);
  }

  getAllRestaurants(): Restaurant[] {
    return Array.from(this.restaurants.values());
  }

  getSector(id: SectorId): Sector | undefined {
    return this.sectors.get(id);
  }

  getSectorsByRestaurant(restaurantId: RestaurantId): Sector[] {
    return Array.from(this.sectors.values()).filter(s => s.restaurantId === restaurantId);
  }

  getTable(id: TableId): Table | undefined {
    return this.tables.get(id);
  }

  getTablesBySector(sectorId: SectorId): Table[] {
    const ids = this.tablesBySector.get(sectorId) || [];
    return ids.map(id => this.tables.get(id)).filter((t): t is Table => t !== undefined);
  }

  getBooking(id: BookingId): Booking | undefined {
    return this.bookings.get(id);
  }

  getBookingsByTable(tableId: TableId): Booking[] {
    return Array.from(this.bookings.values()).filter(
      b => b.tableIds.includes(tableId) && b.status === 'CONFIRMED'
    );
  }

  getBookingsBySector(sectorId: SectorId): Booking[] {
    return Array.from(this.bookings.values()).filter(b => b.sectorId === sectorId);
  }

  createBooking(booking: Booking): Booking {
    this.bookings.set(booking.id, booking);
    return booking;
  }

  updateBooking(id: BookingId, updates: Partial<Booking>): Booking | undefined {
    const existing = this.bookings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: now() };
    this.bookings.set(id, updated);
    return updated;
  }
}

export const db = new Database();
