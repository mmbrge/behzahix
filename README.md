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

## قبل از انتشار

- قیمت‌ها و اطلاعات تماس در `src/data/site.ts` نمایشی هستند و باید جایگزین شوند.
- لینک شبکه‌های اجتماعی (`socials`) را تنظیم کنید.

استک: Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript
