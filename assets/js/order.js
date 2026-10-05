/* ==========================================================================
   BEHIX — order wizard (order.html?service=ID)
   Each service in BX.CATALOG declares its own fields; this page renders them,
   validates them, estimates the price live and saves a draft as you type.
   ========================================================================== */

window.BX.ready.then(function () {
  "use strict";
  const BX = window.BX;
  const { CATALOG, DEADLINES, ADDONS, STYLES, findService, findCategory, auth, estimate, icon, toman, faDigits, enDigits, esc, qs, toast } = BX;

  const DRAFT_KEY = "behix:draft";
  const STEPS = ["انتخاب خدمت", "جزئیات پروژه", "سلیقه و منابع", "زمان و بودجه", "اطلاعات تماس", "بازبینی و ثبت"];
  const BUDGETS = BX.BUDGETS.length ? BX.BUDGETS : ["هنوز مشخص نیست"];
  // Attachments live in memory only (File objects can't be saved in the draft)
  const pendingFiles = [];
  let couponState = { code: "", valid: null, percent: 0 };

  const root = document.getElementById("wizard");
  const user = auth.current();

  // ---------------------------------------------------------------- State
  const blank = () => ({
    step: 0, serviceId: null, details: {}, desc: "",
    style: { styles: [], colors: ["#ff7a1a", "#1e293b", "#f5f5f5"], noColors: false, refs: "", files: [], hasBrand: "no" },
    deadline: "normal", addons: [], budget: BUDGETS[0], coupon: "",
    contact: { name: user?.name || "", phone: user?.phone || "", email: user?.email || "", business: user?.business || "", way: "phone" },
    agree: false,
  });
  let state = blank();
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (d && d.serviceId && findService(d.serviceId)) state = { ...blank(), ...d, contact: { ...blank().contact, ...d.contact }, style: { ...blank().style, ...d.style, files: [] } };
  } catch (e) { /* ignore broken draft */ }

  const pre = qs("service");
  if (pre && findService(pre) && pre !== state.serviceId) {
    state = blank();
    selectService(pre, false);
    state.step = 1;
  }
  if (!state.serviceId) state.step = 0;

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function selectService(id, render = true) {
    if (state.serviceId === id) return;
    state.serviceId = id;
    state.details = {};
    for (const f of findService(id).fields) {
      if (f.type === "number") state.details[f.id] = f.value ?? f.min ?? 0;
      else if (f.type === "select") state.details[f.id] = f.options[0].v;
      else if (f.type === "chips") state.details[f.id] = [];
    }
    if (render) renderAll();
  }

  // ---------------------------------------------------------------- Helpers
  const priceHint = (p) => (!p ? "" : p > 0 ? `+${shortToman(p)}` : `−${shortToman(-p)}`);
  function shortToman(n) {
    return n >= 1e6 ? `${faDigits(String(+(n / 1e6).toFixed(1)).replace(".", "٫"))} میلیون` : `${faDigits(Math.round(n / 1000))} هزار`;
  }
  const svc = () => findService(state.serviceId);
  const cat = () => svc() && findCategory(svc().category);

  // Coupon validity comes from the server (checked as the user types)
  function coupon() {
    const code = state.coupon.trim().toUpperCase();
    if (!code) return null;
    if (couponState.code !== code || couponState.valid === null) return null;
    return couponState.valid ? { code, percent: couponState.percent } : false;
  }
  let couponTimer;
  function checkCoupon() {
    clearTimeout(couponTimer);
    const code = state.coupon.trim().toUpperCase();
    couponState = { code, valid: null, percent: 0 };
    if (!code) return;
    couponTimer = setTimeout(async () => {
      try {
        const r = await BX.api("coupon.check", { code });
        if (state.coupon.trim().toUpperCase() !== code) return;
        couponState = { code, valid: r.valid, percent: r.percent || 0 };
      } catch (e) {
        couponState = { code, valid: false, percent: 0 };
      }
      const hint = root.querySelector("#coupon-hint");
      if (hint) hint.innerHTML = couponHint();
      bumpPrice();
    }, 400);
  }
  function quote() {
    if (!state.serviceId) return { total: 0, days: 0, discount: 0, final: 0 };
    const q = estimate(state.serviceId, state.details, state.deadline, state.addons);
    const c = coupon();
    const discount = c ? Math.round((q.total * c.percent) / 100 / 100000) * 100000 : 0;
    return { ...q, discount, final: q.total - discount };
  }

  function optionLabel(f, v) {
    return f.options?.find((o) => o.v === v)?.label ?? v;
  }
  function fieldValueText(f, v) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "—";
    if (f.type === "number") return `${faDigits(v)} ${f.suffix || ""}`;
    if (Array.isArray(v)) return v.map((x) => optionLabel(f, x)).join("، ");
    if (f.options) return optionLabel(f, v);
    return String(v);
  }

  // Share of brief fields filled in (motivates a complete brief)
  function completeness() {
    const s = svc();
    if (!s) return 0;
    const checks = [
      ...s.fields.map((f) => {
        const v = state.details[f.id];
        return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
      }),
      state.desc.trim().length > 30,
      state.style.styles.length > 0,
      state.style.refs.trim().length > 0 || pendingFiles.length > 0,
      Boolean(state.contact.name && state.contact.phone),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  // ---------------------------------------------------------------- Field rendering
  function renderField(f) {
    const v = state.details[f.id];
    const req = f.required ? ' <span class="req">*</span>' : "";
    const name = `f-${f.id}`;
    let control = "";
    if (f.type === "number") {
      control = `
        <div class="stepper">
          <button type="button" data-step="-1" data-field="${f.id}" aria-label="کم کردن">${icon("minus")}</button>
          <input class="input" type="text" inputmode="numeric" id="${name}" data-field="${f.id}" data-kind="number" value="${faDigits(v ?? f.value ?? 0)}">
          <button type="button" data-step="1" data-field="${f.id}" aria-label="زیاد کردن">${icon("plus")}</button>
          <span class="suffix">${f.suffix || ""}</span>
        </div>
        <input class="range" type="range" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v ?? f.value}" data-field="${f.id}" data-kind="range" aria-label="${esc(f.label)}">
        ${f.perUnit ? `<span class="field-hint">${f.included ? `${faDigits(f.included)} ${f.suffix || "مورد"} در قیمت پایه · ` : ""}هر ${f.suffix || "مورد"} اضافه ${shortToman(f.perUnit)} تومان</span>` : ""}`;
    } else if (f.type === "select") {
      control = `<select class="select" id="${name}" data-field="${f.id}">
        ${f.options.map((o) => `<option value="${o.v}" ${o.v === v ? "selected" : ""}>${esc(o.label)}${o.price ? ` (${priceHint(o.price)})` : ""}</option>`).join("")}
      </select>`;
    } else if (f.type === "cards") {
      control = `<div class="opt-cards" role="radiogroup">
        ${f.options.map((o) => `
          <label class="opt-card">
            <input type="radio" name="${name}" value="${o.v}" data-field="${f.id}" ${o.v === v ? "checked" : ""}>
            <span class="opt-icon">${icon(o.icon || "sparkle")}</span>
            <b>${esc(o.label)}</b>
            ${o.price ? `<small>${priceHint(o.price)} تومان</small>` : "<small>بدون هزینه اضافه</small>"}
          </label>`).join("")}
      </div>`;
    } else if (f.type === "chips") {
      const arr = Array.isArray(v) ? v : [];
      control = `<div class="chips">
        ${f.options.map((o) => `
          <label class="chip">
            <input type="checkbox" value="${o.v}" data-field="${f.id}" data-kind="multi" ${arr.includes(o.v) ? "checked" : ""}>
            <span class="chip-check">${icon("check")}</span>${esc(o.label)}
            ${o.price ? `<span class="chip-price">${priceHint(o.price)}</span>` : ""}
          </label>`).join("")}
      </div>`;
    } else if (f.type === "textarea") {
      control = `<textarea class="textarea" id="${name}" data-field="${f.id}" placeholder="${esc(f.placeholder || "")}">${esc(v || "")}</textarea>`;
    } else {
      control = `<input class="input" id="${name}" data-field="${f.id}" value="${esc(v || "")}" placeholder="${esc(f.placeholder || "")}" ${f.dir ? `dir="${f.dir}"` : ""}>`;
    }
    const labelFor = ["cards", "chips"].includes(f.type) ? "" : ` for="${name}"`;
    const tag = ["cards", "chips"].includes(f.type) ? "span" : "label";
    return `<div class="field" data-wrap="${f.id}"><${tag} class="field-label"${labelFor}>${esc(f.label)}${req}</${tag}>${control}</div>`;
  }

  // ---------------------------------------------------------------- Steps
  function stepService() {
    const activeCat = cat()?.id || CATALOG[0].id;
    return `
      <h2>چه خدمتی لازم دارید؟</h2>
      <p class="muted">یک شاخه و سپس خدمت مورد نظرتان را انتخاب کنید.</p>
      <div class="svc-tabs" role="tablist">
        ${CATALOG.map((c) => `<button type="button" class="svc-tab ${c.id === activeCat ? "is-active" : ""}" data-cat="${c.id}" style="--h:${c.hue}" role="tab" aria-selected="${c.id === activeCat}">${icon(c.icon)}${esc(c.title)}</button>`).join("")}
      </div>
      <div class="svc-pick" role="radiogroup">
        ${findCategory(activeCat).services.map((s) => `
          <label class="svc-card" style="--h:${findCategory(activeCat).hue}">
            <input type="radio" name="service" value="${s.id}" ${s.id === state.serviceId ? "checked" : ""}>
            <span class="svc-icon">${icon(s.icon)}</span>
            <b>${esc(s.title)}</b>
            <small>${esc(s.desc)}</small>
            <span class="svc-price">از ${shortToman(s.base)} تومان · ${faDigits(s.days)} روز</span>
          </label>`).join("")}
      </div>`;
  }

  function stepDetails() {
    const s = svc();
    return `
      <h2>${esc(s.title)}</h2>
      <p class="muted">${esc(s.desc)}</p>
      <div class="form-grid mt-3">
        ${s.fields.map(renderField).join("")}
        <div class="field">
          <div class="row-between">
            <label class="field-label" for="desc">توضیحات بیشتر</label>
            <button type="button" class="btn btn-ghost btn-sm" data-action="suggest">${icon("sparkles")} پیشنهاد هوشمند متن</button>
          </div>
          <textarea class="textarea" id="desc" data-top="desc" placeholder="هدف پروژه، مخاطب، نکات مهم…">${esc(state.desc)}</textarea>
          <span class="field-hint">هرچه دقیق‌تر بنویسید، نتیجه به سلیقه شما نزدیک‌تر می‌شود.</span>
        </div>
      </div>`;
  }

  function stepStyle() {
    const st = state.style;
    return `
      <h2>سلیقه و منابع</h2>
      <p class="muted">به طراح کمک کنید دقیقاً همان چیزی را بسازد که در ذهن دارید.</p>
      <div class="form-grid mt-3">
        <div class="field">
          <span class="field-label">حس و سبک مورد علاقه</span>
          <div class="chips">${STYLES.map((x) => `<label class="chip"><input type="checkbox" value="${esc(x)}" data-style="styles" ${st.styles.includes(x) ? "checked" : ""}><span class="chip-check">${icon("check")}</span>${esc(x)}</label>`).join("")}</div>
        </div>
        <div class="field">
          <span class="field-label">رنگ‌های سازمانی</span>
          <div class="swatches">
            ${st.colors.map((c, i) => `<label class="swatch" style="background:${c}" title="رنگ ${faDigits(i + 1)}"><input type="color" value="${c}" data-color="${i}" aria-label="رنگ ${faDigits(i + 1)}"></label>`).join("")}
            <label class="switch"><input type="checkbox" data-style-bool="noColors" ${st.noColors ? "checked" : ""}><span class="track"></span>رنگ را به طراح می‌سپارم</label>
          </div>
        </div>
        <div class="field">
          <span class="field-label">هویت بصری فعلی</span>
          <div class="chips">
            ${[["no", "ندارم"], ["logo", "فقط لوگو دارم"], ["full", "برندبوک کامل دارم"]].map(([v, l]) => `<label class="chip"><input type="radio" name="hasBrand" value="${v}" data-style="hasBrand" ${st.hasBrand === v ? "checked" : ""}><span class="chip-check">${icon("check")}</span>${l}</label>`).join("")}
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="refs">نمونه‌های مورد علاقه (لینک)</label>
          <textarea class="textarea" id="refs" data-style="refs" dir="auto" placeholder="لینک سایت، پیج یا تصویری که دوست دارید — هر کدام در یک خط">${esc(st.refs)}</textarea>
        </div>
        <div class="field">
          <span class="field-label">فایل‌های پیوست</span>
          <label class="drop" data-drop>
            ${icon("upload")}
            <b>فایل‌ها را اینجا رها کنید یا کلیک کنید</b>
            <small>لوگو، محتوا، عکس‌ها، اسکرین‌شات‌ها (حداکثر ۵۰ مگابایت)</small>
            <input type="file" multiple data-files>
          </label>
          <div class="file-list">${pendingFiles.map((f, i) => `<span class="file-pill">${icon("file")}${esc(f.name)} <small class="muted">${faDigits(Math.max(1, Math.round(f.size / 1024)))}KB</small><button type="button" data-remove-file="${i}" aria-label="حذف">${icon("cross")}</button></span>`).join("")}</div>
        </div>
      </div>`;
  }

  function stepTime() {
    const s = svc();
    return `
      <h2>زمان‌بندی و بودجه</h2>
      <p class="muted">سرعت تحویل و خدمات تکمیلی را انتخاب کنید.</p>
      <div class="form-grid mt-3">
        <div class="field">
          <span class="field-label">سرعت تحویل</span>
          <div class="opt-cards">
            ${DEADLINES.map((d) => `
              <label class="opt-card">
                <input type="radio" name="deadline" value="${d.v}" data-top="deadline" ${state.deadline === d.v ? "checked" : ""}>
                <span class="opt-icon">${icon(d.icon)}</span>
                <b>${esc(d.label)} · ${faDigits(Math.max(1, Math.round(s.days * d.daysMult)))} روز</b>
                <small>${d.mult === 1 ? "بدون هزینه اضافه" : `+${faDigits(Math.round((d.mult - 1) * 100))}٪ هزینه`}</small>
              </label>`).join("")}
          </div>
        </div>
        <div class="field">
          <span class="field-label">خدمات تکمیلی</span>
          <div class="chips">${ADDONS.map((a) => `<label class="chip"><input type="checkbox" value="${a.v}" data-addon ${state.addons.includes(a.v) ? "checked" : ""}><span class="chip-check">${icon("check")}</span>${esc(a.label)}<span class="chip-price">+${faDigits(Math.round(a.pct * 100))}٪</span></label>`).join("")}</div>
        </div>
        <div class="form-grid form-grid-2">
          <div class="field">
            <label class="field-label" for="budget">بودجه شما</label>
            <select class="select" id="budget" data-top="budget">${BUDGETS.map((b) => `<option ${b === state.budget ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label class="field-label" for="coupon">کد تخفیف</label>
            <input class="input" id="coupon" data-top="coupon" value="${esc(state.coupon)}" placeholder="مثلاً WELCOME10" dir="ltr">
            <span class="field-hint" id="coupon-hint">${couponHint()}</span>
          </div>
        </div>
      </div>`;
  }
  function couponHint() {
    const c = coupon();
    if (c === null) return state.coupon.trim() ? "در حال بررسی کد…" : "اگر کد تخفیف دارید وارد کنید.";
    if (c === false) return '<span class="bad">کد تخفیف معتبر نیست.</span>';
    return `<span class="ok">${faDigits(c.percent)}٪ تخفیف اعمال شد.</span>`;
  }

  function stepContact() {
    const c = state.contact;
    return `
      <h2>اطلاعات تماس</h2>
      <p class="muted">${user ? `با حساب <b>${esc(user.name)}</b> وارد شده‌اید.` : "با ثبت سفارش، حساب کاربری شما با همین شماره ساخته می‌شود تا سفارش را در پنل پیگیری کنید."}</p>
      <div class="form-grid form-grid-2 mt-3">
        <div class="field"><label class="field-label" for="c-name">نام و نام خانوادگی <span class="req">*</span></label><input class="input" id="c-name" data-contact="name" value="${esc(c.name)}" autocomplete="name"></div>
        <div class="field"><label class="field-label" for="c-phone">شماره موبایل <span class="req">*</span></label><input class="input" id="c-phone" data-contact="phone" value="${esc(c.phone)}" dir="ltr" inputmode="tel" placeholder="09xxxxxxxxx" autocomplete="tel" ${user ? "readonly" : ""}></div>
        <div class="field"><label class="field-label" for="c-email">ایمیل</label><input class="input" id="c-email" data-contact="email" value="${esc(c.email)}" dir="ltr" type="email" autocomplete="email"></div>
        <div class="field"><label class="field-label" for="c-biz">نام کسب‌وکار</label><input class="input" id="c-biz" data-contact="business" value="${esc(c.business)}" autocomplete="organization"></div>
        <div class="field span-2">
          <span class="field-label">راه ارتباطی ترجیحی</span>
          <div class="chips">${[["phone", "تماس تلفنی", "phone"], ["telegram", "تلگرام", "telegram"], ["whatsapp", "واتساپ", "chat"], ["panel", "فقط پیام در پنل", "inbox"]].map(([v, l, ic]) => `<label class="chip"><input type="radio" name="way" value="${v}" data-contact="way" ${c.way === v ? "checked" : ""}><span class="chip-check">${icon("check")}</span>${icon(ic)}${l}</label>`).join("")}</div>
        </div>
      </div>`;
  }

  function stepReview() {
    const s = svc();
    const q = quote();
    const st = state.style;
    const rows = [
      ...s.fields.map((f) => [f.label, fieldValueText(f, state.details[f.id])]),
      ["سبک", st.styles.join("، ") || "—"],
      ["رنگ‌ها", st.noColors ? "به انتخاب طراح" : st.colors.map((c) => `<span class="dot" style="background:${c}"></span>`).join(" ")],
      ["پیوست‌ها", pendingFiles.length ? `${faDigits(pendingFiles.length)} فایل` : "—"],
      ["سرعت تحویل", `${DEADLINES.find((d) => d.v === state.deadline).label} (${faDigits(q.days)} روز)`],
      ["خدمات تکمیلی", state.addons.map((a) => ADDONS.find((x) => x.v === a).label).join("، ") || "—"],
      ["بودجه", state.budget],
      ["تماس", `${esc(state.contact.name)} · <span dir="ltr">${faDigits(state.contact.phone)}</span>`],
    ];
    return `
      <h2>بازبینی نهایی</h2>
      <p class="muted">همه چیز درست است؟ بعد از ثبت، کارشناس ما ظرف ۲ ساعت کاری پیش‌فاکتور نهایی را برایتان می‌فرستد.</p>
      <dl class="kv review-kv mt-3">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      ${state.desc ? `<div class="card mt-2" style="padding:14px"><b class="small">توضیحات</b><p class="muted small lh mt-1">${esc(state.desc).replace(/\n/g, "<br>")}</p></div>` : ""}
      <label class="switch mt-3"><input type="checkbox" data-top-bool="agree" ${state.agree ? "checked" : ""}><span class="track"></span>قوانین و شرایط همکاری بهیکس را می‌پذیرم.</label>`;
  }

  const STEP_RENDER = [stepService, stepDetails, stepStyle, stepTime, stepContact, stepReview];

  // ---------------------------------------------------------------- Validation
  function validate(step) {
    const errors = [];
    if (step === 0 && !state.serviceId) errors.push(["service", "لطفاً یک خدمت انتخاب کنید."]);
    if (step === 1) {
      for (const f of svc().fields) {
        const v = state.details[f.id];
        const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
        if (f.required && empty) errors.push([f.id, `«${esc(f.label)}» را مشخص کنید.`]);
      }
    }
    if (step === 4) {
      if (state.contact.name.trim().length < 3) errors.push(["c-name", "نام را کامل وارد کنید."]);
      if (!/^09\d{9}$/.test(enDigits(state.contact.phone).trim())) errors.push(["c-phone", "شماره موبایل معتبر نیست (مثلاً ۰۹۱۲۱۲۳۴۵۶۷)."]);
    }
    if (step === 5 && !state.agree) errors.push(["agree", "لطفاً قوانین را بپذیرید."]);
    return errors;
  }

  // ---------------------------------------------------------------- Render
  function renderSummary() {
    const box = root.querySelector("[data-summary]");
    const s = svc();
    if (!s) {
      box.innerHTML = `<h3>خلاصه سفارش</h3><div class="empty">${icon("inbox")}<p>هنوز خدمتی انتخاب نکرده‌اید.</p></div>`;
      return;
    }
    const q = quote();
    const pct = completeness();
    const np = root.querySelector("[data-wnav-price]");
    if (np) np.textContent = toman(q.final);
    const keyRows = s.fields.filter((f) => f.type !== "textarea").slice(0, 4).map((f) => `<li><span>${esc(f.label)}</span><span>${fieldValueText(f, state.details[f.id])}</span></li>`).join("");
    box.innerHTML = `
      <h3>خلاصه سفارش</h3>
      <div class="summary-svc" style="--h:${cat().hue}">
        <span class="svc-icon">${icon(s.icon)}</span>
        <div><b class="small">${esc(s.title)}</b><br><small class="muted">${esc(cat().title)}</small></div>
      </div>
      <ul class="summary-list">
        ${keyRows}
        <li><span>تحویل</span><span>${faDigits(q.days)} روز (${DEADLINES.find((d) => d.v === state.deadline).label})</span></li>
        ${q.discount ? `<li><span>تخفیف</span><span class="ok">−${toman(q.discount)}</span></li>` : ""}
      </ul>
      <div class="summary-total">
        <p class="muted small">برآورد هزینه</p>
        <p class="price" data-price>${toman(q.final)}</p>
        ${q.discount ? `<p class="old-price">${toman(q.total)}</p>` : ""}
      </div>
      <div class="brief-meter mt-2"><span>کامل بودن بریف</span><div class="progress"><div style="width:${pct}%"></div></div><b>${faDigits(pct)}٪</b></div>
      <p class="tip">${icon("info")}<span>این قیمت تقریبی است. پیش‌فاکتور نهایی بعد از بررسی بریف صادر می‌شود و تا تأیید شما هیچ پرداختی انجام نمی‌شود.</span></p>`;
  }

  function renderPane() {
    const pane = root.querySelector("[data-pane]");
    pane.innerHTML = STEP_RENDER[state.step]();
    // The nav lives outside the animated pane so it can be a fixed bottom bar on phones
    root.querySelector("[data-nav]").innerHTML = `
      ${state.step > 0 ? `<button type="button" class="btn btn-ghost" data-action="prev" aria-label="مرحله قبل">${icon("arrow-right")}<span>مرحله قبل</span></button>` : "<span></span>"}
      <div class="wnav-price"><small>برآورد · مرحله ${faDigits(state.step + 1)} از ${faDigits(STEPS.length)}</small><b data-wnav-price>—</b></div>
      ${state.step < STEPS.length - 1
        ? `<button type="button" class="btn btn-primary" data-action="next">مرحله بعد ${icon("arrow")}</button>`
        : `<button type="button" class="btn btn-primary" data-action="submit">${icon("send")} ثبت سفارش</button>`}`;
    pane.classList.remove("wizard-pane");
    void pane.offsetWidth; // replay the enter animation
    pane.classList.add("wizard-pane");
  }

  function renderSteps() {
    root.querySelector("[data-steps]").innerHTML = STEPS.map((t, i) => `
      <button type="button" class="step-dot ${i < state.step ? "is-done" : ""} ${i === state.step ? "is-current" : ""}" data-goto="${i}" ${i > state.step ? "disabled" : ""}>
        <span>${i < state.step ? icon("check") : faDigits(i + 1)}</span>${t}
      </button>`).join("");
    const bar = root.querySelector("[data-steps]");
    const cur = bar.querySelector(".is-current");
    if (cur && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: cur.offsetLeft - (bar.clientWidth - cur.offsetWidth) / 2, behavior: "smooth" });
    // mouse drag-to-scroll when the bar is narrower than its steps
    if (!bar.dataset.drag) {
      bar.dataset.drag = "1";
      let sx = 0, sl = 0, down = false, moved = false;
      bar.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = bar.scrollLeft; });
      window.addEventListener("pointermove", (e) => { if (!down) return; const d = e.clientX - sx; if (Math.abs(d) > 4) moved = true; bar.scrollLeft = sl - d; });
      window.addEventListener("pointerup", () => { down = false; });
      bar.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
      bar.addEventListener("wheel", (e) => { if (bar.scrollWidth > bar.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { bar.scrollLeft -= e.deltaY; e.preventDefault(); } }, { passive: false });
    }
  }

  function renderAll() {
    renderSteps();
    renderPane();
    renderSummary();
    saveDraft();
  }

  // ---------------------------------------------------------------- Events
  function bumpPrice() {
    renderSummary();
    const p = root.querySelector("[data-price]");
    if (p) {
      p.classList.remove("is-bump");
      void p.offsetWidth;
      p.classList.add("is-bump");
    }
    saveDraft();
  }

  function setNumber(fid, value) {
    const f = svc().fields.find((x) => x.id === fid);
    const n = Math.min(f.max, Math.max(f.min, Math.round(Number(value) || 0)));
    state.details[fid] = n;
    root.querySelectorAll(`[data-field="${fid}"]`).forEach((el) => {
      if (el.dataset.kind === "number") el.value = faDigits(n);
      if (el.dataset.kind === "range") el.value = n;
    });
    bumpPrice();
  }

  function go(step) {
    state.step = step;
    renderAll();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showErrors(errors) {
    toast(errors[0][1], "bad");
    for (const [id] of errors) {
      const el = root.querySelector(`#${CSS.escape(id)}`) || root.querySelector(`[data-wrap="${id}"]`) || root.querySelector(`[data-top-bool="${id}"]`);
      if (el) {
        el.classList.remove("is-invalid");
        void el.offsetWidth;
        el.classList.add("is-invalid");
        if (el.matches("input, textarea, select")) el.focus();
      }
    }
  }

  root.addEventListener("click", (e) => {
    const t = e.target;
    const catBtn = t.closest("[data-cat]");
    if (catBtn) {
      const c = findCategory(catBtn.dataset.cat);
      root.querySelectorAll(".svc-tab").forEach((b) => {
        b.classList.toggle("is-active", b === catBtn);
        b.setAttribute("aria-selected", String(b === catBtn));
      });
      root.querySelector(".svc-pick").innerHTML = c.services.map((s) => `
        <label class="svc-card" style="--h:${c.hue}">
          <input type="radio" name="service" value="${s.id}" ${s.id === state.serviceId ? "checked" : ""}>
          <span class="svc-icon">${icon(s.icon)}</span><b>${esc(s.title)}</b><small>${esc(s.desc)}</small>
          <span class="svc-price">از ${shortToman(s.base)} تومان · ${faDigits(s.days)} روز</span>
        </label>`).join("");
      return;
    }
    const stepBtn = t.closest("[data-step]");
    if (stepBtn) {
      const fid = stepBtn.dataset.field;
      const f = svc().fields.find((x) => x.id === fid);
      setNumber(fid, Number(state.details[fid] ?? f.value) + Number(stepBtn.dataset.step) * (f.step || 1));
      return;
    }
    const rm = t.closest("[data-remove-file]");
    if (rm) {
      pendingFiles.splice(Number(rm.dataset.removeFile), 1);
      renderPane();
      renderSummary();
      saveDraft();
      return;
    }
    const goto = t.closest("[data-goto]");
    if (goto && !goto.disabled) return go(Number(goto.dataset.goto));

    const action = t.closest("[data-action]")?.dataset.action;
    if (action === "prev") go(state.step - 1);
    if (action === "next") {
      const errs = validate(state.step);
      if (errs.length) return showErrors(errs);
      go(state.step + 1);
    }
    if (action === "suggest") suggestBrief();
    if (action === "submit") submit();
  });

  root.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.kind === "number") {
      const n = Number(enDigits(el.value).replace(/[^\d]/g, ""));
      if (!Number.isNaN(n) && el.value !== "") {
        const f = svc().fields.find((x) => x.id === el.dataset.field);
        state.details[el.dataset.field] = Math.min(f.max, Math.max(f.min, n));
        const range = root.querySelector(`[data-field="${el.dataset.field}"][data-kind="range"]`);
        if (range) range.value = state.details[el.dataset.field];
        bumpPrice();
      }
      return;
    }
    if (el.dataset.kind === "range") return setNumber(el.dataset.field, el.value);
    if (el.dataset.field && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["radio", "checkbox"].includes(el.type)))) {
      state.details[el.dataset.field] = el.value;
      return bumpPrice();
    }
    if (el.dataset.top && el.tagName !== "SELECT" && el.type !== "radio") {
      state[el.dataset.top] = el.value;
      if (el.dataset.top === "coupon") {
        checkCoupon();
        root.querySelector("#coupon-hint").innerHTML = couponHint();
        bumpPrice();
      } else saveDraft();
      if (el.dataset.top === "desc") renderSummary();
      return;
    }
    if (el.dataset.style === "refs") {
      state.style.refs = el.value;
      renderSummary();
      return saveDraft();
    }
    if (el.dataset.color) {
      state.style.colors[Number(el.dataset.color)] = el.value;
      el.parentElement.style.background = el.value;
      return saveDraft();
    }
    if (el.dataset.contact && el.type !== "radio") {
      state.contact[el.dataset.contact] = el.value;
      renderSummary();
      return saveDraft();
    }
  });

  root.addEventListener("change", (e) => {
    const el = e.target;
    if (el.name === "service") {
      selectService(el.value, false);
      renderSummary();
      saveDraft();
      // Move on automatically after picking a service
      setTimeout(() => go(1), 250);
      return;
    }
    if (el.dataset.field && (el.tagName === "SELECT" || el.type === "radio")) {
      state.details[el.dataset.field] = el.value;
      return bumpPrice();
    }
    if (el.dataset.kind === "multi") {
      const arr = new Set(state.details[el.dataset.field] || []);
      el.checked ? arr.add(el.value) : arr.delete(el.value);
      state.details[el.dataset.field] = [...arr];
      return bumpPrice();
    }
    if (el.dataset.top && (el.tagName === "SELECT" || el.type === "radio")) {
      state[el.dataset.top] = el.value;
      return bumpPrice();
    }
    if (el.dataset.topBool) {
      state[el.dataset.topBool] = el.checked;
      return saveDraft();
    }
    if (el.hasAttribute("data-addon")) {
      const set = new Set(state.addons);
      el.checked ? set.add(el.value) : set.delete(el.value);
      state.addons = [...set];
      return bumpPrice();
    }
    if (el.dataset.style === "styles") {
      const set = new Set(state.style.styles);
      el.checked ? set.add(el.value) : set.delete(el.value);
      state.style.styles = [...set];
      renderSummary();
      return saveDraft();
    }
    if (el.dataset.style === "hasBrand") {
      state.style.hasBrand = el.value;
      return saveDraft();
    }
    if (el.dataset.styleBool) {
      state.style[el.dataset.styleBool] = el.checked;
      return saveDraft();
    }
    if (el.dataset.contact === "way") {
      state.contact.way = el.value;
      return saveDraft();
    }
    if (el.hasAttribute("data-files")) addFiles(el.files);
  });

  // Drag & drop files (only names/sizes are kept until a backend stores them)
  root.addEventListener("dragover", (e) => {
    const d = e.target.closest("[data-drop]");
    if (d) { e.preventDefault(); d.classList.add("is-over"); }
  });
  root.addEventListener("dragleave", (e) => e.target.closest("[data-drop]")?.classList.remove("is-over"));
  root.addEventListener("drop", (e) => {
    const d = e.target.closest("[data-drop]");
    if (!d) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });
  function addFiles(list) {
    const maxMB = BX.settings.uploads?.maxMB || 50;
    const allowed = String(BX.settings.uploads?.ext || "").split(",").map((x) => x.trim());
    for (const f of list) {
      const ext = f.name.split(".").pop().toLowerCase();
      if (f.size > maxMB * 1024 * 1024) { toast(`«${f.name}» بیشتر از ${faDigits(maxMB)} مگابایت است.`, "bad"); continue; }
      if (allowed.length && !allowed.includes(ext)) { toast(`پسوند «${ext}» مجاز نیست.`, "bad"); continue; }
      pendingFiles.push(f);
    }
    renderPane();
    renderSummary();
    saveDraft();
    toast(`${faDigits(list.length)} فایل اضافه شد.`, "ok");
  }

  // Template-based brief writer from the user's own selections
  function suggestBrief() {
    const s = svc();
    const parts = [];
    for (const f of s.fields) {
      const v = state.details[f.id];
      if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
      parts.push(`${esc(f.label)}: ${fieldValueText(f, v)}`);
    }
    const biz = state.contact.business || "کسب‌وکار ما";
    const styles = state.style.styles.length ? ` حس کلی کار ${state.style.styles.join(" و ")} باشد.` : "";
    const text = `برای ${biz} به «${esc(s.title)}» نیاز داریم. ${parts.join("؛ ")}.${styles} مخاطب اصلی ما … است و مهم‌ترین هدف این پروژه … است. نمونه‌هایی که دوست داریم را در مرحله بعد پیوست می‌کنیم.`;
    state.desc = state.desc ? `${state.desc}\n\n${text}` : text;
    const ta = root.querySelector("#desc");
    ta.value = state.desc;
    ta.focus();
    ta.setSelectionRange(ta.value.indexOf("…"), ta.value.indexOf("…") + 1);
    saveDraft();
    renderSummary();
    toast("پیش‌نویس آماده شد؛ جاهای «…» را کامل کنید.", "ok");
  }

  // ---------------------------------------------------------------- Submit
  let submitting = false;
  async function submit() {
    for (let i = 0; i < STEPS.length; i++) {
      const errs = validate(i);
      if (errs.length) {
        if (i !== state.step) go(i);
        return setTimeout(() => showErrors(errs), 50);
      }
    }
    if (submitting) return;
    submitting = true;
    const btn = root.querySelector('[data-action="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = `${icon("loader")} در حال ثبت…`; }
    let res;
    try {
      res = await BX.api("order.submit", {
        serviceId: state.serviceId, details: state.details, desc: state.desc,
        style: { ...state.style, files: undefined }, deadline: state.deadline, addons: state.addons,
        budget: state.budget, coupon: coupon() ? state.coupon : "", contact: { ...state.contact, phone: enDigits(state.contact.phone).trim() },
      });
    } catch (err) {
      submitting = false;
      if (btn) { btn.disabled = false; btn.innerHTML = `${icon("send")} ثبت سفارش`; }
      if (err.code === "exists") {
        BX.modal({
          title: "این شماره حساب دارد",
          body: `<p class="lh">${esc(err.message)}</p>`,
          actions: [{ label: "بستن" }, { label: "ورود و ادامه", primary: true, onClick: () => { location.href = "auth.html?next=order.html"; } }],
        });
      } else toast(err.message, "bad");
      return;
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    let uploadNote = "";
    if (pendingFiles.length) {
      toast("در حال آپلود فایل‌ها…", "info");
      try {
        await BX.api("order.attach", { id: res.id }, pendingFiles);
      } catch (err) {
        uploadNote = `<br><span class="bad">آپلود پیوست‌ها ناموفق بود (${esc(err.message)})؛ می‌توانید در گفتگوی سفارش دوباره بفرستید.</span>`;
      }
    }
    root.innerHTML = `
      <div class="card success" style="grid-column:1/-1">
        <span class="success-icon">${icon("check")}</span>
        <h2 class="h2-sm mt-2">سفارش شما ثبت شد!</h2>
        <p class="muted lh mt-1">کد پیگیری سفارش:</p>
        <span class="track-code" dir="ltr">${esc(res.code)}</span>
        <p class="muted lh mt-2">کارشناس ما بریف را بررسی می‌کند و پیش‌فاکتور را در پنل شما ثبت می‌کند.${res.createdAccount ? `<br>حساب کاربری شما با شماره <b dir="ltr">${faDigits(res.phone)}</b> ساخته شد. رمز موقت: <b dir="ltr">${faDigits(res.tempPassword)}</b> — آن را یادداشت کنید و از پروفایل تغییر دهید.` : ""}${uploadNote}</p>
        <div class="cta-actions">
          <a href="dashboard.html#orders" class="btn btn-primary">پیگیری در پنل ${icon("arrow")}</a>
          <a href="order.html" class="btn btn-ghost">ثبت سفارش دیگر</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------------------------------------------------------------- Boot
  root.innerHTML = `
    <div>
      <div class="steps" data-steps></div>
      <div class="card wizard-card"><div data-pane></div><div class="wizard-nav" data-nav></div></div>
    </div>
    <aside class="card summary glow" data-summary aria-live="polite"></aside>`;
  renderAll();
  if (state.coupon) checkCoupon();
  if (state.step > 0 && !pre) toast("پیش‌نویس قبلی شما بازیابی شد.", "info");
});
