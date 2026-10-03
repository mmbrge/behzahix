/* ==========================================================================
   BEHIX — catalog + demo database
   --------------------------------------------------------------------------
   CATALOG drives the services tree, the mega menu, the order wizard (each
   service lists the form fields it needs) and price estimates.
   Prices are placeholders in Toman — edit them here or from the admin panel.
   The demo database lives in the visitor's browser (localStorage) until a
   real backend is connected.
   ========================================================================== */

(function () {
  "use strict";

  // ---- Field helpers (keep service definitions short) ----
  const num = (id, label, o = {}) => ({ id, type: "number", label, ...o });
  const sel = (id, label, options, o = {}) => ({ id, type: "select", label, options, ...o });
  const cards = (id, label, options, o = {}) => ({ id, type: "cards", label, options, ...o });
  const chips = (id, label, options, o = {}) => ({ id, type: "chips", label, options, ...o });
  const text = (id, label, o = {}) => ({ id, type: "text", label, ...o });
  const area = (id, label, o = {}) => ({ id, type: "textarea", label, ...o });
  const opt = (v, label, price = 0, extra = {}) => ({ v, label, price, ...extra });

  const CATALOG = [
    {
      id: "office",
      title: "آفیس و اسناد",
      en: "Office",
      icon: "office",
      hue: 199,
      desc: "پاورپوینت، رزومه، اکسل و اسناد حرفه‌ای",
      services: [
        {
          id: "pptx", title: "طراحی پاورپوینت حرفه‌ای", icon: "presentation", base: 1500000, days: 3,
          desc: "ارائه‌ای که دیده می‌شود؛ از پیچ‌دک سرمایه‌گذاری تا دفاع پایان‌نامه.",
          fields: [
            cards("purpose", "هدف ارائه", [
              opt("business", "ارائه کاری", 0, { icon: "briefcase" }),
              opt("pitch", "پیچ‌دک سرمایه‌گذاری", 800000, { icon: "chart" }),
              opt("edu", "آموزشی / کارگاه", 0, { icon: "book" }),
              opt("thesis", "دفاع پایان‌نامه", 300000, { icon: "award" }),
            ], { required: true }),
            num("slides", "تعداد اسلاید", { min: 5, max: 150, value: 12, included: 10, perUnit: 120000, suffix: "اسلاید" }),
            sel("content", "وضعیت محتوا", [
              opt("ready", "محتوا آماده است"),
              opt("edit", "نیاز به ویرایش و خلاصه‌سازی", 400000),
              opt("write", "نیاز به نگارش کامل محتوا", 1200000),
            ]),
            chips("extras", "امکانات اضافه", [
              opt("anim", "انیمیشن و ترنزیشن", 300000),
              opt("info", "اینفوگرافیک و نمودار", 500000),
              opt("icons", "آیکن اختصاصی", 400000),
              opt("en", "نسخه انگلیسی", 600000),
            ]),
          ],
        },
        {
          id: "resume", title: "رزومه و کاور لتر", icon: "file", base: 900000, days: 2,
          desc: "رزومه‌ای که از فیلتر ATS رد می‌شود و دیده می‌شود.",
          fields: [
            cards("level", "سطح تجربه", [
              opt("junior", "تازه‌کار / دانشجو", 0, { icon: "sprout" }),
              opt("mid", "میان‌رده", 200000, { icon: "trend" }),
              opt("senior", "ارشد / مدیر", 500000, { icon: "crown" }),
            ], { required: true }),
            sel("lang", "زبان رزومه", [opt("fa", "فارسی"), opt("en", "انگلیسی", 300000), opt("both", "فارسی و انگلیسی", 600000)]),
            chips("extras", "خدمات تکمیلی", [
              opt("cover", "کاور لتر", 400000),
              opt("linkedin", "بهینه‌سازی لینکدین", 500000),
              opt("ats", "نسخه سازگار با ATS", 200000),
            ]),
            text("job", "موقعیت شغلی هدف", { placeholder: "مثلاً: طراح محصول، کارشناس فروش…" }),
          ],
        },
        {
          id: "excel", title: "اکسل و داشبورد مدیریتی", icon: "table", base: 2000000, days: 5,
          desc: "گزارش‌های خودکار، داشبورد و فرم‌های هوشمند.",
          fields: [
            cards("kind", "نوع پروژه", [
              opt("dash", "داشبورد مدیریتی", 0, { icon: "chart" }),
              opt("forms", "فرم و گزارش‌ساز", 0, { icon: "list" }),
              opt("acc", "حسابداری و انبار ساده", 500000, { icon: "wallet" }),
              opt("macro", "اتوماسیون با ماکرو / VBA", 1500000, { icon: "zap" }),
            ], { required: true }),
            num("sheets", "تعداد شیت", { min: 1, max: 40, value: 3, included: 3, perUnit: 250000, suffix: "شیت" }),
            sel("source", "منبع داده", [opt("manual", "ورود دستی"), opt("import", "فایل‌های اکسل موجود", 300000), opt("db", "اتصال به نرم‌افزار / دیتابیس", 1500000)]),
          ],
        },
        {
          id: "docs", title: "کاتالوگ، پروپوزال و بروشور", icon: "book", base: 1800000, days: 4,
          desc: "اسناد چاپی و دیجیتال با هویت برند شما.",
          fields: [
            cards("kind", "نوع سند", [
              opt("catalog", "کاتالوگ محصولات", 0, { icon: "book" }),
              opt("proposal", "پروپوزال کاری", 0, { icon: "file" }),
              opt("brochure", "بروشور / فلایر", -600000, { icon: "image" }),
              opt("report", "گزارش سالانه", 800000, { icon: "chart" }),
            ], { required: true }),
            num("pages", "تعداد صفحه", { min: 1, max: 120, value: 8, included: 8, perUnit: 150000, suffix: "صفحه" }),
            sel("output", "خروجی", [opt("digital", "دیجیتال (PDF)"), opt("print", "آماده چاپ", 300000), opt("both", "هر دو", 400000)]),
          ],
        },
      ],
    },
    {
      id: "web",
      title: "طراحی وب",
      en: "Web",
      icon: "code",
      hue: 25,
      desc: "لندینگ، سایت شرکتی، فروشگاه و UI/UX",
      services: [
        {
          id: "landing", title: "لندینگ پیج", icon: "layout", base: 6000000, days: 7,
          desc: "یک صفحه، یک هدف: تبدیل بازدیدکننده به مشتری.",
          fields: [
            cards("goal", "هدف صفحه", [
              opt("sell", "فروش محصول", 0, { icon: "cart" }),
              opt("lead", "جمع‌آوری لید / مشاوره", 0, { icon: "users" }),
              opt("event", "رویداد / وبینار", 0, { icon: "calendar" }),
              opt("app", "معرفی اپلیکیشن", 500000, { icon: "phone" }),
            ], { required: true }),
            num("sections", "تعداد بخش‌ها", { min: 3, max: 20, value: 7, included: 6, perUnit: 400000, suffix: "بخش" }),
            chips("features", "امکانات", [
              opt("form", "فرم ثبت‌نام / تماس", 0),
              opt("copy", "نگارش متن تبلیغاتی", 1500000),
              opt("anim", "انیمیشن‌های تعاملی", 1200000),
              opt("ab", "نسخه دوم برای تست A/B", 2000000),
              opt("crm", "اتصال به CRM / تلگرام", 800000),
            ]),
            text("domain", "دامنه (اگر دارید)", { placeholder: "example.ir", dir: "ltr" }),
          ],
        },
        {
          id: "corporate", title: "سایت شرکتی", icon: "building", base: 14000000, days: 18,
          desc: "ویترین آنلاین کسب‌وکار با پنل مدیریت محتوا.",
          fields: [
            num("pages", "تعداد صفحات", { min: 3, max: 60, value: 8, included: 6, perUnit: 900000, suffix: "صفحه" }),
            sel("cms", "پلتفرم", [opt("wp", "وردپرس"), opt("custom", "اختصاصی (کدنویسی)", 6000000), opt("static", "استاتیک فوق سریع", -2000000)]),
            chips("features", "امکانات", [
              opt("blog", "وبلاگ", 1000000),
              opt("multi", "چندزبانه", 3000000),
              opt("gallery", "گالری و نمونه‌کار", 800000),
              opt("booking", "رزرو نوبت آنلاین", 2500000),
              opt("chat", "چت آنلاین", 500000),
              opt("seo", "سئو پایه", 1500000),
            ]),
            text("domain", "دامنه فعلی", { placeholder: "example.ir", dir: "ltr" }),
          ],
        },
        {
          id: "shop", title: "فروشگاه اینترنتی", icon: "cart", base: 22000000, days: 25,
          desc: "فروشگاه کامل با درگاه پرداخت و مدیریت سفارش.",
          fields: [
            sel("products", "تعداد تقریبی محصولات", [opt("s", "تا ۵۰ محصول"), opt("m", "۵۰ تا ۵۰۰ محصول", 3000000), opt("l", "بیش از ۵۰۰ محصول", 7000000)]),
            chips("payment", "درگاه پرداخت", [opt("zarinpal", "زرین‌پال"), opt("idpay", "آیدی‌پی"), opt("bank", "درگاه مستقیم بانکی", 1500000), opt("cod", "پرداخت در محل")]),
            chips("features", "امکانات ویژه", [
              opt("vendors", "چندفروشندگی (مارکت‌پلیس)", 12000000),
              opt("coupon", "کد تخفیف و کمپین", 1000000),
              opt("club", "باشگاه مشتریان", 3000000),
              opt("sms", "پیامک وضعیت سفارش", 800000),
              opt("stock", "اتصال به انبار / حسابداری", 4000000),
              opt("app", "اپلیکیشن موبایل (PWA)", 6000000),
            ]),
          ],
        },
        {
          id: "uiux", title: "طراحی UI/UX", icon: "pen", base: 8000000, days: 12,
          desc: "طراحی تجربه و رابط کاربری اپ و وب در فیگما.",
          fields: [
            cards("platform", "پلتفرم", [
              opt("web", "وب", 0, { icon: "monitor" }),
              opt("mobile", "موبایل", 0, { icon: "phone" }),
              opt("both", "وب و موبایل", 5000000, { icon: "layers" }),
            ], { required: true }),
            num("screens", "تعداد صفحات (اسکرین)", { min: 3, max: 120, value: 12, included: 10, perUnit: 450000, suffix: "اسکرین" }),
            chips("deliverables", "خروجی‌ها", [
              opt("wire", "وایرفریم", 0),
              opt("proto", "پروتوتایپ تعاملی", 2000000),
              opt("ds", "دیزاین سیستم", 4000000),
              opt("research", "تحقیق کاربر", 3500000),
            ]),
          ],
        },
        {
          id: "seo", title: "سئو و تولید محتوا", icon: "search", base: 5000000, days: 30,
          desc: "رشد ارگانیک در گوگل با محتوای هدفمند (ماهانه).",
          fields: [
            num("months", "مدت قرارداد", { min: 1, max: 12, value: 3, included: 1, perUnit: 4500000, suffix: "ماه" }),
            num("articles", "مقاله در ماه", { min: 0, max: 40, value: 8, included: 4, perUnit: 350000, suffix: "مقاله" }),
            text("site", "آدرس سایت", { placeholder: "https://", dir: "ltr", required: true }),
            area("keywords", "کلمات کلیدی هدف", { placeholder: "هر کلمه در یک خط" }),
          ],
        },
      ],
    },
    {
      id: "video",
      title: "ویدیو و موشن",
      en: "Video",
      icon: "film",
      hue: 330,
      desc: "تیزر AI، موشن‌گرافیک، تدوین و ریلز",
      services: [
        {
          id: "ai-teaser", title: "تیزر تبلیغاتی با هوش مصنوعی", icon: "sparkles", base: 3500000, days: 4,
          desc: "تیزر سینمایی با هوش مصنوعی، سریع‌تر و ارزان‌تر از فیلم‌برداری.",
          fields: [
            sel("duration", "مدت ویدیو", [opt("15", "۱۵ ثانیه"), opt("30", "۳۰ ثانیه", 1500000), opt("60", "۶۰ ثانیه", 3500000), opt("90", "۹۰ ثانیه", 5500000)], { required: true }),
            chips("ratio", "ابعاد خروجی", [opt("916", "عمودی ۹:۱۶"), opt("169", "افقی ۱۶:۹", 300000), opt("11", "مربع ۱:۱", 300000)]),
            cards("voice", "صدا", [
              opt("music", "فقط موسیقی", 0, { icon: "music" }),
              opt("ai", "گوینده هوش مصنوعی", 500000, { icon: "mic" }),
              opt("pro", "گوینده حرفه‌ای", 2000000, { icon: "award" }),
            ]),
            sel("script", "سناریو", [opt("ready", "سناریو آماده است"), opt("write", "نیاز به نگارش سناریو", 1200000)]),
          ],
        },
        {
          id: "motion", title: "موشن‌گرافیک", icon: "play", base: 5000000, days: 10,
          desc: "توضیح محصول و خدمات با انیمیشن جذاب.",
          fields: [
            cards("style", "سبک", [
              opt("2d", "کاراکتر دوبعدی", 0, { icon: "smile" }),
              opt("typo", "تایپوگرافی", -1000000, { icon: "type" }),
              opt("info", "اینفوگرافیک", 0, { icon: "chart" }),
              opt("3d", "سه‌بعدی", 6000000, { icon: "box" }),
            ], { required: true }),
            num("seconds", "مدت (ثانیه)", { min: 15, max: 300, value: 60, included: 30, perUnit: 90000, step: 15, suffix: "ثانیه" }),
            chips("extras", "تکمیلی", [opt("voice", "گویندگی", 1200000), opt("sub", "زیرنویس", 400000), opt("cut", "نسخه کوتاه برای ریلز", 900000)]),
          ],
        },
        {
          id: "edit", title: "تدوین ویدیو", icon: "scissors", base: 1500000, days: 3,
          desc: "تدوین حرفه‌ای ویدیوهای خام، ولاگ و آموزشی.",
          fields: [
            num("minutes", "طول ویدیوی خام (دقیقه)", { min: 1, max: 600, value: 20, included: 10, perUnit: 60000, suffix: "دقیقه" }),
            num("outputs", "تعداد خروجی نهایی", { min: 1, max: 30, value: 1, included: 1, perUnit: 700000, suffix: "ویدیو" }),
            chips("extras", "خدمات", [opt("color", "اصلاح رنگ", 500000), opt("sub", "زیرنویس فارسی", 400000), opt("sound", "میکس صدا", 400000), opt("thumb", "طراحی کاور", 300000)]),
          ],
        },
        {
          id: "lipsync", title: "دوبله و لب‌سینک AI", icon: "mic", base: 2500000, days: 3,
          desc: "ویدیوی شما به هر زبانی، با حرکت لب طبیعی.",
          fields: [
            cards("kind", "نوع کار", [
              opt("dub", "دوبله به زبان دیگر", 0, { icon: "globe" }),
              opt("avatar", "آواتار سخنگو", 1000000, { icon: "user" }),
              opt("fix", "اصلاح دیالوگ", -500000, { icon: "edit" }),
            ], { required: true }),
            num("minutes", "مدت (دقیقه)", { min: 1, max: 120, value: 3, included: 1, perUnit: 700000, suffix: "دقیقه" }),
            chips("langs", "زبان مقصد", [opt("fa", "فارسی"), opt("en", "انگلیسی"), opt("ar", "عربی", 300000), opt("tr", "ترکی", 300000)]),
          ],
        },
        {
          id: "reels", title: "پک ریلز و استوری ویدیویی", icon: "phone", base: 2400000, days: 5,
          desc: "محتوای ویدیویی ماهانه برای اینستاگرام و شبکه‌های اجتماعی.",
          fields: [
            num("count", "تعداد ویدیو", { min: 2, max: 60, value: 6, included: 4, perUnit: 500000, suffix: "ویدیو" }),
            chips("platform", "پلتفرم", [opt("ig", "اینستاگرام"), opt("yt", "یوتیوب شورتز"), opt("tg", "تلگرام"), opt("ap", "آپارات")]),
            sel("source", "فیلم‌برداری", [opt("client", "فیلم‌ها را خودم می‌فرستم"), opt("ai", "ساخت کامل با AI", 1500000), opt("stock", "فوتیج استوک", 800000)]),
          ],
        },
      ],
    },
    {
      id: "image",
      title: "گرافیک و تصویر",
      en: "Image",
      icon: "image",
      hue: 265,
      desc: "لوگو، پوستر، شبکه‌های اجتماعی و تصویرسازی AI",
      services: [
        {
          id: "logo", title: "لوگو و هویت بصری", icon: "hexagon", base: 4000000, days: 7,
          desc: "لوگویی که برند شما را در یک نگاه معرفی می‌کند.",
          fields: [
            text("brand", "نام برند", { required: true, placeholder: "نام کسب‌وکار" }),
            cards("type", "نوع لوگو", [
              opt("word", "نوشتاری (لوگوتایپ)", 0, { icon: "type" }),
              opt("mark", "تصویری (نشانه)", 500000, { icon: "hexagon" }),
              opt("combo", "ترکیبی", 800000, { icon: "layers" }),
              opt("mascot", "کاراکتر / مسکات", 2500000, { icon: "smile" }),
            ], { required: true }),
            sel("concepts", "تعداد کانسپت اولیه", [opt("2", "۲ کانسپت"), opt("3", "۳ کانسپت", 800000), opt("5", "۵ کانسپت", 2000000)]),
            chips("extras", "هویت بصری", [opt("guide", "برندبوک", 3000000), opt("card", "کارت ویزیت و سربرگ", 800000), opt("social", "کیت شبکه‌های اجتماعی", 1200000), opt("motion", "لوگوموشن", 1500000)]),
            text("slogan", "شعار (اختیاری)", { placeholder: "مثلاً: کسب‌وکارت، نسخه بهتر" }),
          ],
        },
        {
          id: "poster", title: "پوستر و بنر تبلیغاتی", icon: "image", base: 700000, days: 2,
          desc: "طراحی تبلیغاتی برای چاپ و فضای مجازی.",
          fields: [
            num("count", "تعداد طرح", { min: 1, max: 50, value: 2, included: 1, perUnit: 500000, suffix: "طرح" }),
            chips("sizes", "ابعاد", [opt("a4", "A4 / A3"), opt("story", "استوری"), opt("post", "پست"), opt("bill", "بیلبورد / استند", 600000), opt("web", "بنر سایت")]),
            sel("print", "آماده‌سازی چاپ", [opt("no", "فقط دیجیتال"), opt("yes", "فایل آماده چاپ (CMYK)", 200000)]),
          ],
        },
        {
          id: "social", title: "پست و استوری شبکه‌های اجتماعی", icon: "heart", base: 2000000, days: 5,
          desc: "محتوای گرافیکی منظم و هماهنگ با برند.",
          fields: [
            num("posts", "تعداد پست در ماه", { min: 4, max: 60, value: 12, included: 8, perUnit: 180000, suffix: "پست" }),
            num("stories", "تعداد استوری در ماه", { min: 0, max: 90, value: 10, included: 0, perUnit: 90000, suffix: "استوری" }),
            chips("extras", "تکمیلی", [opt("caption", "نگارش کپشن", 900000), opt("template", "قالب قابل ویرایش", 700000), opt("highlight", "کاور هایلایت", 300000)]),
            text("page", "آیدی پیج", { placeholder: "@behix", dir: "ltr" }),
          ],
        },
        {
          id: "ai-art", title: "تصویرسازی با هوش مصنوعی", icon: "wand", base: 1200000, days: 2,
          desc: "تصاویر منحصربه‌فرد برای تبلیغات، کتاب و محصول.",
          fields: [
            cards("style", "سبک تصویر", [
              opt("real", "واقع‌گرایانه", 0, { icon: "camera" }),
              opt("anime", "انیمه", 0, { icon: "smile" }),
              opt("3d", "سه‌بعدی", 200000, { icon: "box" }),
              opt("paint", "نقاشی دیجیتال", 200000, { icon: "palette" }),
            ], { required: true }),
            num("count", "تعداد تصویر", { min: 1, max: 100, value: 5, included: 3, perUnit: 250000, suffix: "تصویر" }),
            sel("usage", "کاربرد", [opt("ad", "تبلیغاتی"), opt("book", "کتاب / داستان", 300000), opt("product", "عکس محصول", 400000)]),
          ],
        },
        {
          id: "packaging", title: "طراحی بسته‌بندی و لیبل", icon: "box", base: 3500000, days: 7,
          desc: "بسته‌بندی که در قفسه فروشگاه دیده می‌شود.",
          fields: [
            text("product", "نوع محصول", { required: true, placeholder: "مثلاً: قهوه، لوازم آرایشی…" }),
            num("skus", "تعداد تنوع (طعم / سایز)", { min: 1, max: 30, value: 1, included: 1, perUnit: 900000, suffix: "تنوع" }),
            chips("extras", "تکمیلی", [opt("mockup", "ماکاپ سه‌بعدی", 600000), opt("dieline", "دایلاین / قالب برش", 500000), opt("label", "لیبل جداگانه", 400000)]),
          ],
        },
      ],
    },
    {
      id: "ai",
      title: "هوش مصنوعی و اتوماسیون",
      en: "AI",
      icon: "ai",
      hue: 145,
      desc: "چت‌بات، اتوماسیون اداری و زیرساخت",
      services: [
        {
          id: "chatbot", title: "چت‌بات هوشمند", icon: "chat", base: 7000000, days: 10,
          desc: "پاسخ‌گویی ۲۴ ساعته به مشتری با هوش مصنوعی.",
          fields: [
            chips("platform", "محل استقرار", [opt("site", "سایت"), opt("tg", "تلگرام", 500000), opt("wa", "واتساپ", 1500000), opt("ig", "اینستاگرام دایرکت", 1500000)], { required: true }),
            sel("source", "منبع دانش", [opt("faq", "سوالات متداول"), opt("docs", "اسناد و کاتالوگ", 1500000), opt("api", "اتصال به سیستم / دیتابیس", 4000000)]),
            num("volume", "پیام در ماه (هزار)", { min: 1, max: 100, value: 5, included: 5, perUnit: 150000, suffix: "هزار" }),
          ],
        },
        {
          id: "automation", title: "اتوماسیون اداری", icon: "zap", base: 6000000, days: 12,
          desc: "کارهای تکراری را به سیستم بسپارید.",
          fields: [
            area("process", "کدام فرایند را می‌خواهید خودکار کنید؟", { required: true, placeholder: "مثلاً: ارسال فاکتور، گزارش روزانه فروش…" }),
            chips("tools", "ابزارهای فعلی", [opt("excel", "اکسل"), opt("crm", "CRM"), opt("mail", "ایمیل"), opt("acc", "نرم‌افزار حسابداری", 1500000), opt("sms", "پیامک", 500000)]),
            num("users", "تعداد کاربران", { min: 1, max: 500, value: 5, included: 5, perUnit: 120000, suffix: "نفر" }),
          ],
        },
        {
          id: "infra", title: "زیرساخت ویندوز و شبکه", icon: "server", base: 3000000, days: 4,
          desc: "نصب، امنیت، بکاپ و مانیتورینگ سیستم‌ها.",
          fields: [
            num("devices", "تعداد سیستم‌ها", { min: 1, max: 300, value: 10, included: 5, perUnit: 250000, suffix: "دستگاه" }),
            chips("services", "خدمات", [opt("install", "نصب و راه‌اندازی ویندوز"), opt("net", "شبکه و اشتراک‌گذاری", 1000000), opt("backup", "بکاپ خودکار", 1200000), opt("monitor", "مانیتورینگ", 1500000), opt("security", "امنیت و آنتی‌ویروس", 800000)]),
            sel("support", "پشتیبانی", [opt("once", "یک‌باره"), opt("monthly", "قرارداد ماهانه", 2500000)]),
          ],
        },
      ],
    },
  ];

  // ---- Common order options (step «زمان‌بندی و بودجه») ----
  const DEADLINES = [
    { v: "normal", label: "عادی", hint: "زمان استاندارد", mult: 1, daysMult: 1, icon: "clock" },
    { v: "fast", label: "سریع", hint: "۳۰٪ سریع‌تر", mult: 1.3, daysMult: 0.7, icon: "zap" },
    { v: "urgent", label: "فوری", hint: "نصف زمان", mult: 1.6, daysMult: 0.5, icon: "flame" },
  ];
  const ADDONS = [
    { v: "source", label: "فایل‌های لایه‌باز / سورس", pct: 0.15 },
    { v: "revisions", label: "۲ بار اصلاح اضافه", pct: 0.1 },
    { v: "license", label: "لایسنس تجاری کامل", pct: 0.1 },
    { v: "support", label: "پشتیبانی ۳ ماهه", pct: 0.12 },
  ];
  const STYLES = ["مینیمال", "مدرن", "لوکس", "رسمی", "فان و شاد", "تکنولوژیک", "سنتی / ایرانی", "فانتزی"];

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

  const PRODUCT_CATEGORIES = [
    { id: "pptx-tpl", title: "قالب پاورپوینت", icon: "presentation" },
    { id: "resume-tpl", title: "قالب رزومه", icon: "file" },
    { id: "web-tpl", title: "قالب سایت", icon: "layout" },
    { id: "motion-pack", title: "پک موشن و ویدیو", icon: "film" },
    { id: "social-pack", title: "پک شبکه‌های اجتماعی", icon: "heart" },
    { id: "assets", title: "فونت، آیکن و ماکاپ", icon: "palette" },
  ];

  // ---- Lookups ----
  const services = CATALOG.flatMap((c) => c.services.map((s) => ({ ...s, category: c.id })));
  const findService = (id) => services.find((s) => s.id === id);
  const findCategory = (id) => CATALOG.find((c) => c.id === id);

  // ---- Demo database (seeded on first visit) ----
  const day = 86400000;
  const ago = (d, h = 0) => Date.now() - d * day - h * 3600000;

  function seed() {
    const users = [
      { id: "u-admin", name: "مدیر بهیکس", phone: "09120000000", password: "admin", role: "admin", status: "active", email: "admin@behix.ir", createdAt: ago(200), wallet: 0, hue: 25 },
      { id: "u-1", name: "سارا محمدی", phone: "09121111111", password: "1234", role: "customer", status: "active", email: "sara@example.com", business: "کافه نارنج", createdAt: ago(60), wallet: 2500000, hue: 330 },
      { id: "u-2", name: "علی رضایی", phone: "09124444444", password: "1234", role: "customer", status: "active", business: "فروشگاه کتاب نو", createdAt: ago(25), wallet: 0, hue: 199 },
      { id: "u-3", name: "مریم احمدی", phone: "09125555555", password: "1234", role: "customer", status: "blocked", createdAt: ago(12), wallet: 0, hue: 145 },
      { id: "d-1", name: "نیما کریمی", phone: "09122222222", password: "1234", role: "designer", status: "active", skills: ["logo", "poster", "social", "packaging"], bio: "طراح هویت بصری با ۸ سال تجربه", rating: 4.9, level: "طراح ارشد", createdAt: ago(150), wallet: 18400000, hue: 265 },
      { id: "d-2", name: "الهام نوری", phone: "09126666666", password: "1234", role: "designer", status: "active", skills: ["ai-teaser", "motion", "edit", "reels", "lipsync"], bio: "موشن‌دیزاینر و متخصص ویدیوی AI", rating: 4.8, level: "طراح ارشد", createdAt: ago(120), wallet: 9600000, hue: 330 },
      { id: "d-3", name: "امیر حسینی", phone: "09127777777", password: "1234", role: "designer", status: "active", skills: ["landing", "corporate", "shop", "uiux", "seo"], bio: "توسعه‌دهنده فرانت‌اند و طراح UI", rating: 4.7, level: "طراح", createdAt: ago(90), wallet: 22000000, hue: 25 },
      { id: "d-4", name: "پریسا مرادی", phone: "09128888888", password: "1234", role: "designer", status: "pending", skills: ["pptx", "resume", "docs", "excel"], bio: "طراح ارائه و اینفوگرافیک", rating: 0, level: "تازه‌وارد", portfolioUrl: "https://behance.net/example", createdAt: ago(1), wallet: 0, hue: 199 },
      { id: "s-1", name: "استودیو پیکسل", phone: "09123333333", password: "1234", role: "seller", status: "active", shopName: "استودیو پیکسل", bio: "قالب‌های آماده پاورپوینت و رزومه", rating: 4.6, createdAt: ago(100), wallet: 7300000, hue: 45 },
      { id: "s-2", name: "موشن‌لب", phone: "09129999999", password: "1234", role: "seller", status: "active", shopName: "موشن‌لب", bio: "پک‌های موشن و ترنزیشن", rating: 4.8, createdAt: ago(80), wallet: 4100000, hue: 300 },
      { id: "s-3", name: "فونت‌خانه", phone: "09121212121", password: "1234", role: "seller", status: "pending", shopName: "فونت‌خانه", bio: "فونت‌های فارسی", createdAt: ago(2), wallet: 0, hue: 180 },
    ];

    const order = (o) => ({
      messages: [], deliverables: [], files: [], paid: o.status !== "new" && o.status !== "review",
      timeline: [{ status: "new", at: o.createdAt }], ...o,
    });
    const orders = [
      order({ id: "o-1", code: "BX-1042", userId: "u-1", serviceId: "logo", title: "لوگو و هویت بصری — کافه نارنج", status: "awaiting", designerId: "d-1", estimate: 7600000, deadline: "normal", createdAt: ago(9),
        details: { brand: "کافه نارنج", type: "combo", concepts: "3", extras: ["guide", "card"] }, style: { styles: ["مینیمال", "فان و شاد"], colors: ["#ff7a1a", "#1e293b"] },
        timeline: [{ status: "new", at: ago(9) }, { status: "review", at: ago(8, 20) }, { status: "in_progress", at: ago(8) }, { status: "awaiting", at: ago(1) }],
        deliverables: [{ name: "logo-concepts-v1.pdf", at: ago(1) }],
        messages: [{ from: "u-1", text: "سلام، رنگ نارنجی برای ما خیلی مهمه 🙏", at: ago(8, 2) }, { from: "d-1", text: "حتماً، سه کانسپت با تم نارنجی آماده کردم. لطفاً بررسی کنید.", at: ago(1) }] }),
      order({ id: "o-2", code: "BX-1043", userId: "u-1", serviceId: "social", title: "پک پست اینستاگرام — مهر", status: "in_progress", designerId: "d-1", estimate: 3800000, deadline: "fast", createdAt: ago(4),
        details: { posts: 12, stories: 10, extras: ["caption"], page: "@narenj.cafe" }, style: { styles: ["مدرن"] },
        timeline: [{ status: "new", at: ago(4) }, { status: "review", at: ago(3, 12) }, { status: "in_progress", at: ago(3) }] }),
      order({ id: "o-3", code: "BX-1038", userId: "u-1", serviceId: "landing", title: "لندینگ منوی آنلاین", status: "done", designerId: "d-3", estimate: 8900000, deadline: "normal", createdAt: ago(40),
        details: { goal: "sell", sections: 7, features: ["form", "crm"] }, rating: 5,
        timeline: [{ status: "new", at: ago(40) }, { status: "review", at: ago(39) }, { status: "in_progress", at: ago(38) }, { status: "awaiting", at: ago(31) }, { status: "done", at: ago(30) }],
        deliverables: [{ name: "landing-final.zip", at: ago(30) }] }),
      order({ id: "o-4", code: "BX-1044", userId: "u-2", serviceId: "ai-teaser", title: "تیزر AI معرفی فروشگاه کتاب", status: "review", designerId: null, estimate: 6200000, deadline: "urgent", createdAt: ago(0, 5),
        details: { duration: "30", ratio: ["916"], voice: "ai", script: "write" }, style: { styles: ["تکنولوژیک"] }, paid: false }),
      order({ id: "o-5", code: "BX-1045", userId: "u-2", serviceId: "pptx", title: "پیچ‌دک جذب سرمایه", status: "new", designerId: null, estimate: 4100000, deadline: "normal", createdAt: ago(0, 2),
        details: { purpose: "pitch", slides: 15, content: "edit", extras: ["info"] }, paid: false }),
      order({ id: "o-6", code: "BX-1036", userId: "u-2", serviceId: "motion", title: "موشن معرفی اپ", status: "done", designerId: "d-2", estimate: 9100000, deadline: "normal", createdAt: ago(55), rating: 4,
        details: { style: "2d", seconds: 60, extras: ["voice"] },
        timeline: [{ status: "new", at: ago(55) }, { status: "in_progress", at: ago(53) }, { status: "done", at: ago(44) }],
        deliverables: [{ name: "motion-final.mp4", at: ago(44) }] }),
      order({ id: "o-7", code: "BX-1040", userId: "u-1", serviceId: "reels", title: "ریلز ماهانه کافه", status: "revision", designerId: "d-2", estimate: 4400000, deadline: "normal", createdAt: ago(14),
        details: { count: 6, platform: ["ig"], source: "client" },
        timeline: [{ status: "new", at: ago(14) }, { status: "in_progress", at: ago(13) }, { status: "awaiting", at: ago(5) }, { status: "revision", at: ago(4) }] }),
    ];

    const products = [
      { id: "p-1", sellerId: "s-1", title: "قالب پاورپوینت پیچ‌دک استارتاپی", category: "pptx-tpl", price: 490000, discount: 20, sales: 132, rating: 4.8, status: "active", tags: ["پیچ‌دک", "استارتاپ"], createdAt: ago(70) },
      { id: "p-2", sellerId: "s-1", title: "قالب رزومه مدرن دوزبانه", category: "resume-tpl", price: 190000, discount: 0, sales: 340, rating: 4.7, status: "active", tags: ["رزومه", "ATS"], createdAt: ago(65) },
      { id: "p-3", sellerId: "s-2", title: "پک ۱۲۰ ترنزیشن پریمیر", category: "motion-pack", price: 650000, discount: 30, sales: 88, rating: 4.9, status: "active", tags: ["پریمیر", "ترنزیشن"], createdAt: ago(50) },
      { id: "p-4", sellerId: "s-2", title: "لوگوموشن افترافکت — ۱۰ سبک", category: "motion-pack", price: 420000, discount: 0, sales: 61, rating: 4.6, status: "active", tags: ["افترافکت", "لوگو"], createdAt: ago(40) },
      { id: "p-5", sellerId: "s-1", title: "پک ۵۰ پست اینستاگرام کافه و رستوران", category: "social-pack", price: 350000, discount: 15, sales: 205, rating: 4.8, status: "active", tags: ["اینستاگرام", "کافه"], createdAt: ago(35) },
      { id: "p-6", sellerId: "s-1", title: "قالب لندینگ HTML محصول دیجیتال", category: "web-tpl", price: 890000, discount: 0, sales: 47, rating: 4.5, status: "active", tags: ["HTML", "لندینگ"], createdAt: ago(30) },
      { id: "p-7", sellerId: "s-2", title: "۳۰۰ آیکن خطی فارسی‌پسند", category: "assets", price: 250000, discount: 10, sales: 150, rating: 4.7, status: "active", tags: ["آیکن", "SVG"], createdAt: ago(20) },
      { id: "p-8", sellerId: "s-1", title: "ماکاپ بسته‌بندی قهوه", category: "assets", price: 180000, discount: 0, sales: 0, rating: 0, status: "pending", tags: ["ماکاپ"], createdAt: ago(1) },
    ];

    const portfolio = [
      ["لوگو کافه نارنج", "image", "logo", "d-1"], ["هویت بصری کلینیک لبخند", "image", "logo", "d-1"],
      ["پوستر جشنواره پاییز", "image", "poster", "d-1"], ["بسته‌بندی عسل کوهستان", "image", "packaging", "d-1"],
      ["تیزر AI لوازم آرایشی", "video", "ai-teaser", "d-2"], ["موشن معرفی اپ پرداخت", "video", "motion", "d-2"],
      ["ریلز رستوران سنتی", "video", "reels", "d-2"], ["فروشگاه آنلاین پوشاک", "web", "shop", "d-3"],
      ["لندینگ دوره آموزشی", "web", "landing", "d-3"], ["UI اپ رزرو نوبت", "web", "uiux", "d-3"],
      ["پیچ‌دک استارتاپ لجستیک", "office", "pptx", "d-4"], ["داشبورد فروش اکسل", "office", "excel", "d-4"],
      ["چت‌بات پشتیبانی بیمه", "ai", "chatbot", "d-3"], ["تصویرسازی کتاب کودک", "image", "ai-art", "d-1"],
    ].map(([title, category, serviceId, designerId], i) => ({ id: `w-${i + 1}`, title, category, serviceId, designerId, likes: 20 + ((i * 37) % 180), createdAt: ago(5 + i * 6) }));

    const transactions = [
      { id: "t-1", userId: "u-1", type: "charge", amount: 5000000, at: ago(20), status: "ok", note: "شارژ کیف پول" },
      { id: "t-2", userId: "u-1", type: "payment", amount: -8900000, at: ago(38), status: "ok", note: "پرداخت BX-1038" },
      { id: "t-3", userId: "u-1", type: "payment", amount: -7600000, at: ago(8), status: "ok", note: "پرداخت BX-1042" },
      { id: "t-4", userId: "u-2", type: "payment", amount: -9100000, at: ago(53), status: "ok", note: "پرداخت BX-1036" },
      { id: "t-5", userId: "d-1", type: "earning", amount: 6080000, at: ago(30), status: "ok", note: "درآمد BX-1038" },
      { id: "t-6", userId: "d-2", type: "earning", amount: 7280000, at: ago(44), status: "ok", note: "درآمد BX-1036" },
      { id: "t-7", userId: "s-1", type: "sale", amount: 392000, at: ago(3), status: "ok", note: "فروش قالب پیچ‌دک" },
      { id: "t-8", userId: "u-1", type: "purchase", amount: -297500, at: ago(6), status: "ok", note: "خرید پک پست اینستاگرام" },
    ];

    return {
      version: 1,
      users,
      orders,
      products,
      portfolio,
      transactions,
      purchases: [{ id: "pu-1", userId: "u-1", productId: "p-5", price: 297500, at: ago(6) }],
      payouts: [
        { id: "po-1", userId: "d-3", amount: 10000000, status: "pending", at: ago(1), card: "6037-****-****-1234" },
        { id: "po-2", userId: "d-1", amount: 6000000, status: "paid", at: ago(20), card: "6219-****-****-5678" },
      ],
      tickets: [
        { id: "tk-1", userId: "u-2", name: "علی رضایی", phone: "09124444444", subject: "سوال درباره زمان تحویل", message: "سلام، تیزر رو تا آخر هفته می‌تونید تحویل بدید؟", status: "open", at: ago(0, 3), replies: [] },
        { id: "tk-2", userId: null, name: "حسین جعفری", phone: "09130000000", subject: "همکاری سازمانی", message: "برای ۲۰ دفتر نیاز به اتوماسیون داریم.", status: "open", at: ago(2), replies: [] },
        { id: "tk-3", userId: "u-1", name: "سارا محمدی", phone: "09121111111", subject: "فاکتور رسمی", message: "لطفاً فاکتور رسمی سفارش BX-1038 رو بفرستید.", status: "closed", at: ago(25), replies: [{ from: "u-admin", text: "فاکتور در بخش سفارش‌ها قرار گرفت.", at: ago(24) }] },
      ],
      coupons: [
        { code: "WELCOME10", percent: 10, uses: 34, limit: 100, active: true, ownerId: null },
        { code: "MEHR25", percent: 25, uses: 8, limit: 50, active: true, ownerId: null },
        { code: "PIXEL15", percent: 15, uses: 12, limit: 0, active: true, ownerId: "s-1" },
      ],
      notifications: [
        { id: "n-1", userId: "u-1", text: "طرح‌های اولیه لوگو آماده بررسی است.", at: ago(1), read: false, link: "orders" },
        { id: "n-2", userId: "u-1", text: "کد تخفیف MEHR25 برای سفارش بعدی شما فعال شد.", at: ago(3), read: true },
        { id: "n-3", userId: "d-1", text: "سفارش جدید پک پست اینستاگرام به شما واگذار شد.", at: ago(3), read: false, link: "projects" },
      ],
      favorites: { "u-1": ["p-1", "p-3"] },
      settings: { siteName: "BEHIX", phone: "09120000000", email: "hello@behix.ir", telegram: "https://t.me/behix", commission: 20, maintenance: false, minPayout: 1000000 },
      priceOverrides: {},
      leads: [],
    };
  }

  // ---- Persistence ----
  const DB_KEY = "behix:db";
  const SESSION_KEY = "behix:session";
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) cache = JSON.parse(raw);
    } catch (e) {
      cache = null;
    }
    if (!cache || cache.version !== 1) {
      cache = seed();
      save();
    }
    return cache;
  }
  function save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(cache));
    } catch (e) {
      /* storage full or blocked: keep working in memory */
    }
  }
  function reset() {
    cache = seed();
    save();
  }

  const db = {
    get data() { return load(); },
    save,
    reset,
    uid: (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    user: (id) => load().users.find((u) => u.id === id),
    notify(userId, text, link) {
      load().notifications.unshift({ id: db.uid("n"), userId, text, at: Date.now(), read: false, link });
    },
    basePrice(serviceId) {
      const o = load().priceOverrides[serviceId];
      return typeof o === "number" ? o : findService(serviceId)?.base ?? 0;
    },
  };

  const auth = {
    current() {
      let id = null;
      try { id = localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
      const u = id && db.user(id);
      return u && u.status !== "blocked" ? u : null;
    },
    login(phone, password) {
      const u = load().users.find((x) => x.phone === phone.trim());
      if (!u || u.password !== password) return { error: "شماره موبایل یا رمز عبور اشتباه است." };
      if (u.status === "blocked") return { error: "حساب کاربری شما مسدود شده است." };
      auth.start(u.id);
      return { user: u };
    },
    start(id) {
      try { localStorage.setItem(SESSION_KEY, id); } catch (e) { /* ignore */ }
    },
    logout() {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    },
  };

  // ---- Price estimate for an order draft ----
  function estimate(serviceId, details = {}, deadline = "normal", addons = []) {
    const s = findService(serviceId);
    if (!s) return { total: 0, days: 0 };
    let total = db.basePrice(serviceId);
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
    const dl = DEADLINES.find((d) => d.v === deadline) || DEADLINES[0];
    const addPct = addons.reduce((p, a) => p + (ADDONS.find((x) => x.v === a)?.pct ?? 0), 0);
    total = total * dl.mult * (1 + addPct);
    return {
      total: Math.max(0, Math.round(total / 100000) * 100000),
      days: Math.max(1, Math.round(s.days * dl.daysMult)),
    };
  }

  window.BX = Object.assign(window.BX || {}, {
    CATALOG, DEADLINES, ADDONS, STYLES, ORDER_STATUS, ORDER_FLOW, PRODUCT_CATEGORIES,
    services, findService, findCategory, db, auth, estimate,
  });
})();
