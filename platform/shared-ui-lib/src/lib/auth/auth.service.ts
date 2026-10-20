import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { buildLoginRedirectUrl, safeReturnUrl } from './redirect-url';
import { AUTH_CONFIG } from './auth.config';
import { AuthTokenStore } from './auth-token.store';
import type { AuthConfig, Principal } from './auth.types';

/**
 * How the app leaves for a full-page navigation (Identity login). Injectable so tests (and future
 * hosts) can capture the redirect instead of actually navigating.
 */
export const EXTERNAL_NAVIGATOR = new InjectionToken<(url: string) => void>('EXTERNAL_NAVIGATOR', {
  factory: () => (url: string) => window.location.assign(url),
});

const RETURN_URL_KEY = 'supportfolio.auth.return-url';

/** Granted over an invalid/replayed one-time code; the callback renders denial, never storage. */
export class LoginDeniedError extends Error {
  override readonly name = 'LoginDeniedError';
}

@Injectable()
export class AuthService {
  readonly lastError = signal<'denied' | null>(null);

  private readonly store = inject(AuthTokenStore);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly config = inject<AuthConfig>(AUTH_CONFIG);
  private readonly navigate = inject(EXTERNAL_NAVIGATOR);

  login(): void {
    const origin = window.location.origin;
    sessionStorage.setItem(RETURN_URL_KEY, safeReturnUrl(this.router.url, origin));
    this.navigate(
      buildLoginRedirectUrl(this.config.identityLoginBaseUrl, origin + this.config.callbackPath),
    );
  }

  async completeLogin(code: string): Promise<Principal> {
    let body: { accessToken: string; expiresIn: number; principal: Principal };
    try {
      body = await new Promise((resolve, reject) => {
        this.http
          .post<{
            accessToken: string;
            tokenType: string;
            expiresIn: number;
            principal: Principal;
          }>(`${this.config.apiBaseUrl}/api/token`, { code })
          .subscribe({ next: resolve, error: reject });
      });
    } catch {
      // Any non-2xx (unknown / used / expired code) is denial: uniform, and nothing is stored.
      throw new LoginDeniedError('Identity rejected the login code');
    }
    this.store.set({
      accessToken: body.accessToken,
      principal: body.principal,
      expiresAt: Date.now() + body.expiresIn * 1000,
    });
    return body.principal;
  }

  logout(): void {
    this.store.clear();
  }

  consumeReturnUrl(): string {
    const raw = sessionStorage.getItem(RETURN_URL_KEY);
    sessionStorage.removeItem(RETURN_URL_KEY);
    return safeReturnUrl(raw, window.location.origin);
  }

  clearError(): void {
    this.lastError.set(null);
  }
}
