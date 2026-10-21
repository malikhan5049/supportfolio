import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthTokenStore } from 'shared-ui-lib';
import { SHORT_LINK_BASE_URL } from '../links/short-link-base-url';
import { LinkApiService } from '../links/link-api.service';
import type { Link } from '../links/link.types';
import { ShortenFormComponent } from './shorten-form.component';

function link(): Link {
  return {
    slug: 'abc12345',
    targetUrl: 'https://example.com/a',
    clickCount: 0,
    createdAt: '2026-10-21T12:00:00Z',
  };
}

describe('ShortenFormComponent', () => {
  let http: HttpTestingController;
  let store: AuthTokenStore;

  const signIn = () => {
    store.set({
      accessToken: 'jwt',
      principal: { id: 'u1', login: 'u1', email: null, displayName: 'User One', role: 'user' },
      expiresAt: Date.now() + 60_000,
    });
  };

  const drain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const renderForm = async () => {
    const fixture = TestBed.createComponent(ShortenFormComponent);
    await drain();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ShortenFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthTokenStore,
        LinkApiService,
        { provide: SHORT_LINK_BASE_URL, useValue: 'http://localhost:8082' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthTokenStore);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('prompts anonymous visitors to sign in instead of calling the API', async () => {
    const fixture = await renderForm();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="sign-in-prompt"]')).toBeTruthy();
  });

  it('shortens when signed in and renders a copyable short link', async () => {
    signIn();
    const fixture = await renderForm();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).value =
      'https://example.com/a';
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (el.querySelector('[data-testid="shorten-submit"]') as HTMLButtonElement).click();
    await drain();
    fixture.detectChanges();
    http.expectOne('/api/links').flush(link(), { status: 201, statusText: 'Created' });
    await drain();
    fixture.detectChanges();
    const anchor = el.querySelector('[data-testid="short-link"]') as HTMLAnchorElement;
    expect(anchor.href).toBe('http://localhost:8082/go/abc12345');
    expect(el.querySelector('[data-testid="copy-link"]')).toBeTruthy();
  });

  it('shows the hourly cap message on 429', async () => {
    signIn();
    const fixture = await renderForm();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).value =
      'https://example.com/a';
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (el.querySelector('[data-testid="shorten-submit"]') as HTMLButtonElement).click();
    http
      .expectOne('/api/links')
      .flush({ error: 'rate_limited' }, { status: 429, statusText: 'Too Many Requests' });
    await drain();
    fixture.detectChanges();
    const error =
      (el.querySelector('[data-testid="shorten-error"]') as HTMLElement).textContent ?? '';
    expect(error).toContain('20');
    expect(error).toContain('hour');
  });

  it('shows the invalid-target message on 400', async () => {
    signIn();
    const fixture = await renderForm();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).value =
      'http://169.254.169.254/x';
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (el.querySelector('[data-testid="shorten-submit"]') as HTMLButtonElement).click();
    http
      .expectOne('/api/links')
      .flush({ error: 'invalid_target_url' }, { status: 400, statusText: 'Bad Request' });
    await drain();
    fixture.detectChanges();
    const error =
      (el.querySelector('[data-testid="shorten-error"]') as HTMLElement).textContent ?? '';
    expect(error).toContain('public');
  });

  it('clears an expired session and prompts sign-in on 401', async () => {
    signIn();
    const fixture = await renderForm();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).value =
      'https://example.com/a';
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (el.querySelector('[data-testid="shorten-submit"]') as HTMLButtonElement).click();
    http.expectOne('/api/links').flush({}, { status: 401, statusText: 'Unauthorized' });
    await drain();
    fixture.detectChanges();
    expect(store.token()).toBeNull();
    expect(el.querySelector('[data-testid="sign-in-prompt"]')).toBeTruthy();
  });

  it('copies the short link', async () => {
    signIn();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const fixture = await renderForm();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).value =
      'https://example.com/a';
    (el.querySelector('[data-testid="target-url"]') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (el.querySelector('[data-testid="shorten-submit"]') as HTMLButtonElement).click();
    http.expectOne('/api/links').flush(link(), { status: 201, statusText: 'Created' });
    await drain();
    fixture.detectChanges();
    (el.querySelector('[data-testid="copy-link"]') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('http://localhost:8082/go/abc12345');
  });
});
