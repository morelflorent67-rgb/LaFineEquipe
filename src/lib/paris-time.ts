/**
 * Conversion entre l'heure de Paris saisie dans un champ « datetime-local » et une date ISO (UTC).
 * Gère l'heure d'été / d'hiver sans dépendance externe.
 */
const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' });
const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Décalage de Paris (en minutes) à un instant donné : +60 en hiver, +120 en été. */
export function parisOffsetMinutes(at: Date): number {
  const name = offsetFmt.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 60;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** « 2026-10-01T20:00 » (heure de Paris) → « 2026-10-01T18:00:00.000Z ». */
export function parisLocalToIso(value: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let ts = naive - parisOffsetMinutes(new Date(naive)) * 60_000;
  ts = naive - parisOffsetMinutes(new Date(ts)) * 60_000;
  return new Date(ts).toISOString();
}

/** Date ISO → valeur pour un champ « datetime-local » en heure de Paris. */
export function isoToParisLocal(iso: string | null): string {
  if (!iso) return '';
  const parts = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
