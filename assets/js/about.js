/* BEHIX — about page: contact form (creates a support ticket) and live contact details */
window.BX.ready.then(function () {
  "use strict";
  const { api, auth, enDigits, toast, esc, faDigits, settings } = window.BX;
  const form = document.getElementById("contact-form");
  const user = auth.current();
  if (user) {
    form.elements.name.value = user.name;
    form.elements.phone.value = user.phone || "";
  }

  // Contact details from the admin panel
  const c = settings.contact || {};
  const so = settings.socials || {};
  const lines = document.getElementById("contact-lines");
  if (lines) {
    const row = (href, ic, label, value, ltr) => `
      <${href ? `a href="${esc(href)}"${href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}` : "div"} class="contact-line">
        <span class="service-icon"><svg class="icon"><use href="#i-${ic}"/></svg></span>
        <span><small class="muted">${label}</small><br><b ${ltr ? 'dir="ltr"' : ""}>${esc(value)}</b></span>
      </${href ? "a" : "div"}>`;
    lines.innerHTML = [
      c.phone && row(`tel:${c.phone}`, "phone", "تلفن", faDigits(c.phone), true),
      c.phone2 && row(`tel:${c.phone2}`, "phone", "تلفن دوم", faDigits(c.phone2), true),
      so.whatsapp && row(so.whatsapp, "whatsapp", "واتساپ", "پیام در واتساپ"),
      so.telegram && row(so.telegram, "telegram", "تلگرام", c.telegramId ? `@${c.telegramId}` : "پیام در تلگرام", true),
      so.instagram && row(so.instagram, "instagram", "اینستاگرام", "صفحه اینستاگرام"),
      c.email && row(`mailto:${c.email}`, "mail", "ایمیل", c.email, true),
      c.address && row("", "home", "آدرس", c.address),
      c.hours && row("", "clock", "ساعات کاری", c.hours),
    ].filter(Boolean).join("");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form.elements;
    const name = f.name.value.trim();
    const phone = enDigits(f.phone.value).trim();
    const message = f.message.value.trim();
    const bad = [];
    if (name.length < 2) bad.push(f.name);
    if (!/^09\d{9}$/.test(phone)) bad.push(f.phone);
    if (message.length < 5) bad.push(f.message);
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    if (bad.length) {
      bad.forEach((el) => el.classList.add("is-invalid"));
      bad[0].focus();
      return toast("لطفاً فیلدهای مشخص‌شده را کامل کنید.", "bad");
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await api("contact.send", { name, phone, subject: f.subject.value, message });
      form.reset();
      toast("پیام شما ثبت شد؛ به‌زودی با شما تماس می‌گیریم.", "ok");
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      btn.disabled = false;
    }
  });
});
