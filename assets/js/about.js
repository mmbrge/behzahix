/* BEHIX — contact form: stores a support ticket for the admin panel */
(function () {
  "use strict";
  const { db, auth, enDigits, toast } = window.BX;
  const form = document.getElementById("contact-form");
  const user = auth.current();
  if (user) {
    form.elements.name.value = user.name;
    form.phone.value = user.phone;
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const phone = enDigits(form.phone.value).trim();
    const message = form.message.value.trim();
    const bad = [];
    if (name.length < 2) bad.push(form.elements.name);
    if (!/^09\d{9}$/.test(phone)) bad.push(form.phone);
    if (message.length < 5) bad.push(form.message);
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    if (bad.length) {
      bad.forEach((el) => el.classList.add("is-invalid"));
      bad[0].focus();
      return toast("لطفاً فیلدهای مشخص‌شده را کامل کنید.", "bad");
    }
    db.data.tickets.unshift({ id: db.uid("tk"), userId: user?.id || null, name, phone, subject: form.subject.value, message, status: "open", at: Date.now(), replies: [] });
    db.notify("u-admin", `پیام جدید از ${name}: ${form.subject.value}`, "tickets");
    db.save();
    form.reset();
    toast("پیام شما ثبت شد؛ به‌زودی با شما تماس می‌گیریم.", "ok");
  });
})();
