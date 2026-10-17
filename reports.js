'use strict';
const REP = (function () {
  const E = INV.esc;
  const TYPES = [
    ['inventory', 'المخزون الحالي'],
    ['low', 'النواقص (تحت الحد الأدنى)'],
    ['expired', 'الدفعات المنتهية'],
    ['near', 'الدفعات قريبة الانتهاء'],
    ['movements', 'حركات الوارد والصادر'],
    ['stocktake', 'فروقات الجرد'],
    ['purchase', 'قائمة الشراء المقترحة']
  ];

  function csv(rows) {
    return '\uFEFF' + rows.map(function (r) {
      return r.map(function (c) {
        c = String(c == null ? '' : c);
        return /[",\n\r;]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\r\n');
  }
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function stamp() {
    const d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  async function build(type, o) {
    o = o || {};
    const P = await DB.getAll('products'), B = await DB.getAll('batches'), M = await DB.getAll('movements');
    const T = await DB.getAll('stocktakes'), st = await DB.getSettings();
    const pm = {};
    P.forEach(function (p) { pm[p.id] = p; });
    const act = P.filter(function (p) { return !p.archived; }).sort(INV.byName);
    const sum = INV.summarize(act, B, st);
    const rep = { title: '', head: [], rows: [], meta: '' };
    if (type === 'inventory') {
      rep.title = 'المخزون الحالي';
      rep.head = ['الرمز', 'المنتج', 'التركيز', 'الشكل', 'العبوة', 'الدفعة', 'الصلاحية', 'الكمية', 'الحالة', 'الموقع'];
      let units = 0;
      act.forEach(function (p) {
        const bs = INV.sortBatches(sum[p.id].batches.filter(function (b) { return b.quantity > 0; }));
        if (!bs.length) rep.rows.push([p.id, p.name, p.strength, p.form, p.pack, '—', '—', 0, 'رصيد صفر', p.location]);
        bs.forEach(function (b) {
          units += b.quantity;
          rep.rows.push([p.id, p.name, p.strength, p.form, p.pack, b.lot || '—', INV.fmtDate(b.expiry), b.quantity, INV.expLabel(INV.expiryStatus(b.expiry, st), st), p.location]);
        });
      });
      rep.meta = 'إجمالي الوحدات: ' + units;
    } else if (type === 'low') {
      rep.title = 'النواقص (تحت الحد الأدنى)';
      rep.head = ['الرمز', 'المنتج', 'التركيز', 'المتاح (غير المنتهي)', 'الحد الأدنى', 'العجز'];
      act.forEach(function (p) {
        const e = sum[p.id];
        if (p.minStock > 0 && e.avail < p.minStock) rep.rows.push([p.id, p.name, p.strength, e.avail, p.minStock, p.minStock - e.avail]);
      });
    } else if (type === 'expired' || type === 'near') {
      rep.title = type === 'expired' ? 'الدفعات المنتهية' : 'الدفعات قريبة الانتهاء';
      rep.head = ['الرمز', 'المنتج', 'الدفعة', 'الصلاحية', type === 'expired' ? 'أيام منذ الانتهاء' : 'الأيام المتبقية', 'الكمية', 'المستوى'];
      INV.sortBatches(B).forEach(function (b) {
        const p = pm[b.productId];
        if (!p || b.quantity <= 0) return;
        const s = INV.expiryStatus(b.expiry, st), d = INV.daysUntil(b.expiry);
        if (type === 'expired' && s === 'expired') rep.rows.push([p.id, p.name, b.lot || '—', INV.fmtDate(b.expiry), -d, b.quantity, 'منتهي']);
        if (type === 'near' && s !== 'expired' && s !== 'ok') rep.rows.push([p.id, p.name, b.lot || '—', INV.fmtDate(b.expiry), d, b.quantity, INV.expLabel(s, st)]);
      });
    } else if (type === 'movements') {
      rep.title = 'حركات المخزون';
      rep.head = ['التاريخ', 'النوع', 'المنتج', 'الدفعة', 'التغير', 'قبل', 'بعد', 'المرجع', 'ملاحظات'];
      let inn = 0, out = 0;
      M.filter(function (m) {
        const d = INV.localDay(m.date);
        return (!o.from || d >= o.from) && (!o.to || d <= o.to);
      }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (m) {
        if (m.delta > 0) inn += m.delta; else out += -m.delta;
        rep.rows.push([INV.fmtDT(m.date), INV.TYPES[m.type] ? INV.TYPES[m.type].label : m.type, m.productName, m.lot || '—', m.delta, m.prevQty, m.newQty, m.ref, m.notes]);
      });
      rep.meta = 'الفترة: ' + (o.from || 'البداية') + ' إلى ' + (o.to || 'اليوم') + ' | إجمالي الداخل: ' + inn + ' | إجمالي الخارج: ' + out;
    } else if (type === 'stocktake') {
      rep.title = 'فروقات الجرد';
      rep.head = ['المنتج', 'الدفعة', 'الصلاحية', 'المسجل', 'المعدود', 'الفرق', 'الحالة'];
      const sk = T.find(function (x) { return x.id === o.st; }) || T.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      if (sk) {
        sk.items.forEach(function (i) {
          if (i.counted == null) return;
          const d = i.counted - i.expected;
          rep.rows.push([i.productName + (i.strength ? ' ' + i.strength : ''), i.lot || '—', INV.fmtDate(i.expiry), i.expected, i.counted, d, d < 0 ? 'نقص' : d > 0 ? 'زيادة' : 'مطابق']);
        });
        rep.meta = 'جرد بتاريخ ' + INV.fmtDT(sk.date) + ' | الحالة: ' + (sk.status === 'done' ? 'تم تطبيق التسويات' : sk.status === 'open' ? 'مفتوح (لم تُطبّق التسويات)' : 'ملغى');
      } else rep.meta = 'لا توجد جلسات جرد';
    } else if (type === 'purchase') {
      const mult = Number(o.mult) > 0 ? Number(o.mult) : 2;
      rep.title = 'قائمة الشراء المقترحة (اقتراحات وليست أوامر شراء)';
      rep.head = ['الرمز', 'المنتج', 'التركيز', 'المتاح', 'الحد الأدنى', 'المستهدف', 'الكمية المقترحة'];
      act.forEach(function (p) {
        const e = sum[p.id];
        if (e.avail <= 0 || (p.minStock > 0 && e.avail < p.minStock)) {
          const t = Math.ceil(p.minStock * mult);
          rep.rows.push([p.id, p.name, p.strength, e.avail, p.minStock, t, INV.reorderQty(t, e.avail)]);
        }
      });
      rep.meta = 'المستهدف = الحد الأدنى × ' + mult;
    }
    rep.settings = st;
    return rep;
  }

  function tableHTML(rep, st) {
    st = st || rep.settings || {};
    const ph = st.pharmacyName ? '<div>' + E(st.pharmacyName) + '</div>' : '';
    const body = rep.rows.length
      ? '<div class="tw"><table><thead><tr>' + rep.head.map(function (h) { return '<th>' + E(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rep.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + E(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'
      : '<p>لا توجد بيانات لهذا التقرير.</p>';
    return '<div class="rep"><div class="rep-head"><h2>Amino Cure Drug Stock</h2>' + ph + '<h3>' + E(rep.title) + '</h3><div class="mut">تاريخ إنشاء التقرير: ' + INV.fmtDT(new Date().toISOString()) + '</div>' +
      (rep.meta ? '<div class="mut">' + E(rep.meta) + '</div>' : '') + '</div>' + body +
      '<div class="rep-foot mut">أداة لتنظيم المخزون وليست أداة قرار سريري. الأرقام مأخوذة من البيانات المحفوظة على هذا الجهاز.</div></div>';
  }
  function repCSV(rep) { return csv([rep.head].concat(rep.rows)); }

  async function makeBackup() {
    const data = await DB.exportAll();
    const counts = {};
    DB.STORES.forEach(function (n) { counts[n] = data[n].length; });
    return { app: 'AminoCureDrugStock', schema: 1, exportedAt: new Date().toISOString(), counts: counts, data: data };
  }
  async function downloadBackup(prefix) {
    const b = await makeBackup();
    download((prefix || 'AminoCure-DrugStock-backup') + '-' + stamp() + '.json', JSON.stringify(b), 'application/json');
    return b;
  }
  function validateBackup(o) {
    const errors = [];
    if (!o || typeof o !== 'object') errors.push('الملف ليس نسخة احتياطية صالحة');
    else {
      if (o.app !== 'AminoCureDrugStock') errors.push('الملف ليس من تطبيق Amino Cure Drug Stock');
      if (o.schema !== 1) errors.push('إصدار النسخة غير متوافق');
      const d = o.data;
      if (!d || typeof d !== 'object') errors.push('بيانات النسخة مفقودة');
      else {
        DB.STORES.forEach(function (n) { if (!Array.isArray(d[n])) errors.push('القسم «' + n + '» مفقود أو تالف'); });
        if (!errors.length) {
          const ids = new Set();
          d.products.forEach(function (p, i) {
            if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') errors.push('المنتج رقم ' + (i + 1) + ' تالف');
            else ids.add(p.id);
          });
          d.batches.forEach(function (b, i) {
            if (!b || typeof b.id !== 'string' || !ids.has(b.productId) || !Number.isFinite(b.quantity) || typeof b.expiry !== 'string') errors.push('الدفعة رقم ' + (i + 1) + ' تالفة أو مرتبطة بمنتج غير موجود');
          });
          d.movements.forEach(function (m, i) {
            if (!m || typeof m.id !== 'string' || typeof m.productId !== 'string' || !Number.isFinite(m.delta)) errors.push('الحركة رقم ' + (i + 1) + ' تالفة');
          });
          d.stocktakes.forEach(function (t, i) {
            if (!t || typeof t.id !== 'string' || !Array.isArray(t.items)) errors.push('الجرد رقم ' + (i + 1) + ' تالف');
          });
          d.settings.forEach(function (r, i) {
            if (!r || typeof r.key !== 'string') errors.push('الإعداد رقم ' + (i + 1) + ' تالف');
          });
        }
      }
    }
    return { ok: errors.length === 0, errors: errors.slice(0, 10), info: errors.length ? null : { exportedAt: o.exportedAt, counts: o.counts || {} } };
  }
  async function restore(o, mode) {
    const v = validateBackup(o);
    if (!v.ok) throw new Error('النسخة غير صالحة، لم يتم تغيير أي شيء');
    if (mode === 'replace') { await DB.replaceAll(o.data); return; }
    const cur = await DB.getAll('settings');
    const seqs = {};
    cur.forEach(function (r) { if (r.key.indexOf('seq_') === 0) seqs[r.key] = r.value; });
    const d = Object.assign({}, o.data);
    d.settings = o.data.settings.filter(function (r) { return r.key.indexOf('seq_') === 0; }).map(function (r) {
      return seqs[r.key] > r.value ? { key: r.key, value: seqs[r.key] } : r;
    });
    await DB.mergeAll(d);
  }

  return { TYPES: TYPES, csv: csv, download: download, stamp: stamp, build: build, tableHTML: tableHTML, repCSV: repCSV, makeBackup: makeBackup, downloadBackup: downloadBackup, validateBackup: validateBackup, restore: restore };
})();
