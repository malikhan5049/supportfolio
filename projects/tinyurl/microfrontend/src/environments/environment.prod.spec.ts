import production from './environment.prod';

describe('the production environment override', () => {
  it('points the link API under /apps/tinyurl', () => {
    expect(production.linkApiBaseUrl).toBe('/apps/tinyurl');
  });

  it('keeps the token endpoint at origin root', () => {
    expect(production.apiBaseUrl).toBe('');
  });

  it('leaves the identity entry point origin-relative', () => {
    expect(production.identityLoginBaseUrl).toBe('');
  });

  it('leaves the public base URL origin-relative', () => {
    expect(production.publicBaseUrl).toBe('');
  });

  it('sets the auth callback under /apps/tinyurl', () => {
    expect(production.callbackPath).toBe('/apps/tinyurl/auth/callback');
  });

  it('protects only the app-prefixed API with the auth interceptor', () => {
    expect(production.apiUrlPrefixes).toEqual(['/apps/tinyurl/api/']);
  });

  it('contains no localhost values', () => {
    const offenders: string[] = [];

    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        if (value.includes('localhost')) offenders.push(`${path}=${value}`);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
        return;
      }
      if (value !== null && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
          walk(entry, path ? `${path}.${key}` : key);
        }
      }
    };

    walk(production, 'production');

    expect(offenders).toEqual([]);
  });

  it('flags the build as a production build', () => {
    expect(production.production).toBe(true);
  });
});
