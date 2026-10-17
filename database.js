'use strict';
const DB = (function () {
  const NAME = 'AminoCureDrugStock';
  const VERSION = 1;
  const STORES = ['products', 'batches', 'movements', 'stocktakes', 'settings'];
  const DEFAULT_SETTINGS = {
    warn1: 30,
    warn2: 60,
    warn3: 90,
    allowNegative: false,
    theme: 'dark',
    pharmacyName: '',
    demoLoaded: false
  };
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('المتصفح لا يدعم IndexedDB'));
        return;
      }
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = function () {
        const db = r.result;
        let s;
        if (!db.objectStoreNames.contains('products')) {
          s = db.createObjectStore('products', { keyPath: 'id' });
          s.createIndex('name', 'name');
          s.createIndex('barcode', 'barcode');
        }
        if (!db.objectStoreNames.contains('batches')) {
          s = db.createObjectStore('batches', { keyPath: 'id' });
          s.createIndex('productId', 'productId');
          s.createIndex('expiry', 'expiry');
        }
        if (!db.objectStoreNames.contains('movements')) {
          s = db.createObjectStore('movements', { keyPath: 'id' });
          s.createIndex('productId', 'productId');
          s.createIndex('date', 'date');
          s.createIndex('type', 'type');
        }
        if (!db.objectStoreNames.contains('stocktakes')) {
          db.createObjectStore('stocktakes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      r.onsuccess = function () {
        const db = r.result;
        db.onversionchange = function () { db.close(); dbPromise = null; };
        resolve(db);
      };
      r.onerror = function () { dbPromise = null; reject(r.error); };
      r.onblocked = function () {
        dbPromise = null;
        reject(new Error('أغلق باقي نوافذ التطبيق ثم أعد المحاولة'));
      };
    });
    return dbPromise;
  }

  function req(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function tx(names, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const t = db.transaction(names, mode);
        const s = {};
        names.forEach(function (n) { s[n] = t.objectStore(n); });
        let result;
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('تم إلغاء العملية')); };
        Promise.resolve().then(function () { return fn(s); })
          .then(function (r) { result = r; })
          .catch(function (e) {
            try { t.abort(); } catch (x) { /* already finished */ }
            reject(e);
          });
      });
    });
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7);
  }

  function getAll(name) {
    return tx([name], 'readonly', function (s) { return req(s[name].getAll()); });
  }
  function get(name, key) {
    return tx([name], 'readonly', function (s) { return req(s[name].get(key)); });
  }
  function put(name, obj) {
    return tx([name], 'readwrite', function (s) { return req(s[name].put(obj)); });
  }
  function remove(name, key) {
    return tx([name], 'readwrite', function (s) { return req(s[name].delete(key)); });
  }

  function getSettings() {
    return getAll('settings').then(function (rows) {
      const out = Object.assign({}, DEFAULT_SETTINGS);
      rows.forEach(function (r) { out[r.key] = r.value; });
      return out;
    });
  }
  function setSettings(obj) {
    return tx(['settings'], 'readwrite', function (s) {
      const keys = Object.keys(obj);
      return Promise.all(keys.map(function (k) {
        return req(s.settings.put({ key: k, value: obj[k] }));
      }));
    });
  }

  async function nextSeq(settingsStore, name) {
    const key = 'seq_' + name;
    const row = await req(settingsStore.get(key));
    const n = (row ? row.value : 0) + 1;
    await req(settingsStore.put({ key: key, value: n }));
    return n;
  }

  function exportAll() {
    return tx(STORES, 'readonly', async function (s) {
      const out = {};
      for (let i = 0; i < STORES.length; i++) {
        out[STORES[i]] = await req(s[STORES[i]].getAll());
      }
      return out;
    });
  }

  function replaceAll(data) {
    return tx(STORES, 'readwrite', async function (s) {
      for (let i = 0; i < STORES.length; i++) {
        const n = STORES[i];
        await req(s[n].clear());
        const items = Array.isArray(data[n]) ? data[n] : [];
        for (let j = 0; j < items.length; j++) {
          await req(s[n].put(items[j]));
        }
      }
    });
  }

  function mergeAll(data) {
    return tx(STORES, 'readwrite', async function (s) {
      for (let i = 0; i < STORES.length; i++) {
        const n = STORES[i];
        const items = Array.isArray(data[n]) ? data[n] : [];
        for (let j = 0; j < items.length; j++) {
          await req(s[n].put(items[j]));
        }
      }
    });
  }

  function clearAll() {
    return tx(STORES, 'readwrite', async function (s) {
      for (let i = 0; i < STORES.length; i++) {
        await req(s[STORES[i]].clear());
      }
    });
  }

  function requestPersist() {
    if (navigator.storage && navigator.storage.persist) {
      return navigator.storage.persist().catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  return {
    STORES: STORES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    open: open, req: req, tx: tx, uid: uid,
    getAll: getAll, get: get, put: put, remove: remove,
    getSettings: getSettings, setSettings: setSettings,
    nextSeq: nextSeq,
    exportAll: exportAll, replaceAll: replaceAll, mergeAll: mergeAll,
    clearAll: clearAll, requestPersist: requestPersist
  };
})(); 
