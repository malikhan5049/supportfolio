import { provideAuth } from './provide-auth';

describe('provideAuth', () => {
  it('requires an explicit identity base', () => {
    expect(() => provideAuth({} as any)).toThrow(/identityLoginBaseUrl/);
  });

  it('accepts an empty base for same-origin production', () => {
    expect(() => provideAuth({ identityLoginBaseUrl: '' })).not.toThrow();
  });
});
