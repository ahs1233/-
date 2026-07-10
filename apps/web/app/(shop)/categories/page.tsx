import Link from "next/link";
import { Card, CardBody } from "@al-souq/ui";
import { getCachedCategories } from "@/src/lib/catalog-cache";

// الصفحة ديناميكية (التخطيط يقرأ كوكي المحافظة)، لكن بيانات الفئات تُخدَم من الكاش.
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getCachedCategories();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-brand-800">الفئات</h1>
      <div className="space-y-3">
        {categories.map((c) => (
          <Card key={c.id}>
            <CardBody>
              <Link href={`/category/${c.slug}`} className="font-bold text-brand-600">
                {c.nameAr}
              </Link>
              {c.children.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.children.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/category/${ch.slug}`}
                      className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-200"
                    >
                      {ch.nameAr}
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
