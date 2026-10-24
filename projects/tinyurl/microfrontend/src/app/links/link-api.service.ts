import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SHORT_LINK_BASE_URL } from './short-link-base-url';
import type { Link, LinkListResponse } from './link.types';

/** A failed API call, carrying the HTTP status so callers can render typed messages. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Thin promise wrapper over the public `/api/links` endpoints. */
@Injectable()
export class LinkApiService {
  private readonly http = inject(HttpClient);
  private readonly shortLinkBaseUrl = inject(SHORT_LINK_BASE_URL);

  async list(): Promise<Link[]> {
    const envelope = await this.request<LinkListResponse>('get', '/api/links');
    return envelope.links;
  }

  async create(targetUrl: string): Promise<Link> {
    return this.request<Link>('post', '/api/links', { targetUrl });
  }

  shortUrl(slug: string): string {
    return `${this.shortLinkBaseUrl}/go/${slug}`;
  }

  private async request<T>(method: 'get' | 'post', url: string, body?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.http.request<T>(method, url, { body }).subscribe({ next: resolve, error: reject });
    }).catch((error: unknown) => {
      if (error instanceof ApiError) throw error;
      const status = (error as { status?: number }).status ?? 0;
      throw new ApiError(status, 'The TinyURL service could not be reached');
    });
  }
}
