import type { ReactNode } from "react";

/** غلاف موحّد لصفحات المحتوى الثابت (القانونية/التعريفية). */
export function ContentPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="border-b border-neutral-100 pb-3">
        <h1 className="text-2xl font-extrabold text-neutral-900">{title}</h1>
        {updated && <p className="mt-1 text-xs text-neutral-400">آخر تحديث: {updated}</p>}
      </header>
      <div className="space-y-4 text-[15px] leading-7 text-neutral-700 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-neutral-900 [&_ul]:list-disc [&_ul]:ps-6 [&_li]:mt-1">
        {children}
      </div>
    </article>
  );
}
