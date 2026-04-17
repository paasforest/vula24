-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'DISPATCHED';

-- CreateTable
CREATE TABLE "pending_payouts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "locksithId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "releaseAfter" TIMESTAMP(3) NOT NULL,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_payouts_jobId_key" ON "pending_payouts"("jobId");

-- AddForeignKey
ALTER TABLE "pending_payouts" ADD CONSTRAINT "pending_payouts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_payouts" ADD CONSTRAINT "pending_payouts_locksithId_fkey" FOREIGN KEY ("locksithId") REFERENCES "Locksmith"("id") ON DELETE CASCADE ON UPDATE CASCADE;
