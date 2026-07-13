"use client";

import { AdsTab } from "../_ads";

export default function AdsEditor() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-brand-800">الإعلانات</h1>
        <p className="text-sm text-neutral-500">لافتات ترويجيّة تظهر في الرئيسية — مجدولة ومربوطة بمحافظة أو لكلّ العراق.</p>
      </div>
      <AdsTab />
    </div>
  );
}
