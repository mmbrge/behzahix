/* ==========================================================================
   BEHIX — login / register (auth.html?mode=register&role=designer&next=…)
   Demo: data stays in this browser. The OTP code is always ۱۲۳۴ until an
   SMS provider is connected on the server.
   ========================================================================== */

(function () {
  "use strict";
  const { CATALOG, PRODUCT_CATEGORIES, db, auth, icon, esc, enDigits, faDigits, toast, qs } = window.BX;
  const box = document.getElementById("auth-main");
  const next = qs("next") || "dashboard.html";
  const DEMO_OTP = "1234";
  const ROLES = [
    { v: "customer", label: "مشتری", icon: "user", hint: "سفارش و خرید" },
    { v: "designer", label: "طراح", icon: "pen", hint: "انجام پروژه" },
    { v: "seller", label: "فروشنده", icon: "store", hint: "فروش فایل" },
  ];
  let mode = qs("mode") === "register" ? "register" : "login";
  let role = ROLES.some((r) => r.v === qs("role")) ? qs("role") : "customer";
  let pending = null; // registration waiting for OTP

  const go = () => (location.href = next);

  function shell(inner) {
    box.innerHTML = `
      <div class="tabs" role="tablist">
        <button type="button" class="tab ${mode === "login" ? "is-active" : ""}" data-mode="login" role="tab">ورود</button>
        <button type="button" class="tab ${mode === "register" ? "is-active" : ""}" data-mode="register" role="tab">ثبت‌نام</button>
      </div>
      <div class="mt-3">${inner}</div>`;
  }

  function loginView() {
    shell(`
      <form class="form-grid" data-form="login" novalidate>
        <div><h2 class="h2-xs">خوش برگشتید 👋</h2><p class="muted small mt-1">با شماره موبایل وارد شوید.</p></div>
        <div class="field"><label class="field-label" for="l-phone">شماره موبایل</label><input class="input" id="l-phone" name="phone" dir="ltr" inputmode="tel" placeholder="09xxxxxxxxx" autocomplete="tel" required></div>
        <div class="field"><label class="field-label" for="l-pass">رمز عبور</label><input class="input" id="l-pass" name="password" type="password" dir="ltr" autocomplete="current-password" required></div>
        <div class="row-between small"><label class="switch"><input type="checkbox" checked><span class="track"></span>مرا به خاطر بسپار</label><button type="button" class="brand" data-otp-login>ورود با کد یکبار مصرف</button></div>
        <button class="btn btn-primary btn-block" type="submit">${icon("lock")} ورود</button>
      </form>
      <div class="divider">ورود سریع به حساب‌های نمونه (دمو)</div>
      <div class="demo-logins">
        <button type="button" data-demo="u-1">${icon("user")}<span><b>مشتری</b><br><small class="muted">سارا محمدی</small></span></button>
        <button type="button" data-demo="d-1">${icon("pen")}<span><b>طراح</b><br><small class="muted">نیما کریمی</small></span></button>
        <button type="button" data-demo="s-1">${icon("store")}<span><b>فروشنده</b><br><small class="muted">استودیو پیکسل</small></span></button>
        <button type="button" data-demo="u-admin">${icon("shield")}<span><b>مدیر کل</b><br><small class="muted">پنل ادمین</small></span></button>
      </div>`);
  }

  function registerView() {
    const extra = role === "designer" ? `
        <div class="field"><span class="field-label">تخصص‌ها <span class="req">*</span></span>
          <div class="chips">${CATALOG.map((c) => `<label class="chip"><input type="checkbox" name="skills" value="${c.id}"><span class="chip-check">${icon("check")}</span>${c.title}</label>`).join("")}</div></div>
        <div class="form-grid form-grid-2">
          <div class="field"><label class="field-label" for="r-portfolio">لینک نمونه‌کار</label><input class="input" id="r-portfolio" name="portfolio" dir="ltr" placeholder="behance.net/…"></div>
          <div class="field"><label class="field-label" for="r-exp">سابقه کار</label><select class="select" id="r-exp" name="exp"><option>کمتر از ۱ سال</option><option>۱ تا ۳ سال</option><option>۳ تا ۵ سال</option><option>بیش از ۵ سال</option></select></div>
        </div>` : role === "seller" ? `
        <div class="field"><label class="field-label" for="r-shop">نام فروشگاه <span class="req">*</span></label><input class="input" id="r-shop" name="shop"></div>
        <div class="field"><span class="field-label">چه محصولاتی می‌فروشید؟</span>
          <div class="chips">${PRODUCT_CATEGORIES.map((c) => `<label class="chip"><input type="checkbox" name="cats" value="${c.id}"><span class="chip-check">${icon("check")}</span>${c.title}</label>`).join("")}</div></div>` : "";
    shell(`
      <form class="form-grid" data-form="register" novalidate>
        <div><h2 class="h2-xs">ساخت حساب کاربری</h2><p class="muted small mt-1">نقش خود را انتخاب کنید.</p></div>
        <div class="role-cards" role="radiogroup">
          ${ROLES.map((r) => `<label class="opt-card"><input type="radio" name="role" value="${r.v}" ${r.v === role ? "checked" : ""}><span class="opt-icon">${icon(r.icon)}</span><b>${r.label}</b><small>${r.hint}</small></label>`).join("")}
        </div>
        <div class="form-grid form-grid-2">
          <div class="field"><label class="field-label" for="r-name">نام و نام خانوادگی <span class="req">*</span></label><input class="input" id="r-name" name="name" autocomplete="name"></div>
          <div class="field"><label class="field-label" for="r-phone">شماره موبایل <span class="req">*</span></label><input class="input" id="r-phone" name="phone" dir="ltr" inputmode="tel" placeholder="09xxxxxxxxx" autocomplete="tel"></div>
        </div>
        <div class="field"><label class="field-label" for="r-pass">رمز عبور <span class="req">*</span></label><input class="input" id="r-pass" name="password" type="password" dir="ltr" autocomplete="new-password" placeholder="حداقل ۶ کاراکتر"></div>
        ${extra}
        ${role !== "customer" ? `<p class="tip small muted" style="display:flex;gap:8px">${icon("info")}<span>حساب ${role === "designer" ? "طراح" : "فروشنده"} پس از بررسی توسط تیم بهیکس فعال می‌شود. تا آن زمان پنل شما در حالت «در انتظار تأیید» است.</span></p>` : ""}
        <label class="switch small"><input type="checkbox" name="agree"><span class="track"></span>قوانین و حریم خصوصی بهیکس را می‌پذیرم.</label>
        <button class="btn btn-primary btn-block" type="submit">ادامه و دریافت کد تأیید ${icon("arrow")}</button>
      </form>`);
  }

  function otpView(phone, onOk) {
    shell(`
      <form class="form-grid" data-form="otp" novalidate style="text-align:center">
        <span class="success-icon" style="margin-inline:auto;background:rgb(255 122 26 / .12);color:var(--brand)">${icon("phone")}</span>
        <div><h2 class="h2-xs">کد تأیید را وارد کنید</h2><p class="muted small mt-1">کد ۴ رقمی به <b dir="ltr">${faDigits(phone)}</b> ارسال شد.<br>(نسخه دمو: کد <b>۱۲۳۴</b>)</p></div>
        <div class="otp">${[0, 1, 2, 3].map((i) => `<input class="input" maxlength="1" inputmode="numeric" data-otp="${i}" aria-label="رقم ${faDigits(i + 1)}">`).join("")}</div>
        <button class="btn btn-primary btn-block" type="submit">تأیید</button>
        <button type="button" class="btn btn-ghost btn-sm" data-back>${icon("arrow-right")} ویرایش اطلاعات</button>
      </form>`);
    const inputs = [...box.querySelectorAll("[data-otp]")];
    inputs[0].focus();
    inputs.forEach((inp, i) => {
      inp.addEventListener("input", () => {
        inp.value = enDigits(inp.value).replace(/\D/g, "").slice(-1);
        if (inp.value && inputs[i + 1]) inputs[i + 1].focus();
        if (inputs.every((x) => x.value)) box.querySelector("[data-form=otp]").requestSubmit();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !inp.value && inputs[i - 1]) inputs[i - 1].focus();
      });
      inp.addEventListener("paste", (e) => {
        const digits = enDigits(e.clipboardData.getData("text")).replace(/\D/g, "").slice(0, 4);
        if (!digits) return;
        e.preventDefault();
        digits.split("").forEach((d, j) => inputs[j] && (inputs[j].value = d));
        if (digits.length === 4) box.querySelector("[data-form=otp]").requestSubmit();
      });
    });
    box.querySelector("[data-form=otp]").addEventListener("submit", (e) => {
      e.preventDefault();
      const code = inputs.map((x) => x.value).join("");
      if (code !== DEMO_OTP) {
        inputs.forEach((x) => { x.value = ""; x.classList.add("is-invalid"); });
        inputs[0].focus();
        return toast("کد تأیید اشتباه است.", "bad");
      }
      onOk();
    });
    box.querySelector("[data-back]").addEventListener("click", () => render());
  }

  function render() {
    const u = auth.current();
    if (u) {
      box.innerHTML = `
        <div class="success" style="padding:24px 0">
          ${window.BX.avatar(u, "avatar-lg")}
          <h2 class="h2-xs mt-2">${esc(u.name)}، شما وارد شده‌اید</h2>
          <div class="cta-actions"><a class="btn btn-primary" href="dashboard.html">رفتن به پنل ${icon("arrow")}</a><button type="button" class="btn btn-ghost" data-logout>${icon("logout")} خروج</button></div>
        </div>`;
      return;
    }
    mode === "login" ? loginView() : registerView();
  }

  const invalid = (els, msg) => {
    box.querySelectorAll(".is-invalid").forEach((x) => x.classList.remove("is-invalid"));
    els.forEach((x) => x && x.classList.add("is-invalid"));
    els[0] && els[0].focus && els[0].focus();
    toast(msg, "bad");
  };

  box.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mode]");
    if (m) { mode = m.dataset.mode; return render(); }
    const d = e.target.closest("[data-demo]");
    if (d) {
      auth.start(d.dataset.demo);
      toast("وارد شدید.", "ok");
      return setTimeout(go, 400);
    }
    if (e.target.closest("[data-logout]")) { auth.logout(); return render(); }
    if (e.target.closest("[data-otp-login]")) {
      const phoneEl = box.querySelector("#l-phone");
      const phone = enDigits(phoneEl.value).trim();
      if (!/^09\d{9}$/.test(phone)) return invalid([phoneEl], "ابتدا شماره موبایل معتبر وارد کنید.");
      const u = db.data.users.find((x) => x.phone === phone);
      if (!u) return invalid([phoneEl], "حسابی با این شماره پیدا نشد؛ ثبت‌نام کنید.");
      if (u.status === "blocked") return invalid([phoneEl], "حساب کاربری شما مسدود شده است.");
      otpView(phone, () => { auth.start(u.id); toast("وارد شدید.", "ok"); setTimeout(go, 400); });
    }
  });

  box.addEventListener("change", (e) => {
    if (e.target.name === "role") { role = e.target.value; registerView(); }
  });

  box.addEventListener("submit", (e) => {
    const f = e.target;
    if (f.dataset.form === "login") {
      e.preventDefault();
      const res = auth.login(enDigits(f.phone.value), f.password.value);
      if (res.error) return invalid([f.phone, f.password], res.error);
      toast(`خوش آمدید ${res.user.name}`, "ok");
      setTimeout(go, 400);
    }
    if (f.dataset.form === "register") {
      e.preventDefault();
      const phone = enDigits(f.phone.value).trim();
      const bad = [];
      if (f.elements.name.value.trim().length < 3) bad.push(f.elements.name);
      if (!/^09\d{9}$/.test(phone)) bad.push(f.phone);
      if (f.password.value.length < 6) bad.push(f.password);
      if (role === "seller" && !f.shop.value.trim()) bad.push(f.shop);
      const skills = role === "designer" ? [...f.querySelectorAll("[name=skills]:checked")].map((x) => x.value) : [];
      if (role === "designer" && !skills.length) bad.push(f.querySelector(".chips"));
      if (bad.length) return invalid(bad, "لطفاً فیلدهای مشخص‌شده را درست وارد کنید.");
      if (!f.agree.checked) return invalid([f.agree.nextElementSibling], "لطفاً قوانین را بپذیرید.");
      if (db.data.users.some((u) => u.phone === phone)) return invalid([f.phone], "این شماره قبلاً ثبت‌نام کرده است؛ وارد شوید.");
      pending = {
        id: db.uid(role === "designer" ? "d" : role === "seller" ? "s" : "u"),
        name: f.elements.name.value.trim(), phone, password: f.password.value, role,
        status: role === "customer" ? "active" : "pending", createdAt: Date.now(), wallet: 0, hue: Math.floor(Math.random() * 360),
        ...(role === "designer" && {
          skills: window.BX.services.filter((s) => skills.includes(s.category)).map((s) => s.id),
          portfolioUrl: f.portfolio.value.trim(), level: "تازه‌وارد", rating: 0, bio: `سابقه: ${f.exp.value}`,
        }),
        ...(role === "seller" && { shopName: f.shop.value.trim(), bio: "", rating: 0, cats: [...f.querySelectorAll("[name=cats]:checked")].map((x) => x.value) }),
      };
      otpView(phone, () => {
        db.data.users.push(pending);
        if (pending.role !== "customer") db.notify("u-admin", `درخواست ${pending.role === "designer" ? "طراح" : "فروشنده"} جدید: ${pending.name}`, pending.role === "designer" ? "designers" : "sellers");
        db.notify(pending.id, "به بهیکس خوش آمدید! 🎉", "overview");
        db.save();
        auth.start(pending.id);
        toast("حساب شما ساخته شد.", "ok");
        setTimeout(go, 500);
      });
    }
  });

  render();
})();
