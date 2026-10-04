/* ==========================================================================
   BEHIX — interactive services tree
   Usage: <div data-tree></div>  (rendered from BX.CATALOG)
   Connector lines are drawn in SVG from the real element positions, so the
   tree works with any layout (columns on desktop, stacked on mobile).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const { icon, faDigits, esc } = BX;

  function shortPrice(n) {
    if (n >= 1e6) return `${faDigits(String(+(n / 1e6).toFixed(1)).replace(".", "٫"))} میلیون`;
    return `${faDigits(Math.round(n / 1000))} هزار`;
  }

  function markup() {
    return `
      <svg class="tree-lines" aria-hidden="true"></svg>
      <div class="tree-root">
        <span class="tree-root-orb"><span class="logo logo--sm"><span class="logo-a">BEHI</span><span class="logo-x">X</span></span></span>
        <div><b>طراحی و خدمات دیجیتال</b><small>${faDigits(BX.CATALOG.reduce((n, c) => n + c.services.length, 0))} خدمت در ${faDigits(BX.CATALOG.length)} شاخه</small></div>
      </div>
      <div class="tree-tabs" role="tablist" aria-label="شاخه‌های خدمات">
        ${BX.CATALOG.map((c, ci) => `<button type="button" role="tab" style="--h:${c.hue}" class="${ci ? "" : "is-on"}" aria-selected="${ci ? "false" : "true"}">${icon(c.icon)}${esc(c.title)}</button>`).join("")}
      </div>
      <div class="tree-cats">
        ${BX.CATALOG.map((c, ci) => `
          <div class="tree-branch" data-branch="${c.id}" id="${c.id}" style="--h:${c.hue};--i:${ci}">
            <button type="button" class="tree-cat" aria-expanded="true">
              <span class="tree-cat-icon">${icon(c.icon)}</span>
              <span class="tree-cat-text"><b>${esc(c.title)}</b><small dir="ltr">${esc(c.en)}</small></span>
              <span class="tree-count">${faDigits(c.services.length)}</span>
            </button>
            <ul class="tree-leaves">
              ${c.services.map((s, si) => `
                <li style="--j:${si}">
                  <a class="tree-leaf" href="order.html?service=${s.id}">
                    <span class="tree-leaf-icon">${icon(s.icon)}</span>
                    <span class="tree-leaf-body">
                      <b>${esc(s.title)}</b>
                      <small>از ${shortPrice(s.base)} تومان · ${faDigits(s.days)} روز</small>
                      <span class="tree-leaf-desc">${esc(s.desc)}</span>
                    </span>
                    <span class="tree-leaf-go">${icon("arrow")}</span>
                  </a>
                </li>`).join("")}
            </ul>
          </div>`).join("")}
      </div>`;
  }

  // Phones: branches become a swipeable carousel with category chips
  const phone = window.matchMedia("(max-width: 767px)");

  function draw(tree) {
    const svg = tree.querySelector(".tree-lines");
    if (phone.matches) return;
    const box = tree.getBoundingClientRect();
    const rel = (r) => ({
      l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top,
      cx: r.left - box.left + r.width / 2, cy: r.top - box.top + r.height / 2,
    });
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    svg.setAttribute("width", box.width);
    svg.setAttribute("height", box.height);

    const root = rel(tree.querySelector(".tree-root-orb").getBoundingClientRect());
    const paths = [];
    // Only connect the root to the first row of branches; lower rows would
    // otherwise run behind the cards above them (2-column / stacked layouts).
    const firstRowTop = Math.min(...[...tree.querySelectorAll(".tree-cat")].map((c) => c.getBoundingClientRect().top - box.top));
    tree.querySelectorAll(".tree-branch").forEach((br) => {
      const id = br.dataset.branch;
      const cat = rel(br.querySelector(".tree-cat").getBoundingClientRect());
      const y0 = root.b, y1 = cat.t, mid = (y0 + y1) / 2;
      if (cat.t > firstRowTop + 4) paths.push([`${id}-main`, "tl tl-main", id, ""]);
      else paths.push([`${id}-main`, "tl tl-main", id, `M${root.cx},${y0} C${root.cx},${mid} ${cat.cx},${mid} ${cat.cx},${y1}`]);

      const leaves = [...br.querySelectorAll(".tree-leaf")].map((l) => rel(l.getBoundingClientRect()));
      if (!leaves.length || br.classList.contains("is-collapsed")) {
        paths.push([`${id}-leaf`, "tl tl-leaf", id, ""]);
        return;
      }
      const trunkX = leaves[0].r + 14; // RTL: trunk runs along the right edge
      const lastY = leaves[leaves.length - 1].cy;
      let d = `M${trunkX},${cat.b} V${lastY - 10} Q${trunkX},${lastY} ${trunkX - 10},${lastY} H${leaves[leaves.length - 1].r}`;
      leaves.slice(0, -1).forEach((lf) => {
        d += ` M${trunkX},${lf.cy - 10} Q${trunkX},${lf.cy} ${trunkX - 10},${lf.cy} H${lf.r}`;
      });
      paths.push([`${id}-leaf`, "tl tl-leaf", id, d]);
    });
    // Update paths in place so their draw-in animation is not restarted.
    if (!svg.querySelector("defs")) {
      svg.innerHTML = '<defs><linearGradient id="tl-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa24a"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient></defs>';
    }
    for (const [key, cls, id, d] of paths) {
      let p = svg.querySelector(`[data-key="${key}"]`);
      if (!p) {
        p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("class", cls);
        p.dataset.key = key;
        p.dataset.for = id;
        svg.appendChild(p);
      }
      p.setAttribute("d", d || "M0,0");
      p.style.visibility = d ? "" : "hidden";
      if (d) p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1);
    }
  }

  function init(tree) {
    tree.classList.add("tree");
    tree.innerHTML = markup();
    const redraw = () => requestAnimationFrame(() => draw(tree));

    // Highlight a branch (lines + node) while hovered or focused
    const setActive = (id) => {
      tree.classList.toggle("has-active", Boolean(id));
      tree.querySelectorAll(".tree-branch").forEach((b) => b.classList.toggle("is-active", b.dataset.branch === id));
      tree.querySelectorAll(".tl").forEach((p) => p.classList.toggle("is-active", p.dataset.for === id));
    };
    tree.querySelectorAll(".tree-branch").forEach((b) => {
      b.addEventListener("pointerenter", () => setActive(b.dataset.branch));
      b.addEventListener("pointerleave", () => setActive(null));
      b.addEventListener("focusin", () => setActive(b.dataset.branch));
      b.addEventListener("focusout", () => setActive(null));
      // Collapse / expand a branch (mostly useful on mobile)
      b.querySelector(".tree-cat").addEventListener("click", () => {
        if (phone.matches) return;
        const collapsed = b.classList.toggle("is-collapsed");
        b.querySelector(".tree-cat").setAttribute("aria-expanded", String(!collapsed));
        redraw();
      });
    });

    const carousel = initCarousel(tree);
    if ("ResizeObserver" in window) new ResizeObserver(() => { redraw(); carousel.fit(); }).observe(tree);
    window.addEventListener("resize", redraw);
    // Leaves animate in / expand on hover; keep the connectors attached.
    tree.addEventListener("transitionend", (e) => {
      if (e.target.closest(".tree-leaves, .tree-cat")) redraw();
    });
    document.fonts && document.fonts.ready.then(redraw);
    redraw();

    // Animate in when scrolled into view
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => {
        if (en[0].isIntersecting) {
          tree.classList.add("is-in");
          setTimeout(() => tree.classList.add("is-drawn"), 2200);
          io.disconnect();
        }
      }, { threshold: 0.15 });
      io.observe(tree);
    } else {
      tree.classList.add("is-in", "is-drawn");
    }

    // Deep link: services.html#web highlights that branch
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && tree.querySelector(`[data-branch="${hash}"]`)) {
      carousel.go(BX.CATALOG.findIndex((c) => c.id === hash), true);
      setTimeout(() => setActive(hash), 900);
      setTimeout(() => setActive(null), 3500);
    }
  }

  function initCarousel(tree) {
    const cats = tree.querySelector(".tree-cats");
    const tabs = tree.querySelector(".tree-tabs");
    const rtl = getComputedStyle(cats).direction === "rtl" ? -1 : 1;
    let cur = 0;
    const fit = () => {
      if (!phone.matches) { cats.style.height = ""; return; }
      cats.style.height = `${cats.children[cur].offsetHeight}px`;
    };
    const mark = (i) => {
      cur = i;
      [...tabs.children].forEach((b, j) => { b.classList.toggle("is-on", j === i); b.setAttribute("aria-selected", String(j === i)); });
      const t = tabs.children[i];
      tabs.scrollTo({ left: t.offsetLeft - (tabs.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
      fit();
    };
    const go = (i, instant) => {
      if (i < 0 || !phone.matches) return;
      cats.scrollTo({ left: rtl * i * cats.clientWidth, behavior: instant ? "auto" : "smooth" });
      mark(i);
    };
    let st;
    cats.addEventListener("scroll", () => {
      if (!phone.matches) return;
      const i = Math.round(Math.abs(cats.scrollLeft) / cats.clientWidth);
      if (i !== cur) { mark(i); navigator.vibrate?.(5); }
      clearTimeout(st);
      st = setTimeout(fit, 120);
    }, { passive: true });
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) go([...tabs.children].indexOf(b));
    });
    phone.addEventListener?.("change", fit);
    setTimeout(fit, 50);
    return { go, fit };
  }

  BX.ready.then(() => document.querySelectorAll("[data-tree]").forEach(init));
})();
