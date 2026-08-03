"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button, Card, CardBody, Textarea } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

/** قسمُ تقييم المتجر — قائمةُ التقييمات + إضافة/تعديل تقييمي (للمشترين منه فقط). */
export function StoreReviews({ vendorId }: { vendorId: string }) {
  const list = trpc.review.listByStore.useQuery({ vendorId });
  const mineQ = trpc.review.myStore.useQuery({ vendorId }, { retry: false });
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const upsert = trpc.review.upsertStore.useMutation({
    onSuccess: () => {
      setOpen(false);
      setError(null);
      utils.review.listByStore.invalidate({ vendorId });
      utils.review.myStore.invalidate({ vendorId });
    },
    onError: (e) => setError(e.message),
  });

  const mine = mineQ.data?.mine ?? null;
  const canReview = mineQ.data?.canReview ?? false;

  function startEdit() {
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment ?? "");
    } else {
      setRating(5);
      setComment("");
    }
    setOpen(true);
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-extrabold text-brand-800">
            <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
            تقييمات المتجر ({list.data?.length ?? 0})
          </h2>
          {canReview && (
            <Button size="sm" variant="outline" onClick={startEdit}>
              {mine ? "تعديل تقييمي" : "قيّم المتجر"}
            </Button>
          )}
        </div>

        {/* لغير المؤهّل: توضيحٌ لطيف */}
        {!canReview && !mineQ.isLoading && (
          <p className="text-xs text-neutral-400">يمكنك تقييم المتجر بعد استلام طلبٍ منه.</p>
        )}

        {open && (
          <div className="space-y-2 rounded-xl bg-neutral-50 p-3">
            <p className="text-sm font-medium text-neutral-700">كيف كانت تجربتك مع المتجر؟</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  aria-label={`${n} نجوم`}
                  className={`text-2xl transition ${n <= rating ? "text-gold-500" : "text-neutral-300 hover:text-gold-300"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="شاركنا رأيك بخدمة المتجر والتوصيل"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" loading={upsert.isPending} onClick={() => upsert.mutate({ vendorId, rating, comment })}>
                حفظ التقييم
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {list.isLoading ? (
          <p className="text-sm text-neutral-500">جارٍ التحميل…</p>
        ) : list.data && list.data.length > 0 ? (
          <ul className="space-y-3">
            {list.data.map((r) => (
              <li key={r.id} className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-800">{r.authorName}</span>
                  <span className="inline-flex items-center gap-0.5 text-gold-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-gold-500 text-gold-500" : "text-neutral-300"}`} />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-neutral-600">{r.comment}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-400">لا تقييمات بعد — كن أوّل من يقيّم هذا المتجر.</p>
        )}
      </CardBody>
    </Card>
  );
}
