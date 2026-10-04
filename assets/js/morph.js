/* ==========================================================================
   BEHIX — scroll-driven particle morph (home page intro)
   A pinned section where ~2000 particles flow from a rotating orb into each
   word from settings (home.morphWords) and finally the BEHIX logo, driven by
   the scroll position. Particles also react to the pointer.
   ========================================================================== */

(function () {
  "use strict";
  const section = document.getElementById("morph");
  if (!section) return;
  const canvas = section.querySelector(".morph-canvas");
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DEFAULT_WORDS = ["ایده", "طراحی", "هوش مصنوعی", "BEHIX"];
  const DEFAULT_CAPTIONS = [
    "به بهیکس خوش آمدید؛ جایی که ایده‌ها جان می‌گیرند",
    "همه‌چیز از یک ایده شروع می‌شود",
    "ایده را به طراحی دیدنی و ماندگار تبدیل می‌کنیم",
    "با هوش مصنوعی، سریع‌تر و هوشمندتر می‌سازیم",
    "از ایده تا اتوماسیون، کنار کسب‌وکار شما",
  ];
  // Palette (index → colour); words use the warm shades, BEHI is light, X is brand
  const PALETTE = ["#ffd8a8", "#ffb347", "#ff9a3c", "#ff7a1a", "#f1f5f9", "#7dd3fc"];

  let W = 0, H = 0, DPR = 1, N = 0;
  let shapes = []; // [{x,y,z,c}] per stage
  let P = []; // particles
  let stagePos = 0, targetStage = 0, time = 0, running = false, visible = true, built = false;
  const mouse = { x: -9999, y: -9999, nx: 0, ny: 0 };
  let captions = DEFAULT_CAPTIONS;
  let words = DEFAULT_WORDS;

  const brand = () => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#ff7a1a";

  // ------------------------------------------------------------ shapes
  function sampleText(text, isLogo) {
    const off = document.createElement("canvas");
    const ow = Math.min(1400, Math.round(W * 0.9));
    const oh = Math.round(Math.min(H * 0.42, ow * 0.45));
    off.width = ow;
    off.height = oh;
    const o = off.getContext("2d", { willReadFrequently: true });
    const latin = /^[A-Za-z0-9 ]+$/.test(text);
    let size = oh * 0.9;
    const font = (s) => `900 ${s}px ${latin ? "Vazirmatn, sans-serif" : "Vazirmatn, Tahoma, sans-serif"}`;
    o.font = font(size);
    while (o.measureText(text).width > ow * 0.92 && size > 20) {
      size *= 0.92;
      o.font = font(size);
    }
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.direction = latin ? "ltr" : "rtl";
    if (isLogo) {
      // Draw BEHI light and X in brand colour so particles inherit the colours
      const full = o.measureText(text).width;
      const xw = o.measureText("X").width;
      o.textAlign = "left";
      o.direction = "ltr";
      o.fillStyle = "#ffffff";
      o.fillText(text.slice(0, -1), ow / 2 - full / 2, oh / 2);
      o.fillStyle = "#ff7a1a";
      o.fillText("X", ow / 2 + full / 2 - xw, oh / 2);
    } else {
      const g = o.createLinearGradient(0, 0, 0, oh);
      g.addColorStop(0, "#ffd8a8");
      g.addColorStop(1, "#ff7a1a");
      o.fillStyle = g;
      o.fillText(text, ow / 2, oh / 2);
    }
    const data = o.getImageData(0, 0, ow, oh).data;
    // Choose a grid step that yields roughly N points
    let filled = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 128) filled++;
    const step = Math.max(2, Math.round(Math.sqrt((filled * 4) / N)));
    const pts = [];
    for (let y = 0; y < oh; y += step) {
      for (let x = 0; x < ow; x += step) {
        const k = (y * ow + x) * 4;
        if (data[k + 3] < 128) continue;
        const r = data[k], gch = data[k + 1], b = data[k + 2];
        let c;
        if (r > 230 && gch > 230 && b > 230) c = 4;
        else c = gch > 200 ? 0 : gch > 170 ? 1 : gch > 140 ? 2 : 3;
        pts.push({ x: x - ow / 2, y: y - oh / 2 - H * 0.05, z: (Math.random() - 0.5) * 40, c });
      }
    }
    return fit(pts);
  }

  function sphere() {
    const R = Math.min(W, H) * 0.24;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const phi = Math.acos(1 - 2 * t);
      const th = Math.PI * (1 + Math.sqrt(5)) * i;
      const rr = R * (0.92 + Math.random() * 0.12);
      pts.push({ x: rr * Math.sin(phi) * Math.cos(th), y: rr * Math.cos(phi) - H * 0.05, z: rr * Math.sin(phi) * Math.sin(th), c: Math.random() < 0.12 ? 5 : 1 + (i % 3), orb: true });
    }
    return pts;
  }

  // Resize a point list to exactly N entries and shuffle (random pairing makes the flow)
  function fit(pts) {
    if (!pts.length) return sphere();
    const out = [];
    for (let i = 0; i < N; i++) out.push(i < pts.length ? pts[i] : { ...pts[(Math.random() * pts.length) | 0], z: (Math.random() - 0.5) * 60 });
    if (pts.length > N) {
      // keep an even subsample
      const k = pts.length / N;
      for (let i = 0; i < N; i++) out[i] = pts[Math.floor(i * k)];
    }
    for (let i = out.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function build() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    N = W < 640 ? 1100 : W < 1100 ? 1600 : 2200;
    shapes = [sphere(), ...words.map((w, i) => sampleText(w, i === words.length - 1 && /^[A-Za-z]+X$/i.test(w)))];
    const keep = P.length === N;
    if (!keep) {
      P = Array.from({ length: N }, () => ({
        x: (Math.random() - 0.5) * W * 1.6, y: (Math.random() - 0.5) * H * 1.6, z: (Math.random() - 0.5) * 600,
        d: Math.random(), a: Math.random() * Math.PI * 2, s: 0.7 + Math.random() * 0.9,
      }));
    }
    built = true;
  }

  // ------------------------------------------------------------ scroll → stage
  function readScroll() {
    const r = section.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    const raw = p * (shapes.length - 1);
    // Hold on each shape for a while, then move quickly to the next
    const i = Math.floor(raw);
    const f = raw - i;
    const eased = f < 0.3 ? 0 : f > 0.85 ? 1 : (f - 0.3) / 0.55;
    targetStage = Math.min(shapes.length - 1, i + eased);
    section.style.setProperty("--p", p.toFixed(3));
  }

  let shownStage = -1;
  function updateCaption() {
    const s = Math.round(stagePos);
    if (s === shownStage) return;
    shownStage = s;
    const cap = section.querySelector(".morph-caption");
    cap.classList.remove("is-in");
    void cap.offsetWidth;
    cap.textContent = captions[s] || "";
    cap.classList.add("is-in");
    section.querySelectorAll(".morph-dots i").forEach((d, i) => d.classList.toggle("is-on", i === s));
    section.classList.toggle("is-final", s === shapes.length - 1);
  }

  // ------------------------------------------------------------ render
  const smooth = (t) => t * t * (3 - 2 * t);
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible || !built) return;
    time += 0.016;
    stagePos += (targetStage - stagePos) * 0.08;
    updateCaption();

    const i0 = Math.floor(stagePos);
    const i1 = Math.min(shapes.length - 1, i0 + 1);
    const t = stagePos - i0;
    const A = shapes[i0], B = shapes[i1];
    const yaw = Math.sin(time * 0.35) * 0.22 + mouse.nx * 0.35;
    const pitch = mouse.ny * 0.18 + Math.sin(time * 0.27) * 0.05;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const spin = time * 0.5;
    const cs = Math.cos(spin), ss = Math.sin(spin);
    const F = 900;

    ctx.clearRect(0, 0, W, H);
    // orbit rings
    ctx.save();
    ctx.translate(W / 2, H / 2 - H * 0.05);
    ctx.globalAlpha = 0.18 * (1 - Math.min(1, stagePos));
    ctx.strokeStyle = brand();
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.min(W, H) * (0.3 + k * 0.07), Math.min(W, H) * (0.08 + k * 0.03), spin * (k % 2 ? -0.3 : 0.3) + k, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalCompositeOperation = "lighter";
    const buckets = PALETTE.map(() => []);
    for (let n = 0; n < N; n++) {
      const p = P[n];
      let a = A[n], b = B[n];
      // the orb keeps spinning
      let ax = a.x, az = a.z, bx = b.x, bz = b.z;
      if (a.orb) { ax = a.x * cs - a.z * ss; az = a.x * ss + a.z * cs; }
      if (b.orb) { bx = b.x * cs - b.z * ss; bz = b.x * ss + b.z * cs; }
      // staggered, swirling transition
      const tt = smooth(Math.min(1, Math.max(0, (t - p.d * 0.35) / 0.65)));
      const sw = Math.sin(Math.PI * tt) * (90 + p.d * 160);
      const ang = p.a + tt * 5;
      let x = ax + (bx - ax) * tt + Math.cos(ang) * sw;
      let y = a.y + (b.y - a.y) * tt + Math.sin(ang) * sw * 0.55;
      let z = az + (bz - az) * tt + Math.sin(ang * 1.7) * sw;
      // gentle breathing
      y += Math.sin(time * 1.6 + p.a * 3) * 1.5;
      // rotate scene
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const sc = F / (F + z2);
      let px = W / 2 + x1 * sc, py = H / 2 + y1 * sc;
      // pointer repulsion
      const dx = px - mouse.x, dy = py - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 12000) {
        const f = (1 - d2 / 12000) * 38;
        const d = Math.sqrt(d2) || 1;
        px += (dx / d) * f;
        py += (dy / d) * f;
      }
      p.x += (px - p.x) * 0.14;
      p.y += (py - p.y) * 0.14;
      const c = tt < 0.5 ? a.c : b.c;
      buckets[c].push(p.x, p.y, Math.max(0.6, 1.9 * sc * p.s));
    }
    for (let c = 0; c < buckets.length; c++) {
      const arr = buckets[c];
      ctx.fillStyle = c === 3 ? brand() : PALETTE[c];
      for (let k = 0; k < arr.length; k += 3) ctx.fillRect(arr[k], arr[k + 1], arr[k + 2], arr[k + 2]);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ------------------------------------------------------------ boot
  function start() {
    const home = window.BX?.settings?.home || {};
    if (Array.isArray(home.morphWords) && home.morphWords.length) words = home.morphWords.slice(0, 8);
    if (Array.isArray(home.morphCaptions) && home.morphCaptions.length) captions = home.morphCaptions;
    section.style.setProperty("--stages", words.length + 1);
    section.querySelector(".morph-dots").innerHTML = Array.from({ length: words.length + 1 }, () => "<i></i>").join("");
    if (reduced) {
      section.classList.add("is-static", "is-final");
      section.querySelector(".morph-caption").textContent = captions[captions.length - 1] || "";
      return;
    }
    build();
    readScroll();
    stagePos = 0;
    running = true;
    frame();
    window.addEventListener("scroll", readScroll, { passive: true });
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { build(); readScroll(); }, 200);
    });
    section.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.nx = (mouse.x / W - 0.5) * 2;
      mouse.ny = (mouse.y / H - 0.5) * 2;
    });
    section.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; mouse.nx = mouse.ny = 0; });
    if ("IntersectionObserver" in window) new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(section);
  }

  const fontReady = document.fonts ? document.fonts.load('900 80px "Vazirmatn"').catch(() => {}) : Promise.resolve();
  Promise.all([window.BX?.ready?.catch(() => {}) || Promise.resolve(), fontReady]).then(start);
})();
