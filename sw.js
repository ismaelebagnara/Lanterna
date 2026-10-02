// Service worker: tiene l'app disponibile offline e riceve le immagini condivise da altre app.
const CACHE = "lanterna-v12";
const FILES = ["./", "./index.html", "./styles.css", "./app.js", "./seed.js", "./srd.js", "./rules.js", "./gen.js", "./manifest.webmanifest",
  "./fonts/Cinzel.ttf", "./fonts/CrimsonPro.ttf", "./fonts/CrimsonPro-Italic.ttf",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"];
// cache: "reload" scavalca la cache HTTP del browser, così una versione nuova non riprende i file vecchi
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("message", (e) => { if (e.data === "version") e.source.postMessage({ version: CACHE }); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("lanterna-mappe", 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("maps", { keyPath: "id" }); d.createObjectStore("blobs"); d.createObjectStore("index", { keyPath: "id" }); d.createObjectStore("inbox", { autoIncrement: true }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function receiveShare(request) {
  try {
    const fd = await request.formData();
    const files = fd.getAll("maps").filter((f) => f && f.size && /^image\//.test(f.type));
    const text = [fd.get("title"), fd.get("text")].filter(Boolean).join(" ");
    if (files.length) {
      const db = await openDb();
      await new Promise((res, rej) => { const t = db.transaction("inbox", "readwrite"); const st = t.objectStore("inbox");
        files.forEach((f) => st.add({ file: f, name: f.name, text })); t.oncomplete = res; t.onerror = () => rej(t.error); });
    }
  } catch (e) { /* in caso di errore l'app si apre comunque */ }
  return Response.redirect("./index.html#/mappe", 303);
}
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) { e.respondWith(receiveShare(e.request)); return; }
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone(); if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match("./index.html"))));
});
