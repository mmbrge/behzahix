"use client";

import { useState } from "react";
import { bundleDiscounts, packageOptions } from "@/data/site";
import { formatToman, toFaDigits } from "@/lib/format";
import { ArrowLeft, Check, Clock } from "./Icons";

export function PackageCalculator() {
  const [selected, setSelected] = useState<string[]>(["site", "ai-pack"]);

  const chosen = packageOptions.filter((o) => selected.includes(o.id));
  const subtotal = chosen.reduce((sum, o) => sum + o.price, 0);
  const discount = bundleDiscounts[chosen.length] ?? 0;
  const total = Math.round((subtotal * (1 - discount)) / 100_000) * 100_000;
  // Services run in parallel, so the longest one sets the timeline.
  const days = chosen.reduce((max, o) => Math.max(max, o.days), 0);
  const maxDiscount = Math.max(...Object.values(bundleDiscounts));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <section id="packages" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12">
      <div className="card grid gap-8 p-6 md:p-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <h2 className="text-2xl font-black">ماشین‌حساب پکیج‌های رشد</h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            خدمات مورد نیاز خود را انتخاب کنید تا قیمت و زمان تحویل به صورت لحظه‌ای محاسبه
            شود.
          </p>

          <fieldset className="mt-6 space-y-3">
            <legend className="sr-only">انتخاب خدمات</legend>
            {packageOptions.map((o) => {
              const on = selected.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-3.5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${
                    on ? "border-brand/60 bg-brand/10" : "border-line hover:border-white/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => toggle(o.id)}
                  />
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-md border ${
                      on ? "border-brand bg-brand text-ink" : "border-white/30"
                    }`}
                  >
                    {on && <Check className="size-4" />}
                  </span>
                  <span className="flex-1 text-sm font-medium">{o.title}</span>
                  <span className="text-xs text-muted">{formatToman(o.price)}</span>
                </label>
              );
            })}
          </fieldset>
          <p className="mt-4 text-xs text-muted">
            تخفیف ترکیبی: ۲ خدمت {toFaDigits(bundleDiscounts[2] * 100)}٪، ۳ خدمت{" "}
            {toFaDigits(bundleDiscounts[3] * 100)}٪، ۴ خدمت {toFaDigits(maxDiscount * 100)}٪
          </p>
        </div>

        <div className="glow-border flex flex-col rounded-3xl border border-brand/40 bg-gradient-to-b from-surface-2 to-ink p-6">
          <h3 className="font-bold">پکیج پیشنهادی شما</h3>

          <div className="mt-5 flex justify-between text-sm">
            <div>
              <p className="text-muted">تخفیف ترکیبی</p>
              <p className="mt-1 text-xl font-black text-brand-2">{toFaDigits(discount * 100)}٪</p>
            </div>
            <div className="text-left">
              <p className="flex items-center gap-1 text-muted">
                <Clock className="size-4" />
                زمان تحویل
              </p>
              <p className="mt-1 text-xl font-black">
                {days ? `${toFaDigits(days)} روز` : "—"}
              </p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-brand to-brand-2 transition-all"
              style={{ width: `${(discount / maxDiscount) * 100}%` }}
            />
          </div>

          <div className="mt-6" aria-live="polite">
            <p className="text-3xl font-black">{formatToman(total)}</p>
            {discount > 0 && (
              <p className="mt-1 text-sm text-muted line-through">{formatToman(subtotal)}</p>
            )}
          </div>

          <a
            href="#contact"
            aria-disabled={chosen.length === 0}
            className={`btn-primary mt-auto w-full ${chosen.length === 0 ? "pointer-events-none opacity-50" : ""}`}
          >
            ثبت درخواست
            <ArrowLeft className="size-5" />
          </a>
          <p className="mt-3 text-center text-xs text-muted">
            قیمت‌ها تقریبی است و پس از جلسه مشاوره نهایی می‌شود.
          </p>
        </div>
      </div>
    </section>
  );
}
