import { environment } from './environment.standalone';

describe('standalone environment', () => {
  it('is production and same-origin', () => {
    expect(environment.production).toBe(true);
    expect(environment.apiBaseUrl).toBe('');
    expect(environment.identityLoginBaseUrl).toBe('');
    expect(environment.publicBaseUrl).toBe('');
    expect(environment.linkApiBaseUrl).toBe('');
    expect(environment.callbackPath).toBe('/auth/callback');
    expect(environment.apiUrlPrefixes).toEqual(['/api/']);
  });
});
