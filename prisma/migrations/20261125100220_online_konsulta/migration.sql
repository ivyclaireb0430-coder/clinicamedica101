-- CreateTable
CREATE TABLE "ConsultSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "channel" TEXT NOT NULL DEFAULT 'WEBSITE',
    "leadId" TEXT,
    "patientId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "birthDate" TEXT,
    "sex" TEXT,
    "consentVersion" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "summaryEnc" TEXT,
    "doctorNoteEnc" TEXT,
    "prescriptionEnc" TEXT,
    "draftNoteEnc" TEXT,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "emergencyAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "textEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultFile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "filenameEnc" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultLesson" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultSession_token_key" ON "ConsultSession"("token");

-- CreateIndex
CREATE INDEX "ConsultSession_status_lastMessageAt_idx" ON "ConsultSession"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ConsultSession_leadId_idx" ON "ConsultSession"("leadId");

-- CreateIndex
CREATE INDEX "ConsultSession_patientId_idx" ON "ConsultSession"("patientId");

-- CreateIndex
CREATE INDEX "ConsultMessage_sessionId_createdAt_idx" ON "ConsultMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultFile_storageKey_key" ON "ConsultFile"("storageKey");

-- AddForeignKey
ALTER TABLE "ConsultSession" ADD CONSTRAINT "ConsultSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultSession" ADD CONSTRAINT "ConsultSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultMessage" ADD CONSTRAINT "ConsultMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConsultSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultFile" ADD CONSTRAINT "ConsultFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConsultSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
