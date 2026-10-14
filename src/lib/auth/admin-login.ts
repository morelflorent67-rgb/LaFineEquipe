/**
 * Compte unique d'administration (décision du 14/10/2026) : on se connecte avec l'identifiant
 * « admin ». Supabase Auth exige un e-mail : l'identifiant est traduit côté serveur en
 * LFE_ADMIN_EMAIL, qui n'est jamais envoyé au navigateur.
 */
export const ADMIN_LOGIN = 'admin';

/** Renvoie l'e-mail Supabase du compte admin si l'identifiant saisi est « admin », sinon null. */
export function resolveAdminEmail(identifier: string, adminEmail: string | null): string | null {
  if (!adminEmail) return null;
  return identifier.trim().toLowerCase() === ADMIN_LOGIN ? adminEmail : null;
}
