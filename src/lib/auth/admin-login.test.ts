import { describe, expect, it } from 'vitest';
import { resolveAdminEmail } from './admin-login';

describe('resolveAdminEmail', () => {
  const email = 'admin@fineequipe.com';
  it('traduit l’identifiant « admin » (casse et espaces ignorés)', () => {
    expect(resolveAdminEmail('admin', email)).toBe(email);
    expect(resolveAdminEmail('  Admin ', email)).toBe(email);
  });
  it('refuse tout autre identifiant, y compris l’e-mail lui-même', () => {
    expect(resolveAdminEmail('flo', email)).toBeNull();
    expect(resolveAdminEmail(email, email)).toBeNull();
    expect(resolveAdminEmail('', email)).toBeNull();
  });
  it('refuse tout si LFE_ADMIN_EMAIL n’est pas configuré', () => {
    expect(resolveAdminEmail('admin', null)).toBeNull();
  });
});
