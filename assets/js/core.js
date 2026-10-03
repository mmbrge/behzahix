/* ==========================================================================
   BEHIX — shared site runtime
   Icons, header/footer, theme, animations, cursor, toasts and modals.
   Loaded on every page after data.js.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;

  // ---------------------------------------------------------------- Icons
  // 24×24 stroke icons. Use: <svg class="icon"><use href="#i-NAME"/></svg>
  const ICONS = {
    arrow: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-left": '<path d="m15 6-6 6 6 6"/>',
    play: '<path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    cross: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
    sparkles: '<path d="M10 3 11.8 8.2 17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8Z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9Z"/>',
    ai: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3M9.5 15 11 9h2l1.5 6M10 13h4"/>',
    brush: '<path d="M14.5 4.5 19.5 9.5 11 18l-5-5 8.5-8.5Z"/><path d="M6 13c-2 0-3 1.5-3 3.5V20h3.5C8.5 20 10 19 10 17"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    windows: '<path d="M3 5.5 10.5 4.5v7H3zM13 4.2 21 3v8.5h-8zM3 13h7.5v6.5L3 18.5zM13 13h8v8l-8-1.2z"/>',
    office: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    presentation: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13v4H6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
    sprout: '<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6ZM12 12c0-3 2-5 6-5 0 3-2 5-6 5Z"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
    crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7Z"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
    building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4"/>',
    pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    edit: '<path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    hexagon: '<path d="M21 16V8l-9-5-9 5v8l9 5Z"/><circle cx="12" cy="12" r="3"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z"/>',
    wand: '<path d="m15 4 5 5L8 21l-5-5ZM15 4l-2-2M20 9l2 2M17 2l.5 1.5M22 7l-1.5-.5"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
    palette: '<path d="M12 22a10 10 0 1 1 10-10c0 3-2.5 4-4.5 4H16a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15.5" cy="7.5" r="1"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/>',
    loader: '<path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    "x-circle": '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    home: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    logout: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h11"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
    store: '<path d="M3 9 5 3h14l2 6M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/><path d="M5 13v8h14v-8M10 21v-5h4v5"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><path d="M7.5 7.5h.01"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    ticket: '<path d="M3 9a3 3 0 0 0 0 6v4h18v-4a3 3 0 0 1 0-6V5H3Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    kanban: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor"/>',
    linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 7.8v.01M11.5 16v-5.5M11.5 13c0-1.7 1-2.5 2.3-2.5S16 11.3 16 13v3"/>',
    telegram: '<path d="M21 4 3 11l6 2.2M21 4l-3 16-7.5-6.5M21 4 9 13.2m0 0V19l3-3"/>',
    whatsapp: '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2Z"/>',
    aparat: '<circle cx="12" cy="12" r="8.5"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>',
    x: '<path d="M4 4l16 16M20 4 4 20"/>',
    youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor"/>',
  };

  const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.setAttribute("aria-hidden", "true");
  sprite.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
  sprite.innerHTML = `<defs>${Object.entries(ICONS)
    .map(([n, p]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${p}</symbol>`)
    .join("")}</defs>`;
  document.body.prepend(sprite);

  const icon = (name, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${String(name).replace(/[^a-z0-9-]/g, "")}"/></svg>`;

  // ---------------------------------------------------------------- Format
  const faDigits = (v) => String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  const enDigits = (v) => String(v).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const num = (n) => faDigits(Math.round(n).toLocaleString("en-US"));
  const toman = (n) => `${num(n)} تومان`;
  const dateFmt = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" });
  const date = (t) => dateFmt.format(new Date(t));
  const rel = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  function ago(t) {
    const s = (t - Date.now()) / 1000;
    const steps = [[60, "second"], [60, "minute"], [24, "hour"], [30, "day"], [12, "month"]];
    let v = s;
    for (const [n, unit] of steps) {
      if (Math.abs(v) < n) return rel.format(Math.round(v), unit);
      v /= n;
    }
    return rel.format(Math.round(v), "year");
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const qs = (k) => new URLSearchParams(location.search).get(k);

  // Deterministic artwork gradient for items without real images yet.
  function art(seed, hue) {
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) % 360;
    const a = hue ?? h;
    return `radial-gradient(circle at ${20 + (h % 60)}% ${30 + (h % 40)}%, hsl(${a} 90% 60% / .9), transparent 55%), radial-gradient(circle at 80% 90%, hsl(${(a + 40) % 360} 85% 50% / .8), transparent 50%), linear-gradient(135deg, hsl(${(a + 200) % 360} 45% 18%), #0b0d14)`;
  }
  const avatar = (u, size = "") =>
    `<span class="avatar ${size}" style="--h:${u?.hue ?? 25}">${esc((u?.name || "?").trim().charAt(0))}</span>`;

  // ---------------------------------------------------------------- Header / footer
  const NAV = [
    { id: "services", label: "خدمات", href: "services.html", mega: true },
    { id: "portfolio", label: "نمونه‌کارها", href: "portfolio.html" },
    { id: "shop", label: "فروشگاه", href: "shop.html" },
    { id: "designers", label: "طراحان", href: "designers.html" },
    { id: "pricing", label: "تعرفه‌ها", href: "index.html#packages" },
    { id: "about", label: "درباره ما", href: "about.html" },
  ];
  const page = document.body.dataset.page || "";

  function megaMenu() {
    return `<div class="mega" role="menu">
      <div class="mega-grid">
        ${BX.CATALOG.map((c) => `
          <div class="mega-col" style="--h:${c.hue}">
            <a class="mega-head" href="services.html#${c.id}">
              <span class="mega-icon">${icon(c.icon)}</span>
              <span><b>${esc(c.title)}</b><small dir="ltr">${esc(c.en)}</small></span>
            </a>
            <ul>${c.services.map((s) => `<li><a href="order.html?service=${s.id}">${icon(s.icon)}${esc(s.title)}</a></li>`).join("")}</ul>
          </div>`).join("")}
      </div>
      <div class="mega-foot">
        <a href="services.html">${icon("grid")} نمایش درخت کامل خدمات</a>
        <a href="order.html" class="btn btn-primary btn-sm">ثبت سفارش آنلاین ${icon("arrow")}</a>
      </div>
    </div>`;
  }

  function renderHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;
    const user = BX.auth.current();
    const account = user
      ? `<a href="dashboard.html" class="icon-btn account-btn" aria-label="پنل کاربری" title="پنل کاربری">${avatar(user, "avatar-sm")}</a>`
      : `<a href="auth.html" class="icon-btn" aria-label="ورود / ثبت‌نام" title="ورود / ثبت‌نام">${icon("user")}</a>`;

    el.className = "site-header";
    el.innerHTML = `
      <div class="header-bar">
        <a href="index.html" class="logo logo--md" aria-label="BEHIX صفحه اصلی"><span class="logo-a">BEHI</span><span class="logo-x">X</span></a>
        <nav class="nav" aria-label="منوی اصلی">
          ${NAV.map((n) => n.mega
            ? `<div class="nav-item has-mega"><a href="${n.href}" class="${page === n.id ? "is-active" : ""}" aria-haspopup="true">${n.label}${icon("chevron-down", "chev")}</a>${megaMenu()}</div>`
            : `<a href="${n.href}" class="${page === n.id ? "is-active" : ""}">${n.label}</a>`).join("")}
        </nav>
        <div class="header-actions">
          <button type="button" class="icon-btn theme-btn" aria-label="تغییر تم روشن و تاریک" title="تغییر تم">
            ${icon("sun", "icon-sun")}${icon("moon", "icon-moon")}
          </button>
          ${account}
          <div class="header-cta">
            <a href="order.html" class="btn btn-primary btn-sm"><span class="live-dot"></span>ثبت سفارش</a>
            <span class="live-note"><span class="ok">●</span> آماده دریافت سفارش</span>
          </div>
          <button type="button" class="icon-btn menu-btn" aria-label="باز کردن منو" aria-expanded="false" aria-controls="mobile-nav">${icon("menu")}</button>
        </div>
      </div>
      <nav class="mobile-nav" id="mobile-nav" aria-label="منوی موبایل" hidden>
        <details class="m-services">
          <summary>خدمات ${icon("chevron-down", "chev")}</summary>
          ${BX.CATALOG.map((c) => `
            <div class="m-cat" style="--h:${c.hue}">
              <a href="services.html#${c.id}" class="m-cat-head">${icon(c.icon)}${esc(c.title)}</a>
              ${c.services.map((s) => `<a href="order.html?service=${s.id}">${esc(s.title)}</a>`).join("")}
            </div>`).join("")}
        </details>
        ${NAV.filter((n) => !n.mega).map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}
        <a href="${user ? "dashboard.html" : "auth.html"}">${user ? "پنل کاربری" : "ورود / ثبت‌نام"}</a>
        <a href="order.html" class="btn btn-primary">ثبت سفارش</a>
      </nav>`;

    // Mobile menu
    const btn = el.querySelector(".menu-btn");
    const menu = el.querySelector("#mobile-nav");
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

    // Mega menu: keyboard / touch friendly toggle on top of CSS hover
    const mega = el.querySelector(".has-mega");
    if (mega) {
      mega.addEventListener("keydown", (e) => {
        if (e.key === "Escape") mega.querySelector("a").focus();
      });
    }

    // Floating header
    let floating = false;
    const update = () => {
      const next = floating ? window.scrollY > 20 : window.scrollY > 60;
      if (next !== floating) {
        floating = next;
        el.classList.toggle("is-floating", floating);
      }
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  const SOCIALS = [
    ["instagram", "اینستاگرام"], ["telegram", "تلگرام"], ["whatsapp", "واتساپ"], ["linkedin", "لینکدین"],
    ["youtube", "یوتیوب"], ["aparat", "آپارات"], ["x", "ایکس"],
  ];
  function socialLinks() {
    const so = BX.settings.socials || {};
    return SOCIALS.filter(([k]) => so[k]).map(([k, l]) => `<li><a href="${esc(so[k])}" aria-label="${l}" title="${l}" target="_blank" rel="noopener">${icon(k)}</a></li>`).join("");
  }

  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    const st = BX.settings;
    const c = st.contact || {};
    const g = st.general || {};
    const legal = st.legal || {};
    const badges = [legal.enamadCode, legal.samandehiCode, legal.extraBadgesCode].filter(Boolean);
    el.className = "site-footer";
    el.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-about">
            <span class="logo logo--md"><span class="logo-a">BEHI</span><span class="logo-x">X</span></span>
            <p class="muted lh">${esc(g.siteNameFa || "بهیکس")}؛ ${esc(g.tagline || "")}. از ایده تا اتوماسیون، کنار کسب‌وکار شما.</p>
            <ul class="socials">${socialLinks()}</ul>
          </div>
          <div>
            <h4>خدمات</h4>
            <ul class="footer-links">${BX.CATALOG.map((cat) => `<li><a href="services.html#${cat.id}">${esc(cat.title)}</a></li>`).join("")}</ul>
          </div>
          <div>
            <h4>${esc(g.siteNameFa || "بهیکس")}</h4>
            <ul class="footer-links">
              <li><a href="portfolio.html">نمونه‌کارها</a></li>
              ${st.shop?.enabled !== false ? '<li><a href="shop.html">فروشگاه فایل</a></li>' : ""}
              <li><a href="designers.html">طراحان</a></li>
              <li><a href="about.html">درباره ما</a></li>
              <li><a href="about.html#faq">سوالات متداول</a></li>
              <li><a href="terms.html">قوانین و مقررات</a></li>
              <li><a href="terms.html#privacy">حریم خصوصی</a></li>
            </ul>
          </div>
          <div>
            <h4>همکاری</h4>
            <ul class="footer-links">
              <li><a href="auth.html?mode=register&role=designer">همکاری به عنوان طراح</a></li>
              <li><a href="auth.html?mode=register&role=seller">فروشنده شوید</a></li>
              <li><a href="dashboard.html">ورود به پنل</a></li>
              <li><a href="about.html#contact">تماس با ما</a></li>
            </ul>
          </div>
          <div>
            <h4>ارتباط با ما</h4>
            <ul class="footer-contact-list">
              ${c.phone ? `<li><a href="tel:${esc(c.phone)}">${icon("phone")}<span dir="ltr">${faDigits(c.phone)}</span></a></li>` : ""}
              ${c.phone2 ? `<li><a href="tel:${esc(c.phone2)}">${icon("phone")}<span dir="ltr">${faDigits(c.phone2)}</span></a></li>` : ""}
              ${c.email ? `<li><a href="mailto:${esc(c.email)}">${icon("mail")}<span dir="ltr">${esc(c.email)}</span></a></li>` : ""}
              ${c.address ? `<li><span>${icon("home")}${esc(c.address)}</span></li>` : ""}
              ${c.hours ? `<li><span>${icon("clock")}${esc(c.hours)}</span></li>` : ""}
            </ul>
            <form class="newsletter" data-newsletter>
              <input type="email" required placeholder="ایمیل برای خبرنامه" aria-label="ایمیل" dir="ltr">
              <button class="btn btn-primary btn-sm" type="submit">عضویت</button>
            </form>
          </div>
        </div>
        ${badges.length ? `<div class="trust-badges">${badges.join("")}</div>` : ""}
        <div class="footer-bottom">
          <p>تمامی حقوق برای ${esc(g.siteNameFa || "بهیکس")} محفوظ است.</p>
          <p dir="ltr">© ${esc(g.siteName || "BEHIX")} ${faDigits(new Date().getFullYear())}</p>
        </div>
      </div>`;
    el.querySelector("[data-newsletter]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = e.target.querySelector("input");
      try {
        await BX.api("newsletter", { email: input.value });
        input.value = "";
        toast("عضویت شما در خبرنامه ثبت شد.", "ok");
      } catch (err) {
        toast(err.message, "bad");
      }
    });
  }

  function renderAnnouncement() {
    const g = BX.settings.general || {};
    if (!g.announcement || document.body.dataset.page === "dashboard") return;
    let closed = null;
    try { closed = sessionStorage.getItem("bx-ann"); } catch (e) { /* ignore */ }
    if (closed === g.announcement) return;
    const bar = document.createElement("div");
    bar.className = "announce";
    bar.innerHTML = `${icon("sparkle")}${g.announcementLink ? `<a href="${esc(g.announcementLink)}">${esc(g.announcement)}</a>` : `<span>${esc(g.announcement)}</span>`}<button type="button" aria-label="بستن">${icon("cross")}</button>`;
    bar.querySelector("button").addEventListener("click", () => {
      bar.remove();
      try { sessionStorage.setItem("bx-ann", g.announcement); } catch (e) { /* ignore */ }
    });
    document.body.prepend(bar);
  }

  function fullScreenNotice(title, text) {
    const d = document.createElement("div");
    d.className = "fullscreen-notice";
    d.innerHTML = `<div><span class="logo logo--md"><span class="logo-a">BEHI</span><span class="logo-x">X</span></span><h1>${esc(title)}</h1><p>${esc(text)}</p></div>`;
    document.body.appendChild(d);
  }

  // ---------------------------------------------------------------- Theme
  function initTheme() {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const apply = (t) => {
      root.dataset.theme = t;
      meta && meta.setAttribute("content", t === "light" ? "#f5f6fa" : "#07080c");
    };
    apply(root.dataset.theme === "light" ? "light" : "dark");
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".theme-btn")) return;
      const next = root.dataset.theme === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem("theme", next); } catch (err) { /* ignore */ }
    });
  }

  // ---------------------------------------------------------------- Reveal
  function initReveal(scope = document) {
    const items = scope.querySelectorAll("[data-reveal]:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
    items.forEach((el) => io.observe(el));
  }

  // Pointer spotlight for any [data-spotlight] card
  document.addEventListener("pointermove", (e) => {
    const card = e.target instanceof Element && e.target.closest("[data-spotlight]");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  // ---------------------------------------------------------------- Cursor
  function initCursor() {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    const root = document.documentElement;
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    ring.innerHTML = "<span>‹ ›</span>";
    document.body.append(dot, ring);
    root.classList.add("has-cursor");
    let x = -100, y = -100, rx = x, ry = y;
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      root.classList.add("cursor-visible");
      const t = e.target instanceof Element ? e.target : null;
      const typing = Boolean(t && t.closest("input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select"));
      root.classList.toggle("cursor-text", typing);
      root.classList.toggle("cursor-drag", Boolean(t && t.closest(".compare")));
      root.classList.toggle("cursor-hover", !typing && Boolean(t && t.closest("a, button, label, summary, [data-spotlight], .float, .tree-leaf, .tree-cat")));
    });
    document.addEventListener("pointerleave", () => root.classList.remove("cursor-visible"));
    window.addEventListener("pointerdown", (e) => {
      root.classList.add("cursor-down");
      const r = document.createElement("span");
      r.className = "cursor-ripple";
      r.style.left = `${e.clientX}px`;
      r.style.top = `${e.clientY}px`;
      document.body.appendChild(r);
      r.addEventListener("animationend", () => r.remove());
    });
    window.addEventListener("pointerup", () => root.classList.remove("cursor-down"));
    const tick = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------------------------------------------------------------- Toast & modal
  let toastBox;
  function toast(msg, tone = "info") {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.className = "toasts";
      toastBox.setAttribute("aria-live", "polite");
      document.body.appendChild(toastBox);
    }
    const t = document.createElement("div");
    t.className = `toast toast--${tone}`;
    const ic = { ok: "check-circle", bad: "x-circle", warn: "info", info: "info" }[tone] || "info";
    t.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
    toastBox.appendChild(t);
    setTimeout(() => t.classList.add("is-out"), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  function modal({ title, body, actions = [], wide = false, onOpen }) {
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    wrap.innerHTML = `
      <div class="modal ${wide ? "modal--wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="بستن">${icon("cross")}</button></div>
        <div class="modal-body">${body}</div>
        ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button type="button" class="btn ${a.primary ? "btn-primary" : "btn-ghost"} btn-sm" data-act="${i}">${a.label}</button>`).join("")}</div>` : ""}
      </div>`;
    const prev = document.activeElement;
    const close = () => {
      wrap.classList.add("is-out");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => wrap.remove(), 250);
      prev && prev.focus && prev.focus();
    };
    const onKey = (e) => e.key === "Escape" && close();
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-close]")) close();
      const a = e.target.closest("[data-act]");
      if (a) {
        const act = actions[Number(a.dataset.act)];
        if (!act.onClick || act.onClick(wrap) !== false) close();
      }
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector("[data-close]").focus();
    onOpen && onOpen(wrap, close);
    return { el: wrap, close };
  }

  // ---------------------------------------------------------------- Boot
  Object.assign(BX, { ICONS, icon, faDigits, enDigits, num, toman, date, ago, esc, qs, art, avatar, toast, modal, initReveal });

  // Pages that keep working during maintenance (so the admin can sign in)
  const ALWAYS_OPEN = ["auth", "dashboard"];

  BX.ready
    .then(() => {
      const g = BX.settings.general || {};
      if (g.maintenance && BX.me?.role !== "admin" && !ALWAYS_OPEN.includes(document.body.dataset.page)) {
        fullScreenNotice("به‌زودی برمی‌گردیم", g.maintenanceText || "");
        return;
      }
      if (BX.settings.theme?.cursor !== false) initCursor();
      const seo = BX.settings.seo || {};
      if (document.body.dataset.page === "home" && seo.title) document.title = seo.title;
      if (document.body.dataset.page === "home" && seo.description) document.querySelector('meta[name="description"]')?.setAttribute("content", seo.description);
      renderAnnouncement();
      renderHeader();
      renderFooter();
      initReveal();
      document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = faDigits(new Date().getFullYear())));
    })
    .catch((err) => {
      initReveal();
      if (!BX.installed) fullScreenNotice("سایت در حال راه‌اندازی است", "نصب سایت هنوز کامل نشده است. مدیر سایت: فایل install.php را باز کنید.");
      else toast(err.message, "bad");
    });
  initTheme();
})();
