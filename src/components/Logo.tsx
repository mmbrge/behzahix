export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      dir="ltr"
      className={`inline-flex items-baseline font-black tracking-tight ${className}`}
      aria-label="BEHIX"
    >
      <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
        BEHI
      </span>
      <span className="bg-gradient-to-b from-brand-2 to-brand bg-clip-text text-transparent drop-shadow-[0_0_12px_rgb(255_122_26/0.6)]">
        X
      </span>
    </span>
  );
}
