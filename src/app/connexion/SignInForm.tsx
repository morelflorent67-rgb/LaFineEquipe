'use client';

import { useActionState } from 'react';
import { signInAction, type SignInState } from '@/app/actions/auth';

export function SignInForm({ suite }: { suite: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, { error: null });
  return (
    <form action={action} style={{ display: 'grid', gap: 16, maxWidth: 420 }}>
      <input type="hidden" name="suite" value={suite} />
      <div className="field">
        <label htmlFor="identifier">Identifiant</label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state.error ? (
        <p role="alert" style={{ margin: 0, color: '#ff9b93' }}>
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-red" disabled={pending}>
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
