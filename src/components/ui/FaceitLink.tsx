import { faceitProfileUrl } from '@/lib/faceit/input';
import { Icon } from './Icon';

/**
 * Lien vers le profil FACEIT d'un joueur. Pour un profil fictif (démo), aucun lien n'est créé :
 * un pseudo « demo_… » pourrait exister sur FACEIT et désigner une vraie personne.
 */
export function FaceitLink({
  nickname,
  isDemo,
  className = 'link',
  label = 'FACEIT',
}: {
  nickname: string;
  isDemo: boolean;
  className?: string;
  label?: string;
}) {
  if (isDemo) {
    return (
      <span className={`${className}`} aria-disabled="true" title="Profil fictif : aucun lien FACEIT" style={{ opacity: 0.55, cursor: 'not-allowed' }}>
        {label} (fictif)
      </span>
    );
  }
  return (
    <a
      className={className}
      href={faceitProfileUrl(nickname)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Profil FACEIT de ${nickname} (nouvel onglet)`}
    >
      {label} <Icon name="ext" />
    </a>
  );
}
