# BEHIX — سایت بهیکس

لندینگ پیج بهیکس: طراحی سایت، استودیو برندینگ، محتوای هوش مصنوعی و اتوماسیون.

## اجرا

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # بیلد production
npm run lint
```

## ساختار

- `src/app/` — layout (فارسی، RTL، فونت Vazirmatn به‌صورت self-host) و صفحه اصلی
- `src/components/` — بخش‌های صفحه: Header، Hero، Services، BeforeAfter، PackageCalculator، Contact، Footer
- `src/data/site.ts` — **همه متن‌ها، قیمت‌ها، تخفیف‌ها و اطلاعات تماس** (برای تغییر محتوا فقط این فایل را ویرایش کنید)
- `src/lib/format.ts` — تبدیل اعداد به فارسی و فرمت تومان

## انتشار روی هاست (cPanel / DirectAdmin)

سایت به‌صورت فایل‌های ثابت بیلد می‌شود و به Node.js روی هاست نیازی ندارد.

1. `npm run build` را اجرا کنید؛ خروجی در پوشه `out/` ساخته می‌شود.
2. **محتویات** پوشه `out/` (نه خود پوشه و نه سورس پروژه) را در `public_html` آپلود کنید.
   فایل `index.html` باید مستقیماً داخل `public_html` باشد.

## قبل از انتشار

- قیمت‌ها و اطلاعات تماس در `src/data/site.ts` نمایشی هستند و باید جایگزین شوند.
- لینک شبکه‌های اجتماعی (`socials`) را تنظیم کنید.

استک: Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript
