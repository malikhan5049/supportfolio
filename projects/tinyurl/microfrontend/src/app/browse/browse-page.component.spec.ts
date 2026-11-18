import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LINK_API_BASE_URL } from '../links/link-api-base-url';
import { LinkApiService } from '../links/link-api.service';
import type { Link } from '../links/link.types';
import { AuthTokenStore } from 'shared-ui-lib';
import { ShortenFormComponent } from '../shorten/shorten-form.component';
import { BrowsePageComponent } from './browse-page.component';

function link(slug: string, clickCount: number): Link {
  return {
    slug,
    targetUrl: `https://example.com/${slug}`,
    shortUrl: `https://tiny.example.com/go/${slug}`,
    clickCount,
    createdAt: '2026-10-21T12:00:00Z',
  };
}

describe('BrowsePageComponent', () => {
  let http: HttpTestingController;
  const drain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const flushList = (links: Link[], status = 200) => {
    http
      .expectOne('/api/links')
      .flush({ links }, { status, statusText: status === 200 ? 'OK' : 'Unavailable' });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BrowsePageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthTokenStore,
        LinkApiService,
        { provide: LINK_API_BASE_URL, useValue: '' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders one row per link with its click count', async () => {
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();
    flushList([link('aaa11111', 3), link('bbb22222', 0)]);
    await drain();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="browse-list"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="link-row-aaa11111"]')).toHaveLength(1);
    expect(el.querySelectorAll('[data-testid="link-row-bbb22222"]')).toHaveLength(1);
    expect(el.querySelector('[data-testid="click-count-aaa11111"]')?.textContent).toContain('3');
    expect(el.querySelector('[data-testid="click-count-bbb22222"]')?.textContent).toContain('0');
  });

  it('renders the server-provided short link', async () => {
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();
    flushList([link('aaa11111', 0)]);
    await drain();
    fixture.detectChanges();
    const anchor = fixture.nativeElement.querySelector('[data-testid="link-row-aaa11111"] a');
    expect(anchor?.getAttribute('href')).toBe('https://tiny.example.com/go/aaa11111');
  });

  it('shows an empty state for no links', async () => {
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();
    flushList([]);
    await drain();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="browse-empty"]'),
    ).toBeTruthy();
  });

  it('reloads the list after the shorten form creates a link', async () => {
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();
    flushList([link('aaa11111', 0)]);
    await drain();
    fixture.detectChanges();
    const form = fixture.debugElement
      .query(By.directive(ShortenFormComponent))
      .injector.get(ShortenFormComponent);
    form.created.emit(link('bbb22222', 0));
    flushList([link('aaa11111', 0), link('bbb22222', 0)]);
    await drain();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="link-row-bbb22222"]')).toHaveLength(1);
  });

  it('shows an error state when the list fails', async () => {
    const fixture = TestBed.createComponent(BrowsePageComponent);
    fixture.detectChanges();
    http.expectOne('/api/links').flush({}, { status: 503, statusText: 'Unavailable' });
    await drain();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="browse-error"]'),
    ).toBeTruthy();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="browse-list"]'),
    ).toBeNull();
  });
});
