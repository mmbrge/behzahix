/* ==========================================================================
   BEHIX — «X PRO» in the panel: plans and purchase for users; members,
   revenue, manual grants and plan/quota settings for the admin.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;
  const { icon, esc, faDigits, toman } = BX;
  const name = () => BX.settings.pro?.name || "X PRO";

  BXD.routes.pro = () => `<div data-pro-panel><div class="card box skeleton" style="height:360px"></div></div>`;

  const FEATURES = [
    ["فایل نهایی استودیو (رزومه، کارت، پست، سند، پاورپوینت)", "خرید تکی", "studio", "studioBiz"],
    ["ویرایش طرح‌های خریداری‌شده", "—", "نامحدود", "نامحدود"],
    ["کارت ویزیت دیجیتال (صفحه شخصی + QR)", "اشتراک جدا", "رایگان", "رایگان"],
    ["منوی دیجیتال QR کافه و رستوران", "اشتراک جدا", "—", "رایگان"],
    ["بررسی سئوی سایت", "q:seo", "q:seo", "q:seo"],
    ["کوتاه‌کننده لینک با آمار", "q:short", "q:short", "q:short"],
    ["ایده نام برند", "q:names", "q:names", "q:names"],
    ["ساخت فاوآیکن", "q:favicon", "q:favicon", "q:favicon"],
    ["تخفیف خرید از فروشگاه", "—", "disc", "disc"],
    ["نشان PRO کنار نام و زیر لوگو", "—", "✓", "✓"],
  ];
  async function userView(el) {
    const r = await BX.api("pro.info");
    const me = r.me || {};
    const q = (k, pro) => { const x = r.quotas[k]; if (!x) return "—"; const n = pro ? x.proLimit : x.free; return n > 0 ? `${faDigits(n)} بار در هفته` : "نامحدود"; };
    const cell = (v, col) => {
      if (v === "studio") return `${faDigits(r.studioFiles)} فایل در ماه`;
      if (v === "studioBiz") return `${faDigits(r.studioFilesBiz)} فایل در ماه`;
      if (v === "disc") return `${faDigits(r.discount)}٪`;
      if (String(v).startsWith("q:")) return q(v.slice(2), col > 0);
      return esc(v);
    };
    const monthly = (p) => Math.round(p.price / p.months);
    el.innerHTML = `<div class="dash-grid">
      <div class="pro-hero card ${me.active ? "is-active" : ""}">
        <div class="pro-hero-mark">${icon("crown")}<b>${esc(name())}</b></div>
        <div class="grow">${me.active
          ? `<h2>اشتراک ${esc(name())}${me.business ? " Business" : ""} شما فعال است</h2><p class="muted">تا ${BX.date(me.until)} (${faDigits(me.days)} روز دیگر) · ${faDigits(r.studioLeft ?? 0)} فایل استودیو در این ماه باقی مانده</p>`
          : `<h2>با ${esc(name())} همه‌چیز را بدون محدودیت بسازید</h2><p class="muted">فایل‌های استودیو، ویرایش نامحدود طرح‌ها، کارت ویزیت دیجیتال، ابزارهای ویژه و نشان PRO کنار نام شما — ارزان‌تر از خرید تکی.</p>`}</div>
      </div>
      <div class="pro-plans">${r.plans.map((p, i) => `
        <div class="pro-plan card ${p.note ? "is-best" : ""} ${p.business ? "is-biz" : ""}" style="--d:${i * 60}ms">
          ${p.note ? `<span class="pro-plan-note">${esc(p.note)}</span>` : ""}
          <h3>${esc(p.title)}</h3>
          <div class="pro-plan-price">${p.old ? `<s>${toman(p.old)}</s>` : ""}<b>${toman(p.price)}</b><small>${p.months > 1 ? `ماهی ${toman(monthly(p))}` : "ماهانه"}</small></div>
          <ul>${(p.business ? [`${faDigits(r.studioFilesBiz)} فایل استودیو در ماه`, "منوی QR + کارت دیجیتال", "همه امکانات PRO"] : [`${faDigits(r.studioFiles)} فایل استودیو در ماه`, "ویرایش نامحدود طرح‌ها", "کارت ویزیت دیجیتال رایگان"]).map((x) => `<li>${icon("check")}${x}</li>`).join("")}</ul>
          <button class="btn ${p.note ? "btn-primary" : "btn-ghost"} btn-block" data-act="pro-buy" data-plan="${esc(p.id)}">${me.active ? "تمدید" : "خرید"} ${icon("arrow")}</button>
        </div>`).join("")}</div>
      ${BXD.ui.box("مقایسه امکانات", "list", `<div class="table-wrap"><table class="table pro-compare"><thead><tr><th>امکان</th><th>رایگان</th><th>${esc(name())}</th><th>Business</th></tr></thead><tbody>
        ${FEATURES.map(([l, ...cols]) => `<tr><td>${esc(l)}</td>${cols.map((v, i) => `<td>${cell(v, i)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`)}
      ${BXD.ui.box("استفاده این هفته شما از ابزارهای ویژه", "zap", `<div class="pro-usage">${Object.values(r.quotas).map((x) => `<div><span>${esc(x.title)}</span>${x.limit > 0 ? `<div class="track"><span class="fill" style="display:block;width:${Math.min(100, (x.used / x.limit) * 100)}%"></span></div><small class="muted">${faDigits(x.used)} از ${faDigits(x.limit)}</small>` : `<small class="muted">${faDigits(x.used)} بار — نامحدود</small>`}</div>`).join("")}</div>`)}
    </div>`;
  }

  async function adminView(el) {
    const [r, info] = await Promise.all([BX.api("a.pro.members"), BX.api("pro.info")]);
    const s = BXD.S?.settings?.pro || null;
    const cfg = s || { enabled: info.enabled, name: info.name, plans: info.plans, studioFiles: info.studioFiles, studioFilesBiz: info.studioFilesBiz, discount: info.discount,
      freeQuota: Object.fromEntries(Object.entries(info.quotas).map(([k, x]) => [k, x.free])), proQuota: Object.fromEntries(Object.entries(info.quotas).map(([k, x]) => [k, x.proLimit])) };
    const { box, tile, table } = BXD.ui;
    const usage = Object.fromEntries((r.usage || []).map((u) => [u.k, Number(u.n)]));
    const titles = Object.fromEntries(Object.entries(info.quotas).map(([k, x]) => [k, x.title]));
    el.innerHTML = `<div class="dash-grid">
      <div class="tiles">${tile("اعضای فعال", faDigits(r.members.length), "crown")}${tile("درآمد اشتراک (۳۰ روز)", toman(r.revenue30), "trend")}${tile("فایل‌های استودیو با اشتراک", faDigits(usage["studio-file"] || 0), "sparkles", "۳۰ روز اخیر")}${tile("استفاده از ابزارها", faDigits(Object.entries(usage).filter(([k]) => k.startsWith("tool:")).reduce((a, [, n]) => a + n, 0)), "zap", "۳۰ روز اخیر")}</div>
      ${box("طرح‌ها و قیمت‌ها", "tag", `<form class="form-grid" data-pro-form>
        <div class="form-grid form-grid-2"><label class="switch"><input type="checkbox" name="enabled" ${cfg.enabled ? "checked" : ""}><span class="track"></span>فروش اشتراک فعال است</label>
          <div class="field"><label class="field-label">نام اشتراک</label><input class="input" name="name" value="${esc(cfg.name)}"></div></div>
        <div class="pro-plan-rows" data-plans>${cfg.plans.map(planRow).join("")}</div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="pro-plan-add">${icon("plus")} طرح جدید</button>
        <div class="form-grid form-grid-2">
          <div class="field"><label class="field-label">فایل استودیو در ماه (PRO)</label><input class="input" name="studioFiles" dir="ltr" value="${faDigits(cfg.studioFiles)}"></div>
          <div class="field"><label class="field-label">فایل استودیو در ماه (Business)</label><input class="input" name="studioFilesBiz" dir="ltr" value="${faDigits(cfg.studioFilesBiz)}"></div>
          <div class="field"><label class="field-label">تخفیف اعضا روی محصولات فروشگاه (٪)</label><input class="input" name="discount" dir="ltr" value="${faDigits(cfg.discount)}"></div></div>
        <h4 class="mt-2">سهمیه هفتگی ابزارهای ویژه <small class="muted">(۰ = نامحدود)</small></h4>
        <div class="table-wrap"><table class="table"><thead><tr><th>ابزار</th><th>کاربر رایگان</th><th>عضو PRO</th></tr></thead><tbody>${Object.keys(cfg.freeQuota).map((k) => `<tr><td>${esc(titles[k] || k)}</td><td><input class="input input-sm" dir="ltr" name="free.${k}" value="${faDigits(cfg.freeQuota[k])}"></td><td><input class="input input-sm" dir="ltr" name="pro.${k}" value="${faDigits(cfg.proQuota[k])}"></td></tr>`).join("")}</tbody></table></div>
        <button class="btn btn-primary" type="submit">${icon("check")} ذخیره</button></form>`)}
      <div class="dash-grid dash-grid-2">
        ${box("فعال‌سازی دستی", "user", `<form class="form-grid" data-pro-grant><div class="field"><label class="field-label">موبایل کاربر</label><input class="input" name="phone" dir="ltr" placeholder="09120000000"></div>
          <div class="form-grid form-grid-2"><div class="field"><label class="field-label">چند ماه (۰ = لغو)</label><input class="input" name="months" dir="ltr" value="۱"></div><label class="switch"><input type="checkbox" name="business"><span class="track"></span>Business</label></div>
          <button class="btn btn-primary btn-sm" type="submit">${icon("crown")} اعمال</button></form>`)}
        ${box("اعضای فعال", "crown", table(["کاربر", "تا", ""], r.members.map((m) => `<tr><td><b>${esc(m.name)}</b> ${m.business ? '<span class="pro-badge">BIZ</span>' : '<span class="pro-badge">PRO</span>'}<br><small class="muted" dir="ltr">${faDigits(m.phone)}</small></td><td>${BX.date(m.until)}</td><td><button class="btn btn-ghost btn-xs" data-act="pro-cancel" data-id="${m.id}">لغو</button></td></tr>`), "هنوز عضوی ندارید."))}
      </div>
    </div>`;
    BXD.labelTables?.(el);
    el.querySelector("[data-pro-form]").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target, n = (x) => Number(BX.enDigits(String(x || "0")).replace(/[^\d]/g, "")) || 0;
      const plans = [...f.querySelectorAll(".pro-plan-row")].map((row) => { const g = (k) => row.querySelector(`[name="${k}"]`); return { id: g("id").value, title: g("title").value, months: n(g("months").value), price: n(g("price").value), old: n(g("old").value), note: g("note").value, business: g("business").checked }; });
      const freeQuota = {}, proQuota = {};
      for (const k of Object.keys(cfg.freeQuota)) { freeQuota[k] = n(f.elements[`free.${k}`].value); proQuota[k] = n(f.elements[`pro.${k}`].value); }
      BX.api("a.settings.save", { group: "pro", value: { enabled: f.elements.enabled.checked, name: f.elements.name.value, plans, studioFiles: n(f.elements.studioFiles.value), studioFilesBiz: n(f.elements.studioFilesBiz.value), discount: n(f.elements.discount.value), freeQuota, proQuota } })
        .then((x) => BX.toast(x.message || "ذخیره شد.", "ok")).catch((e) => BX.toast(e.message, "bad"));
    });
    el.querySelector("[data-pro-grant]").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.target.elements;
      BX.api("a.pro.grant", { phone: f.phone.value, months: BX.enDigits(f.months.value), business: f.business.checked }).then((x) => { BX.toast(x.message, "ok"); load(); }).catch((e) => BX.toast(e.message, "bad"));
    });
  }
  const planRow = (p = {}) => `<div class="pro-plan-row"><input type="hidden" name="id" value="${esc(p.id || "")}">
    <input class="input input-sm" name="title" placeholder="عنوان" value="${esc(p.title || "")}"><input class="input input-sm" name="months" dir="ltr" placeholder="ماه" value="${faDigits(p.months || 1)}">
    <input class="input input-sm" name="price" dir="ltr" placeholder="قیمت" value="${faDigits(p.price || "")}"><input class="input input-sm" name="old" dir="ltr" placeholder="قیمت خط‌خورده" value="${p.old ? faDigits(p.old) : ""}">
    <input class="input input-sm" name="note" placeholder="برچسب (مثلاً محبوب‌ترین)" value="${esc(p.note || "")}"><label class="switch switch-sm"><input type="checkbox" name="business" ${p.business ? "checked" : ""}><span class="track"></span>Biz</label>
    <button type="button" class="icon-btn icon-btn-sm" data-act="pro-plan-del" aria-label="حذف">${icon("trash")}</button></div>`;

  const box = () => document.querySelector("[data-pro-panel]");
  const load = () => { const el = box(); if (!el) return; (BXD.me.role === "admin" ? adminView(el) : userView(el)).catch((e) => { el.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(e.message)}</p></div>`; }); };
  const prevAfter = BXD.afterRender;
  BXD.afterRender = (view, id, param) => { if (prevAfter) prevAfter(view, id, param); if (view.querySelector("[data-pro-panel]")) load(); };
  Object.assign(BXD.acts, {
    "pro-buy": (b) => BX.api("a.pro.buy", { plan: b.dataset.plan }).then((r) => {
      if (r.redirect) { location.href = r.redirect; return; }
      BX.toast(`اشتراک ${name()} فعال شد!`, "ok");
      setTimeout(() => location.reload(), 900);
    }).catch((e) => BX.toast(e.message, "bad")),
    "pro-plan-add": () => box().querySelector("[data-plans]").insertAdjacentHTML("beforeend", planRow()),
    "pro-plan-del": (b) => b.closest(".pro-plan-row").remove(),
    "pro-cancel": (b) => BXD.ui.confirmBox("لغو اشتراک", "اشتراک این کاربر همین حالا لغو می‌شود.", () => BX.api("a.pro.grant", { userId: b.dataset.id, months: 0 }).then((r) => { BX.toast(r.message, "ok"); load(); }), "لغو اشتراک"),
  });
})();
