import "server-only";
import { cookies } from "next/headers";

export const GOV_COOKIE = "al_gov";
export const GOV_NAME_COOKIE = "al_gov_name";

/** يقرأ المحافظة المختارة من الكوكي (جانب الخادم). */
export function getGovernorate(): { id: string; name: string } | null {
  const c = cookies();
  const id = c.get(GOV_COOKIE)?.value;
  if (!id) return null;
  return { id, name: c.get(GOV_NAME_COOKIE)?.value ?? "محافظتي" };
}
