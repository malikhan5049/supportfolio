import production from './environment.prod';

describe('the production environment override', () => {
  it('points the link API under /apps/tinyurl', () => {
    expect(production.linkApiBaseUrl).toBe('/apps/tinyurl');
  });

  it('keeps the token endpoint at origin root', () => {
    expect(production.apiBaseUrl).toBe('');
  });

  it('sets the auth callback under /apps/tinyurl', () => {
    expect(production.callbackPath).toBe('/apps/tinyurl/auth/callback');
  });

  it('protects only the app-prefixed API with the auth interceptor', () => {
    expect(production.apiUrlPrefixes).toEqual(['/apps/tinyurl/api/']);
  });

  it('contains no localhost values', () => {
    expect(
      Object.values(production).some(
        (value) => typeof value === 'string' && value.includes('localhost'),
      ),
    ).toBe(false);
  });

  it('flags the build as a production build', () => {
    expect(production.production).toBe(true);
  });
});
