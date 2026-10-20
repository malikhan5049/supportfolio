import { render, screen } from '@testing-library/angular';
import { ActivatedRoute, Router } from '@angular/router';
import type { ParamMap } from '@angular/router';
import { AuthCallbackComponent } from './auth-callback.component';
import { AuthTokenStore } from './auth-token.store';
import { AuthService, LoginDeniedError } from './auth.service';
import { provideAuth } from './provide-auth';
import type { Principal } from './auth.types';

const principal = (): Principal => ({
  id: '1',
  login: 'octocat',
  email: null,
  displayName: 'Octo',
  role: 'user',
});

const paramMap = (query: Record<string, string>): ParamMap => {
  const keys = Object.keys(query);
  return {
    keys,
    has: (name: string) => keys.includes(name),
    getAll: (name: string) => (keys.includes(name) ? [query[name]] : []),
    get: (name: string) => (keys.includes(name) ? query[name] : null),
  };
};

const renderCallback = (
  query: Record<string, string>,
  serviceStub: Partial<AuthService> = {},
  navigateByUrl: (url: string) => Promise<boolean> = jest.fn().mockResolvedValue(true),
) => {
  const store = new AuthTokenStore();
  return render(AuthCallbackComponent, {
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: paramMap(query) } } },
      { provide: Router, useValue: { navigateByUrl } },
      { provide: AuthService, useValue: serviceStub },
      { provide: AuthTokenStore, useValue: store },
    ],
  });
};

describe('AuthCallbackComponent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('shows denial and stores no token when identity returns an error', async () => {
    const store = new AuthTokenStore();
    await renderCallback({ error: 'access_denied' });
    expect(screen.getByTestId('login-denied')).toBeTruthy();
    expect(store.token()).toBeNull();
  });

  it('exchanges the code and navigates away with replaceUrl to clean the address bar', async () => {
    const completeLogin = jest.fn().mockResolvedValue(principal());
    const consumeReturnUrl = jest.fn().mockReturnValue('/projects/identity');
    const navigateByUrl = jest.fn().mockResolvedValue(true);
    const { fixture } = await renderCallback(
      { code: 'abc' },
      { completeLogin, consumeReturnUrl } as Partial<AuthService>,
      navigateByUrl,
    );
    await fixture.whenStable();
    expect(completeLogin).toHaveBeenCalledWith('abc');
    expect(navigateByUrl).toHaveBeenCalledWith('/projects/identity', { replaceUrl: true });
  });

  it('ignores an off-origin stored return URL', async () => {
    const completeLogin = jest.fn().mockResolvedValue(principal());
    const consumeReturnUrl = jest.fn().mockReturnValue('https://evil.example/route');
    const navigateByUrl = jest.fn().mockResolvedValue(true);
    const { fixture } = await renderCallback(
      { code: 'abc' },
      { completeLogin, consumeReturnUrl } as Partial<AuthService>,
      navigateByUrl,
    );
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('renders an error state when neither code nor error is present', async () => {
    await renderCallback({});
    expect(screen.getByTestId('login-error')).toBeTruthy();
  });

  it('shows the denial state when the exchange is rejected', async () => {
    const completeLogin = jest.fn().mockRejectedValue(new LoginDeniedError('no'));
    const store = new AuthTokenStore();
    const { fixture } = await renderCallback({ code: 'abc' }, {
      completeLogin,
    } as Partial<AuthService>);
    await fixture.whenStable();
    expect(screen.getByTestId('login-denied')).toBeTruthy();
    expect(store.token()).toBeNull();
  });
});
