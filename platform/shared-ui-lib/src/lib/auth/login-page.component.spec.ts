import { render, screen } from '@testing-library/angular';
import { EXTERNAL_NAVIGATOR } from './auth.service';
import { provideAuth } from './provide-auth';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from './auth.service';
import { TestBed } from '@angular/core/testing';

describe('LoginPageComponent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('signs in through the identity login entry point', async () => {
    const navigate = jest.fn();
    const { fixture } = await render(LoginPageComponent, {
      providers: [
        provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' }),
        { provide: EXTERNAL_NAVIGATOR, useValue: navigate },
      ],
    });
    screen.getByTestId('sign-in').click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/auth/login?redirect='));
  });

  it('shows the denial state when the shared service reports denial', async () => {
    const { fixture } = await render(LoginPageComponent, {
      providers: [provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' })],
    });
    TestBed.inject(AuthService).lastError.set('denied');
    await fixture.whenStable();
    expect(screen.getByTestId('login-denied')).toBeTruthy();
  });
});
