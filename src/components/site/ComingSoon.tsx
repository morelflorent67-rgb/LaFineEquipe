import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

/** Module pas encore disponible : présenté clairement comme tel, jamais comme une page fonctionnelle vide. */
export function ComingSoon({ kicker, title, children, plan }: { kicker: string; title: string; children: ReactNode; plan: string[] }) {
  return (
    <>
      <header className="page-head">
        <p className="kicker">
          <Icon name="spk" className="spk" /> {kicker}
        </p>
        <h1 className="h1">{title}</h1>
      </header>
      <section className="sec">
        <div className="state unavailable" style={{ maxWidth: 760 }}>
          <span className="chip unknown">Pas encore disponible</span>
          <strong>Ce module n’est pas encore en service</strong>
          <div>{children}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {plan.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="actions">
            <Link className="btn btn-steel btn-sm" href="/">
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
