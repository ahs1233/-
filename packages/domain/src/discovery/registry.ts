/**
 * Discovery Model V2 — سجلّ المُسقِطات (المرحلة A · PR1).
 * الأنواع **تسجّل نفسها** (ثابت #3: لا `switch(type)`). إضافة نوع = تسجيل مُسقِط
 * يحمل مِلَفّ أوزانه — فيستحيل تسجيل نوع بلا أوزان (يُنفَّذ ثابت «كل نوع له أوزان» بالنوع).
 */
import type { DiscoveryItem, DiscoveryItemType, WeightProfile } from "./item";

/** سياق الإسقاط: اللحظة + أعلى شعبية في مجموعة المرشّحين (لتطبيع popularity إلى [0..1]). */
export interface ProjectionContext {
  now: Date;
  popMax: number;
}

/**
 * مُسقِط نوعٍ واحد: يحوّل «حقائق مصدر» إلى `DiscoveryItem` مطبّع. نقيّ (بلا قاعدة/شبكة).
 * `weightProfile` مُرفَق بالنوع — مصدر واحد للحقيقة يستهلكه المُصنِّف عبر `weightProfileFor`.
 */
export interface Projector<TFacts = unknown, TCard = unknown> {
  readonly type: DiscoveryItemType;
  readonly weightProfile: WeightProfile;
  project(facts: TFacts, ctx: ProjectionContext): DiscoveryItem<TCard>;
}

const REGISTRY = new Map<DiscoveryItemType, Projector>();

/** يسجّل مُسقِطاً (يُستدعى عند تحميل وحدة المُسقِط). آخر تسجيل لنوعٍ يفوز. */
export function registerProjector<TFacts, TCard>(p: Projector<TFacts, TCard>): void {
  REGISTRY.set(p.type, p as Projector);
}

export function getProjector(type: DiscoveryItemType): Projector | undefined {
  return REGISTRY.get(type);
}

/** ملف أوزان النوع من السجلّ (لا `switch` — بحث في خريطة). */
export function weightProfileFor(type: DiscoveryItemType): WeightProfile | undefined {
  return REGISTRY.get(type)?.weightProfile;
}

/** الأنواع المُسجَّلة فعلاً (لاختبار التغطية). */
export function registeredTypes(): DiscoveryItemType[] {
  return [...REGISTRY.keys()];
}

/** للاختبارات فقط: تفريغ السجلّ (عزل بين الاختبارات). */
export function __clearRegistryForTests(): void {
  REGISTRY.clear();
}
