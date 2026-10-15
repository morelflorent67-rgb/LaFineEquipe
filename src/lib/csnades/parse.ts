/**
 * Lecture des pages publiques de csnades.gg (import autorisé par écrit par csnades, voir
 * docs/csnades-import.md). Leurs pages Next.js embarquent les données dans le flux RSC
 * (`self.__next_f.push([1, "…"])`) : on reconstitue ce flux puis on en extrait les objets JSON.
 * Aucune requête réseau ici : fonctions pures, testées avec des extraits de pages.
 */

/** Reconstitue le texte du flux RSC à partir du HTML d'une page. */
export function flightText(html: string): string {
  const parts: string[] = [];
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  for (const m of html.matchAll(re)) parts.push(JSON.parse(m[1]!) as string);
  return parts.join('');
}

/** Renvoie l'objet JSON qui commence à `start` (accolade ouvrante), en respectant les chaînes. */
export function objectAt(text: string, start: number): unknown {
  if (text[start] !== '{') throw new Error('objectAt : pas d’accolade à cette position');
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('objectAt : objet non terminé');
}

/** Tous les objets qui commencent par `marker` (le marqueur doit commencer par « { »). */
export function objectsStartingWith(text: string, marker: string): unknown[] {
  const out: unknown[] = [];
  let i = text.indexOf(marker);
  while (i >= 0) {
    out.push(objectAt(text, i));
    i = text.indexOf(marker, i + 1);
  }
  return out;
}

/** Les dates du flux RSC sont préfixées par « $D ». */
export function rscDate(v: unknown): string | null {
  return typeof v === 'string' && v.startsWith('$D') ? v.slice(2) : typeof v === 'string' ? v : null;
}

/** Repères de sous-titres WebVTT : début en secondes + texte (les étapes de leurs vidéos). */
export function parseVtt(vtt: string): { start: number; text: string }[] {
  const cues: { start: number; text: string }[] = [];
  const blocks = vtt.replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const t = lines.findIndex((l) => l.includes('-->'));
    if (t < 0) continue;
    const m = lines[t]!.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/);
    if (!m) continue;
    const start = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]!.padEnd(3, '0')) / 1000;
    const text = lines
      .slice(t + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) cues.push({ start: Math.round(start * 100) / 100, text });
  }
  return cues;
}
