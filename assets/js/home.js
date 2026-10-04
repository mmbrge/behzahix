/* ==========================================================================
   BEHIX — home page: before/after slider and package calculator
   ========================================================================== */

// Hero texts and calculator packages come from the admin panel (settings → home).
const { faDigits, toman, esc } = window.BX;
let PACKAGES = [];
let BUNDLE_DISCOUNTS = {};

// ---- Before / after slider ----
(() => {
  const frame = document.getElementById("compare-frame");
  const range = document.getElementById("compare-range");
  const toggle = document.getElementById("compare-toggle");
  let pos = 50; // percent of the frame (from the right) showing "before"

  const setPos = (value, animate) => {
    pos = Math.min(100, Math.max(0, value));
    frame.classList.toggle("is-animating", Boolean(animate));
    frame.style.setProperty("--pos", `${pos}%`);
    range.value = Math.round(pos);
  };
  const fromPointer = (clientX) => {
    const rect = frame.getBoundingClientRect();
    setPos(((rect.right - clientX) / rect.width) * 100, false);
  };

  frame.addEventListener("pointerdown", (e) => {
    frame.setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
  });
  frame.addEventListener("pointermove", (e) => {
    if (frame.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
  });
  range.addEventListener("input", () => setPos(Number(range.value), false));
  toggle.addEventListener("click", () => setPos(pos > 50 ? 0 : 100, true));
})();

// ---- Package calculator ----
window.BX.ready.then(() => {
  const home = window.BX.settings.home || {};
  for (const key of ["badge", "lead", "cta"]) {
    const el = document.querySelector(`[data-home="${key}"]`);
    if (el && home[key]) el.textContent = home[key];
  }
  const h1 = document.querySelector(".hero h1");
  if (h1 && home.title1) h1.firstChild.textContent = home.title1;
  if (h1 && home.title2 && h1.childNodes[2]) h1.childNodes[2].textContent = `\n        ${home.title2}\n        `;
  const c = window.BX.settings.contact || {};
  const so = window.BX.settings.socials || {};
  const tel = document.getElementById("cta-phone");
  if (tel && c.phone) { tel.href = `tel:${c.phone}`; tel.querySelector("span").textContent = faDigits(c.phone); }
  const tg = document.getElementById("cta-telegram");
  if (tg) so.telegram ? (tg.href = so.telegram) : tg.remove();
  const em = document.getElementById("cta-email");
  if (em) c.email ? ((em.href = `mailto:${c.email}`), (em.textContent = c.email)) : em.remove();
  PACKAGES = home.packages || [];
  BUNDLE_DISCOUNTS = Object.fromEntries(Object.entries(home.bundle || {}).map(([k, v]) => [k, v / 100]));
  BUNDLE_DISCOUNTS[1] = 0;

  const list = document.getElementById("calc-options");
  const out = {
    discount: document.getElementById("calc-discount"),
    days: document.getElementById("calc-days"),
    progress: document.getElementById("calc-progress"),
    total: document.getElementById("calc-total"),
    subtotal: document.getElementById("calc-subtotal"),
    submit: document.getElementById("calc-submit"),
    note: document.getElementById("calc-discount-note"),
  };
  const maxDiscount = Math.max(0.0001, ...Object.values(BUNDLE_DISCOUNTS));

  for (const p of PACKAGES) {
    const label = document.createElement("label");
    label.className = "option";
    label.innerHTML = `
      <input type="checkbox" class="sr-only" value="${p.id}" ${p.selected ? "checked" : ""}>
      <span class="option-box"><svg class="icon"><use href="#i-check"/></svg></span>
      <span class="option-title"></span>
      <span class="option-price">${toman(p.price)}</span>`;
    label.querySelector(".option-title").textContent = p.title;
    list.appendChild(label);
  }

  out.note.textContent = `تخفیف ترکیبی: ${Object.entries(BUNDLE_DISCOUNTS)
    .filter(([, v]) => v > 0)
    .map(([n, v]) => `${faDigits(n)} خدمت ${faDigits(Math.round(v * 100))}٪`)
    .join("، ")}`;

  const update = () => {
    const ids = [...list.querySelectorAll("input:checked")].map((i) => i.value);
    const chosen = PACKAGES.filter((p) => ids.includes(p.id));
    const subtotal = chosen.reduce((sum, p) => sum + p.price, 0);
    const discount = BUNDLE_DISCOUNTS[chosen.length] ?? Math.max(0, ...Object.entries(BUNDLE_DISCOUNTS).filter(([n]) => Number(n) <= chosen.length).map(([, v]) => v));
    const total = Math.round((subtotal * (1 - discount)) / 100000) * 100000;
    // Services run in parallel, so the longest one sets the timeline.
    const days = chosen.reduce((max, p) => Math.max(max, p.days), 0);

    out.discount.textContent = `${faDigits(Math.round(discount * 100))}٪`;
    out.days.textContent = days ? `${faDigits(days)} روز` : "—";
    out.progress.style.width = `${maxDiscount ? (discount / maxDiscount) * 100 : 0}%`;
    if (out.total.textContent !== toman(total)) {
      out.total.textContent = toman(total);
      out.total.classList.remove("is-bump");
      void out.total.offsetWidth; // restart the animation
      out.total.classList.add("is-bump");
    }
    out.subtotal.textContent = toman(subtotal);
    out.subtotal.hidden = discount === 0;
    out.submit.classList.toggle("is-disabled", chosen.length === 0);
    out.submit.setAttribute("aria-disabled", String(chosen.length === 0));
    if (dock) {
      dock.querySelector("b").textContent = toman(total);
      dock.querySelector("small").textContent = chosen.length ? `${faDigits(chosen.length)} خدمت · ${days ? `${faDigits(days)} روز` : ""}${discount ? ` · ${faDigits(Math.round(discount * 100))}٪ تخفیف` : ""}` : "یک خدمت انتخاب کنید";
      dock.querySelector("a").classList.toggle("is-disabled", chosen.length === 0);
    }
  };

  // Phones: while choosing packages the quote card is off-screen, so a small
  // dock above the tab bar shows the live total.
  let dock = null;
  if (window.matchMedia("(max-width: 767px)").matches && "IntersectionObserver" in window) {
    dock = document.createElement("div");
    dock.className = "calc-dock";
    dock.innerHTML = `<div><small></small><b></b></div><a href="#calc-total" class="btn btn-primary btn-sm">مشاهده پکیج</a>`;
    document.body.appendChild(dock);
    dock.querySelector("a").addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(".quote").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    let listIn = false, quoteIn = false;
    const sync = () => dock.classList.toggle("is-on", listIn && !quoteIn);
    new IntersectionObserver((e) => { listIn = e[0].isIntersecting; sync(); }, { rootMargin: "0px 0px -20% 0px" }).observe(list);
    new IntersectionObserver((e) => { quoteIn = e[0].isIntersecting; sync(); }, { threshold: 0.35 }).observe(document.querySelector(".quote"));
  }

  list.addEventListener("change", update);
  update();
});
