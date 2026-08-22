const CACHE_NAME = 'velmora-v6.19.0';

// Cache separata per le immagini dello Storage. Non viene svuotata quando
// cambia la versione dell'applicazione: gli URL delle immagini contengono
// una marca temporale e sono immutabili, quindi ciò che è stato scaricato
// una volta resta valido per sempre e non ha alcun bisogno di rivalidazione.
// È qui che si risolve il consumo di banda: la maggior parte dei file nel
// bucket porta un'intestazione `max-age=3600`, e senza questa cache ogni
// dispositivo li riscaricava più volte nella stessa serata.
const IMG_CACHE = 'velmora-img-v1';

const SHELL = [
  '/velmora',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

/** Riconosce un oggetto pubblico dello Storage di Supabase. */
function isStorageImage(url) {
  return url.includes('/storage/v1/object/public/');
}

/** Chiave dello slot: tutto ciò che precede il primo punto del nome file. */
function slotKeyOf(url) {
  const name = url.split('/').pop() || '';
  const dot = name.indexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return url.slice(0, url.length - name.length) + base;   // cartella + slot
}

/**
 * Toglie dalla cache le versioni superate dello stesso slot. Quando il DM
 * sostituisce un'immagine il nome cambia, e la vecchia resterebbe a
 * occupare spazio senza che nessuno la chieda più.
 */
async function pruneOldVersions(cache, freshUrl) {
  const key = slotKeyOf(freshUrl);
  const keys = await cache.keys();
  await Promise.all(keys.map(req =>
    (req.url !== freshUrl && slotKeyOf(req.url) === key) ? cache.delete(req) : null
  ));
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k !== CACHE_NAME && k !== IMG_CACHE)
        .map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;

  // Immagini dello Storage: prima la cache, poi la rete.
  if (isStorageImage(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const hit = await cache.match(url);
      if (hit) return hit;
      try {
        // Richiesta esplicita in CORS invece di lasciar passare quella
        // dell'elemento <img>, che sarebbe opaca: una risposta opaca si può
        // conservare, ma i browser la contabilizzano nella quota con un
        // sovrapprezzo molto pesante, e con qualche centinaio di immagini
        // farebbe scoppiare lo spazio disponibile.
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (res && res.ok) {
          try {
            await cache.put(url, res.clone());
            await pruneOldVersions(cache, url);
          } catch (err) {
            // Quota esaurita: svuoto la cache immagini e riparto pulito
            // invece di lasciare il salvataggio in uno stato incoerente.
            if (err && err.name === 'QuotaExceededError') await caches.delete(IMG_CACHE);
          }
        }
        return res;
      } catch {
        // Rete assente e nulla in cache: lascio fallire come farebbe il browser
        return fetch(e.request);
      }
    })());
    return;
  }

  // Ogni altra chiamata a Supabase (dati, realtime, storage non pubblico)
  // resta di competenza della rete: non va né intercettata né conservata.
  if (url.includes('supabase')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
