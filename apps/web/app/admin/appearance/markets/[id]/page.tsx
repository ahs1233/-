"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUp, ArrowDown, Eye, EyeOff, ChevronRight, RotateCcw } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { SECTION_LABELS, DEFAULT_SECTIONS, type SectionCfg } from "@/src/lib/theme";
import { trpc } from "@/src/trpc/react";

// الأقسام التي تحمل عنواناً قابلاً للتخصيص داخل السوق.
const TITLED = new Set(["categories", "products", "stores", "top_stores"]);

function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export default function MarketDisplayEditor() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { success, error } = useToast();
  const utils = trpc.useUtils();
  const list = trpc.admin.marketList.useQuery(undefined, { retry: false });
  const market = list.data?.find((m) => m.id === id);

  // الحالة المبدئيّة: إعداد السوق إن وُجد، وإلا الافتراضيّ العامّ.
  const initial = useMemo(() => {
    const cfg = (market?.config ?? null) as { sections?: SectionCfg[]; sectionTitles?: Record<string, string> } | null;
    const sections = cfg?.sections?.length ? cfg.sections : DEFAULT_SECTIONS;
    return { sections: sections.map((s) => ({ ...s })), titles: { ...(cfg?.sectionTitles ?? {}) } };
  }, [market]);

  const [sections, setSections] = useState<SectionCfg[] | null>(null);
  const [titles, setTitles] = useState<Record<string, string> | null>(null);
  const secs = sections ?? initial.sections;
  const ttl = titles ?? initial.titles;
  const dirty = sections !== null || titles !== null;

  const save = trpc.admin.updateMarketDisplay.useMutation({
    onSuccess: () => {
      utils.admin.marketList.invalidate();
      setSections(null);
      setTitles(null);
      success("تم حفظ عرض السوق");
    },
    onError: (e) => error(e.message),
  });

  const move = (i: number, dir: -1 | 1) => setSections(reorder(secs, i, i + dir));
  const toggle = (i: number) => setSections(secs.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)));
  const setTitle = (key: string, val: string) => {
    const next = { ...ttl };
    if (val.trim()) next[key] = val;
    else delete next[key];
    setTitles(next);
  };

  if (list.isLoading) return <p className="p-4 text-sm text-neutral-400">…جارٍ التحميل</p>;
  if (!market) return <p className="p-4 text-sm text-neutral-500">لم يُعثر على السوق. <Link href="/admin/appearance/markets" className="text-brand-600 underline">عودة</Link></p>;

  const isStores = market.kind === "stores";

  return (
    <div className="space-y-5 pb-24">
      <div>
        <Link href="/admin/appearance/markets" className="mb-1 inline-flex items-center gap-0.5 text-sm text-brand-600 hover:text-brand-700">
          <ChevronRight className="h-4 w-4" /> الأسواق
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-brand-800">
          <span>{market.icon}</span> ضبط عرض: {market.nameAr}
        </h1>
        <p className="text-sm text-neutral-500">
          رتّب أقسام هذا السوق، أظهِرها/أخفِها، وخصّص عناوينها — تحكّمٌ كاملٌ لهذا السوق وحده، مستقلٌّ عن الإعداد العامّ.
        </p>
      </div>

      {!isStores && (
        <div className="rounded-xl border border-gold-300 bg-gold-50 p-3 text-sm text-gold-800">
          هذا السوق من نوع «فئة/رابط»؛ ترتيب الأقسام يسري على أسواق «كل المتاجر» (الواقعيّة والإلكترونيّة). لأسواق الفئات، يُعرض المحتوى تلقائياً (الأقسام ثم المنتجات).
        </div>
      )}

      <Card>
        <CardBody>
          <ul className="space-y-2">
            {secs.map((s, i) => (
              <li
                key={s.key}
                className={`rounded-xl border px-2.5 py-2.5 ${s.visible ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 nums">{i + 1}</span>
                  <span className={`flex-1 text-sm font-medium ${s.visible ? "text-neutral-800" : "text-neutral-400"}`}>
                    {SECTION_LABELS[s.key] ?? s.key}
                  </span>
                  <button onClick={() => toggle(i)} aria-label={s.visible ? "إخفاء" : "إظهار"} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100">
                    {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="لأعلى" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === secs.length - 1} aria-label="لأسفل" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                </div>
                {TITLED.has(s.key) && (
                  <input
                    value={ttl[s.key] ?? ""}
                    onChange={(e) => setTitle(s.key, e.target.value)}
                    placeholder={`عنوان مخصّص — الافتراضيّ: ${SECTION_LABELS[s.key] ?? s.key}`}
                    maxLength={40}
                    className="mt-2 ms-8 h-8 w-[calc(100%-2rem)] rounded-lg border border-neutral-200 px-2.5 text-xs"
                  />
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => save.mutate({ id, sections: null, sectionTitles: null })}
          disabled={save.isPending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-danger"
        >
          <RotateCcw className="h-4 w-4" /> إعادة للإعداد العامّ
        </button>
        <Button
          loading={save.isPending}
          disabled={!dirty}
          onClick={() => save.mutate({ id, sections: secs, sectionTitles: ttl })}
        >
          حفظ عرض السوق
        </Button>
      </div>
    </div>
  );
}
