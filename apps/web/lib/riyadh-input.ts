import { RIYADH_OFFSET_MS } from '@app/shared';

/** <input type="datetime-local"> values are Riyadh wall-clock time. */
export function toRiyadhInput(iso: string | Date): string {
  return new Date(new Date(iso).getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 16);
}
export function fromRiyadhInput(v: string): string {
  return new Date(Date.parse(`${v}:00.000Z`) - RIYADH_OFFSET_MS).toISOString();
}
