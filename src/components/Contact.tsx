import { contact } from "@/data/site";
import { toFaDigits } from "@/lib/format";
import { ArrowLeft, Telegram } from "./Icons";

export function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12">
      <div className="glow-border relative overflow-hidden rounded-3xl border border-brand/40 bg-[radial-gradient(circle_at_85%_20%,rgb(255_122_26/0.25),transparent_50%)] p-8 text-center md:p-12">
        <h2 className="text-3xl font-black">بیایید پروژه بعدی شما را بسازیم</h2>
        <p className="mx-auto mt-3 max-w-xl leading-8 text-muted">
          یک جلسه مشاوره رایگان رزرو کنید؛ نیازتان را بررسی می‌کنیم و بهترین مسیر را پیشنهاد
          می‌دهیم.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={`tel:${contact.phone}`} className="btn-primary">
            تماس: <span dir="ltr">{toFaDigits(contact.phone)}</span>
            <ArrowLeft className="size-5" />
          </a>
          <a href={contact.telegram} className="btn-ghost" target="_blank" rel="noreferrer">
            <Telegram className="size-5" />
            پیام در تلگرام
          </a>
          <a href={`mailto:${contact.email}`} className="btn-ghost">
            {contact.email}
          </a>
        </div>
      </div>
    </section>
  );
}
