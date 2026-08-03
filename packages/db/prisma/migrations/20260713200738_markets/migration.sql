-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "tagline" TEXT,
    "imageUrl" TEXT,
    "icon" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'category',
    "categorySlug" TEXT,
    "href" TEXT,
    "status" TEXT NOT NULL DEFAULT 'live',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_slug_key" ON "Market"("slug");

-- CreateIndex
CREATE INDEX "Market_enabled_sortOrder_idx" ON "Market"("enabled", "sortOrder");
