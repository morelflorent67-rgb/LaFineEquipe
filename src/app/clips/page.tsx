import type { Metadata } from 'next';
import { ComingSoon } from '@/components/site/ComingSoon';

export const metadata: Metadata = { title: 'Clips' };

export default function ClipsPage() {
  return (
    <ComingSoon
      kicker="Highlights"
      title="Clips"
      plan={[
        'V1 : un admin ajoute des liens YouTube, Twitch ou Allstar (titre, joueur, map, date).',
        'Lecture intégrée seulement si le fournisseur l’autorise, sinon lien externe.',
        'Import automatique uniquement avec une API officielle et des droits vérifiés.',
      ]}
    >
      FACEIT ne propose pas d’API publique de clips, et l’API Allstar demande un accès partenaire. Aucun import automatique
      n’est donc simulé ici.
    </ComingSoon>
  );
}
