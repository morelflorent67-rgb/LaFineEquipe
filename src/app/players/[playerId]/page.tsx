import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/seo';
import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ClipCard } from '@/components/clips/ClipCard';
import clipStyles from '@/components/clips/clips.module.css';
import { CrosshairCard } from '@/components/crosshairs/CrosshairCard';
import crosshairStyles from '@/components/crosshairs/crosshairs.module.css';
import { EloHistoryChart } from '@/components/elo/EloHistoryChart';
import { MatchList } from '@/components/match/MatchList';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag, Delta, Level, ProfileFreshness, StateBlock } from '@/components/ui/badges';
import { FaceitLink } from '@/components/ui/FaceitLink';
import { Icon } from '@/components/ui/Icon';
import {
  getClips,
  getCrosshairs,
  getEloHistory,
  getMapCovers,
  getPlayer,
  getRecentMatches,
  settle,
} from '@/lib/data/queries';
import { progressionOf } from '@/lib/elo/board';
import { fmtDate, fmtDateTime, fmtInt } from '@/lib/format';
import { mapCoverUrl } from '@/lib/media';
import styles from './player.module.css';

type Params = { params: Promise<{ playerId: string }> };

const load = cache(async (playerId: string) => {
  if (!z.uuid().safeParse(playerId).success) return null;
  const res = await settle(getPlayer(playerId));
  return res;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { playerId } = await params;
  const res = await load(playerId);
  if (!res?.ok || !res.data || res.data.isDemo) return { title: 'Joueur', robots: { index: false, follow: false } };
  return publicMetadata(res.data.profile.nickname,
    `Le profil de ${res.data.profile.nickname} sur LaFineEquipe : progression ELO FACEIT, derniers matchs, clips et crosshairs publiés.`,
    `/players/${encodeURIComponent(playerId)}`);
}

export default async function PlayerPage({ params }: Params) {
  const { playerId } = await params;
  const res = await load(playerId);
  if (!res || (res.ok && !res.data)) {
    notFound();
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
  const [matches, maps, history, clips, crosshairs] = await Promise.all([
    settle(getRecentMatches(10, player.id)),
    settle(getMapCovers()),
    settle(getEloHistory(player.id)),
    settle(getClips()),
    settle(getCrosshairs()),
  ]);
  // Ne transmettre au navigateur que les contenus publiés rattachés à ce joueur.
  const playerClips = clips.ok ? clips.data.filter((c) => c.published && c.player?.id === player.id) : [];
  const playerCrosshairs = crosshairs.ok
    ? crosshairs.data.filter((c) => c.published && c.player?.id === player.id)
    : [];
  const progression = progressionOf(player);

  return (
    <>
      <header className={`page-head ${styles.hero}`}>
        <Avatar src={p.avatarUrl} size={140} level={p.cs2Level} alt={`Avatar FACEIT de ${p.nickname}`} />
        <div className={styles.identity}>
          <Link href="/team" className="link">
            ← Tous les joueurs
          </Link>
          <p className="kicker">
            <Icon name="spk" className="spk" /> {player.group === 'team' ? 'Team' : 'Guest'}
            {player.active ? '' : ' · inactif'}
          </p>
          <h1 className="h1" style={{ overflowWrap: 'anywhere' }}>
            {p.nickname}
          </h1>
          <div className={styles.details}>
            <span>
              Niveau <Level level={p.cs2Level} />
            </span>
            <span className="num">
              {p.cs2Elo !== null ? `${fmtInt(p.cs2Elo)} ELO` : 'ELO CS2 non fourni par FACEIT'}
            </span>
            <ProfileFreshness
              fetchedAt={p.fetchedAt}
              lastError={p.lastError}
              lastAttemptAt={p.lastAttemptAt}
              staleAfterHours={6}
            />
            <FaceitLink nickname={p.nickname} isDemo={p.isDemo} label="Profil FACEIT" />
            {player.isDemo ? <DemoTag /> : null}
          </div>
        </div>
        <nav className={styles.jump} aria-label="Sur ce profil">
          <a className="btn btn-red btn-sm" href="#progression">
            Progression ELO
          </a>
          <a className="btn btn-steel btn-sm" href="#matchs">
            Matchs
          </a>
          <a className="btn btn-steel btn-sm" href="#clips">
            Clips{clips.ok ? ` · ${playerClips.length}` : ''}
          </a>
          <a className="btn btn-steel btn-sm" href="#crosshairs">
            Crosshairs{crosshairs.ok ? ` · ${playerCrosshairs.length}` : ''}
          </a>
        </nav>
      </header>

      <section className={`sec ${styles.section}`} aria-labelledby="run-h" id="progression">
        <div className="sec-h">
          <div>
            <p className="kicker">Depuis son ajout</p>
            <h2 className="h2" id="run-h">
              Progression ELO
            </h2>
          </div>
          <Link className="link" href="/elo-run">
            Classement complet →
          </Link>
        </div>
        {!player.active ? (
          <p className="muted">
            Joueur inactif : il ne figure plus au classement. Les relevés déjà enregistrés sont conservés.
          </p>
        ) : null}
        <div className={styles.overview}>
          <dl className={styles.numbers}>
            <div>
              <dt>ELO à l’ajout</dt>
              <dd>
                {player.addedElo !== null ? fmtInt(player.addedElo) : '—'}
                <small>{fmtDate(player.addedAt)}</small>
              </dd>
            </div>
            <div>
              <dt>Dernier ELO connu</dt>
              <dd>
                {p.cs2Elo !== null ? fmtInt(p.cs2Elo) : '—'}
                <small>
                  {p.isDemo ? 'Exemple fictif' : 'Source : FACEIT'}
                  <br />
                  {fmtDateTime(p.fetchedAt)}
                </small>
              </dd>
            </div>
            <div>
              <dt>Progression depuis l’ajout</dt>
              <dd>
                <Delta value={progression} />
                {progression === null ? <small>ELO de départ ou actuel indisponible</small> : null}
              </dd>
            </div>
          </dl>
          <div className={styles.chart}>
            <h3>Les relevés enregistrés</h3>
            {!history.ok ? (
              <StateBlock kind="error" title="Relevés momentanément indisponibles" />
            ) : history.data ? (
              <EloHistoryChart
                history={history.data}
                current={{ elo: p.cs2Elo, at: p.fetchedAt }}
                nickname={p.nickname}
                animate={false}
              />
            ) : (
              <p className="muted">Aucun relevé ELO enregistré pour ce joueur.</p>
            )}
          </div>
        </div>
      </section>

      <section className={`sec ${styles.section}`} aria-labelledby="m-h" id="matchs">
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

      <section className={`sec ${styles.section}`} aria-labelledby="clips-h" id="clips">
        <div className="sec-h">
          <h2 className="h2" id="clips-h">
            Ses clips
          </h2>
          <Link className="link" href={`/clips?player=${player.id}`}>
            Voir ses clips dans la bibliothèque →
          </Link>
        </div>
        {!clips.ok ? (
          <StateBlock kind="error" title="Clips momentanément indisponibles" />
        ) : playerClips.length ? (
          <ul className={clipStyles.grid}>
            {playerClips.slice(0, 3).map((c) => (
              <li key={c.id}>
                <ClipCard clip={c} headingLevel={3} cover={c.map ? mapCoverUrl(c.map) : null} />
              </li>
            ))}
          </ul>
        ) : (
          <StateBlock title="Aucun clip publié pour ce joueur">
            Ses highlights apparaîtront ici dès leur publication par la team.
          </StateBlock>
        )}
      </section>

      <section className={`sec ${styles.section}`} aria-labelledby="crosshairs-h" id="crosshairs">
        <div className="sec-h">
          <h2 className="h2" id="crosshairs-h">
            Ses crosshairs
          </h2>
          <Link className="link" href="/crosshairs">
            Tous les crosshairs →
          </Link>
        </div>
        {!crosshairs.ok ? (
          <StateBlock kind="error" title="Crosshairs momentanément indisponibles" />
        ) : playerCrosshairs.length ? (
          <ul className={crosshairStyles.grid}>
            {playerCrosshairs.map((c) => (
              <li key={c.id}>
                <CrosshairCard c={c} />
              </li>
            ))}
          </ul>
        ) : (
          <StateBlock title="Aucun crosshair publié pour ce joueur">
            Les presets ajoutés par l’admin seront consultables et copiables ici.
          </StateBlock>
        )}
      </section>
    </>
  );
}
