declare const restaurantIdBrand: unique symbol;
export type RestaurantId = string & { [restaurantIdBrand]: true };

declare const sectorIdBrand: unique symbol;
export type SectorId = string & { [sectorIdBrand]: true };

declare const tableIdBrand: unique symbol;
export type TableId = string & { [tableIdBrand]: true };

declare const bookingIdBrand: unique symbol;
export type BookingId = string & { [bookingIdBrand]: true };

export const toRestaurantId = (s: string): RestaurantId => s as RestaurantId;
export const toSectorId = (s: string): SectorId => s as SectorId;
export const toTableId = (s: string): TableId => s as TableId;
export const toBookingId = (s: string): BookingId => s as BookingId;

export type ISODateTime = string;

export interface ServiceWindow {
  start: string;
  end: string;
}

export interface Restaurant {
  id: RestaurantId;
  name: string;
  timezone: string;
  windows?: ServiceWindow[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Sector {
  id: SectorId;
  restaurantId: RestaurantId;
  name: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Table {
  id: TableId;
  sectorId: SectorId;
  name: string;
  minSize: number;
  maxSize: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface Booking {
  id: BookingId;
  restaurantId: RestaurantId;
  sectorId: SectorId;
  tableIds: TableId[];
  partySize: number;
  start: ISODateTime;
  end: ISODateTime;
  durationMinutes: number;
  status: BookingStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const now = (): ISODateTime => new Date().toISOString();
