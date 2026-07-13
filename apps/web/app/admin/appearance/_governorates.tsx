"use client";

import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Store, Megaphone } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageField } from "./_image-field";

type Souk = { label: string; q: string; img?: string; emoji?: string };
type Draft = { enabled: boolean; tagline: string; heroImageUrl: string; souks: Souk[] };

function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}

export function GovernoratesTab() {
  const { success, error } = useToast();
  const list = trpc.admin.govList.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const save = trpc.admin.updateGovernorate.useMutation({
    onSuccess: () => {
      utils.admin.govList.invalidate();
      success("تم حفظ المحافظة");
    },
    onError: (e) => error(e.message),
  });

  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function expand(g: NonNullable<typeof list.data>[number]) {
    if (open === g.id) {
      setOpen(null);
      setDraft(null);
      return;
    }
    setOpen(g.id);
    setDraft({
      enabled: g.enabled,
      tagline: g.tagline ?? "",
      heroImageUrl: g.heroImageUrl ?? "",
      souks: g.souks ?? [],
    });
  }

  if (list.isLoading) return <p className="text-sm text-neutral-400">…جارٍ التحميل</p>;
  if (list.isError || !list.data) return <p className="text-sm text-danger">تعذّر تحميل المحافظات</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        كلّ محافظةٍ تجربةٌ مختلفة: شعورٌ، صورةُ بطلٍ، وأسواقٌ خاصّة بها. المخفيّة لا تظهر للاختيار.
      </p>
      {list.data.map((g) => {
        const isOpen = open === g.id;
        return (
          <Card key={g.id}>
            <button
              onClick={() => expand(g)}
              className="flex w-full items-center gap-3 px-4 py-3 text-start"
            >
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-extrabold text-brand-700">
                {g.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-neutral-800">{g.nameAr}</span>
                  {!g.enabled && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">مخفيّة</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-3 text-[11px] text-neutral-400">
                  <span className="inline-flex items-center gap-1"><Store className="h-3 w-3" />{g.vendorCount} متجر</span>
                  <span className="inline-flex items-center gap-1"><Megaphone className="h-3 w-3" />{g.adCount} إعلان</span>
                  {g.souks.length > 0 && <span>{g.souks.length} سوق</span>}
                </span>
              </span>
              {g.heroImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.heroImageUrl} alt="" className="h-10 w-14 flex-shrink-0 rounded-lg object-cover" />
              )}
              <ChevronDown className={`h-5 w-5 flex-shrink-0 text-neutral-400 transition ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && draft && (
              <CardBody className="space-y-4 border-t border-neutral-100 pt-4">
                {/* الظهور + الشعور */}
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5">
                  <span className="text-sm font-medium text-neutral-700">تظهر في التطبيق</span>
                  <button
                    onClick={() => setDraft((d) => (d ? { ...d, enabled: !d.enabled } : d))}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${draft.enabled ? "bg-petrol/10 text-petrol" : "bg-neutral-200 text-neutral-500"}`}
                  >
                    {draft.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {draft.enabled ? "ظاهرة" : "مخفيّة"}
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">الشعور (يظهر تحت اسم المحافظة)</label>
                  <input
                    value={draft.tagline}
                    onChange={(e) => setDraft((d) => (d ? { ...d, tagline: e.target.value } : d))}
                    placeholder="قباب وأزقّة وفوانيس عند المغرب"
                    maxLength={120}
                    className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">صورة بطل المحافظة</label>
                  <ImageField
                    value={draft.heroImageUrl}
                    onChange={(url) => setDraft((d) => (d ? { ...d, heroImageUrl: url } : d))}
                    purpose="gov"
                    aspect="aspect-[3/2]"
                  />
                </div>

                {/* الأسواق */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-medium text-neutral-700">أسواق المحافظة</label>
                    <button
                      onClick={() => setDraft((d) => (d && d.souks.length < 12 ? { ...d, souks: [...d.souks, { label: "", q: "", emoji: "🛍️" }] } : d))}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> أضف سوقاً
                    </button>
                  </div>
                  <div className="space-y-2">
                    {draft.souks.map((s, i) => (
                      <div key={i} className="rounded-xl border border-neutral-200 p-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            value={s.label}
                            onChange={(e) => setDraft((d) => (d ? { ...d, souks: d.souks.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) } : d))}
                            placeholder="اسم السوق (الشورجة)"
                            className="h-9 flex-1 rounded-lg border border-neutral-300 px-2.5 text-sm"
                          />
                          <input
                            value={s.emoji ?? ""}
                            onChange={(e) => setDraft((d) => (d ? { ...d, souks: d.souks.map((x, k) => (k === i ? { ...x, emoji: e.target.value } : x)) } : d))}
                            placeholder="🛍️"
                            className="h-9 w-12 rounded-lg border border-neutral-300 text-center text-base"
                          />
                          <button onClick={() => setDraft((d) => (d ? { ...d, souks: moveItem(d.souks, i, -1) } : d))} disabled={i === 0} aria-label="لأعلى" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                          <button onClick={() => setDraft((d) => (d ? { ...d, souks: moveItem(d.souks, i, 1) } : d))} disabled={i === draft.souks.length - 1} aria-label="لأسفل" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                          <button onClick={() => setDraft((d) => (d ? { ...d, souks: d.souks.filter((_, k) => k !== i) } : d))} aria-label="حذف" className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <input
                          value={s.q}
                          onChange={(e) => setDraft((d) => (d ? { ...d, souks: d.souks.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) } : d))}
                          placeholder="كلمة البحث عند النقر (نحاس)"
                          className="mt-2 h-8 w-full rounded-lg border border-neutral-200 px-2.5 text-xs"
                        />
                      </div>
                    ))}
                    {draft.souks.length === 0 && <p className="text-xs text-neutral-400">لا أسواق — ستُعرض الأسواق الافتراضيّة.</p>}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
                  <Button variant="ghost" size="sm" onClick={() => { setOpen(null); setDraft(null); }}>إلغاء</Button>
                  <Button
                    size="sm"
                    loading={save.isPending}
                    onClick={() =>
                      save.mutate({
                        id: g.id,
                        enabled: draft.enabled,
                        tagline: draft.tagline.trim() || null,
                        heroImageUrl: draft.heroImageUrl.trim() || null,
                        souks: draft.souks.filter((s) => s.label.trim() && s.q.trim()),
                      })
                    }
                  >
                    حفظ {g.nameAr}
                  </Button>
                </div>
              </CardBody>
            )}
          </Card>
        );
      })}
    </div>
  );
}
