"use client";

import { useCallback, useRef, useState } from "react";
import { afterItems, beforeItems } from "@/data/site";
import { Check, Cross, Play } from "./Icons";

export function BeforeAfter() {
  // Percentage of the frame (from the right edge) showing "before".
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const moveTo = useCallback((clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return;
    const fromRight = ((rect.right - clientX) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, fromRight)));
  }, []);

  return (
    <section id="compare" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12">
      <div className="card grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_2fr] lg:items-center">
        <div>
          <p className="eyebrow">AI STUDIO</p>
          <h2 className="mt-2 text-3xl font-black">مقایسه زنده قبل و بعد</h2>
          <p className="mt-4 leading-8 text-muted">
            با یک حرکت ساده، تفاوت دنیای سنتی و آینده دیجیتال را ببینید.
          </p>
          <button
            type="button"
            onClick={() => setPos((p) => (p > 50 ? 0 : 100))}
            className="btn-ghost mt-6"
          >
            <span className="grid size-7 place-items-center rounded-full bg-fg text-ink">
              <Play className="size-3.5" />
            </span>
            تجربه کنید
          </button>
        </div>

        <div
          ref={frame}
          className="relative h-80 cursor-ew-resize touch-none overflow-hidden rounded-2xl border border-line outline-brand select-none has-[input:focus-visible]:outline-2"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            moveTo(e.clientX);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e.clientX);
          }}
        >
          {/* After (full layer) */}
          <Panel
            label="بعد از BEHIX"
            items={afterItems}
            good
            className="bg-[radial-gradient(circle_at_20%_30%,rgb(59_130_246/0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgb(255_122_26/0.35),transparent_50%),#0b1020]"
          />
          {/* Before (clipped from the right) */}
          <div
            className={`absolute inset-0 ${dragging ? "" : "transition-[clip-path] duration-500 ease-out"}`}
            style={{ clipPath: `inset(0 0 0 ${100 - pos}%)` }}
          >
            <Panel
              label="قبل از"
              items={beforeItems}
              className="bg-[linear-gradient(135deg,#3b2f24,#1b1611)] grayscale-[40%]"
            />
          </div>

          {/* Handle */}
          <div
            className={`pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px] shadow-white ${dragging ? "" : "transition-[right] duration-500 ease-out"}`}
            style={{ right: `${pos}%` }}
          >
            <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm font-bold text-ink">
              ‹ ›
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(pos)}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="میزان نمایش حالت قبل"
            className="sr-only"
          />
        </div>
      </div>
    </section>
  );
}

function Panel({
  label,
  items,
  good,
  className,
}: {
  label: string;
  items: string[];
  good?: boolean;
  className: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex flex-col p-6 ${good ? "items-end" : "items-start"} ${className}`}
    >
      <span
        className={`rounded-full px-3 py-1 text-sm font-bold ${good ? "bg-brand text-ink" : "bg-white/10"}`}
      >
        {label}
      </span>
      <ul className="mt-auto space-y-3 text-sm">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            {good ? (
              <Check className="size-4 text-ok" />
            ) : (
              <Cross className="size-4 text-bad" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
