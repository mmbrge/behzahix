import { socials } from "@/data/site";
import { toFaDigits } from "@/lib/format";
import { Instagram, Linkedin, Telegram, Youtube } from "./Icons";
import { Logo } from "./Logo";

const socialIcons = {
  instagram: Instagram,
  linkedin: Linkedin,
  telegram: Telegram,
  youtube: Youtube,
};

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pt-8 pb-10">
      <div className="flex flex-col items-center justify-between gap-6 border-t border-line pt-8 text-sm text-muted md:flex-row">
        <div className="flex items-center gap-4">
          <Logo className="text-3xl" />
          <span>ایده‌هایتان را هوشمندانه بسازید</span>
        </div>

        <ul className="flex items-center gap-2">
          {socials.map((s) => {
            const Icon = socialIcons[s.icon];
            return (
              <li key={s.icon}>
                <a
                  href={s.href}
                  aria-label={s.label}
                  className="grid size-10 place-items-center rounded-full border border-line hover:border-brand/60 hover:text-brand-2"
                >
                  <Icon className="size-5" />
                </a>
              </li>
            );
          })}
        </ul>

        <p>
          خلاقیت + تکنولوژی + رشد پایدار ·{" "}
          <span dir="ltr">© BEHIX {toFaDigits(new Date().getFullYear())}</span>
        </p>
      </div>
    </footer>
  );
}
