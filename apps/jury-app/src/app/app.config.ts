import {
  type ApplicationConfig,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideServiceWorker } from "@angular/service-worker";
import { seedDemo } from "@winnovation/data-access";
import { appRoutes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode(),
      registrationStrategy: "registerWhenStable:30000",
    }),
    // Dev-only: make the WIN-26 demo event (with a full two-judge dataset) joinable
    // out of the box. Never runs in a production build. A failure here is swallowed
    // so it can never block app bootstrap.
    provideAppInitializer(() => {
      if (!isDevMode()) return;
      return seedDemo().catch((err) => console.warn("[demo seed] skipped:", err));
    }),
  ],
};
