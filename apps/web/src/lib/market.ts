/**
 * اسمُ السوق يتكيّف مع المحافظة المختارة: «سوگ {gov}» → «سوگ بغداد».
 * الأسواق بلا العنصر النائب {gov} تُعرض كما هي («سوگ الطعام»).
 */
export function marketDisplayName(name: string, govName?: string): string {
  return name.replace(/\{gov\}/g, govName ?? "العراق");
}
