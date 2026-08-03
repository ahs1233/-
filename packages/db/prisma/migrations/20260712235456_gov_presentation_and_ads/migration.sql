-- AlterTable
ALTER TABLE "Governorate" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "heroImageUrl" TEXT,
ADD COLUMN     "souks" JSONB,
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL DEFAULT '/search',
    "placement" TEXT NOT NULL DEFAULT 'home_banner',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "governorateId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_active_placement_sortOrder_idx" ON "Ad"("active", "placement", "sortOrder");

-- CreateIndex
CREATE INDEX "Ad_governorateId_idx" ON "Ad"("governorateId");

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
