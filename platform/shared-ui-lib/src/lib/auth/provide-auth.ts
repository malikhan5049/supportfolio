import { makeEnvironmentProviders } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { AUTH_CONFIG } from './auth.config';
import type { AuthConfig } from './auth.types';
import { AuthTokenStore } from './auth-token.store';
import { AuthService } from './auth.service';

/**
 * Registers the shared auth machinery on an app: config defaults, the token store, the service,
 * and the default external navigator. Call `provideAuth({...})` from `app.config.ts`. The
 * `identityLoginBaseUrl` is required with no dev default: dev callers pass
 * `http://localhost:8081`, production consumers pass `''` for the same-origin proxy (an empty
 * string is valid; the production bundle must not contain a dev Identity URL).
 */
export function provideAuth(
  config: { identityLoginBaseUrl: string } & Partial<AuthConfig>,
): EnvironmentProviders {
  if (typeof config.identityLoginBaseUrl !== 'string') {
    throw new Error(
      'provideAuth requires an explicit identityLoginBaseUrl (pass the dev Identity base, or "" for same-origin production)',
    );
  }
  const full: AuthConfig = {
    apiBaseUrl: '',
    callbackPath: '/auth/callback',
    ...config,
  };
  return makeEnvironmentProviders([
    { provide: AUTH_CONFIG, useValue: full },
    AuthTokenStore,
    AuthService,
  ]);
}
