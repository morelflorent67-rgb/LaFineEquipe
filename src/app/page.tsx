import Link from 'next/link';
import type { CSSProperties } from 'react';
import { HeroParallax } from '@/components/home/HeroParallax';
import { MatchList, teamResult } from '@/components/match/MatchList';
import { liveSummary } from '@/components/match/LiveStatus';
import { Avatar } from '@/components/ui/Avatar';
import { Delta, ResultBadge, StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getLiveStateRow, getMapCovers, getMaps, getRecentMatches, getRefreshStatus, getRoster, settle } from '@/lib/data/queries';
import { deriveLiveState } from '@/lib/domain/live';
import type { MapInfo, Match } from '@/lib/domain/schemas';
import { rankingRows } from '@/lib/elo/board';
import { faceitProfileUrl } from '@/lib/faceit/input';
import { fmtAgo, fmtInt, mapLabel, pluralize } from '@/lib/format';
import { mapCoverUrl } from '@/lib/media';
import styles from './home.module.css';

const rv = (i: number) => ({ 'data-rv': '', style: { '--i': i } as CSSProperties });

export default async function HomePage() {
  const [liveRow, matchesRes, rosterRes, mapsRes, refreshRes, coversRes] = await Promise.all([
    settle(getLiveStateRow()),
    settle(getRecentMatches(8)),
    settle(getRoster()),
    settle(getMaps()),
    settle(getRefreshStatus()),
    settle(getMapCovers()),
  ]);
  const live = liveRow.ok ? deriveLiveState(liveRow.data) : null;
  const roster = rosterRes.ok ? rosterRes.data : [];
  const board = rankingRows(roster, 'elo');
  const leader = board.find((r) => r.rank === 1) ?? null;
  const matches = matchesRes.ok ? matchesRes.data : [];
  const maps = mapsRes.ok ? mapsRes.data : [];
  const covers = coversRes.ok ? coversRes.data : {};
  const totalStuffs = maps.reduce((n, m) => n + m.counts.total, 0);
  const lastSync = refreshRes.ok ? refreshRes.data.lastOkAt : null;
  const lastMatch = matches[0];
  const lastResult = lastMatch ? teamResult(lastMatch) : 'unknown';
  const lastAt = lastMatch ? (lastMatch.finishedAt ?? lastMatch.startedAt) : null;
  const lastCover = lastMatch?.mapKey ? covers[lastMatch.mapKey] : undefined;
  const lastScore = lastMatch ? scoreOf(lastMatch) : null;
  const stripCovers = maps.map((m) => mapCoverUrl(m)).filter((u): u is string => Boolean(u)).slice(0, 4);

  return (
    <>
      <HeroParallax className={styles.hero} labelledBy="hero-h">
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.shards} aria-hidden="true">
          <span className={styles.s3} />
          <span className={styles.s1} />
          <span className={styles.s2} />
        </div>
        <div className={styles.copy}>
          <p className={`kicker ${styles.kicker}`}>
            <Icon name="spk" className="spk" /> Team CS2 · FACEIT
          </p>
          <h1 className={`display ${styles.title}`} id="hero-h">
            <span className={styles.ln}>
              <span className="metal">La Fine</span>
            </span>{' '}
            <span className={styles.ln}>
              <span className="ember">Equipe</span>
            </span>
          </h1>
          <p className={styles.lede}>
            Le QG de la team : <strong>classement ELO permanent</strong>, matchs FACEIT et <strong>stuffs map par map</strong>.
          </p>
          <div className={styles.ctas}>
            <Link className="btn btn-red" href="/elo-run">
              Classement ELO <Icon name="arrow" className="arrow" />
            </Link>
            <Link className={`btn btn-steel ${styles.ctaAlt}`} href="/stuffs">
              Stuffs par map
            </Link>
          </div>
        </div>
        <div className={styles.emblemWrap} aria-hidden="true">
          <div className={styles.emblem}>
            <span className={styles.ring} />
            <span className={`${styles.ring} ${styles.r2}`} />
            {/* Logo détaillé original (héros/branding). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lfe-emblem.webp" alt="" width={500} height={500} />
            <span className={styles.sweep} />
          </div>
        </div>

        <nav className={styles.prio} aria-label="Accès prioritaires">
          {live?.kind === 'live' || live?.kind === 'none' ? (
            <Link className={`${styles.pt} ${styles.ptLive}`} href="/matches#en-cours" style={{ '--i': 0 } as CSSProperties}>
              <span className={styles.t}>
                <span className={styles.lbl}>Matchs en cours</span>
                <span className={styles.main}>
                  {live.kind === 'live' ? (
                    <span className="live">
                      <span className="dot" aria-hidden="true" /> Live
                    </span>
                  ) : null}
                  <span>{liveSummary(live).title}</span>
                </span>
                <span className={styles.sub}>{liveSummary(live).detail}</span>
              </span>
              <Icon name="arrow" className={styles.go} />
            </Link>
          ) : (
            <Link className={`${styles.pt} ${styles.ptLive}`} href="#derniers-matchs" style={{ '--i': 0 } as CSSProperties}>
              {lastCover ? (
                <span className={styles.ptBg} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lastCover} alt="" />
                </span>
              ) : null}
              <span className={styles.t}>
                <span className={styles.lbl}>Dernier match{lastAt ? ` · ${fmtAgo(lastAt)}` : ''}</span>
                {lastMatch ? (
                  <>
                    <span className={styles.main}>
                      {lastResult !== 'mixed' ? <ResultBadge result={lastResult} large /> : null}
                      <span className={styles.big}>{mapLabel(lastMatch.mapKey, lastMatch.mapName) ?? 'Map inconnue'}</span>
                      {lastScore ? (
                        <span className={styles.score}>
                          {lastScore.us}
                          <i>–</i>
                          {lastScore.them}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.who}>
                      {lastMatch.players.slice(0, 5).map((p) => (
                        <Avatar key={p.playerId} src={p.avatarUrl} size={24} />
                      ))}
                      <span>{lastMatch.players.map((p) => p.nickname).join(', ')}</span>
                    </span>
                  </>
                ) : (
                  <span className={styles.main}>
                    <span>{matchesRes.ok ? 'Aucun match récent' : 'Matchs indisponibles'}</span>
                  </span>
                )}
              </span>
              <Icon name="arrow" className={styles.go} />
            </Link>
          )}
          <Link className={`${styles.pt} ${styles.ptElo}`} href="/elo-run" style={{ '--i': 1 } as CSSProperties}>
            <span className={styles.rankMark} aria-hidden="true">
              1
            </span>
            <span className={styles.t}>
              <span className={styles.lbl}>ELO Run · n°1{lastSync ? ` · synchro ${fmtAgo(lastSync)}` : ''}</span>
              {leader ? (
                <>
                  <span className={styles.main}>
                    <Avatar src={leader.avatarUrl} size={40} level={leader.level} />
                    <span className={styles.big}>{leader.nickname}</span>
                  </span>
                  <span className={styles.sub}>
                    <b className={styles.eloBig}>{leader.currentElo !== null ? fmtInt(leader.currentElo) : '—'}</b>
                    <span>ELO</span>
                    <Delta value={leader.delta} />
                    <span>depuis l’ajout</span>
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.main}>
                    <span>Pas encore de classement</span>
                  </span>
                  <span className={styles.sub}>Aucun joueur ajouté</span>
                </>
              )}
            </span>
            <Icon name="arrow" className={styles.go} />
          </Link>
          <Link className={`${styles.pt} ${styles.ptStuffs}`} href="/stuffs" style={{ '--i': 2 } as CSSProperties}>
            <span className={styles.ptStrip} aria-hidden="true">
              {stripCovers.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" />
              ))}
            </span>
            <span className={styles.t}>
              <span className={styles.lbl}>Stuffs · carte tactique</span>
              <span className={styles.main}>
                <span className={styles.big}>{pluralize(maps.length, 'map', 'maps')}</span>
              </span>
              <span className={styles.sub}>
                <b className={styles.num}>{pluralize(totalStuffs, 'lineup publié', 'lineups publiés')}</b>
                <span>· smoke, flash, molotov, HE</span>
              </span>
            </span>
            <Icon name="arrow" className={styles.go} />
          </Link>
        </nav>
      </HeroParallax>

      <section className={`sec ${styles.now}`} id="derniers-matchs" aria-labelledby="matchs-h">
        <div className="sec-h">
          <div>
            <p className="kicker" {...rv(0)}>
              <Icon name="spk" className="spk" /> FACEIT
            </p>
            <h2 className="h2" id="matchs-h" {...rv(1)}>
              Derniers matchs
            </h2>
          </div>
          <span className="mono" {...rv(2)}>
            Un match = une ligne, même à plusieurs joueurs suivis
          </span>
        </div>
        <div className={styles.results}>
          {!matchesRes.ok ? (
            <StateBlock kind="error" title="Matchs momentanément indisponibles" />
          ) : matches.length === 0 ? (
            <StateBlock title="Aucun match enregistré">
              Les matchs terminés des joueurs suivis apparaîtront après la prochaine synchronisation FACEIT.
            </StateBlock>
          ) : (
            <MatchList matches={matches.slice(0, 5)} covers={covers} />
          )}
          <Link className="link" href="/matches" style={{ marginTop: 16 }}>
            Tous les matchs <Icon name="arrow" className="arrow" />
          </Link>
        </div>
      </section>

      <section className={`sec ${styles.run}`} aria-labelledby="run-h">
        <p className={styles.backword} aria-hidden="true">
          ELO
        </p>
        <div className={styles.runGrid}>
          <div>
            <p className="kicker" {...rv(0)}>
              <Icon name="spk" className="spk" /> ELO Run · classement permanent
            </p>
            <h2 className="h2" id="run-h" {...rv(1)}>
              Qui est devant ?
            </h2>
            <p className={styles.runLede} {...rv(2)}>
              Pas de saison ni de remise à zéro. Chaque joueur entre au classement à son vrai ELO FACEIT dès que l’admin
              l’ajoute, avec une progression qui démarre à zéro.
            </p>
            <div className={styles.runMeta} {...rv(3)}>
              <span>
                Dernière synchro : <b>{lastSync ? fmtAgo(lastSync) : 'jamais'}</b>
              </span>
              <span>Synchronisation planifiée toutes les 5 min</span>
              <span>{pluralize(board.length, 'joueur classé', 'joueurs classés')}</span>
            </div>
            <div {...rv(4)}>
              <Link className="btn btn-red" href="/elo-run" style={{ marginTop: 28 }}>
                Classement complet <Icon name="arrow" className="arrow" />
              </Link>
            </div>
          </div>
          {!rosterRes.ok ? (
            <StateBlock kind="error" title="Classement momentanément indisponible" />
          ) : board.length === 0 ? (
            <StateBlock title="Personne au classement pour l’instant">Les joueurs ajoutés par l’admin y entrent à leur ELO actuel.</StateBlock>
          ) : (
            <ol className={styles.mini} aria-label="Top 5 par ELO actuel">
              {board.slice(0, 5).map((r, i) => (
                <li key={r.playerId} {...rv(i)}>
                  <span className={styles.rk}>{r.rank ?? '–'}</span>
                  <Avatar src={r.avatarUrl} size={i === 0 ? 46 : 40} level={r.level} />
                  <Link className={styles.nm} href={`/players/${r.playerId}`}>
                    {r.nickname}
                  </Link>
                  <span className={styles.elo}>{r.currentElo !== null ? fmtInt(r.currentElo) : '—'}</span>
                  <span className={styles.dl}>
                    <Delta value={r.delta} />
                  </span>
                  {r.isDemo ? (
                    <span className={styles.fc} aria-hidden="true" />
                  ) : (
                    <a
                      className={styles.fc}
                      href={faceitProfileUrl(r.nickname)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Profil FACEIT de ${r.nickname} (nouvel onglet)`}
                    >
                      <Icon name="ext" />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="sec" aria-labelledby="stuffs-h">
        <div className="sec-h">
          <div>
            <p className="kicker" {...rv(0)}>
              <Icon name="spk" className="spk" /> {pluralize(totalStuffs, 'fiche publiée', 'fiches publiées')}
            </p>
            <h2 className="h2" id="stuffs-h" {...rv(1)}>
              Stuffs par map
            </h2>
          </div>
          <Link className="link" href="/stuffs">
            Toutes les maps <Icon name="arrow" className="arrow" />
          </Link>
        </div>
        {!mapsRes.ok ? (
          <StateBlock kind="error" title="Maps momentanément indisponibles" />
        ) : (
          <ul className={styles.maps}>
            {maps.map((m, i) => (
              <li key={m.slug} {...rv(i % 4)}>
                <MapCard map={m} />
              </li>
            ))}
          </ul>
        )}
        <p className="mono" style={{ marginTop: 14 }}>
          Compteurs calculés à partir des fiches publiées.
        </p>
      </section>
    </>
  );
}

/** Score « nous – eux » du point de vue des joueurs suivis, seulement s'il a été fourni par FACEIT. */
function scoreOf(m: Match): { us: number; them: number } | null {
  const f = m.players[0]?.faction;
  if (!m.score || (f !== 'faction1' && f !== 'faction2')) return null;
  const us = m.score[f];
  const them = m.score[f === 'faction1' ? 'faction2' : 'faction1'];
  return typeof us === 'number' && typeof them === 'number' ? { us, them } : null;
}

function MapCard({ map }: { map: MapInfo }) {
  const cover = mapCoverUrl(map);
  return (
    <Link className={styles.mcard} href={`/stuffs/${map.slug}`}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" loading="lazy" decoding="async" style={{ viewTransitionName: `map-${map.slug}` }} />
      ) : null}
      <span className={styles.cap}>
        <span className={styles.mname}>{map.name}</span>
        <span className={styles.ct}>{map.counts.total === 0 ? 'Aucun stuff' : pluralize(map.counts.total, 'stuff', 'stuffs')}</span>
      </span>
      <span className={styles.bar} />
    </Link>
  );
}
