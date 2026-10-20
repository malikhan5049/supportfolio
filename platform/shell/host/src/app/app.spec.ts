import { render, screen, waitFor } from '@testing-library/angular';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';
import { provideAuth, EXTERNAL_NAVIGATOR } from 'shared-ui-lib';
import { appRoutes } from './app.routes';
import { provideRemoteRegistry } from './catalog/remote-registry.providers';
import { CatalogService } from './catalog/catalog.service';

const SESSION_KEY = 'supportfolio.auth.session';

async function renderShell() {
  return render(App, {
    imports: [RouterTestingModule.withRoutes(appRoutes)],
    providers: [
      provideAuth(),
      { provide: EXTERNAL_NAVIGATOR, useValue: jest.fn() },
      provideHttpClient(),
      provideRemoteRegistry(''),
      CatalogService,
    ],
  });
}

describe('App', () => {
  beforeEach(() => sessionStorage.clear());

  it('renders the shell header and the router outlet', async () => {
    const { fixture } = await renderShell();
    expect(
      fixture.nativeElement.querySelector('[data-testid="shell-header"]').textContent,
    ).toContain('Supportfolio');
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('offers sign-in from the header when signed out', async () => {
    await renderShell();
    expect(screen.getAllByTestId('header-sign-in').length).toBeGreaterThan(0);
  });

  it('reaches the shared login page through the header sign-in', async () => {
    await renderShell();
    screen
      .getAllByTestId('header-sign-in')
      .forEach((el) => (el as HTMLAnchorElement).click());
    await waitFor(() => expect(screen.getByTestId('sign-in')).toBeTruthy());
  });

  it('shows the signed-in user with sign-out and clears the session on sign out', async () => {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        accessToken: 'jwt',
        principal: {
          id: '123',
          login: 'octocat',
          email: null,
          displayName: 'The Octocat',
          role: 'admin',
        },
        expiresAt: Date.now() + 60_000,
      }),
    );
    const { fixture } = await renderShell();
    expect(screen.getByTestId('session-user').textContent).toContain('The Octocat');
    expect(screen.getByTestId('sign-out')).toBeTruthy();
    screen.getByTestId('sign-out').click();
    fixture.detectChanges();
    await waitFor(() => expect(screen.getAllByTestId('header-sign-in').length).toBeGreaterThan(0));
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
