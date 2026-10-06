/* ==========================================================================
   BEHIX — Studio PowerPoint builder: write the slides, pick a theme, get an
   editable right-to-left .pptx (PptxGenJS, bundled locally — no outside API).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const ready = () => new Promise((ok) => { const t = () => (window.STUDIO ? ok(window.STUDIO) : setTimeout(t, 30)); t(); });

  ready().then((STUDIO) => {
    const H = STUDIO.h;
    const THEMES = {
      ocean: { name: "اقیانوسی", bg: "0F172A", fg: "FFFFFF", accent: "38BDF8", soft: "1E293B", sub: "94A3B8" },
      orange: { name: "نارنجی بهیکس", bg: "FFFFFF", fg: "111827", accent: "FF7A1A", soft: "FFF1E6", sub: "6B7280" },
      forest: { name: "سبز طبیعی", bg: "F4F7F2", fg: "14281D", accent: "16A34A", soft: "DCFCE7", sub: "4B5563" },
      royal: { name: "بنفش رسمی", bg: "1E1B4B", fg: "FFFFFF", accent: "A78BFA", soft: "312E81", sub: "C7D2FE" },
      mono: { name: "سیاه‌وسفید", bg: "FFFFFF", fg: "111111", accent: "111111", soft: "F3F4F6", sub: "6B7280" },
    };
    const TYPES = [["bullets", "عنوان و نکته‌ها"], ["image", "عکس و متن"], ["quote", "نقل‌قول / پیام کلیدی"], ["section", "جداکننده بخش"], ["numbers", "آمار و اعداد"]];
    const schema = [
      { title: "قالب", icon: "palette", fields: [
        { k: "theme", type: "tpl", label: "پوسته", options: Object.entries(THEMES).map(([k, t]) => [k, t.name, `#${t.accent}`]) },
        { k: "font", type: "select", label: "فونت فایل پاورپوینت", options: [["Tahoma", "Tahoma (روی همه سیستم‌ها)"], ["Vazirmatn", "وزیرمتن"], ["B Nazanin", "ب نازنین"], ["IRANSans", "ایران‌سنس"]], help: "اگر فونت روی سیستم ارائه نصب نیست، Tahoma را انتخاب کنید." },
      ] },
      { title: "اسلاید عنوان", icon: "presentation", fields: [{ k: "title", label: "عنوان ارائه", span: true }, { k: "subtitle", label: "زیرعنوان", span: true }, { k: "author", label: "ارائه‌دهنده" }, { k: "date", label: "تاریخ / مناسبت" }, { k: "logo", type: "image", label: "لوگو", max: 500 }] },
      { title: "اسلایدها", icon: "layers", fields: [{ k: "slides", type: "list", label: "اسلایدها", add: "افزودن اسلاید", max: 40, fields: [
        { k: "type", type: "select", label: "نوع", options: TYPES, def: "bullets" }, { k: "title", label: "عنوان اسلاید" },
        { k: "text", type: "textarea", label: "متن (هر خط یک نکته؛ برای «آمار»: عدد | توضیح)", span: true },
        { k: "image", type: "image", label: "عکس (برای اسلاید عکس‌دار)", max: 1400, span: true },
      ] }] },
      { title: "اسلاید پایانی", icon: "check", fields: [{ k: "end", label: "متن پایانی", span: true, ph: "مثلاً با تشکر از توجه شما" }, { k: "contact", label: "راه ارتباطی", span: true, dir: "ltr" }] },
    ];
    const defaults = () => ({
      theme: "orange", font: "Tahoma", title: "عنوان ارائه شما", subtitle: "زیرعنوان یا موضوع جلسه", author: BX.me?.name || "", date: "", logo: "",
      slides: [
        { type: "bullets", title: "مقدمه", text: "مسئله‌ای که حل می‌کنیم\nمخاطب ما چه کسانی هستند\nچرا همین حالا", image: "" },
        { type: "numbers", title: "در یک نگاه", text: "۲۴۰ | مشتری فعال\n۹۸٪ | رضایت مشتری\n۳ | شهر", image: "" },
        { type: "quote", title: "پیام کلیدی", text: "یک جمله که می‌خواهید مخاطب به خاطر بسپارد.", image: "" },
      ],
      end: "با تشکر از توجه شما", contact: "",
    });
    const hex = (h) => `#${h}`;
    function previewHtml(d, paid) {
      const t = THEMES[d.theme] || THEMES.orange;
      const e = H.esc;
      const slide = (inner, i) => `<div class="sl" style="--bg:${hex(t.bg)};--fg:${hex(t.fg)};--ac:${hex(t.accent)};--soft:${hex(t.soft)};--sub:${hex(t.sub)}">${inner}${d.logo ? `<img class="sl-logo" src="${d.logo}" alt="">` : ""}<span class="sl-n">${H.fa(i)}</span>${paid ? "" : H.watermarkHtml()}</div>`;
      const all = [slide(`<div class="sl-title"><i></i><h3>${e(d.title)}</h3><p>${e(d.subtitle)}</p><small>${e([d.author, d.date].filter(Boolean).join(" · "))}</small></div>`, 1)];
      (d.slides || []).forEach((s, i) => {
        const lines = H.lines(s.text);
        let inner = "";
        if (s.type === "section") inner = `<div class="sl-sec"><b>${H.fa(String(i + 1).padStart(2, "0"))}</b><h3>${e(s.title)}</h3></div>`;
        else if (s.type === "quote") inner = `<div class="sl-quote"><span>”</span><h3>${e(lines.join(" ") || s.title)}</h3>${lines.length && s.title ? `<small>${e(s.title)}</small>` : ""}</div>`;
        else if (s.type === "numbers") inner = `<h4>${e(s.title)}</h4><div class="sl-nums">${lines.slice(0, 4).map((l) => { const [n, l2] = l.split("|").map((x) => x.trim()); return `<div><b>${e(n)}</b><small>${e(l2 || "")}</small></div>`; }).join("")}</div>`;
        else if (s.type === "image") inner = `<h4>${e(s.title)}</h4><div class="sl-img">${s.image ? `<img src="${s.image}" alt="">` : `<span>عکس</span>`}<ul>${lines.slice(0, 5).map((l) => `<li>${e(l)}</li>`).join("")}</ul></div>`;
        else inner = `<h4>${e(s.title)}</h4><ul class="sl-ul">${lines.slice(0, 7).map((l) => `<li>${e(l)}</li>`).join("")}</ul>`;
        all.push(slide(inner, i + 2));
      });
      all.push(slide(`<div class="sl-title"><i></i><h3>${e(d.end || "با تشکر")}</h3><p dir="auto">${e(d.contact || "")}</p></div>`, all.length + 1));
      return `<div class="sl-grid">${all.join("")}</div>`;
    }
    let lib = null;
    const loadLib = () => lib || (lib = new Promise((ok, no) => { if (window.PptxGenJS) return ok(window.PptxGenJS); const s = document.createElement("script"); s.src = "assets/vendor/pptxgen.bundle.js?v=1"; s.onload = () => ok(window.PptxGenJS); s.onerror = no; document.head.appendChild(s); }));
    async function exportPptx(d) {
      BX.toast("در حال ساخت فایل پاورپوینت…", "info");
      const P = await loadLib();
      const t = THEMES[d.theme] || THEMES.orange;
      const pres = new P();
      pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in
      pres.rtlMode = true;
      pres.title = d.title || "ارائه";
      pres.author = d.author || "";
      const F = d.font || "Tahoma";
      const base = { fontFace: F, color: t.fg, rtlMode: true, lang: "fa-IR", align: "right" };
      const W = 13.33, Hh = 7.5, M = 0.6;
      const addLogo = (s) => { if (d.logo) s.addImage({ data: d.logo, x: M, y: 0.35, w: 0.9, h: 0.9, sizing: { type: "contain", w: 0.9, h: 0.9 } }); };
      const addNum = (s, n) => s.addText(BX.faDigits(n), { ...base, x: M, y: Hh - 0.6, w: 1, h: 0.4, fontSize: 11, color: t.sub, align: "left" });
      const header = (s, title) => {
        s.addShape(pres.ShapeType.rect, { x: W - M - 0.12, y: 0.55, w: 0.12, h: 0.7, fill: { color: t.accent } });
        s.addText(title || "", { ...base, x: M + 1, y: 0.45, w: W - 2 * M - 1.3, h: 0.9, fontSize: 30, bold: true });
      };
      // title slide
      let s = pres.addSlide(); s.background = { color: t.bg };
      s.addShape(pres.ShapeType.rect, { x: W - 0.35, y: 0, w: 0.35, h: Hh, fill: { color: t.accent } });
      s.addText(d.title || "", { ...base, x: M, y: 2.2, w: W - 2 * M - 0.5, h: 1.4, fontSize: 44, bold: true });
      s.addText(d.subtitle || "", { ...base, x: M, y: 3.6, w: W - 2 * M - 0.5, h: 0.8, fontSize: 22, color: t.accent });
      s.addText([d.author, d.date].filter(Boolean).join("  ·  "), { ...base, x: M, y: 4.6, w: W - 2 * M - 0.5, h: 0.6, fontSize: 16, color: t.sub });
      addLogo(s);
      (d.slides || []).forEach((sd, i) => {
        s = pres.addSlide(); s.background = { color: t.bg };
        const lines = H.lines(sd.text);
        if (sd.type === "section") {
          s.background = { color: t.accent };
          s.addText(BX.faDigits(String(i + 1).padStart(2, "0")), { ...base, x: M, y: 2.2, w: W - 2 * M, h: 1.2, fontSize: 60, bold: true, color: t.bg === "FFFFFF" ? "FFFFFF" : t.bg });
          s.addText(sd.title || "", { ...base, x: M, y: 3.4, w: W - 2 * M, h: 1.2, fontSize: 40, bold: true, color: "FFFFFF" });
        } else if (sd.type === "quote") {
          s.addText("”", { ...base, x: W - M - 1.5, y: 0.8, w: 1.5, h: 1.5, fontSize: 120, color: t.accent, bold: true });
          s.addText(lines.join(" ") || sd.title || "", { ...base, x: M + 0.5, y: 2.2, w: W - 2 * M - 1, h: 2.6, fontSize: 32, bold: true, valign: "middle" });
          if (lines.length && sd.title) s.addText("— " + sd.title, { ...base, x: M + 0.5, y: 5, w: W - 2 * M - 1, h: 0.6, fontSize: 18, color: t.sub });
        } else if (sd.type === "numbers") {
          header(s, sd.title);
          const items = lines.slice(0, 4).map((l) => l.split("|").map((x) => x.trim()));
          const n = Math.max(1, items.length), gap = 0.3, bw = (W - 2 * M - gap * (n - 1)) / n;
          items.forEach(([num, label], k) => {
            const x = W - M - bw - k * (bw + gap);
            s.addShape(pres.ShapeType.roundRect, { x, y: 2.2, w: bw, h: 3, fill: { color: t.soft }, rectRadius: 0.15 });
            s.addText(num || "", { ...base, x, y: 2.6, w: bw, h: 1.3, fontSize: 48, bold: true, color: t.accent, align: "center" });
            s.addText(label || "", { ...base, x: x + 0.2, y: 3.9, w: bw - 0.4, h: 1, fontSize: 18, color: t.sub, align: "center" });
          });
        } else if (sd.type === "image") {
          header(s, sd.title);
          if (sd.image) s.addImage({ data: sd.image, x: M, y: 1.6, w: 6, h: 5.2, sizing: { type: "contain", w: 6, h: 5.2 } });
          s.addText(lines.slice(0, 6).map((l) => ({ text: l, options: { bullet: true, breakLine: true } })), { ...base, x: M + 6.3, y: 1.7, w: W - 2 * M - 6.4, h: 5, fontSize: 20, valign: "top", paraSpaceAfter: 10 });
        } else {
          header(s, sd.title);
          s.addText(lines.slice(0, 8).map((l) => ({ text: l, options: { bullet: { code: "25CF" }, breakLine: true } })), { ...base, x: M, y: 1.7, w: W - 2 * M - 0.3, h: 5.2, fontSize: 22, valign: "top", paraSpaceAfter: 14 });
        }
        addNum(s, i + 2);
        if (sd.type !== "section") addLogo(s);
      });
      s = pres.addSlide(); s.background = { color: t.bg };
      s.addShape(pres.ShapeType.rect, { x: 0, y: Hh - 0.35, w: W, h: 0.35, fill: { color: t.accent } });
      s.addText(d.end || "با تشکر", { ...base, x: M, y: 2.5, w: W - 2 * M, h: 1.4, fontSize: 44, bold: true, align: "center" });
      if (d.contact) s.addText(d.contact, { ...base, x: M, y: 4, w: W - 2 * M, h: 0.7, fontSize: 20, color: t.sub, align: "center" });
      await pres.writeFile({ fileName: `${(d.title || "presentation").slice(0, 40)}.pptx` });
    }
    STUDIO.register("slides", {
      title: "پاورپوینت‌ساز",
      render: (v, param) => STUDIO.open(v, "slides", param, defaults, (data, item) => {
        STUDIO.editor(v, {
          kind: "slides", title: "پاورپوینت‌ساز", icon: "presentation", schema, data, item, wide: true, deliverText: "(فایل .pptx قابل ویرایش در پاورپوینت و Google Slides)",
          titleOf: (d) => d.title || "ارائه",
          preview(el, d, paid) { el.innerHTML = previewHtml(d, paid) + `<p class="muted small center mt-1">${H.fa(2 + (d.slides || []).length)} اسلاید — فایل نهایی کاملاً قابل ویرایش است</p>`; },
          exportFile: exportPptx,
        });
      }),
    });
  });
})();
