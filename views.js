'use strict';
(function () {
  const A = window.APP, S = A.S, $ = A.$, $$ = A.$$, E = A.E;
  const toast = A.toast, openModal = A.openModal, closeModal = A.closeModal, confirmBox = A.confirmBox, showErr = A.showErr;
  const openForm = A.openForm, done = A.done, fd = A.fd, inp = A.inp, sel = A.sel, bar = A.bar, bd = A.bd, stBadge = A.stBadge, mvTable = A.mvTable;
  const byName = INV.byName;
  let stOpen = null, curRep = null, csvItems = null, bkObj = null;
  const F = { q: '', f: 'all', sort: 'name' };
  const MF = { type: '', from: '', to: '' };
  const PU = { mult: 2, targets: {} };
  const RS = { type: 'inventory', from: '', to: '', st: '' };
  A.onShow = function (p) { if (p !== 'stocktaking') stOpen = null; };

  /* ===== المخزون ===== */
  function badges(e) {
    const p = e.p;
    let h = '';
    if (e.total > 0 && e.avail <= 0) h += bd('b-exp', 'كله منتهي');
    else if (e.avail <= 0) h += bd('b-w1', 'رصيد صفر');
    else if (p.minStock > 0 && e.avail < p.minStock) h += bd('b-w1', 'تحت الحد');
    if (e.expiredQty > 0 && e.avail > 0) h += bd('b-exp', 'فيه منتهي');
    if (e.nearQty > 0) h += bd('b-w2', 'قريب الانتهاء');
    return h;
  }
  function invList() {
    const m = INV.summarize(S.products, S.batches, S.settings);
    const q = F.q.trim().toLowerCase();
    const rows = S.products.map(function (p) { return m[p.id]; }).filter(function (e) {
      const p = e.p;
      if (F.f === 'archived') { if (!p.archived) return false; } else if (p.archived) return false;
      if (q && ![p.name, p.brand, p.ingredient, p.barcode, p.id].some(function (x) { return String(x || '').toLowerCase().indexOf(q) >= 0; })) return false;
      if (F.f === 'low') return p.minStock > 0 && e.avail < p.minStock;
      if (F.f === 'zero') return e.avail <= 0;
      if (F.f === 'expired') return e.expiredQty > 0;
      if (F.f === 'near') return e.nearQty > 0;
      return true;
    });
    rows.sort(function (a, b) {
      if (F.sort === 'stock') return a.total - b.total;
      if (F.sort === 'stockd') return b.total - a.total;
      if (F.sort === 'exp') return (a.firstExp || '9999') < (b.firstExp || '9999') ? -1 : 1;
      return byName(a.p, b.p);
    });
    let h = '<p class="mut small">' + rows.length + ' نتيجة' + (rows.length > 300 ? ' (يُعرض أول 300، استخدم البحث)' : '') + '</p>';
    rows.slice(0, 300).forEach(function (e) {
      const p = e.p;
      h += '<div class="item" data-act="view-product" data-id="' + p.id + '"><div><b>' + E(p.name) + '</b>' + (p.brand ? ' <small>(' + E(p.brand) + ')</small>' : '') + '<div class="mut">' + E([p.strength, p.form, p.pack].filter(Boolean).join(' • ')) + '</div><div class="mut small">' + p.id + (p.location ? ' • ' + E(p.location) : '') + '</div></div><div class="it-side"><div class="qty">' + e.total + '</div>' + badges(e) + '</div></div>';
    });
    return h;
  }
  function vInv() {
    return bar('<button class="btn primary" data-act="add-product">+ منتج جديد</button>') +
      '<div class="row noprint"><input id="inv-q" placeholder="بحث: اسم، مادة فعالة، باركود، رمز" value="' + E(F.q) + '"><select id="inv-f">' +
      [['all', 'الكل'], ['low', 'تحت الحد'], ['zero', 'رصيد صفر'], ['expired', 'فيه منتهي'], ['near', 'قريب الانتهاء'], ['archived', 'الأرشيف']].map(function (o) { return '<option value="' + o[0] + '"' + (F.f === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select><select id="inv-s">' + [['name', 'ترتيب: الاسم'], ['stock', 'الأقل مخزوناً'], ['stockd', 'الأكثر مخزوناً'], ['exp', 'أقرب انتهاء']].map(function (o) { return '<option value="' + o[0] + '"' + (F.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div><div id="inv-list">' + invList() + '</div>';
  }

  function viewProduct(id) {
    const p = S.products.find(function (x) { return x.id === id; });
    if (!p) return;
    const m = INV.summarize([p], S.batches, S.settings)[p.id];
    const info = [['الرمز', p.id], ['الاسم التجاري', p.brand], ['المادة الفعالة', p.ingredient], ['التركيز', p.strength], ['الشكل', p.form], ['العبوة', p.pack], ['الباركود', p.barcode], ['المصنع', p.manufacturer], ['المورد', p.supplier], ['سعر الشراء', p.cost], ['سعر البيع', p.price], ['الحد الأدنى', p.minStock], ['الموقع', p.location], ['ملاحظات', p.notes], ['أُنشئ', INV.fmtDT(p.createdAt)], ['آخر تعديل', INV.fmtDT(p.updatedAt)]].filter(function (r) { return r[1] !== '' && r[1] != null; });
    let h = (p.archived ? '<div class="err">منتج مؤرشف</div>' : '') + '<div class="tw"><table>' + info.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + E(r[1]) + '</td></tr>'; }).join('') + '</table></div>';
    h += '<h3>الدفعات (الإجمالي ' + m.total + ' | المتاح غير المنتهي ' + m.avail + ')</h3>';
    const bs = INV.sortBatches(m.batches);
    if (!bs.length) h += '<p class="mut">لا توجد دفعات. سجّل رصيداً افتتاحياً أو وارداً.</p>';
    else h += '<div class="tw"><table><thead><tr><th>الدفعة</th><th>الصلاحية</th><th>الكمية</th><th>الحالة</th><th></th></tr></thead><tbody>' + bs.map(function (b) {
      const ex = INV.daysUntil(b.expiry) < 0;
      return '<tr><td>' + E(b.lot || '—') + '</td><td>' + INV.fmtDate(b.expiry) + '</td><td>' + b.quantity + '</td><td>' + stBadge(b) + '</td><td><button class="btn sm" data-act="new-move" data-type="' + (ex ? 'expired' : 'out') + '" data-product="' + p.id + '" data-batch="' + b.id + '">' + (ex ? 'إزالة منتهي' : 'صرف') + '</button> <button class="btn sm" data-act="new-move" data-type="correction" data-product="' + p.id + '" data-batch="' + b.id + '">تصحيح</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    h += '<div class="actions"><button class="btn green" data-act="new-move" data-type="in" data-product="' + p.id + '">+ وارد</button><button class="btn" data-act="edit-product" data-id="' + p.id + '">تعديل</button><button class="btn" data-act="archive" data-id="' + p.id + '">' + (p.archived ? 'استعادة من الأرشيف' : 'أرشفة') + '</button><button class="btn danger" data-act="delete-product" data-id="' + p.id + '">حذف</button></div>';
    h += '<h3>آخر الحركات</h3>' + mvTable(S.movements.filter(function (x) { return x.productId === p.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 10));
    openModal(p.name, h, true);
  }

  function productForm(id) {
    const p = id ? S.products.find(function (x) { return x.id === id; }) : { minStock: 0 };
    if (!p) return;
    const forms = ['أقراص', 'كبسولات', 'شراب', 'معلق', 'حقن', 'أمبولات', 'كريم', 'مرهم', 'نقط', 'بخاخ', 'تحاميل', 'أكياس', 'محلول'];
    const f = openForm(id ? 'تعديل منتج' : 'منتج جديد',
      inp('اسم المنتج', 'name', p.name, { req: 1 }) + inp('الاسم التجاري / العلامة', 'brand', p.brand) + inp('المادة الفعالة', 'ingredient', p.ingredient) +
      '<div class="row3">' + inp('التركيز', 'strength', p.strength) +
      '<label class="f"><span>الشكل الدوائي</span><input name="form" list="dl-forms" value="' + E(p.form || '') + '"><datalist id="dl-forms">' + forms.map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></label>' +
      inp('العبوة', 'pack', p.pack) + '</div>' +
      inp('الباركود', 'barcode', p.barcode) + inp('المصنع', 'manufacturer', p.manufacturer) + inp('المورد', 'supplier', p.supplier) +
      '<div class="row3">' + inp('سعر الشراء', 'cost', p.cost, { type: 'number', attr: 'step="any" min="0"' }) + inp('سعر البيع', 'price', p.price, { type: 'number', attr: 'step="any" min="0"' }) + inp('الحد الأدنى', 'minStock', p.minStock, { type: 'number', attr: 'step="1" min="0"' }) + '</div>' +
      inp('الموقع / الرف', 'location', p.location) + '<label class="f"><span>ملاحظات</span><textarea name="notes">' + E(p.notes || '') + '</textarea></label>',
      'حفظ', async function (form) {
        const c = INV.cleanProduct(fd(form));
        if (c.errors.length) throw new Error(c.errors.map(function (e) { return e.msg; }).join(' | '));
        const dups = INV.findDuplicates(c.data, S.products, id);
        if (dups.length && form.dataset.force !== '1') {
          form.dataset.force = '1';
          showErr('تنبيه: يوجد منتج مشابه: ' + dups.map(function (d) { return d.name + ' ' + (d.strength || '') + ' (' + d.id + ')'; }).join('، ') + '. الاختلاف في التركيز أو الشكل أو العبوة يعني منتجاً مختلفاً. اضغط «حفظ» مرة أخرى للمتابعة.');
          return false;
        }
        const saved = await INV.saveProduct(c.data, id);
        await A.refresh();
        closeModal();
        if (id) toast('تم حفظ التعديلات');
        else { toast('تم حفظ المنتج. سجّل رصيده الافتتاحي الآن أو أغلق النافذة'); moveForm({ type: 'initial', productId: saved.id }); }
      }, true);
    f.addEventListener('input', function () { delete f.dataset.force; });
  }

  function moveForm(pre) {
    pre = pre || {};
    const prods = S.products.filter(function (p) { return !p.archived; }).sort(byName);
    if (!prods.length) { toast('أضف منتجاً أولاً', true); return; }
    const mid = DB.uid('M');
    const typeOpts = Object.keys(INV.TYPES).map(function (k) { return [k, INV.TYPES[k].label]; });
    const f = openForm('حركة مخزون',
      sel('نوع الحركة', 'type', typeOpts, pre.type || 'in').replace('<select', '<select id="mv-type"') +
      '<label class="f"><span>بحث عن المنتج</span><input id="mv-q" placeholder="اسم أو باركود" autocomplete="off"></label>' +
      '<label class="f"><span>المنتج *</span><select name="productId" id="mv-p"></select></label><div id="mv-dyn"></div>' +
      inp('رقم المرجع / الفاتورة (اختياري)', 'ref', '') + '<label class="f"><span>السبب / ملاحظات</span><textarea name="notes"></textarea></label>',
      'تسجيل الحركة', async function (form) {
        const d = fd(form);
        const r = await INV.recordMovement({ id: mid, type: d.type, productId: d.productId, batchId: d.batchId, qty: d.qty === '' || d.qty == null ? NaN : Number(d.qty), lot: d.lot, expiry: d.expiry, cost: d.cost, supplier: d.supplier, received: d.received, ref: d.ref, notes: d.notes });
        await done('تم التسجيل. الرصيد الجديد للدفعة: ' + r.newQty);
      }, true);
    function fillProducts() {
      const q = $('#mv-q').value.trim().toLowerCase();
      const cur = $('#mv-p').value || pre.productId || '';
      const list = prods.filter(function (p) { return !q || [p.name, p.barcode, p.ingredient, p.brand, p.id].some(function (x) { return String(x || '').toLowerCase().indexOf(q) >= 0; }); }).slice(0, 100);
      if (cur && !list.some(function (p) { return p.id === cur; })) { const c = prods.find(function (p) { return p.id === cur; }); if (c) list.unshift(c); }
      $('#mv-p').innerHTML = '<option value="">— اختر —</option>' + list.map(function (p) { return '<option value="' + p.id + '"' + (p.id === cur ? ' selected' : '') + '>' + E(p.name + (p.strength ? ' ' + p.strength : '') + (p.form ? ' - ' + p.form : '')) + '</option>'; }).join('');
    }
    function renderDyn() {
      const type = $('#mv-type').value, kind = INV.TYPES[type].kind, pid = $('#mv-p').value;
      let h = '';
      if (kind === 'in') {
        h = '<p class="mut small">إذا تطابقت التشغيلة والصلاحية مع دفعة موجودة تُضاف الكمية إليها، وإلا تُنشأ دفعة جديدة منفصلة.</p>' +
          inp('رقم التشغيلة (Lot)', 'lot', '') + inp('تاريخ الصلاحية', 'expiry', '', { type: 'date', req: 1 }) +
          inp('سعر الشراء للوحدة', 'cost', '', { type: 'number', attr: 'step="any" min="0"' }) + inp('المورد', 'supplier', '') + inp('تاريخ الاستلام', 'received', INV.todayStr(), { type: 'date' });
      } else {
        const bs = INV.sortBatches(S.batches.filter(function (b) { return b.productId === pid; }));
        const opts = bs.filter(function (b) {
          if (type === 'expired') return b.quantity > 0 && INV.daysUntil(b.expiry) < 0;
          if (type === 'out') return b.quantity > 0;
          return true;
        });
        let first = true;
        const os = opts.map(function (b) {
          const ex = INV.daysUntil(b.expiry) < 0, dis = type === 'out' && ex;
          const auto = !dis && first && !pre.batchId;
          if (auto) first = false;
          const sl = pre.batchId === b.id ? ' selected' : (auto ? ' selected' : '');
          return '<option value="' + b.id + '"' + (dis ? ' disabled' : '') + sl + '>' + E((b.lot || 'بدون رقم') + ' • ' + INV.fmtDate(b.expiry) + ' • الكمية ' + b.quantity + (ex ? ' • منتهي' : '') + (auto && type === 'out' ? ' • الأقدم صلاحية (FEFO)' : '')) + '</option>';
        }).join('');
        h = '<label class="f"><span>الدفعة *</span><select name="batchId" id="mv-b">' + (pid ? (os || '<option value="">لا توجد دفعات مناسبة</option>') : '<option value="">اختر المنتج أولاً</option>') + '</select></label>';
      }
      const ql = kind === 'set' ? 'الكمية المعدودة فعلياً' : kind === 'adj' ? 'مقدار التصحيح (+ زيادة أو − نقص)' : 'الكمية';
      h += '<label class="f"><span>' + ql + ' *</span><input name="qty" id="mv-q2" type="number" step="1" inputmode="numeric"' + (kind === 'adj' ? '' : ' min="0"') + '></label><div id="mv-prev" class="mut small"></div>';
      $('#mv-dyn').innerHTML = h;
    }
    function prev() {
      const el = $('#mv-prev'), b = $('#mv-b'), qv = $('#mv-q2');
      if (!el || !b || !qv || !b.value || qv.value === '') { if (el) el.textContent = ''; return; }
      const kind = INV.TYPES[$('#mv-type').value].kind, batch = S.batches.find(function (x) { return x.id === b.value; }), q = Number(qv.value);
      if (!batch) return;
      const next = kind === 'out' ? batch.quantity - q : kind === 'set' ? q : batch.quantity + q;
      el.textContent = 'رصيد الدفعة الحالي: ' + batch.quantity + ' ← بعد الحركة: ' + next;
      el.className = next < 0 ? 'err small' : 'mut small';
    }
    fillProducts();
    renderDyn();
    f.addEventListener('input', function (e) {
      if (e.target.id === 'mv-q') { fillProducts(); renderDyn(); }
      else if (e.target.id === 'mv-q2') prev();
    });
    f.addEventListener('change', function (e) {
      if (e.target.id === 'mv-type' || e.target.id === 'mv-p') { pre.batchId = ''; renderDyn(); }
      else if (e.target.id === 'mv-b') prev();
    });
  }

  /* ===== الحركات ===== */
  function filteredMoves() {
    return S.movements.filter(function (m) {
      const d = INV.localDay(m.date);
      return (!MF.type || m.type === MF.type) && (!MF.from || d >= MF.from) && (!MF.to || d <= MF.to);
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function vMoves() {
    const list = filteredMoves();
    return bar('<button class="btn primary" data-act="new-move" data-type="in">+ حركة جديدة</button><button class="btn" data-act="export-moves">تصدير CSV</button>') +
      '<div class="row noprint"><select id="mv-ft"><option value="">كل الأنواع</option>' + Object.keys(INV.TYPES).map(function (k) { return '<option value="' + k + '"' + (MF.type === k ? ' selected' : '') + '>' + INV.TYPES[k].label + '</option>'; }).join('') + '</select><input type="date" id="mv-fa" value="' + MF.from + '"><input type="date" id="mv-fb" value="' + MF.to + '"></div>' +
      '<div class="panel" id="mv-list">' + mvTable(list.slice(0, 200)) + (list.length > 200 ? '<p class="mut small">يُعرض أحدث 200 من ' + list.length + ' حركة. استخدم التصفية أو التقارير.</p>' : '') + '</div>';
  }

  /* ===== الصلاحية ===== */
  function vExpiry() {
    const st = S.settings, g = { expired: [], w1: [], w2: [], w3: [] }, pm = {};
    S.products.forEach(function (p) { pm[p.id] = p; });
    INV.sortBatches(S.batches).forEach(function (b) {
      if (b.quantity <= 0 || !pm[b.productId]) return;
      const s = INV.expiryStatus(b.expiry, st);
      if (g[s]) g[s].push(b);
    });
    const titles = { expired: 'منتهية الصلاحية', w1: 'تنتهي خلال ' + st.warn1 + ' يوم', w2: 'تنتهي خلال ' + st.warn2 + ' يوم', w3: 'تنتهي خلال ' + st.warn3 + ' يوم' };
    let h = '<p class="mut small">لا تُحذف الدفعات المنتهية تلقائياً. سجّل «إزالة منتهي» لإخراجها من الرصيد بسجل واضح.</p>';
    ['expired', 'w1', 'w2', 'w3'].forEach(function (k) {
      h += '<div class="panel"><h3>' + titles[k] + ' (' + g[k].length + ')</h3>';
      if (!g[k].length) h += '<p class="mut">لا توجد دفعات.</p>';
      else h += '<div class="tw"><table><thead><tr><th>المنتج</th><th>الدفعة</th><th>الصلاحية</th><th>الأيام</th><th>الكمية</th><th></th></tr></thead><tbody>' + g[k].map(function (b) {
        const p = pm[b.productId], d = INV.daysUntil(b.expiry);
        return '<tr><td>' + E(p.name + (p.strength ? ' ' + p.strength : '')) + '</td><td>' + E(b.lot || '—') + '</td><td>' + INV.fmtDate(b.expiry) + '</td><td>' + (d < 0 ? 'منذ ' + (-d) : d) + '</td><td>' + b.quantity + '</td><td><button class="btn sm" data-act="new-move" data-type="' + (k === 'expired' ? 'expired' : 'out') + '" data-product="' + p.id + '" data-batch="' + b.id + '">' + (k === 'expired' ? 'إزالة منتهي' : 'صرف') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
      h += '</div>';
    });
    return h;
  }

  /* ===== الجرد ===== */
  function stDetail(st) {
    const open = st.status === 'open';
    const counted = st.items.filter(function (i) { return i.counted != null; }).length;
    let h = bar('<button class="btn" data-act="st-back">رجوع</button>', 'جرد ' + INV.fmtDT(st.date)) +
      '<div class="panel"><p>الحالة: ' + (open ? bd('b-w2', 'مفتوح') : st.status === 'done' ? bd('b-ok', 'تم تطبيق التسويات') : bd('b-exp', 'ملغى')) + ' • معدود ' + counted + ' من ' + st.items.length + (st.note ? ' • ' + E(st.note) : '') + '</p>' +
      (open ? '<p class="mut small">لا يتغير المخزون عند إدخال الأرقام. تُطبَّق التسويات فقط بعد المراجعة والتأكيد. الدفعات التي لم تُعدّ لن تتغير.</p><div class="actions"><button class="btn green" data-act="review-stocktake" data-id="' + st.id + '">مراجعة وتأكيد</button><button class="btn danger" data-act="cancel-stocktake" data-id="' + st.id + '">إلغاء الجرد</button></div>' : '<div class="actions"><button class="btn primary" data-act="st-report" data-id="' + st.id + '">عرض التقرير / طباعة</button></div>') + '</div>';
    h += '<div class="panel"><div class="tw"><table><thead><tr><th>المنتج</th><th>الدفعة</th><th>الصلاحية</th><th>المسجل</th><th>المعدود</th><th>الفرق</th></tr></thead><tbody>' + st.items.map(function (i) {
      const d = i.counted == null ? '' : i.counted - i.expected;
      return '<tr><td>' + E(i.productName + (i.strength ? ' ' + i.strength : '')) + '</td><td>' + E(i.lot || '—') + '</td><td>' + INV.fmtDate(i.expiry) + '</td><td>' + i.expected + '</td><td>' + (open ? '<input class="cnt" type="number" min="0" step="1" inputmode="numeric" data-batch="' + i.batchId + '" value="' + (i.counted == null ? '' : i.counted) + '">' : (i.counted == null ? '—' : i.counted)) + '</td><td dir="ltr" data-diff="' + i.batchId + '" class="' + (d < 0 ? 'neg' : d > 0 ? 'pos' : '') + '">' + (d === '' ? '' : (d > 0 ? '+' : '') + d) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }
  function vStock() {
    if (stOpen) {
      const st = S.stocktakes.find(function (x) { return x.id === stOpen; });
      if (st) return stDetail(st);
      stOpen = null;
    }
    let h = bar('<button class="btn primary" data-act="start-stocktake">+ بدء جرد</button>');
    const list = S.stocktakes.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!list.length) h += '<div class="panel"><p>لا توجد جلسات جرد. ابدأ جرداً جديداً: ستُسجَّل الكميات المعدودة وتُقارن بالمسجل، ثم تؤكد التسويات.</p></div>';
    list.forEach(function (s) {
      const c = s.items.filter(function (i) { return i.counted != null; }).length;
      h += '<div class="item" data-act="open-stocktake" data-id="' + s.id + '"><div><b>' + INV.fmtDT(s.date) + '</b><div class="mut small">' + (s.scope === 'all' ? 'كل المخزون' : 'منتجات محددة') + ' • معدود ' + c + '/' + s.items.length + '</div></div><div>' + (s.status === 'open' ? bd('b-w2', 'مفتوح') : s.status === 'done' ? bd('b-ok', 'مكتمل') : bd('b-exp', 'ملغى')) + '</div></div>';
    });
    return h;
  }
  function startStocktakeForm() {
    const prods = S.products.filter(function (p) { return !p.archived; }).sort(byName);
    const chosen = new Set();
    const f = openForm('بدء جرد جديد',
      '<label class="f"><span>نطاق الجرد</span><select name="scope" id="sk-scope"><option value="all">كل المخزون</option><option value="sel">منتجات محددة</option></select></label>' +
      '<div id="sk-sel" hidden><input id="sk-q" placeholder="بحث..."><div id="sk-list" class="chk"></div></div>' + inp('ملاحظة (اختياري)', 'note', ''),
      'ابدأ الجرد', async function (form) {
        const d = fd(form);
        const st = await INV.startStocktake(d.scope === 'sel' ? Array.from(chosen) : null, d.note);
        stOpen = st.id;
        closeModal();
        await A.refresh();
        A.go('stocktaking');
        toast('بدأ الجرد. أدخل الكميات المعدودة');
      });
    function draw() {
      const q = $('#sk-q').value.trim().toLowerCase();
      $('#sk-list').innerHTML = prods.filter(function (p) { return !q || (p.name + ' ' + (p.barcode || '')).toLowerCase().indexOf(q) >= 0; }).slice(0, 200).map(function (p) {
        return '<label class="chk-i"><input type="checkbox" value="' + p.id + '"' + (chosen.has(p.id) ? ' checked' : '') + '>' + E(p.name + (p.strength ? ' ' + p.strength : '')) + '</label>';
      }).join('');
    }
    draw();
    f.addEventListener('change', function (e) {
      if (e.target.id === 'sk-scope') { $('#sk-sel').hidden = e.target.value !== 'sel'; }
      else if (e.target.type === 'checkbox') { if (e.target.checked) chosen.add(e.target.value); else chosen.delete(e.target.value); }
    });
    f.addEventListener('input', function (e) { if (e.target.id === 'sk-q') draw(); });
  }
  function reviewStocktake(id) {
    const st = S.stocktakes.find(function (x) { return x.id === id; });
    if (!st) return;
    const d = INV.diff(st);
    function tbl(list) {
      return '<div class="tw"><table><thead><tr><th>المنتج</th><th>الدفعة</th><th>المسجل</th><th>المعدود</th><th>الفرق</th></tr></thead><tbody>' + list.map(function (i) { return '<tr><td>' + E(i.productName) + '</td><td>' + E(i.lot || '—') + '</td><td>' + i.expected + '</td><td>' + i.counted + '</td><td dir="ltr" class="' + (i.diff < 0 ? 'neg' : 'pos') + '">' + (i.diff > 0 ? '+' : '') + i.diff + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    let h = '<p>مطابق: <b>' + d.same.length + '</b> • نقص: <b>' + d.short.length + '</b> • زيادة: <b>' + d.surp.length + '</b> • لم يُعدّ: <b>' + d.uncounted + '</b></p>';
    if (d.short.length) h += '<h3>النقص</h3>' + tbl(d.short);
    if (d.surp.length) h += '<h3>الزيادة</h3>' + tbl(d.surp);
    h += '<p class="mut small">عند التأكيد ستُضبط كمية كل دفعة معدودة إلى الرقم المعدود، وتُسجَّل حركة «تسوية جرد» لكل فرق. لا يمكن التراجع إلا بحركة تصحيح.</p><div class="actions"><button class="btn green" id="st-ok">تأكيد وتطبيق التسويات</button><button class="btn" data-close>رجوع</button></div>';
    openModal('مراجعة فروقات الجرد', h, true);
    $('#st-ok').onclick = async function (e) {
      e.target.disabled = true;
      try { await INV.confirmStocktake(id); await done('تم تطبيق التسويات وحفظ تقرير الجرد'); }
      catch (err) { e.target.disabled = false; toast(err.message, true); }
    };
  }

  /* ===== المشتريات ===== */
  function purRows() {
    const act = S.products.filter(function (p) { return !p.archived; }).sort(byName);
    const m = INV.summarize(act, S.batches, S.settings);
    return act.map(function (p) { return m[p.id]; }).filter(function (e) {
      return e.avail <= 0 || (e.p.minStock > 0 && e.avail < e.p.minStock);
    }).map(function (e) {
      const t = PU.targets[e.p.id] !== undefined && PU.targets[e.p.id] !== '' ? Number(PU.targets[e.p.id]) : Math.ceil(e.p.minStock * PU.mult);
      return { e: e, target: t, sug: INV.reorderQty(t, e.avail) };
    });
  }
  function purBody() {
    const rows = purRows();
    if (!rows.length) return '<tr><td colspan="6">لا توجد منتجات ناقصة.</td></tr>';
    return rows.map(function (r) {
      const p = r.e.p;
      return '<tr><td>' + E(p.name) + '</td><td>' + E(p.strength || '') + '</td><td>' + r.e.avail + '</td><td>' + p.minStock + '</td><td><input class="tgt" type="number" min="0" step="1" data-id="' + p.id + '" value="' + r.target + '"></td><td data-sug="' + p.id + '"><b>' + r.sug + '</b></td></tr>';
    }).join('');
  }
  function vPurchase() {
    return bar('<button class="btn" data-act="print">طباعة</button><button class="btn" data-act="export-purchase">تصدير CSV</button>') +
      '<div class="print-only"><h2>Amino Cure Drug Stock</h2><h3>قائمة الشراء المقترحة</h3><p>' + INV.fmtDT(new Date().toISOString()) + '</p></div>' +
      '<div class="panel"><p class="mut small">هذه اقتراحات حسابية وليست أوامر شراء. المتاح = الكمية غير المنتهية. المقترح = المستهدف − المتاح (لا يقل عن صفر).</p>' +
      '<div class="row noprint"><label>المستهدف الافتراضي = الحد الأدنى ×</label><input id="pu-mult" type="number" min="1" step="0.5" value="' + PU.mult + '" style="max-width:100px"></div>' +
      '<div class="tw"><table><thead><tr><th>المنتج</th><th>التركيز</th><th>المتاح</th><th>الحد الأدنى</th><th>المستهدف</th><th>المقترح</th></tr></thead><tbody id="pu-body">' + purBody() + '</tbody></table></div></div>';
  }

  /* ===== التقارير ===== */
  function vReports() {
    return '<div class="panel noprint"><label class="f"><span>نوع التقرير</span><select id="rp-type">' + REP.TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (RS.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="row3"><label class="f"><span>من تاريخ (للحركات)</span><input type="date" id="rp-from" value="' + RS.from + '"></label><label class="f"><span>إلى تاريخ</span><input type="date" id="rp-to" value="' + RS.to + '"></label></div>' +
      '<label class="f"><span>جلسة الجرد (لتقرير الفروقات)</span><select id="rp-st"><option value="">الأحدث</option>' + S.stocktakes.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (s) { return '<option value="' + s.id + '"' + (RS.st === s.id ? ' selected' : '') + '>' + INV.fmtDT(s.date) + '</option>'; }).join('') + '</select></label>' +
      '<div class="actions"><button class="btn primary" data-act="run-report">عرض التقرير</button><button class="btn" data-act="print">طباعة / حفظ PDF</button><button class="btn" data-act="csv-report">تصدير CSV</button></div></div><div id="report-out">' + (curRep ? REP.tableHTML(curRep) : '') + '</div>';
  }
  async function runReport() {
    RS.type = $('#rp-type').value; RS.from = $('#rp-from').value; RS.to = $('#rp-to').value; RS.st = $('#rp-st').value;
    curRep = await REP.build(RS.type, { from: RS.from, to: RS.to, st: RS.st, mult: PU.mult });
    $('#report-out').innerHTML = REP.tableHTML(curRep);
  }

  /* ===== النسخ والاستيراد ===== */
  function vBackup() {
    const demo = S.products.some(function (p) { return p.demo; });
    return '<div class="panel"><h3>النسخ الاحتياطي (JSON)</h3><p class="mut small">البيانات محفوظة في هذا الجهاز فقط، ولا تتزامن تلقائياً مع أي جهاز آخر. انسخ ملف النسخة إلى مكان آمن (Google Drive أو الكمبيوتر). قد تضيع البيانات إذا مسحت بيانات الموقع أو التطبيق.' + (S.settings.lastBackup ? ' آخر نسخة: ' + INV.fmtDT(S.settings.lastBackup) : ' لم تُنشأ نسخة بعد.') + '</p><div class="actions"><button class="btn green" data-act="export-backup">تصدير نسخة كاملة</button><button class="btn" data-act="pick-backup">استعادة من ملف</button></div><div id="bk-preview"></div></div>' +
      '<div class="panel"><h3>استيراد المنتجات (CSV)</h3><p class="mut small">الأعمدة: ' + INV.CSV_COLS.join(', ') + '. الحقل name إلزامي. إذا وضعت qty أكبر من 0 فيلزم expiry بصيغة YYYY-MM-DD (و lot اختياري) وتُنشأ دفعة افتتاحية. الحد الأدنى هو minStock. لا يُستورد أي صف قبل المعاينة والتأكيد.</p><div class="actions"><button class="btn" data-act="dl-template">تنزيل القالب</button><button class="btn" data-act="copy-template">نسخ القالب</button><button class="btn primary" data-act="pick-csv">اختيار ملف CSV</button></div><label class="f" style="margin-top:10px"><span>أو الصق محتوى CSV هنا</span><textarea id="csv-text" dir="ltr"></textarea></label><button class="btn" data-act="csv-preview-text">معاينة المحتوى الملصوق</button><div id="csv-preview"></div></div>' +
      '<div class="panel"><h3>بيانات تجريبية</h3><p class="mut small">لتجربة التطبيق فقط. تُوسم بـ [تجريبي] ولا تُخلط مع بياناتك إلا بقرارك.</p><div class="actions"><button class="btn" data-act="load-demo"' + (demo ? ' disabled' : '') + '>تحميل بيانات تجريبية</button><button class="btn danger" data-act="remove-demo"' + (demo ? '' : ' disabled') + '>حذف البيانات التجريبية</button></div></div>';
  }
  function drawBackupPreview(v) {
    const el = $('#bk-preview');
    if (!el) return;
    if (!v.ok) { el.innerHTML = '<div class="err">النسخة غير صالحة ولم يتغير أي شيء:<br>' + v.errors.map(E).join('<br>') + '</div>'; return; }
    const c = v.info.counts;
    el.innerHTML = '<div class="panel" style="margin-top:10px"><h3>معاينة النسخة</h3><p>تاريخ التصدير: ' + INV.fmtDT(v.info.exportedAt) + '<br>منتجات: ' + (c.products || 0) + ' • دفعات: ' + (c.batches || 0) + ' • حركات: ' + (c.movements || 0) + ' • جرد: ' + (c.stocktakes || 0) + '</p>' +
      '<label class="chk-i"><input type="radio" name="bkmode" value="merge" checked> دمج مع البيانات الحالية (السجلات المتطابقة المعرّف تُستبدل بما في الملف، والإعدادات الحالية تبقى)</label>' +
      '<label class="chk-i"><input type="radio" name="bkmode" value="replace"> استبدال كل البيانات الحالية بالنسخة</label>' +
      '<label class="chk-i"><input type="checkbox" id="bk-ok"> أفهم أن الاستبدال يمحو البيانات الحالية (سيُنزَّل ملف أمان تلقائياً قبل الاستبدال)</label>' +
      '<div class="actions"><button class="btn danger" data-act="restore-go">استعادة</button></div></div>';
  }
  function csvPreview(text) {
    const v = INV.validateImport(INV.parseCSV(text), S.products);
    const el = $('#csv-preview');
    if (v.error) { csvItems = null; el.innerHTML = '<div class="err">' + E(v.error) + '</div>'; return; }
    csvItems = v.items;
    const n = function (s) { return v.items.filter(function (i) { return i.status === s; }).length; };
    el.innerHTML = '<div class="panel" style="margin-top:10px"><p>صالحة: <b>' + n('ok') + '</b> • مكررة (ستُتجاهل): <b>' + n('dup') + '</b> • بها أخطاء (ستُتجاهل): <b>' + n('error') + '</b></p><div class="tw"><table><thead><tr><th>السطر</th><th>الاسم</th><th>الحالة</th><th>الملاحظات</th></tr></thead><tbody>' + v.items.slice(0, 300).map(function (i) {
      return '<tr><td>' + i.line + '</td><td>' + E(i.data.name) + '</td><td>' + (i.status === 'ok' ? bd('b-ok', 'صالح') : i.status === 'dup' ? bd('b-w2', 'مكرر') : bd('b-exp', 'خطأ')) + '</td><td>' + E(i.msgs.map(function (m) { return m.field + ': ' + m.msg; }).join(' | ')) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + (v.items.length > 300 ? '<p class="mut small">المعاينة تعرض أول 300 سطر فقط، لكن الاستيراد يشمل كل الصفوف الصالحة.</p>' : '') + '<div class="actions"><button class="btn green" data-act="csv-run"' + (n('ok') ? '' : ' disabled') + '>استيراد الصفوف الصالحة (' + n('ok') + ')</button></div></div>';
  }

  /* ===== الإعدادات ===== */
  function vSettings() {
    const s = S.settings;
    return '<form id="set-form" class="panel">' + inp('اسم الصيدلية (يظهر في التقارير)', 'pharmacyName', s.pharmacyName) +
      '<div class="row3">' + inp('تنبيه أول (أيام)', 'warn1', s.warn1, { type: 'number', attr: 'min="1" step="1"' }) + inp('تنبيه ثانٍ', 'warn2', s.warn2, { type: 'number', attr: 'min="1" step="1"' }) + inp('تنبيه ثالث', 'warn3', s.warn3, { type: 'number', attr: 'min="1" step="1"' }) + '</div>' +
      sel('المظهر', 'theme', [['dark', 'داكن'], ['light', 'فاتح']], A.getTheme()) +
      '<label class="chk-i"><input type="checkbox" name="allowNegative"' + (s.allowNegative ? ' checked' : '') + '> السماح بالرصيد السالب (غير مفضّل: يعطّل حماية الصرف الزائد)</label><div class="actions"><button class="btn primary" type="submit">حفظ الإعدادات</button></div></form>' +
      '<div class="panel"><h3>عن التطبيق</h3><p>Amino Cure Drug Stock — الإصدار 1.0<br>أداة لتنظيم مخزون الصيدلية، وليست نظاماً للقرار السريري ولا تقدم توصيات علاجية أو جرعات. البيانات محفوظة على هذا الجهاز فقط. الإصدار يحتاج إلى اختبار قبل الاعتماد عليه.</p></div>' +
      '<div class="panel"><h3>منطقة الخطر</h3><p class="mut small">يمحو كل المنتجات والدفعات والحركات والجرد. صدّر نسخة احتياطية أولاً.</p><button class="btn danger" data-act="wipe">حذف كل البيانات</button></div>';
  }

  A.pages.inventory = vInv;
  A.pages.movements = vMoves;
  A.pages.expiry = vExpiry;
  A.pages.stocktaking = vStock;
  A.pages.purchase = vPurchase;
  A.pages.reports = vReports;
  A.pages.backup = vBackup;
  A.pages.settings = vSettings;

  /* ===== الأحداث ===== */
  document.addEventListener('click', async function (e) {
    const t = e.target;
    if (t.id === 'modal') { closeModal(); return; }
    if (t.closest('[data-close]')) { closeModal(); return; }
    const a = t.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act, d = a.dataset;
    try {
      switch (act) {
        case 'add-product': productForm(); break;
        case 'edit-product': productForm(d.id); break;
        case 'view-product': viewProduct(d.id); break;
        case 'new-move': moveForm({ type: d.type, productId: d.product, batchId: d.batch }); break;
        case 'archive': {
          const p = S.products.find(function (x) { return x.id === d.id; });
          const tot = S.batches.filter(function (b) { return b.productId === d.id; }).reduce(function (s, b) { return s + b.quantity; }, 0);
          if (!p.archived && tot > 0 && !(await confirmBox('في هذا المنتج مخزون (' + tot + ' وحدة). الأرشفة تستثنيه من الإحصائيات والجرد. متابعة؟', 'أرشفة'))) break;
          await INV.archiveProduct(d.id, !p.archived);
          await done(p.archived ? 'تمت الاستعادة' : 'تمت الأرشفة');
          break;
        }
        case 'delete-product':
          if (await confirmBox('حذف هذا المنتج نهائياً؟ لا يمكن حذف منتج له حركات مخزون (استخدم الأرشفة).', 'حذف', true)) { await INV.deleteProduct(d.id); await done('تم الحذف'); }
          break;
        case 'export-moves': REP.download('movements-' + REP.stamp() + '.csv', REP.csv([['التاريخ', 'النوع', 'المنتج', 'الدفعة', 'الصلاحية', 'التغير', 'قبل', 'بعد', 'المرجع', 'ملاحظات']].concat(filteredMoves().map(function (m) { return [INV.fmtDT(m.date), INV.TYPES[m.type] ? INV.TYPES[m.type].label : m.type, m.productName, m.lot, m.expiry, m.delta, m.prevQty, m.newQty, m.ref, m.notes]; })))); break;
        case 'start-stocktake': startStocktakeForm(); break;
        case 'open-stocktake': stOpen = d.id; A.render(); break;
        case 'st-back': stOpen = null; A.render(); break;
        case 'review-stocktake': reviewStocktake(d.id); break;
        case 'cancel-stocktake':
          if (await confirmBox('إلغاء هذا الجرد؟ لن تتغير أي كميات.', 'إلغاء الجرد', true)) { await INV.cancelStocktake(d.id); stOpen = null; await done('تم إلغاء الجرد'); }
          break;
        case 'st-report': RS.type = 'stocktake'; RS.st = d.id; curRep = null; A.go('reports'); setTimeout(runReport, 80); break;
        case 'print': window.print(); break;
        case 'export-purchase': REP.download('purchase-' + REP.stamp() + '.csv', REP.csv([['المنتج', 'التركيز', 'المتاح', 'الحد الأدنى', 'المستهدف', 'المقترح']].concat(purRows().map(function (r) { return [r.e.p.name, r.e.p.strength, r.e.avail, r.e.p.minStock, r.target, r.sug]; })))); break;
        case 'run-report': await runReport(); break;
        case 'csv-report': if (!curRep) await runReport(); REP.download('report-' + RS.type + '-' + REP.stamp() + '.csv', REP.repCSV(curRep)); break;
        case 'export-backup': await REP.downloadBackup(); await DB.setSettings({ lastBackup: new Date().toISOString() }); toast('تم تنزيل النسخة. انسخها إلى مكان آمن'); await A.refresh(); break;
        case 'pick-backup': $('#f-backup').click(); break;
        case 'restore-go': {
          if (!bkObj) { toast('اختر ملف نسخة صالحاً أولاً', true); break; }
          const mode = ($('input[name=bkmode]:checked') || {}).value || 'merge';
          if (mode === 'replace' && !$('#bk-ok').checked) { toast('أكّد فهمك لخطورة الاستبدال أولاً', true); break; }
          if (!(await confirmBox(mode === 'replace' ? 'سيتم استبدال كل البيانات الحالية بالنسخة. سيُنزَّل ملف أمان بالبيانات الحالية أولاً.' : 'سيتم دمج النسخة مع البيانات الحالية.', 'تأكيد الاستعادة', mode === 'replace'))) break;
          if (mode === 'replace') await REP.downloadBackup('AminoCure-before-restore');
          await REP.restore(bkObj, mode);
          bkObj = null;
          await A.refresh();
          toast('تمت الاستعادة بنجاح');
          break;
        }
        case 'dl-template': REP.download('products-template.csv', '\uFEFF' + INV.CSV_COLS.join(',') + '\r\n'); break;
        case 'copy-template':
          try { await navigator.clipboard.writeText(INV.CSV_COLS.join(',')); toast('تم نسخ سطر العناوين'); } catch (x) { toast('تعذر النسخ، استخدم تنزيل القالب', true); }
          break;
        case 'pick-csv': $('#f-csv').click(); break;
        case 'csv-preview-text': csvPreview($('#csv-text').value); break;
        case 'csv-run': {
          if (!csvItems) break;
          const items = csvItems;
          a.disabled = true;
          const added = await INV.runImport(items);
          csvItems = null;
          const dup = items.filter(function (i) { return i.status === 'dup'; }), er = items.filter(function (i) { return i.status === 'error'; });
          let h = '<p>تمت إضافة: <b>' + added + '</b> • مكررة متجاهلة: <b>' + dup.length + '</b> • بها أخطاء متجاهلة: <b>' + er.length + '</b></p>';
          if (dup.length || er.length) h += '<div class="tw"><table><thead><tr><th>السطر</th><th>الاسم</th><th>السبب</th></tr></thead><tbody>' + dup.map(function (i) { return '<tr><td>' + i.line + '</td><td>' + E(i.data.name) + '</td><td>مكرر</td></tr>'; }).concat(er.map(function (i) { return '<tr><td>' + i.line + '</td><td>' + E(i.data.name) + '</td><td>' + E(i.msgs.map(function (m) { return m.field + ': ' + m.msg; }).join(' | ')) + '</td></tr>'; })).join('') + '</tbody></table></div>';
          openModal('تقرير الاستيراد', h + '<div class="actions"><button class="btn primary" data-close>حسناً</button></div>', true);
          await A.refresh();
          break;
        }
        case 'load-demo':
          if (await confirmBox('ستُضاف 5 منتجات تجريبية موسومة [تجريبي] لتجربة التطبيق فقط. يمكنك حذفها لاحقاً.', 'تحميل')) { await INV.loadDemo(); await A.refresh(); toast('تم تحميل البيانات التجريبية'); }
          break;
        case 'remove-demo':
          if (await confirmBox('حذف المنتجات التجريبية ودفعاتها وحركاتها فقط؟ بياناتك الحقيقية لن تتأثر.', 'حذف التجريبي', true)) { const n = await INV.removeDemo(); await A.refresh(); toast('حُذف ' + n + ' منتج تجريبي'); }
          break;
        case 'wipe':
          openForm('حذف كل البيانات', '<p class="err">سيُمحى كل شيء نهائياً. صدّر نسخة احتياطية أولاً.</p>' + inp('اكتب كلمة «حذف» للتأكيد', 'word', ''), 'حذف نهائي', async function (f) {
            if (fd(f).word.trim() !== 'حذف') throw new Error('اكتب كلمة حذف بالضبط');
            await DB.clearAll();
            await done('تم حذف كل البيانات');
          });
          break;
      }
    } catch (err) { toast(err.message || String(err), true); }
  });

  document.addEventListener('input', function (e) {
    const t = e.target;
    if (t.id === 'inv-q') { F.q = t.value; $('#inv-list').innerHTML = invList(); }
    else if (t.classList.contains('tgt')) {
      PU.targets[t.dataset.id] = t.value;
      const r = purRows().find(function (x) { return x.e.p.id === t.dataset.id; });
      const c = $('[data-sug="' + t.dataset.id + '"]');
      if (r && c) c.innerHTML = '<b>' + r.sug + '</b>';
    }
  });

  document.addEventListener('change', async function (e) {
    const t = e.target;
    if (t.id === 'f-backup') {
      const file = t.files[0];
      t.value = '';
      if (!file) return;
      try {
        const txt = await file.text();
        let o;
        try { o = JSON.parse(txt); } catch (x) { throw new Error('الملف ليس JSON صالحاً (قد يكون تالفاً)'); }
        const v = REP.validateBackup(o);
        bkObj = v.ok ? o : null;
        drawBackupPreview(v);
      } catch (err) { toast(err.message, true); }
    } else if (t.id === 'f-csv') {
      const file = t.files[0];
      t.value = '';
      if (!file) return;
      try { csvPreview(await file.text()); } catch (err) { toast(err.message, true); }
    } else if (t.id === 'inv-f') { F.f = t.value; $('#inv-list').innerHTML = invList(); }
    else if (t.id === 'inv-s') { F.sort = t.value; $('#inv-list').innerHTML = invList(); }
    else if (t.id === 'mv-ft' || t.id === 'mv-fa' || t.id === 'mv-fb') { MF.type = $('#mv-ft').value; MF.from = $('#mv-fa').value; MF.to = $('#mv-fb').value; A.render(); }
    else if (t.id === 'pu-mult') { PU.mult = Number(t.value) > 0 ? Number(t.value) : 2; PU.targets = {}; $('#pu-body').innerHTML = purBody(); }
    else if (t.classList.contains('cnt')) {
      try {
        await INV.setCount(stOpen, t.dataset.batch, t.value);
        S.stocktakes = await DB.getAll('stocktakes');
        const st = S.stocktakes.find(function (x) { return x.id === stOpen; });
        const it = st.items.find(function (i) { return i.batchId === t.dataset.batch; });
        const c = $('[data-diff="' + t.dataset.batch + '"]');
        const df = it.counted == null ? '' : it.counted - it.expected;
        c.textContent = df === '' ? '' : (df > 0 ? '+' : '') + df;
        c.className = df < 0 ? 'neg' : df > 0 ? 'pos' : '';
      } catch (err) { toast(err.message, true); }
    }
  });

  document.addEventListener('submit', async function (e) {
    if (e.target.id !== 'set-form') return;
    e.preventDefault();
    try {
      const d = fd(e.target), w1 = Number(d.warn1), w2 = Number(d.warn2), w3 = Number(d.warn3);
      if (![w1, w2, w3].every(function (x) { return Number.isInteger(x) && x > 0; }) || !(w1 < w2 && w2 < w3)) throw new Error('أيام التنبيه يجب أن تكون أعداداً صحيحة متزايدة (مثال: 30 ثم 60 ثم 90)');
      await DB.setSettings({ pharmacyName: d.pharmacyName.trim(), warn1: w1, warn2: w2, warn3: w3, allowNegative: d.allowNegative === 'on' });
      A.setTheme(d.theme === 'light' ? 'light' : 'dark');
      await A.refresh();
      toast('تم حفظ الإعدادات');
    } catch (err) { toast(err.message, true); }
  });

  document.addEventListener('keydown', function (e) {
    const m = $('#modal');
    if (e.key === 'Escape' && m && !m.hidden) closeModal();
  });
})();
