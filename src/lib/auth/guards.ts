import 'server-only';
import { DbError } from '@/lib/db/errors';
import { getViewer, isAdmin, isMember, type Viewer } from './viewer';

/** À appeler en tête de CHAQUE action serveur d'administration. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!isAdmin(viewer)) throw new DbError('forbidden', 'Action réservée aux administrateurs.');
  return viewer;
}

export async function requireMember(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!isMember(viewer)) throw new DbError('forbidden', 'Action réservée aux membres de la team.');
  return viewer;
}
