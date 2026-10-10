const VERSION = "20261013a";
const CACHE = "ptu3d-" + VERSION;
const CORE = [
 "./",
 "./index.html",
 "./manifest.json",
 "css/style.css?v=20261013a",
 "js/core.js?v=20261013a",
 "js/textures.js?v=20261013a",
 "js/audio.js?v=20261013a",
 "js/state.js?v=20261013a",
 "js/gameplay.js?v=20261013a",
 "js/renderer.js?v=20261013a",
 "js/decor.js?v=20261013a",
 "js/face.js?v=20261013a",
 "js/weapons.js?v=20261013a",
 "js/ui.js?v=20261013a",
 "js/net.js?v=20261013a",
 "js/coopgame.js?v=20261013a",
 "js/main.js?v=20261013a",
 "assets/icons/icon-192.png",
 "assets/icons/icon-512.png",
 "assets/icons/maskable-512.png",
 "assets/icons/apple-180.png",
 "assets/icons/favicon-32.png"
];
const OPTIONAL = [
 "assets/enemies/enemy.jpg",
 "assets/enemies/final-boss.jpg",
 "assets/sounds/heartbreath.mp3",
 "assets/sounds/rbdsound1.mp3",
 "assets/sounds/rbdsound2.mp3",
 "assets/ui/boss-intro.jpg",
 "assets/ui/deathbg.jpg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE);
    await Promise.all(OPTIONAL.map(u => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("ptu3d-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fromNetwork(req, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate"){
    e.respondWith(fromNetwork(req, 4000).then(r => {
      if (r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
      return r;
    }).catch(() => caches.match("./index.html").then(hit => hit || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && r.type === "basic"){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
