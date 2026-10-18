'use strict';
(function () {
  const APP = window.APP;
  const $ = APP.$, E = APP.E;
  let lastCode = '', lastTime = 0;
  let stream = null, timer = null, h5 = null;

  /* ---------- معالجة الباركود (من الجهاز أو الكاميرا) ---------- */
  function handle(code) {
    code = String(code || '').trim();
    if (code.length < 4) return;
    const now = Date.now();
    if (code === lastCode && now - lastTime < 1500) return;
    lastCode = code; lastTime = now;

    const p = APP.S.products.find(function (x) {
      return !x.archived && String(x.barcode || '') === code;
    });

    document.dispatchEvent(new CustomEvent('app-barcode', { detail: { code: code, product: p || null } }));

        if (p) {
      // أثناء الجرد: يذهب المؤشر لخانة العدّ الخاصة بالدواء
      if (APP.view === 'stocktaking') {
        const ids = APP.S.batches.filter(function (b) { return b.productId === p.id; }).map(function (b) { return b.id; });
        const inputs = APP.$$('input.cnt').filter(function (i) { return ids.indexOf(i.dataset.batch) >= 0; });
        if (inputs.length) {
          inputs[0].scrollIntoView({ block: 'center' });
          inputs[0].focus();
          inputs[0].select();
          APP.toast(p.name);
          return;
        }
      }
      APP.openModal('تم العثور على الدواء',
        '<p><b>' + E(p.name) + '</b></p>' +
        '<p class="mut small" dir="ltr">' + E(code) + '</p>' +
        '<div class="actions">' +
          '<button class="btn green" data-act="new-move" data-type="in" data-product="' + p.id + '">+ وارد</button>' +
          '<button class="btn" data-act="new-move" data-type="out" data-product="' + p.id + '">صرف</button>' +
          '<button class="btn" data-act="view-product" data-id="' + p.id + '">تفاصيل</button>' +
          '<button class="btn" id="bc-next">مسح التالي</button>' +
        '</div>');
    } else {
      APP.openModal('باركود غير مسجل',
        '<p class="mut small" dir="ltr">' + E(code) + '</p>' +
        '<p>هذا الباركود غير مرتبط بأي دواء.</p>' +
        '<div class="actions">' +
          '<button class="btn primary" id="bc-add">إضافة دواء بهذا الباركود</button>' +
          '<button class="btn" id="bc-next">مسح التالي</button>' +
        '</div>');
      $('#bc-add').onclick = function () {
        APP.closeModal();
        const b = $('[data-act="add-product"]');
        if (b) b.click();
        setTimeout(function () {
          const i = $('#mform [name="barcode"]');
          if (i) i.value = code;
        }, 150);
      };
    }
    $('#bc-next').onclick = openCam;
    $('#bc-next').onclick = openCam;
  }
  APP.onBarcode = handle;

  /* ---------- جهاز الباركود (يعمل كلوحة مفاتيح) ---------- */
  let buf = '', lastKey = 0;
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const now = Date.now();

    if (e.key === 'Enter') {
      const code = buf; buf = '';
      if (code.length < 4) return;
      const el = document.activeElement;
      const isField = el && /^(INPUT|TEXTAREA)$/.test(el.tagName);
            if (isField && (el.name === 'barcode' || el.id === 'mv-q' || el.dataset.barcode !== undefined)) return;
      e.preventDefault();
      if (isField && el.value && el.value.indexOf(code) !== -1) {
        el.value = el.value.replace(code, '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      handle(code);
      return;
    }

    if (e.key.length !== 1) return;
    if (now - lastKey > 80) buf = '';
    buf += e.key;
    lastKey = now;
  }, true);

  /* ---------- الكاميرا ---------- */
  function stopCam() {
    if (timer) { clearInterval(timer); timer = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (h5) { try { h5.stop().catch(function () {}); } catch (e) { /* ignore */ } h5 = null; }
  }

  function msg(t) { const m = $('#bc-msg'); if (m) m.textContent = t; }

  function loadLib() {
    return new Promise(function (res, rej) {
      if (window.Html5Qrcode) return res();
      const s = document.createElement('script');
      s.src = 'html5-qrcode.min.js';
      s.onload = res;
      s.onerror = function () { rej(new Error('lib')); };
      document.head.appendChild(s);
    });
  }

  async function fallbackCam() {
    try { await loadLib(); }
    catch (e) {
      msg('هذا المتصفح لا يدعم مسح الباركود. استخدم Chrome، أو أضف ملف html5-qrcode.min.js بجانب التطبيق.');
      return;
    }
    $('#bc-box').innerHTML = '<div id="bc-reader" style="width:100%"></div><p class="mut small" id="bc-msg">وجّه الكاميرا نحو الباركود</p>';
    h5 = new Html5Qrcode('bc-reader');
    await h5.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 160 } }, function (c) {
      stopCam();
      handle(c);
    });
  }

  async function openCam() {
    stopCam();
    APP.openModal('مسح بالكاميرا',
      '<div id="bc-box"><video id="bc-video" playsinline muted style="width:100%;border-radius:12px;background:#000"></video>' +
      '<p class="mut small" id="bc-msg">وجّه الكاميرا نحو الباركود</p></div>');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg('الكاميرا تحتاج رابط https، أو اسمح للموقع باستخدامها.');
        return;
      }
      let det = null;
      if ('BarcodeDetector' in window) {
        try { det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'] }); }
        catch (e) { det = null; }
      }
      if (!det) { await fallbackCam(); return; }

      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const v = $('#bc-video');
      if (!v) { stopCam(); return; }
      v.srcObject = stream;
      await v.play();
      timer = setInterval(async function () {
        try {
          const r = await det.detect(v);
          if (r.length) { const c = r[0].rawValue; stopCam(); handle(c); }
        } catch (e) { /* ignore */ }
      }, 250);
    } catch (e) {
      msg('تعذر تشغيل الكاميرا. اسمح للموقع باستخدامها من إعدادات المتصفح.');
    }
  }
  APP.scanCamera = openCam;

  /* ---------- الزر العائم + إيقاف الكاميرا عند إغلاق النافذة ---------- */
  let tries = 0;
  const init = setInterval(function () {
    const wrap = $('.fab-wrap'), modal = $('#modal');
    if (wrap && modal) {
      clearInterval(init);
      wrap.insertAdjacentHTML('afterbegin',
        '<button class="fab" id="fab-scan" type="button" aria-label="مسح باركود">' +
          '<svg viewBox="0 0 24 24"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M7 8v8M11 8v8M15 8v8M18 8v8"/></svg>' +
        '</button>');
      new MutationObserver(function () {
        if (!$('#bc-video') && !$('#bc-reader')) stopCam();
      }).observe(modal, { childList: true });
    } else if (++tries > 100) clearInterval(init);
  }, 200);

  document.addEventListener('click', function (e) {
    if (e.target.closest('#fab-scan')) openCam();
  });
})();
