import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const discoverQuery = z.object({
  restaurantId: z.string(),
  sectorId: z.string(),
  date: z.string().regex(datePattern),
  partySize: z.coerce.number().int().positive(),
  duration: z.coerce.number().int().refine(
    n => n % 15 === 0 && n >= 30 && n <= 180,
    '15-min grid, 30-180 range'
  ),
});

export const bookingBody = z.object({
  restaurantId: z.string(),
  sectorId: z.string(),
  tableIds: z.array(z.string()).min(1),
  partySize: z.number().int().positive(),
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const dayQuery = z.object({
  restaurantId: z.string(),
  sectorId: z.string(),
  date: z.string().regex(datePattern),
});

export type DiscoverQuery = z.infer<typeof discoverQuery>;
export type BookingBody = z.infer<typeof bookingBody>;
export type DayQuery = z.infer<typeof dayQuery>;
