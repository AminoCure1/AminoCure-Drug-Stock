'use strict';
(function () {
  const APP = window.APP = {
    S: { products: [], batches: [], movements: [], stocktakes: [], settings: { warn1: 30, warn2: 60, warn3: 90, allowNegative: false, pharmacyName: '' } },
    pages: {}, view: 'dashboard'
  };
  const S = APP.S;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function E(v) { return INV.esc(v); }
  function setText(sel, t) { const el = $(sel); if (el) el.textContent = t; }
  APP.$ = $; APP.$$ = $$; APP.E = E;

  const TITLES = { dashboard: 'لوحة التحكم', inventory: 'المخزون والأصناف', movements: 'حركات المخزون', expiry: 'الصلاحية والتنبيهات', stocktaking: 'الجرد الفعلي', purchase: 'المشتريات المقترحة', reports: 'التقارير', backup: 'النسخ الاحتياطي', settings: 'الإعدادات' };
  const ICONS = {
    purchase: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h11l2-8H6.5"/>',
    settings: '<path d="M4 6h9"/><path d="M17 6h3"/><path d="M4 12h3"/><path d="M11 12h9"/><path d="M4 18h11"/><path d="M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    box: '<path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    warn: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>'
  };

  /* ---------- المظهر ---------- */
  function getTheme() { try { return localStorage.getItem('ac-theme') === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  function setTheme(t) {
    try { localStorage.setItem('ac-theme', t); } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('data-theme', t);
    setText('#themeIcon', t === 'light' ? '☾' : '☀');
    setText('#themeText', t === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح');
  }
  APP.getTheme = getTheme; APP.setTheme = setTheme;
  document.documentElement.setAttribute('data-theme', getTheme());

  /* ---------- أدوات الواجهة المشتركة ---------- */
  function toast(m, err) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = m;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 3800);
  }
  function closeModal() { const m = $('#modal'); m.innerHTML = ''; m.hidden = true; }
  function openModal(title, body, wide) {
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = '<div class="mbox' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="mhead"><h3>' + E(title) + '</h3><button class="x" data-close aria-label="إغلاق">✕</button></div><div class="mbody">' + body + '</div></div>';
    return $('.mbody', m);
  }
  function confirmBox(msg, ok, danger) {
    return new Promise(function (res) {
      openModal('تأكيد', '<p class="pre">' + E(msg) + '</p><div class="actions"><button class="btn ' + (danger ? 'danger' : 'primary') + '" id="c-ok">' + E(ok || 'تأكيد') + '</button><button class="btn" id="c-no">إلغاء</button></div>');
      $('#c-ok').onclick = function () { closeModal(); res(true); };
      $('#c-no').onclick = function () { closeModal(); res(false); };
      $('#modal .x').onclick = function () { closeModal(); res(false); };
    });
  }
  function showErr(m) {
    const x = $('#merr');
    if (x) { x.textContent = m; x.hidden = false; x.scrollIntoView({ block: 'nearest' }); } else toast(m, true);
  }
  function openForm(title, fields, submit, handler, wide) {
    openModal(title, '<form id="mform" novalidate>' + fields + '<div id="merr" class="err" hidden></div><div class="actions"><button class="btn primary" type="submit">' + E(submit) + '</button><button class="btn" type="button" data-close>إلغاء</button></div></form>', wide);
    const f = $('#mform');
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      const btn = $('button[type=submit]', f);
      if (btn.disabled) return;
      btn.disabled = true;
      $('#merr').hidden = true;
      try {
        const keep = await handler(f);
        if (keep === false) btn.disabled = false;
      } catch (e) {
        showErr(e.message || String(e));
        btn.disabled = false;
      }
    });
    return f;
  }
  function fd(f) { const o = {}; new FormData(f).forEach(function (v, k) { o[k] = typeof v === 'string' ? v : ''; }); return o; }
  function inp(label, name, val, o) {
    o = o || {};
    return '<label class="f"><span>' + E(label) + (o.req ? ' *' : '') + '</span><input name="' + name + '" type="' + (o.type || 'text') + '" value="' + E(val == null ? '' : val) + '" ' + (o.attr || '') + '></label>';
  }
  function sel(label, name, opts, val) {
    return '<label class="f"><span>' + E(label) + '</span><select name="' + name + '">' + opts.map(function (o) {
      return '<option value="' + E(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + E(o[1]) + '</option>';
    }).join('') + '</select></label>';
  }
  function bar(extra, title) {
    return '<div class="row noprint" style="justify-content:space-between">' + (title ? '<b>' + E(title) + '</b>' : '<span></span>') + '<div class="row" style="margin:0">' + (extra || '') + '</div></div>';
  }
  function bd(c, t) { return '<span class="badge ' + c + '">' + E(t) + '</span>'; }
  function stBadge(b) {
    const s = INV.expiryStatus(b.expiry, S.settings);
    const c = { expired: 'b-exp', w1: 'b-w1', w2: 'b-w2', w3: 'b-w3', ok: 'b-ok', none: 'b-ok' }[s];
    return bd(c, INV.expLabel(s, S.settings));
  }
  function mvTable(list) {
    if (!list.length) return '<p class="mut">لا توجد حركات.</p>';
    return '<div class="tw"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المنتج</th><th>الدفعة</th><th>التغير</th><th>الرصيد</th><th>ملاحظات</th></tr></thead><tbody>' +
      list.map(function (m) {
        return '<tr><td>' + INV.fmtDT(m.date) + '</td><td>' + E(INV.TYPES[m.type] ? INV.TYPES[m.type].label : m.type) + '</td><td>' + E(m.productName) + '</td><td>' + E(m.lot || '—') + '</td><td class="' + (m.delta < 0 ? 'neg' : 'pos') + '" dir="ltr">' + (m.delta > 0 ? '+' : '') + m.delta + '</td><td dir="ltr">' + m.prevQty + ' → ' + m.newQty + '</td><td>' + E([m.ref, m.notes].filter(Boolean).join(' | ')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  Object.assign(APP, { toast: toast, closeModal: closeModal, openModal: openModal, confirmBox: confirmBox, showErr: showErr, openForm: openForm, fd: fd, inp: inp, sel: sel, bar: bar, bd: bd, stBadge: stBadge, mvTable: mvTable });

  /* ---------- البيانات ---------- */
  APP.load = async function () {
    S.products = await DB.getAll('products');
    S.batches = await DB.getAll('batches');
    S.movements = await DB.getAll('movements');
    S.stocktakes = await DB.getAll('stocktakes');
    S.settings = await DB.getSettings();
  };
  APP.refresh = async function () { await APP.load(); APP.render(); };
  APP.done = async function (msg) { closeModal(); toast(msg); await APP.refresh(); };
  APP.fatal = function (msg) {
    const m = $('.main-content');
    const d = document.createElement('div');
    d.className = 'err';
    d.textContent = msg;
    if (m) m.insertBefore(d, m.children[1] || null);
  };

  /* ---------- الرئيسية: ربط بطاقاتك بالأرقام الحقيقية ---------- */
  function statCard(cls, label, icon, key, page) {
    return '<article class="stat-card ' + cls + '" data-page="' + page + '"><div class="stat-top"><span>' + label + '</span><span class="stat-icon ac-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + icon + '</svg></span></div><strong data-x="' + key + '">0</strong><p data-xp="' + key + '"></p></article>';
  }
  function fillPanel(panel, html) {
    const empty = $('.empty-state', panel);
    let slot = $('.dash-slot', panel);
    if (!slot) { slot = document.createElement('div'); slot.className = 'dash-slot'; panel.appendChild(slot); }
    if (html) { if (empty) empty.style.display = 'none'; slot.innerHTML = html; }
    else { if (empty) empty.style.display = ''; slot.innerHTML = ''; }
  }
  function renderDash() {
    const k = INV.stats(S.products, S.batches, S.movements, S.settings);
    const g = $('#page-dashboard .stats-grid');
    const v = function (cls, n, txt) {
      const s = $('.' + cls + ' > strong', g), p = $('.' + cls + ' > p', g);
      if (s) s.textContent = n;
      if (p) p.textContent = txt;
    };
    v('purple-stat', k.products, 'منتج نشط مسجل');
    v('green-stat', k.units, 'وحدة فعلية في كل الدفعات');
    v('orange-stat', k.low.length, 'منتج تحت الحد الأدنى');
    v('red-stat', k.expired + k.near, 'دفعة منتهية أو قاربت الانتهاء');
    const xs = { batches: [k.batches, 'دفعة كميتها أكبر من صفر'], expired: [k.expired, 'دفعة منتهية الصلاحية'], near: [k.near, 'خلال ' + S.settings.warn3 + ' يوم'], zero: [k.zero.length, 'منتج بلا مخزون صالح'] };
    Object.keys(xs).forEach(function (key) {
      setText('[data-x="' + key + '"]', xs[key][0]);
      setText('[data-xp="' + key + '"]', xs[key][1]);
    });
    const demo = S.products.some(function (p) { return p.demo; });
    setText('.demo-banner p', demo ? 'توجد بيانات تجريبية موسومة [تجريبي]. احذفها من صفحة «النسخ الاحتياطي» قبل إدخال بيانات صيدليتك الحقيقية.' : 'كل الأرقام محسوبة من بياناتك المحفوظة على هذا الجهاز فقط. خذ نسخة احتياطية دورياً.');
    const panels = $$('#page-dashboard .content-grid .panel');
    if (panels.length > 1) {
      fillPanel(panels[0], k.recent.length ? mvTable(k.recent) : '');
      const pm = {};
      S.products.forEach(function (p) { pm[p.id] = p; });
      const sum = INV.summarize(S.products.filter(function (p) { return !p.archived; }), S.batches, S.settings);
      const urgent = INV.sortBatches(S.batches).filter(function (b) {
        return b.quantity > 0 && pm[b.productId] && !pm[b.productId].archived && INV.expiryStatus(b.expiry, S.settings) !== 'ok';
      }).slice(0, 5);
      let h = '';
      if (k.low.length) h += '<h4 class="dl-title">تحت الحد الأدنى</h4>' + k.low.slice(0, 5).map(function (p) { return '<div class="dl"><span>' + E(p.name) + '</span><b>' + sum[p.id].avail + ' / ' + p.minStock + '</b></div>'; }).join('');
      if (urgent.length) h += '<h4 class="dl-title">أقرب الدفعات انتهاءً</h4>' + urgent.map(function (b) { return '<div class="dl"><span>' + E(pm[b.productId].name) + ' <small class="mut">(' + E(b.lot || '—') + ')</small></span><span>' + stBadge(b) + ' ' + INV.fmtDate(b.expiry) + '</span></div>'; }).join('');
      if (!h) h = '<p class="ok-line">لا توجد تنبيهات حالياً ✓</p>';
      fillPanel(panels[1], S.products.length ? h : '');
    }
  }

  APP.render = function () {
    if (APP.view === 'dashboard') { renderDash(); return; }
    const b = $('#body-' + APP.view);
    if (b && APP.pages[APP.view]) b.innerHTML = APP.pages[APP.view]();
  };

  /* ---------- التنقل ---------- */
  function setMenu(open) {
    $('#sidebar').classList.toggle('open', open);
    $('#menuToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function show(page) {
    if (page !== 'dashboard' && !APP.pages[page]) page = 'dashboard';
    APP.view = page;
    if (APP.onShow) APP.onShow(page);
    $$('.page-section').forEach(function (s) {
      const on = s.id === 'page-' + page;
      s.hidden = !on;
      s.classList.toggle('active', on);
    });
    $$('.nav-link').forEach(function (a) { a.classList.toggle('active', a.dataset.page === page); });
    setText('#pageHeading', TITLES[page] || '');
    APP.render();
    window.scrollTo(0, 0);
  }
  function go(p) { if (location.hash === '#' + p) show(p); else location.hash = '#' + p; }
  APP.go = go;

  /* ---------- تجهيز الصفحة (بدون تعديل ملفاتك) ---------- */
  function injectCSS() {
    const st = document.createElement('style');
    st.id = 'app-extra-style';
    st.textContent = `
:root{--yel:#e0b000}
html[data-theme="light"]{--yel:#8a6d00}
[hidden]{display:none!important}
.top-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.net-chip{font-size:11px;padding:3px 10px;border-radius:99px;border:1px solid var(--border)}
.net-chip.on{color:var(--green)}.net-chip.off{color:var(--orange)}
.stat-card[data-page]{cursor:pointer}
#extra-stats{margin-top:-14px}
.qa-panel{margin-bottom:17px}
.qa-panel h3{margin:0 0 4px;font-size:14px}
.dash-slot{margin-top:8px}
.dl-title{margin:10px 0 4px;font-size:12px;color:var(--muted);font-weight:600}
.dl{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px}
.ok-line{color:var(--green);margin:10px 0}
.page-body .panel{margin-bottom:14px}
.page-body h3,.overlay h3{margin:4px 0 8px;font-size:15px}
.page-body p{margin:6px 0}
.mut{color:var(--muted)}.small{font-size:12px}.pre{white-space:pre-wrap}
.row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:center}
.row3{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.f{display:block;margin:0 0 10px}
.f span{display:block;font-size:12px;color:var(--muted);margin-bottom:3px}
.page-body input,.page-body select,.page-body textarea,.overlay input,.overlay select,.overlay textarea{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:9px 10px;font-size:14px}
.page-body input[type=checkbox],.page-body input[type=radio],.overlay input[type=checkbox],.overlay input[type=radio]{width:auto}
.page-body textarea,.overlay textarea{min-height:70px}
.page-body .row input,.page-body .row select,.overlay .row input,.overlay .row select{width:auto;flex:1 1 140px}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.btn{background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:9px 14px;font-size:13px;cursor:pointer}
.btn.primary{background:var(--purple);color:#14102a;border-color:var(--purple);font-weight:700}
.btn.green{background:var(--green);color:#06241a;border-color:var(--green);font-weight:700}
.btn.danger{background:var(--red);color:#fff;border-color:var(--red)}
html[data-theme="light"] .btn.primary,html[data-theme="light"] .btn.green{color:#fff}
.btn.sm{padding:5px 10px;font-size:12px;min-height:0}
.item{display:flex;justify-content:space-between;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px;margin:0 0 8px;cursor:pointer}
.it-side{text-align:center;min-width:90px}
.qty{font-size:22px;font-weight:700}
.badge{display:inline-block;font-size:11px;padding:1px 8px;border-radius:99px;margin:2px;border:1px solid}
.b-exp{color:var(--red);border-color:var(--red)}
.b-w1{color:var(--orange);border-color:var(--orange)}
.b-w2{color:var(--yel);border-color:var(--yel)}
.b-w3{color:var(--blue);border-color:var(--blue)}
.b-ok{color:var(--green);border-color:var(--green)}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
.page-body table,.overlay table{font-size:13px}
.page-body th,.page-body td,.overlay th,.overlay td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}
th{color:var(--muted);font-weight:600}
td.pos{color:var(--green)}td.neg{color:var(--red)}
.page-body td input{width:90px;padding:5px 6px}
.err{color:var(--red);background:color-mix(in srgb,var(--red) 12%,transparent);border:1px solid var(--red);border-radius:10px;padding:8px;margin:8px 0}
.ok{color:var(--green)}
.overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:10px;overflow-y:auto}
.mbox{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:14px;width:100%;max-width:520px;margin:10px 0}
.mbox.wide{max-width:820px}
.mhead{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border)}
.mhead h3{margin:0}
.x{background:none;border:0;color:var(--text);font-size:20px;cursor:pointer}
.mbody{padding:12px 14px}
.chk{max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:6px;margin:6px 0}
.chk-i{display:flex;gap:8px;align-items:center;padding:4px 2px}
#toasts{position:fixed;bottom:20px;left:10px;right:10px;z-index:3000;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
.toast{background:var(--green);color:#06241a;padding:9px 14px;border-radius:10px;font-size:14px;max-width:520px}
.toast.err{background:var(--red);color:#fff;border:0}
.rep{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px}
.rep-head{text-align:center;margin-bottom:10px}
.rep-head h2{margin:0;font-size:18px}
.rep-head h3{margin:6px 0}
.rep-foot{margin-top:10px;font-size:12px;text-align:center}
.print-only{display:none}
@media print{
  .noprint,#toasts,#modal,.net-chip,.section-heading,.qa-panel{display:none!important}
  .main-content{margin:0!important;max-width:none!important;width:100%!important;padding:0!important}
  .print-only{display:block}
  .rep,.panel{background:#fff;color:#000;border:0}
  .mut,th{color:#333}
  table{font-size:11px}
  th,td{border-bottom:1px solid #999!important;color:#000;white-space:normal!important}
  .page-body td input{border:0;background:none;color:#000;width:auto}
}`;
    document.head.appendChild(st);
  }

  function buildShell() {
    if (!$('link[rel="manifest"]')) {
      [['manifest', 'manifest.json'], ['icon', 'icon-192.png'], ['apple-touch-icon', 'icon-192.png']].forEach(function (x) {
        const l = document.createElement('link');
        l.rel = x[0]; l.href = x[1];
        document.head.appendChild(l);
      });
    }
    document.body.insertAdjacentHTML('beforeend', '<div id="modal" class="overlay" hidden></div><div id="toasts"></div><input type="file" id="f-backup" accept=".json,application/json" hidden><input type="file" id="f-csv" accept=".csv,text/csv,text/plain" hidden>');

    const tt = $('#themeToggle');
    const wrap = document.createElement('div');
    wrap.className = 'top-actions';
    tt.parentNode.insertBefore(wrap, tt);
    wrap.insertAdjacentHTML('beforeend', '<span id="net" class="net-chip on">متصل</span><button class="theme-toggle" id="btn-install" type="button" hidden>تثبيت التطبيق</button>');
    wrap.appendChild(tt);

    const nav = $('.navigation');
    const navBtn = function (page, label) {
      return '<button class="nav-link" data-page="' + page + '" type="button"><span class="nav-icon ac-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICONS[page] + '</svg></span><span>' + label + '</span></button>';
    };
    $('[data-page="stocktaking"]', nav).insertAdjacentHTML('afterend', navBtn('purchase', 'المشتريات المقترحة'));
    nav.insertAdjacentHTML('beforeend', navBtn('settings', 'الإعدادات'));
    nav.insertAdjacentHTML('beforeend',
  '<button class="nav-link" data-page="guide" type="button"><span class="nav-icon">📘</span><span>دليل الاستخدام</span></button>'
);

    const footer = $('.main-footer');
    [['purchase', 'المشتريات المقترحة', 'اقتراحات حسابية للشراء حسب الحد الأدنى للمخزون.'], ['settings', 'الإعدادات', 'أيام تنبيه الصلاحية واسم الصيدلية والمظهر.']].forEach(function (p) {
      footer.insertAdjacentHTML('beforebegin', '<section class="page-section" id="page-' + p[0] + '" hidden><div class="section-heading"><div><h3>' + p[1] + '</h3><p>' + p[2] + '</p></div></div></section>');
    });
    $$('.page-section').forEach(function (sec) {
      if (sec.id === 'page-dashboard') return;
      const body = document.createElement('div');
      body.className = 'page-body';
      body.id = 'body-' + sec.id.slice(5);
      const ph = $('.placeholder-panel', sec);
      if (ph) ph.replaceWith(body); else sec.appendChild(body);
    });

    const g = $('#page-dashboard .stats-grid');
    [['purple-stat', 'inventory'], ['green-stat', 'inventory'], ['orange-stat', 'purchase'], ['red-stat', 'expiry']].forEach(function (x) { const c = $('.' + x[0], g); if (c) c.dataset.page = x[1]; });
    g.insertAdjacentHTML('afterend', '<div class="stats-grid" id="extra-stats">' +
      statCard('purple-stat', 'دفعات متوفرة', ICONS.box, 'batches', 'inventory') +
      statCard('red-stat', 'دفعات منتهية', ICONS.clock, 'expired', 'expiry') +
      statCard('orange-stat', 'قاربت الانتهاء', ICONS.clock, 'near', 'expiry') +
      statCard('orange-stat', 'رصيد صفر', ICONS.warn, 'zero', 'purchase') + '</div>');
    $('#page-dashboard .quick-grid').insertAdjacentHTML('afterend', '<div class="panel qa-panel"><h3>تسجيل سريع</h3><div class="row"><button class="btn primary" data-act="add-product">+ منتج جديد</button><button class="btn green" data-act="new-move" data-type="in">تسجيل وارد</button><button class="btn" data-act="new-move" data-type="out">تسجيل صادر</button><button class="btn" data-act="start-stocktake">بدء جرد</button></div></div>');

    const ep = $$('#page-dashboard .content-grid .empty-state p');
    if (ep[0]) ep[0].textContent = 'لا توجد حركات بعد. سجّل رصيداً افتتاحياً أو وارداً من «تسجيل سريع».';
    if (ep[1]) ep[1].textContent = 'أضف أصنافاً لتظهر ملخصات النواقص والصلاحية هنا.';
    setText('.sidebar-note strong', 'الإصدار 1.0');
    setText('.sidebar-note p', 'البيانات على هذا الجهاز فقط');
    setText('#currentDate', new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }));
  }

  let deferred = null;
  function net() {
    const n = $('#net');
    n.textContent = navigator.onLine ? 'متصل' : 'بدون إنترنت (يعمل محلياً)';
    n.className = 'net-chip ' + (navigator.onLine ? 'on' : 'off');
  }
  function bind() {
    document.addEventListener('click', function (e) {
      const n = e.target.closest('[data-page]');
      if (n) { go(n.dataset.page); setMenu(false); return; }
      if ($('#sidebar').classList.contains('open') && !e.target.closest('#sidebar') && !e.target.closest('#menuToggle')) setMenu(false);
    });
    $('#menuToggle').addEventListener('click', function () { setMenu(!$('#sidebar').classList.contains('open')); });
    $('#themeToggle').addEventListener('click', function () { setTheme(getTheme() === 'light' ? 'dark' : 'light'); });
    $('#btn-install').addEventListener('click', async function () {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      $('#btn-install').hidden = true;
    });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('#btn-install').hidden = false; });
    window.addEventListener('appinstalled', function () { $('#btn-install').hidden = true; });
    window.addEventListener('hashchange', function () { show((location.hash || '#dashboard').slice(1)); });
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    window.addEventListener('error', function (e) { toast('خطأ غير متوقع: ' + e.message, true); });
  }

  async function boot() {
    injectCSS();
    buildShell();
    bind();
    net();
    setTheme(getTheme());
    try { await DB.open(); await APP.load(); DB.requestPersist(); }
    catch (e) { APP.fatal('تعذر فتح قاعدة البيانات: ' + e.message); return; }
    show((location.hash || '#dashboard').slice(1));
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('service-worker.js').catch(function () { /* ignore */ });
    }
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('تعذر تحميل الملف: ' + src)); };
      document.head.appendChild(s);
    });
  }
  (async function () {
    try {
      for (const f of ['database.js', 'inventory.js', 'reports.js', 'views.js','guide.js']) await loadScript(f);
      await boot();
    } catch (e) {
      APP.fatal(e.message || String(e));
    }
  })();
})();
