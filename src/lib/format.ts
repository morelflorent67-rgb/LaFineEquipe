/**
 * Formatage français. Le fuseau Europe/Paris est imposé pour que le serveur (UTC en ligne)
 * et le navigateur affichent les mêmes heures.
 */
const TZ = 'Europe/Paris';
const nf = new Intl.NumberFormat('fr-FR');
const dateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const longDateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

export const fmtInt = (n: number) => nf.format(n);

/** +12 / −8 / 0 (signe moins typographique). */
export function fmtSigned(n: number): string {
  if (n > 0) return `+${nf.format(n)}`;
  if (n < 0) return `−${nf.format(Math.abs(n))}`;
  return '0';
}

export const fmtDate = (v: string | Date) => dateFmt.format(toDate(v));
export const fmtShortDate = (v: string | Date) => shortDateFmt.format(toDate(v));
export const fmtTime = (v: string | Date) => timeFmt.format(toDate(v));
export const fmtLongDate = (v: string | Date) => longDateFmt.format(toDate(v));
/** « 12/10 à 14:05 » */
export const fmtDateTime = (v: string | Date) => `${fmtShortDate(v)} à ${fmtTime(v)}`;

/** Clé de jour « AAAA-MM-JJ » dans le fuseau de Paris. */
export const parisDayKey = (v: string | Date) => dayKeyFmt.format(toDate(v));

/** « il y a 5 min », « il y a 3 h », sinon la date. */
export function fmtAgo(v: string | Date, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - toDate(v).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `le ${fmtDateTime(v)}`;
}

/** Libellé d'un nom de map FACEIT (« de_mirage » → « Mirage »). */
export function mapLabel(mapKey: string | null, mapName: string | null): string | null {
  if (mapName) return mapName;
  if (!mapKey) return null;
  const base = mapKey.replace(/^(de|cs)_/, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Libellé quand la map manque : l'historique FACEIT ne la donne pas, elle arrive avec les détails
 * du match au passage de synchro suivant (source encore « faceit_history »).
 */
export const missingMapLabel = (m: { status: string; source: string }) =>
  m.status === 'cancelled' ? 'Annulé' : m.source === 'faceit_history' ? 'Map en attente' : 'Map inconnue';

export const pluralize = (n: number, one: string, many: string) => `${fmtInt(n)} ${n > 1 ? many : one}`;
