-- «السعر قبل الخصم» للمنتج — يفعّل عرض الخصم والسعر المشطوب في كل التطبيق.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "compareAtPrice" DECIMAL(12,2);
