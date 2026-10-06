/* ==========================================================================
   BEHIX — Studio: business card (front/back, 9×5 cm print) and social post /
   story / poster. Only the forms and smart helpers live here — previews and
   final files are drawn on the server. The QR helper is for hosted pages.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const ready = () => new Promise((ok) => { const t = () => (window.STUDIO ? ok(window.STUDIO) : setTimeout(t, 30)); t(); });

  ready().then((STUDIO) => {
    const H = STUDIO.h;
    // QR codes for the hosted pages (digital card / menu table cards)
    let qrLib = null;
    const loadQr = () => qrLib || (qrLib = new Promise((ok, no) => { if (window.qrcode) return ok(window.qrcode); const s = document.createElement("script"); s.src = "assets/vendor/qrcode.js?v=1"; s.onload = () => { window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"]; ok(window.qrcode); }; s.onerror = no; document.head.appendChild(s); }));
    async function drawQr(ctx, data, x, y, size, fg = "#111", bg = "#fff") {
      const q = await loadQr();
      const qr = q(0, "M"); qr.addData(data); qr.make();
      const n = qr.getModuleCount(), cell = size / (n + 2);
      ctx.fillStyle = bg; ctx.fillRect(x, y, size, size);
      ctx.fillStyle = fg;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, Math.ceil(cell), Math.ceil(cell));
    }
    STUDIO.qr = { loadQr, drawQr };

    // Two dominant, saturated colors of an uploaded logo → brand colors
    async function paletteOf(src) {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, 64, 64);
      const px = x.getImageData(0, 0, 64, 64).data, bins = {};
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        if (a < 128) continue;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx - mn < 40 || mx < 50 || mn > 225) continue; // skip grey / white / black
        const k = `${r >> 5},${g >> 5},${b >> 5}`;
        (bins[k] ||= { n: 0, r: 0, g: 0, b: 0 }); bins[k].n++; bins[k].r += r; bins[k].g += g; bins[k].b += b;
      }
      const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
      return Object.values(bins).sort((a, b) => b.n - a.n).slice(0, 2).map((v) => `#${hex(v.r / v.n)}${hex(v.g / v.n)}${hex(v.b / v.n)}`);
    }
    STUDIO.paletteOf = paletteOf;

    // ================================================================ BUSINESS CARD
    const CARD_TPL = [["band", "نوار رنگی", "#ff7a1a"], ["luxe", "لوکس طلایی", "#c9a227"], ["glass", "شیشه‌ای", "#06b6d4"], ["gradient", "گرادیانی", "#7c3aed"], ["dark", "تیره", "#111827"], ["split", "دو تکه", "#db2777"],
      ["circle", "دایره‌ای", "#0891b2"], ["wave", "موجی", "#2563eb"], ["corner", "گوشه‌ای", "#059669"], ["stripes", "راه‌راه", "#f59e0b"], ["frame", "قاب‌دار", "#dc2626"], ["minimal", "مینیمال", "#94a3b8"]];
    const cardSchema = [
      { title: "قالب و رنگ", icon: "palette", fields: [{ k: "tpl", type: "tpl", label: "قالب", options: CARD_TPL }, { k: "color", type: "color", label: "رنگ اصلی" }, { k: "color2", type: "color", label: "رنگ دوم", swatches: ["#ffa24a", "#facc15", "#38bdf8", "#a78bfa", "#f472b6", "#e5e7eb", "#111827", "#22c55e"] }, { k: "logo", type: "image", label: "لوگو (ترجیحاً PNG بدون پس‌زمینه) — رنگ‌ها خودکار از لوگو برداشته می‌شود", max: 700, span: true }] },
      { title: "اطلاعات روی کارت", icon: "user", fields: [
        { k: "name", label: "نام" }, { k: "role", label: "سمت" }, { k: "company", label: "نام شرکت / برند" }, { k: "slogan", label: "شعار (پشت کارت)" },
        { k: "phone", label: "موبایل", dir: "ltr" }, { k: "phone2", label: "تلفن دوم", dir: "ltr" }, { k: "email", label: "ایمیل", dir: "ltr" }, { k: "web", label: "وب‌سایت", dir: "ltr" },
        { k: "insta", label: "اینستاگرام (بدون @)", dir: "ltr" }, { k: "address", label: "آدرس", span: true },
      ] },
      { title: "پشت کارت", icon: "qr", fields: [{ k: "backQr", type: "check", label: "QR کد روی پشت کارت (به سایت یا شماره)" }, { k: "qrText", label: "متن/لینک QR (خالی = وب‌سایت یا موبایل)", dir: "ltr", span: true }] },
    ];
    const cardDefaults = () => ({ tpl: "band", color: "#ff7a1a", color2: "#111827", logo: "", name: BX.me?.name || "", role: "", company: "", slogan: "", phone: BX.me?.phone || "", phone2: "", email: "", web: "", insta: "", address: "", backQr: true, qrText: "" });
    function cardSmart(el, d, refresh) {
      let lastLogo = d.logo;
      const SLOGANS = ["کیفیت، تعهد، اعتماد", "همراه شما در مسیر رشد", "تفاوت را حس کنید", "ساده، سریع، مطمئن", "خلاقیت بی‌مرز", "از ایده تا اجرا"];
      const list = SLOGANS.map((x) => [x, () => { d.slogan = x; }]);
      el.innerHTML = STUDIO.chips("شعار پیشنهادی", list) + `<p class="muted small st-smart-tip">${BX.icon("info")} لوگو را بگذارید تا رنگ کارت خودکار با برند شما هماهنگ شود.</p>`;
      STUDIO.bindChips(el.querySelector(".st-chips"), list, refresh);
      // watch for a new logo → pick brand colors from it
      const timer = setInterval(async () => {
        if (!el.isConnected) return clearInterval(timer);
        if (!d.logo || d.logo === lastLogo) return;
        lastLogo = d.logo;
        try { const [a, b] = await paletteOf(d.logo); if (a) { d.color = a; if (b) d.color2 = b; refresh(); BX.toast("رنگ‌های کارت از لوگوی شما برداشته شد.", "ok"); } } catch (e) { /* unreadable image */ }
      }, 700);
    }
    STUDIO.register("card", {
      title: "کارت ویزیت چاپی",
      render: (v, param) => STUDIO.open(v, "card", param, cardDefaults, (data, item) => {
        STUDIO.editor(v, {
          kind: "card", title: "کارت ویزیت چاپی", icon: "layout", schema: cardSchema, data, item, deliverText: "(PDF چاپی ۹×۵ سانتی‌متر و PNG ۳۰۰dpi)",
          titleOf: (d) => `کارت ویزیت ${d.name || d.company || ""}`.trim(), layout: "card", smart: cardSmart,
        });
      }),
    });

    // ================================================================ POST / STORY / POSTER
    const SIZES = { post: "پست مربعی ۱۰۸۰", portrait: "پست عمودی ۴:۵", story: "استوری / ریلز", poster: "پوستر A4" };
    const POST_TPL = [["sale", "تخفیف و حراج", "#dc2626"], ["product", "معرفی محصول", "#2563eb"], ["occasion", "تبریک مناسبت", "#7c3aed"], ["launch", "رونمایی / به‌زودی", "#22d3ee"],
      ["announce", "اطلاعیه", "#0f172a"], ["event", "رویداد و وبینار", "#ff7a1a"], ["hiring", "استخدام", "#4f46e5"], ["tips", "نکته‌ها و آموزش", "#f97316"],
      ["menu", "منو و لیست قیمت", "#b45309"], ["review", "نظر مشتری", "#ec4899"], ["quote", "جمله و نقل‌قول", "#059669"], ["photo", "عکس و کپشن", "#0f766e"]];
    const postSchema = [
      { title: "قالب، اندازه و رنگ", icon: "palette", fields: [{ k: "tpl", type: "tpl", label: "قالب", options: POST_TPL }, { k: "size", type: "select", label: "اندازه", options: Object.entries(SIZES) }, { k: "color", type: "color", label: "رنگ اصلی" }, { k: "color2", type: "color", label: "رنگ دوم", swatches: ["#ffa24a", "#facc15", "#38bdf8", "#a78bfa", "#f472b6", "#ffffff", "#111827", "#22c55e"] }] },
      { title: "متن‌ها", icon: "type", fields: [
        { k: "title", label: "تیتر اصلی", span: true, ph: "مثلاً حراج بزرگ پاییزه" }, { k: "subtitle", label: "زیرتیتر", span: true },
        { k: "body", type: "textarea", label: "متن یا فهرست (برای منو: «نام | قیمت» در هر خط)", span: true }, { k: "badge", label: "برچسب برجسته (مثلاً ۳۰٪ یا جدید)" }, { k: "cta", label: "دکمه / دعوت به اقدام", ph: "مثلاً همین حالا سفارش دهید" },
        { k: "date", label: "تاریخ و ساعت (رویداد / رونمایی)" }, { k: "footer", label: "پاورقی (آیدی، شماره، سایت)", dir: "ltr" },
      ] },
      { title: "تصاویر", icon: "image", fields: [{ k: "photo", type: "image", label: "عکس اصلی / محصول", max: 1600 }, { k: "logo", type: "image", label: "لوگو", max: 600 }, { k: "dim", type: "range", label: "تیرگی روی عکس پس‌زمینه", min: 0, max: 80 }] },
    ];
    const postDefaults = () => ({ tpl: "sale", size: "post", color: "#dc2626", color2: "#facc15", title: "حراج بزرگ پاییزه", subtitle: "فقط تا پایان هفته", body: "", badge: "۳۰٪", cta: "همین حالا خرید کنید", date: "", footer: "", photo: "", logo: "", dim: 45 });
    // Ready-made occasions (Iranian calendar) — one click fills the design
    const OCCASIONS = [
      ["نوروز", { tpl: "occasion", color: "#16a34a", color2: "#fde047", title: "نوروز مبارک", subtitle: "سال نو، روزهای نو", body: "بهار دل‌انگیز را به شما و خانواده محترمتان تبریک می‌گوییم.", badge: "", cta: "" }],
      ["یلدا", { tpl: "occasion", color: "#9f1239", color2: "#fb923c", title: "شب یلدا مبارک", subtitle: "بلندترین شب سال، کنار عزیزان", body: "یلدایتان پر از گرما، انار و قصه‌های شیرین.", cta: "" }],
      ["روز مادر", { tpl: "occasion", color: "#db2777", color2: "#fce7f3", title: "روز مادر مبارک", subtitle: "به پاس همه مهربانی‌ها", body: "", cta: "هدیه روز مادر" }],
      ["روز پدر", { tpl: "occasion", color: "#1e3a8a", color2: "#93c5fd", title: "روز پدر مبارک", subtitle: "تکیه‌گاه همیشگی ما", body: "", cta: "" }],
      ["روز معلم", { tpl: "occasion", color: "#0f766e", color2: "#fde68a", title: "روز معلم گرامی باد", subtitle: "سپاس از همه کسانی که به ما آموختند", body: "", cta: "" }],
      ["روز زن", { tpl: "occasion", color: "#7c3aed", color2: "#f9a8d4", title: "روز زن مبارک", subtitle: "", body: "", cta: "" }],
      ["حراج / بلک فرایدی", { tpl: "sale", color: "#111827", color2: "#facc15", title: "حراج جمعه سیاه", subtitle: "فقط ۷۲ ساعت", badge: "۵۰٪", cta: "همین حالا خرید کنید" }],
      ["افتتاحیه", { tpl: "launch", color: "#7c3aed", color2: "#22d3ee", title: "افتتاحیه شعبه جدید", subtitle: "منتظر دیدارتان هستیم", badge: "به‌زودی", cta: "" }],
      ["تولد برند", { tpl: "occasion", color: "#ff7a1a", color2: "#fde047", title: "تولدمان مبارک!", subtitle: "یک سال همراهی شما", body: "به همین مناسبت تخفیف ویژه داریم.", badge: "", cta: "دیدن تخفیف‌ها" }],
      ["استخدام", { tpl: "hiring", color: "#4f46e5", color2: "#fde68a", title: "طراح گرافیک", subtitle: "تمام‌وقت · تهران", body: "حداقل ۲ سال سابقه کار\nتسلط به فتوشاپ و ایلاستریتور\nروحیه کار تیمی", badge: "استخدام", cta: "ارسال رزومه" }],
    ];
    const HASHTAGS = { sale: "#حراج #تخفیف #خرید_آنلاین #فروش_ویژه", product: "#محصول_جدید #خرید #کیفیت", occasion: "#تبریک #مناسبت", launch: "#به_زودی #رونمایی #جدید", announce: "#اطلاعیه #خبر", event: "#وبینار #رویداد #آموزش", hiring: "#استخدام #فرصت_شغلی #کار", tips: "#آموزش #نکته #ترفند", menu: "#منو #کافه #رستوران", review: "#نظر_مشتری #رضایت_مشتری", quote: "#جمله_انگیزشی #انگیزه", photo: "#عکاسی #لحظه" };
    function caption(d) {
      const site = BX.settings.general?.siteNameFa || "";
      const open = { sale: "🔥 فرصت را از دست ندهید!", product: "✨ معرفی محصول جدید", occasion: "🌸", launch: "🚀 به‌زودی…", announce: "📢 اطلاعیه", event: "📅 دعوت به رویداد", hiring: "💼 فرصت شغلی", tips: "💡 چند نکته کاربردی", menu: "☕ منوی امروز", review: "⭐ نظر مشتریان ما", quote: "💬", photo: "📸" }[d.tpl] || "";
      return [open, d.title, d.subtitle, d.body, d.date && `🗓 ${d.date}`, d.cta && `👈 ${d.cta}`, d.footer && `📍 ${d.footer}`, "", `${HASHTAGS[d.tpl] || ""} ${site ? `#${site.replace(/\s+/g, "_")}` : ""}`].filter((x) => x !== undefined && x !== null && x !== false).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    function postSmart(el, d, refresh) {
      const list = OCCASIONS.map(([l, p]) => [l, () => Object.assign(d, { body: "", badge: "", date: "", ...p })]);
      el.innerHTML = STUDIO.chips("مناسبت و قالب آماده", list) + `<div class="row mt-1"><button type="button" class="btn btn-ghost btn-xs" data-cap>${BX.icon("sparkles")} کپشن و هشتگ پیشنهادی</button></div>`;
      STUDIO.bindChips(el.querySelector(".st-chips"), list, refresh);
      el.querySelector("[data-cap]").onclick = () => {
        const txt = caption(d);
        BX.modal({ title: "کپشن پیشنهادی", body: `<textarea class="textarea" rows="10" data-captxt>${H.esc(txt)}</textarea><p class="muted small mt-1">متن را ویرایش و کپی کنید.</p>`,
          actions: [{ label: "بستن" }, { label: "کپی", primary: true, onClick: (m) => { navigator.clipboard?.writeText(m.querySelector("[data-captxt]").value).then(() => BX.toast("کپی شد.", "ok")); } }] });
      };
    }
    STUDIO.register("post", {
      title: "پست، استوری و پوستر",
      render: (v, param) => STUDIO.open(v, "post", param, postDefaults, (data, item) => {
        STUDIO.editor(v, {
          kind: "post", title: "پست، استوری و پوستر", icon: "image", schema: postSchema, data, item, deliverText: "(PNG با کیفیت کامل، JPG و PDF)",
          titleOf: (d) => d.title || "پست", layout: "post", smart: postSmart,
        });
      }),
    });
  });
})();
