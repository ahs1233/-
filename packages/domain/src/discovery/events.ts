/**
 * Δ4 — تصنيف الأحداث الموحّد (عقد معماري).
 * مصدر واحد لأسماء أحداث تفاعل المستخدم. في V1 لا تُخزَّن كلها، لكن كل ميزة
 * يجب أن تستخدم هذه الأسماء حصراً — فيصبح تسجيلها في V2 «إضافة تخزين» لا إعادة تصميم.
 */
export const DISCOVERY_EVENTS = {
  ProductViewed: "ProductViewed",
  ProductClicked: "ProductClicked",
  ProductShared: "ProductShared",
  StoreOpened: "StoreOpened",
  StoreFollowed: "StoreFollowed",
  ProductSaved: "ProductSaved",
  ProductPurchased: "ProductPurchased",
  QuestionCreated: "QuestionCreated",
  ReviewCreated: "ReviewCreated",
  NotificationOpened: "NotificationOpened",
  SearchPerformed: "SearchPerformed",
} as const;

export type DiscoveryEventName = keyof typeof DISCOVERY_EVENTS;

export interface DiscoveryEvent {
  name: DiscoveryEventName;
  actorId?: string; // المستخدم (إن وُجد)
  subjectId?: string; // productId / storeId
  governorateId?: string;
  at: Date;
  meta?: Record<string, unknown>;
}

/**
 * منفذ التتبّع الرفيع. سِنك V1 = no-op (أو سجل تطوير). في V2 يُستبدل السِنك
 * بتخزين/تحليلات دون تغيير مواضع الإطلاق.
 */
export type EventSink = (event: DiscoveryEvent) => void;

let sink: EventSink = () => {};
export function setEventSink(next: EventSink): void {
  sink = next;
}
export function track(name: DiscoveryEventName, payload: Omit<DiscoveryEvent, "name" | "at"> = {}): void {
  sink({ name, at: new Date(), ...payload });
}
