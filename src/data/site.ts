// All editable site content lives here, so copy and prices can change
// without touching the components.

export const nav = [
  { label: "خدمات رسانه و AI", href: "#services" },
  { label: "توسعه وب", href: "#services" },
  { label: "قبل و بعد", href: "#compare" },
  { label: "محاسبه قیمت", href: "#packages" },
  { label: "تماس", href: "#contact" },
];

export type ServiceIcon = "ai" | "brush" | "code" | "windows";

export type Service = {
  id: string;
  icon: ServiceIcon;
  title: string;
  bullets: string[];
  tags?: string[];
  art: "portrait" | "posters" | "devices" | "servers";
};

export const services: Service[] = [
  {
    id: "ai-media",
    icon: "ai",
    title: "هوش مصنوعی، ساخت تیزر و موشن تبلیغاتی",
    bullets: [
      "تولید ویدیو با هوش مصنوعی",
      "صداگذاری حرفه‌ای و لب‌سینک",
      "انیمیشن و موشن‌گرافیک سه‌بعدی",
    ],
    tags: ["Video AI", "LipSync", "3D Motion"],
    art: "portrait",
  },
  {
    id: "branding",
    icon: "brush",
    title: "استودیو گرافیک، پوستر و هویت بصری",
    bullets: [
      "طراحی لوگو و برندینگ",
      "پوستر و محتوای تبلیغاتی",
      "کاتالوگ، کارت ویزیت و لیبل",
    ],
    art: "posters",
  },
  {
    id: "web",
    icon: "code",
    title: "طراحی اختصاصی و توسعه وب‌سایت مدرن",
    bullets: [
      "لندینگ فوق سریع و بهینه",
      "طراحی واکنش‌گرا (ریسپانسیو)",
      "کدنویسی تمیز و استاندارد",
    ],
    art: "devices",
  },
  {
    id: "automation",
    icon: "windows",
    title: "زیرساخت ویندوز، اتوماسیون و ابزارها",
    bullets: [
      "راه‌اندازی و پشتیبانی ویندوز",
      "اتوماسیون اداری و سازمانی",
      "مانیتورینگ و پایداری سرور",
    ],
    art: "servers",
  },
];

export const beforeItems = [
  "کاغذی و سنتی",
  "بدون اتوماسیون",
  "تبلیغات محدود",
  "پشتیبانی ضعیف",
];

export const afterItems = [
  "سایت حرفه‌ای",
  "تولید محتوای AI",
  "اتوماسیون و ابزارها",
  "پشتیبانی و مانیتورینگ",
];

// Placeholder prices (Toman) — replace with real pricing before launch.
export type PackageOption = {
  id: string;
  title: string;
  price: number;
  days: number;
};

export const packageOptions: PackageOption[] = [
  { id: "site", title: "طراحی وب‌سایت شرکتی / فروشگاهی", price: 18_000_000, days: 14 },
  { id: "ai-pack", title: "بسته ۴ عددی تیزر هوش مصنوعی + لوگوموشن", price: 9_500_000, days: 7 },
  { id: "seo", title: "سئو و محتوای وبلاگ ماهانه", price: 6_000_000, days: 30 },
  { id: "infra", title: "ساخت سیستم ویندوزی و اتوماسیون دفتری", price: 8_000_000, days: 10 },
];

// Bundle discount by number of selected services.
export const bundleDiscounts: Record<number, number> = {
  1: 0,
  2: 0.1,
  3: 0.15,
  4: 0.2,
};

export const socials = [
  { label: "اینستاگرام", href: "#", icon: "instagram" },
  { label: "لینکدین", href: "#", icon: "linkedin" },
  { label: "تلگرام", href: "#", icon: "telegram" },
  { label: "یوتیوب", href: "#", icon: "youtube" },
] as const;

// Placeholder contact details — replace before launch.
export const contact = {
  phone: "09120000000",
  telegram: "https://t.me/behix",
  email: "hello@behix.ir",
};
