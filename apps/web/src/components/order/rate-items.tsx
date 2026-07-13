"use client";

import { useState } from "react";
import { Button, Card, CardBody, Textarea } from "@al-souq/ui";
import { trpc } from "@/src/trpc/react";

type Item = { productId: string; title: string };

/** تقييمُ مشتريات الطلب — نجومٌ لكل منتجٍ استلمتَه (يظهر للطلبات المستلمة/المكتملة). */
export function RateOrderItems({ items }: { items: Item[] }) {
  const unique = Array.from(new Map(items.map((i) => [i.productId, i])).values());
  if (unique.length === 0) return null;
  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="flex items-center gap-2 font-extrabold text-brand-800">
          <span className="inline-block h-5 w-1 rounded-full bg-gold-500" aria-hidden />
          قيّم مشترياتك
        </h2>
        <p className="-mt-1 text-xs text-neutral-400">رأيُك يساعد بقيّة المتسوّقين — قيّم ما استلمتَه.</p>
        <ul className="divide-y divide-neutral-100">
          {unique.map((it) => (
            <RateRow key={it.productId} item={it} />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function RateRow({ item }: { item: Item }) {
  const mine = trpc.review.mine.useQuery({ productId: item.productId }, { retry: false });
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const upsert = trpc.review.upsert.useMutation({
    onSuccess: () => {
      setOpen(false);
      setError(null);
      utils.review.mine.invalidate({ productId: item.productId });
      utils.review.listByProduct.invalidate({ productId: item.productId });
    },
    onError: (e) => setError(e.message),
  });

  const current = mine.data;

  function start() {
    setRating(current?.rating ?? 5);
    setComment(current?.comment ?? "");
    setOpen(true);
  }

  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium text-neutral-800">{item.title}</p>
          {current && !open && (
            <span className="mt-0.5 inline-flex items-center gap-0.5 text-gold-500" aria-label={`تقييمك ${current.rating}`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < current.rating ? "text-gold-500" : "text-neutral-300"}>★</span>
              ))}
            </span>
          )}
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={start}>
            {current ? "تعديل" : "قيّم"}
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-neutral-50 p-3">
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
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="رأيك بالمنتج (اختياري)" />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" loading={upsert.isPending} onClick={() => upsert.mutate({ productId: item.productId, rating, comment })}>
              حفظ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
