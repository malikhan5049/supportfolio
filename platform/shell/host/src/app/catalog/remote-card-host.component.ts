import {
  Component,
  EventEmitter,
  Input,
  ViewChild,
  ViewContainerRef,
  inject,
  signal,
} from '@angular/core';
import type { ComponentRef, Type } from '@angular/core';
import { RemoteRegistryService } from 'shared-ui-lib';
import type { RemoteProject } from './registry.types';

interface CardMetadata {
  title: string;
  description: string;
  features: string[];
  openUrl: string;
}

function metadataFor(project: RemoteProject): CardMetadata {
  return {
    title: project.displayName,
    description: project.shortDescription,
    features: project.features,
    openUrl: project.openUrl,
  };
}

function applyMetadata(ref: ComponentRef<unknown>, metadata: CardMetadata): void {
  ref.setInput('title', metadata.title);
  ref.setInput('description', metadata.description);
  ref.setInput('features', metadata.features);
  ref.setInput('openUrl', metadata.openUrl);
}

/**
 * Bridges registry -> component: resolves the project's `./card` module through the dynamic
 * registry and creates it inside a container. On any failure — remote down, CSP-blocked, missing
 * default export — an explicit offline tile renders instead, so the grid never loses a project.
 */
@Component({
  selector: 'app-remote-card-host',
  template: `
    <section [attr.data-testid]="remoteBacked() ? 'remote-card-' + project.id : null">
      <ng-container #host></ng-container>
      @if (offline()) {
        <article class="card" data-testid="remote-card-offline">
          <h3 class="card-title">{{ project.displayName || 'Untitled project' }}</h3>
          <p class="card-description">{{ project.shortDescription }}</p>
          <ul class="card-features">
            @for (feature of project.features; track feature) {
              <li>{{ feature }}</li>
            }
          </ul>
          <p class="card-offline-badge" role="status">Offline</p>
        </article>
      }
    </section>
  `,
})
export class RemoteCardHostComponent {
  @Input({ required: true }) project!: RemoteProject;

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private readonly registry = inject(RemoteRegistryService);

  readonly remoteBacked = signal(false);

  readonly offline = signal(false);

  async ngOnInit(): Promise<void> {
    const metadata = metadataFor(this.project);
    this.remoteBacked.set(false);
    this.offline.set(false);
    this.host.clear();
    try {
      const component = await this.resolveCard();
      this.remoteBacked.set(true);
      const ref = this.host.createComponent(component);
      this.wireOpenAction(ref.instance, metadata);
      applyMetadata(ref, metadata);
    } catch {
      this.offline.set(true);
    }
  }

  /** Both card shapes expose an optional `open` output; the shell owns opening the URL. */
  private wireOpenAction(instance: unknown, metadata: CardMetadata): void {
    const output = (instance as { open?: EventEmitter<void> }).open;
    if (!output) {
      return;
    }
    output.subscribe(() => {
      window.open(metadata.openUrl, '_blank', 'noopener,noreferrer');
    });
  }

  private async resolveCard(): Promise<Type<unknown>> {
    const entry = this.project.exposedModules.find((module) => module.moduleName === 'card');
    if (!entry) {
      throw new Error('Project exposes no card module');
    }
    const ref = await this.registry.resolveModule(this.project.id, entry.moduleName);
    const component = (await ref.load()) as Type<unknown>;
    if (!component) {
      throw new Error('Exposed module resolved to nothing');
    }
    return component;
  }
}
