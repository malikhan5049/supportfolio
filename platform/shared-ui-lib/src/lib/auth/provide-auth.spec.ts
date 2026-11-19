import { TestBed } from '@angular/core/testing';
import { AUTH_CONFIG } from './auth.config';
import type { AuthConfig } from './auth.types';
import { provideAuth } from './provide-auth';

describe('provideAuth explicit identity base (R4)', () => {
  it('requires an explicit identity base', () => {
    expect(() => provideAuth({} as never)).toThrow(/identityLoginBaseUrl/);
  });

  it('accepts an empty base for same-origin production', () => {
    expect(() => provideAuth({ identityLoginBaseUrl: '' })).not.toThrow();
  });

  it('defaults apiBaseUrl, callbackPath, and apiUrlPrefixes', () => {
    TestBed.configureTestingModule({
      providers: [provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' })],
    });
    const config = TestBed.inject<AuthConfig>(AUTH_CONFIG);
    expect(config.apiBaseUrl).toBe('');
    expect(config.callbackPath).toBe('/auth/callback');
    expect(config.apiUrlPrefixes).toEqual(['/api/']);
  });

  it('accepts explicit apiUrlPrefixes', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAuth({
          identityLoginBaseUrl: 'http://localhost:8081',
          apiUrlPrefixes: ['/apps/tinyurl/api/'],
        }),
      ],
    });
    const config = TestBed.inject<AuthConfig>(AUTH_CONFIG);
    expect(config.apiUrlPrefixes).toEqual(['/apps/tinyurl/api/']);
  });
});
