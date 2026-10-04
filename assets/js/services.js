/* BEHIX — services page: one detailed section per category */
(function () {
  "use strict";
  const BX = window.BX;
  const root = document.getElementById("service-sections");
  BX.ready.then(() => {
  const { CATALOG, icon, toman, faDigits, initReveal, esc } = BX;

  // Phones: a sticky chip bar jumps between categories; each category's cards swipe sideways
  const nav = `<nav class="svc-nav" aria-label="دسته‌های خدمات"><div>${CATALOG.map((c, i) => `<a href="#cat-${c.id}" style="--h:${c.hue}" class="${i ? "" : "is-on"}">${icon(c.icon)}${esc(c.title)}</a>`).join("")}</div></nav>`;
  root.innerHTML = nav + CATALOG.map((c) => `
    <section class="container section-sm svc-section" id="cat-${c.id}" style="--h:${c.hue}">
      <div class="svc-section-head" data-reveal>
        <span class="tree-cat-icon">${icon(c.icon)}</span>
        <div>
          <p class="eyebrow" dir="ltr" style="text-align:right">${esc((c.en || "").toUpperCase())}</p>
          <h2 class="h2-xs">${esc(c.title)}</h2>
          <p class="muted small">${esc(c.desc)}</p>
        </div>
      </div>
      <div class="grid-auto mt-2 svc-row">
        ${c.services.map((s, i) => `
          <article class="card service-detail" data-spotlight data-reveal style="--d:${i * 80}ms">
            <div class="row-between">
              <span class="svc-icon-lg">${icon(s.icon)}</span>
              <span class="badge">${icon("clock")} ${faDigits(s.days)} روز</span>
            </div>
            <h3>${esc(s.title)}</h3>
            <p class="muted small lh">${esc(s.desc)}</p>
            <ul class="svc-fields">${s.fields.slice(0, 4).map((f) => `<li>${icon("check")}${esc(f.label)}</li>`).join("")}</ul>
            <div class="row-between mt-2">
              <span class="small muted">شروع قیمت<br><b class="brand">${toman(s.base)}</b></span>
              <a href="order.html?service=${s.id}" class="btn btn-primary btn-sm">ثبت سفارش ${icon("arrow")}</a>
            </div>
          </article>`).join("")}
      </div>
    </section>`).join("");

  initReveal(root);

  const chips = [...root.querySelectorAll(".svc-nav a")];
  const strip = root.querySelector(".svc-nav div");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const on = chips.find((a) => a.getAttribute("href") === `#${en.target.id}`);
        chips.forEach((a) => a.classList.toggle("is-on", a === on));
        if (on) strip.scrollTo({ left: on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2, behavior: "smooth" });
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    root.querySelectorAll(".svc-section").forEach((sec) => io.observe(sec));
  }
  });
})();
