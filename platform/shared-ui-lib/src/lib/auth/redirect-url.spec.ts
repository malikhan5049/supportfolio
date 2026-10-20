import { buildLoginRedirectUrl, safeReturnUrl, stripFragment } from './redirect-url';

describe('redirect-url', () => {
  it('strips fragments and encodes the callback target exactly once', () => {
    expect(
      buildLoginRedirectUrl('http://localhost:8081', 'http://localhost:4200/auth/callback#/tab'),
    ).toBe(
      'http://localhost:8081/auth/login?redirect=http%3A%2F%2Flocalhost%3A4200%2Fauth%2Fcallback',
    );
  });

  it('keeps queries but drops fragments', () => {
    expect(stripFragment('/app?tab=1#frag')).toBe('/app?tab=1');
    expect(stripFragment('/app#/route')).toBe('/app');
  });

  it('ignores off-origin and protocol-relative return targets', () => {
    expect(safeReturnUrl('https://evil.example/x', 'http://localhost:4200')).toBe('/');
    expect(safeReturnUrl('//evil.example/x', 'http://localhost:4200')).toBe('/');
    expect(safeReturnUrl('javascript:alert(1)', 'http://localhost:4200')).toBe('/');
  });

  it('accepts same-origin paths and same-origin absolute URLs', () => {
    expect(safeReturnUrl('/projects/identity', 'http://localhost:4200')).toBe('/projects/identity');
    expect(safeReturnUrl('http://localhost:4200/signin', 'http://localhost:4200')).toBe('/signin');
  });

  it('falls back to the root for null or empty return targets', () => {
    expect(safeReturnUrl(null, 'http://localhost:4200')).toBe('/');
    expect(safeReturnUrl('', 'http://localhost:4200')).toBe('/');
  });
});
