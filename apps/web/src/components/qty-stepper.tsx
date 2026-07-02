"use client";

/** قطعة تعديل الكمية الموحّدة (سلة + صفحة المنتج) مع تسميات لقارئات الشاشة. */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const btn = size === "sm" ? "px-2.5 py-1" : "px-3 py-2";
  const box = size === "sm" ? "text-sm" : "";
  return (
    <div className={`flex items-center rounded-lg border border-neutral-300 ${box}`}>
      <button
        type="button"
        aria-label="إنقاص الكمية"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="min-w-8 text-center nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="زيادة الكمية"
        className={btn}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        +
      </button>
    </div>
  );
}
