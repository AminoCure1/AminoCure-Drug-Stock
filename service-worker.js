'use strict';
const CACHE = 'amino-drug-stock-v5';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './views.js',
  './guide.js',
  './database.js',
  './inventory.js',
  './reports.js',
  './barcode.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ملفات اختيارية: لو غير موجودة لا يفشل التثبيت
const OPTIONAL = [
  './ameen.png',
  './html5-qrcode.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(FILES).then(function () {
        return Promise.all(OPTIONAL.map(function (f) {
          return c.add(f).catch(function () { /* تجاهل */ });
        }));
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
