import type { Metadata, Viewport } from 'next';
import { Archivo, Martian_Mono } from 'next/font/google';
import { MobileTabBar, SiteNav, type NavLive, type NavViewer } from '@/components/site/SiteNav';
import { SiteFooter } from '@/components/site/SiteFooter';
import { RevealObserver } from '@/components/ui/Reveal';
import { ToastProvider } from '@/components/ui/Toaster';
import { ConfigError, getServerEnv } from '@/lib/env';
import { getViewer } from '@/lib/auth/viewer';
import { getLiveStateRow, settle } from '@/lib/data/queries';
import { deriveLiveState } from '@/lib/domain/live';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const martian = Martian_Mono({ subsets: ['latin'], variable: '--font-martian', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'LaFineEquipe', template: '%s · LaFineEquipe' },
  description: 'Le QG de LaFineEquipe : ELO Run FACEIT, matchs, stuffs CS2 et la team.',
};

export const viewport: Viewport = {
  themeColor: '#050505',
  colorScheme: 'dark',
};

async function loadShell(): Promise<
  | { ok: true; viewer: NavViewer; live: NavLive; backend: 'local' | 'supabase'; fixtures: boolean }
  | { ok: false; message: string }
> {
  try {
    const env = getServerEnv();
    const viewer = await getViewer();
    const row = await settle(getLiveStateRow());
    let live: NavLive = { kind: 'error', count: 0 };
    if (row.ok) {
      const state = deriveLiveState(row.data);
      live = { kind: state.kind, count: state.kind === 'live' ? state.matches.length : 0 };
    }
    return {
      ok: true,
      viewer: { role: viewer.role, signedIn: viewer.signedIn, label: viewer.label },
      live,
      backend: env.backend,
      fixtures: env.faceit.mode === 'fixtures',
    };
  } catch (err) {
    if (err instanceof ConfigError) return { ok: false, message: err.message };
    throw err;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShell();
  return (
    <html lang="fr" className={`${archivo.variable} ${martian.variable}`}>
      <body>
        <a className="skip-link sr-only-focusable" href="#contenu">
          Aller au contenu
        </a>
        <ToastProvider>
          <div className="site">
            {shell.ok ? (
              <>
                {shell.backend === 'local' ? (
                  <p className="ribbon" role="note">
                    <span>Mode local de développement : données stockées sur ce PC (dossier .data), pas sur Supabase.</span>
                    {shell.fixtures ? <span>FACEIT simulé : profils fictifs « demo_… », aucun appel réel.</span> : null}
                  </p>
                ) : null}
                <SiteNav viewer={shell.viewer} live={shell.live} />
                <main id="contenu" tabIndex={-1}>
                  {children}
                </main>
                <SiteFooter signedIn={shell.viewer.signedIn} isAdmin={shell.viewer.role === 'admin'} />
                <MobileTabBar viewer={shell.viewer} live={shell.live} />
                <RevealObserver />
              </>
            ) : (
              <main id="contenu" className="sec">
                <div className="state error">
                  <strong>Configuration incomplète</strong>
                  <p>{shell.message}</p>
                  <p>
                    Copie <code>.env.example</code> en <code>.env.local</code>, complète-le, puis relance{' '}
                    <code>npm run dev</code>. Détails dans <code>docs/setup.md</code>.
                  </p>
                </div>
              </main>
            )}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
