/* ==========================================================================
   BEHIX — Studio canvas builders: business card (front/back, 9×5 cm print)
   and social post / story / poster. Everything is drawn in the browser.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const ready = () => new Promise((ok) => { const t = () => (window.STUDIO ? ok(window.STUDIO) : setTimeout(t, 30)); t(); });

  ready().then((STUDIO) => {
    const H = STUDIO.h;
    // ---------------------------------------------------------------- drawing helpers
    const FONT = "Vazirmatn, Tahoma, sans-serif";
    const fontsReady = (async () => { try { await Promise.all([document.fonts.load(`900 40px Vazirmatn`), document.fonts.load(`400 20px Vazirmatn`)]); } catch (e) { /* fallback font */ } })();
    const ICONS = {
      phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
      mail: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6",
      web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
      map: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11ZM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
      insta: "M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    };
    function icon(ctx, name, x, y, size, color) {
      ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.stroke(new Path2D(ICONS[name])); ctx.restore();
    }
    const isLtr = (s) => /^[\x00-\x7F۰-۹\s+@._\-/:]+$/.test(String(s)) && /[a-z0-9@۰-۹]/i.test(String(s));
    // Text with right/left/center alignment; RTL unless the string is Latin
    function text(ctx, s, x, y, { size = 40, weight = 400, color = "#111", align = "right", maxW = 0, font = FONT } = {}) {
      s = String(s || "");
      if (!s) return 0;
      let fs = size;
      ctx.font = `${weight} ${fs}px ${font}`;
      if (maxW) while (ctx.measureText(s).width > maxW && fs > 10) { fs -= 1; ctx.font = `${weight} ${fs}px ${font}`; }
      ctx.direction = isLtr(s) ? "ltr" : "rtl";
      ctx.textAlign = align === "center" ? "center" : align === "right" ? (ctx.direction === "rtl" ? "start" : "right") : ctx.direction === "rtl" ? "end" : "left";
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.fillText(s, x, y);
      return ctx.measureText(s).width;
    }
    // Word-wrapped paragraph; returns height used
    function para(ctx, s, x, y, { size = 36, weight = 400, color = "#111", align = "right", maxW = 600, lh = 1.5, maxLines = 6 } = {}) {
      ctx.font = `${weight} ${size}px ${FONT}`;
      const lines = [];
      for (const raw of String(s || "").split("\n")) {
        let cur = "";
        for (const w of raw.split(/\s+/)) {
          const t = cur ? `${cur} ${w}` : w;
          if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
        }
        if (cur) lines.push(cur);
      }
      lines.slice(0, maxLines).forEach((l, i) => text(ctx, l, x, y + i * size * lh, { size, weight, color, align }));
      return Math.min(lines.length, maxLines) * size * lh;
    }
    // Shrinks the font until the (multi-line) title fits the box
    function fitTitle(ctx, s, x, y, maxW, maxH, { max = 140, min = 40, weight = 900, color = "#fff", align = "right", lh = 1.25 } = {}) {
      let size = max;
      const wrap = (sz) => { ctx.font = `${weight} ${sz}px ${FONT}`; const out = []; for (const raw of String(s || "").split("\n")) { let cur = ""; for (const w of raw.split(/\s+/)) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); } return out; };
      let lines = wrap(size);
      while (size > min && (lines.length * size * lh > maxH || lines.some((l) => ctx.measureText(l).width > maxW))) { size -= 4; lines = wrap(size); }
      lines.forEach((l, i) => text(ctx, l, x, y + i * size * lh + size / 2, { size, weight, color, align }));
      return lines.length * size * lh;
    }
    const loadImg = (src) => new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
    function drawContain(ctx, img, x, y, w, h) { if (!img) return; const r = Math.min(w / img.width, h / img.height); ctx.drawImage(img, x + (w - img.width * r) / 2, y + (h - img.height * r) / 2, img.width * r, img.height * r); }
    function drawCover(ctx, img, x, y, w, h) { if (!img) return; const r = Math.max(w / img.width, h / img.height); const sw = w / r, sh = h / r; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h); }
    function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
    function watermark(ctx, w, h) {
      ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = "#ff7a1a"; ctx.font = `800 ${Math.round(w / 22)}px ${FONT}`; ctx.textAlign = "center"; ctx.direction = "rtl";
      ctx.translate(w / 2, h / 2); ctx.rotate(-0.4);
      for (let yy = -h; yy < h; yy += w / 6) for (let xx = -w; xx < w; xx += w / 2.4) ctx.fillText(`پیش‌نمایش ${BX.settings.general?.siteName || "BEHIX"}`, xx, yy);
      ctx.restore();
    }
    const shade = (hex, amt) => { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, c + amt)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
    let qrLib = null;
    const loadQr = () => qrLib || (qrLib = new Promise((ok, no) => { if (window.qrcode) return ok(window.qrcode); const s = document.createElement("script"); s.src = "assets/vendor/qrcode.js?v=1"; s.onload = () => { window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"]; ok(window.qrcode); }; s.onerror = no; document.head.appendChild(s); }));
    async function drawQr(ctx, data, x, y, size, fg = "#111", bg = "#fff") {
      const q = await loadQr();
      const qr = q(0, "M"); qr.addData(data); qr.make();
      const n = qr.getModuleCount(), cell = size / (n + 2);
      ctx.fillStyle = bg; rrect(ctx, x, y, size, size, size * 0.06); ctx.fill();
      ctx.fillStyle = fg;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, Math.ceil(cell), Math.ceil(cell));
    }
    STUDIO.qr = { loadQr, drawQr };
    const canvasBlob = (c) => new Promise((ok) => c.toBlob(ok, "image/png"));

    // ================================================================ BUSINESS CARD
    const CW = 1063, CH = 591; // 9 × 5 cm at 300 dpi
    const CARD_TPL = [["band", "نوار رنگی", "#ff7a1a"], ["dark", "تیره و لوکس", "#111827"], ["gradient", "گرادیانی", "#7c3aed"], ["minimal", "مینیمال", "#cbd5e1"], ["corner", "گوشه‌ای", "#059669"], ["wave", "موجی", "#2563eb"]];
    const cardSchema = [
      { title: "قالب و رنگ", icon: "palette", fields: [{ k: "tpl", type: "tpl", label: "قالب", options: CARD_TPL }, { k: "color", type: "color", label: "رنگ اصلی" }, { k: "color2", type: "color", label: "رنگ دوم", swatches: ["#ffa24a", "#facc15", "#38bdf8", "#a78bfa", "#f472b6", "#e5e7eb", "#111827", "#22c55e"] }, { k: "logo", type: "image", label: "لوگو (ترجیحاً PNG بدون پس‌زمینه)", max: 700 }] },
      { title: "اطلاعات روی کارت", icon: "user", fields: [
        { k: "name", label: "نام" }, { k: "role", label: "سمت" }, { k: "company", label: "نام شرکت / برند" }, { k: "slogan", label: "شعار (پشت کارت)" },
        { k: "phone", label: "موبایل", dir: "ltr" }, { k: "phone2", label: "تلفن دوم", dir: "ltr" }, { k: "email", label: "ایمیل", dir: "ltr" }, { k: "web", label: "وب‌سایت", dir: "ltr" },
        { k: "insta", label: "اینستاگرام (بدون @)", dir: "ltr" }, { k: "address", label: "آدرس", span: true },
      ] },
      { title: "پشت کارت", icon: "qr", fields: [{ k: "backQr", type: "check", label: "QR کد روی پشت کارت (به سایت یا شماره)" }, { k: "qrText", label: "متن/لینک QR (خالی = وب‌سایت یا موبایل)", dir: "ltr", span: true }] },
    ];
    const cardDefaults = () => ({ tpl: "band", color: "#ff7a1a", color2: "#111827", logo: "", name: BX.me?.name || "", role: "", company: "", slogan: "", phone: BX.me?.phone || "", phone2: "", email: "", web: "", insta: "", address: "", backQr: true, qrText: "" });
    const fa = (s) => BX.faDigits(String(s || ""));
    function contacts(d) {
      return [["phone", fa(d.phone)], ["phone", fa(d.phone2)], ["mail", d.email], ["web", d.web], ["insta", d.insta && "@" + d.insta.replace(/^@/, "")], ["map", d.address]].filter((x) => x[1]);
    }
    // preview shows sample text in empty fields so the design is visible
    const sample = (d, paid) => (paid ? d : { ...d, name: d.name || "نام و نام خانوادگی", role: d.role || (d.company ? "" : "سمت شما"), company: d.company || "", phone: d.phone || "۰۹۱۲۰۰۰۰۰۰۰" });
    async function drawCardFront(c, d, paid) {
      await fontsReady;
      d = sample(d, paid);
      const ctx = c.getContext("2d"); c.width = CW; c.height = CH;
      const col = d.color || "#ff7a1a", col2 = d.color2 || "#111827", logo = await loadImg(d.logo);
      const list = contacts(d);
      const rows = (x, y0, gap, color, iconColor, align = "right", size = 30) => list.slice(0, 5).forEach(([ic, v], i) => {
        const y = y0 + i * gap;
        if (align === "right") { icon(ctx, ic, x - 32, y - 16, 32, iconColor); text(ctx, v, x - 48, y, { size, color, align: "right", maxW: 520 }); }
        else { icon(ctx, ic, x, y - 16, 32, iconColor); text(ctx, v, x + 48, y, { size, color, align: "left", maxW: 520 }); }
      });
      const t = d.tpl || "band";
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, CW, CH);
      if (t === "band") {
        const g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, col); g.addColorStop(1, shade(col, -50));
        ctx.fillStyle = g; ctx.fillRect(0, 0, 360, CH);
        if (logo) drawContain(ctx, logo, 60, 150, 240, 240); else text(ctx, d.company || d.name, 180, CH / 2, { size: 54, weight: 900, color: "#fff", align: "center", maxW: 300 });
        text(ctx, d.name, CW - 70, 120, { size: 64, weight: 900, color: "#111", maxW: 600 });
        text(ctx, d.role || d.company, CW - 70, 190, { size: 34, weight: 600, color: col, maxW: 600 });
        ctx.fillStyle = col; ctx.fillRect(CW - 170, 232, 100, 6);
        rows(CW - 70, 300, 56, "#333", col);
      } else if (t === "dark") {
        ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = col; ctx.fillRect(0, CH - 14, CW, 14);
        if (logo) drawContain(ctx, logo, 60, 50, 180, 140);
        text(ctx, d.name, CW - 70, 130, { size: 66, weight: 900, color: "#fff", maxW: 680 });
        text(ctx, d.role || d.company, CW - 70, 200, { size: 32, weight: 600, color: col, maxW: 680 });
        rows(CW - 70, 300, 54, "#e5e7eb", col);
      } else if (t === "gradient") {
        const g = ctx.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, col); g.addColorStop(1, col2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
        ctx.globalAlpha = 0.12; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(CW - 80, 60, 260, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (logo) drawContain(ctx, logo, CW / 2 - 70, 40, 140, 110);
        text(ctx, d.name, CW / 2, 215, { size: 66, weight: 900, color: "#fff", align: "center", maxW: 900 });
        text(ctx, [d.role, d.company].filter(Boolean).join(" · "), CW / 2, 285, { size: 32, weight: 600, color: "rgba(255,255,255,.88)", align: "center", maxW: 900 });
        const items = list.slice(0, 4);
        items.forEach(([ic, v], i) => { const col_ = i % 2, row = Math.floor(i / 2); const x = col_ ? 520 : CW - 70; icon(ctx, ic, x - 32, 380 + row * 70 - 16, 30, "#fff"); text(ctx, v, x - 46, 380 + row * 70, { size: 28, color: "#fff", maxW: 410 }); });
      } else if (t === "minimal") {
        if (logo) drawContain(ctx, logo, CW / 2 - 60, 46, 120, 100);
        text(ctx, d.name, CW / 2, 205, { size: 64, weight: 900, color: "#111", align: "center", maxW: 900 });
        text(ctx, d.role || d.company, CW / 2, 270, { size: 30, weight: 500, color: "#666", align: "center", maxW: 900 });
        ctx.fillStyle = col; ctx.fillRect(CW / 2 - 50, 310, 100, 5);
        const line = list.slice(0, 3).map((x) => x[1]).join("   |   ");
        text(ctx, line, CW / 2, 400, { size: 26, color: "#333", align: "center", maxW: 960 });
        if (list[3]) text(ctx, list[3][1], CW / 2, 450, { size: 24, color: "#777", align: "center", maxW: 960 });
      } else if (t === "corner") {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, CH); ctx.lineTo(0, CH - 330); ctx.lineTo(420, CH); ctx.fill();
        ctx.fillStyle = shade(col, 40); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(0, CH); ctx.lineTo(0, CH - 200); ctx.lineTo(260, CH); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(CW, 0); ctx.lineTo(CW - 140, 0); ctx.lineTo(CW, 110); ctx.fill();
        if (logo) drawContain(ctx, logo, 60, 50, 170, 130);
        text(ctx, d.name, CW - 80, 140, { size: 62, weight: 900, color: "#111", maxW: 620 });
        text(ctx, d.role || d.company, CW - 80, 205, { size: 32, weight: 600, color: col, maxW: 620 });
        rows(CW - 80, 300, 54, "#333", col);
      } else {
        // wave
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, CH * 0.62);
        ctx.bezierCurveTo(CW * 0.3, CH * 0.45, CW * 0.6, CH * 0.85, CW, CH * 0.6); ctx.lineTo(CW, CH); ctx.lineTo(0, CH); ctx.fill();
        ctx.fillStyle = shade(col, -35); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(0, CH * 0.75); ctx.bezierCurveTo(CW * 0.35, CH * 0.6, CW * 0.65, CH * 0.95, CW, CH * 0.72); ctx.lineTo(CW, CH); ctx.lineTo(0, CH); ctx.fill(); ctx.globalAlpha = 1;
        if (logo) drawContain(ctx, logo, CW - 200, 40, 140, 110);
        text(ctx, d.name, CW - (logo ? 230 : 70), 100, { size: 58, weight: 900, color: "#111", maxW: 600 });
        text(ctx, d.role || d.company, CW - (logo ? 230 : 70), 160, { size: 30, weight: 600, color: col, maxW: 600 });
        list.slice(0, 4).forEach(([ic, v], i) => { const x = i % 2 ? 500 : CW - 60; const y = 440 + Math.floor(i / 2) * 60; icon(ctx, ic, x - 30, y - 15, 30, "#fff"); text(ctx, v, x - 44, y, { size: 27, color: "#fff", maxW: 400 }); });
      }
      if (!paid) watermark(ctx, CW, CH);
    }
    async function drawCardBack(c, d, paid) {
      await fontsReady;
      d = sample(d, paid);
      if (!paid && !d.company && !d.logo) d = { ...d, company: "نام برند" };
      const ctx = c.getContext("2d"); c.width = CW; c.height = CH;
      const col = d.color || "#ff7a1a", dark = ["dark"].includes(d.tpl), logo = await loadImg(d.logo);
      const bg = d.tpl === "minimal" ? "#fff" : dark ? "#0f1117" : col;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
      if (d.tpl === "gradient") { const g = ctx.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, col); g.addColorStop(1, d.color2 || "#111827"); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH); }
      const fg = d.tpl === "minimal" ? "#111" : "#fff";
      const qr = d.backQr && (d.qrText || d.web || (d.phone && `tel:${BX.enDigits(d.phone)}`));
      const cx = qr ? CW * 0.62 : CW / 2;
      if (logo) drawContain(ctx, logo, cx - 160, 120, 320, 230);
      else text(ctx, d.company || d.name, cx, CH / 2 - 30, { size: 76, weight: 900, color: fg, align: "center", maxW: qr ? 560 : 900 });
      if (d.slogan) text(ctx, d.slogan, cx, 420, { size: 32, weight: 500, color: fg, align: "center", maxW: qr ? 560 : 900 });
      if (qr) { try { await drawQr(ctx, d.qrText ? d.qrText : d.web ? (/^https?:/.test(d.web) ? d.web : `https://${d.web}`) : `tel:${BX.enDigits(d.phone)}`, 90, CH / 2 - 160, 320); } catch (e) { /* too long */ } }
      if (!paid) watermark(ctx, CW, CH);
    }
    STUDIO.register("card", {
      title: "کارت ویزیت چاپی",
      render: (v, param) => STUDIO.open(v, "card", param, cardDefaults, (data, item) => {
        STUDIO.editor(v, {
          kind: "card", title: "کارت ویزیت چاپی", icon: "layout", schema: cardSchema, data, item, deliverText: "(دو فایل PNG با کیفیت ۳۰۰dpi و PDF چاپی ۹×۵ سانتی‌متر)",
          titleOf: (d) => `کارت ویزیت ${d.name || d.company || ""}`.trim(),
          async preview(el, d, paid) {
            if (!el.querySelector("canvas")) el.innerHTML = `<div class="st-cards"><div><small>رو</small><canvas data-f></canvas></div><div><small>پشت</small><canvas data-b></canvas></div></div><p class="muted small center">ابعاد چاپ استاندارد ۹×۵ سانتی‌متر — فایل نهایی بدون واترمارک</p>`;
            await drawCardFront(el.querySelector("[data-f]"), d, paid); await drawCardBack(el.querySelector("[data-b]"), d, paid);
          },
          async exportFile(d) {
            const f = document.createElement("canvas"), b = document.createElement("canvas");
            await drawCardFront(f, d, true); await drawCardBack(b, d, true);
            const name = (d.name || "card").replace(/\s+/g, "-");
            H.download(await canvasBlob(f), `${name}-front.png`);
            setTimeout(async () => H.download(await canvasBlob(b), `${name}-back.png`), 500);
            const fu = f.toDataURL("image/png"), bu = b.toDataURL("image/png");
            BX.modal({ title: "فایل‌ها دانلود شد", body: `<p class="lh">دو فایل PNG (رو و پشت) دانلود شد. برای چاپخانه می‌توانید نسخه PDF هم بگیرید.</p>`, actions: [{ label: "بستن" }, { label: "نسخه PDF چاپی", primary: true, onClick: () => H.printHtml(`<style>.p{width:90mm;height:50mm;page-break-after:always}.p img{width:90mm;height:50mm;display:block}</style><div class="p"><img src="${fu}"></div><div class="p"><img src="${bu}"></div>`, `کارت ویزیت ${d.name || ""}`, "90mm 50mm") }] });
          },
        });
      }),
    });

    // ================================================================ POST / STORY / POSTER
    const SIZES = { post: [1080, 1080, "پست مربعی ۱۰۸۰"], portrait: [1080, 1350, "پست عمودی ۴:۵"], story: [1080, 1920, "استوری / ریلز"], poster: [1240, 1754, "پوستر A4"] };
    const POST_TPL = [["sale", "تخفیف و حراج", "#dc2626"], ["product", "معرفی محصول", "#2563eb"], ["occasion", "تبریک مناسبت", "#7c3aed"], ["announce", "اطلاعیه", "#0f172a"], ["quote", "جمله و نقل‌قول", "#059669"], ["event", "رویداد و وبینار", "#ff7a1a"]];
    const postSchema = [
      { title: "قالب، اندازه و رنگ", icon: "palette", fields: [{ k: "tpl", type: "tpl", label: "قالب", options: POST_TPL }, { k: "size", type: "select", label: "اندازه", options: Object.entries(SIZES).map(([k, v]) => [k, v[2]]) }, { k: "color", type: "color", label: "رنگ اصلی" }, { k: "color2", type: "color", label: "رنگ دوم", swatches: ["#ffa24a", "#facc15", "#38bdf8", "#a78bfa", "#f472b6", "#ffffff", "#111827", "#22c55e"] }] },
      { title: "متن‌ها", icon: "type", fields: [
        { k: "title", label: "تیتر اصلی", span: true, ph: "مثلاً حراج بزرگ پاییزه" }, { k: "subtitle", label: "زیرتیتر", span: true },
        { k: "body", type: "textarea", label: "متن (اختیاری)", span: true }, { k: "badge", label: "برچسب برجسته (مثلاً ۳۰٪ یا جدید)" }, { k: "cta", label: "دکمه / دعوت به اقدام", ph: "مثلاً همین حالا سفارش دهید" },
        { k: "date", label: "تاریخ و ساعت (برای رویداد)" }, { k: "footer", label: "پاورقی (آیدی، شماره، سایت)", dir: "ltr" },
      ] },
      { title: "تصاویر", icon: "image", fields: [{ k: "photo", type: "image", label: "عکس اصلی / محصول", max: 1600 }, { k: "logo", type: "image", label: "لوگو", max: 600 }, { k: "dim", type: "range", label: "تیرگی روی عکس پس‌زمینه", min: 0, max: 80 }] },
    ];
    const postDefaults = () => ({ tpl: "sale", size: "post", color: "#dc2626", color2: "#facc15", title: "حراج بزرگ پاییزه", subtitle: "فقط تا پایان هفته", body: "", badge: "۳۰٪", cta: "همین حالا خرید کنید", date: "", footer: "", photo: "", logo: "", dim: 45 });
    async function drawPost(c, d, paid) {
      await fontsReady;
      const [W, Ht] = SIZES[d.size] || SIZES.post;
      c.width = W; c.height = Ht;
      const ctx = c.getContext("2d");
      const col = d.color || "#ff7a1a", col2 = d.color2 || "#facc15";
      const photo = await loadImg(d.photo), logo = await loadImg(d.logo);
      const pad = W * 0.08, t = d.tpl || "sale";
      const footer = () => { if (d.footer) text(ctx, fa(d.footer), W / 2, Ht - pad * 0.7, { size: W * 0.032, weight: 600, color: "rgba(255,255,255,.9)", align: "center", maxW: W - pad * 2 }); };
      const logoAt = (x, y, s) => logo && drawContain(ctx, logo, x, y, s, s);
      const ctaBtn = (y, bg, fg) => {
        if (!d.cta) return;
        ctx.font = `800 ${W * 0.04}px ${FONT}`;
        const w = Math.min(W - pad * 2, ctx.measureText(d.cta).width + W * 0.12), h = W * 0.095;
        ctx.fillStyle = bg; rrect(ctx, W / 2 - w / 2, y, w, h, h / 2); ctx.fill();
        text(ctx, d.cta, W / 2, y + h / 2, { size: W * 0.04, weight: 800, color: fg, align: "center", maxW: w - 30 });
      };
      if (t === "sale") {
        const g = ctx.createLinearGradient(0, 0, W, Ht); g.addColorStop(0, col); g.addColorStop(1, shade(col, -60)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Ht);
        if (photo) { ctx.globalAlpha = 0.25; drawCover(ctx, photo, 0, 0, W, Ht); ctx.globalAlpha = 1; }
        ctx.fillStyle = "rgba(255,255,255,.08)"; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(W * (i % 3) / 2, Ht * (0.2 + i * 0.15), W * 0.18, 0, 7); ctx.fill(); }
        logoAt(pad, pad * 0.7, W * 0.14);
        if (d.badge) { const r = W * 0.2; ctx.fillStyle = col2; ctx.beginPath(); ctx.arc(W / 2, Ht * 0.3, r, 0, 7); ctx.fill(); text(ctx, fa(d.badge), W / 2, Ht * 0.3, { size: r * 0.62, weight: 900, color: shade(col, -40), align: "center", maxW: r * 1.7 }); }
        const y0 = d.badge ? Ht * 0.3 + W * 0.25 : Ht * 0.28;
        const th = fitTitle(ctx, d.title, W / 2, y0, W - pad * 2, Ht * 0.22, { max: W * 0.11, color: "#fff", align: "center" });
        if (d.subtitle) text(ctx, d.subtitle, W / 2, y0 + th + W * 0.05, { size: W * 0.045, weight: 600, color: col2, align: "center", maxW: W - pad * 2 });
        if (d.body) para(ctx, d.body, W / 2, y0 + th + W * 0.12, { size: W * 0.034, color: "rgba(255,255,255,.9)", align: "center", maxW: W - pad * 2, maxLines: 3 });
        ctaBtn(Ht - pad - W * 0.16, col2, shade(col, -50));
        footer();
      } else if (t === "product") {
        ctx.fillStyle = "#f6f7fb"; ctx.fillRect(0, 0, W, Ht);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(W * 0.5, Ht * 0.36, W * 0.36, 0, 7); ctx.fill();
        ctx.fillStyle = shade(col, 50); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(W * 0.85, Ht * 0.12, W * 0.16, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (photo) drawContain(ctx, photo, W * 0.17, Ht * 0.36 - W * 0.33, W * 0.66, W * 0.66);
        logoAt(W - pad - W * 0.13, pad * 0.6, W * 0.13);
        if (d.badge) { ctx.fillStyle = col2; rrect(ctx, pad, pad * 0.8, W * 0.26, W * 0.1, W * 0.05); ctx.fill(); text(ctx, fa(d.badge), pad + W * 0.13, pad * 0.8 + W * 0.05, { size: W * 0.045, weight: 900, color: "#111", align: "center", maxW: W * 0.22 }); }
        const y0 = Ht * 0.36 + W * 0.42;
        const th = fitTitle(ctx, d.title, W / 2, y0, W - pad * 2, Ht * 0.14, { max: W * 0.085, color: "#111", align: "center" });
        if (d.subtitle) text(ctx, fa(d.subtitle), W / 2, y0 + th + W * 0.04, { size: W * 0.05, weight: 800, color: col, align: "center", maxW: W - pad * 2 });
        if (d.body) para(ctx, d.body, W / 2, y0 + th + W * 0.11, { size: W * 0.032, color: "#555", align: "center", maxW: W - pad * 2, maxLines: 2 });
        ctaBtn(Ht - pad - W * 0.13, col, "#fff");
        if (d.footer) text(ctx, fa(d.footer), W / 2, Ht - pad * 0.55, { size: W * 0.03, weight: 600, color: "#666", align: "center", maxW: W - pad * 2 });
      } else if (t === "occasion") {
        const g = ctx.createRadialGradient(W / 2, Ht * 0.35, 10, W / 2, Ht / 2, Ht * 0.8); g.addColorStop(0, shade(col, 30)); g.addColorStop(1, shade(col, -70)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Ht);
        if (photo) { ctx.globalAlpha = (100 - (d.dim ?? 45)) / 100 * 0.6; drawCover(ctx, photo, 0, 0, W, Ht); ctx.globalAlpha = 1; }
        // confetti / stars
        let seed = (d.title || "x").length * 97;
        const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < 60; i++) { ctx.fillStyle = i % 3 ? col2 : "#fff"; ctx.globalAlpha = 0.25 + rnd() * 0.6; const x = rnd() * W, y = rnd() * Ht, s = 3 + rnd() * W * 0.012; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col2; ctx.lineWidth = W * 0.006; rrect(ctx, pad * 0.6, pad * 0.6, W - pad * 1.2, Ht - pad * 1.2, W * 0.04); ctx.stroke();
        logoAt(W / 2 - W * 0.08, pad * 1.1, W * 0.16);
        const th = fitTitle(ctx, d.title, W / 2, Ht * 0.36, W - pad * 2.4, Ht * 0.24, { max: W * 0.12, color: "#fff", align: "center" });
        if (d.subtitle) text(ctx, d.subtitle, W / 2, Ht * 0.36 + th + W * 0.06, { size: W * 0.048, weight: 700, color: col2, align: "center", maxW: W - pad * 2.4 });
        if (d.body) para(ctx, d.body, W / 2, Ht * 0.36 + th + W * 0.14, { size: W * 0.036, color: "rgba(255,255,255,.92)", align: "center", maxW: W - pad * 2.6, maxLines: 4 });
        footer();
      } else if (t === "announce") {
        ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, W, Ht);
        ctx.fillStyle = col; ctx.fillRect(0, 0, W, W * 0.02); ctx.fillRect(0, Ht - W * 0.02, W, W * 0.02);
        if (photo) { drawCover(ctx, photo, 0, 0, W, Ht * 0.42); const gg = ctx.createLinearGradient(0, Ht * 0.2, 0, Ht * 0.42); gg.addColorStop(0, "rgba(15,17,23,0)"); gg.addColorStop(1, "#0f1117"); ctx.fillStyle = gg; ctx.fillRect(0, Ht * 0.2, W, Ht * 0.23); }
        logoAt(W - pad - W * 0.12, pad * 0.8, W * 0.12);
        const y0 = photo ? Ht * 0.45 : Ht * 0.2;
        if (d.badge) { ctx.fillStyle = col; rrect(ctx, W - pad - W * 0.3, y0, W * 0.3, W * 0.08, W * 0.02); ctx.fill(); text(ctx, d.badge, W - pad - W * 0.15, y0 + W * 0.04, { size: W * 0.036, weight: 800, color: "#fff", align: "center", maxW: W * 0.27 }); }
        const th = fitTitle(ctx, d.title, W - pad, y0 + W * 0.13, W - pad * 2, Ht * 0.2, { max: W * 0.09, color: "#fff", align: "right" });
        if (d.subtitle) text(ctx, d.subtitle, W - pad, y0 + W * 0.13 + th + W * 0.04, { size: W * 0.042, weight: 600, color: col, align: "right", maxW: W - pad * 2 });
        if (d.body) para(ctx, d.body, W - pad, y0 + W * 0.13 + th + W * 0.12, { size: W * 0.034, color: "#d1d5db", align: "right", maxW: W - pad * 2, maxLines: 8, lh: 1.7 });
        ctaBtn(Ht - pad - W * 0.15, col, "#fff");
        footer();
      } else if (t === "quote") {
        ctx.fillStyle = col; ctx.fillRect(0, 0, W, Ht);
        if (photo) { drawCover(ctx, photo, 0, 0, W, Ht); ctx.fillStyle = `rgba(0,0,0,${(d.dim ?? 45) / 100})`; ctx.fillRect(0, 0, W, Ht); }
        text(ctx, "”", W - pad, Ht * 0.22, { size: W * 0.3, weight: 900, color: col2, align: "right" });
        const th = fitTitle(ctx, d.title, W - pad, Ht * 0.32, W - pad * 2, Ht * 0.4, { max: W * 0.085, min: 34, weight: 800, color: "#fff", align: "right", lh: 1.5 });
        if (d.subtitle) { ctx.fillStyle = col2; ctx.fillRect(W - pad - W * 0.08, Ht * 0.32 + th + W * 0.05, W * 0.08, W * 0.008); text(ctx, d.subtitle, W - pad - W * 0.11, Ht * 0.32 + th + W * 0.055, { size: W * 0.04, weight: 600, color: "#fff", align: "right", maxW: W - pad * 3 }); }
        logoAt(pad, Ht - pad - W * 0.12, W * 0.12);
        if (d.footer) text(ctx, fa(d.footer), W - pad, Ht - pad * 0.9, { size: W * 0.03, weight: 600, color: "rgba(255,255,255,.85)", align: "right", maxW: W * 0.6 });
      } else {
        // event
        const g = ctx.createLinearGradient(0, 0, 0, Ht); g.addColorStop(0, "#111827"); g.addColorStop(1, shade(col, -40)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Ht);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.3; ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(W * 0.9, Ht * 0.08, W * 0.06 * (i + 1), 0, 7); ctx.stroke(); } ctx.globalAlpha = 1;
        logoAt(pad, pad * 0.8, W * 0.12);
        if (d.badge) { ctx.fillStyle = col; rrect(ctx, W - pad - W * 0.24, pad, W * 0.24, W * 0.075, W * 0.04); ctx.fill(); text(ctx, d.badge, W - pad - W * 0.12, pad + W * 0.0375, { size: W * 0.034, weight: 800, color: "#fff", align: "center", maxW: W * 0.21 }); }
        const th = fitTitle(ctx, d.title, W - pad, Ht * 0.24, W - pad * 2, Ht * 0.24, { max: W * 0.1, color: "#fff", align: "right" });
        if (d.subtitle) text(ctx, d.subtitle, W - pad, Ht * 0.24 + th + W * 0.05, { size: W * 0.045, weight: 600, color: col, align: "right", maxW: W - pad * 2 });
        if (photo) { const s = W * 0.32; ctx.save(); ctx.beginPath(); ctx.arc(pad + s / 2, Ht * 0.62, s / 2, 0, 7); ctx.clip(); drawCover(ctx, photo, pad, Ht * 0.62 - s / 2, s, s); ctx.restore(); ctx.strokeStyle = col; ctx.lineWidth = W * 0.008; ctx.beginPath(); ctx.arc(pad + s / 2, Ht * 0.62, s / 2, 0, 7); ctx.stroke(); }
        if (d.date) { ctx.fillStyle = "rgba(255,255,255,.08)"; rrect(ctx, W - pad - W * 0.5, Ht * 0.56, W * 0.5, W * 0.16, W * 0.03); ctx.fill(); text(ctx, fa(d.date), W - pad - W * 0.25, Ht * 0.56 + W * 0.08, { size: W * 0.038, weight: 800, color: "#fff", align: "center", maxW: W * 0.46 }); }
        if (d.body) para(ctx, d.body, W - pad, Ht * 0.56 + W * 0.24, { size: W * 0.032, color: "#d1d5db", align: "right", maxW: W * 0.5, maxLines: 5 });
        ctaBtn(Ht - pad - W * 0.15, col, "#fff");
        footer();
      }
      if (!paid) watermark(ctx, W, Ht);
    }
    STUDIO.register("post", {
      title: "پست، استوری و پوستر",
      render: (v, param) => STUDIO.open(v, "post", param, postDefaults, (data, item) => {
        STUDIO.editor(v, {
          kind: "post", title: "پست، استوری و پوستر", icon: "image", schema: postSchema, data, item, deliverText: "(PNG با کیفیت کامل)",
          titleOf: (d) => d.title || "پست",
          async preview(el, d, paid) {
            if (!el.querySelector("canvas")) el.innerHTML = `<div class="st-canvas"><canvas></canvas></div><p class="muted small center">اندازه را عوض کنید تا نسخه استوری و پوستر را هم ببینید.</p>`;
            await drawPost(el.querySelector("canvas"), d, paid);
          },
          async exportFile(d) { const c = document.createElement("canvas"); await drawPost(c, d, true); H.download(await canvasBlob(c), `${(d.title || "post").slice(0, 30)}-${d.size}.png`); },
        });
      }),
    });
  });
})();
