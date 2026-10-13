/** Analyse ce que l'admin saisit : pseudo, lien de profil FACEIT ou identifiant FACEIT. */
export type FaceitInput = { kind: 'nickname'; value: string } | { kind: 'id'; value: string };
export type ParseResult = { ok: true; input: FaceitInput } | { ok: false; reason: string };

export const FACEIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NICKNAME = /^[\p{L}\p{N}_.-]{2,32}$/u;

export function parseFaceitInput(text: string): ParseResult {
  const value = text.trim();
  if (value === '') return { ok: false, reason: 'Saisis un pseudo ou un lien de profil FACEIT.' };
  if (value.length > 200) return { ok: false, reason: 'Saisie trop longue.' };

  if (FACEIT_ID.test(value)) return { ok: true, input: { kind: 'id', value: value.toLowerCase() } };

  if (/faceit\.com/i.test(value) || /^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return { ok: false, reason: 'Lien invalide.' };
    }
    if (!/^(www\.)?faceit\.com$/i.test(url.hostname)) {
      return { ok: false, reason: 'Seuls les liens faceit.com sont acceptés.' };
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const at = parts.findIndex((p) => p === 'players' || p === 'players-modal');
    const raw = at >= 0 ? parts[at + 1] : undefined;
    if (!raw) {
      return { ok: false, reason: 'Lien non reconnu : utilise un lien de profil, ex. faceit.com/fr/players/pseudo.' };
    }
    let nickname: string;
    try {
      nickname = decodeURIComponent(raw);
    } catch {
      return { ok: false, reason: 'Lien invalide.' };
    }
    if (!NICKNAME.test(nickname)) return { ok: false, reason: 'Pseudo du lien invalide.' };
    return { ok: true, input: { kind: 'nickname', value: nickname } };
  }

  if (!NICKNAME.test(value)) {
    return { ok: false, reason: 'Pseudo invalide (2 à 32 caractères : lettres, chiffres, « _ », « - », « . »).' };
  }
  return { ok: true, input: { kind: 'nickname', value } };
}

/** Identifiant raccourci, pour l'affichage uniquement. L'identifiant complet reste la référence. */
export function shortFaceitId(id: string): string {
  return id.slice(0, 8);
}

export function faceitProfileUrl(nickname: string): string {
  return `https://www.faceit.com/fr/players/${encodeURIComponent(nickname)}`;
}
