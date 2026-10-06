/* ==========================================================================
   BEHIX — admin blog: posts list and a simple visual editor with SEO preview.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const BXD = window.BXD;
  const { icon, esc, faDigits, ago } = BX;
  const ST = { posts: null };

  BXD.routes.blog = function (param) {
    return `<div data-blog-admin="${esc(param || "")}"><div class="card box skeleton" style="height:320px"></div></div>`;
  };

  async function listView(el) {
    const { box, table } = BXD.ui;
    const r = await BX.api("a.post.list");
    ST.posts = r.posts;
    const pub = r.posts.filter((p) => p.status === "published");
    el.innerHTML = `<div class="dash-grid">
      <div class="tiles">
        ${BXD.ui.tile("مطالب منتشرشده", faDigits(pub.length), "book")}
        ${BXD.ui.tile("پیش‌نویس", faDigits(r.posts.length - pub.length), "edit")}
        ${BXD.ui.tile("کل بازدید", faDigits(r.posts.reduce((s, p) => s + p.views, 0)), "eye")}
        ${BXD.ui.tile("پربازدیدترین", esc((pub.slice().sort((a, b) => b.views - a.views)[0] || {}).title || "—"), "trend")}
      </div>
      ${box("مطالب وبلاگ", "book", table(["عنوان", "دسته", "وضعیت", "بازدید", "تاریخ", ""], r.posts.map((p) => `<tr>
          <td><b>${esc(p.title)}</b></td><td>${esc(p.category || "—")}</td>
          <td>${p.status === "published" ? (p.publishedAt > Date.now() ? '<span class="badge badge--info">زمان‌بندی‌شده</span>' : '<span class="badge badge--ok">منتشرشده</span>') : '<span class="badge">پیش‌نویس</span>'}</td>
          <td>${faDigits(p.views)}</td><td class="muted">${p.publishedAt ? BX.date(p.publishedAt) : ago(p.updatedAt)}</td>
          <td><div class="actions"><a class="btn btn-ghost btn-xs" href="#blog/${p.id}">${icon("edit")} ویرایش</a><a class="btn btn-ghost btn-xs" href="blog.html?p=${encodeURIComponent(p.slug)}" target="_blank">${icon("external")}</a>
            <button class="icon-btn icon-btn-sm" data-act="post-delete" data-id="${p.id}" aria-label="حذف">${icon("trash")}</button></div></td></tr>`),
        "هنوز مطلبی ننوشته‌اید. اولین مطلب را با موضوعی بنویسید که مشتری‌هایتان در گوگل جستجو می‌کنند."),
        `<a class="btn btn-primary btn-sm" href="#blog/new">${icon("plus")} مطلب جدید</a><a class="btn btn-ghost btn-sm" href="blog.html" target="_blank">${icon("external")} وبلاگ</a>`)}
      <div class="banner banner--info">${icon("info")}<span><b>نکته سئو:</b> هر هفته ۱ تا ۲ مطلب ۸۰۰+ کلمه‌ای درباره سؤال‌های واقعی مشتری‌ها بنویسید (مثل «قیمت طراحی لوگو ۱۴۰۵»، «سایت فروشگاهی چقدر هزینه دارد»)، در متن به صفحه خدمت مرتبط لینک بدهید و عنوان‌های H2 بگذارید.</span></div>
    </div>`;
    BXD.labelTables?.(el);
  }

  const TOOLS = [["h2", "عنوان ۲", "H2"], ["h3", "عنوان ۳", "H3"], ["bold", "پررنگ", "B"], ["italic", "کج", "I"], ["ul", "فهرست", "•"], ["ol", "فهرست شماره‌دار", "۱."], ["quote", "نقل‌قول", "❝"], ["link", "لینک", "🔗"], ["image", "تصویر", "🖼"], ["clear", "حذف قالب", "⌫"], ["html", "کد HTML", "</>"]];

  async function editView(el, id) {
    let p = { title: "", slug: "", excerpt: "", body: "", category: "", tags: [], status: "draft", seoTitle: "", seoDesc: "", cover: null, publishedAt: null };
    if (id !== "new") p = (await BX.api("a.post.get", { id })).post;
    const local = (ms) => { if (!ms) return ""; const d = new Date(ms - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
    const svcLinks = (BX.CATALOG || []).flatMap((c) => c.services).map((s) => `<option value="service.html?id=${esc(s.id)}">${esc(s.title)}</option>`).join("");
    el.innerHTML = `<form class="blog-edit" data-post-form>
      <div class="be-main card">
        <input class="be-title" name="title" value="${esc(p.title)}" placeholder="عنوان مطلب" required maxlength="255">
        <div class="be-toolbar">${TOOLS.map(([k, t, l]) => `<button type="button" data-cmd="${k}" title="${t}">${l}</button>`).join("")}
          <select data-cmd-link title="لینک به صفحه خدمت"><option value="">لینک به خدمت…</option>${svcLinks}</select></div>
        <div class="be-body post-body" contenteditable="true" data-ph="متن مطلب را این‌جا بنویسید… از «عنوان ۲» برای تیترهای اصلی استفاده کنید.">${p.body || ""}</div>
        <textarea class="be-html textarea" hidden spellcheck="false" dir="ltr"></textarea>
        <div class="be-count muted small" data-count></div>
      </div>
      <aside class="be-side">
        <div class="card box"><h3 class="be-h">${icon("send")} انتشار</h3>
          <label class="switch"><input type="checkbox" name="published" ${p.status === "published" ? "checked" : ""}><span class="track"></span>منتشر شود</label>
          <div class="field mt-1"><label class="field-label">زمان انتشار (خالی = همین حالا)</label><input class="input" type="datetime-local" name="publishedAt" value="${local(p.publishedAt)}" dir="ltr"></div>
          <div class="row mt-2"><button class="btn btn-primary btn-sm" type="submit">${icon("check")} ذخیره</button>${p.slug ? `<a class="btn btn-ghost btn-sm" href="blog.html?p=${encodeURIComponent(p.slug)}" target="_blank">${icon("eye")} مشاهده</a>` : ""}<a class="btn btn-ghost btn-sm" href="#blog">بازگشت</a></div>
        </div>
        <div class="card box"><h3 class="be-h">${icon("image")} تصویر شاخص</h3>
          <label class="be-cover" data-cover style="${p.cover ? `background-image:url('api/index.php?r=file&id=${esc(p.cover)}')` : ""}">${p.cover ? "" : `${icon("upload")}<small>انتخاب تصویر (۱۲۰۰×۶۷۵)</small>`}<input type="file" name="cover" accept="image/*" hidden></label>
          ${p.cover ? `<label class="switch small mt-1"><input type="checkbox" name="removeCover"><span class="track"></span>حذف تصویر</label>` : ""}
        </div>
        <div class="card box"><h3 class="be-h">${icon("tag")} دسته و برچسب</h3>
          <div class="field"><label class="field-label">دسته</label><input class="input" name="category" value="${esc(p.category)}" placeholder="مثلاً طراحی سایت" list="be-cats"><datalist id="be-cats">${[...new Set((ST.posts || []).map((x) => x.category).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
          <div class="field"><label class="field-label">برچسب‌ها (با کاما)</label><input class="input" name="tags" value="${esc(p.tags.join("، "))}"></div>
          <div class="field"><label class="field-label">خلاصه (در لیست وبلاگ)</label><textarea class="textarea" name="excerpt" rows="3" maxlength="600">${esc(p.excerpt)}</textarea></div>
        </div>
        <div class="card box"><h3 class="be-h">${icon("search")} سئو</h3>
          <div class="field"><label class="field-label">آدرس (slug)</label><input class="input" name="slug" value="${esc(p.slug)}" placeholder="خودکار از عنوان" dir="auto"></div>
          <div class="field"><label class="field-label">عنوان در گوگل <small data-len="seoTitle"></small></label><input class="input" name="seoTitle" value="${esc(p.seoTitle)}" placeholder="خالی = عنوان مطلب" maxlength="255"></div>
          <div class="field"><label class="field-label">توضیحات متا <small data-len="seoDesc"></small></label><textarea class="textarea" name="seoDesc" rows="3" maxlength="400" placeholder="۱۲۰ تا ۱۶۰ کاراکتر؛ خالی = خلاصه">${esc(p.seoDesc)}</textarea></div>
          <div class="serp" data-serp></div>
        </div>
      </aside>
    </form>`;
    const f = el.querySelector("[data-post-form]");
    const body = f.querySelector(".be-body");
    const html = f.querySelector(".be-html");
    const site = BX.settings.general?.siteNameFa || "بهیکس";
    const refresh = () => {
      const t = f.elements.seoTitle.value || f.elements.title.value || "عنوان مطلب";
      const d = f.elements.seoDesc.value || f.elements.excerpt.value || body.textContent.trim().slice(0, 160);
      const slug = f.elements.slug.value || f.elements.title.value.trim().replace(/\s+/g, "-");
      f.querySelector("[data-serp]").innerHTML = `<small dir="ltr">${esc(location.host)} › blog › ${esc(slug.slice(0, 40))}</small><b>${esc((t + " | " + site).slice(0, 65))}</b><p>${esc(d.slice(0, 160))}</p>`;
      const words = (html.hidden ? body.textContent : html.value.replace(/<[^>]+>/g, " ")).trim().split(/\s+/).filter(Boolean).length;
      f.querySelector("[data-count]").textContent = `${faDigits(words)} کلمه · حدود ${faDigits(Math.max(1, Math.round(words / 200)))} دقیقه مطالعه${words < 600 ? " — برای سئو بهتر، حداقل ۸۰۰ کلمه بنویسید" : ""}`;
      const lens = { seoTitle: [f.elements.seoTitle.value || f.elements.title.value, 60], seoDesc: [f.elements.seoDesc.value, 160] };
      for (const [k, [v, max]] of Object.entries(lens)) { const s = f.querySelector(`[data-len="${k}"]`); s.textContent = `(${faDigits(v.length)}/${faDigits(max)})`; s.className = v.length > max ? "bad" : "muted"; }
    };
    f.addEventListener("input", refresh);
    refresh();
    // toolbar
    const exec = (cmd, val) => { body.focus(); document.execCommand(cmd, false, val); refresh(); };
    f.querySelector(".be-toolbar").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-cmd]");
      if (!b || b.tagName === "SELECT") return;
      const c = b.dataset.cmd;
      if (c === "html") {
        if (html.hidden) { html.value = body.innerHTML; html.hidden = false; body.hidden = true; b.classList.add("is-on"); }
        else { body.innerHTML = html.value; html.hidden = true; body.hidden = false; b.classList.remove("is-on"); }
        return;
      }
      if (c === "h2" || c === "h3") return exec("formatBlock", `<${c}>`);
      if (c === "quote") return exec("formatBlock", "<blockquote>");
      if (c === "bold" || c === "italic") return exec(c);
      if (c === "ul") return exec("insertUnorderedList");
      if (c === "ol") return exec("insertOrderedList");
      if (c === "clear") { exec("removeFormat"); return exec("formatBlock", "<p>"); }
      if (c === "link") { const u = prompt("آدرس لینک (مثلاً service.html?id=logo یا https://…)"); if (u) exec("createLink", u); return; }
      if (c === "image") {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "image/*";
        inp.onchange = async () => {
          if (!inp.files[0]) return;
          const files = []; files.image = inp.files[0];
          try { const r = await BX.api("a.post.image", { id: id === "new" ? 0 : id }, files); exec("insertHTML", `<img src="${r.url}" alt="${esc(f.elements.title.value)}">`); }
          catch (err) { BX.toast(err.message, "bad"); }
        };
        inp.click();
      }
    });
    const sel = f.querySelector("[data-cmd-link]");
    sel.addEventListener("change", () => {
      if (!sel.value) return;
      const text = sel.options[sel.selectedIndex].text;
      const s = window.getSelection();
      if (s && s.toString()) exec("createLink", sel.value);
      else exec("insertHTML", `<a href="${sel.value}">${esc(text)}</a>&nbsp;`);
      sel.value = "";
    });
    const cover = f.elements.cover;
    cover.addEventListener("change", () => { if (cover.files[0]) { const c = f.querySelector("[data-cover]"); c.style.backgroundImage = `url('${URL.createObjectURL(cover.files[0])}')`; c.querySelectorAll("small, svg").forEach((x) => x.remove()); } });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const E = f.elements;
      const data = { id: id === "new" ? 0 : id, title: E.title.value, slug: E.slug.value, excerpt: E.excerpt.value, category: E.category.value, tags: E.tags.value,
        seoTitle: E.seoTitle.value, seoDesc: E.seoDesc.value, status: E.published.checked ? "published" : "draft",
        publishedAt: E.publishedAt.value ? new Date(E.publishedAt.value).toISOString() : "", body: html.hidden ? body.innerHTML : html.value };
      if (E.removeCover?.checked) data.removeCover = 1;
      const files = [];
      if (cover.files[0]) files.cover = cover.files[0];
      try {
        const r = await BX.api("a.post.save", data, files);
        BX.toast(r.message, "ok");
        if (id === "new") location.hash = `blog/${r.id}`;
        else E.slug.value = r.slug;
      } catch (err) { BX.toast(err.message, "bad"); }
    });
  }

  const prevAfter = BXD.afterRender;
  BXD.afterRender = (view, id, param) => {
    if (prevAfter) prevAfter(view, id, param);
    const el = view.querySelector("[data-blog-admin]");
    if (!el) return;
    (param ? editView(el, param) : listView(el)).catch((err) => { el.innerHTML = `<div class="card empty">${icon("info")}<p>${esc(err.message)}</p></div>`; });
  };
  Object.assign(BXD.acts, {
    "post-delete": (el) => BXD.ui.confirmBox("حذف مطلب", "مطلب و تصاویرش برای همیشه حذف می‌شود.", () => BX.api("a.post.delete", { id: el.dataset.id }).then(() => listView(document.querySelector("[data-blog-admin]"))), "حذف"),
  });
})();
