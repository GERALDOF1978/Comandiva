/* Dishy PWA: installation support only. Never intercept app navigation, APIs or tenant resources. */
const CACHE="dishy-static-v2";
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/dishy-icon.svg","/manifest.webmanifest"])));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
/* No fetch interception: avoids rejected respondWith promises and preserves server routing. */
