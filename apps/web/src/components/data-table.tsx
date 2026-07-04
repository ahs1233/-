"use client";

import { useMemo, useState, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** قيمة الفرز (تُفعّل الفرز على العمود عند وجودها). */
  sortValue?: (row: T) => string | number;
  align?: "start" | "end" | "center";
  /** إخفاء تسمية العمود في عرض الجوال (للإجراءات مثلاً). */
  hideLabelOnMobile?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyLabel?: string;
};

const alignClass = { start: "text-start", end: "text-end", center: "text-center" } as const;

export function DataTable<T>({ columns, rows, getRowKey, pageSize = 15, initialSort, emptyLabel = "لا نتائج" }: Props<T>) {
  const [sortKey, setSortKey] = useState(initialSort?.key ?? "");
  const [dir, setDir] = useState<"asc" | "desc">(initialSort?.dir ?? "desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const arr = [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, dir, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const pageRows = sorted.slice(current * pageSize, current * pageSize + pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
    setPage(0);
  }

  if (sorted.length === 0) {
    return <p className="rounded-xl border border-neutral-200 bg-white py-10 text-center text-neutral-400">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {/* جدول — سطح المكتب */}
      <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-medium ${alignClass[c.align ?? "start"]}`}>
                  {c.sortValue ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                    >
                      {c.header}
                      <span className="text-[10px] text-neutral-400">{sortKey === c.key ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {pageRows.map((row) => (
              <tr key={getRowKey(row)} className="hover:bg-neutral-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 align-middle ${alignClass[c.align ?? "start"]}`}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* بطاقات — الجوال */}
      <div className="space-y-3 md:hidden">
        {pageRows.map((row) => (
          <div key={getRowKey(row)} className="space-y-1.5 rounded-xl border border-neutral-200 bg-white p-3">
            {columns.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                {!c.hideLabelOnMobile && <span className="flex-shrink-0 text-xs text-neutral-400">{c.header}</span>}
                <span className={c.hideLabelOnMobile ? "w-full" : "text-sm"}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ترقيم الصفحات */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            صفحة <span className="nums">{current + 1}</span> من <span className="nums">{pages}</span> ·{" "}
            <span className="nums">{sorted.length}</span> عنصر
          </span>
          <div className="flex gap-1">
            <button
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="rounded-lg border border-neutral-200 px-3 py-1 disabled:opacity-40 enabled:hover:bg-neutral-100"
            >
              السابق
            </button>
            <button
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="rounded-lg border border-neutral-200 px-3 py-1 disabled:opacity-40 enabled:hover:bg-neutral-100"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
