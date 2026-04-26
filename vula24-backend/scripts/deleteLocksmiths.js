/**
 * Deletes locksmith accounts by email (direct DB operations).
 *
 * Usage:
 *   cd vula24-backend && node scripts/deleteLocksmiths.js
 *   DATABASE_URL=postgresql://... node scripts/deleteLocksmiths.js
 *
 * Notes:
 * - Prisma schema already cascades many relations on Locksmith delete:
 *   Wallet, ServicePricing, TeamMember (businessId), PendingPayout, Quote, Review.
 * - Job.locksmith uses onDelete: SetNull, so jobs are preserved.
 * - Notification is not a relation; we delete locksmith notifications explicitly.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../lib/prisma');

const EMAILS = [
  'paasforest@gmail.com',
  'paasbanda@gmail.com',
  'sipho@vula24.co.za',
  'cly-test-1775243332@example.com',
].map((e) => e.trim().toLowerCase());

async function deleteOneByEmail(email) {
  const locksmith = await prisma.locksmith.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!locksmith) {
    console.log('[NOT FOUND]', email);
    return { email, found: false, deleted: false };
  }

  console.log('[FOUND]', locksmith.id, locksmith.email, `(${locksmith.name})`);

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Wallet + transactions
      const wallet = await tx.wallet.findUnique({
        where: { locksithId: locksmith.id },
        select: { id: true },
      });
      if (wallet) {
        await tx.transaction.deleteMany({ where: { walletId: wallet.id } });
        await tx.wallet.delete({ where: { id: wallet.id } });
      }

      // 2) ServicePricing
      await tx.servicePricing.deleteMany({ where: { locksithId: locksmith.id } });

      // 3) Notifications (not FK-related)
      await tx.notification.deleteMany({
        where: { recipientType: 'LOCKSMITH', recipientId: locksmith.id },
      });

      // 4) PendingPayouts
      await tx.pendingPayout.deleteMany({ where: { locksithId: locksmith.id } });

      // 5) TeamMembers
      await tx.teamMember.deleteMany({ where: { businessId: locksmith.id } });

      // 6) Jobs (preserve jobs; detach locksmith)
      await tx.job.updateMany({
        where: { locksithId: locksmith.id },
        data: { locksithId: null, acceptedAt: null },
      });

      // Extra safety: remove dependent records that also cascade, to reduce surprises.
      await tx.quote.deleteMany({ where: { locksithId: locksmith.id } });
      await tx.review.deleteMany({ where: { locksithId: locksmith.id } });

      // 7) Locksmith
      await tx.locksmith.delete({ where: { id: locksmith.id } });
    });

    console.log('[DELETED]', email);
    return { email, found: true, deleted: true };
  } catch (err) {
    console.error('[FAILED]', email, err?.message || err);
    return { email, found: true, deleted: false, error: err };
  }
}

async function main() {
  const results = [];
  for (const email of EMAILS) {
    // Per-account error handling: keep going even if one fails.
    // eslint-disable-next-line no-await-in-loop
    results.push(await deleteOneByEmail(email));
  }

  const deleted = results.filter((r) => r.deleted).map((r) => r.email);
  const notFound = results.filter((r) => !r.found).map((r) => r.email);
  const failed = results.filter((r) => r.found && !r.deleted).map((r) => r.email);

  console.log('---');
  console.log('Deleted:', deleted.length ? deleted.join(', ') : '(none)');
  console.log('Not found:', notFound.length ? notFound.join(', ') : '(none)');
  console.log('Failed:', failed.length ? failed.join(', ') : '(none)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

