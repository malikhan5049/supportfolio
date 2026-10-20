import { AuthTokenStore } from './auth-token.store';
import type { Principal } from './auth.types';

const SESSION_KEY = 'supportfolio.auth.session';

const principal = (): Principal => ({
  id: '1',
  login: 'octocat',
  email: null,
  displayName: 'Octo',
  role: 'user',
});

describe('AuthTokenStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persists a session for the tab and clears it on logout', () => {
    const store = new AuthTokenStore();
    store.set({
      accessToken: 't',
      principal: principal(),
      expiresAt: Date.now() + 60_000,
    });
    expect(sessionStorage.getItem(SESSION_KEY)).toContain('"accessToken":"t"');
    expect(store.token()).toBe('t');
    store.clear();
    expect(store.token()).toBeNull();
  });

  it('treats an expired session as signed out', () => {
    const store = new AuthTokenStore();
    store.set({
      accessToken: 't',
      principal: principal(),
      expiresAt: Date.now() - 1,
    });
    expect(store.token()).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('clears an unreadable persisted session on hydration', () => {
    sessionStorage.setItem(SESSION_KEY, 'not-json');
    const store = new AuthTokenStore();
    expect(store.token()).toBeNull();
  });
});
