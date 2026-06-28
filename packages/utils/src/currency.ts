/**
 * تنسيق الدينار العراقي (IQD).
 * الدينار عملة بلا كسور عملية متداولة (أصغر فئة 250 د.ع)، لذا نعرض أعداداً
 * صحيحة دون منازل عشرية، مع فاصل آلاف عربي صحيح.
 */

const IQD_FORMATTER = new Intl.NumberFormat("ar-IQ", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/** يحوّل قيمة رقمية أو نصية إلى "12,500 د.ع". */
export function formatIQD(
  value: number | string,
  opts: { withSymbol?: boolean; latinDigits?: boolean } = {},
): string {
  const { withSymbol = true, latinDigits = false } = opts;
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return withSymbol ? "٠ د.ع" : "٠";
  const rounded = Math.round(num);
  let formatted = latinDigits
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        rounded,
      )
    : IQD_FORMATTER.format(rounded);
  return withSymbol ? `${formatted} د.ع` : formatted;
}

/** يحوّل نصاً مُدخلاً (قد يحوي أرقاماً عربية وفواصل) إلى رقم صحيح. */
export function parseIQD(input: string): number {
  const cleaned = input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : 0;
}
