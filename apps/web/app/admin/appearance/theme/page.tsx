"use client";

import { useMemo } from "react";
import { Check, AlertTriangle, Copy, ClipboardPaste, RotateCcw } from "lucide-react";
import { Button, Card, CardBody, useToast } from "@al-souq/ui";
import {
  buildThemeCss,
  contrastRatio,
  isValidHex,
  PRESETS,
  DEFAULT_COLORS,
  type AppearanceColors,
} from "@/src/lib/theme";
import { useAppearanceDraft } from "../_appearance-draft";
import { SaveBar } from "../_save-bar";
import { ColorField } from "../_color-field";
import { ThemePreview } from "../_theme-preview";

const FIELDS: { key: keyof AppearanceColors; label: string; hint: string }[] = [
  { key: "primary", label: "الأساسيّ (نيليّ)", hint: "الشريط، العناوين، البطاقات" },
  { key: "accent", label: "لمسة الذهب", hint: "الأزرار، الأسعار، العلامات" },
  { key: "surface", label: "سطح العاجيّ", hint: "خلفية التطبيق" },
  { key: "live", label: "الأخضر الحيّ", hint: "النبض، «موثوق»، التوصيل" },
];

export default function ThemeEditor() {
  const { success, error } = useToast();
  const d = useAppearanceDraft();
  const rampCss = useMemo(() => buildThemeCss(d.colors, ".ramp-scope"), [d.colors]);

  const checks = [
    { label: "نصٌّ أبيض على النيليّ", ratio: contrastRatio(d.colors.primary, "#ffffff"), min: 4.5 },
    { label: "نصّ الزرّ على الذهبيّ", ratio: contrastRatio(d.colors.accent, "#16223b"), min: 3 },
    { label: "نصٌّ داكن على العاجيّ", ratio: contrastRatio(d.colors.surface, "#1a1813"), min: 4.5 },
  ];

  function exportTheme() {
    void navigator.clipboard.writeText(JSON.stringify({ colors: d.colors }, null, 2));
    success("نُسخ رمز الثيم إلى الحافظة");
  }
  function importTheme() {
    const raw = prompt("ألصق رمز الثيم (JSON):");
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as { colors?: AppearanceColors };
      if (p.colors) d.setColors({ ...DEFAULT_COLORS, ...p.colors });
      success("طُبّق الثيم — راجِعه ثم احفظ");
    } catch {
      error("رمز غير صالح");
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-brand-800">الألوان والهويّة</h1>
          <p className="text-sm text-neutral-500">لون التطبيق كلّه من أربعة ألوانٍ مرساة، مع معاينةٍ حيّة على كلّ الشاشات.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => d.setColors(DEFAULT_COLORS)}>
          <RotateCcw className="h-4 w-4" /> الافتراضيّ
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {/* قوالب جاهزة بمعاينة */}
          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-bold text-brand-800">قوالب جاهزة</h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {PRESETS.map((p) => {
                  const active = FIELDS.every((f) => d.colors[f.key].toLowerCase() === p.colors[f.key].toLowerCase());
                  return <TemplateCard key={p.id} id={p.id} name={p.name} colors={p.colors} active={active} onApply={() => d.setColors(p.colors)} />;
                })}
              </div>
            </CardBody>
          </Card>

          {/* الألوان */}
          <Card>
            <CardBody className="space-y-3">
              <h2 className="font-bold text-brand-800">الألوان</h2>
              <div className="space-y-2.5">
                {FIELDS.map((f) => (
                  <ColorField
                    key={f.key}
                    label={f.label}
                    hint={f.hint}
                    value={d.colors[f.key]}
                    onChange={(hex) => d.setColors({ ...d.colors, [f.key]: hex })}
                    onReset={() => d.setColors({ ...d.colors, [f.key]: DEFAULT_COLORS[f.key] })}
                  />
                ))}
              </div>

              {/* فحص التباين */}
              <div className="space-y-1.5 rounded-xl bg-neutral-50 p-3">
                <p className="text-xs font-semibold text-neutral-600">فحص التباين (سهولة القراءة)</p>
                {checks.map((c) => {
                  const ok = c.ratio >= c.min;
                  return (
                    <div key={c.label} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-neutral-600">
                        {ok ? <Check className="h-3.5 w-3.5 text-petrol" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                        {c.label}
                      </span>
                      <span className={`nums font-semibold ${ok ? "text-petrol" : "text-warning"}`}>{c.ratio.toFixed(1)}:1</span>
                    </div>
                  );
                })}
              </div>

              {/* مقاييس الألوان المولّدة */}
              <style dangerouslySetInnerHTML={{ __html: rampCss }} />
              <div className="ramp-scope space-y-1.5">
                <RampStrip label="نيليّ" varName="brand" steps={[50, 100, 200, 300, 400, 500, 600, 700, 800, 900]} />
                <RampStrip label="ذهب" varName="gold" steps={[50, 100, 200, 300, 400, 500, 600, 700]} />
                <RampStrip label="عاجيّ" varName="sand" steps={[50, 100, 200, 300]} />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={exportTheme}><Copy className="h-4 w-4" /> نسخ الثيم</Button>
                <Button variant="outline" size="sm" onClick={importTheme}><ClipboardPaste className="h-4 w-4" /> لصق ثيم</Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* المعاينة الحيّة متعدّدة الشاشات */}
        <Card className="lg:sticky lg:top-24 lg:self-start">
          <CardBody>
            <h2 className="mb-3 font-bold text-brand-800">معاينة حيّة</h2>
            <ThemePreview colors={d.colors} />
          </CardBody>
        </Card>
      </div>

      <SaveBar dirty={d.dirty} unsavedCount={d.unsavedCount} allValid={d.allValid} saving={d.saving} onSave={d.commit} onDiscard={d.discard} />
    </div>
  );
}

function TemplateCard({ id, name, colors, active, onApply }: { id: string; name: string; colors: AppearanceColors; active: boolean; onApply: () => void }) {
  const css = useMemo(() => buildThemeCss(colors, `.tpl-${id}`), [colors, id]);
  return (
    <button onClick={onApply} className={`overflow-hidden rounded-xl border text-start transition ${active ? "border-gold-400 ring-2 ring-gold-200" : "border-neutral-200 hover:border-gold-300"}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className={`tpl-${id} relative h-16 bg-sand-50 p-2`}>
        <div className="flex h-full flex-col justify-between rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 p-1.5">
          <span className="text-[8px] font-bold text-gold-300">سوگ</span>
          <span className="inline-block w-fit rounded bg-gold-500 px-1.5 py-0.5 text-[7px] font-extrabold text-brand-900">زرّ</span>
        </div>
        {active && <span className="absolute end-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-gold-500 text-brand-900"><Check className="h-3 w-3" /></span>}
      </div>
      <span className="block px-2 py-1.5 text-xs font-semibold text-neutral-700">{name}</span>
    </button>
  );
}

function RampStrip({ label, varName, steps }: { label: string; varName: string; steps: number[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 flex-shrink-0 text-[10px] font-semibold text-neutral-500">{label}</span>
      <div className="flex flex-1 overflow-hidden rounded-lg ring-1 ring-black/5">
        {steps.map((s) => (
          <span key={s} className="h-6 flex-1" style={{ backgroundColor: `rgb(var(--c-${varName}-${s}))` }} />
        ))}
      </div>
    </div>
  );
}
