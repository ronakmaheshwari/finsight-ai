-- CreateEnum
CREATE TYPE "RuleCategory" AS ENUM ('ANOMALY', 'RELATIONSHIP', 'CONTROL');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "RuleConfig" DROP CONSTRAINT "RuleConfig_orgId_fkey";

-- DropForeignKey
ALTER TABLE "AnalysisRun" DROP CONSTRAINT "AnalysisRun_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "RiskSignal" DROP CONSTRAINT "RiskSignal_runId_fkey";

-- DropForeignKey
ALTER TABLE "Case" DROP CONSTRAINT "Case_engagementId_fkey";

-- DropForeignKey
ALTER TABLE "GraphEdge" DROP CONSTRAINT "GraphEdge_runId_fkey";

-- DropIndex
DROP INDEX "AnalysisRun_datasetId_idx";

-- DropIndex
DROP INDEX "AnalysisRun_triggeredById_idx";

-- DropIndex
DROP INDEX "RiskSignal_entityType_entityId_idx";

-- DropIndex
DROP INDEX "Case_engagementId_idx";

-- DropIndex
DROP INDEX "Case_runId_idx";

-- DropIndex
DROP INDEX "CaseNote_caseId_idx";

-- DropIndex
DROP INDEX "CaseNote_authorId_idx";

-- DropIndex
DROP INDEX "AiInvestigation_reviewedById_idx";

-- AlterTable
ALTER TABLE "JWTToken" DROP COLUMN "isLatest";

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "externalId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "postedAt",
ADD COLUMN     "postedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "RuleConfig" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "AnalysisRun" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "ruleSnapshot" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "RiskSignal" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entities" JSONB NOT NULL,
ADD COLUMN     "invoiceIds" TEXT[],
ADD COLUMN     "vendorId" TEXT,
DROP COLUMN "category",
ADD COLUMN     "category" "RuleCategory" NOT NULL;

-- AlterTable
ALTER TABLE "Case" DROP COLUMN "statsu",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decisionReason" TEXT,
ADD COLUMN     "entities" JSONB NOT NULL,
ADD COLUMN     "graph" JSONB,
ADD COLUMN     "primaryEntityId" TEXT NOT NULL,
ADD COLUMN     "primaryEntityLabel" TEXT NOT NULL,
ADD COLUMN     "primaryEntityType" "EntityType" NOT NULL,
ADD COLUMN     "priority" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "signalCount" INTEGER NOT NULL,
ADD COLUMN     "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "AiInvestigation" ADD COLUMN     "editedOutput" JSONB,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "packetHash" TEXT,
ADD COLUMN     "requestedById" TEXT NOT NULL,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "model" DROP NOT NULL,
ALTER COLUMN "promptVersion" DROP NOT NULL,
ALTER COLUMN "output" DROP NOT NULL,
ALTER COLUMN "inputTokens" DROP NOT NULL,
ALTER COLUMN "outputTokens" DROP NOT NULL,
DROP COLUMN "reviewStatus",
ADD COLUMN     "reviewStatus" "AiReviewStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" TEXT,
ALTER COLUMN "entityId" DROP NOT NULL;

-- DropTable
DROP TABLE "GraphEdge";

-- DropEnum
DROP TYPE "AiInvestigationStatus";

-- CreateIndex
CREATE UNIQUE INDEX "JWTToken_tokenHash_key" ON "JWTToken"("tokenHash");

-- CreateIndex
CREATE INDEX "Vendor_createdById_idx" ON "Vendor"("createdById");

-- CreateIndex
CREATE INDEX "BankAccount_datasetId_accountNumberHash_idx" ON "BankAccount"("datasetId", "accountNumberHash");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_datasetId_externalId_key" ON "BankAccount"("datasetId", "externalId");

-- CreateIndex
CREATE INDEX "Invoice_datasetId_invoiceDate_idx" ON "Invoice"("datasetId", "invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_datasetId_externalId_key" ON "Invoice"("datasetId", "externalId");

-- CreateIndex
CREATE INDEX "Transaction_datasetId_postedAt_idx" ON "Transaction"("datasetId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_datasetId_externalId_key" ON "Transaction"("datasetId", "externalId");

-- CreateIndex
CREATE INDEX "AnalysisRun_datasetId_createdAt_idx" ON "AnalysisRun"("datasetId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskSignal_runId_ruleKey_idx" ON "RiskSignal"("runId", "ruleKey");

-- CreateIndex
CREATE INDEX "RiskSignal_runId_vendorId_idx" ON "RiskSignal"("runId", "vendorId");

-- CreateIndex
CREATE INDEX "Case_engagementId_status_idx" ON "Case"("engagementId", "status");

-- CreateIndex
CREATE INDEX "Case_runId_priority_idx" ON "Case"("runId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Case_runId_code_key" ON "Case"("runId", "code");

-- CreateIndex
CREATE INDEX "CaseNote_caseId_createdAt_idx" ON "CaseNote"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInvestigation" ADD CONSTRAINT "AiInvestigation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleConfig" ADD CONSTRAINT "RuleConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleConfig" ADD CONSTRAINT "RuleConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
