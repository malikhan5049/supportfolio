import { Component, inject, signal } from '@angular/core';
import { ShortenFormComponent } from '../shorten/shorten-form.component';
import { LinkApiService } from '../links/link-api.service';
import type { Link } from '../links/link.types';

/** The public browse page: shorten form for everyone, one row per link with its click count. */
@Component({
  selector: 'app-browse-page',
  imports: [ShortenFormComponent],
  templateUrl: './browse-page.component.html',
})
export class BrowsePageComponent {
  private readonly api = inject(LinkApiService);

  readonly links = signal<Link[] | null>(null);
  readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  onCreate(): void {
    void this.load();
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
