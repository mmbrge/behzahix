/* ==========================================================================
   BEHIX — panel side of the studio: «ساخته‌های من» for every user and the
   admin view (sales, hosted pages, document templates).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;
  const { icon, esc, faDigits, ago, toman } = BX;
  const ROUTE = { resume: "resume", card: "card", post: "post", doc: "doc", slides: "slides" };
  const KIND_ICON = { resume: "file", card: "layout", post: "image", doc: "book", slides: "presentation" };

  BXD.routes.studio = () => `<div data-studio-panel><div class="card box skeleton" style="height:320px"></div></div>`;

  async function mine(el) {
    const { box, table } = BXD.ui;
    const r = await BX.api("a.studio.list");
    el.innerHTML = `<div class="dash-grid">
      <div class="banner banner--info">${icon("sparkles")}<span>هر چیزی در <a class="brand" href="studio.html">استودیو</a> بسازید اینجا ذخیره می‌شود؛ فایل‌های خریداری‌شده را هر زمان دوباره ویرایش و دانلود کنید.</span></div>
      ${box("صفحه‌های من", "globe", r.pages.length ? `<div class="sp-pages">${r.pages.map((p) => `
        <div class="sp-page"><span class="cell-icon">${icon(p.kind === "menu" ? "list" : "user")}</span>
          <div class="grow"><b>${esc(p.title || p.slug)}</b> ${p.active ? '<span class="badge badge--ok">فعال</span>' : '<span class="badge badge--bad">غیرفعال</span>'}<br>
          <small class="muted">${esc(p.kindTitle)} · <a dir="ltr" class="brand" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url.replace(/^https?:\/\//, ""))}</a> · ${faDigits(p.views)} بازدید${p.expiresAt ? ` · تا ${BX.date(p.expiresAt)}` : ""}</small></div>
          <a class="btn btn-ghost btn-xs" href="studio.html#page-${p.kind}/${p.id}">${icon("edit")} ویرایش و تمدید</a></div>`).join("")}</div>`
        : `<p class="muted small">هنوز صفحه‌ای نساخته‌اید. <a class="brand" href="studio.html#page-card">کارت ویزیت دیجیتال</a> یا <a class="brand" href="studio.html#page-menu">منوی QR</a> بسازید.</p>`)}
      ${box("طرح‌ها و فایل‌ها", "layers", table(["طرح", "نوع", "وضعیت", "آخرین تغییر", ""], r.items.map((i) => `<tr>
          <td><span class="cell-icon">${icon(KIND_ICON[i.kind] || "file")}</span> <b>${esc(i.title)}</b></td><td>${esc(i.kindTitle)}</td>
          <td>${i.paid ? '<span class="badge badge--ok">خریداری شده</span>' : '<span class="badge">پیش‌نویس</span>'}</td><td class="muted">${ago(i.updatedAt)}</td>
          <td><div class="actions"><a class="btn ${i.paid ? "btn-primary" : "btn-ghost"} btn-xs" href="studio.html#${ROUTE[i.kind]}/${i.id}">${icon(i.paid ? "download" : "edit")} ${i.paid ? "باز کردن و دانلود" : "ادامه"}</a>
            ${i.paid ? "" : `<button class="icon-btn icon-btn-sm" data-act="studio-del" data-id="${i.id}" aria-label="حذف">${icon("trash")}</button>`}</div></td></tr>`), "هنوز طرحی نساخته‌اید."),
        `<a class="btn btn-primary btn-sm" href="studio.html">${icon("plus")} ساخت جدید</a>`)}
    </div>`;
    BXD.labelTables?.(el);
  }

  async function admin(el, param) {
    const { box, table, tile } = BXD.ui;
    const r = await BX.api("a.studio.admin");
    const total = Object.values(r.byKind).reduce((s, x) => s + x.total, 0);
    const n = Object.values(r.byKind).reduce((s, x) => s + x.n, 0);
    const activePages = r.pages.filter((p) => p.active).length;
    const tabsHtml = `<div class="tabs-row">${[["", "فروش", "chart"], ["pages", "صفحه‌ها", "globe"], ["docs", "قالب‌های سند", "book"]].map(([id, l, ic]) => `<a class="tab-link ${id === (param || "") ? "is-active" : ""}" href="#studio${id ? `/${id}` : ""}">${icon(ic)}${l}</a>`).join("")}<a class="tab-link" href="#settings/studio">${icon("settings")}قیمت‌ها</a><a class="tab-link" href="studio.html" target="_blank">${icon("external")}مشاهده استودیو</a></div>`;
    if (param === "pages") {
      el.innerHTML = tabsHtml + box("صفحه‌های میزبانی‌شده", "globe", table(["صفحه", "نوع", "صاحب", "بازدید", "وضعیت", ""], r.pages.map((p) => `<tr>
        <td><a class="brand" dir="ltr" href="${esc(p.url)}" target="_blank" rel="noopener">/c/${esc(p.slug)}</a><br><small class="muted">${esc(p.title)}</small></td><td>${esc(p.kindTitle)}</td><td>${esc(p.user)}</td><td>${faDigits(p.views)}</td>
        <td>${p.active ? `<span class="badge badge--ok">فعال تا ${BX.date(p.expiresAt)}</span>` : '<span class="badge badge--bad">غیرفعال</span>'}</td>
        <td><button class="icon-btn icon-btn-sm" data-act="page-del" data-id="${p.id}" aria-label="حذف">${icon("trash")}</button></td></tr>`), "هنوز صفحه‌ای ساخته نشده."));
    } else if (param === "docs") {
      el.innerHTML = tabsHtml + box("قالب‌های قرارداد و سند", "book", `<p class="field-hint mb-2">هر قالب جدید مستقیماً به استودیو اضافه می‌شود و قابل فروش است. در متن، هر جای خالی را با {{نام فیلد}} مشخص کنید؛ فرم مشتری خودکار ساخته می‌شود.</p>
        ${table(["عنوان", "دسته", "فیلدها", "قیمت", "وضعیت", ""], r.docs.map((d) => `<tr><td><b>${esc(d.title)}</b><br><small class="muted">${esc(d.desc)}</small></td><td>${esc(d.category)}</td>
          <td>${faDigits(new Set([...d.body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1])).size)}</td><td>${d.price == null ? '<span class="muted">پیش‌فرض</span>' : toman(d.price)}</td>
          <td>${d.active ? '<span class="badge badge--ok">فعال</span>' : '<span class="badge">غیرفعال</span>'}</td>
          <td><div class="actions"><button class="btn btn-ghost btn-xs" data-act="doctpl-edit" data-id="${d.id}">${icon("edit")} ویرایش</button><button class="icon-btn icon-btn-sm" data-act="doctpl-del" data-id="${d.id}" aria-label="حذف">${icon("trash")}</button></div></td></tr>`), "قالبی نیست.")}`,
        `<button class="btn btn-primary btn-sm" data-act="doctpl-edit" data-id="0">${icon("plus")} قالب جدید</button>`);
      ST.docs = r.docs;
    } else {
      el.innerHTML = tabsHtml + `<div class="dash-grid">
        <div class="tiles">${tile("فروش استودیو", toman(total), "trend", `${faDigits(n)} فایل فروخته شده`)}${tile("صفحه‌های فعال", faDigits(activePages), "globe", `از ${faDigits(r.pages.length)} صفحه`)}${tile("پیش‌نویس‌ها", faDigits(r.drafts), "edit", "مشتری بالقوه برای پیگیری")}${tile("پرفروش‌ترین", esc((r.kinds[Object.entries(r.byKind).sort((a, b) => b[1].n - a[1].n)[0]?.[0]] || "—")), "award")}</div>
        ${box("فروش به تفکیک محصول", "chart", `<ul class="hbars">${Object.entries(r.kinds).map(([k, l]) => { const x = r.byKind[k] || { n: 0, total: 0 }; return `<li><span>${esc(l)}<br><small class="muted">${toman(x.total)}</small></span><span class="track"><span class="fill" style="display:block;width:${n ? (x.n / n) * 100 : 0}%"></span></span><b>${faDigits(x.n)}</b></li>`; }).join("")}</ul>`)}
        ${box("آخرین خریدها", "list", table(["طرح", "نوع", "خریدار", "مبلغ", "زمان"], r.sold.map((s) => `<tr><td>${esc(s.title)}</td><td>${esc(s.kindTitle)}</td><td>${esc(s.user)} <small class="muted" dir="ltr">${faDigits(s.phone)}</small></td><td>${toman(s.price)}</td><td class="muted">${ago(s.paidAt)}</td></tr>`), "هنوز فروشی ثبت نشده."))}
      </div>`;
    }
    BXD.labelTables?.(el);
  }
  const ST = { docs: [] };
  function docModal(d) {
    BX.modal({
      title: d ? "ویرایش قالب سند" : "قالب سند جدید", wide: true,
      body: `<form class="form-grid form-grid-2" id="doctpl-form">
        <div class="field"><label class="field-label">عنوان</label><input class="input" name="title" value="${esc(d?.title || "")}"></div>
        <div class="field"><label class="field-label">دسته (قرارداد، مالی، اداری…)</label><input class="input" name="category" value="${esc(d?.category || "")}"></div>
        <div class="field span-2"><label class="field-label">توضیح کوتاه</label><input class="input" name="desc" value="${esc(d?.desc || "")}"></div>
        <div class="field"><label class="field-label">قیمت اختصاصی (خالی = قیمت پیش‌فرض اسناد)</label><input class="input" name="price" dir="ltr" value="${d?.price ?? ""}"></div>
        <div class="field"><label class="field-label">ترتیب</label><input class="input" name="sort" dir="ltr" value="${d?.sort ?? 0}"></div>
        <div class="field span-2"><label class="field-label">متن قالب (HTML ساده؛ جاهای خالی: {{نام فیلد}})</label><textarea class="textarea code-area tall" name="body" spellcheck="false">${esc(d?.body || "<h2 style=\"text-align:center\">عنوان سند</h2>\n<p>اینجانب {{نام و نام خانوادگی}} …</p>")}</textarea></div>
        <label class="switch"><input type="checkbox" name="active" ${d?.active !== false ? "checked" : ""}><span class="track"></span>فعال در استودیو</label>
      </form>`,
      actions: [{ label: "انصراف" }, { label: "ذخیره", primary: true, onClick: (w) => {
        const f = w.querySelector("#doctpl-form").elements;
        BX.api("a.doctpl.save", { id: d?.id || 0, title: f.title.value, category: f.category.value, desc: f.desc.value, price: BX.enDigits(f.price.value), sort: BX.enDigits(f.sort.value), body: f.body.value, active: f.active.checked })
          .then((r) => { BX.toast(r.message, "ok"); load(); }).catch((e) => BX.toast(e.message, "bad"));
      } }],
    });
  }
  const el = () => document.querySelector("[data-studio-panel]");
  const load = () => { const box = el(); if (!box) return; const param = decodeURIComponent(location.hash.slice(1)).split("/")[1] || ""; (BXD.me.role === "admin" ? admin(box, param) : mine(box)).catch((e) => { box.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(e.message)}</p></div>`; }); };
  const prevAfter = BXD.afterRender;
  BXD.afterRender = (view, id, param) => { if (prevAfter) prevAfter(view, id, param); if (view.querySelector("[data-studio-panel]")) load(); };
  Object.assign(BXD.acts, {
    "studio-del": (b) => BXD.ui.confirmBox("حذف پیش‌نویس", "این طرح حذف می‌شود.", () => BX.api("a.studio.delete", { id: b.dataset.id }).then(load), "حذف"),
    "page-del": (b) => BXD.ui.confirmBox("حذف صفحه", "صفحه و آدرسش برای همیشه حذف می‌شود.", () => BX.api("a.page.delete", { id: b.dataset.id }).then(load), "حذف"),
    "doctpl-edit": (b) => docModal(ST.docs.find((x) => String(x.id) === b.dataset.id)),
    "doctpl-del": (b) => BXD.ui.confirmBox("حذف قالب", "قالب از استودیو حذف می‌شود (فایل‌های خریداری‌شده قبلی باقی می‌مانند).", () => BX.api("a.doctpl.delete", { id: b.dataset.id }).then(load), "حذف"),
  });
})();
