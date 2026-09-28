import { toFaDigits } from "@/lib/format";
import { ArrowLeft, Play, Sparkle } from "./Icons";
import { Logo } from "./Logo";

export function Hero() {
  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 lg:grid-cols-2 lg:pt-24">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-sm text-brand-2">
          <Sparkle className="size-4" />
          نسل جدید خلق ارزش دیجیتال با هوش مصنوعی
        </span>

        <h1 className="mt-6 text-3xl leading-[1.5] font-black sm:text-4xl sm:leading-[1.45] xl:text-[2.6rem]">
          تحول دیجیتال کسب‌وکار شما؛
          <br />
          از ایده تا اتوماسیون با
          <Logo className="mt-2 block text-6xl md:text-8xl" />
        </h1>

        <p className="mt-6 max-w-lg text-lg leading-8 text-muted">
          ما در بهیکس، با ترکیب خلاقیت، فناوری و هوش مصنوعی به کسب‌وکار شما قدرت
          می‌دهیم تا سریع‌تر، هوشمندتر و حرفه‌ای‌تر رشد کند.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#contact" className="btn-primary">
            شروع همکاری
            <ArrowLeft className="size-5" />
          </a>
          <a href="#services" className="group inline-flex items-center gap-3 text-muted hover:text-fg">
            <span className="grid size-10 place-items-center rounded-full border border-line group-hover:border-brand/60">
              <Play className="size-4 text-brand" />
            </span>
            مشاهده نمونه‌کارها
          </a>
        </div>
      </div>

      <HeroVisual />
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-xl" aria-hidden="true">
      <div className="absolute inset-x-10 bottom-4 h-16 rounded-[50%] bg-brand/30 blur-3xl" />

      {/* Monitor */}
      <div className="glow-border absolute inset-x-6 top-10 bottom-16 rounded-3xl border border-line bg-gradient-to-br from-surface-2 to-ink p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-zinc-600" />
            <span className="size-2 rounded-full bg-zinc-600" />
            <span className="size-2 rounded-full bg-brand" />
          </div>
          <Logo className="text-lg" />
        </div>
        <svg viewBox="0 0 300 120" className="mt-4 h-[55%] w-full">
          <defs>
            <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff7a1a" stopOpacity="0.6" />
              <stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 110 L30 90 L55 100 L85 60 L110 75 L140 30 L165 55 L195 20 L225 50 L255 35 L300 10 V120 H0 Z"
            fill="url(#hero-area)"
          />
          <path
            d="M0 110 L30 90 L55 100 L85 60 L110 75 L140 30 L165 55 L195 20 L225 50 L255 35 L300 10"
            fill="none"
            stroke="#ffa24a"
            strokeWidth="2"
          />
        </svg>
        <div dir="ltr" className="mt-3 flex h-8 items-end gap-1">
          {[30, 50, 40, 70, 55, 85, 65, 95, 75, 100].map((h, i) => (
            <span key={i} className="flex-1 rounded-sm bg-brand/70" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* Speed card */}
      <div className="card absolute top-0 right-0 w-36 p-3 backdrop-blur-md md:w-40">
        <p className="text-sm font-bold">سرعت سایت</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full border-4 border-ok text-lg font-black text-ok">
            {toFaDigits(100)}
          </span>
          <span className="text-xs text-muted">بهینه‌سازی کامل</span>
        </div>
      </div>

      {/* AI render card */}
      <div className="card absolute top-6 left-0 w-40 p-3 backdrop-blur-md md:w-44">
        <p dir="ltr" className="text-left text-sm font-bold">
          AI Video Render
        </p>
        <div className="mt-2 h-16 rounded-xl bg-[radial-gradient(circle_at_30%_70%,#ff7a1a,transparent_60%),linear-gradient(135deg,#1e3a8a,#0e1017)]" />
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>در حال رندر…</span>
          <span className="font-bold text-ok">{toFaDigits(98)}٪</span>
        </div>
      </div>

      {/* Chatbot card */}
      <div className="card absolute bottom-0 left-1/2 w-60 -translate-x-1/2 p-3 backdrop-blur-md">
        <p className="text-sm font-bold">تست سریع چت‌بات</p>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-ink/60 px-3 py-2 text-xs text-muted">
          <span className="flex-1">یک پیام آزمایشی ارسال کنید…</span>
          <span className="grid size-6 place-items-center rounded-lg bg-brand text-ink">
            <ArrowLeft className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
