import { AvailableSlot } from './availability';
import { toMinutesFromISO } from '../utils/time';

const WASTE_WEIGHT = 100;
const COMBO_PENALTY = 10;

export function selectBestSlot(
  slots: AvailableSlot[],
  partySize: number,
  windowStart: string
): AvailableSlot | null {
  if (!slots.length) return null;
  if (slots.length === 1) return slots[0];

  const scored = slots.map(s => ({
    slot: s,
    score: scoreSlot(s, partySize, windowStart),
  }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return (a.slot.tableIds[0] ?? '').localeCompare(b.slot.tableIds[0] ?? '');
  });

  return scored[0].slot;
}

function scoreSlot(slot: AvailableSlot, partySize: number, windowStart: string): number {
  const waste = slot.maxCapacity - partySize;
  const comboSize = slot.tableIds.length;
  const mins = toMinutesFromISO(slot.start) - toMinutesFromISO(windowStart);

  return (waste * WASTE_WEIGHT) + (comboSize * COMBO_PENALTY) + mins;
}
