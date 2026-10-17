'use strict';
const INV = (function () {
  const R = DB.req;
  const TYPES = {
    in: { label: 'وارد', kind: 'in' },
    out: { label: 'صادر', kind: 'out' },
    initial: { label: 'رصيد افتتاحي', kind: 'in' },
    return: { label: 'مرتجع', kind: 'in' },
    damaged: { label: 'تالف', kind: 'out' },
    expired: { label: 'إزالة منتهي', kind: 'out' },
    count: { label: 'تسوية جرد', kind: 'set' },
    correction: { label: 'تصحيح', kind: 'adj' }
  };
  const CSV_COLS = ['name', 'brand', 'ingredient', 'strength', 'form', 'pack', 'barcode', 'manufacturer', 'supplier', 'cost', 'price', 'minStock', 'location', 'notes', 'qty', 'lot', 'expiry'];

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return ymd(new Date()); }
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
  function localDay(iso) { const d = new Date(iso); return isNaN(d) ? '' : ymd(d); }
  function isDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const p = s.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }
  function daysUntil(s) {
    const p = s.split('-').map(Number);
    const t = new Date(p[0], p[1] - 1, p[2]);
    const n = new Date();
    const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((t - t0) / 86400000);
  }
  function fmtDate(s) { if (!s) return '—'; const p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function fmtDT(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function expiryStatus(exp, st) {
    if (!exp) return 'none';
    const d = daysUntil(exp);
    if (d < 0) return 'expired';
    if (d <= st.warn1) return 'w1';
    if (d <= st.warn2) return 'w2';
    if (d <= st.warn3) return 'w3';
    return 'ok';
  }
  function expLabel(s, st) {
    if (s === 'expired') return 'منتهي';
    if (s === 'w1') return '≤ ' + st.warn1 + ' يوم';
    if (s === 'w2') return '≤ ' + st.warn2 + ' يوم';
    if (s === 'w3') return '≤ ' + st.warn3 + ' يوم';
    return 'سليم';
  }
  function byName(a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); }
  function sortBatches(bs) { return bs.slice().sort(function (a, b) { return a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : 0; }); }
  function reorderQty(target, avail) {
    const t = Number(target), a = Number(avail);
    if (isNaN(t) || isNaN(a)) return 0;
    return Math.max(0, Math.ceil(t - a));
  }

  function normKey(p) {
    return [p.name, p.strength, p.form, p.pack].map(function (x) {
      return String(x || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }).join('|');
  }
  function findDuplicates(data, products, excludeId) {
    const k = normKey(data);
    return products.filter(function (p) {
      if (p.id === excludeId) return false;
      if (normKey(p) === k) return true;
      return data.barcode && p.barcode && String(p.barcode).trim() === String(data.barcode).trim();
    });
  }

  function cleanProduct(r) {
    const t = function (k) { return String(r[k] == null ? '' : r[k]).trim(); };
    const errors = [];
    const d = {
      name: t('name'), brand: t('brand'), ingredient: t('ingredient'), strength: t('strength'),
      form: t('form'), pack: t('pack'), barcode: t('barcode'), manufacturer: t('manufacturer'),
      supplier: t('supplier'), location: t('location'), notes: t('notes')
    };
    if (!d.name) errors.push({ field: 'name', msg: 'اسم المنتج مطلوب' });
    [['cost', 'سعر الشراء'], ['price', 'سعر البيع']].forEach(function (x) {
      const v = t(x[0]);
      if (v === '') { d[x[0]] = ''; return; }
      const n = Number(v);
      if (isNaN(n) || n < 0) errors.push({ field: x[0], msg: x[1] + ' غير صالح' });
      else d[x[0]] = n;
    });
    const m = t('minStock');
    if (m === '') d.minStock = 0;
    else {
      const n = Number(m);
      if (!Number.isInteger(n) || n < 0) errors.push({ field: 'minStock', msg: 'الحد الأدنى يجب أن يكون عدداً صحيحاً ≥ 0' });
      else d.minStock = n;
    }
    return { data: d, errors: errors };
  }

  async function createProductIn(s, data, extra) {
    const n = await DB.nextSeq(s.settings, 'product');
    const now = new Date().toISOString();
    const p = Object.assign({}, data, { id: 'P' + String(n).padStart(5, '0'), archived: false, createdAt: now, updatedAt: now }, extra || {});
    await R(s.products.add(p));
    return p;
  }

  function saveProduct(data, id) {
    return DB.tx(['products', 'settings'], 'readwrite', async function (s) {
      if (id) {
        const old = await R(s.products.get(id));
        if (!old) throw new Error('المنتج غير موجود');
        const p = Object.assign({}, old, data, { id: id, updatedAt: new Date().toISOString() });
        await R(s.products.put(p));
        return p;
      }
      return createProductIn(s, data);
    });
  }
  function archiveProduct(id, flag) {
    return DB.tx(['products'], 'readwrite', async function (s) {
      const p = await R(s.products.get(id));
      if (!p) throw new Error('المنتج غير موجود');
      p.archived = !!flag;
      p.updatedAt = new Date().toISOString();
      await R(s.products.put(p));
    });
  }
  function deleteProduct(id) {
    return DB.tx(['products', 'batches', 'movements'], 'readwrite', async function (s) {
      const mv = await R(s.movements.index('productId').getAll(id));
      if (mv.length) throw new Error('لا يمكن حذف منتج له حركات مخزون. استخدم الأرشفة للحفاظ على السجل.');
      const bs = await R(s.batches.index('productId').getAll(id));
      for (let i = 0; i < bs.length; i++) await R(s.batches.delete(bs[i].id));
      await R(s.products.delete(id));
    });
  }

  async function settingsIn(store) {
    const rows = await R(store.getAll());
    const o = Object.assign({}, DB.DEFAULT_SETTINGS);
    rows.forEach(function (r) { o[r.key] = r.value; });
    return o;
  }

  async function applyMovement(s, st, inp) {
    const T = TYPES[inp.type];
    if (!T) throw new Error('نوع الحركة غير معروف');
    if (!inp.productId) throw new Error('اختر المنتج');
    const product = await R(s.products.get(inp.productId));
    if (!product) throw new Error('اختر المنتج');
    const qty = Number(inp.qty);
    if (!Number.isInteger(qty)) throw new Error('الكمية يجب أن تكون عدداً صحيحاً');
    if (T.kind === 'adj') { if (qty === 0) throw new Error('مقدار التصحيح لا يمكن أن يكون صفراً'); }
    else if (T.kind === 'set') { if (qty < 0) throw new Error('الكمية المعدودة لا يمكن أن تكون سالبة'); }
    else if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من صفر');
    const now = new Date().toISOString();
    let batch = null, prev = 0;
    if (T.kind === 'in') {
      if (product.archived) throw new Error('المنتج مؤرشف. استعده من الأرشيف أولاً');
      const exp = String(inp.expiry || '').trim();
      if (!isDate(exp)) throw new Error('تاريخ الصلاحية مطلوب');
      const lot = String(inp.lot || '').trim();
      const all = await R(s.batches.index('productId').getAll(product.id));
      batch = all.find(function (b) { return b.expiry === exp && String(b.lot || '').toLowerCase() === lot.toLowerCase(); });
      if (batch) prev = batch.quantity;
      else {
        let cost = (inp.cost === '' || inp.cost == null) ? '' : Number(inp.cost);
        if (cost !== '' && (isNaN(cost) || cost < 0)) throw new Error('سعر الشراء غير صالح');
        const rec = inp.received && isDate(inp.received) ? inp.received : todayStr();
        batch = { id: DB.uid('B'), productId: product.id, lot: lot, expiry: exp, quantity: 0, cost: cost, supplier: String(inp.supplier || '').trim(), received: rec, createdAt: now };
      }
    } else {
      if (!inp.batchId) throw new Error('اختر الدفعة');
      batch = await R(s.batches.get(inp.batchId));
      if (!batch || batch.productId !== product.id) throw new Error('اختر الدفعة');
      prev = batch.quantity;
      if (inp.type === 'out' && daysUntil(batch.expiry) < 0) throw new Error('هذه الدفعة منتهية الصلاحية، لا تُصرف. سجّلها كـ «إزالة منتهي».');
    }
    let next;
    if (T.kind === 'out') next = prev - qty;
    else if (T.kind === 'set') next = qty;
    else next = prev + qty;
    if (next < 0 && !st.allowNegative) throw new Error('الكمية غير كافية. المتاح في الدفعة: ' + prev);
    batch.quantity = next;
    batch.updatedAt = now;
    await R(s.batches.put(batch));
    const mv = {
      id: inp.id || DB.uid('M'), date: now, productId: product.id, productName: product.name,
      batchId: batch.id, lot: batch.lot, expiry: batch.expiry, type: inp.type,
      delta: next - prev, qty: Math.abs(next - prev), prevQty: prev, newQty: next,
      ref: String(inp.ref || '').trim(), notes: String(inp.notes || '').trim()
    };
    try { await R(s.movements.add(mv)); }
    catch (e) {
      if (e && e.name === 'ConstraintError') throw new Error('تم تسجيل هذه الحركة من قبل');
      throw e;
    }
    return mv;
  }

  function recordMovement(inp) {
    return DB.tx(['products', 'batches', 'movements', 'settings'], 'readwrite', async function (s) {
      const st = await settingsIn(s.settings);
      return applyMovement(s, st, inp);
    });
  }

  function summarize(products, batches, st) {
    const m = {};
    products.forEach(function (p) { m[p.id] = { p: p, total: 0, avail: 0, expiredQty: 0, nearQty: 0, firstExp: '', batches: [] }; });
    batches.forEach(function (b) {
      const e = m[b.productId];
      if (!e) return;
      e.batches.push(b);
      e.total += b.quantity;
      if (b.quantity <= 0) return;
      const s = expiryStatus(b.expiry, st);
      if (s === 'expired') e.expiredQty += b.quantity;
      else { e.avail += b.quantity; if (s !== 'ok') e.nearQty += b.quantity; }
      if (!e.firstExp || b.expiry < e.firstExp) e.firstExp = b.expiry;
    });
    return m;
  }

  function stats(products, batches, movements, st) {
    const act = products.filter(function (p) { return !p.archived; });
    const m = summarize(act, batches, st);
    let units = 0, nb = 0, exp = 0, near = 0;
    batches.forEach(function (b) {
      if (!m[b.productId]) return;
      units += b.quantity;
      if (b.quantity > 0) {
        nb++;
        const s = expiryStatus(b.expiry, st);
        if (s === 'expired') exp++; else if (s !== 'ok') near++;
      }
    });
    const low = [], zero = [];
    act.forEach(function (p) {
      const e = m[p.id];
      if (e.avail <= 0) zero.push(p);
      if (p.minStock > 0 && e.avail < p.minStock) low.push(p);
    });
    const recent = movements.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 8);
    return { products: act.length, batches: nb, units: units, expired: exp, near: near, low: low, zero: zero, recent: recent };
  }

  function startStocktake(productIds, note) {
    return DB.tx(['products', 'batches', 'stocktakes'], 'readwrite', async function (s) {
      const prods = await R(s.products.getAll());
      const bs = await R(s.batches.getAll());
      const set = productIds && productIds.length ? new Set(productIds) : null;
      const pm = {};
      prods.forEach(function (p) { pm[p.id] = p; });
      const items = bs.filter(function (b) {
        const p = pm[b.productId];
        return p && !p.archived && b.quantity > 0 && (!set || set.has(b.productId));
      }).map(function (b) {
        const p = pm[b.productId];
        return { batchId: b.id, productId: p.id, productName: p.name, strength: p.strength || '', lot: b.lot || '', expiry: b.expiry, expected: b.quantity, counted: null };
      }).sort(function (a, b) { return a.productName.localeCompare(b.productName, 'ar'); });
      if (!items.length) throw new Error('لا توجد دفعات متوفرة للجرد في هذا النطاق');
      const st = { id: DB.uid('S'), date: new Date().toISOString(), scope: set ? 'selected' : 'all', status: 'open', note: String(note || '').trim(), items: items, result: null };
      await R(s.stocktakes.add(st));
      return st;
    });
  }
  function setCount(stId, batchId, value) {
    return DB.tx(['stocktakes'], 'readwrite', async function (s) {
      const st = await R(s.stocktakes.get(stId));
      if (!st || st.status !== 'open') throw new Error('الجرد غير مفتوح');
      const it = st.items.find(function (i) { return i.batchId === batchId; });
      if (!it) throw new Error('الدفعة غير موجودة في هذا الجرد');
      if (value === '' || value == null) it.counted = null;
      else {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) throw new Error('الكمية المعدودة يجب أن تكون عدداً صحيحاً ≥ 0');
        it.counted = n;
      }
      await R(s.stocktakes.put(st));
    });
  }
  function diff(st) {
    const r = { short: [], surp: [], same: [], uncounted: 0 };
    st.items.forEach(function (i) {
      if (i.counted == null) { r.uncounted++; return; }
      const d = i.counted - i.expected;
      (d < 0 ? r.short : d > 0 ? r.surp : r.same).push(Object.assign({ diff: d }, i));
    });
    return r;
  }
  function confirmStocktake(stId) {
    return DB.tx(['products', 'batches', 'movements', 'settings', 'stocktakes'], 'readwrite', async function (s) {
      const st = await R(s.stocktakes.get(stId));
      if (!st || st.status !== 'open') throw new Error('الجرد غير مفتوح');
      const set = await settingsIn(s.settings);
      const rows = [];
      for (let k = 0; k < st.items.length; k++) {
        const i = st.items[k];
        if (i.counted == null) continue;
        const b = await R(s.batches.get(i.batchId));
        if (!b) continue;
        let applied = false;
        const before = b.quantity;
        if (b.quantity !== i.counted) {
          await applyMovement(s, set, { type: 'count', productId: i.productId, batchId: i.batchId, qty: i.counted, ref: st.id, notes: 'تسوية جرد' });
          applied = true;
        }
        rows.push({ batchId: i.batchId, productName: i.productName, lot: i.lot, expiry: i.expiry, expected: i.expected, counted: i.counted, diff: i.counted - i.expected, prevQty: before, applied: applied });
      }
      st.status = 'done';
      st.confirmedAt = new Date().toISOString();
      st.result = rows;
      await R(s.stocktakes.put(st));
      return st;
    });
  }
  function cancelStocktake(stId) {
    return DB.tx(['stocktakes'], 'readwrite', async function (s) {
      const st = await R(s.stocktakes.get(stId));
      if (!st || st.status !== 'open') throw new Error('الجرد غير مفتوح');
      st.status = 'cancelled';
      await R(s.stocktakes.put(st));
    });
  }

  const DEMO = [
    { name: '[تجريبي] Paracetamol', ingredient: 'Paracetamol', strength: '500mg', form: 'أقراص', pack: 'علبة 20 قرص', min: 10, b: [['DEMO-A1', -15, 5], ['DEMO-A2', 25, 12], ['DEMO-A3', 400, 30]] },
    { name: '[تجريبي] Amoxicillin', ingredient: 'Amoxicillin', strength: '500mg', form: 'كبسولات', pack: 'علبة 16 كبسولة', min: 8, b: [['DEMO-B1', 50, 6]] },
    { name: '[تجريبي] أملاح الجفاف', ingredient: '', strength: '', form: 'أكياس', pack: 'كيس', min: 20, b: [['DEMO-C1', 80, 40]] },
    { name: '[تجريبي] Ibuprofen', ingredient: 'Ibuprofen', strength: '400mg', form: 'أقراص', pack: 'علبة 30 قرص', min: 10, b: [['DEMO-D1', 200, 15]] },
    { name: '[تجريبي] محلول ملحي', ingredient: 'Sodium chloride', strength: '0.9%', form: 'محلول', pack: 'زجاجة 500 مل', min: 10, b: [] }
  ];
  function loadDemo() {
    return DB.tx(['products', 'batches', 'movements', 'settings'], 'readwrite', async function (s) {
      const set = await settingsIn(s.settings);
      const ps = await R(s.products.getAll());
      if (ps.some(function (p) { return p.demo; })) throw new Error('البيانات التجريبية موجودة بالفعل');
      for (let i = 0; i < DEMO.length; i++) {
        const d = DEMO[i];
        const p = await createProductIn(s, { name: d.name, brand: '', ingredient: d.ingredient, strength: d.strength, form: d.form, pack: d.pack, barcode: '', manufacturer: '', supplier: '', cost: '', price: '', minStock: d.min, location: '', notes: 'بيانات تجريبية' }, { demo: true });
        for (let j = 0; j < d.b.length; j++) {
          await applyMovement(s, set, { type: 'initial', productId: p.id, qty: d.b[j][2], lot: d.b[j][0], expiry: addDays(d.b[j][1]), notes: 'بيانات تجريبية' });
        }
      }
      await R(s.settings.put({ key: 'demoLoaded', value: true }));
    });
  }
  function removeDemo() {
    return DB.tx(['products', 'batches', 'movements', 'settings'], 'readwrite', async function (s) {
      const ps = (await R(s.products.getAll())).filter(function (p) { return p.demo; });
      for (let i = 0; i < ps.length; i++) {
        const id = ps[i].id;
        const bs = await R(s.batches.index('productId').getAll(id));
        for (let j = 0; j < bs.length; j++) await R(s.batches.delete(bs[j].id));
        const ms = await R(s.movements.index('productId').getAll(id));
        for (let j = 0; j < ms.length; j++) await R(s.movements.delete(ms[j].id));
        await R(s.products.delete(id));
      }
      await R(s.settings.put({ key: 'demoLoaded', value: false }));
      return ps.length;
    });
  }

  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = [',', ';', '\t'].map(function (d) { return [d, first.split(d).length]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  function validateImport(rows, existing) {
    if (rows.length < 2) return { error: 'الملف فارغ: يلزم سطر عناوين وصف بيانات واحد على الأقل' };
    const head = rows[0].map(function (h) { return String(h).trim(); });
    if (head.indexOf('name') < 0) return { error: 'عمود name غير موجود في سطر العناوين. حمّل القالب واستخدمه.' };
    const seen = new Set(existing.map(normKey));
    const items = [];
    for (let i = 1; i < rows.length; i++) {
      const r = {};
      head.forEach(function (h, j) { if (h) r[h] = rows[i][j]; });
      const c = cleanProduct(r);
      const msgs = c.errors.slice();
      const lot = String(r.lot || '').trim(), expiry = String(r.expiry || '').trim();
      const qs = String(r.qty == null ? '' : r.qty).trim();
      let q = 0;
      if (qs !== '') {
        q = Number(qs);
        if (!Number.isInteger(q) || q < 0) msgs.push({ field: 'qty', msg: 'الكمية غير صالحة' });
        else if (q > 0 && !isDate(expiry)) msgs.push({ field: 'expiry', msg: 'الصلاحية مطلوبة بصيغة YYYY-MM-DD عند وجود كمية' });
      }
      let status = msgs.length ? 'error' : 'ok';
      if (status === 'ok') {
        const k = normKey(c.data);
        if (seen.has(k)) status = 'dup'; else seen.add(k);
      }
      items.push({ line: i + 1, data: c.data, qty: q, lot: lot, expiry: expiry, status: status, msgs: msgs });
    }
    return { items: items };
  }

  function runImport(items) {
    return DB.tx(['products', 'batches', 'movements', 'settings'], 'readwrite', async function (s) {
      const set = await settingsIn(s.settings);
      let added = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.status !== 'ok') continue;
        const p = await createProductIn(s, it.data);
        if (it.qty > 0) await applyMovement(s, set, { type: 'initial', productId: p.id, qty: it.qty, lot: it.lot, expiry: it.expiry, notes: 'استيراد CSV' });
        added++;
      }
      return added;
    });
  }

  return {
    TYPES: TYPES, CSV_COLS: CSV_COLS, esc: esc, todayStr: todayStr, localDay: localDay, isDate: isDate,
    daysUntil: daysUntil, fmtDate: fmtDate, fmtDT: fmtDT, expiryStatus: expiryStatus, expLabel: expLabel,
    byName: byName, sortBatches: sortBatches, reorderQty: reorderQty, normKey: normKey,
    findDuplicates: findDuplicates, cleanProduct: cleanProduct, saveProduct: saveProduct,
    archiveProduct: archiveProduct, deleteProduct: deleteProduct, recordMovement: recordMovement,
    summarize: summarize, stats: stats, startStocktake: startStocktake, setCount: setCount, diff: diff,
    confirmStocktake: confirmStocktake, cancelStocktake: cancelStocktake, loadDemo: loadDemo,
    removeDemo: removeDemo, parseCSV: parseCSV, validateImport: validateImport, runImport: runImport
  };
})();
