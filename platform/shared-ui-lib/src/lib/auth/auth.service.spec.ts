import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthService, LoginDeniedError, EXTERNAL_NAVIGATOR } from './auth.service';
import { AuthTokenStore } from './auth-token.store';
import { AUTH_CONFIG } from './auth.config';
import type { Principal } from './auth.types';

const principal = (): Principal => ({
  id: '1',
  login: 'octocat',
  email: null,
  displayName: 'Octo',
  role: 'user',
});

const setup = (navigate: (url: string) => void = () => {}) => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      AuthTokenStore,
      AuthService,
      {
        provide: AUTH_CONFIG,
        useValue: {
          identityLoginBaseUrl: 'http://localhost:8081',
          apiBaseUrl: '',
          callbackPath: '/auth/callback',
        },
      },
      { provide: EXTERNAL_NAVIGATOR, useValue: navigate },
    ],
  });
  const store = TestBed.inject(AuthTokenStore);
  return { store, service: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
};

describe('AuthService', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('exchanges a code for the identity token contract and stores the session', async () => {
    const { store, service, http } = setup();
    const promise = service.completeLogin('abc');
    const req = http.expectOne('/api/token');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: 'abc' });
    req.flush({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 3600,
      principal: principal(),
    });
    await expect(promise).resolves.toEqual(principal());
    expect(store.token()).toBe('jwt');
  });

  it('stores nothing when the code is rejected', async () => {
    const { store, service, http } = setup();
    const promise = service.completeLogin('used');
    http
      .expectOne('/api/token')
      .flush({ error: 'invalid_code' }, { status: 400, statusText: 'Bad Request' });
    await expect(promise).rejects.toBeInstanceOf(LoginDeniedError);
    expect(store.token()).toBeNull();
  });

  it('navigates to identity login with the fragment-free callback target', () => {
    const navigate: string[] = [];
    const { service } = setup((url) => navigate.push(url));
    service.login();
    expect(navigate[0]).toContain('/auth/login?redirect=');
    expect(navigate[0]).not.toContain('#');
  });

  it('forgets the stored session on logout', () => {
    const { store, service } = setup();
    store.set({
      accessToken: 'jwt',
      principal: principal(),
      expiresAt: Date.now() + 60_000,
    });
    service.logout();
    expect(store.token()).toBeNull();
  });
});
