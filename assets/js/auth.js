/* ==========================================================================
   BEHIX — login / register (auth.html?mode=register&role=designer&next=…)
   Phone first: the visitor types a mobile number and the site decides —
   unknown number → registration form; known number → pick the account type
   (when the number has several, e.g. customer and seller) → password, or a
   one-time SMS code when SMS (or api.ir OTP) is configured.
   ========================================================================== */

window.BX.ready.then(function () {
  "use strict";
  const BX = window.BX;
  const { CATALOG, PRODUCT_CATEGORIES, api, icon, esc, enDigits, faDigits, toast, qs, avatar } = BX;
  const box = document.getElementById("auth-main");
  const smsOn = Boolean(BX.settings.sms?.enabled);
  const demo = BX.demoAccounts || [];
  const nextRaw = qs("next") || "dashboard.html";
  const next = /^[a-z0-9_-]+\.html([?#].*)?$/i.test(nextRaw) ? nextRaw : "dashboard.html"; // same-site pages only
  const ROLES = [
    { v: "customer", label: "مشتری", icon: "user", hint: "سفارش و خرید" },
    { v: "designer", label: "طراح", icon: "pen", hint: "انجام پروژه" },
    { v: "seller", label: "فروشنده", icon: "store", hint: "فروش فایل" },
  ];
  const roleOf = (v) => ROLES.find((r) => r.v === v) || { v, label: v === "admin" ? "مدیر" : v, icon: v === "admin" ? "shield" : "user", hint: "" };
  const STATUS = { pending: "در انتظار تأیید", blocked: "مسدود" };

  // What we know about the number being signed in
  const st = {
    phone: "", exists: false, accounts: [], otp: false, otpDefault: Boolean(BX.settings.sms?.otpDefault),
    role: "", // chosen account type for sign-in ("" = let the password decide)
    method: "pass", // "pass" | "otp"
    regRole: ROLES.some((r) => r.v === qs("role")) ? qs("role") : "customer",
    adding: false, // creating another account type for a number that already has one
  };

  const go = () => (location.href = next);
  const phoneOk = (p) => /^09\d{9}$/.test(p);
  // «۰۹۱۲ ۳۴۵ ۶۷۸۹»، «+98912…» or «912…» → 09123456789
  const normPhone = (v) => {
    let p = enDigits(String(v || "")).replace(/\D/g, "");
    if (p.startsWith("0098")) p = p.slice(4); else if (p.startsWith("98") && p.length === 12) p = p.slice(2);
    if (p.length === 10 && p[0] === "9") p = "0" + p;
    return p;
  };
  const phoneChip = () => `<div class="auth-phone"><span>${icon("phone")} <b dir="ltr">${faDigits(st.phone)}</b></span><button type="button" class="brand small" data-change-phone>تغییر شماره</button></div>`;
  const freeRoles = () => ROLES.filter((r) => !st.accounts.some((a) => a.role === r.v));

  // ---- Step 1: phone number ----
  function phoneView() {
    const demoLabels = { customer: ["مشتری", "user"], designer: ["طراح", "pen"], seller: ["فروشنده", "store"] };
    box.innerHTML = `
      <form class="form-grid" data-form="phone" novalidate>
        <div><h2 class="h2-xs">ورود یا ثبت‌نام 👋</h2><p class="muted small mt-1">شماره موبایل خود را وارد کنید؛ اگر حساب داشته باشید وارد می‌شوید، وگرنه حساب جدید می‌سازید.</p></div>
        <div class="field"><label class="field-label" for="a-phone">شماره موبایل</label><input class="input" id="a-phone" name="phone" dir="ltr" type="tel" inputmode="tel" maxlength="16" placeholder="09xxxxxxxxx" autocomplete="tel" value="${esc(st.phone)}" required></div>
        <button class="btn btn-primary btn-block" type="submit">ادامه ${icon("arrow")}</button>
      </form>
      ${demo.length ? `
        <div class="divider">ورود سریع به حساب‌های نمونه (حالت نمایشی)</div>
        <div class="demo-logins">${demo.map((r) => `<button type="button" data-demo="${r}">${icon(demoLabels[r]?.[1] || "user")}<span><b>${demoLabels[r]?.[0] || r}</b><br><small class="muted">حساب نمونه</small></span></button>`).join("")}</div>` : ""}`;
    setTimeout(() => box.querySelector("#a-phone")?.focus(), 30);
  }

  // ---- Step 2a: which account type? ----
  function chooseView(list) {
    const free = freeRoles();
    box.innerHTML = `
      <div class="form-grid">
        <div><h2 class="h2-xs">وارد کدام حساب می‌شوید؟</h2><p class="muted small mt-1">این شماره چند نوع حساب کاربری دارد.</p></div>
        ${phoneChip()}
        <div class="acct-pick">${list.map((a) => { const r = roleOf(a.role); return `
          <button type="button" class="acct-opt" data-pick="${esc(a.role)}">
            <span class="opt-icon">${icon(r.icon)}</span>
            <span><b>حساب ${esc(a.title || r.label)}</b><small>${STATUS[a.status] ? esc(STATUS[a.status]) : esc(r.hint)}</small></span>
            ${icon("arrow")}
          </button>`; }).join("")}</div>
        ${free.length ? `<button type="button" class="btn btn-ghost btn-sm" data-add-role>${icon("plus")} ساخت حساب ${free.map((r) => r.label).join(" / ")} با همین شماره</button>` : ""}
      </div>`;
  }

  // ---- Step 2b: sign in (password by default, SMS code optional) ----
  function loginView() {
    const acc = st.accounts.find((a) => a.role === st.role);
    const multi = st.accounts.length > 1;
    const free = freeRoles();
    const otp = st.method === "otp" && st.otp;
    box.innerHTML = `
      <div class="form-grid">
        <div><h2 class="h2-xs">خوش برگشتید 👋</h2><p class="muted small mt-1">${acc ? `ورود به حساب <b>${esc(acc.title)}</b>` : "ورود به حساب کاربری"}${acc && STATUS[acc.status] ? ` · <span class="badge badge--warn">${esc(STATUS[acc.status])}</span>` : ""}</p></div>
        ${phoneChip()}
        ${multi ? `<button type="button" class="brand small" style="justify-self:start" data-choose>${icon("refresh")} انتخاب حساب دیگر</button>` : ""}
        ${st.otp ? `<div class="tabs" role="tablist">
          <button type="button" class="tab ${otp ? "" : "is-active"}" data-method="pass" role="tab">${icon("lock")} رمز عبور</button>
          <button type="button" class="tab ${otp ? "is-active" : ""}" data-method="otp" role="tab">${icon("chat")} کد پیامکی</button>
        </div>` : ""}
        ${otp ? `
          <form class="form-grid" data-form="otp-ask" novalidate>
            <p class="muted small lh">یک کد ۵ رقمی به این شماره پیامک می‌شود؛ بدون نیاز به رمز عبور وارد شوید.</p>
            <button class="btn btn-primary btn-block" type="submit">${icon("send")} ارسال کد ورود</button>
          </form>` : `
          <form class="form-grid" data-form="login" novalidate>
            <input type="text" name="username" value="${esc(st.phone)}" autocomplete="username" hidden>
            <div class="field"><label class="field-label" for="l-pass">رمز عبور</label><input class="input" id="l-pass" name="password" type="password" dir="ltr" autocomplete="current-password" required></div>
            ${st.otp ? `<div class="row-between small"><span></span><button type="button" class="brand" data-method="otp">رمز را فراموش کرده‌اید؟ ورود با کد پیامکی</button></div>` : ""}
            <button class="btn btn-primary btn-block" type="submit">${icon("lock")} ورود</button>
          </form>`}
        ${free.length ? `<p class="small muted center">حساب ${free.map((r) => r.label).join(" یا ")} هم می‌خواهید؟ <button type="button" class="brand" data-add-role>با همین شماره بسازید</button></p>` : ""}
      </div>`;
    const pass = box.querySelector("#l-pass");
    if (pass && st.keepPass) { pass.value = st.keepPass; st.keepPass = ""; }
    setTimeout(() => pass?.focus(), 30);
  }

  // ---- Step 2c: registration (new number, or another account type for a known one) ----
  function registerView() {
    const roles = st.exists ? freeRoles() : ROLES;
    if (!roles.some((r) => r.v === st.regRole)) st.regRole = roles[0]?.v || "customer";
    const role = st.regRole;
    // without SMS, a second account type is proven with the existing account's password
    const ownerPass = st.exists && !smsOn;
    const extra = role === "designer" ? `
        <div class="field"><span class="field-label">تخصص‌ها <span class="req">*</span></span>
          <div class="chips">${CATALOG.map((c) => `<label class="chip"><input type="checkbox" name="skills" value="${esc(c.id)}"><span class="chip-check">${icon("check")}</span>${esc(c.title)}</label>`).join("")}</div></div>
        <div class="form-grid form-grid-2">
          <div class="field"><label class="field-label" for="r-portfolio">لینک نمونه‌کار</label><input class="input" id="r-portfolio" name="portfolio" dir="ltr" placeholder="behance.net/…"></div>
          <div class="field"><label class="field-label" for="r-exp">سابقه کار</label><select class="select" id="r-exp" name="exp"><option>کمتر از ۱ سال</option><option>۱ تا ۳ سال</option><option>۳ تا ۵ سال</option><option>بیش از ۵ سال</option></select></div>
        </div>` : role === "seller" ? `
        <div class="field"><label class="field-label" for="r-shop">نام فروشگاه <span class="req">*</span></label><input class="input" id="r-shop" name="shop"></div>
        <div class="field"><span class="field-label">چه محصولاتی می‌فروشید؟</span>
          <div class="chips">${PRODUCT_CATEGORIES.map((c) => `<label class="chip"><input type="checkbox" name="cats" value="${esc(c.id)}"><span class="chip-check">${icon("check")}</span>${esc(c.title)}</label>`).join("")}</div></div>` : "";
    box.innerHTML = `
      <form class="form-grid" data-form="register" novalidate>
        <div><h2 class="h2-xs">${st.exists ? "ساخت نوع حساب جدید" : "ساخت حساب کاربری"}</h2><p class="muted small mt-1">${st.exists ? "این شماره قبلاً حساب دارد؛ نوع حساب جدید را انتخاب کنید." : "این شماره هنوز ثبت‌نام نکرده است. نوع حساب را انتخاب کنید."}</p></div>
        ${phoneChip()}
        <div class="role-cards" role="radiogroup" ${roles.length < 3 ? `style="grid-template-columns:repeat(${roles.length},1fr)"` : ""}>
          ${roles.map((r) => `<label class="opt-card"><input type="radio" name="role" value="${r.v}" ${r.v === role ? "checked" : ""}><span class="opt-icon">${icon(r.icon)}</span><b>${r.label}</b><small>${r.hint}</small></label>`).join("")}
        </div>
        <div class="field"><label class="field-label" for="r-name">نام و نام خانوادگی <span class="req">*</span></label><input class="input" id="r-name" name="name" autocomplete="name"></div>
        <input type="text" name="username" value="${esc(st.phone)}" autocomplete="username" hidden>
        <div class="field"><label class="field-label" for="r-pass">${ownerPass ? "رمز عبور حساب فعلی شما" : "رمز عبور"} <span class="req">*</span></label><input class="input" id="r-pass" name="password" type="password" dir="ltr" autocomplete="${ownerPass ? "current-password" : "new-password"}" placeholder="${ownerPass ? "همان رمزی که با آن وارد می‌شوید" : "حداقل ۶ کاراکتر"}">
          ${ownerPass ? `<span class="field-hint">برای امنیت، مالکیت شماره با رمز حساب فعلی تأیید می‌شود و حساب جدید هم همین رمز را می‌گیرد.</span>` : ""}</div>
        ${extra}
        ${role !== "customer" ? `<p class="tip small muted" style="display:flex;gap:8px">${icon("info")}<span>حساب ${role === "designer" ? "طراح" : "فروشنده"} پس از بررسی توسط تیم ما فعال می‌شود.</span></p>` : ""}
        <label class="switch small"><input type="checkbox" name="agree"><span class="track"></span><span>قوانین و حریم خصوصی را <a href="terms.html" target="_blank" class="brand">(مطالعه)</a> می‌پذیرم.</span></label>
        <button class="btn btn-primary btn-block" type="submit">${smsOn ? "ادامه و دریافت کد تأیید" : "ساخت حساب"} ${icon("arrow")}</button>
        ${st.exists ? `<button type="button" class="btn btn-ghost btn-sm" data-back-login>${icon("arrow-right")} بازگشت به ورود</button>` : ""}
      </form>`;
    setTimeout(() => box.querySelector("#r-name")?.focus(), 30);
  }

  function otpView(phone, demoCode, onCode, again) {
    box.innerHTML = `
      <form class="form-grid" data-form="otp" novalidate style="text-align:center">
        <span class="success-icon" style="margin-inline:auto;background:rgb(255 122 26 / .12);color:var(--brand)">${icon("phone")}</span>
        <div><h2 class="h2-xs">کد تأیید را وارد کنید</h2><p class="muted small mt-1">کد ۵ رقمی به <b dir="ltr">${faDigits(phone)}</b> ارسال شد.${demoCode ? `<br>(حالت نمایشی — کد: <b dir="ltr">${faDigits(demoCode)}</b>)` : ""}</p></div>
        <div class="otp">${[0, 1, 2, 3, 4].map((i) => `<input class="input" maxlength="1" inputmode="numeric" autocomplete="one-time-code" data-otp="${i}" aria-label="رقم ${faDigits(i + 1)}">`).join("")}</div>
        <button class="btn btn-primary btn-block" type="submit">تأیید</button>
        <div class="row-between small"><button type="button" class="brand" data-resend disabled>ارسال دوباره (<span data-left>۶۰</span>)</button><button type="button" class="brand" data-back>${icon("arrow-right")} بازگشت</button></div>
      </form>`;
    const inputs = [...box.querySelectorAll("[data-otp]")];
    const form = box.querySelector("[data-form=otp]");
    inputs[0].focus();
    inputs.forEach((inp, i) => {
      inp.addEventListener("input", () => {
        inp.value = enDigits(inp.value).replace(/\D/g, "").slice(-1);
        if (inp.value && inputs[i + 1]) inputs[i + 1].focus();
        if (inputs.every((x) => x.value)) form.requestSubmit();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !inp.value && inputs[i - 1]) inputs[i - 1].focus();
      });
      inp.addEventListener("paste", (e) => {
        const digits = enDigits(e.clipboardData.getData("text")).replace(/\D/g, "").slice(0, 5);
        if (!digits) return;
        e.preventDefault();
        digits.split("").forEach((d, j) => inputs[j] && (inputs[j].value = d));
        if (digits.length === 5) form.requestSubmit();
      });
    });
    let busyCode = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = inputs.map((x) => x.value).join("");
      if (code.length !== 5 || busyCode) return;
      busyCode = true;
      try {
        await onCode(code);
      } catch (err) {
        inputs.forEach((x) => { x.value = ""; x.classList.add("is-invalid"); });
        inputs[0].focus();
        toast(err.message, "bad");
      }
      busyCode = false;
    });
    // resend after a minute (the server refuses sooner)
    const resend = box.querySelector("[data-resend]");
    let left = 60;
    const t = setInterval(() => {
      if (!resend.isConnected) return clearInterval(t);
      left -= 1;
      if (left > 0) resend.querySelector("[data-left]").textContent = faDigits(left);
      else { clearInterval(t); resend.disabled = false; resend.textContent = "ارسال دوباره کد"; }
    }, 1000);
    resend.addEventListener("click", () => again && again());
    box.querySelector("[data-back]").addEventListener("click", () => render());
  }

  // Signed in already: offer the other account types of the same number
  function signedInView(u) {
    const others = u.accounts || [];
    box.innerHTML = `
      <div class="success" style="padding:24px 0">
        ${avatar(u, "avatar-lg")}
        <h2 class="h2-xs mt-2">${esc(u.name)}، شما وارد شده‌اید</h2>
        <p class="muted small mt-1">حساب ${esc(roleOf(u.role).label)}</p>
        <div class="cta-actions"><a class="btn btn-primary" href="dashboard.html">رفتن به پنل ${icon("arrow")}</a><button type="button" class="btn btn-ghost" data-logout>${icon("logout")} خروج</button></div>
        ${others.length ? `<div class="acct-pick mt-3" style="text-align:right">${others.map((a) => { const r = roleOf(a.role); return `
          <button type="button" class="acct-opt" data-switch="${esc(a.role)}"><span class="opt-icon">${icon(r.icon)}</span><span><b>رفتن به حساب ${esc(r.label)}</b><small>${STATUS[a.status] ? esc(STATUS[a.status]) : "با همین شماره"}</small></span>${icon("arrow")}</button>`; }).join("")}</div>` : ""}
      </div>`;
  }

  function render() {
    if (BX.me) return signedInView(BX.me);
    if (!st.phone) return phoneView();
    if (!st.exists || st.adding) return registerView();
    if (st.accounts.length > 1 && !st.role) return chooseView(st.accounts);
    return loginView();
  }

  const invalid = (els, msg) => {
    box.querySelectorAll(".is-invalid").forEach((x) => x.classList.remove("is-invalid"));
    els.forEach((x) => x && x.classList.add("is-invalid"));
    els[0] && els[0].focus && els[0].focus();
    toast(msg, "bad");
  };
  const busy = (form, on) => {
    const b = form.querySelector("button[type=submit]");
    if (b) b.disabled = on;
  };
  const welcome = (r) => { toast(r?.me?.name ? `خوش آمدید ${r.me.name}` : "وارد شدید.", "ok"); setTimeout(go, 300); };
  // The server asks which account when one password/code opens several
  const handleChoose = (r) => {
    if (!r?.chooseRole) return false;
    st.accounts = r.accounts.length ? r.accounts : st.accounts;
    st.role = "";
    chooseView(r.accounts);
    return true;
  };

  async function lookup(phone) {
    const r = await api("auth.lookup", { phone });
    Object.assign(st, {
      phone: r.phone || phone, exists: Boolean(r.exists), accounts: r.accounts || [], otp: Boolean(r.otp),
      otpDefault: Boolean(r.otpDefault), adding: false,
    });
    st.method = st.otp && st.otpDefault ? "otp" : "pass";
    // one visible account: sign in to it; none listed (e.g. admin-only number): the password decides
    st.role = st.accounts.length === 1 ? st.accounts[0].role : "";
    if (qs("mode") === "register" && st.exists && freeRoles().some((x) => x.v === st.regRole)) st.adding = true;
  }

  async function sendLoginCode() {
    const r = await api("auth.otp.send", { phone: st.phone, purpose: "login" });
    otpView(st.phone, r.demoCode, async (code) => {
      const res = await api("auth.otp.login", { phone: st.phone, code, role: st.role });
      if (handleChoose(res)) return;
      if (res.need2fa) return twoStep(res.message);
      welcome(res);
    }, () => sendLoginCode().catch((err) => toast(err.message, "bad")));
  }

  box.addEventListener("click", async (e) => {
    const d = e.target.closest("[data-demo]");
    if (d) {
      try {
        await api("auth.demo", { role: d.dataset.demo });
        toast("وارد شدید.", "ok");
        setTimeout(go, 300);
      } catch (err) { toast(err.message, "bad"); }
      return;
    }
    if (e.target.closest("[data-logout]")) {
      await BX.auth.logout();
      location.reload();
      return;
    }
    const sw = e.target.closest("[data-switch]");
    if (sw) {
      try {
        const r = await api("a.account.switch", { role: sw.dataset.switch });
        BX.me = r.me;
        toast(`وارد حساب ${roleOf(r.me.role).label} شدید.`, "ok");
        setTimeout(go, 300);
      } catch (err) { toast(err.message, "bad"); }
      return;
    }
    if (e.target.closest("[data-change-phone]")) { Object.assign(st, { exists: false, accounts: [], role: "", adding: false }); const p = st.phone; st.phone = ""; phoneView(); box.querySelector("#a-phone").value = p; return; }
    const pick = e.target.closest("[data-pick]");
    if (pick) { st.role = pick.dataset.pick; st.adding = false; return loginView(); }
    if (e.target.closest("[data-choose]")) { st.role = ""; return chooseView(st.accounts); }
    if (e.target.closest("[data-add-role]")) { st.adding = true; return registerView(); }
    if (e.target.closest("[data-back-login]")) { st.adding = false; return render(); }
    const m = e.target.closest("[data-method]");
    if (m) { st.method = m.dataset.method; return loginView(); }
  });

  box.addEventListener("change", (e) => {
    if (e.target.name === "role") { st.regRole = e.target.value; registerView(); }
  });

  // Admin two-step sign-in: code sent by SMS after the password
  function twoStep(msg) {
    BX.modal({
      title: "تأیید دومرحله‌ای",
      body: `<p class="muted small lh">${BX.esc(msg || "کد تأیید پیامک شد.")}</p><input class="input mt-2" id="tf-code" dir="ltr" inputmode="numeric" autocomplete="one-time-code" placeholder="کد ۶ رقمی" maxlength="8">`,
      onOpen: (w) => setTimeout(() => w.querySelector("#tf-code").focus(), 50),
      actions: [{ label: "انصراف" }, { label: "ورود", primary: true, onClick: (w) => {
        api("auth.2fa", { code: enDigits(w.querySelector("#tf-code").value) }).then((r) => { toast(`خوش آمدید ${r.me.name}`, "ok"); setTimeout(go, 300); }).catch((err) => toast(err.message, "bad"));
      } }],
    });
  }

  box.addEventListener("submit", async (e) => {
    const f = e.target;
    if (f.dataset.form === "phone") {
      e.preventDefault();
      const phone = normPhone(f.elements.phone.value);
      if (!phoneOk(phone)) return invalid([f.elements.phone], "شماره موبایل معتبر وارد کنید (مثلاً ۰۹۱۲۳۴۵۶۷۸۹).");
      busy(f, true);
      try {
        await lookup(phone);
        render();
      } catch (err) {
        busy(f, false);
        invalid([f.elements.phone], err.message);
      }
    }
    if (f.dataset.form === "otp-ask") {
      e.preventDefault();
      busy(f, true);
      try { await sendLoginCode(); } catch (err) { busy(f, false); toast(err.message, "bad"); }
    }
    if (f.dataset.form === "login") {
      e.preventDefault();
      if (!f.elements.password.value) return invalid([f.elements.password], "رمز عبور را وارد کنید.");
      busy(f, true);
      try {
        const r = await api("auth.login", { phone: st.phone, password: f.elements.password.value, role: st.role });
        busy(f, false);
        // keep the typed password for the second submit after choosing the account
        if (handleChoose(r)) { st.keepPass = f.elements.password.value; return; }
        if (r.need2fa) return twoStep(r.message);
        welcome(r);
      } catch (err) {
        busy(f, false);
        invalid([f.elements.password], err.message);
      }
    }
    if (f.dataset.form === "register") {
      e.preventDefault();
      const el = f.elements;
      const role = st.regRole;
      const bad = [];
      if (el.name.value.trim().length < 3) bad.push(el.name);
      if (el.password.value.length < 6) bad.push(el.password);
      if (role === "seller" && !el.shop.value.trim()) bad.push(el.shop);
      const skills = role === "designer" ? [...f.querySelectorAll("[name=skills]:checked")].map((x) => x.value) : [];
      if (role === "designer" && !skills.length) bad.push(f.querySelector(".chips"));
      if (bad.length) return invalid(bad, "لطفاً فیلدهای مشخص‌شده را درست وارد کنید.");
      if (!el.agree.checked) return invalid([el.agree.nextElementSibling], "لطفاً قوانین را بپذیرید.");
      const payload = {
        role, name: el.name.value.trim(), phone: st.phone, password: el.password.value, skills,
        portfolio: el.portfolio?.value || "", exp: el.exp?.value || "", shop: el.shop?.value || "",
        cats: [...f.querySelectorAll("[name=cats]:checked")].map((x) => x.value),
      };
      const finish = async (code) => {
        await api("auth.register", code ? { ...payload, code } : payload);
        toast("حساب شما ساخته شد.", "ok");
        setTimeout(go, 400);
      };
      const sendCode = async () => {
        const r = await api("auth.otp.send", { phone: st.phone, purpose: "register", role });
        otpView(st.phone, r.demoCode, finish, () => sendCode().catch((err) => toast(err.message, "bad")));
      };
      busy(f, true);
      try {
        if (smsOn) await sendCode();
        else await finish();
      } catch (err) {
        busy(f, false);
        if (err.code === "need_owner_pass") return invalid([el.password], err.message);
        toast(err.message, "bad");
      }
    }
  });

  render();
});
