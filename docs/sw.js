/* AzubiPass · Zwischenspeicher
   Erzeugt von build_app.py — nicht von Hand bearbeiten.

   Der Name des Speichers trägt das Baudatum. Ein neuer Bau legt deshalb einen
   neuen an und räumt die alten weg; ein halb altes, halb neues Gemisch kann es
   nicht geben.

   Bewusst ohne skipWaiting: Eine neue Fassung übernimmt nicht mitten im Lesen,
   sondern meldet sich in der App und wartet, bis jemand sie anfordert. */

var SPEICHER = "azubipass-20260810-215749";
var VORRAT = [
  "./",
  "app.html",
  "app.html",
  "buchfuehrung.html",
  "datenschutz.html",
  "impressum.html",
  "index.html",
  "lf1.html",
  "lf10.html",
  "lf11.html",
  "lf12.html",
  "lf13.html",
  "lf2.html",
  "lf3.html",
  "lf4.html",
  "lf5.html",
  "lf7.html",
  "lf8.html",
  "lf9.html",
  "manifest.webmanifest",
  "mittel/app.js",
  "mittel/azubipass.css",
  "mittel/azubipass.js",
  "mittel/ibm-plex-mono-400-latin-ext.woff2",
  "mittel/ibm-plex-mono-400-latin.woff2",
  "mittel/ibm-plex-mono-500-latin-ext.woff2",
  "mittel/ibm-plex-mono-500-latin.woff2",
  "mittel/ibm-plex-sans-400-latin-ext.woff2",
  "mittel/ibm-plex-sans-400-latin.woff2",
  "mittel/ibm-plex-sans-500-latin-ext.woff2",
  "mittel/ibm-plex-sans-500-latin.woff2",
  "mittel/ibm-plex-sans-600-latin-ext.woff2",
  "mittel/ibm-plex-sans-600-latin.woff2",
  "mittel/inhalt.json",
  "mittel/kern.js",
  "mittel/landing.css",
  "mittel/landing.js",
  "mittel/schriften.css",
  "mittel/source-serif-4-400-latin-ext.woff2",
  "mittel/source-serif-4-400-latin.woff2",
  "mittel/source-serif-4-600-kursiv-latin-ext.woff2",
  "mittel/source-serif-4-600-kursiv-latin.woff2",
  "mittel/source-serif-4-600-latin-ext.woff2",
  "mittel/source-serif-4-600-latin.woff2",
  "mittel/source-serif-4-700-latin-ext.woff2",
  "mittel/source-serif-4-700-latin.woff2",
  "mittel/suche.json",
  "mittel/symbol-180.png",
  "mittel/symbol-192.png",
  "mittel/symbol-512.png",
  "mittel/symbol.svg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SPEICHER).then(function (c) {
    // Einzeln statt addAll: Eine fehlende Datei soll nicht die ganze
    // Installation scheitern lassen — dann liefe gar nichts offline.
    return Promise.all(VORRAT.map(function (u) {
      return c.add(new Request(u, { cache: "reload" })).catch(function () {});
    }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (namen) {
    return Promise.all(namen.map(function (n) {
      return n !== SPEICHER && n.indexOf("azubipass-") === 0 ? caches.delete(n) : null;
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) {
  if (e.data === "uebernehmen") self.skipWaiting();
});

self.addEventListener("fetch", function (e) {
  var anfrage = e.request;
  if (anfrage.method !== "GET") return;
  var url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(anfrage, { ignoreSearch: true }).then(function (treffer) {
      if (treffer) return treffer;
      return fetch(anfrage).then(function (antwort) {
        if (antwort && antwort.ok && antwort.type === "basic") {
          var kopie = antwort.clone();
          caches.open(SPEICHER).then(function (c) { c.put(anfrage, kopie); });
        }
        return antwort;
      }).catch(function () {
        // Ohne Netz und ohne Vorrat: Wenigstens die App statt eines
        // Browserfehlers, damit man von dort weiterkommt.
        return anfrage.mode === "navigate" ? caches.match("app.html") : Response.error();
      });
    })
  );
});
