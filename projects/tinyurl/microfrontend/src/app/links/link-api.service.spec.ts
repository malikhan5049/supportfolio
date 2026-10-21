import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SHORT_LINK_BASE_URL } from '../links/short-link-base-url';
import { LinkApiService } from './link-api.service';
import type { Link } from './link.types';

function link(): Link {
  return {
    slug: 'abc12345',
    targetUrl: 'https://example.com/a',
    clickCount: 3,
    createdAt: '2026-10-21T12:00:00Z',
  };
}

describe('LinkApiService', () => {
  let service: LinkApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        LinkApiService,
        { provide: SHORT_LINK_BASE_URL, useValue: 'http://localhost:8082' },
      ],
    });
    service = TestBed.inject(LinkApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists links from the public endpoint', async () => {
    const promise = service.list();
    const req = http.expectOne('/api/links');
    expect(req.request.method).toBe('GET');
    req.flush({ links: [link()] });
    await expect(promise).resolves.toEqual([link()]);
  });

  it('maps a failed list to a typed ApiError', async () => {
    const promise = service.list();
    http.expectOne('/api/links').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(promise).rejects.toMatchObject({ status: 503, name: 'ApiError' });
  });

  it('creates a link by posting the target url', async () => {
    const promise = service.create('https://example.com/a');
    const req = http.expectOne('/api/links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetUrl: 'https://example.com/a' });
    req.flush(link(), { status: 201, statusText: 'Created' });
    await expect(promise).resolves.toEqual(link());
  });

  it('maps a failed create to a typed ApiError', async () => {
    const promise = service.create('http://169.254.169.254/latest');
    http
      .expectOne('/api/links')
      .flush({ error: 'invalid_target_url' }, { status: 400, statusText: 'Bad Request' });
    await expect(promise).rejects.toMatchObject({ status: 400, name: 'ApiError' });
  });

  it('builds a clickable short link from the configured base', () => {
    expect(service.shortUrl('abc12345')).toBe('http://localhost:8082/go/abc12345');
  });
});
