-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Product_titleNorm_trgm_idx" ON "Product" USING GIN ("titleNorm" gin_trgm_ops);
