/* ==========================================================================
   BEHIX — API client and shared data
   Every page waits for BX.ready (boot data from the server: settings,
   service catalog, logged-in user) before rendering.
   ========================================================================== */

(function () {
  "use strict";

  const API = "api/index.php";
  let csrf = "";

  class ApiError extends Error {
    constructor(message, code, status) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  async function call(route, data = {}, files = null, retried = false) {
    const opts = { method: "POST", credentials: "same-origin", headers: { "X-CSRF": csrf } };
    // files: array of File (sent as files[]); named extras like files.cover are sent under their own key
    const named = files ? Object.keys(files).filter((k) => isNaN(k) && files[k] instanceof Blob) : [];
    if (files && (files.length || named.length)) {
      const fd = new FormData();
      fd.append("payload", JSON.stringify(data));
      for (const f of files) fd.append("files[]", f, f.name);
      for (const k of named) fd.append(k, files[k], files[k].name);
      opts.body = fd;
    } else {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(data);
    }
    let res;
    try {
      res = await fetch(`${API}?r=${encodeURIComponent(route)}`, opts);
    } catch (e) {
      throw new ApiError("اتصال به سرور برقرار نشد؛ اینترنت خود را بررسی کنید.", "network", 0);
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (res.status === 419 && !retried) {
      await boot(true);
      return call(route, data, files, true);
    }
    if (!res.ok || (json && json.error)) {
      throw new ApiError(json?.message || "خطای سرور رخ داد؛ دوباره تلاش کنید.", json?.error || "server", res.status);
    }
    return json || {};
  }

  // ---- Constants shared by the pages ----
  const ORDER_STATUS = {
    new: { label: "ثبت شده", tone: "info", icon: "inbox" },
    review: { label: "بررسی و پیش‌فاکتور", tone: "info", icon: "search" },
    in_progress: { label: "در حال انجام", tone: "warn", icon: "loader" },
    awaiting: { label: "منتظر تأیید شما", tone: "brand", icon: "eye" },
    revision: { label: "در حال اصلاح", tone: "warn", icon: "refresh" },
    done: { label: "تحویل شده", tone: "ok", icon: "check-circle" },
    cancelled: { label: "لغو شده", tone: "bad", icon: "x-circle" },
  };
  const ORDER_FLOW = ["new", "review", "in_progress", "awaiting", "done"];

  const BX = (window.BX = Object.assign(window.BX || {}, {
    api: call,
    ApiError,
    ORDER_STATUS,
    ORDER_FLOW,
    CATALOG: [],
    services: [],
    PRODUCT_CATEGORIES: [],
    DEADLINES: [],
    ADDONS: [],
    STYLES: [],
    BUDGETS: [],
    settings: {},
    me: null,
    unread: 0,
    installed: true,
  }));

  BX.findService = (id) => BX.services.find((s) => s.id === id);
  BX.findCategory = (id) => BX.CATALOG.find((c) => c.id === id);
  BX.auth = {
    current: () => BX.me,
    async logout() {
      await call("auth.logout").catch(() => {});
      BX.me = null;
    },
  };

  // Live price estimate in the browser; the server recalculates on submit.
  BX.estimate = function (serviceId, details = {}, deadline = "normal", addons = []) {
    const s = BX.findService(serviceId);
    if (!s) return { total: 0, days: 0 };
    let total = s.base;
    for (const f of s.fields) {
      const val = details[f.id];
      if (f.type === "number") {
        const n = Number(val ?? f.value ?? 0);
        total += Math.max(0, n - (f.included ?? 0)) * (f.perUnit ?? 0);
      } else if (f.options) {
        const vals = Array.isArray(val) ? val : val != null ? [val] : [];
        for (const v of vals) total += f.options.find((o) => o.v === v)?.price ?? 0;
      }
    }
    const dl = BX.DEADLINES.find((d) => d.v === deadline) || BX.DEADLINES[0] || { mult: 1, daysMult: 1 };
    const pct = addons.reduce((p, a) => p + (BX.ADDONS.find((x) => x.v === a)?.pct ?? 0), 0);
    total = total * dl.mult * (1 + pct);
    return { total: Math.max(0, Math.round(total / 100000) * 100000), days: Math.max(1, Math.round(s.days * dl.daysMult)) };
  };

  async function boot(refreshOnly = false) {
    const res = await fetch(`${API}?r=boot`, { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.error) {
      if (json?.error === "not_installed") BX.installed = false;
      throw new ApiError(json?.message || "سرور در دسترس نیست.", json?.error || "server", res.status);
    }
    csrf = json.csrf;
    if (refreshOnly) return json;
    BX.me = json.me;
    BX.unread = json.unread;
    BX.impersonating = json.impersonating;
    BX.demoAccounts = json.demoAccounts || [];
    BX.settings = json.settings;
    BX.CATALOG = json.catalog;
    BX.services = json.catalog.flatMap((c) => c.services.map((s) => ({ ...s, category: c.id })));
    BX.PRODUCT_CATEGORIES = json.productCategories;
    const o = json.settings.orders || {};
    BX.DEADLINES = o.deadlines || [];
    BX.ADDONS = o.addons || [];
    BX.STYLES = o.styles || [];
    BX.BUDGETS = o.budgets || [];
    applyTheme(json.settings.theme || {});
    return json;
  }

  function applyTheme(t) {
    const root = document.documentElement;
    if (t.brand) root.style.setProperty("--brand", t.brand);
    if (t.brand2) root.style.setProperty("--brand-2", t.brand2);
    let saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) { /* ignore */ }
    if (!saved && t.defaultTheme) root.dataset.theme = t.defaultTheme;
  }

  BX.ready = boot();
})();
