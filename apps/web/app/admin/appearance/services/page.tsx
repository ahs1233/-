"use client";

import { useState } from "react";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardBody } from "@al-souq/ui";
import { SERVICE_LABELS, SERVICE_STATUS_META, SERVICE_STATUS_ORDER, type ServiceCfg, type ServiceStatus } from "@/src/lib/theme";
import { useAppearanceDraft } from "../_appearance-draft";
import { SaveBar } from "../_save-bar";

function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export default function ServicesEditor() {
  const d = useAppearanceDraft();
  const [drag, setDrag] = useState<number | null>(null);

  function setStatus(i: number, status: ServiceStatus) {
    d.setServices((a) => a.map((x, k) => (k === i ? { ...x, status } : x)));
  }
  function setLabel(key: string, val: string) {
    d.setServiceLabels((m) => {
      const next = { ...m };
      if (val.trim()) next[key] = val;
      else delete next[key];
      return next;
    });
  }
  const move = (i: number, dir: -1 | 1) => d.setServices((a) => reorder(a, i, i + dir));

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-extrabold text-brand-800">خدمات السوگ</h1>
        <p className="text-sm text-neutral-500">اسحب لإعادة الترتيب، خصّص التسميات، وحدّد حالة كلّ خدمة.</p>
      </div>

      {/* مفتاح الحالات */}
      <div className="flex flex-wrap gap-3 rounded-xl bg-neutral-50 p-3 text-xs">
        {SERVICE_STATUS_ORDER.map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5 text-neutral-600">
            <span className={`h-2.5 w-2.5 rounded-full ${SERVICE_STATUS_META[st].dot}`} /> {SERVICE_STATUS_META[st].label}
          </span>
        ))}
      </div>

      <Card>
        <CardBody>
          <ul className="space-y-2">
            {d.services.map((s: ServiceCfg, i) => (
              <li
                key={s.key}
                draggable
                onDragStart={() => setDrag(i)}
                onDragEnter={() => {
                  if (drag !== null && drag !== i) {
                    d.setServices((a) => reorder(a, drag, i));
                    setDrag(i);
                  }
                }}
                onDragEnd={() => setDrag(null)}
                onDragOver={(e) => e.preventDefault()}
                className={`rounded-xl border px-2.5 py-2.5 transition ${drag === i ? "border-gold-400 bg-gold-50 opacity-60" : "border-neutral-200 bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="cursor-grab text-neutral-300 active:cursor-grabbing" aria-hidden><GripVertical className="h-5 w-5" /></span>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 nums">{i + 1}</span>
                  <span className={`flex-1 text-sm font-medium ${s.status === "hidden" ? "text-neutral-400" : "text-neutral-800"}`}>
                    {SERVICE_LABELS[s.key] ?? s.key}
                  </span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="لأعلى" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === d.services.length - 1} aria-label="لأسفل" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                </div>

                {/* محدّد الحالة الرباعيّ */}
                <div className="mt-2 ms-12 flex flex-wrap gap-1.5">
                  {SERVICE_STATUS_ORDER.map((st) => {
                    const on = s.status === st;
                    const meta = SERVICE_STATUS_META[st];
                    return (
                      <button
                        key={st}
                        onClick={() => setStatus(i, st)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${on ? meta.chip + " ring-1 ring-current" : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
                      </button>
                    );
                  })}
                </div>

                <input
                  value={d.serviceLabels[s.key] ?? ""}
                  onChange={(e) => setLabel(s.key, e.target.value)}
                  placeholder={`تسمية مخصّصة — الافتراضيّ: ${SERVICE_LABELS[s.key] ?? s.key}`}
                  maxLength={40}
                  className="mt-2 ms-12 h-8 w-[calc(100%-3rem)] rounded-lg border border-neutral-200 px-2.5 text-xs"
                />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <SaveBar dirty={d.dirty} unsavedCount={d.unsavedCount} allValid={d.allValid} saving={d.saving} onSave={d.commit} onDiscard={d.discard} />
    </div>
  );
}
