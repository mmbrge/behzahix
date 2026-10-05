/* ==========================================================================
   BEHIX — portfolio, shop and designers pages
   Each page has a container with data-view="portfolio|shop|designers".
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const view = document.querySelector("[data-view]");
  if (!view) return;

  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  BX.ready.then(async () => {
    const { CATALOG, findService, findCategory, icon, toman, num, faDigits, esc, art, avatar, toast, modal, date, initReveal, qs, api } = BX;
    const PRODUCT_CATEGORIES = BX.PRODUCT_CATEGORIES;
    const stars = (r) => (r ? `<span class="stars">${icon("star")}${faDigits(Number(r).toFixed(1))}</span>` : '<span class="badge">جدید</span>');
    const loading = () => (view.innerHTML = `<div class="grid-auto">${Array.from({ length: 6 }, () => '<div class="card skeleton"></div>').join("")}</div>`);
    const thumbBg = (item, hue) => (item.image ? `url("api/index.php?r=file&id=${encodeURIComponent(item.image)}") center/cover, ${art(item.id, hue)}` : art(item.id, hue));

    function filterBar({ chips, active, search = true, sorts }) {
      return `
        <div class="filters" data-reveal>
          <div class="filter-chips">${chips.map((c) => `<button type="button" class="filter-chip ${c.id === active ? "is-active" : ""}" data-filter="${esc(c.id)}">${esc(c.label)}</button>`).join("")}</div>
          ${search ? `<label class="search">${icon("search")}<input class="input" type="search" placeholder="جستجو…" data-search aria-label="جستجو"></label>` : ""}
          ${sorts ? `<select class="select sort-select" data-sort aria-label="مرتب‌سازی">${sorts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>` : ""}
        </div>`;
    }
    // "or N instalments of X with SnappPay" under a price
    const bnplHint = (amount) => {
      const b = BX.bnplFor(amount).find((x) => x.installments > 1);
      return b ? `<p class="bnpl-hint">${icon("calendar")}<span>یا ${faDigits(b.installments)} قسط ${toman(Math.ceil(amount / b.installments / 1000) * 1000)} با <b>${esc(b.label)}</b></span></p>` : "";
    };
    const failView = (err) => (view.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(err.message)}</p></div>`);

    // ============================================================= Portfolio
    async function portfolioPage() {
      loading();
      let data;
      try { data = await api("portfolio.list"); } catch (err) { return failView(err); }
      const people = Object.fromEntries(data.designers.map((d) => [d.id, d]));
      const liked = new Set(data.liked.map(String));
      let filter = qs("cat") || "all";
      let term = "";
      let sort = "new";
      view.innerHTML = `
        ${filterBar({ chips: [{ id: "all", label: "همه" }, ...CATALOG.map((c) => ({ id: c.id, label: c.title }))], active: filter, sorts: [["new", "جدیدترین"], ["top", "محبوب‌ترین"]] })}
        <div class="grid-auto" data-list></div>`;
      const list = view.querySelector("[data-list]");

      function render() {
        let items = data.works.filter((w) => (filter === "all" || w.category === filter) && (!term || w.title.includes(term)));
        items = items.sort((a, b) => (sort === "top" ? b.likes - a.likes : b.createdAt - a.createdAt));
        list.innerHTML = items.length ? items.map((w, i) => {
          const s = findService(w.serviceId) || { icon: "image", title: "" };
          const c = findCategory(w.category) || { hue: 25 };
          const d = people[w.designerId];
          const on = liked.has(w.id);
          return `
            <article class="work-card" data-reveal style="--d:${(i % 6) * 60}ms">
              <button type="button" class="work-thumb w-full" data-open="${w.id}" aria-label="مشاهده ${esc(w.title)}">
                <span class="bg" style='background:${thumbBg(w, c.hue)}'></span>
                ${w.image ? "" : `<span class="thumb-icon">${icon(s.icon)}</span>`}
                <span class="work-overlay"><span class="badge" style="color:#fff;border-color:rgb(255 255 255 / .3)">${esc(s.title)}</span>${icon("eye")}</span>
              </button>
              <div class="work-body">
                <h3>${esc(w.title)}</h3>
                <div class="work-meta">
                  <span class="row">${avatar(d, "avatar-sm")}${esc(d?.name || "")}</span>
                  <button type="button" class="like-btn ${on ? "is-on" : ""}" data-like="${w.id}" aria-pressed="${on}" aria-label="پسندیدن">${icon("heart")}<span>${faDigits(w.likes)}</span></button>
                </div>
              </div>
            </article>`;
        }).join("") : `<div class="empty card" style="grid-column:1/-1">${icon("search")}<p>نمونه‌کاری پیدا نشد.</p></div>`;
        initReveal(view);
      }

      view.addEventListener("click", async (e) => {
        const f = e.target.closest("[data-filter]");
        if (f) {
          filter = f.dataset.filter;
          view.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("is-active", b === f));
          return render();
        }
        const like = e.target.closest("[data-like]");
        if (like) {
          try {
            const r = await api("portfolio.like", { id: like.dataset.like });
            const w = data.works.find((x) => x.id === like.dataset.like);
            w.likes = r.likes;
            r.liked ? liked.add(w.id) : liked.delete(w.id);
            render();
          } catch (err) { toast(err.message, "bad"); }
          return;
        }
        const open = e.target.closest("[data-open]");
        if (open) {
          const w = data.works.find((x) => x.id === open.dataset.open);
          const s = findService(w.serviceId) || { icon: "image", title: "", id: "" };
          const c = findCategory(w.category) || { hue: 25, title: "" };
          const d = people[w.designerId];
          modal({
            title: w.title, wide: true,
            body: `
              <div class="detail-thumb" style='background:${thumbBg(w, c.hue)}'>${w.image ? "" : icon(s.icon)}</div>
              <dl class="kv mt-2">
                <dt>خدمت</dt><dd>${esc(s.title)}</dd>
                <dt>شاخه</dt><dd>${esc(c.title)}</dd>
                <dt>طراح</dt><dd>${esc(d?.name || "")}${d?.level ? ` · ${esc(d.level)}` : ""}</dd>
                <dt>تاریخ</dt><dd>${date(w.createdAt)}</dd>
              </dl>`,
            actions: [{ label: "بستن" }, { label: "سفارش مشابه این کار", primary: true, onClick: () => { location.href = `order.html?service=${encodeURIComponent(s.id)}`; } }],
          });
        }
      });
      view.addEventListener("input", (e) => {
        if (e.target.matches("[data-search]")) { term = e.target.value.trim(); render(); }
      });
      view.addEventListener("change", (e) => {
        if (e.target.matches("[data-sort]")) { sort = e.target.value; render(); }
      });
      render();
    }

    // ============================================================= Shop
    async function shopPage() {
      loading();
      let data;
      try { data = await api("products.list"); } catch (err) { return failView(err); }
      const sellers = Object.fromEntries(data.sellers.map((u) => [u.id, u]));
      const favs = new Set(data.favorites);
      const owned = new Set(data.owned);
      let filter = qs("cat") || "all";
      let term = "";
      let sort = "top";
      let couponCode = "";
      let cart = store.get("behix:cart", []).filter((id) => data.products.some((p) => p.id === id) && !owned.has(id));
      store.set("behix:cart", cart);
      const user = BX.me;
      const finalPrice = (p) => Math.round((p.price * (100 - p.discount)) / 100 / 1000) * 1000;
      const catOf = (p) => PRODUCT_CATEGORIES.find((x) => x.id === p.category) || { icon: "box", title: "" };

      view.innerHTML = `
        ${filterBar({ chips: [{ id: "all", label: "همه" }, ...PRODUCT_CATEGORIES.map((c) => ({ id: c.id, label: c.title }))], active: filter, sorts: [["top", "پرفروش‌ترین"], ["new", "جدیدترین"], ["cheap", "ارزان‌ترین"], ["rate", "بالاترین امتیاز"]] })}
        <div class="grid-auto" data-list></div>
        <button type="button" class="cart-fab" data-cart aria-label="سبد خرید">${icon("cart")}<span class="count" data-count>۰</span></button>`;
      const list = view.querySelector("[data-list]");

      const updateCount = (bump) => {
        view.querySelector("[data-count]").textContent = faDigits(cart.length);
        if (bump) {
          const fab = view.querySelector("[data-cart]");
          fab.classList.remove("bump");
          void fab.offsetWidth;
          fab.classList.add("bump");
        }
      };

      function render() {
        let items = data.products.filter((p) => (filter === "all" || p.category === filter) && (!term || p.title.includes(term) || p.tags.some((t) => t.includes(term))));
        const sorters = { top: (a, b) => b.sales - a.sales, new: (a, b) => b.createdAt - a.createdAt, cheap: (a, b) => finalPrice(a) - finalPrice(b), rate: (a, b) => b.rating - a.rating };
        items = items.sort(sorters[sort]);
        list.innerHTML = items.length ? items.map((p, i) => {
          const c = catOf(p);
          const seller = sellers[p.sellerId];
          const inCart = cart.includes(p.id);
          const mine = owned.has(p.id);
          return `
            <article class="work-card" data-reveal style="--d:${(i % 6) * 60}ms">
              <button type="button" class="work-thumb w-full" data-open="${p.id}" aria-label="جزئیات ${esc(p.title)}">
                <span class="bg" style='background:${thumbBg(p)}'></span>
                ${p.image ? "" : `<span class="thumb-icon">${icon(c.icon)}</span>`}
                ${p.discount ? `<span class="off">${faDigits(p.discount)}٪</span>` : ""}
              </button>
              <div class="work-body">
                <h3>${esc(p.title)}</h3>
                <div class="work-meta"><span>${icon("store")} ${esc(seller?.shopName || seller?.name || BX.settings.general?.siteNameFa || "")}</span>${stars(p.rating)}</div>
                <div class="price-row"><span class="now">${toman(finalPrice(p))}</span>${p.discount ? `<span class="was">${num(p.price)}</span>` : ""}</div>
                <div class="card-actions">
                  ${mine ? `<a class="btn btn-ghost" href="dashboard.html#downloads">${icon("download")} خریده‌اید</a>` : `<button type="button" class="btn ${inCart ? "btn-ghost" : "btn-primary"}" data-add="${p.id}">${inCart ? `${icon("check")} در سبد` : `${icon("cart")} افزودن`}</button>`}
                  <button type="button" class="icon-btn like-btn ${favs.has(p.id) ? "is-on" : ""}" data-fav="${p.id}" aria-label="علاقه‌مندی">${icon("heart")}</button>
                </div>
              </div>
            </article>`;
        }).join("") : `<div class="empty card" style="grid-column:1/-1">${icon("search")}<p>محصولی پیدا نشد.</p></div>`;
        initReveal(view);
        updateCount();
      }

      function addToCart(id) {
        if (!cart.includes(id)) {
          cart.push(id);
          store.set("behix:cart", cart);
          toast("به سبد خرید اضافه شد.", "ok");
          updateCount(true);
          render();
        }
      }

      function openCart() {
        const items = cart.map((id) => data.products.find((p) => p.id === id)).filter(Boolean);
        const total = items.reduce((s, p) => s + finalPrice(p), 0);
        const wallet = user?.wallet || 0;
        const wrap = document.createElement("div");
        wrap.className = "drawer-wrap";
        wrap.innerHTML = `
          <aside class="drawer" role="dialog" aria-modal="true" aria-label="سبد خرید">
            <div class="row-between"><h3>سبد خرید (${faDigits(items.length)})</h3><button type="button" class="icon-btn" data-close aria-label="بستن">${icon("cross")}</button></div>
            <div class="drawer-items">
              ${items.length ? items.map((p) => `
                <div class="drawer-item">
                  <span class="mini" style='background:${thumbBg(p)}'></span>
                  <div class="grow"><b>${esc(p.title)}</b><br><span class="muted">${toman(finalPrice(p))}</span></div>
                  <button type="button" class="icon-btn" data-remove="${p.id}" aria-label="حذف">${icon("trash")}</button>
                </div>`).join("") : `<div class="empty">${icon("cart")}<p>سبد خرید خالی است.</p></div>`}
            </div>
            ${items.length ? `<form class="coupon-row" data-coupon><input class="input" name="code" dir="ltr" placeholder="کد تخفیف" value="${esc(couponCode)}" aria-label="کد تخفیف"><button class="btn btn-ghost btn-sm" type="submit">اعمال</button></form><p class="small" data-coupon-note></p>` : ""}
            <div class="row-between"><span class="muted">جمع کل</span><b class="price" style="font-size:1.4rem" data-total>${toman(total)}</b></div>
            ${user ? `<p class="small muted mt-1">موجودی کیف پول: ${toman(wallet)}${wallet && wallet < total ? ` — ${toman(total - wallet)} از درگاه پرداخت می‌شود` : ""}</p>` : '<p class="small muted mt-1">برای خرید ابتدا وارد شوید.</p>'}
            ${user && items.length && wallet < total && BX.bnplFor(total - wallet).length ? `<p class="small mt-2"><b>روش پرداخت</b></p>${BX.payOptions(total - wallet)}` : ""}
            <button type="button" class="btn btn-primary btn-block mt-2" data-checkout ${items.length ? "" : "disabled"}>${icon("lock")} ${user && wallet >= total ? "پرداخت از کیف پول" : "پرداخت و دانلود"}</button>
          </aside>`;
        const close = () => wrap.remove();
        const applyCoupon = async () => {
          const note = wrap.querySelector("[data-coupon-note]");
          if (!note) return;
          try {
            const q = await api("shop.quote", { items: cart, coupon: couponCode });
            wrap.querySelector("[data-total]").textContent = toman(q.total);
            note.className = `small ${q.coupon ? "ok" : couponCode ? "bad" : ""}`;
            note.textContent = q.coupon ? `${faDigits(q.coupon)}٪ تخفیف اعمال شد (−${toman(q.discount)})` : couponCode ? "این کد برای محصولات سبد شما معتبر نیست." : "";
          } catch (err) { note.textContent = err.message; }
        };
        wrap.addEventListener("submit", (e) => {
          if (!e.target.matches("[data-coupon]")) return;
          e.preventDefault();
          couponCode = e.target.elements.code.value.trim().toUpperCase();
          applyCoupon();
        });
        if (couponCode) applyCoupon();
        wrap.addEventListener("click", (e) => {
          if (e.target === wrap || e.target.closest("[data-close]")) return close();
          const rm = e.target.closest("[data-remove]");
          if (rm) {
            cart = cart.filter((x) => x !== rm.dataset.remove);
            store.set("behix:cart", cart);
            close();
            render();
            return openCart();
          }
          const btn = e.target.closest("[data-checkout]");
          if (btn) checkout(btn, close);
        });
        document.body.appendChild(wrap);
      }

      async function checkout(btn, close) {
        if (!user) {
          toast("برای خرید ابتدا وارد شوید.", "info");
          setTimeout(() => (location.href = "auth.html?next=shop.html"), 700);
          return;
        }
        btn.disabled = true;
        try {
          const method = btn.closest(".drawer")?.querySelector("[name=method]:checked")?.value || "gateway";
          const r = await api("shop.checkout", { items: cart, coupon: couponCode, method });
          if (r.redirect) {
            location.href = r.redirect;
            return;
          }
          cart.forEach((id) => owned.add(id));
          cart = [];
          store.set("behix:cart", cart);
          close();
          render();
          modal({
            title: "پرداخت موفق",
            body: `<div class="success" style="padding:12px"><span class="success-icon">${icon("check")}</span><p class="mt-2 lh">خرید شما انجام شد و ${toman(r.paidFromWallet)} از کیف پول کسر شد.</p></div>`,
            actions: [{ label: "ادامه خرید" }, { label: "رفتن به دانلودها", primary: true, onClick: () => { location.href = "dashboard.html#downloads"; } }],
          });
        } catch (err) {
          btn.disabled = false;
          toast(err.message, "bad");
        }
      }

      view.addEventListener("click", async (e) => {
        const f = e.target.closest("[data-filter]");
        if (f) {
          filter = f.dataset.filter;
          view.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("is-active", b === f));
          return render();
        }
        const add = e.target.closest("[data-add]");
        if (add) return addToCart(add.dataset.add);
        const fav = e.target.closest("[data-fav]");
        if (fav) {
          if (!user) return toast("برای ذخیره علاقه‌مندی وارد شوید.", "info");
          try {
            const r = await api("fav.toggle", { productId: fav.dataset.fav });
            r.on ? favs.add(fav.dataset.fav) : favs.delete(fav.dataset.fav);
            render();
          } catch (err) { toast(err.message, "bad"); }
          return;
        }
        if (e.target.closest("[data-cart]")) return openCart();
        const open = e.target.closest("[data-open]");
        if (open) {
          const p = data.products.find((x) => x.id === open.dataset.open);
          const c = catOf(p);
          const seller = sellers[p.sellerId];
          modal({
            title: p.title, wide: true,
            body: `
              <div class="detail-thumb" style='background:${thumbBg(p)}'>${p.image ? "" : icon(c.icon)}</div>
              <div class="row-between mt-2"><div class="price-row" style="margin:0"><span class="now price">${toman(finalPrice(p))}</span>${p.discount ? `<span class="was">${num(p.price)}</span>` : ""}</div>${stars(p.rating)}</div>
              ${bnplHint(finalPrice(p))}
              ${p.desc ? `<p class="muted small lh mt-2" style="white-space:pre-line">${esc(p.desc)}</p>` : ""}
              <dl class="kv mt-2">
                <dt>دسته</dt><dd>${esc(c.title)}</dd>
                <dt>فروشنده</dt><dd>${esc(seller?.shopName || seller?.name || "")}</dd>
                <dt>فروش</dt><dd>${faDigits(p.sales)} بار</dd>
                ${p.tags.length ? `<dt>برچسب‌ها</dt><dd>${p.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join(" ")}</dd>` : ""}
              </dl>
              <p class="muted small lh mt-2">پس از پرداخت، لینک دانلود دائمی در پنل کاربری شما قرار می‌گیرد.</p>`,
            actions: owned.has(p.id)
              ? [{ label: "بستن" }, { label: "رفتن به دانلودها", primary: true, onClick: () => { location.href = "dashboard.html#downloads"; } }]
              : [{ label: "بستن" }, { label: cart.includes(p.id) ? "مشاهده سبد" : "افزودن به سبد", primary: true, onClick: () => (cart.includes(p.id) ? openCart() : addToCart(p.id)) }],
          });
        }
      });
      view.addEventListener("input", (e) => {
        if (e.target.matches("[data-search]")) { term = e.target.value.trim(); render(); }
      });
      view.addEventListener("change", (e) => {
        if (e.target.matches("[data-sort]")) { sort = e.target.value; render(); }
      });
      render();
    }

    // ============================================================= Designers
    async function designersPage() {
      loading();
      let data;
      try { data = await api("designers.list"); } catch (err) { return failView(err); }
      let filter = "all";
      view.innerHTML = `
        ${filterBar({ chips: [{ id: "all", label: "همه طراحان" }, ...CATALOG.map((c) => ({ id: c.id, label: c.title }))], active: filter, search: false })}
        <div class="grid-auto" data-list></div>`;
      const list = view.querySelector("[data-list]");
      function render() {
        const items = data.designers.filter((d) => filter === "all" || (d.skills || []).some((s) => findService(s)?.category === filter));
        list.innerHTML = items.length ? items.map((d, i) => `
          <article class="card designer-card hover-lift" data-spotlight data-reveal style="--d:${i * 80}ms">
            ${avatar(d, "avatar-lg")}
            <h3>${esc(d.name)}</h3>
            <p class="muted small">${esc(d.level || "")}${d.bio ? ` · ${esc(d.bio)}` : ""}</p>
            <div class="skills">${(d.skills || []).slice(0, 4).map((s) => `<span class="badge">${esc(findService(s)?.title || s)}</span>`).join("")}</div>
            <div class="designer-stats"><span><b>${faDigits((d.rating || 0).toFixed(1))}</b>امتیاز</span><span><b>${faDigits(d.done)}</b>پروژه</span><span><b>${faDigits(d.works)}</b>نمونه‌کار</span></div>
            <div class="card-actions">
              <a class="btn btn-ghost" href="portfolio.html">نمونه‌کارها</a>
              <a class="btn btn-primary" href="order.html${d.skills?.[0] ? `?service=${encodeURIComponent(d.skills[0])}` : ""}">سفارش</a>
            </div>
          </article>`).join("") : `<div class="empty card" style="grid-column:1/-1">${icon("users")}<p>طراحی در این شاخه ثبت نشده است.</p></div>`;
        initReveal(view);
      }
      view.addEventListener("click", (e) => {
        const f = e.target.closest("[data-filter]");
        if (!f) return;
        filter = f.dataset.filter;
        view.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("is-active", b === f));
        render();
      });
      render();
    }

    ({ portfolio: portfolioPage, shop: shopPage, designers: designersPage })[view.dataset.view]();
  });
})();
