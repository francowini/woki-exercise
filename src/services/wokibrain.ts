import { AvailableSlot } from './availability';

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
    return a.slot.tableIds.join(',').localeCompare(b.slot.tableIds.join(','));
  });

  return scored[0].slot;
}

function scoreSlot(slot: AvailableSlot, partySize: number, windowStart: string): number {
  const waste = slot.maxCapacity - partySize;
  const comboSize = slot.tableIds.length;
  const mins = toMinutesFromISO(slot.start) - toMinutesFromISO(windowStart);

  // weighted: capacity waste >> combo size >> time
  return (waste * 100) + (comboSize * 10) + mins;
}

function toMinutesFromISO(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
