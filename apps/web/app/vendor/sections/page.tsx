"use client";

import { useState } from "react";
import { Layers, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Package } from "lucide-react";
import { Button, Card, CardBody, Input } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

// إدارة أقسام المتجر الداخليّة (رفوف/خدمات): إضافة، تسمية، ترتيب، حذف.
// حذف القسم لا يحذف منتجاته — تُفرَّغ من القسم فقط (تظهر تحت «منتجات أخرى»).
export default function VendorSectionsPage() {
  const utils = trpc.useUtils();
  const sections = trpc.vendor.sections.useQuery();
  const refresh = () => utils.vendor.sections.invalidate();
  const upsert = trpc.vendor.sectionUpsert.useMutation({ onSuccess: refresh });
  const remove = trpc.vendor.sectionDelete.useMutation({ onSuccess: refresh });
  const reorder = trpc.vendor.sectionReorder.useMutation({ onSuccess: refresh });

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const list = sections.data ?? [];

  function add() {
    const name = newName.trim();
    if (name.length < 2) return;
    upsert.mutate({ nameAr: name }, { onSuccess: () => { setNewName(""); refresh(); } });
  }
  function saveEdit(id: string) {
    const name = editName.trim();
    if (name.length < 2) return;
    upsert.mutate({ id, nameAr: name }, { onSuccess: () => { setEditId(null); refresh(); } });
  }
  function move(index: number, dir: -1 | 1) {
    const next = [...list];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    reorder.mutate({ orderedIds: next.map((s) => s.id) });
  }

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Layers className="h-5 w-5 text-brand-600" /> أقسام المتجر
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          نظّم منتجاتك في أقسامٍ داخليّة (رفوف أو خدمات) حسب نوع متجرك — تظهر مبوَّبةً في صفحة متجرك.
        </p>
      </div>

      {/* إضافة قسم */}
      <Card>
        <CardBody>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="اسم القسم — مثل: هواتف، صيانة، مكياج"
              maxLength={40}
            />
            <Button onClick={add} loading={upsert.isPending && !editId} disabled={newName.trim().length < 2}>
              <Plus className="h-4 w-4" /> إضافة
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* القائمة */}
      {sections.isLoading ? (
        <p className="text-sm text-neutral-400">…جارٍ التحميل</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 py-10 text-neutral-400">
          <Layers className="h-8 w-8" />
          <p className="text-sm">لا أقسام بعد — أضِف أوّل قسمٍ لمتجرك.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((s, i) => (
            <li key={s.id}>
              <Card>
                <div className="flex items-center gap-2 p-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Layers className="h-5 w-5" />
                  </span>
                  {editId === s.id ? (
                    <div className="flex flex-1 gap-2">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} autoFocus />
                      <Button size="sm" loading={upsert.isPending} onClick={() => saveEdit(s.id)}>حفظ</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>إلغاء</Button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-neutral-800">{s.nameAr}</p>
                        <p className="flex items-center gap-1 text-[11px] text-neutral-400">
                          <Package className="h-3 w-3" /> <span className="nums">{s.productCount}</span> منتج
                        </p>
                      </div>
                      <div className="flex flex-col">
                        <button aria-label="أعلى" disabled={i === 0} onClick={() => move(i, -1)} className="text-neutral-400 hover:text-brand-600 disabled:opacity-30">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button aria-label="أسفل" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="text-neutral-400 hover:text-brand-600 disabled:opacity-30">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                      <button aria-label="تعديل" onClick={() => { setEditId(s.id); setEditName(s.nameAr); }} className="grid h-9 w-9 place-items-center rounded-lg text-brand-600 hover:bg-brand-50">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="حذف"
                        onClick={() => { if (confirm(`حذف قسم «${s.nameAr}»؟ ستبقى منتجاته بلا قسم.`)) remove.mutate({ id: s.id }); }}
                        className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
