import { BeforeAfter } from "@/components/BeforeAfter";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PackageCalculator } from "@/components/PackageCalculator";
import { Services } from "@/components/Services";

export default function Home() {
  return (
    <div id="top" className="relative overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand/15 blur-[140px]"
      />
      <Header />
      <main>
        <Hero />
        <Services />
        <BeforeAfter />
        <PackageCalculator />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
