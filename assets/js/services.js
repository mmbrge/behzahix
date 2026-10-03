/* BEHIX — services page: one detailed section per category */
(function () {
  "use strict";
  const { CATALOG, icon, toman, faDigits, db, initReveal } = window.BX;
  const root = document.getElementById("service-sections");

  root.innerHTML = CATALOG.map((c) => `
    <section class="container section-sm svc-section" id="cat-${c.id}" style="--h:${c.hue}">
      <div class="svc-section-head" data-reveal>
        <span class="tree-cat-icon">${icon(c.icon)}</span>
        <div>
          <p class="eyebrow" dir="ltr" style="text-align:right">${c.en.toUpperCase()}</p>
          <h2 class="h2-xs">${c.title}</h2>
          <p class="muted small">${c.desc}</p>
        </div>
      </div>
      <div class="grid-auto mt-2">
        ${c.services.map((s, i) => `
          <article class="card service-detail" data-spotlight data-reveal style="--d:${i * 80}ms">
            <div class="row-between">
              <span class="svc-icon-lg">${icon(s.icon)}</span>
              <span class="badge">${icon("clock")} ${faDigits(s.days)} روز</span>
            </div>
            <h3>${s.title}</h3>
            <p class="muted small lh">${s.desc}</p>
            <ul class="svc-fields">${s.fields.slice(0, 4).map((f) => `<li>${icon("check")}${f.label}</li>`).join("")}</ul>
            <div class="row-between mt-2">
              <span class="small muted">شروع قیمت<br><b class="brand">${toman(db.basePrice(s.id))}</b></span>
              <a href="order.html?service=${s.id}" class="btn btn-primary btn-sm">ثبت سفارش ${icon("arrow")}</a>
            </div>
          </article>`).join("")}
      </div>
    </section>`).join("");

  initReveal(root);
})();
