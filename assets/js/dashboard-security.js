/* ==========================================================================
   BEHIX — admin «امنیت»: security score, checklist with fixes, file integrity,
   recent security events, blocked addresses, sessions and backups.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;
  const { icon, esc, faDigits, ago } = BX;
  const LEVEL = { critical: ["بحرانی", "bad"], high: ["مهم", "warn"], medium: ["متوسط", "info"], low: ["کم", ""] };
  const TYPE = { login_fail: ["ورود ناموفق", "warn"], admin_login: ["ورود مدیر", "info"], blocked: ["مسدودسازی", "bad"], rate: ["درخواست زیاد", "warn"], admin_action: ["اقدام مدیر", ""], password: ["تغییر رمز", "info"] };

  BXD.routes.security = () => `<div data-security><div class="card box skeleton" style="height:360px"></div></div>`;

  async function load(el) {
    const { box, table, tile } = BXD.ui;
    const r = await BX.api("a.security.report");
    const rep = r.report, s = r.settings;
    const tone = rep.score >= 85 ? "ok" : rep.score >= 60 ? "warn" : "bad";
    const failed = rep.checks.filter((c) => !c.ok);
    el.innerHTML = `<div class="dash-grid">
      <div class="sec-hero card sec-hero--${tone}">
        <div class="st-gauge" style="--p:${rep.score}"><b>${faDigits(rep.score)}</b><small>امتیاز امنیت</small></div>
        <div class="grow"><h2>${rep.score >= 85 ? "وضعیت امنیت سایت خوب است" : rep.score >= 60 ? "چند مورد مهم نیاز به اقدام دارد" : "سایت در برابر حمله آسیب‌پذیر است؛ موارد قرمز را فوراً اصلاح کنید"}</h2>
          <p class="muted small">${faDigits(rep.checks.length - failed.length)} از ${faDigits(rep.checks.length)} بررسی موفق · آی‌پی شما: <b dir="ltr">${esc(r.ip)}</b></p>
          <div class="row mt-1"><button class="btn btn-primary btn-sm" data-act="sec-backup">${icon("download")} دانلود پشتیبان کامل</button><button class="btn btn-ghost btn-sm" data-act="sec-reload">${icon("refresh")} بررسی دوباره</button><button class="btn btn-ghost btn-sm" data-act="sec-logout-all">${icon("logout")} خروج همه کاربران از همه دستگاه‌ها</button></div></div>
      </div>
      <div class="tiles">${tile("ورود ناموفق (۷ روز)", faDigits(r.stats.loginFail), "lock")}${tile("آی‌پی مسدودشده (۷ روز)", faDigits(r.stats.blocked), "shield")}${tile("درخواست بیش از حد", faDigits(r.stats.rate), "zap")}${tile("ورود مدیر", faDigits(r.stats.adminLogin), "user")}</div>
      ${box("چک‌لیست امنیت", "shield", `<div class="sec-checks">${rep.checks.sort((a, b) => a.ok - b.ok).map((c) => `
        <div class="sec-check ${c.ok ? "ok" : "bad"}">${icon(c.ok ? "check-circle" : "x-circle")}<div class="grow"><b>${esc(c.label)}</b> ${c.ok ? "" : `<span class="badge badge--${LEVEL[c.level][1]}">${LEVEL[c.level][0]}</span>`}${c.ok ? "" : `<p class="muted small">${esc(c.tip)}</p>`}</div></div>`).join("")}</div>`)}
      <div class="dash-grid dash-grid-2">
        ${box("تنظیمات امنیتی", "settings", `<form class="form-grid" data-form="security-settings">
          <label class="switch"><input type="checkbox" name="security.admin2fa" ${s.admin2fa ? "checked" : ""}><span class="track"></span>ورود دومرحله‌ای مدیر (کد پیامکی بعد از رمز)</label>
          <label class="switch"><input type="checkbox" name="security.loginAlert" ${s.loginAlert ? "checked" : ""}><span class="track"></span>پیامک هشدار هنگام هر ورود مدیر (قالب «هشدار ورود مدیر»)</label>
          <div class="form-grid form-grid-2"><div class="field"><label class="field-label">مسدودسازی بعد از چند ورود ناموفق</label><input class="input" name="security.maxFails" dir="ltr" value="${faDigits(s.maxFails)}"></div>
          <div class="field"><label class="field-label">مدت مسدودی (دقیقه)</label><input class="input" name="security.blockMinutes" dir="ltr" value="${faDigits(s.blockMinutes)}"></div></div>
          <label class="switch"><input type="checkbox" name="security.trustProxy" ${s.trustProxy ? "checked" : ""}><span class="track"></span>سایت پشت CDN است (ابر آروان / کلودفلر) — آی‌پی واقعی از هدر خوانده شود</label>
          <button class="btn btn-primary" type="submit">${icon("check")} ذخیره</button></form>`)}
        ${box("آی‌پی‌های مسدود", "lock", `${r.blocks.length ? r.blocks.map((b) => `<div class="list-row"><span class="cell-icon">${icon("lock")}</span><div class="grow"><b dir="ltr">${esc(b.ip)}</b><br><small class="muted">${esc(b.reason)} · ${b.until ? `تا ${BX.date(b.until)}` : "دائمی"}</small></div><button class="btn btn-ghost btn-xs" data-act="sec-unblock" data-ip="${esc(b.ip)}">رفع</button></div>`).join("") : '<p class="muted small">آی‌پی مسدودی وجود ندارد.</p>'}
          <form class="row mt-2" data-sec-block><input class="input" name="ip" dir="ltr" placeholder="مسدودسازی دستی آی‌پی"><button class="btn btn-ghost btn-sm">${icon("lock")} مسدود</button></form>`)}
      </div>
      ${rep.integrity.suspicious.length || rep.integrity.changed.length ? box("هشدار فایل‌ها", "info", `<ul class="sec-files">${rep.integrity.suspicious.map((f) => `<li class="bad">مشکوک: <code dir="ltr">${esc(f)}</code></li>`).join("")}${rep.integrity.changed.map((f) => `<li>تغییرکرده: <code dir="ltr">${esc(f)}</code></li>`).join("")}</ul>`) : ""}
      ${box("رویدادهای امنیتی اخیر", "list", table(["زمان", "رویداد", "آی‌پی", "کاربر", "جزئیات"], r.events.map((e) => `<tr><td class="muted">${ago(e.at)}</td><td>${TYPE[e.type] ? `<span class="badge badge--${TYPE[e.type][1]}">${TYPE[e.type][0]}</span>` : esc(e.type)}</td>
        <td dir="ltr"><button class="link-btn" data-act="sec-block-ip" data-ip="${esc(e.ip)}" title="مسدود کردن">${esc(e.ip)}</button></td><td>${esc(e.user || "—")}</td><td class="small" title="${esc(e.ua)}">${esc(e.detail)}</td></tr>`), "رویدادی ثبت نشده است."))}
    </div>`;
    el.querySelector("[data-sec-block]").addEventListener("submit", (ev) => { ev.preventDefault(); block(ev.target.elements.ip.value.trim()); });
    BXD.labelTables?.(el);
  }
  const box = () => document.querySelector("[data-security]");
  const reload = () => load(box()).catch((e) => BX.toast(e.message, "bad"));
  function block(ip) {
    if (!ip) return;
    BXD.ui.confirmBox("مسدود کردن آی‌پی", `همه درخواست‌های آی‌پی ${ip} مسدود می‌شود. ادامه می‌دهید؟`, () => BX.api("a.security.block", { ip }).then((r) => { BX.toast(r.message, "ok"); reload(); }), "مسدود کن");
  }
  const prevAfter = BXD.afterRender;
  BXD.afterRender = (view, id, param) => { if (prevAfter) prevAfter(view, id, param); const el = view.querySelector("[data-security]"); if (el) load(el).catch((e) => { el.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(e.message)}</p></div>`; }); };
  BXD.forms["security-settings"] = (f) => {
    const e = f.elements, n = (x) => Number(BX.enDigits(x.value)) || 0;
    BXD.quiet(BXD.act("settings.save", { group: "security", value: { admin2fa: e["security.admin2fa"].checked, loginAlert: e["security.loginAlert"].checked, trustProxy: e["security.trustProxy"].checked, maxFails: n(e["security.maxFails"]), blockMinutes: n(e["security.blockMinutes"]) } }));
  };
  Object.assign(BXD.acts, {
    "sec-reload": reload,
    "sec-unblock": (b) => BX.api("a.security.unblock", { ip: b.dataset.ip }).then((r) => { BX.toast(r.message, "ok"); reload(); }),
    "sec-block-ip": (b) => block(b.dataset.ip),
    "sec-logout-all": () => BXD.ui.confirmBox("خروج همه کاربران", "همه کاربران (به‌جز همین نشست شما) باید دوباره وارد شوند. برای وقتی است که به نفوذ مشکوکید.", () => BX.api("a.security.logoutAll").then((r) => BX.toast(r.message, "ok")), "خروج همه"),
    "sec-backup": async () => {
      BX.toast("در حال آماده‌سازی پشتیبان…", "info");
      try {
        const res = await fetch("api/index.php?r=a.security.backup", { method: "POST", credentials: "same-origin", headers: { "X-CSRF": BX.csrf(), "Content-Type": "application/json" }, body: "{}" });
        if (!res.ok) throw new Error("دانلود پشتیبان ناموفق بود.");
        const blob = await res.blob();
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `behix-backup-${new Date().toISOString().slice(0, 10)}.sql.gz`; a.click();
        setTimeout(reload, 800);
      } catch (e) { BX.toast(e.message, "bad"); }
    },
  });
})();
