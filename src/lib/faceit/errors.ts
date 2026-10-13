/** Erreurs FACEIT normalisées. Le message ne contient jamais la clé API. */
export type FaceitErrorKind =
  | 'config_missing'
  | 'bad_request'
  | 'unauthorized'
  | 'not_found'
  | 'rate_limited'
  | 'unavailable'
  | 'timeout'
  | 'network'
  | 'invalid_response';

export class FaceitError extends Error {
  override name = 'FaceitError';
  constructor(
    public readonly kind: FaceitErrorKind,
    message: string,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

/** Libellés affichés dans l'interface. */
export const FACEIT_ERROR_LABELS: Record<FaceitErrorKind, string> = {
  config_missing: 'Clé FACEIT absente côté serveur : ajoute FACEIT_API_KEY dans .env.local puis redémarre.',
  bad_request: 'Requête refusée par FACEIT (paramètre invalide).',
  unauthorized: 'Clé FACEIT refusée : vérifie qu’il s’agit d’une clé « Server side » valide.',
  not_found: 'Profil FACEIT introuvable.',
  rate_limited: 'Trop de requêtes vers FACEIT : réessaie dans quelques minutes.',
  unavailable: 'FACEIT ne répond pas correctement pour le moment.',
  timeout: 'FACEIT a mis trop de temps à répondre.',
  network: 'Impossible de joindre FACEIT (réseau).',
  invalid_response: 'Réponse FACEIT inattendue : rien n’a été enregistré.',
};
