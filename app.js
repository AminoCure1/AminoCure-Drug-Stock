
'use strict';
(function () {
  const APP = window.APP = {
    S: {
      products: [],
      batches: [],
      movements: [],
      stocktakes: [],
      settings: {
        warn1: 30,
        warn2: 60,
        warn3: 90,
        allowNegative: false,
        pharmacyName: ''
      }
    },
    pages: {},
    view: 'dashboard'
  };

  const S = APP.S;

  function $(s, r) {
    return (r || document).querySelector(s);
  }

  function $$(s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  }

  function E(v) {
    return INV.esc(v);
  }

  function setText(sel, t) {
    const el = $(sel);
    if (el) el.textContent = t;
  }

  APP.$ = $;
  APP.$$ = $$;
  APP.E = E;

  const TITLES = {
    dashboard: 'لوحة التحكم',
    inventory: 'المخزون والأصناف',
    movements: 'حركات المخزون',
    expiry: 'الصلاحية والتنبيهات',
    stocktaking: 'الجرد الفعلي',
    purchase: 'المشتريات المقترحة',
    reports: 'التقارير',
    backup: 'النسخ الاحتياطي',
    settings: 'الإعدادات'
  };

  const ICONS = {
    purchase: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h11l2-8H6.5"/>',
    settings: '<path d="M4 6h9"/><path d="M17 6h3"/><path d="M4 12h3"/><path d="M11 12h9"/><path d="M4 18h11"/><path d="M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    box: '<path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    warn: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>'
  };

  /* ---------- المظهر ---------- */

  function getTheme() {
    try {
      return localStorage.getItem('ac-theme') === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function setTheme(t) {
    try {
      localStorage.setItem('ac-theme', t);
    } catch (e) {
      /* ignore */
    }

    document.documentElement.setAttribute('data-theme', t);
    setText('#themeIcon', t === 'light' ? '☾' : '☀');
    setText('#themeText', t === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح');
  }

  APP.getTheme = getTheme;
  APP.setTheme = setTheme;

  document.documentElement.setAttribute('data-theme', getTheme());

  /* ---------- أدوات الواجهة المشتركة ---------- */

  function toast(m, err) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = m;
    $('#toasts').appendChild(t);

    setTimeout(function () {
      t.remove();
    }, 3800);
  }

  function closeModal() {
    const m = $('#modal');
    m.innerHTML = '';
    m.hidden = true;
  }

  function openModal(title, body, wide) {
    const m = $('#modal');

    m.hidden = false;
    m.innerHTML =
      '<div class="mbox' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="mhead">' +
          '<h3>' + E(title) + '</h3>' +
          '<button class="x" data-close aria-label="إغلاق">✕</button>' +
        '</div>' +
        '<div class="mbody">' + body + '</div>' +
      '</div>';

    return $('.mbody', m);
  }

  function confirmBox(msg, ok, danger) {
    return new Promise(function (res) {
      openModal(
        'تأكيد',
        '<p class="pre">' + E(msg) + '</p>' +
        '<div class="actions">' +
          '<button class="btn ' + (danger ? 'danger' : 'primary') + '" id="c-ok">' +
            E(ok || 'تأكيد') +
          '</button>' +
          '<button class="btn" id="c-no">إلغاء</button>' +
        '</div>'
      );

      $('#c-ok').onclick = function () {
        closeModal();
        res(true);
      };

      $('#c-no').onclick = function () {
        closeModal();
        res(false);
      };

      $('#modal .x').onclick = function () {
        closeModal();
        res(false);
      };
    });
  }

  function showErr(m) {
    const x = $('#merr');

    if (x) {
      x.textContent = m;
      x.hidden = false;
      x.scrollIntoView({ block: 'nearest' });
    } else {
      toast(m, true);
    }
  }

  function openForm(title, fields, submit, handler, wide) {
    openModal(
      title,
      '<form id="mform" novalidate>' +
        fields +
        '<div id="merr" class="err" hidden></div>' +
        '<div class="actions">' +
          '<button class="btn primary" type="submit">' + E(submit) + '</button>' +
          '<button class="btn" type="button" data-close>إلغاء</button>' +
        '</div>' +
      '</form>',
      wide
    );

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

  function fd(f) {
    const o = {};

    new FormData(f).forEach(function (v, k) {
      o[k] = typeof v === 'string' ? v : '';
    });

    return o;
  }

  function inp(label, name, val, o) {
    o = o || {};

    return '<label class="f">' +
      '<span>' + E(label) + (o.req ? ' *' : '') + '</span>' +
      '<input name="' + name + '" type="' + (o.type || 'text') +
      '" value="' + E(val == null ? '' : val) + '" ' + (o.attr || '') + '>' +
      '</label>';
  }

  function sel(label, name, opts, val) {
    return '<label class="f">' +
      '<span>' + E(label) + '</span>' +
      '<select name="' + name + '">' +
      opts.map(function (o) {
        return '<option value="' + E(o[0]) + '"' +
          (String(o[0]) === String(val) ? ' selected' : '') +
          '>' + E(o[1]) + '</option>';
      }).join('') +
      '</select>' +
      '</label>';
  }

  function bar(extra, title) {
    return '<div class="row noprint" style="justify-content:space-between">' +
      (title ? '<b>' + E(title) + '</b>' : '<span></span>') +
      '<div class="row" style="margin:0">' + (extra || '') + '</div>' +
      '</div>';
  }

  function bd(c, t) {
    return '<span class="badge ' + c + '">' + E(t) + '</span>';
  }

  function stBadge(b) {
    const s = INV.expiryStatus(b.expiry, S.settings);

    const c = {
      expired: 'b-exp',
      w1: 'b-w1',
      w2: 'b-w2',
      w3: 'b-w3',
      ok: 'b-ok',
      none: 'b-ok'
    }[s];

    return bd(c, INV.expLabel(s, S.settings));
  }

  function mvTable(list) {
    if (!list.length) return '<p class="mut">لا توجد حركات.</p>';

    return '<div class="tw"><table>' +
      '<thead><tr>' +
        '<th>التاريخ</th><th>النوع</th><th>المنتج</th><th>الدفعة</th>' +
        '<th>التغير</th><th>الرصيد</th><th>ملاحظات</th>' +
      '</tr></thead><tbody>' +

      list.map(function (m) {
        return '<tr>' +
          '<td>' + INV.fmtDT(m.date) + '</td>' +
          '<td>' + E(INV.TYPES[m.type] ? INV.TYPES[m.type].label : m.type) + '</td>' +
          '<td>' + E(m.productName) + '</td>' +
          '<td>' + E(m.lot || '—') + '</td>' +
          '<td class="' + (m.delta < 0 ? 'neg' : 'pos') + '" dir="ltr">' +
            (m.delta > 0 ? '+' : '') + m.delta +
          '</td>' +
          '<td dir="ltr">' + m.prevQty + ' → ' + m.newQty + '</td>' +
          '<td>' + E([m.ref, m.notes].filter(Boolean).join(' | ')) + '</td>' +
        '</tr>';
      }).join('') +

      '</tbody></table></div>';
  }

  Object.assign(APP, {
    toast: toast,
    closeModal: closeModal,
    openModal: openModal,
    confirmBox: confirmBox,
    showErr: showErr,
    openForm: openForm,
    fd: fd,
    inp: inp,
    sel: sel,
    bar: bar,
    bd: bd,
    stBadge: stBadge,
    mvTable: mvTable
  });

  /* ---------- البيانات ---------- */

  APP.load = async function () {
    S.products = await DB.getAll('products');
    S.batches = await DB.getAll('batches');
    S.movements = await DB.getAll('movements');
    S.stocktakes = await DB.getAll('stocktakes');
    S.settings = await DB.getSettings();
  };

  APP.refresh = async function () {
    await APP.load();
    APP.render();
  };

  APP.done = async function (msg) {
    closeModal();
    toast(msg);
    await APP.refresh();
  };

  APP.fatal = function (msg) {
    const m = $('.main-content');
    const d = document.createElement('div');

    d.className = 'err';
    d.textContent = msg;

    if (m) m.insertBefore(d, m.children[1] || null);
  };

  /* ---------- بطاقات الإحصائيات ---------- */

  function statCard(cls, label, icon, key, page) {
    return '<article class="stat-card ' + cls + '" data-page="' + page + '">' +
      '<div class="stat-top">' +
        '<span>' + label + '</span>' +
        '<span class="stat-icon ac-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24">' + icon + '</svg>' +
        '</span>' +
      '</div>' +
      '<strong data-x="' + key + '">0</strong>' +
      '<p data-xp="' + key + '"></p>' +
    '</article>';
  }

  function fillPanel(panel, html) {
    const empty = $('.empty-state', panel);
    let slot = $('.dash-slot', panel);

    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'dash-slot';
      panel.appendChild(slot);
    }

    if (html) {
      if (empty) empty.style.display = 'none';
      slot.innerHTML = html;
    } else {
      if (empty) empty.style.display = '';
      slot.innerHTML = '';
    }
  }

  function renderDash() {
    const k = INV.stats(S.products, S.batches, S.movements, S.settings);
    const g = $('#page-dashboard .stats-grid');

    function updateStat(key, n, txt) {
      const card = $('[data-stat-key="' + key + '"]', g);
      if (!card) return;

      const number = $('strong', card);
      const description = $('p', card);

      if (number) number.textContent = n;
      if (description) description.textContent = txt;
    }

    updateStat('products', k.products, 'منتج نشط مسجل');
    updateStat('units', k.units, 'وحدة فعلية في كل الدفعات');
    updateStat('low', k.low.length, 'منتج تحت الحد الأدنى');
    updateStat('expired', k.expired, 'دفعة منتهية الصلاحية');

    const xs = {
      batches: [k.batches, 'دفعة كميتها أكبر من صفر'],
      near: [k.near, 'خلال ' + S.settings.warn3 + ' يوم']
    };

    Object.keys(xs).forEach(function (key) {
      setText('[data-x="' + key + '"]', xs[key][0]);
      setText('[data-xp="' + key + '"]', xs[key][1]);
    });

    const demo = S.products.some(function (p) {
      return p.demo;
    });

    setText(
      '.demo-banner p',
      demo
        ? 'توجد بيانات تجريبية موسومة [تجريبي]. احذفها من صفحة «النسخ الاحتياطي» قبل إدخال بيانات صيدليتك الحقيقية.'
        : 'كل الأرقام محسوبة من بياناتك المحفوظة على هذا الجهاز فقط. خذ نسخة احتياطية دورياً.'
    );

    const panels = $$('#page-dashboard .content-grid .panel');

    if (panels.length > 1) {
      fillPanel(panels[0], k.recent.length ? mvTable(k.recent) : '');

      const pm = {};

      S.products.forEach(function (p) {
        pm[p.id] = p;
      });

      const sum = INV.summarize(
        S.products.filter(function (p) {
          return !p.archived;
        }),
        S.batches,
        S.settings
      );

      const urgent = INV.sortBatches(S.batches).filter(function (b) {
        return b.quantity > 0 &&
          pm[b.productId] &&
          !pm[b.productId].archived &&
          INV.expiryStatus(b.expiry, S.settings) !== 'ok';
      }).slice(0, 5);

      let h = '';

      if (k.low.length) {
        h += '<h4 class="dl-title">تحت الحد الأدنى</h4>' +
          k.low.slice(0, 5).map(function (p) {
            return '<div class="dl"><span>' + E(p.name) + '</span><b>' +
              sum[p.id].avail + ' / ' + p.minStock +
              '</b></div>';
          }).join('');
      }

      if (urgent.length) {
        h += '<h4 class="dl-title">أقرب الدفعات انتهاءً</h4>' +
          urgent.map(function (b) {
            return '<div class="dl"><span>' +
              E(pm[b.productId].name) +
              ' <small class="mut">(' + E(b.lot || '—') + ')</small>' +
              '</span><span>' +
              stBadge(b) + ' ' + INV.fmtDate(b.expiry) +
              '</span></div>';
          }).join('');
      }

      if (!h) h = '<p class="ok-line">لا توجد تنبيهات حالياً ✓</p>';

      fillPanel(panels[1], S.products.length ? h : '');
    }
  }

  APP.render = function () {
    if (APP.view === 'dashboard') {
      renderDash();
      return;
    }

    const b = $('#body-' + APP.view);

    if (b && APP.pages[APP.view]) {
      b.innerHTML = APP.pages[APP.view]();
    }
  };

  /* ---------- التنقل ---------- */

  function setMenu(open) {
    $('#sidebar').classList.toggle('open', open);
    $('#menuToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function show(page) {
    if (page !== 'dashboard' && !APP.pages[page]) {
      page = 'dashboard';
    }

    APP.view = page;

    if (APP.onShow) APP.onShow(page);

    $$('.page-section').forEach(function (s) {
      const on = s.id === 'page-' + page;

      s.hidden = !on;
      s.classList.toggle('active', on);
    });

    $$('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.dataset.page === page);
    });

    setText('#pageHeading', TITLES[page] || '');

    APP.render();
    window.scrollTo(0, 0);
  }    updateFab();
  function updateFab() {
    const top = $('#fab-top'), back = $('#fab-back');
    if (top) top.hidden = window.scrollY < 300;
    if (back) back.hidden = APP.view === 'dashboard';
  }
  function go(p) {
    if (location.hash === '#' + p) {
      show(p);
    } else {
      location.hash = '#' + p;
    }
  }

  APP.go = go;

  /* ---------- تجهيز الصفحة ---------- */

function injectCSS() {
  const st = document.createElement('style');
  st.id = 'app-extra-style';

  st.textContent = `
:root{--yel:#e0b000}
html[data-theme="light"]{--yel:#8a6d00}
[hidden]{display:none!important}

/* الشريط العلوي */
.top-actions{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
  min-width:0;
}
.net-chip{
  font-size:11px;
  padding:3px 10px;
  border-radius:99px;
  border:1px solid var(--border);
}
.net-chip.on{color:var(--green)}
.net-chip.off{color:var(--orange)}

/* توزيع بطاقات الإحصائيات */
#page-dashboard .stats-grid,
#page-dashboard #extra-stats{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:14px;
  width:100%;
  max-width:100%;
  min-width:0;
  margin:0 0 14px;
  padding:0;
  box-sizing:border-box;
}

#page-dashboard #extra-stats{
  margin-top:0;
}

#page-dashboard .stat-card{
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  gap:10px;
  width:100%;
  min-width:0;
  min-height:140px;
  box-sizing:border-box;
  padding:16px;
  overflow:hidden;
  background:var(--surface)!important;
  border:1px solid var(--border)!important;
  border-radius:16px;
  box-shadow:none;
  cursor:pointer;
}

#page-dashboard .stat-card::before,
#page-dashboard .stat-card::after{
  content:none!important;
  display:none!important;
}

#page-dashboard .stat-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  min-width:0;
}

#page-dashboard .stat-top>span:first-child{
  min-width:0;
  overflow-wrap:anywhere;
  line-height:1.6;
  font-size:13px;
}

#page-dashboard .stat-icon{
  display:flex;
  align-items:center;
  justify-content:center;
  flex:0 0 38px;
  width:38px;
  height:38px;
  border-radius:12px;
  background:var(--surface-2)!important;
  border:1px solid var(--border)!important;
}

#page-dashboard .stat-icon svg{
  display:block;
  width:21px;
  height:21px;
  fill:none;
  stroke:currentColor;
  stroke-width:1.8;
  stroke-linecap:round;
  stroke-linejoin:round;
}

#page-dashboard .stat-card strong{
  display:block;
  font-size:clamp(22px,2.3vw,30px);
  line-height:1.3;
  font-weight:800;
  overflow-wrap:anywhere;
  direction:ltr;
  text-align:right;
}

#page-dashboard .stat-card p{
  margin:0;
  font-size:12px;
  line-height:1.6;
  color:var(--muted);
  overflow-wrap:anywhere;
}

/* ألوان البطاقات الست */
#page-dashboard .stat-products{--c:#a78bfa}
#page-dashboard .stat-units{--c:#34d399}
#page-dashboard .stat-batches-card{--c:#38bdf8}
#page-dashboard .stat-low{--c:#fb923c}
#page-dashboard .stat-expired{--c:#f87171}
#page-dashboard .stat-near-card{--c:#facc15}

html[data-theme="light"] #page-dashboard .stat-products{--c:#7c3aed}
html[data-theme="light"] #page-dashboard .stat-units{--c:#059669}
html[data-theme="light"] #page-dashboard .stat-batches-card{--c:#0284c7}
html[data-theme="light"] #page-dashboard .stat-low{--c:#ea580c}
html[data-theme="light"] #page-dashboard .stat-expired{--c:#dc2626}
html[data-theme="light"] #page-dashboard .stat-near-card{--c:#ca8a04}

#page-dashboard .stat-card .stat-icon,
#page-dashboard .stat-card strong{
  color:var(--c)!important;
}

#page-dashboard .stat-card .stat-icon{
  background:color-mix(in srgb,var(--c) 14%,transparent)!important;
  border-color:color-mix(in srgb,var(--c) 40%,transparent)!important;
}

#page-dashboard .stat-card{
  border-top:3px solid var(--c)!important;
}
/* الأجهزة المتوسطة: بطاقتان في الصف */
@media (max-width:900px){
  #page-dashboard .stats-grid,
  #page-dashboard #extra-stats{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:12px;
  }

  #page-dashboard .stat-card{
    min-height:130px;
    padding:14px;
  }
}

/* الهواتف */
@media (max-width:520px){
  #page-dashboard .stats-grid,
  #page-dashboard #extra-stats{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:9px;
    margin-bottom:10px;
  }

  #page-dashboard .stat-card{
    min-height:120px;
    padding:11px;
    gap:8px;
    border-radius:13px;
  }

  #page-dashboard .stat-top{
    align-items:flex-start;
    gap:6px;
  }

  #page-dashboard .stat-top>span:first-child{
    font-size:11px;
    line-height:1.6;
  }

  #page-dashboard .stat-icon{
    flex-basis:30px;
    width:30px;
    height:30px;
    border-radius:9px;
  }

  #page-dashboard .stat-icon svg{
    width:17px;
    height:17px;
  }

  #page-dashboard .stat-card strong{
    font-size:23px;
  }

  #page-dashboard .stat-card p{
    font-size:10px;
    line-height:1.5;
  }
}

/* الهواتف الصغيرة جداً */
@media (max-width:350px){
  #page-dashboard .stats-grid,
  #page-dashboard #extra-stats{
    gap:7px;
  }

  #page-dashboard .stat-card{
    min-height:112px;
    padding:9px;
  }

  #page-dashboard .stat-top>span:first-child{
    font-size:10px;
  }

  #page-dashboard .stat-icon{
    flex-basis:26px;
    width:26px;
    height:26px;
  }

  #page-dashboard .stat-card strong{
    font-size:20px;
  }

  #page-dashboard .stat-card p{
    font-size:9px;
  }
}

/* بقية الواجهة */
.qa-panel{margin-bottom:17px}
.qa-panel h3{margin:0 0 4px;font-size:14px}
.dash-slot{margin-top:8px}
.dl-title{margin:10px 0 4px;font-size:12px;color:var(--muted);font-weight:600}
.dl{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px}
.ok-line{color:var(--green);margin:10px 0}
.page-body .panel{margin-bottom:14px}
.page-body h3,.overlay h3{margin:4px 0 8px;font-size:15px}
.page-body p{margin:6px 0}
.mut{color:var(--muted)}
.small{font-size:12px}
.pre{white-space:pre-wrap}

.row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:center}
.row3{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}

.f{display:block;margin:0 0 10px}
.f span{display:block;font-size:12px;color:var(--muted);margin-bottom:3px}

.page-body input,.page-body select,.page-body textarea,.overlay input,.overlay select,.overlay textarea{
  width:100%;
  background:var(--bg);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:10px;
  padding:9px 10px;
  font-size:14px;
}

.page-body input[type=checkbox],.page-body input[type=radio],.overlay input[type=checkbox],.overlay input[type=radio]{width:auto}
.page-body textarea,.overlay textarea{min-height:70px}

.page-body .row input,.page-body .row select,.overlay .row input,.overlay .row select{
  width:auto;
  flex:1 1 140px;
}

.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}

.btn{
  background:var(--surface-2);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:10px;
  padding:9px 14px;
  font-size:13px;
  cursor:pointer;
}

.btn.primary{
  background:var(--purple);
  color:#14102a;
  border-color:var(--purple);
  font-weight:700;
}

.btn.green{
  background:var(--green);
  color:#06241a;
  border-color:var(--green);
  font-weight:700;
}

.btn.danger{background:var(--red);color:#fff;border-color:var(--red)}

html[data-theme="light"] .btn.primary,
html[data-theme="light"] .btn.green{color:#fff}

.btn.sm{padding:5px 10px;font-size:12px;min-height:0}

.item{
  display:flex;
  justify-content:space-between;
  gap:10px;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:12px;
  padding:10px;
  margin:0 0 8px;
  cursor:pointer;
}

.it-side{text-align:center;min-width:90px}
.qty{font-size:22px;font-weight:700}

.badge{
  display:inline-block;
  font-size:11px;
  padding:1px 8px;
  border-radius:99px;
  margin:2px;
  border:1px solid;
}

.b-exp{color:var(--red);border-color:var(--red)}
.b-w1{color:var(--orange);border-color:var(--orange)}
.b-w2{color:var(--yel);border-color:var(--yel)}
.b-w3{color:var(--blue);border-color:var(--blue)}
.b-ok{color:var(--green);border-color:var(--green)}

.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
.page-body table,.overlay table{font-size:13px}

.page-body th,.page-body td,.overlay th,.overlay td{
  padding:6px 8px;
  border-bottom:1px solid var(--border);
  text-align:right;
  white-space:nowrap;
}

th{color:var(--muted);font-weight:600}
td.pos{color:var(--green)}
td.neg{color:var(--red)}
.page-body td input{width:90px;padding:5px 6px}

.err{
  color:var(--red);
  background:color-mix(in srgb,var(--red) 12%,transparent);
  border:1px solid var(--red);
  border-radius:10px;
  padding:8px;
  margin:8px 0;
}

.ok{color:var(--green)}

.overlay{
  position:fixed;
  inset:0;
  z-index:2000;
  background:rgba(0,0,0,.6);
  display:flex;
  align-items:flex-start;
  justify-content:center;
  padding:10px;
  overflow-y:auto;
}

.mbox{
  background:var(--surface);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:14px;
  width:100%;
  max-width:520px;
  margin:10px 0;
}

.mbox.wide{max-width:820px}

.mhead{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:10px 14px;
  border-bottom:1px solid var(--border);
}

.mhead h3{margin:0}
.x{background:none;border:0;color:var(--text);font-size:20px;cursor:pointer}
.mbody{padding:12px 14px}

.chk{
  max-height:220px;
  overflow-y:auto;
  border:1px solid var(--border);
  border-radius:10px;
  padding:6px;
  margin:6px 0;
}

.chk-i{display:flex;gap:8px;align-items:center;padding:4px 2px}

#toasts{
  position:fixed;
  bottom:20px;
  left:10px;
  right:10px;
  z-index:3000;
  display:flex;
  flex-direction:column;
  gap:6px;
  align-items:center;
  pointer-events:none;
}

.toast{
  background:var(--green);
  color:#06241a;
  padding:9px 14px;
  border-radius:10px;
  font-size:14px;
  max-width:520px;
}

.toast.err{background:var(--red);color:#fff;border:0}

.rep{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:14px;
  padding:12px;
}

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
  
} @media (max-width: 900px) {
  #page-dashboard .stats-grid,
  #page-dashboard #extra-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 12px !important;
  }
}

@media (max-width: 480px) {
  #page-dashboard .stats-grid,
  #page-dashboard #extra-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
  }
}

#page-dashboard .stat-card {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}/* ترتيب البطاقات: صف المخزون ثم صف التنبيهات */
#page-dashboard .stat-products{order:1}
#page-dashboard .stat-units{order:2}
#page-dashboard .stat-batches-card{order:3}
#page-dashboard .stat-low{order:4}
#page-dashboard .stat-expired{order:5}
#page-dashboard .stat-near-card{order:6}

#page-dashboard .stats-grid{
  align-items:stretch;
  grid-auto-rows:1fr;
}/* أزرار الأعلى والرجوع */
.fab-wrap{position:fixed;left:14px;bottom:18px;z-index:1500;display:flex;flex-direction:column;gap:10px}
.fab{width:44px;height:44px;padding:0;border-radius:50%;border:1px solid var(--border);background:var(--surface-2);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.fab svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@media print{.fab-wrap{display:none!important}}@media(max-width:520px){
  #ac-userbar{flex-wrap:wrap}
  #ac-userbar .theme-toggle{padding:6px 8px;font-size:12px}
  .top-actions{gap:5px}
}`;

  document.head.appendChild(st);
}


  function buildShell() {
    if (!$('link[rel="manifest"]')) {
      [
        ['manifest', 'manifest.json'],
        ['icon', 'icon-192.png'],
        ['apple-touch-icon', 'icon-192.png']
      ].forEach(function (x) {
        const l = document.createElement('link');
        l.rel = x[0];
        l.href = x[1];
        document.head.appendChild(l);
      });
    }

    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="modal" class="overlay" hidden></div>' +
      '<div id="toasts"></div>' +
      '<input type="file" id="f-backup" accept=".json,application/json" hidden>' +
      '<input type="file" id="f-csv" accept=".csv,text/csv,text/plain" hidden>'
    );
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="fab-wrap noprint">' +
        '<button class="fab" id="fab-top" type="button" aria-label="إلى الأعلى" hidden>' +
          '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>' +
        '</button>' +
        '<button class="fab" id="fab-back" type="button" aria-label="رجوع" hidden>' +
          '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        '</button>' +
      '</div>'
    );
    const tt = $('#themeToggle');
    const wrap = document.createElement('div');

    wrap.className = 'top-actions';
    tt.parentNode.insertBefore(wrap, tt);

    wrap.insertAdjacentHTML(
      'beforeend',
      '<span id="net" class="net-chip on">متصل</span>' +
      '<button class="theme-toggle" id="btn-install" type="button" hidden>تثبيت التطبيق</button>'
    );

    wrap.appendChild(tt);

    const nav = $('.navigation');

    const navBtn = function (page, label) {
      return '<button class="nav-link" data-page="' + page + '" type="button">' +
        '<span class="nav-icon ac-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24">' + (ICONS[page] || ICONS.box) + '</svg>' +
        '</span>' +
        '<span>' + label + '</span>' +
      '</button>';
    };

    $('[data-page="stocktaking"]', nav).insertAdjacentHTML(
      'afterend',
      navBtn('purchase', 'المشتريات المقترحة')
    );

    nav.insertAdjacentHTML('beforeend', navBtn('settings', 'الإعدادات'));

    nav.insertAdjacentHTML(
      'beforeend',
      '<button class="nav-link" data-page="guide" type="button">' +
        '<span class="nav-icon">📘</span>' +
        '<span>دليل الاستخدام</span>' +
      '</button>'
    );

    const footer = $('.main-footer');

    [
      ['purchase', 'المشتريات المقترحة', 'اقتراحات حسابية للشراء حسب الحد الأدنى للمخزون.'],
      ['settings', 'الإعدادات', 'أيام تنبيه الصلاحية واسم الصيدلية والمظهر.']
    ].forEach(function (p) {
      footer.insertAdjacentHTML(
        'beforebegin',
        '<section class="page-section" id="page-' + p[0] + '" hidden>' +
          '<div class="section-heading"><div>' +
            '<h3>' + p[1] + '</h3>' +
            '<p>' + p[2] + '</p>' +
          '</div></div>' +
        '</section>'
      );
    });

    $$('.page-section').forEach(function (sec) {
      if (sec.id === 'page-dashboard') return;

      const body = document.createElement('div');
      body.className = 'page-body';
      body.id = 'body-' + sec.id.slice(5);

      const ph = $('.placeholder-panel', sec);

      if (ph) {
        ph.replaceWith(body);
      } else {
        sec.appendChild(body);
      }
    });

    /* تمييز البطاقات الأربع الأصلية */
    const g = $('#page-dashboard .stats-grid');

    const statDefinitions = [
      ['purple-stat', 'inventory', 'products'],
      ['green-stat', 'inventory', 'units'],
      ['orange-stat', 'purchase', 'low'],
      ['red-stat', 'expiry', 'expired']
    ];

    statDefinitions.forEach(function (x) {
      const c = $('.' + x[0], g);

      if (c) {
        c.dataset.page = x[1];
        c.dataset.statKey = x[2];
        c.classList.add('stat-' + x[2]);
      }
    });

    /* إضافة بطاقتين فقط: الدفعات المتوفرة والقريبة من الانتهاء */
        /* إضافة البطاقتين داخل نفس الشبكة لتصبح 6 بطاقات في شبكة واحدة */
    g.insertAdjacentHTML(
      'beforeend',
      statCard('stat-batches-card', 'دفعات متوفرة', ICONS.box, 'batches', 'inventory') +
      statCard('stat-near-card', 'قاربت الانتهاء', ICONS.clock, 'near', 'expiry')
    );
    const ep = $$('#page-dashboard .content-grid .empty-state p');

    if (ep[0]) {
      ep[0].textContent =
        'لا توجد حركات بعد. سجّل رصيداً افتتاحياً أو وارداً من «تسجيل سريع».';
    }

    if (ep[1]) {
      ep[1].textContent =
        'أضف أصنافاً لتظهر ملخصات النواقص والصلاحية هنا.';
    }

    $('#page-dashboard .quick-grid').insertAdjacentHTML(
      'afterend',
      '<div class="panel qa-panel">' +
        '<h3>تسجيل سريع</h3>' +
        '<div class="row">' +
          '<button class="btn primary" data-act="add-product">+ منتج جديد</button>' +
          '<button class="btn green" data-act="new-move" data-type="in">تسجيل وارد</button>' +
          '<button class="btn" data-act="new-move" data-type="out">تسجيل صادر</button>' +
          '<button class="btn" data-act="start-stocktake">بدء جرد</button>' +
        '</div>' +
      '</div>'
    );

    setText('.sidebar-note strong', 'الإصدار 1.0');
    setText('.sidebar-note p', 'البيانات على هذا الجهاز فقط');

    setText(
      '#currentDate',
      new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      })
    );
  }

  let deferred = null;

  function net() {
    const n = $('#net');

    n.textContent = navigator.onLine
      ? 'متصل'
      : 'بدون إنترنت (يعمل محلياً)';

    n.className = 'net-chip ' + (navigator.onLine ? 'on' : 'off');
  }

  function bind() {
    document.addEventListener('click', function (e) {
      const n = e.target.closest('[data-page]');

      if (n) {
        go(n.dataset.page);
        setMenu(false);
        return;
      }

      if (
        $('#sidebar').classList.contains('open') &&
        !e.target.closest('#sidebar') &&
        !e.target.closest('#menuToggle')
      ) {
        setMenu(false);
      }
    });

    $('#menuToggle').addEventListener('click', function () {
      setMenu(!$('#sidebar').classList.contains('open'));
    });

    $('#themeToggle').addEventListener('click', function () {
      setTheme(getTheme() === 'light' ? 'dark' : 'light');
    });

    $('#btn-install').addEventListener('click', async function () {
      if (!deferred) return;

      deferred.prompt();
      await deferred.userChoice;

      deferred = null;
      $('#btn-install').hidden = true;
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      $('#btn-install').hidden = false;
    });

    window.addEventListener('appinstalled', function () {
      $('#btn-install').hidden = true;
    });

    window.addEventListener('hashchange', function () {
      show((location.hash || '#dashboard').slice(1));
    });

    window.addEventListener('online', net);
        let navs = 0, goingBack = false;

    window.addEventListener('hashchange', function () {
      if (goingBack) { navs = Math.max(0, navs - 1); goingBack = false; }
      else navs++;
    });

    window.addEventListener('scroll', updateFab, { passive: true });

    $('#fab-top').addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#fab-back').addEventListener('click', function () {
      if (navs > 0) { goingBack = true; history.back(); }
      else go('dashboard');
    });
    window.addEventListener('offline', net);

    window.addEventListener('error', function (e) {
      toast('خطأ غير متوقع: ' + e.message, true);
    });
  }

  async function boot() {
    injectCSS();
    buildShell();
    bind();
    net();
    setTheme(getTheme());

    try {
      await DB.open();
      await APP.load();
      DB.requestPersist();
    } catch (e) {
      APP.fatal('تعذر فتح قاعدة البيانات: ' + e.message);
      return;
    }

    show((location.hash || '#dashboard').slice(1));

    if (
      'serviceWorker' in navigator &&
      (
        location.protocol === 'https:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1'
      )
    ) {
      navigator.serviceWorker.register('service-worker.js').catch(function () {
        /* ignore */
      });
    }
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      const s = document.createElement('script');

      s.src = src;
      s.onload = res;
      s.onerror = function () {
        rej(new Error('تعذر تحميل الملف: ' + src));
      };

      document.head.appendChild(s);
    });
  }

  (async function () {
    try {
      for (const f of [
        'database.js',
        'inventory.js',
        'reports.js',
        'views.js',
        'guide.js',
        'barcode.js'
      ]) {
        await loadScript(f);
      }

      await boot();
    } catch (e) {
      APP.fatal(e.message || String(e));
    }
  })();
})();
/* ===== أصوات التطبيق (كتلة واحدة مستقلة) ===== */
(function () {
  if (window.__acSounds) return;
  window.__acSounds = true;

  let ctx = null;

  function on() {
    try { return localStorage.getItem('ac-sound') !== 'off'; } catch (e) { return true; }
  }

  function tone(f, s, d, type, v) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + s;
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  const SND = {
    click:   [[700, 0, 0.05, 'sine', 0.08]],
    nav:     [[520, 0, 0.06, 'sine', 0.1], [780, 0.05, 0.08, 'sine', 0.1]],
    open:    [[440, 0, 0.08, 'sine', 0.1], [660, 0.07, 0.1, 'sine', 0.1]],
    close:   [[660, 0, 0.08, 'sine', 0.1], [440, 0.07, 0.1, 'sine', 0.1]],
    success: [[523, 0, 0.1, 'sine', 0.12], [659, 0.09, 0.1, 'sine', 0.12], [784, 0.18, 0.16, 'sine', 0.12]],
    error:   [[220, 0, 0.15, 'square', 0.07], [165, 0.14, 0.2, 'square', 0.07]],
    beep:    [[1400, 0, 0.09, 'square', 0.06]],
    miss:    [[300, 0, 0.12, 'square', 0.07], [220, 0.12, 0.18, 'square', 0.07]]
  };

  function play(name) {
    if (!on()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      (SND[name] || []).forEach(function (n) { tone(n[0], n[1], n[2], n[3], n[4]); });
    } catch (e) { /* ignore */ }
  }
  window.acSound = play;

  /* نقر الأزرار والتنقل */
  document.addEventListener('click', function (e) {
    const el = e.target.closest('button, .item, .stat-card, .nav-link');
    if (!el || el.disabled || el.id === 'btn-sound2') return;
    play(el.dataset.page ? 'nav' : 'click');
  }, true);

  /* باركود: مسجل = بيب، غير مسجل = رفض */
  document.addEventListener('app-barcode', function (e) {
    play(e.detail && e.detail.product ? 'beep' : 'miss');
  });

  /* انتظار عناصر الصفحة ثم ربط النوافذ والرسائل وزر الكتم */
  let tries = 0;
  const wait = setInterval(function () {
    const modal = document.getElementById('modal');
    const toasts = document.getElementById('toasts');
    const top = document.querySelector('.top-actions');

    if (modal && toasts && top) {
      clearInterval(wait);

      /* فتح وإغلاق النوافذ */
      let wasOpen = !modal.hidden;
      new MutationObserver(function () {
        const open = !modal.hidden;
        if (open !== wasOpen) { play(open ? 'open' : 'close'); wasOpen = open; }
      }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });

      /* رسائل النجاح والخطأ */
      new MutationObserver(function (list) {
        list.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            if (n.classList && n.classList.contains('toast')) {
              play(n.classList.contains('err') ? 'error' : 'success');
            }
          });
        });
      }).observe(toasts, { childList: true });

      /* زر الكتم */
      const b = document.createElement('button');
      b.id = 'btn-sound2';
      b.type = 'button';
      b.className = 'theme-toggle';
      b.setAttribute('aria-label', 'الصوت');
      b.textContent = on() ? '🔊' : '🔇';
      b.addEventListener('click', function () {
        try { localStorage.setItem('ac-sound', on() ? 'off' : 'on'); } catch (e) { /* ignore */ }
        b.textContent = on() ? '🔊' : '🔇';
        play('click');
      });
      top.insertBefore(b, top.firstChild);
    } else if (++tries > 100) {
      clearInterval(wait);
    }
  }, 200);
})();
/* ===== نظام الدخول والمستخدمين (كتلة واحدة مستقلة) ===== */
(function () {
  if (window.__acAuth) return;
  window.__acAuth = true;

  const KEY = 'ac-users', SES = 'ac-session', IDLE = 10 * 60 * 1000;
  let cur = null, idleT = null, fails = 0, lockUntil = 0;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(u) { localStorage.setItem(KEY, JSON.stringify(u)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }

  async function hash(pw, saltB64) {
    if (!window.crypto || !crypto.subtle) throw new Error('المتصفح لا يدعم التشفير. افتح التطبيق عبر رابط https.');
    const salt = saltB64 ? Uint8Array.from(atob(saltB64), function (c) { return c.charCodeAt(0); }) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, key, 256);
    return { salt: b64(salt), hash: b64(bits) };
  }

  /* ---------- الشكل ---------- */
  const st = document.createElement('style');
  st.textContent = `
#ac-auth{position:fixed;inset:0;z-index:5000;background:var(--bg,#0f0f1a);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;direction:rtl}
.ac-box{background:var(--surface,#1a1a2e);color:var(--text,#fff);border:1px solid var(--border,#333);border-radius:16px;width:100%;max-width:380px;padding:20px}
.ac-box h2{margin:0 0 14px;font-size:18px;text-align:center}
.ac-box label{display:block;font-size:12px;color:var(--muted,#aaa);margin-bottom:10px}
.ac-box input,.ac-box select{display:block;width:100%;margin-top:4px;background:var(--bg,#0f0f1a);color:var(--text,#fff);border:1px solid var(--border,#333);border-radius:10px;padding:10px;font-size:14px;box-sizing:border-box}
.ac-b{width:100%;margin-top:6px;padding:10px;border:0;border-radius:10px;background:var(--purple,#a78bfa);color:#14102a;font-weight:700;font-size:14px;cursor:pointer}
.ac-b.s{width:auto;padding:5px 10px;font-size:12px;background:var(--surface-2,#26263d);color:var(--text,#fff);border:1px solid var(--border,#333);margin:0 2px}
.ac-b.d{background:var(--red,#f87171);color:#fff;border:0}
.ac-err{color:var(--red,#f87171);font-size:12px;min-height:16px;margin:4px 0}
.ac-note{font-size:11px;color:var(--muted,#aaa);margin-top:10px;line-height:1.7}
.ac-t{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}
.ac-t td,.ac-t th{padding:6px;border-bottom:1px solid var(--border,#333);text-align:right}
#ac-userbar{display:flex;align-items:center;gap:6px}
#ac-userbar .theme-toggle{white-space:nowrap}`;
  document.head.appendChild(st);

  const ov = document.createElement('div');
  ov.id = 'ac-auth';
  ov.hidden = true;
  function mount() { document.body.appendChild(ov); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function screen(html) { ov.hidden = false; ov.innerHTML = '<div class="ac-box">' + html + '</div>'; }
  function err(m) { const e = document.getElementById('ac-e'); if (e) e.textContent = m; }

  /* ---------- أول تشغيل: إنشاء المدير ---------- */
  function showSetup() {
    screen('<h2>إعداد أول حساب (المدير)</h2>' +
      '<form id="ac-f"><label>الاسم الظاهر<input name="n" required></label>' +
      '<label>اسم المستخدم<input name="u" autocomplete="username" required></label>' +
      '<label>كلمة السر (6 أحرف على الأقل)<input name="p" type="password" autocomplete="new-password" required></label>' +
      '<label>تأكيد كلمة السر<input name="p2" type="password" autocomplete="new-password" required></label>' +
      '<div class="ac-err" id="ac-e"></div><button class="ac-b">إنشاء الحساب</button></form>' +
      '<p class="ac-note">هذا الحساب مدير ويضيف بقية الصيادلة. احفظ كلمة السر جيداً.</p>');
    document.getElementById('ac-f').onsubmit = async function (e) {
      e.preventDefault();
      const f = e.target, n = f.n.value.trim(), u = f.u.value.trim().toLowerCase();
      if (!n || !u) return err('أكمل الحقول');
      if (f.p.value.length < 6) return err('كلمة السر أقل من 6 أحرف');
      if (f.p.value !== f.p2.value) return err('كلمتا السر غير متطابقتين');
      try {
        const h = await hash(f.p.value);
        save([{ username: u, name: n, role: 'admin', salt: h.salt, hash: h.hash }]);
        enter(load()[0]);
      } catch (x) { err(x.message); }
    };
  }

  /* ---------- تسجيل الدخول ---------- */
  function showLogin() {
    if (!load().length) return showSetup();
    screen('<h2>تسجيل الدخول</h2>' +
      '<form id="ac-f"><label>اسم المستخدم<input name="u" autocomplete="username" required></label>' +
      '<label>كلمة السر<input name="p" type="password" autocomplete="current-password" required></label>' +
      '<div class="ac-err" id="ac-e"></div><button class="ac-b">دخول</button></form>' +
      '<p class="ac-note">نسيت كلمة السر؟ اطلب من المدير إعادة تعيينها.</p>');
    document.getElementById('ac-f').onsubmit = async function (e) {
      e.preventDefault();
      const f = e.target;
      if (Date.now() < lockUntil) return err('محاولات كثيرة. انتظر ' + Math.ceil((lockUntil - Date.now()) / 1000) + ' ثانية');
      const u = load().find(function (x) { return x.username === f.u.value.trim().toLowerCase(); });
      try {
        const h = u ? await hash(f.p.value, u.salt) : null;
        if (!u || h.hash !== u.hash) {
          if (++fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
          return err('اسم المستخدم أو كلمة السر غير صحيحة');
        }
        fails = 0;
        enter(u);
      } catch (x) { err(x.message); }
    };
  }

  /* ---------- بعد الدخول ---------- */
  function enter(u) {
    cur = u;
    try { sessionStorage.setItem(SES, u.username); } catch (e) { /* ignore */ }
    ov.hidden = true;
    ov.innerHTML = '';
    bar();
    resetIdle();
  }

  function logout() {
    cur = null;
    try { sessionStorage.removeItem(SES); } catch (e) { /* ignore */ }
    clearTimeout(idleT);
    const b = document.getElementById('ac-userbar');
    if (b) b.remove();
    showLogin();
  }

  function resetIdle() {
    clearTimeout(idleT);
    if (cur) idleT = setTimeout(logout, IDLE);
  }
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (cur) resetIdle(); }, { passive: true, capture: true });
  });

  function bar() {
    let t = 0;
    const w = setInterval(function () {
      const top = document.querySelector('.top-actions');
      if (top || ++t > 50) {
        clearInterval(w);
        if (!top || !cur || document.getElementById('ac-userbar')) return;
        const d = document.createElement('div');
        d.id = 'ac-userbar';
        d.innerHTML = '<span class="net-chip on">👤 ' + esc(cur.name) + '</span>' +
          (cur.role === 'admin' ? '<button class="theme-toggle" id="ac-users" type="button">👥 المستخدمون</button>' : '') +
          '<button class="theme-toggle" id="ac-out" type="button">خروج</button>';
        top.insertBefore(d, top.firstChild);
        document.getElementById('ac-out').onclick = logout;
        const um = document.getElementById('ac-users');
        if (um) um.onclick = manage;
      }
    }, 200);
  }

  /* ---------- إدارة المستخدمين (للمدير) ---------- */
  function manage() {
    const users = load();
    const m = document.createElement('div');
    m.id = 'ac-auth';
    m.style.zIndex = 5100;
    m.innerHTML = '<div class="ac-box" style="max-width:520px"><h2>المستخدمون</h2>' +
      '<table class="ac-t"><tbody>' + users.map(function (u) {
        return '<tr><td>' + esc(u.name) + '<br><small dir="ltr">' + esc(u.username) + '</small></td>' +
          '<td>' + (u.role === 'admin' ? 'مدير' : 'صيدلي') + '</td><td>' +
          '<button class="ac-b s" data-r="' + esc(u.username) + '">كلمة سر جديدة</button>' +
          (u.username !== cur.username ? '<button class="ac-b s d" data-d="' + esc(u.username) + '">حذف</button>' : '') +
          '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<h2 style="font-size:14px;margin-top:14px">إضافة مستخدم</h2>' +
      '<form id="ac-add"><label>الاسم الظاهر<input name="n" required></label>' +
      '<label>اسم المستخدم<input name="u" required></label>' +
      '<label>كلمة السر<input name="p" type="password" required></label>' +
      '<label>الصلاحية<select name="r"><option value="user">صيدلي</option><option value="admin">مدير</option></select></label>' +
      '<div class="ac-err" id="ac-e"></div><button class="ac-b">إضافة</button></form>' +
      '<button class="ac-b s" id="ac-x" style="margin-top:10px">إغلاق</button></div>';
    document.body.appendChild(m);
    m.querySelector('#ac-x').onclick = function () { m.remove(); };

    m.querySelector('#ac-add').onsubmit = async function (e) {
      e.preventDefault();
      const f = e.target, u = f.u.value.trim().toLowerCase(), n = f.n.value.trim();
      if (!u || !n) return err('أكمل الحقول');
      if (f.p.value.length < 6) return err('كلمة السر أقل من 6 أحرف');
      if (load().some(function (x) { return x.username === u; })) return err('اسم المستخدم موجود');
      const h = await hash(f.p.value);
      const all = load();
      all.push({ username: u, name: n, role: f.r.value, salt: h.salt, hash: h.hash });
      save(all);
      m.remove();
      manage();
    };

    m.addEventListener('click', async function (e) {
      const r = e.target.dataset.r, d = e.target.dataset.d;
      if (r) {
        const p = prompt('كلمة السر الجديدة (6 أحرف على الأقل):');
        if (!p) return;
        if (p.length < 6) return alert('أقل من 6 أحرف');
        const h = await hash(p), all = load(), u = all.find(function (x) { return x.username === r; });
        u.salt = h.salt; u.hash = h.hash;
        save(all);
        alert('تم تغيير كلمة السر');
      }
      if (d && confirm('حذف هذا المستخدم؟')) {
        let all = load().filter(function (x) { return x.username !== d; });
        if (!all.some(function (x) { return x.role === 'admin'; })) return alert('لازم يبقى مدير واحد على الأقل');
        save(all);
        m.remove();
        manage();
      }
    });
  }

  /* ---------- البداية ---------- */
  let sess = null;
  try { sess = sessionStorage.getItem(SES); } catch (e) { /* ignore */ }
  const found = sess && load().find(function (x) { return x.username === sess; });
  if (found) { cur = found; ov.hidden = true; bar(); resetIdle(); }
  else {
    ov.hidden = false;
    if (document.body) showLogin(); else document.addEventListener('DOMContentLoaded', showLogin);
  }
})();
