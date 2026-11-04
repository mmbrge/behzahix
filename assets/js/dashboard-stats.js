/* ==========================================================================
   BEHIX — admin: visit statistics (site, each page, each article).
   Data: api/lib/stats.php (collected on the site itself, no outside service).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;
  const { icon, esc, faDigits } = BX;
  const PERIODS = [[1, "امروز"], [7, "۷ روز"], [30, "۳۰ روز"], [90, "۹۰ روز"], [365, "یک سال"]];
  const DEVICES = { mobile: "موبایل", desktop: "کامپیوتر", tablet: "تبلت", "": "نامشخص" };
  const ST = { days: 30 };
  const n = (x) => faDigits(Math.round(x || 0).toLocaleString("en-US"));
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);

  BXD.routes.stats = function (param) {
    return `<div data-stats-admin="${esc(param || "")}"><div class="card box skeleton" style="height:320px"></div></div>`;
  };

  // «#stats/p:<path>» = one page
  const pathOf = (param) => (param && param.startsWith("p:") ? decodeURIComponent(param.slice(2)) : "");

  const tileCh = (cur, prev) => {
    const c = pct(cur, prev);
    if (!prev && !cur) return "";
    return `<small class="st-ch ${c > 0 ? "is-up" : c < 0 ? "is-down" : ""}">${c > 0 ? "▲" : c < 0 ? "▼" : "●"} ${faDigits(Math.abs(c))}٪ <span>نسبت به دوره قبل</span></small>`;
  };
  const hbars = (list, label, total) => list.length ? `<ul class="hbars">${list.map((x) => `<li><span>${esc(label(x))}<br><small class="muted">${faDigits(total ? Math.round((x.n / total) * 100) : 0)}٪</small></span><span class="track"><span class="fill" style="display:block;width:${total ? Math.max(2, (x.n / total) * 100) : 0}%"></span></span><b>${n(x.n)}</b></li>`).join("")}</ul>` : `<p class="muted small">هنوز داده‌ای ثبت نشده است.</p>`;

  // ------------------------------------------------------------ daily chart (views + visitors, one axis)
  function lineChart(el, series) {
    const W = Math.max(300, el.clientWidth), H = 230, padT = 16, padB = 28, padR = 42, padL = 10;
    // four round steps (1, 2 or 5 × 10ⁿ) above the highest day
    const max = Math.max(4, ...series.map((d) => d.views));
    const raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const stepV = [1, 2, 5, 10].find((m) => m * mag >= raw) * mag;
    const top = stepV * 4;
    const N = series.length;
    // time runs right → left, like the rest of the panel
    const x = (i) => (N === 1 ? (W - padR + padL) / 2 : W - padR - (i * (W - padR - padL)) / (N - 1));
    const y = (v) => padT + (1 - v / top) * (H - padT - padB);
    const path = (key) => series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join("");
    const area = `${path("views")}L${x(N - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const ticks = [0, 1, 2, 3, 4].map((k) => k * stepV);
    const every = Math.ceil(N / Math.max(2, Math.floor(W / 70)));
    el.innerHTML = `<svg class="st-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار روزانه بازدید و بازدیدکننده">
        ${ticks.map((t) => `<line class="st-grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="st-ax" x="${W - padR + 6}" y="${y(t) + 4}">${n(t)}</text>`).join("")}
        ${series.map((d, i) => (i % every === 0 ? `<text class="st-ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(d.label.slice(5))}</text>` : "")).join("")}
        <path class="st-area" d="${area}"/>
        <path class="st-line st-a" d="${path("views")}"/><path class="st-line st-b" d="${path("visitors")}"/>
        <line class="st-cross" x1="0" x2="0" y1="${padT}" y2="${H - padB}" visibility="hidden"/>
        <circle class="st-dot st-a" r="4.5" visibility="hidden"/><circle class="st-dot st-b" r="4.5" visibility="hidden"/>
      </svg><div class="st-tip" hidden></div>`;
    const svg = el.querySelector("svg"), tip = el.querySelector(".st-tip"), cross = svg.querySelector(".st-cross");
    const [da, db] = svg.querySelectorAll(".st-dot");
    const show = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = clientX - r.left;
      let i = N === 1 ? 0 : Math.round(((W - padR - px) / (W - padR - padL)) * (N - 1));
      i = Math.max(0, Math.min(N - 1, i));
      const d = series[i], cx = x(i);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
      da.setAttribute("cx", cx); da.setAttribute("cy", y(d.views)); da.setAttribute("visibility", "visible");
      db.setAttribute("cx", cx); db.setAttribute("cy", y(d.visitors)); db.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(d.label)}</b><span><i class="st-key st-a"></i>بازدید <b>${n(d.views)}</b></span><span><i class="st-key st-b"></i>بازدیدکننده <b>${n(d.visitors)}</b></span>`;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(W - tw - 4, Math.max(4, cx - tw / 2))}px`;
    };
    const hide = () => { tip.hidden = true; [cross, da, db].forEach((e) => e.setAttribute("visibility", "hidden")); };
    svg.addEventListener("pointermove", (e) => show(e.clientX));
    svg.addEventListener("pointerdown", (e) => show(e.clientX));
    svg.addEventListener("pointerleave", hide);
  }
  // visits by hour of day (Tehran time)
  const hourBars = (hours) => {
    const max = Math.max(1, ...hours);
    return `<div class="st-hours">${hours.map((v, h) => `<div title="ساعت ${faDigits(h)}: ${n(v)} بازدید"><i style="--h:${(v / max) * 100}%"></i><small>${h % 3 === 0 ? faDigits(h) : ""}</small></div>`).join("")}</div>`;
  };

  async function view(el, param) {
    const path = pathOf(param);
    const r = await BX.api("a.stats.views", { days: ST.days, path });
    const { box, tile, table } = BXD.ui;
    const t = r.totals, p = r.prev;
    const sum = (l) => l.reduce((s, x) => s + x.n, 0);
    el.innerHTML = `<div class="dash-grid">
      <div class="st-bar">
        ${path ? `<a class="btn btn-ghost btn-sm" href="#stats">${icon("arrow-right")} همه صفحه‌ها</a><b class="st-path" dir="ltr">${esc(safeDecode(path))}</b><a class="btn btn-ghost btn-xs" href="${esc(path.replace(/^\//, ""))}" target="_blank">${icon("external")}</a>` : `<b>آمار بازدید سایت</b>`}
        <div class="chips st-periods">${PERIODS.map(([d, l]) => `<button type="button" class="chip ${d === ST.days ? "is-on" : ""}" data-days="${d}">${l}</button>`).join("")}</div>
        <small class="muted">${esc(r.from)} تا ${esc(r.to)}</small>
        <span class="st-live" title="بازدیدکنندگان ۵ دقیقه اخیر"><i></i>${n(t.online)} نفر آنلاین</span>
      </div>
      <div class="tiles">
        ${tile("بازدید صفحه", n(t.views), "eye")}
        ${tile("بازدیدکننده یکتا", n(t.visitors), "users")}
        ${tile("ورود به سایت", n(t.visits), "arrow")}
        ${tile("صفحه در هر ورود", faDigits(String(t.perVisit).replace(".", "٫")), "layers")}
      </div>
      <div class="st-changes">${tileCh(t.views, p.views).replace("st-ch", "st-ch st-ch--a")}<span class="muted small">بازدید</span> ${tileCh(t.visitors, p.visitors)}<span class="muted small">بازدیدکننده</span> <span class="muted small">· امروز ${n(t.today)} بازدید</span></div>
      ${r.days > 1 ? box("بازدید روزانه", "chart", `<div class="st-legend"><span><i class="st-key st-a"></i>بازدید صفحه</span><span><i class="st-key st-b"></i>بازدیدکننده یکتا</span></div><div class="st-chart" data-chart></div>`) : ""}
      <div class="dash-cols">
        ${box("از کجا آمده‌اند", "share", hbars(r.sources, (x) => x.label, sum(r.sources)))}
        ${box("ساعت‌های شلوغ (به وقت تهران)", "clock", hourBars(r.hours))}
      </div>
      ${path ? "" : box("پربازدیدترین صفحه‌ها", "list", table(["صفحه", "بازدید", "بازدیدکننده", "ورود از این صفحه", ""], r.pages.map((x) => `<tr>
          <td><b>${esc(x.title || x.label)}</b><br><small class="muted" dir="ltr">${esc(safeDecode(x.path))}</small></td><td>${n(x.views)}</td><td>${n(x.visitors)}</td><td>${n(x.entries)}</td>
          <td><a class="btn btn-ghost btn-xs" href="#stats/p:${encodeURIComponent(x.path)}">${icon("chart")} جزئیات</a></td></tr>`), "هنوز بازدیدی ثبت نشده است؛ آمار از همین حالا جمع می‌شود."))}
      ${path ? "" : box("مقاله‌ها", "book", table(["مقاله", "بازدید در این دوره", "بازدیدکننده", "کل بازدیدها", ""], r.posts.map((x) => `<tr>
          <td><b>${esc(x.title)}</b>${x.publishedAt ? `<br><small class="muted">${BX.date(x.publishedAt)}</small>` : ""}</td><td>${n(x.views)}</td><td>${n(x.visitors)}</td><td>${n(x.total)}</td>
          <td><a class="btn btn-ghost btn-xs" href="#stats/p:${encodeURIComponent(x.path)}">${icon("chart")} جزئیات</a></td></tr>`), "هنوز مقاله‌ای منتشر نشده است."))}
      <div class="dash-cols">
        ${box("دستگاه", "monitor", hbars(r.devices, (x) => DEVICES[x.k] || x.k, sum(r.devices)))}
        ${box("مرورگر", "globe", hbars(r.browsers, (x) => x.k || "نامشخص", sum(r.browsers)))}
        ${box("سیستم‌عامل", "settings", hbars(r.os, (x) => x.k || "نامشخص", sum(r.os)))}
        ${path ? "" : box("بخش‌های سایت", "layers", hbars(r.groups, (x) => x.label, sum(r.groups)))}
      </div>
      <div class="banner banner--info">${icon("info")}<span>آمار روی خود سایت جمع می‌شود (بدون سرویس بیرونی). ربات‌ها، ابزارهای تست سرعت و بازدیدهای مدیر، حسابدار و شریک شمرده نمی‌شوند. «بازدیدکننده یکتا» با یک شناسه ناشناس (بدون ذخیره IP) شمرده می‌شود؛ «ورود» یعنی شروع یک بازدید تازه بعد از ۳۰ دقیقه.</span></div>
    </div>`;
    BXD.labelTables?.(el);
    const chart = el.querySelector("[data-chart]");
    if (chart) {
      lineChart(chart, r.series);
      let rt;
      const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (document.body.contains(chart)) lineChart(chart, r.series); else removeEventListener("resize", onResize); }, 200); };
      addEventListener("resize", onResize);
    }
    el.querySelector(".st-periods").addEventListener("click", (e) => {
      const b = e.target.closest("[data-days]");
      if (!b) return;
      ST.days = Number(b.dataset.days);
      view(el, param).catch((err) => BX.toast(err.message, "bad"));
    });
  }

  const prevAfter = BXD.afterRender;
  BXD.afterRender = (v, id, param) => {
    if (prevAfter) prevAfter(v, id, param);
    const el = v.querySelector("[data-stats-admin]");
    if (!el) return;
    view(el, param).catch((err) => { el.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(err.message)}</p></div>`; });
  };
})();
