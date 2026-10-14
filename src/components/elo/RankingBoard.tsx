'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag, Delta, Level, Series } from '@/components/ui/badges';
import { FaceitLink } from '@/components/ui/FaceitLink';
import { Icon } from '@/components/ui/Icon';
import { useFlip } from '@/components/ui/useFlip';
import type { EloHistory, Player, RecentResult } from '@/lib/domain/schemas';
import { eloHistorySchema } from '@/lib/domain/schemas';
import { faceitProfileUrl } from '@/lib/faceit/input';
import { rankingRows, type BoardRow, type GroupFilter } from '@/lib/elo/board';
import { rankMoves, type RankMode } from '@/lib/elo/ranking';
import { fmtDateTime, fmtInt, fmtShortDate, mapLabel } from '@/lib/format';
import { EloHistoryChart } from './EloHistoryChart';
import styles from './elo.module.css';

const GROUPS: { value: GroupFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'team', label: 'Team' },
  { value: 'guest', label: 'Guests' },
];

const seriesOf = (results: RecentResult[] | undefined) =>
  (results ?? []).map((r) => ({
    result: r.result,
    detail: [mapLabel(null, r.mapName), r.at ? fmtShortDate(r.at) : null].filter(Boolean).join(' · '),
  }));

/**
 * Classement permanent : podium, tableau détaillé et courbe pilotés par le MÊME état
 * (tri, filtre, joueur sélectionné). Quand de nouvelles données arrivent (synchro), les lignes
 * glissent vers leur nouveau rang, les ELO modifiés sont surlignés et les places gagnées indiquées.
 */
export function RankingBoard({
  players,
  results,
  initialHistory,
}: {
  players: Player[];
  results: Record<string, RecentResult[]>;
  initialHistory: EloHistory | null;
}) {
  const [mode, setMode] = useState<RankMode>('elo');
  const [group, setGroup] = useState<GroupFilter>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, EloHistory | 'error'>>(() =>
    initialHistory ? { [initialHistory.playerId]: initialHistory } : {},
  );
  const [highlights, setHighlights] = useState<{ changed: Set<string>; moves: Map<string, number> }>(() => ({ changed: new Set(), moves: new Map() }));
  const [drawn, setDrawn] = useState(false);

  const rows = useMemo(() => rankingRows(players, mode, group), [players, mode, group]);
  const counts = useMemo(() => {
    const active = players.filter((p) => p.active);
    return { all: active.length, team: active.filter((p) => p.group === 'team').length, guest: active.filter((p) => p.group === 'guest').length };
  }, [players]);

  // Nouvelles données (synchro, actualisation) : valeurs modifiées et déplacements de rang.
  const previous = useRef<{ elo: Map<string, number | null>; rank: Map<string, number | null> } | null>(null);
  useEffect(() => {
    const elo = new Map(players.map((p) => [p.id, p.profile.cs2Elo]));
    const byElo = rankingRows(players, 'elo');
    const rank = new Map(byElo.map((r) => [r.playerId, r.rank]));
    const before = previous.current;
    previous.current = { elo, rank };
    if (!before) return;
    const changed = new Set([...elo].filter(([id, v]) => before.elo.has(id) && before.elo.get(id) !== v).map(([id]) => id));
    const moves = rankMoves(before.rank, byElo);
    if (changed.size === 0 && moves.size === 0) return;
    const show = setTimeout(() => setHighlights({ changed, moves }), 0);
    const hide = setTimeout(() => setHighlights({ changed: new Set(), moves: new Map() }), 6000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [players]);

  const selectedId = rows.some((r) => r.playerId === picked) ? picked : (rows[0]?.playerId ?? null);
  const selected = rows.find((r) => r.playerId === selectedId) ?? null;
  const history = selectedId ? histories[selectedId] : undefined;

  // Historique du joueur sélectionné, chargé à la demande (lecture de la base uniquement).
  useEffect(() => {
    if (!selectedId || histories[selectedId]) return;
    let cancelled = false;
    fetch(`/api/elo/history/${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: unknown) => {
        const parsed = eloHistorySchema.safeParse(json);
        if (!cancelled) setHistories((h) => ({ ...h, [selectedId]: parsed.success && parsed.data ? parsed.data : 'error' }));
      })
      .catch(() => {
        if (!cancelled) setHistories((h) => ({ ...h, [selectedId]: 'error' }));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, histories]);

  const listRef = useRef<HTMLOListElement>(null);
  const podiumRef = useRef<HTMLOListElement>(null);
  const order = rows.map((r) => r.playerId).join('|');
  useFlip(listRef, [order]);
  useFlip(podiumRef, [order]);

  const podium = rows.filter((r) => r.rank !== null).slice(0, 3);
  const valueLabel = mode === 'elo' ? 'ELO actuel' : 'progression depuis l’ajout';

  const select = (id: string) => {
    setPicked(id);
    setDrawn(true);
  };

  return (
    <>
      <div className={styles.controls} role="group" aria-label="Tri et filtre du classement">
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel} id="sort-l">
            Trier par
          </span>
          <div className="seg" role="group" aria-labelledby="sort-l">
            <button type="button" aria-pressed={mode === 'elo'} onClick={() => setMode('elo')}>
              ELO actuel
            </button>
            <button type="button" aria-pressed={mode === 'delta'} onClick={() => setMode('delta')}>
              Progression
            </button>
          </div>
        </div>
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel} id="group-l">
            Afficher
          </span>
          <div className="seg" role="group" aria-labelledby="group-l">
            {GROUPS.map((g) => (
              <button key={g.value} type="button" aria-pressed={group === g.value} onClick={() => setGroup(g.value)}>
                {g.label} <span className="count">{counts[g.value]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.wrap}>
          <p className="state">
            <strong>Aucun joueur dans ce groupe</strong>
            <span>Choisis « Tous » pour voir l’ensemble du classement.</span>
          </p>
        </div>
      ) : (
        <>
          <div className={styles.podwrap}>
            <ol className={styles.podium} ref={podiumRef} aria-label={`Podium (${valueLabel})`}>
              {podium.map((r, i) => (
                <li key={r.playerId} data-key={r.playerId} className={`${styles.pod} ${styles[`p${i + 1}` as 'p1' | 'p2' | 'p3']}`}>
                  <button type="button" className={styles.podBtn} onClick={() => select(r.playerId)} aria-label={`${r.nickname}, rang ${r.rank}. Afficher sa courbe.`}>
                    <span className={styles.rk} aria-hidden="true">
                      {r.rank}
                    </span>
                    {r.group === 'guest' ? <span className={`tag ${styles.podTag}`}>Guest</span> : null}
                    <Avatar src={r.avatarUrl} size={i === 0 ? 112 : 86} level={r.level} />
                    <Level level={r.level} />
                    <span className={styles.nm}>{r.nickname}</span>
                    {mode === 'elo' ? (
                      <>
                        <span className={`${styles.val} num`}>
                          {r.currentElo !== null ? fmtInt(r.currentElo) : '—'}
                          <span className={styles.unit}>ELO</span>
                        </span>
                        <span className={styles.sub}>
                          <Delta value={r.delta} /> <span className="muted">depuis l’ajout</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.val}>
                          <Delta value={r.delta} />
                        </span>
                        <span className={styles.sub}>
                          <b className="num">{r.currentElo !== null ? `${fmtInt(r.currentElo)} ELO` : '—'}</b>
                          <span className="muted">· ajouté à {r.addedElo !== null ? fmtInt(r.addedElo) : '—'}</span>
                        </span>
                      </>
                    )}
                    <Series results={seriesOf(results[r.playerId])} />
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.wrap}>
            <section className={styles.board} aria-labelledby="classement-h">
              <h2 className="sr-only-focusable" id="classement-h">
                Classement détaillé
              </h2>
              <div className={`${styles.row} ${styles.head}`} aria-hidden="true">
                <span>Rang</span>
                <span />
                <span>Joueur</span>
                <span>Niv.</span>
                <span className={styles.r}>ELO</span>
                <span className={styles.r}>Progression</span>
                <span>5 derniers</span>
                <span />
              </div>
              <ol className={styles.rows} ref={listRef}>
                {rows.map((r) => (
                  <BoardLine
                    key={r.playerId}
                    row={r}
                    selected={r.playerId === selectedId}
                    changed={highlights.changed.has(r.playerId)}
                    move={highlights.moves.get(r.playerId) ?? 0}
                    results={results[r.playerId]}
                    onSelect={() => select(r.playerId)}
                  />
                ))}
              </ol>
              <div className={styles.boardFoot}>
                <span>
                  {rows.length} joueur{rows.length > 1 ? 's' : ''} classé{rows.length > 1 ? 's' : ''} · rang selon {valueLabel}
                </span>
                <span>Progression = ELO actuel − ELO relevé à l’ajout</span>
              </div>
            </section>

            <section className={styles.chartCard} aria-labelledby="courbe-h" id="courbe">
              {selected ? (
                <>
                  <div className={styles.ccHead}>
                    <Avatar src={selected.avatarUrl} size={56} level={selected.level} />
                    <div style={{ minWidth: 0 }}>
                      <h2 className={styles.ccName} id="courbe-h">
                        <Link href={`/players/${selected.playerId}`}>{selected.nickname}</Link>
                      </h2>
                      <p className={styles.ccLine}>
                        <Level level={selected.level} />
                        <b className="num">{selected.currentElo !== null ? `${fmtInt(selected.currentElo)} ELO` : 'ELO non fourni'}</b>
                        <Delta value={selected.delta} />
                        <FaceitLink nickname={selected.nickname} isDemo={selected.isDemo} label="Profil FACEIT" />
                        {selected.isDemo ? <DemoTag /> : null}
                      </p>
                    </div>
                  </div>
                  <dl className={styles.ccStats}>
                    <div>
                      <dt>Ajouté le</dt>
                      <dd>{fmtShortDate(selected.addedAt)}</dd>
                    </div>
                    <div>
                      <dt>ELO à l’ajout</dt>
                      <dd className="num">{selected.addedElo !== null ? fmtInt(selected.addedElo) : 'en attente'}</dd>
                    </div>
                    <div>
                      <dt>Dernier relevé</dt>
                      <dd>{fmtDateTime(selected.currentAt)}</dd>
                    </div>
                  </dl>
                  {history === undefined ? (
                    <p className={styles.chartEmpty}>Chargement des relevés…</p>
                  ) : history === 'error' ? (
                    <p className={styles.chartEmpty}>Relevés momentanément indisponibles.</p>
                  ) : (
                    <EloHistoryChart
                      history={history}
                      current={{ elo: selected.currentElo, at: selected.currentAt }}
                      nickname={selected.nickname}
                      animate={drawn}
                    />
                  )}
                  <a className={`link ${styles.back}`} href="#classement-h">
                    Retour au classement
                  </a>
                </>
              ) : null}
            </section>
          </div>
        </>
      )}
    </>
  );
}

function BoardLine({
  row: r,
  selected,
  changed,
  move,
  results,
  onSelect,
}: {
  row: BoardRow;
  selected: boolean;
  changed: boolean;
  move: number;
  results: RecentResult[] | undefined;
  onSelect: () => void;
}) {
  const failed = r.lastError !== null;
  return (
    <li className={`${styles.row} ${selected ? styles.sel : ''}`} data-key={r.playerId}>
      <span className={styles.rk}>
        {r.rank ?? '–'}
        {move !== 0 ? (
          <span className={`${styles.mv} ${move > 0 ? styles.mvUp : styles.mvDown}`} aria-label={move > 0 ? `gagne ${move} place${move > 1 ? 's' : ''}` : `perd ${-move} place${move < -1 ? 's' : ''}`}>
            {move > 0 ? `▲${move}` : `▼${-move}`}
          </span>
        ) : null}
      </span>
      <Avatar src={r.avatarUrl} size={42} level={r.level} />
      <span className={styles.who}>
        <button type="button" className={styles.nmBtn} aria-pressed={selected} onClick={onSelect}>
          {r.nickname}
        </button>
        <span className={styles.meta}>
          <span className="tag">{r.group === 'team' ? 'Team' : 'Guest'}</span>
          <span className={styles.added}>
            ajouté le {fmtShortDate(r.addedAt)}
            {r.addedElo !== null ? ` à ${fmtInt(r.addedElo)}` : ''}
          </span>
          {failed ? (
            <span className="chip stale" title={r.lastAttemptAt ? `Dernière tentative ${fmtDateTime(r.lastAttemptAt)}` : undefined}>
              Valeur du {fmtShortDate(r.currentAt)}
            </span>
          ) : null}
        </span>
      </span>
      <span className={styles.lvl}>
        <Level level={r.level} />
      </span>
      <span className={`${styles.elo} num ${changed ? styles.bump : ''}`} title={`Relevé du ${fmtDateTime(r.currentAt)}`}>
        {r.currentElo !== null ? fmtInt(r.currentElo) : '—'}
      </span>
      <span className={`${styles.r} ${styles.dl}`}>
        <Delta value={r.delta} />
      </span>
      <span className={styles.ser}>
        <Series results={seriesOf(results)} />
      </span>
      <span className={styles.fl}>
        {r.isDemo ? (
          <span className={`${styles.flLink} ${styles.flOff}`} title="Profil fictif : aucun lien FACEIT">
            <Icon name="ext" />
            <span className="sr-only-focusable">Profil fictif, pas de lien FACEIT</span>
          </span>
        ) : (
          <a className={styles.flLink} href={faceitProfileUrl(r.nickname)} target="_blank" rel="noopener noreferrer" aria-label={`Profil FACEIT de ${r.nickname} (nouvel onglet)`}>
            <Icon name="ext" />
          </a>
        )}
      </span>
    </li>
  );
}
