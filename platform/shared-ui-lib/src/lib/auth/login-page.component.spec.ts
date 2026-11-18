import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AuthService, EXTERNAL_NAVIGATOR } from './auth.service';
import { provideAuth } from './provide-auth';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  const mockNavigate = jest.fn();
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    http?.verify();
  });

  it('signs in through the identity login entry point', async () => {
    const navigate = jest.fn();
    const { fixture } = await render(LoginPageComponent, {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' }),
        { provide: EXTERNAL_NAVIGATOR, useValue: navigate },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/features');
    screen.getByTestId('sign-in').click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/auth/login?redirect='));
  });

  it('shows the denial state when the shared service reports denial', async () => {
    const { fixture } = await render(LoginPageComponent, {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' }),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/features');
    TestBed.inject(AuthService).lastError.set('denied');
    await fixture.whenStable();
    expect(screen.getByTestId('login-denied')).toBeTruthy();
  });

  it('shows the demo sign-in button when /api/features returns demoLogin:true', async () => {
    await render(LoginPageComponent, {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' }),
        { provide: Router, useValue: { navigate: mockNavigate } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/features').flush({ demoLogin: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('demo-sign-in')).toBeTruthy();
  });

  it('hides the demo sign-in button when /api/features returns demoLogin:false', async () => {
    await render(LoginPageComponent, {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' }),
        { provide: Router, useValue: { navigate: mockNavigate } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/features').flush({ demoLogin: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByTestId('demo-sign-in')).toBeNull();
  });

  it('hides the demo sign-in button when /api/features fails', async () => {
    await render(LoginPageComponent, {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' }),
        { provide: Router, useValue: { navigate: mockNavigate } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/features').flush(null, { status: 500, statusText: 'Server Error' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByTestId('demo-sign-in')).toBeNull();
  });

  it('POSTs /api/demo-login and navigates to /auth/callback with the code when demo sign-in is clicked', async () => {
    await render(LoginPageComponent, {
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth({ identityLoginBaseUrl: 'http://localhost:8081' }),
        { provide: Router, useValue: { navigate: mockNavigate } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/features').flush({ demoLogin: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    screen.getByTestId('demo-sign-in').click();

    const req = http.expectOne('/api/demo-login');
    expect(req.request.method).toBe('POST');
    req.flush({ code: 'demo-code-123' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockNavigate).toHaveBeenCalledWith(['/auth/callback'], {
      queryParams: { code: 'demo-code-123' },
    });
  });
});
