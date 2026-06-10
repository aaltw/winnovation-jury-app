import {
  type ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { SwUpdate, provideServiceWorker } from "@angular/service-worker";
import { seedDemo } from "@winnovation/data-access";
import { JuryStore } from "@winnovation/feature-jury";
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
    // Force-update installed PWAs: as soon as the service worker has a new
    // version ready, activate it and reload. Without this, clients only get a
    // new build on their *second* visit. Local state lives in IndexedDB, so a
    // reload loses nothing.
    provideAppInitializer(() => {
      const updates = inject(SwUpdate);
      if (!updates.isEnabled) return;
      updates.versionUpdates.subscribe((ev) => {
        if (ev.type === "VERSION_READY") {
          void updates.activateUpdate().then(() => document.location.reload());
        }
      });
      void updates.checkForUpdate().catch(() => false);
    }),
    // Restore the last {eventId, judge} so a refresh lands back in the event
    // instead of the join screen. Runs before routing; failures are swallowed.
    provideAppInitializer(() => {
      const store = inject(JuryStore);
      return store.restoreSession().catch(() => false);
    }),
  ],
};
