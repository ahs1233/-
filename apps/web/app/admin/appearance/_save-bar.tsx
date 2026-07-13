"use client";

import { Undo2, Check, Loader2, CircleAlert } from "lucide-react";
import { Button } from "@al-souq/ui";

/** شريط حفظٍ ثابت أسفل الشاشة بحالةٍ واضحة وعدّاد تعديلات. */
export function SaveBar({
  dirty,
  unsavedCount,
  allValid,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  unsavedCount: number;
  allValid: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.5)] backdrop-blur md:mr-56">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-2">
        <span className={`flex flex-1 items-center gap-1.5 text-xs font-semibold ${saving ? "text-brand-600" : dirty ? "text-amber-600" : "text-petrol"}`}>
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الحفظ…</>
          ) : dirty ? (
            <><CircleAlert className="h-4 w-4" /> لديك {unsavedCount} {unsavedCount === 1 ? "تعديل غير محفوظ" : "تعديلات غير محفوظة"}</>
          ) : (
            <><Check className="h-4 w-4" /> جميع التغييرات محفوظة</>
          )}
        </span>
        {dirty && (
          <Button variant="outline" size="sm" onClick={onDiscard}>
            <Undo2 className="h-4 w-4" /> تراجع
          </Button>
        )}
        <Button size="lg" loading={saving} disabled={!allValid || !dirty} onClick={onSave}>
          {allValid ? "حفظ المظهر" : "أدخِل ألواناً صحيحة"}
        </Button>
      </div>
    </div>
  );
}
