-- تحسين البحث العربي: فهرس trigram (GIN) لتسريع البحث بالاحتواء (LIKE '%...%')
-- الفهرس btree لا يخدم wildcard البادئ، فنستخدم pg_trgm لبحث فعّال قابل للتوسّع.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_titleNorm_trgm_idx"
  ON "Product" USING gin ("titleNorm" gin_trgm_ops);
