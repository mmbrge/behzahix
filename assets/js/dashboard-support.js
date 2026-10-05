/* ==========================================================================
   BEHIX — admin «پشتیبانی آنلاین»: archive of every bot / live conversation,
   live replies with emoji, quick replies, edit & delete (admin only).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;
  const { icon, esc, faDigits, ago } = BX;
  const EMOJI = "😀 😂 😍 😊 😉 🤔 😅 🙏 👍 👌 👏 💪 🤝 ❤️ 🌹 🔥 ✨ 🎉 🎁 ✅ ❌ ⚡ 💡 📌 📞 💬 ⏰ 💳 📦 🎨 🚀 😎".split(" ");
  const ST = { filter: "all", q: "", page: 0, data: null, chat: null, msgs: [], lastId: 0, rev: 0, timer: 0, editing: 0 };
  const STATUS = { bot: ["ربات", "info"], waiting: ["منتظر پاسخ", "warn"], live: ["در گفتگو", "ok"], closed: ["بسته", ""] };
  const FROM = { user: "کاربر", bot: "ربات", admin: "شما", system: "" };
  const DEVICE = { mobile: "موبایل", desktop: "دسکتاپ", tablet: "تبلت" };
  const PAGE = { home: "صفحه اصلی", services: "خدمات", order: "ثبت سفارش", shop: "فروشگاه", portfolio: "نمونه‌کارها", designers: "طراحان", about: "درباره ما", terms: "قوانین", tools: "ابزارها" };

  BXD.routes.support = function (param) {
    return `<div class="sp-wrap ${param ? "has-chat" : ""}" data-support-admin="${esc(param || "")}">
      <div class="sp-side card"><div class="skeleton" style="height:100%"></div></div>
      <div class="sp-main card">${param ? '<div class="skeleton" style="height:100%"></div>' : placeholder()}</div>
    </div>`;
  };
  function placeholder() {
    return `<div class="sp-empty">${icon("chat")}<b>یک گفتگو را انتخاب کنید</b><p class="muted small">همه گفتگوهای ربات و پشتیبانی این‌جا بایگانی می‌شود. گفتگوهای «منتظر پاسخ» بالای لیست هستند.</p></div>`;
  }

  // ------------------------------------------------------------------ list
  async function loadList(wrap) {
    const side = wrap.querySelector(".sp-side");
    try {
      ST.data = await BX.api("a.chat.list", { filter: ST.filter, q: ST.q, page: ST.page });
    } catch (e) { side.innerHTML = `<p class="muted pad">${esc(e.message)}</p>`; return; }
    paintList(wrap);
  }
  function paintList(wrap) {
    const side = wrap.querySelector(".sp-side");
    const d = ST.data;
    const cur = Number(wrap.dataset.supportAdmin) || 0;
    const s = d.stats;
    side.innerHTML = `
      <div class="sp-stats">
        <div><b>${faDigits(s.open)}</b><small>باز</small></div>
        <div><b>${faDigits(s.today)}</b><small>امروز</small></div>
        <div><b>${faDigits(s.total)}</b><small>کل گفتگو</small></div>
        <div title="گفتگوهایی که بدون نیاز به پشتیبان تمام شد"><b>${faDigits(s.botRate)}٪</b><small>حل با ربات</small></div>
      </div>
      <div class="sp-filter">
        <div class="seg seg-sm">${[["all", "همه"], ["open", "باز"], ["human", "با پشتیبان"], ["bot", "فقط ربات"], ["closed", "بسته"]].map(([k, l]) => `<button type="button" class="${ST.filter === k ? "is-active" : ""}" data-act="sp-filter" data-f="${k}">${l}</button>`).join("")}</div>
        <form data-sp-search class="search">${icon("search")}<input class="input" name="q" value="${esc(ST.q)}" placeholder="نام، شماره یا متن پیام…"></form>
      </div>
      <div class="sp-list">${d.chats.map((c) => `
        <a class="sp-item ${c.id === cur ? "is-active" : ""} ${c.unread ? "is-unread" : ""}" href="#support/${c.id}">
          <span class="sp-ava ${c.escalated ? "is-human" : ""}">${icon(c.escalated ? "user" : "ai")}</span>
          <span class="sp-it"><span class="sp-row"><b>${esc(c.name)}</b><small>${ago(c.updatedAt)}</small></span>
            <span class="sp-row"><span class="sp-last">${c.last ? (c.last.from === "admin" ? "شما: " : c.last.from === "bot" ? "🤖 " : "") + esc(c.last.text) : ""}</span>
            ${c.unread ? `<i class="sp-dot">${faDigits(c.unread)}</i>` : `<span class="badge badge--${STATUS[c.status][1]}">${STATUS[c.status][0]}</span>`}</span></span>
        </a>`).join("") || `<p class="muted small pad">گفتگویی پیدا نشد.</p>`}
        ${d.more ? `<button type="button" class="btn btn-ghost btn-sm sp-more" data-act="sp-more">${icon("refresh")} قدیمی‌ترها</button>` : ""}
      </div>
      ${d.missed.length ? `<details class="sp-missed"><summary>${icon("info")} سؤال‌های بی‌پاسخ ربات (${faDigits(d.missed.length)})</summary>
        <p class="muted small">برای هر سؤال یک پاسخ اختصاصی بنویسید تا ربات دفعه بعد جواب بدهد.</p>
        ${d.missed.map((m) => `<div class="sp-miss"><span>${esc(m.text)}</span><div class="actions"><button type="button" class="btn btn-ghost btn-xs" data-act="sp-faq" data-text="${esc(m.text)}">${icon("plus")} پاسخ</button><a class="icon-btn icon-btn-sm" href="#support/${m.chatId}" aria-label="گفتگو">${icon("eye")}</a></div></div>`).join("")}
      </details>` : ""}`;
    side.querySelector("[data-sp-search]").addEventListener("submit", (e) => { e.preventDefault(); ST.q = e.target.elements.q.value.trim(); ST.page = 0; loadList(wrap); });
    setNavCount(s.waiting);
  }

  // ------------------------------------------------------------------ conversation
  async function loadChat(wrap, id) {
    const main = wrap.querySelector(".sp-main");
    try {
      const r = await BX.api("a.chat.get", { id });
      ST.chat = r.chat; ST.user = r.user; ST.msgs = r.messages; ST.rev = r.chat.rev;
      ST.lastId = ST.msgs.reduce((a, m) => Math.max(a, m.id), 0);
    } catch (e) { main.innerHTML = `<div class="sp-empty">${icon("info")}<b>${esc(e.message)}</b></div>`; return; }
    const c = ST.chat, u = ST.user;
    const replies = ST.data?.quickReplies || [];
    main.innerHTML = `
      <header class="sp-head">
        <a class="icon-btn icon-btn-sm sp-back" href="#support" aria-label="بازگشت">${icon("arrow-right")}</a>
        <span class="sp-ava ${c.escalated ? "is-human" : ""}">${icon(c.escalated ? "user" : "ai")}</span>
        <div class="grow"><b>${esc(c.name)}</b> <span class="badge badge--${STATUS[c.status][1]}" data-sp-status>${STATUS[c.status][0]}</span>
          <small class="muted d-block">${c.phone ? `<a href="tel:${esc(c.phone)}" dir="ltr">${esc(c.phone)}</a> · ` : ""}${DEVICE[c.device] || ""}${c.page ? ` · از ${esc(PAGE[c.page] || c.page)}` : ""} · ${BX.date(c.createdAt)}</small></div>
        <div class="actions">
          ${c.phone ? `<a class="btn btn-ghost btn-xs" href="https://wa.me/${esc(c.phone.replace(/^0/, "98"))}" target="_blank" rel="noopener">${icon("whatsapp")}</a>` : ""}
          <button type="button" class="btn btn-ghost btn-xs" data-act="sp-close" data-id="${c.id}">${c.status === "closed" ? `${icon("refresh")} بازکردن` : `${icon("check")} بستن`}</button>
          <button type="button" class="icon-btn icon-btn-sm" data-act="sp-remove" data-id="${c.id}" aria-label="حذف گفتگو">${icon("trash")}</button>
        </div>
      </header>
      ${u ? `<div class="sp-user">${icon("user")}<span><b>${esc(u.name)}</b> · ${esc({ customer: "مشتری", designer: "طراح", seller: "فروشنده", admin: "مدیر" }[u.role] || u.role)} · کیف پول ${BX.toman(u.wallet)}</span>
        ${u.orders.map((o) => `<a class="chip" href="#orders/${o.id}">${esc(o.code)} · ${esc((BX.ORDER_STATUS?.[o.status] || {}).label || o.status)}</a>`).join("")}</div>` : ""}
      <div class="sp-log" data-sp-log></div>
      ${replies.length ? `<div class="sp-quick">${replies.map((t) => `<button type="button" class="chip" data-act="sp-quick" data-text="${esc(t)}">${esc(t.length > 40 ? t.slice(0, 38) + "…" : t)}</button>`).join("")}</div>` : ""}
      <form class="sp-compose" data-sp-compose>
        <button type="button" class="icon-btn icon-btn-sm" data-act="sp-emoji" aria-label="ایموجی">${icon("smile")}</button>
        <textarea class="input" name="text" rows="1" placeholder="پاسخ خود را بنویسید…" title="Enter ارسال · Shift+Enter خط جدید"></textarea>
        <button class="btn btn-primary btn-sm" type="submit">${icon("send")} ارسال</button>
        <div class="sp-emoji" hidden>${EMOJI.map((e) => `<button type="button" data-act="sp-emo" data-e="${e}">${e}</button>`).join("")}</div>
      </form>`;
    paintMsgs(main);
    const form = main.querySelector("[data-sp-compose]");
    form.addEventListener("submit", (e) => { e.preventDefault(); sendReply(main); });
    form.elements.text.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(main); } });
    if (window.matchMedia("(pointer:fine)").matches) form.elements.text.focus();
    // the list's unread dot for this chat is gone now
    const it = wrap.querySelector(`.sp-item[href="#support/${id}"]`);
    if (it) { it.classList.remove("is-unread"); it.querySelector(".sp-dot")?.remove(); }
  }
  function paintMsgs(main) {
    const log = main.querySelector("[data-sp-log]");
    if (!log) return;
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    log.innerHTML = ST.msgs.map((m) => {
      if (m.from === "system") return `<div class="sp-sys">${esc(m.text)} · ${ago(m.at)}</div>`;
      const mine = m.from === "admin";
      const body = m.deleted ? `<i class="muted">🚫 پیام حذف شد</i>` : esc(m.text).replace(/\n/g, "<br>");
      const links = !m.deleted && (m.links || []).length ? `<div class="sp-mlinks">${m.links.map(([l]) => `<span>${esc(l)}</span>`).join("")}</div>` : "";
      return `<div class="sp-msg is-${m.from} ${mine ? "is-mine" : ""}" data-mid="${m.id}">
        <div class="sp-bubble">${ST.editing === m.id
          ? `<form data-sp-edit="${m.id}"><textarea class="input" name="text" rows="3">${esc(m.text)}</textarea><div class="actions mt-1"><button class="btn btn-primary btn-xs" type="submit">ذخیره</button><button class="btn btn-ghost btn-xs" type="button" data-act="sp-edit-cancel">انصراف</button></div></form>`
          : body + links}</div>
        <div class="sp-meta"><small>${FROM[m.from]} · ${new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(m.at))}${m.edited && !m.deleted ? " · ویرایش شده" : ""}</small>
          ${m.deleted ? "" : `<span class="sp-tools">${mine ? `<button type="button" data-act="sp-edit" data-id="${m.id}" aria-label="ویرایش">${icon("edit")}</button>` : ""}<button type="button" data-act="sp-del" data-id="${m.id}" aria-label="حذف">${icon("trash")}</button></span>`}</div>
      </div>`;
    }).join("");
    if (atEnd || !log.dataset.ready) log.scrollTop = log.scrollHeight;
    log.dataset.ready = "1";
    main.querySelector(`[data-sp-edit]`)?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await BX.api("a.chat.edit", { id: ST.editing, text: e.target.elements.text.value });
        const m = ST.msgs.find((x) => x.id === ST.editing);
        if (m) { m.text = e.target.elements.text.value.trim(); m.edited = true; }
        ST.editing = 0; ST.rev++; paintMsgs(main);
      } catch (err) { BX.toast(err.message, "bad"); }
    });
  }
  async function sendReply(main) {
    const ta = main.querySelector("[data-sp-compose] textarea");
    const text = ta.value.trim();
    if (!text) return;
    ta.value = "";
    try {
      const r = await BX.api("a.chat.send", { id: ST.chat.id, text, after: ST.lastId });
      merge(r.messages);
      ST.chat.status = "live";
      const b = main.querySelector("[data-sp-status]"); if (b) { b.className = "badge badge--ok"; b.textContent = STATUS.live[0]; }
      paintMsgs(main);
      main.querySelector("[data-sp-log]").scrollTop = 1e9;
    } catch (e) { ta.value = text; BX.toast(e.message, "bad"); }
  }
  function merge(list) {
    for (const m of list || []) { const i = ST.msgs.findIndex((x) => x.id === m.id); i >= 0 ? (ST.msgs[i] = m) : ST.msgs.push(m); }
    ST.lastId = ST.msgs.reduce((a, m) => Math.max(a, m.id), 0);
  }

  // ------------------------------------------------------------------ polling
  function wrapEl() { return document.querySelector("[data-support-admin]"); }
  async function tick() {
    const wrap = wrapEl();
    const id = wrap ? Number(wrap.dataset.supportAdmin) || 0 : 0;
    try {
      const r = await BX.api("a.chat.poll", { id, after: ST.lastId, rev: ST.rev });
      if (r.waiting > (BXD.S.supportWaiting || 0) && !wrap) BX.toast("💬 پیام جدید در پشتیبانی آنلاین", "ok");
      setNavCount(r.waiting);
      if (wrap && id && r.chat && ST.chat && ST.chat.id === id && !ST.editing) {
        if (r.full) { ST.msgs = r.messages; ST.rev = r.chat.rev; ST.lastId = ST.msgs.reduce((a, m) => Math.max(a, m.id), 0); }
        else merge(r.messages);
        if ((r.messages || []).length || r.full) paintMsgs(wrap.querySelector(".sp-main"));
      }
      if (wrap && ST.data && Date.now() - (ST.listAt || 0) > 12000) { ST.listAt = Date.now(); await loadList(wrap); }
    } catch (e) { /* retry */ }
    clearTimeout(ST.timer);
    ST.timer = setTimeout(tick, wrapEl() ? 3500 : 25000);
  }
  function setNavCount(n) {
    BXD.S.supportWaiting = n;
    document.querySelectorAll('[data-nav="support"]').forEach((a) => {
      let c = a.querySelector(".count");
      if (!n) { c?.remove(); return; }
      if (!c) { c = document.createElement("span"); c.className = "count"; a.appendChild(c); }
      c.textContent = faDigits(n);
    });
  }

  const prevAfter = BXD.afterRender;
  BXD.afterRender = (view, id, param) => {
    if (prevAfter) prevAfter(view, id, param);
    if (BXD.me?.role === "admin" && !ST.started) { ST.started = true; ST.timer = setTimeout(tick, 25000); }
    const wrap = view.querySelector("[data-support-admin]");
    if (!wrap) return;
    ST.editing = 0;
    ST.listAt = Date.now();
    loadList(wrap);
    if (param) loadChat(wrap, Number(param));
    else ST.chat = null;
    clearTimeout(ST.timer);
    ST.timer = setTimeout(tick, 3500);
  };

  const main = () => document.querySelector(".sp-main");
  Object.assign(BXD.acts, {
    "sp-filter": (el) => { ST.filter = el.dataset.f; ST.page = 0; loadList(wrapEl()); },
    "sp-more": async () => {
      ST.page += 1;
      const r = await BX.api("a.chat.list", { filter: ST.filter, q: ST.q, page: ST.page });
      ST.data.chats = ST.data.chats.concat(r.chats); ST.data.more = r.more; paintList(wrapEl());
    },
    "sp-quick": (el) => { const ta = main().querySelector("[data-sp-compose] textarea"); ta.value = (ta.value ? ta.value + " " : "") + el.dataset.text; ta.focus(); },
    "sp-emoji": () => { const p = main().querySelector(".sp-emoji"); p.hidden = !p.hidden; },
    "sp-emo": (el) => { const ta = main().querySelector("[data-sp-compose] textarea"); ta.value += el.dataset.e; ta.focus(); main().querySelector(".sp-emoji").hidden = true; },
    "sp-edit": (el) => { ST.editing = Number(el.dataset.id); paintMsgs(main()); main().querySelector("[data-sp-edit] textarea")?.focus(); },
    "sp-edit-cancel": () => { ST.editing = 0; paintMsgs(main()); },
    "sp-del": (el) => BXD.ui.confirmBox("حذف پیام", "پیام برای کاربر هم به «این پیام حذف شد» تغییر می‌کند. ادامه می‌دهید؟", async () => {
      await BX.api("a.chat.delete", { id: el.dataset.id });
      const m = ST.msgs.find((x) => x.id === Number(el.dataset.id)); if (m) m.deleted = true;
      ST.rev++; paintMsgs(main());
    }, "حذف"),
    "sp-close": async (el) => {
      try { const r = await BX.api("a.chat.close", { id: el.dataset.id }); BX.toast(r.message || "انجام شد.", "ok"); const w = wrapEl(); loadChat(w, Number(el.dataset.id)); loadList(w); } catch (e) { BX.toast(e.message, "bad"); }
    },
    "sp-remove": (el) => BXD.ui.confirmBox("حذف کامل گفتگو", "این گفتگو و همه پیام‌هایش از بایگانی برای همیشه حذف می‌شود.", async () => {
      await BX.api("a.chat.remove", { id: el.dataset.id }); location.hash = "support";
    }, "حذف"),
    "sp-faq": (el) => faqModal(el.dataset.text),
  });

  // Teach the bot: append «keywords | answer» to the chat FAQ setting
  function faqModal(question) {
    const words = BX.esc(question.replace(/[؟?!.،,]/g, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 4).join("، "));
    BX.modal({
      title: "آموزش پاسخ جدید به ربات",
      body: `<form class="form-grid" id="sp-faq-form">
        <p class="muted small">سؤال کاربر: «${BX.esc(question)}»</p>
        <div class="field"><label class="field-label" for="sf-k">کلمه‌های کلیدی (با کاما جدا کنید؛ اگر هرکدام در پیام باشد این پاسخ داده می‌شود)</label><input class="input" id="sf-k" name="k" value="${words}" required></div>
        <div class="field"><label class="field-label" for="sf-a">پاسخ ربات</label><textarea class="input" id="sf-a" name="a" rows="4" required></textarea></div>
        <div class="field"><label class="field-label">امتحان</label><div class="row"><input class="input" name="t" value="${BX.esc(question)}"><button type="button" class="btn btn-ghost btn-sm" data-try>${icon("ai")} پاسخ فعلی ربات</button></div><p class="muted small mt-1" data-try-out></p></div>
      </form>`,
      actions: [{ label: "ذخیره در پاسخ‌های ربات", primary: true, onClick: (w) => {
        const f = w.querySelector("#sp-faq-form");
        const k = f.elements.k.value.trim(), a = f.elements.a.value.trim().replace(/\n/g, " ");
        if (!k || !a) { BX.toast("کلمه کلیدی و پاسخ را بنویسید.", "bad"); return false; }
        const faq = (BXD.S.settings.chat?.faq || []).concat([`${k} | ${a}`]);
        BX.api("a.settings.save", { group: "chat", value: { faq } })
          .then(() => { BXD.S.settings.chat = { ...(BXD.S.settings.chat || {}), faq }; BX.toast("پاسخ به ربات اضافه شد.", "ok"); })
          .catch((e) => BX.toast(e.message, "bad"));
      } }, { label: "انصراف" }],
      onOpen: (m) => m.querySelector("[data-try]").addEventListener("click", async () => {
        const out = m.querySelector("[data-try-out]");
        try { const r = await BX.api("a.chat.try", { text: m.querySelector("[name=t]").value }); out.textContent = `(${r.reply.intent}) ${r.reply.text}`; } catch (e) { out.textContent = e.message; }
      }),
    });
  }
})();
