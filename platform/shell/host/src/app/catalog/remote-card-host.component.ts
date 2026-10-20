import {
  Component,
  Input,
  ViewChild,
  ViewContainerRef,
  inject,
  signal,
} from '@angular/core';
import type { ComponentRef, Type } from '@angular/core';
import { CardComponent, RemoteRegistryService } from 'shared-ui-lib';
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
 * default export — the shared fallback card renders instead, so the grid never loses a project.
 */
@Component({
  selector: 'app-remote-card-host',
  template:
    '<section [attr.data-testid]="remoteBacked() ? \'remote-card-\' + project.id : null"><ng-container #host></ng-container></section>',
})
export class RemoteCardHostComponent {
  @Input({ required: true }) project!: RemoteProject;

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private readonly registry = inject(RemoteRegistryService);

  readonly remoteBacked = signal(false);

  async ngOnInit(): Promise<void> {
    const metadata = metadataFor(this.project);
    this.remoteBacked.set(false);
    this.host.clear();
    try {
      const component = await this.resolveCard();
      this.remoteBacked.set(true);
      applyMetadata(this.host.createComponent(component), metadata);
    } catch {
      applyMetadata(this.host.createComponent(CardComponent), metadata);
    }
  }

  private async resolveCard(): Promise<Type<unknown>> {
    const entry = this.project.exposedModules[0];
    const ref = await this.registry.resolveModule(this.project.id, entry.moduleName);
    const component = (await ref.load()) as Type<unknown>;
    if (!component) {
      throw new Error('Exposed module resolved to nothing');
    }
    return component;
  }
}
