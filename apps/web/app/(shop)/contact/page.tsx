import type { Metadata } from "next";
import { Phone, Mail, MessageCircle, Store } from "lucide-react";
import Link from "next/link";
import { ContentPage } from "@/src/components/content-page";

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: "طرق التواصل مع فريق منصة السوگ للدعم والاستفسارات.",
};

export default function ContactPage() {
  return (
    <ContentPage title="تواصل معنا">
      <p>فريق السوگ في خدمتك — للاستفسارات، مشاكل الطلبات، أو الانضمام كتاجر.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="mailto:support@alsouq.iq"
          className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4 transition hover:border-brand-300"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Mail className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-neutral-900">البريد الإلكتروني</span>
            <span className="text-sm text-neutral-500" dir="ltr">support@alsouq.iq</span>
          </span>
        </a>
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-neutral-900">داخل التطبيق</span>
            <span className="text-sm text-neutral-500">من صفحة الطلب يمكنك إضافة ملاحظة للبائع</span>
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Phone className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-neutral-900">أوقات الدعم</span>
            <span className="text-sm text-neutral-500">يومياً ٩ صباحاً – ٩ مساءً</span>
          </span>
        </div>
        <Link
          href="/become-seller"
          className="flex items-center gap-3 rounded-2xl border border-gold-300 bg-gold-50 p-4 transition hover:border-gold-400"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-500 text-white">
            <Store className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-neutral-900">انضم كتاجر</span>
            <span className="text-sm text-neutral-600">افتح متجرك وابدأ البيع اليوم</span>
          </span>
        </Link>
      </div>

      <p className="text-sm text-neutral-500">
        عند مراسلتنا بخصوص طلب، أرفق رقم الطلب (يبدأ بـ SQ) ليصلك الرد أسرع.
      </p>
    </ContentPage>
  );
}
