/**
 * فكّ ترميز مقاطع المسار الديناميكية.
 * في App Router لا تُفكّ Next.js ترميز params تلقائياً، فالـ slug العربي يصل
 * مُرمّزاً (%D9%85…) ولا يطابق القيمة المخزّنة في قاعدة البيانات → 404.
 * نفكّ الترميز هنا بأمان (إن فشل نُعيد القيمة كما هي).
 */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
