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
      `<button class="btn btn-primary btn-sm" data-act="add-product">${icon("plus")} محصول جدید</button>`);
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
        ["instagram", "لینک اینستاگرام", "ltr"], ["telegram", "لینک تلگرام", "ltr"], ["whatsapp", "لینک واتساپ (wa.me/98…)", "ltr"],
        ["linkedin", "لینک لینکدین", "ltr"], ["youtube", "لینک یوتیوب", "ltr"], ["aparat", "لینک آپارات", "ltr"], ["x", "لینک ایکس (توییتر)", "ltr"],
      ], "لینک هر شبکه‌ای که خالی باشد در سایت نمایش داده نمی‌شود."],
    ] },
    home: { title: "صفحه اصلی", icon: "home", groups: [
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
        ["deadlines", "سرعت‌های تحویل", "deadlines"], ["addons", "خدمات تکمیلی (درصدی)", "addons"],
        ["styles", "سبک‌های پیشنهادی (هر خط یکی)", "lines"], ["budgets", "بازه‌های بودجه (هر خط یکی)", "lines"],
      ]],
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
        ["apiKey", "کلید API", "ltr"], ["template", "نام الگوی تأیید (کاوه‌نگار)", "ltr"], ["templateId", "شناسه قالب (SMS.ir)", "ltr"], ["paramName", "نام پارامتر کد در قالب (SMS.ir)", "ltr"],
      ], "در پنل پیامک یک الگوی «کد تأیید» بسازید که متغیر %token% (کاوه‌نگار) یا #CODE# (SMS.ir) را داشته باشد."],
    ] },
    theme: { title: "ظاهر", icon: "palette", groups: [
      ["theme", [
        ["brand", "رنگ اصلی", "color"], ["brand2", "رنگ دوم (گرادیان)", "color"],
        ["defaultTheme", "تم پیش‌فرض", "select", [["dark", "تاریک"], ["light", "روشن"]]], ["cursor", "نشانگر موس انیمیشنی", "switch"],
      ]],
      ["uploads", [["maxMB", "حداکثر حجم هر فایل (مگابایت)", "number"], ["ext", "پسوندهای مجاز (با کاما)", "ltr"]], "حداکثر حجم واقعی به تنظیمات PHP هاست (upload_max_filesize) هم بستگی دارد."],
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
        <section class="card box danger-zone"><div class="box-head"><h2>${icon("trash")}حذف داده‌های نمایشی</h2></div>
          <p class="muted lh small">همه کاربران نمونه، سفارش‌ها، محصولات، تراکنش‌ها و پیام‌های آن‌ها حذف می‌شود و حالت نمایشی خاموش می‌شود. خدمات، تنظیمات و حساب شما دست‌نخورده می‌ماند. پیش از راه‌اندازی واقعی سایت این کار را انجام دهید.</p>
          <button class="btn btn-danger mt-2" data-act="demo-purge" ${S.demoUsers ? "" : "disabled"}>${icon("trash")} حذف داده‌های نمایشی</button>
        </section></div>`;
    }
    const t = SETTINGS[tab];
    return `${head}<div class="dash-grid">${t.groups.map(([group, fields, note]) => box(
      { general: "اطلاعات سایت", shop: "فروشگاه", seo: "سئو", contact: "اطلاعات تماس", socials: "شبکه‌های اجتماعی", home: "صفحه اصلی", legal: "قوانین و نمادها", commission: "کارمزد", orders: "تنظیمات سفارش", payment: "درگاه پرداخت", sms: "سرویس پیامک", theme: "رنگ و ظاهر", uploads: "آپلود فایل" }[group] || group,
      t.icon,
      `${note ? `<p class="field-hint mb-2">${note}</p>` : ""}
       <form class="form-grid form-grid-2" data-form="settings" data-group="${group}">
         ${fields.map((f) => fieldInput(group, f, (S.settings[group] || {})[f[0]])).join("")}
         <div class="span-2 row"><button class="btn btn-primary" type="submit">${icon("check")} ذخیره</button>
           ${group === "sms" ? `<button class="btn btn-ghost" type="button" data-act="sms-test">${icon("send")} ارسال پیامک آزمایشی به شماره من</button>` : ""}
           ${group === "legal" ? '<a class="btn btn-ghost" href="terms.html" target="_blank">مشاهده صفحه قوانین</a>' : ""}</div>
       </form>`)).join("")}</div>`;
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
    "demo-purge": () => BXD.ui.confirmBox("حذف داده‌های نمایشی", "همه حساب‌ها و داده‌های نمونه برای همیشه حذف می‌شوند. ادامه می‌دهید؟", () => BXD.quiet(BXD.act("demo.purge")), "حذف"),
    "demo-toggle": () => {
      const g = { ...BXD.S.settings.general, demoMode: !BXD.S.settings.general.demoMode };
      BXD.quiet(BXD.act("settings.save", { group: "general", value: g }));
    },
  });

  // Live label next to colour inputs
  BXD.changes.noop = () => {};
  document.addEventListener("input", (e) => {
    if (e.target.classList?.contains("color-input")) e.target.nextElementSibling.textContent = e.target.value;
  });
})();
