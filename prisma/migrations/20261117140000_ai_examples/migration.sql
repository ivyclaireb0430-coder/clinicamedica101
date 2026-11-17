-- Past clinic replies used as writing examples for the Messenger AI (owner-approved).
CREATE TABLE "AiExample" (
    "id" TEXT NOT NULL,
    "questionEnc" TEXT,
    "replyEnc" TEXT NOT NULL,
    "replyHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiExample_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiExample_replyHash_key" ON "AiExample"("replyHash");
CREATE INDEX "AiExample_approved_idx" ON "AiExample"("approved");
