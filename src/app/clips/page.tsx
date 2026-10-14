import Link from 'next/link';
import { publicMetadata } from '@/lib/seo';
import { ClipCard } from '@/components/clips/ClipCard';
import styles from '@/components/clips/clips.module.css';
import { StateBlock } from '@/components/ui/badges';
import { getClips, settle } from '@/lib/data/queries';
import { getViewer } from '@/lib/auth/viewer';
import { mapCoverUrl } from '@/lib/media';

export const metadata = publicMetadata('Clips', 'Les highlights publiés par LaFineEquipe : retrouve les clips de la team par joueur, map et date.', '/clips');

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, res, viewer] = await Promise.all([searchParams, settle(getClips()), getViewer()]);
  const param = (k: string) => (typeof query[k] === 'string' ? (query[k] as string) : '');
  const all = res.ok ? res.data : [];
  const q = param('q').slice(0, 100),
    player = param('player'),
    map = param('map');
  const from = /^\d{4}-\d{2}-\d{2}$/.test(param('from')) ? param('from') : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(param('to')) ? param('to') : '';
  const oldest = param('sort') === 'oldest';
  const filtered = all.filter(
    (c) =>
      (!q ||
        `${c.title} ${c.player?.nickname ?? ''}`
          .toLocaleLowerCase('fr')
          .includes(q.toLocaleLowerCase('fr'))) &&
      (!player || c.player?.id === player) &&
      (!map || c.map?.slug === map) &&
      (!from || c.recordedOn >= from) &&
      (!to || c.recordedOn <= to),
  );
  if (oldest) filtered.reverse();
  const players = [
    ...new Map(all.flatMap((c) => (c.player ? [[c.player.id, c.player.nickname] as const] : []))).entries(),
  ];
  const maps = [...new Map(all.flatMap((c) => (c.map ? [[c.map.slug, c.map.name] as const] : []))).entries()];
  return (
    <>
      <header className={`page-head ${styles.intro}`}>
        <div>
          <p className="kicker">La mémoire des rounds</p>
          <h1 className="h1">
            Les clips de la team<span className="ember">.</span>
          </h1>
          <p className="lede">Les beaux gestes, les sauvetages improbables et les rounds qu’on se repasse.</p>
        </div>
        <div className={styles.count}>
          {all.length}
          <small>clips publiés</small>
        </div>
      </header>
      <section className="sec" aria-label="Bibliothèque de clips">
        <div className="sec-h">
          <p className="mono">YouTube · Twitch · Allstar</p>
          {viewer.role === 'admin' ? (
            <Link href="/admin/clips" className="btn btn-steel btn-sm">
              Gérer les clips
            </Link>
          ) : null}
        </div>
        {!res.ok ? (
          <StateBlock kind="error" title="Clips momentanément indisponibles" />
        ) : all.length === 0 ? (
          <div className={styles.empty}>
            <p className="kicker">La prochaine action mérite sa place ici</p>
            <h2>Le premier highlight reste à partager.</h2>
            <p>
              Les clips publiés par la team apparaîtront ici, avec leur joueur, leur map et un lien vers la
              vidéo originale.
            </p>
            {viewer.role === 'admin' ? (
              <Link href="/admin/clips/nouveau" className="btn btn-red">
                Ajouter le premier clip
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <form className={styles.filters} action="/clips" key={JSON.stringify(query)}>
              <label>
                Rechercher
                <input
                  name="q"
                  className="input"
                  defaultValue={q}
                  maxLength={100}
                  placeholder="Titre ou pseudo"
                />
              </label>
              <label>
                Joueur
                <select name="player" className="select" defaultValue={player}>
                  <option value="">Tous les joueurs</option>
                  {players.map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Map
                <select name="map" className="select" defaultValue={map}>
                  <option value="">Toutes les maps</option>
                  {maps.map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Depuis le
                <input name="from" type="date" className="input" defaultValue={from} />
              </label>
              <label>
                Jusqu’au
                <input name="to" type="date" className="input" defaultValue={to} />
              </label>
              <label>
                Ordre
                <select name="sort" className="select" defaultValue={oldest ? 'oldest' : 'newest'}>
                  <option value="newest">Plus récents</option>
                  <option value="oldest">Plus anciens</option>
                </select>
              </label>
              <button className="btn btn-red btn-sm">Filtrer</button>
              <Link href="/clips" className="btn btn-ghost btn-sm">
                Réinitialiser
              </Link>
            </form>
            <p className="mono" role="status">
              {filtered.length} clip{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
            </p>
            {filtered.length ? (
              <ul className={`${styles.grid} ${styles.featured}`}>
                {filtered.map((c) => (
                  <li key={c.id}>
                    <ClipCard clip={c} cover={c.map ? mapCoverUrl(c.map) : null} />
                  </li>
                ))}
              </ul>
            ) : (
              <StateBlock title="Aucun clip pour ces filtres">
                Essaie une autre map, un autre joueur ou une période plus large.
              </StateBlock>
            )}
          </>
        )}
      </section>
    </>
  );
}
