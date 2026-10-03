/* ==========================================================================
   BEHIX — login / register (auth.html?mode=register&role=designer&next=…)
   Password login always works; one-time SMS codes are used when an SMS
   provider is configured in the admin panel.
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
  let mode = qs("mode") === "register" ? "register" : "login";
  let role = ROLES.some((r) => r.v === qs("role")) ? qs("role") : "customer";

  const go = () => (location.href = next);
  const phoneOk = (p) => /^09\d{9}$/.test(p);

  function shell(inner) {
    box.innerHTML = `
      <div class="tabs" role="tablist">
        <button type="button" class="tab ${mode === "login" ? "is-active" : ""}" data-mode="login" role="tab">ورود</button>
        <button type="button" class="tab ${mode === "register" ? "is-active" : ""}" data-mode="register" role="tab">ثبت‌نام</button>
      </div>
      <div class="mt-3">${inner}</div>`;
  }

  function loginView() {
    const demoLabels = { customer: ["مشتری", "user"], designer: ["طراح", "pen"], seller: ["فروشنده", "store"] };
    shell(`
      <form class="form-grid" data-form="login" novalidate>
        <div><h2 class="h2-xs">خوش برگشتید 👋</h2><p class="muted small mt-1">با شماره موبایل وارد شوید.</p></div>
        <div class="field"><label class="field-label" for="l-phone">شماره موبایل</label><input class="input" id="l-phone" name="phone" dir="ltr" inputmode="tel" placeholder="09xxxxxxxxx" autocomplete="tel" required></div>
        <div class="field"><label class="field-label" for="l-pass">رمز عبور</label><input class="input" id="l-pass" name="password" type="password" dir="ltr" autocomplete="current-password" required></div>
        ${smsOn || demo.length ? `<div class="row-between small"><span></span><button type="button" class="brand" data-otp-login>ورود با کد یکبار مصرف</button></div>` : ""}
        <button class="btn btn-primary btn-block" type="submit">${icon("lock")} ورود</button>
      </form>
      ${demo.length ? `
        <div class="divider">ورود سریع به حساب‌های نمونه (حالت نمایشی)</div>
        <div class="demo-logins">${demo.map((r) => `<button type="button" data-demo="${r}">${icon(demoLabels[r]?.[1] || "user")}<span><b>${demoLabels[r]?.[0] || r}</b><br><small class="muted">حساب نمونه</small></span></button>`).join("")}</div>` : ""}`);
  }

  function registerView() {
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
        ${role !== "customer" ? `<p class="tip small muted" style="display:flex;gap:8px">${icon("info")}<span>حساب ${role === "designer" ? "طراح" : "فروشنده"} پس از بررسی توسط تیم ما فعال می‌شود.</span></p>` : ""}
        <label class="switch small"><input type="checkbox" name="agree"><span class="track"></span><span>قوانین و حریم خصوصی را <a href="terms.html" target="_blank" class="brand">(مطالعه)</a> می‌پذیرم.</span></label>
        <button class="btn btn-primary btn-block" type="submit">${smsOn ? "ادامه و دریافت کد تأیید" : "ساخت حساب"} ${icon("arrow")}</button>
      </form>`);
  }

  function otpView(phone, demoCode, onCode) {
    shell(`
      <form class="form-grid" data-form="otp" novalidate style="text-align:center">
        <span class="success-icon" style="margin-inline:auto;background:rgb(255 122 26 / .12);color:var(--brand)">${icon("phone")}</span>
        <div><h2 class="h2-xs">کد تأیید را وارد کنید</h2><p class="muted small mt-1">کد ۵ رقمی به <b dir="ltr">${faDigits(phone)}</b> ارسال شد.${demoCode ? `<br>(حالت نمایشی — کد: <b dir="ltr">${faDigits(demoCode)}</b>)` : ""}</p></div>
        <div class="otp">${[0, 1, 2, 3, 4].map((i) => `<input class="input" maxlength="1" inputmode="numeric" autocomplete="one-time-code" data-otp="${i}" aria-label="رقم ${faDigits(i + 1)}">`).join("")}</div>
        <button class="btn btn-primary btn-block" type="submit">تأیید</button>
        <button type="button" class="btn btn-ghost btn-sm" data-back>${icon("arrow-right")} ویرایش اطلاعات</button>
      </form>`);
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
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = inputs.map((x) => x.value).join("");
      if (code.length !== 5) return;
      try {
        await onCode(code);
      } catch (err) {
        inputs.forEach((x) => { x.value = ""; x.classList.add("is-invalid"); });
        inputs[0].focus();
        toast(err.message, "bad");
      }
    });
    box.querySelector("[data-back]").addEventListener("click", () => render());
  }

  function render() {
    const u = BX.me;
    if (u) {
      box.innerHTML = `
        <div class="success" style="padding:24px 0">
          ${avatar(u, "avatar-lg")}
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
  const busy = (form, on) => {
    const b = form.querySelector("button[type=submit]");
    if (b) b.disabled = on;
  };

  box.addEventListener("click", async (e) => {
    const m = e.target.closest("[data-mode]");
    if (m) { mode = m.dataset.mode; return render(); }
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
    if (e.target.closest("[data-otp-login]")) {
      const phoneEl = box.querySelector("#l-phone");
      const phone = enDigits(phoneEl.value).trim();
      if (!phoneOk(phone)) return invalid([phoneEl], "ابتدا شماره موبایل معتبر وارد کنید.");
      try {
        const r = await api("auth.otp.send", { phone, purpose: "login" });
        otpView(phone, r.demoCode, async (code) => {
          await api("auth.otp.login", { phone, code });
          toast("وارد شدید.", "ok");
          setTimeout(go, 300);
        });
      } catch (err) { invalid([phoneEl], err.message); }
    }
  });

  box.addEventListener("change", (e) => {
    if (e.target.name === "role") { role = e.target.value; registerView(); }
  });

  box.addEventListener("submit", async (e) => {
    const f = e.target;
    if (f.dataset.form === "login") {
      e.preventDefault();
      busy(f, true);
      try {
        const r = await api("auth.login", { phone: enDigits(f.elements.phone.value), password: f.elements.password.value });
        toast(`خوش آمدید ${r.me.name}`, "ok");
        setTimeout(go, 300);
      } catch (err) {
        busy(f, false);
        invalid([f.elements.phone, f.elements.password], err.message);
      }
    }
    if (f.dataset.form === "register") {
      e.preventDefault();
      const el = f.elements;
      const phone = enDigits(el.phone.value).trim();
      const bad = [];
      if (el.name.value.trim().length < 3) bad.push(el.name);
      if (!phoneOk(phone)) bad.push(el.phone);
      if (el.password.value.length < 6) bad.push(el.password);
      if (role === "seller" && !el.shop.value.trim()) bad.push(el.shop);
      const skills = role === "designer" ? [...f.querySelectorAll("[name=skills]:checked")].map((x) => x.value) : [];
      if (role === "designer" && !skills.length) bad.push(f.querySelector(".chips"));
      if (bad.length) return invalid(bad, "لطفاً فیلدهای مشخص‌شده را درست وارد کنید.");
      if (!el.agree.checked) return invalid([el.agree.nextElementSibling], "لطفاً قوانین را بپذیرید.");
      const payload = {
        role, name: el.name.value.trim(), phone, password: el.password.value, skills,
        portfolio: el.portfolio?.value || "", exp: el.exp?.value || "", shop: el.shop?.value || "",
        cats: [...f.querySelectorAll("[name=cats]:checked")].map((x) => x.value),
      };
      const finish = async (code) => {
        await api("auth.register", code ? { ...payload, code } : payload);
        toast("حساب شما ساخته شد.", "ok");
        setTimeout(go, 400);
      };
      busy(f, true);
      try {
        if (smsOn) {
          const r = await api("auth.otp.send", { phone, purpose: "register" });
          otpView(phone, r.demoCode, finish);
        } else {
          await finish();
        }
      } catch (err) {
        busy(f, false);
        toast(err.message, "bad");
      }
    }
  });

  render();
});
