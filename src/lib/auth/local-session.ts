import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Session du mode LOCAL de développement uniquement : cookie signé (HMAC) contenant
 * l'identifiant d'un compte local. Le secret est généré dans .data/ (ignoré par git).
 * Ce mécanisme n'existe pas en mode Supabase, où la connexion passe par Supabase Auth.
 */
export const LOCAL_SESSION_COOKIE = 'lfe_local_session';
const SECRET_FILE = path.join(process.cwd(), '.data', 'local-session-secret');
let secretPromise: Promise<Buffer> | null = null;

function getSecret(): Promise<Buffer> {
  secretPromise ??= (async () => {
    try {
      return Buffer.from((await readFile(SECRET_FILE, 'utf8')).trim(), 'hex');
    } catch {
      const secret = randomBytes(32);
      await mkdir(path.dirname(SECRET_FILE), { recursive: true });
      await writeFile(SECRET_FILE, secret.toString('hex'), { mode: 0o600 });
      return secret;
    }
  })();
  return secretPromise;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function signLocalSession(userId: string): Promise<string> {
  if (!UUID.test(userId)) throw new Error('Identifiant local invalide');
  const mac = createHmac('sha256', await getSecret()).update(userId).digest('base64url');
  return `${userId}.${mac}`;
}

export async function verifyLocalSession(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [userId, mac] = value.split('.');
  if (!userId || !mac || !UUID.test(userId)) return null;
  const expected = createHmac('sha256', await getSecret()).update(userId).digest();
  const given = Buffer.from(mac, 'base64url');
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
