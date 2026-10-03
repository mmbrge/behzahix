/* ==========================================================================
   BEHIX — dashboard for every role
   customer · designer · seller · admin  (hash routing: #section/param)
   All actions update the shared demo database, so a step taken in one panel
   (e.g. admin assigns a designer) shows up in the others.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const { CATALOG, ORDER_STATUS, ORDER_FLOW, PRODUCT_CATEGORIES, DEADLINES, ADDONS, findService, findCategory, db, auth, icon, toman, num, faDigits, enDigits, esc, date, ago, art, avatar, toast, modal } = BX;

  let me = auth.current();
  if (!me) {
    location.replace(`auth.html?next=${encodeURIComponent(`dashboard.html${location.hash}`)}`);
    return;
  }
  const D = () => db.data;
  const refreshMe = () => (me = db.user(me.id));
  const ROLE_LABEL = { customer: "مشتری", designer: "طراح", seller: "فروشنده", admin: "مدیر کل" };
  const app = document.getElementById("dash");

  function commit(msg, tone = "ok") {
    db.save();
    refreshMe();
    render();
    if (msg) toast(msg, tone);
  }

  // ================================================================ UI bits
  const statusBadge = (st) => {
    const s = ORDER_STATUS[st];
    return `<span class="badge badge--${s.tone}">${icon(s.icon)}${s.label}</span>`;
  };
  const PRODUCT_STATUS = { pending: ["در انتظار تأیید", "warn"], active: ["فعال", "ok"], hidden: ["مخفی", "info"], rejected: ["رد شده", "bad"] };
  const USER_STATUS = { active: ["فعال", "ok"], pending: ["در انتظار تأیید", "warn"], blocked: ["مسدود", "bad"], rejected: ["رد شده", "bad"] };
  const pill = ([label, tone]) => `<span class="badge badge--${tone}">${label}</span>`;
  const tile = (label, value, ic, sub = "") => `
    <div class="card tile"><div class="tile-top"><span class="tile-label">${label}</span><span class="tile-icon">${icon(ic)}</span></div>
    <div class="tile-value">${value}</div>${sub ? `<div class="tile-sub">${sub}</div>` : ""}</div>`;
  const box = (title, ic, body, actions = "") => `
    <section class="card box"><div class="box-head"><h2>${icon(ic)}${title}</h2>${actions}</div>${body}</section>`;
  const empty = (text, ic = "inbox") => `<div class="empty">${icon(ic)}<p>${text}</p></div>`;
  const table = (cols, rows, emptyText = "موردی وجود ندارد.") =>
    rows.length
      ? `<div class="table-wrap"><table class="table"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
      : empty(emptyText);
  const seg = (name, items, active) => `<div class="seg">${items.map(([v, l, n]) => `<button type="button" class="${v === active ? "is-active" : ""}" data-act="seg" data-seg="${name}" data-v="${v}">${l}${n != null ? `<span class="n">${faDigits(n)}</span>` : ""}</button>`).join("")}</div>`;
  const segState = {};
  const money = (n) => toman(n);
  function short(n) {
    const a = Math.abs(n);
    if (a >= 1e6) return `${faDigits(String(+(a / 1e6).toFixed(1)).replace(".", "٫"))} م`;
    if (a >= 1e3) return `${faDigits(Math.round(a / 1e3))} ه`;
    return faDigits(a);
  }
  const parseAmount = (v) => Number(enDigits(String(v)).replace(/[^\d]/g, "")) || 0;
  const priceOf = (o) => o.quote || o.estimate || 0;

  function svcCell(o) {
    const s = findService(o.serviceId);
    const c = findCategory(s.category);
    return `<div class="cell-title" style="--h:${c.hue}"><span class="cell-icon">${icon(s.icon)}</span><span><b>${esc(o.title)}</b><small dir="auto">${o.code} · ${s.title}</small></span></div>`;
  }
  function userCell(u, sub = "") {
    return `<div class="cell-title">${avatar(u, "avatar-sm")}<span><b>${esc(u?.name || "—")}</b><small>${sub || `<span dir="ltr">${faDigits(u?.phone || "")}</span>`}</small></span></div>`;
  }

  // ---------------------------------------------------------------- Charts
  const keyFmt = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { year: "numeric", month: "numeric" });
  const monthFmt = new Intl.DateTimeFormat("fa-IR", { month: "long" });
  function lastMonths(n = 6) {
    const out = [];
    const seen = new Set();
    for (let i = 0; out.length < n && i < 420; i += 3) {
      const d = new Date(Date.now() - i * 86400000);
      const k = keyFmt.format(d);
      if (!seen.has(k)) {
        seen.add(k);
        out.unshift({ key: k, label: monthFmt.format(d) });
      }
    }
    return out;
  }
  // Monthly totals; months with no real data yet can fall back to labelled demo values.
  function monthly(items, value, demo = []) {
    return lastMonths().map((m, i) => {
      const real = items.filter((x) => keyFmt.format(new Date(x.at)) === m.key).reduce((s, x) => s + value(x), 0);
      return real || !demo[i] ? { label: m.label, value: real } : { label: m.label, value: demo[i], demo: true };
    });
  }
  function barChart(points, unit = "تومان") {
    const W = 640, H = 220, top = 12, bottom = 30, left = 8, right = 46;
    const max = Math.max(1, ...points.map((p) => p.value));
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    const niceMax = Math.ceil(max / step) * step;
    const plotH = H - top - bottom;
    const slot = (W - left - right) / points.length;
    const bw = Math.min(34, slot * 0.46);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const y = top + plotH * (1 - f);
      return `<line class="grid-line" x1="${left}" x2="${W - right}" y1="${y}" y2="${y}"/><text class="axis-label" x="${W - 4}" y="${y + 4}" text-anchor="end">${short(niceMax * f)}</text>`;
    }).join("");
    // RTL: oldest month on the right, newest on the left
    const cols = points.map((p, i) => {
      const cx = W - right - slot * (i + 0.5);
      const h = Math.max(p.value ? 3 : 0, (p.value / niceMax) * plotH);
      const x = cx - bw / 2, y = top + plotH - h, r = Math.min(4, h);
      const d = h ? `M${x},${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${top + plotH} H${x} Z` : "";
      return `<g class="col" data-tip-label="${p.label}${p.demo ? " (نمایشی)" : ""}" data-tip-value="${toman(p.value)}" data-x="${cx}" data-y="${y}">
        <rect class="hit" x="${cx - slot / 2}" y="${top}" width="${slot}" height="${plotH + bottom}"/>
        ${d ? `<path class="bar bar-grow ${p.demo ? "is-demo" : ""}" d="${d}" style="animation-delay:${i * 70}ms"/>` : ""}
        <text class="axis-label" x="${cx}" y="${H - 8}" text-anchor="middle">${p.label}</text></g>`;
    }).join("");
    const hasDemo = points.some((p) => p.demo);
    return `<div class="chart-box">
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="نمودار ماهانه (${unit})">
        <defs><pattern id="bar-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgb(255 122 26 / .25)"/><line x1="0" y1="0" x2="0" y2="6" stroke="#ff7a1a" stroke-width="2.5"/></pattern></defs>
        ${grid}${cols}
      </svg>
      <div class="chart-tip"></div>
      ${hasDemo ? '<p class="chart-note"><i></i>ماه‌های هاشورخورده داده نمایشی هستند و با فعالیت واقعی جایگزین می‌شوند.</p>' : ""}
      <details class="mt-1 small"><summary class="muted">نمایش جدول داده</summary>${table(["ماه", "مبلغ"], points.map((p) => `<tr><td>${p.label}${p.demo ? " *" : ""}</td><td>${toman(p.value)}</td></tr>`))}</details>
    </div>`;
  }
  // Chart tooltip (delegated)
  app.addEventListener("pointermove", (e) => {
    const col = e.target.closest && e.target.closest(".chart-svg .col");
    const svg = e.target.closest && e.target.closest(".chart-svg");
    document.querySelectorAll(".chart-svg.has-hover").forEach((s) => s !== svg && s.classList.remove("has-hover"));
    document.querySelectorAll(".chart-tip.is-on").forEach((t) => !col && t.classList.remove("is-on"));
    if (!col) return svg && svg.classList.remove("has-hover");
    svg.classList.add("has-hover");
    const boxEl = svg.parentElement;
    const tip = boxEl.querySelector(".chart-tip");
    const vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    const bx = (Number(col.dataset.x) / vb.width) * r.width;
    const by = (Number(col.dataset.y) / vb.height) * r.height;
    tip.innerHTML = `<span class="muted">${col.dataset.tipLabel}</span><b>${col.dataset.tipValue}</b>`;
    tip.style.right = `${r.width - bx}px`;
    tip.style.top = `${by}px`;
    tip.classList.add("is-on");
  });

  // ================================================================ Order helpers
  function setStatus(o, st, note) {
    o.status = st;
    o.timeline.push({ status: st, at: Date.now(), note });
  }
  function notifyOrder(o, text, link) {
    const targets = new Set([o.userId, o.designerId, "u-admin"].filter(Boolean));
    targets.delete(me.id);
    targets.forEach((id) => db.notify(id, text, link || (db.user(id)?.role === "designer" ? "projects" : "orders")));
  }
  const orderLink = (o) => (me.role === "designer" ? `#projects/${o.id}` : `#orders/${o.id}`);

  function orderRows(list, extra = () => "") {
    return list.map((o) => `
      <tr data-href="${orderLink(o)}">
        <td>${svcCell(o)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${money(priceOf(o))}${o.paid ? ` <span class="badge badge--ok">${icon("check")}پرداخت</span>` : ""}</td>
        <td class="muted">${ago(o.createdAt)}</td>
        ${extra(o)}
      </tr>`);
  }

  function fieldText(f, v) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "—";
    const lab = (x) => f.options?.find((o) => o.v === x)?.label ?? x;
    if (f.type === "number") return `${faDigits(v)} ${f.suffix || ""}`;
    if (Array.isArray(v)) return v.map(lab).join("، ");
    return esc(lab(v));
  }

  function chatBox(o) {
    const msgs = o.messages || [];
    return box("گفتگو", "chat", `
      <div class="chat">
        <div class="chat-log" data-chat>
          ${msgs.length ? msgs.map((m) => {
            const u = db.user(m.from);
            return `<div class="msg ${m.from === me.id ? "me" : "them"}">${m.from !== me.id ? `<span class="who">${esc(u?.name || "")} · ${ROLE_LABEL[u?.role] || ""}</span>` : ""}${esc(m.text)}<small>${ago(m.at)}</small></div>`;
          }).join("") : `<p class="chat-empty">${icon("chat")}<br>هنوز پیامی رد و بدل نشده است.</p>`}
        </div>
        <form class="chat-form" data-form="msg" data-id="${o.id}">
          <input class="input" name="text" placeholder="پیام خود را بنویسید…" autocomplete="off" aria-label="متن پیام">
          <button class="btn btn-primary btn-sm" type="submit" aria-label="ارسال">${icon("send")}</button>
        </form>
      </div>`);
  }

  function orderDetail(id) {
    const o = D().orders.find((x) => x.id === id);
    if (!o) return empty("سفارش پیدا نشد.", "search");
    const s = findService(o.serviceId);
    const c = findCategory(s.category);
    const cust = db.user(o.userId);
    const des = o.designerId && db.user(o.designerId);
    const role = me.role;
    const idx = o.status === "revision" ? 2 : ORDER_FLOW.indexOf(o.status);
    const flow = o.status === "cancelled"
      ? `<div class="banner" style="border-color:rgb(248 113 113 / .4);background:rgb(248 113 113 / .08)">${icon("x-circle")}<span>این سفارش لغو شده است.</span></div>`
      : `<div class="flow">${ORDER_FLOW.map((st, i) => `
          <div class="flow-step ${i < idx || o.status === "done" ? "is-done" : ""} ${i === idx && o.status !== "done" ? "is-current" : ""}">
            <span class="flow-dot">${i < idx || o.status === "done" ? icon("check") : icon(ORDER_STATUS[st].icon)}</span>${st === "in_progress" && o.status === "revision" ? "اصلاحیه" : ORDER_STATUS[st].label}
          </div>`).join("")}</div>`;

    const st = o.style || {};
    const details = [
      ...s.fields.map((f) => [f.label, fieldText(f, o.details?.[f.id])]),
      ["سبک", (st.styles || []).join("، ") || "—"],
      ["رنگ‌ها", st.noColors ? "به انتخاب طراح" : (st.colors || []).map((col) => `<span class="dot" style="background:${col}"></span>`).join(" ") || "—"],
      ["سرعت تحویل", DEADLINES.find((d) => d.v === o.deadline)?.label || "عادی"],
      ["خدمات تکمیلی", (o.addons || []).map((a) => ADDONS.find((x) => x.v === a)?.label).join("، ") || "—"],
      ["بودجه مشتری", esc(o.budget || "—")],
      ["پیوست‌ها", (o.files || []).length ? o.files.map((f) => `<span class="badge">${icon("file")}${esc(f.name)}</span>`).join(" ") : "—"],
    ];

    // Role-specific actions
    let actions = "";
    if (role === "customer") {
      if (["new", "review"].includes(o.status) && !o.paid) {
        actions += o.status === "review"
          ? `<button class="btn btn-primary btn-block" data-act="pay" data-id="${o.id}">${icon("wallet")} پرداخت پیش‌فاکتور (${money(priceOf(o))})</button>`
          : `<p class="small muted lh">${icon("clock")} کارشناس ما در حال بررسی بریف شماست؛ پیش‌فاکتور به‌زودی صادر می‌شود.</p>`;
        actions += `<button class="btn btn-ghost btn-block btn-sm" data-act="cancel-order" data-id="${o.id}">لغو سفارش</button>`;
      }
      if (o.status === "awaiting") {
        actions += `<button class="btn btn-primary btn-block" data-act="approve" data-id="${o.id}">${icon("check-circle")} تأیید و دریافت نسخه نهایی</button>
          <button class="btn btn-ghost btn-block" data-act="revise" data-id="${o.id}">${icon("refresh")} درخواست اصلاح</button>`;
      }
      if (o.status === "done" && !o.rating) actions += `<button class="btn btn-primary btn-block" data-act="rate" data-id="${o.id}">${icon("star")} امتیاز به طراح</button>`;
      if (o.status === "done") actions += `<a class="btn btn-ghost btn-block" href="order.html?service=${o.serviceId}">${icon("refresh")} سفارش مجدد</a>`;
    }
    if (role === "designer" && o.designerId === me.id && ["in_progress", "revision"].includes(o.status)) {
      actions += `<label class="drop" style="padding:16px">${icon("upload")}<b class="small">آپلود فایل تحویلی</b><input type="file" multiple data-change="deliver" data-id="${o.id}"></label>
        <button class="btn btn-primary btn-block" data-act="submit-review" data-id="${o.id}">${icon("send")} ارسال برای تأیید مشتری</button>`;
    }
    if (role === "admin") {
      const candidates = D().users.filter((u) => u.role === "designer" && u.status === "active");
      const applicants = o.applicants || [];
      actions += `
        <form class="form-grid" data-form="quote" data-id="${o.id}">
          <div class="field"><label class="field-label">قیمت نهایی (پیش‌فاکتور)</label>
            <div class="row"><input class="input" name="amount" value="${faDigits(priceOf(o))}" dir="ltr" inputmode="numeric"><button class="btn btn-primary btn-sm" type="submit">ارسال</button></div></div>
        </form>
        <form class="form-grid mt-2" data-form="assign" data-id="${o.id}">
          <div class="field"><label class="field-label">تخصیص طراح ${applicants.length ? `<span class="badge badge--brand">${faDigits(applicants.length)} داوطلب</span>` : ""}</label>
            <div class="row"><select class="select" name="designer">
              <option value="">— انتخاب —</option>
              ${candidates.sort((a, b) => applicants.includes(b.id) - applicants.includes(a.id)).map((u) => `<option value="${u.id}" ${u.id === o.designerId ? "selected" : ""}>${applicants.includes(u.id) ? "★ " : ""}${esc(u.name)}${(u.skills || []).includes(o.serviceId) ? " (متخصص)" : ""}</option>`).join("")}
            </select><button class="btn btn-ghost btn-sm" type="submit">ثبت</button></div></div>
        </form>
        <form class="form-grid mt-2" data-form="status" data-id="${o.id}">
          <div class="field"><label class="field-label">تغییر وضعیت</label>
            <div class="row"><select class="select" name="status">${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v.label}</option>`).join("")}</select><button class="btn btn-ghost btn-sm" type="submit">ثبت</button></div></div>
        </form>
        ${!o.paid ? `<button class="btn btn-ghost btn-block btn-sm mt-2" data-act="mark-paid" data-id="${o.id}">${icon("check")} علامت‌گذاری به عنوان پرداخت‌شده</button>` : ""}`;
    }

    const deliverables = (o.deliverables || []).length
      ? o.deliverables.map((f) => `<div class="deliv"><span class="cell-icon">${icon("file")}</span><div class="grow"><b dir="ltr" style="text-align:right">${esc(f.name)}</b><small class="muted">${ago(f.at)}</small></div><button class="btn btn-ghost btn-xs" data-act="download" data-name="${esc(f.name)}">${icon("download")} دانلود</button></div>`).join("")
      : empty("هنوز فایلی تحویل داده نشده است.", "folder");

    return `
      <div class="row-between">
        <a href="${me.role === "designer" ? "#projects" : "#orders"}" class="btn btn-ghost btn-sm">${icon("arrow-right")} بازگشت</a>
        <span class="muted small">ثبت: ${date(o.createdAt)}</span>
      </div>
      <div class="dash-grid dash-grid-2 mt-2">
        <div class="dash-grid">
          <section class="card box">
            <div class="row-between">${svcCell(o)}${statusBadge(o.status)}</div>
            ${flow}
          </section>
          ${box("جزئیات بریف", "file", `<dl class="kv">${details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>${o.desc ? `<p class="muted small lh mt-2" style="white-space:pre-line">${esc(o.desc)}</p>` : ""}`)}
          ${box("فایل‌های تحویلی", "folder", deliverables)}
          ${chatBox(o)}
        </div>
        <div class="dash-grid" style="align-content:start">
          <section class="card box glow">
            <p class="muted small">${o.quote ? "مبلغ پیش‌فاکتور" : "برآورد اولیه"}</p>
            <p class="price">${money(priceOf(o))}</p>
            <p class="small mt-1">${o.paid ? `<span class="badge badge--ok">${icon("check")}پرداخت شده</span>` : '<span class="badge badge--warn">پرداخت نشده</span>'} ${o.rating ? `<span class="stars">${icon("star")}${faDigits(o.rating)}</span>` : ""}</p>
            <div class="stack mt-2">${actions}</div>
          </section>
          ${box("افراد", "users", `
            <div class="list-row">${avatar(cust)}<div class="grow"><b>${esc(cust?.name || "")}</b><br><small>مشتری${cust?.business ? ` · ${esc(cust.business)}` : ""}</small></div></div>
            <div class="list-row">${des ? `${avatar(des)}<div class="grow"><b>${esc(des.name)}</b><br><small>طراح · ${faDigits((des.rating || 0).toFixed(1))} ★</small></div>` : `<span class="avatar" style="--h:0;filter:grayscale(1)">؟</span><div class="grow"><b>هنوز طراحی تخصیص نیافته</b><br><small>پس از پرداخت تعیین می‌شود</small></div>`}</div>`)}
          ${box("تاریخچه", "clock", `<ul>${o.timeline.slice().reverse().map((t) => `<li class="list-row"><span class="cell-icon">${icon(ORDER_STATUS[t.status]?.icon || "info")}</span><div class="grow"><b>${ORDER_STATUS[t.status]?.label || t.status}</b><br><small>${date(t.at)} · ${ago(t.at)}</small></div></li>`).join("")}</ul>`)}
        </div>
      </div>`;
  }

  // ================================================================ Shared views
  function notificationsView() {
    const list = D().notifications.filter((n) => n.userId === me.id);
    return box("همه اعلان‌ها", "bell", list.length ? list.map((n) => `
      <button class="notif-item ${n.read ? "" : "is-unread"}" data-act="open-notif" data-id="${n.id}">${icon("bell")}<span><b>${esc(n.text)}</b><br><small class="muted">${ago(n.at)}</small></span></button>`).join("") : empty("اعلانی ندارید.", "bell"),
      `<button class="btn btn-ghost btn-sm" data-act="read-all">${icon("check")} خواندن همه</button>`);
  }

  function ticketsView(all = false) {
    const list = D().tickets.filter((t) => all || t.userId === me.id);
    const rows = list.map((t) => `
      <tr data-act="open-ticket" data-id="${t.id}" style="cursor:pointer">
        ${all ? `<td>${userCell(db.user(t.userId) || { name: t.name, phone: t.phone, hue: 200 })}</td>` : ""}
        <td><b>${esc(t.subject)}</b><br><small class="muted">${esc(t.message.slice(0, 60))}</small></td>
        <td>${t.status === "open" ? pill(["باز", "warn"]) : pill(["بسته", "ok"])}</td>
        <td class="muted">${ago(t.at)}</td>
      </tr>`);
    const form = all ? "" : box("تیکت جدید", "plus", `
      <form class="form-grid" data-form="ticket">
        <div class="field"><label class="field-label" for="tk-sub">موضوع</label><input class="input" id="tk-sub" name="subject" required></div>
        <div class="field"><label class="field-label" for="tk-msg">پیام</label><textarea class="textarea" id="tk-msg" name="message" required></textarea></div>
        <button class="btn btn-primary" type="submit">${icon("send")} ارسال تیکت</button>
      </form>`);
    return `<div class="dash-grid ${all ? "" : "dash-grid-2"}">${box(all ? "تیکت‌ها و پیام‌های تماس" : "تیکت‌های من", "ticket", table([...(all ? ["فرستنده"] : []), "موضوع", "وضعیت", "زمان"], rows, "تیکتی وجود ندارد."))}${form}</div>`;
  }

  function payoutView() {
    const s = D().settings;
    const payouts = D().payouts.filter((p) => p.userId === me.id);
    const tx = D().transactions.filter((t) => t.userId === me.id);
    return `
      <div class="dash-grid dash-grid-2-eq">
        <div class="dash-grid" style="align-content:start">
          <div class="wallet-card"><p class="label">موجودی قابل برداشت</p><p class="amount">${money(me.wallet || 0)}</p><p class="label mt-1">کارمزد پلتفرم: ${faDigits(s.commission)}٪ · حداقل برداشت ${money(s.minPayout)}</p></div>
          ${box("درخواست تسویه", "wallet", `
            <form class="form-grid" data-form="payout">
              <div class="field"><label class="field-label" for="po-amount">مبلغ (تومان)</label><input class="input" id="po-amount" name="amount" dir="ltr" inputmode="numeric" placeholder="${num(s.minPayout)}"></div>
              <div class="field"><label class="field-label" for="po-card">شماره شبا / کارت</label><input class="input" id="po-card" name="card" dir="ltr" value="${esc(me.card || "")}" placeholder="IR…"></div>
              <button class="btn btn-primary" type="submit">${icon("send")} ثبت درخواست</button>
            </form>`)}
        </div>
        <div class="dash-grid" style="align-content:start">
          ${box("درخواست‌های تسویه", "clock", table(["مبلغ", "وضعیت", "تاریخ"], payouts.map((p) => `<tr><td>${money(p.amount)}</td><td>${p.status === "paid" ? pill(["واریز شد", "ok"]) : pill(["در صف واریز", "warn"])}</td><td class="muted">${date(p.at)}</td></tr>`), "درخواستی ثبت نشده."))}
          ${box("گردش حساب", "list", txTable(tx))}
        </div>
      </div>`;
  }

  function txTable(tx, withUser = false) {
    const TYPE = { charge: "شارژ", payment: "پرداخت سفارش", purchase: "خرید فایل", earning: "درآمد پروژه", sale: "فروش فایل", payout: "تسویه", refund: "بازگشت وجه" };
    return table([...(withUser ? ["کاربر"] : []), "شرح", "نوع", "مبلغ", "تاریخ"], tx.slice(0, 40).map((t) => `
      <tr>${withUser ? `<td>${userCell(db.user(t.userId))}</td>` : ""}
        <td>${esc(t.note || "")}</td><td><span class="badge">${TYPE[t.type] || t.type}</span></td>
        <td class="${t.amount < 0 ? "bad" : "ok"}" dir="ltr" style="text-align:right">${t.amount < 0 ? "−" : "+"}${num(Math.abs(t.amount))}</td>
        <td class="muted">${date(t.at)}</td></tr>`), "تراکنشی وجود ندارد.");
  }

  function profileView() {
    const p = me.prefs || { email: true, sms: true };
    const roleFields = {
      customer: `<div class="field"><label class="field-label" for="pf-biz">نام کسب‌وکار</label><input class="input" id="pf-biz" name="business" value="${esc(me.business || "")}"></div>`,
      designer: `<div class="field span-2"><label class="field-label" for="pf-bio">معرفی کوتاه</label><textarea class="textarea" id="pf-bio" name="bio">${esc(me.bio || "")}</textarea></div>
        <div class="field span-2"><span class="field-label">تخصص‌ها</span><div class="chips">${BX.services.map((s) => `<label class="chip"><input type="checkbox" name="skills" value="${s.id}" ${(me.skills || []).includes(s.id) ? "checked" : ""}><span class="chip-check">${icon("check")}</span>${s.title}</label>`).join("")}</div></div>
        <div class="field"><label class="field-label" for="pf-card">شماره شبا</label><input class="input" id="pf-card" name="card" dir="ltr" value="${esc(me.card || "")}"></div>`,
      seller: `<div class="field"><label class="field-label" for="pf-shop">نام فروشگاه</label><input class="input" id="pf-shop" name="shopName" value="${esc(me.shopName || "")}"></div>
        <div class="field span-2"><label class="field-label" for="pf-bio">معرفی فروشگاه</label><textarea class="textarea" id="pf-bio" name="bio">${esc(me.bio || "")}</textarea></div>
        <div class="field"><label class="field-label" for="pf-card">شماره شبا</label><input class="input" id="pf-card" name="card" dir="ltr" value="${esc(me.card || "")}"></div>`,
      admin: "",
    }[me.role];
    return `
      <div class="dash-grid dash-grid-2">
        ${box("اطلاعات حساب", "user", `
          <form class="form-grid form-grid-2" data-form="profile">
            <div class="field"><label class="field-label" for="pf-name">نام و نام خانوادگی</label><input class="input" id="pf-name" name="name" value="${esc(me.name)}"></div>
            <div class="field"><label class="field-label" for="pf-phone">موبایل</label><input class="input" id="pf-phone" value="${faDigits(me.phone)}" dir="ltr" readonly></div>
            <div class="field"><label class="field-label" for="pf-email">ایمیل</label><input class="input" id="pf-email" name="email" type="email" dir="ltr" value="${esc(me.email || "")}"></div>
            ${roleFields}
            <div class="span-2"><button class="btn btn-primary" type="submit">${icon("check")} ذخیره تغییرات</button></div>
          </form>`)}
        <div class="dash-grid" style="align-content:start">
          ${box("امنیت", "lock", `
            <form class="form-grid" data-form="password">
              <div class="field"><label class="field-label" for="pw-old">رمز فعلی</label><input class="input" id="pw-old" name="old" type="password" dir="ltr" autocomplete="current-password"></div>
              <div class="field"><label class="field-label" for="pw-new">رمز جدید</label><input class="input" id="pw-new" name="new" type="password" dir="ltr" autocomplete="new-password"></div>
              <button class="btn btn-ghost" type="submit">تغییر رمز</button>
            </form>`)}
          ${box("اعلان‌ها", "bell", `
            <div class="stack">
              <label class="switch"><input type="checkbox" data-change="pref" data-key="sms" ${p.sms ? "checked" : ""}><span class="track"></span>پیامک وضعیت سفارش</label>
              <label class="switch"><input type="checkbox" data-change="pref" data-key="email" ${p.email ? "checked" : ""}><span class="track"></span>ایمیل خبرنامه و تخفیف‌ها</label>
            </div>`)}
        </div>
      </div>`;
  }

  // ================================================================ Customer
  const CUSTOMER = [
    { id: "overview", label: "داشبورد", icon: "home", render: customerOverview },
    { id: "orders", label: "سفارش‌های من", icon: "list", render: customerOrders, count: () => D().orders.filter((o) => o.userId === me.id && (o.status === "awaiting" || (o.status === "review" && !o.paid))).length },
    { id: "downloads", label: "دانلودها", icon: "download", render: customerDownloads },
    { id: "wallet", label: "کیف پول", icon: "wallet", render: customerWallet },
    { id: "favorites", label: "علاقه‌مندی‌ها", icon: "heart", render: customerFavorites },
    { id: "tickets", label: "پشتیبانی", icon: "ticket", render: () => ticketsView() },
    { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
    { id: "profile", label: "پروفایل و تنظیمات", icon: "settings", render: profileView },
  ];

  function customerOverview() {
    const mine = D().orders.filter((o) => o.userId === me.id);
    const active = mine.filter((o) => !["done", "cancelled"].includes(o.status));
    const need = mine.filter((o) => o.status === "awaiting" || (o.status === "review" && !o.paid));
    const purchases = D().purchases.filter((p) => p.userId === me.id);
    return `
      <div class="dash-grid">
        <div class="welcome">
          <h2>سلام ${esc(me.name.split(" ")[0])} 👋</h2>
          <p>${need.length ? `${faDigits(need.length)} سفارش منتظر اقدام شماست.` : "همه چیز روبه‌راه است. پروژه بعدی را شروع کنیم؟"}</p>
          <div class="cta-actions"><a class="btn btn-primary" href="order.html">${icon("plus")} سفارش جدید</a><a class="btn btn-ghost" href="shop.html">${icon("store")} فروشگاه فایل</a></div>
        </div>
        <div class="tiles">
          ${tile("سفارش‌های فعال", faDigits(active.length), "loader")}
          ${tile("منتظر اقدام شما", faDigits(need.length), "eye", need.length ? "تأیید یا پرداخت" : "")}
          ${tile("موجودی کیف پول", money(me.wallet || 0), "wallet")}
          ${tile("فایل‌های خریداری‌شده", faDigits(purchases.length), "download")}
        </div>
        <div class="dash-grid dash-grid-2">
          ${box("آخرین سفارش‌ها", "list", table(["سفارش", "وضعیت", "مبلغ", "زمان"], orderRows(mine.slice(0, 5)), "هنوز سفارشی ثبت نکرده‌اید."), `<a class="btn btn-ghost btn-sm" href="#orders">همه</a>`)}
          ${box("سفارش سریع", "zap", `<div class="quick-cats">${CATALOG.map((c) => `<a class="quick-cat" href="services.html#${c.id}" style="--h:${c.hue}"><span class="tree-cat-icon">${icon(c.icon)}</span>${c.title}</a>`).join("")}</div>
            <div class="banner mt-2" style="border-color:rgb(255 122 26 / .35);background:rgb(255 122 26 / .07)">${icon("percent")}<span>کد <b dir="ltr">MEHR25</b> را در سفارش بعدی وارد کنید و ۲۵٪ تخفیف بگیرید.</span></div>`)}
        </div>
      </div>`;
  }

  function customerOrders(param) {
    if (param) return orderDetail(param);
    const mine = D().orders.filter((o) => o.userId === me.id);
    const f = segState.corders || "all";
    const groups = [["all", "همه", mine.length], ["active", "در جریان", mine.filter((o) => !["done", "cancelled"].includes(o.status)).length], ["awaiting", "منتظر تأیید", mine.filter((o) => o.status === "awaiting").length], ["done", "تحویل‌شده", mine.filter((o) => o.status === "done").length]];
    const list = mine.filter((o) => f === "all" || (f === "active" ? !["done", "cancelled"].includes(o.status) : o.status === f));
    return box("سفارش‌های من", "list", `${seg("corders", groups, f)}<div class="mt-2">${table(["سفارش", "وضعیت", "مبلغ", "زمان"], orderRows(list), "سفارشی در این دسته نیست.")}</div>`, `<a class="btn btn-primary btn-sm" href="order.html">${icon("plus")} سفارش جدید</a>`);
  }

  function customerDownloads() {
    const list = D().purchases.filter((p) => p.userId === me.id);
    const files = D().orders.filter((o) => o.userId === me.id && o.status === "done").flatMap((o) => (o.deliverables || []).map((f) => ({ ...f, order: o })));
    return `<div class="dash-grid dash-grid-2-eq">
      ${box("فایل‌های خریداری‌شده", "store", list.length ? list.map((pu) => {
        const p = D().products.find((x) => x.id === pu.productId);
        return `<div class="deliv"><span class="mini-thumb" style="background:${art(p?.id)}">${icon("file")}</span><div class="grow"><b>${esc(p?.title || "")}</b><small class="muted">${date(pu.at)} · ${money(pu.price)}</small></div><button class="btn btn-ghost btn-xs" data-act="download" data-name="${esc(p?.title || "")}">${icon("download")} دانلود</button></div>`;
      }).join("") : empty("هنوز خریدی نداشته‌اید.", "store"), '<a class="btn btn-ghost btn-sm" href="shop.html">فروشگاه</a>')}
      ${box("فایل‌های سفارش‌های تحویل‌شده", "folder", files.length ? files.map((f) => `<div class="deliv"><span class="cell-icon">${icon("file")}</span><div class="grow"><b dir="ltr" style="text-align:right">${esc(f.name)}</b><small class="muted">${f.order.code} · ${date(f.at)}</small></div><button class="btn btn-ghost btn-xs" data-act="download" data-name="${esc(f.name)}">${icon("download")} دانلود</button></div>`).join("") : empty("فایل نهایی‌ای وجود ندارد.", "folder"))}
    </div>`;
  }

  function customerWallet() {
    const tx = D().transactions.filter((t) => t.userId === me.id);
    return `<div class="dash-grid dash-grid-2-eq">
      <div class="dash-grid" style="align-content:start">
        <div class="wallet-card"><p class="label">موجودی کیف پول</p><p class="amount">${money(me.wallet || 0)}</p><p class="label mt-1">پرداخت سریع سفارش‌ها و خریدها بدون درگاه</p></div>
        ${box("افزایش موجودی", "plus", `
          <form class="form-grid" data-form="charge">
            <div class="amount-chips">${[500000, 1000000, 2000000, 5000000].map((a) => `<button type="button" data-act="amount" data-v="${a}">${short(a)} تومان</button>`).join("")}</div>
            <div class="field"><label class="field-label" for="ch-amount">مبلغ دلخواه (تومان)</label><input class="input" id="ch-amount" name="amount" dir="ltr" inputmode="numeric"></div>
            <button class="btn btn-primary" type="submit">${icon("lock")} پرداخت از درگاه (دمو)</button>
          </form>`)}
      </div>
      ${box("گردش حساب", "list", txTable(tx))}
    </div>`;
  }

  function customerFavorites() {
    const ids = D().favorites[me.id] || [];
    const list = D().products.filter((p) => ids.includes(p.id));
    return box("علاقه‌مندی‌ها", "heart", list.length ? `<div class="grid-auto">${list.map((p) => `
      <div class="deliv"><span class="mini-thumb" style="background:${art(p.id)}">${icon("heart")}</span><div class="grow"><b>${esc(p.title)}</b><small class="muted">${money(p.price)}</small></div><button class="icon-btn icon-btn-sm" data-act="unfav" data-id="${p.id}" aria-label="حذف">${icon("trash")}</button></div>`).join("")}</div>` : empty("محصولی را نپسندیده‌اید.", "heart"), '<a class="btn btn-ghost btn-sm" href="shop.html">رفتن به فروشگاه</a>');
  }

  // ================================================================ Designer
  const DESIGNER = [
    { id: "overview", label: "داشبورد", icon: "home", render: designerOverview },
    { id: "projects", label: "پروژه‌های من", icon: "kanban", render: designerProjects, count: () => D().orders.filter((o) => o.designerId === me.id && ["in_progress", "revision"].includes(o.status)).length },
    { id: "jobs", label: "پروژه‌های باز", icon: "briefcase", render: designerJobs, count: () => openJobs().length },
    { id: "portfolio", label: "نمونه‌کارهای من", icon: "image", render: designerPortfolio },
    { id: "earnings", label: "درآمد و تسویه", icon: "wallet", render: payoutView },
    { id: "tickets", label: "پشتیبانی", icon: "ticket", render: () => ticketsView() },
    { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
    { id: "profile", label: "پروفایل حرفه‌ای", icon: "settings", render: profileView },
  ];
  const openJobs = () => D().orders.filter((o) => !o.designerId && ["new", "review"].includes(o.status) && (me.skills || []).includes(o.serviceId));

  function designerOverview() {
    const mine = D().orders.filter((o) => o.designerId === me.id);
    const earn = D().transactions.filter((t) => t.userId === me.id && t.type === "earning");
    return `<div class="dash-grid">
      <div class="welcome"><h2>روز بخیر ${esc(me.name.split(" ")[0])} ✏️</h2><p>${faDigits(openJobs().length)} پروژه باز متناسب با مهارت‌های شما وجود دارد.</p>
        <div class="cta-actions"><a class="btn btn-primary" href="#jobs">${icon("briefcase")} پروژه‌های باز</a><a class="btn btn-ghost" href="#projects">${icon("kanban")} تخته پروژه‌ها</a></div></div>
      <div class="tiles">
        ${tile("پروژه‌های در جریان", faDigits(mine.filter((o) => ["in_progress", "revision", "awaiting"].includes(o.status)).length), "loader")}
        ${tile("تحویل‌شده", faDigits(mine.filter((o) => o.status === "done").length), "check-circle")}
        ${tile("امتیاز", `${faDigits((me.rating || 0).toFixed(1))} ★`, "star", me.level || "")}
        ${tile("موجودی", money(me.wallet || 0), "wallet")}
      </div>
      <div class="dash-grid dash-grid-2">
        ${box("درآمد ماهانه", "chart", barChart(monthly(earn, (t) => t.amount, [9.2e6, 12.5e6, 8.8e6, 14.1e6, 16.4e6, 0])))}
        ${box("نیازمند اقدام", "zap", (() => {
          const todo = mine.filter((o) => ["in_progress", "revision"].includes(o.status));
          return todo.length ? todo.map((o) => `<a class="list-row" href="#projects/${o.id}">${svcCell(o)}<span style="margin-right:auto">${statusBadge(o.status)}</span></a>`).join("") : empty("کاری در صف نیست.", "check-circle");
        })())}
      </div>
    </div>`;
  }

  function designerProjects(param) {
    if (param) return orderDetail(param);
    const mine = D().orders.filter((o) => o.designerId === me.id);
    const cols = [["in_progress", "در حال انجام"], ["revision", "اصلاحیه"], ["awaiting", "منتظر تأیید مشتری"], ["done", "تحویل‌شده"]];
    return box("تخته پروژه‌ها", "kanban", `
      <p class="muted small mb-2">کارت‌ها را به ستون «منتظر تأیید مشتری» بکشید تا برای مشتری ارسال شوند.</p>
      <div class="kanban mt-2">
        ${cols.map(([st, label]) => {
          const items = mine.filter((o) => o.status === st);
          return `<div class="kan-col" data-drop-status="${st}">
            <div class="kan-head"><span>${label}</span><span class="badge">${faDigits(items.length)}</span></div>
            ${items.map((o) => `<a class="kan-card" draggable="true" data-drag="${o.id}" href="#projects/${o.id}">
              <b>${esc(o.title)}</b><span class="small muted" dir="ltr" style="display:block;text-align:right">${o.code}</span>
              <div class="row-between"><span>${icon("clock")} ${ago(o.createdAt)}</span><span>${faDigits((o.deliverables || []).length)} فایل</span></div></a>`).join("") || `<p class="small muted center" style="padding:20px 0">خالی</p>`}
          </div>`;
        }).join("")}
      </div>`);
  }

  function designerJobs() {
    const jobs = openJobs();
    return box("پروژه‌های باز مطابق مهارت شما", "briefcase", jobs.length ? `<div class="grid-auto">${jobs.map((o) => {
      const s = findService(o.serviceId);
      const applied = (o.applicants || []).includes(me.id);
      return `<article class="card job hover-lift" style="--h:${findCategory(s.category).hue}">
        <div class="row-between">${svcCell(o)}</div>
        <dl class="kv small">${s.fields.slice(0, 3).map((f) => `<dt>${f.label}</dt><dd>${fieldText(f, o.details?.[f.id])}</dd>`).join("")}<dt>تحویل</dt><dd>${DEADLINES.find((d) => d.v === o.deadline)?.label}</dd></dl>
        <div class="row-between"><b class="brand">${money(Math.round(priceOf(o) * (1 - D().settings.commission / 100)))}</b>
          ${applied ? `<span class="badge badge--ok">${icon("check")}درخواست ثبت شد</span>` : `<button class="btn btn-primary btn-sm" data-act="apply" data-id="${o.id}">${icon("send")} اعلام آمادگی</button>`}</div>
      </article>`;
    }).join("")}</div>` : empty("فعلاً پروژه بازی متناسب با مهارت‌های شما نیست. مهارت‌ها را در پروفایل به‌روز کنید.", "briefcase"));
  }

  function designerPortfolio() {
    const works = D().portfolio.filter((w) => w.designerId === me.id);
    return box("نمونه‌کارهای من", "image", works.length ? `<div class="grid-auto">${works.map((w) => {
      const s = findService(w.serviceId);
      return `<article class="work-card"><div class="work-thumb"><span class="bg" style="background:${art(w.id, findCategory(w.category).hue)}"></span><span class="thumb-icon">${icon(s.icon)}</span></div>
        <div class="work-body"><h3>${esc(w.title)}</h3><div class="work-meta"><span>${s.title} · ${icon("heart")} ${faDigits(w.likes)}</span><button class="icon-btn icon-btn-sm" data-act="del-work" data-id="${w.id}" aria-label="حذف">${icon("trash")}</button></div></div></article>`;
    }).join("")}</div>` : empty("هنوز نمونه‌کاری اضافه نکرده‌اید.", "image"), `<button class="btn btn-primary btn-sm" data-act="add-work">${icon("plus")} افزودن نمونه‌کار</button>`);
  }

  // ================================================================ Seller
  const SELLER = [
    { id: "overview", label: "داشبورد", icon: "home", render: sellerOverview },
    { id: "products", label: "محصولات من", icon: "box", render: sellerProducts },
    { id: "sales", label: "فروش‌ها", icon: "chart", render: sellerSales },
    { id: "coupons", label: "کدهای تخفیف", icon: "percent", render: () => couponsView(true) },
    { id: "earnings", label: "درآمد و تسویه", icon: "wallet", render: payoutView },
    { id: "tickets", label: "پشتیبانی", icon: "ticket", render: () => ticketsView() },
    { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
    { id: "profile", label: "پروفایل فروشگاه", icon: "settings", render: profileView },
  ];
  const myProducts = () => D().products.filter((p) => p.sellerId === me.id);

  function sellerOverview() {
    const prods = myProducts();
    const sales = D().transactions.filter((t) => t.userId === me.id && t.type === "sale");
    return `<div class="dash-grid">
      <div class="welcome"><h2>${esc(me.shopName || me.name)} 🛍️</h2><p>${prods.filter((p) => p.status === "pending").length ? "بعضی از محصولات شما در انتظار تأیید هستند." : "محصول جدید اضافه کنید تا فروش‌تان بیشتر شود."}</p>
        <div class="cta-actions"><button class="btn btn-primary" data-act="add-product">${icon("plus")} محصول جدید</button><a class="btn btn-ghost" href="shop.html">${icon("store")} مشاهده فروشگاه</a></div></div>
      <div class="tiles">
        ${tile("محصولات فعال", faDigits(prods.filter((p) => p.status === "active").length), "box")}
        ${tile("کل فروش (تعداد)", faDigits(prods.reduce((s, p) => s + p.sales, 0)), "cart")}
        ${tile("درآمد این ماه", money(sales.filter((t) => keyFmt.format(new Date(t.at)) === keyFmt.format(new Date())).reduce((s, t) => s + t.amount, 0)), "trend")}
        ${tile("موجودی", money(me.wallet || 0), "wallet")}
      </div>
      <div class="dash-grid dash-grid-2">
        ${box("درآمد ماهانه فروش", "chart", barChart(monthly(sales, (t) => t.amount, [2.1e6, 3.4e6, 2.9e6, 4.6e6, 5.2e6, 0])))}
        ${box("پرفروش‌ترین‌ها", "star", prods.length ? prods.slice().sort((a, b) => b.sales - a.sales).slice(0, 5).map((p) => `<div class="list-row"><span class="mini-thumb" style="background:${art(p.id)}">${icon("box")}</span><div class="grow"><b>${esc(p.title)}</b><br><small>${faDigits(p.sales)} فروش</small></div></div>`).join("") : empty("محصولی ندارید.", "box"))}
      </div>
    </div>`;
  }

  function productRows(list, admin = false) {
    return list.map((p) => {
      const c = PRODUCT_CATEGORIES.find((x) => x.id === p.category);
      const seller = db.user(p.sellerId);
      return `<tr>
        <td><div class="cell-title"><span class="mini-thumb" style="background:${art(p.id)}">${icon(c?.icon || "box")}</span><span><b>${esc(p.title)}</b><small>${c?.title || ""}${admin ? ` · ${esc(seller?.shopName || "")}` : ""}</small></span></div></td>
        <td>${money(p.price)}${p.discount ? ` <span class="badge badge--bad">${faDigits(p.discount)}٪</span>` : ""}</td>
        <td>${faDigits(p.sales)}</td>
        <td>${pill(PRODUCT_STATUS[p.status])}</td>
        <td><div class="actions">${admin
          ? `${p.status !== "active" ? `<button class="btn btn-primary btn-xs" data-act="product-status" data-id="${p.id}" data-v="active">تأیید / فعال</button>` : `<button class="btn btn-ghost btn-xs" data-act="product-status" data-id="${p.id}" data-v="hidden">مخفی</button>`}${p.status === "pending" ? `<button class="btn btn-ghost btn-xs" data-act="product-status" data-id="${p.id}" data-v="rejected">رد</button>` : ""}`
          : `<button class="icon-btn icon-btn-sm" data-act="edit-product" data-id="${p.id}" aria-label="ویرایش">${icon("edit")}</button>${p.status === "active" || p.status === "hidden" ? `<button class="icon-btn icon-btn-sm" data-act="product-status" data-id="${p.id}" data-v="${p.status === "active" ? "hidden" : "active"}" aria-label="نمایش/مخفی">${icon("eye")}</button>` : ""}<button class="icon-btn icon-btn-sm" data-act="del-product" data-id="${p.id}" aria-label="حذف">${icon("trash")}</button>`}
        </div></td></tr>`;
    });
  }

  function sellerProducts() {
    return box("محصولات من", "box", table(["محصول", "قیمت", "فروش", "وضعیت", ""], productRows(myProducts()), "هنوز محصولی اضافه نکرده‌اید."), `<button class="btn btn-primary btn-sm" data-act="add-product">${icon("plus")} محصول جدید</button>`);
  }

  function sellerSales() {
    const sales = D().transactions.filter((t) => t.userId === me.id && t.type === "sale");
    return `<div class="dash-grid">${box("نمودار فروش", "chart", barChart(monthly(sales, (t) => t.amount)))}${box("فروش‌های اخیر", "list", txTable(sales))}</div>`;
  }

  function couponsView(own) {
    const list = D().coupons.filter((c) => (own ? c.ownerId === me.id : true));
    return `<div class="dash-grid dash-grid-2">
      ${box("کدهای تخفیف", "percent", table(["کد", "تخفیف", "استفاده", "مالک", "وضعیت", ""], list.map((c) => `
        <tr><td><b dir="ltr">${esc(c.code)}</b></td><td>${faDigits(c.percent)}٪</td><td>${faDigits(c.uses)}${c.limit ? ` / ${faDigits(c.limit)}` : ""}</td>
        <td class="muted">${c.ownerId ? esc(db.user(c.ownerId)?.shopName || "") : "سراسری"}</td>
        <td>${c.active ? pill(["فعال", "ok"]) : pill(["غیرفعال", "info"])}</td>
        <td><div class="actions"><label class="switch"><input type="checkbox" data-change="coupon-toggle" data-code="${esc(c.code)}" ${c.active ? "checked" : ""}><span class="track"></span></label></div></td></tr>`), "کد تخفیفی ندارید."))}
      ${box("ساخت کد جدید", "plus", `
        <form class="form-grid" data-form="coupon">
          <div class="field"><label class="field-label" for="cp-code">کد</label><input class="input" id="cp-code" name="code" dir="ltr" placeholder="${own ? "MYSHOP20" : "NOROUZ30"}" required></div>
          <div class="form-grid form-grid-2">
            <div class="field"><label class="field-label" for="cp-pct">درصد</label><input class="input" id="cp-pct" name="percent" dir="ltr" inputmode="numeric" placeholder="20" required></div>
            <div class="field"><label class="field-label" for="cp-limit">سقف استفاده</label><input class="input" id="cp-limit" name="limit" dir="ltr" inputmode="numeric" placeholder="۰ = نامحدود"></div>
          </div>
          <button class="btn btn-primary" type="submit">${icon("plus")} ساخت کد</button>
        </form>`)}
    </div>`;
  }

  // ================================================================ Admin
  const ADMIN = [
    { id: "overview", label: "داشبورد کل", icon: "home", render: adminOverview },
    { id: "orders", label: "سفارش‌ها", icon: "list", render: adminOrders, count: () => D().orders.filter((o) => o.status === "new").length },
    { id: "users", label: "کاربران", icon: "users", render: adminUsers },
    { id: "designers", label: "طراحان", icon: "pen", render: adminDesigners, count: () => D().users.filter((u) => u.role === "designer" && u.status === "pending").length },
    { id: "sellers", label: "فروشندگان و محصولات", icon: "store", render: adminSellers, count: () => D().users.filter((u) => u.role === "seller" && u.status === "pending").length + D().products.filter((p) => p.status === "pending").length },
    { id: "services", label: "خدمات و قیمت‌ها", icon: "tag", render: adminServices },
    { id: "finance", label: "مالی و تسویه", icon: "wallet", render: adminFinance, count: () => D().payouts.filter((p) => p.status === "pending").length },
    { id: "tickets", label: "تیکت‌ها", icon: "ticket", render: () => ticketsView(true), count: () => D().tickets.filter((t) => t.status === "open").length },
    { id: "coupons", label: "کدهای تخفیف", icon: "percent", render: () => couponsView(false) },
    { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
    { id: "settings", label: "تنظیمات سایت", icon: "settings", render: adminSettings },
  ];

  function adminOverview() {
    const d = D();
    const paidOrders = d.orders.filter((o) => o.paid);
    const income = d.transactions.filter((t) => ["payment", "purchase"].includes(t.type));
    const revenue = income.reduce((s, t) => s - t.amount, 0);
    const commission = Math.round(revenue * (d.settings.commission / 100));
    const byStatus = Object.entries(ORDER_STATUS).map(([k, v]) => [v.label, d.orders.filter((o) => o.status === k).length]);
    const maxS = Math.max(1, ...byStatus.map((x) => x[1]));
    const pending = d.users.filter((u) => u.status === "pending").length + d.products.filter((p) => p.status === "pending").length;
    return `<div class="dash-grid">
      <div class="tiles">
        ${tile("درآمد کل (پرداخت‌ها)", money(revenue), "trend", `سهم پلتفرم ≈ ${money(commission)}`)}
        ${tile("سفارش‌ها", faDigits(d.orders.length), "list", `${faDigits(d.orders.filter((o) => o.status === "new").length)} سفارش جدید`)}
        ${tile("کاربران", faDigits(d.users.length), "users", `${faDigits(d.users.filter((u) => u.role === "designer").length)} طراح · ${faDigits(d.users.filter((u) => u.role === "seller").length)} فروشنده`)}
        ${tile("در انتظار تأیید", faDigits(pending), "shield", "طراح، فروشنده و محصول")}
      </div>
      <div class="dash-grid dash-grid-2">
        ${box("درآمد ماهانه", "chart", barChart(monthly(income, (t) => -t.amount, [21e6, 28.5e6, 24e6, 33e6, 0, 0])))}
        ${box("وضعیت سفارش‌ها", "kanban", `<ul class="hbars">${byStatus.map(([l, n]) => `<li><span>${l}</span><span class="track"><span class="fill" style="display:block;width:${(n / maxS) * 100}%"></span></span><b>${faDigits(n)}</b></li>`).join("")}</ul>`)}
      </div>
      <div class="dash-grid dash-grid-2">
        ${box("سفارش‌های جدید", "inbox", table(["سفارش", "وضعیت", "مبلغ", "زمان"], orderRows(d.orders.filter((o) => ["new", "review"].includes(o.status)).slice(0, 6)), "سفارش جدیدی نیست."), `<a class="btn btn-ghost btn-sm" href="#orders">همه سفارش‌ها</a>`)}
        ${box("فعالیت اخیر", "bell", d.notifications.filter((n) => n.userId === "u-admin").slice(0, 7).map((n) => `<div class="list-row"><span class="cell-icon">${icon("bell")}</span><div class="grow">${esc(n.text)}<br><small>${ago(n.at)}</small></div></div>`).join("") || empty("فعالیتی نیست.", "bell"))}
      </div>
    </div>`;
  }

  function adminOrders(param) {
    if (param) return orderDetail(param);
    const all = D().orders;
    const f = segState.aorders || "all";
    const term = segState.aordersQ || "";
    const counts = Object.fromEntries(Object.keys(ORDER_STATUS).map((k) => [k, all.filter((o) => o.status === k).length]));
    const list = all.filter((o) => (f === "all" || o.status === f) && (!term || o.code.includes(term.toUpperCase()) || o.title.includes(term)));
    return box("مدیریت سفارش‌ها", "list", `
      <div class="row-between">${seg("aorders", [["all", "همه", all.length], ...Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label, counts[k]])], f)}
        <label class="search">${icon("search")}<input class="input" data-change="aorders-q" value="${esc(term)}" placeholder="کد یا عنوان سفارش"></label></div>
      <div class="mt-2">${table(["سفارش", "وضعیت", "مبلغ", "زمان", "مشتری", "طراح"], orderRows(list, (o) => `<td>${esc(db.user(o.userId)?.name || "")}</td><td>${o.designerId ? esc(db.user(o.designerId)?.name || "") : `<span class="badge badge--warn">تخصیص نیافته${(o.applicants || []).length ? ` · ${faDigits(o.applicants.length)} داوطلب` : ""}</span>`}</td>`))}</div>`);
  }

  function adminUsers() {
    const f = segState.users || "all";
    const all = D().users;
    const list = all.filter((u) => f === "all" || u.role === f);
    return box("کاربران", "users", `
      ${seg("users", [["all", "همه", all.length], ...Object.entries(ROLE_LABEL).map(([k, l]) => [k, l, all.filter((u) => u.role === k).length])], f)}
      <div class="mt-2">${table(["کاربر", "نقش", "وضعیت", "عضویت", "کیف پول", ""], list.map((u) => `
        <tr><td>${userCell(u)}</td>
          <td><select class="select" style="padding:6px 10px;padding-left:28px;width:auto" data-change="role" data-id="${u.id}" ${u.id === "u-admin" ? "disabled" : ""}>${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${k === u.role ? "selected" : ""}>${l}</option>`).join("")}</select></td>
          <td>${pill(USER_STATUS[u.status] || USER_STATUS.active)}</td>
          <td class="muted">${date(u.createdAt)}</td>
          <td>${money(u.wallet || 0)}</td>
          <td><div class="actions">${u.id !== me.id ? `
            <button class="btn btn-ghost btn-xs" data-act="impersonate" data-id="${u.id}" title="ورود به‌جای کاربر برای پشتیبانی">${icon("eye")} ورود</button>
            ${u.status === "blocked" ? `<button class="btn btn-ghost btn-xs" data-act="user-status" data-id="${u.id}" data-v="active">رفع مسدودی</button>` : `<button class="btn btn-ghost btn-xs" data-act="user-status" data-id="${u.id}" data-v="blocked">مسدود</button>`}` : ""}</div></td></tr>`))}</div>`);
  }

  function applicantCards(list, kind) {
    return list.length ? `<div class="grid-auto">${list.map((u) => `
      <article class="card job">
        <div class="row">${avatar(u, "avatar-lg")}<div><b>${esc(u.name)}</b><br><small class="muted" dir="ltr">${faDigits(u.phone)}</small><br><small class="muted">${ago(u.createdAt)}</small></div></div>
        ${kind === "designer"
          ? `<div class="chips">${(u.skills || []).slice(0, 6).map((s) => `<span class="badge">${findService(s)?.title || s}</span>`).join("")}</div>${u.portfolioUrl ? `<a class="brand small" href="${esc(u.portfolioUrl)}" target="_blank" rel="noreferrer">${icon("external")} مشاهده نمونه‌کار</a>` : ""}<p class="small muted">${esc(u.bio || "")}</p>`
          : `<p class="small"><b>${esc(u.shopName || "")}</b></p><p class="small muted">${(u.cats || []).map((c) => PRODUCT_CATEGORIES.find((x) => x.id === c)?.title).filter(Boolean).join("، ")}</p>`}
        <div class="row-between"><button class="btn btn-primary btn-sm" data-act="user-status" data-id="${u.id}" data-v="active">${icon("check")} تأیید</button><button class="btn btn-ghost btn-sm" data-act="user-status" data-id="${u.id}" data-v="rejected">رد درخواست</button></div>
      </article>`).join("")}</div>` : empty("درخواست جدیدی وجود ندارد.", "check-circle");
  }

  function adminDesigners() {
    const all = D().users.filter((u) => u.role === "designer");
    const active = all.filter((u) => u.status === "active");
    return `<div class="dash-grid">
      ${box("درخواست‌های همکاری طراحان", "shield", applicantCards(all.filter((u) => u.status === "pending"), "designer"))}
      ${box("طراحان فعال", "pen", table(["طراح", "امتیاز", "پروژه فعال", "تحویل‌شده", "موجودی"], active.map((u) => {
        const os = D().orders.filter((o) => o.designerId === u.id);
        return `<tr><td>${userCell(u, esc(u.level || ""))}</td><td><span class="stars">${icon("star")}${faDigits((u.rating || 0).toFixed(1))}</span></td><td>${faDigits(os.filter((o) => !["done", "cancelled"].includes(o.status)).length)}</td><td>${faDigits(os.filter((o) => o.status === "done").length)}</td><td>${money(u.wallet || 0)}</td></tr>`;
      })))}
    </div>`;
  }

  function adminSellers() {
    const f = segState.aprod || "pending";
    const prods = D().products.filter((p) => f === "all" || p.status === f);
    return `<div class="dash-grid">
      ${box("درخواست‌های فروشندگی", "shield", applicantCards(D().users.filter((u) => u.role === "seller" && u.status === "pending"), "seller"))}
      ${box("محصولات", "box", `${seg("aprod", [["pending", "در انتظار تأیید", D().products.filter((p) => p.status === "pending").length], ["active", "فعال"], ["hidden", "مخفی"], ["rejected", "رد شده"], ["all", "همه"]], f)}
        <div class="mt-2">${table(["محصول", "قیمت", "فروش", "وضعیت", ""], productRows(prods, true), "محصولی در این وضعیت نیست.")}</div>`)}
    </div>`;
  }

  function adminServices() {
    return `<div class="dash-grid">
      <div class="banner" style="border-color:rgb(96 165 250 / .35);background:rgb(96 165 250 / .07)">${icon("info")}<span>قیمت پایه هر خدمت را تغییر دهید؛ درخت خدمات، صفحه خدمات و برآورد قیمت فرم سفارش بلافاصله به‌روز می‌شوند. قیمت امکانات هر خدمت در فایل <code dir="ltr">assets/js/data.js</code> قابل ویرایش است.</span></div>
      <form data-form="prices" class="dash-grid">
        ${CATALOG.map((c) => box(c.title, c.icon, table(["خدمت", "زمان پایه", "قیمت پیش‌فرض", "قیمت پایه (تومان)"], c.services.map((s) => `
          <tr><td><div class="cell-title" style="--h:${c.hue}"><span class="cell-icon">${icon(s.icon)}</span><b>${s.title}</b></div></td>
          <td>${faDigits(s.days)} روز</td><td class="muted">${num(s.base)}</td>
          <td><input class="input price-input" name="${s.id}" value="${num(db.basePrice(s.id))}" inputmode="numeric" aria-label="قیمت ${s.title}"></td></tr>`)))).join("")}
        <div class="row"><button class="btn btn-primary" type="submit">${icon("check")} ذخیره قیمت‌ها</button><button class="btn btn-ghost" type="button" data-act="reset-prices">بازگشت به پیش‌فرض</button></div>
      </form>
    </div>`;
  }

  function adminFinance() {
    const d = D();
    const pending = d.payouts.filter((p) => p.status === "pending");
    const income = d.transactions.filter((t) => ["payment", "purchase"].includes(t.type)).reduce((s, t) => s - t.amount, 0);
    const owed = d.users.filter((u) => ["designer", "seller"].includes(u.role)).reduce((s, u) => s + (u.wallet || 0), 0);
    return `<div class="dash-grid">
      <div class="tiles">
        ${tile("ورودی کل", money(income), "trend")}
        ${tile("سهم پلتفرم", money(Math.round(income * d.settings.commission / 100)), "percent", `${faDigits(d.settings.commission)}٪ کارمزد`)}
        ${tile("بدهی به طراحان/فروشندگان", money(owed), "users")}
        ${tile("تسویه در صف", money(pending.reduce((s, p) => s + p.amount, 0)), "clock", `${faDigits(pending.length)} درخواست`)}
      </div>
      ${box("درخواست‌های تسویه", "wallet", table(["کاربر", "مبلغ", "شبا/کارت", "تاریخ", "وضعیت", ""], d.payouts.map((p) => `
        <tr><td>${userCell(db.user(p.userId), ROLE_LABEL[db.user(p.userId)?.role])}</td><td>${money(p.amount)}</td><td dir="ltr" class="muted">${esc(p.card || "")}</td><td class="muted">${date(p.at)}</td>
        <td>${p.status === "paid" ? pill(["واریز شد", "ok"]) : pill(["در صف", "warn"])}</td>
        <td>${p.status === "pending" ? `<button class="btn btn-primary btn-xs" data-act="payout-paid" data-id="${p.id}">${icon("check")} واریز شد</button>` : ""}</td></tr>`), "درخواستی نیست."))}
      ${box("آخرین تراکنش‌ها", "list", txTable(d.transactions, true))}
    </div>`;
  }

  function adminSettings() {
    const s = D().settings;
    return `<div class="dash-grid dash-grid-2">
      ${box("تنظیمات عمومی", "settings", `
        <form class="form-grid form-grid-2" data-form="settings">
          <div class="field"><label class="field-label" for="st-name">نام سایت</label><input class="input" id="st-name" name="siteName" value="${esc(s.siteName)}"></div>
          <div class="field"><label class="field-label" for="st-phone">تلفن پشتیبانی</label><input class="input" id="st-phone" name="phone" dir="ltr" value="${esc(s.phone)}"></div>
          <div class="field"><label class="field-label" for="st-email">ایمیل</label><input class="input" id="st-email" name="email" dir="ltr" value="${esc(s.email)}"></div>
          <div class="field"><label class="field-label" for="st-tg">لینک تلگرام</label><input class="input" id="st-tg" name="telegram" dir="ltr" value="${esc(s.telegram)}"></div>
          <div class="field"><label class="field-label" for="st-com">کارمزد پلتفرم (٪)</label><input class="input" id="st-com" name="commission" dir="ltr" inputmode="numeric" value="${faDigits(s.commission)}"></div>
          <div class="field"><label class="field-label" for="st-min">حداقل تسویه (تومان)</label><input class="input" id="st-min" name="minPayout" dir="ltr" inputmode="numeric" value="${num(s.minPayout)}"></div>
          <div class="span-2"><label class="switch"><input type="checkbox" name="maintenance" ${s.maintenance ? "checked" : ""}><span class="track"></span>حالت تعمیر و نگهداری (فقط نمایشی)</label></div>
          <div class="span-2"><button class="btn btn-primary" type="submit">${icon("check")} ذخیره تنظیمات</button></div>
        </form>`)}
      <section class="card box danger-zone"><div class="box-head"><h2>${icon("refresh")}داده‌های نمایشی</h2></div>
        <p class="muted small lh">همه سفارش‌ها، کاربران و تغییرات این مرورگر پاک می‌شود و داده‌های نمونه اولیه برمی‌گردد.</p>
        <button class="btn btn-danger mt-2" data-act="reset-demo">${icon("trash")} بازنشانی داده‌ها</button>
      </section>
    </div>`;
  }

  // ================================================================ Layout
  const NAVS = { customer: CUSTOMER, designer: DESIGNER, seller: SELLER, admin: ADMIN };
  const PENDING_NAV = [
    { id: "overview", label: "وضعیت حساب", icon: "home", render: pendingOverview },
    { id: "profile", label: "پروفایل", icon: "settings", render: profileView },
    { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
  ];
  function pendingOverview() {
    const rejected = me.status === "rejected";
    return `<div class="dash-grid">
      <div class="banner">${icon(rejected ? "x-circle" : "clock")}<span>${rejected
        ? "متأسفانه درخواست همکاری شما تأیید نشد. می‌توانید پس از تکمیل نمونه‌کار دوباره درخواست دهید."
        : `درخواست همکاری شما به عنوان <b>${ROLE_LABEL[me.role]}</b> ثبت شد و در حال بررسی است. معمولاً کمتر از ۴۸ ساعت طول می‌کشد. در این مدت پروفایل خود را کامل کنید.`}</span></div>
      ${box("قدم‌های بعدی", "list", `<ul>
        <li class="list-row"><span class="cell-icon">${icon("check")}</span><div class="grow">ثبت‌نام و تأیید شماره موبایل</div></li>
        <li class="list-row"><span class="cell-icon">${icon(rejected ? "x-circle" : "loader")}</span><div class="grow">بررسی ${me.role === "designer" ? "نمونه‌کار و مهارت‌ها" : "اطلاعات فروشگاه"} توسط تیم بهیکس</div></li>
        <li class="list-row"><span class="cell-icon">${icon("zap")}</span><div class="grow">فعال شدن پنل ${ROLE_LABEL[me.role]} و شروع ${me.role === "designer" ? "دریافت پروژه" : "فروش"}</div></li></ul>`)}
    </div>`;
  }

  const navFor = () => (me.role !== "customer" && me.role !== "admin" && me.status !== "active" ? PENDING_NAV : NAVS[me.role]);

  function shell() {
    const nav = navFor();
    const unread = D().notifications.filter((n) => n.userId === me.id && !n.read).length;
    app.innerHTML = `
      <aside class="dash-side" id="dash-side" aria-label="منوی پنل">
        <div class="side-brand"><a href="index.html" class="logo logo--md" aria-label="BEHIX"><span class="logo-a">BEHI</span><span class="logo-x">X</span></a><button class="icon-btn icon-btn-sm side-toggle-close" data-act="side-close" aria-label="بستن منو" style="display:none">${icon("cross")}</button></div>
        <div class="side-user">${avatar(me)}<div><b>${esc(me.name)}</b><span class="badge badge--brand">${ROLE_LABEL[me.role]}</span></div></div>
        <nav class="side-nav">
          <p class="side-nav-title">منو</p>
          ${nav.map((n) => {
            const c = n.count ? n.count() : n.id === "notifications" ? unread : 0;
            return `<a class="side-link" href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}${n.label}${c ? `<span class="count">${faDigits(c)}</span>` : ""}</a>`;
          }).join("")}
        </nav>
        <div class="side-foot">
          <label class="demo-switch"><span class="muted">حالت دمو — تغییر نقش:</span>
            <select class="select mt-1" data-change="switch-user">
              ${[["u-1", "مشتری — سارا"], ["d-1", "طراح — نیما"], ["s-1", "فروشنده — پیکسل"], ["u-admin", "مدیر کل"]].map(([id, l]) => `<option value="${id}" ${id === me.id ? "selected" : ""}>${l}</option>`).join("")}
              ${["u-1", "d-1", "s-1", "u-admin"].includes(me.id) ? "" : `<option value="${me.id}" selected>${esc(me.name)}</option>`}
            </select></label>
          <a class="side-link" href="index.html">${icon("globe")}بازگشت به سایت</a>
          <button class="side-link" data-act="logout" style="width:100%">${icon("logout")}خروج از حساب</button>
        </div>
      </aside>
      <div class="dash-main">
        <header class="dash-top">
          <button class="icon-btn side-toggle" data-act="side-open" aria-label="باز کردن منو">${icon("menu")}</button>
          <div class="grow"><p class="crumb">پنل ${ROLE_LABEL[me.role]}</p><h1 data-title></h1></div>
          <button type="button" class="icon-btn theme-btn" aria-label="تغییر تم">${icon("sun", "icon-sun")}${icon("moon", "icon-moon")}</button>
          <div class="bell ${unread ? "has-new" : ""}" style="position:relative">
            <button class="icon-btn" data-act="bell" aria-label="اعلان‌ها" aria-expanded="false">${icon("bell")}</button>
            ${unread ? `<span class="dot-count">${faDigits(unread)}</span>` : ""}
          </div>
          ${me.role === "customer" ? `<a class="btn btn-primary btn-sm" href="order.html">${icon("plus")}<span class="hide-sm">سفارش جدید</span></a>` : ""}
        </header>
        <div class="dash-view" id="view"></div>
      </div>`;
  }

  function render() {
    refreshMe();
    if (!me || me.status === "blocked") {
      auth.logout();
      location.replace("auth.html");
      return;
    }
    shell();
    const nav = navFor();
    const [sec, param] = decodeURIComponent(location.hash.slice(1)).split("/");
    const route = nav.find((n) => n.id === sec) || nav[0];
    app.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === route.id));
    app.querySelector("[data-title]").textContent = route.label;
    document.title = `${route.label} | پنل بهیکس`;
    const view = app.querySelector("#view");
    view.innerHTML = route.render(param);
    const log = view.querySelector("[data-chat]");
    if (log) log.scrollTop = log.scrollHeight;
  }

  // ================================================================ Actions
  function confirmBox(title, text, onYes, label = "تأیید") {
    modal({ title, body: `<p class="lh">${text}</p>`, actions: [{ label: "انصراف" }, { label, primary: true, onClick: onYes }] });
  }
  const findOrder = (id) => D().orders.find((o) => o.id === id);

  function productForm(p = {}) {
    modal({
      title: p.id ? "ویرایش محصول" : "محصول جدید", wide: true,
      body: `<form class="form-grid form-grid-2" id="product-form">
        <div class="field span-2"><label class="field-label" for="pd-title">عنوان محصول</label><input class="input" id="pd-title" name="title" value="${esc(p.title || "")}" required></div>
        <div class="field"><label class="field-label" for="pd-cat">دسته‌بندی</label><select class="select" id="pd-cat" name="category">${PRODUCT_CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === p.category ? "selected" : ""}>${c.title}</option>`).join("")}</select></div>
        <div class="field"><label class="field-label" for="pd-tags">برچسب‌ها (با کاما)</label><input class="input" id="pd-tags" name="tags" value="${esc((p.tags || []).join("، "))}"></div>
        <div class="field"><label class="field-label" for="pd-price">قیمت (تومان)</label><input class="input" id="pd-price" name="price" dir="ltr" inputmode="numeric" value="${p.price ? num(p.price) : ""}"></div>
        <div class="field"><label class="field-label" for="pd-off">تخفیف (٪)</label><input class="input" id="pd-off" name="discount" dir="ltr" inputmode="numeric" value="${faDigits(p.discount || 0)}"></div>
        <div class="field span-2"><label class="field-label" for="pd-desc">توضیحات</label><textarea class="textarea" id="pd-desc" name="desc">${esc(p.desc || "")}</textarea></div>
        <div class="field span-2"><span class="field-label">فایل محصول و پیش‌نمایش</span><label class="drop">${icon("upload")}<b class="small">فایل‌ها را انتخاب کنید</b><small>${p.files ? `${faDigits(p.files.length)} فایل بارگذاری شده` : "zip، pptx، psd، aep …"}</small><input type="file" name="files" multiple></label></div>
      </form>
      <p class="small muted mt-2">${icon("info")} محصول پس از ذخیره، برای بررسی کیفیت به مدیر ارسال می‌شود.</p>`,
      actions: [{ label: "انصراف" }, {
        label: "ذخیره و ارسال برای بررسی", primary: true, onClick: (wrap) => {
          const f = wrap.querySelector("#product-form");
          const title = f.elements.title.value.trim();
          const price = parseAmount(f.price.value);
          if (title.length < 4 || !price) {
            toast("عنوان و قیمت را وارد کنید.", "bad");
            return false;
          }
          const data = {
            title, category: f.category.value, price, discount: Math.min(90, parseAmount(f.discount.value)),
            tags: f.tags.value.split(/[,،]/).map((t) => t.trim()).filter(Boolean), desc: f.desc.value,
            files: f.files.files.length ? [...f.files.files].map((x) => x.name) : p.files,
          };
          if (p.id) Object.assign(D().products.find((x) => x.id === p.id), data, { status: "pending" });
          else D().products.unshift({ id: db.uid("p"), sellerId: me.id, sales: 0, rating: 0, status: "pending", createdAt: Date.now(), ...data });
          db.notify("u-admin", `محصول «${title}» برای تأیید ارسال شد.`, "sellers");
          commit("محصول برای بررسی ارسال شد.");
        },
      }],
    });
  }

  const ACT = {
    "side-open": () => {
      app.querySelector("#dash-side").classList.add("is-open");
      const scrim = document.createElement("div");
      scrim.className = "side-scrim";
      scrim.addEventListener("click", ACT["side-close"]);
      document.body.appendChild(scrim);
    },
    "side-close": () => {
      app.querySelector("#dash-side")?.classList.remove("is-open");
      document.querySelectorAll(".side-scrim").forEach((s) => s.remove());
    },
    logout: () => { auth.logout(); location.href = "index.html"; },
    seg: (el) => { segState[el.dataset.seg] = el.dataset.v; render(); },
    bell: (el) => {
      const wrap = el.parentElement;
      const open = wrap.querySelector(".notif-pop");
      if (open) { open.remove(); return el.setAttribute("aria-expanded", "false"); }
      const list = D().notifications.filter((n) => n.userId === me.id).slice(0, 6);
      wrap.insertAdjacentHTML("beforeend", `<div class="notif-pop">${list.length ? list.map((n) => `<button class="notif-item ${n.read ? "" : "is-unread"}" data-act="open-notif" data-id="${n.id}">${icon("bell")}<span><b>${esc(n.text)}</b><br><small class="muted">${ago(n.at)}</small></span></button>`).join("") : empty("اعلانی ندارید.", "bell")}
        <div class="row-between" style="padding:8px"><button class="btn btn-ghost btn-xs" data-act="read-all">خواندن همه</button><a class="btn btn-ghost btn-xs" href="#notifications">همه اعلان‌ها</a></div></div>`);
      el.setAttribute("aria-expanded", "true");
    },
    "open-notif": (el) => {
      const n = D().notifications.find((x) => x.id === el.dataset.id);
      n.read = true;
      db.save();
      if (n.link && navFor().some((x) => x.id === n.link)) location.hash = n.link;
      else render();
    },
    "read-all": () => {
      D().notifications.forEach((n) => n.userId === me.id && (n.read = true));
      commit("همه اعلان‌ها خوانده شد.");
    },
    download: (el) => toast(`دانلود «${el.dataset.name}» (در نسخه نهایی فایل واقعی از سرور دریافت می‌شود)`, "info"),
    amount: (el) => {
      const input = app.querySelector("#ch-amount");
      input.value = num(Number(el.dataset.v));
      app.querySelectorAll(".amount-chips button").forEach((b) => b.classList.toggle("is-active", b === el));
    },
    unfav: (el) => {
      D().favorites[me.id] = (D().favorites[me.id] || []).filter((x) => x !== el.dataset.id);
      commit("از علاقه‌مندی‌ها حذف شد.");
    },
    "cancel-order": (el) => confirmBox("لغو سفارش", "آیا از لغو این سفارش مطمئن هستید؟", () => {
      const o = findOrder(el.dataset.id);
      setStatus(o, "cancelled");
      notifyOrder(o, `سفارش ${o.code} توسط مشتری لغو شد.`);
      commit("سفارش لغو شد.", "info");
    }, "لغو سفارش"),
    pay: (el) => {
      const o = findOrder(el.dataset.id);
      const amount = priceOf(o);
      const canWallet = (me.wallet || 0) >= amount;
      modal({
        title: `پرداخت ${o.code}`,
        body: `<p class="price">${money(amount)}</p>
          <div class="opt-cards mt-2">
            <label class="opt-card"><input type="radio" name="method" value="gateway" ${canWallet ? "" : "checked"}><span class="opt-icon">${icon("lock")}</span><b>درگاه بانکی</b><small>نسخه دمو</small></label>
            <label class="opt-card" ${canWallet ? "" : 'style="opacity:.5;pointer-events:none"'}><input type="radio" name="method" value="wallet" ${canWallet ? "checked" : ""}><span class="opt-icon">${icon("wallet")}</span><b>کیف پول</b><small>موجودی ${money(me.wallet || 0)}</small></label>
          </div>`,
        actions: [{ label: "انصراف" }, {
          label: "پرداخت", primary: true, onClick: (wrap) => {
            const method = wrap.querySelector("[name=method]:checked")?.value || "gateway";
            const u = db.user(me.id);
            if (method === "wallet") u.wallet -= amount;
            o.paid = true;
            D().transactions.unshift({ id: db.uid("t"), userId: me.id, type: "payment", amount: -amount, at: Date.now(), status: "ok", note: `پرداخت ${o.code}${method === "wallet" ? " (کیف پول)" : ""}` });
            if (o.designerId) setStatus(o, "in_progress");
            notifyOrder(o, `پیش‌فاکتور ${o.code} پرداخت شد.`);
            commit("پرداخت با موفقیت انجام شد.");
          },
        }],
      });
    },
    approve: (el) => confirmBox("تأیید نهایی", "با تأیید، سفارش تحویل‌شده محسوب می‌شود و فایل‌های نهایی در اختیار شما قرار می‌گیرد.", () => {
      const o = findOrder(el.dataset.id);
      setStatus(o, "done");
      const des = db.user(o.designerId);
      if (des) {
        const earn = Math.round(priceOf(o) * (1 - D().settings.commission / 100));
        des.wallet = (des.wallet || 0) + earn;
        D().transactions.unshift({ id: db.uid("t"), userId: des.id, type: "earning", amount: earn, at: Date.now(), status: "ok", note: `درآمد ${o.code}` });
      }
      notifyOrder(o, `سفارش ${o.code} توسط مشتری تأیید و تحویل شد 🎉`);
      db.save();
      refreshMe();
      render();
      setTimeout(() => ACT.rate(el), 300);
    }, "تأیید و تحویل"),
    rate: (el) => {
      const o = findOrder(el.dataset.id);
      modal({
        title: "به طراح امتیاز دهید",
        body: `<div class="rate">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rate" id="r${n}" value="${n}"><label for="r${n}" aria-label="${faDigits(n)} ستاره">${icon("star")}</label>`).join("")}</div>
          <textarea class="textarea mt-2" name="comment" placeholder="نظر شما درباره همکاری (اختیاری)"></textarea>`,
        actions: [{ label: "بعداً" }, {
          label: "ثبت امتیاز", primary: true, onClick: (wrap) => {
            const v = Number(wrap.querySelector("[name=rate]:checked")?.value);
            if (!v) { toast("یک امتیاز انتخاب کنید.", "bad"); return false; }
            o.rating = v;
            o.review = wrap.querySelector("[name=comment]").value;
            const des = db.user(o.designerId);
            if (des) {
              const rated = D().orders.filter((x) => x.designerId === des.id && x.rating);
              des.rating = rated.reduce((s, x) => s + x.rating, 0) / rated.length;
              db.notify(des.id, `امتیاز ${faDigits(v)} ستاره برای ${o.code} ثبت شد.`, "overview");
            }
            commit("ممنون از امتیاز شما!");
          },
        }],
      });
    },
    revise: (el) => {
      const o = findOrder(el.dataset.id);
      modal({
        title: "درخواست اصلاح",
        body: `<label class="field-label" for="rv-note">چه چیزی باید تغییر کند؟</label><textarea class="textarea mt-1" id="rv-note" placeholder="مثلاً: رنگ نارنجی کمی روشن‌تر، فونت عنوان ضخیم‌تر…"></textarea>`,
        actions: [{ label: "انصراف" }, {
          label: "ارسال برای طراح", primary: true, onClick: (wrap) => {
            const note = wrap.querySelector("#rv-note").value.trim();
            if (note.length < 5) { toast("توضیح اصلاحات را بنویسید.", "bad"); return false; }
            o.messages.push({ from: me.id, text: `درخواست اصلاح: ${note}`, at: Date.now() });
            setStatus(o, "revision", note);
            notifyOrder(o, `درخواست اصلاح برای ${o.code} ثبت شد.`);
            commit("درخواست اصلاح ارسال شد.");
          },
        }],
      });
    },
    "submit-review": (el) => {
      const o = findOrder(el.dataset.id);
      if (!(o.deliverables || []).length) return toast("ابتدا حداقل یک فایل تحویلی آپلود کنید.", "bad");
      setStatus(o, "awaiting");
      notifyOrder(o, `نسخه جدید ${o.code} آماده بررسی است.`);
      commit("برای تأیید مشتری ارسال شد.");
    },
    "mark-paid": (el) => {
      const o = findOrder(el.dataset.id);
      o.paid = true;
      if (o.designerId && ["new", "review"].includes(o.status)) setStatus(o, "in_progress");
      notifyOrder(o, `پرداخت ${o.code} توسط مدیر تأیید شد.`);
      commit("سفارش پرداخت‌شده علامت خورد.");
    },
    apply: (el) => {
      const o = findOrder(el.dataset.id);
      o.applicants = [...new Set([...(o.applicants || []), me.id])];
      db.notify("u-admin", `${me.name} برای ${o.code} اعلام آمادگی کرد.`, "orders");
      commit("آمادگی شما ثبت شد؛ پس از تأیید مدیر پروژه به شما واگذار می‌شود.");
    },
    "add-work": () => {
      const skills = (me.skills || []).map(findService).filter(Boolean);
      modal({
        title: "افزودن نمونه‌کار",
        body: `<form class="form-grid" id="work-form">
          <div class="field"><label class="field-label" for="wk-title">عنوان</label><input class="input" id="wk-title" name="title"></div>
          <div class="field"><label class="field-label" for="wk-svc">خدمت</label><select class="select" id="wk-svc" name="service">${(skills.length ? skills : BX.services).map((s) => `<option value="${s.id}">${s.title}</option>`).join("")}</select></div>
          <label class="drop">${icon("upload")}<b class="small">تصاویر نمونه‌کار</b><input type="file" multiple accept="image/*"></label>
        </form>`,
        actions: [{ label: "انصراف" }, {
          label: "افزودن", primary: true, onClick: (wrap) => {
            const f = wrap.querySelector("#work-form");
            if (f.elements.title.value.trim().length < 3) { toast("عنوان را وارد کنید.", "bad"); return false; }
            const s = findService(f.service.value);
            D().portfolio.unshift({ id: db.uid("w"), title: f.elements.title.value.trim(), category: s.category, serviceId: s.id, designerId: me.id, likes: 0, createdAt: Date.now() });
            commit("نمونه‌کار اضافه شد و در صفحه نمونه‌کارها نمایش داده می‌شود.");
          },
        }],
      });
    },
    "del-work": (el) => confirmBox("حذف نمونه‌کار", "این نمونه‌کار حذف شود؟", () => {
      D().portfolio = D().portfolio.filter((w) => w.id !== el.dataset.id);
      commit("حذف شد.", "info");
    }, "حذف"),
    "add-product": () => productForm(),
    "edit-product": (el) => productForm(D().products.find((p) => p.id === el.dataset.id)),
    "del-product": (el) => confirmBox("حذف محصول", "این محصول حذف شود؟", () => {
      D().products = D().products.filter((p) => p.id !== el.dataset.id);
      commit("محصول حذف شد.", "info");
    }, "حذف"),
    "product-status": (el) => {
      const p = D().products.find((x) => x.id === el.dataset.id);
      p.status = el.dataset.v;
      if (me.role === "admin") db.notify(p.sellerId, `وضعیت «${p.title}»: ${PRODUCT_STATUS[p.status][0]}`, "products");
      commit("وضعیت محصول به‌روز شد.");
    },
    "user-status": (el) => {
      const u = db.user(el.dataset.id);
      u.status = el.dataset.v;
      db.notify(u.id, u.status === "active" ? "حساب شما تأیید و فعال شد 🎉" : u.status === "rejected" ? "درخواست همکاری شما تأیید نشد." : "وضعیت حساب شما تغییر کرد.", "overview");
      commit(`وضعیت ${u.name}: ${USER_STATUS[u.status][0]}`);
    },
    impersonate: (el) => confirmBox("ورود به‌جای کاربر", "برای پشتیبانی وارد پنل این کاربر می‌شوید. برای بازگشت از منوی «حالت دمو» مدیر کل را انتخاب کنید.", () => {
      auth.start(el.dataset.id);
      location.hash = "";
      location.reload();
    }, "ورود"),
    "payout-paid": (el) => {
      const p = D().payouts.find((x) => x.id === el.dataset.id);
      p.status = "paid";
      D().transactions.unshift({ id: db.uid("t"), userId: p.userId, type: "payout", amount: -p.amount, at: Date.now(), status: "ok", note: "تسویه حساب" });
      db.notify(p.userId, `مبلغ ${money(p.amount)} به حساب شما واریز شد.`, "earnings");
      commit("واریز ثبت شد.");
    },
    "open-ticket": (el) => {
      const t = D().tickets.find((x) => x.id === el.dataset.id);
      modal({
        title: t.subject, wide: true,
        body: `<div class="chat" style="height:auto;max-height:60vh"><div class="chat-log">
          <div class="msg ${t.userId === me.id ? "me" : "them"}"><span class="who">${esc(t.name)}</span>${esc(t.message)}<small>${ago(t.at)}</small></div>
          ${t.replies.map((r) => `<div class="msg ${r.from === me.id ? "me" : "them"}"><span class="who">${esc(db.user(r.from)?.name || "")}</span>${esc(r.text)}<small>${ago(r.at)}</small></div>`).join("")}
          </div></div>
          ${t.status === "open" ? `<textarea class="textarea mt-2" id="tk-reply" placeholder="پاسخ…"></textarea>` : '<p class="muted small mt-2">این تیکت بسته شده است.</p>'}`,
        actions: t.status === "open" ? [
          ...(me.role === "admin" ? [{ label: "بستن تیکت", onClick: () => { t.status = "closed"; if (t.userId) db.notify(t.userId, `تیکت «${t.subject}» بسته شد.`, "tickets"); commit("تیکت بسته شد.", "info"); } }] : []),
          { label: "ارسال پاسخ", primary: true, onClick: (wrap) => {
            const text = wrap.querySelector("#tk-reply").value.trim();
            if (!text) { toast("متن پاسخ را بنویسید.", "bad"); return false; }
            t.replies.push({ from: me.id, text, at: Date.now() });
            if (me.role === "admin" && t.userId) db.notify(t.userId, `پاسخ جدید برای تیکت «${t.subject}»`, "tickets");
            if (me.role !== "admin") db.notify("u-admin", `پاسخ جدید در تیکت «${t.subject}»`, "tickets");
            commit("پاسخ ارسال شد.");
          } },
        ] : [{ label: "بستن" }],
      });
    },
    "reset-prices": () => {
      D().priceOverrides = {};
      commit("قیمت‌ها به حالت پیش‌فرض برگشت.", "info");
    },
    "reset-demo": () => confirmBox("بازنشانی داده‌ها", "همه داده‌های این مرورگر پاک شود؟ این کار قابل بازگشت نیست.", () => {
      db.reset();
      try { localStorage.removeItem("behix:cart"); localStorage.removeItem("behix:draft"); } catch (e) { /* ignore */ }
      auth.start("u-admin");
      location.hash = "";
      location.reload();
    }, "بازنشانی"),
  };

  const FORMS = {
    msg: (f) => {
      const text = f.text.value.trim();
      if (!text) return;
      const o = findOrder(f.dataset.id);
      o.messages.push({ from: me.id, text, at: Date.now() });
      notifyOrder(o, `پیام جدید در ${o.code} از ${me.name}`);
      commit();
    },
    ticket: (f) => {
      const subject = f.subject.value.trim();
      const message = f.message.value.trim();
      if (!subject || !message) return toast("موضوع و پیام را وارد کنید.", "bad");
      D().tickets.unshift({ id: db.uid("tk"), userId: me.id, name: me.name, phone: me.phone, subject, message, status: "open", at: Date.now(), replies: [] });
      db.notify("u-admin", `تیکت جدید: ${subject}`, "tickets");
      commit("تیکت ثبت شد؛ به‌زودی پاسخ می‌دهیم.");
    },
    charge: (f) => {
      const amount = parseAmount(f.amount.value);
      if (amount < 10000) return toast("مبلغ معتبر وارد کنید (حداقل ۱۰ هزار تومان).", "bad");
      const u = db.user(me.id);
      u.wallet = (u.wallet || 0) + amount;
      D().transactions.unshift({ id: db.uid("t"), userId: me.id, type: "charge", amount, at: Date.now(), status: "ok", note: "شارژ کیف پول (دمو)" });
      commit(`${money(amount)} به کیف پول اضافه شد.`);
    },
    payout: (f) => {
      const amount = parseAmount(f.amount.value);
      const s = D().settings;
      if (amount < s.minPayout) return toast(`حداقل مبلغ تسویه ${money(s.minPayout)} است.`, "bad");
      if (amount > (me.wallet || 0)) return toast("موجودی کافی نیست.", "bad");
      if (f.card.value.trim().length < 8) return toast("شماره شبا یا کارت را وارد کنید.", "bad");
      const u = db.user(me.id);
      u.wallet -= amount;
      u.card = f.card.value.trim();
      D().payouts.unshift({ id: db.uid("po"), userId: me.id, amount, status: "pending", at: Date.now(), card: u.card });
      db.notify("u-admin", `درخواست تسویه ${money(amount)} از ${me.name}`, "finance");
      commit("درخواست تسویه ثبت شد.");
    },
    profile: (f) => {
      const u = db.user(me.id);
      u.name = f.elements.name.value.trim() || u.name;
      u.email = f.email.value.trim();
      ["business", "bio", "card", "shopName"].forEach((k) => f[k] && (u[k] = f[k].value.trim()));
      if (f.querySelector("[name=skills]")) u.skills = [...f.querySelectorAll("[name=skills]:checked")].map((x) => x.value);
      commit("پروفایل ذخیره شد.");
    },
    password: (f) => {
      const u = db.user(me.id);
      if (f.old.value !== u.password) return toast("رمز فعلی اشتباه است.", "bad");
      if (f.new.value.length < 6) return toast("رمز جدید باید حداقل ۶ کاراکتر باشد.", "bad");
      u.password = f.new.value;
      commit("رمز عبور تغییر کرد.");
    },
    coupon: (f) => {
      const code = f.code.value.trim().toUpperCase().replace(/\s/g, "");
      const percent = parseAmount(f.percent.value);
      if (!/^[A-Z0-9]{3,20}$/.test(code)) return toast("کد باید ۳ تا ۲۰ حرف/عدد انگلیسی باشد.", "bad");
      if (!percent || percent > 90) return toast("درصد تخفیف بین ۱ تا ۹۰ باشد.", "bad");
      if (D().coupons.some((c) => c.code === code)) return toast("این کد قبلاً ساخته شده است.", "bad");
      D().coupons.unshift({ code, percent, uses: 0, limit: parseAmount(f.limit.value), active: true, ownerId: me.role === "admin" ? null : me.id });
      commit("کد تخفیف ساخته شد.");
    },
    quote: (f) => {
      const o = findOrder(f.dataset.id);
      const amount = parseAmount(f.amount.value);
      if (!amount) return toast("مبلغ معتبر وارد کنید.", "bad");
      o.quote = amount;
      if (o.status === "new") setStatus(o, "review");
      db.notify(o.userId, `پیش‌فاکتور ${o.code} صادر شد: ${money(amount)}`, "orders");
      commit("پیش‌فاکتور برای مشتری ارسال شد.");
    },
    assign: (f) => {
      const o = findOrder(f.dataset.id);
      const id = f.designer.value;
      if (!id) return toast("یک طراح انتخاب کنید.", "bad");
      o.designerId = id;
      if (o.paid && ["new", "review"].includes(o.status)) setStatus(o, "in_progress");
      db.notify(id, `پروژه ${o.code} به شما واگذار شد.`, "projects");
      db.notify(o.userId, `طراح سفارش ${o.code}: ${db.user(id).name}`, "orders");
      commit("طراح تخصیص یافت.");
    },
    status: (f) => {
      const o = findOrder(f.dataset.id);
      if (f.status.value === o.status) return;
      setStatus(o, f.status.value, "توسط مدیر");
      notifyOrder(o, `وضعیت ${o.code}: ${ORDER_STATUS[o.status].label}`);
      commit("وضعیت به‌روز شد.");
    },
    prices: (f) => {
      const over = {};
      BX.services.forEach((s) => {
        const v = parseAmount(f.elements[s.id].value);
        if (v && v !== s.base) over[s.id] = v;
      });
      D().priceOverrides = over;
      commit("قیمت‌ها ذخیره شد و روی سایت اعمال شد.");
    },
    settings: (f) => {
      const s = D().settings;
      s.siteName = f.siteName.value.trim();
      s.phone = enDigits(f.phone.value).trim();
      s.email = f.email.value.trim();
      s.telegram = f.telegram.value.trim();
      s.commission = Math.min(60, parseAmount(f.commission.value));
      s.minPayout = parseAmount(f.minPayout.value);
      s.maintenance = f.maintenance.checked;
      commit("تنظیمات ذخیره شد.");
    },
  };

  app.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a && ACT[a.dataset.act]) {
      e.preventDefault();
      ACT[a.dataset.act](a, e);
      return;
    }
    const row = e.target.closest("tr[data-href]");
    if (row && !e.target.closest("a, button, select, input")) location.hash = row.getAttribute("data-href");
    if (e.target.closest(".side-link[href^='#']")) ACT["side-close"]();
    if (!e.target.closest(".bell")) app.querySelector(".notif-pop")?.remove();
  });
  // Modal content lives outside #dash; route its data-act buttons too
  document.body.addEventListener("click", (e) => {
    if (app.contains(e.target)) return;
    const a = e.target.closest("[data-act]");
    if (a && ACT[a.dataset.act] && !a.closest(".modal-foot")) ACT[a.dataset.act](a, e);
  });

  app.addEventListener("submit", (e) => {
    const f = e.target.closest("form[data-form]");
    if (f && FORMS[f.dataset.form]) {
      e.preventDefault();
      FORMS[f.dataset.form](f);
    }
  });

  app.addEventListener("change", (e) => {
    const el = e.target;
    const kind = el.dataset.change;
    if (kind === "switch-user") { auth.start(el.value); location.hash = ""; location.reload(); }
    if (kind === "deliver") {
      const o = findOrder(el.dataset.id);
      o.deliverables = [...(o.deliverables || []), ...[...el.files].map((f) => ({ name: f.name, at: Date.now() }))];
      commit(`${faDigits(el.files.length)} فایل آپلود شد.`);
    }
    if (kind === "pref") {
      const u = db.user(me.id);
      u.prefs = { ...(u.prefs || { email: true, sms: true }), [el.dataset.key]: el.checked };
      db.save();
      toast("ذخیره شد.", "ok");
    }
    if (kind === "role") {
      const u = db.user(el.dataset.id);
      u.role = el.value;
      commit(`نقش ${u.name} به ${ROLE_LABEL[u.role]} تغییر کرد.`);
    }
    if (kind === "coupon-toggle") {
      const c = D().coupons.find((x) => x.code === el.dataset.code);
      c.active = el.checked;
      commit(c.active ? "کد فعال شد." : "کد غیرفعال شد.", "info");
    }
  });
  app.addEventListener("input", (e) => {
    if (e.target.dataset.change === "aorders-q") {
      segState.aordersQ = e.target.value.trim();
      const pos = e.target.selectionStart;
      render();
      const input = app.querySelector("[data-change='aorders-q']");
      input.focus();
      input.setSelectionRange(pos, pos);
    }
  });

  // Kanban drag & drop (designer)
  app.addEventListener("dragstart", (e) => {
    const card = e.target.closest("[data-drag]");
    if (!card) return;
    e.dataTransfer.setData("text/plain", card.dataset.drag);
    card.classList.add("is-dragging");
  });
  app.addEventListener("dragend", (e) => e.target.closest?.("[data-drag]")?.classList.remove("is-dragging"));
  app.addEventListener("dragover", (e) => {
    const col = e.target.closest("[data-drop-status]");
    if (!col) return;
    e.preventDefault();
    app.querySelectorAll(".kan-col.is-over").forEach((c) => c !== col && c.classList.remove("is-over"));
    col.classList.add("is-over");
  });
  app.addEventListener("drop", (e) => {
    const col = e.target.closest("[data-drop-status]");
    if (!col) return;
    e.preventDefault();
    col.classList.remove("is-over");
    const o = findOrder(e.dataTransfer.getData("text/plain"));
    const to = col.dataset.dropStatus;
    if (!o || o.status === to) return;
    if (to !== "awaiting" || !["in_progress", "revision"].includes(o.status)) return toast("فقط می‌توانید پروژه در جریان را برای تأیید مشتری ارسال کنید.", "info");
    if (!(o.deliverables || []).length) return toast("ابتدا فایل تحویلی را در صفحه پروژه آپلود کنید.", "bad");
    setStatus(o, "awaiting");
    notifyOrder(o, `نسخه جدید ${o.code} آماده بررسی است.`);
    commit("برای تأیید مشتری ارسال شد.");
  });

  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo({ top: 0 });
  });
  render();
})();
