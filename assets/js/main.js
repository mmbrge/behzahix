/* ==========================================================================
   BEHIX — site scripts
   ========================================================================== */

// ---- Editable settings --------------------------------------------------
// Placeholder prices (Toman) — replace with real pricing before launch.
const PACKAGES = [
  { id: "site", title: "طراحی وب‌سایت شرکتی / فروشگاهی", price: 18000000, days: 14, selected: true },
  { id: "ai-pack", title: "بسته ۴ عددی تیزر هوش مصنوعی + لوگوموشن", price: 9500000, days: 7, selected: true },
  { id: "seo", title: "سئو و محتوای وبلاگ ماهانه", price: 6000000, days: 30 },
  { id: "infra", title: "ساخت سیستم ویندوزی و اتوماسیون دفتری", price: 8000000, days: 10 },
];

// Bundle discount by number of selected services.
const BUNDLE_DISCOUNTS = { 1: 0, 2: 0.1, 3: 0.15, 4: 0.2 };
// -------------------------------------------------------------------------

const faDigits = (value) => String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const toman = (amount) => `${faDigits(amount.toLocaleString("en-US"))} تومان`;

// ---- Mobile menu ----
(() => {
  const btn = document.querySelector(".menu-btn");
  const menu = document.getElementById("mobile-nav");
  const setOpen = (open) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "بستن منو" : "باز کردن منو");
    btn.querySelector("use").setAttribute("href", open ? "#i-cross" : "#i-menu");
  };
  btn.addEventListener("click", () => setOpen(menu.hidden));
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
})();

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
(() => {
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
  const maxDiscount = Math.max(...Object.values(BUNDLE_DISCOUNTS));

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

  out.note.textContent = `تخفیف ترکیبی: ۲ خدمت ${faDigits(BUNDLE_DISCOUNTS[2] * 100)}٪، ۳ خدمت ${faDigits(
    BUNDLE_DISCOUNTS[3] * 100
  )}٪، ۴ خدمت ${faDigits(maxDiscount * 100)}٪`;

  const update = () => {
    const ids = [...list.querySelectorAll("input:checked")].map((i) => i.value);
    const chosen = PACKAGES.filter((p) => ids.includes(p.id));
    const subtotal = chosen.reduce((sum, p) => sum + p.price, 0);
    const discount = BUNDLE_DISCOUNTS[chosen.length] ?? 0;
    const total = Math.round((subtotal * (1 - discount)) / 100000) * 100000;
    // Services run in parallel, so the longest one sets the timeline.
    const days = chosen.reduce((max, p) => Math.max(max, p.days), 0);

    out.discount.textContent = `${faDigits(Math.round(discount * 100))}٪`;
    out.days.textContent = days ? `${faDigits(days)} روز` : "—";
    out.progress.style.width = `${maxDiscount ? (discount / maxDiscount) * 100 : 0}%`;
    out.total.textContent = toman(total);
    out.subtotal.textContent = toman(subtotal);
    out.subtotal.hidden = discount === 0;
    out.submit.classList.toggle("is-disabled", chosen.length === 0);
    out.submit.setAttribute("aria-disabled", String(chosen.length === 0));
  };

  list.addEventListener("change", update);
  update();
})();

// ---- Footer year ----
document.getElementById("year").textContent = faDigits(new Date().getFullYear());
