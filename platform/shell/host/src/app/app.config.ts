import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideAuth, authInterceptor } from 'shared-ui-lib';
import { environment } from '../environments/environment';
import { CatalogService } from './catalog/catalog.service';
import { provideRemoteRegistry } from './catalog/remote-registry.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAuth(),
    provideRemoteRegistry(environment.registryUrl),
    CatalogService,
  ],
};
