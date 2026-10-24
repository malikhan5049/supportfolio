import { provideRouter } from '@angular/router';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor, provideAuth } from 'shared-ui-lib';
import { SHORT_LINK_BASE_URL } from './links/short-link-base-url';
import { LinkApiService } from './links/link-api.service';
import { appRoutes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    LinkApiService,
    { provide: SHORT_LINK_BASE_URL, useValue: environment.publicBaseUrl },
    provideAuth({
      identityLoginBaseUrl: environment.identityLoginBaseUrl,
      apiBaseUrl: environment.apiBaseUrl,
      callbackPath: '/auth/callback',
    }),
  ],
};
