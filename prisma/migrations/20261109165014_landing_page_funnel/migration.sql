-- CreateTable
CREATE TABLE "LandingVisit" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "campaignKey" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LandingVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingVisit_day_campaignKey_key" ON "LandingVisit"("day", "campaignKey");
