"use client";

import { useState } from "react";
import { GripVertical, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardBody } from "@al-souq/ui";
import { SECTION_LABELS, type SectionCfg } from "@/src/lib/theme";
import { useAppearanceDraft } from "../_appearance-draft";
import { SaveBar } from "../_save-bar";

// الأقسام التي تحمل عنواناً قابلاً للتخصيص في الرئيسية.
const TITLED = new Set(["souks", "best_selling", "new", "stores", "categories"]);

function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export default function SectionsEditor() {
  const d = useAppearanceDraft();
  const [drag, setDrag] = useState<number | null>(null);

  function setOverride(key: string, val: string) {
    d.setSectionTitles((m) => {
      const next = { ...m };
      if (val.trim()) next[key] = val;
      else delete next[key];
      return next;
    });
  }
  const move = (i: number, dir: -1 | 1) => d.setSections((a) => reorder(a, i, i + dir));

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-extrabold text-brand-800">أقسام الرئيسية</h1>
        <p className="text-sm text-neutral-500">اسحب لإعادة الترتيب، أظهِر/أخفِ، وخصّص العناوين. البطل (بوّابة المحافظة) يبقى أوّلاً دائماً.</p>
      </div>

      <Card>
        <CardBody>
          <ul className="space-y-2">
            {d.sections.map((s: SectionCfg, i) => (
              <li
                key={s.key}
                draggable
                onDragStart={() => setDrag(i)}
                onDragEnter={() => {
                  if (drag !== null && drag !== i) {
                    d.setSections((a) => reorder(a, drag, i));
                    setDrag(i);
                  }
                }}
                onDragEnd={() => setDrag(null)}
                onDragOver={(e) => e.preventDefault()}
                className={`rounded-xl border px-2.5 py-2.5 transition ${
                  drag === i ? "border-gold-400 bg-gold-50 opacity-60" : s.visible ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="cursor-grab text-neutral-300 active:cursor-grabbing" aria-hidden><GripVertical className="h-5 w-5" /></span>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 nums">{i + 1}</span>
                  <span className={`flex-1 text-sm font-medium ${s.visible ? "text-neutral-800" : "text-neutral-400"}`}>
                    {SECTION_LABELS[s.key] ?? s.key}
                  </span>
                  <button
                    onClick={() => d.setSections((a) => a.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)))}
                    aria-label={s.visible ? "إخفاء" : "إظهار"}
                    className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                  >
                    {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  {/* أسهم احتياطيّة (وصولٌ للوحة المفاتيح) */}
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="لأعلى" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === d.sections.length - 1} aria-label="لأسفل" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                </div>
                {TITLED.has(s.key) && (
                  <input
                    value={d.sectionTitles[s.key] ?? ""}
                    onChange={(e) => setOverride(s.key, e.target.value)}
                    placeholder={`عنوان مخصّص — الافتراضيّ: ${SECTION_LABELS[s.key] ?? s.key}`}
                    maxLength={40}
                    className="mt-2 ms-12 h-8 w-[calc(100%-3rem)] rounded-lg border border-neutral-200 px-2.5 text-xs"
                  />
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <SaveBar dirty={d.dirty} unsavedCount={d.unsavedCount} allValid={d.allValid} saving={d.saving} onSave={d.commit} onDiscard={d.discard} />
    </div>
  );
}
