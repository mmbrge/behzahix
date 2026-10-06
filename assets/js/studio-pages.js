/* ==========================================================================
   BEHIX — Studio hosted pages: digital business card and QR menu.
   Built here, served by p.php at /c/<slug>, paid monthly or yearly.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const ready = () => new Promise((ok) => { const t = () => (window.STUDIO ? ok(window.STUDIO) : setTimeout(t, 30)); t(); });

  ready().then((STUDIO) => {
    const H = STUDIO.h;
    // images on hosted pages are uploaded (public files), not inlined
    STUDIO.upload = async (file) => {
      if (!BX.me) throw new Error("برای آپلود تصویر ابتدا وارد شوید.");
      if (file.size > 3 * 1024 * 1024) throw new Error("حجم تصویر حداکثر ۳ مگابایت باشد.");
      const small = await H.readImage(file, 1000);
      const blob = await (await fetch(small)).blob();
      const files = [];
      files.image = new File([blob], /png/.test(small.slice(0, 30)) ? "img.png" : "img.jpg", { type: blob.type });
      const r = await BX.api("a.page.image", {}, files);
      return r.id;
    };
    const SW = ["#ff7a1a", "#2563eb", "#059669", "#7c3aed", "#db2777", "#0f172a", "#b45309", "#dc2626"];
    const SCHEMA = {
      card: [
        { title: "آدرس صفحه و ظاهر", icon: "link", fields: [
          { k: "slug", label: `آدرس صفحه: ${location.host}/c/…`, dir: "ltr", ph: "sara-mohammadi", help: "فقط حروف انگلیسی کوچک، عدد و خط‌تیره" },
          { k: "color", type: "color", label: "رنگ", swatches: SW }, { k: "dark", type: "check", label: "حالت تیره" }, { k: "avatar", type: "image", label: "عکس پروفایل یا لوگو", upload: true },
        ] },
        { title: "معرفی", icon: "user", fields: [{ k: "name", label: "نام" }, { k: "title", label: "سمت / تخصص" }, { k: "company", label: "شرکت / برند" }, { k: "bio", type: "textarea", label: "معرفی کوتاه", span: true }] },
        { title: "راه‌های ارتباطی", icon: "phone", fields: [
          { k: "phone", label: "موبایل", dir: "ltr" }, { k: "phone2", label: "تلفن ثابت", dir: "ltr" }, { k: "whatsapp", label: "واتساپ (شماره یا لینک)", dir: "ltr" }, { k: "email", label: "ایمیل", dir: "ltr" },
          { k: "website", label: "وب‌سایت", dir: "ltr" }, { k: "instagram", label: "اینستاگرام", dir: "ltr" }, { k: "telegram", label: "تلگرام", dir: "ltr" }, { k: "bale", label: "بله", dir: "ltr" },
          { k: "linkedin", label: "لینکدین", dir: "ltr" }, { k: "map", label: "لینک نقشه (گوگل/نشان/بلد)", dir: "ltr" }, { k: "address", label: "آدرس", span: true },
        ] },
        { title: "لینک‌های دلخواه", icon: "link", fields: [{ k: "links", type: "list", label: "دکمه‌ها", add: "افزودن لینک", max: 12, fields: [{ k: "label", label: "عنوان دکمه" }, { k: "url", label: "لینک", dir: "ltr" }] }] },
      ],
      menu: [
        { title: "آدرس صفحه و ظاهر", icon: "link", fields: [
          { k: "slug", label: `آدرس منو: ${location.host}/c/…`, dir: "ltr", ph: "cafe-nova", help: "فقط حروف انگلیسی کوچک، عدد و خط‌تیره" },
          { k: "color", type: "color", label: "رنگ", swatches: SW }, { k: "dark", type: "check", label: "حالت تیره" }, { k: "logo", type: "image", label: "لوگو", upload: true },
        ] },
        { title: "اطلاعات مجموعه", icon: "building", fields: [{ k: "name", label: "نام کافه / رستوران" }, { k: "intro", label: "شعار یا توضیح کوتاه" }, { k: "hours", label: "ساعات کاری" }, { k: "phone", label: "تلفن", dir: "ltr" }, { k: "address", label: "آدرس", span: true }, { k: "instagram", label: "اینستاگرام", dir: "ltr" }, { k: "unit", type: "select", label: "واحد قیمت", options: [["تومان", "تومان"], ["هزار تومان", "هزار تومان"]] }] },
        { title: "دسته‌ها و آیتم‌ها", icon: "list", fields: [{ k: "cats", type: "list", label: "دسته‌ها", add: "افزودن دسته", max: 30, fields: [
          { k: "title", label: "نام دسته (مثلاً نوشیدنی گرم)", span: true },
          { k: "items", type: "list", label: "آیتم‌ها", add: "افزودن آیتم", max: 60, fields: [
            { k: "name", label: "نام" }, { k: "price", label: "قیمت", dir: "ltr" }, { k: "desc", label: "توضیح کوتاه", span: true }, { k: "tag", label: "برچسب (پیشنهاد سرآشپز، جدید…)" }, { k: "off", type: "check", label: "ناموجود" }, { k: "img", type: "image", label: "عکس", upload: true },
          ] },
        ] }] },
      ],
    };
    const DEFAULTS = {
      card: () => ({ slug: "", color: "#ff7a1a", dark: false, avatar: "", name: BX.me?.name || "", title: "", company: "", bio: "", phone: BX.me?.phone || "", phone2: "", whatsapp: "", email: "", website: "", instagram: "", telegram: "", bale: "", linkedin: "", map: "", address: "", links: [] }),
      menu: () => ({ slug: "", color: "#b45309", dark: false, logo: "", name: "", intro: "", hours: "", phone: "", address: "", instagram: "", unit: "تومان",
        cats: [{ title: "نوشیدنی گرم", items: [{ name: "اسپرسو", price: "85000", desc: "", tag: "", off: false, img: "" }, { name: "کاپوچینو", price: "120000", desc: "", tag: "محبوب", off: false, img: "" }] },
          { title: "کیک و دسر", items: [{ name: "چیزکیک", price: "150000", desc: "", tag: "", off: false, img: "" }] }] }),
    };
    const TITLE = { card: "کارت ویزیت دیجیتال", menu: "منوی QR کافه و رستوران" };

    async function editor(v, kind, param) {
      let page = null, prices = { month: 0, year: 0 }, data;
      const p = STUDIO.S.info?.prices || {};
      prices = kind === "card" ? { month: p.pageCardMonth, year: p.pageCardYear } : { month: p.pageMenuMonth, year: p.pageMenuYear };
      if (param && /^\d+$/.test(param) && BX.me) {
        try { const r = await BX.api("a.page.get", { id: param }); page = r.page; data = { ...r.page.data, slug: r.page.slug }; prices = r.prices; } catch (e) { BX.toast(e.message, "bad"); }
      }
      if (!data && !param && BX.me) {
        // reopen the user's existing page of this type
        try { const l = await BX.api("a.studio.list"); const mine = l.pages.find((x) => x.kind === kind); if (mine) { location.hash = `page-${kind}/${mine.id}`; return; } } catch (e) { /* new page */ }
      }
      data = data || STUDIO.loadDraft(`page-${kind}`) || DEFAULTS[kind]();
      const schema = SCHEMA[kind];
      v.innerHTML = `
        <div class="st-top card">
          <a class="icon-btn" href="#" aria-label="بازگشت">${BX.icon("arrow-right")}</a><span class="st-top-ic">${BX.icon(kind === "card" ? "user" : "list")}</span>
          <div class="grow"><b>${TITLE[kind]}</b><small class="muted d-block" data-pg-status></small></div>
          <button type="button" class="btn btn-primary btn-sm" data-pg="save">${BX.icon("check")} ذخیره و انتشار</button>
        </div>
        <div class="st-edit">
          <div class="st-form card" data-st-form>${STUDIO.form.render(schema, data)}</div>
          <div class="st-preview">
            <div class="st-phone"><iframe name="pgprev-${kind}" title="پیش‌نمایش" loading="lazy"></iframe></div>
            <form method="post" action="p.php" target="pgprev-${kind}" data-pf hidden><input name="preview" value="1"><input name="kind" value="${kind}"><input name="data"></form>
            <div class="card st-pgbox" data-pg-box></div>
          </div>
        </div>`;
      const formEl = v.querySelector("[data-st-form]");
      const pf = v.querySelector("[data-pf]");
      const refresh = H.debounce(() => { pf.elements.data.value = JSON.stringify(data); pf.submit(); }, 400);
      const autosave = H.debounce(() => STUDIO.saveDraft(`page-${kind}`, data), 600);
      STUDIO.form.bind(formEl, schema, data, () => { refresh(); autosave(); });
      refresh();
      const box = v.querySelector("[data-pg-box]");
      const status = v.querySelector("[data-pg-status]");
      function paintBox() {
        if (!page) {
          status.textContent = `${H.fa(STUDIO.S.info?.trialDays || 0)} روز آزمایش رایگان، سپس ${BX.toman(prices.month || 0)} در ماه`;
          box.innerHTML = `<p class="small lh">${BX.icon("info")} بعد از «ذخیره و انتشار»، صفحه شما با آدرس اختصاصی فعال می‌شود${STUDIO.S.info?.trialDays ? ` و ${H.fa(STUDIO.S.info.trialDays)} روز رایگان است` : ""}. هر زمان می‌توانید اطلاعات و قیمت‌ها را تغییر دهید.</p>`;
          return;
        }
        const left = page.expiresAt ? Math.ceil((page.expiresAt - Date.now()) / 864e5) : 0;
        status.innerHTML = page.active ? `فعال تا ${BX.date(page.expiresAt)} (${H.fa(Math.max(0, left))} روز) · ${H.fa(page.views)} بازدید` : `<span class="bad">غیرفعال — اشتراک را فعال کنید</span>`;
        box.innerHTML = `
          <div class="row-between"><b>آدرس صفحه</b>${page.active ? '<span class="badge badge--ok">فعال</span>' : '<span class="badge badge--bad">غیرفعال</span>'}</div>
          <div class="st-url"><a href="${H.esc(page.url)}" target="_blank" rel="noopener" dir="ltr">${H.esc(page.url.replace(/^https?:\/\//, ""))}</a><button type="button" class="btn btn-ghost btn-xs" data-pg="copy">کپی</button></div>
          <div class="st-plans">
            <button type="button" class="st-plan" data-pg="buy" data-plan="month"><b>ماهانه</b><span>${BX.toman(prices.month || 0)}</span></button>
            <button type="button" class="st-plan is-best" data-pg="buy" data-plan="year"><b>سالانه</b><span>${BX.toman(prices.year || 0)}</span><small>${prices.month ? `${H.fa(Math.max(0, Math.round((1 - prices.year / (prices.month * 12)) * 100)))}٪ صرفه‌جویی` : ""}</small></button>
          </div>
          <div class="st-qr"><canvas data-qr width="600" height="600"></canvas><div>
            <p class="small lh">این QR را روی ${kind === "menu" ? "میزها، ویترین و منوی چاپی" : "کارت ویزیت، ویترین و امضای ایمیل"} قرار دهید؛ با اسکن، صفحه شما باز می‌شود.</p>
            <div class="row"><button type="button" class="btn btn-ghost btn-xs" data-pg="qr">${BX.icon("download")} QR (PNG)</button>${kind === "menu" ? `<button type="button" class="btn btn-ghost btn-xs" data-pg="table">${BX.icon("file")} کارت روی میز</button>` : ""}</div></div></div>`;
        const c = box.querySelector("[data-qr]");
        STUDIO.qr?.drawQr(c.getContext("2d"), page.url, 0, 0, 600).catch(() => {});
      }
      paintBox();
      v.onclick = async (e) => {
        const b = e.target.closest("[data-pg]");
        if (!b) return;
        const act = b.dataset.pg;
        if (act === "save") {
          if (!BX.me) { STUDIO.saveDraft(`page-${kind}`, data); location.href = `auth.html?next=${encodeURIComponent(`studio.html#page-${kind}`)}`; return; }
          if (!String(data.slug || "").trim()) return BX.toast("آدرس صفحه را وارد کنید (مثلاً cafe-nova).", "bad");
          if (!String(data.name || "").trim()) return BX.toast("نام را وارد کنید.", "bad");
          try {
            const { slug, ...rest } = data;
            const r = await BX.api("a.page.save", { id: page?.id || 0, kind, slug: String(slug).trim().toLowerCase(), title: data.name, data: rest });
            page = r.page;
            history.replaceState(null, "", `#page-${kind}/${page.id}`);
            BX.toast(page.active ? "صفحه ذخیره و منتشر شد." : "ذخیره شد؛ برای انتشار اشتراک را فعال کنید.", "ok");
            paintBox();
          } catch (err) { BX.toast(err.message, "bad"); }
        }
        if (act === "copy") navigator.clipboard?.writeText(page.url).then(() => BX.toast("آدرس کپی شد.", "ok"));
        if (act === "buy") {
          try {
            const r = await BX.api("a.page.buy", { id: page.id, plan: b.dataset.plan });
            if (r.redirect) { location.href = r.redirect; return; }
            const g = await BX.api("a.page.get", { id: page.id }); page = g.page; paintBox();
            BX.toast("اشتراک فعال شد.", "ok");
          } catch (err) { BX.toast(err.message, "bad"); }
        }
        if (act === "qr") box.querySelector("[data-qr]").toBlob((bl) => H.download(bl, `${page.slug}-qr.png`));
        if (act === "table") {
          const q = box.querySelector("[data-qr]").toDataURL("image/png");
          H.printHtml(`<style>.t{width:100mm;height:148mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6mm;border:2mm solid ${data.color || "#b45309"};border-radius:6mm;margin:5mm auto;text-align:center}
            .t h1{font-size:22pt;margin:0}.t p{font-size:12pt;margin:0;color:#555}.t img{width:62mm;height:62mm}.t b{font-size:10pt;color:${data.color || "#b45309"}}</style>
            <div class="t"><h1>${H.esc(data.name || "")}</h1><p>برای دیدن منو اسکن کنید</p><img src="${q}"><b dir="ltr">${H.esc(page.url.replace(/^https?:\/\//, ""))}</b></div>`, `کارت میز ${data.name || ""}`, "A6");
        }
      };
    }
    STUDIO.register("page-card", { title: "کارت ویزیت دیجیتال", render: (v, param) => editor(v, "card", param) });
    STUDIO.register("page-menu", { title: "منوی QR کافه و رستوران", render: (v, param) => editor(v, "menu", param) });
  });
})();
