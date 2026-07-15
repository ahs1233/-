import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Store, MapPin, BadgeCheck, Star, CalendarDays, Package, Truck, Instagram, Facebook, ExternalLink } from "lucide-react";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard } from "@/src/components/product-card";
import { AppImage } from "@/src/components/app-image";
import { StoreReviews } from "@/src/components/store/store-reviews";
import { decodeSlug } from "@/src/lib/slug";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://one-theta-81.vercel.app";

async function getStore(slug: string) {
  const api = await getServerApi();
  return api.catalog.storeBySlug({ slug: decodeSlug(slug) });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const data = await getStore(params.slug);
    if (!data) return { title: "متجر غير موجود" };
    const description =
      data.vendor.description?.slice(0, 160) ??
      `تسوّق من ${data.vendor.storeName}${data.vendor.governorate ? ` في ${data.vendor.governorate.nameAr}` : ""} — الدفع عند الاستلام في السوگ.`;
    const url = `${BASE}/store/${encodeURIComponent(data.vendor.slug)}`;
    return {
      title: data.vendor.storeName,
      description,
      alternates: { canonical: url },
      openGraph: { title: data.vendor.storeName, description, url, type: "website", siteName: "السوگ", locale: "ar_IQ" },
    };
  } catch {
    return { title: "السوگ" };
  }
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const data = await getStore(params.slug);
  if (!data) notFound();
  const { vendor, products } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: vendor.storeName,
    description: vendor.description ?? undefined,
    url: `${BASE}/store/${encodeURIComponent(vendor.slug)}`,
    ...(vendor.governorate
      ? { address: { "@type": "PostalAddress", addressRegion: vendor.governorate.nameAr, addressCountry: "IQ" } }
      : {}),
  };

  const year = new Date(vendor.memberSince).getFullYear();
  const hasRating = vendor.ratingCount > 0;

  return (
    <div className="space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* الواجهة — تدخل محلاً، لا تفتح بطاقة. صاحبه حاضرٌ يرحّب بك. */}
      <section className="bg-card overflow-hidden rounded-3xl border border-line shadow-sm">
        {/* واجهة المحل — لافتته وسِتارته */}
        <div className="relative h-28 sm:h-32">
          {vendor.bannerUrl ? (
            <AppImage src={vendor.bannerUrl} alt={`واجهة ${vendor.storeName}`} sizes="100vw" priority className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, #b87d4a 0 22px, #9a6638 22px 44px)",
              }}
            />
          )}
          {/* ظلّ السِتارة — عمقٌ ودفء */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        </div>

        <div className="relative px-4 pb-4">
          {/* ختم صاحب المحل */}
          <div className="flex items-end gap-3">
            <span className="bg-card2 -mt-12 grid h-24 w-24 flex-shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-[rgb(var(--c-card))] text-gold-300 shadow-md ring-1 ring-gold-500/40">
              {vendor.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img loading="lazy" decoding="async" src={vendor.logoUrl} alt={vendor.storeName} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-9 w-9" />
              )}
            </span>
            <div className="flex-1 pb-1">
              <h1 className="flex items-center gap-1.5 text-xl font-extrabold text-neutral-100">
                {vendor.storeName}
                <BadgeCheck className="h-5 w-5 text-gold-400" aria-label="متجر موثّق" />
              </h1>
              {vendor.governorate && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-neutral-400">
                  <MapPin className="h-3.5 w-3.5" /> {vendor.governorate.nameAr}
                </p>
              )}
            </div>
          </div>

          {/* صوت صاحب المحل */}
          <p className="bg-card2 mt-3 rounded-2xl border border-line px-4 py-3 text-sm leading-relaxed text-neutral-300">
            {vendor.description ? (
              <>
                <span className="font-bold text-gold-300">صاحب المتجر:</span> «{vendor.description}»
              </>
            ) : (
              <>أهلاً بك في محلّي — تصفّح على راحتك، وما يعجبك يصلك حتى بابك.</>
            )}
          </p>

          {/* شارات الثقة — منذ متى، التقييم، الرفوف، التوصيل */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge icon={<Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" />}>
              {hasRating ? (
                <span className="nums">{vendor.ratingAvg.toFixed(1)}</span>
              ) : (
                "متجر جديد"
              )}
              {hasRating && <span className="text-neutral-400"> ({vendor.ratingCount})</span>}
            </Badge>
            <Badge icon={<Package className="h-3.5 w-3.5 text-gold-400" />}>
              <span className="nums">{vendor.productCount}</span> منتج
            </Badge>
            <Badge icon={<CalendarDays className="h-3.5 w-3.5 text-gold-400" />}>
              في السوگ منذ <span className="nums">{year}</span>
            </Badge>
            <Badge icon={<Truck className="h-3.5 w-3.5 text-petrol" />}>الدفع عند الاستلام</Badge>
          </div>

          {/* روابط الصفحات — للمتاجر الإلكترونيّة (إنستغرام/فيسبوك/تيك توك) */}
          {vendor.channel === "online" && (vendor.instagramUrl || vendor.facebookUrl || vendor.tiktokUrl) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {vendor.instagramUrl && (
                <SocialLink href={vendor.instagramUrl} icon={<Instagram className="h-3.5 w-3.5" />}>إنستغرام</SocialLink>
              )}
              {vendor.tiktokUrl && (
                <SocialLink href={vendor.tiktokUrl} icon={<ExternalLink className="h-3.5 w-3.5" />}>تيك توك</SocialLink>
              )}
              {vendor.facebookUrl && (
                <SocialLink href={vendor.facebookUrl} icon={<Facebook className="h-3.5 w-3.5" />}>فيسبوك</SocialLink>
              )}
            </div>
          )}
        </div>
      </section>

      {/* الرفوف */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          على الرفوف <span className="text-sm font-medium text-neutral-400">· <span className="nums">{vendor.productCount}</span> منتج</span>
        </h2>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-400">
            الرفوف قيد التجهيز — لا توجد منتجات بعد.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* تقييمات المتجر — رأيُ من اشترى منه */}
      <StoreReviews vendorId={vendor.id} />
    </div>
  );
}

function Badge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="bg-card2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-medium text-neutral-300 shadow-sm">
      {icon}
      {children}
    </span>
  );
}

function SocialLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-200 transition hover:border-gold-500/70"
    >
      {icon}
      {children}
    </a>
  );
}
