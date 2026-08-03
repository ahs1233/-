"use client";

import { RotateCcw } from "lucide-react";
import { isValidHex } from "@/src/lib/theme";

/** حقلُ لونٍ بارز: مربّع كبير قابل للنقر (منتقي النظام) + قيمة Hex + استعادة. */
export function ColorField({
  label,
  hint,
  value,
  onChange,
  onReset,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (hex: string) => void;
  onReset: () => void;
}) {
  const valid = isValidHex(value);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
      <label className="relative h-14 w-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-black/10">
        <span className="block h-full w-full" style={{ backgroundColor: valid ? value : "#000" }} />
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-800">{label}</span>
          <button onClick={onReset} aria-label="استعادة" className="grid h-7 w-7 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mb-1.5 mt-0.5 text-xs text-neutral-400">{hint}</p>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          className={`h-8 w-full rounded-lg border px-2.5 text-sm nums ${valid ? "border-neutral-300" : "border-danger"}`}
        />
      </div>
    </div>
  );
}
