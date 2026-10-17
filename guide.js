
(function () {
  "use strict";

  const style = document.createElement("style");
  style.textContent = `
    .guide-wrap { display:grid; gap:14px; }
    .guide-hero {
      padding:22px; border-radius:17px;
      background:linear-gradient(135deg,
        color-mix(in srgb,var(--purple) 18%,var(--surface)),
        var(--surface));
      border:1px solid var(--border);
    }
    .guide-hero h3 { margin:0 0 8px; font-size:21px; }
    .guide-hero p { margin:0; color:var(--muted); }
    .guide-shortcuts {
      display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
      gap:9px; margin-top:17px;
    }
    .guide-shortcuts button {
      padding:11px; text-align:right; cursor:pointer;
      border:1px solid var(--border); border-radius:10px;
      background:var(--surface); color:var(--text);
    }
    .guide-card {
      background:var(--surface); border:1px solid var(--border);
      border-radius:14px; padding:17px; scroll-margin-top:15px;
    }
    .guide-card h3 { margin:0 0 10px; font-size:16px; }
    .guide-card p { margin:7px 0; }
    .guide-card li { margin:7px 0; padding-inline-start:3px; }
    .guide-tip {
      margin-top:11px; padding:11px; border-radius:10px;
      background:color-mix(in srgb,var(--green) 10%,var(--surface));
      border:1px solid color-mix(in srgb,var(--green) 30%,var(--border));
    }
    .guide-warning {
      margin-top:11px; padding:11px; border-radius:10px;
      background:color-mix(in srgb,var(--orange) 10%,var(--surface));
      border:1px solid color-mix(in srgb,var(--orange) 30%,var(--border));
    }
    .guide-number {
      display:inline-grid; place-items:center; width:29px; height:29px;
      margin-inline-end:7px; border-radius:9px;
      color:var(--purple);
      background:color-mix(in srgb,var(--purple) 14%,transparent);
    }
    @media(max-width:380px) {
      .guide-shortcuts { grid-template-columns:minmax(0,1fr); }
      .guide-card,.guide-hero { padding:13px; }
    }
  `;
  document.head.appendChild(style);

  const sections = [
    ["guide-products", "إضافة الأصناف", `
      <p>ابدأ بإضافة الأدوية الموجودة فعليًا في الصيدلية.</p>
      <ol>
        <li>افتح قسم <b>المخزون</b> وابحث عن خيار إضافة منتج.</li>
        <li>أدخل اسم الدواء والتركيز والشكل الصيدلاني والبيانات المطلوبة.</li>
        <li>راجع اسم الصنف وتفاصيله قبل الحفظ.</li>
        <li>إذا كان للصنف أكثر من تشغيلة بتاريخ صلاحية مختلف، فلا تخلط بيانات التشغيلات.</li>
      </ol>
      <div class="guide-warning">قبل إدخال مخزون حقيقي، تأكد من طريقة تسجيل الرصيد الافتتاحي وأن الكمية تظهر صحيحة في النظام.</div>
    `],
    ["guide-movements", "الوارد والصادر", `
      <p>حركة المخزون هي التي توضح كيف تتغير الكمية مع الوقت.</p>
      <ol>
        <li><b>الوارد:</b> يُستخدم لتسجيل الكميات التي دخلت المخزون.</li>
        <li><b>الصادر:</b> يُستخدم لتسجيل الكميات التي خرجت من المخزون.</li>
        <li>اختر الصنف الصحيح وأدخل الكمية، ثم راجع البيانات قبل التأكيد.</li>
        <li>لا تسجل الحركة مرتين؛ راجع سجل الحركات عند الشك.</li>
      </ol>
      <div class="guide-tip">قاعدة مهمة: الرصيد المتوقع = الرصيد السابق + الوارد − الصادر، مع مراعاة أي تسويات جرد مسجلة.</div>
    `],
    ["guide-alerts", "الصلاحية والمخزون المنخفض", `
      <p>استخدم قسم الصلاحية لمراجعة تواريخ انتهاء الأدوية، وقسم التقارير أو التنبيهات إن كان متاحًا لمتابعة الكميات القليلة.</p>
      <ul>
        <li>تأكد من إدخال تاريخ الصلاحية الصحيح لكل تشغيلة.</li>
        <li>راجع الأصناف القريبة من انتهاء الصلاحية دوريًا.</li>
        <li>قارن الرصيد المسجل بالكمية الفعلية على الرف.</li>
        <li>لا تعتمد على التنبيه وحده لاتخاذ قرار صرف الدواء.</li>
      </ul>
      <div class="guide-warning">ظهور هذا القسم في القائمة لا يعني بالضرورة أن جميع التنبيهات اكتملت؛ اختبر النتائج ببيانات تجريبية أولًا.</div>
    `],
    ["guide-stocktake", "الجرد الفعلي", `
      <ol>
        <li>عدّ الكمية الموجودة فعليًا للصنف.</li>
        <li>قارنها بالرصيد المسجل في التطبيق.</li>
        <li>أعد العد عند وجود فرق، وراجع حركات الوارد والصادر.</li>
        <li>لا تعدّل الأرقام لمجرد جعلها متطابقة؛ سجّل التسوية فقط بالطريقة التي يدعمها التطبيق.</li>
      </ol>
      <div class="guide-warning">إذا كانت وظيفة الجرد لا تزال قيد التطوير، استخدم سجلًا ورقيًا مؤقتًا ولا تعتبر النتائج محفوظة في التطبيق.</div>
    `],
    ["guide-backup", "النسخ الاحتياطي والاستعادة", `
      <ul>
        <li>افتح قسم النسخ الاحتياطي إذا كان متاحًا.</li>
        <li>صدّر نسخة احتياطية واحفظها في مكان آمن خارج التطبيق.</li>
        <li>أنشئ نسخة جديدة بعد التعديلات المهمة.</li>
        <li>قبل استعادة نسخة، تأكد من تاريخها ومحتواها؛ قد تستبدل بيانات موجودة.</li>
      </ul>
      <div class="guide-warning">وجود بيانات على الجهاز لا يعني أنها محفوظة في السحابة. لا تمسح بيانات المتصفح أو التطبيق قبل التأكد من سلامة النسخة الاحتياطية.</div>
    `],
    ["guide-troubleshooting", "حل المشكلات الشائعة", `
      <h4>رصيد الصنف يظهر صفرًا</h4>
      <ul>
        <li>راجع هل أُدخلت بيانات الصنف فقط أم سُجلت الكمية الافتتاحية أيضًا.</li>
        <li>راجع حركات الوارد والصادر وسجّل كمية افتتاحية بالطريقة المدعومة إن لزم.</li>
        <li>لا تُدخل كمية إضافية قبل التأكد من الرصيد، حتى لا يتكرر احتسابها.</li>
      </ul>
      <h4>الصنف لا يظهر في القائمة</h4>
      <ul>
        <li>تأكد من حفظ الصنف بنجاح.</li>
        <li>امسح نص البحث أو جرّب اسمًا أقصر.</li>
        <li>حدّث الصفحة بعد التأكد من حفظ البيانات.</li>
      </ul>
      <h4>البيانات اختفت</h4>
      <ul>
        <li>تأكد أنك تستخدم الجهاز والمتصفح نفسيهما.</li>
        <li>لا تمسح بيانات الموقع أو المتصفح.</li>
        <li>تحقق من وجود نسخة احتياطية قبل محاولة الاستعادة.</li>
      </ul>
    `]
  ];

  function guideHTML() {
    return `
      <div class="guide-wrap">
        <section class="guide-hero">
          <p class="eyebrow">AMINO CURE · USER GUIDE</p>
          <h3>دليل استخدام مخزون الصيدلية 📘</h3>
          <p>مرجع سريع يساعدك تفهم خطوات العمل وتراجعها وقت الحاجة.</p>
          <div class="guide-shortcuts">
            ${sections.map((s, i) =>
              `<button type="button" data-guide-target="${s[0]}">${i + 1}. ${s[1]}</button>`
            ).join("")}
          </div>
        </section>
        ${sections.map((s, i) => `
          <section class="guide-card" id="${s[0]}">
            <h3><span class="guide-number">${i + 1}</span>${s[1]}</h3>
            ${s[2]}
          </section>
        `).join("")}
        <section class="guide-card">
          <h3>قبل استخدام بيانات حقيقية</h3>
          <p>اختبر التطبيق ببيانات تجريبية، وتأكد من دقة الأرصدة والحركات والتقارير والنسخ الاحتياطي. لا تعتمد عليه وحده لإدارة مخزون صيدلية قبل التحقق من عمل الوظائف المطلوبة.</p>
          <button class="btn" type="button" data-guide-top>العودة إلى أعلى الدليل ↑</button>
        </section>
      </div>
    `;
  }

  function openGuide() {
  if (window.APP && APP.pages) {
    APP.pages.guide = function () {
      return guideHTML();
    };

    if (typeof APP.render === "function") {
      APP.view = "guide";
      APP.render();
    }
  }


    alert("تم تحميل الدليل، لكن نحتاج ربطه بنظام التنقل الحالي في التطبيق.");
  }
if (window.APP && window.APP.pages) {
  window.APP.pages.guide = function () {
    return guideHTML();
  };

  const appMain = document.querySelector("main");
  if (appMain && !document.getElementById("page-guide")) {
    const section = document.createElement("section");
    section.id = "page-guide";
    section.className = "page-section";
    section.hidden = true;
    section.innerHTML = `
      <div class="page-body" id="body-guide"></div>
    `;
    appMain.appendChild(section);
  }
}
  document.addEventListener("click", function (event) {
    const target = event.target.closest("[data-guide-target]");
    if (target) {
      const section = document.getElementById(target.dataset.guideTarget);
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (event.target.closest("[data-guide-top]")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (event.target.closest("[data-open-guide]")) {
      openGuide();
    }
  });

  window.AminoCureGuide = { open: openGuide };
})();
