import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEloHistory } from '@/lib/data/queries';

/** Relevés ELO d'un joueur depuis son ajout (lecture publique soumise à la RLS, aucun appel FACEIT). */
export async function GET(_req: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  if (!z.uuid().safeParse(playerId).success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  try {
    const history = await getEloHistory(playerId);
    if (!history) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[elo-history]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
