import { z } from 'zod';
import { RestaurantId, SectorId } from './domain/types';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

export const discoverQuery = z.object({
  restaurantId: z.string().min(1).transform(s => s as RestaurantId),
  sectorId: z.string().min(1).transform(s => s as SectorId),
  date: z.string().regex(datePattern, 'date must be YYYY-MM-DD'),
  partySize: z.coerce.number().int().positive(),
  duration: z.coerce.number().int().refine(
    n => n % 15 === 0 && n >= 30 && n <= 180,
    '15-min grid, 30-180 range'
  ),
  windowStart: z.string().regex(timePattern).optional(),
  windowEnd: z.string().regex(timePattern).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const bookingBody = z.object({
  restaurantId: z.string().min(1),
  sectorId: z.string().min(1),
  partySize: z.number().int().positive(),
  durationMinutes: z.number().int().refine(
    n => n % 15 === 0 && n >= 30 && n <= 180,
    '15-min grid, 30-180 range'
  ),
  date: z.string().regex(datePattern, 'date must be YYYY-MM-DD'),
  windowStart: z.string().regex(timePattern),
  windowEnd: z.string().regex(timePattern),
});

export const dayQuery = z.object({
  restaurantId: z.string().min(1),
  sectorId: z.string().min(1),
  date: z.string().regex(datePattern, 'date must be YYYY-MM-DD'),
});

export const bookingIdParam = z.object({
  id: z.string().min(1),
});

export type DiscoverQuery = z.infer<typeof discoverQuery>;
export type BookingBody = z.infer<typeof bookingBody>;
export type DayQuery = z.infer<typeof dayQuery>;
export type BookingIdParam = z.infer<typeof bookingIdParam>;
