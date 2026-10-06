/* ==========================================================================
   BEHIX — Studio PowerPoint builder: write the slides, pick a theme, get an
   editable right-to-left .pptx built on the server. Includes ready-made
   outlines for common presentation types.
   ========================================================================== */

(function () {
  "use strict";
  const BX = window.BX;
  const ready = () => new Promise((ok) => { const t = () => (window.STUDIO ? ok(window.STUDIO) : setTimeout(t, 30)); t(); });

  ready().then((STUDIO) => {
    const H = STUDIO.h;
    const THEMES = [["orange", "نارنجی بهیکس", "#ff7a1a"], ["ocean", "اقیانوسی", "#38bdf8"], ["royal", "بنفش رسمی", "#a78bfa"], ["sunset", "غروب گرادیانی", "#ec4899"],
      ["mint", "نعنایی مدرن", "#14b8a6"], ["forest", "سبز طبیعی", "#16a34a"], ["noir", "مشکی و طلایی", "#d4af37"], ["mono", "سیاه‌وسفید", "#111111"]];
    const TYPES = [["bullets", "عنوان و نکته‌ها"], ["image", "عکس و متن"], ["two", "دو ستونه"], ["numbers", "آمار و اعداد"], ["timeline", "خط زمانی / مراحل"], ["quote", "نقل‌قول / پیام کلیدی"], ["section", "جداکننده بخش"]];
    const schema = [
      { title: "قالب", icon: "palette", fields: [
        { k: "theme", type: "tpl", label: "پوسته", options: THEMES },
        { k: "font", type: "select", label: "فونت فایل پاورپوینت", options: [["Tahoma", "Tahoma (روی همه سیستم‌ها)"], ["Vazirmatn", "وزیرمتن"], ["B Nazanin", "ب نازنین"], ["IRANSans", "ایران‌سنس"]], help: "اگر فونت روی سیستم ارائه نصب نیست، Tahoma را انتخاب کنید." },
      ] },
      { title: "اسلاید عنوان", icon: "presentation", fields: [{ k: "title", label: "عنوان ارائه", span: true }, { k: "subtitle", label: "زیرعنوان", span: true }, { k: "author", label: "ارائه‌دهنده" }, { k: "date", label: "تاریخ / مناسبت" }, { k: "logo", type: "image", label: "لوگو", max: 500 }] },
      { title: "اسلایدها", icon: "layers", fields: [{ k: "slides", type: "list", label: "اسلایدها", add: "افزودن اسلاید", max: 40, fields: [
        { k: "type", type: "select", label: "نوع", options: TYPES, def: "bullets" }, { k: "title", label: "عنوان اسلاید" },
        { k: "text", type: "textarea", label: "متن (هر خط یک نکته؛ آمار و مراحل: «عدد یا عنوان | توضیح»)", span: true },
        { k: "image", type: "image", label: "عکس (برای اسلاید عکس‌دار)", max: 1400, span: true },
      ] }] },
      { title: "اسلاید پایانی", icon: "check", fields: [{ k: "end", label: "متن پایانی", span: true, ph: "مثلاً با تشکر از توجه شما" }, { k: "contact", label: "راه ارتباطی", span: true, dir: "ltr" }] },
    ];
    const S = (type, title, text = "") => ({ type, title, text, image: "" });
    // Ready outlines: the usual structure of each kind of presentation
    const OUTLINES = {
      "ارائه استارتاپ / جذب سرمایه": [S("bullets", "مسئله", "مشتری امروز با چه مشکلی روبه‌روست؟\nاین مشکل چقدر هزینه دارد؟"), S("bullets", "راه‌حل ما", "محصول ما چه می‌کند\nچرا بهتر از روش‌های فعلی است"), S("numbers", "اندازه بازار", "۲۰ هزار میلیارد | کل بازار\n۲ هزار میلیارد | بازار در دسترس\n۲۰۰ میلیارد | سهم هدف"), S("two", "رقبا و مزیت ما", "رقیب الف: گران\nرقیب ب: کند\nما: ارزان‌تر\nما: سریع‌تر"), S("timeline", "مسیر رشد", "فاز ۱ | ساخت محصول\nفاز ۲ | ۱۰۰۰ کاربر\nفاز ۳ | درآمد پایدار\nفاز ۴ | توسعه بازار"), S("bullets", "مدل درآمد", "اشتراک ماهانه\nکارمزد فروش"), S("bullets", "تیم", "بنیان‌گذار — تجربه و تخصص\nهم‌بنیان‌گذار — تجربه و تخصص"), S("numbers", "درخواست سرمایه", "۵ میلیارد | مبلغ\n۱۸ ماه | زمان\n۱۰٪ | سهام")],
      "گزارش کار / عملکرد": [S("bullets", "خلاصه", "مهم‌ترین نتایج دوره\nچالش‌های اصلی"), S("numbers", "شاخص‌های کلیدی", "۲۴۰ | مشتری فعال\n۹۸٪ | رضایت\n۳۵٪ | رشد فروش"), S("timeline", "کارهای انجام‌شده", "فروردین | شروع پروژه\nتیر | تحویل فاز اول\nمهر | راه‌اندازی\nاسفند | جمع‌بندی"), S("two", "نقاط قوت و ضعف", "تیم متخصص\nکیفیت بالا\nبودجه محدود\nکمبود نیرو"), S("bullets", "برنامه دوره بعد", "هدف اول\nهدف دوم\nهدف سوم")],
      "دفاع پایان‌نامه": [S("bullets", "بیان مسئله", "اهمیت موضوع\nخلأ پژوهشی"), S("bullets", "اهداف و سؤالات پژوهش", "هدف اصلی\nسؤال اول\nسؤال دوم"), S("bullets", "پیشینه پژوهش", "مطالعه ۱ — نتیجه\nمطالعه ۲ — نتیجه"), S("timeline", "روش تحقیق", "جامعه | نمونه‌گیری\nابزار | پرسشنامه\nتحلیل | آزمون آماری"), S("numbers", "یافته‌ها", "۰٫۰۱ | سطح معناداری\n۸۵٪ | پایایی\n۳۸۴ | حجم نمونه"), S("bullets", "نتیجه‌گیری و پیشنهادها", "نتیجه اصلی\nپیشنهاد برای پژوهش‌های آینده"), S("quote", "", "با سپاس از استاد راهنما و مشاور")],
      "پیشنهاد فروش به مشتری": [S("bullets", "نیاز شما", "چالش فعلی مشتری\nهدفی که دارد"), S("bullets", "پیشنهاد ما", "خدمت اصلی\nخدمات جانبی"), S("image", "نمونه‌کارها", "پروژه ۱\nپروژه ۲\nپروژه ۳"), S("timeline", "مراحل اجرا", "هفته ۱ | جلسه و نیازسنجی\nهفته ۲ | طراحی\nهفته ۳ | اجرا\nهفته ۴ | تحویل"), S("numbers", "هزینه و زمان", "۴ هفته | زمان\n۲ مرحله | پرداخت\n۳ ماه | پشتیبانی"), S("quote", "مشتریان ما", "همکاری با این تیم بهترین تصمیم ما بود.")],
      "کارگاه آموزشی": [S("bullets", "اهداف کارگاه", "بعد از این جلسه می‌توانید…"), S("section", "بخش اول: مفاهیم پایه"), S("bullets", "مفهوم اول", "تعریف\nمثال"), S("section", "بخش دوم: کار عملی"), S("timeline", "گام‌ها", "۱ | آماده‌سازی\n۲ | اجرا\n۳ | بررسی"), S("bullets", "جمع‌بندی و تمرین", "نکته کلیدی\nتمرین خانگی")],
      "معرفی شرکت": [S("bullets", "ما که هستیم", "داستان شکل‌گیری\nمأموریت و چشم‌انداز"), S("numbers", "در یک نگاه", "۱۰ سال | تجربه\n۵۰۰+ | مشتری\n۳ | شعبه"), S("two", "خدمات ما", "خدمت ۱\nخدمت ۲\nخدمت ۳\nخدمت ۴"), S("image", "پروژه‌های شاخص", "پروژه ۱\nپروژه ۲"), S("quote", "مشتریان درباره ما", "کیفیت و تعهد این مجموعه بی‌نظیر است.")],
    };
    const defaults = () => ({
      theme: "orange", font: "Tahoma", title: "عنوان ارائه شما", subtitle: "زیرعنوان یا موضوع جلسه", author: BX.me?.name || "", date: "", logo: "",
      slides: [S("bullets", "مقدمه", "مسئله‌ای که حل می‌کنیم\nمخاطب ما چه کسانی هستند\nچرا همین حالا"), S("numbers", "در یک نگاه", "۲۴۰ | مشتری فعال\n۹۸٪ | رضایت مشتری\n۳ | شهر"), S("quote", "پیام کلیدی", "یک جمله که می‌خواهید مخاطب به خاطر بسپارد.")],
      end: "با تشکر از توجه شما", contact: "",
    });
    function smart(el, d, refresh) {
      const list = Object.keys(OUTLINES).map((k) => [k, () => { d.slides = OUTLINES[k].map((x) => ({ ...x })); if (!d.title || d.title === "عنوان ارائه شما") d.subtitle = k; }]);
      el.innerHTML = STUDIO.chips("ساختار آماده ارائه (اسلایدها جایگزین می‌شوند)", list);
      const box = el.querySelector(".st-chips");
      box.addEventListener("click", (e) => { const b = e.target.closest("[data-chip]"); if (b && !confirm("اسلایدهای فعلی با ساختار آماده جایگزین شوند؟")) e.stopImmediatePropagation(); }, true);
      STUDIO.bindChips(box, list, refresh);
    }
    STUDIO.register("slides", {
      title: "پاورپوینت‌ساز",
      render: (v, param) => STUDIO.open(v, "slides", param, defaults, (data, item) => {
        STUDIO.editor(v, {
          kind: "slides", title: "پاورپوینت‌ساز", icon: "presentation", schema, data, item, wide: true, deliverText: "(فایل .pptx قابل ویرایش در پاورپوینت و Google Slides + PDF)",
          titleOf: (d) => d.title || "ارائه", layout: "slides", smart,
        });
      }),
    });
  });
})();
