import { signal } from '@angular/core';
import type { AuthSession } from './auth.types';

const SESSION_KEY = 'supportfolio.auth.session';

/**
 * Tab-scoped access-token holder. Persists to `sessionStorage` so a browser tab keeps its login
 * across reloads but never to disk or other tabs; the shell never hands this token to a remote.
 */
export class AuthTokenStore {
  readonly session = signal<AuthSession | null>(this.hydrated());

  set(session: AuthSession): void {
    if (session.expiresAt <= Date.now()) {
      this.clear();
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  clear(): void {
    sessionStorage.removeItem(SESSION_KEY);
    // `session` may not be initialized yet when hygiene runs during construction.
    if (this.session) {
      this.session.set(null);
    }
  }

  /** The access token, or null when signed out or the session already expired. */
  token(): string | null {
    const session = this.hydrated();
    if (session && session.expiresAt <= Date.now()) {
      this.clear();
      return null;
    }
    this.session.set(session);
    return session === null ? null : session.accessToken;
  }

  private hydrated(): AuthSession | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (!parsed || typeof parsed.accessToken !== 'string') {
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }
}
