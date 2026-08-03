import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppImage } from "@/src/components/app-image";
import { SectionPageHeader } from "@/src/components/section-page-header";
import { getServerApi } from "@/src/trpc/server";
import { articleBySlug, type Article } from "@/src/lib/articles";

export const dynamic = "force-dynamic";

async function loadArticle(slug: string): Promise<Article | null> {
  try {
    const api = await getServerApi();
    const rows = await api.appearance.articles();
    const a = rows.find((x) => x.slug === slug);
    if (a) return a as Article;
  } catch {
    /* احتياطٌ إن لم تُربط القاعدة */
  }
  return articleBySlug(slug);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await loadArticle(params.slug);
  return { title: a ? `${a.title} — السوگ` : "مقال" };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const a = await loadArticle(params.slug);
  if (!a) notFound();

  return (
    <div className="space-y-5">
      <SectionPageHeader title={a.label} backHref="/discover" />
      <article className="space-y-4">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-line">
          <AppImage src={a.cover} alt={a.title} sizes="(max-width:768px) 100vw, 768px" priority className="h-full w-full object-cover" />
        </div>
        <h1 className="text-2xl font-extrabold leading-snug text-neutral-100">{a.title}</h1>
        {a.excerpt && <p className="text-sm text-neutral-400">{a.excerpt}</p>}
        <div className="space-y-3 leading-relaxed text-neutral-200">
          {a.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
