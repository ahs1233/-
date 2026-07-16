import { redirect } from "next/navigation";

// «المظهر» صار قسماً بتبويبات؛ نُوجّه الجذر لأوّل تبويب (الألوان).
export default function AppearanceIndex() {
  redirect("/admin/appearance/theme");
}
