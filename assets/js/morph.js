/* ==========================================================================
   BEHIX — particle word morph (home page intro)
   Particles flow from a rotating orb into each word from the admin panel
   (settings → home → morphItems) and cycle automatically every few seconds.
   Particles react to the pointer; the dots below jump to a word.
   ========================================================================== */

(function () {
  "use strict";
  const section = document.getElementById("morph");
  if (!section) return;
  const canvas = section.querySelector(".morph-canvas");
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DEFAULT_ITEMS = [
    { word: "ایده", caption: "همه‌چیز از یک ایده شروع می‌شود" },
    { word: "طراحی", caption: "ایده را به طراحی دیدنی و ماندگار تبدیل می‌کنیم" },
    { word: "هوش مصنوعی", caption: "با هوش مصنوعی، سریع‌تر و هوشمندتر می‌سازیم" },
    { word: "اتوماسیون", caption: "کارهای تکراری را به کد می‌سپاریم" },
    { word: "BEHIX", caption: "از ایده تا اتوماسیون، کنار کسب‌وکار شما" },
  ];
  const DEFAULT_INTRO = "به بهیکس خوش آمدید؛ جایی که ایده‌ها جان می‌گیرند";
  const PALETTE = ["#ffe0b8", "#ffbe5c", "#ff9a3c", "#ff7a1a", "#f8fafc", "#7dd3fc"];
  const GLYPHS = ["</>", "{ }", "=>", "( )", "[ ]", "&&", "//", "fn", "<X/>", ";"];

  let W = 0, H = 0, DPR = 1, N = 0;
  let shapes = []; // per stage: { pts:[{x,y,z,c,orb}], size }
  let P = [];
  let glyphs = [];
  let bufs = null; // per-colour Float32Array(x, y, size …) reused every frame
  const counts = new Int32Array(6);
  let stagePos = 0, from = 0, to = 0, tStart = 0, tDur = 1500;
  let running = false, visible = true, built = false;
  let interval = 3500, timer = null, last = performance.now(), time = 0;
  const mouse = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0 };
  let items = DEFAULT_ITEMS;
  let intro = DEFAULT_INTRO;

  let brandColor = "#ff7a1a", brandAt = 0;
  const brand = () => {
    const now = performance.now();
    if (now - brandAt > 2000) {
      brandColor = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#ff7a1a";
      brandAt = now;
    }
    return brandColor;
  };

  // ------------------------------------------------------------ shapes
  function sampleText(text, isLogo) {
    const off = document.createElement("canvas");
    // Phones: long multi-word phrases wrap onto two lines so letters stay big
    const words = String(text).trim().split(/\s+/);
    const twoLines = !isLogo && W < 640 && words.length > 1;
    const lines = twoLines ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [text];
    const ow = Math.round(Math.min(1500, W * 0.92));
    const oh = Math.round(twoLines ? Math.min(H * 0.46, ow * 0.95) : Math.min(H * 0.5, ow * 0.5));
    off.width = ow;
    off.height = oh;
    const o = off.getContext("2d", { willReadFrequently: true });
    const latin = /^[A-Za-z0-9 .&+-]+$/.test(text);
    let size = (oh / lines.length) * 0.92;
    const font = (s) => `900 ${s}px Vazirmatn, Tahoma, sans-serif`;
    o.font = font(size);
    const widest = () => Math.max(...lines.map((l) => o.measureText(l).width));
    while (widest() > ow * 0.94 && size > 18) {
      size *= 0.94;
      o.font = font(size);
    }
    o.textBaseline = "middle";
    if (isLogo) {
      const full = o.measureText(text).width;
      const xw = o.measureText("X").width;
      o.direction = "ltr";
      o.textAlign = "left";
      o.fillStyle = "#ffffff";
      o.fillText(text.slice(0, -1), ow / 2 - full / 2, oh / 2);
      o.fillStyle = "#ff7a1a";
      o.fillText("X", ow / 2 + full / 2 - xw, oh / 2);
    } else {
      o.direction = latin ? "ltr" : "rtl";
      o.textAlign = "center";
      const g = o.createLinearGradient(0, 0, 0, oh);
      g.addColorStop(0, "#ffe0b8");
      g.addColorStop(0.55, "#ff9a3c");
      g.addColorStop(1, "#ff7a1a");
      o.fillStyle = g;
      const lh = size * 1.12;
      lines.forEach((l, k) => o.fillText(l, ow / 2, oh / 2 + (k - (lines.length - 1) / 2) * lh));
    }
    const data = o.getImageData(0, 0, ow, oh).data;
    let filled = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 140) filled++;
    // Grid step so that the glyphs get close to N samples → crisp, dense letters
    const step = Math.max(2, Math.sqrt(filled / N));
    const pts = [];
    for (let y = step / 2; y < oh; y += step) {
      for (let x = step / 2; x < ow; x += step) {
        const k = ((y | 0) * ow + (x | 0)) * 4;
        if (data[k + 3] < 140) continue;
        const r = data[k], gch = data[k + 1], b = data[k + 2];
        const c = r > 230 && gch > 230 && b > 230 ? 4 : gch > 200 ? 0 : gch > 165 ? 1 : gch > 135 ? 2 : 3;
        pts.push({ x: x - ow / 2, y: y - oh / 2 - H * 0.06, z: (Math.random() - 0.5) * 10, c });
      }
    }
    return { pts: fit(pts), size: Math.max(1.4, step * 0.82) };
  }

  function sphere() {
    const R = Math.min(W, H) * 0.25;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const phi = Math.acos(1 - 2 * t);
      const th = Math.PI * (1 + Math.sqrt(5)) * i;
      const rr = R * (0.94 + Math.random() * 0.1);
      pts.push({ x: rr * Math.sin(phi) * Math.cos(th), y: rr * Math.cos(phi) - H * 0.06, z: rr * Math.sin(phi) * Math.sin(th), c: Math.random() < 0.1 ? 5 : 1 + (i % 3), orb: true });
    }
    return { pts, size: W < 640 ? 1.6 : 1.9 };
  }

  function fit(pts) {
    if (!pts.length) return sphere().pts;
    let out;
    if (pts.length >= N) {
      const k = pts.length / N;
      out = Array.from({ length: N }, (_, i) => pts[Math.floor(i * k)]);
    } else {
      out = pts.slice();
      while (out.length < N) out.push({ ...pts[(Math.random() * pts.length) | 0], z: (Math.random() - 0.5) * 30 });
    }
    for (let i = out.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function build() {
    const r = canvas.getBoundingClientRect();
    W = r.width;
    // Phones: 1.5x is visually the same for square particles and fills ~45% fewer pixels
    DPR = Math.min(W < 640 ? 1.5 : 2, window.devicePixelRatio || 1);
    H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    N = W < 640 ? 1400 : W < 1100 ? 2600 : 3400;
    shapes = [sphere(), ...items.map((it) => sampleText(it.word, /^[A-Za-z]+X$/.test(it.word)))];
    if (P.length !== N) {
      P = Array.from({ length: N }, () => ({
        x: W / 2 + (Math.random() - 0.5) * W * 1.4, y: H / 2 + (Math.random() - 0.5) * H * 1.4,
        d: Math.random(), a: Math.random() * Math.PI * 2, s: 0.8 + Math.random() * 0.4,
      }));
    }
    glyphs = Array.from({ length: W < 640 ? 10 : 22 }, () => ({
      g: GLYPHS[(Math.random() * GLYPHS.length) | 0], x: Math.random() * W, y: Math.random() * H,
      v: 0.15 + Math.random() * 0.35, s: 11 + 3 * Math.floor(Math.random() * 4), o: 0.05 + Math.random() * 0.1,
    })).sort((a, b) => a.s - b.s);
    built = true;
  }

  // ------------------------------------------------------------ sequencing
  function goTo(i) {
    const n = shapes.length;
    from = stagePos;
    to = ((i % n) + n) % n;
    tStart = performance.now();
    tDur = 1500;
    showCaption(to);
  }
  function next() { goTo(Math.round(to) + 1); }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (visible && !document.hidden) next();
      schedule();
    }, interval + tDur);
  }

  // Terminal-style typed caption
  let typeTimer;
  function showCaption(i) {
    const cap = section.querySelector(".morph-caption .txt");
    const text = i === 0 ? intro : items[i - 1]?.caption || "";
    clearInterval(typeTimer);
    let k = 0;
    cap.textContent = "";
    typeTimer = setInterval(() => {
      k += 1;
      cap.textContent = text.slice(0, k);
      if (k >= text.length) clearInterval(typeTimer);
    }, Math.max(14, Math.min(40, 900 / Math.max(1, text.length))));
    section.querySelectorAll(".morph-dots button").forEach((d, j) => {
      d.classList.toggle("is-on", j === i);
      d.setAttribute("aria-current", j === i ? "true" : "false");
    });
    section.querySelector(".morph-word").textContent = i === 0 ? "hello" : items[i - 1]?.word || "";
  }

  // ------------------------------------------------------------ render
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    // paused while a menu covers it (mobile sheet or the desktop services menu)
    const rc = document.documentElement.classList;
    if (!visible || !built || rc.contains("menu-open") || rc.contains("mega-open")) return;
    const dt = Math.min(50, now - last);
    last = now;
    time += dt / 1000;

    // progress between `from` and `to`
    const k = Math.min(1, (now - tStart) / tDur);
    const t = ease(k);
    const i0 = Math.round(from) % shapes.length;
    const i1 = to;
    const A = shapes[i0], B = shapes[i1];
    stagePos = k >= 1 ? to : from;

    mouse.sx += (mouse.nx - mouse.sx) * 0.06;
    mouse.sy += (mouse.ny - mouse.sy) * 0.06;
    const textMode = !(A.pts[0].orb && B.pts[0].orb);
    const yaw = Math.sin(time * 0.4) * (textMode ? 0.08 : 0.2) + mouse.sx * 0.22;
    const pitch = mouse.sy * 0.14;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const spin = time * 0.45;
    const cs = Math.cos(spin), ss = Math.sin(spin);
    const F = 1000;

    ctx.clearRect(0, 0, W, H);

    // floating code glyphs
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffbe5c";
    let curSize = 0;
    for (const g of glyphs) {
      g.y -= g.v;
      if (g.y < -20) { g.y = H + 20; g.x = Math.random() * W; }
      ctx.globalAlpha = g.o;
      if (g.s !== curSize) { curSize = g.s; ctx.font = `600 ${g.s}px ui-monospace, Menlo, Consolas, monospace`; }
      ctx.fillText(g.g, g.x, g.y);
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "lighter";
    const sizeA = A.size, sizeB = B.size;
    if (!bufs || bufs[0].length < N * 3) bufs = PALETTE.map(() => new Float32Array(N * 3));
    counts.fill(0);
    for (let n = 0; n < N; n++) {
      const p = P[n];
      const a = A.pts[n], b = B.pts[n];
      let ax = a.x, az = a.z, bx = b.x, bz = b.z;
      if (a.orb) { ax = a.x * cs - a.z * ss; az = a.x * ss + a.z * cs; }
      if (b.orb) { bx = b.x * cs - b.z * ss; bz = b.x * ss + b.z * cs; }
      const tt = smooth(Math.min(1, Math.max(0, (t - p.d * 0.3) / 0.7)));
      const sw = Math.sin(Math.PI * tt) * (70 + p.d * 150);
      const ang = p.a + tt * 4.5;
      const x = ax + (bx - ax) * tt + Math.cos(ang) * sw;
      const y = a.y + (b.y - a.y) * tt + Math.sin(ang) * sw * 0.5;
      const z = az + (bz - az) * tt + Math.sin(ang * 1.7) * sw;
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const sc = F / (F + z2);
      let px = W / 2 + x1 * sc, py = H / 2 + y1 * sc;
      const dx = px - mouse.x, dy = py - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 9000) {
        const f = (1 - d2 / 9000) * 30;
        const d = Math.sqrt(d2) || 1;
        px += (dx / d) * f;
        py += (dy / d) * f;
      }
      p.x += (px - p.x) * 0.2;
      p.y += (py - p.y) * 0.2;
      const sz = (sizeA + (sizeB - sizeA) * tt) * sc * p.s;
      const ci = tt < 0.5 ? a.c : b.c, buf = bufs[ci];
      let o = counts[ci];
      buf[o++] = p.x - sz / 2; buf[o++] = p.y - sz / 2; buf[o++] = sz;
      counts[ci] = o;
    }
    for (let c = 0; c < PALETTE.length; c++) {
      const arr = bufs[c], len = counts[c];
      if (!len) continue;
      ctx.fillStyle = c === 3 ? brand() : PALETTE[c];
      for (let q = 0; q < len; q += 3) ctx.fillRect(arr[q], arr[q + 1], arr[q + 2], arr[q + 2]);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ------------------------------------------------------------ boot
  function readSettings() {
    const home = window.BX?.settings?.home || {};
    if (Array.isArray(home.morphItems) && home.morphItems.some((x) => x && x.word)) {
      items = home.morphItems.filter((x) => x && x.word).map((x) => ({ word: String(x.word), caption: String(x.caption || "") }));
    } else if (Array.isArray(home.morphWords) && home.morphWords.length) {
      items = home.morphWords.map((w, i) => ({ word: w, caption: (home.morphCaptions || [])[i + 1] || "" }));
    }
    if (home.morphIntro) intro = home.morphIntro;
    const sec = Number(home.morphInterval);
    if (sec >= 1.5 && sec <= 30) interval = sec * 1000;
  }

  function start() {
    readSettings();
    section.querySelector(".morph-dots").innerHTML = [intro, ...items.map((x) => x.word)]
      .map((w, i) => `<button type="button" aria-label="${i === 0 ? "شروع" : String(w).replace(/[<>"&]/g, "")}"></button>`).join("");
    if (reduced) {
      section.classList.add("is-static");
      section.querySelector(".morph-caption .txt").textContent = items[items.length - 1]?.caption || intro;
      section.querySelector(".morph-word").textContent = items[items.length - 1]?.word || "";
      section.querySelector(".morph-dots button:last-child")?.classList.add("is-on");
      return;
    }
    build();
    showCaption(0);
    tStart = performance.now() - tDur; // start settled on the orb (particles fly in)
    running = true;
    requestAnimationFrame(frame);
    schedule();
    section.querySelector(".morph-dots").addEventListener("click", (e) => {
      const btns = [...section.querySelectorAll(".morph-dots button")];
      const i = btns.indexOf(e.target.closest("button"));
      if (i >= 0 && i !== to) { goTo(i); schedule(); }
    });
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(build, 200);
    });
    section.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.nx = (mouse.x / W - 0.5) * 2;
      mouse.ny = (mouse.y / H - 0.5) * 2;
    });
    section.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; mouse.nx = mouse.ny = 0; });
    // Touch: drag a finger through the particles; tap to blast them apart
    const touchAt = (t) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = t.clientX - r.left;
      mouse.y = t.clientY - r.top;
    };
    section.addEventListener("touchstart", (e) => touchAt(e.touches[0]), { passive: true });
    section.addEventListener("touchmove", (e) => touchAt(e.touches[0]), { passive: true });
    section.addEventListener("touchend", () => { mouse.x = mouse.y = -9999; }, { passive: true });
    section.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a, button")) return;
      const r = canvas.getBoundingClientRect();
      const bx = e.clientX - r.left, by = e.clientY - r.top, R = W < 640 ? 150 : 220;
      for (const p of P) {
        const dx = p.x - bx, dy = p.y - by, d = Math.hypot(dx, dy) || 1;
        if (d < R) { const f = (1 - d / R) * (W < 640 ? 110 : 160); p.x += (dx / d) * f; p.y += (dy / d) * f; }
      }
      navigator.vibrate?.(10);
    });
    // Tilt the orb with the phone (where the browser allows it without a prompt)
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== "function" && matchMedia("(pointer: coarse)").matches) {
      window.addEventListener("deviceorientation", (e) => {
        if (e.gamma == null) return;
        mouse.nx = Math.max(-1, Math.min(1, e.gamma / 30));
        mouse.ny = Math.max(-1, Math.min(1, (e.beta - 45) / 40));
      });
    }
    if ("IntersectionObserver" in window) new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(section);
  }

  const fontReady = document.fonts ? document.fonts.load('900 80px "Vazirmatn"').catch(() => {}) : Promise.resolve();
  Promise.all([window.BX?.ready?.catch(() => {}) || Promise.resolve(), fontReady]).then(start);
})();
