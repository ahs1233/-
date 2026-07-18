import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Store, MapPin, BadgeCheck, Star, CalendarDays, Package, Truck, Instagram, Facebook, ExternalLink, Clock, Timer, ShoppingBag, Award, Boxes, Sparkles, TrendingUp, Tag } from "lucide-react";
import { getServerApi } from "@/src/trpc/server";
import { ProductCard } from "@/src/components/product-card";
import { StoreRailCard } from "@/src/components/home/store-rail-card";
import { AppImage } from "@/src/components/app-image";
import { StoreReviews } from "@/src/components/store/store-reviews";
import { decodeSlug } from "@/src/lib/slug";
import { storeOpenState, timeAgoAr } from "@/src/lib/store-hours";

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
  const api = await getServerApi();
  const slug = decodeSlug(params.slug);
  const data = await api.catalog.storeBySlug({ slug });
  if (!data) notFound();
  const { vendor, products, sections, activities } = data;
  const related = await api.catalog.relatedStores({ slug, limit: 8 });

  // تجميع منتجات المتجر تحت أقسامه الداخليّة (بترتيب الأقسام)، وما بلا قسمٍ في «منتجات أخرى».
  const grouped = sections
    .map((s) => ({ ...s, items: products.filter((p) => p.sectionId === s.id) }))
    .filter((s) => s.items.length > 0);
  const ungrouped = products.filter((p) => !p.sectionId || !sections.some((s) => s.id === p.sectionId));
  const hasSections = grouped.length > 0;

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

  const memberYear = new Date(vendor.memberSince).getFullYear();
  const hasRating = vendor.ratingCount > 0;
  const nowYear = new Date().getFullYear();
  const experience = vendor.establishedYear ? Math.max(0, nowYear - vendor.establishedYear) : null;
  const openState = storeOpenState(vendor.opensAt, vendor.closesAt);

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
                {vendor.verified && <BadgeCheck className="h-5 w-5 text-gold-400" aria-label="متجر موثّق" />}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-neutral-400">
                {(vendor.addressText || vendor.governorate) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {vendor.addressText ?? vendor.governorate?.nameAr}
                  </span>
                )}
                {openState && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      openState.open
                        ? openState.soon
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-petrol/15 text-petrol"
                        : "bg-neutral-500/15 text-neutral-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${openState.open ? (openState.soon ? "bg-amber-400" : "bg-petrol") : "bg-neutral-500"}`} />
                    {openState.label}
                  </span>
                )}
              </p>
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

          {/* شارات الثقة — التقييم، الطلبات، الخبرة، الرفوف، الردّ، الساعات، التوصيل */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge icon={<Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" />}>
              {hasRating ? (
                <span className="nums">{vendor.ratingAvg.toFixed(1)}</span>
              ) : (
                "متجر جديد"
              )}
              {hasRating && <span className="text-neutral-400"> ({vendor.ratingCount})</span>}
            </Badge>
            {vendor.ordersCount > 0 && (
              <Badge icon={<ShoppingBag className="h-3.5 w-3.5 text-gold-400" />}>
                <span className="nums">{vendor.ordersCount.toLocaleString("en")}</span> طلب
              </Badge>
            )}
            {experience != null && experience >= 1 && (
              <Badge icon={<Award className="h-3.5 w-3.5 text-gold-400" />}>
                <span className="nums">{experience}</span> سنة خبرة
              </Badge>
            )}
            <Badge icon={<Package className="h-3.5 w-3.5 text-gold-400" />}>
              <span className="nums">{vendor.productCount}</span> منتج
            </Badge>
            {vendor.responseMins != null && (
              <Badge icon={<Timer className="h-3.5 w-3.5 text-gold-400" />}>
                يردّ خلال <span className="nums">{vendor.responseMins}</span> دقيقة
              </Badge>
            )}
            {vendor.opensAt && vendor.closesAt && (
              <Badge icon={<Clock className="h-3.5 w-3.5 text-gold-400" />}>
                <span className="nums" dir="ltr">{vendor.opensAt}–{vendor.closesAt}</span>
              </Badge>
            )}
            <Badge icon={<CalendarDays className="h-3.5 w-3.5 text-gold-400" />}>
              في السوگ منذ <span className="nums">{memberYear}</span>
            </Badge>
            <Badge icon={<Truck className="h-3.5 w-3.5 text-petrol" />}>الدفع عند الاستلام</Badge>
          </div>

          {/* التوصيل — سطرٌ مميّز */}
          {vendor.deliveryInfo && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-petrol">
              <Truck className="h-3.5 w-3.5" /> {vendor.deliveryInfo}
            </p>
          )}

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

      {/* نبض المتجر — آخر أحداثه الحيّة */}
      {activities.length > 0 && (
        <section className="bg-card rounded-3xl border border-line p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-neutral-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-petrol opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-petrol" />
            </span>
            نبض المتجر
          </h2>
          <ul className="space-y-2.5">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 text-sm">
                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gold-500/10 text-gold-300">
                  <ActivityIcon kind={a.kind} />
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-200">{a.message}</span>
                <span className="flex-shrink-0 text-[11px] text-neutral-500">{timeAgoAr(a.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* أقسام المتجر الداخليّة — شريط تنقّلٍ سريع (يظهر إن كان للمتجر أقسام) */}
      {hasSections && (
        <nav aria-label="أقسام المتجر" className="sticky top-[3.75rem] z-10 -mx-4 bg-[rgb(var(--c-bg))]/90 px-4 py-2 backdrop-blur">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {grouped.map((s) => (
              <a
                key={s.id}
                href={`#sec-${s.id}`}
                className="bg-card2 inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-neutral-300 transition hover:border-gold-500/50 hover:text-gold-200"
              >
                {s.nameAr}
                <span className="text-xs font-normal text-neutral-500 nums">{s.items.length}</span>
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* الرفوف — مجمّعةً حسب أقسام المتجر الداخليّة، أو قائمةً واحدة إن لم تكن هناك أقسام */}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-neutral-400">
          الرفوف قيد التجهيز — لا توجد منتجات بعد.
        </div>
      ) : hasSections ? (
        <div className="space-y-6">
          {grouped.map((s) => (
            <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-28">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
                <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
                {s.nameAr}
                <span className="text-sm font-medium text-neutral-400">· <span className="nums">{s.items.length}</span> منتج</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {s.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          ))}
          {ungrouped.length > 0 && (
            <section id="sec-other" className="scroll-mt-28">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
                <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
                منتجات أخرى
                <span className="text-sm font-medium text-neutral-400">· <span className="nums">{ungrouped.length}</span> منتج</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {ungrouped.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            على الرفوف <span className="text-sm font-medium text-neutral-400">· <span className="nums">{vendor.productCount}</span> منتج</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* تقييمات المتجر — رأيُ من اشترى منه */}
      <StoreReviews vendorId={vendor.id} />

      {/* من نفس البيئة — متاجرُ محافظتِه التي تشاركه المجال */}
      {related.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-neutral-100">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            من نفس البيئة
          </h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {related.map((s) => (
              <div key={s.id} className="w-44 flex-shrink-0">
                <StoreRailCard store={s} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// أيقونة نوع حدث النبض.
function ActivityIcon({ kind }: { kind: string }) {
  const cls = "h-4 w-4";
  if (kind === "restock" || kind === "new_arrival") return <Boxes className={cls} />;
  if (kind === "new_section") return <Sparkles className={cls} />;
  if (kind === "most_visited") return <TrendingUp className={cls} />;
  if (kind === "promo") return <Tag className={cls} />;
  return <Sparkles className={cls} />;
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
