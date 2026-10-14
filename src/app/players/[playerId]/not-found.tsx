import Link from 'next/link';

export default function PlayerNotFound() {
  return (
    <section className="sec">
      <p className="kicker">Profil indisponible</p>
      <h1 className="h1">Joueur introuvable</h1>
      <p className="lede">Ce joueur n’existe pas ou son profil n’est plus disponible.</p>
      <Link className="btn btn-red" href="/team">
        Voir les joueurs
      </Link>
    </section>
  );
}
