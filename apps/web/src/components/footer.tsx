import Link from "next/link";
import { BrandMark } from "@/src/components/brand-logo";

const SECTIONS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "السوگ",
    links: [
      { href: "/about", label: "من نحن" },
      { href: "/contact", label: "تواصل معنا" },
      { href: "/become-seller", label: "افتح متجرك" },
    ],
  },
  {
    title: "المساعدة",
    links: [
      { href: "/faq", label: "الأسئلة الشائعة" },
      { href: "/returns", label: "سياسة الإرجاع" },
      { href: "/orders", label: "تتبّع طلبك" },
    ],
  },
  {
    title: "قانوني",
    links: [
      { href: "/terms", label: "الشروط والأحكام" },
      { href: "/privacy", label: "سياسة الخصوصية" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-10 border-t border-neutral-200 bg-white pb-24 md:pb-8">
      <div className="container-app grid gap-8 py-8 sm:grid-cols-4">
        <div>
          <div className="flex items-center gap-1.5 text-xl font-extrabold text-brand-700">
            <BrandMark className="h-8 w-8" />
            <span>
              السوگ<span className="text-gold-500">.</span>
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            سوق العراق — تسوّق من تجّار محافظتك، والدفع عند الاستلام.
          </p>
        </div>
        {SECTIONS.map((s) => (
          <nav key={s.title} aria-label={s.title}>
            <h3 className="mb-2 text-sm font-bold text-neutral-900">{s.title}</h3>
            <ul className="space-y-1.5">
              {s.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-neutral-500 transition hover:text-brand-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-neutral-100">
        <p className="container-app py-4 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} السوگ — جميع الحقوق محفوظة. صُنع بحب في العراق 🇮🇶
          <span className="ms-2 text-neutral-300 nums" dir="ltr">
            v-{process.env.NEXT_PUBLIC_BUILD}
          </span>
        </p>
      </div>
    </footer>
  );
}
