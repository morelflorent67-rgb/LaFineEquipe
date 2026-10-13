import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { MatchList } from '@/components/match/MatchList';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag, Delta, Level, ProfileFreshness, StateBlock } from '@/components/ui/badges';
import { FaceitLink } from '@/components/ui/FaceitLink';
import { Icon } from '@/components/ui/Icon';
import { getMapCovers, getPlayer, getRecentMatches, settle } from '@/lib/data/queries';
import { progressionOf } from '@/lib/elo/board';
import { fmtDate, fmtInt } from '@/lib/format';

type Params = { params: Promise<{ playerId: string }> };

async function load(playerId: string) {
  if (!z.uuid().safeParse(playerId).success) return null;
  const res = await settle(getPlayer(playerId));
  return res;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { playerId } = await params;
  const res = await load(playerId);
  return { title: res?.ok && res.data ? res.data.profile.nickname : 'Joueur' };
}

export default async function PlayerPage({ params }: Params) {
  const { playerId } = await params;
  const res = await load(playerId);
  if (!res || (res.ok && !res.data)) {
    return (
      <section className="sec">
        <StateBlock
          title="Joueur introuvable"
          actions={
            <Link className="btn btn-steel btn-sm" href="/team">
              Voir le roster
            </Link>
          }
        >
          Ce joueur n’existe pas ou a été retiré du roster.
        </StateBlock>
      </section>
    );
  }
  if (!res.ok) {
    return (
      <section className="sec">
        <StateBlock kind="error" title="Profil momentanément indisponible" />
      </section>
    );
  }
  const player = res.data!;
  const p = player.profile;
  const [matches, maps] = await Promise.all([settle(getRecentMatches(10, player.id)), settle(getMapCovers())]);
  const progression = progressionOf(player);

  return (
    <>
      <header className="page-head" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
        <Avatar src={p.avatarUrl} size={140} level={p.cs2Level} alt={`Avatar FACEIT de ${p.nickname}`} />
        <div style={{ minWidth: 0, display: 'grid', gap: 12 }}>
          <p className="kicker">
            <Icon name="spk" className="spk" /> {player.group === 'team' ? 'Team' : 'Guest'}
            {player.active ? '' : ' · inactif'}
          </p>
          <h1 className="h1" style={{ overflowWrap: 'anywhere' }}>
            {p.nickname}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center' }}>
            <span>
              Niveau <Level level={p.cs2Level} />
            </span>
            <span className="num">{p.cs2Elo !== null ? `${fmtInt(p.cs2Elo)} ELO` : 'ELO CS2 non fourni par FACEIT'}</span>
            <ProfileFreshness fetchedAt={p.fetchedAt} lastError={p.lastError} lastAttemptAt={p.lastAttemptAt} staleAfterHours={6} />
            <FaceitLink nickname={p.nickname} isDemo={p.isDemo} label="Profil FACEIT" />
            {player.isDemo ? <DemoTag /> : null}
          </div>
        </div>
      </header>

      <section className="sec" aria-labelledby="run-h" style={{ paddingBottom: 0 }}>
        <h2 className="h3" id="run-h" style={{ marginBottom: 12 }}>
          ELO Run
        </h2>
        {player.active ? (
          <div className="state" style={{ borderStyle: 'solid' }}>
            <strong>Classement permanent</strong>
            <span className="num">
              Ajouté le {fmtDate(player.addedAt)} à {player.addedElo !== null ? `${fmtInt(player.addedElo)} ELO` : '— (ELO en attente)'} → actuel{' '}
              {p.cs2Elo !== null ? fmtInt(p.cs2Elo) : '—'} · <Delta value={progression} />
            </span>
            <Link className="link" href="/elo-run">
              Classement complet <Icon name="arrow" className="arrow" />
            </Link>
          </div>
        ) : (
          <p className="muted">Joueur inactif : il ne figure plus au classement (son historique est conservé).</p>
        )}
      </section>

      <section className="sec" aria-labelledby="m-h">
        <div className="sec-h">
          <h2 className="h3" id="m-h">
            Derniers matchs
          </h2>
          <span className="mono">Dans le roster depuis le {fmtDate(player.createdAt)}</span>
        </div>
        {!matches.ok ? (
          <StateBlock kind="error" title="Matchs momentanément indisponibles" />
        ) : matches.data.length === 0 ? (
          <StateBlock title="Aucun match enregistré pour ce joueur" />
        ) : (
          <MatchList matches={matches.data} covers={maps.ok ? maps.data : {}} />
        )}
      </section>
    </>
  );
}
