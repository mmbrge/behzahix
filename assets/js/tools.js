/* ==========================================================================
   BEHIX — free tools (tools.html)
   Hub of small utilities. Images, PDFs, QR codes and text are processed in
   the visitor's browser; only usage metadata is sent (tools.track) so the
   admin panel can show statistics. The link shortener uses the server.
   ========================================================================== */
(function () {
  "use strict";
  const BX = window.BX;
  const app = document.getElementById("tools-app"); // null on the dashboard (only the stats modal is used there)
  const { icon, esc, faDigits, enDigits, toast } = BX;

  const CATS = [
    ["all", "همه ابزارها", "grid"], ["image", "عکس و تصویر", "image"], ["pdf", "PDF", "file"],
    ["link", "لینک و QR", "link"], ["text", "متن، عدد و تاریخ", "type"], ["check", "امنیت و بررسی", "shield"],
  ];
  const TOOLS = [
    { id: "qr", title: "ساخت QR کد", desc: "کیوآر کد رنگی و حرفه‌ای با لوگو برای لینک، متن، وای‌فای و کارت ویزیت", icon: "qr", hue: 25, cat: "link", local: true },
    { id: "short", title: "کوتاه‌کننده لینک", desc: "لینک‌های طولانی را کوتاه کنید و تعداد کلیک، دستگاه و منبع بازدید را ببینید", icon: "link", hue: 205, cat: "link" },
    { id: "image", title: "کاهش حجم و تغییر اندازه عکس", desc: "حجم عکس‌ها را تا ۸۰٪ کم کنید، اندازه را تغییر دهید یا به WebP و JPG تبدیل کنید", icon: "image", hue: 190, cat: "image", local: true },
    { id: "pdf-split", title: "جداکننده PDF", desc: "صفحه‌های دلخواه را از PDF جدا کنید یا هر صفحه را یک فایل جدا تحویل بگیرید", icon: "scissors", hue: 355, cat: "pdf", local: true },
    { id: "pdf-merge", title: "ادغام PDF", desc: "چند فایل PDF را به ترتیب دلخواه به یک فایل تبدیل کنید", icon: "layers", hue: 330, cat: "pdf", local: true },
    { id: "img2pdf", title: "تبدیل عکس به PDF", desc: "عکس‌ها و اسکن‌ها را در قطع A4 یا اندازه اصلی به یک PDF مرتب تبدیل کنید", icon: "file", hue: 12, cat: "pdf", local: true },
    { id: "palette", title: "استخراج پالت رنگ", desc: "رنگ‌های اصلی هر عکس یا لوگو را با کد HEX و RGB بیرون بکشید", icon: "palette", hue: 285, cat: "image", local: true },
    { id: "favicon", title: "ساخت فاوآیکن سایت", desc: "از یک عکس، همه اندازه‌های آیکن سایت و فایل ICO را بسازید", icon: "sparkle", hue: 45, cat: "image", local: true },
    { id: "counter", title: "شمارنده کلمات و کاراکتر", desc: "تعداد کلمه، کاراکتر، جمله و زمان مطالعه متن را لحظه‌ای ببینید", icon: "type", hue: 160, cat: "text", local: true },
    { id: "date", title: "تبدیل تاریخ شمسی و میلادی", desc: "تبدیل دقیق تاریخ شمسی، میلادی و قمری همراه با روز هفته", icon: "calendar", hue: 175, cat: "text", local: true },
    { id: "num2words", title: "تبدیل عدد به حروف", desc: "مبلغ و عدد را به حروف فارسی بنویسید؛ مناسب چک و قرارداد", icon: "hash", hue: 120, cat: "text", local: true },
    { id: "password", title: "ساخت رمز عبور قوی", desc: "رمزهای تصادفی و امن با طول و کاراکترهای دلخواه بسازید", icon: "lock", hue: 260, cat: "check", local: true },
    { id: "validate", title: "بررسی کد ملی، شبا و کارت", desc: "صحت کد ملی، شماره شبا و کارت بانکی و نام بانک را بررسی کنید", icon: "shield", hue: 140, cat: "check", local: true },
    { id: "utm", title: "ساخت لینک UTM", desc: "لینک کمپین بسازید تا بدانید بازدیدها از کدام تبلیغ یا شبکه می‌آیند", icon: "chart", hue: 225, cat: "link" },
  ];
  const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

  // ---------------------------------------------------------------- helpers
  const fa = (n) => faDigits(n);
  const num = (n) => BX.num(n);
  const fmtBytes = (b) => (b >= 1048576 ? `${fa((b / 1048576).toFixed(2))} مگابایت` : `${fa(Math.max(1, Math.round(b / 1024)))} کیلوبایت`);
  const baseName = (name) => name.replace(/\.[^.]+$/, "");
  const scripts = {};
  const loadScript = (src) => (scripts[src] ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error("بارگذاری ابزار ناموفق بود؛ اتصال اینترنت را بررسی کنید."));
    document.head.appendChild(s);
  }));
  const loadPdfLib = () => loadScript("assets/vendor/pdf-lib.min.js?v=1").then(() => window.PDFLib);
  const loadQr = () => loadScript("assets/vendor/qrcode.js?v=1").then(() => {
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
    return window.qrcode;
  });
  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function copy(text, msg = "کپی شد.") {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    toast(msg, "ok");
  }
  // Usage tracking (metadata only). Text tools report once per visit.
  const tracked = new Set();
  function track(tool, meta = {}, once = false) {
    if (once) { if (tracked.has(tool)) return; tracked.add(tool); }
    BX.api("tools.track", { tool, meta }).catch(() => {});
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // Drop zone: <label> wrapping a file input, with drag & drop
  function dropzone(accept, multiple, title, hint) {
    return `<label class="tdrop" data-drop>
      <input type="file" accept="${accept}" ${multiple ? "multiple" : ""} hidden>
      <span class="tdrop-ic">${icon("upload")}</span>
      <b>${title}</b><small>${hint}</small>
      <span class="btn btn-ghost btn-sm">انتخاب فایل</span>
    </label>`;
  }
  function bindDrop(root, onFiles) {
    const z = root.querySelector("[data-drop]");
    const input = z.querySelector("input");
    input.addEventListener("change", () => { if (input.files.length) onFiles([...input.files]); input.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); z.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => z.addEventListener(ev, () => z.classList.remove("is-over")));
    z.addEventListener("drop", (e) => {
      e.preventDefault();
      const files = [...e.dataTransfer.files].filter((f) => !input.accept || input.accept.split(",").some((a) => (a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : f.type === a || f.name.toLowerCase().endsWith(a))));
      if (files.length) onFiles(input.multiple ? files : files.slice(0, 1));
    });
  }
  async function loadImage(file) {
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file); } catch (e) { /* fall back */ }
    }
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("این عکس قابل خواندن نیست."));
      img.src = URL.createObjectURL(file);
    });
  }
  const canvasBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
  const moveItem = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  // ---------------------------------------------------------------- hub
  let cat = "all", term = "";
  const enabledTools = () => {
    const cfg = BX.settings.tools || {};
    return TOOLS.filter((t) => !(cfg.disabled || []).includes(t.id));
  };
  function card(t, i = 0) {
    return `<a class="tool-card" href="#${t.id}" style="--h:${t.hue};--d:${(i % 8) * 50}ms" data-spotlight data-reveal>
      <span class="tool-ic">${icon(t.icon)}</span>
      <b>${esc(t.title)}</b>
      <small>${esc(t.desc)}</small>
      <span class="tool-tags">${t.local ? `<i>${icon("shield")}بدون آپلود</i>` : `<i>${icon("globe")}آنلاین</i>`}<i>رایگان</i></span>
      <span class="tool-go">${icon("arrow")}</span>
    </a>`;
  }
  function hub() {
    const list = enabledTools();
    app.innerHTML = `
      <div class="tools-bar" data-reveal>
        <label class="search">${icon("search")}<input class="input" type="search" placeholder="جستجوی ابزار… (مثلاً PDF یا عکس)" value="${esc(term)}" data-term aria-label="جستجوی ابزار"></label>
        <div class="filter-chips">${CATS.map(([id, label, ic]) => `<button type="button" class="filter-chip ${id === cat ? "is-active" : ""}" data-cat="${id}">${icon(ic)}${label}</button>`).join("")}</div>
      </div>
      <div class="tools-grid" data-grid></div>`;
    const grid = app.querySelector("[data-grid]");
    const draw = () => {
      const items = list.filter((t) => (cat === "all" || t.cat === cat) && (!term || (t.title + t.desc).includes(term)));
      grid.innerHTML = items.length ? items.map(card).join("") : `<div class="card empty" style="grid-column:1/-1">${icon("search")}<p>ابزاری پیدا نشد.</p></div>`;
      BX.initReveal(grid);
    };
    app.querySelector("[data-term]").addEventListener("input", (e) => { term = e.target.value.trim(); draw(); });
    app.querySelector(".filter-chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      cat = b.dataset.cat;
      app.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("is-active", x === b));
      draw();
    });
    draw();
    BX.initReveal(app);
  }

  // ---------------------------------------------------------------- tool page
  function view(t) {
    const others = enabledTools().filter((x) => x.id !== t.id && (x.cat === t.cat)).concat(enabledTools().filter((x) => x.cat !== t.cat)).slice(0, 4);
    app.innerHTML = `
      <div class="tool-view" style="--h:${t.hue}">
        <a href="#" class="tool-back">${icon("arrow-right")} همه ابزارها</a>
        <header class="tool-head">
          <span class="tool-ic lg">${icon(t.icon)}</span>
          <div class="grow"><h2>${esc(t.title)}</h2><p>${esc(t.desc)}</p></div>
          ${t.local ? `<span class="tool-privacy">${icon("shield")}<span>فایل‌ها روی دستگاه خودتان پردازش می‌شوند و جایی آپلود نمی‌شوند.</span></span>` : ""}
        </header>
        <div class="tool-body" data-body><div class="card tpane"><div class="skeleton" style="height:180px"></div></div></div>
        <section class="tool-more"><h3>ابزارهای دیگر</h3><div class="tools-grid tools-grid--mini">${others.map(card).join("")}</div></section>
      </div>`;
    BX.initReveal(app);
    const body = app.querySelector("[data-body]");
    Promise.resolve(RENDER[t.id](body, t)).catch((err) => {
      body.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(err.message)}</p></div>`;
    });
  }

  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    const cfg = BX.settings.tools || {};
    if (cfg.enabled === false) {
      app.innerHTML = `<div class="card empty">${icon("wrench")}<p>ابزارها موقتاً در دسترس نیستند.</p></div>`;
      return;
    }
    const t = byId[id];
    if (t && enabledTools().includes(t)) {
      view(t);
      document.title = `${t.title} | ابزارهای رایگان ${BX.settings.general?.siteNameFa || "بهیکس"}`;
    } else {
      hub();
      document.title = `ابزارهای رایگان | ${BX.settings.general?.siteNameFa || "بهیکس"}`;
    }
    document.body.classList.toggle("is-tool", Boolean(t));
  }

  // ================================================================ tools
  const RENDER = {};

  // ---------------------------------------------------------------- QR code
  RENDER.qr = async (body) => {
    const qrcode = await loadQr();
    const st = { type: "url", text: "https://", wifi: { ssid: "", pass: "", enc: "WPA", hidden: false }, card: { name: "", phone: "", email: "", org: "", url: "" },
      fg: "#111827", eye: "#ff7a1a", bg: "#ffffff", style: "rounded", logo: "x", logoImg: null, size: 1024 };
    body.innerHTML = `<div class="tgrid">
      <div class="card tpane">
        <div class="seg-tabs" data-qtype>
          <button type="button" data-v="url" class="is-on">${icon("link")}لینک / متن</button>
          <button type="button" data-v="wifi">${icon("globe")}وای‌فای</button>
          <button type="button" data-v="card">${icon("user")}کارت ویزیت</button>
        </div>
        <div data-fields class="mt-2"></div>
        <div class="tsep"></div>
        <div class="form-grid form-grid-2">
          <div class="field"><span class="field-label">شکل نقطه‌ها</span><div class="seg-tabs sm" data-style>
            <button type="button" data-v="rounded" class="is-on">گرد</button><button type="button" data-v="dots">دایره</button><button type="button" data-v="square">مربع</button></div></div>
          <div class="field"><span class="field-label">لوگو وسط</span><div class="seg-tabs sm" data-logo>
            <button type="button" data-v="x" class="is-on">X بهیکس</button><button type="button" data-v="none">بدون لوگو</button><button type="button" data-v="img">عکس من</button></div>
            <input type="file" accept="image/*" hidden data-logo-file></div>
          <div class="field"><span class="field-label">رنگ‌ها</span><div class="colors">
            <label title="رنگ نقطه‌ها"><input type="color" value="${st.fg}" data-c="fg"><span>نقطه‌ها</span></label>
            <label title="رنگ گوشه‌ها"><input type="color" value="${st.eye}" data-c="eye"><span>گوشه‌ها</span></label>
            <label title="رنگ زمینه"><input type="color" value="${st.bg}" data-c="bg"><span>زمینه</span></label></div></div>
          <div class="field"><span class="field-label">اندازه خروجی</span><select class="select" data-size><option value="512">۵۱۲ پیکسل</option><option value="1024" selected>۱۰۲۴ پیکسل</option><option value="2048">۲۰۴۸ پیکسل (چاپ)</option></select></div>
        </div>
      </div>
      <div class="card tpane tpreview">
        <div class="qr-stage"><canvas data-canvas width="1024" height="1024"></canvas></div>
        <p class="small muted center" data-msg>با گوشی اسکن کنید تا امتحانش کنید.</p>
        <div class="row tactions"><button type="button" class="btn btn-primary" data-dl="png">${icon("download")} دانلود PNG</button><button type="button" class="btn btn-ghost" data-dl="svg">${icon("download")} SVG برای چاپ</button></div>
      </div></div>`;
    const fields = body.querySelector("[data-fields]");
    const canvas = body.querySelector("[data-canvas]");
    const msg = body.querySelector("[data-msg]");
    const vesc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
    const payload = () => {
      if (st.type === "wifi") return `WIFI:T:${st.wifi.enc};S:${vesc(st.wifi.ssid)};P:${vesc(st.wifi.pass)};${st.wifi.hidden ? "H:true;" : ""};`;
      if (st.type === "card") {
        const c = st.card;
        return ["BEGIN:VCARD", "VERSION:3.0", `N:${c.name}`, `FN:${c.name}`, c.org && `ORG:${c.org}`, c.phone && `TEL;TYPE=CELL:${enDigits(c.phone)}`, c.email && `EMAIL:${c.email}`, c.url && `URL:${c.url}`, "END:VCARD"].filter(Boolean).join("\n");
      }
      return st.text;
    };
    const fieldsHtml = () => {
      if (st.type === "wifi") return `<div class="form-grid form-grid-2">
        <div class="field"><label class="field-label">نام شبکه (SSID)</label><input class="input" dir="ltr" data-w="ssid" value="${esc(st.wifi.ssid)}"></div>
        <div class="field"><label class="field-label">رمز وای‌فای</label><input class="input" dir="ltr" data-w="pass" value="${esc(st.wifi.pass)}"></div>
        <div class="field"><label class="field-label">نوع امنیت</label><select class="select" data-w="enc"><option value="WPA">WPA / WPA2</option><option value="WEP">WEP</option><option value="nopass">بدون رمز</option></select></div>
        <label class="switch mt-2"><input type="checkbox" data-w="hidden"><span class="track"></span>شبکه مخفی است</label></div>`;
      if (st.type === "card") return `<div class="form-grid form-grid-2">
        ${[["name", "نام و نام خانوادگی", ""], ["phone", "موبایل", "ltr"], ["email", "ایمیل", "ltr"], ["org", "شرکت / برند", ""], ["url", "وب‌سایت", "ltr"]].map(([k, l, d]) => `<div class="field"><label class="field-label">${l}</label><input class="input" ${d ? `dir="${d}"` : ""} data-k="${k}" value="${esc(st.card[k])}"></div>`).join("")}</div>`;
      return `<div class="field"><label class="field-label">لینک یا متن</label><textarea class="textarea" data-text dir="auto" rows="3">${esc(st.text)}</textarea><span class="field-hint">لینک سایت، پیج اینستاگرام، شماره تماس یا هر متنی</span></div>`;
    };
    function draw(cv, size) {
      const data = payload();
      if (!data.trim() || data === "https://") { msg.textContent = "متن یا لینک را وارد کنید."; }
      const qr = qrcode(0, st.logo === "none" ? "M" : "H");
      qr.addData(data || " ");
      qr.make();
      const n = qr.getModuleCount(), m = 3, cell = size / (n + m * 2);
      const ctx = cv.getContext("2d");
      cv.width = cv.height = size;
      ctx.fillStyle = st.bg;
      ctx.fillRect(0, 0, size, size);
      const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      const logoBox = st.logo !== "none" ? Math.ceil(n * 0.22) | 1 : 0;
      const lo = (n - logoBox) / 2;
      const inLogo = (r, c) => logoBox && r >= lo - 0.5 && r < lo + logoBox - 0.5 && c >= lo - 0.5 && c < lo + logoBox - 0.5;
      const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); };
      ctx.fillStyle = st.fg;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
        const x = (c + m) * cell, y = (r + m) * cell;
        if (st.style === "dots") { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2); ctx.fill(); }
        else if (st.style === "rounded") rr(x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.32);
        else ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
      }
      for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
        const x = (fc + m) * cell, y = (fr + m) * cell, round = st.style === "square" ? 0 : cell * 1.6;
        ctx.fillStyle = st.eye; rr(x, y, cell * 7, cell * 7, round);
        ctx.fillStyle = st.bg; rr(x + cell, y + cell, cell * 5, cell * 5, round * 0.7);
        ctx.fillStyle = st.eye; rr(x + cell * 2, y + cell * 2, cell * 3, cell * 3, round * 0.5);
      }
      if (logoBox) {
        const s = logoBox * cell, x = (lo + m) * cell, y = (lo + m) * cell;
        ctx.fillStyle = st.bg; rr(x - cell * 0.3, y - cell * 0.3, s + cell * 0.6, s + cell * 0.6, cell * 1.2);
        if (st.logo === "img" && st.logoImg) {
          const im = st.logoImg, k = Math.min(s / im.width, s / im.height);
          ctx.drawImage(im, x + (s - im.width * k) / 2, y + (s - im.height * k) / 2, im.width * k, im.height * k);
        } else {
          const g = ctx.createLinearGradient(x, y, x + s, y + s);
          g.addColorStop(0, "#ffb15c"); g.addColorStop(1, "#ff5a0a");
          ctx.fillStyle = g;
          ctx.font = `900 ${s * 0.95}px Vazirmatn, Tahoma, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("X", x + s / 2, y + s / 2 + s * 0.04);
        }
      }
      return { qr, n, m, logoBox, lo };
    }
    const render = () => {
      try { draw(canvas, 1024); msg.textContent = "با گوشی اسکن کنید تا امتحانش کنید."; msg.classList.remove("bad"); }
      catch (e) { msg.textContent = "متن برای QR خیلی طولانی است."; msg.classList.add("bad"); }
    };
    function svg() {
      const { qr, n, m, logoBox, lo } = draw(document.createElement("canvas"), 64);
      const S = n + m * 2;
      const parts = [`<rect width="${S}" height="${S}" fill="${st.bg}"/>`];
      const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      const inLogo = (r, c) => logoBox && r >= lo - 0.5 && r < lo + logoBox - 0.5 && c >= lo - 0.5 && c < lo + logoBox - 0.5;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
        parts.push(st.style === "dots" ? `<circle cx="${c + m + 0.5}" cy="${r + m + 0.5}" r="0.42" fill="${st.fg}"/>`
          : `<rect x="${c + m + (st.style === "rounded" ? 0.06 : 0)}" y="${r + m + (st.style === "rounded" ? 0.06 : 0)}" width="${st.style === "rounded" ? 0.88 : 1}" height="${st.style === "rounded" ? 0.88 : 1}" rx="${st.style === "rounded" ? 0.32 : 0}" fill="${st.fg}"/>`);
      }
      const rad = st.style === "square" ? 0 : 1.6;
      for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
        const x = fc + m, y = fr + m;
        parts.push(`<rect x="${x}" y="${y}" width="7" height="7" rx="${rad}" fill="${st.eye}"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="${rad * 0.7}" fill="${st.bg}"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${rad * 0.5}" fill="${st.eye}"/>`);
      }
      if (logoBox && st.logo === "x") {
        const x = lo + m, s = logoBox;
        parts.push(`<rect x="${x - 0.3}" y="${x - 0.3}" width="${s + 0.6}" height="${s + 0.6}" rx="1.2" fill="${st.bg}"/><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb15c"/><stop offset="1" stop-color="#ff5a0a"/></linearGradient></defs><text x="${x + s / 2}" y="${x + s / 2}" font-family="Vazirmatn, Tahoma, sans-serif" font-weight="900" font-size="${s * 0.95}" text-anchor="middle" dominant-baseline="central" fill="url(#g)">X</text>`);
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="${st.style === "square" ? "crispEdges" : "geometricPrecision"}">${parts.join("")}</svg>`;
    }
    const segs = (sel, cb) => body.querySelector(sel).addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (!b) return;
      b.parentElement.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("is-on", x === b));
      cb(b.dataset.v);
    });
    const bindFields = () => {
      fields.innerHTML = fieldsHtml();
      if (st.type === "wifi") fields.querySelector('[data-w="enc"]').value = st.wifi.enc;
    };
    segs("[data-qtype]", (v) => { st.type = v; bindFields(); render(); });
    segs("[data-style]", (v) => { st.style = v; render(); });
    segs("[data-logo]", (v) => {
      if (v === "img") body.querySelector("[data-logo-file]").click();
      st.logo = v; render();
    });
    body.querySelector("[data-logo-file]").addEventListener("change", async (e) => {
      if (!e.target.files[0]) return;
      st.logoImg = await loadImage(e.target.files[0]);
      st.logo = "img"; render();
    });
    fields.addEventListener("input", (e) => {
      const el = e.target;
      if (el.matches("[data-text]")) st.text = el.value;
      if (el.dataset.w) st.wifi[el.dataset.w] = el.type === "checkbox" ? el.checked : el.value;
      if (el.dataset.k) st.card[el.dataset.k] = el.value;
      render();
    });
    fields.addEventListener("change", (e) => { if (e.target.dataset.w) { st.wifi[e.target.dataset.w] = e.target.type === "checkbox" ? e.target.checked : e.target.value; render(); } });
    body.querySelectorAll("[data-c]").forEach((el) => el.addEventListener("input", () => { st[el.dataset.c] = el.value; render(); }));
    body.querySelector("[data-size]").addEventListener("change", (e) => (st.size = Number(e.target.value)));
    body.querySelector(".tactions").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-dl]");
      if (!b) return;
      if (b.dataset.dl === "png") {
        const c = document.createElement("canvas");
        draw(c, st.size);
        download(await canvasBlob(c, "image/png"), "behix-qr.png");
      } else download(new Blob([svg()], { type: "image/svg+xml" }), "behix-qr.svg");
      track("qr", { type: st.type, format: b.dataset.dl, size: st.size, style: st.style, logo: st.logo });
    });
    bindFields();
    render();
  };

  // ---------------------------------------------------------------- Link shortener
  RENDER.short = async (body) => {
    const cfg = BX.settings.tools || {};
    const host = `${location.host}/s/`;
    if (cfg.shortRequireLogin && !BX.me) {
      body.innerHTML = `<div class="card tpane center">${icon("lock")}<h3 class="mt-2">برای ساخت لینک کوتاه وارد شوید</h3><p class="muted mt-1">لینک‌ها و آمار کلیک‌ها در حساب شما ذخیره می‌شود.</p><a class="btn btn-primary mt-2" href="auth.html?next=${encodeURIComponent("tools.html#short")}">ورود / ثبت‌نام</a></div>`;
      return;
    }
    body.innerHTML = `<div class="card tpane short-form">
        <form data-form class="short-row">
          <input class="input input-lg" name="url" dir="ltr" placeholder="https://example.com/very/long/link…" required aria-label="لینک طولانی">
          <button class="btn btn-primary" type="submit">${icon("link")} کوتاه کن</button>
        </form>
        <details class="mt-2"><summary class="small muted">نام دلخواه برای لینک (اختیاری)</summary>
          <div class="alias mt-1" dir="ltr"><span>${esc(host)}</span><input class="input" name="alias" form="" data-alias placeholder="my-link" maxlength="30"></div>
        </details>
        <div data-result></div>
      </div>
      <div class="card tpane mt-3"><div class="row-between"><h3 class="h-sm">${icon("list")} لینک‌های من</h3>${BX.me ? "" : '<a class="small" href="auth.html?next=tools.html%23short">ورود برای نگهداری دائمی لینک‌ها</a>'}</div><div data-mine class="mt-2"></div></div>`;
    const mine = body.querySelector("[data-mine]");
    const loadMine = async () => {
      const r = await BX.api("tools.short.mine").catch(() => ({ links: [] }));
      mine.innerHTML = r.links.length ? `<ul class="short-list">${r.links.map((l) => `<li>
          <div class="grow"><a href="${esc(l.short)}" target="_blank" rel="noopener" dir="ltr" class="brand">${esc(l.short.replace(/^https?:\/\//, ""))}</a><small dir="ltr">${esc(l.url)}</small></div>
          <span class="badge">${icon("eye")} ${fa(l.clicks)} کلیک</span>
          <button type="button" class="icon-btn icon-btn-sm" data-copy="${esc(l.short)}" aria-label="کپی">${icon("link")}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-stats="${esc(l.code)}" aria-label="آمار">${icon("chart")}</button></li>`).join("")}</ul>`
        : `<p class="muted small">هنوز لینکی نساخته‌اید.</p>`;
    };
    body.querySelector("[data-form]").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      try {
        const { link } = await BX.api("tools.short.create", { url: e.target.elements.url.value.trim(), alias: body.querySelector("[data-alias]").value.trim() });
        const qr = await loadQr();
        const q = qr(0, "M"); q.addData(link.short); q.make();
        body.querySelector("[data-result]").innerHTML = `<div class="short-result">
          <div class="grow"><small class="muted">لینک کوتاه شما آماده است</small><a href="${esc(link.short)}" target="_blank" rel="noopener" dir="ltr">${esc(link.short.replace(/^https?:\/\//, ""))}</a></div>
          <div class="short-qr">${q.createSvgTag({ cellSize: 3, margin: 2, scalable: true })}</div>
          <div class="row"><button type="button" class="btn btn-primary btn-sm" data-copy="${esc(link.short)}">${icon("link")} کپی</button><button type="button" class="btn btn-ghost btn-sm" data-stats="${esc(link.code)}">${icon("chart")} آمار</button></div>
        </div>`;
        copy(link.short, "لینک کوتاه ساخته و کپی شد.");
        e.target.reset();
        loadMine();
      } catch (err) { toast(err.message, "bad"); }
      btn.disabled = false;
    });
    body.addEventListener("click", (e) => {
      const c = e.target.closest("[data-copy]");
      if (c) copy(c.dataset.copy);
      const s = e.target.closest("[data-stats]");
      if (s) BX.api("tools.short.stats", { code: s.dataset.stats }).then(statsModal).catch((err) => toast(err.message, "bad"));
    });
    loadMine();
  };
  // Shared with the admin panel
  function statsModal(d) {
    const max = Math.max(1, ...d.days.map((x) => x.n));
    const days = Array.from({ length: 14 }, (_, i) => {
      const dt = new Date(Date.now() - (13 - i) * 864e5);
      const key = dt.toISOString().slice(0, 10);
      return { key, n: (d.days.find((x) => x.d === key) || { n: 0 }).n, label: new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(dt) };
    });
    const bars = (list, labels = {}) => {
      const total = Math.max(1, list.reduce((s, x) => s + x.n, 0));
      return list.length ? list.map((x) => `<div class="hb"><span>${esc(labels[x.k] || x.k)}</span><i style="--w:${(x.n / total) * 100}%"></i><b>${fa(x.n)}</b></div>`).join("") : '<p class="muted small">هنوز داده‌ای نیست.</p>';
    };
    const DEV = { mobile: "موبایل", desktop: "دسکتاپ", tablet: "تبلت", bot: "ربات" };
    BX.modal({
      title: "آمار لینک کوتاه", wide: true,
      body: `<div class="stat-head"><a href="${esc(d.link.short)}" target="_blank" rel="noopener" dir="ltr" class="brand">${esc(d.link.short.replace(/^https?:\/\//, ""))}</a><small dir="ltr" class="muted">${esc(d.link.url || "")}</small></div>
        <div class="mini-tiles"><div><b>${fa(d.link.clicks)}</b><span>کل کلیک‌ها</span></div><div><b>${fa(d.unique)}</b><span>بازدیدکننده یکتا</span></div><div><b>${d.link.lastClickAt ? BX.ago(d.link.lastClickAt) : "—"}</b><span>آخرین کلیک</span></div></div>
        <div class="day-bars">${days.map((x) => `<div title="${x.label}: ${fa(x.n)}"><i style="--h:${(x.n / max) * 100}%"></i><small>${x.label.split(" ")[0]}</small></div>`).join("")}</div>
        <div class="stat-cols"><div><h4>دستگاه</h4>${bars(d.devices, DEV)}</div><div><h4>مرورگر</h4>${bars(d.browsers)}</div><div><h4>سیستم‌عامل</h4>${bars(d.os)}</div><div><h4>منبع ورود</h4>${bars(d.referrers.map((x) => ({ ...x, k: x.k === "—" ? "مستقیم" : x.k })))}</div></div>
        ${d.recent.length ? `<h4 class="mt-2">آخرین کلیک‌ها</h4><ul class="recent">${d.recent.map((r) => `<li><span>${BX.ago(r.at)}</span><span>${DEV[r.device] || r.device} · ${esc(r.browser)} · ${esc(r.os)}</span><span dir="ltr">${esc(r.referrer || "direct")}</span></li>`).join("")}</ul>` : ""}`,
    });
  }
  BX.shortStatsModal = statsModal;

  // ---------------------------------------------------------------- Image compressor
  RENDER.image = (body) => {
    const st = { files: [], quality: 0.75, max: 1920, format: "image/webp" };
    body.innerHTML = `<div class="tgrid tgrid--wide">
      <div class="card tpane">
        ${dropzone("image/*", true, "عکس‌ها را اینجا رها کنید", "JPG، PNG، WebP — چند عکس با هم")}
        <div class="form-grid mt-2">
          <div class="field"><div class="row-between"><span class="field-label">کیفیت</span><b class="brand" data-qv>۷۵٪</b></div><input type="range" class="range" min="30" max="95" value="75" data-q></div>
          <div class="field"><span class="field-label">حداکثر عرض</span><div class="seg-tabs sm" data-max>
            <button type="button" data-v="0">اصلی</button><button type="button" data-v="2560">۲۵۶۰</button><button type="button" data-v="1920" class="is-on">۱۹۲۰</button><button type="button" data-v="1280">۱۲۸۰</button><button type="button" data-v="800">۸۰۰</button></div></div>
          <div class="field"><span class="field-label">فرمت خروجی</span><div class="seg-tabs sm" data-fmt>
            <button type="button" data-v="image/webp" class="is-on">WebP (کم‌حجم‌ترین)</button><button type="button" data-v="image/jpeg">JPG</button><button type="button" data-v="image/png">PNG</button></div></div>
        </div>
      </div>
      <div class="card tpane"><div class="row-between"><h3 class="h-sm">${icon("image")} نتیجه</h3><button type="button" class="btn btn-primary btn-sm" data-all disabled>${icon("download")} دانلود همه</button></div><div data-out class="img-out mt-2"><p class="muted small">هنوز عکسی انتخاب نشده است.</p></div><div data-sum></div></div>
    </div>`;
    const out = body.querySelector("[data-out]");
    const results = [];
    const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
    async function run() {
      if (!st.files.length) return;
      out.innerHTML = st.files.map(() => '<div class="img-row skeleton"></div>').join("");
      results.length = 0;
      let inB = 0, outB = 0;
      for (const f of st.files) {
        try {
          const img = await loadImage(f);
          const k = st.max && img.width > st.max ? st.max / img.width : 1;
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          const ctx = c.getContext("2d");
          if (st.format === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
          ctx.drawImage(img, 0, 0, c.width, c.height);
          let blob = await canvasBlob(c, st.format, st.quality);
          if (blob.size >= f.size && k === 1 && f.type === st.format) blob = f; // already optimal
          results.push({ f, blob, w: c.width, h: c.height, name: `${baseName(f.name)}-behix.${ext[st.format]}` });
          inB += f.size; outB += blob.size;
        } catch (e) { results.push({ f, err: e.message }); }
      }
      out.innerHTML = results.map((r, i) => r.err ? `<div class="img-row"><b>${esc(r.f.name)}</b><span class="bad small">${esc(r.err)}</span></div>` : `<div class="img-row">
          <img src="${URL.createObjectURL(r.blob)}" alt="">
          <div class="grow"><b>${esc(r.name)}</b><small>${fa(r.w)}×${fa(r.h)} · ${fmtBytes(r.f.size)} ← <b class="ok">${fmtBytes(r.blob.size)}</b></small></div>
          <span class="saved ${r.blob.size < r.f.size ? "" : "same"}">${r.blob.size < r.f.size ? `−${fa(Math.round(100 - (r.blob.size / r.f.size) * 100))}٪` : "بهینه"}</span>
          <button type="button" class="icon-btn icon-btn-sm" data-i="${i}" aria-label="دانلود">${icon("download")}</button></div>`).join("");
      body.querySelector("[data-sum]").innerHTML = outB ? `<div class="sum-bar"><span>مجموع: ${fmtBytes(inB)} ← <b>${fmtBytes(outB)}</b></span><b class="ok">${fa(Math.max(0, Math.round(100 - (outB / inB) * 100)))}٪ صرفه‌جویی</b></div>` : "";
      body.querySelector("[data-all]").disabled = !results.some((r) => r.blob);
      track("image", { files: st.files.length, inKB: Math.round(inB / 1024), outKB: Math.round(outB / 1024), format: ext[st.format], maxWidth: st.max || "original", quality: Math.round(st.quality * 100) });
    }
    const rerun = debounce(run, 350);
    bindDrop(body, (files) => { st.files = files; run(); });
    body.querySelector("[data-q]").addEventListener("input", (e) => { st.quality = e.target.value / 100; body.querySelector("[data-qv]").textContent = `${fa(e.target.value)}٪`; rerun(); });
    const seg = (sel, cb) => body.querySelector(sel).addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]"); if (!b) return;
      b.parentElement.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("is-on", x === b)); cb(b.dataset.v); rerun();
    });
    seg("[data-max]", (v) => (st.max = Number(v)));
    seg("[data-fmt]", (v) => (st.format = v));
    out.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) { const r = results[b.dataset.i]; download(r.blob, r.name); } });
    body.querySelector("[data-all]").addEventListener("click", async () => { for (const r of results) if (r.blob) { download(r.blob, r.name); await new Promise((s) => setTimeout(s, 350)); } });
  };

  // ---------------------------------------------------------------- PDF split
  function parseRanges(str, n) {
    const set = new Set();
    for (const part of enDigits(str).split(/[,،\s]+/)) {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      let a = Number(m[1]), b = Number(m[2] || m[1]);
      if (a > b) [a, b] = [b, a];
      for (let i = Math.max(1, a); i <= Math.min(n, b); i++) set.add(i - 1);
    }
    return [...set].sort((x, y) => x - y);
  }
  const toRanges = (idx) => {
    const out = [];
    for (let i = 0; i < idx.length; i++) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
      out.push(i === j ? `${idx[i] + 1}` : `${idx[i] + 1}-${idx[j] + 1}`);
      i = j;
    }
    return out.join(", ");
  };
  RENDER["pdf-split"] = async (body) => {
    const { PDFDocument } = await loadPdfLib();
    let src = null, file = null, n = 0, sel = new Set(), mode = "one";
    body.innerHTML = `<div class="card tpane">${dropzone("application/pdf,.pdf", false, "فایل PDF را اینجا رها کنید", "فایل روی دستگاه شما باز می‌شود")}<div data-work></div></div>`;
    const work = body.querySelector("[data-work]");
    function draw() {
      work.innerHTML = `<div class="pdf-file mt-2">${icon("file")}<b>${esc(file.name)}</b><span class="muted small">${fa(n)} صفحه · ${fmtBytes(file.size)}</span></div>
        <div class="row-between mt-2"><span class="field-label">صفحه‌ها را انتخاب کنید</span><div class="row"><button type="button" class="btn btn-ghost btn-xs" data-all>همه</button><button type="button" class="btn btn-ghost btn-xs" data-none>هیچ</button></div></div>
        <div class="pages">${Array.from({ length: n }, (_, i) => `<button type="button" class="page ${sel.has(i) ? "is-on" : ""}" data-p="${i}"><i></i><i></i><i></i><span>${fa(i + 1)}</span></button>`).join("")}</div>
        <div class="form-grid form-grid-2 mt-2">
          <div class="field"><label class="field-label">یا بازه صفحات</label><input class="input" dir="ltr" data-range placeholder="1-3, 5, 8-10" value="${toRanges([...sel].sort((a, b) => a - b))}"></div>
          <div class="field"><span class="field-label">خروجی</span><div class="seg-tabs sm" data-mode><button type="button" data-v="one" class="${mode === "one" ? "is-on" : ""}">صفحات انتخابی در یک فایل</button><button type="button" data-v="each" class="${mode === "each" ? "is-on" : ""}">هر صفحه یک فایل</button></div></div>
        </div>
        <div class="row-between mt-2"><span class="muted small">${fa(sel.size)} صفحه انتخاب شده</span><button type="button" class="btn btn-primary" data-go ${sel.size ? "" : "disabled"}>${icon("scissors")} جدا کن و دانلود</button></div>
        <div data-files class="file-links"></div>`;
    }
    bindDrop(body, async ([f]) => {
      try {
        file = f;
        src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
        n = src.getPageCount();
        sel = new Set([0]);
        draw();
      } catch (e) { toast("این فایل PDF قابل خواندن نیست (شاید رمزدار است).", "bad"); }
    });
    work.addEventListener("click", async (e) => {
      const p = e.target.closest("[data-p]");
      if (p) { const i = Number(p.dataset.p); sel.has(i) ? sel.delete(i) : sel.add(i); draw(); return; }
      if (e.target.closest("[data-all]")) { sel = new Set(Array.from({ length: n }, (_, i) => i)); draw(); return; }
      if (e.target.closest("[data-none]")) { sel = new Set(); draw(); return; }
      const m = e.target.closest("[data-mode] [data-v]");
      if (m) { mode = m.dataset.v; draw(); return; }
      if (e.target.closest("[data-go]")) {
        const idx = [...sel].sort((a, b) => a - b);
        const name = baseName(file.name);
        const links = work.querySelector("[data-files]");
        if (mode === "one") {
          const out = await PDFDocument.create();
          (await out.copyPages(src, idx)).forEach((pg) => out.addPage(pg));
          download(new Blob([await out.save()], { type: "application/pdf" }), `${name}-pages-${toRanges(idx).replace(/[ ,]+/g, "_")}.pdf`);
        } else {
          links.innerHTML = "";
          for (const i of idx) {
            const out = await PDFDocument.create();
            out.addPage((await out.copyPages(src, [i]))[0]);
            const blob = new Blob([await out.save()], { type: "application/pdf" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${name}-page-${i + 1}.pdf`;
            a.className = "chip";
            a.innerHTML = `${icon("download")} صفحه ${fa(i + 1)}`;
            links.appendChild(a);
          }
          toast("فایل هر صفحه آماده است؛ روی هرکدام بزنید تا دانلود شود.", "ok");
        }
        track("pdf-split", { pages: n, selected: idx.length, mode, sizeKB: Math.round(file.size / 1024) });
      }
    });
    work.addEventListener("change", (e) => { if (e.target.matches("[data-range]")) { sel = new Set(parseRanges(e.target.value, n)); draw(); } });
  };

  // ---------------------------------------------------------------- PDF merge
  RENDER["pdf-merge"] = async (body) => {
    const { PDFDocument } = await loadPdfLib();
    const items = [];
    body.innerHTML = `<div class="card tpane">${dropzone("application/pdf,.pdf", true, "فایل‌های PDF را اینجا رها کنید", "ترتیب را بعداً می‌توانید عوض کنید")}<ul class="sort-list mt-2" data-list></ul>
      <div class="row-between mt-2"><span class="muted small" data-info></span><button type="button" class="btn btn-primary" data-go disabled>${icon("layers")} ادغام و دانلود</button></div></div>`;
    const list = body.querySelector("[data-list]");
    const draw = () => {
      list.innerHTML = items.map((it, i) => `<li><span class="num">${fa(i + 1)}</span>${icon("file")}<div class="grow"><b>${esc(it.f.name)}</b><small>${fa(it.pages)} صفحه · ${fmtBytes(it.f.size)}</small></div>
        <button type="button" class="icon-btn icon-btn-sm" data-up="${i}" aria-label="بالا">${icon("chevron-up")}</button><button type="button" class="icon-btn icon-btn-sm" data-down="${i}" aria-label="پایین">${icon("chevron-down")}</button><button type="button" class="icon-btn icon-btn-sm" data-rm="${i}" aria-label="حذف">${icon("cross")}</button></li>`).join("");
      const pages = items.reduce((s, x) => s + x.pages, 0);
      body.querySelector("[data-info]").textContent = items.length ? `${fa(items.length)} فایل · ${fa(pages)} صفحه` : "";
      body.querySelector("[data-go]").disabled = items.length < 2;
    };
    bindDrop(body, async (files) => {
      for (const f of files) {
        try { const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true }); items.push({ f, doc, pages: doc.getPageCount() }); }
        catch (e) { toast(`«${f.name}» قابل خواندن نیست.`, "bad"); }
      }
      draw();
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.up) moveItem(items, Number(b.dataset.up), -1);
      if (b.dataset.down) moveItem(items, Number(b.dataset.down), 1);
      if (b.dataset.rm) items.splice(Number(b.dataset.rm), 1);
      draw();
    });
    body.querySelector("[data-go]").addEventListener("click", async () => {
      const out = await PDFDocument.create();
      for (const it of items) (await out.copyPages(it.doc, it.doc.getPageIndices())).forEach((p) => out.addPage(p));
      download(new Blob([await out.save()], { type: "application/pdf" }), "behix-merged.pdf");
      track("pdf-merge", { files: items.length, pages: out.getPageCount(), sizeKB: Math.round(items.reduce((s, x) => s + x.f.size, 0) / 1024) });
    });
  };

  // ---------------------------------------------------------------- Images → PDF
  RENDER.img2pdf = async (body) => {
    const { PDFDocument } = await loadPdfLib();
    const items = [];
    let size = "a4", margin = 24;
    body.innerHTML = `<div class="card tpane">${dropzone("image/*", true, "عکس‌ها یا اسکن‌ها را اینجا رها کنید", "هر عکس یک صفحه می‌شود")}
      <div class="thumbs mt-2" data-list></div>
      <div class="form-grid form-grid-2 mt-2">
        <div class="field"><span class="field-label">اندازه صفحه</span><div class="seg-tabs sm" data-size><button type="button" data-v="a4" class="is-on">A4</button><button type="button" data-v="fit">اندازه عکس</button></div></div>
        <div class="field"><span class="field-label">حاشیه</span><div class="seg-tabs sm" data-margin><button type="button" data-v="0">بدون حاشیه</button><button type="button" data-v="24" class="is-on">کم</button><button type="button" data-v="48">زیاد</button></div></div>
      </div>
      <div class="row-between mt-2"><span class="muted small" data-info></span><button type="button" class="btn btn-primary" data-go disabled>${icon("file")} ساخت PDF</button></div></div>`;
    const list = body.querySelector("[data-list]");
    const draw = () => {
      list.innerHTML = items.map((it, i) => `<figure><img src="${it.url}" alt=""><figcaption>${fa(i + 1)}</figcaption>
        <div class="thumb-actions"><button type="button" data-up="${i}" aria-label="قبلی">${icon("chevron-left")}</button><button type="button" data-rm="${i}" aria-label="حذف">${icon("cross")}</button><button type="button" data-down="${i}" aria-label="بعدی">${icon("arrow-right")}</button></div></figure>`).join("");
      body.querySelector("[data-info]").textContent = items.length ? `${fa(items.length)} صفحه` : "";
      body.querySelector("[data-go]").disabled = !items.length;
    };
    bindDrop(body, (files) => { files.forEach((f) => items.push({ f, url: URL.createObjectURL(f) })); draw(); });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.up) moveItem(items, Number(b.dataset.up), -1);
      if (b.dataset.down) moveItem(items, Number(b.dataset.down), 1);
      if (b.dataset.rm) items.splice(Number(b.dataset.rm), 1);
      draw();
    });
    const seg = (sel, cb) => body.querySelector(sel).addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]"); if (!b) return;
      b.parentElement.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("is-on", x === b)); cb(b.dataset.v);
    });
    seg("[data-size]", (v) => (size = v));
    seg("[data-margin]", (v) => (margin = Number(v)));
    body.querySelector("[data-go]").addEventListener("click", async () => {
      const doc = await PDFDocument.create();
      for (const it of items) {
        let bytes, kind;
        if (it.f.type === "image/jpeg" || it.f.type === "image/png") { bytes = await it.f.arrayBuffer(); kind = it.f.type; }
        else {
          const img = await loadImage(it.f);
          const c = document.createElement("canvas");
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
          bytes = await (await canvasBlob(c, "image/jpeg", 0.92)).arrayBuffer(); kind = "image/jpeg";
        }
        const em = kind === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const land = em.width > em.height;
        const [pw, ph] = size === "fit" ? [em.width + margin * 2, em.height + margin * 2] : land ? [841.89, 595.28] : [595.28, 841.89];
        const page = doc.addPage([pw, ph]);
        const k = Math.min((pw - margin * 2) / em.width, (ph - margin * 2) / em.height);
        page.drawImage(em, { x: (pw - em.width * k) / 2, y: (ph - em.height * k) / 2, width: em.width * k, height: em.height * k });
      }
      download(new Blob([await doc.save()], { type: "application/pdf" }), "behix-images.pdf");
      track("img2pdf", { images: items.length, page: size, margin });
    });
  };

  // ---------------------------------------------------------------- Colour palette
  const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  RENDER.palette = (body) => {
    body.innerHTML = `<div class="tgrid"><div class="card tpane">${dropzone("image/*", false, "عکس یا لوگو را اینجا رها کنید", "رنگ‌های غالب عکس استخراج می‌شود")}<div class="pal-img mt-2" data-img></div></div>
      <div class="card tpane"><div class="row-between"><h3 class="h-sm">${icon("palette")} پالت رنگ</h3><button type="button" class="btn btn-ghost btn-sm" data-css disabled>کپی CSS</button></div><div class="swatches-out mt-2" data-out><p class="muted small">یک عکس انتخاب کنید.</p></div></div></div>`;
    let colors = [];
    bindDrop(body, async ([f]) => {
      const img = await loadImage(f);
      const k = Math.min(1, 120 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
      // k-means with k = 6, seeded evenly through the pixel list
      const K = Math.min(6, px.length);
      let cent = Array.from({ length: K }, (_, i) => px[Math.floor((i + 0.5) * px.length / K)].slice());
      let assign = new Array(px.length).fill(0);
      for (let it = 0; it < 10; it++) {
        const sum = cent.map(() => [0, 0, 0, 0]);
        px.forEach((p, i) => {
          let best = 0, bd = Infinity;
          cent.forEach((c2, j) => { const dd = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2 + (p[2] - c2[2]) ** 2; if (dd < bd) { bd = dd; best = j; } });
          assign[i] = best; const s = sum[best]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
        });
        cent = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cent[j]));
      }
      const counts = cent.map((_, j) => assign.filter((a) => a === j).length);
      colors = cent.map((c2, j) => ({ hex: hex(...c2), rgb: c2.map(Math.round), pct: counts[j] / px.length })).filter((x) => x.pct > 0.005).sort((a, b) => b.pct - a.pct);
      body.querySelector("[data-img]").innerHTML = `<img src="${URL.createObjectURL(f)}" alt=""><div class="pal-bar">${colors.map((x) => `<i style="background:${x.hex};flex:${x.pct}"></i>`).join("")}</div>`;
      body.querySelector("[data-out]").innerHTML = colors.map((x) => `<button type="button" class="sw" data-hex="${x.hex}" style="--c:${x.hex}"><i></i><b dir="ltr">${x.hex.toUpperCase()}</b><small dir="ltr">rgb(${x.rgb.join(", ")})</small><span>${fa(Math.round(x.pct * 100))}٪</span></button>`).join("");
      body.querySelector("[data-css]").disabled = false;
      track("palette", { colors: colors.length, width: img.width, height: img.height });
    });
    body.addEventListener("click", (e) => {
      const s = e.target.closest("[data-hex]"); if (s) copy(s.dataset.hex.toUpperCase(), `${s.dataset.hex.toUpperCase()} کپی شد.`);
      if (e.target.closest("[data-css]")) copy(`:root {\n${colors.map((x, i) => `  --color-${i + 1}: ${x.hex};`).join("\n")}\n}`, "متغیرهای CSS کپی شد.");
    });
  };

  // ---------------------------------------------------------------- Favicon
  function makeIco(pngs) {
    const total = 6 + 16 * pngs.length + pngs.reduce((s, p) => s + p.bytes.length, 0);
    const buf = new Uint8Array(total), dv = new DataView(buf.buffer);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, pngs.length, true);
    let off = 6 + 16 * pngs.length;
    pngs.forEach((p, i) => {
      const e = 6 + 16 * i;
      dv.setUint8(e, p.size >= 256 ? 0 : p.size); dv.setUint8(e + 1, p.size >= 256 ? 0 : p.size);
      dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
      dv.setUint32(e + 8, p.bytes.length, true); dv.setUint32(e + 12, off, true);
      buf.set(p.bytes, off); off += p.bytes.length;
    });
    return new Blob([buf], { type: "image/x-icon" });
  }
  RENDER.favicon = (body) => {
    const SIZES = [16, 32, 48, 180, 192, 512];
    let img = null, fit = "cover", bg = "#ffffff", round = 0, outs = [];
    body.innerHTML = `<div class="tgrid"><div class="card tpane">${dropzone("image/*", false, "لوگو یا عکس مربعی را اینجا رها کنید", "بهتر است حداقل ۵۱۲×۵۱۲ پیکسل باشد")}
        <div class="form-grid form-grid-2 mt-2">
          <div class="field"><span class="field-label">جای‌گیری</span><div class="seg-tabs sm" data-fit><button type="button" data-v="cover" class="is-on">پر کردن</button><button type="button" data-v="contain">کامل با زمینه</button></div></div>
          <div class="field"><span class="field-label">گوشه‌ها</span><div class="seg-tabs sm" data-round><button type="button" data-v="0" class="is-on">تیز</button><button type="button" data-v="0.22">گرد</button><button type="button" data-v="0.5">دایره</button></div></div>
          <div class="field"><span class="field-label">رنگ زمینه</span><input type="color" value="#ffffff" data-bg class="color-input"></div>
        </div></div>
      <div class="card tpane"><div class="row-between"><h3 class="h-sm">${icon("sparkle")} خروجی</h3><button type="button" class="btn btn-primary btn-sm" data-ico disabled>${icon("download")} favicon.ico</button></div>
        <div class="fav-out mt-2" data-out><p class="muted small">یک عکس انتخاب کنید.</p></div><div data-code></div></div></div>`;
    async function run() {
      if (!img) return;
      outs = [];
      for (const s of SIZES) {
        const c = document.createElement("canvas"); c.width = c.height = s;
        const ctx = c.getContext("2d");
        if (round) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, s, s, s * round) : ctx.rect(0, 0, s, s); ctx.clip(); }
        if (fit === "contain") { ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s); }
        const k = fit === "cover" ? Math.max(s / img.width, s / img.height) : Math.min(s / img.width, s / img.height) * 0.86;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
        const blob = await canvasBlob(c, "image/png");
        outs.push({ size: s, blob, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      const names = { 16: "favicon-16x16.png", 32: "favicon-32x32.png", 48: "favicon-48x48.png", 180: "apple-touch-icon.png", 192: "icon-192.png", 512: "icon-512.png" };
      body.querySelector("[data-out]").innerHTML = outs.map((o) => `<button type="button" class="fav" data-s="${o.size}"><img src="${URL.createObjectURL(o.blob)}" alt="" style="width:${Math.min(64, Math.max(16, o.size / 4))}px"><b>${fa(o.size)}×${fa(o.size)}</b><small dir="ltr">${names[o.size]}</small></button>`).join("");
      const code = `<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;
      body.querySelector("[data-code]").innerHTML = `<div class="code-box mt-2"><pre dir="ltr">${esc(code)}</pre><button type="button" class="btn btn-ghost btn-xs" data-copycode>کپی کد</button></div>`;
      body.querySelector("[data-code] [data-copycode]").onclick = () => copy(code, "کد HTML کپی شد.");
      body.querySelector("[data-ico]").disabled = false;
      outs.names = names;
    }
    bindDrop(body, async ([f]) => { img = await loadImage(f); await run(); track("favicon", { width: img.width, height: img.height }); });
    const seg = (sel, cb) => body.querySelector(sel).addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]"); if (!b) return;
      b.parentElement.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("is-on", x === b)); cb(b.dataset.v); run();
    });
    seg("[data-fit]", (v) => (fit = v));
    seg("[data-round]", (v) => (round = Number(v)));
    body.querySelector("[data-bg]").addEventListener("input", (e) => { bg = e.target.value; run(); });
    body.querySelector("[data-out]").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (b) { const o = outs.find((x) => x.size === Number(b.dataset.s)); download(o.blob, outs.names[o.size]); } });
    body.querySelector("[data-ico]").addEventListener("click", () => download(makeIco(outs.filter((o) => o.size <= 48)), "favicon.ico"));
  };

  // ---------------------------------------------------------------- Word counter
  RENDER.counter = (body) => {
    body.innerHTML = `<div class="tgrid tgrid--wide"><div class="card tpane"><textarea class="textarea big-text" dir="auto" data-t placeholder="متن خود را اینجا بنویسید یا بچسبانید…"></textarea>
      <div class="row mt-1"><button type="button" class="btn btn-ghost btn-xs" data-clear>${icon("trash")} پاک کردن</button><button type="button" class="btn btn-ghost btn-xs" data-fix>${icon("wand")} اصلاح «ی» و «ک» عربی و فاصله‌ها</button></div></div>
      <div class="card tpane"><div class="count-grid" data-stats></div><h4 class="mt-2 small">پرتکرارترین کلمه‌ها</h4><div class="chips mt-1" data-top></div></div></div>`;
    const ta = body.querySelector("[data-t]");
    const STOP = new Set(["و", "در", "به", "از", "که", "این", "را", "با", "است", "برای", "آن", "یک", "تا", "هم", "می", "ها", "the", "a", "an", "of", "to", "and", "in", "is"]);
    const update = () => {
      const t = ta.value;
      const words = t.match(/[\p{L}\p{N}‌]+/gu) || [];
      const sentences = t.split(/[.!?؟]+/).filter((s) => s.trim()).length;
      const paras = t.split(/\n\s*\n/).filter((s) => s.trim()).length;
      const read = Math.max(0, Math.ceil(words.length / 200));
      const stats = [["کلمه", words.length], ["کاراکتر", t.length], ["بدون فاصله", t.replace(/\s/g, "").length], ["جمله", sentences], ["پاراگراف", paras], ["زمان مطالعه", read ? `${fa(read)} دقیقه` : "—"]];
      body.querySelector("[data-stats]").innerHTML = stats.map(([l, v]) => `<div><b>${typeof v === "number" ? num(v) : v}</b><span>${l}</span></div>`).join("");
      const freq = {};
      words.forEach((w) => { const k = w.toLowerCase(); if (k.length > 1 && !STOP.has(k)) freq[k] = (freq[k] || 0) + 1; });
      body.querySelector("[data-top]").innerHTML = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => `<span class="chip">${esc(w)} <small>${fa(n)}</small></span>`).join("") || '<span class="muted small">—</span>';
      if (t.length > 30) trackT(words.length, t.length);
    };
    const trackT = debounce((w, c) => track("counter", { words: w, chars: c }, true), 2500);
    ta.addEventListener("input", update);
    body.querySelector("[data-clear]").onclick = () => { ta.value = ""; update(); };
    body.querySelector("[data-fix]").onclick = () => { ta.value = ta.value.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[ \t]{2,}/g, " ").replace(/ ([،.!؟:؛])/g, "$1"); update(); toast("متن مرتب شد.", "ok"); };
    update();
  };

  // ---------------------------------------------------------------- Date converter (Jalali algorithm after jalaali-js, MIT)
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    let gy = jy + 621, leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, i;
    for (i = 1; i < BREAKS.length; i++) { jm = BREAKS[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1;
    return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd };
  }
  const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    let k = jdn - g2d(gy, 3, r.march), jm, jd;
    if (k >= 0) {
      if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      k -= 186;
    } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    jm = 7 + div(k, 30); jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }
  const J_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  const G_MONTHS = ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"];
  const WEEK = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  BX.jalali = { toJalali: (gy, gm, gd) => d2j(g2d(gy, gm, gd)), toGregorian: (jy, jm, jd) => d2g(j2d(jy, jm, jd)) };
  RENDER.date = (body) => {
    const now = new Date();
    const tj = d2j(g2d(now.getFullYear(), now.getMonth() + 1, now.getDate()));
    const hijri = new Intl.DateTimeFormat("fa-IR-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(now);
    const sel = (name, list, v) => `<select class="select" data-${name}>${list.map((m, i) => `<option value="${i + 1}" ${i + 1 === v ? "selected" : ""}>${m}</option>`).join("")}</select>`;
    body.innerHTML = `<div class="today card">${icon("calendar")}<div><small>امروز</small><b>${WEEK[now.getDay()]} ${fa(tj.jd)} ${J_MONTHS[tj.jm - 1]} ${fa(tj.jy)}</b><span>${fa(now.getDate())} ${G_MONTHS[now.getMonth()]} ${fa(now.getFullYear())} · ${hijri}</span></div></div>
      <div class="tgrid mt-3">
        <div class="card tpane" data-box="j"><h3 class="h-sm">شمسی به میلادی</h3><div class="date-row mt-2"><input class="input" inputmode="numeric" data-d value="${fa(tj.jd)}" aria-label="روز">${sel("m", J_MONTHS, tj.jm)}<input class="input" inputmode="numeric" data-y value="${fa(tj.jy)}" aria-label="سال"></div><div class="date-out" data-out></div></div>
        <div class="card tpane" data-box="g"><h3 class="h-sm">میلادی به شمسی</h3><div class="date-row mt-2"><input class="input" inputmode="numeric" data-d value="${fa(now.getDate())}" aria-label="روز">${sel("m", G_MONTHS, now.getMonth() + 1)}<input class="input" inputmode="numeric" data-y value="${fa(now.getFullYear())}" aria-label="سال"></div><div class="date-out" data-out></div></div>
      </div>`;
    const today = g2d(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const rel = (jdn) => { const d = jdn - today; return d === 0 ? "امروز" : d > 0 ? `${fa(d)} روز بعد` : `${fa(-d)} روز پیش`; };
    const calc = (box) => {
      const v = (s) => Number(enDigits(box.querySelector(s).value)) || 0;
      const d = v("[data-d]"), m = v("[data-m]"), y = v("[data-y]");
      const out = box.querySelector("[data-out]");
      if (!d || !y || d > 31) { out.innerHTML = '<span class="muted">تاریخ را کامل وارد کنید.</span>'; return; }
      if (box.dataset.box === "j") {
        const jdn = j2d(y, m, d), g = d2g(jdn), wd = new Date(g.gy, g.gm - 1, g.gd).getDay();
        out.innerHTML = `<b>${WEEK[wd]} ${fa(g.gd)} ${G_MONTHS[g.gm - 1]} ${fa(g.gy)}</b><span dir="ltr">${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}</span><small>${rel(jdn)}</small>`;
      } else {
        const jdn = g2d(y, m, d), j = d2j(jdn), wd = new Date(y, m - 1, d).getDay();
        out.innerHTML = `<b>${WEEK[wd]} ${fa(j.jd)} ${J_MONTHS[j.jm - 1]} ${fa(j.jy)}</b><span dir="ltr">${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}</span><small>${rel(jdn)}</small>`;
      }
      if (ready) trackD(box.dataset.box);
    };
    let ready = false;
    const trackD = debounce((dir) => track("date", { dir: dir === "j" ? "jalali→gregorian" : "gregorian→jalali" }, true), 2000);
    body.querySelectorAll("[data-box]").forEach((box) => { box.addEventListener("input", () => calc(box)); calc(box); });
    ready = true;
  };

  // ---------------------------------------------------------------- Number to words
  const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
  const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const HUNDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  const SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون", "کوادریلیون"];
  function three(n) {
    const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10, parts = [];
    if (h) parts.push(HUNDS[h]);
    if (t === 1) parts.push(TEENS[o]);
    else { if (t) parts.push(TENS[t]); if (o) parts.push(ONES[o]); }
    return parts.join(" و ");
  }
  function toWords(str) {
    let s = String(str).replace(/^0+(?=\d)/, "");
    if (!/^\d+$/.test(s)) return "";
    if (/^0+$/.test(s)) return "صفر";
    const groups = [];
    while (s.length) { groups.unshift(Number(s.slice(-3))); s = s.slice(0, -3); }
    if (groups.length > SCALES.length) return "عدد خیلی بزرگ است";
    return groups.map((g, i) => {
      const sc = SCALES[groups.length - 1 - i];
      if (!g) return "";
      if (g === 1 && sc === "هزار") return "هزار";
      return `${three(g)}${sc ? ` ${sc}` : ""}`;
    }).filter(Boolean).join(" و ");
  }
  BX.numToWords = toWords;
  RENDER.num2words = (body) => {
    body.innerHTML = `<div class="card tpane"><div class="field"><label class="field-label" for="n2w">عدد یا مبلغ</label><input id="n2w" class="input input-lg" inputmode="numeric" dir="ltr" placeholder="۱۲۵۰۰۰۰۰" data-n></div>
      <div class="seg-tabs sm mt-2" data-unit><button type="button" data-v="" class="is-on">فقط عدد</button><button type="button" data-v="toman">تومان</button><button type="button" data-v="rial">ریال</button></div>
      <div class="words-out mt-2" data-out><span class="muted">عدد را وارد کنید…</span></div></div>`;
    let unit = "";
    const input = body.querySelector("[data-n]");
    const update = () => {
      const raw = enDigits(input.value).replace(/[^\d]/g, "");
      if (raw && input.value !== num(Number(raw)) && raw.length < 16) { input.value = num(Number(raw)); }
      const out = body.querySelector("[data-out]");
      if (!raw) { out.innerHTML = '<span class="muted">عدد را وارد کنید…</span>'; return; }
      const w = toWords(raw);
      const unitName = { toman: "تومان", rial: "ریال" }[unit] || "";
      let extra = "";
      if (unit === "rial" && raw.length > 1) extra = `<p class="muted small mt-1">معادل ${toWords(raw.slice(0, -1) || "0")} تومان</p>`;
      if (unit === "toman") extra = `<p class="muted small mt-1">معادل ${toWords(raw + "0")} ریال</p>`;
      out.innerHTML = `<p class="words">${w}${unitName ? ` ${unitName}` : ""}</p>${extra}<button type="button" class="btn btn-ghost btn-xs mt-1" data-copyw>${icon("link")} کپی</button>`;
      out.querySelector("[data-copyw]").onclick = () => copy(`${w}${unitName ? ` ${unitName}` : ""}`);
      trackN(raw.length, unit);
    };
    const trackN = debounce((digits, u) => track("num2words", { digits, unit: u || "none" }, true), 2000);
    input.addEventListener("input", update);
    body.querySelector("[data-unit]").addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]"); if (!b) return;
      b.parentElement.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("is-on", x === b)); unit = b.dataset.v; update();
    });
  };

  // ---------------------------------------------------------------- Password generator
  RENDER.password = (body) => {
    const st = { len: 16, lower: true, upper: true, digits: true, symbols: true, similar: true };
    body.innerHTML = `<div class="tgrid"><div class="card tpane">
        <div class="field"><div class="row-between"><span class="field-label">طول رمز</span><b class="brand" data-lv>${fa(st.len)}</b></div><input type="range" class="range" min="8" max="64" value="${st.len}" data-len></div>
        <div class="checks mt-2">${[["lower", "حروف کوچک (a-z)"], ["upper", "حروف بزرگ (A-Z)"], ["digits", "اعداد (0-9)"], ["symbols", "نمادها (!@#…)"], ["similar", "حذف کاراکترهای شبیه (l، 1، O، 0)"]].map(([k, l]) => `<label class="switch"><input type="checkbox" data-k="${k}" checked><span class="track"></span>${l}</label>`).join("")}</div>
        <button type="button" class="btn btn-primary btn-block mt-2" data-gen>${icon("refresh")} ساخت رمز جدید</button></div>
      <div class="card tpane"><ul class="pw-list" data-out></ul></div></div>`;
    const gen = (silent) => {
      let set = "";
      if (st.lower) set += "abcdefghijkmnopqrstuvwxyz" + (st.similar ? "" : "l");
      if (st.upper) set += "ABCDEFGHJKLMNPQRSTUVWXYZ" + (st.similar ? "" : "IO");
      if (st.digits) set += "23456789" + (st.similar ? "" : "01");
      if (st.symbols) set += "!@#$%^&*-_=+?";
      if (!set) set = "abcdefghijkmnopqrstuvwxyz";
      const pick = () => {
        const lim = 256 - (256 % set.length), r = new Uint8Array(1);
        do crypto.getRandomValues(r); while (r[0] >= lim);
        return set[r[0] % set.length];
      };
      const bits = Math.round(st.len * Math.log2(set.length));
      const level = bits >= 100 ? ["بسیار قوی", "ok", 100] : bits >= 70 ? ["قوی", "ok", 75] : bits >= 50 ? ["متوسط", "warn", 50] : ["ضعیف", "bad", 25];
      body.querySelector("[data-out]").innerHTML = Array.from({ length: 5 }, () => {
        const pw = Array.from({ length: st.len }, pick).join("");
        return `<li><code dir="ltr">${esc(pw)}</code><button type="button" class="icon-btn icon-btn-sm" data-pw="${esc(pw)}" aria-label="کپی">${icon("link")}</button></li>`;
      }).join("") + `<li class="strength ${level[1]}"><span>قدرت: <b>${level[0]}</b> (${fa(bits)} بیت)</span><i style="--w:${level[2]}%"></i></li>`;
      if (silent !== true) track("password", { length: st.len, sets: ["lower", "upper", "digits", "symbols"].filter((k) => st[k]).length });
    };
    body.querySelector("[data-len]").addEventListener("input", (e) => { st.len = Number(e.target.value); body.querySelector("[data-lv]").textContent = fa(st.len); });
    body.querySelector("[data-len]").addEventListener("change", () => gen());
    body.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("change", () => { st[el.dataset.k] = el.checked; gen(); }));
    body.querySelector("[data-gen]").onclick = () => gen();
    body.querySelector("[data-out]").addEventListener("click", (e) => { const b = e.target.closest("[data-pw]"); if (b) copy(b.dataset.pw, "رمز کپی شد."); });
    gen(true);
  };

  // ---------------------------------------------------------------- National code / IBAN / card validator
  const BINS = { 603799: "ملی", 589210: "سپه", 627648: "توسعه صادرات", 207177: "توسعه صادرات", 627961: "صنعت و معدن", 603770: "کشاورزی", 639217: "کشاورزی",
    628023: "مسکن", 627760: "پست بانک", 502908: "توسعه تعاون", 627412: "اقتصاد نوین", 622106: "پارسیان", 639194: "پارسیان", 627884: "پارسیان",
    502229: "پاسارگاد", 639347: "پاسارگاد", 627488: "کارآفرین", 502910: "کارآفرین", 621986: "سامان", 639346: "سینا", 639607: "سرمایه", 636214: "آینده",
    502806: "شهر", 504706: "شهر", 502938: "دی", 603769: "صادرات", 610433: "ملت", 991975: "ملت", 627353: "تجارت", 585983: "تجارت", 589463: "رفاه کارگران",
    639370: "مهر اقتصاد", 639599: "قوامین", 504172: "رسالت", 606373: "قرض‌الحسنه مهر ایران", 505785: "ایران زمین", 505416: "گردشگری", 606256: "ملل", 505801: "کوثر" };
  const IBANK = { "010": "مرکزی", "011": "صنعت و معدن", "012": "ملت", "013": "رفاه کارگران", "014": "مسکن", "015": "سپه", "016": "کشاورزی", "017": "ملی",
    "018": "تجارت", "019": "صادرات", "020": "توسعه صادرات", "021": "پست بانک", "022": "توسعه تعاون", "053": "کارآفرین", "054": "پارسیان", "055": "اقتصاد نوین",
    "056": "سامان", "057": "پاسارگاد", "058": "سرمایه", "059": "سینا", "060": "قرض‌الحسنه مهر ایران", "061": "شهر", "062": "آینده", "066": "دی", "069": "ایران زمین", "070": "رسالت" };
  function checkMelli(c) {
    if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false;
    const s = [...c.slice(0, 9)].reduce((a, d, i) => a + Number(d) * (10 - i), 0) % 11;
    return Number(c[9]) === (s < 2 ? s : 11 - s);
  }
  const checkCard = (c) => /^\d{16}$/.test(c) && [...c].reverse().reduce((a, d, i) => { let n = Number(d); if (i % 2) { n *= 2; if (n > 9) n -= 9; } return a + n; }, 0) % 10 === 0;
  function checkIban(v) {
    if (!/^IR\d{24}$/.test(v)) return false;
    const re = (v.slice(4) + "1827" + v.slice(2, 4));
    let r = 0;
    for (const ch of re) r = (r * 10 + Number(ch)) % 97;
    return r === 1;
  }
  RENDER.validate = (body) => {
    let kind = "melli";
    body.innerHTML = `<div class="card tpane"><div class="seg-tabs" data-kind><button type="button" data-v="melli" class="is-on">${icon("user")}کد ملی</button><button type="button" data-v="iban">${icon("building")}شماره شبا</button><button type="button" data-v="card">${icon("wallet")}شماره کارت</button></div>
      <input class="input input-lg mt-2 mono" dir="ltr" inputmode="numeric" data-v-in placeholder="0012345678" autocomplete="off">
      <div class="verdict mt-2" data-out></div></div>`;
    const input = body.querySelector("[data-v-in]");
    const out = body.querySelector("[data-out]");
    const PH = { melli: "0012345678", iban: "IR000000000000000000000000", card: "6037 9900 0000 0000" };
    const update = () => {
      let v = enDigits(input.value).toUpperCase().replace(/[\s-]/g, "");
      if (kind === "iban" && /^\d/.test(v)) v = "IR" + v;
      if (!v) { out.innerHTML = ""; out.className = "verdict mt-2"; return; }
      let ok = false, extra = "";
      if (kind === "melli") { ok = checkMelli(v); extra = ok ? "کد ملی از نظر ساختار معتبر است." : v.length !== 10 ? `کد ملی ۱۰ رقم است (${fa(v.length)} رقم وارد شده).` : "رقم کنترل کد ملی درست نیست."; }
      if (kind === "card") { ok = checkCard(v); const bank = BINS[v.slice(0, 6)]; extra = (ok ? "شماره کارت معتبر است." : v.length !== 16 ? `شماره کارت ۱۶ رقم است (${fa(v.length)} رقم وارد شده).` : "شماره کارت معتبر نیست.") + (bank ? ` بانک: <b>${bank}</b>` : ""); }
      if (kind === "iban") { ok = checkIban(v); const bank = IBANK[v.slice(4, 7)]; extra = (ok ? "شماره شبا معتبر است." : v.length !== 26 ? `شبا IR و ۲۴ رقم است (${fa(Math.max(0, v.length - 2))} رقم وارد شده).` : "رقم کنترل شبا درست نیست.") + (ok && bank ? ` بانک: <b>${bank}</b>` : ""); }
      out.className = `verdict mt-2 ${ok ? "is-ok" : "is-bad"}`;
      out.innerHTML = `<span class="v-ic">${icon(ok ? "check" : "cross")}</span><span>${extra}</span>`;
      if ((kind === "melli" && v.length === 10) || (kind === "card" && v.length === 16) || (kind === "iban" && v.length === 26)) track("validate", { kind, valid: ok });
    };
    input.addEventListener("input", update);
    body.querySelector("[data-kind]").addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]"); if (!b) return;
      b.parentElement.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("is-on", x === b));
      kind = b.dataset.v; input.placeholder = PH[kind]; input.inputMode = kind === "iban" ? "text" : "numeric"; update(); input.focus();
    });
    body.insertAdjacentHTML("beforeend", `<p class="muted small mt-2">${icon("info")} بررسی فقط بر اساس فرمول استاندارد انجام می‌شود و به معنی فعال بودن حساب یا کارت نیست. اطلاعات شما جایی ارسال نمی‌شود.</p>`);
  };

  // ---------------------------------------------------------------- UTM builder
  RENDER.utm = (body) => {
    const PRE = { source: ["instagram", "telegram", "whatsapp", "google", "email", "sms"], medium: ["social", "cpc", "story", "email", "sms", "referral"] };
    body.innerHTML = `<div class="tgrid"><div class="card tpane"><div class="form-grid">
        <div class="field"><label class="field-label">آدرس صفحه</label><input class="input" dir="ltr" data-f="url" placeholder="https://example.com/landing"></div>
        ${[["source", "منبع (utm_source)", "instagram"], ["medium", "رسانه (utm_medium)", "social"], ["campaign", "نام کمپین (utm_campaign)", "yalda-sale"], ["term", "کلمه کلیدی (اختیاری)", ""], ["content", "محتوا / نسخه تبلیغ (اختیاری)", ""]].map(([k, l, ph]) => `<div class="field"><label class="field-label">${l}</label><input class="input" dir="ltr" data-f="${k}" placeholder="${ph}">${PRE[k] ? `<div class="chips sm">${PRE[k].map((v) => `<button type="button" class="chip" data-pre="${k}" data-val="${v}">${v}</button>`).join("")}</div>` : ""}</div>`).join("")}
      </div></div>
      <div class="card tpane"><h3 class="h-sm">${icon("link")} لینک کمپین</h3><div class="utm-out mt-2" dir="ltr" data-out>—</div>
        <div class="row mt-2"><button type="button" class="btn btn-primary btn-sm" data-copy disabled>${icon("link")} کپی</button><button type="button" class="btn btn-ghost btn-sm" data-short disabled>${icon("zap")} کوتاه کن</button></div><div data-short-out class="mt-2"></div>
        <p class="muted small mt-2">${icon("info")} این لینک را در تبلیغ استفاده کنید؛ در Google Analytics بازدیدها به تفکیک منبع و کمپین دیده می‌شود.</p></div></div>`;
    const val = (k) => body.querySelector(`[data-f="${k}"]`).value.trim();
    let link = "";
    const update = () => {
      let u = val("url");
      if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
      try {
        const url = new URL(u);
        for (const k of ["source", "medium", "campaign", "term", "content"]) { const v = val(k).replace(/\s+/g, "-"); if (v) url.searchParams.set(`utm_${k}`, v); else url.searchParams.delete(`utm_${k}`); }
        link = val("source") && val("campaign") ? url.toString() : "";
      } catch (e) { link = ""; }
      body.querySelector("[data-out]").textContent = link || "آدرس، منبع و نام کمپین را وارد کنید.";
      body.querySelector("[data-copy]").disabled = body.querySelector("[data-short]").disabled = !link;
    };
    body.addEventListener("input", update);
    body.addEventListener("click", async (e) => {
      const p = e.target.closest("[data-pre]");
      if (p) { body.querySelector(`[data-f="${p.dataset.pre}"]`).value = p.dataset.val; update(); }
      if (e.target.closest("[data-copy]")) { copy(link, "لینک کمپین کپی شد."); track("utm", { source: val("source"), medium: val("medium"), action: "copy" }); }
      if (e.target.closest("[data-short]")) {
        try {
          const { link: l } = await BX.api("tools.short.create", { url: link });
          body.querySelector("[data-short-out]").innerHTML = `<div class="short-result"><div class="grow"><small class="muted">لینک کوتاه کمپین</small><a href="${esc(l.short)}" target="_blank" rel="noopener" dir="ltr">${esc(l.short.replace(/^https?:\/\//, ""))}</a></div><button type="button" class="btn btn-ghost btn-sm" data-copy2="${esc(l.short)}">کپی</button></div>`;
          copy(l.short, "لینک کوتاه ساخته و کپی شد.");
          track("utm", { source: val("source"), medium: val("medium"), action: "short" });
        } catch (err) { toast(err.message, "bad"); }
      }
      const c2 = e.target.closest("[data-copy2]"); if (c2) copy(c2.dataset.copy2);
    });
  };

  // ---------------------------------------------------------------- boot
  if (app) BX.ready.then(() => {
    window.addEventListener("hashchange", () => { route(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    route();
  }).catch(() => {});
})();
