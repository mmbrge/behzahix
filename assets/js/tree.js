/* ==========================================================================
   BEHIX — services explorer (home + services page)
   Usage: <div data-tree></div>  (rendered from BX.CATALOG)
   Desktop: category rail + a stage with the category banner and service
   cards. Phones: swipeable category chips and a compact two-column grid;
   swiping the stage left/right moves between categories.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const { icon, faDigits, esc } = BX;

  function shortPrice(n) {
    if (n >= 1e6) return `${faDigits(String(+(n / 1e6).toFixed(1)).replace(".", "٫"))} میلیون`;
    return `${faDigits(Math.round(n / 1000))} هزار`;
  }
  const minOf = (c, k) => Math.min(...c.services.map((s) => s[k] || 0));

  function rail() {
    return `<div class="svx-rail" role="tablist" aria-label="دسته‌های خدمات">${BX.CATALOG.map((c, i) => `
      <button type="button" role="tab" class="svx-cat" data-i="${i}" style="--h:${c.hue}" aria-selected="false">
        <span class="svx-cat-ic">${icon(c.icon)}</span>
        <span class="svx-cat-t"><b>${esc(c.title)}</b><small>${faDigits(c.services.length)} خدمت · از ${shortPrice(minOf(c, "base"))}</small></span>
        <span class="svx-cat-go">${icon("arrow")}</span>
      </button>`).join("")}</div>`;
  }
  function stage(c) {
    return `
      <header class="svx-head">
        <span class="svx-head-ic">${icon(c.icon)}</span>
        <div class="svx-head-t">
          <small dir="ltr">${esc(c.en)}</small>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.desc || "")}</p>
        </div>
        <div class="svx-stats">
          <span><b>${faDigits(c.services.length)}</b>خدمت</span>
          <span><b>${shortPrice(minOf(c, "base"))}</b>شروع قیمت</span>
          <span><b>${faDigits(minOf(c, "days"))}</b>روز سریع‌ترین</span>
        </div>
      </header>
      <div class="svx-grid">${c.services.map((s, j) => `
        <a class="svx-card" href="order.html?service=${encodeURIComponent(s.id)}" style="--j:${j}">
          <span class="svx-card-top"><span class="svx-card-ic">${icon(s.icon)}</span><span class="svx-price">از ${shortPrice(s.base)}<small> تومان</small></span></span>
          <b class="svx-card-t">${esc(s.title)}</b>
          <span class="svx-card-d">${esc(s.desc || "")}</span>
          <span class="svx-card-f"><span>${icon("clock")} ${faDigits(s.days)} روز</span><span class="svx-go">سفارش ${icon("arrow")}</span></span>
        </a>`).join("")}</div>
      <div class="svx-more"><a class="btn btn-ghost btn-sm" href="services.html#${encodeURIComponent(c.id)}">جزئیات و نمونه‌های ${esc(c.title)} ${icon("arrow")}</a></div>`;
  }

  function init(root) {
    root.classList.add("svx");
    root.innerHTML = `${rail()}<div class="svx-stage" aria-live="polite"></div>`;
    const tabs = [...root.querySelectorAll(".svx-cat")];
    const st = root.querySelector(".svx-stage");
    let cur = -1;
    const show = (i, focus) => {
      i = (i + tabs.length) % tabs.length;
      if (i === cur) return;
      const dir = i > cur ? 1 : -1;
      cur = i;
      const c = BX.CATALOG[i];
      tabs.forEach((t, k) => { t.classList.toggle("is-on", k === i); t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      st.style.setProperty("--h", c.hue);
      st.style.setProperty("--dir", dir);
      st.classList.remove("is-in");
      st.innerHTML = stage(c);
      void st.offsetWidth; // restart the entrance animation
      st.classList.add("is-in");
      const t = tabs[i];
      const r = t.parentElement;
      if (r.scrollWidth > r.clientWidth) r.scrollTo({ left: t.offsetLeft - (r.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
      if (focus) t.focus();
    };
    root.querySelector(".svx-rail").addEventListener("click", (e) => { const b = e.target.closest(".svx-cat"); if (b) show(Number(b.dataset.i)); });
    // Desktop: hovering a category previews it
    const fine = window.matchMedia("(hover: hover) and (min-width: 900px)");
    // small delay so sweeping the mouse across the list does not rebuild every category
    let hoverT;
    tabs.forEach((t) => {
      t.addEventListener("pointerenter", () => { if (!fine.matches) return; clearTimeout(hoverT); hoverT = setTimeout(() => show(Number(t.dataset.i)), 160); });
      t.addEventListener("pointerleave", () => clearTimeout(hoverT));
    });
    root.querySelector(".svx-rail").addEventListener("keydown", (e) => {
      const k = { ArrowDown: 1, ArrowLeft: 1, ArrowUp: -1, ArrowRight: -1 }[e.key];
      if (k) { e.preventDefault(); show(cur + k, true); }
    });
    // Phones: swipe the stage sideways to change category (RTL: swipe left = next)
    let sx = 0, sy = 0;
    st.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    st.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { show(cur + (dx < 0 ? 1 : -1)); navigator.vibrate?.(5); }
    }, { passive: true });
    const hash = decodeURIComponent(location.hash.slice(1));
    const start = Math.max(0, BX.CATALOG.findIndex((c) => c.id === hash));
    show(start);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { root.classList.add("is-seen"); io.disconnect(); } }, { threshold: 0.12 });
      io.observe(root);
    } else root.classList.add("is-seen");
  }

  BX.ready.then(() => document.querySelectorAll("[data-tree]").forEach(init));
})();
