import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { getServiceDb } from '@/lib/db';
import { runAllSyncs, syncMatches, syncProfiles } from '@/lib/sync/run-sync';

/**
 * Point d'entrée de la synchronisation planifiée (Supabase Cron, Vercel Cron…).
 * Protégé par l'en-tête « Authorization: Bearer <CRON_SECRET> ». Ne renvoie aucune donnée de joueur.
 *   GET /api/cron/sync            → profils + matchs
 *   GET /api/cron/sync?job=matches → matchs seulement (fréquence plus élevée possible)
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (!env.cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 503 });
  }
  if (!authorized(request, env.cronSecret)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const job = request.nextUrl.searchParams.get('job');
  const db = getServiceDb();
  const reports =
    job === 'profiles'
      ? [await syncProfiles(db, 'cron')]
      : job === 'matches'
        ? [await syncMatches(db, 'cron')]
        : await runAllSyncs(db, 'cron');
  return NextResponse.json({ reports: reports.map(({ job: j, status, ok, failed }) => ({ job: j, status, ok, failed })) });
}
