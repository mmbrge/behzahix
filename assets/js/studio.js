/* ==========================================================================
   BEHIX — Studio: self-service builders that run entirely in the browser.
   This file: router, hub, form engine, save/buy flow, resume, documents,
   brand-name generator and the SEO audit. Other builders register through
   window.STUDIO.register (studio-canvas.js, studio-slides.js, studio-pages.js).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const builders = {};
  const S = { info: null };
  const STUDIO = (window.STUDIO = { builders, S, register: (id, def) => { builders[id] = { id, ...def }; } });

  // ---------------------------------------------------------------- small helpers
  const H = (STUDIO.h = {
    esc: (s) => BX.esc(s == null ? "" : String(s)),
    fa: (n) => BX.faDigits(n),
    money: (n) => (n > 0 ? BX.toman(n) : "رایگان"),
    debounce(fn, ms = 120) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
    download(blob, name) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
    // Opens a clean page and asks the browser to print / «Save as PDF»
    printHtml(html, title, size = "A4") {
      const w = window.open("", "_blank");
      if (!w) { BX.toast("پنجره چاپ باز نشد؛ اجازه پاپ‌آپ را بدهید.", "bad"); return; }
      const font = new URL("assets/fonts/Vazirmatn.woff2", location.href).href;
      w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${H.esc(title)}</title>
        <style>@font-face{font-family:Vazirmatn;src:url("${font}") format("woff2");font-weight:100 900}
        @page{size:${size};margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Vazirmatn,Tahoma,sans-serif;background:#fff}</style></head>
        <body>${html}<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})<\/script></body></html>`);
      w.document.close();
    },
    // Resize an image file to a data URL (keeps PNG transparency for logos)
    async readImage(file, max = 900) {
      const url = URL.createObjectURL(file);
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      return /png|gif|webp/.test(file.type) ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.86);
    },
    // Repeating «پیش‌نمایش» layer over HTML previews
    watermarkHtml() {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='160'><text x='20' y='90' transform='rotate(-24 130 80)' font-family='Tahoma' font-size='22' font-weight='700' fill='rgba(255,122,26,.22)'>پیش‌نمایش ${BX.settings.general?.siteName || "BEHIX"}</text></svg>`;
      return `<div class="st-wm" style="background-image:url(&quot;data:image/svg+xml,${encodeURIComponent(svg)}&quot;)"></div>`;
    },
    lines: (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean),
  });

  // ---------------------------------------------------------------- form engine
  // Field: {k, label, type, options, ph, span, fields (list), add, max, help, dir}
  function fieldHtml(f, v, path) {
    if (f.type === "html") return f.html;
    const id = `sf-${path.replace(/\W/g, "_")}`;
    const lab = f.label ? `<label class="field-label" for="${id}">${f.label}</label>` : "";
    const help = f.help ? `<small class="field-hint">${f.help}</small>` : "";
    const span = f.span ? " span-2" : "";
    const dir = f.dir ? ` dir="${f.dir}"` : "";
    if (f.type === "textarea") return `<div class="field${span}">${lab}<textarea class="textarea" id="${id}" data-p="${path}" rows="${f.rows || 3}" placeholder="${H.esc(f.ph || "")}"${dir}>${H.esc(v)}</textarea>${help}</div>`;
    if (f.type === "select") return `<div class="field${span}">${lab}<select class="select" id="${id}" data-p="${path}">${f.options.map(([o, l]) => `<option value="${H.esc(o)}" ${String(o) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select>${help}</div>`;
    if (f.type === "color") return `<div class="field">${lab}<div class="st-colors">${(f.swatches || ["#ff7a1a", "#2563eb", "#059669", "#7c3aed", "#db2777", "#0f172a", "#b45309", "#0891b2"]).map((c) => `<button type="button" class="${c === v ? "is-on" : ""}" style="background:${c}" data-swatch="${path}" data-c="${c}" aria-label="${c}"></button>`).join("")}<input type="color" id="${id}" data-p="${path}" value="${H.esc(v || "#ff7a1a")}"></div></div>`;
    if (f.type === "check") return `<label class="switch${span}"><input type="checkbox" data-p="${path}" ${v ? "checked" : ""}><span class="track"></span>${f.label}</label>`;
    if (f.type === "range") return `<div class="field">${lab}<input type="range" id="${id}" data-p="${path}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${H.esc(v)}"></div>`;
    if (f.type === "tpl") return `<div class="field span-2">${lab}<div class="st-tpls">${f.options.map(([o, l, sw]) => `<button type="button" class="st-tpl ${o === v ? "is-on" : ""}" data-tpl="${path}" data-v="${o}"><i style="background:${sw || "var(--brand)"}"></i>${l}</button>`).join("")}</div></div>`;
    if (f.type === "image") {
      const src = v ? (f.upload ? `api/index.php?r=file&id=${encodeURIComponent(v)}` : v) : "";
      return `<div class="field${span}">${lab}<div class="st-img">${src ? `<img src="${src}" alt="">` : `<span>${BX.icon("image")}</span>`}<label class="btn btn-ghost btn-xs">${BX.icon("upload")} ${v ? "تغییر" : "انتخاب"}<input type="file" accept="image/*" data-img="${path}" data-max="${f.max || 900}" ${f.upload ? "data-upload" : ""} hidden></label>${v ? `<button type="button" class="btn btn-ghost btn-xs" data-clear="${path}">حذف</button>` : ""}</div>${help}</div>`;
    }
    if (f.type === "list") {
      const arr = Array.isArray(v) ? v : [];
      return `<div class="field span-2 st-list"><div class="row-between"><span class="field-label">${f.label}</span><button type="button" class="btn btn-ghost btn-xs" data-add="${path}">${BX.icon("plus")} ${f.add || "افزودن"}</button></div>
        ${arr.map((item, i) => `<div class="st-li"><div class="st-li-bar"><b>${H.fa(i + 1)}</b><span class="grow"></span>${i ? `<button type="button" class="icon-btn icon-btn-sm" data-up="${path}" data-i="${i}" aria-label="بالا">${BX.icon("chevron-up")}</button>` : ""}<button type="button" class="icon-btn icon-btn-sm" data-del="${path}" data-i="${i}" aria-label="حذف">${BX.icon("trash")}</button></div>
          <div class="form-grid form-grid-2">${f.fields.map((sf) => fieldHtml(sf, item[sf.k], `${path}.${i}.${sf.k}`)).join("")}</div></div>`).join("") || `<p class="muted small">${f.empty || "موردی اضافه نشده."}</p>`}</div>`;
    }
    if (f.type === "html") return f.html;
    return `<div class="field${span}">${lab}<input class="input" id="${id}" data-p="${path}" value="${H.esc(v)}" placeholder="${H.esc(f.ph || "")}"${dir}${f.type === "number" ? ' inputmode="numeric"' : ""}>${help}</div>`;
  }
  const getAt = (o, path) => (path ? path.split(".").reduce((a, k) => (a == null ? a : a[k]), o) : undefined);
  const setAt = (o, path, v) => { const ks = path.split("."); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= /^\d+$/.test(k) ? {} : {}), o); t[last] = v; };
  STUDIO.form = {
    render(schema, data) {
      return schema.map((sec) => `<details class="st-sec" ${sec.open !== false ? "open" : ""}><summary>${sec.icon ? BX.icon(sec.icon) : ""}${sec.title}</summary><div class="form-grid form-grid-2">${sec.fields.map((f) => fieldHtml(f, getAt(data, f.k), f.k)).join("")}</div></details>`).join("");
    },
    // Wires inputs to data; calls onChange(data, structural) after each change
    bind(root, schema, data, onChange) {
      // definition of a (possibly nested) list: «cats.0.items» → cats → items
      const listDef = (path) => {
        let defs = schema.flatMap((s) => s.fields), def = null;
        for (const part of path.split(".")) { if (/^\d+$/.test(part)) continue; def = defs.find((f) => f.k === part); if (!def) return null; defs = def.fields || []; }
        return def;
      };
      const rerender = () => { root.innerHTML = STUDIO.form.render(schema, data); onChange(data, true); };
      root.addEventListener("input", (e) => {
        const p = e.target.dataset.p;
        if (!p) return;
        setAt(data, p, e.target.type === "checkbox" ? e.target.checked : e.target.value);
        if (e.target.type === "color") e.target.closest(".st-colors")?.querySelectorAll("[data-swatch]").forEach((b) => b.classList.toggle("is-on", b.dataset.c === e.target.value));
        onChange(data, false);
      });
      root.addEventListener("change", async (e) => {
        if (e.target.dataset.p && e.target.tagName === "SELECT") { setAt(data, e.target.dataset.p, e.target.value); onChange(data, false); }
        const ip = e.target.dataset.img;
        if (ip && e.target.files[0]) {
          try {
            if (e.target.hasAttribute("data-upload")) {
              if (!STUDIO.upload) throw new Error("آپلود در دسترس نیست.");
              BX.toast("در حال آپلود تصویر…", "info");
              setAt(data, ip, await STUDIO.upload(e.target.files[0]));
            } else setAt(data, ip, await H.readImage(e.target.files[0], Number(e.target.dataset.max) || 900));
            rerender();
          } catch (err) { BX.toast(err.message || "این تصویر قابل خواندن نیست.", "bad"); }
        }
      });
      root.addEventListener("click", (e) => {
        const b = e.target.closest("[data-add],[data-del],[data-up],[data-swatch],[data-tpl],[data-clear]");
        if (!b) return;
        const d = b.dataset;
        if (d.swatch) { setAt(data, d.swatch, d.c); root.querySelector(`[data-p="${d.swatch}"]`).value = d.c; b.parentElement.querySelectorAll("[data-swatch]").forEach((x) => x.classList.toggle("is-on", x === b)); return onChange(data, false); }
        if (d.tpl) { setAt(data, d.tpl, d.v); b.parentElement.querySelectorAll(".st-tpl").forEach((x) => x.classList.toggle("is-on", x === b)); return onChange(data, false); }
        if (d.clear) { setAt(data, d.clear, ""); return rerender(); }
        const path = d.add || d.del || d.up;
        const arr = getAt(data, path) || [];
        if (d.add) { const def = listDef(path); if (def.max && arr.length >= def.max) return BX.toast(`حداکثر ${H.fa(def.max)} مورد.`, "info"); arr.push(Object.fromEntries(def.fields.map((f) => [f.k, f.def ?? ""]))); }
        if (d.del) arr.splice(Number(d.i), 1);
        if (d.up) { const i = Number(d.i); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }
        setAt(data, path, arr);
        rerender();
      });
    },
  };

  // ---------------------------------------------------------------- save / buy
  const draftKey = (kind) => `behix:studio:${kind}`;
  STUDIO.saveDraft = (kind, data) => { try { localStorage.setItem(draftKey(kind), JSON.stringify(data)); } catch (e) { /* storage full */ } };
  STUDIO.loadDraft = (kind) => { try { return JSON.parse(localStorage.getItem(draftKey(kind)) || "null"); } catch (e) { return null; } };
  function needLogin(kind) {
    BX.modal({
      title: "ورود برای ذخیره و دریافت فایل",
      body: `<p class="lh">طرح شما روی همین دستگاه ذخیره شد. برای دریافت فایل نهایی وارد شوید (فقط با شماره موبایل)؛ بعد از ورود دوباره به همین صفحه برمی‌گردید.</p>`,
      actions: [{ label: "بعداً" }, { label: "ورود / ثبت‌نام", primary: true, onClick: () => { location.href = `auth.html?next=${encodeURIComponent(`studio.html#${kind}`)}`; } }],
    });
  }
  // Shared editor shell for file builders (resume, doc, card, post, slides)
  STUDIO.editor = function (view, cfg) {
    const { kind, schema } = cfg;
    let item = cfg.item || null; // {id, paid, title}
    let price = cfg.price ?? (S.info?.prices?.[kind] || 0);
    const data = cfg.data;
    view.innerHTML = `
      <div class="st-top card">
        <a class="icon-btn" href="#" aria-label="بازگشت به استودیو">${BX.icon("arrow-right")}</a>
        <span class="st-top-ic">${BX.icon(cfg.icon || "sparkles")}</span>
        <div class="grow"><b>${H.esc(cfg.title)}</b><small class="muted d-block" data-st-status>${item?.paid ? "خریداری شده — دانلود نامحدود" : `پیش‌نمایش رایگان · فایل نهایی ${H.money(price)}`}</small></div>
        <button type="button" class="btn btn-ghost btn-sm" data-st="save">${BX.icon("check")}<span class="hide-sm"> ذخیره</span></button>
        <button type="button" class="btn btn-primary btn-sm" data-st="get">${BX.icon("download")} ${item?.paid ? "دانلود" : `دریافت<span class="hide-sm"> فایل نهایی</span>`}</button>
      </div>
      <div class="st-edit ${cfg.wide ? "is-wide" : ""}">
        <div class="st-form card" data-st-form>${STUDIO.form.render(schema, data)}</div>
        <div class="st-preview" data-st-preview></div>
      </div>`;
    const formEl = view.querySelector("[data-st-form]");
    const prev = view.querySelector("[data-st-preview]");
    const paint = () => cfg.preview(prev, data, !!item?.paid);
    const paintSoon = H.debounce(paint, 140);
    const autosave = H.debounce(() => STUDIO.saveDraft(kind, data), 600);
    STUDIO.form.bind(formEl, schema, data, (d, structural) => { structural ? paint() : paintSoon(); autosave(); });
    paint();
    const status = (txt) => { view.querySelector("[data-st-status]").textContent = txt; };
    async function save(quiet) {
      if (!BX.me) { STUDIO.saveDraft(kind, data); needLogin(cfg.route || kind); return null; }
      const r = await BX.api("a.studio.save", { id: item?.id || 0, kind, title: (cfg.titleOf ? cfg.titleOf(data) : "") || cfg.title, data });
      item = r.item; price = r.price;
      if (location.hash.split("/")[1] !== String(item.id)) history.replaceState(null, "", `#${cfg.route || kind}/${item.id}`);
      if (!quiet) BX.toast("طرح ذخیره شد؛ از پنل «ساخته‌های من» هم در دسترس است.", "ok");
      status(item.paid ? "خریداری شده — دانلود نامحدود" : `ذخیره شد · فایل نهایی ${H.money(price)}`);
      return item;
    }
    async function get() {
      try {
        const it = await save(true);
        if (!it) return;
        if (it.paid) { await cfg.exportFile(data); return; }
        const wallet = BX.me?.wallet || 0;
        BX.modal({
          title: "دریافت فایل نهایی",
          body: `<div class="st-buy"><p class="lh">فایل بدون واترمارک و با کیفیت چاپ ${cfg.deliverText || ""} آماده می‌شود و همیشه از پنل «ساخته‌های من» قابل دانلود و ویرایش است.</p>
            <div class="st-buy-price"><span>مبلغ</span><b>${H.money(price)}</b></div>
            ${price && wallet ? `<p class="muted small">موجودی کیف پول: ${BX.toman(wallet)}${wallet >= price ? " — از کیف پول کسر می‌شود." : " — مابقی از درگاه پرداخت می‌شود."}</p>` : ""}</div>`,
          actions: [{ label: "انصراف" }, { label: price ? "پرداخت و دریافت" : "دریافت رایگان", primary: true, onClick: () => {
            BX.api("a.studio.buy", { id: it.id }).then(async (r) => {
              if (r.redirect) { STUDIO.saveDraft(kind, data); location.href = r.redirect; return; }
              item.paid = true;
              if (r.paidFromWallet && BX.me) BX.me.wallet = Math.max(0, (BX.me.wallet || 0) - r.paidFromWallet);
              status("خریداری شده — دانلود نامحدود");
              view.querySelector('[data-st="get"]').innerHTML = `${BX.icon("download")} دانلود`;
              paint();
              BX.toast("پرداخت شد؛ فایل در حال آماده‌سازی است…", "ok");
              await cfg.exportFile(data);
            }).catch((e) => BX.toast(e.message, "bad"));
          } }],
        });
      } catch (e) { BX.toast(e.message, "bad"); }
    }
    view.querySelector('[data-st="save"]').onclick = () => save(false).catch((e) => BX.toast(e.message, "bad"));
    view.querySelector('[data-st="get"]').onclick = get;
    return { paint, data, save };
  };

  // Loads a saved item (#kind/ID) or the local draft, then opens the editor
  STUDIO.open = async function (view, kind, idPart, defaults, start) {
    let item = null, data = null;
    if (idPart && /^\d+$/.test(idPart) && BX.me) {
      try { const r = await BX.api("a.studio.get", { id: idPart }); item = r.item; data = r.item.data; item.price = r.price; }
      catch (e) { BX.toast(e.message, "bad"); }
    }
    if (!data) data = STUDIO.loadDraft(kind) || defaults();
    start(data, item);
  };

  // ---------------------------------------------------------------- hub
  const CARDS = [
    ["resume", "رزومه‌ساز حرفه‌ای", "file", "۴ قالب فارسی و دوزبانه با عکس؛ خروجی PDF آماده ارسال برای کارفرما", "resume", 210],
    ["card", "کارت ویزیت چاپی", "layout", "۶ قالب مدرن پشت و رو، با لوگو و QR؛ خروجی PNG و PDF با ابعاد چاپ ۹×۵", "card", 25],
    ["post", "پست، استوری و پوستر", "image", "تخفیف، مناسبت، معرفی محصول و اطلاعیه برای اینستاگرام، استوری و A4", "post", 330],
    ["doc", "قرارداد و نامه رسمی", "book", "قرارداد فریلنسری، رسید وجه، نامه اداری، پیش‌فاکتور و درخواست — فقط جاهای خالی را پر کنید", "doc", 160],
    ["slides", "پاورپوینت‌ساز", "presentation", "اسلایدها را بنویسید، قالب را انتخاب کنید و فایل .pptx قابل ویرایش بگیرید", "slides", 280],
    ["page-card", "کارت ویزیت دیجیتال", "user", "صفحه شخصی با لینک‌ها، دکمه تماس و ذخیره مخاطب + QR؛ اشتراک ماهانه یا سالانه", "pageCard", 40],
    ["page-menu", "منوی QR کافه و رستوران", "list", "منوی آنلاین با دسته‌بندی، قیمت و عکس؛ تغییر قیمت در هر لحظه + کارت QR میز", "pageMenu", 15],
    ["names", "ایده نام برند", "sparkles", "ده‌ها نام فارسی و انگلیسی برای کسب‌وکارتان با پیش‌نمایش لوگوتایپ — رایگان", "free", 190],
    ["seo", "بررسی سئوی سایت", "search", "۱۸ مورد مهم سئو و سرعت سایت را در چند ثانیه بررسی کنید — رایگان", "free", 140],
  ];
  function hub(view) {
    const p = S.info?.prices || {};
    const priceTag = (k) => k === "free" ? "رایگان" : k === "pageCard" ? `از ${BX.toman(p.pageCardMonth || 0)} در ماه` : k === "pageMenu" ? `از ${BX.toman(p.pageMenuMonth || 0)} در ماه` : (p[k] ? `فایل نهایی ${BX.toman(p[k])}` : "رایگان");
    view.innerHTML = `<div class="studio-grid">${CARDS.map(([id, t, ic, d, pk, hue], i) => `
      <a class="card st-card" href="#${id}" style="--h:${hue};--d:${i * 50}ms" data-reveal>
        <span class="st-card-ic">${BX.icon(ic)}</span>
        <h2>${t}</h2><p class="muted small lh">${d}</p>
        <div class="row-between"><span class="badge ${pk === "free" ? "badge--ok" : "badge--brand"}">${priceTag(pk)}</span><span class="st-go">شروع ${BX.icon("arrow")}</span></div>
      </a>`).join("")}</div>
      <div class="card st-how mt-3" data-reveal>
        <div><b>۱</b><span>قالب را انتخاب کنید و فرم را پر کنید</span></div>
        <div><b>۲</b><span>پیش‌نمایش زنده را ببینید و تا دلتان خواست تغییر دهید</span></div>
        <div><b>۳</b><span>پرداخت کنید و فایل نهایی را فوری دانلود کنید</span></div>
        <div><b>۴</b><span>هر وقت خواستید از پنل ویرایش و دوباره دانلود کنید</span></div>
      </div>
      <div class="cta glow mt-3" data-reveal><h2 class="h2-sm">طراحی کاملاً اختصاصی می‌خواهید؟</h2><p class="muted lh">طراحان بهیکس لوگو، کارت ویزیت، رزومه و پاورپوینت اختصاصی شما را از صفر طراحی می‌کنند.</p>
        <div class="cta-actions"><a class="btn btn-primary" href="order.html">ثبت سفارش طراحی اختصاصی ${BX.icon("arrow")}</a><a class="btn btn-ghost" href="dashboard.html#studio">ساخته‌های من</a></div></div>`;
    BX.initReveal?.(view);
  }

  // ---------------------------------------------------------------- router
  const view = () => document.getElementById("studio-app");
  async function route() {
    const [id, param] = decodeURIComponent(location.hash.slice(1)).split("/");
    const v = view();
    if (!v) return;
    document.querySelector(".studio-hero")?.toggleAttribute("hidden", !!id && !!builders[id]);
    if (!id || !builders[id]) { hub(v); document.title = "استودیو آنلاین | " + (BX.settings.general?.siteNameFa || "بهیکس"); return; }
    window.scrollTo({ top: 0 });
    v.innerHTML = `<div class="card skeleton" style="height:480px"></div>`;
    document.title = `${builders[id].title} | استودیو ${BX.settings.general?.siteNameFa || "بهیکس"}`;
    try { await builders[id].render(v, param); } catch (e) { console.error(e); v.innerHTML = `<div class="card empty">${BX.icon("info")}<p>${H.esc(e.message)}</p><a class="btn btn-ghost btn-sm" href="#">بازگشت</a></div>`; }
  }
  BX.ready.then(async () => {
    try { S.info = await BX.api("studio.info"); } catch (e) { S.info = { prices: {}, docs: [] }; }
    if (S.info.enabled === false && BX.me?.role !== "admin") { view().innerHTML = `<div class="card empty">${BX.icon("info")}<p>استودیو فعلاً غیرفعال است.</p></div>`; return; }
    window.addEventListener("hashchange", route);
    route();
  });

  // ================================================================ RESUME
  const RESUME_TPL = [["classic", "کلاسیک", "#1e293b"], ["modern", "مدرن دوستونه", "#2563eb"], ["minimal", "مینیمال", "#94a3b8"], ["creative", "خلاق", "#ff7a1a"]];
  const LEVEL = [["5", "عالی"], ["4", "خیلی خوب"], ["3", "خوب"], ["2", "متوسط"], ["1", "آشنایی"]];
  const resumeSchema = [
    { title: "قالب و رنگ", icon: "palette", fields: [{ k: "tpl", type: "tpl", label: "قالب", options: RESUME_TPL }, { k: "color", type: "color", label: "رنگ اصلی" }, { k: "photo", type: "image", label: "عکس پرسنلی (اختیاری)", max: 500 }] },
    { title: "اطلاعات شخصی", icon: "user", fields: [
      { k: "name", label: "نام و نام خانوادگی", ph: "مثلاً سارا محمدی" }, { k: "role", label: "عنوان شغلی", ph: "مثلاً کارشناس بازاریابی دیجیتال" },
      { k: "phone", label: "موبایل", dir: "ltr" }, { k: "email", label: "ایمیل", dir: "ltr" }, { k: "city", label: "شهر" }, { k: "link", label: "لینکدین / سایت / نمونه‌کار", dir: "ltr" },
      { k: "birth", label: "سال تولد (اختیاری)" }, { k: "military", label: "وضعیت نظام وظیفه (اختیاری)" },
      { k: "summary", type: "textarea", label: "درباره من (۲ تا ۴ خط)", span: true, rows: 4, ph: "خلاصه‌ای از تجربه، مهارت‌های کلیدی و هدف شغلی شما" },
    ] },
    { title: "سوابق کاری", icon: "briefcase", fields: [{ k: "jobs", type: "list", label: "سابقه‌ها", add: "افزودن سابقه", max: 10, fields: [
      { k: "role", label: "سمت" }, { k: "company", label: "شرکت" }, { k: "from", label: "از (مثلاً ۱۴۰۰)" }, { k: "to", label: "تا (مثلاً اکنون)" },
      { k: "desc", type: "textarea", label: "دستاوردها و مسئولیت‌ها (هر خط یک مورد)", span: true }] }] },
    { title: "تحصیلات", icon: "award", fields: [{ k: "edu", type: "list", label: "مدارک", add: "افزودن مدرک", max: 6, fields: [
      { k: "degree", label: "مدرک و رشته" }, { k: "school", label: "دانشگاه / موسسه" }, { k: "from", label: "از" }, { k: "to", label: "تا" }] }] },
    { title: "مهارت‌ها و زبان", icon: "zap", fields: [
      { k: "skills", type: "list", label: "مهارت‌ها", add: "افزودن مهارت", max: 16, fields: [{ k: "name", label: "مهارت" }, { k: "level", label: "سطح", type: "select", options: LEVEL, def: "4" }] },
      { k: "langs", type: "list", label: "زبان‌ها", add: "افزودن زبان", max: 6, fields: [{ k: "name", label: "زبان" }, { k: "level", label: "سطح", type: "select", options: LEVEL, def: "3" }] },
    ] },
    { title: "دوره‌ها، افتخارات و علایق", icon: "star", open: false, fields: [
      { k: "courses", type: "list", label: "دوره‌ها و گواهی‌ها", add: "افزودن دوره", max: 10, fields: [{ k: "title", label: "عنوان" }, { k: "org", label: "برگزارکننده و سال" }] },
      { k: "interests", label: "علایق", span: true, ph: "مثلاً کتاب، کوهنوردی، عکاسی" },
    ] },
  ];
  const resumeDefaults = () => ({
    tpl: "modern", color: "#2563eb", photo: "", name: BX.me?.name || "", role: "", phone: BX.me?.phone || "", email: "", city: "", link: "", birth: "", military: "", summary: "",
    jobs: [{ role: "", company: "", from: "", to: "اکنون", desc: "" }], edu: [{ degree: "", school: "", from: "", to: "" }],
    skills: [{ name: "", level: "4" }], langs: [{ name: "انگلیسی", level: "3" }], courses: [], interests: "",
  });
  function resumeHtml(d) {
    const e = H.esc, c = d.color || "#2563eb", t = d.tpl || "modern";
    const dots = (n) => `<span class="rz-dots">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Number(n) ? "on" : ""}"></i>`).join("")}</span>`;
    const list = (arr, fn) => (arr || []).filter((x) => Object.values(x).some((v) => String(v || "").trim())).map(fn).join("");
    const contact = [d.phone && `📞 <span dir="ltr">${e(BX.faDigits(d.phone))}</span>`, d.email && `✉️ <span dir="ltr">${e(d.email)}</span>`, d.city && `📍 ${e(d.city)}`, d.link && `🔗 <span dir="ltr">${e(d.link)}</span>`, d.birth && `🎂 ${e(BX.faDigits(d.birth))}`, d.military && `🎖️ ${e(d.military)}`].filter(Boolean);
    const jobs = list(d.jobs, (j) => `<div class="rz-item"><div class="rz-row"><b>${e(j.role)}</b><span>${e(BX.faDigits([j.from, j.to].filter(Boolean).join(" — ")))}</span></div><div class="rz-sub">${e(j.company)}</div>${H.lines(j.desc).length ? `<ul>${H.lines(j.desc).map((l) => `<li>${e(l)}</li>`).join("")}</ul>` : ""}</div>`);
    const edu = list(d.edu, (x) => `<div class="rz-item"><div class="rz-row"><b>${e(x.degree)}</b><span>${e(BX.faDigits([x.from, x.to].filter(Boolean).join(" — ")))}</span></div><div class="rz-sub">${e(x.school)}</div></div>`);
    const skills = list(d.skills, (s) => `<div class="rz-skill"><span>${e(s.name)}</span>${dots(s.level)}</div>`);
    const langs = list(d.langs, (s) => `<div class="rz-skill"><span>${e(s.name)}</span>${dots(s.level)}</div>`);
    const courses = list(d.courses, (x) => `<div class="rz-item"><b>${e(x.title)}</b><div class="rz-sub">${e(BX.faDigits(x.org || ""))}</div></div>`);
    const sec = (title, body) => (body ? `<section class="rz-sec"><h3>${title}</h3>${body}</section>` : "");
    const photo = d.photo ? `<img class="rz-photo" src="${d.photo}" alt="">` : "";
    const head = `<header class="rz-head">${photo}<div><h1>${e(d.name || "نام و نام خانوادگی")}</h1><h2>${e(d.role || "عنوان شغلی")}</h2></div></header>`;
    const side = `${contact.length ? `<section class="rz-sec"><h3>اطلاعات تماس</h3><div class="rz-contact">${contact.map((x) => `<div>${x}</div>`).join("")}</div></section>` : ""}${sec("مهارت‌ها", skills)}${sec("زبان‌ها", langs)}${d.interests ? sec("علایق", `<p>${e(d.interests)}</p>`) : ""}`;
    const main = `${d.summary ? sec("درباره من", `<p>${e(d.summary).replace(/\n/g, "<br>")}</p>`) : ""}${sec("سوابق کاری", jobs)}${sec("تحصیلات", edu)}${sec("دوره‌ها و گواهی‌ها", courses)}`;
    const body = t === "modern" || t === "creative" ? `${head}<div class="rz-cols"><aside class="rz-side">${side}</aside><main class="rz-main">${main}</main></div>` : `${head}<div class="rz-one">${contact.length ? `<div class="rz-contact rz-inline">${contact.map((x) => `<span>${x}</span>`).join("")}</div>` : ""}${main}<div class="rz-cols2">${sec("مهارت‌ها", skills)}${sec("زبان‌ها", langs)}</div>${d.interests ? sec("علایق", `<p>${e(d.interests)}</p>`) : ""}</div>`;
    return `<div class="rz rz--${t}" style="--c:${c}">${body}</div>`;
  }
  const RESUME_CSS = `
    .rz{width:210mm;min-height:297mm;background:#fff;color:#1f2430;font-family:Vazirmatn,Tahoma,sans-serif;font-size:10.5pt;line-height:1.85;direction:rtl;position:relative;overflow:hidden}
    .rz h1{font-size:22pt;font-weight:900;line-height:1.4;margin:0}.rz h2{font-size:12pt;font-weight:600;color:var(--c);margin:0}
    .rz h3{font-size:11.5pt;font-weight:900;color:var(--c);margin:0 0 6px;padding-bottom:4px;border-bottom:2px solid color-mix(in srgb,var(--c) 25%,transparent)}
    .rz p{margin:0}.rz ul{margin:4px 18px 0 0;padding:0}.rz li{margin:0}
    .rz-sec{margin-bottom:14px}.rz-item{margin-bottom:9px}.rz-row{display:flex;justify-content:space-between;gap:8px}.rz-row span{color:#6b7080;font-size:9pt;white-space:nowrap}.rz-sub{color:#555b6b;font-size:9.5pt}
    .rz-skill{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;font-size:9.5pt}
    .rz-dots{display:inline-flex;gap:3px;direction:ltr}.rz-dots i{width:8px;height:8px;border-radius:50%;background:#e2e5ec}.rz-dots i.on{background:var(--c)}
    .rz-contact div{margin-bottom:3px;font-size:9.5pt;word-break:break-word}.rz-inline{display:flex;flex-wrap:wrap;gap:4px 16px;margin-bottom:14px;font-size:9.5pt}
    .rz-photo{width:96px;height:96px;border-radius:50%;object-fit:cover;flex-shrink:0}
    .rz-head{display:flex;align-items:center;gap:18px}
    .rz--modern .rz-head{background:var(--c);color:#fff;padding:26px 30px}.rz--modern .rz-head h2{color:rgba(255,255,255,.85)}.rz--modern .rz-photo{border:4px solid rgba(255,255,255,.6)}
    .rz-cols{display:grid;grid-template-columns:62mm 1fr;min-height:250mm}.rz-side{background:color-mix(in srgb,var(--c) 7%,#fff);padding:22px 20px}.rz-main{padding:22px 26px}
    .rz--classic{padding:20mm 18mm}.rz--classic .rz-head{border-bottom:3px solid var(--c);padding-bottom:14px;margin-bottom:14px}
    .rz--minimal{padding:22mm 20mm}.rz--minimal .rz-head{margin-bottom:10px}.rz--minimal h3{border:0;color:#1f2430;letter-spacing:0;font-size:11pt}.rz--minimal h3::before{content:"";display:inline-block;width:18px;height:3px;background:var(--c);margin-left:8px;vertical-align:middle}
    .rz-cols2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .rz--creative .rz-head{padding:30px 30px 26px;background:linear-gradient(120deg,var(--c),color-mix(in srgb,var(--c) 55%,#000));color:#fff;border-radius:0 0 0 60px}.rz--creative .rz-head h2{color:#fff;opacity:.85}
    .rz--creative .rz-side{background:#fff;border-left:2px dashed color-mix(in srgb,var(--c) 30%,transparent)}.rz--creative h3{border:0;background:color-mix(in srgb,var(--c) 12%,#fff);padding:3px 10px;border-radius:8px;display:inline-block}`;
  STUDIO.register("resume", {
    title: "رزومه‌ساز", render: (v, param) => STUDIO.open(v, "resume", param, resumeDefaults, (data, item) => {
      STUDIO.editor(v, {
        kind: "resume", title: "رزومه‌ساز حرفه‌ای", icon: "file", schema: resumeSchema, data, item, deliverText: "(PDF در اندازه A4)",
        titleOf: (d) => `رزومه ${d.name || ""}`.trim(),
        preview(el, d, paid) {
          el.innerHTML = `<style>${RESUME_CSS}</style><div class="st-paper"><div class="st-scale">${resumeHtml(d)}${paid ? "" : H.watermarkHtml()}</div></div>
            <p class="muted small center mt-1">پیش‌نمایش A4 — فایل نهایی بدون واترمارک است</p>`;
          fitPaper(el);
        },
        exportFile: (d) => H.printHtml(`<style>${RESUME_CSS}</style>${resumeHtml(d)}`, `رزومه ${d.name || ""}`),
      });
    }),
  });
  // Scale an A4 preview to the column width
  function fitPaper(el) {
    const paper = el.querySelector(".st-paper"), inner = el.querySelector(".st-scale");
    if (!paper || !inner) return;
    const fit = () => { const w = paper.clientWidth; const s = w / inner.firstElementChild.offsetWidth; inner.style.transform = `scale(${s})`; paper.style.height = `${inner.firstElementChild.offsetHeight * s}px`; };
    requestAnimationFrame(fit);
    if (!paper._ro) { paper._ro = new ResizeObserver(fit); paper._ro.observe(paper); }
  }
  STUDIO.fitPaper = fitPaper;

  // ================================================================ DOCUMENTS (templates from the panel)
  const fieldsOf = (body) => [...new Set([...String(body).matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]))];
  function docHtml(tpl, vals) {
    return `<div class="dc"><div class="dc-body">${String(tpl.body).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, k) => (vals[k] ? `<b class="dc-v">${H.esc(vals[k]).replace(/\n/g, "<br>")}</b>` : `<span class="dc-blank">${H.esc(k)}</span>`))}</div></div>`;
  }
  const DOC_CSS = `.dc{width:210mm;min-height:297mm;background:#fff;color:#1f2430;font-family:Vazirmatn,Tahoma,sans-serif;font-size:11.5pt;line-height:2.1;padding:22mm 20mm;direction:rtl;position:relative}
    .dc h2{font-size:16pt;margin:0 0 14px}.dc h3{font-size:12pt;margin:14px 0 4px}.dc p{margin:0 0 8px}.dc table{font-size:10.5pt}
    .dc-blank{display:inline-block;min-width:90px;border-bottom:1px dashed #aaa;color:#b0b4bf;font-size:9pt;padding:0 6px}.dc-v{font-weight:700}`;
  STUDIO.register("doc", {
    title: "قرارداد و نامه رسمی",
    async render(v, param) {
      const docs = S.info?.docs || [];
      const pick = (tid) => docs.find((x) => String(x.id) === String(tid));
      const start = (data, item) => {
        const tpl = pick(data.templateId);
        if (!tpl) return chooser();
        const keys = fieldsOf(tpl.body);
        data.values = data.values || {};
        const schema = [{ title: tpl.title, icon: "book", fields: [
          { type: "html", html: `<p class="muted small span-2">${H.esc(tpl.desc || "")} — جاهای خالی را پر کنید؛ متن در پیش‌نمایش جایگزین می‌شود.</p>` },
          ...keys.map((k) => ({ k: `values.${k}`, label: H.esc(k), type: /شرح|متن|توضیح|دلیل/.test(k) ? "textarea" : "text", span: /شرح|متن|توضیح|نشانی|دلیل/.test(k) })),
        ] }];
        STUDIO.editor(v, {
          kind: "doc", route: "doc", title: tpl.title, icon: "book", schema, data, item, price: item ? item.price : tpl.price, deliverText: "(قابل چاپ، PDF و فایل Word)",
          titleOf: () => tpl.title,
          preview(el, d, paid) { el.innerHTML = `<style>${DOC_CSS}</style><div class="st-paper"><div class="st-scale">${docHtml(tpl, d.values || {})}${paid ? "" : H.watermarkHtml()}</div></div>`; fitPaper(el); },
          exportFile(d) {
            const html = docHtml(tpl, d.values || {}).replace(/<span class="dc-blank">[^<]*<\/span>/g, "…………");
            BX.modal({ title: "دریافت فایل", body: `<p class="lh">فرمت مورد نظر را انتخاب کنید:</p>`, actions: [
              { label: "فایل Word (.doc)", onClick: () => H.download(new Blob([`﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Tahoma;direction:rtl}${DOC_CSS.replace(/width:210mm;min-height:297mm;/, "")}</style></head><body dir="rtl">${html}</body></html>`], { type: "application/msword" }), `${tpl.title}.doc`) },
              { label: "چاپ / PDF", primary: true, onClick: () => H.printHtml(`<style>${DOC_CSS}</style>${html}`, tpl.title) },
            ] });
          },
        });
      };
      const chooser = () => {
        const cats = [...new Set(docs.map((d) => d.category || "سایر"))];
        v.innerHTML = `<div class="st-top card"><a class="icon-btn" href="#" aria-label="بازگشت">${BX.icon("arrow-right")}</a><span class="st-top-ic">${BX.icon("book")}</span><div class="grow"><b>قرارداد و نامه رسمی</b><small class="muted d-block">یک قالب انتخاب کنید</small></div></div>
          ${cats.map((c) => `<h3 class="st-h3">${H.esc(c)}</h3><div class="studio-grid">${docs.filter((d) => (d.category || "سایر") === c).map((d) => `
            <button type="button" class="card st-card st-doc" data-doc="${d.id}"><span class="st-card-ic">${BX.icon("file")}</span><h2>${H.esc(d.title)}</h2><p class="muted small lh">${H.esc(d.desc)}</p><span class="badge badge--brand">${H.money(d.price)}</span></button>`).join("")}</div>`).join("") || `<div class="card empty">${BX.icon("book")}<p>قالبی تعریف نشده است.</p></div>`}
          <p class="muted small mt-2">${BX.icon("info")} این متن‌ها نمونه عمومی هستند؛ برای قراردادهای مهم پیش از امضا با مشاور حقوقی مشورت کنید.</p>`;
        v.onclick = (e) => { const b = e.target.closest("[data-doc]"); if (!b) return; v.onclick = null; const draft = STUDIO.loadDraft("doc"); start(draft && String(draft.templateId) === b.dataset.doc ? draft : { templateId: Number(b.dataset.doc), values: {} }, null); };
      };
      if (param) return STUDIO.open(v, "doc", param, () => ({}), (data, item) => (pick(data.templateId) ? start(data, item) : chooser()));
      chooser();
    },
  });

  // ================================================================ BRAND NAMES (free)
  const NAME_BANK = {
    general: { fa: ["نو", "آوا", "ماه", "مهر", "روشن", "پویا", "آرا", "سپهر", "رخ", "تاک", "نیک", "سان", "آسا", "دیبا", "رادین", "کیان"], en: ["Nova", "Zen", "Arya", "Mehr", "Pars", "Sana", "Kia", "Rad", "Vira", "Tara", "Sora", "Lumi"] },
    food: { fa: ["دمنوش", "خوشه", "سفره", "نان", "شیرین", "قهوه", "طعم", "باغ", "دانه", "عطر", "ادویه", "تنور", "کاسه", "شکر"], en: ["Brew", "Bite", "Crumb", "Bean", "Taste", "Oven", "Spice", "Feast", "Sip", "Grain"] },
    beauty: { fa: ["گلبرگ", "ناز", "رز", "آیینه", "مخمل", "شبنم", "بلور", "پرنیان", "ترمه", "نگار", "یاس", "مهتاب"], en: ["Glow", "Bloom", "Silk", "Rose", "Muse", "Velvet", "Luna", "Aura", "Belle", "Pure"] },
    tech: { fa: ["رایان", "پردازش", "کد", "فن", "داده", "شبکه", "هوش", "سامانه", "ابر", "پیکسل", "نوآور", "اندیش"], en: ["Byte", "Logic", "Code", "Pixel", "Data", "Nexa", "Cloud", "Sync", "Volt", "Grid", "Bit", "Core"] },
    fashion: { fa: ["پوش", "جامه", "دوخت", "نخ", "پارچه", "مد", "ترنج", "سبک", "پیراهن", "شال", "حریر", "اطلس"], en: ["Wear", "Thread", "Style", "Chic", "Mode", "Loom", "Stitch", "Tailor", "Vogue", "Weave"] },
    edu: { fa: ["دانش", "آموز", "فرزانه", "اندیشه", "کتاب", "مکتب", "پژوه", "خرد", "دبستان", "روشنا", "آموزه", "ایده"], en: ["Learn", "Mind", "Sage", "Scholar", "Quest", "Skill", "Brain", "Bright", "Path", "Spark"] },
    health: { fa: ["سلامت", "آرامش", "تندرست", "شفا", "زیست", "مهرورز", "نفس", "توان", "جان", "بهی", "سبز", "رویش"], en: ["Vita", "Care", "Heal", "Pulse", "Well", "Fit", "Life", "Zen", "Cure", "Vital"] },
    home: { fa: ["خانه", "سرا", "آشیانه", "کاشانه", "منزل", "دیوار", "پنجره", "چوب", "سنگ", "ستون", "دکور", "فرش"], en: ["Nest", "Home", "Haven", "Casa", "Loft", "Deco", "Stone", "Wood", "Craft", "Abode"] },
  };
  const FA_SUF = ["‌ستان", "‌زار", "کده", "یار", "سرا", "انه", "‌نو", "‌پلاس", "‌آنلاین", "ینو", "ک", "‌شاپ"];
  const FA_PRE = ["نو", "هم", "پیش", "آی", "دی", "ای"];
  const EN_SUF = ["ify", "ly", "io", "hub", "lab", "nest", "go", "co", "ora", "ix", "a", "o", "zy", "verse"];
  function makeNames(industry, keys, style) {
    const b = NAME_BANK[industry] || NAME_BANK.general, g = NAME_BANK.general;
    const fa = [...new Set([...keys.filter((k) => /[؀-ۿ]/.test(k)), ...b.fa, ...g.fa.slice(0, 6)])];
    const en = [...new Set([...keys.filter((k) => /^[a-z]/i.test(k)).map((k) => k[0].toUpperCase() + k.slice(1).toLowerCase()), ...b.en, ...g.en.slice(0, 5)])];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const out = new Set();
    for (let i = 0; out.size < 60 && i < 600; i++) {
      const r = Math.random();
      if (style !== "en") {
        if (r < 0.25) out.add(pick(fa) + pick(FA_SUF));
        else if (r < 0.45) out.add(pick(FA_PRE) + pick(fa));
        else if (r < 0.65) out.add(`${pick(fa)} ${pick(b.fa)}`);
        else if (style === "fa" && r < 1) out.add(pick(fa) + pick(["‌ها", "ی", "ستان", "انه"]));
      }
      if (style !== "fa" && r >= 0.45) {
        const w = pick(en);
        if (r < 0.7) out.add(w + pick(EN_SUF));
        else if (r < 0.85) out.add(w + pick(en));
        else out.add(w.slice(0, Math.max(3, Math.ceil(w.length * 0.7))) + pick(["a", "o", "i", "x", "y"]));
      }
    }
    return [...out].filter((n) => n.length >= 3 && n.length <= 18).slice(0, 48);
  }
  STUDIO.register("names", {
    title: "ایده نام برند",
    render(v) {
      v.innerHTML = `<div class="st-top card"><a class="icon-btn" href="#" aria-label="بازگشت">${BX.icon("arrow-right")}</a><span class="st-top-ic">${BX.icon("sparkles")}</span><div class="grow"><b>ایده نام برند</b><small class="muted d-block">رایگان — هر بار نتیجه جدید</small></div></div>
        <form class="card st-names-f" data-names>
          <div class="field"><label class="field-label">حوزه کاری</label><select class="select" name="ind">${[["general", "عمومی"], ["food", "کافه، رستوران، غذا"], ["beauty", "زیبایی و آرایشی"], ["tech", "فناوری و نرم‌افزار"], ["fashion", "پوشاک و مد"], ["edu", "آموزش"], ["health", "سلامت و ورزش"], ["home", "خانه و دکوراسیون"]].map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
          <div class="field"><label class="field-label">کلمه‌های دلخواه (اختیاری)</label><input class="input" name="keys" placeholder="مثلاً: مهر، Nova، سبز"></div>
          <div class="field"><label class="field-label">زبان نام</label><select class="select" name="style"><option value="mix">فارسی و انگلیسی</option><option value="fa">فقط فارسی</option><option value="en">فقط انگلیسی</option></select></div>
          <button class="btn btn-primary" type="submit">${BX.icon("sparkles")} ساخت ایده‌ها</button>
        </form>
        <div class="st-names" data-out></div>`;
      const f = v.querySelector("[data-names]");
      const out = v.querySelector("[data-out]");
      f.onsubmit = (e) => {
        e.preventDefault();
        const names = makeNames(f.ind.value, f.keys.value.split(/[،,\s]+/).filter(Boolean), f.style.value);
        out.innerHTML = names.map((n, i) => `<div class="st-name card" style="--d:${i * 25}ms"><b style="font-family:${/^[a-z]/i.test(n) ? "ui-sans-serif,system-ui" : "inherit"};color:hsl(${(i * 47) % 360} 75% 55%)">${H.esc(n)}</b>
          <div class="row"><button type="button" class="btn btn-ghost btn-xs" data-copy="${H.esc(n)}">${BX.icon("link")} کپی</button>${/^[a-z]/i.test(n) ? `<a class="btn btn-ghost btn-xs" target="_blank" rel="noopener" href="https://www.whois.com/whois/${encodeURIComponent(n.toLowerCase())}.ir">دامنه .ir</a>` : ""}<a class="btn btn-ghost btn-xs" href="order.html?service=logo">لوگو</a></div></div>`).join("")
          + `<div class="cta glow" style="grid-column:1/-1"><h2 class="h2-sm">نام را پیدا کردید؟</h2><p class="muted lh">لوگو و هویت بصری حرفه‌ای همین نام را به طراحان بهیکس بسپارید.</p><div class="cta-actions"><a class="btn btn-primary" href="order.html?service=logo">سفارش لوگو ${BX.icon("arrow")}</a></div></div>`;
      };
      out.onclick = (e) => { const c = e.target.closest("[data-copy]"); if (c) navigator.clipboard?.writeText(c.dataset.copy).then(() => BX.toast("کپی شد.", "ok")); };
      f.requestSubmit();
    },
  });

  // ================================================================ SEO AUDIT (free)
  STUDIO.register("seo", {
    title: "بررسی سئوی سایت",
    render(v) {
      v.innerHTML = `<div class="st-top card"><a class="icon-btn" href="#" aria-label="بازگشت">${BX.icon("arrow-right")}</a><span class="st-top-ic">${BX.icon("search")}</span><div class="grow"><b>بررسی سئوی سایت</b><small class="muted d-block">رایگان — ۱۸ مورد کلیدی سئو و سرعت</small></div></div>
        <form class="card st-seo-f" data-seo><input class="input" name="url" dir="ltr" placeholder="example.com" required><button class="btn btn-primary" type="submit">${BX.icon("search")} بررسی کن</button></form>
        <div data-out></div>`;
      const f = v.querySelector("[data-seo]"), out = v.querySelector("[data-out]");
      f.onsubmit = async (e) => {
        e.preventDefault();
        out.innerHTML = `<div class="card st-loading">${BX.icon("loader")} در حال بررسی سایت… (تا ۲۰ ثانیه)</div>`;
        try {
          const r = await BX.api("studio.seo", { url: f.url.value });
          const tone = r.score >= 80 ? "ok" : r.score >= 55 ? "warn" : "bad";
          out.innerHTML = `<div class="st-seo">
            <div class="card st-score st-score--${tone}"><div class="st-gauge" style="--p:${r.score}"><b>${H.fa(r.score)}</b><small>از ۱۰۰</small></div>
              <div><h2 class="h2-xs">${r.score >= 80 ? "عالی! سایت شما وضعیت خوبی دارد" : r.score >= 55 ? "قابل قبول؛ چند مورد مهم را اصلاح کنید" : "سایت شما به بهینه‌سازی جدی نیاز دارد"}</h2>
              <p class="muted small" dir="ltr" style="text-align:right">${H.esc(r.url)}</p>${r.title ? `<p class="small mt-1"><b>عنوان:</b> ${H.esc(r.title)}</p>` : ""}<p class="small"><b>زمان پاسخ:</b> ${H.fa(r.time)} ثانیه</p></div></div>
            <div class="card st-checks">${r.checks.map((c) => `<div class="st-check ${c.ok ? "ok" : "bad"}">${BX.icon(c.ok ? "check-circle" : "x-circle")}<div><b>${H.esc(c.label)}</b>${c.ok ? "" : `<p class="muted small">${H.esc(c.tip)}</p>`}</div></div>`).join("")}</div>
            <div class="cta glow"><h2 class="h2-sm">اصلاح همه موارد را به ما بسپارید</h2><p class="muted lh">سئوی فنی، محتوای سئوشده و افزایش سرعت سایت با گزارش ماهانه.</p><div class="cta-actions"><a class="btn btn-primary" href="service.html?id=seo">خدمات سئو ${BX.icon("arrow")}</a><a class="btn btn-ghost" href="index.html#support">مشاوره رایگان</a></div></div>
          </div>`;
        } catch (err) { out.innerHTML = `<div class="card empty">${BX.icon("info")}<p>${H.esc(err.message)}</p></div>`; }
      };
    },
  });
})();
