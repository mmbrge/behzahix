"use client";

import { useState } from "react";
import { nav } from "@/data/site";
import { Logo } from "./Logo";
import { Cross, Menu } from "./Icons";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-3 z-50 mx-auto w-full max-w-6xl px-4">
      <div className="flex items-center justify-between gap-4 rounded-full border border-line bg-ink/75 px-4 py-2.5 backdrop-blur-xl md:px-6">
        <a href="#top" className="text-3xl md:text-4xl">
          <Logo />
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="منوی اصلی">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-fg"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden flex-col items-center gap-1 sm:flex">
            <a href="#contact" className="btn-primary py-2 text-sm">
              <span className="size-2 rounded-full bg-ok shadow-[0_0_8px] shadow-ok" />
              شروع پروژه هوشمند
            </a>
            <span className="text-[11px] text-muted">
              <span className="text-ok">●</span> آماده دریافت سفارش
            </span>
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full border border-line lg:hidden"
            aria-label={open ? "بستن منو" : "باز کردن منو"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Cross className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="منوی موبایل"
          className="mt-2 flex flex-col rounded-3xl border border-line bg-ink/95 p-3 backdrop-blur-xl lg:hidden"
        >
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3 text-muted hover:bg-white/5 hover:text-fg"
            >
              {item.label}
            </a>
          ))}
          <a href="#contact" onClick={() => setOpen(false)} className="btn-primary mt-2 sm:hidden">
            شروع پروژه هوشمند
          </a>
        </nav>
      )}
    </header>
  );
}
