// BEHIX — critical CSS (development tool, not used by the live site).
//
// For every public page: load it in a real browser on phone, tablet and desktop
// sizes, in the dark and the light theme, keep the CSS rules that style what is
// visible on the first screen, and put them inline in the page's <head>. The full
// stylesheets are then loaded without blocking the first paint, so every page still
// has every style; the inline part only lets the first screen draw at once.
//
// Rules are copied from the CSS files as written (the browser is only asked which
// selectors match), so nothing is re-serialised.
//
// Run after changing CSS or page markup (needs the site running locally):
//   node dev/critical.js http://127.0.0.1:8080
// It rewrites the <head> of the listed .html files; run it again any time.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE = (process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
// page file → URLs that use it (variants share the same file, so their rules are merged);
// «!reduce» = also with reduced motion (the home hero has a static version)
const PAGES = {
  "index.html": ["/", "/!reduce"],
  "services.html": ["/services.html"],
  "service.html": ["/service.html?id=logo", "/service.html?id=pptx"],
  "shop.html": ["/shop.html"],
  "blog.html": ["/blog.html", "@post"],
  "studio.html": ["/studio.html", "/studio.html#post"],
  "tools.html": ["/tools.html"],
  "about.html": ["/about.html"],
  "portfolio.html": ["/portfolio.html"],
  "designers.html": ["/designers.html"],
  "order.html": ["/order.html"],
  "terms.html": ["/terms.html"],
  "auth.html": ["/auth.html"],
  "404.html": ["/404.html"],
};
const VIEWPORTS = [{ width: 390, height: 844, mobile: true }, { width: 800, height: 1100, mobile: true }, { width: 1350, height: 940, mobile: false }];
const THEMES = ["dark", "light"];
const MARK_A = "<!-- critical-css -->", MARK_B = "<!-- /critical-css -->";

// ------------------------------------------------------------------ CSS source → rule tree
// nodes: {t:"rule", sel, text} | {t:"group", head, kids} | {t:"font", text} | {t:"kf", name, text} | {t:"other", text}
function parseCss(src) {
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  const block = () => { // from just after «{» to the matching «}», returns the inner text
    let d = 1, s = i, q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === q && src[i - 1] !== "\\") q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === "{") d++;
      else if (c === "}" && !--d) { const inner = src.slice(s, i); i++; return inner; }
    }
    return src.slice(s);
  };
  const list = (stopAtClose) => {
    const out = [];
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (i >= src.length) break;
      if (src[i] === "}") { if (stopAtClose) { i++; return out; } i++; continue; }
      const s = i;
      while (i < src.length && src[i] !== "{" && src[i] !== ";") i++;
      const head = src.slice(s, i).trim();
      if (src[i] === ";") { i++; out.push({ t: "other", text: head + ";" }); continue; }
      i++; // «{»
      if (/^@(media|supports|layer|container)\b/i.test(head)) { out.push({ t: "group", head, kids: list(true) }); continue; }
      const body = block();
      if (/^@font-face/i.test(head)) out.push({ t: "font", text: head + "{" + body + "}" });
      else if (/^@(-webkit-)?keyframes\s/i.test(head)) out.push({ t: "kf", name: head.split(/\s+/)[1], text: head + "{" + body + "}" });
      else if (head[0] === "@") out.push({ t: "other", text: head + "{" + body + "}" });
      else out.push({ t: "rule", sel: head, text: head + "{" + body + "}" });
    }
    return out;
  };
  return list(false);
}

// Runs inside the page: which of the given selectors match something on the first screen
function collect(sels) {
  const H = innerHeight * 1.25;
  // an element without a box (hidden by a rule) counts where its nearest visible container is,
  // so the rules that hide things on the first screen are kept too
  const onScreen = (el) => {
    for (let n = el; n; n = n.parentElement) {
      if (n === document.documentElement || n === document.body) return true;
      const r = n.getBoundingClientRect();
      if (r.width + r.height > 0) return r.bottom > 0 && r.top < H;
    }
    return false;
  };
  // drop pseudo-elements and state pseudo-classes, so «a:hover::after» matches the «a»
  const clean = (sel) => sel
    .replace(/::?(before|after|placeholder|marker|selection|backdrop|first-letter|first-line|file-selector-button)\b/g, "")
    .replace(/::-(webkit|moz)-[\w-]+/g, "")
    .replace(/:(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|enabled|placeholder-shown|invalid|valid|empty|indeterminate)\b/g, "")
    .replace(/:not\(\s*\)/g, "")
    .trim() || "*";
  const split = (s) => { const out = []; let d = 0, cur = ""; for (const c of s) { if (c === "(" || c === "[") d++; if (c === ")" || c === "]") d--; if (c === "," && !d) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; };
  const hits = [];
  sels.forEach((s, k) => {
    for (const one of split(s)) {
      let list;
      try { list = document.querySelectorAll(clean(one)); } catch (e) { hits.push(k); return; } // unknown syntax: keep it
      for (const el of list) if (onScreen(el)) { hits.push(k); return; }
    }
  });
  return hits;
}

(async () => {
  const browser = await chromium.launch();
  const sheets = {}; // name → tree
  for (const f of fs.readdirSync(path.join(ROOT, "assets/css")).filter((x) => x.endsWith(".css"))) sheets[f] = parseCss(fs.readFileSync(path.join(ROOT, "assets/css", f), "utf8"));
  // a published post for the blog variant
  const ctx0 = await browser.newContext();
  const p0 = await ctx0.newPage();
  await p0.goto(BASE + "/blog.html", { waitUntil: "domcontentloaded" });
  const post = await p0.evaluate(() => (document.documentElement.innerHTML.match(/href="(blog\.html\?p=[^"]+)"/) || [])[1] || null);
  await ctx0.close();

  const report = [];
  for (const [file, urls] of Object.entries(PAGES)) {
    const html0 = fs.readFileSync(path.join(ROOT, file), "utf8");
    // stylesheets of this page, in document order (plain or already-async form; not the noscript copies)
    const links = [...html0.matchAll(/<link rel="stylesheet" href="assets\/css\/([a-z-]+)\.css\?v=([^"]+)"[^>]*>/g)].filter((m) => !/<noscript>(<link[^>]*>)*$/.test(html0.slice(Math.max(0, m.index - 400), m.index)));
    const names = [...new Set(links.map((m) => m[1] + ".css"))];
    const ver = links[0] ? links[0][2] : "";
    if (!names.length) continue;
    // every style rule of these sheets, numbered
    const all = [];
    const index = (tree) => tree.forEach((n) => { if (n.t === "rule") { n.id = all.length; all.push(n.sel); } else if (n.t === "group") index(n.kids); });
    names.forEach((n) => index(sheets[n] || []));
    const keep = new Set();
    for (const u0 of urls) {
      const reduce = u0.endsWith("!reduce");
      const u = u0 === "@post" ? (post ? "/" + post : null) : u0.replace("!reduce", "");
      if (!u) continue;
      // «js: false» = the page as the server sends it, before the site's scripts replace parts of it
      // (that state is what the first paint shows)
      for (const vp of VIEWPORTS) for (const theme of THEMES) for (const js of [true, false]) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, reducedMotion: reduce ? "reduce" : "no-preference" });
        await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch (e) { /* ignore */ } }, theme);
        const p = await ctx.newPage();
        if (!js) await p.route(/\/assets\/js\/.*\.js/, (r) => r.abort());
        await p.goto(BASE + u, { waitUntil: "networkidle" }).catch(() => {});
        await p.waitForTimeout(700);
        for (const k of await p.evaluate(collect, all)) keep.add(k);
        await ctx.close();
      }
    }
    // assemble in stylesheet order; groups only when something inside is kept;
    // @font-face, :root/html/body and the keyframes that kept rules use are always included
    const always = /^(:root|html|body|\*)(\[[^\]]+\])?(\s*,\s*(:root|html|body|\*)(\[[^\]]+\])?)*$/;
    const emit = (tree) => tree.map((n) => {
      if (n.t === "group") { const inner = emit(n.kids); return inner ? n.head + "{" + inner + "}" : ""; }
      if (n.t === "font") return n.text;
      if (n.t === "rule" && (keep.has(n.id) || always.test(n.sel.trim()))) return n.text;
      return "";
    }).join("");
    let css = names.map((n) => emit(sheets[n] || [])).join("");
    const kfs = (tree) => tree.flatMap((n) => (n.t === "group" ? kfs(n.kids) : n.t === "kf" ? [n] : []));
    const used = new Set();
    for (const n of names) for (const k of kfs(sheets[n] || [])) if (!used.has(k.name) && new RegExp("[\\s:,]" + k.name.replace(/[-]/g, "\\-") + "\\b").test(css)) { used.add(k.name); css += k.text; }
    // light minify: whitespace only (selectors and values stay exactly as written)
    css = css.replace(/\s+/g, " ").replace(/\s*([{};])\s*/g, "$1").replace(/;}/g, "}").replace(/url\((["']?)\.\.\//g, "url($1assets/").replace(/<\//g, "<\\/");
    // head: inline critical CSS, then each stylesheet loaded without blocking (noscript fallback)
    const block = MARK_A + "\n  <style>" + css + "</style>\n  " + names.map((n) => `<link rel="stylesheet" href="assets/css/${n}?v=${ver}" media="print" onload="this.media='all'">`).join("\n  ") +
      "\n  <noscript>" + names.map((n) => `<link rel="stylesheet" href="assets/css/${n}?v=${ver}">`).join("") + "</noscript>\n  " + MARK_B;
    let html = html0;
    if (html.includes(MARK_A)) html = html.replace(new RegExp(MARK_A + "[\\s\\S]*?" + MARK_B), () => block);
    else {
      // the first stylesheet link becomes the block; the other links (and their noscript copies) go
      let first = true;
      html = html.replace(/(<link rel="stylesheet" href="assets\/css\/[a-z-]+\.css\?v=[^"]+"[^>]*>)(<noscript><link rel="stylesheet" href="assets\/css\/[a-z-]+\.css\?v=[^"]+"><\/noscript>)?\n?\s*/g, () => { if (first) { first = false; return block + "\n  "; } return ""; });
    }
    fs.writeFileSync(path.join(ROOT, file), html);
    report.push(`${file.padEnd(15)} ${names.join(" + ")} → inline ${(css.length / 1024).toFixed(1)} KB (${keep.size} of ${all.length} rules)`);
  }
  await browser.close();
  console.log(report.join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });
