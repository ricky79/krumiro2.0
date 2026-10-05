import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CACHE_AVVISI, chiaveCache, notificaDaPush, opzioniNotifica } from './core/avvisiPush';

/** Service worker della PWA: app offline (precache) e notifiche degli avvisi (web push dal backend). */

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

// Aggiornamento automatico (registerType 'autoUpdate'): la nuova versione prende subito il controllo.
void self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// App a pagina singola: ogni navigazione riceve index.html dalla precache, anche offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

/** Il payload del push, o null se manca o non è JSON. */
function leggiPayload(evento: PushEvent): unknown {
  try {
    return evento.data?.json() ?? null;
  } catch {
    return null;
  }
}

/** Il testo lasciato dalla pagina per questo avviso, o null. */
async function testoSalvato(id: string): Promise<unknown> {
  try {
    const voce = await (await caches.open(CACHE_AVVISI)).match(chiaveCache(self.registration.scope, id));
    return voce ? await voce.json() : null;
  } catch {
    return null;
  }
}

self.addEventListener('push', (evento) => {
  const payload = leggiPayload(evento);
  const id = typeof payload === 'object' && payload !== null && 'id' in payload && typeof payload.id === 'string' ? payload.id : null;
  evento.waitUntil(
    (async () => {
      const n = notificaDaPush(payload, id ? await testoSalvato(id) : null);
      await self.registration.showNotification(n.titolo, opzioniNotifica(n));
      if (id) {
        await caches
          .open(CACHE_AVVISI)
          .then((c) => c.delete(chiaveCache(self.registration.scope, id)))
          .catch(() => undefined);
      }
    })(),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const app = finestre.find((c) => c.url.startsWith(self.registration.scope));
      if (app) await app.focus();
      else await self.clients.openWindow(self.registration.scope);
    })(),
  );
});
