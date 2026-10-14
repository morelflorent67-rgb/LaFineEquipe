'use client';

import Link from 'next/link';

/** Next.js 16.3 transmet retry, qui recharge les données et retente le rendu du segment. */
export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="sec" role="alert">
      <p className="kicker">Une pause technique</p>
      <h1 className="h1">La page n’a pas pu être chargée.</h1>
      <p className="lede">Réessaie dans un instant ou retourne à l’accueil.</p>
      <div className="actions">
        <button type="button" className="btn btn-red" onClick={() => retry()}>
          Réessayer
        </button>
        <Link className="btn btn-steel" href="/">
          Retour à l’accueil
        </Link>
      </div>
    </section>
  );
}
