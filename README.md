# BEHIX — سایت بهیکس

لندینگ پیج بهیکس: طراحی سایت، استودیو برندینگ، محتوای هوش مصنوعی و اتوماسیون.

## دانلود نسخه آماده آپلود

**[⬇️ دانلود behix-site.zip](https://github.com/mmbrge/behzahix/raw/claude/bold-cray-7b2r7i/deploy/behix-site.zip)**

این فایل را در `public_html` هاست آپلود و Extract کنید؛ `index.html` باید مستقیماً داخل `public_html` باشد.
⚠️ دکمه سبز «Code → Download ZIP» گیت‌هاب **سورس** پروژه است و روی هاست اجرا نمی‌شود.

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

1. `npm run package` را اجرا کنید؛ سایت بیلد و در `deploy/behix-site.zip` بسته‌بندی می‌شود
   (خروجی باز شده هم در `out/` است).
2. zip را کامیت کنید تا لینک دانلود بالا به‌روز شود.
3. zip را در `public_html` آپلود و Extract کنید. فایل `.htaccess` همراه آن است
   (صفحه ۴۰۴ اختصاصی و کش فایل‌ها).

## قبل از انتشار

- قیمت‌ها و اطلاعات تماس در `src/data/site.ts` نمایشی هستند و باید جایگزین شوند.
- لینک شبکه‌های اجتماعی (`socials`) را تنظیم کنید.

استک: Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript
