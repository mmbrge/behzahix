/* BEHIX — service landing pages and blog. The server (seo.php) normally sends
   these pages already filled in; on hosts without URL rewriting the block is
   fetched here from seo.php?frag=… instead. */
(function () {
  "use strict";
  const BX = window.BX;
  const page = document.body.dataset.page;
  const root = document.getElementById(page === "service" ? "svc-page" : "blog-root");
  if (!root) return;
  const q = new URLSearchParams(location.search);

  async function fill() {
    if (root.dataset.ssr) return;
    root.innerHTML = `<section class="container page-hero"><div class="skeleton" style="height:220px;border-radius:24px"></div></section>`;
    const params = new URLSearchParams({ frag: page === "service" ? "service" : "blog" });
    for (const k of ["id", "p", "page", "tag"]) if (q.get(k)) params.set(k, q.get(k));
    try {
      const r = await fetch(`seo.php?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("not found");
      root.innerHTML = await r.text();
      const h1 = root.querySelector("h1");
      if (h1) document.title = `${h1.textContent.trim()} | ${BX.settings?.general?.siteNameFa || "بهیکس"}`;
    } catch (e) {
      root.innerHTML = `<section class="container page-hero"><h1>صفحه پیدا نشد</h1><p><a class="brand" href="${page === "service" ? "services.html" : "blog.html"}">بازگشت</a></p></section>`;
    }
  }

  BX.ready.then(fill).then(() => {
    BX.initReveal?.(root);
    // Blog: table of contents for long posts
    const body = root.querySelector(".post-body");
    if (body) {
      const hs = [...body.querySelectorAll("h2")];
      if (hs.length >= 3) {
        const toc = document.createElement("nav");
        toc.className = "post-toc card";
        toc.innerHTML = `<b>فهرست مطالب</b><ol>${hs.map((h, i) => { h.id = h.id || `s${i + 1}`; return `<li><a href="#${h.id}">${BX.esc(h.textContent)}</a></li>`; }).join("")}</ol>`;
        body.before(toc);
      }
    }
  }).catch(() => {});
})();
