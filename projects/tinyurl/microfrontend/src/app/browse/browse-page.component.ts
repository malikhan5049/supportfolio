import { Component, inject, signal } from '@angular/core';
import { LinkApiService } from '../links/link-api.service';
import type { Link } from '../links/link.types';

/** The public browse page: one row per link with its click count, or explicit empty/error states. */
@Component({
  selector: 'app-browse-page',
  templateUrl: './browse-page.component.html',
})
export class BrowsePageComponent {
  private readonly api = inject(LinkApiService);

  readonly links = signal<Link[] | null>(null);
  readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    try {
      this.links.set(await this.api.list());
      this.failed.set(false);
    } catch {
      this.links.set(null);
      this.failed.set(true);
    }
  }
}
