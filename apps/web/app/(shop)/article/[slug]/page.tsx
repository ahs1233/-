import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppImage } from "@/src/components/app-image";
import { SectionPageHeader } from "@/src/components/section-page-header";
import { articleBySlug } from "@/src/lib/articles";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = articleBySlug(params.slug);
  return { title: a ? `${a.title} — السوگ` : "مقال" };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const a = articleBySlug(params.slug);
  if (!a) notFound();

  return (
    <div className="space-y-5">
      <SectionPageHeader title={a.label} backHref="/discover" />
      <article className="space-y-4">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-line">
          <AppImage src={a.cover} alt={a.title} sizes="(max-width:768px) 100vw, 768px" priority className="h-full w-full object-cover" />
        </div>
        <h1 className="text-2xl font-extrabold leading-snug text-neutral-100">{a.title}</h1>
        <p className="text-sm text-neutral-400">{a.excerpt}</p>
        <div className="space-y-3 leading-relaxed text-neutral-200">
          {a.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
