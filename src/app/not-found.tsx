import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="sec">
      <p className="kicker">404 · Hors de la map</p>
      <h1 className="h1">Cette page est introuvable.</h1>
      <p className="lede">Le lien a peut-être changé. Retrouve le classement ou retourne au QG de la team.</p>
      <div className="actions">
        <Link className="btn btn-red" href="/">
          Retour à l’accueil
        </Link>
        <Link className="btn btn-steel" href="/elo-run">
          Classement ELO
        </Link>
      </div>
    </section>
  );
}
