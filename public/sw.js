const CACHE='outsideclass-v6';const assets=['/learn','/notebook','/guides','/updates','/activity','/updates.xml','/','/style.css','/app.js','/samples.js','/safety.js','/outsideclass-logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(assets))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('outsideclass-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!assets.includes(url.pathname))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
