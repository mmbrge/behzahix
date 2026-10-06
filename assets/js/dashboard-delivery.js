/* ==========================================================================
   BEHIX — admin «تقویم تحویل»: Jalali month view of in-person delivery
   bookings, capacity per day/slot, and actions on each booking.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;
  const { icon, esc, faDigits } = BX;
  const DAY = 864e5;
  const WD = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]; // grid columns (RTL: Saturday first)
  const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  const STATUS = { booked: ["رزرو", "info"], done: ["تحویل شد", "ok"], cancelled: ["لغو", "bad"], noshow: ["نیامد", "warn"] };
  const fmt = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
  const jp = (t) => { const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value])); return { y: +p.year, m: +p.month, d: +p.day }; };
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const utc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const ST = { anchor: null, sel: null, data: null };

  BXD.routes.delivery = () => `<div data-dlv-admin><div class="card box skeleton" style="height:420px"></div></div>`;

  async function load(el) {
    const todayT = utc(new Date(Date.now() + 3.5 * 3600e3).toISOString().slice(0, 10)); // Tehran date
    if (ST.anchor == null) ST.anchor = todayT;
    // month bounds (Jalali)
    const a = jp(ST.anchor);
    let start = ST.anchor - (a.d - 1) * DAY;
    let end = start;
    while (jp(end + DAY).m === a.m) end += DAY;
    // grid from the Saturday on/before the 1st
    const gridStart = start - (((new Date(start).getUTCDay() + 1) % 7) * DAY);
    const gridEnd = end + ((6 - ((new Date(end).getUTCDay() + 1) % 7)) * DAY);
    ST.data = await BX.api("a.booking.list", { from: iso(gridStart), to: iso(gridEnd) });
    const d = ST.data;
    if (!ST.sel) ST.sel = d.today;
    const byDay = {};
    for (const b of d.bookings) (byDay[b.date] = byDay[b.date] || []).push(b);
    const capOf = (t) => {
      const wd = new Date(t).getUTCDay();
      if (!d.weekdays.includes(wd) || d.closed.includes(iso(t))) return 0;
      return d.slots.filter((s) => !(s.days || []).length || s.days.map(Number).includes(wd)).reduce((n, s) => n + Number(s.cap || 0), 0);
    };
    const cells = [];
    for (let t = gridStart; t <= gridEnd; t += DAY) {
      const ds = iso(t), j = jp(t), cap = capOf(t);
      const list = (byDay[ds] || []).filter((b) => b.status !== "cancelled");
      const pct = cap ? Math.min(100, Math.round((list.length / cap) * 100)) : 0;
      cells.push(`<button type="button" class="cal-cell ${j.m !== a.m ? "is-out" : ""} ${ds === d.today ? "is-today" : ""} ${ds === ST.sel ? "is-sel" : ""} ${cap ? "" : "is-off"}" data-act="dlv-day" data-d="${ds}">
        <b>${faDigits(j.d)}</b>
        ${cap ? `<span class="cal-load"><i style="width:${pct}%" class="${pct >= 100 ? "full" : pct >= 70 ? "hi" : ""}"></i></span><small>${faDigits(list.length)} از ${faDigits(cap)}</small>` : `<small>${d.closed.includes(ds) ? "تعطیل" : "—"}</small>`}
      </button>`);
    }
    const monthBookings = d.bookings.filter((b) => b.date >= iso(start) && b.date <= iso(end) && b.status !== "cancelled").length;
    el.innerHTML = `<div class="dash-grid">
      ${d.enabled ? "" : `<div class="banner">${icon("info")}<span>تحویل حضوری خاموش است. از <a class="brand" href="#settings/delivery">تنظیمات ← تحویل حضوری</a> روشن کنید و در ویرایش هر خدمت گزینه «تحویل حضوری» را بزنید.</span></div>`}
      <div class="cal-wrap">
        <section class="card box cal">
          <div class="cal-head">
            <button class="icon-btn icon-btn-sm" data-act="dlv-month" data-dir="-1" aria-label="ماه قبل">${icon("arrow-right")}</button>
            <h2>${MONTHS[a.m - 1]} ${faDigits(a.y)}</h2>
            <button class="icon-btn icon-btn-sm" data-act="dlv-month" data-dir="1" aria-label="ماه بعد">${icon("arrow")}</button>
            <span class="grow"></span><span class="muted small">${faDigits(monthBookings)} نوبت در این ماه</span>
            <button class="btn btn-ghost btn-xs" data-act="dlv-today">امروز</button><a class="btn btn-ghost btn-xs" href="#settings/delivery">${icon("settings")} بازه‌ها و ظرفیت</a>
          </div>
          <div class="cal-grid">${WD.map((w) => `<span class="cal-wd">${w}</span>`).join("")}${cells.join("")}</div>
        </section>
        <section class="card box cal-day" data-day-panel>${dayPanel(ST.sel, byDay[ST.sel] || [])}</section>
      </div>
    </div>`;
  }

  function dayPanel(ds, list) {
    const d = ST.data;
    const t = utc(ds), j = jp(t), wd = new Date(t).getUTCDay();
    const slots = d.slots.filter((s) => !(s.days || []).length || s.days.map(Number).includes(wd));
    const open = d.weekdays.includes(wd) && !d.closed.includes(ds);
    const inSlot = (id) => list.filter((b) => b.slot === id);
    const orphan = list.filter((b) => !slots.some((s) => s.id === b.slot));
    const row = (b) => `<div class="cal-bk ${b.status}">
      <div class="grow"><b>${esc(b.name)}</b> <a href="tel:${esc(b.phone)}" dir="ltr" class="muted small">${faDigits(b.phone)}</a><br>
        <a class="brand small" href="#orders/${b.orderId}">${esc(b.code)}</a> <small class="muted">${esc(b.title)}</small></div>
      <span class="badge badge--${STATUS[b.status][1]}">${STATUS[b.status][0]}</span>
      <div class="actions">${b.status === "booked" ? `<button class="btn btn-primary btn-xs" data-act="bk-status" data-id="${b.id}" data-s="done">${icon("check")} تحویل شد</button><button class="btn btn-ghost btn-xs" data-act="bk-move" data-id="${b.id}">جابه‌جایی</button><button class="btn btn-ghost btn-xs" data-act="bk-status" data-id="${b.id}" data-s="noshow">نیامد</button><button class="icon-btn icon-btn-sm" data-act="bk-status" data-id="${b.id}" data-s="cancelled" aria-label="لغو">${icon("cross")}</button>`
        : `<button class="btn btn-ghost btn-xs" data-act="bk-status" data-id="${b.id}" data-s="booked">بازگردانی</button>`}</div></div>`;
    return `<div class="box-head"><h2>${icon("calendar")}${WD[(wd + 1) % 7]} ${faDigits(j.d)} ${MONTHS[j.m - 1]}</h2><span class="muted small">${open ? `${faDigits(list.filter((b) => b.status !== "cancelled").length)} نوبت` : "روز تعطیل"}</span></div>
      ${slots.length && open ? slots.map((s) => {
        const bs = inSlot(s.id);
        const used = bs.filter((b) => b.status !== "cancelled").length;
        return `<div class="cal-slot"><div class="row-between"><b>${icon("clock")} ${esc(s.label)} <small class="muted">${faDigits(`${s.from || ""} تا ${s.to || ""}`)}</small></b><span class="badge ${used >= s.cap ? "badge--bad" : "badge--ok"}">${faDigits(used)} از ${faDigits(s.cap)}</span></div>
          ${bs.length ? bs.map(row).join("") : '<p class="muted small">نوبتی ثبت نشده.</p>'}</div>`;
      }).join("") : '<p class="muted small">در این روز تحویل انجام نمی‌شود.</p>'}
      ${orphan.length ? `<div class="cal-slot"><b class="small">بازه‌های حذف‌شده</b>${orphan.map(row).join("")}</div>` : ""}`;
  }

  const el = () => document.querySelector("[data-dlv-admin]");
  const reload = () => load(el()).catch((e) => BX.toast(e.message, "bad"));
  const prevAfter = BXD.afterRender;
  BXD.afterRender = (view, id, param) => {
    if (prevAfter) prevAfter(view, id, param);
    const box = view.querySelector("[data-dlv-admin]");
    if (box) load(box).catch((e) => { box.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(e.message)}</p></div>`; });
  };
  Object.assign(BXD.acts, {
    "dlv-day": (b) => {
      ST.sel = b.dataset.d;
      document.querySelectorAll(".cal-cell.is-sel").forEach((x) => x.classList.remove("is-sel"));
      b.classList.add("is-sel");
      const list = ST.data.bookings.filter((x) => x.date === ST.sel);
      const p = document.querySelector("[data-day-panel]");
      p.innerHTML = dayPanel(ST.sel, list);
      if (window.matchMedia("(max-width: 900px)").matches) p.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    "dlv-month": (b) => {
      const a = jp(ST.anchor);
      // jump to the 15th of the previous / next Jalali month
      let t = ST.anchor - (a.d - 15) * DAY + Number(b.dataset.dir) * 30 * DAY;
      ST.anchor = t;
      reload();
    },
    "dlv-today": () => { ST.anchor = null; ST.sel = null; reload(); },
    "bk-status": (b) => {
      const go = () => BX.api("a.booking.status", { id: b.dataset.id, status: b.dataset.s }).then((r) => { BX.toast(r.message, "ok"); reload(); }).catch((e) => BX.toast(e.message, "bad"));
      b.dataset.s === "cancelled" ? BXD.ui.confirmBox("لغو نوبت", "نوبت لغو و ظرفیتش آزاد می‌شود و به مشتری اعلان داده می‌شود.", go, "لغو نوبت") : go();
    },
    "bk-move": (b) => {
      const bk = ST.data.bookings.find((x) => String(x.id) === b.dataset.id);
      BX.deliveryModal({ title: `جابه‌جایی نوبت ${bk ? bk.code : ""}`, value: bk, onSave: (v) => BX.api("a.booking.change", { id: b.dataset.id, date: v.date, slot: v.slot }).then((r) => { BX.toast(r.message, "ok"); reload(); }).catch((e) => BX.toast(e.message, "bad")) });
    },
  });
})();
