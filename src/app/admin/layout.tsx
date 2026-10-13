import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSideNav } from '@/components/admin/AdminSideNav';
import styles from '@/components/admin/admin.module.css';
import { getViewer } from '@/lib/auth/viewer';

export const metadata: Metadata = { title: 'Administration', robots: { index: false, follow: false } };

/**
 * Contrôle côté serveur, à chaque requête : seul un compte au rôle « admin » (table profiles)
 * voit l'administration. Chaque action serveur revérifie ce rôle, et la base aussi (RLS).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer.signedIn) redirect('/connexion?suite=/admin');
  if (viewer.role !== 'admin') {
    return (
      <section className="sec">
        <div className="state error">
          <strong>Accès réservé aux administrateurs</strong>
          <p>Ton compte est connecté mais n’a pas le rôle administrateur.</p>
          <div className="actions">
            <Link className="btn btn-steel btn-sm" href="/">
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </section>
    );
  }
  return (
    <div className={styles.shell}>
      <AdminSideNav />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
