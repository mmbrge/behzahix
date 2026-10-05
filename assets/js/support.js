/* ==========================================================================
   BEHIX — floating support: messengers + smart bot + live chat with support.
   The bot answers on the server; «گفتگو با پشتیبان» hands the chat to a person
   (logged-in users go straight through, guests leave name + phone).
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const KEY = "bx-chat";
  const EMOJI = "😀 😂 😍 🥰 😊 😉 😎 🤩 🤔 😅 😢 😡 🙏 👍 👎 👌 👏 💪 🤝 ✌️ ❤️ 🧡 💛 💚 💙 💜 🔥 ✨ ⭐ 🌹 🎉 🎁 ✅ ❌ ⚡ 💡 📌 📎 📞 💬 ⏰ 💳 🛒 📦 🎨 🖥️ 📱 🚀".split(" ");

  const store = {
    get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } },
  };
  const S = { chat: null, msgs: [], open: false, view: "home", busy: false, timer: 0, lastId: 0, rev: 0, form: false, seen: false };

  BX.ready.then(() => {
    const st = BX.settings || {};
    if (st.chat && st.chat.enabled === false) return;
    if (["dashboard", "auth"].includes(document.body.dataset.page)) return;
    mount();
    // Resume an ongoing conversation (unread badge + live polling)
    if (store.get() || BX.me) poll(true);
    if (location.hash === "#support") openPanel("chat");
    window.addEventListener("hashchange", () => { if (location.hash === "#support") openPanel("chat"); });
  }).catch(() => {});

  const { icon, esc } = BX;
  const botName = () => (BX.settings.chat && BX.settings.chat.botName) || "دستیار هوشمند";

  function channels() {
    const c = BX.settings.contact || {};
    const so = BX.settings.socials || {};
    const wa = so.whatsapp || (c.whatsapp ? `https://wa.me/${String(c.whatsapp).replace(/\D/g, "").replace(/^0/, "98")}` : "");
    const tg = so.telegram || (c.telegramId ? `https://t.me/${String(c.telegramId).replace(/^@/, "")}` : "");
    return [
      wa && { href: wa, icon: "whatsapp", label: "واتساپ", cls: "wa" },
      tg && { href: tg, icon: "telegram", label: "تلگرام", cls: "tg" },
      so.bale && { href: so.bale, icon: "bale", label: "بله", cls: "bale" },
      c.phone && { href: `tel:${c.phone}`, icon: "phone", label: "تماس تلفنی", cls: "tel" },
      so.instagram && { href: so.instagram, icon: "instagram", label: "اینستاگرام", cls: "ig" },
    ].filter(Boolean);
  }

  // ------------------------------------------------------------------ DOM
  let root, fab, panel;
  function mount() {
    root = document.createElement("div");
    root.className = "sup";
    root.innerHTML = `
      <div class="sup-tip" hidden><button type="button" class="sup-tip-x" aria-label="بستن">${icon("cross")}</button><b>سؤالی دارید؟</b><span>دستیار هوشمند همین الان جواب می‌دهد ⚡</span></div>
      <button type="button" class="sup-fab" aria-label="پشتیبانی و گفتگو" aria-expanded="false">
        <span class="sup-ring" aria-hidden="true"></span>
        <span class="sup-icons" aria-hidden="true">${["chat", ...channels().slice(0, 3).map((c) => c.icon)].map((n, i) => `<i style="--i:${i}">${icon(n)}</i>`).join("")}</span>
        <span class="sup-close" aria-hidden="true">${icon("cross")}</span>
        <span class="sup-badge" hidden></span>
      </button>
      <section class="sup-panel" role="dialog" aria-label="پشتیبانی" hidden></section>`;
    document.body.appendChild(root);
    fab = root.querySelector(".sup-fab");
    panel = root.querySelector(".sup-panel");
    const icons = root.querySelectorAll(".sup-icons i");
    root.style.setProperty("--n", icons.length);
    if (icons.length < 2) root.classList.add("sup-single");
    document.body.classList.add("has-sup");

    fab.addEventListener("click", () => (S.open ? closePanel() : openPanel()));
    root.querySelector(".sup-tip").addEventListener("click", (e) => {
      if (e.target.closest(".sup-tip-x")) { hideTip(); try { sessionStorage.setItem("bx-tip", "1"); } catch (er) { /* */ } return; }
      openPanel("chat");
    });
    panel.addEventListener("click", onClick);
    panel.addEventListener("submit", onSubmit);
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && e.target.matches(".sup-input")) { e.preventDefault(); e.target.form.requestSubmit(); }
      if (e.key === "Escape") closePanel();
    });
    panel.addEventListener("input", (e) => { if (e.target.matches(".sup-input")) grow(e.target); });
    let tipShown = false;
    try { tipShown = sessionStorage.getItem("bx-tip") === "1"; } catch (e) { /* */ }
    // Cycle the button icon: chat → messengers
    let cur = 0;
    if (icons.length > 1) setInterval(() => {
      if (S.open || document.hidden) return;
      icons[cur].classList.remove("is-on");
      cur = (cur + 1) % icons.length;
      icons[cur].classList.add("is-on");
    }, 2600);
    icons[0]?.classList.add("is-on");
    if (!tipShown) setTimeout(() => { if (!S.open && !S.seen) root.querySelector(".sup-tip").hidden = false; }, 9000);
  }
  function hideTip() { const t = root.querySelector(".sup-tip"); if (t) t.hidden = true; }

  function openPanel(view) {
    hideTip();
    S.open = true;
    S.seen = true;
    if (view) S.view = view;
    else if (S.chat && S.msgs.length) S.view = "chat";
    root.classList.add("is-open");
    fab.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    render();
    if (S.view === "chat") enterChat();
    document.body.classList.add("sup-locked");
  }
  function closePanel() {
    S.open = false;
    root.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    document.body.classList.remove("sup-locked");
    setTimeout(() => { if (!S.open) panel.hidden = true; }, 260);
    schedule();
  }

  function render() {
    panel.innerHTML = S.view === "chat" ? chatView() : homeView();
    if (S.view === "chat") { paintMessages(); scrollEnd(); }
  }

  function header(back) {
    const live = S.chat && ["waiting", "live"].includes(S.chat.status);
    return `<header class="sup-head">
      ${back ? `<button type="button" class="sup-icon" data-sup="home" aria-label="بازگشت">${icon("arrow-right")}</button>` : ""}
      <span class="sup-ava ${live ? "is-human" : ""}">${icon(live ? "user" : "ai")}<i></i></span>
      <div class="sup-title"><b>${live ? "پشتیبانی " + esc(BX.settings.general?.siteNameFa || "بهیکس") : esc(botName())}</b>
        <small>${live ? (S.chat.status === "live" ? "کارشناس در گفتگو" : "در انتظار پاسخ کارشناس…") : "آنلاین · پاسخ فوری"}</small></div>
      <button type="button" class="sup-icon" data-sup="close" aria-label="بستن">${icon("cross")}</button>
    </header>`;
  }

  function homeView() {
    const ch = channels();
    const name = BX.me ? `${esc(BX.me.name.split(" ")[0])} عزیز، ` : "";
    return `${header(false)}
      <div class="sup-body sup-home">
        <p class="sup-hello">${name}سلام 👋<br><span>چطور می‌توانیم کمکتان کنیم؟</span></p>
        <button type="button" class="sup-bot-card" data-sup="chat">
          <span class="sup-bot-ic">${icon("sparkles")}</span>
          <span><b>چت با ${esc(botName())}</b><small>قیمت، زمان تحویل، پیگیری سفارش، پرداخت و اقساط — جواب فوری</small></span>
          ${icon("chevron-left")}
        </button>
        ${ch.length ? `<p class="sup-label">یا از راه دلخواهتان پیام دهید</p>
        <div class="sup-channels">${ch.map((c) => `<a class="sup-ch sup-ch--${c.cls}" href="${esc(c.href)}" target="_blank" rel="noopener">${icon(c.icon)}<span>${c.label}</span></a>`).join("")}</div>` : ""}
        <button type="button" class="sup-human-link" data-sup="human">${icon("user")} گفتگو مستقیم با کارشناس پشتیبانی</button>
        ${BX.settings.contact?.hours ? `<p class="sup-hours">${icon("clock")} ${esc(BX.settings.contact.hours)}</p>` : ""}
      </div>`;
  }

  function chatView() {
    return `${header(true)}
      <div class="sup-body sup-log" aria-live="polite"></div>
      <div class="sup-extra"></div>
      <form class="sup-compose" autocomplete="off">
        <button type="button" class="sup-icon sup-emo-btn" data-sup="emoji" aria-label="ایموجی">${icon("smile")}</button>
        <textarea class="sup-input" name="text" rows="1" maxlength="2000" placeholder="پیام خود را بنویسید…" aria-label="پیام"></textarea>
        <button type="submit" class="sup-send" aria-label="ارسال">${icon("send")}</button>
        <div class="sup-emoji" hidden>${EMOJI.map((e) => `<button type="button" data-emo="${e}">${e}</button>`).join("")}</div>
      </form>`;
  }

  // ------------------------------------------------------------------ messages
  const fmtTime = (ms) => new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  function textHtml(t) {
    return esc(t).replace(/\n/g, "<br>").replace(/(BX-\d{3,6})/g, "<b dir=\"ltr\">$1</b>");
  }
  function bubble(m) {
    if (m.from === "system") return `<div class="sup-sys">${esc(m.text)}</div>`;
    const mine = m.from === "user";
    const who = m.from === "admin" ? "پشتیبان" : "";
    const body = m.deleted ? `<i class="sup-del">🚫 این پیام حذف شد</i>` : textHtml(m.text);
    const links = !m.deleted && m.from === "bot" && (m.links || []).length ? `<div class="sup-links">${m.links.map(([l, h]) => `<a href="${esc(h)}">${esc(l)} ${icon("chevron-left")}</a>`).join("")}</div>` : "";
    return `<div class="sup-msg ${mine ? "is-me" : "is-them"} is-${m.from}" data-id="${m.id}">
      ${who ? `<small class="sup-who">${who}</small>` : ""}
      <div class="sup-bubble">${body}${links}</div>
      <small class="sup-time">${fmtTime(m.at)}${m.edited && !m.deleted ? " · ویرایش شده" : ""}</small>
    </div>`;
  }
  function paintMessages() {
    const log = panel.querySelector(".sup-log");
    if (!log) return;
    const greet = (BX.settings.chat && BX.settings.chat.greeting) || "سلام! چطور می‌توانم کمکتان کنم؟";
    const intro = { id: 0, from: "bot", text: (BX.me ? `${BX.me.name.split(" ")[0]} عزیز، ` : "") + greet, at: S.msgs[0]?.at || Date.now() };
    const all = [intro, ...S.msgs];
    log.innerHTML = all.map(bubble).join("") + (S.busy ? `<div class="sup-msg is-them is-bot"><div class="sup-bubble sup-typing"><i></i><i></i><i></i></div></div>` : "");
    paintExtra();
  }
  // Chips / escalate button / guest form under the log
  function paintExtra() {
    const box = panel.querySelector(".sup-extra");
    if (!box) return;
    const status = S.chat?.status || "bot";
    const last = [...S.msgs].reverse().find((m) => m.from !== "system");
    if (S.form) {
      box.innerHTML = `<form class="sup-form" data-sup-form>
        <p>برای اتصال به کارشناس، نام و شماره موبایل خود را وارد کنید تا اگر از صفحه خارج شدید هم پاسخ را دریافت کنید.</p>
        <input class="input" name="name" placeholder="نام و نام خانوادگی" required maxlength="120">
        <input class="input" name="phone" placeholder="شماره موبایل (۰۹…)" inputmode="tel" dir="ltr" required maxlength="14">
        <div class="sup-form-act"><button class="btn btn-primary btn-sm" type="submit">${icon("send")} اتصال به پشتیبان</button><button class="btn btn-ghost btn-sm" type="button" data-sup="form-cancel">انصراف</button></div>
      </form>`;
      return;
    }
    if (status !== "bot") { box.innerHTML = ""; return; }
    const chips = !S.msgs.length ? ["لیست خدمات", "قیمت طراحی سایت", "پیگیری سفارش", "پرداخت قسطی دارید؟", "زمان تحویل لوگو"] : (last && last.from === "bot" ? last.chips || [] : []);
    const wantsHuman = last && last.from === "bot" && last.human;
    box.innerHTML = `<div class="sup-chips">
      ${wantsHuman ? `<button type="button" class="sup-chip is-human" data-sup="human">${icon("user")} گفتگو با پشتیبان</button>` : ""}
      ${chips.filter((c) => !(wantsHuman && /پشتیبان/.test(c))).map((c) => /پشتیبان/.test(c) ? `<button type="button" class="sup-chip is-human" data-sup="human">${icon("user")} ${esc(c)}</button>` : `<button type="button" class="sup-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join("")}
      ${S.msgs.length && !wantsHuman && !chips.some((c) => /پشتیبان/.test(c)) ? `<button type="button" class="sup-chip is-ghost" data-sup="human">${icon("user")} پشتیبان</button>` : ""}
    </div>`;
  }
  function scrollEnd() {
    const log = panel.querySelector(".sup-log");
    if (log) requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
  }
  function merge(res, full) {
    if (res.chat) {
      S.chat = res.chat;
      if (res.chat.token) store.set(res.chat.token);
      S.rev = res.chat.rev || 0;
    }
    const list = res.messages || [];
    if (full) S.msgs = list;
    else for (const m of list) { const i = S.msgs.findIndex((x) => x.id === m.id); i >= 0 ? (S.msgs[i] = m) : S.msgs.push(m); }
    S.lastId = S.msgs.reduce((a, m) => Math.max(a, m.id), 0);
  }
  function badge(n) {
    const b = root.querySelector(".sup-badge");
    b.hidden = !n;
    b.textContent = BX.faDigits(n);
    root.classList.toggle("has-unread", !!n);
  }

  // ------------------------------------------------------------------ network
  const base = () => ({ token: store.get(), page: document.body.dataset.page || "" });
  async function enterChat() {
    const inp = panel.querySelector(".sup-input");
    if (window.matchMedia("(pointer:fine)").matches) inp?.focus();
    if (!S.chat && (store.get() || BX.me) && !S.loaded) {
      try { const r = await BX.api("chat.open", base()); S.loaded = true; merge(r, true); badge(0); } catch (e) { /* offline: start fresh */ }
      if (S.view === "chat") { paintMessages(); scrollEnd(); }
    }
    badge(0);
    schedule();
  }
  async function send(text) {
    text = text.trim();
    if (!text || S.busy) return;
    const tmp = { id: S.lastId + 0.5, from: "user", text, at: Date.now() };
    S.msgs.push(tmp);
    const botTurn = !S.chat || S.chat.status === "bot" || S.chat.status === "closed";
    S.busy = botTurn;
    paintMessages(); scrollEnd();
    try {
      const r = await BX.api("chat.send", { ...base(), text, after: S.lastId });
      S.msgs = S.msgs.filter((m) => m !== tmp);
      if (botTurn) await new Promise((ok) => setTimeout(ok, 450 + Math.min(900, text.length * 12)));
      merge(r, false);
    } catch (e) {
      S.msgs = S.msgs.filter((m) => m !== tmp);
      BX.toast(e.message, "bad");
      const inp = panel.querySelector(".sup-input");
      if (inp && !inp.value) inp.value = text;
    }
    S.busy = false;
    paintMessages(); scrollEnd();
    schedule();
  }
  async function escalate(extra) {
    try {
      const r = await BX.api("chat.escalate", { ...base(), ...extra, after: S.lastId });
      S.form = false;
      merge(r, false);
      paintMessages();
      panel.querySelector(".sup-head").outerHTML = header(true);
      scrollEnd();
      schedule();
    } catch (e) { BX.toast(e.message, "bad"); }
  }
  function askHuman() {
    if (S.view !== "chat") { S.view = "chat"; render(); enterChat(); }
    if (S.chat && ["waiting", "live"].includes(S.chat.status)) { BX.toast("گفتگوی شما به پشتیبان وصل است؛ پیامتان را بنویسید.", "ok"); return; }
    if (BX.me) escalate({});
    else { S.form = true; paintExtra(); scrollEnd(); panel.querySelector("[data-sup-form] input")?.focus(); }
  }
  // Poll: fast while the chat is open with a person, slow in the background (unread badge)
  function schedule() {
    clearTimeout(S.timer);
    const live = S.chat && ["waiting", "live"].includes(S.chat.status);
    if (!live) return;
    S.timer = setTimeout(() => poll(false), S.open && S.view === "chat" ? 3000 : 20000);
  }
  async function poll(first) {
    if (document.hidden && !first) { schedule(); return; }
    try {
      const opened = S.open && S.view === "chat";
      const r = await BX.api("chat.poll", { ...base(), after: S.lastId, rev: S.rev, open: opened ? 1 : 0 });
      if (r.chat) {
        const before = S.chat?.status;
        const grew = (r.messages || []).length;
        merge(r, first || r.full);
        if (opened) {
          if (grew || r.full || before !== r.chat.status) {
            paintMessages(); scrollEnd();
            const h = panel.querySelector(".sup-head"); if (h) h.outerHTML = header(true);
          }
          badge(0);
        } else badge(r.chat.unread || 0);
      }
    } catch (e) { /* retry later */ }
    schedule();
  }

  // ------------------------------------------------------------------ events
  function onClick(e) {
    const emo = e.target.closest("[data-emo]");
    if (emo) {
      const inp = panel.querySelector(".sup-input");
      const s = inp.selectionStart ?? inp.value.length;
      inp.value = inp.value.slice(0, s) + emo.dataset.emo + inp.value.slice(inp.selectionEnd ?? s);
      inp.focus();
      inp.selectionStart = inp.selectionEnd = s + emo.dataset.emo.length;
      return;
    }
    const chip = e.target.closest("[data-chip]");
    if (chip) { send(chip.dataset.chip); return; }
    const a = e.target.closest("[data-sup]");
    if (!a) {
      if (!e.target.closest(".sup-emoji, .sup-emo-btn")) { const p = panel.querySelector(".sup-emoji"); if (p) p.hidden = true; }
      if (e.target.closest(".sup-links a") && /^#/.test(e.target.closest("a").getAttribute("href"))) closePanel();
      return;
    }
    const act = a.dataset.sup;
    if (act === "close") closePanel();
    else if (act === "home") { S.view = "home"; S.form = false; render(); }
    else if (act === "chat") { S.view = "chat"; render(); enterChat(); }
    else if (act === "human") askHuman();
    else if (act === "form-cancel") { S.form = false; paintExtra(); }
    else if (act === "emoji") { const p = panel.querySelector(".sup-emoji"); p.hidden = !p.hidden; }
  }
  function onSubmit(e) {
    e.preventDefault();
    const f = e.target;
    if (f.matches("[data-sup-form]")) {
      const name = f.elements.name.value.trim();
      const phone = BX.enDigits(f.elements.phone.value).replace(/\D/g, "");
      if (name.length < 2) return BX.toast("نام خود را وارد کنید.", "bad");
      if (!/^09\d{9}$/.test(phone)) return BX.toast("شماره موبایل معتبر نیست.", "bad");
      escalate({ name, phone });
      return;
    }
    const inp = f.elements.text;
    const t = inp.value;
    inp.value = "";
    grow(inp);
    const p = panel.querySelector(".sup-emoji"); if (p) p.hidden = true;
    send(t);
  }
  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(120, t.scrollHeight) + "px"; }

  BX.support = { open: (v) => openPanel(v || "chat"), human: () => { openPanel("chat"); askHuman(); } };
})();
