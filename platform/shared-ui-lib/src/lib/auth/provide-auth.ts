import { makeEnvironmentProviders } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { AUTH_CONFIG } from './auth.config';
import type { AuthConfig } from './auth.types';
import { AuthTokenStore } from './auth-token.store';
import { AuthService } from './auth.service';

/**
 * Registers the shared auth machinery on an app: config defaults, the token store, the service,
 * and the default external navigator. Call `provideAuth({...})` from `app.config.ts`.
 */
export function provideAuth(
  config: { identityLoginBaseUrl: string } & Partial<AuthConfig>,
): EnvironmentProviders {
  if (typeof config?.identityLoginBaseUrl !== 'string') {
    throw new Error('identityLoginBaseUrl is required');
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
