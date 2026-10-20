import { Component, inject, signal } from '@angular/core';
import { CatalogService } from './catalog.service';
import { RemoteCardHostComponent } from './remote-card-host.component';
import type { RemoteProject } from './registry.types';

/** The catalog: one card per registry project, or a visible error state — never a silent empty grid. */
@Component({
  selector: 'app-catalog-page',
  templateUrl: './catalog-page.component.html',
  imports: [RemoteCardHostComponent],
})
export class CatalogPageComponent {
  private readonly catalog = inject(CatalogService);

  readonly projects = signal<RemoteProject[] | null>(null);
  readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const projects = await this.catalog.loadProjects();
      this.projects.set(projects);
      this.failed.set(false);
    } catch {
      this.projects.set(null);
      this.failed.set(true);
    }
  }
}
