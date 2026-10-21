import { Component, inject, output, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthTokenStore } from 'shared-ui-lib';
import { ApiError, LinkApiService } from '../links/link-api.service';
import type { Link } from '../links/link.types';

const ERROR_MESSAGES: Record<number, string> = {
  400: 'That link is not a valid public URL. Only public http(s) targets are accepted.',
  401: 'Your session ended. Sign in to shorten links again.',
  403: 'Your account cannot shorten links.',
  429: 'Hourly cap reached (20 per hour). Try again in the next hour.',
};

/** The signed-in shorten form: typed error states, a copyable short link, `created` on success. */
@Component({
  selector: 'app-shorten-form',
  imports: [RouterLink],
  templateUrl: './shorten-form.component.html',
})
export class ShortenFormComponent {
  private readonly api = inject(LinkApiService);
  private readonly store = inject(AuthTokenStore);

  readonly created = output<Link>();
  readonly shortLink = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly targetUrl = signal('');
  readonly signedOut = signal(false);

  readonly signedIn = computed(() => this.store.session() !== null);

  async shorten(): Promise<void> {
    const url = this.targetUrl();
    if (url.trim().length === 0) return;
    this.error.set(null);
    this.shortLink.set(null);
    try {
      const link = await this.api.create(url);
      this.shortLink.set(this.api.shortUrl(link.slug));
      this.created.emit(link);
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : 0;
      if (status === 401) {
        this.store.clear();
        this.signedOut.set(true);
      }
      this.error.set(ERROR_MESSAGES[status] ?? 'Shortening failed. Try again.');
    }
  }

  async copy(): Promise<void> {
    const url = this.shortLink();
    if (url !== null) await navigator.clipboard.writeText(url);
  }
}
