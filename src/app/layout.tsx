import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted so the site doesn't depend on Google Fonts being reachable.
const vazirmatn = localFont({
  src: "./fonts/Vazirmatn.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بهیکس | خلق ارزش دیجیتال با هوش مصنوعی",
  description:
    "طراحی سایت، استودیو برندینگ، تولید محتوای هوش مصنوعی و اتوماسیون کسب‌وکار. از ایده تا اتوماسیون با BEHIX.",
};

export const viewport: Viewport = {
  themeColor: "#07080c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
