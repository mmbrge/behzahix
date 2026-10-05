/* ==========================================================================
   BEHIX — admin editors: users, services & products catalog, site settings.
   Registers routes/actions into window.BXD (see dashboard.js).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;

  // Everything below runs lazily (on render), after dashboard.js has filled BXD.
  const h = () => ({ ...BXD.ui, S: BXD.S, me: BXD.me, icon: BX.icon, esc: BX.esc, faDigits: BX.faDigits, num: BX.num, toman: BX.toman, date: BX.date, ago: BX.ago, avatar: BX.avatar, toast: BX.toast, modal: BX.modal });
  const val = (v) => BX.esc(v ?? "");
  const ICON_NAMES = () => Object.keys(BX.ICONS).filter((n) => !["instagram", "linkedin", "telegram", "youtube", "whatsapp", "aparat", "x", "sun", "moon"].includes(n));

  function iconPicker(name, current) {
    const { icon } = h();
    return `<div class="icon-picker" role="radiogroup" aria-label="آیکن">${ICON_NAMES().map((n) => `
      <label title="${n}"><input type="radio" name="${name}" value="${n}" ${n === current ? "checked" : ""}><span>${icon(n)}</span></label>`).join("")}</div>`;
  }
  const tabs = (base, items, active) => `<div class="tabs-row">${items.map(([id, label, ic]) => `<a class="tab-link ${id === active ? "is-active" : ""}" href="#${base}${id ? `/${id}` : ""}">${ic ? BX.icon(ic) : ""}${label}</a>`).join("")}</div>`;

  // ============================================================ USERS
  BXD.routes.users = function () {
    const { S, me, box, table, seg, segState, pill, money, faDigits, esc, icon, userCell, date, ROLE_LABEL, USER_STATUS } = h();
    const f = segState.users || "all";
    const term = (segState["users-q"] || "").trim();
    const pending = S.users.filter((u) => u.status === "pending");
    const list = S.users.filter((u) => (f === "all" || (f === "pending" ? u.status === "pending" : u.role === f)) && (!term || u.name.includes(term) || (u.phone || "").includes(BX.enDigits(term))));
    const applicants = pending.length ? box("درخواست‌های همکاری (طراح و فروشنده)", "shield", `<div class="grid-auto">${pending.map((u) => `
      <article class="card job">
        <div class="row">${BX.avatar(u, "avatar-lg")}<div><b>${esc(u.name)}</b> <span class="badge badge--brand">${ROLE_LABEL[u.role]}</span><br><small class="muted" dir="ltr">${faDigits(u.phone || "")}</small><br><small class="muted">${BX.ago(u.createdAt)}</small></div></div>
        ${u.role === "designer"
          ? `<div class="chips">${(u.skills || []).slice(0, 8).map((s) => `<span class="badge">${esc(BX.findService(s)?.title || s)}</span>`).join("")}</div>${u.portfolioUrl ? `<a class="brand small" href="${esc(/^https?:/.test(u.portfolioUrl) ? u.portfolioUrl : `https://${u.portfolioUrl}`)}" target="_blank" rel="noopener noreferrer">${icon("external")} مشاهده نمونه‌کار</a>` : ""}<p class="small muted">${esc(u.bio || "")}</p>`
          : `<p class="small"><b>${esc(u.shopName || "")}</b></p><p class="small muted">${(u.cats || []).map((c) => esc(BX.PRODUCT_CATEGORIES.find((x) => x.id === c)?.title || c)).join("، ")}</p>`}
        <div class="row-between"><button class="btn btn-primary btn-sm" data-act="user-status" data-id="${u.id}" data-v="active">${icon("check")} تأیید</button><button class="btn btn-ghost btn-sm" data-act="user-status" data-id="${u.id}" data-v="rejected">رد درخواست</button></div>
      </article>`).join("")}</div>`) : "";
    return `<div class="dash-grid">${applicants}
      ${box("کاربران", "users", `
        <div class="row-between">${seg("users", [["all", "همه", S.users.length], ...Object.entries(ROLE_LABEL).map(([k, l]) => [k, l, S.users.filter((u) => u.role === k).length]), ["pending", "در انتظار", pending.length]], f)}
          <label class="search">${icon("search")}<input class="input" data-change="users-q" value="${esc(term)}" placeholder="نام یا موبایل"></label></div>
        <div class="mt-2">${table(["کاربر", "نقش", "وضعیت", "عضویت", "کیف پول", "کارمزد", ""], list.map((u) => `
          <tr><td>${userCell(u)}</td>
            <td><span class="badge">${ROLE_LABEL[u.role]}</span>${u.isDemo ? ' <span class="badge badge--info">نمونه</span>' : ""}</td>
            <td>${pill(USER_STATUS[u.status] || USER_STATUS.active)}</td>
            <td class="muted">${date(u.createdAt)}</td>
            <td>${money(u.wallet)}</td>
            <td>${["designer", "seller"].includes(u.role) ? `${faDigits(u.effectiveCommission ?? "")}٪${u.commission != null ? ' <span class="badge badge--brand">اختصاصی</span>' : ""}` : "—"}</td>
            <td><div class="actions">
              <button class="icon-btn icon-btn-sm" data-act="user-edit" data-id="${u.id}" title="ویرایش" aria-label="ویرایش">${icon("edit")}</button>
              ${u.id !== me.id ? `
                <button class="icon-btn icon-btn-sm" data-act="impersonate" data-id="${u.id}" title="ورود به پنل این کاربر" aria-label="ورود به‌جای کاربر">${icon("eye")}</button>
                ${u.status === "blocked" ? `<button class="btn btn-ghost btn-xs" data-act="user-status" data-id="${u.id}" data-v="active">رفع مسدودی</button>` : `<button class="btn btn-ghost btn-xs" data-act="user-status" data-id="${u.id}" data-v="blocked">مسدود</button>`}
                <button class="icon-btn icon-btn-sm" data-act="user-delete" data-id="${u.id}" title="حذف" aria-label="حذف">${icon("trash")}</button>` : ""}
            </div></td></tr>`), "کاربری پیدا نشد.")}</div>`, `<button class="btn btn-primary btn-sm" data-act="user-edit">${icon("plus")} کاربر جدید</button>`)}
    </div>`;
  };

  function userModal(u) {
    const { S, me, modal, esc, num, faDigits, icon, ROLE_LABEL, USER_STATUS, toast } = h();
    const isNew = !u;
    u = u || { role: "customer", status: "active", skills: [] };
    const c = S.settings.commission || {};
    modal({
      title: isNew ? "کاربر جدید" : `ویرایش ${u.name}`, wide: true,
      body: `<form class="form-grid form-grid-2" id="user-form" autocomplete="off">
        <div class="field"><label class="field-label" for="uf-name">نام و نام خانوادگی</label><input class="input" id="uf-name" name="name" value="${val(u.name)}"></div>
        <div class="field"><label class="field-label" for="uf-phone">موبایل (نام کاربری)</label><input class="input" id="uf-phone" name="phone" dir="ltr" value="${val(u.phone)}"></div>
        <div class="field"><label class="field-label" for="uf-email">ایمیل</label><input class="input" id="uf-email" name="email" dir="ltr" value="${val(u.email)}"></div>
        <div class="field"><label class="field-label" for="uf-pass">${isNew ? "رمز عبور" : "رمز جدید (خالی = بدون تغییر)"}</label><input class="input" id="uf-pass" name="password" type="text" dir="ltr" autocomplete="new-password"></div>
        <div class="field"><label class="field-label" for="uf-role">نقش</label><select class="select" id="uf-role" name="role" ${u.id === me.id ? "disabled" : ""}>${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${k === u.role ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label class="field-label" for="uf-status">وضعیت</label><select class="select" id="uf-status" name="status" ${u.id === me.id ? "disabled" : ""}>${Object.entries(USER_STATUS).map(([k, [l]]) => `<option value="${k}" ${k === u.status ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label class="field-label" for="uf-biz">نام کسب‌وکار (مشتری)</label><input class="input" id="uf-biz" name="business" value="${val(u.business)}"></div>
        <div class="field"><label class="field-label" for="uf-shop">نام فروشگاه (فروشنده)</label><input class="input" id="uf-shop" name="shopName" value="${val(u.shopName)}"></div>
        <div class="field"><label class="field-label" for="uf-level">سطح / عنوان (طراح)</label><input class="input" id="uf-level" name="level" value="${val(u.level)}" placeholder="مثلاً طراح ارشد"></div>
        <div class="field"><label class="field-label" for="uf-card">شماره شبا</label><input class="input" id="uf-card" name="card" dir="ltr" value="${val(u.card)}"></div>
        <div class="field span-2"><label class="field-label" for="uf-bio">معرفی</label><textarea class="textarea" id="uf-bio" name="bio">${esc(u.bio || "")}</textarea></div>
        <div class="field"><label class="field-label" for="uf-com">کارمزد اختصاصی (٪)</label><input class="input" id="uf-com" name="commission" dir="ltr" inputmode="decimal" value="${u.commission != null ? faDigits(u.commission) : ""}" placeholder="خالی = طبق تنظیمات (${faDigits(c.percent)}٪)">
          <span class="field-hint">برای طراح/فروشنده. اگر خالی باشد، کارمزد تازه‌واردها (${faDigits(c.newcomerPercent)}٪ تا ${faDigits(c.newcomerUntil)} مورد اول) و سپس کارمزد عمومی اعمال می‌شود.</span></div>
        <div class="field"><label class="field-label" for="uf-wallet">اصلاح موجودی کیف پول (تومان)</label><input class="input" id="uf-wallet" name="walletAdjust" dir="ltr" placeholder="مثلاً 500000 یا -200000">
          <span class="field-hint">موجودی فعلی: ${BX.toman(u.wallet || 0)}</span></div>
        <div class="field span-2" data-skills ${u.role === "designer" ? "" : "hidden"}><span class="field-label">تخصص‌ها (طراح)</span>
          <div class="chips">${BX.services.map((s) => `<label class="chip"><input type="checkbox" name="skills" value="${esc(s.id)}" ${(u.skills || []).includes(s.id) ? "checked" : ""}><span class="chip-check">${icon("check")}</span>${esc(s.title)}</label>`).join("")}</div></div>
      </form>`,
      onOpen: (wrap) => {
        wrap.querySelector("#uf-role").addEventListener("change", (e) => (wrap.querySelector("[data-skills]").hidden = e.target.value !== "designer"));
      },
      actions: [{ label: "انصراف" }, {
        label: "ذخیره", primary: true, onClick: (wrap) => {
          const f = wrap.querySelector("#user-form");
          const e = f.elements;
          if (isNew && !e.password.value) { toast("برای کاربر جدید رمز عبور تعیین کنید.", "bad"); return false; }
          const data = {
            id: u.id || 0, name: e.name.value, phone: BX.enDigits(e.phone.value), email: e.email.value, password: e.password.value,
            role: u.id === me.id ? "admin" : e.role.value, status: u.id === me.id ? "active" : e.status.value,
            business: e.business.value, shopName: e.shopName.value, level: e.level.value, card: e.card.value, bio: e.bio.value,
            commission: BX.enDigits(e.commission.value), walletAdjust: BX.enDigits(e.walletAdjust.value).replace(/[^\d-]/g, ""),
            skills: [...f.querySelectorAll("[name=skills]:checked")].map((x) => x.value),
          };
          BXD.quiet(BXD.act("user.save", data));
        },
      }],
    });
  }

  Object.assign(BXD.acts, {
    "user-edit": (el) => userModal(el.dataset.id ? BXD.S.users.find((u) => u.id === el.dataset.id) : null),
    "user-status": (el) => BXD.quiet(BXD.act("user.status", { id: el.dataset.id, status: el.dataset.v })),
    "user-delete": (el) => {
      const u = BXD.S.users.find((x) => x.id === el.dataset.id);
      BXD.ui.confirmBox("حذف کاربر", `«${BX.esc(u.name)}» و همه سفارش‌ها، محصولات، تراکنش‌ها و فایل‌هایش برای همیشه حذف می‌شود. ادامه می‌دهید؟`, () => BXD.quiet(BXD.act("user.delete", { id: u.id })), "حذف کامل");
    },
    impersonate: (el) => BXD.ui.confirmBox("ورود به‌جای کاربر", "برای پشتیبانی وارد پنل این کاربر می‌شوید. با دکمه «بازگشت به پنل مدیر» برمی‌گردید.", async () => {
      try {
        await BX.api("a.user.impersonate", { id: el.dataset.id });
        location.hash = "";
        location.reload();
      } catch (err) { BX.toast(err.message, "bad"); }
    }, "ورود"),
  });

  // ============================================================ CATALOG
  BXD.routes.catalog = function (param) {
    const tab = param || "services";
    const head = tabs("catalog", [["services", "خدمات و شاخه‌ها", "layers"], ["products", "محصولات فروشگاه", "box"], ["pcats", "دسته‌های فروشگاه", "folder"]], tab);
    if (tab === "products") return head + productsTab();
    if (tab === "pcats") return head + pcatsTab();
    return head + servicesTab();
  };

  function servicesTab() {
    const { S, box, table, icon, esc, toman, faDigits } = h();
    const cats = S.catalogAll || [];
    return `<div class="dash-grid">
      <div class="banner banner--info">${icon("info")}<span>هر شاخه و خدمت را می‌توانید ویرایش، غیرفعال یا حذف کنید. برای هر خدمت، سوال‌های فرم سفارش و قیمت هر گزینه را در بخش «فیلدهای فرم سفارش» تعریف کنید؛ فرم سفارش، درخت خدمات و منوی سایت فوراً به‌روز می‌شوند.</span></div>
      <div class="row"><button class="btn btn-primary btn-sm" data-act="cat-edit">${icon("plus")} شاخه جدید</button></div>
      ${cats.map((c) => box(`${esc(c.title)} ${c.active ? "" : '<span class="badge">غیرفعال</span>'}`, c.icon, table(["خدمت", "قیمت پایه", "زمان", "فیلدها", "وضعیت", ""], c.services.map((s) => `
        <tr><td><div class="cell-title" style="--h:${c.hue}"><span class="cell-icon">${icon(s.icon)}</span><span><b>${esc(s.title)}</b><small dir="ltr">${esc(s.id)}</small></span></div></td>
          <td>${toman(s.base)}</td><td>${faDigits(s.days)} روز</td><td>${faDigits(s.fields.length)}</td>
          <td>${s.active ? '<span class="badge badge--ok">فعال</span>' : '<span class="badge">غیرفعال</span>'}</td>
          <td><div class="actions"><a class="icon-btn icon-btn-sm" href="order.html?service=${encodeURIComponent(s.id)}" target="_blank" title="پیش‌نمایش فرم" aria-label="پیش‌نمایش">${icon("eye")}</a>
            <button class="icon-btn icon-btn-sm" data-act="svc-edit" data-cat="${c.id}" data-id="${esc(s.id)}" aria-label="ویرایش">${icon("edit")}</button>
            <button class="icon-btn icon-btn-sm" data-act="svc-delete" data-id="${esc(s.id)}" aria-label="حذف">${icon("trash")}</button></div></td></tr>`), "این شاخه هنوز خدمتی ندارد."),
        `<button class="btn btn-primary btn-xs" data-act="svc-edit" data-cat="${c.id}">${icon("plus")} خدمت جدید</button><button class="icon-btn icon-btn-sm" data-act="cat-edit" data-id="${c.id}" aria-label="ویرایش شاخه">${icon("edit")}</button><button class="icon-btn icon-btn-sm" data-act="cat-delete" data-id="${c.id}" aria-label="حذف شاخه">${icon("trash")}</button>`)).join("")}
    </div>`;
  }

  function productsTab() {
    const { S, box, table, seg, segState, icon, productRows } = h();
    const f = segState.aprod || "all";
    const list = S.products.filter((p) => f === "all" || p.status === f);
    return box("محصولات فروشگاه", "box", `
      ${seg("aprod", [["all", "همه", S.products.length], ["pending", "در انتظار تأیید", S.products.filter((p) => p.status === "pending").length], ["active", "فعال"], ["hidden", "مخفی"], ["rejected", "رد شده"]], f)}
      <div class="mt-2">${table(["محصول", "قیمت", "فروش", "وضعیت", ""], productRows(list, true), "محصولی در این وضعیت نیست.")}</div>`,
      `<button class="btn btn-ghost btn-sm" data-act="product-import">${icon("upload")} ورود گروهی از اکسل</button><button class="btn btn-primary btn-sm" data-act="add-product">${icon("plus")} محصول جدید</button>`);
  }

  // Bulk import: CSV saved from Excel / Google Sheets
  function productImport() {
    const { icon, faDigits, esc, modal, toast } = h();
    const cats = (BXD.S.productCategories || BX.PRODUCT_CATEGORIES).map((c) => c.title);
    const template = () => {
      const rows = [["عنوان", "دسته", "قیمت", "تخفیف", "برچسب‌ها", "توضیحات", "وضعیت"],
        ["قالب پاورپوینت شرکتی", cats[0] || "", "490000", "10", "پاورپوینت، شرکتی", "۲۰ اسلاید قابل ویرایش", "فعال"]];
      const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = "behix-products-template.csv";
      a.click();
    };
    modal({
      title: "ورود گروهی محصولات", wide: true,
      body: `<ol class="steps-list">
          <li>فایل نمونه را دانلود و در اکسل باز کنید؛ هر سطر یک محصول است.</li>
          <li>ستون «دسته» باید یکی از این‌ها باشد: ${cats.map((c) => `<span class="badge">${esc(c)}</span>`).join(" ")}</li>
          <li>در اکسل: File ← Save As ← نوع <b dir="ltr">CSV UTF-8</b> را انتخاب و فایل را اینجا بارگذاری کنید.</li>
          <li>بعد از ورود، برای هر محصول عکس کاور و فایل‌های دانلودی را از دکمه ویرایش اضافه کنید.</li>
        </ol>
        <button type="button" class="btn btn-ghost btn-sm mt-2" data-tpl>${icon("download")} دانلود فایل نمونه</button>
        <label class="drop mt-2">${icon("upload")}<b class="small">انتخاب فایل CSV</b><small data-picked>حداکثر ۵۰۰ محصول در هر بار</small><input type="file" accept=".csv,text/csv" hidden data-csv></label>
        <div data-result></div>`,
      onOpen: (wrap) => {
        wrap.querySelector("[data-tpl]").onclick = template;
        wrap.querySelector("[data-csv]").addEventListener("change", async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          wrap.querySelector("[data-picked]").textContent = f.name;
          try {
            const r = await BXD.act("product.import", { csv: await f.text() });
            const errs = r.errors || [];
            wrap.querySelector("[data-result]").innerHTML = `<div class="banner mt-2">${icon(r.created ? "check-circle" : "info")}<span>${esc(r.message || "")}</span></div>
              ${errs.length ? `<ul class="small mt-1">${errs.slice(0, 20).map((x) => `<li>سطر ${faDigits(x.row)}: ${esc(x.msg)}</li>`).join("")}</ul>` : ""}`;
          } catch (err) { toast(err.message, "bad"); }
        });
      },
      actions: [{ label: "بستن" }],
    });
  }

  function pcatsTab() {
    const { S, box, table, icon, esc, faDigits } = h();
    return box("دسته‌بندی‌های فروشگاه", "folder", table(["دسته", "شناسه", "ترتیب", "محصولات", ""], (S.productCategories || []).map((c) => `
      <tr><td><div class="cell-title"><span class="cell-icon">${icon(c.icon)}</span><b>${esc(c.title)}</b></div></td><td dir="ltr" class="muted">${esc(c.id)}</td><td>${faDigits(c.sort)}</td>
        <td>${faDigits(S.products.filter((p) => p.category === c.id).length)}</td>
        <td><div class="actions"><button class="icon-btn icon-btn-sm" data-act="pcat-edit" data-id="${esc(c.id)}" aria-label="ویرایش">${icon("edit")}</button><button class="icon-btn icon-btn-sm" data-act="pcat-delete" data-id="${esc(c.id)}" aria-label="حذف">${icon("trash")}</button></div></td></tr>`), "دسته‌ای وجود ندارد."),
      `<button class="btn btn-primary btn-sm" data-act="pcat-edit">${icon("plus")} دسته جدید</button>`);
  }

  function categoryModal(c) {
    const { modal, esc, faDigits } = h();
    const isNew = !c;
    c = c || { hue: 25, icon: "sparkle", active: true, sort: (BXD.S.catalogAll || []).length };
    modal({
      title: isNew ? "شاخه جدید" : `ویرایش شاخه ${c.title}`, wide: true,
      body: `<form class="form-grid form-grid-2" id="cat-form">
        <div class="field"><label class="field-label">شناسه انگلیسی (در آدرس‌ها)</label><input class="input" name="id" dir="ltr" value="${val(c.id)}" ${isNew ? "" : "readonly"} placeholder="design"></div>
        <div class="field"><label class="field-label">عنوان</label><input class="input" name="title" value="${val(c.title)}"></div>
        <div class="field"><label class="field-label">عنوان انگلیسی (زیرعنوان)</label><input class="input" name="en" dir="ltr" value="${val(c.en)}"></div>
        <div class="field"><label class="field-label">ترتیب نمایش</label><input class="input" name="sort" dir="ltr" value="${faDigits(c.sort ?? 0)}"></div>
        <div class="field span-2"><label class="field-label">توضیح کوتاه</label><input class="input" name="desc" value="${val(c.desc)}"></div>
        <div class="field span-2"><label class="field-label">رنگ شاخه</label><div class="row"><input class="range" type="range" name="hue" min="0" max="360" value="${c.hue}"><span class="hue-preview" style="--h:${c.hue}"></span></div></div>
        <div class="field span-2"><span class="field-label">آیکن</span>${iconPicker("icon", c.icon)}</div>
        <label class="switch span-2"><input type="checkbox" name="active" ${c.active ? "checked" : ""}><span class="track"></span>فعال (نمایش در سایت)</label>
      </form>`,
      onOpen: (wrap) => {
        const r = wrap.querySelector("[name=hue]");
        r.addEventListener("input", () => wrap.querySelector(".hue-preview").style.setProperty("--h", r.value));
      },
      actions: [{ label: "انصراف" }, {
        label: "ذخیره", primary: true, onClick: (wrap) => {
          const e = wrap.querySelector("#cat-form").elements;
          BXD.quiet(BXD.act("category.save", { isNew, id: e.id.value.trim(), title: e.title.value, en: e.en.value, sort: BX.enDigits(e.sort.value), desc: e.desc.value, hue: e.hue.value, icon: e.icon.value, active: e.active.checked }));
        },
      }],
    });
  }

  // ------------------------------------------------------------ service editor with field builder
  const FIELD_TYPES = [["cards", "کارت‌های انتخابی (یک گزینه)"], ["select", "لیست کشویی (یک گزینه)"], ["chips", "چندانتخابی"], ["number", "عدد (با قیمت هر واحد)"], ["text", "متن کوتاه"], ["textarea", "متن بلند"]];
  function fieldEditor(f, i, n) {
    const { icon, faDigits, esc } = h();
    const hasOpts = ["cards", "select", "chips"].includes(f.type);
    return `<div class="fb-field" data-i="${i}">
      <div class="fb-head">
        <span class="fb-num">${faDigits(i + 1)}</span>
        <input class="input" data-k="label" value="${val(f.label)}" placeholder="عنوان سوال (مثلاً تعداد اسلاید)">
        <select class="select" data-k="type">${FIELD_TYPES.map(([v, l]) => `<option value="${v}" ${v === f.type ? "selected" : ""}>${l}</option>`).join("")}</select>
        <div class="fb-tools">
          <button type="button" class="icon-btn icon-btn-sm" data-fb="up" ${i === 0 ? "disabled" : ""} aria-label="بالا">${icon("chevron-down", "flip")}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-fb="down" ${i === n - 1 ? "disabled" : ""} aria-label="پایین">${icon("chevron-down")}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-fb="remove" aria-label="حذف فیلد">${icon("trash")}</button>
        </div>
      </div>
      <div class="fb-body">
        <label class="mini-field"><span>شناسه</span><input class="input" data-k="id" dir="ltr" value="${val(f.id)}" placeholder="slides"></label>
        <label class="switch small"><input type="checkbox" data-k="required" ${f.required ? "checked" : ""}><span class="track"></span>اجباری</label>
        ${f.type === "number" ? [["min", "حداقل"], ["max", "حداکثر"], ["value", "پیش‌فرض"], ["included", "تعداد در قیمت پایه"], ["perUnit", "قیمت هر واحد اضافه"], ["step", "گام"], ["suffix", "واحد (مثلاً اسلاید)"]]
          .map(([k, l]) => `<label class="mini-field"><span>${l}</span><input class="input" data-k="${k}" ${k === "suffix" ? "" : 'dir="ltr" inputmode="numeric"'} value="${val(f[k] ?? (k === "step" ? 1 : ""))}"></label>`).join("") : ""}
        ${["text", "textarea"].includes(f.type) ? `<label class="mini-field wide"><span>متن راهنما</span><input class="input" data-k="placeholder" value="${val(f.placeholder)}"></label>
          <label class="switch small"><input type="checkbox" data-k="ltr" ${f.dir === "ltr" ? "checked" : ""}><span class="track"></span>چپ‌چین (لینک، دامنه)</label>` : ""}
      </div>
      ${hasOpts ? `<div class="fb-opts">
        <div class="fb-opt fb-opt-head"><span>گزینه</span><span>شناسه</span><span>هزینه اضافه (تومان، منفی = تخفیف)</span>${f.type === "cards" ? "<span>آیکن</span>" : ""}<span></span></div>
        ${(f.options || []).map((o, j) => `<div class="fb-opt" data-j="${j}">
          <input class="input" data-o="label" value="${val(o.label)}" placeholder="عنوان گزینه">
          <input class="input" data-o="v" dir="ltr" value="${val(o.v)}" placeholder="opt${j + 1}">
          <input class="input" data-o="price" dir="ltr" inputmode="numeric" value="${val(o.price ?? 0)}">
          ${f.type === "cards" ? `<select class="select" data-o="icon">${ICON_NAMES().map((n) => `<option ${n === (o.icon || "sparkle") ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}
          <button type="button" class="icon-btn icon-btn-sm" data-fb="opt-remove" data-j="${j}" aria-label="حذف گزینه">${icon("cross")}</button>
        </div>`).join("")}
        <button type="button" class="btn btn-ghost btn-xs" data-fb="opt-add">${icon("plus")} افزودن گزینه</button>
      </div>` : ""}
    </div>`;
  }

  function serviceModal(catId, svc) {
    const { modal, esc, faDigits, num, icon, toast } = h();
    const isNew = !svc;
    const cats = BXD.S.catalogAll || [];
    svc = svc ? JSON.parse(JSON.stringify(svc)) : { category: catId, icon: "sparkle", base: 1000000, days: 3, active: true, sort: 0, fields: [] };
    let fields = svc.fields || [];

    // Read the builder's inputs back into `fields` before re-rendering it
    const sync = (wrap) => {
      fields = [...wrap.querySelectorAll(".fb-field")].map((el) => {
        const g = (k) => el.querySelector(`[data-k="${k}"]`);
        const f = { id: g("id").value.trim(), label: g("label").value.trim(), type: g("type").value };
        if (g("required").checked) f.required = true;
        if (f.type === "number") ["min", "max", "value", "included", "perUnit", "step"].forEach((k) => (f[k] = Number(BX.enDigits(g(k)?.value || "0")) || 0)), (f.suffix = g("suffix")?.value || "");
        if (["text", "textarea"].includes(f.type)) {
          if (g("placeholder")?.value) f.placeholder = g("placeholder").value;
          if (g("ltr")?.checked) f.dir = "ltr";
        }
        const opts = [...el.querySelectorAll(".fb-opt[data-j]")].map((o) => {
          const x = { label: o.querySelector('[data-o="label"]').value.trim(), v: o.querySelector('[data-o="v"]').value.trim(), price: Number(BX.enDigits(o.querySelector('[data-o="price"]').value).replace(/[^\d-]/g, "")) || 0 };
          const ic = o.querySelector('[data-o="icon"]');
          if (ic) x.icon = ic.value;
          return x;
        });
        if (opts.length || ["cards", "select", "chips"].includes(f.type)) f.options = opts;
        return f;
      });
    };
    const drawFields = (wrap) => {
      wrap.querySelector("[data-fields]").innerHTML = fields.length ? fields.map((f, i) => fieldEditor(f, i, fields.length)).join("") : `<p class="muted small center" style="padding:16px">هنوز فیلدی تعریف نشده؛ مشتری فقط توضیحات آزاد می‌نویسد.</p>`;
    };

    modal({
      title: isNew ? "خدمت جدید" : `ویرایش ${svc.title}`, wide: true,
      body: `<form class="form-grid" id="svc-form">
        <div class="form-grid form-grid-2">
          <div class="field"><label class="field-label">عنوان خدمت</label><input class="input" name="title" value="${val(svc.title)}"></div>
          <div class="field"><label class="field-label">شناسه انگلیسی (در لینک سفارش)</label><input class="input" name="id" dir="ltr" value="${val(svc.id)}" ${isNew ? "" : "readonly"} placeholder="logo-design"></div>
          <div class="field"><label class="field-label">شاخه</label><select class="select" name="category">${cats.map((c) => `<option value="${esc(c.id)}" ${c.id === svc.category ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></div>
          <div class="field"><label class="field-label">ترتیب نمایش</label><input class="input" name="sort" dir="ltr" value="${faDigits(svc.sort || 0)}"></div>
          <div class="field"><label class="field-label">قیمت پایه (تومان)</label><input class="input" name="base" dir="ltr" inputmode="numeric" value="${num(svc.base)}"></div>
          <div class="field"><label class="field-label">زمان تحویل پایه (روز)</label><input class="input" name="days" dir="ltr" inputmode="numeric" value="${faDigits(svc.days)}"></div>
          <div class="field span-2"><label class="field-label">توضیح کوتاه</label><textarea class="textarea" name="desc" style="min-height:70px">${esc(svc.desc || "")}</textarea></div>
          <label class="switch"><input type="checkbox" name="active" ${svc.active !== false ? "checked" : ""}><span class="track"></span>فعال (قابل سفارش)</label>
        </div>
        <details class="fb-icons"><summary>${icon("image")} انتخاب آیکن خدمت</summary>${iconPicker("icon", svc.icon)}</details>
        <div class="fb">
          <div class="row-between"><h3 class="small">فیلدهای فرم سفارش</h3><button type="button" class="btn btn-ghost btn-xs" data-fb="add">${icon("plus")} افزودن فیلد</button></div>
          <p class="field-hint">هزینه هر گزینه به قیمت پایه اضافه می‌شود. برای فیلد عددی، تعداد مشخصی در قیمت پایه است و هر واحد اضافه قیمت جداگانه دارد.</p>
          <div data-fields class="mt-1"></div>
        </div>
      </form>`,
      onOpen: (wrap) => {
        drawFields(wrap);
        wrap.addEventListener("click", (e) => {
          const b = e.target.closest("[data-fb]");
          if (!b) return;
          e.preventDefault();
          sync(wrap);
          const i = Number(b.closest(".fb-field")?.dataset.i);
          const op = b.dataset.fb;
          if (op === "add") fields.push({ id: `field${fields.length + 1}`, label: "", type: "cards", options: [{ label: "", v: "opt1", price: 0 }] });
          if (op === "remove") fields.splice(i, 1);
          if (op === "up" && i > 0) [fields[i - 1], fields[i]] = [fields[i], fields[i - 1]];
          if (op === "down" && i < fields.length - 1) [fields[i + 1], fields[i]] = [fields[i], fields[i + 1]];
          if (op === "opt-add") (fields[i].options = fields[i].options || []).push({ label: "", v: `opt${(fields[i].options || []).length + 1}`, price: 0 });
          if (op === "opt-remove") fields[i].options.splice(Number(b.dataset.j), 1);
          drawFields(wrap);
        });
        wrap.addEventListener("change", (e) => {
          if (e.target.dataset.k === "type") {
            sync(wrap);
            const f = fields[Number(e.target.closest(".fb-field").dataset.i)];
            if (["cards", "select", "chips"].includes(f.type) && !(f.options || []).length) f.options = [{ label: "", v: "opt1", price: 0 }];
            if (f.type === "number" && f.max == null) Object.assign(f, { min: 1, max: 100, value: 1, included: 1, perUnit: 0, step: 1 });
            drawFields(wrap);
          }
        });
      },
      actions: [{ label: "انصراف" }, {
        label: "ذخیره خدمت", primary: true, onClick: (wrap) => {
          sync(wrap);
          const e = wrap.querySelector("#svc-form").elements;
          if (fields.some((f) => !f.label)) { toast("عنوان همه فیلدها را وارد کنید (یا فیلد خالی را حذف کنید).", "bad"); return false; }
          BXD.quiet(BXD.act("service.save", {
            isNew, id: e.id.value.trim(), title: e.title.value, category: e.category.value, sort: BX.enDigits(e.sort.value),
            base: BX.enDigits(e.base.value), days: BX.enDigits(e.days.value), desc: e.desc.value, active: e.active.checked,
            icon: wrap.querySelector("[name=icon]:checked")?.value || svc.icon, fields,
          }).then(() => BX.ready && reloadCatalog()));
        },
      }],
    });
  }

  // Keep the site-wide catalog (used by menus and helpers) in sync after edits
  async function reloadCatalog() {
    const cats = BXD.S.catalogAll || [];
    BX.CATALOG = cats.filter((c) => c.active).map((c) => ({ ...c, services: c.services.filter((s) => s.active) }));
    BX.services = cats.flatMap((c) => c.services.map((s) => ({ ...s, category: c.id })));
  }

  function pcatModal(c) {
    const { modal, faDigits } = h();
    const isNew = !c;
    c = c || { icon: "box", sort: (BXD.S.productCategories || []).length };
    modal({
      title: isNew ? "دسته جدید فروشگاه" : `ویرایش ${c.title}`, wide: true,
      body: `<form class="form-grid form-grid-2" id="pcat-form">
        <div class="field"><label class="field-label">عنوان</label><input class="input" name="title" value="${val(c.title)}"></div>
        <div class="field"><label class="field-label">شناسه انگلیسی</label><input class="input" name="id" dir="ltr" value="${val(c.id)}" ${isNew ? "" : "readonly"} placeholder="fonts"></div>
        <div class="field"><label class="field-label">ترتیب</label><input class="input" name="sort" dir="ltr" value="${faDigits(c.sort || 0)}"></div>
        <div class="field span-2"><span class="field-label">آیکن</span>${iconPicker("icon", c.icon)}</div>
      </form>`,
      actions: [{ label: "انصراف" }, {
        label: "ذخیره", primary: true, onClick: (wrap) => {
          const e = wrap.querySelector("#pcat-form").elements;
          BXD.quiet(BXD.act("productCategory.save", { isNew, id: e.id.value.trim(), title: e.title.value, sort: BX.enDigits(e.sort.value), icon: wrap.querySelector("[name=icon]:checked")?.value || "box" }));
        },
      }],
    });
  }

  Object.assign(BXD.acts, {
    "cat-edit": (el) => categoryModal(el.dataset.id ? (BXD.S.catalogAll || []).find((c) => c.id === el.dataset.id) : null),
    "cat-delete": (el) => BXD.ui.confirmBox("حذف شاخه", "شاخه فقط وقتی حذف می‌شود که خدمتی نداشته باشد.", () => BXD.quiet(BXD.act("category.delete", { id: el.dataset.id }).then(reloadCatalog)), "حذف"),
    "svc-edit": (el) => serviceModal(el.dataset.cat, el.dataset.id ? (BXD.S.catalogAll || []).flatMap((c) => c.services).find((s) => s.id === el.dataset.id) : null),
    "svc-delete": (el) => BXD.ui.confirmBox("حذف خدمت", "اگر این خدمت سفارش ثبت‌شده داشته باشد، به‌جای حذف غیرفعال می‌شود.", () => BXD.quiet(BXD.act("service.delete", { id: el.dataset.id }).then(reloadCatalog)), "حذف"),
    "pcat-edit": (el) => pcatModal(el.dataset.id ? (BXD.S.productCategories || []).find((c) => c.id === el.dataset.id) : null),
    "pcat-delete": (el) => BXD.ui.confirmBox("حذف دسته", "دسته فقط وقتی حذف می‌شود که محصولی نداشته باشد.", () => BXD.quiet(BXD.act("productCategory.delete", { id: el.dataset.id })), "حذف"),
  });

  // ============================================================ SETTINGS
  // Field spec: [key, label, type, extra]
  // types: text | ltr | textarea | code | html | number | switch | select | color | lines
  const SETTINGS = {
    general: { title: "عمومی", icon: "settings", groups: [
      ["general", [
        ["siteNameFa", "نام فارسی سایت", "text"], ["siteName", "نام لاتین (لوگو)", "ltr"], ["tagline", "شعار سایت", "text"],
        ["announcement", "نوار اطلاع‌رسانی بالای سایت (خالی = خاموش)", "text"], ["announcementLink", "لینک نوار اطلاع‌رسانی", "ltr"],
        ["maintenance", "حالت تعمیر و نگهداری (فقط مدیر سایت را می‌بیند)", "switch"], ["maintenanceText", "متن صفحه تعمیر", "textarea"],
      ]],
      ["shop", [["enabled", "فروشگاه فایل فعال باشد", "switch"]]],
      ["seo", [["title", "عنوان سئو صفحه اصلی", "text"], ["description", "توضیحات متا", "textarea"]]],
    ] },
    contact: { title: "تماس و شبکه‌ها", icon: "phone", groups: [
      ["contact", [
        ["phone", "تلفن اصلی", "ltr"], ["phone2", "تلفن دوم", "ltr"], ["email", "ایمیل", "ltr"], ["telegramId", "آیدی تلگرام (بدون @)", "ltr"],
        ["address", "آدرس", "text"], ["hours", "ساعات کاری", "text"],
      ]],
      ["socials", [
        ["instagram", "لینک اینستاگرام", "ltr"], ["telegram", "لینک تلگرام", "ltr"], ["whatsapp", "لینک واتساپ (wa.me/98…)", "ltr"], ["bale", "لینک بله (ble.ir/…)", "ltr"],
        ["linkedin", "لینک لینکدین", "ltr"], ["youtube", "لینک یوتیوب", "ltr"], ["aparat", "لینک آپارات", "ltr"], ["x", "لینک ایکس (توییتر)", "ltr"],
      ], "لینک هر شبکه‌ای که خالی باشد در سایت نمایش داده نمی‌شود."],
    ] },
    home: { title: "صفحه اصلی", icon: "home", groups: [
      ["about", [
        ["stats", "آمار صفحه «درباره ما» — هر خط: مقدار | عنوان (مثلاً: ۲ ساعت | زمان پاسخ‌گویی). {services} = تعداد خدمات", "lines"],
        ["designerStats", "آمار صفحه «طراحان» — همان قالب. {share} = سهم طراح بر اساس کارمزد", "lines"],
      ], "فقط عددهای واقعی بنویسید؛ مثلاً تعداد پروژه‌ها را وقتی واقعاً به آن رسیدید اضافه کنید."],
      ["home", [
        ["badge", "برچسب بالای عنوان", "text"], ["title1", "خط اول عنوان", "text"], ["title2", "خط دوم عنوان (قبل از لوگو)", "text"],
        ["morphItems", "کلمات انیمیشن ذره‌ای بالای صفحه (بدون محدودیت؛ هر کلمه با یک زیرنویس. کلمه لاتینی که به X ختم شود، مثل BEHIX، با X نارنجی نمایش داده می‌شود)", "morph"],
        ["morphIntro", "زیرنویس شروع (هنگام نمایش کره ذرات)", "text"], ["morphInterval", "مکث روی هر کلمه (ثانیه، ۱.۵ تا ۳۰)", "number"],
        ["lead", "متن معرفی", "textarea"], ["cta", "متن دکمه اصلی", "text"], ["packages", "پکیج‌های ماشین‌حساب صفحه اصلی", "packages"], ["bundle", "تخفیف ترکیبی ماشین‌حساب", "bundle"],
      ]],
    ] },
    legal: { title: "قوانین و نمادها", icon: "shield", groups: [
      ["legal", [
        ["terms", "متن قوانین و مقررات (HTML ساده: h2، p، ul، li، b)", "html"], ["privacy", "متن حریم خصوصی", "html"],
        ["enamadCode", "کد نماد اعتماد الکترونیکی (اینماد)", "code"], ["samandehiCode", "کد نشان ساماندهی", "code"], ["extraBadgesCode", "سایر نمادها / کد دلخواه فوتر", "code"],
      ], "کد نمادها را دقیقاً همان‌طور که سایت اینماد یا ساماندهی می‌دهد کپی کنید؛ در فوتر همه صفحات نمایش داده می‌شود."],
    ] },
    commission: { title: "کارمزد و تسویه", icon: "percent", groups: [
      ["commission", [
        ["percent", "کارمزد عمومی پلتفرم (٪)", "number"],
        ["newcomerEnabled", "کارمزد ویژه برای طراحان و فروشندگان تازه‌وارد", "switch"],
        ["newcomerPercent", "کارمزد تازه‌واردها (٪)", "number"], ["newcomerUntil", "تا چندمین پروژه/فروش", "number"],
        ["minPayout", "حداقل مبلغ تسویه (تومان)", "number"],
      ], "ترتیب اعمال: ۱) کارمزد اختصاصی کاربر (از بخش کاربران) ۲) کارمزد تازه‌واردها تا تعداد تعیین‌شده ۳) کارمزد عمومی."],
    ] },
    orders: { title: "سفارش‌ها", icon: "list", groups: [
      ["orders", [
        ["guestOrders", "ثبت سفارش بدون ورود (ساخت خودکار حساب)", "switch"], ["revisions", "تعداد اصلاح رایگان", "number"],
        ["stagedEnabled", "پرداخت مرحله‌ای (پیش‌پرداخت + مانده) برای سفارش‌های بزرگ", "switch"], ["stagedMin", "حداقل مبلغ سفارش برای پرداخت مرحله‌ای (تومان)", "number"], ["stagedPercent", "درصد پیش‌پرداخت", "number"],
        ["deadlines", "سرعت‌های تحویل", "deadlines"], ["addons", "خدمات تکمیلی (درصدی)", "addons"],
        ["styles", "سبک‌های پیشنهادی (هر خط یکی)", "lines"], ["budgets", "بازه‌های بودجه (هر خط یکی)", "lines"],
      ]],
      ["referral", [
        ["enabled", "برنامه دعوت از دوستان فعال باشد", "switch"], ["rewardInviter", "هدیه معرف (تومان، به کیف پول)", "number"],
        ["rewardFriend", "هدیه دوست دعوت‌شده (تومان)", "number"], ["minPurchase", "حداقل مبلغ اولین خرید دوست برای دریافت هدیه (تومان)", "number"],
      ], "هدیه‌ها فقط بعد از اولین پرداخت واقعی دوست داده می‌شود تا از سوءاستفاده جلوگیری شود."],
      ["cart", [["reminder", "پیامک یادآوری سبد خرید رهاشده", "switch"], ["hours", "ارسال یادآوری بعد از چند ساعت", "number"]],
        "برای کاربران واردشده‌ای که فایل در سبد گذاشته‌اند و خرید نکرده‌اند؛ یک بار برای هر سبد. قالب «یادآوری سبد خرید» را در قالب‌های پیامک فعال کنید."],
    ] },
    payment: { title: "درگاه پرداخت", icon: "wallet", groups: [
      ["payment", [
        ["driver", "درگاه", "select", [["test", "تست (بدون پول — فقط در حالت نمایشی)"], ["zarinpal", "زرین‌پال"], ["zibal", "زیبال"]]],
        ["merchant", "مرچنت کد", "ltr"], ["sandbox", "حالت آزمایشی درگاه (Sandbox)", "switch"], ["description", "توضیح پرداخت", "text"],
      ], "مرچنت کد را از پنل زرین‌پال یا زیبال بگیرید. آدرس بازگشت به‌طور خودکار ساخته می‌شود؛ دامنه سایت باید در پنل درگاه ثبت شده باشد."],
    ] },
    sms: { title: "پیامک", icon: "chat", groups: [
      ["sms", [
        ["driver", "سرویس پیامک", "select", [["none", "غیرفعال (فقط ورود با رمز)"], ["kavenegar", "کاوه‌نگار"], ["smsir", "اس‌ام‌اس دات آی‌آر"]]],
        ["apiKey", "کلید API", "ltr"], ["adminPhone", "شماره موبایل مدیر برای پیامک‌های مدیریتی", "ltr"], ["template", "نام الگوی تأیید (کاوه‌نگار)", "ltr"], ["templateId", "شناسه قالب (SMS.ir)", "ltr"], ["paramName", "نام پارامتر کد در قالب (SMS.ir)", "ltr"],
      ], "در پنل پیامک یک الگوی «کد تأیید» بسازید که متغیر %token% (کاوه‌نگار) یا #CODE# (SMS.ir) را داشته باشد."],
    ] },
    smsTpl: { title: "قالب‌های پیامک", icon: "send", groups: [] },
    theme: { title: "ظاهر", icon: "palette", groups: [
      ["theme", [
        ["brand", "رنگ اصلی", "color"], ["brand2", "رنگ دوم (گرادیان)", "color"],
        ["defaultTheme", "تم پیش‌فرض", "select", [["dark", "تاریک"], ["light", "روشن"]]], ["cursor", "نشانگر موس انیمیشنی", "switch"],
      ]],
      ["uploads", [["maxMB", "حداکثر حجم هر فایل (مگابایت)", "number"], ["ext", "پسوندهای مجاز (با کاما)", "ltr"]], "حداکثر حجم واقعی به تنظیمات PHP هاست (upload_max_filesize) هم بستگی دارد."],
    ] },
    bnpl: { title: "پرداخت اقساطی", icon: "wallet", groups: [
      ["bnpl_snapppay", [
        ["enabled", "فعال باشد (پس از عقد قرارداد پذیرندگی)", "switch"], ["label", "نام نمایشی", "text"], ["note", "توضیح کوتاه برای مشتری (مثلاً ۴ قسط بدون کارمزد)", "text"],
        ["installments", "تعداد قسط برای نمایش مبلغ هر قسط (۰ = نمایش نده)", "number"], ["min", "حداقل مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"], ["max", "حداکثر مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"],
        ["apiUrl", "آدرس API (خالی = پیش‌فرض)", "ltr"],
        ["clientId", "Client ID", "ltr"], ["clientSecret", "Client Secret", "ltr"], ["username", "نام کاربری", "ltr"], ["password", "رمز عبور", "ltr"],
      ], "اطلاعات پذیرنده را پس از قرارداد از اسنپ‌پی بگیرید. آدرس پیش‌فرض، محیط آزمایشی (staging) است؛ برای فروش واقعی آدرس نهایی را که اسنپ‌پی می‌دهد وارد کنید."],
      ["bnpl_digipay", [
        ["enabled", "فعال باشد (پس از عقد قرارداد پذیرندگی)", "switch"], ["label", "نام نمایشی", "text"], ["note", "توضیح کوتاه برای مشتری (مثلاً ۴ قسط بدون کارمزد)", "text"],
        ["installments", "تعداد قسط برای نمایش مبلغ هر قسط (۰ = نمایش نده)", "number"], ["min", "حداقل مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"], ["max", "حداکثر مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"],
        ["apiUrl", "آدرس API (خالی = پیش‌فرض)", "ltr"],
        ["clientId", "Client ID", "ltr"], ["clientSecret", "Client Secret", "ltr"], ["username", "نام کاربری", "ltr"], ["password", "رمز عبور", "ltr"],
      ], "در صفحه پرداخت دیجی‌پی، مشتری بین پرداخت کارتی، کیف پول و خرید اعتباری/اقساطی انتخاب می‌کند."],
      ["bnpl_azki", [
        ["enabled", "فعال باشد (پس از عقد قرارداد پذیرندگی)", "switch"], ["label", "نام نمایشی", "text"], ["note", "توضیح کوتاه برای مشتری (مثلاً ۴ قسط بدون کارمزد)", "text"],
        ["installments", "تعداد قسط برای نمایش مبلغ هر قسط (۰ = نمایش نده)", "number"], ["min", "حداقل مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"], ["max", "حداکثر مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"],
        ["apiUrl", "آدرس API (خالی = پیش‌فرض)", "ltr"],
        ["merchantId", "Merchant ID", "ltr"], ["key", "کلید (Key) — رشته هگز", "ltr"],
      ], "اطلاعات را از پنل پذیرندگان ازکی وام بگیرید."],
      ["bnpl_torobpay", [
        ["enabled", "فعال باشد (پس از عقد قرارداد پذیرندگی)", "switch"], ["label", "نام نمایشی", "text"], ["note", "توضیح کوتاه برای مشتری (مثلاً ۴ قسط بدون کارمزد)", "text"],
        ["installments", "تعداد قسط برای نمایش مبلغ هر قسط (۰ = نمایش نده)", "number"], ["min", "حداقل مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"], ["max", "حداکثر مبلغ سفارش (تومان، ۰ = بدون محدودیت)", "number"],
        ["apiUrl", "آدرس API (خالی = پیش‌فرض)", "ltr"],
        ["clientId", "Client ID", "ltr"], ["clientSecret", "Client Secret", "ltr"], ["username", "نام کاربری", "ltr"], ["password", "رمز عبور", "ltr"],
      ], "اطلاعات پذیرنده را پس از قرارداد از ترب‌پی بگیرید."],
    ] },
    tools: { title: "ابزارها", icon: "wrench", groups: [
      ["tools", [
        ["enabled", "صفحه ابزارهای رایگان فعال باشد", "switch"], ["shortRequireLogin", "ساخت لینک کوتاه فقط برای کاربران واردشده", "switch"],
        ["shortGuestDaily", "سقف ساخت لینک کوتاه برای مهمان در هر روز", "number"], ["blockedDomains", "دامنه‌های ممنوع برای کوتاه‌سازی (هر خط یک دامنه، مثلاً example.com)", "lines"],
      ], "روشن یا خاموش کردن هر ابزار از بخش «ابزارها و لینک‌ها» انجام می‌شود."],
    ] },
    demo: { title: "داده‌های نمایشی", icon: "refresh", groups: [] },
  };

  function fieldInput(group, [k, label, type, extra], value) {
    const { icon, faDigits, esc, num } = h();
    const name = `${group}.${k}`;
    if (type === "switch") return `<label class="switch span-2"><input type="checkbox" name="${name}" ${value ? "checked" : ""}><span class="track"></span>${label}</label>`;
    if (type === "select") return `<div class="field"><label class="field-label">${label}</label><select class="select" name="${name}">${extra.map(([v, l]) => `<option value="${v}" ${v === value ? "selected" : ""}>${l}</option>`).join("")}</select></div>`;
    if (type === "color") return `<div class="field"><label class="field-label">${label}</label><div class="row"><input type="color" name="${name}" value="${val(value)}" class="color-input"><code dir="ltr">${val(value)}</code></div></div>`;
    if (type === "number") return `<div class="field"><label class="field-label">${label}</label><input class="input" name="${name}" dir="ltr" inputmode="decimal" value="${k === "minPayout" ? num(value || 0) : faDigits(value ?? "")}"></div>`;
    if (type === "textarea") return `<div class="field span-2"><label class="field-label">${label}</label><textarea class="textarea" name="${name}">${esc(value || "")}</textarea></div>`;
    if (type === "lines") return `<div class="field span-2"><label class="field-label">${label}</label><textarea class="textarea" name="${name}">${esc((value || []).join("\n"))}</textarea></div>`;
    if (type === "code") return `<div class="field span-2"><label class="field-label">${label}</label><textarea class="textarea code-area" dir="ltr" name="${name}" spellcheck="false">${esc(value || "")}</textarea></div>`;
    if (type === "html") return `<div class="field span-2"><div class="row-between"><label class="field-label">${label}</label><button type="button" class="btn btn-ghost btn-xs" data-act="html-preview" data-name="${name}">${icon("eye")} پیش‌نمایش</button></div><textarea class="textarea code-area tall" name="${name}" spellcheck="false">${esc(value || "")}</textarea></div>`;
    if (type === "packages") return `<div class="field span-2"><span class="field-label">${label}</span><div class="rows-editor" data-rows="${name}" data-kind="packages">${(value || []).map((p) => packageRow(p)).join("")}</div><button type="button" class="btn btn-ghost btn-xs" data-act="row-add" data-kind="packages" data-target="${name}">${icon("plus")} افزودن پکیج</button></div>`;
    if (type === "bundle") return `<div class="field span-2"><span class="field-label">${label}</span><div class="bundle-grid">${[2, 3, 4, 5].map((n) => `<label class="mini-field"><span>${faDigits(n)} خدمت (٪)</span><input class="input" dir="ltr" name="${name}.${n}" value="${faDigits(value?.[n] ?? "")}"></label>`).join("")}</div></div>`;
    if (type === "morph") return `<div class="field span-2"><span class="field-label">${label}</span><div class="rows-editor" data-rows="${name}" data-kind="morph">${(value || []).map((m) => morphRow(m)).join("")}</div><button type="button" class="btn btn-ghost btn-xs" data-act="row-add" data-kind="morph" data-target="${name}">${icon("plus")} افزودن کلمه</button></div>`;
    if (type === "deadlines") return `<div class="field span-2"><span class="field-label">${label}</span><div class="rows-editor" data-rows="${name}" data-kind="deadlines">${(value || []).map((d) => deadlineRow(d)).join("")}</div><button type="button" class="btn btn-ghost btn-xs" data-act="row-add" data-kind="deadlines" data-target="${name}">${icon("plus")} افزودن سرعت</button></div>`;
    if (type === "addons") return `<div class="field span-2"><span class="field-label">${label}</span><div class="rows-editor" data-rows="${name}" data-kind="addons">${(value || []).map((a) => addonRow(a)).join("")}</div><button type="button" class="btn btn-ghost btn-xs" data-act="row-add" data-kind="addons" data-target="${name}">${icon("plus")} افزودن خدمت تکمیلی</button></div>`;
    return `<div class="field"><label class="field-label">${label}</label><input class="input" name="${name}" ${type === "ltr" ? 'dir="ltr"' : ""} value="${val(value)}"></div>`;
  }
  const rmBtn = () => `<button type="button" class="icon-btn icon-btn-sm" data-act="row-remove" aria-label="حذف">${BX.icon("cross")}</button>`;
  const packageRow = (p = {}) => `<div class="edit-row" data-row><input class="input" data-f="title" placeholder="عنوان پکیج" value="${val(p.title)}"><input class="input" data-f="price" dir="ltr" placeholder="قیمت" value="${val(p.price)}"><input class="input" data-f="days" dir="ltr" placeholder="روز" value="${val(p.days)}"><label class="switch small"><input type="checkbox" data-f="selected" ${p.selected ? "checked" : ""}><span class="track"></span>پیش‌فرض</label><input type="hidden" data-f="id" value="${val(p.id)}">${rmBtn()}</div>`;
  const upBtn = () => `<button type="button" class="icon-btn icon-btn-sm" data-act="row-up" aria-label="جابه‌جایی به بالا" title="جابه‌جایی به بالا">${BX.icon("chevron-up")}</button>`;
  const morphRow = (m = {}) => `<div class="edit-row" data-row><input class="input" data-f="word" placeholder="کلمه (مثلاً طراحی)" maxlength="24" value="${val(m.word)}"><input class="input" data-f="caption" placeholder="زیرنویس این کلمه" maxlength="160" value="${val(m.caption)}">${upBtn()}${rmBtn()}</div>`;
  const deadlineRow = (d = {}) => `<div class="edit-row" data-row><input class="input" data-f="label" placeholder="عنوان (مثلاً فوری)" value="${val(d.label)}"><input class="input" data-f="hint" placeholder="توضیح" value="${val(d.hint)}"><input class="input" data-f="mult" dir="ltr" placeholder="ضریب قیمت" title="ضریب قیمت (۱ = بدون تغییر)" value="${val(d.mult ?? 1)}"><input class="input" data-f="daysMult" dir="ltr" placeholder="ضریب زمان" title="ضریب زمان تحویل" value="${val(d.daysMult ?? 1)}"><input type="hidden" data-f="v" value="${val(d.v)}"><input type="hidden" data-f="icon" value="${val(d.icon || "clock")}">${rmBtn()}</div>`;
  const addonRow = (a = {}) => `<div class="edit-row" data-row><input class="input" data-f="label" placeholder="عنوان" value="${val(a.label)}"><input class="input" data-f="pct" dir="ltr" placeholder="درصد" title="درصد افزایش قیمت" value="${val(a.pct != null ? Math.round(a.pct * 100) : "")}"><input type="hidden" data-f="v" value="${val(a.v)}">${rmBtn()}</div>`;

  BXD.routes.settings = function (param) {
    const { S, box, icon, esc, faDigits } = h();
    const tab = SETTINGS[param] ? param : "general";
    const head = tabs("settings", Object.entries(SETTINGS).map(([id, t]) => [id, t.title, t.icon]), tab);
    if (tab === "demo") {
      const demo = S.settings.general?.demoMode;
      return `${head}<div class="dash-grid dash-grid-2">
        <section class="card box"><div class="box-head"><h2>${icon("info")}حالت نمایشی</h2></div>
          <p class="muted lh small">در حالت نمایشی، دکمه‌های ورود سریع به حساب‌های نمونه در صفحه ورود نمایش داده می‌شود، کد پیامک تأیید روی صفحه نمایش داده می‌شود و درگاه «تست» بدون پول کار می‌کند.</p>
          <p class="mt-2">وضعیت فعلی: ${demo ? '<span class="badge badge--warn">روشن</span>' : '<span class="badge badge--ok">خاموش</span>'} · ${faDigits(S.demoUsers || 0)} حساب نمونه</p>
          <div class="row mt-2"><button class="btn btn-ghost" data-act="demo-toggle">${demo ? "خاموش کردن حالت نمایشی" : "روشن کردن حالت نمایشی"}</button></div>
        </section>
        <section class="card box danger-zone" style="grid-column:1/-1"><div class="box-head"><h2>${icon("refresh")}شروع واقعی سایت (پاکسازی کامل)</h2></div>
          <p class="muted lh small">هر چیزی که در دوره آزمایش ساخته شده و نمی‌خواهید بماند را انتخاب کنید. تنظیمات سایت، خدمات و شاخه‌ها و حساب‌های مدیر همیشه می‌مانند. این کار برگشت‌پذیر نیست.</p>
          <form data-form="fresh-start" class="mt-2">
            <div class="checks-grid">${[["demo", "حساب‌های نمونه (نمایشی)", true], ["orders", "همه سفارش‌ها، پرداخت‌ها، تراکنش‌ها، تیکت‌ها و اعلان‌ها", true], ["products", "همه محصولات فروشگاه و خریدها", false],
              ["portfolio", "همه نمونه‌کارها", true], ["users", "همه کاربران غیرمدیر (مشتری، طراح، فروشنده)", false], ["tools", "آمار ابزارها و لینک‌های کوتاه", true], ["chats", "گفتگوهای پشتیبانی", true], ["coupons", "کدهای تخفیف", false]]
              .map(([v, l, on]) => `<label class="switch"><input type="checkbox" name="parts" value="${v}" ${on ? "checked" : ""}><span class="track"></span>${l}</label>`).join("")}</div>
            <div class="row mt-2"><input class="input" name="confirm" placeholder="برای تأیید بنویسید: پاکسازی" style="max-width:260px"><button class="btn btn-danger">${icon("trash")} پاکسازی</button></div>
          </form>
        </section>
        <section class="card box danger-zone"><div class="box-head"><h2>${icon("trash")}حذف داده‌های نمایشی</h2></div>
          <p class="muted lh small">همه کاربران نمونه، سفارش‌ها، محصولات، تراکنش‌ها و پیام‌های آن‌ها حذف می‌شود و حالت نمایشی خاموش می‌شود. خدمات، تنظیمات و حساب شما دست‌نخورده می‌ماند. پیش از راه‌اندازی واقعی سایت این کار را انجام دهید.</p>
          <button class="btn btn-danger mt-2" data-act="demo-purge" ${S.demoUsers ? "" : "disabled"}>${icon("trash")} حذف داده‌های نمایشی</button>
        </section></div>`;
    }
    if (tab === "smsTpl") return head + smsTemplatesView();
    const t = SETTINGS[tab];
    return `${head}<div class="dash-grid">${t.groups.map(([group, fields, note]) => box(
      { general: "اطلاعات سایت", shop: "فروشگاه", about: "آمار صفحات", referral: "دعوت از دوستان", cart: "سبد خرید رهاشده", tools: "ابزارهای رایگان", bnpl_snapppay: "اسنپ‌پی", bnpl_digipay: "دیجی‌پی", bnpl_azki: "ازکی وام", bnpl_torobpay: "ترب‌پی", seo: "سئو", contact: "اطلاعات تماس", socials: "شبکه‌های اجتماعی", home: "صفحه اصلی", legal: "قوانین و نمادها", commission: "کارمزد", orders: "تنظیمات سفارش", payment: "درگاه پرداخت", sms: "سرویس پیامک", theme: "رنگ و ظاهر", uploads: "آپلود فایل" }[group] || group,
      t.icon,
      `${note ? `<p class="field-hint mb-2">${note}</p>` : ""}
       <form class="form-grid form-grid-2" data-form="settings" data-group="${group}">
         ${fields.map((f) => fieldInput(group, f, (S.settings[group] || {})[f[0]])).join("")}
         <div class="span-2 row"><button class="btn btn-primary" type="submit">${icon("check")} ذخیره</button>
           ${group === "sms" ? `<button class="btn btn-ghost" type="button" data-act="sms-test">${icon("send")} ارسال کد تأیید آزمایشی به شماره من</button><a class="btn btn-ghost" href="#settings/smsTpl">${icon("list")} قالب‌های پیامک رویدادها</a>` : ""}
           ${group === "payment" ? `<button class="btn btn-ghost" type="button" data-act="payment-test">${icon("zap")} تست اتصال درگاه</button>` : ""}
           ${group.startsWith("bnpl_") ? `<button class="btn btn-ghost" type="button" data-act="bnpl-test" data-id="${group.slice(5)}">${icon("zap")} تست اتصال (پس از ذخیره)</button>` : ""}
           ${group === "legal" ? '<a class="btn btn-ghost" href="terms.html" target="_blank">مشاهده صفحه قوانین</a>' : ""}</div>
       </form>`)).join("")}</div>`;
  };

  // Ready-made SMS templates per event: copy into the SMS panel, then enter the template name/id here
  function smsTemplatesView() {
    const { S, box, icon, esc, faDigits, ago, table } = h();
    const driver = S.settings.sms?.driver || "none";
    const cfg = S.settings.sms_events || {};
    const show = driver === "smsir" ? "smsir" : "kavenegar";
    const EVENT_TITLE = Object.fromEntries((S.smsEvents || []).map((e) => [e.id, e.title]));
    const guide = driver === "smsir"
      ? "در پنل SMS.ir بخش «قالب‌ها» هر متن زیر را به‌عنوان قالب جدید ثبت کنید (متغیرها با #…# هستند). پس از تأیید، «شناسه قالب» را در کادر همان رویداد بنویسید."
      : "در پنل کاوه‌نگار بخش «اعتبارسنجی ← الگوها» هر متن زیر را با یک نام انگلیسی (مثلاً order-new) ثبت کنید. پس از تأیید الگو، همان نام را در کادر رویداد بنویسید.";
    return `<div class="dash-grid">
      ${driver === "none" ? `<div class="banner">${icon("info")}<span>هنوز سرویس پیامک انتخاب نشده است. ابتدا در <a class="brand" href="#settings/sms">تنظیمات ← پیامک</a> کاوه‌نگار یا SMS.ir و کلید API را ذخیره کنید. متن قالب‌ها برای کاوه‌نگار نمایش داده می‌شود.</span></div>` : ""}
      <div class="banner">${icon("send")}<span>${guide} برای پیامک‌های مدیریتی، شماره موبایل مدیر را در تنظیمات پیامک وارد کنید.</span></div>
      <form data-form="sms-events" class="sms-events">
        ${(S.smsEvents || []).map((e) => {
          const c = cfg[e.id] || {};
          return `<section class="card box sms-ev" data-ev="${e.id}">
            <div class="box-head"><h2>${icon("send")}${esc(e.title)} <span class="badge">${esc(e.to)}</span></h2>
              <label class="switch"><input type="checkbox" name="on" ${c.on ? "checked" : ""}><span class="track"></span>ارسال فعال</label></div>
            <div class="sms-tpl"><pre data-tpl>${esc(e[show])}</pre><button type="button" class="btn btn-ghost btn-xs" data-act="copy-tpl" data-ev="${e.id}">${icon("link")} کپی متن</button></div>
            <p class="small muted mt-1">متغیرها: ${e.vars.map((v) => `<code dir="ltr">${esc(v[show])}</code> = ${esc(v.label)}`).join("، ")}</p>
            <div class="row mt-2"><input class="input" name="template" dir="ltr" value="${esc(c.template || "")}" placeholder="${show === "smsir" ? "شناسه قالب، مثلاً 123456" : "نام الگو، مثلاً order-new"}" style="max-width:280px">
              <button type="button" class="btn btn-ghost btn-sm" data-act="sms-event-test" data-ev="${e.id}">${icon("send")} ارسال آزمایشی به شماره من</button></div>
          </section>`;
        }).join("")}
        <div class="row"><button class="btn btn-primary" type="submit">${icon("check")} ذخیره همه</button></div>
      </form>
      ${box("آخرین پیامک‌های ارسالی", "list", table(["زمان", "رویداد", "شماره", "نتیجه", "پاسخ سرویس"], (S.smsLog || []).map((l) => `<tr><td class="muted">${ago(l.at)}</td><td>${esc(EVENT_TITLE[l.event] || l.event)}</td><td dir="ltr">${faDigits(l.phone)}</td>
        <td>${l.ok ? '<span class="badge badge--ok">ارسال شد</span>' : '<span class="badge badge--bad">ناموفق</span>'}</td><td class="small muted">${esc(l.response || "")}</td></tr>`), "هنوز پیامکی ارسال نشده است."))}
    </div>`;
  }
  BXD.forms["sms-events"] = (form) => {
    const value = {};
    form.querySelectorAll("[data-ev]").forEach((sec) => {
      if (!sec.matches("section")) return;
      value[sec.dataset.ev] = { on: sec.querySelector("[name=on]").checked, template: sec.querySelector("[name=template]").value.trim() };
    });
    BXD.quiet(BXD.act("settings.save", { group: "sms_events", value }));
  };

  function collect(form, group) {
    const spec = Object.values(SETTINGS).flatMap((t) => t.groups).find(([g]) => g === group)[1];
    const out = {};
    for (const [k, , type] of spec) {
      const name = `${group}.${k}`;
      const el = form.elements[name];
      if (type === "switch") out[k] = el.checked;
      else if (type === "number") out[k] = Number(BX.enDigits(el.value).replace(/[^\d.]/g, "")) || 0;
      else if (type === "lines") out[k] = el.value.split("\n").map((x) => x.trim()).filter(Boolean);
      else if (type === "bundle") out[k] = Object.fromEntries([2, 3, 4, 5].map((n) => [n, Number(BX.enDigits(form.elements[`${name}.${n}`].value)) || 0]).filter(([, v]) => v > 0));
      else if (type === "morph") {
        out[k] = [...form.querySelectorAll(`[data-rows="${name}"] [data-row]`)].map((row) => ({
          word: row.querySelector('[data-f="word"]').value.trim(), caption: row.querySelector('[data-f="caption"]').value.trim(),
        })).filter((x) => x.word);
      } else if (["packages", "deadlines", "addons"].includes(type)) {
        out[k] = [...form.querySelectorAll(`[data-rows="${name}"] [data-row]`)].map((row, i) => {
          const g = (f) => row.querySelector(`[data-f="${f}"]`);
          if (type === "packages") return { id: g("id").value || `p${i + 1}`, title: g("title").value.trim(), price: Number(BX.enDigits(g("price").value).replace(/\D/g, "")) || 0, days: Number(BX.enDigits(g("days").value)) || 1, selected: g("selected").checked };
          if (type === "morph") return `<div class="field span-2"><span class="field-label">${label}</span><div class="rows-editor" data-rows="${name}" data-kind="morph">${(value || []).map((m) => morphRow(m)).join("")}</div><button type="button" class="btn btn-ghost btn-xs" data-act="row-add" data-kind="morph" data-target="${name}">${icon("plus")} افزودن کلمه</button></div>`;
    if (type === "deadlines") return { v: g("v").value || `d${i + 1}`, label: g("label").value.trim(), hint: g("hint").value.trim(), mult: Number(BX.enDigits(g("mult").value)) || 1, daysMult: Number(BX.enDigits(g("daysMult").value)) || 1, icon: g("icon").value || "clock" };
          return { v: g("v").value || `a${i + 1}`, label: g("label").value.trim(), pct: (Number(BX.enDigits(g("pct").value)) || 0) / 100 };
        }).filter((x) => x.title || x.label);
      } else out[k] = el.value;
    }
    return out;
  }

  BXD.forms["fresh-start"] = (form) => {
    const parts = [...form.querySelectorAll("[name=parts]:checked")].map((x) => x.value);
    BXD.quiet(BXD.act("fresh.start", { parts, confirm: form.elements.confirm.value }));
  };

  BXD.forms.settings = (form) => {
    const group = form.dataset.group;
    BXD.quiet(BXD.act("settings.save", { group, value: collect(form, group) }).then(async () => {
      // Refresh public settings (theme colours, contact…) for the rest of the UI
      Object.assign(BX.settings, BXD.S.settings);
      if (group === "theme") {
        const t = BXD.S.settings.theme;
        document.documentElement.style.setProperty("--brand", t.brand);
        document.documentElement.style.setProperty("--brand-2", t.brand2);
      }
    }));
  };

  Object.assign(BXD.acts, {
    "row-add": (el) => {
      const box = el.parentElement.querySelector(`[data-rows="${el.dataset.target}"]`);
      box.insertAdjacentHTML("beforeend", { packages: packageRow, deadlines: deadlineRow, addons: addonRow, morph: morphRow }[el.dataset.kind]());
      box.lastElementChild?.querySelector("input")?.focus();
    },
    "row-remove": (el) => el.closest("[data-row]").remove(),
    "row-up": (el) => {
      const row = el.closest("[data-row]");
      if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
    },
    "html-preview": (el) => {
      const ta = el.closest(".field").querySelector("textarea");
      BX.modal({ title: "پیش‌نمایش", wide: true, body: `<div class="prose">${ta.value}</div>` });
    },
    "sms-test": () => BXD.quiet(BXD.act("sms.test")),
    "copy-tpl": (el) => {
      const text = el.closest(".sms-tpl").querySelector("[data-tpl]").textContent;
      navigator.clipboard?.writeText(text).then(() => BX.toast("متن قالب کپی شد.", "ok"), () => BX.toast("کپی نشد؛ متن را دستی انتخاب کنید.", "bad"));
    },
    "sms-event-test": async (el) => {
      // save this event's template first so the test uses what is on screen
      const sec = el.closest("section");
      const S = BXD.S;
      const value = { ...(S.settings.sms_events || {}), [el.dataset.ev]: { on: sec.querySelector("[name=on]").checked, template: sec.querySelector("[name=template]").value.trim() } };
      try {
        await BX.api("a.settings.save", { group: "sms_events", value });
        const r = await BX.api("a.sms.eventTest", { event: el.dataset.ev });
        BX.toast(r.message, "ok");
      } catch (err) { BX.toast(err.message, "bad"); }
    },
    "payment-test": async () => {
      try {
        const r = await BX.api("a.payment.test");
        BX.modal({ title: "تست درگاه پرداخت", body: `<p class="lh">${BX.esc(r.message)}</p><p class="muted small lh mt-1">برای اطمینان کامل، یک پرداخت واقعی ۱,۰۰۰ تومانی انجام دهید؛ مبلغ به کیف پول خودتان در سایت اضافه می‌شود و بعد از بازگشت، نتیجه نمایش داده می‌شود.</p>`,
          actions: [{ label: "بستن" }, { label: "پرداخت آزمایشی ۱,۰۰۰ تومان", primary: true, onClick: () => { location.href = r.payUrl; } }] });
      } catch (err) { BX.toast(err.message, "bad"); }
    },
    "bnpl-test": async (el) => {
      try { const r = await BX.api("a.bnpl.test", { id: el.dataset.id }); BX.toast(r.message, "ok"); }
      catch (err) { BX.toast(err.message, "bad"); }
    },
    "demo-purge": () => BXD.ui.confirmBox("حذف داده‌های نمایشی", "همه حساب‌ها و داده‌های نمونه برای همیشه حذف می‌شوند. ادامه می‌دهید؟", () => BXD.quiet(BXD.act("demo.purge")), "حذف"),
    "demo-toggle": () => {
      const g = { ...BXD.S.settings.general, demoMode: !BXD.S.settings.general.demoMode };
      BXD.quiet(BXD.act("settings.save", { group: "general", value: g }));
    },
  });

  // Live label next to colour inputs

  // ============================================================ FREE TOOLS (usage, short links)
  const TOOL_META = {
    files: "فایل", inKB: "حجم ورودی (KB)", outKB: "حجم خروجی (KB)", format: "فرمت", maxWidth: "حداکثر عرض", quality: "کیفیت", pages: "صفحات", selected: "انتخابی",
    mode: "حالت", sizeKB: "حجم (KB)", images: "عکس", page: "قطع", margin: "حاشیه", colors: "رنگ", width: "عرض", height: "ارتفاع", words: "کلمه", chars: "کاراکتر",
    dir: "جهت", digits: "رقم", unit: "واحد", length: "طول", sets: "نوع کاراکتر", kind: "نوع", valid: "معتبر", type: "نوع", size: "اندازه", style: "سبک",
    logo: "لوگو", host: "دامنه", alias: "نام دلخواه", source: "منبع", medium: "رسانه", action: "اقدام",
  };
  const DEVICE = { mobile: "موبایل", desktop: "دسکتاپ", tablet: "تبلت", bot: "ربات", "": "—" };
  const toolsState = { data: null, log: { tool: "", page: 0, items: [] }, q: "" };
  const metaChips = (m) => Object.entries(m || {}).map(([k, v]) => `<span class="meta-chip"><small>${BX.esc(TOOL_META[k] || k)}</small>${BX.esc(typeof v === "boolean" ? (v ? "بله" : "خیر") : BX.faDigits(v))}</span>`).join("") || '<span class="muted">—</span>';

  BXD.routes.tools = function (param) {
    const sub = ["", "log", "links"].includes(param) ? param : "";
    return `${tabs("tools", [["", "آمار ابزارها", "chart"], ["log", "گزارش استفاده", "list"], ["links", "لینک‌های کوتاه", "link"]], sub)}
      <div data-tools-admin="${sub}"><div class="dash-grid"><div class="tiles">${Array.from({ length: 4 }, () => '<div class="card tile skeleton" style="height:110px"></div>').join("")}</div><div class="card box skeleton" style="height:280px"></div></div></div>`;
  };

  async function toolsOverview(el) {
    const { box, tile, table, icon, faDigits, ago } = h();
    const d = (toolsState.data = await BX.api("a.tools.stats"));
    const t = d.totals;
    const max = Math.max(1, ...d.days.map((x) => x.n));
    const days = Array.from({ length: 14 }, (_, i) => {
      const dt = new Date(Date.now() - (13 - i) * 864e5), key = dt.toISOString().slice(0, 10);
      return { n: (d.days.find((x) => x.d === key) || { n: 0 }).n, label: new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(dt) };
    });
    const devTotal = Math.max(1, d.devices.reduce((s, x) => s + x.n, 0));
    const off = new Set(d.settings.disabled || []);
    el.innerHTML = `<div class="dash-grid">
      ${d.settings.enabled ? "" : `<div class="banner">${icon("info")}<span>صفحه ابزارها برای بازدیدکنندگان خاموش است. از <a href="#settings/tools" class="brand">تنظیمات ← ابزارها</a> روشنش کنید.</span></div>`}
      <div class="tiles">
        ${tile("استفاده امروز", faDigits(t.today), "zap", `کل: ${faDigits(t.uses)} بار`)}
        ${tile("کاربران یکتا (۷ روز)", faDigits(t.people), "users", "بر اساس دستگاه")}
        ${tile("لینک‌های کوتاه", faDigits(t.links), "link", `${faDigits(t.clicks)} کلیک`)}
        ${tile("محبوب‌ترین ابزار", BX.esc((d.tools.slice().sort((a, b) => b.week - a.week)[0] || {}).title || "—"), "award", "در ۷ روز گذشته")}
      </div>
      <div class="dash-grid dash-grid-2">
        ${box("استفاده روزانه (۱۴ روز)", "chart", `<div class="day-bars">${days.map((x) => `<div title="${x.label}: ${faDigits(x.n)}"><i style="--h:${(x.n / max) * 100}%"></i><small>${x.label.split(" ")[0]}</small></div>`).join("")}</div>`)}
        ${box("دستگاه کاربران", "monitor", d.devices.length ? d.devices.map((x) => `<div class="hb"><span>${DEVICE[x.k] || x.k}</span><i style="--w:${(x.n / devTotal) * 100}%"></i><b>${faDigits(x.n)}</b></div>`).join("") : '<p class="muted small">هنوز داده‌ای نیست.</p>')}
      </div>
      ${box("ابزارها", "wrench", table(["ابزار", "امروز", "۷ روز", "کل", "افراد یکتا", "آخرین استفاده", "وضعیت", ""], d.tools.map((x) => `<tr>
          <td><b>${BX.esc(x.title)}</b></td><td>${faDigits(x.today)}</td><td>${faDigits(x.week)}</td><td><b>${faDigits(x.total)}</b></td><td>${faDigits(x.people)}</td>
          <td class="muted">${x.last ? ago(x.last) : "—"}</td>
          <td><label class="switch small"><input type="checkbox" data-change="tool-toggle" value="${x.id}" ${off.has(x.id) ? "" : "checked"}><span class="track"></span>${off.has(x.id) ? "خاموش" : "روشن"}</label></td>
          <td><div class="actions"><a class="btn btn-ghost btn-xs" href="#tools/log" data-act="tool-log" data-tool="${x.id}">${icon("list")} گزارش</a><a class="btn btn-ghost btn-xs" href="tools.html#${x.id}" target="_blank">${icon("external")}</a></div></td></tr>`)),
        `<a class="btn btn-ghost btn-xs" href="#settings/tools">${icon("settings")} تنظیمات</a><a class="btn btn-ghost btn-xs" href="tools.html" target="_blank">${icon("external")} صفحه ابزارها</a>`)}
    </div>`;
  }

  async function toolsLog(el, append) {
    const { box, table, icon, faDigits, ago, esc } = h();
    const L = toolsState.log;
    if (!append) { L.page = 0; L.items = []; }
    const r = await BX.api("a.tools.events", { tool: L.tool, page: L.page });
    L.items = L.items.concat(r.events);
    const names = toolsState.data?.tools || [];
    const title = (id) => (names.find((x) => x.id === id) || { title: id }).title;
    el.innerHTML = box("گزارش استفاده از ابزارها", "list", `
      <div class="row-between mb-2"><select class="select" style="max-width:260px" data-change="tool-log-filter"><option value="">همه ابزارها</option>${(names.length ? names : []).map((x) => `<option value="${x.id}" ${x.id === L.tool ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select>
      <span class="muted small">${faDigits(L.items.length)} مورد نمایش داده شده</span></div>
      ${table(["زمان", "ابزار", "کاربر", "دستگاه", "جزئیات"], L.items.map((e) => `<tr>
        <td class="muted" title="${BX.date(e.at)}">${ago(e.at)}</td><td><b>${esc(title(e.tool))}</b></td>
        <td>${e.user ? `<a href="#users" class="brand">${esc(e.user)}</a>` : `<span class="muted">مهمان <small dir="ltr">#${esc(e.visitor.slice(0, 6))}</small></span>`}</td>
        <td>${DEVICE[e.device] || esc(e.device)}</td><td><div class="meta-chips">${metaChips(e.meta)}</div></td></tr>`), "هنوز استفاده‌ای ثبت نشده است.")}
      ${r.more ? `<div class="center mt-2"><button class="btn btn-ghost btn-sm" data-act="tool-log-more">${icon("refresh")} موارد بیشتر</button></div>` : ""}`);
    BXD.labelTables?.(el);
  }

  async function toolsLinks(el) {
    const { box, table, icon, faDigits, ago, esc } = h();
    const r = await BX.api("a.short.list", { q: toolsState.q });
    el.innerHTML = box("لینک‌های کوتاه", "link", `
      <form class="row mb-2" data-tools-search><input class="input" name="q" placeholder="جستجوی کد یا آدرس مقصد…" value="${esc(toolsState.q)}" style="max-width:320px"><button class="btn btn-ghost btn-sm">${icon("search")} جستجو</button></form>
      ${table(["لینک کوتاه", "مقصد", "سازنده", "کلیک", "ساخته‌شده", "وضعیت", ""], r.links.map((l) => `<tr>
        <td><a href="${esc(l.short)}" target="_blank" rel="noopener" dir="ltr" class="brand">/s/${esc(l.code)}</a></td>
        <td><span class="ellipsis" dir="ltr" title="${esc(l.url)}">${esc(l.url)}</span></td>
        <td>${l.owner ? esc(l.owner) : '<span class="muted">مهمان</span>'}</td><td><b>${faDigits(l.clicks)}</b></td><td class="muted">${ago(l.createdAt)}</td>
        <td>${l.active ? '<span class="badge badge--ok">فعال</span>' : '<span class="badge badge--bad">غیرفعال</span>'}</td>
        <td><div class="actions"><button class="btn btn-ghost btn-xs" data-act="short-stats" data-id="${l.id}">${icon("chart")} آمار</button>
          <button class="btn btn-ghost btn-xs" data-act="short-toggle" data-id="${l.id}">${l.active ? "غیرفعال" : "فعال"}</button>
          <button class="icon-btn icon-btn-sm" data-act="short-delete" data-id="${l.id}" aria-label="حذف">${icon("trash")}</button></div></td></tr>`), "هنوز لینک کوتاهی ساخته نشده است.")}`);
    el.querySelector("[data-tools-search]").addEventListener("submit", (e) => { e.preventDefault(); toolsState.q = e.target.elements.q.value.trim(); toolsLinks(el); });
    BXD.labelTables?.(el);
  }

  function loadToolsView(el) {
    const sub = el.dataset.toolsAdmin;
    const job = sub === "log" ? (toolsState.data ? Promise.resolve() : BX.api("a.tools.stats").then((d) => (toolsState.data = d))).then(() => toolsLog(el)) : sub === "links" ? toolsLinks(el) : toolsOverview(el);
    job.then(() => BXD.labelTables?.(el)).catch((err) => { el.innerHTML = `<div class="card empty">${BX.icon("info")}<p>${BX.esc(err.message)}</p></div>`; });
  }
  const prevAfter = BXD.afterRender;
  BXD.afterRender = (view, id, param) => {
    if (prevAfter) prevAfter(view, id, param);
    const el = view.querySelector("[data-tools-admin]");
    if (el) loadToolsView(el);
  };
  const toolsEl = () => document.querySelector("[data-tools-admin]");
  Object.assign(BXD.acts, {
    "product-import": () => productImport(),
    "tool-log": (el) => { toolsState.log.tool = el.dataset.tool; location.hash = "tools/log"; },
    "tool-log-more": () => { toolsState.log.page += 1; toolsLog(toolsEl(), true); },
    "short-stats": (el) => BX.api("a.short.stats", { id: el.dataset.id }).then((d) => BX.shortStatsModal?.(d)).catch((err) => BX.toast(err.message, "bad")),
    "short-toggle": (el) => BX.api("a.short.toggle", { id: el.dataset.id }).then(() => toolsLinks(toolsEl())).catch((err) => BX.toast(err.message, "bad")),
    "short-delete": (el) => BXD.ui.confirmBox("حذف لینک کوتاه", "لینک و آمار کلیک‌هایش حذف می‌شود و دیگر کار نمی‌کند. ادامه می‌دهید؟", () => BX.api("a.short.delete", { id: el.dataset.id }).then(() => toolsLinks(toolsEl())), "حذف"),
  });
  Object.assign(BXD.changes, {
    "tool-toggle": async (el) => {
      const d = toolsState.data;
      const off = new Set(d.settings.disabled || []);
      el.checked ? off.delete(el.value) : off.add(el.value);
      try {
        await BX.api("a.settings.save", { group: "tools", value: { disabled: [...off] } });
        d.settings.disabled = [...off];
        el.parentElement.lastChild.textContent = el.checked ? "روشن" : "خاموش";
        BX.toast(el.checked ? "ابزار روشن شد." : "ابزار برای بازدیدکنندگان خاموش شد.", "ok");
      } catch (err) { el.checked = !el.checked; BX.toast(err.message, "bad"); }
    },
    "tool-log-filter": (el) => { toolsState.log.tool = el.value; toolsLog(toolsEl()); },
  });

  BXD.changes.noop = () => {};
  document.addEventListener("input", (e) => {
    if (e.target.classList?.contains("color-input")) e.target.nextElementSibling.textContent = e.target.value;
  });
})();
