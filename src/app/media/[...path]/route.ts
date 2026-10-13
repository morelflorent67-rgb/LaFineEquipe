import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { MEDIA_PATH } from '@/lib/media';
import { readLocalMedia } from '@/lib/storage';

/** Sert les captures stockées localement (.data/media). N'existe qu'en mode « local ». */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (getServerEnv().backend !== 'local') return new NextResponse(null, { status: 404 });
  const p = (await params).path.join('/');
  if (!MEDIA_PATH.test(p)) return new NextResponse(null, { status: 404 });
  const data = await readLocalMedia(p);
  if (!data) return new NextResponse(null, { status: 404 });
  const ext = p.split('.').pop();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return new NextResponse(new Uint8Array(data), {
    headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff' },
  });
}
