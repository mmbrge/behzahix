/* BEHIX — terms & privacy page (texts are edited in admin → settings → legal) */
window.BX.ready.then(async function () {
  "use strict";
  for (const el of document.querySelectorAll("[data-legal]")) {
    try {
      const r = await window.BX.api("page", { slug: el.dataset.legal });
      // Admin-authored HTML; scripts are not executed by innerHTML
      el.innerHTML = `<h2 class="legal-title">${el.dataset.legal === "terms" ? "قوانین و مقررات" : "حریم خصوصی"}</h2>${r.html || "<p>متنی ثبت نشده است.</p>"}`;
    } catch (err) {
      el.innerHTML = `<p class="muted">${window.BX.esc(err.message)}</p>`;
    }
  }
  const links = document.querySelectorAll(".legal-nav a");
  const mark = () => links.forEach((a) => a.classList.toggle("is-active", a.hash === (location.hash || "#terms")));
  window.addEventListener("hashchange", mark);
  mark();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
});
