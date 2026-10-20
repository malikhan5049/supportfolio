import type { Type } from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import type { RemoteModuleEntry } from 'shared-ui-lib';
import type { RemoteCardComponent } from 'shared-ui-lib';

/**
 * The one dynamic-loading primitive: every load is driven by the runtime registry's remoteEntry —
 * there is no build-time remote name resolution to get stale.
 */
export async function loadFederatedCard(
  entry: RemoteModuleEntry,
): Promise<Type<RemoteCardComponent>> {
  const module = await loadRemoteModule({
    remoteEntry: entry.remoteEntry,
    remoteName: entry.projectId,
    exposedModule: './' + entry.moduleName,
  });
  const component = module.default;
  if (!component) {
    throw new Error(`Exposed module ./${entry.moduleName} has no default component`);
  }
  return component as Type<RemoteCardComponent>;
}
