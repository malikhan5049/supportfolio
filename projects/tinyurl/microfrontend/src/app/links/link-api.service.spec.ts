import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LINK_API_BASE_URL } from '../links/link-api-base-url';
import { LinkApiService } from './link-api.service';
import type { Link } from './link.types';

function link(): Link {
  return {
    slug: 'abc12345',
    targetUrl: 'https://example.com/a',
    shortUrl: 'https://tiny.example.com/go/abc12345',
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
        { provide: LINK_API_BASE_URL, useValue: '/apps/tinyurl' },
      ],
    });
    service = TestBed.inject(LinkApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists links from the public endpoint under the configured base', async () => {
    const promise = service.list();
    const req = http.expectOne('/apps/tinyurl/api/links');
    expect(req.request.method).toBe('GET');
    req.flush({ links: [link()] });
    await expect(promise).resolves.toEqual([link()]);
  });

  it('maps a failed list to a typed ApiError', async () => {
    const promise = service.list();
    http.expectOne('/apps/tinyurl/api/links').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(promise).rejects.toMatchObject({ status: 503, name: 'ApiError' });
  });

  it('creates a link by posting the target url under the configured base', async () => {
    const promise = service.create('https://example.com/a');
    const req = http.expectOne('/apps/tinyurl/api/links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetUrl: 'https://example.com/a' });
    req.flush(link(), { status: 201, statusText: 'Created' });
    await expect(promise).resolves.toEqual(link());
  });

  it('maps a failed create to a typed ApiError', async () => {
    const promise = service.create('http://169.254.169.254/latest');
    http
      .expectOne('/apps/tinyurl/api/links')
      .flush({ error: 'invalid_target_url' }, { status: 400, statusText: 'Bad Request' });
    await expect(promise).rejects.toMatchObject({ status: 400, name: 'ApiError' });
  });
});
