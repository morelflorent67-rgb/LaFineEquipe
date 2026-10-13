import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getServerEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MEDIA_PATH } from '@/lib/media';

/**
 * Stockage des captures de stuffs.
 * - Supabase : bucket « stuff-media », écriture avec la session de l'admin (règles de stockage = admin).
 * - Local : dossier .data/media (servi par /media/… en développement uniquement). Une base locale
 *   séparée (LFE_LOCAL_DATA_DIR, ex. celle des tests) a son propre dossier « <dossier>-media ».
 */
export const LOCAL_MEDIA_DIR = process.env.LFE_LOCAL_DATA_DIR
  ? `${path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.LFE_LOCAL_DATA_DIR)}-media`
  : path.join(process.cwd(), '.data', 'media');
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageKind = { ext: 'png' | 'jpg' | 'webp'; contentType: string };

/** Type réel du fichier d'après ses premiers octets (on ne fait pas confiance au nom ni au type annoncé). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', contentType: 'image/png' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (
    b.length > 12 &&
    String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === 'RIFF' &&
    String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === 'WEBP'
  ) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

function localFile(p: string): string {
  if (!MEDIA_PATH.test(p)) throw new Error('Chemin de média invalide');
  return path.join(LOCAL_MEDIA_DIR, ...p.split('/'));
}

export async function putMedia(p: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (!MEDIA_PATH.test(p)) throw new Error('Chemin de média invalide');
  if (getServerEnv().backend === 'local') {
    const file = localFile(p);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return;
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from('stuff-media').upload(p, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Téléversement refusé : ${error.message}`);
}

export async function deleteMedia(p: string | null): Promise<void> {
  if (!p || !MEDIA_PATH.test(p)) return;
  try {
    if (getServerEnv().backend === 'local') {
      await unlink(localFile(p));
    } else {
      const supabase = await createSupabaseServerClient();
      await supabase.storage.from('stuff-media').remove([p]);
    }
  } catch {
    // Fichier déjà absent : rien à faire.
  }
}

export async function readLocalMedia(p: string): Promise<Buffer | null> {
  try {
    return await readFile(localFile(p));
  } catch {
    return null;
  }
}
