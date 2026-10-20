import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthTokenStore } from './auth-token.store';
import type { Principal } from './auth.types';

const principal = (): Principal => ({
  id: '1',
  login: 'octocat',
  email: null,
  displayName: 'Octo',
  role: 'user',
});

const setup = () => {
  const store = TestBed.inject(AuthTokenStore);
  const http = TestBed.inject(HttpTestingController);
  const client = TestBed.inject(HttpClient);
  return { store, http, client };
};

describe('authInterceptor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthTokenStore,
      ],
    });
  });

  it('attaches the bearer only to protected same-origin api calls', () => {
    const { store, http, client } = setup();
    store.set({
      accessToken: 'jwt',
      principal: principal(),
      expiresAt: Date.now() + 60_000,
    });
    client.get('/api/session/me').subscribe();
    expect(http.expectOne('/api/session/me').request.headers.get('Authorization')).toBe(
      'Bearer jwt',
    );
  });

  it('never attaches the token to the token endpoint or a remote origin', () => {
    const { store, http, client } = setup();
    store.set({
      accessToken: 'jwt',
      principal: principal(),
      expiresAt: Date.now() + 60_000,
    });
    client.get('http://localhost:4301/remoteEntry.js').subscribe();
    expect(
      http.expectOne('http://localhost:4301/remoteEntry.js').request.headers.has('Authorization'),
    ).toBe(false);
    client.post('/api/token', { code: 'x' }).subscribe();
    expect(http.expectOne('/api/token').request.headers.has('Authorization')).toBe(false);
  });
});
