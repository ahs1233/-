"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Plus, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageField } from "../../_image-field";

type Souk = { label: string; q: string; img?: string; emoji?: string; color?: string; status?: "active" | "hidden" };
type Draft = { enabled: boolean; tagline: string; heroImageUrl: string; souks: Souk[] };

function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m!);
  return next;
}

export default function GovernorateEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error } = useToast();
  const list = trpc.admin.govList.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const save = trpc.admin.updateGovernorate.useMutation({
    onSuccess: () => {
      utils.admin.govList.invalidate();
      success("تم حفظ المحافظة — يظهر على التطبيق فوراً");
    },
    onError: (e) => error(e.message),
  });

  const gov = list.data?.find((g) => g.id === params.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => {
    if (gov && !draft) {
      setDraft({
        enabled: gov.enabled,
        tagline: gov.tagline ?? "",
        heroImageUrl: gov.heroImageUrl ?? "",
        souks: gov.souks ?? [],
      });
    }
  }, [gov, draft]);

  if (list.isLoading) return <p className="text-sm text-neutral-400">…جارٍ التحميل</p>;
  if (!gov) return <p className="text-sm text-danger">المحافظة غير موجودة</p>;
  if (!draft) return null;

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchSouk = (i: number, p: Partial<Souk>) => patch({ souks: draft.souks.map((x, k) => (k === i ? { ...x, ...p } : x)) });

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-brand-800">{gov.nameAr}</h1>
          <p className="text-sm text-neutral-500">صورة البطل، الشعور، والأسواق — تجربةُ هذه المحافظة.</p>
        </div>
      </div>

      <Card>
        <CardBody className="space-y-4">
          {/* الظهور */}
          <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5">
            <span className="text-sm font-medium text-neutral-700">تظهر في التطبيق</span>
            <button
              onClick={() => patch({ enabled: !draft.enabled })}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${draft.enabled ? "bg-petrol/10 text-petrol" : "bg-neutral-200 text-neutral-500"}`}
            >
              {draft.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {draft.enabled ? "ظاهرة" : "مخفيّة"}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">الشعور (يظهر تحت اسم المحافظة)</label>
            <input value={draft.tagline} onChange={(e) => patch({ tagline: e.target.value })} placeholder="قباب وأزقّة وفوانيس عند المغرب" maxLength={120} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">صورة بطل المحافظة</label>
            <ImageField value={draft.heroImageUrl} onChange={(url) => patch({ heroImageUrl: url })} purpose="gov" aspect="aspect-[3/2]" />
          </div>
        </CardBody>
      </Card>

      {/* الأسواق */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-brand-800">أسواق المحافظة</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => draft.souks.length < 12 && patch({ souks: [...draft.souks, { label: "", q: "", emoji: "🛍️", status: "active" }] })}
            >
              <Plus className="h-4 w-4" /> أضف سوقاً
            </Button>
          </div>

          {draft.souks.length === 0 && <p className="text-xs text-neutral-400">لا أسواق — ستُعرض الأسواق الافتراضيّة على الرئيسية.</p>}

          <div className="space-y-3">
            {draft.souks.map((s, i) => {
              const hidden = s.status === "hidden";
              return (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragEnter={() => { if (drag !== null && drag !== i) { patch({ souks: reorder(draft.souks, drag, i) }); setDrag(i); } }}
                  onDragEnd={() => setDrag(null)}
                  onDragOver={(e) => e.preventDefault()}
                  className={`rounded-2xl border p-3 transition ${drag === i ? "border-gold-400 bg-gold-50 opacity-60" : hidden ? "border-dashed border-neutral-200 bg-neutral-50" : "border-neutral-200"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="cursor-grab text-neutral-300 active:cursor-grabbing" aria-hidden><GripVertical className="h-5 w-5" /></span>
                    <input value={s.emoji ?? ""} onChange={(e) => patchSouk(i, { emoji: e.target.value })} placeholder="🛍️" className="h-9 w-11 rounded-lg border border-neutral-300 text-center text-base" aria-label="أيقونة" />
                    <input value={s.label} onChange={(e) => patchSouk(i, { label: e.target.value })} placeholder="اسم السوق (الشورجة)" className="h-9 flex-1 rounded-lg border border-neutral-300 px-2.5 text-sm" />
                    <button onClick={() => patchSouk(i, { status: hidden ? "active" : "hidden" })} aria-label={hidden ? "إظهار" : "إخفاء"} className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100">
                      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={() => patch({ souks: reorder(draft.souks, i, i - 1) })} disabled={i === 0} aria-label="لأعلى" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button onClick={() => patch({ souks: reorder(draft.souks, i, i + 1) })} disabled={i === draft.souks.length - 1} aria-label="لأسفل" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button onClick={() => patch({ souks: draft.souks.filter((_, k) => k !== i) })} aria-label="حذف" className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input value={s.q} onChange={(e) => patchSouk(i, { q: e.target.value })} placeholder="كلمة البحث عند النقر (نحاس)" className="h-9 rounded-lg border border-neutral-200 px-2.5 text-xs" />
                    <label className="flex h-9 items-center gap-2 rounded-lg border border-neutral-200 px-2.5 text-xs text-neutral-600">
                      لون السوق
                      <input type="color" value={s.color ?? "#1a2740"} onChange={(e) => patchSouk(i, { color: e.target.value })} className="h-6 w-8 cursor-pointer rounded" aria-label="لون السوق" />
                      {s.color && <button onClick={() => patchSouk(i, { color: undefined })} className="text-[10px] text-neutral-400 hover:text-danger">إزالة</button>}
                    </label>
                  </div>

                  <div className="mt-2">
                    <ImageField value={s.img ?? ""} onChange={(url) => patchSouk(i, { img: url || undefined })} purpose="gov" aspect="aspect-[16/9]" />
                    <p className="mt-1 text-[11px] text-neutral-400">اترك الصورة فارغةً لتظهر البلاطة بالأيقونة واللون.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* شريط الحفظ */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.5)] backdrop-blur md:mr-56">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-2">
          <span className="flex-1 text-xs font-medium text-neutral-500">تحرير {gov.nameAr}</span>
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/appearance/governorates")}>رجوع</Button>
          <Button
            size="lg"
            loading={save.isPending}
            onClick={() =>
              save.mutate({
                id: gov.id,
                enabled: draft.enabled,
                tagline: draft.tagline.trim() || null,
                heroImageUrl: draft.heroImageUrl.trim() || null,
                souks: draft.souks.filter((s) => s.label.trim() && s.q.trim()),
              })
            }
          >
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}
