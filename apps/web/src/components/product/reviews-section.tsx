"use client";

import { useState } from "react";
import { Button, Card, CardBody, Textarea } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

export function ReviewsSection({ productId }: { productId: string }) {
  const reviews = trpc.review.listByProduct.useQuery({ productId });
  const mine = trpc.review.mine.useQuery({ productId }, { retry: false });
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const upsert = trpc.review.upsert.useMutation({
    onSuccess: () => {
      setOpen(false);
      setError(null);
      utils.review.listByProduct.invalidate({ productId });
      utils.review.mine.invalidate({ productId });
    },
    onError: (e) => setError(e.message),
  });

  function startEdit() {
    if (mine.data) {
      setRating(mine.data.rating);
      setComment(mine.data.comment ?? "");
    }
    setOpen(true);
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">التقييمات ({reviews.data?.length ?? 0})</h2>
          <Button size="sm" variant="outline" onClick={startEdit}>
            {mine.data ? "تعديل تقييمي" : "أضف تقييماً"}
          </Button>
        </div>

        {open && (
          <div className="space-y-2 rounded-lg bg-neutral-50 p-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={`text-2xl ${n <= rating ? "text-gold-500" : "text-neutral-300"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="شاركنا رأيك بالمنتج"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" loading={upsert.isPending} onClick={() => upsert.mutate({ productId, rating, comment })}>
                حفظ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {reviews.isLoading ? (
          <p className="text-sm text-neutral-500">جارٍ التحميل…</p>
        ) : reviews.data && reviews.data.length > 0 ? (
          <ul className="space-y-3">
            {reviews.data.map((r) => (
              <li key={r.id} className="border-b border-neutral-100 pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.authorName}</span>
                  <span className="text-gold-500">{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm text-neutral-600">{r.comment}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">لا توجد تقييمات بعد.</p>
        )}
      </CardBody>
    </Card>
  );
}
