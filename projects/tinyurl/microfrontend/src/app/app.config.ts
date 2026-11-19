import { provideRouter } from '@angular/router';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor, provideAuth } from 'shared-ui-lib';
import { LINK_API_BASE_URL } from './links/link-api-base-url';
import { LinkApiService } from './links/link-api.service';
import { appRoutes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    LinkApiService,
    { provide: LINK_API_BASE_URL, useValue: environment.linkApiBaseUrl },
    provideAuth({
      identityLoginBaseUrl: environment.identityLoginBaseUrl,
      apiBaseUrl: environment.apiBaseUrl,
      callbackPath: environment.callbackPath,
      apiUrlPrefixes: environment.apiUrlPrefixes,
    }),
  ],
};
