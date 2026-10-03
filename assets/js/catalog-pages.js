/* ==========================================================================
   BEHIX — portfolio, shop and designers pages
   Each page has a container with data-view="portfolio|shop|designers".
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const { CATALOG, PRODUCT_CATEGORIES, findService, findCategory, db, auth, icon, toman, num, faDigits, esc, art, avatar, toast, modal, date, initReveal, qs } = BX;
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
  const stars = (r) => (r ? `<span class="stars">${icon("star")}${faDigits(r.toFixed(1))}</span>` : '<span class="badge">جدید</span>');

  function filterBar({ chips, active, search = true, sorts }) {
    return `
      <div class="filters" data-reveal>
        ${chips.map((c) => `<button type="button" class="filter-chip ${c.id === active ? "is-active" : ""}" data-filter="${c.id}">${c.label}</button>`).join("")}
        ${search ? `<label class="search">${icon("search")}<input class="input" type="search" placeholder="جستجو…" data-search aria-label="جستجو"></label>` : ""}
        ${sorts ? `<select class="select" data-sort style="width:auto" aria-label="مرتب‌سازی">${sorts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>` : ""}
      </div>`;
  }

  // =============================================================== Portfolio
  function portfolioPage() {
    const likes = new Set(store.get("behix:likes", []));
    let filter = qs("cat") || "all";
    let term = "";
    let sort = "new";
    view.innerHTML = `
      ${filterBar({ chips: [{ id: "all", label: "همه" }, ...CATALOG.map((c) => ({ id: c.id, label: c.title }))], active: filter, sorts: [["new", "جدیدترین"], ["top", "محبوب‌ترین"]] })}
      <div class="grid-auto" data-list></div>`;
    const list = view.querySelector("[data-list]");

    function render() {
      let items = db.data.portfolio.filter((w) => (filter === "all" || w.category === filter) && (!term || w.title.includes(term)));
      items = items.sort((a, b) => (sort === "top" ? b.likes - a.likes : b.createdAt - a.createdAt));
      list.innerHTML = items.length ? items.map((w, i) => {
        const s = findService(w.serviceId);
        const c = findCategory(w.category);
        const d = db.user(w.designerId);
        const liked = likes.has(w.id);
        return `
          <article class="work-card" data-reveal style="--d:${(i % 6) * 60}ms">
            <button type="button" class="work-thumb w-full" data-open="${w.id}" aria-label="مشاهده ${esc(w.title)}">
              <span class="bg" style="background:${art(w.id, c.hue)}"></span>
              <span class="thumb-icon">${icon(s.icon)}</span>
              <span class="work-overlay"><span class="badge" style="color:#fff;border-color:rgb(255 255 255 / .3)">${s.title}</span>${icon("eye")}</span>
            </button>
            <div class="work-body">
              <h3>${esc(w.title)}</h3>
              <div class="work-meta">
                <span class="row">${avatar(d, "avatar-sm")}${esc(d?.name || "")}</span>
                <button type="button" class="like-btn ${liked ? "is-on" : ""}" data-like="${w.id}" aria-pressed="${liked}" aria-label="پسندیدن">${icon("heart")}<span>${faDigits(w.likes + (liked ? 1 : 0))}</span></button>
              </div>
            </div>
          </article>`;
      }).join("") : `<div class="empty card" style="grid-column:1/-1">${icon("search")}<p>نمونه‌کاری پیدا نشد.</p></div>`;
      initReveal(list);
    }

    view.addEventListener("click", (e) => {
      const f = e.target.closest("[data-filter]");
      if (f) {
        filter = f.dataset.filter;
        view.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("is-active", b === f));
        return render();
      }
      const like = e.target.closest("[data-like]");
      if (like) {
        const id = like.dataset.like;
        likes.has(id) ? likes.delete(id) : likes.add(id);
        store.set("behix:likes", [...likes]);
        return render();
      }
      const open = e.target.closest("[data-open]");
      if (open) {
        const w = db.data.portfolio.find((x) => x.id === open.dataset.open);
        const s = findService(w.serviceId);
        const c = findCategory(w.category);
        const d = db.user(w.designerId);
        modal({
          title: w.title, wide: true,
          body: `
            <div class="detail-thumb" style="background:${art(w.id, c.hue)}">${icon(s.icon)}</div>
            <dl class="kv mt-2">
              <dt>خدمت</dt><dd>${s.title}</dd>
              <dt>شاخه</dt><dd>${c.title}</dd>
              <dt>طراح</dt><dd>${esc(d?.name || "")} · ${esc(d?.level || "")}</dd>
              <dt>تاریخ</dt><dd>${date(w.createdAt)}</dd>
            </dl>
            <p class="muted small lh mt-2">تصاویر واقعی نمونه‌کار بعد از اتصال پنل مدیریت محتوا اینجا نمایش داده می‌شود.</p>`,
          actions: [
            { label: "بستن" },
            { label: "سفارش مشابه این کار", primary: true, onClick: () => { location.href = `order.html?service=${s.id}`; } },
          ],
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

  // =============================================================== Shop
  function shopPage() {
    let filter = qs("cat") || "all";
    let term = "";
    let sort = "top";
    let cart = store.get("behix:cart", []);
    const user = auth.current();
    const favs = new Set(user ? db.data.favorites[user.id] || [] : []);
    const finalPrice = (p) => Math.round((p.price * (100 - p.discount)) / 100 / 1000) * 1000;

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
      let items = db.data.products.filter((p) => p.status === "active" && (filter === "all" || p.category === filter) && (!term || p.title.includes(term) || p.tags.some((t) => t.includes(term))));
      const sorters = { top: (a, b) => b.sales - a.sales, new: (a, b) => b.createdAt - a.createdAt, cheap: (a, b) => finalPrice(a) - finalPrice(b), rate: (a, b) => b.rating - a.rating };
      items = items.sort(sorters[sort]);
      list.innerHTML = items.length ? items.map((p, i) => {
        const c = PRODUCT_CATEGORIES.find((x) => x.id === p.category);
        const seller = db.user(p.sellerId);
        const inCart = cart.includes(p.id);
        return `
          <article class="work-card" data-reveal style="--d:${(i % 6) * 60}ms">
            <button type="button" class="work-thumb w-full" data-open="${p.id}" aria-label="جزئیات ${esc(p.title)}">
              <span class="bg" style="background:${art(p.id)}"></span>
              <span class="thumb-icon">${icon(c.icon)}</span>
              ${p.discount ? `<span class="off">${faDigits(p.discount)}٪</span>` : ""}
            </button>
            <div class="work-body">
              <h3>${esc(p.title)}</h3>
              <div class="work-meta"><span>${icon("store")} ${esc(seller?.shopName || "")}</span>${stars(p.rating)}</div>
              <div class="price-row"><span class="now">${toman(finalPrice(p))}</span>${p.discount ? `<span class="was">${num(p.price)}</span>` : ""}</div>
              <div class="card-actions">
                <button type="button" class="btn ${inCart ? "btn-ghost" : "btn-primary"}" data-add="${p.id}">${inCart ? `${icon("check")} در سبد` : `${icon("cart")} افزودن`}</button>
                <button type="button" class="icon-btn like-btn ${favs.has(p.id) ? "is-on" : ""}" data-fav="${p.id}" aria-label="علاقه‌مندی">${icon("heart")}</button>
              </div>
            </div>
          </article>`;
      }).join("") : `<div class="empty card" style="grid-column:1/-1">${icon("search")}<p>محصولی پیدا نشد.</p></div>`;
      initReveal(list);
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
      const items = cart.map((id) => db.data.products.find((p) => p.id === id)).filter(Boolean);
      const total = items.reduce((s, p) => s + finalPrice(p), 0);
      const wrap = document.createElement("div");
      wrap.className = "drawer-wrap";
      wrap.innerHTML = `
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="سبد خرید">
          <div class="row-between"><h3>سبد خرید (${faDigits(items.length)})</h3><button type="button" class="icon-btn" data-close aria-label="بستن">${icon("cross")}</button></div>
          <div class="drawer-items">
            ${items.length ? items.map((p) => `
              <div class="drawer-item">
                <span class="mini" style="background:${art(p.id)}"></span>
                <div class="grow"><b>${esc(p.title)}</b><br><span class="muted">${toman(finalPrice(p))}</span></div>
                <button type="button" class="icon-btn" data-remove="${p.id}" aria-label="حذف">${icon("trash")}</button>
              </div>`).join("") : `<div class="empty">${icon("cart")}<p>سبد خرید خالی است.</p></div>`}
          </div>
          <div class="row-between"><span class="muted">جمع کل</span><b class="price" style="font-size:1.4rem">${toman(total)}</b></div>
          ${user ? `<p class="small muted mt-1">موجودی کیف پول: ${toman(user.wallet || 0)}</p>` : ""}
          <button type="button" class="btn btn-primary btn-block mt-2" data-checkout ${items.length ? "" : "disabled"}>${icon("lock")} پرداخت و دانلود</button>
        </aside>`;
      const close = () => wrap.remove();
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
        if (e.target.closest("[data-checkout]")) checkout(items, total, close);
      });
      document.body.appendChild(wrap);
    }

    function checkout(items, total, close) {
      if (!user) {
        toast("برای خرید ابتدا وارد شوید.", "info");
        setTimeout(() => (location.href = "auth.html?next=shop.html"), 700);
        return;
      }
      const data = db.data;
      const me = db.user(user.id);
      const fromWallet = Math.min(me.wallet || 0, total);
      me.wallet = (me.wallet || 0) - fromWallet;
      const commission = data.settings.commission / 100;
      for (const p of items) {
        const price = finalPrice(p);
        data.purchases.unshift({ id: db.uid("pu"), userId: me.id, productId: p.id, price, at: Date.now() });
        data.transactions.unshift({ id: db.uid("t"), userId: me.id, type: "purchase", amount: -price, at: Date.now(), status: "ok", note: `خرید ${p.title}` });
        const seller = db.user(p.sellerId);
        const earn = Math.round(price * (1 - commission));
        seller.wallet = (seller.wallet || 0) + earn;
        data.transactions.unshift({ id: db.uid("t"), userId: seller.id, type: "sale", amount: earn, at: Date.now(), status: "ok", note: `فروش ${p.title}` });
        p.sales++;
        db.notify(seller.id, `«${p.title}» فروخته شد (+${toman(earn)})`, "sales");
      }
      db.notify(me.id, `${faDigits(items.length)} فایل خریداری شد و در بخش دانلودها آماده است.`, "downloads");
      db.save();
      cart = [];
      store.set("behix:cart", cart);
      close();
      render();
      modal({
        title: "پرداخت موفق",
        body: `<div class="success" style="padding:12px">${'<span class="success-icon">' + icon("check") + "</span>"}<p class="mt-2 lh">خرید شما با موفقیت انجام شد.${fromWallet ? `<br>${toman(fromWallet)} از کیف پول کسر شد.` : ""}${total - fromWallet > 0 ? `<br>${toman(total - fromWallet)} از درگاه (دمو) پرداخت شد.` : ""}</p></div>`,
        actions: [{ label: "ادامه خرید" }, { label: "رفتن به دانلودها", primary: true, onClick: () => { location.href = "dashboard.html#downloads"; } }],
      });
    }

    view.addEventListener("click", (e) => {
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
        const id = fav.dataset.fav;
        favs.has(id) ? favs.delete(id) : favs.add(id);
        db.data.favorites[user.id] = [...favs];
        db.save();
        return render();
      }
      if (e.target.closest("[data-cart]")) return openCart();
      const open = e.target.closest("[data-open]");
      if (open) {
        const p = db.data.products.find((x) => x.id === open.dataset.open);
        const c = PRODUCT_CATEGORIES.find((x) => x.id === p.category);
        const seller = db.user(p.sellerId);
        modal({
          title: p.title, wide: true,
          body: `
            <div class="detail-thumb" style="background:${art(p.id)}">${icon(c.icon)}</div>
            <div class="row-between mt-2"><div class="price-row" style="margin:0"><span class="now price">${toman(finalPrice(p))}</span>${p.discount ? `<span class="was">${num(p.price)}</span>` : ""}</div>${stars(p.rating)}</div>
            <dl class="kv mt-2">
              <dt>دسته</dt><dd>${c.title}</dd>
              <dt>فروشنده</dt><dd>${esc(seller?.shopName || "")}</dd>
              <dt>فروش</dt><dd>${faDigits(p.sales)} بار</dd>
              <dt>برچسب‌ها</dt><dd>${p.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join(" ")}</dd>
            </dl>
            <p class="muted small lh mt-2">پس از پرداخت، لینک دانلود دائمی در پنل کاربری شما قرار می‌گیرد. لایسنس استفاده تجاری برای یک پروژه.</p>`,
          actions: [{ label: "بستن" }, { label: cart.includes(p.id) ? "مشاهده سبد" : "افزودن به سبد", primary: true, onClick: () => (cart.includes(p.id) ? openCart() : addToCart(p.id)) }],
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

  // =============================================================== Designers
  function designersPage() {
    let filter = "all";
    view.innerHTML = `
      ${filterBar({ chips: [{ id: "all", label: "همه طراحان" }, ...CATALOG.map((c) => ({ id: c.id, label: c.title }))], active: filter, search: false })}
      <div class="grid-auto" data-list></div>`;
    const list = view.querySelector("[data-list]");
    function render() {
      const items = db.data.users.filter((u) => u.role === "designer" && u.status === "active" && (filter === "all" || (u.skills || []).some((s) => findService(s)?.category === filter)));
      list.innerHTML = items.map((d, i) => {
        const done = db.data.orders.filter((o) => o.designerId === d.id && o.status === "done").length;
        const works = db.data.portfolio.filter((w) => w.designerId === d.id).length;
        return `
          <article class="card designer-card hover-lift" data-spotlight data-reveal style="--d:${i * 80}ms">
            ${avatar(d, "avatar-lg")}
            <h3>${esc(d.name)}</h3>
            <p class="muted small">${esc(d.level || "")} · ${esc(d.bio || "")}</p>
            <div class="skills">${(d.skills || []).slice(0, 4).map((s) => `<span class="badge">${findService(s)?.title || s}</span>`).join("")}</div>
            <div class="designer-stats"><span><b>${faDigits((d.rating || 0).toFixed(1))}</b>امتیاز</span><span><b>${faDigits(done + 12)}</b>پروژه</span><span><b>${faDigits(works)}</b>نمونه‌کار</span></div>
            <div class="card-actions">
              <a class="btn btn-ghost" href="portfolio.html">نمونه‌کارها</a>
              <a class="btn btn-primary" href="order.html?service=${(d.skills || [])[0] || ""}">سفارش</a>
            </div>
          </article>`;
      }).join("");
      initReveal(list);
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
})();
