"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Eye, EyeOff, Newspaper } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@al-souq/api";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import { ImageField } from "../_image-field";

type Row = inferRouterOutputs<AppRouter>["admin"]["articleList"][number];

type Form = {
  id?: string;
  slug: string;
  kind: "article" | "tip";
  title: string;
  excerpt: string;
  coverUrl: string;
  body: string; // فقرات مفصولة بأسطر
  active: boolean;
  sortOrder: number;
};

const empty: Form = { slug: "", kind: "article", title: "", excerpt: "", coverUrl: "", body: "", active: true, sortOrder: 0 };

function ArticleForm({ initial, submitting, onCancel, onSubmit }: { initial: Form; submitting: boolean; onCancel: () => void; onSubmit: (f: Form) => void }) {
  const [f, setF] = useState<Form>(initial);
  const valid = f.title.trim().length >= 2 && /^[a-z0-9-]{2,}$/.test(f.slug.trim());
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-neutral-700">النوع
          <select value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value as Form["kind"] }))} className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm">
            <option value="article">مقال اليوم</option>
            <option value="tip">نصيحة اليوم</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-neutral-700">المعرّف (slug لاتينيّ)
          <input dir="ltr" value={f.slug} onChange={(e) => setF((s) => ({ ...s, slug: e.target.value }))} placeholder="best-grill-spots" className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" disabled={!!initial.id} />
        </label>
      </div>
      <label className="block text-sm font-medium text-neutral-700">العنوان
        <input value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} maxLength={120} className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" placeholder="أفضل الأماكن للشواء في بغداد" />
      </label>
      <label className="block text-sm font-medium text-neutral-700">مقتطف (اختياري)
        <input value={f.excerpt} onChange={(e) => setF((s) => ({ ...s, excerpt: e.target.value }))} maxLength={300} className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm" />
      </label>
      <div>
        <span className="mb-1 block text-sm font-medium text-neutral-700">صورة الغلاف (اختياري — بديلٌ مصمّم إن تُركت)</span>
        <ImageField value={f.coverUrl} onChange={(url) => setF((s) => ({ ...s, coverUrl: url }))} purpose="ad" aspect="aspect-[21/9]" />
      </div>
      <label className="block text-sm font-medium text-neutral-700">النصّ (كلّ سطرٍ فقرة)
        <textarea value={f.body} onChange={(e) => setF((s) => ({ ...s, body: e.target.value }))} rows={7} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed" placeholder={"الفقرة الأولى…\nالفقرة الثانية…"} />
      </label>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input type="checkbox" checked={f.active} onChange={(e) => setF((s) => ({ ...s, active: e.target.checked }))} className="h-4 w-4 accent-brand-700" /> ظاهر
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">الترتيب
          <input type="number" value={f.sortOrder} onChange={(e) => setF((s) => ({ ...s, sortOrder: Number(e.target.value) || 0 }))} className="h-9 w-20 rounded-lg border border-neutral-300 px-2 text-sm nums" />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>إلغاء</Button>
        <Button size="sm" loading={submitting} disabled={!valid} onClick={() => onSubmit(f)}>حفظ</Button>
      </div>
    </div>
  );
}

export default function ContentEditor() {
  const { success, error } = useToast();
  const list = trpc.admin.articleList.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const done = (msg: string) => { utils.admin.articleList.invalidate(); success(msg); };
  const upsert = trpc.admin.upsertArticle.useMutation({ onSuccess: () => { done("تمّ الحفظ"); setCreating(false); setEditing(null); }, onError: (e) => error(e.message) });
  const remove = trpc.admin.deleteArticle.useMutation({ onSuccess: () => done("تمّ الحذف"), onError: (e) => error(e.message) });
  const toggle = trpc.admin.upsertArticle.useMutation({ onSuccess: () => utils.admin.articleList.invalidate(), onError: (e) => error(e.message) });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  function toForm(a: Row): Form {
    return { id: a.id, slug: a.slug, kind: a.kind === "tip" ? "tip" : "article", title: a.title, excerpt: a.excerpt ?? "", coverUrl: a.coverUrl ?? "", body: a.body.join("\n"), active: a.active, sortOrder: a.sortOrder };
  }
  function payload(f: Form) {
    return {
      id: f.id,
      slug: f.slug.trim(),
      kind: f.kind,
      title: f.title.trim(),
      excerpt: f.excerpt.trim() || null,
      coverUrl: f.coverUrl.trim() || null,
      body: f.body.split("\n").map((l) => l.trim()).filter(Boolean),
      active: f.active,
      sortOrder: f.sortOrder,
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-brand-800">المحتوى</h1>
          <p className="text-sm text-neutral-500">«مقال اليوم» و«نصيحة اليوم» — يظهران في شاشة «اكتشف اليوم».</p>
        </div>
        {!creating && <Button size="sm" onClick={() => { setCreating(true); setEditing(null); }}><Plus className="h-4 w-4" /> محتوى جديد</Button>}
      </div>

      {creating && (
        <Card><CardBody><h3 className="mb-3 font-bold text-brand-800">محتوى جديد</h3><ArticleForm initial={empty} submitting={upsert.isPending} onCancel={() => setCreating(false)} onSubmit={(f) => upsert.mutate(payload(f))} /></CardBody></Card>
      )}

      {list.isLoading && <p className="text-sm text-neutral-400">…جارٍ التحميل</p>}
      {list.data && list.data.length === 0 && !creating && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 py-10 text-neutral-400">
          <Newspaper className="h-8 w-8" /><p className="text-sm">لا محتوى بعد — أضِف أوّل مقال.</p>
        </div>
      )}

      {list.data?.map((a) => (
        <Card key={a.id}>
          {editing === a.id ? (
            <CardBody><ArticleForm initial={toForm(a)} submitting={upsert.isPending} onCancel={() => setEditing(null)} onSubmit={(f) => upsert.mutate(payload(f))} /></CardBody>
          ) : (
            <div className="flex items-center gap-3 p-3">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Newspaper className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold text-neutral-800">{a.title}</span>
                  {!a.active && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">مخفيّ</span>}
                </div>
                <p className="text-[11px] text-neutral-400">{a.kind === "tip" ? "نصيحة اليوم" : "مقال اليوم"} · <span dir="ltr">{a.slug}</span></p>
              </div>
              <button onClick={() => toggle.mutate({ ...({ id: a.id, slug: a.slug, kind: a.kind as "article" | "tip", title: a.title, excerpt: a.excerpt, coverUrl: a.coverUrl, body: a.body, sortOrder: a.sortOrder }), active: !a.active })} aria-label={a.active ? "إخفاء" : "إظهار"} className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100">{a.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              <button onClick={() => { setEditing(a.id); setCreating(false); }} aria-label="تعديل" className="grid h-9 w-9 place-items-center rounded-lg text-brand-600 hover:bg-brand-50"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => { if (confirm(`حذف «${a.title}»؟`)) remove.mutate({ id: a.id }); }} aria-label="حذف" className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
