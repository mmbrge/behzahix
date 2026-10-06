/* ==========================================================================
   BEHIX — dashboard for every role (customer · designer · seller · admin)
   Hash routing: #section/param. Data comes from api "dash" (scoped to the
   signed-in role); every action is an api "a.*" call checked on the server.
   Admin editors (catalog, users, settings) live in dashboard-admin.js.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const app = document.getElementById("dash");
  const domReady = new Promise((r) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r()));

  // Registry shared with dashboard-admin.js
  const BXD = (window.BXD = { routes: {}, acts: {}, forms: {}, changes: {} });

  let S = null; // current snapshot
  let me = null;
  const segState = {};

  Promise.all([BX.ready, domReady]).then(start).catch((err) => {
    app.innerHTML = `<div class="empty" style="margin:auto"><p>${String(err.message)}</p></div>`;
  });

  function start() {
    const { ORDER_STATUS, ORDER_FLOW, findService, findCategory, icon, toman, num, faDigits, enDigits, esc, date, ago, art, avatar, toast, modal, api } = BX;
    if (!BX.me) {
      location.replace(`auth.html?next=${encodeURIComponent(`dashboard.html${location.hash}`)}`);
      return;
    }
    const ROLE_LABEL = { customer: "مشتری", designer: "طراح", seller: "فروشنده", admin: "مدیر کل" };
    const PRODUCT_STATUS = { pending: ["در انتظار تأیید", "warn"], active: ["فعال", "ok"], hidden: ["مخفی", "info"], rejected: ["رد شده", "bad"] };
    const USER_STATUS = { active: ["فعال", "ok"], pending: ["در انتظار تأیید", "warn"], blocked: ["مسدود", "bad"], rejected: ["رد شده", "bad"] };
    const fileUrl = (id) => `api/index.php?r=file&id=${encodeURIComponent(id)}`;

    // ============================================================ data
    async function load() {
      S = await api("dash");
      me = S.me;
      BX.me = me;
    }
    // Runs a server action, then reloads the snapshot and re-renders.
    async function act(name, data = {}, files = null) {
      try {
        const r = await api(`a.${name}`, data, files);
        if (r.redirect) {
          location.href = r.redirect;
          return r;
        }
        await load();
        render();
        if (r.message) toast(r.message, "ok");
        return r;
      } catch (err) {
        toast(err.message, "bad");
        throw err;
      }
    }
    const quiet = (p) => p.catch(() => {});

    // ============================================================ UI bits
    const statusBadge = (st) => {
      const s = ORDER_STATUS[st] || { tone: "info", icon: "info", label: st };
      return `<span class="badge badge--${s.tone}">${icon(s.icon)}${s.label}</span>`;
    };
    const pill = ([label, tone]) => `<span class="badge badge--${tone}">${label}</span>`;
    const tile = (label, value, ic, sub = "") => `
      <div class="card tile"><div class="tile-top"><span class="tile-label">${label}</span><span class="tile-icon">${icon(ic)}</span></div>
      <div class="tile-value">${value}</div>${sub ? `<div class="tile-sub">${sub}</div>` : ""}</div>`;
    const box = (title, ic, body, actions = "") => `
      <section class="card box"><div class="box-head"><h2>${icon(ic)}${title}</h2>${actions ? `<div class="box-actions">${actions}</div>` : ""}</div>${body}</section>`;
    const empty = (text, ic = "inbox") => `<div class="empty">${icon(ic)}<p>${text}</p></div>`;
    const table = (cols, rows, emptyText = "موردی وجود ندارد.") =>
      rows.length
        ? `<div class="table-wrap"><table class="table"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`
        : empty(emptyText);
    const seg = (name, items, active) => `<div class="seg">${items.map(([v, l, n]) => `<button type="button" class="${v === active ? "is-active" : ""}" data-act="seg" data-seg="${name}" data-v="${v}">${l}${n != null ? `<span class="n">${faDigits(n)}</span>` : ""}</button>`).join("")}</div>`;
    const money = (n) => toman(n || 0);
    function short(n) {
      const a = Math.abs(n);
      if (a >= 1e6) return `${faDigits(String(+(a / 1e6).toFixed(1)).replace(".", "٫"))} م`;
      if (a >= 1e3) return `${faDigits(Math.round(a / 1e3))} ه`;
      return faDigits(a);
    }
    const parseAmount = (v) => Number(enDigits(String(v)).replace(/[^\d]/g, "")) || 0;
    const priceOf = (o) => (o.quote != null ? o.quote : o.estimate) || 0;
    const userById = (id) => S.users.find((u) => u.id === String(id)) || (me.id === String(id) ? me : null);
    const findOrder = (id) => S.orders.find((o) => o.id === String(id));
    const commissionPct = () => S.settings.commission?.percent ?? 20;

    function svcCell(o) {
      const s = findService(o.serviceId) || { icon: "sparkle", title: o.serviceId, category: "" };
      const c = findCategory(s.category) || { hue: 25 };
      return `<div class="cell-title" style="--h:${c.hue}"><span class="cell-icon">${icon(s.icon)}</span><span><b>${esc(o.title)}</b><small dir="auto">${esc(o.code)} · ${esc(s.title)}</small></span></div>`;
    }
    function userCell(u, sub = "") {
      return `<div class="cell-title">${avatar(u, "avatar-sm")}<span><b>${esc(u?.name || "—")}</b><small>${sub || (u?.phone ? `<span dir="ltr">${faDigits(u.phone)}</span>` : "")}</small></span></div>`;
    }
    function confirmBox(title, text, onYes, label = "تأیید") {
      modal({ title, body: `<p class="lh">${text}</p>`, actions: [{ label: "انصراف" }, { label, primary: true, onClick: onYes }] });
    }

    // ------------------------------------------------------------ charts
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
    function monthly(items, value) {
      return lastMonths().map((m) => ({ label: m.label, value: items.filter((x) => keyFmt.format(new Date(x.at)) === m.key).reduce((s, x) => s + value(x), 0) }));
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
      const cols = points.map((p, i) => {
        const cx = W - right - slot * (i + 0.5);
        const h = Math.max(p.value ? 3 : 0, (p.value / niceMax) * plotH);
        const x = cx - bw / 2, y = top + plotH - h, r = Math.min(4, h);
        const d = h ? `M${x},${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${top + plotH} H${x} Z` : "";
        return `<g class="col" data-tip-label="${p.label}" data-tip-value="${toman(p.value)}" data-x="${cx}" data-y="${y}">
          <rect class="hit" x="${cx - slot / 2}" y="${top}" width="${slot}" height="${plotH + bottom}"/>
          ${d ? `<path class="bar bar-grow" d="${d}" style="animation-delay:${i * 70}ms"/>` : ""}
          <text class="axis-label" x="${cx}" y="${H - 8}" text-anchor="middle">${p.label}</text></g>`;
      }).join("");
      const total = points.reduce((s, p) => s + p.value, 0);
      return `<div class="chart-box">
        ${total ? "" : '<p class="chart-note">هنوز داده‌ای برای این نمودار ثبت نشده است.</p>'}
        <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="نمودار ماهانه (${unit})">${grid}${cols}</svg>
        <div class="chart-tip"></div>
        <details class="mt-1 small"><summary class="muted">نمایش جدول داده</summary>${table(["ماه", "مبلغ"], points.map((p) => `<tr><td>${p.label}</td><td>${toman(p.value)}</td></tr>`))}</details>
      </div>`;
    }
    app.addEventListener("pointermove", (e) => {
      const col = e.target.closest && e.target.closest(".chart-svg .col");
      const svg = e.target.closest && e.target.closest(".chart-svg");
      document.querySelectorAll(".chart-svg.has-hover").forEach((s) => s !== svg && s.classList.remove("has-hover"));
      if (!col) {
        document.querySelectorAll(".chart-tip.is-on").forEach((t) => t.classList.remove("is-on"));
        return svg && svg.classList.remove("has-hover");
      }
      svg.classList.add("has-hover");
      const tip = svg.parentElement.querySelector(".chart-tip");
      const vb = svg.viewBox.baseVal;
      const r = svg.getBoundingClientRect();
      tip.innerHTML = `<span class="muted">${col.dataset.tipLabel}</span><b>${col.dataset.tipValue}</b>`;
      tip.style.right = `${r.width - (Number(col.dataset.x) / vb.width) * r.width}px`;
      tip.style.top = `${(Number(col.dataset.y) / vb.height) * r.height}px`;
      tip.classList.add("is-on");
    });

    // ============================================================ orders
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
      if (f.type === "number") return `${faDigits(v)} ${esc(f.suffix || "")}`;
      if (Array.isArray(v)) return v.map((x) => esc(lab(x))).join("، ");
      return esc(lab(v));
    }
    function chatBox(o) {
      const msgs = o.messages || [];
      return box("گفتگو", "chat", `
        <div class="chat">
          <div class="chat-log" data-chat>
            ${msgs.length ? msgs.map((m) => {
              const u = userById(m.from);
              const mine = m.from === me.id;
              return `<div class="msg ${mine ? "me" : "them"}">${!mine ? `<span class="who">${esc(u?.name || "پشتیبانی")}${u ? ` · ${ROLE_LABEL[u.role] || ""}` : ""}</span>` : ""}${esc(m.text)}<small>${ago(m.at)}</small></div>`;
            }).join("") : `<p class="chat-empty">${icon("chat")}<br>هنوز پیامی رد و بدل نشده است.</p>`}
          </div>
          <form class="chat-form" data-form="msg" data-id="${o.id}">
            <input class="input" name="text" placeholder="پیام خود را بنویسید…" autocomplete="off" aria-label="متن پیام">
            <button class="btn btn-primary btn-sm" type="submit" aria-label="ارسال">${icon("send")}</button>
          </form>
        </div>`);
    }
    const fileRow = (f, extra = "") => `
      <div class="deliv"><span class="cell-icon">${icon("file")}</span><div class="grow"><b dir="ltr" style="text-align:right">${esc(f.name)}</b><small class="muted">${f.size ? `${faDigits(Math.max(1, Math.round(f.size / 1024)))}KB · ` : ""}${ago(f.at)}</small></div>
      <a class="btn btn-ghost btn-xs" href="${fileUrl(f.id)}" download>${icon("download")} دانلود</a>${extra}</div>`;

    function orderDetail(id) {
      const o = findOrder(id);
      if (!o) return empty("سفارش پیدا نشد.", "search");
      const s = findService(o.serviceId) || { fields: [], title: o.serviceId, icon: "sparkle" };
      const cust = userById(o.userId);
      const des = o.designerId && userById(o.designerId);
      const role = me.role;
      const idx = o.status === "revision" ? 2 : ORDER_FLOW.indexOf(o.status);
      const flow = o.status === "cancelled"
        ? `<div class="banner banner--bad">${icon("x-circle")}<span>این سفارش لغو شده است.</span></div>`
        : `<div class="flow">${ORDER_FLOW.map((st, i) => `
            <div class="flow-step ${i < idx || o.status === "done" ? "is-done" : ""} ${i === idx && o.status !== "done" ? "is-current" : ""}">
              <span class="flow-dot">${i < idx || o.status === "done" ? icon("check") : icon(ORDER_STATUS[st].icon)}</span>${st === "in_progress" && o.status === "revision" ? "اصلاحیه" : ORDER_STATUS[st].label}
            </div>`).join("")}</div>`;
      const st = o.style || {};
      const details = [
        ...s.fields.map((f) => [esc(f.label), fieldText(f, o.details?.[f.id])]),
        ["سبک", esc((st.styles || []).join("، ")) || "—"],
        ["رنگ‌ها", st.noColors ? "به انتخاب طراح" : (st.colors || []).map((col) => `<span class="dot" style="background:${esc(col)}"></span>`).join(" ") || "—"],
        ["هویت بصری", { no: "ندارد", logo: "فقط لوگو", full: "برندبوک کامل" }[st.hasBrand] || "—"],
        ["نمونه‌های مورد علاقه", st.refs ? `<span dir="auto" style="white-space:pre-line">${esc(st.refs)}</span>` : "—"],
        ["سرعت تحویل", esc(BX.DEADLINES.find((d) => d.v === o.deadline)?.label || o.deadline)],
        ["خدمات تکمیلی", esc((o.addons || []).map((a) => BX.ADDONS.find((x) => x.v === a)?.label || a).join("، ")) || "—"],
        ["بودجه مشتری", esc(o.budget || "—")],
        ...(o.coupon ? [["کد تخفیف", `<b dir="ltr">${esc(o.coupon)}</b> (−${money(o.discount)})`]] : []),
        ...(role === "admin" && o.contact ? [["تماس مشتری", `${esc(o.contact.name || "")} · <span dir="ltr">${faDigits(o.contact.phone || "")}</span>${o.contact.email ? ` · ${esc(o.contact.email)}` : ""} (${esc({ phone: "تلفن", telegram: "تلگرام", whatsapp: "واتساپ", panel: "پنل" }[o.contact.way] || "")})`]] : []),
      ];

      let actions = "";
      if (role === "customer") {
        const due = priceOf(o) - (o.paidAmount || 0);
        if (["new", "review"].includes(o.status) && !o.paid && !o.paidAmount) {
          actions += o.status === "review"
            ? (o.deposit ? `<button class="btn btn-primary btn-block" data-act="pay" data-stage="deposit" data-id="${o.id}">${icon("wallet")} شروع با پیش‌پرداخت (${money(o.deposit)})</button>
                <button class="btn btn-ghost btn-block" data-act="pay" data-id="${o.id}">${icon("wallet")} پرداخت کامل (${money(priceOf(o))})</button>
                <p class="small muted lh">${icon("info")} با پیش‌پرداخت کار شروع می‌شود و مانده را قبل از دریافت فایل‌های نهایی پرداخت می‌کنید.</p>`
              : `<button class="btn btn-primary btn-block" data-act="pay" data-id="${o.id}">${icon("wallet")} پرداخت پیش‌فاکتور (${money(priceOf(o))})</button>`)
            : `<p class="small muted lh">${icon("clock")} کارشناس ما در حال بررسی بریف شماست؛ پیش‌فاکتور به‌زودی صادر می‌شود.</p>`;
          actions += `<button class="btn btn-ghost btn-block btn-sm" data-act="cancel-order" data-id="${o.id}">لغو سفارش</button>`;
        }
        if (!o.paid && o.paidAmount > 0 && due > 0 && o.status !== "cancelled") {
          actions += `<div class="due-box">${icon("wallet")}<span>پیش‌پرداخت: <b>${money(o.paidAmount)}</b> · مانده: <b class="brand">${money(due)}</b></span></div>
            <button class="btn ${o.status === "awaiting" ? "btn-primary" : "btn-ghost"} btn-block" data-act="pay" data-id="${o.id}">${icon("wallet")} پرداخت مانده (${money(due)})</button>`;
        }
        if (o.status === "awaiting") {
          actions += `<button class="btn btn-primary btn-block" data-act="approve" data-id="${o.id}" ${o.paid ? "" : "disabled title=\"ابتدا مانده را پرداخت کنید\""}>${icon("check-circle")} تأیید و دریافت نسخه نهایی</button>
            <button class="btn btn-ghost btn-block" data-act="revise" data-id="${o.id}">${icon("refresh")} درخواست اصلاح</button>`;
        }
        if (o.status === "done" && !o.rating) actions += `<button class="btn btn-primary btn-block" data-act="rate" data-id="${o.id}">${icon("star")} امتیاز به طراح</button>`;
        if (o.status === "done") actions += `<a class="btn btn-ghost btn-block" href="order.html?service=${encodeURIComponent(o.serviceId)}">${icon("refresh")} سفارش مجدد</a>`;
      }
      // In-person delivery: booked slot, change / pick a time
      const needDlv = s.delivery || o.delivery;
      if (needDlv && (role === "customer" || role === "admin") && o.status !== "cancelled") {
        const d = o.delivery && o.delivery.status !== "cancelled" ? o.delivery : null;
        const st = { booked: ["رزرو شده", "info"], done: ["تحویل شد", "ok"], noshow: ["عدم مراجعه", "bad"] };
        actions = `<div class="dlv-box">${icon("calendar")}<div class="grow"><small class="muted">تحویل حضوری</small><br>${d ? `<b>${esc(d.label)}</b> ${pill(st[d.status] || ["", ""])}` : '<b class="bad">زمان تحویل انتخاب نشده</b>'}</div></div>
          ${d && d.status === "booked" ? `<button class="btn btn-ghost btn-block btn-sm" data-act="dlv-change" data-id="${d.id}" data-order="${o.id}">${icon("calendar")} تغییر زمان تحویل</button>` : ""}
          ${!d ? `<button class="btn btn-primary btn-block btn-sm" data-act="dlv-pick" data-order="${o.id}">${icon("calendar")} انتخاب زمان تحویل</button>` : ""}` + actions;
      }
      if ((role === "customer" && o.quote != null) || role === "admin") {
        actions += `<a class="btn btn-ghost btn-block btn-sm" href="api/index.php?r=invoice&order=${o.id}" target="_blank" rel="noopener">${icon("file")} ${o.paid ? "فاکتور فروش" : "پیش‌فاکتور"} (چاپ / PDF)</a>`;
      }
      if (((role === "designer" && o.designerId === me.id) || role === "admin") && ["in_progress", "revision"].includes(o.status)) {
        actions += `<label class="drop" style="padding:16px">${icon("upload")}<b class="small">آپلود فایل تحویلی</b><small>حداکثر ${faDigits(S.settings.uploads?.maxMB || 50)} مگابایت</small><input type="file" multiple data-change="deliver" data-id="${o.id}"></label>
          <button class="btn btn-primary btn-block" data-act="submit-review" data-id="${o.id}">${icon("send")} ارسال برای تأیید مشتری</button>`;
      }
      if (role === "admin") {
        const candidates = S.users.filter((u) => u.role === "designer" && u.status === "active");
        const applicants = o.applicants || [];
        actions += `
          <form class="form-grid" data-form="quote" data-id="${o.id}">
            <div class="field"><label class="field-label">قیمت نهایی (پیش‌فاکتور)</label>
              <div class="row"><input class="input" name="amount" value="${num(priceOf(o))}" dir="ltr" inputmode="numeric"><button class="btn btn-primary btn-sm" type="submit">ارسال</button></div></div>
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
          <div class="row mt-2" style="flex-wrap:wrap">
            ${!o.paid ? `<button class="btn btn-ghost btn-xs" data-act="mark-paid" data-id="${o.id}">${icon("check")} پرداخت‌شده</button>` : `<button class="btn btn-ghost btn-xs" data-act="refund" data-id="${o.id}">${icon("refresh")} بازگشت وجه</button>`}
            <button class="btn btn-ghost btn-xs danger-text" data-act="delete-order" data-id="${o.id}">${icon("trash")} حذف سفارش</button>
          </div>`;
      }

      const canDelete = role === "admin" || (role === "designer" && o.designerId === me.id && ["in_progress", "revision"].includes(o.status));
      const deliverables = (o.deliverables || []).length
        ? o.deliverables.map((f) => fileRow(f, canDelete ? `<button class="icon-btn icon-btn-sm" data-act="delete-file" data-id="${f.id}" aria-label="حذف">${icon("trash")}</button>` : "")).join("")
        : empty("هنوز فایلی تحویل داده نشده است.", "folder");
      const attachments = (o.files || []).map((f) => fileRow(f)).join("");

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
            ${box("جزئیات بریف", "file", `<dl class="kv">${details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>${o.desc ? `<p class="muted small lh mt-2" style="white-space:pre-line">${esc(o.desc)}</p>` : ""}
              ${attachments ? `<h3 class="small mt-2 mb-1">پیوست‌های مشتری</h3>${attachments}` : ""}`)}
            ${box("فایل‌های تحویلی", "folder", deliverables)}
            ${chatBox(o)}
          </div>
          <div class="dash-grid" style="align-content:start">
            <section class="card box glow">
              <p class="muted small">${o.quote != null ? "مبلغ پیش‌فاکتور" : "برآورد اولیه"}</p>
              <p class="price">${money(priceOf(o))}</p>
              <p class="small mt-1">${o.paid ? `<span class="badge badge--ok">${icon("check")}پرداخت شده</span>` : o.paidAmount ? `<span class="badge badge--info">پیش‌پرداخت ${money(o.paidAmount)}</span>` : '<span class="badge badge--warn">پرداخت نشده</span>'} ${o.rating ? `<span class="stars">${icon("star")}${faDigits(o.rating)}</span>` : ""}</p>
              ${actions ? `<div class="stack mt-2">${actions}</div>` : ""}
            </section>
            ${box("افراد", "users", `
              <div class="list-row">${avatar(cust || { name: o.contact?.name })}<div class="grow"><b>${esc(cust?.name || o.contact?.name || "")}</b><br><small>مشتری${cust?.business ? ` · ${esc(cust.business)}` : ""}</small></div></div>
              <div class="list-row">${des ? `${avatar(des)}<div class="grow"><b>${esc(des.name)}</b><br><small>طراح · ${faDigits((des.rating || 0).toFixed(1))} ★</small></div>` : `<span class="avatar" style="--h:0;filter:grayscale(1)">؟</span><div class="grow"><b>هنوز طراحی تخصیص نیافته</b><br><small>پس از بررسی تعیین می‌شود</small></div>`}</div>`)}
            ${box("تاریخچه", "clock", `<ul>${(o.timeline || []).slice().reverse().map((t) => `<li class="list-row"><span class="cell-icon">${icon(ORDER_STATUS[t.status]?.icon || "info")}</span><div class="grow"><b>${ORDER_STATUS[t.status]?.label || esc(t.status)}</b>${t.note ? ` <small>(${esc(t.note)})</small>` : ""}<br><small>${date(t.at)} · ${ago(t.at)}</small></div></li>`).join("")}</ul>`)}
          </div>
        </div>`;
    }

    // ============================================================ shared views
    function notificationsView() {
      const list = S.notifications;
      return box("همه اعلان‌ها", "bell", list.length ? list.map((n) => `
        <button class="notif-item ${n.read ? "" : "is-unread"}" data-act="open-notif" data-id="${n.id}">${icon("bell")}<span><b>${esc(n.text)}</b><br><small class="muted">${ago(n.at)}</small></span></button>`).join("") : empty("اعلانی ندارید.", "bell"),
        `<button class="btn btn-ghost btn-sm" data-act="read-all">${icon("check")} خواندن همه</button>`);
    }
    const TICKET_STATUS = { open: ["باز", "warn"], answered: ["پاسخ داده شد", "info"], closed: ["بسته", "ok"] };
    function ticketsView(all = false) {
      const rows = S.tickets.map((t) => `
        <tr data-act="open-ticket" data-id="${t.id}" style="cursor:pointer">
          ${all ? `<td>${userCell(userById(t.userId) || { name: t.name, phone: t.phone, hue: 200 })}</td>` : ""}
          <td><b>${esc(t.subject)}</b><br><small class="muted">${esc(t.message.slice(0, 70))}</small></td>
          <td>${pill(TICKET_STATUS[t.status] || ["—", "info"])}</td>
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
    const TX_TYPE = { charge: "شارژ", payment: "پرداخت سفارش", purchase: "خرید فایل", earning: "درآمد پروژه", sale: "فروش فایل", payout: "تسویه", refund: "بازگشت وجه" };
    function txTable(tx, withUser = false) {
      return table([...(withUser ? ["کاربر"] : []), "شرح", "نوع", "مبلغ", "تاریخ"], tx.slice(0, 60).map((t) => `
        <tr>${withUser ? `<td>${userCell(userById(t.userId))}</td>` : ""}
          <td>${esc(t.note || "")}</td><td><span class="badge">${TX_TYPE[t.type] || esc(t.type)}</span></td>
          <td class="${t.amount < 0 ? "bad" : "ok"}" dir="ltr" style="text-align:right">${t.amount < 0 ? "−" : "+"}${num(Math.abs(t.amount))}</td>
          <td class="muted">${date(t.at)}</td></tr>`), "تراکنشی وجود ندارد.");
    }
    function payoutView() {
      const c = S.settings.commission || {};
      const eff = me.effectiveCommission ?? c.percent;
      return `
        <div class="dash-grid dash-grid-2-eq">
          <div class="dash-grid" style="align-content:start">
            <div class="wallet-card"><p class="label">موجودی قابل برداشت</p><p class="amount">${money(me.wallet)}</p>
              <p class="label mt-1">کارمزد فعلی شما: ${faDigits(eff)}٪${c.newcomerEnabled && me.commission == null ? ` · کارمزد ویژه تازه‌واردها ${faDigits(c.newcomerPercent)}٪ تا ${faDigits(c.newcomerUntil)} ${me.role === "seller" ? "فروش" : "پروژه"} اول` : ""}</p>
              <p class="label">حداقل برداشت ${money(c.minPayout)}</p></div>
            ${box("درخواست تسویه", "wallet", `
              <form class="form-grid" data-form="payout">
                <div class="field"><label class="field-label" for="po-amount">مبلغ (تومان)</label><input class="input" id="po-amount" name="amount" dir="ltr" inputmode="numeric" placeholder="${num(c.minPayout || 0)}"></div>
                <div class="field"><label class="field-label" for="po-card">شماره شبا / کارت</label><input class="input" id="po-card" name="card" dir="ltr" value="${esc(me.card || "")}" placeholder="IR…"></div>
                <button class="btn btn-primary" type="submit">${icon("send")} ثبت درخواست</button>
              </form>`)}
          </div>
          <div class="dash-grid" style="align-content:start">
            ${box("درخواست‌های تسویه", "clock", table(["مبلغ", "وضعیت", "تاریخ"], S.payouts.map((p) => `<tr><td>${money(p.amount)}</td><td>${pill({ paid: ["واریز شد", "ok"], rejected: ["رد شد", "bad"] }[p.status] || ["در صف واریز", "warn"])}</td><td class="muted">${date(p.at)}</td></tr>`), "درخواستی ثبت نشده."))}
            ${box("گردش حساب", "list", txTable(S.transactions))}
          </div>
        </div>`;
    }
    function profileView() {
      const p = me.prefs || { email: true, sms: true };
      const roleFields = {
        customer: `<div class="field"><label class="field-label" for="pf-biz">نام کسب‌وکار</label><input class="input" id="pf-biz" name="business" value="${esc(me.business || "")}"></div>`,
        designer: `<div class="field span-2"><label class="field-label" for="pf-bio">معرفی کوتاه</label><textarea class="textarea" id="pf-bio" name="bio">${esc(me.bio || "")}</textarea></div>
          <div class="field span-2"><span class="field-label">تخصص‌ها (پروژه‌های باز بر این اساس نمایش داده می‌شوند)</span><div class="chips">${BX.services.map((s) => `<label class="chip"><input type="checkbox" name="skills" value="${esc(s.id)}" ${(me.skills || []).includes(s.id) ? "checked" : ""}><span class="chip-check">${icon("check")}</span>${esc(s.title)}</label>`).join("")}</div></div>
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
              <div class="field"><label class="field-label" for="pf-phone">موبایل</label><input class="input" id="pf-phone" value="${faDigits(me.phone || "")}" dir="ltr" readonly></div>
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

    // ============================================================ customer
    const CUSTOMER = [
      { id: "overview", label: "داشبورد", icon: "home", render: customerOverview },
      { id: "orders", label: "سفارش‌های من", icon: "list", render: customerOrders, count: () => S.orders.filter((o) => o.status === "awaiting" || (o.status === "review" && !o.paid)).length },
      { id: "downloads", label: "دانلودها", icon: "download", render: customerDownloads },
      { id: "studio", label: "ساخته‌های من", icon: "sparkles", render: (p) => BXD.routes.studio(p) },
      { id: "pro", label: (BX.settings.pro?.name || "X PRO"), icon: "crown", render: (p) => BXD.routes.pro(p) },
      { id: "wallet", label: "کیف پول", icon: "wallet", render: customerWallet },
      { id: "favorites", label: "علاقه‌مندی‌ها", icon: "heart", render: customerFavorites },
      { id: "tickets", label: "پشتیبانی", icon: "ticket", render: () => ticketsView() },
      { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
      { id: "profile", label: "پروفایل و تنظیمات", icon: "settings", render: profileView },
    ];
    // Invite friends: personal link + progress (all roles)
    function referralBox() {
      const r = S.referral;
      const cfg = S.settings.referral || {};
      if (!r || !cfg.enabled) return "";
      const link = `${location.origin}${location.pathname.replace(/dashboard\.html$/, "")}?ref=${r.code}`;
      return box("دعوت از دوستان 🎁", "users", `
        <p class="small lh">لینک اختصاصی‌تان را بفرستید. وقتی دوستتان اولین خریدش (حداقل ${money(cfg.minPurchase || 0)}) را انجام داد، <b class="brand">${money(cfg.rewardInviter || 0)}</b> به کیف پول شما${cfg.rewardFriend ? ` و <b class="brand">${money(cfg.rewardFriend)}</b> به کیف پول دوستتان` : ""} اضافه می‌شود.</p>
        <div class="ref-link mt-2"><code dir="ltr">${esc(link)}</code><button class="btn btn-primary btn-sm" data-act="ref-copy" data-link="${esc(link)}">${icon("link")} کپی</button>${navigator.share ? `<button class="btn btn-ghost btn-sm" data-act="ref-share" data-link="${esc(link)}">${icon("send")} اشتراک</button>` : ""}</div>
        <div class="mini-stats mt-2"><div><b>${faDigits(r.invited)}</b><span>ثبت‌نام با لینک شما</span></div><div><b>${faDigits(r.rewarded)}</b><span>خرید انجام‌شده</span></div><div><b>${money(r.earned)}</b><span>هدیه دریافتی</span></div></div>`);
    }
    function customerOverview() {
      const mine = S.orders;
      const active = mine.filter((o) => !["done", "cancelled"].includes(o.status));
      const need = mine.filter((o) => o.status === "awaiting" || (o.status === "review" && !o.paid));
      return `
        <div class="dash-grid">
          <div class="welcome">
            <h2>سلام ${esc(me.name.split(" ")[0])} 👋</h2>
            <p>${need.length ? `${faDigits(need.length)} سفارش منتظر اقدام شماست.` : "همه چیز روبه‌راه است. پروژه بعدی را شروع کنیم؟"}</p>
            <div class="cta-actions"><a class="btn btn-primary" href="order.html">${icon("plus")} سفارش جدید</a>${S.settings.shop?.enabled !== false ? `<a class="btn btn-ghost" href="shop.html">${icon("store")} فروشگاه فایل</a>` : ""}</div>
          </div>
          <div class="tiles">
            ${tile("سفارش‌های فعال", faDigits(active.length), "loader")}
            ${tile("منتظر اقدام شما", faDigits(need.length), "eye", need.length ? "تأیید یا پرداخت" : "")}
            ${tile("موجودی کیف پول", money(me.wallet), "wallet")}
            ${tile("فایل‌های خریداری‌شده", faDigits(S.purchases.length), "download")}
          </div>
          <div class="dash-grid dash-grid-2">
            ${box("آخرین سفارش‌ها", "list", table(["سفارش", "وضعیت", "مبلغ", "زمان"], orderRows(mine.slice(0, 5)), "هنوز سفارشی ثبت نکرده‌اید."), `<a class="btn btn-ghost btn-sm" href="#orders">همه</a>`)}
            ${box("سفارش سریع", "zap", `<div class="quick-cats">${BX.CATALOG.map((c) => `<a class="quick-cat" href="services.html#${c.id}" style="--h:${c.hue}"><span class="tree-cat-icon">${icon(c.icon)}</span>${esc(c.title)}</a>`).join("")}</div>`)}
          </div>
          ${referralBox()}
        </div>`;
    }
    function customerOrders(param) {
      if (param) return orderDetail(param);
      const mine = S.orders;
      const f = segState.corders || "all";
      const groups = [["all", "همه", mine.length], ["active", "در جریان", mine.filter((o) => !["done", "cancelled"].includes(o.status)).length], ["awaiting", "منتظر تأیید", mine.filter((o) => o.status === "awaiting").length], ["done", "تحویل‌شده", mine.filter((o) => o.status === "done").length]];
      const list = mine.filter((o) => f === "all" || (f === "active" ? !["done", "cancelled"].includes(o.status) : o.status === f));
      return box("سفارش‌های من", "list", `${seg("corders", groups, f)}<div class="mt-2">${table(["سفارش", "وضعیت", "مبلغ", "زمان"], orderRows(list), "سفارشی در این دسته نیست.")}</div>`, `<a class="btn btn-primary btn-sm" href="order.html">${icon("plus")} سفارش جدید</a>`);
    }
    function customerDownloads() {
      const files = S.orders.filter((o) => ["done", "awaiting"].includes(o.status)).flatMap((o) => (o.deliverables || []).map((f) => ({ ...f, order: o })));
      return `<div class="dash-grid dash-grid-2-eq">
        ${box("فایل‌های خریداری‌شده", "store", S.purchases.length ? S.purchases.map((pu) => {
          const p = S.products.find((x) => x.id === pu.productId);
          const pf = p?.files || [];
          return `<div class="deliv deliv--col"><div class="row"><span class="mini-thumb" style="background:${art(pu.productId)}">${icon("file")}</span><div class="grow"><b>${esc(p?.title || "محصول")}</b><br><small class="muted">${date(pu.at)} · ${money(pu.price)}</small></div></div>
            <div class="row" style="flex-wrap:wrap">${pf.length ? pf.map((f) => `<a class="btn btn-ghost btn-xs" href="${fileUrl(f.id)}" download>${icon("download")} ${esc(f.name)}</a>`).join("") : '<small class="muted">فایل این محصول هنوز بارگذاری نشده است.</small>'}</div>
            <div class="row" style="flex-wrap:wrap"><a class="btn btn-ghost btn-xs" href="shop.html?product=${encodeURIComponent(pu.productId)}#review">${icon("star")} ثبت نظر و امتیاز</a><a class="btn btn-ghost btn-xs" href="api/index.php?r=invoice&purchase=${pu.id}" target="_blank" rel="noopener">${icon("file")} فاکتور</a></div></div>`;
        }).join("") : empty("هنوز خریدی نداشته‌اید.", "store"), S.settings.shop?.enabled !== false ? '<a class="btn btn-ghost btn-sm" href="shop.html">فروشگاه</a>' : "")}
        ${box("فایل‌های سفارش‌ها", "folder", files.length ? files.map((f) => fileRow(f)).join("") : empty("فایل تحویلی وجود ندارد.", "folder"))}
      </div>`;
    }
    function customerWallet() {
      return `<div class="dash-grid dash-grid-2-eq">
        <div class="dash-grid" style="align-content:start">
          <div class="wallet-card"><p class="label">موجودی کیف پول</p><p class="amount">${money(me.wallet)}</p><p class="label mt-1">پرداخت سریع سفارش‌ها و خریدها بدون درگاه</p></div>
          ${box("افزایش موجودی", "plus", `
            <form class="form-grid" data-form="charge">
              <div class="amount-chips">${[500000, 1000000, 2000000, 5000000].map((a) => `<button type="button" data-act="amount" data-v="${a}">${short(a)} تومان</button>`).join("")}</div>
              <div class="field"><label class="field-label" for="ch-amount">مبلغ دلخواه (تومان)</label><input class="input" id="ch-amount" name="amount" dir="ltr" inputmode="numeric"></div>
              <button class="btn btn-primary" type="submit">${icon("lock")} پرداخت از درگاه</button>
            </form>`)}
        </div>
        ${box("گردش حساب", "list", txTable(S.transactions))}
      </div>`;
    }
    function customerFavorites() {
      const ids = S.favorites[me.id] || [];
      const list = S.products.filter((p) => ids.includes(p.id));
      return box("علاقه‌مندی‌ها", "heart", list.length ? `<div class="grid-auto">${list.map((p) => `
        <div class="deliv"><span class="mini-thumb" style="background:${art(p.id)}">${icon("heart")}</span><div class="grow"><b>${esc(p.title)}</b><small class="muted">${money(p.price)}</small></div><button class="icon-btn icon-btn-sm" data-act="unfav" data-id="${p.id}" aria-label="حذف">${icon("trash")}</button></div>`).join("")}</div>` : empty("محصولی را نپسندیده‌اید.", "heart"), '<a class="btn btn-ghost btn-sm" href="shop.html">رفتن به فروشگاه</a>');
    }

    // ============================================================ designer
    const openJobs = () => S.orders.filter((o) => !o.designerId && ["new", "review"].includes(o.status));
    const myProjects = () => S.orders.filter((o) => o.designerId === me.id);
    const DESIGNER = [
      { id: "overview", label: "داشبورد", icon: "home", render: designerOverview },
      { id: "projects", label: "پروژه‌های من", icon: "kanban", render: designerProjects, count: () => myProjects().filter((o) => ["in_progress", "revision"].includes(o.status)).length },
      { id: "jobs", label: "پروژه‌های باز", icon: "briefcase", render: designerJobs, count: () => openJobs().filter((o) => !(o.applicants || []).includes(me.id)).length },
      { id: "portfolio", label: "نمونه‌کارهای من", icon: "image", render: designerPortfolio },
      { id: "earnings", label: "درآمد و تسویه", icon: "wallet", render: payoutView },
      { id: "pro", label: (BX.settings.pro?.name || "X PRO"), icon: "crown", render: (p) => BXD.routes.pro(p) },
      { id: "tickets", label: "پشتیبانی", icon: "ticket", render: () => ticketsView() },
      { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
      { id: "profile", label: "پروفایل حرفه‌ای", icon: "settings", render: profileView },
    ];
    function designerOverview() {
      const mine = myProjects();
      const earn = S.transactions.filter((t) => t.type === "earning");
      const todo = mine.filter((o) => ["in_progress", "revision"].includes(o.status));
      return `<div class="dash-grid">
        <div class="welcome"><h2>روز بخیر ${esc(me.name.split(" ")[0])} ✏️</h2><p>${faDigits(openJobs().length)} پروژه باز متناسب با مهارت‌های شما وجود دارد.</p>
          <div class="cta-actions"><a class="btn btn-primary" href="#jobs">${icon("briefcase")} پروژه‌های باز</a><a class="btn btn-ghost" href="#projects">${icon("kanban")} تخته پروژه‌ها</a></div></div>
        <div class="tiles">
          ${tile("پروژه‌های در جریان", faDigits(mine.filter((o) => ["in_progress", "revision", "awaiting"].includes(o.status)).length), "loader")}
          ${tile("تحویل‌شده", faDigits(mine.filter((o) => o.status === "done").length), "check-circle")}
          ${tile("امتیاز", `${faDigits((me.rating || 0).toFixed(1))} ★`, "star", esc(me.level || ""))}
          ${tile("موجودی", money(me.wallet), "wallet", `کارمزد فعلی: ${faDigits(me.effectiveCommission ?? commissionPct())}٪`)}
        </div>
        <div class="dash-grid dash-grid-2">
          ${box("درآمد ماهانه", "chart", barChart(monthly(earn, (t) => t.amount)))}
          ${box("نیازمند اقدام", "zap", todo.length ? todo.map((o) => `<a class="list-row" href="#projects/${o.id}">${svcCell(o)}<span style="margin-right:auto">${statusBadge(o.status)}</span></a>`).join("") : empty("کاری در صف نیست.", "check-circle"))}
        </div>
      </div>`;
    }
    function designerProjects(param) {
      if (param) return orderDetail(param);
      const mine = myProjects();
      const cols = [["in_progress", "در حال انجام"], ["revision", "اصلاحیه"], ["awaiting", "منتظر تأیید مشتری"], ["done", "تحویل‌شده"]];
      return box("تخته پروژه‌ها", "kanban", `
        <p class="muted small">کارت‌ها را به ستون «منتظر تأیید مشتری» بکشید تا برای مشتری ارسال شوند.</p>
        <div class="kanban mt-2">
          ${cols.map(([st, label]) => {
            const items = mine.filter((o) => o.status === st);
            return `<div class="kan-col" data-drop-status="${st}">
              <div class="kan-head"><span>${label}</span><span class="badge">${faDigits(items.length)}</span></div>
              ${items.map((o) => `<a class="kan-card" draggable="true" data-drag="${o.id}" href="#projects/${o.id}">
                <b>${esc(o.title)}</b><span class="small muted" dir="ltr" style="display:block;text-align:right">${esc(o.code)}</span>
                <div class="row-between"><span>${icon("clock")} ${ago(o.createdAt)}</span><span>${faDigits((o.deliverables || []).length)} فایل</span></div></a>`).join("") || `<p class="small muted center" style="padding:20px 0">خالی</p>`}
            </div>`;
          }).join("")}
        </div>`);
    }
    function designerJobs() {
      const jobs = openJobs();
      const share = 1 - (me.effectiveCommission ?? commissionPct()) / 100;
      return box("پروژه‌های باز مطابق مهارت شما", "briefcase", jobs.length ? `<div class="grid-auto">${jobs.map((o) => {
        const s = findService(o.serviceId) || { fields: [], category: "" };
        const applied = (o.applicants || []).includes(me.id);
        return `<article class="card job hover-lift" style="--h:${findCategory(s.category)?.hue ?? 25}">
          <div class="row-between">${svcCell(o)}</div>
          <dl class="kv small">${s.fields.slice(0, 3).map((f) => `<dt>${esc(f.label)}</dt><dd>${fieldText(f, o.details?.[f.id])}</dd>`).join("")}<dt>تحویل</dt><dd>${esc(BX.DEADLINES.find((d) => d.v === o.deadline)?.label || "")}</dd></dl>
          <div class="row-between"><span><small class="muted">سهم شما ≈</small> <b class="brand">${money(Math.round(priceOf(o) * share))}</b></span>
            ${applied ? `<span class="badge badge--ok">${icon("check")}درخواست ثبت شد</span>` : `<button class="btn btn-primary btn-sm" data-act="apply" data-id="${o.id}">${icon("send")} اعلام آمادگی</button>`}</div>
        </article>`;
      }).join("")}</div>` : empty("فعلاً پروژه بازی متناسب با مهارت‌های شما نیست. مهارت‌ها را در پروفایل به‌روز کنید.", "briefcase"));
    }
    function workCard(w, canDelete) {
      const s = findService(w.serviceId) || { icon: "image", title: "" };
      const hue = findCategory(w.category)?.hue;
      const bg = w.image ? `url('${fileUrl(w.image)}') center/cover, ${art(w.id, hue)}` : art(w.id, hue);
      return `<article class="work-card"><div class="work-thumb"><span class="bg" style="background:${bg}"></span>${w.image ? "" : `<span class="thumb-icon">${icon(s.icon)}</span>`}</div>
        <div class="work-body"><h3>${esc(w.title)}</h3><div class="work-meta"><span>${esc(s.title)} · ${icon("heart")} ${faDigits(w.likes)}</span>${canDelete ? `<button class="icon-btn icon-btn-sm" data-act="del-work" data-id="${w.id}" aria-label="حذف">${icon("trash")}</button>` : ""}</div></div></article>`;
    }
    function designerPortfolio() {
      const works = S.portfolio;
      return box("نمونه‌کارهای من", "image", works.length ? `<div class="grid-auto">${works.map((w) => workCard(w, true)).join("")}</div>` : empty("هنوز نمونه‌کاری اضافه نکرده‌اید.", "image"), `<button class="btn btn-primary btn-sm" data-act="add-work">${icon("plus")} افزودن نمونه‌کار</button>`);
    }

    // ============================================================ seller
    const SELLER = [
      { id: "overview", label: "داشبورد", icon: "home", render: sellerOverview },
      { id: "products", label: "محصولات من", icon: "box", render: () => box("محصولات من", "box", table(["محصول", "قیمت", "فروش", "وضعیت", ""], productRows(S.products), "هنوز محصولی اضافه نکرده‌اید."), `<button class="btn btn-primary btn-sm" data-act="add-product">${icon("plus")} محصول جدید</button>`) },
      { id: "sales", label: "فروش‌ها", icon: "chart", render: () => { const sales = S.transactions.filter((t) => t.type === "sale"); return `<div class="dash-grid">${box("نمودار فروش", "chart", barChart(monthly(sales, (t) => t.amount)))}${box("فروش‌های اخیر", "list", txTable(sales))}</div>`; } },
      { id: "coupons", label: "کدهای تخفیف", icon: "percent", render: () => couponsView(true) },
      { id: "earnings", label: "درآمد و تسویه", icon: "wallet", render: payoutView },
      { id: "pro", label: (BX.settings.pro?.name || "X PRO"), icon: "crown", render: (p) => BXD.routes.pro(p) },

      { id: "tickets", label: "پشتیبانی", icon: "ticket", render: () => ticketsView() },
      { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
      { id: "profile", label: "پروفایل فروشگاه", icon: "settings", render: profileView },
    ];
    function sellerOverview() {
      const prods = S.products;
      const sales = S.transactions.filter((t) => t.type === "sale");
      return `<div class="dash-grid">
        <div class="welcome"><h2>${esc(me.shopName || me.name)} 🛍️</h2><p>${prods.some((p) => p.status === "pending") ? "بعضی از محصولات شما در انتظار تأیید هستند." : "محصول جدید اضافه کنید تا فروش‌تان بیشتر شود."}</p>
          <div class="cta-actions"><button class="btn btn-primary" data-act="add-product">${icon("plus")} محصول جدید</button><a class="btn btn-ghost" href="shop.html">${icon("store")} مشاهده فروشگاه</a></div></div>
        <div class="tiles">
          ${tile("محصولات فعال", faDigits(prods.filter((p) => p.status === "active").length), "box")}
          ${tile("کل فروش (تعداد)", faDigits(prods.reduce((s, p) => s + p.sales, 0)), "cart")}
          ${tile("درآمد این ماه", money(sales.filter((t) => keyFmt.format(new Date(t.at)) === keyFmt.format(new Date())).reduce((s, t) => s + t.amount, 0)), "trend")}
          ${tile("موجودی", money(me.wallet), "wallet", `کارمزد فعلی: ${faDigits(me.effectiveCommission ?? commissionPct())}٪`)}
        </div>
        <div class="dash-grid dash-grid-2">
          ${box("درآمد ماهانه فروش", "chart", barChart(monthly(sales, (t) => t.amount)))}
          ${box("پرفروش‌ترین‌ها", "star", prods.length ? prods.slice().sort((a, b) => b.sales - a.sales).slice(0, 5).map((p) => `<div class="list-row"><span class="mini-thumb" style="background:${art(p.id)}">${icon("box")}</span><div class="grow"><b>${esc(p.title)}</b><br><small>${faDigits(p.sales)} فروش</small></div></div>`).join("") : empty("محصولی ندارید.", "box"))}
        </div>
      </div>`;
    }
    function productRows(list, admin = false) {
      return list.map((p) => {
        const c = (S.productCategories || BX.PRODUCT_CATEGORIES).find((x) => x.id === p.category);
        const seller = userById(p.sellerId);
        return `<tr>
          <td><div class="cell-title"><span class="mini-thumb" style='background:${p.image ? `url("${fileUrl(p.image)}") center/cover, ` : ""}${art(p.id)}'>${p.image ? "" : icon(c?.icon || "box")}</span><span><b>${esc(p.title)}</b><small>${esc(c?.title || "")}${admin ? ` · ${esc(seller?.shopName || seller?.name || "")}` : ""} · ${faDigits((p.files || []).length)} فایل</small></span></div></td>
          <td>${money(p.price)}${p.discount ? ` <span class="badge badge--bad">${faDigits(p.discount)}٪</span>` : ""}</td>
          <td>${faDigits(p.sales)}</td>
          <td>${pill(PRODUCT_STATUS[p.status] || ["—", "info"])}</td>
          <td><div class="actions">
            ${admin && p.status !== "active" ? `<button class="btn btn-primary btn-xs" data-act="product-status" data-id="${p.id}" data-v="active">تأیید / فعال</button>` : ""}
            ${admin && p.status === "pending" ? `<button class="btn btn-ghost btn-xs" data-act="product-status" data-id="${p.id}" data-v="rejected">رد</button>` : ""}
            ${p.status === "active" || p.status === "hidden" ? `<button class="icon-btn icon-btn-sm" data-act="product-status" data-id="${p.id}" data-v="${p.status === "active" ? "hidden" : "active"}" title="${p.status === "active" ? "مخفی کردن" : "نمایش"}" aria-label="نمایش/مخفی">${icon("eye")}</button>` : ""}
            <button class="icon-btn icon-btn-sm" data-act="edit-product" data-id="${p.id}" aria-label="ویرایش">${icon("edit")}</button>
            <button class="icon-btn icon-btn-sm" data-act="del-product" data-id="${p.id}" aria-label="حذف">${icon("trash")}</button>
          </div></td></tr>`;
      });
    }
    function couponsView(own) {
      return `<div class="dash-grid dash-grid-2">
        ${box("کدهای تخفیف", "percent", table(["کد", "تخفیف", "استفاده", "مالک", "فعال", ""], S.coupons.map((c) => `
          <tr><td><b dir="ltr">${esc(c.code)}</b></td><td>${faDigits(c.percent)}٪</td><td>${faDigits(c.uses)}${c.limit ? ` / ${faDigits(c.limit)}` : ""}</td>
          <td class="muted">${c.ownerId ? esc(userById(c.ownerId)?.shopName || userById(c.ownerId)?.name || "فروشنده") : "سراسری"}</td>
          <td><label class="switch"><input type="checkbox" data-change="coupon-toggle" data-code="${esc(c.code)}" ${c.active ? "checked" : ""}><span class="track"></span></label></td>
          <td><button class="icon-btn icon-btn-sm" data-act="del-coupon" data-code="${esc(c.code)}" aria-label="حذف">${icon("trash")}</button></td></tr>`), "کد تخفیفی ندارید."))}
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

    // ============================================================ admin (core views)
    const ADMIN = [
      { id: "overview", label: "داشبورد کل", icon: "home", render: adminOverview },
      { id: "orders", label: "سفارش‌ها", icon: "list", render: adminOrders, count: () => S.orders.filter((o) => o.status === "new").length },
      { id: "delivery", label: "تقویم تحویل", icon: "calendar", render: (p) => BXD.routes.delivery(p), count: () => S.deliveryToday || 0 },
      { id: "support", label: "پشتیبانی آنلاین", icon: "chat", render: (p) => BXD.routes.support(p), count: () => S.supportWaiting || 0 },
      { id: "users", label: "کاربران", icon: "users", render: (p) => BXD.routes.users(p), count: () => S.users.filter((u) => u.status === "pending").length },
      { id: "catalog", label: "خدمات و محصولات", icon: "tag", render: (p) => BXD.routes.catalog(p), count: () => S.products.filter((p) => p.status === "pending").length },
      { id: "finance", label: "مالی و تسویه", icon: "wallet", render: adminFinance, count: () => S.payouts.filter((p) => p.status === "pending").length },
      { id: "tickets", label: "تیکت‌ها", icon: "ticket", render: () => ticketsView(true), count: () => S.tickets.filter((t) => t.status === "open").length },
      { id: "coupons", label: "کدهای تخفیف", icon: "percent", render: () => couponsView(false) },
      { id: "studio", label: "استودیو", icon: "sparkles", render: (p) => BXD.routes.studio(p) },
      { id: "pro", label: (BX.settings.pro?.name || "X PRO"), icon: "crown", render: (p) => BXD.routes.pro(p) },
      { id: "blog", label: "وبلاگ", icon: "book", render: (p) => BXD.routes.blog(p) },
      { id: "tools", label: "ابزارها و لینک‌ها", icon: "wrench", render: (p) => BXD.routes.tools(p) },
      { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
      { id: "security", label: "امنیت", icon: "shield", render: (p) => BXD.routes.security(p) },
      { id: "settings", label: "تنظیمات سایت", icon: "settings", render: (p) => BXD.routes.settings(p) },
    ];
    function adminOverview() {
      const income = S.transactions.filter((t) => ["payment", "purchase"].includes(t.type));
      const revenue = income.reduce((s, t) => s - t.amount, 0);
      const earned = S.transactions.filter((t) => ["earning", "sale"].includes(t.type)).reduce((s, t) => s + t.amount, 0);
      const byStatus = Object.entries(ORDER_STATUS).map(([k, v]) => [v.label, S.orders.filter((o) => o.status === k).length]);
      const maxS = Math.max(1, ...byStatus.map((x) => x[1]));
      const pending = S.users.filter((u) => u.status === "pending").length + S.products.filter((p) => p.status === "pending").length;
      const demo = S.settings.general?.demoMode;
      return `<div class="dash-grid">
        ${demo ? `<div class="banner">${icon("info")}<span>سایت در <b>حالت نمایشی</b> است: ${faDigits(S.demoUsers || 0)} حساب نمونه وجود دارد و درگاه «تست» بدون پول کار می‌کند. پیش از راه‌اندازی، از <a class="brand" href="#settings/demo">تنظیمات ← داده‌های نمایشی</a> آن‌ها را حذف و درگاه واقعی را تنظیم کنید.</span></div>` : ""}
        <div class="tiles">
          ${tile("ورودی (پرداخت‌ها)", money(revenue), "trend", `سهم پلتفرم ≈ ${money(Math.max(0, revenue - earned))}`)}
          ${tile("سفارش‌ها", faDigits(S.orders.length), "list", `${faDigits(S.orders.filter((o) => o.status === "new").length)} سفارش جدید`)}
          ${tile("کاربران", faDigits(S.users.length), "users", `${faDigits(S.users.filter((u) => u.role === "designer").length)} طراح · ${faDigits(S.users.filter((u) => u.role === "seller").length)} فروشنده`)}
          ${tile("در انتظار تأیید", faDigits(pending), "shield", "طراح، فروشنده و محصول")}
        </div>
        <div class="dash-grid dash-grid-2">
          ${box("ورودی ماهانه", "chart", barChart(monthly(income, (t) => -t.amount)))}
          ${box("وضعیت سفارش‌ها", "kanban", `<ul class="hbars">${byStatus.map(([l, n]) => `<li><span>${l}</span><span class="track"><span class="fill" style="display:block;width:${(n / maxS) * 100}%"></span></span><b>${faDigits(n)}</b></li>`).join("")}</ul>`)}
        </div>
        <div class="dash-grid dash-grid-2">
          ${box("سفارش‌های جدید", "inbox", table(["سفارش", "وضعیت", "مبلغ", "زمان"], orderRows(S.orders.filter((o) => ["new", "review"].includes(o.status)).slice(0, 6)), "سفارش جدیدی نیست."), `<a class="btn btn-ghost btn-sm" href="#orders">همه سفارش‌ها</a>`)}
          ${box("فعالیت اخیر", "bell", S.notifications.slice(0, 7).map((n) => `<div class="list-row"><span class="cell-icon">${icon("bell")}</span><div class="grow">${esc(n.text)}<br><small>${ago(n.at)}</small></div></div>`).join("") || empty("فعالیتی نیست.", "bell"))}
        </div>
      </div>`;
    }
    function adminOrders(param) {
      if (param) return orderDetail(param);
      const all = S.orders;
      const f = segState.aorders || "all";
      const term = segState.aordersQ || "";
      const list = all.filter((o) => (f === "all" || o.status === f) && (!term || o.code.includes(term.toUpperCase()) || o.title.includes(term) || (userById(o.userId)?.name || "").includes(term)));
      return box("مدیریت سفارش‌ها", "list", `
        <div class="row-between">${seg("aorders", [["all", "همه", all.length], ...Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label, all.filter((o) => o.status === k).length])], f)}
          <label class="search">${icon("search")}<input class="input" data-change="aorders-q" value="${esc(term)}" placeholder="کد، عنوان یا نام مشتری"></label></div>
        <div class="mt-2">${table(["سفارش", "وضعیت", "مبلغ", "زمان", "مشتری", "طراح"], orderRows(list, (o) => `<td>${esc(userById(o.userId)?.name || "")}</td><td>${o.designerId ? esc(userById(o.designerId)?.name || "") : `<span class="badge badge--warn">تخصیص نیافته${(o.applicants || []).length ? ` · ${faDigits(o.applicants.length)} داوطلب` : ""}</span>`}</td>`))}</div>`);
    }
    function adminFinance() {
      const pending = S.payouts.filter((p) => p.status === "pending");
      const income = S.transactions.filter((t) => ["payment", "purchase"].includes(t.type)).reduce((s, t) => s - t.amount, 0);
      const owed = S.users.filter((u) => ["designer", "seller"].includes(u.role)).reduce((s, u) => s + (u.wallet || 0), 0);
      const wallets = S.users.filter((u) => u.role === "customer").reduce((s, u) => s + (u.wallet || 0), 0);
      return `<div class="dash-grid">
        <div class="tiles">
          ${tile("ورودی کل", money(income), "trend")}
          ${tile("موجودی کیف پول مشتریان", money(wallets), "wallet")}
          ${tile("بدهی به طراحان/فروشندگان", money(owed), "users")}
          ${tile("تسویه در صف", money(pending.reduce((s, p) => s + p.amount, 0)), "clock", `${faDigits(pending.length)} درخواست`)}
        </div>
        ${box("درخواست‌های تسویه", "wallet", table(["کاربر", "مبلغ", "شبا/کارت", "تاریخ", "وضعیت", ""], S.payouts.map((p) => `
          <tr><td>${userCell(userById(p.userId), ROLE_LABEL[userById(p.userId)?.role] || "")}</td><td>${money(p.amount)}</td><td dir="ltr" class="muted">${esc(p.card || "")}</td><td class="muted">${date(p.at)}</td>
          <td>${pill({ paid: ["واریز شد", "ok"], rejected: ["رد شد", "bad"] }[p.status] || ["در صف", "warn"])}</td>
          <td><div class="actions">${p.status === "pending" ? `<button class="btn btn-primary btn-xs" data-act="payout-paid" data-id="${p.id}">${icon("check")} واریز شد</button><button class="btn btn-ghost btn-xs" data-act="payout-reject" data-id="${p.id}">رد</button>` : ""}</div></td></tr>`), "درخواستی نیست."))}
        ${box("آخرین تراکنش‌ها", "list", txTable(S.transactions, true))}
      </div>`;
    }

    // ============================================================ layout
    const NAVS = { customer: CUSTOMER, designer: DESIGNER, seller: SELLER, admin: ADMIN };
    const PENDING_NAV = [
      { id: "overview", label: "وضعیت حساب", icon: "home", render: pendingOverview },
      { id: "profile", label: "پروفایل", icon: "settings", render: profileView },
      { id: "tickets", label: "پشتیبانی", icon: "ticket", render: () => ticketsView() },
      { id: "notifications", label: "اعلان‌ها", icon: "bell", render: notificationsView },
    ];
    function pendingOverview() {
      const rejected = me.status === "rejected";
      return `<div class="dash-grid">
        <div class="banner">${icon(rejected ? "x-circle" : "clock")}<span>${rejected
          ? "متأسفانه درخواست همکاری شما تأیید نشد. می‌توانید پس از تکمیل نمونه‌کار از طریق پشتیبانی دوباره درخواست دهید."
          : `درخواست همکاری شما به عنوان <b>${ROLE_LABEL[me.role]}</b> ثبت شد و در حال بررسی است. در این مدت پروفایل خود را کامل کنید.`}</span></div>
        ${box("قدم‌های بعدی", "list", `<ul>
          <li class="list-row"><span class="cell-icon">${icon("check")}</span><div class="grow">ثبت‌نام</div></li>
          <li class="list-row"><span class="cell-icon">${icon(rejected ? "x-circle" : "loader")}</span><div class="grow">بررسی ${me.role === "designer" ? "نمونه‌کار و مهارت‌ها" : "اطلاعات فروشگاه"}</div></li>
          <li class="list-row"><span class="cell-icon">${icon("zap")}</span><div class="grow">فعال شدن پنل ${ROLE_LABEL[me.role]}</div></li></ul>`)}
      </div>`;
    }
    const navFor = () => (me.role !== "customer" && me.role !== "admin" && me.status !== "active" ? PENDING_NAV : NAVS[me.role]);

    function shell() {
      const nav = navFor();
      const unread = S.notifications.filter((n) => !n.read).length;
      app.innerHTML = `
        <aside class="dash-side" id="dash-side" aria-label="منوی پنل">
          <div class="side-brand">${BX.logoHtml("a", 'aria-label="صفحه اصلی"')}<button class="icon-btn icon-btn-sm side-close" data-act="side-close" aria-label="بستن منو">${icon("cross")}</button></div>
          <div class="side-user">${avatar(me)}<div><b>${esc(me.name)}</b><span class="badge badge--brand">${ROLE_LABEL[me.role]}</span></div></div>
          <nav class="side-nav">
            <p class="side-nav-title">منو</p>
            ${nav.map((n) => {
              const c = n.count ? n.count() : n.id === "notifications" ? unread : 0;
              return `<a class="side-link" href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}${n.label}${c ? `<span class="count">${faDigits(c)}</span>` : ""}</a>`;
            }).join("")}
          </nav>
          <div class="side-foot">
            <a class="side-link" href="index.html">${icon("globe")}مشاهده سایت</a>
            <button class="side-link" data-act="logout" style="width:100%">${icon("logout")}خروج از حساب</button>
          </div>
        </aside>
        <div class="dash-main">
          ${S.impersonating ? `<div class="imp-bar">${icon("eye")}<span>در حال مشاهده پنل <b>${esc(me.name)}</b> به‌جای کاربر هستید.</span><button class="btn btn-primary btn-xs" data-act="unimpersonate">بازگشت به پنل مدیر</button></div>` : ""}
          <header class="dash-top">
            <button class="icon-btn side-toggle" data-act="side-open" aria-label="باز کردن منو">${icon("menu")}</button>
            <div class="grow"><p class="crumb">پنل ${ROLE_LABEL[me.role]}</p><h1 data-title></h1></div>
            <button type="button" class="icon-btn theme-btn" aria-label="تغییر تم">${icon("sun", "icon-sun")}${icon("moon", "icon-moon")}</button>
            <div class="bell ${unread ? "has-new" : ""}">
              <button class="icon-btn" data-act="bell" aria-label="اعلان‌ها" aria-expanded="false">${icon("bell")}</button>
              ${unread ? `<span class="dot-count">${faDigits(unread)}</span>` : ""}
            </div>
            ${me.role === "customer" ? `<a class="btn btn-primary btn-sm" href="order.html">${icon("plus")}<span class="hide-sm">سفارش جدید</span></a>` : ""}
          </header>
          <div class="dash-view" id="view"></div>
        </div>
        ${mobileTabs(nav, unread)}`;
    }

    // Phones: app-style bottom bar (first panel sections + the logo X + "more")
    function mobileTabs(nav, unread) {
      const [sec] = decodeURIComponent(location.hash.slice(1)).split("/");
      const current = (nav.find((n) => n.id === sec) || nav[0]).id;
      const picks = nav.slice(0, 3);
      const link = (n) => {
        const c = n.count ? n.count() : n.id === "notifications" ? unread : 0;
        return `<a href="#${n.id}" class="${n.id === current ? "is-active" : ""}"><span class="tb-ic">${icon(n.icon)}${c ? `<i class="tb-badge">${faDigits(c)}</i>` : ""}</span><span class="tb-l">${esc(n.label.replace(/ من$| کل$/, ""))}</span></a>`;
      };
      const fab = me.role === "customer" ? ["order.html", "سفارش"] : ["index.html", "سایت"];
      return `<nav class="tabbar dash-tabbar" aria-label="منوی سریع پنل">
        ${link(picks[0])}${picks[1] ? link(picks[1]) : ""}
        <a href="${fab[0]}" class="tb-fab"><span class="tb-x">${icon("plus")}</span><span class="tb-l">${fab[1]}</span></a>
        ${picks[2] ? link(picks[2]) : "<span></span>"}
        <button type="button" data-act="side-open" class="${picks.some((n) => n.id === current) ? "" : "is-active"}"><span class="tb-ic">${icon("menu")}</span><span class="tb-l">بیشتر</span></button>
      </nav>`;
    }

    // Label every cell with its column title so tables can become cards on phones
    function labelTables(root) {
      root.querySelectorAll("table.table").forEach((t) => {
        const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
        t.querySelectorAll("tbody tr").forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; }));
      });
    }
    BXD.labelTables = labelTables;

    function render() {
      shell();
      const nav = navFor();
      const [sec, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
      const param = rest.join("/");
      const route = nav.find((n) => n.id === sec) || nav[0];
      app.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === route.id));
      app.querySelector("[data-title]").textContent = route.label;
      document.title = `${route.label} | پنل ${BX.settings.general?.siteNameFa || "بهیکس"}`;
      const view = app.querySelector("#view");
      view.innerHTML = route.render(param);
      labelTables(view);
      const log = view.querySelector("[data-chat]");
      if (log) log.scrollTop = log.scrollHeight;
      if (BXD.afterRender) BXD.afterRender(view, route.id, param);
    }

    // ============================================================ actions
    function productForm(p = {}) {
      const cats = S.productCategories || BX.PRODUCT_CATEGORIES;
      const isAdmin = me.role === "admin";
      const sellers = isAdmin ? S.users.filter((u) => ["seller", "admin"].includes(u.role)) : [];
      modal({
        title: p.id ? "ویرایش محصول" : "محصول جدید", wide: true,
        body: `<form class="form-grid form-grid-2" id="product-form">
          <div class="field span-2"><label class="field-label" for="pd-title">عنوان محصول</label><input class="input" id="pd-title" name="title" value="${esc(p.title || "")}" required></div>
          <div class="field"><label class="field-label" for="pd-cat">دسته‌بندی</label><select class="select" id="pd-cat" name="category">${cats.map((c) => `<option value="${esc(c.id)}" ${c.id === p.category ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select></div>
          <div class="field"><label class="field-label" for="pd-tags">برچسب‌ها (با کاما)</label><input class="input" id="pd-tags" name="tags" value="${esc((p.tags || []).join("، "))}"></div>
          <div class="field"><label class="field-label" for="pd-price">قیمت (تومان)</label><input class="input" id="pd-price" name="price" dir="ltr" inputmode="numeric" value="${p.price ? num(p.price) : ""}"></div>
          <div class="field"><label class="field-label" for="pd-off">تخفیف (٪)</label><input class="input" id="pd-off" name="discount" dir="ltr" inputmode="numeric" value="${faDigits(p.discount || 0)}"></div>
          ${isAdmin ? `
            <div class="field"><label class="field-label" for="pd-seller">فروشنده</label><select class="select" id="pd-seller" name="sellerId">${sellers.map((u) => `<option value="${u.id}" ${u.id === (p.sellerId || me.id) ? "selected" : ""}>${esc(u.shopName || u.name)}${u.role === "admin" ? " (فروشگاه سایت)" : ""}</option>`).join("")}</select></div>
            <div class="field"><label class="field-label" for="pd-status">وضعیت</label><select class="select" id="pd-status" name="status">${Object.entries(PRODUCT_STATUS).map(([k, [l]]) => `<option value="${k}" ${k === (p.status || "active") ? "selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}
          <div class="field span-2"><span class="field-label">عکس کاور محصول</span>
            <div class="cover-pick">
              <span class="cover-prev" data-cover-prev style="${p.image ? `background-image:url('${fileUrl(p.image)}')` : ""}">${p.image ? "" : icon("image")}</span>
              <div class="grow"><label class="btn btn-ghost btn-sm">${icon("upload")} انتخاب عکس<input type="file" name="cover" accept="image/*" hidden></label>
              ${p.image ? `<label class="switch small mt-1"><input type="checkbox" name="removeCover"><span class="track"></span>حذف عکس فعلی</label>` : ""}
              <small class="muted d-block mt-1">JPG، PNG یا WebP — ترجیحاً ۱۲۰۰×۹۰۰. بدون عکس، طرح رنگی خودکار نمایش داده می‌شود.</small></div>
            </div></div>
          <div class="field span-2"><span class="field-label">گالری تصاویر پیش‌نمایش (تا ۸ تصویر)</span>
            <div class="gal-edit">${(p.gallery || []).map((g) => `<label class="gal-th" style="background-image:url('${fileUrl(g)}')"><input type="checkbox" name="removeGallery" value="${esc(g)}"><span>${icon("trash")}</span></label>`).join("")}
              <label class="gal-add">${icon("plus")}<small>افزودن</small><input type="file" name="gallery" accept="image/*" multiple hidden></label></div>
            <small class="muted d-block mt-1" data-gal-picked>برای حذف یک تصویر، رویش بزنید. تصاویر در صفحه محصول به‌صورت اسلاید نمایش داده می‌شوند.</small></div>
          <div class="field span-2"><label class="field-label" for="pd-desc">توضیحات</label><textarea class="textarea" id="pd-desc" name="desc">${esc(p.desc || "")}</textarea></div>
          <div class="field span-2"><span class="field-label">فایل‌های محصول</span>
            ${(p.files || []).map((f) => `<div class="deliv">${icon("file")}<div class="grow"><b dir="ltr" style="text-align:right">${esc(f.name)}</b></div><a class="btn btn-ghost btn-xs" href="${fileUrl(f.id)}">${icon("download")}</a><button type="button" class="icon-btn icon-btn-sm" data-act="delete-file" data-id="${f.id}" aria-label="حذف">${icon("trash")}</button></div>`).join("")}
            <label class="drop">${icon("upload")}<b class="small">افزودن فایل</b><small>zip، pptx، psd، aep … حداکثر ${faDigits(S.settings.uploads?.maxMB || 50)} مگابایت</small><input type="file" name="files" multiple></label>
            <div class="small muted" data-picked></div></div>
        </form>
        ${!isAdmin ? `<p class="small muted mt-2">${icon("info")} محصول پس از ذخیره برای بررسی کیفیت به مدیر ارسال می‌شود.</p>` : ""}`,
        onOpen: (wrap) => {
          const input = wrap.querySelector("input[type=file]");
          input.addEventListener("change", () => (wrap.querySelector("[data-picked]").textContent = [...input.files].map((f) => f.name).join("، ")));
          const gal = wrap.querySelector("input[name=gallery]");
          gal.addEventListener("change", () => (wrap.querySelector("[data-gal-picked]").textContent = `${faDigits(gal.files.length)} تصویر جدید انتخاب شد: ${[...gal.files].map((x) => x.name).join("، ")}`));
          const cover = wrap.querySelector("input[name=cover]");
          cover.addEventListener("change", () => {
            const prev = wrap.querySelector("[data-cover-prev]");
            if (!cover.files[0]) return;
            prev.style.backgroundImage = `url('${URL.createObjectURL(cover.files[0])}')`;
            prev.innerHTML = "";
          });
        },
        actions: [{ label: "انصراف" }, {
          label: isAdmin ? "ذخیره" : "ذخیره و ارسال برای بررسی", primary: true, onClick: (wrap) => {
            const f = wrap.querySelector("#product-form").elements;
            const data = { id: p.id || 0, title: f.title.value, category: f.category.value, tags: f.tags.value, price: f.price.value, discount: f.discount.value, desc: f.desc.value };
            if (isAdmin) Object.assign(data, { sellerId: f.sellerId.value, status: f.status.value });
            if (f.removeCover?.checked) data.removeCover = 1;
            const files = [...f.files.files];
            if (f.cover.files[0]) files.cover = f.cover.files[0];
            [...f.gallery.files].slice(0, 8).forEach((g, i) => { files["gallery" + i] = g; });
            const rm = [...wrap.querySelectorAll("input[name=removeGallery]:checked")].map((x) => x.value);
            if (rm.length) data.removeGallery = rm;
            quiet(act("product.save", data, files));
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
      logout: async () => { await BX.auth.logout(); location.href = "index.html"; },
      unimpersonate: async () => {
        try {
          await api("a.unimpersonate");
          location.hash = "users";
          location.reload();
        } catch (err) { toast(err.message, "bad"); }
      },
      seg: (el) => { segState[el.dataset.seg] = el.dataset.v; render(); },
      bell: (el) => {
        const wrap = el.parentElement;
        const open = wrap.querySelector(".notif-pop");
        if (open) { open.remove(); return el.setAttribute("aria-expanded", "false"); }
        const list = S.notifications.slice(0, 6);
        wrap.insertAdjacentHTML("beforeend", `<div class="notif-pop">${list.length ? list.map((n) => `<button class="notif-item ${n.read ? "" : "is-unread"}" data-act="open-notif" data-id="${n.id}">${icon("bell")}<span><b>${esc(n.text)}</b><br><small class="muted">${ago(n.at)}</small></span></button>`).join("") : empty("اعلانی ندارید.", "bell")}
          <div class="row-between" style="padding:8px"><button class="btn btn-ghost btn-xs" data-act="read-all">خواندن همه</button><a class="btn btn-ghost btn-xs" href="#notifications">همه اعلان‌ها</a></div></div>`);
        el.setAttribute("aria-expanded", "true");
      },
      "open-notif": async (el) => {
        const n = S.notifications.find((x) => x.id === el.dataset.id);
        await quiet(api("a.notif.read", { id: n.id }));
        n.read = true;
        if (n.link && navFor().some((x) => x.id === n.link) && location.hash !== `#${n.link}`) location.hash = n.link;
        else render();
      },
      "read-all": () => quiet(act("notif.readAll")),
      amount: (el) => {
        app.querySelector("#ch-amount").value = num(Number(el.dataset.v));
        app.querySelectorAll(".amount-chips button").forEach((b) => b.classList.toggle("is-active", b === el));
      },
      "dlv-change": (el) => BX.deliveryModal({ title: "تغییر زمان تحویل", value: (findOrder(el.dataset.order) || {}).delivery, days: me.role === "admin" ? 0 : (findOrder(el.dataset.order) || {}).readyIn || 0,
        onSave: (v) => quiet(act("booking.change", { id: el.dataset.id, date: v.date, slot: v.slot })) }),
      "dlv-pick": (el) => BX.deliveryModal({ title: "انتخاب زمان تحویل", days: me.role === "admin" ? 0 : (findOrder(el.dataset.order) || {}).readyIn || 0,
        onSave: (v) => quiet(act("booking.create", { orderId: el.dataset.order, date: v.date, slot: v.slot })) }),
      "ref-copy": (el) => navigator.clipboard?.writeText(el.dataset.link).then(() => toast("لینک دعوت کپی شد.", "ok")),
      "ref-share": (el) => navigator.share?.({ title: BX.settings.general?.siteNameFa || "بهیکس", text: "با این لینک در بهیکس ثبت‌نام کن و هدیه بگیر:", url: el.dataset.link }).catch(() => {}),
      unfav: (el) => quiet(act("fav.toggle", { productId: el.dataset.id })),
      "cancel-order": (el) => confirmBox("لغو سفارش", "آیا از لغو این سفارش مطمئن هستید؟", () => quiet(act("order.cancel", { id: el.dataset.id })), "لغو سفارش"),
      pay: (el) => {
        const o = findOrder(el.dataset.id);
        const stage = el.dataset.stage || "";
        const amount = stage === "deposit" ? o.deposit : priceOf(o) - (o.paidAmount || 0);
        const canWallet = (me.wallet || 0) >= amount;
        modal({
          title: `پرداخت ${o.code}`,
          body: `<p class="price">${money(amount)}</p>
            <div class="mt-2">${BX.payOptions(Math.max(1000, amount - Math.max(0, me.wallet || 0)), {
              wallet: { note: `موجودی ${money(me.wallet)}`, checked: canWallet, disabled: !canWallet },
              gatewayNote: me.wallet ? `${money(Math.max(0, amount - me.wallet))} از درگاه` : "پرداخت آنلاین با همه کارت‌ها",
            })}</div>`,
          actions: [{ label: "انصراف" }, { label: "پرداخت", primary: true, onClick: (wrap) => quiet(act("order.pay", { id: o.id, stage, method: wrap.querySelector("[name=method]:checked")?.value || "gateway" })) }],
        });
      },
      approve: (el) => confirmBox("تأیید نهایی", "با تأیید، سفارش تحویل‌شده محسوب می‌شود و فایل‌های نهایی در اختیار شما قرار می‌گیرد.", async () => {
        try {
          await act("order.approve", { id: el.dataset.id });
          setTimeout(() => ACT.rate(el), 300);
        } catch (e) { /* toast already shown */ }
      }, "تأیید و تحویل"),
      rate: (el) => {
        modal({
          title: "به طراح امتیاز دهید",
          body: `<div class="rate">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rate" id="r${n}" value="${n}"><label for="r${n}" aria-label="${faDigits(n)} ستاره">${icon("star")}</label>`).join("")}</div>
            <textarea class="textarea mt-2" name="comment" placeholder="نظر شما درباره همکاری (اختیاری)"></textarea>`,
          actions: [{ label: "بعداً" }, {
            label: "ثبت امتیاز", primary: true, onClick: (wrap) => {
              const v = Number(wrap.querySelector("[name=rate]:checked")?.value);
              if (!v) { toast("یک امتیاز انتخاب کنید.", "bad"); return false; }
              quiet(act("order.rate", { id: el.dataset.id, rating: v, review: wrap.querySelector("[name=comment]").value }));
            },
          }],
        });
      },
      revise: (el) => {
        modal({
          title: "درخواست اصلاح",
          body: `<label class="field-label" for="rv-note">چه چیزی باید تغییر کند؟</label><textarea class="textarea mt-1" id="rv-note" placeholder="مثلاً: رنگ نارنجی کمی روشن‌تر، فونت عنوان ضخیم‌تر…"></textarea>`,
          actions: [{ label: "انصراف" }, {
            label: "ارسال برای طراح", primary: true, onClick: (wrap) => {
              const note = wrap.querySelector("#rv-note").value.trim();
              if (note.length < 5) { toast("توضیح اصلاحات را بنویسید.", "bad"); return false; }
              quiet(act("order.revise", { id: el.dataset.id, note }));
            },
          }],
        });
      },
      "submit-review": (el) => quiet(act("order.submitReview", { id: el.dataset.id })),
      "delete-file": (el) => confirmBox("حذف فایل", "این فایل حذف شود؟", () => {
        document.querySelectorAll(".modal-wrap").forEach((m) => m.remove());
        quiet(act("file.delete", { id: el.dataset.id }));
      }, "حذف"),
      "mark-paid": (el) => quiet(act("order.markPaid", { id: el.dataset.id })),
      refund: (el) => {
        const o = findOrder(el.dataset.id);
        modal({
          title: `بازگشت وجه ${o.code}`,
          body: `<p class="small muted lh">مبلغ به کیف پول مشتری برمی‌گردد و سفارش لغو می‌شود.</p><label class="field-label mt-2" for="rf-amount">مبلغ (تومان)</label><input class="input mt-1" id="rf-amount" dir="ltr" value="${num(priceOf(o))}">`,
          actions: [{ label: "انصراف" }, { label: "بازگرداندن وجه", primary: true, onClick: (w) => quiet(act("order.refund", { id: o.id, amount: w.querySelector("#rf-amount").value })) }],
        });
      },
      "delete-order": (el) => confirmBox("حذف سفارش", "سفارش، پیام‌ها و فایل‌های آن برای همیشه حذف می‌شوند.", async () => {
        await quiet(act("order.delete", { id: el.dataset.id }));
        location.hash = "orders";
      }, "حذف"),
      apply: (el) => quiet(act("order.apply", { id: el.dataset.id })),
      "add-work": () => {
        const skills = me.role === "admin" ? BX.services : (me.skills || []).map(findService).filter(Boolean);
        modal({
          title: "افزودن نمونه‌کار",
          body: `<form class="form-grid" id="work-form">
            <div class="field"><label class="field-label" for="wk-title">عنوان</label><input class="input" id="wk-title" name="title"></div>
            <div class="field"><label class="field-label" for="wk-svc">خدمت</label><select class="select" id="wk-svc" name="service">${(skills.length ? skills : BX.services).map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join("")}</select></div>
            <label class="drop">${icon("upload")}<b class="small">تصاویر نمونه‌کار (jpg، png، webp)</b><input type="file" name="files" multiple accept="image/*"></label>
          </form>`,
          actions: [{ label: "انصراف" }, {
            label: "افزودن", primary: true, onClick: (wrap) => {
              const f = wrap.querySelector("#work-form").elements;
              if (f.title.value.trim().length < 3) { toast("عنوان را وارد کنید.", "bad"); return false; }
              quiet(act("work.add", { title: f.title.value.trim(), service: f.service.value }, [...f.files.files]));
            },
          }],
        });
      },
      "del-work": (el) => confirmBox("حذف نمونه‌کار", "این نمونه‌کار حذف شود؟", () => quiet(act("work.delete", { id: el.dataset.id })), "حذف"),
      "add-product": () => productForm(),
      "edit-product": (el) => productForm(S.products.find((p) => p.id === el.dataset.id)),
      "del-product": (el) => confirmBox("حذف محصول", "این محصول و فایل‌هایش حذف شود؟", () => quiet(act("product.delete", { id: el.dataset.id })), "حذف"),
      "product-status": (el) => quiet(act("product.status", { id: el.dataset.id, status: el.dataset.v })),
      "del-coupon": (el) => confirmBox("حذف کد تخفیف", "این کد حذف شود؟", () => quiet(act("coupon.delete", { code: el.dataset.code })), "حذف"),
      "payout-paid": (el) => quiet(act("payout.paid", { id: el.dataset.id })),
      "payout-reject": (el) => confirmBox("رد درخواست تسویه", "مبلغ به موجودی کاربر برمی‌گردد.", () => quiet(act("payout.reject", { id: el.dataset.id })), "رد درخواست"),
      "open-ticket": (el) => {
        const t = S.tickets.find((x) => x.id === el.dataset.id);
        modal({
          title: t.subject, wide: true,
          body: `<div class="chat" style="height:auto;max-height:60vh"><div class="chat-log">
            <div class="msg ${t.userId === me.id ? "me" : "them"}"><span class="who">${esc(t.name)}${me.role === "admin" && t.phone ? ` · <span dir="ltr">${faDigits(t.phone)}</span>` : ""}</span>${esc(t.message)}<small>${ago(t.at)}</small></div>
            ${t.replies.map((r) => `<div class="msg ${r.from === me.id ? "me" : "them"}"><span class="who">${esc(r.name || "")}</span>${esc(r.text)}<small>${ago(r.at)}</small></div>`).join("")}
            </div></div>
            ${t.status !== "closed" ? `<textarea class="textarea mt-2" id="tk-reply" placeholder="پاسخ…"></textarea>` : '<p class="muted small mt-2">این تیکت بسته شده است.</p>'}`,
          actions: [
            ...(me.role === "admin" ? [{ label: "حذف", onClick: () => quiet(act("ticket.delete", { id: t.id })) }] : []),
            ...(me.role === "admin" && t.status !== "closed" ? [{ label: "بستن تیکت", onClick: () => quiet(act("ticket.close", { id: t.id })) }] : []),
            ...(t.status !== "closed" ? [{ label: "ارسال پاسخ", primary: true, onClick: (wrap) => {
              const text = wrap.querySelector("#tk-reply").value.trim();
              if (!text) { toast("متن پاسخ را بنویسید.", "bad"); return false; }
              quiet(act("ticket.reply", { id: t.id, text }));
            } }] : [{ label: "بستن" }]),
          ],
        });
      },
    };

    const FORMS = {
      msg: (f) => {
        const text = f.elements.text.value.trim();
        if (text) quiet(act("order.message", { id: f.dataset.id, text }));
      },
      ticket: (f) => quiet(act("ticket.create", { subject: f.elements.subject.value, message: f.elements.message.value })),
      charge: (f) => quiet(act("wallet.charge", { amount: f.elements.amount.value })),
      payout: (f) => quiet(act("payout.request", { amount: f.elements.amount.value, card: f.elements.card.value })),
      profile: (f) => {
        const e = f.elements;
        const data = { name: e.name.value, email: e.email.value };
        ["business", "bio", "card", "shopName"].forEach((k) => e[k] && (data[k] = e[k].value));
        if (f.querySelector("[name=skills]")) data.skills = [...f.querySelectorAll("[name=skills]:checked")].map((x) => x.value);
        quiet(act("profile.save", data));
      },
      password: (f) => quiet(act("password.change", { old: f.elements.old.value, new: f.elements.new.value })),
      coupon: (f) => quiet(act("coupon.create", { code: f.elements.code.value, percent: f.elements.percent.value, limit: f.elements.limit.value })),
      quote: (f) => quiet(act("order.quote", { id: f.dataset.id, amount: f.elements.amount.value })),
      assign: (f) => {
        if (!f.elements.designer.value) return toast("یک طراح انتخاب کنید.", "bad");
        quiet(act("order.assign", { id: f.dataset.id, designerId: f.elements.designer.value }));
      },
      status: (f) => quiet(act("order.status", { id: f.dataset.id, status: f.elements.status.value })),
    };

    const CHANGES = {
      deliver: (el) => quiet(act("order.deliver", { id: el.dataset.id }, [...el.files])),
      pref: (el) => quiet(api("a.prefs.save", { key: el.dataset.key, value: el.checked }).then(() => toast("ذخیره شد.", "ok"))),
      "coupon-toggle": (el) => quiet(act("coupon.toggle", { code: el.dataset.code, active: el.checked })),
    };

    // Shared with dashboard-admin.js
    // Live getters (Object.assign would copy their current values instead)
    Object.defineProperty(BXD, "S", { get: () => S, configurable: true });
    Object.defineProperty(BXD, "me", { get: () => me, configurable: true });
    Object.assign(BXD, {
      act, quiet, render, load, productForm,
      ui: { statusBadge, pill, tile, box, empty, table, seg, money, short, parseAmount, userCell, userById, confirmBox, workCard, productRows, fileUrl, segState, ROLE_LABEL, USER_STATUS, PRODUCT_STATUS },
    });

    app.addEventListener("click", (e) => {
      const a = e.target.closest("[data-act]");
      if (a) {
        const fn = ACT[a.dataset.act] || BXD.acts[a.dataset.act];
        if (fn) {
          e.preventDefault();
          fn(a, e);
          return;
        }
      }
      const row = e.target.closest("tr[data-href]");
      if (row && !e.target.closest("a, button, select, input, label")) location.hash = row.getAttribute("data-href");
      if (e.target.closest(".side-link[href^='#']")) ACT["side-close"]();
      if (!e.target.closest(".bell")) app.querySelector(".notif-pop")?.remove();
    });
    // data-act buttons inside modals (rendered outside #dash)
    document.body.addEventListener("click", (e) => {
      if (app.contains(e.target)) return;
      const a = e.target.closest("[data-act]");
      if (!a || a.closest(".modal-foot")) return;
      const fn = ACT[a.dataset.act] || BXD.acts[a.dataset.act];
      if (fn) {
        e.preventDefault();
        fn(a, e);
      }
    });
    app.addEventListener("submit", (e) => {
      const f = e.target.closest("form[data-form]");
      if (!f) return;
      const fn = FORMS[f.dataset.form] || BXD.forms[f.dataset.form];
      if (fn) {
        e.preventDefault();
        fn(f);
      }
    });
    app.addEventListener("change", (e) => {
      const fn = CHANGES[e.target.dataset.change] || BXD.changes[e.target.dataset.change];
      if (fn) fn(e.target);
    });
    let searchTimer;
    app.addEventListener("input", (e) => {
      const kind = e.target.dataset.change;
      if (kind !== "aorders-q" && kind !== "users-q") return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        segState[kind] = e.target.value.trim();
        if (kind === "aorders-q") segState.aordersQ = segState[kind];
        render();
        const input = app.querySelector(`[data-change='${kind}']`);
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }, 250);
    });

    // Kanban drag & drop
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
      if (!o || o.status === col.dataset.dropStatus) return;
      if (col.dataset.dropStatus !== "awaiting" || !["in_progress", "revision"].includes(o.status)) return toast("فقط می‌توانید پروژه در جریان را برای تأیید مشتری ارسال کنید.", "info");
      quiet(act("order.submitReview", { id: o.id }));
    });

    window.addEventListener("hashchange", () => {
      if (!S) return; // snapshot still loading; load().then(render) picks up the new hash
      render();
      window.scrollTo({ top: 0 });
    });

    // Back from a payment gateway: ?pay=ok|fail&msg=…
    const params = new URLSearchParams(location.search);
    if (params.get("pay")) {
      toast(params.get("msg") || (params.get("pay") === "ok" ? "پرداخت انجام شد." : "پرداخت ناموفق بود."), params.get("pay") === "ok" ? "ok" : "bad");
      history.replaceState(null, "", `dashboard.html${location.hash}`);
    }

    load().then(render).catch((err) => {
      if (err.status === 401) location.replace("auth.html?next=dashboard.html");
      else app.innerHTML = `<div class="empty" style="margin:auto">${icon("info")}<p>${esc(err.message)}</p></div>`;
    });
  }
})();
