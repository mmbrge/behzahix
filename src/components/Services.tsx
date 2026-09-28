import { services, type Service, type ServiceIcon } from "@/data/site";
import { Ai, ArrowLeft, Brush, Code, Play, Windows } from "./Icons";

const icons: Record<ServiceIcon, typeof Ai> = {
  ai: Ai,
  brush: Brush,
  code: Code,
  windows: Windows,
};

export function Services() {
  return (
    <section id="services" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-20">
      <div className="text-center">
        <p className="eyebrow">OUR SERVICES</p>
        <h2 className="mt-2 text-4xl font-black">خدمات ما</h2>
        <p className="mt-3 text-muted">ترکیبی از خلاقیت، تکنولوژی و تجربه برای رشد شما</p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {services.map((s) => (
          <ServiceCard key={s.id} service={s} />
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const Icon = icons[service.icon];
  return (
    <article className="card group relative grid overflow-hidden transition hover:border-brand/40 sm:grid-cols-[1fr_auto]">
      <div className="p-6">
        <span className="grid size-12 place-items-center rounded-2xl border border-brand/40 bg-brand/10 text-brand">
          <Icon className="size-6" />
        </span>
        <h3 className="mt-4 text-xl leading-9 font-bold">{service.title}</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {service.bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-brand" />
              {b}
            </li>
          ))}
        </ul>
        <a
          href="#contact"
          className="mt-5 inline-flex items-center gap-1 text-sm text-brand-2 hover:underline"
        >
          مشاهده جزئیات
          <ArrowLeft className="size-4" />
        </a>
      </div>
      <ServiceArt service={service} />
    </article>
  );
}

function ServiceArt({ service }: { service: Service }) {
  const base =
    "relative m-4 hidden h-48 w-44 items-center justify-center self-center overflow-hidden rounded-2xl sm:flex";
  switch (service.art) {
    case "portrait":
      return (
        <div
          className={`${base} bg-[radial-gradient(circle_at_60%_35%,#fbbf24_0,#ea580c_25%,#1e1b4b_60%,#07080c_100%)]`}
          aria-hidden="true"
        >
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-white/15 backdrop-blur">
              <Play className="size-5" />
            </span>
          </span>
          <div className="absolute right-2 bottom-2 flex flex-col items-end gap-1.5" dir="ltr">
            {service.tags?.map((t) => (
              <span key={t} className="rounded-lg border border-white/15 bg-ink/70 px-2 py-0.5 text-[11px]">
                {t}
              </span>
            ))}
          </div>
        </div>
      );
    case "posters":
      return (
        <div className={base} aria-hidden="true">
          {[
            "rotate-[-12deg] -translate-x-8 from-sky-500 to-indigo-900",
            "rotate-[-4deg] -translate-x-3 from-rose-500 to-purple-900",
            "rotate-[6deg] translate-x-4 from-brand-2 to-orange-900",
          ].map((cls, i) => (
            <span
              key={i}
              className={`absolute h-36 w-24 rounded-xl border border-white/20 bg-gradient-to-b shadow-2xl transition group-hover:rotate-0 ${cls}`}
            />
          ))}
        </div>
      );
    case "devices":
      return (
        <div className={base} aria-hidden="true">
          <span className="h-24 w-40 rounded-lg border-4 border-zinc-700 bg-[radial-gradient(circle_at_30%_60%,#ff7a1a,#1f1308_70%)]" />
          <span className="absolute bottom-6 left-3 h-20 w-11 rounded-lg border-4 border-zinc-700 bg-[linear-gradient(#ff7a1a,#1f1308)]" />
        </div>
      );
    case "servers":
      return (
        <div className={`${base} items-end! gap-2 pb-4`} aria-hidden="true">
          {[28, 36, 24].map((h, i) => (
            <span
              key={i}
              className="flex w-11 flex-col gap-1.5 rounded-md border border-zinc-600 bg-zinc-900 p-1.5"
              style={{ height: `${h * 4.5}px` }}
            >
              {Array.from({ length: Math.floor(h / 7) }).map((_, j) => (
                <span key={j} className="h-1.5 rounded-sm bg-brand/80 shadow-[0_0_6px] shadow-brand" />
              ))}
            </span>
          ))}
        </div>
      );
  }
}
