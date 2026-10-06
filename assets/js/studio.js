/* ==========================================================================
   BEHIX — Studio: self-service builders. The forms run here; every preview
   image and final file is drawn on the server (watermarked, low-resolution
   previews; the clean file only after purchase or an X PRO allowance).
   This file: router, hub, form engine, save/buy/download flow, resume,
   documents, brand names and the SEO audit. Other builders register through
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

  // ---------------------------------------------------------------- save / buy / download
  const draftKey = (kind) => `behix:studio:${kind}`;
  STUDIO.saveDraft = (kind, data) => { try { localStorage.setItem(draftKey(kind), JSON.stringify(data)); } catch (e) { /* storage full */ } };
  STUDIO.loadDraft = (kind) => { try { return JSON.parse(localStorage.getItem(draftKey(kind)) || "null"); } catch (e) { return null; } };
  const proName = () => BX.settings.pro?.name || "X PRO";
  const isPro = () => !!BX.me && (BX.me.pro || BX.me.role === "admin");
  function needLogin(kind) {
    BX.modal({
      title: "ورود برای ذخیره و دریافت فایل",
      body: `<p class="lh">طرح شما روی همین دستگاه ذخیره شد. برای دریافت فایل نهایی وارد شوید (فقط با شماره موبایل)؛ بعد از ورود دوباره به همین صفحه برمی‌گردید.</p>`,
      actions: [{ label: "بعداً" }, { label: "ورود / ثبت‌نام", primary: true, onClick: () => { location.href = `auth.html?next=${encodeURIComponent(`studio.html#${kind}`)}`; } }],
    });
  }
  // Final files come only from the server, after the purchase check
  STUDIO.fetchFile = async function (route, body) {
    const res = await fetch(`api/index.php?r=${route}`, { method: "POST", credentials: "same-origin", headers: { "X-CSRF": BX.csrf(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const type = res.headers.get("Content-Type") || "";
    if (!res.ok || type.includes("application/json")) {
      let j = null; try { j = await res.json(); } catch (e) { /* not json */ }
      const err = new Error(j?.message || "دریافت فایل ناموفق بود؛ دوباره تلاش کنید.");
      err.code = j?.error; throw err;
    }
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i);
    H.download(await res.blob(), m ? decodeURIComponent(m[1]) : "behix-file");
  };
  // Live preview: the server returns low-resolution watermarked images only
  STUDIO.preview = function (el, kind, layout) {
    let seq = 0, ctl = null;
    const wrap = { card: "st-prev st-prev--card", post: "st-prev st-prev--post", slides: "st-prev st-prev--slides", pages: "st-prev st-prev--pages" }[layout] || "st-prev";
    el.innerHTML = `<div class="${wrap}"><div class="st-prev-imgs" data-imgs><div class="st-prev-ph skeleton"></div></div><div class="st-prev-busy" data-busy hidden>${BX.icon("loader")}</div></div>
      <p class="muted small center mt-1" data-note>${BX.icon("shield")} پیش‌نمایش کم‌کیفیت و واترمارک‌دار؛ فایل نهایی روی سرور و بعد از خرید ساخته می‌شود.</p>`;
    const imgs = el.querySelector("[data-imgs]"), busy = el.querySelector("[data-busy]");
    return async (data) => {
      const my = ++seq;
      ctl?.abort(); ctl = new AbortController();
      busy.hidden = false;
      try {
        const res = await fetch("api/index.php?r=studio.preview", { method: "POST", credentials: "same-origin", signal: ctl.signal, headers: { "X-CSRF": BX.csrf(), "Content-Type": "application/json" }, body: JSON.stringify({ kind, data }) });
        const j = await res.json();
        if (my !== seq) return;
        if (!res.ok || j.error) throw new Error(j.message || "پیش‌نمایش ساخته نشد.");
        const labels = layout === "card" ? ["رو", "پشت"] : null;
        imgs.innerHTML = j.pages.map((src, i) => `<figure>${labels ? `<figcaption>${labels[i] || ""}</figcaption>` : layout === "slides" ? `<figcaption>${H.fa(i + 1)}</figcaption>` : ""}<img src="${src}" alt="پیش‌نمایش" draggable="false"></figure>`).join("")
          + (j.total > j.pages.length ? `<p class="muted small center">${H.fa(j.total - j.pages.length)} صفحه دیگر در فایل نهایی</p>` : "");
      } catch (e) {
        if (e.name !== "AbortError" && my === seq) imgs.innerHTML = `<div class="card empty">${BX.icon("info")}<p>${H.esc(e.message)}</p></div>`;
      } finally { if (my === seq) busy.hidden = true; }
    };
  };
  // Shared editor shell for file builders (resume, doc, card, post, slides)
  STUDIO.editor = function (view, cfg) {
    const { kind, schema } = cfg;
    let item = cfg.item || null; // {id, paid, title}
    let price = cfg.price ?? (S.info?.prices?.[kind] || 0);
    const data = cfg.data;
    const savedJson = JSON.stringify(data);
    view.innerHTML = `
      <div class="st-top card">
        <a class="icon-btn" href="#" aria-label="بازگشت به استودیو">${BX.icon("arrow-right")}</a>
        <span class="st-top-ic">${BX.icon(cfg.icon || "sparkles")}</span>
        <div class="grow"><b>${H.esc(cfg.title)}</b><small class="muted d-block" data-st-status></small></div>
        <button type="button" class="btn btn-ghost btn-sm" data-st="save">${BX.icon("check")}<span class="hide-sm"> ذخیره</span></button>
        <button type="button" class="btn btn-primary btn-sm" data-st="get"></button>
      </div>
      <div class="st-lock card" data-lock hidden></div>
      <div class="st-edit ${cfg.wide ? "is-wide" : ""}">
        <div class="st-form card" data-st-form>${cfg.smart ? `<div class="st-smart" data-smart></div>` : ""}<div data-fields>${STUDIO.form.render(schema, data)}</div></div>
        <div class="st-preview" data-st-preview></div>
      </div>`;
    const formEl = view.querySelector("[data-fields]");
    const paint = STUDIO.preview(view.querySelector("[data-st-preview]"), kind, cfg.layout || "pages");
    const paintSoon = H.debounce(() => paint(data), kind === "slides" ? 800 : 450);
    const autosave = H.debounce(() => STUDIO.saveDraft(kind, data), 600);
    const status = () => {
      view.querySelector("[data-st-status]").textContent = item?.paid ? (item.via === "pro" ? `دریافت‌شده با ${proName()} — دانلود نامحدود` : "خریداری شده — دانلود نامحدود") : `پیش‌نمایش رایگان · فایل نهایی ${H.money(price)}${isPro() ? ` یا رایگان با ${proName()}` : ""}`;
      view.querySelector('[data-st="get"]').innerHTML = item?.paid ? `${BX.icon("download")} دانلود` : `${BX.icon("download")} دریافت<span class="hide-sm"> فایل نهایی</span>`;
    };
    // a bought design is locked for non-members (they can save a new copy)
    const lock = () => {
      const box = view.querySelector("[data-lock]");
      const locked = item?.paid && !isPro() && JSON.stringify(data) !== savedJson;
      box.hidden = !locked;
      if (locked) box.innerHTML = `${BX.icon("lock")}<div class="grow"><b>این طرح خریداری شده است</b><p class="muted small">تغییرات روی فایل خریداری‌شده ذخیره نمی‌شود. با اشتراک ${proName()} طرح‌هایتان را هر وقت خواستید ویرایش کنید، یا از همین طرح یک نسخه جدید بسازید.</p></div>
        <button class="btn btn-ghost btn-sm" data-st="copy">نسخه جدید</button><a class="btn btn-primary btn-sm" href="dashboard.html#pro">${BX.icon("star")} ${proName()}</a>`;
    };
    const onChange = (d, structural) => { structural ? paint(data) : paintSoon(); autosave(); lock(); };
    STUDIO.form.bind(formEl, schema, data, onChange);
    cfg.smart?.(view.querySelector("[data-smart]"), data, () => { formEl.innerHTML = STUDIO.form.render(schema, data); onChange(data, true); });
    status();
    paint(data);
    async function save(quiet) {
      if (!BX.me) { STUDIO.saveDraft(kind, data); needLogin(cfg.route || kind); return null; }
      const r = await BX.api("a.studio.save", { id: item?.id || 0, kind, title: (cfg.titleOf ? cfg.titleOf(data) : "") || cfg.title, data });
      item = r.item; price = r.price;
      if (location.hash.split("/")[1] !== String(item.id)) history.replaceState(null, "", `#${cfg.route || kind}/${item.id}`);
      if (!quiet) BX.toast("طرح ذخیره شد؛ از پنل «ساخته‌های من» هم در دسترس است.", "ok");
      status();
      return item;
    }
    async function copy() {
      try {
        const it = await save(true).catch((e) => { if (e.code !== "pro_edit") throw e; return null; });
        const r = await BX.api("a.studio.copy", { id: item.id });
        item = { id: r.id, paid: false };
        await save(true);
        BX.toast("نسخه جدید ساخته شد؛ تغییرات شما روی این نسخه ذخیره می‌شود.", "ok");
        lock();
        return it;
      } catch (e) { BX.toast(e.message, "bad"); }
    }
    function formats() {
      const f = S.info?.formats?.[kind] || {};
      const keys = Object.keys(f);
      if (keys.length === 1) return download(keys[0]);
      BX.modal({
        title: "دریافت فایل نهایی",
        body: `<div class="st-fmts">${keys.map((k, i) => `<button type="button" class="st-fmt ${i ? "" : "is-main"}" data-fmt="${k}"><b>${k.toUpperCase()}</b><span>${H.esc(f[k])}</span></button>`).join("")}</div>`,
        actions: [{ label: "بستن" }],
        onOpen: (m) => m.addEventListener("click", (e) => { const b = e.target.closest("[data-fmt]"); if (b) download(b.dataset.fmt, b); }),
      });
    }
    async function download(fmt, btn) {
      btn?.classList.add("is-busy");
      BX.toast("فایل روی سرور ساخته می‌شود…", "info");
      try { await STUDIO.fetchFile("a.studio.export", { id: item.id, format: fmt }); BX.toast("فایل دانلود شد.", "ok"); }
      catch (e) { BX.toast(e.message, "bad"); }
      finally { btn?.classList.remove("is-busy"); }
    }
    async function get() {
      try {
        if (item?.paid && !isPro() && JSON.stringify(data) !== savedJson) {
          return BX.modal({ title: "طرح تغییر کرده است", body: `<p class="lh">فایل خریداری‌شده همان نسخه ذخیره‌شده است. برای دریافت نسخه تغییرکرده یک نسخه جدید بسازید یا با ${proName()} طرح را ویرایش کنید.</p>`,
            actions: [{ label: "دانلود نسخه خریداری‌شده", onClick: () => { formats(); } }, { label: "ساخت نسخه جدید", primary: true, onClick: () => { copy(); } }] });
        }
        const it = await save(true);
        if (!it) return;
        if (it.paid) return formats();
        const wallet = BX.me?.wallet || 0;
        if (isPro()) {
          return BX.modal({
            title: `دریافت با اشتراک ${proName()}`,
            body: `<div class="st-buy"><p class="lh">این فایل از سهمیه ماهانه اشتراک شما کم می‌شود و همیشه از «ساخته‌های من» قابل دانلود و ویرایش است.</p></div>`,
            actions: [{ label: "انصراف" }, { label: "دریافت فایل", primary: true, onClick: () => { item.paid = true; item.via = "pro"; status(); formats(); } }],
          });
        }
        BX.modal({
          title: "دریافت فایل نهایی",
          body: `<div class="st-buy"><p class="lh">فایل بدون واترمارک و با کیفیت چاپ ${cfg.deliverText || ""} روی سرور ساخته می‌شود و همیشه از پنل «ساخته‌های من» قابل دانلود است.</p>
            <div class="st-buy-price"><span>مبلغ</span><b>${H.money(price)}</b></div>
            ${price && wallet ? `<p class="muted small">موجودی کیف پول: ${BX.toman(wallet)}${wallet >= price ? " — از کیف پول کسر می‌شود." : " — مابقی از درگاه پرداخت می‌شود."}</p>` : ""}
            <a class="st-upsell" href="dashboard.html#pro">${BX.icon("star")}<span><b>${proName()}</b> — ماهی ${H.money(S.pro?.plans?.[0]?.price || 0)}: ${H.fa(S.pro?.studioFiles || 15)} فایل در ماه + ویرایش نامحدود طرح‌ها + کارت ویزیت دیجیتال</span></a></div>`,
          actions: [{ label: "انصراف" }, { label: price ? "پرداخت و دریافت" : "دریافت رایگان", primary: true, onClick: () => {
            BX.api("a.studio.buy", { id: it.id }).then((r) => {
              if (r.redirect) { STUDIO.saveDraft(kind, data); location.href = r.redirect; return; }
              item.paid = true;
              if (r.paidFromWallet && BX.me) BX.me.wallet = Math.max(0, (BX.me.wallet || 0) - r.paidFromWallet);
              status();
              BX.toast("پرداخت شد؛ قالب فایل را انتخاب کنید.", "ok");
              formats();
            }).catch((e) => BX.toast(e.message, "bad"));
          } }],
        });
      } catch (e) {
        if (e.code === "pro_edit") return lock();
        BX.toast(e.message, "bad");
      }
    }
    view.querySelector('[data-st="save"]').onclick = () => save(false).catch((e) => { if (e.code === "pro_edit") { lock(); BX.toast(e.message, "info"); } else BX.toast(e.message, "bad"); });
    view.querySelector('[data-st="get"]').onclick = get;
    view.addEventListener("click", (e) => { if (e.target.closest('[data-st="copy"]')) copy(); });
    return { paint: () => paint(data), data, save };
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
  // Smart-suggestion chips: [[label, fn], …]
  STUDIO.chips = (title, list) => `<div class="st-chips"><span>${BX.icon("sparkles")} ${title}</span>${list.map(([l], i) => `<button type="button" class="st-chip" data-chip="${i}">${H.esc(l)}</button>`).join("")}</div>`;
  STUDIO.bindChips = (el, list, after) => el.addEventListener("click", (e) => { const b = e.target.closest("[data-chip]"); if (!b || !el.contains(b)) return; list[Number(b.dataset.chip)][1](); after(); b.classList.add("is-used"); });

  // ---------------------------------------------------------------- hub
  const CARDS = [
    ["resume", "رزومه‌ساز حرفه‌ای", "file", "۸ قالب حرفه‌ای با عکس + دستیار نوشتن رزومه؛ خروجی PDF وکتور آماده ارسال", "resume", 210],
    ["card", "کارت ویزیت چاپی", "layout", "۱۲ قالب لوکس پشت و رو با لوگو و QR؛ PDF چاپی ۹×۵ و PNG با کیفیت ۳۰۰dpi", "card", 25],
    ["post", "پست، استوری و پوستر", "image", "۱۲ قالب + مناسبت‌های آماده (نوروز، یلدا، …) و کپشن و هشتگ پیشنهادی", "post", 330],
    ["doc", "قرارداد و نامه رسمی", "book", "قرارداد، رسید، نامه اداری، فاکتور و … — تاریخ و مبلغ به حروف خودکار؛ خروجی PDF و Word", "doc", 160],
    ["slides", "پاورپوینت‌ساز", "presentation", "۸ پوسته + ساخت خودکار ساختار ارائه؛ فایل .pptx راست‌به‌چپ و قابل ویرایش", "slides", 280],
    ["page-card", "کارت ویزیت دیجیتال", "user", "صفحه شخصی با لینک‌ها، دکمه تماس و ذخیره مخاطب + QR؛ اشتراک ماهانه یا سالانه", "pageCard", 40],
    ["page-menu", "منوی QR کافه و رستوران", "list", "منوی آنلاین با دسته‌بندی، قیمت و عکس؛ تغییر قیمت در هر لحظه + کارت QR میز", "pageMenu", 15],
    ["names", "ایده نام برند", "sparkles", "ده‌ها نام فارسی و انگلیسی با امتیاز خوش‌آوایی — چند بار در هفته رایگان", "free", 190],
    ["seo", "بررسی سئوی سایت", "search", "۱۸ مورد مهم سئو و سرعت سایت در چند ثانیه — چند بار در هفته رایگان", "free", 140],
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
    BX.api("pro.info").then((r) => { S.pro = r; }).catch(() => {});
    if (S.info.enabled === false && BX.me?.role !== "admin") { view().innerHTML = `<div class="card empty">${BX.icon("info")}<p>استودیو فعلاً غیرفعال است.</p></div>`; return; }
    window.addEventListener("hashchange", route);
    route();
  });

  // ================================================================ RESUME
  const RESUME_TPL = [["modern", "مدرن دوستونه", "#2563eb"], ["executive", "مدیریتی تیره", "#4c1d95"], ["creative", "خلاق", "#ff7a1a"], ["timeline", "خط زمانی", "#0891b2"],
    ["classic", "کلاسیک", "#1e293b"], ["minimal", "مینیمال", "#0f766e"], ["elegant", "کلاسیک شیک", "#b45309"], ["bold", "جسور", "#e11d48"]];
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
  // Phrase bank by field: summary, achievement lines and skills (no AI service needed)
  const CAREERS = {
    design: { t: "طراحی و گرافیک", sum: ["طراح گرافیک با {n} سال تجربه در هویت بصری، تبلیغات و شبکه‌های اجتماعی؛ دقیق، خلاق و مسلط به اصول تایپوگرافی و رنگ.", "طراح محصول دیجیتال با تمرکز بر تجربه کاربری، تحقیق کاربر و ساخت سیستم طراحی برای محصولات در حال رشد."],
      jobs: ["طراحی هویت بصری کامل برای ۱۰+ برند", "طراحی محتوای ماهانه اینستاگرام و افزایش تعامل صفحه", "همکاری نزدیک با تیم بازاریابی برای کمپین‌های فصلی", "آماده‌سازی فایل‌های چاپی و نظارت بر چاپ", "ساخت کتابچه راهنمای برند (Brand Guideline)"],
      skills: ["Adobe Photoshop", "Adobe Illustrator", "Figma", "تایپوگرافی", "هویت بصری", "طراحی تجربه کاربری", "موشن گرافیک"] },
    dev: { t: "برنامه‌نویسی و IT", sum: ["برنامه‌نویس با {n} سال تجربه در توسعه وب؛ علاقه‌مند به کد تمیز، تست‌پذیر و کار تیمی.", "توسعه‌دهنده فول‌استک با تجربه پیاده‌سازی سامانه‌های فروشگاهی و پنل‌های مدیریتی پرترافیک."],
      jobs: ["توسعه و نگهداری سامانه با بیش از ۵۰ هزار کاربر", "بهبود سرعت بارگذاری صفحات تا ۴۰٪", "پیاده‌سازی درگاه پرداخت و پنل مدیریت", "نوشتن تست خودکار و راه‌اندازی CI/CD", "مستندسازی API و آموزش اعضای جدید تیم"],
      skills: ["JavaScript", "PHP", "Python", "React", "MySQL", "Git", "Docker", "REST API"] },
    marketing: { t: "بازاریابی و فروش", sum: ["کارشناس بازاریابی دیجیتال با {n} سال تجربه در تولید محتوا، تبلیغات آنلاین و تحلیل داده؛ نتیجه‌محور و خلاق.", "کارشناس فروش با سابقه موفق در جذب مشتری جدید، مذاکره و تحقق اهداف فروش ماهانه."],
      jobs: ["افزایش ۳ برابری فالوور و تعامل صفحه اینستاگرام", "مدیریت کمپین‌های تبلیغاتی با بازگشت سرمایه مثبت", "تحقق ۱۲۰٪ هدف فروش فصلی", "راه‌اندازی ایمیل مارکتینگ و باشگاه مشتریان", "تحلیل رقبا و تهیه گزارش ماهانه بازار"],
      skills: ["سئو", "تولید محتوا", "تبلیغات گوگل", "اینستاگرام مارکتینگ", "Google Analytics", "مذاکره", "CRM"] },
    office: { t: "اداری، مالی و حسابداری", sum: ["کارشناس اداری و مالی با {n} سال تجربه، مسلط به نرم‌افزارهای حسابداری و مجموعه آفیس؛ منظم و دقیق.", "حسابدار با تجربه ثبت اسناد، تهیه صورت‌های مالی و امور مالیاتی و بیمه."],
      jobs: ["ثبت و کنترل اسناد مالی روزانه", "تهیه گزارش‌های ماهانه مدیریتی در اکسل", "پیگیری امور بیمه و مالیات", "مدیریت مکاتبات و بایگانی اسناد", "کاهش خطای ثبت با طراحی فرم‌های استاندارد"],
      skills: ["Excel پیشرفته", "Word", "PowerPoint", "نرم‌افزار سپیدار", "حسابداری", "گزارش‌نویسی", "تایپ سریع"] },
    teach: { t: "آموزش", sum: ["مدرس با {n} سال تجربه تدریس حضوری و آنلاین؛ صبور، خلاق و علاقه‌مند به روش‌های نوین آموزشی.", "معلم با سابقه موفق در بهبود نتایج تحصیلی و ایجاد کلاس‌های تعاملی."],
      jobs: ["تدریس به بیش از ۳۰۰ دانش‌آموز", "طراحی محتوای آموزشی و آزمون‌های دوره‌ای", "برگزاری کلاس‌های آنلاین تعاملی", "افزایش میانگین نمرات کلاس", "مشاوره تحصیلی به دانش‌آموزان و والدین"],
      skills: ["طراحی آموزشی", "مدیریت کلاس", "آموزش آنلاین", "ارتباط مؤثر", "PowerPoint", "ارزشیابی"] },
    health: { t: "سلامت و درمان", sum: ["پرستار با {n} سال تجربه در بخش‌های ویژه، متعهد به ایمنی بیمار و کار تیمی.", "کارشناس سلامت با تجربه در آموزش بیمار و پیگیری درمان."],
      jobs: ["مراقبت از بیماران بخش ویژه", "آموزش بیمار و خانواده هنگام ترخیص", "ثبت دقیق پرونده و داروها", "همکاری در تیم احیا", "آموزش نیروهای جدید بخش"],
      skills: ["مراقبت ویژه", "احیای قلبی ریوی", "ثبت پرونده", "آموزش بیمار", "کار تیمی", "مدیریت استرس"] },
    eng: { t: "فنی و مهندسی", sum: ["مهندس با {n} سال تجربه در طراحی، اجرا و کنترل پروژه؛ مسلط به نرم‌افزارهای تخصصی و استانداردهای ایمنی.", "کارشناس فنی با تجربه نگهداری و تعمیرات و بهبود فرآیندهای تولید."],
      jobs: ["مدیریت اجرای پروژه در زمان و بودجه مصوب", "کاهش ۱۵٪ هزینه‌های تولید", "تهیه نقشه‌های اجرایی و مستندات فنی", "نظارت بر کیفیت و ایمنی کارگاه", "هماهنگی با پیمانکاران و تأمین‌کنندگان"],
      skills: ["AutoCAD", "SolidWorks", "MSP", "کنترل پروژه", "ایمنی کار", "Excel"] },
    service: { t: "خدمات و پشتیبانی مشتری", sum: ["کارشناس پشتیبانی با {n} سال تجربه، خوش‌برخورد و مسلط به حل مسئله و پیگیری درخواست‌ها.", "مسئول خدمات مشتری با تمرکز بر رضایت و وفاداری مشتریان."],
      jobs: ["پاسخ‌گویی روزانه به بیش از ۸۰ تماس و پیام", "کاهش زمان پاسخ‌گویی به نصف", "ثبت و پیگیری درخواست‌ها در CRM", "افزایش رضایت مشتری در نظرسنجی‌ها", "تهیه پاسخ‌های آماده برای سؤالات پرتکرار"],
      skills: ["ارتباط مؤثر", "حل مسئله", "CRM", "مدیریت زمان", "تایپ سریع", "کار با تیکت"] },
  };
  function resumeSmart(el, d, refresh) {
    const draw = () => {
      const c = CAREERS[el.dataset.car || "design"];
      const years = Math.max(1, (d.jobs || []).length * 2);
      const sums = c.sum.map((x) => [`درباره من: ${x.slice(0, 26)}…`, () => { d.summary = x.replace("{n}", H.fa(years)); }]);
      const lines = c.jobs.map((x) => [x, () => { const j = (d.jobs ||= [{ role: "", company: "", from: "", to: "", desc: "" }])[0]; j.desc = [j.desc, x].filter(Boolean).join("\n"); }]);
      const skills = c.skills.map((x) => [x, () => { d.skills = (d.skills || []).filter((s) => s.name); if (!d.skills.some((s) => s.name === x)) d.skills.push({ name: x, level: "4" }); }]);
      el.innerHTML = `<div class="st-smart-head">${BX.icon("sparkles")}<b>دستیار رزومه</b><select class="select select-sm" data-car>${Object.entries(CAREERS).map(([k, v]) => `<option value="${k}" ${k === (el.dataset.car || "design") ? "selected" : ""}>${v.t}</option>`).join("")}</select></div>
        ${STUDIO.chips("متن آماده درباره من", sums)}${STUDIO.chips("دستاورد برای سابقه اول", lines)}${STUDIO.chips("مهارت پیشنهادی", skills)}`;
      el.querySelectorAll(".st-chips").forEach((box, i) => STUDIO.bindChips(box, [sums, lines, skills][i], refresh));
      el.querySelector("[data-car]").onchange = (e) => { el.dataset.car = e.target.value; draw(); };
    };
    draw();
  }
  STUDIO.register("resume", {
    title: "رزومه‌ساز", render: (v, param) => STUDIO.open(v, "resume", param, resumeDefaults, (data, item) => {
      STUDIO.editor(v, {
        kind: "resume", title: "رزومه‌ساز حرفه‌ای", icon: "file", schema: resumeSchema, data, item, deliverText: "(PDF وکتور A4 با متن قابل انتخاب)",
        titleOf: (d) => `رزومه ${d.name || ""}`.trim(), layout: "pages", smart: resumeSmart,
      });
    }),
  });

  // ================================================================ DOCUMENTS (templates from the panel)
  const fieldsOf = (body) => [...new Set([...String(body).matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]))];
  // Number → Persian words (for «مبلغ به حروف»)
  const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"], TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
  const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"], HUNDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  const SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];
  const three = (n) => { const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10, p = []; if (h) p.push(HUNDS[h]); if (t === 1) p.push(TEENS[o]); else { if (t) p.push(TENS[t]); if (o) p.push(ONES[o]); } return p.join(" و "); };
  STUDIO.words = (str) => {
    let s = BX.enDigits(String(str || "")).replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    if (!s) return ""; if (/^0+$/.test(s)) return "صفر";
    const g = []; while (s.length) { g.unshift(Number(s.slice(-3))); s = s.slice(0, -3); }
    if (g.length > SCALES.length) return "";
    return g.map((x, i) => { const sc = SCALES[g.length - 1 - i]; if (!x) return ""; if (x === 1 && sc === "هزار") return "هزار"; return `${three(x)}${sc ? ` ${sc}` : ""}`; }).filter(Boolean).join(" و ");
  };
  const today = () => new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const groupNum = (v) => { const n = BX.enDigits(String(v)).replace(/[^\d]/g, ""); return n ? H.fa(Number(n).toLocaleString("en-US")) : v; };
  // Auto-fill: dates → today, «… به حروف» ← the amount field next to it, amounts get separators
  function docAuto(keys, vals, changed) {
    const amountKeys = keys.filter((k) => /مبلغ|جمع|قیمت|حقوق/.test(k) && !/حروف/.test(k));
    if (changed && amountKeys.includes(changed)) vals[changed] = groupNum(vals[changed]);
    // invoices: total = sum of the numbered row amounts
    const rows = keys.filter((k) => /^مبلغ\s*[۰-۹\d]+$/.test(k));
    const tot = keys.find((k) => /جمع کل/.test(k) && !/حروف/.test(k));
    if (rows.length && tot) { const sum = rows.reduce((a, k) => a + Number(BX.enDigits(String(vals[k] || "")).replace(/[^\d]/g, "") || 0), 0); if (sum) vals[tot] = groupNum(sum); }
    for (const k of keys) {
      if (/تاریخ/.test(k) && !/اعتبار|تولد|شروع|پایان|تحویل|رویداد|مهلت|خرید/.test(k) && !vals[k]) vals[k] = today();
      if (/به حروف/.test(k)) {
        const src = /جمع/.test(k) ? amountKeys.find((a) => /جمع/.test(a)) : amountKeys.find((a) => !/[۰-۹\d]$/.test(a)) || amountKeys[0];
        if (src && vals[src]) { const w = STUDIO.words(vals[src]); if (w) vals[k] = `${w} ${/تومان/.test(src + k) ? "تومان" : ""}`.trim(); }
      }
    }
  }
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
        docAuto(keys, data.values, null);
        const schema = [{ title: tpl.title, icon: "book", fields: [
          { type: "html", html: `<p class="muted small span-2">${H.esc(tpl.desc || "")} — جاهای خالی را پر کنید؛ تاریخ و «مبلغ به حروف» خودکار پر می‌شود.</p>` },
          ...keys.map((k) => ({ k: `values.${k}`, label: H.esc(k), type: /شرح|متن|توضیح|دلیل|تعهدات|موارد/.test(k) ? "textarea" : "text", span: /شرح|متن|توضیح|نشانی|دلیل|تعهدات|موارد/.test(k) })),
        ] }, { title: "ظاهر سند", icon: "palette", open: false, fields: [{ k: "color", type: "color", label: "رنگ نوار بالای سند", swatches: ["#1f2937", "#ff7a1a", "#2563eb", "#059669", "#7c3aed", "#b45309"] }, { k: "frame", type: "check", label: "قاب دور صفحه" }] }];
        const ed = STUDIO.editor(v, {
          kind: "doc", route: "doc", title: tpl.title, icon: "book", schema, data, item, price: item ? item.price : tpl.price, deliverText: "(PDF و فایل Word قابل ویرایش)",
          titleOf: () => tpl.title, layout: "pages",
        });
        // re-run the auto-fill when a field changes and refresh the dependent inputs
        v.querySelector("[data-fields]").addEventListener("change", (e) => {
          const p = e.target.dataset.p; if (!p || !p.startsWith("values.")) return;
          docAuto(keys, data.values, p.slice(7));
          v.querySelectorAll("[data-p^='values.']").forEach((inp) => { const k = inp.dataset.p.slice(7); if (inp !== document.activeElement && data.values[k] !== undefined) inp.value = data.values[k]; });
          ed.paint();
        });
      };
      const chooser = () => {
        const cats = [...new Set(docs.map((d) => d.category || "سایر"))];
        v.innerHTML = `<div class="st-top card"><a class="icon-btn" href="#" aria-label="بازگشت">${BX.icon("arrow-right")}</a><span class="st-top-ic">${BX.icon("book")}</span><div class="grow"><b>قرارداد و نامه رسمی</b><small class="muted d-block">${H.fa(docs.length)} قالب آماده — یکی را انتخاب کنید</small></div></div>
          ${cats.map((c) => `<h3 class="st-h3">${H.esc(c)}</h3><div class="studio-grid">${docs.filter((d) => (d.category || "سایر") === c).map((d) => `
            <button type="button" class="card st-card st-doc" data-doc="${d.id}"><span class="st-card-ic">${BX.icon("file")}</span><h2>${H.esc(d.title)}</h2><p class="muted small lh">${H.esc(d.desc)}</p><span class="badge badge--brand">${H.money(d.price)}</span></button>`).join("")}</div>`).join("") || `<div class="card empty">${BX.icon("book")}<p>قالبی تعریف نشده است.</p></div>`}
          <p class="muted small mt-2">${BX.icon("info")} این متن‌ها نمونه عمومی هستند؛ برای قراردادهای مهم پیش از امضا با مشاور حقوقی مشورت کنید.</p>`;
        v.onclick = (e) => { const b = e.target.closest("[data-doc]"); if (!b) return; v.onclick = null; const draft = STUDIO.loadDraft("doc"); start(draft && String(draft.templateId) === b.dataset.doc ? draft : { templateId: Number(b.dataset.doc), values: {}, color: "#1f2937" }, null); };
      };
      if (param) return STUDIO.open(v, "doc", param, () => ({}), (data, item) => (pick(data.templateId) ? start(data, item) : chooser()));
      chooser();
    },
  });

  // ================================================================ BRAND NAMES (free)
  // Quota line for the premium tools (free uses per week; X PRO gets many more)
  STUDIO.quotaText = (q) => !q || q.limit <= 0 ? (q?.pro ? `استفاده نامحدود با ${proName()}` : "") : `${H.fa(q.left)} از ${H.fa(q.limit)} استفاده این هفته باقی مانده${q.pro ? "" : ` — با ${proName()} بیشتر`}`;
  STUDIO.quotaWall = (out, msg) => { out.innerHTML = `<div class="card st-wall">${BX.icon("star")}<h3>${H.esc(msg)}</h3><p class="muted lh">اشتراک ${proName()}: ابزارهای ویژه تقریباً نامحدود، ${H.fa(S.pro?.studioFiles || 15)} فایل استودیو در ماه، ویرایش نامحدود طرح‌ها، کارت ویزیت دیجیتال و نشان PRO کنار نام شما.</p><a class="btn btn-primary" href="dashboard.html#pro">${BX.icon("star")} مشاهده اشتراک‌ها</a></div>`; };

  STUDIO.register("names", {
    title: "ایده نام برند",
    render(v) {
      v.innerHTML = `<div class="st-top card"><a class="icon-btn" href="#" aria-label="بازگشت">${BX.icon("arrow-right")}</a><span class="st-top-ic">${BX.icon("sparkles")}</span><div class="grow"><b>ایده نام برند</b><small class="muted d-block" data-q>هر بار نتیجه جدید</small></div></div>
        <form class="card st-names-f" data-names>
          <div class="field"><label class="field-label">حوزه کاری</label><select class="select" name="ind">${[["general", "عمومی"], ["food", "کافه، رستوران، غذا"], ["beauty", "زیبایی و آرایشی"], ["tech", "فناوری و نرم‌افزار"], ["fashion", "پوشاک و مد"], ["edu", "آموزش"], ["health", "سلامت و ورزش"], ["home", "خانه و دکوراسیون"]].map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
          <div class="field"><label class="field-label">کلمه‌های دلخواه (اختیاری)</label><input class="input" name="keys" placeholder="مثلاً: مهر، Nova، سبز"></div>
          <div class="field"><label class="field-label">زبان نام</label><select class="select" name="style"><option value="mix">فارسی و انگلیسی</option><option value="fa">فقط فارسی</option><option value="en">فقط انگلیسی</option></select></div>
          <button class="btn btn-primary" type="submit">${BX.icon("sparkles")} ساخت ایده‌ها</button>
        </form>
        <div class="st-names" data-out></div>`;
      const f = v.querySelector("[data-names]");
      const out = v.querySelector("[data-out]");
      f.onsubmit = async (e) => {
        e.preventDefault();
        out.innerHTML = `<div class="card st-loading" style="grid-column:1/-1">${BX.icon("loader")} در حال ساخت ایده‌ها…</div>`;
        let r;
        try { r = await BX.api("studio.names", { industry: f.ind.value, keys: f.keys.value, style: f.style.value }); }
        catch (err) { if (err.code === "quota") return STUDIO.quotaWall(out, err.message); out.innerHTML = `<div class="card empty">${BX.icon("info")}<p>${H.esc(err.message)}</p></div>`; return; }
        v.querySelector("[data-q]").textContent = STUDIO.quotaText(r.quota);
        out.innerHTML = r.names.map(({ name: n, score }, i) => `<div class="st-name card" style="--d:${i * 25}ms"><b style="font-family:${/^[a-z]/i.test(n) ? "ui-sans-serif,system-ui" : "inherit"};color:hsl(${(i * 47) % 360} 75% 55%)">${H.esc(n)}</b>
          <div class="st-score-bar" title="امتیاز خوش‌آوایی و کوتاهی"><i style="width:${score}%"></i><span>${H.fa(score)}</span></div>
          <div class="row"><button type="button" class="btn btn-ghost btn-xs" data-copy="${H.esc(n)}">${BX.icon("link")} کپی</button>${/^[a-z]/i.test(n) ? `<a class="btn btn-ghost btn-xs" target="_blank" rel="noopener" href="https://www.whois.com/whois/${encodeURIComponent(n.toLowerCase())}.ir">دامنه .ir</a>` : ""}<a class="btn btn-ghost btn-xs" href="order.html?service=logo">لوگو</a></div></div>`).join("")
          + `<div class="cta glow" style="grid-column:1/-1"><h2 class="h2-sm">نام را پیدا کردید؟</h2><p class="muted lh">لوگو و هویت بصری حرفه‌ای همین نام را به طراحان بهیکس بسپارید.</p><div class="cta-actions"><a class="btn btn-primary" href="order.html?service=logo">سفارش لوگو ${BX.icon("arrow")}</a></div></div>`;
      };
      out.onclick = (e) => { const c = e.target.closest("[data-copy]"); if (c) navigator.clipboard?.writeText(c.dataset.copy).then(() => BX.toast("کپی شد.", "ok")); };
      BX.api("tools.quota", { tool: "names" }).then((q) => { v.querySelector("[data-q]").textContent = STUDIO.quotaText(q) || "هر بار نتیجه جدید"; }).catch(() => {});
    },
  });

  // ================================================================ SEO AUDIT (free)
  STUDIO.register("seo", {
    title: "بررسی سئوی سایت",
    render(v) {
      v.innerHTML = `<div class="st-top card"><a class="icon-btn" href="#" aria-label="بازگشت">${BX.icon("arrow-right")}</a><span class="st-top-ic">${BX.icon("search")}</span><div class="grow"><b>بررسی سئوی سایت</b><small class="muted d-block" data-q>۱۸ مورد کلیدی سئو و سرعت</small></div></div>
        <form class="card st-seo-f" data-seo><input class="input" name="url" dir="ltr" placeholder="example.com" required><button class="btn btn-primary" type="submit">${BX.icon("search")} بررسی کن</button></form>
        <div data-out></div>`;
      const f = v.querySelector("[data-seo]"), out = v.querySelector("[data-out]");
      f.onsubmit = async (e) => {
        e.preventDefault();
        out.innerHTML = `<div class="card st-loading">${BX.icon("loader")} در حال بررسی سایت… (تا ۲۰ ثانیه)</div>`;
        try {
          const r = await BX.api("studio.seo", { url: f.url.value });
          v.querySelector("[data-q]").textContent = STUDIO.quotaText(r.quota);
          const tone = r.score >= 80 ? "ok" : r.score >= 55 ? "warn" : "bad";
          out.innerHTML = `<div class="st-seo">
            <div class="card st-score st-score--${tone}"><div class="st-gauge" style="--p:${r.score}"><b>${H.fa(r.score)}</b><small>از ۱۰۰</small></div>
              <div><h2 class="h2-xs">${r.score >= 80 ? "عالی! سایت شما وضعیت خوبی دارد" : r.score >= 55 ? "قابل قبول؛ چند مورد مهم را اصلاح کنید" : "سایت شما به بهینه‌سازی جدی نیاز دارد"}</h2>
              <p class="muted small" dir="ltr" style="text-align:right">${H.esc(r.url)}</p>${r.title ? `<p class="small mt-1"><b>عنوان:</b> ${H.esc(r.title)}</p>` : ""}<p class="small"><b>زمان پاسخ:</b> ${H.fa(r.time)} ثانیه</p></div></div>
            <div class="card st-checks">${r.checks.map((c) => `<div class="st-check ${c.ok ? "ok" : "bad"}">${BX.icon(c.ok ? "check-circle" : "x-circle")}<div><b>${H.esc(c.label)}</b>${c.ok ? "" : `<p class="muted small">${H.esc(c.tip)}</p>`}</div></div>`).join("")}</div>
            <div class="cta glow"><h2 class="h2-sm">اصلاح همه موارد را به ما بسپارید</h2><p class="muted lh">سئوی فنی، محتوای سئوشده و افزایش سرعت سایت با گزارش ماهانه.</p><div class="cta-actions"><a class="btn btn-primary" href="service.html?id=seo">خدمات سئو ${BX.icon("arrow")}</a><a class="btn btn-ghost" href="index.html#support">مشاوره رایگان</a></div></div>
          </div>`;
        } catch (err) { if (err.code === "quota") return STUDIO.quotaWall(out, err.message); out.innerHTML = `<div class="card empty">${BX.icon("info")}<p>${H.esc(err.message)}</p></div>`; }
      };
      BX.api("tools.quota", { tool: "seo" }).then((q) => { v.querySelector("[data-q]").textContent = STUDIO.quotaText(q) || "۱۸ مورد کلیدی سئو و سرعت"; }).catch(() => {});
    },
  });
})();
