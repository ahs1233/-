"use client";

import { useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@al-souq/api";
import { Plus, Trash2, Pencil, Eye, EyeOff, Store, ChevronUp, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageField } from "../_image-field";

type MarketRow = inferRouterOutputs<AppRouter>["admin"]["marketList"][number];
type FormState = {
  slug: string;
  nameAr: string;
  tagline: string;
  icon: string;
  imageUrl: string;
  kind: "stores" | "category" | "external";
  categorySlug: string;
  channel: "physical" | "online";
  href: string;
  status: "live" | "soon";
  enabled: boolean;
  sortOrder: number;
};
const empty: FormState = {
  slug: "", nameAr: "", tagline: "", icon: "🏬", imageUrl: "",
  kind: "category", categorySlug: "", channel: "physical", href: "", status: "live", enabled: true, sortOrder: 0,
};
const KIND_LABEL: Record<string, string> = { stores: "كل المتاجر", category: "فئة منتجات", external: "رابط خارجيّ" };

function MarketForm({ initial, submitting, onCancel, onSubmit }: {
  initial: FormState; submitting: boolean; onCancel: () => void; onSubmit: (f: FormState) => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const valid = f.slug.trim().length >= 2 && /^[a-z0-9-]+$/.test(f.slug) && f.nameAr.trim().length >= 2;
  return (
    <div className="space-y-3">
      <ImageField value={f.imageUrl} onChange={(url) => setF((s) => ({ ...s, imageUrl: url }))} purpose="market" aspect="aspect-[16/9]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">الاسم</label>
          <input value={f.nameAr} onChange={(e) => setF((s) => ({ ...s, nameAr: e.target.value }))} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="بغداد الإلكترونية" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">المعرّف (slug)</label>
          <input dir="ltr" value={f.slug} onChange={(e) => setF((s) => ({ ...s, slug: e.target.value.toLowerCase() }))} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm nums" placeholder="electronics" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">الوصف</label>
        <input value={f.tagline} onChange={(e) => setF((s) => ({ ...s, tagline: e.target.value }))} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="أجهزة إلكترونية وإكسسوارات أصلية" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">الأيقونة</label>
          <input value={f.icon} onChange={(e) => setF((s) => ({ ...s, icon: e.target.value }))} className="h-10 w-full rounded-lg border border-neutral-300 text-center text-lg" placeholder="📱" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">النوع</label>
          <select value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value as FormState["kind"] }))} className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm">
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">الحالة</label>
          <select value={f.status} onChange={(e) => setF((s) => ({ ...s, status: e.target.value as FormState["status"] }))} className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm">
            <option value="live">مُفعّل</option>
            <option value="soon">قريباً</option>
          </select>
        </div>
      </div>
      {f.kind === "category" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">معرّف الفئة (slug)</label>
          <input dir="ltr" value={f.categorySlug} onChange={(e) => setF((s) => ({ ...s, categorySlug: e.target.value }))} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="الكترونيات" />
        </div>
      )}
      {f.kind === "stores" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">قناة المتاجر</label>
          <select value={f.channel} onChange={(e) => setF((s) => ({ ...s, channel: e.target.value as FormState["channel"] }))} className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm">
            <option value="physical">متاجر واقعيّة (سوق المدينة)</option>
            <option value="online">متاجر إلكترونيّة (إنستغرام/فيسبوك/تيك توك)</option>
          </select>
          <p className="mt-1 text-xs text-neutral-400">يعرض هذا السوق بائعي هذه القناة فقط.</p>
        </div>
      )}
      {f.kind === "external" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">الرابط</label>
          <input dir="ltr" value={f.href} onChange={(e) => setF((s) => ({ ...s, href: e.target.value }))} className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="/stores" />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={f.enabled} onChange={(e) => setF((s) => ({ ...s, enabled: e.target.checked }))} className="h-4 w-4 accent-brand-700" />
        ظاهر في الرئيسية
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>إلغاء</Button>
        <Button size="sm" loading={submitting} disabled={!valid} onClick={() => onSubmit(f)}>حفظ السوق</Button>
      </div>
    </div>
  );
}

export default function MarketsManager() {
  const { success, error } = useToast();
  const list = trpc.admin.marketList.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const done = (m: string) => { utils.admin.marketList.invalidate(); success(m); };
  const create = trpc.admin.createMarket.useMutation({ onSuccess: () => { done("تم إنشاء السوق"); setCreating(false); }, onError: (e) => error(e.message) });
  const update = trpc.admin.updateMarket.useMutation({ onSuccess: () => { done("تم حفظ السوق"); setEditing(null); }, onError: (e) => error(e.message) });
  const remove = trpc.admin.deleteMarket.useMutation({ onSuccess: () => done("تم حذف السوق"), onError: (e) => error(e.message) });
  const toggle = trpc.admin.updateMarket.useMutation({ onSuccess: () => utils.admin.marketList.invalidate(), onError: (e) => error(e.message) });
  const reorder = trpc.admin.reorderMarkets.useMutation({
    // تحديثٌ تفاؤليّ: يُظهر الترتيب الجديد فوراً ثم يثبّته الخادم.
    onMutate: async (vars) => {
      await utils.admin.marketList.cancel();
      const prev = utils.admin.marketList.getData();
      if (prev) {
        const byId = new Map(prev.map((m) => [m.id, m]));
        utils.admin.marketList.setData(undefined, vars.ids.map((id) => byId.get(id)!).filter(Boolean));
      }
      return { prev };
    },
    onError: (e, _v, cInfo) => { if (cInfo?.prev) utils.admin.marketList.setData(undefined, cInfo.prev); error(e.message); },
    onSettled: () => utils.admin.marketList.invalidate(),
  });

  function move(index: number, dir: -1 | 1) {
    const rows = list.data;
    if (!rows) return;
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const ids = rows.map((m) => m.id);
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    reorder.mutate({ ids });
  }

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  function toState(m: MarketRow): FormState {
    return {
      slug: m.slug, nameAr: m.nameAr, tagline: m.tagline ?? "", icon: m.icon ?? "", imageUrl: m.imageUrl ?? "",
      kind: (m.kind === "stores" || m.kind === "external" ? m.kind : "category"),
      categorySlug: m.categorySlug ?? "", channel: (m.channel === "online" ? "online" : "physical"),
      href: m.href ?? "",
      status: m.status === "soon" ? "soon" : "live", enabled: m.enabled, sortOrder: m.sortOrder,
    };
  }
  function payload(f: FormState) {
    return {
      slug: f.slug.trim(), nameAr: f.nameAr.trim(), tagline: f.tagline.trim() || null,
      icon: f.icon.trim() || null, imageUrl: f.imageUrl.trim() || null, kind: f.kind,
      categorySlug: f.kind === "category" ? (f.categorySlug.trim() || null) : null,
      channel: f.kind === "stores" ? f.channel : null,
      href: f.kind === "external" ? (f.href.trim() || null) : null,
      status: f.status, enabled: f.enabled, sortOrder: f.sortOrder,
    };
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-brand-800">الأسواق</h1>
          <p className="text-sm text-neutral-500">أسواق «السوگ» التي تظهر في الرئيسية — كلّ سوقٍ عالمٌ مستقلّ.</p>
        </div>
        {!creating && <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> سوق جديد</Button>}
      </div>

      {creating && (
        <Card><CardBody>
          <h3 className="mb-3 font-bold text-brand-800">سوق جديد</h3>
          <MarketForm initial={{ ...empty, sortOrder: (list.data?.length ?? 0) }} submitting={create.isPending} onCancel={() => setCreating(false)} onSubmit={(f) => create.mutate(payload(f))} />
        </CardBody></Card>
      )}

      {list.isLoading && <p className="text-sm text-neutral-400">…جارٍ التحميل</p>}
      {!list.isLoading && (list.data?.length ?? 0) > 1 && !creating && (
        <p className="text-xs text-neutral-400">رتّب الأسواق بالأسهم ↑↓ — الترتيب نفسه يظهر في الرئيسية.</p>
      )}
      {list.data?.map((m, index) => (
        <Card key={m.id}>
          {editing === m.id ? (
            <CardBody><MarketForm initial={toState(m)} submitting={update.isPending} onCancel={() => setEditing(null)} onSubmit={(f) => update.mutate({ id: m.id, ...payload(f) })} /></CardBody>
          ) : (
            <div className="flex items-center gap-3 p-3">
              <div className="flex flex-col">
                <button onClick={() => move(index, -1)} disabled={index === 0 || reorder.isPending} aria-label="تحريك للأعلى" className="grid h-5 w-6 place-items-center rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(index, 1)} disabled={index === (list.data!.length - 1) || reorder.isPending} aria-label="تحريك للأسفل" className="grid h-5 w-6 place-items-center rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-xl text-gold-300">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (m.icon || <Store className="h-5 w-5" />)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold text-neutral-800">{m.nameAr}</span>
                  {m.status === "soon" && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold text-gold-700">قريباً</span>}
                  {!m.enabled && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">مخفيّ</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                  <span dir="ltr" className="rounded bg-neutral-100 px-1.5 py-0.5">{m.slug}</span>
                  <span>{KIND_LABEL[m.kind] ?? m.kind}</span>
                </div>
              </div>
              <button onClick={() => toggle.mutate({ id: m.id, enabled: !m.enabled })} aria-label={m.enabled ? "إخفاء" : "إظهار"} className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100">
                {m.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <Link href={`/admin/appearance/markets/${m.id}`} aria-label="ضبط العرض" title="ضبط عرض هذا السوق" className="grid h-9 w-9 place-items-center rounded-lg text-brand-600 hover:bg-brand-50"><SlidersHorizontal className="h-4 w-4" /></Link>
              <button onClick={() => setEditing(m.id)} aria-label="تعديل" className="grid h-9 w-9 place-items-center rounded-lg text-brand-600 hover:bg-brand-50"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => { if (confirm(`حذف سوق «${m.nameAr}»؟`)) remove.mutate({ id: m.id }); }} aria-label="حذف" className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
