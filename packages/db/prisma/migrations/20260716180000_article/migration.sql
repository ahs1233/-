-- محتوى تحريريّ (مقال/نصيحة اليوم) يُدار من «المظهر ← المحتوى».
CREATE TABLE IF NOT EXISTS "Article" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'article',
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "coverUrl" TEXT,
  "body" TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Article_slug_key" ON "Article"("slug");
CREATE INDEX IF NOT EXISTS "Article_active_sortOrder_idx" ON "Article"("active", "sortOrder");
