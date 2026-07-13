"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";
import {
  DEFAULT_APPEARANCE,
  isValidHex,
  serviceStatusOf,
  type AppearanceColors,
  type SectionCfg,
  type ServiceCfg,
} from "@/src/lib/theme";

const COLOR_KEYS: (keyof AppearanceColors)[] = ["primary", "accent", "surface", "live"];

type StoredAppearance = {
  colors?: AppearanceColors;
  sections?: SectionCfg[];
  services?: ServiceCfg[];
  sectionTitles?: Record<string, string>;
  serviceLabels?: Record<string, string>;
};

/**
 * حالةُ مسودّة «المظهر» المشتركة بين محرّرات (الألوان/الأقسام/الخدمات).
 * تحمّل الكائن الكامل من الخادم، وتتيح تعديل شريحةٍ منه، وتحفظ الكائن كاملاً
 * كي لا يطمس حفظُ شريحةٍ الشرائحَ الأخرى.
 */
export function useAppearanceDraft() {
  const { success, error } = useToast();
  const q = trpc.admin.getAppearance.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const [colors, setColors] = useState<AppearanceColors>(DEFAULT_APPEARANCE.colors);
  const [sections, setSections] = useState<SectionCfg[]>(DEFAULT_APPEARANCE.sections);
  const [services, setServices] = useState<ServiceCfg[]>(DEFAULT_APPEARANCE.services);
  const [sectionTitles, setSectionTitles] = useState<Record<string, string>>({});
  const [serviceLabels, setServiceLabels] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState("");

  const snapshot = useCallback(
    () => JSON.stringify({ colors, sections, services, sectionTitles, serviceLabels }),
    [colors, sections, services, sectionTitles, serviceLabels],
  );

  useEffect(() => {
    const v = (q.data ?? null) as StoredAppearance | null;
    const c = v?.colors ? { ...DEFAULT_APPEARANCE.colors, ...v.colors } : DEFAULT_APPEARANCE.colors;
    const s = v?.sections?.length ? v.sections : DEFAULT_APPEARANCE.sections;
    // تطبيع الخدمات إلى الحالة الرباعيّة الرسميّة.
    const sv = (v?.services?.length ? v.services : DEFAULT_APPEARANCE.services).map((x) => ({
      key: x.key,
      status: serviceStatusOf(x),
    }));
    const st = v?.sectionTitles ?? {};
    const sl = v?.serviceLabels ?? {};
    setColors(c);
    setSections(s);
    setServices(sv);
    setSectionTitles(st);
    setServiceLabels(sl);
    setBaseline(JSON.stringify({ colors: c, sections: s, services: sv, sectionTitles: st, serviceLabels: sl }));
  }, [q.data]);

  const save = trpc.admin.updateAppearance.useMutation({
    onSuccess: () => {
      utils.admin.getAppearance.invalidate();
      setBaseline(snapshot());
      success("تم حفظ المظهر — يظهر على التطبيق فوراً");
    },
    onError: (e) => error(e.message),
  });

  const allValid = COLOR_KEYS.every((k) => isValidHex(colors[k]));
  const dirty = baseline !== "" && baseline !== snapshot();

  // عدد الشرائح المتغيّرة (لعرض «لديك N تعديلات غير محفوظة»).
  let unsavedCount = 0;
  if (baseline) {
    const b = JSON.parse(baseline) as StoredAppearance;
    if (JSON.stringify(b.colors) !== JSON.stringify(colors)) unsavedCount++;
    if (JSON.stringify(b.sections) !== JSON.stringify(sections)) unsavedCount++;
    if (JSON.stringify(b.services) !== JSON.stringify(services)) unsavedCount++;
    if (JSON.stringify(b.sectionTitles ?? {}) !== JSON.stringify(sectionTitles)) unsavedCount++;
    if (JSON.stringify(b.serviceLabels ?? {}) !== JSON.stringify(serviceLabels)) unsavedCount++;
  }

  function commit() {
    save.mutate({
      colors,
      sections,
      // نُرسل status الرسميّ + نشتقّ visible/soon للتوافق الخلفيّ.
      services: services.map((s) => ({
        key: s.key,
        status: s.status,
        visible: s.status !== "hidden",
        soon: s.status === "soon",
      })),
      sectionTitles,
      serviceLabels,
    });
  }
  function discard() {
    const b = JSON.parse(baseline) as Required<StoredAppearance>;
    setColors(b.colors);
    setSections(b.sections);
    setServices(b.services);
    setSectionTitles(b.sectionTitles ?? {});
    setServiceLabels(b.serviceLabels ?? {});
  }

  return {
    isLoading: q.isLoading,
    colors, setColors,
    sections, setSections,
    services, setServices,
    sectionTitles, setSectionTitles,
    serviceLabels, setServiceLabels,
    dirty, unsavedCount, allValid,
    saving: save.isPending,
    commit, discard,
  };
}
