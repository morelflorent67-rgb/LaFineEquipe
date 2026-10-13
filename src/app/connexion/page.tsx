import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerEnv } from '@/lib/env';
import { getViewer } from '@/lib/auth/viewer';
import { getLocalPg } from '@/lib/db/local-pg';
import { localSignInAction, signOutAction } from '@/app/actions/auth';
import { Icon } from '@/components/ui/Icon';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = { title: 'Connexion team', robots: { index: false, follow: false } };

const roleLabel = { admin: 'Administrateur', member: 'Membre', visitor: 'Aucun rôle (accès visiteur)' } as const;

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const suite = typeof sp.suite === 'string' && sp.suite.startsWith('/') && !sp.suite.startsWith('//') ? sp.suite : '/';
  const env = getServerEnv();
  const viewer = await getViewer();

  let localAccounts: { id: string; email: string; role: string | null; display_name: string | null }[] = [];
  if (env.backend === 'local') {
    const pg = await getLocalPg();
    localAccounts = (
      await pg.query<{ id: string; email: string; role: string | null; display_name: string | null }>(
        `select u.id::text, u.email, p.role, p.display_name from auth.users u
           left join public.profiles p on p.user_id = u.id order by u.email`,
      )
    ).rows;
  }

  return (
    <>
      <header className="page-head">
        <p className="kicker">
          <Icon name="spk" className="spk" /> Espace team
        </p>
        <h1 className="h1">Connexion</h1>
        <p className="lede">
          Réservée aux membres et administrateurs de LaFineEquipe. Les visiteurs peuvent consulter tout le reste du site
          sans compte.
        </p>
      </header>
      <section className="sec" style={{ display: 'grid', gap: 24 }}>
        {viewer.signedIn ? (
          <div className="state">
            <strong>Connecté : {viewer.label}</strong>
            <span>Rôle : {roleLabel[viewer.role]}</span>
            {viewer.role === 'visitor' ? (
              <span>Ce compte n’a pas encore été autorisé par un administrateur : il voit le site comme un visiteur.</span>
            ) : null}
            <div className="actions">
              <Link className="btn btn-steel btn-sm" href={suite}>
                Continuer
              </Link>
              <form action={signOutAction}>
                <button className="btn btn-ghost btn-sm" type="submit">
                  Se déconnecter
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {env.backend === 'local' ? (
          <div className="state unavailable">
            <strong>Mode local : comptes de test</strong>
            <span>
              Sans Supabase, la connexion utilise ces comptes fictifs de la base locale (aucun mot de passe). Ce choix
              n’existe pas en ligne.
            </span>
            <div className="actions">
              {localAccounts.map((a) => (
                <form key={a.id} action={localSignInAction}>
                  <input type="hidden" name="userId" value={a.id} />
                  <input type="hidden" name="suite" value={suite} />
                  <button className="btn btn-steel btn-sm" type="submit">
                    {a.display_name ?? a.email} · {a.role ? roleLabel[a.role as 'admin' | 'member'] : 'sans rôle'}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : (
          <SignInForm suite={suite} />
        )}
      </section>
    </>
  );
}
