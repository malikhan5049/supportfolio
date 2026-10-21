import { provideAuth } from './provide-auth';

describe('provideAuth explicit identity base (R4)', () => {
  it('requires an explicit identity base', () => {
    expect(() => provideAuth({} as never)).toThrow(/identityLoginBaseUrl/);
  });

  it('accepts an empty base for same-origin production', () => {
    expect(() => provideAuth({ identityLoginBaseUrl: '' })).not.toThrow();
  });

  it('defaults apiBaseUrl and callbackPath', () => {
    expect(() =>
      provideAuth({
        identityLoginBaseUrl: 'http://localhost:8081',
        apiBaseUrl: '',
        callbackPath: '/auth/callback',
      }),
    ).not.toThrow();
  });
});
