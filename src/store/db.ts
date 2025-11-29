import {
  Restaurant,
  RestaurantId,
  Sector,
  SectorId,
  Table,
  TableId,
  Booking,
  BookingId,
  toRestaurantId,
  toSectorId,
  toTableId,
  now,
} from '../domain/types';
import seedData from '../data/seed.json';

class Database {
  private restaurants = new Map<RestaurantId, Restaurant>();
  private sectors = new Map<SectorId, Sector>();
  private tables = new Map<TableId, Table>();
  private bookings = new Map<BookingId, Booking>();

  // Index for efficient sector->tables lookup
  private tablesBySector = new Map<SectorId, TableId[]>();

  constructor() {
    this.loadSeed();
  }

  private loadSeed(): void {
    const timestamp = now();

    for (const r of seedData.restaurants) {
      const id = toRestaurantId(r.id);
      this.restaurants.set(id, {
        ...r,
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as Restaurant);
    }

    for (const s of seedData.sectors) {
      const id = toSectorId(s.id);
      const restaurantId = toRestaurantId(s.restaurantId);
      this.sectors.set(id, {
        ...s,
        id,
        restaurantId,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as Sector);
    }

    for (const t of seedData.tables) {
      const id = toTableId(t.id);
      const sectorId = toSectorId(t.sectorId);
      this.tables.set(id, {
        ...t,
        id,
        sectorId,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as Table);

      // Build index
      const existing = this.tablesBySector.get(sectorId) || [];
      this.tablesBySector.set(sectorId, [...existing, id]);
    }
  }

  // Restaurant queries
  getRestaurant(id: RestaurantId): Restaurant | undefined {
    return this.restaurants.get(id);
  }

  getAllRestaurants(): Restaurant[] {
    return Array.from(this.restaurants.values());
  }

  // Sector queries
  getSector(id: SectorId): Sector | undefined {
    return this.sectors.get(id);
  }

  getSectorsByRestaurant(restaurantId: RestaurantId): Sector[] {
    return Array.from(this.sectors.values()).filter(
      s => s.restaurantId === restaurantId
    );
  }

  // Table queries
  getTable(id: TableId): Table | undefined {
    return this.tables.get(id);
  }

  getTablesBySector(sectorId: SectorId): Table[] {
    const ids = this.tablesBySector.get(sectorId) || [];
    return ids.map(id => this.tables.get(id)!).filter(Boolean);
  }

  // Booking queries
  getBooking(id: BookingId): Booking | undefined {
    return this.bookings.get(id);
  }

  getBookingsByRestaurant(restaurantId: RestaurantId): Booking[] {
    return Array.from(this.bookings.values()).filter(
      b => b.restaurantId === restaurantId
    );
  }

  getBookingsBySector(sectorId: SectorId): Booking[] {
    return Array.from(this.bookings.values()).filter(
      b => b.sectorId === sectorId
    );
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
