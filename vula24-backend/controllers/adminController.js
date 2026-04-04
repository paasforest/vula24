const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function listPendingLocksmiths(req, res) {
  const locksmiths = await prisma.locksmith.findMany({
    where: { isVerified: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      accountType: true,
      businessName: true,
      psiraNumber: true,
      createdAt: true,
      idPhotoUrl: true,
      selfiePhotoUrl: true,
      toolsPhotoUrl: true,
      proofOfAddressUrl: true,
    },
  });
  res.json({ locksmiths });
}

async function approveLocksmith(req, res) {
  const { id } = req.params;
  const locksmith = await prisma.locksmith.findUnique({ where: { id } });
  if (!locksmith) throw new AppError('Locksmith not found', 404);

  const updated = await prisma.$transaction(async (tx) => {
    const l = await tx.locksmith.update({
      where: { id },
      data: { isVerified: true },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        accountType: true,
        businessName: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await tx.notification.create({
      data: {
        recipientId: id,
        recipientType: 'LOCKSMITH',
        title: 'Account approved',
        message: 'Your Vula24 locksmith profile has been approved. You can go online and accept jobs.',
      },
    });
    return l;
  });

  res.json({ locksmith: updated });
}

async function rejectLocksmith(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const locksmith = await prisma.locksmith.findUnique({ where: { id } });
  if (!locksmith) throw new AppError('Locksmith not found', 404);

  await prisma.notification.create({
    data: {
      recipientId: id,
      recipientType: 'LOCKSMITH',
      title: 'Application not approved',
      message: reason
        ? `Your application was not approved. Reason: ${reason}`
        : 'Your application was not approved.',
    },
  });

  res.json({ success: true });
}

async function suspendLocksmith(req, res) {
  const { id } = req.params;
  const locksmith = await prisma.locksmith.findUnique({ where: { id } });
  if (!locksmith) throw new AppError('Locksmith not found', 404);

  const updated = await prisma.locksmith.update({
    where: { id },
    data: { isSuspended: true, isOnline: false },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isSuspended: true,
      isOnline: true,
    },
  });

  res.json({ locksmith: updated });
}

async function listAllJobs(req, res) {
  const { status, dateFrom, dateTo } = req.query;

  const where = {};
  if (status) {
    where.status = status;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      customer: {
        select: { id: true, name: true, phone: true, email: true },
      },
      locksmith: {
        select: { id: true, name: true, phone: true, email: true },
      },
    },
  });

  res.json({ jobs });
}

async function getStats(req, res) {
  const [totalJobs, revenueAgg, activeOnline] = await Promise.all([
    prisma.job.count(),
    prisma.job.aggregate({
      where: { finalPaid: true },
      _sum: { platformFee: true },
    }),
    prisma.locksmith.count({
      where: { isOnline: true, isSuspended: false, isVerified: true },
    }),
  ]);

  res.json({
    totalJobs,
    totalRevenue: revenueAgg._sum.platformFee || 0,
    activeLocksmithsOnline: activeOnline,
  });
}

async function strikeCustomer(req, res) {
  const customerId = req.params.id;
  const exists = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!exists) throw new AppError('Customer not found', 404);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.customer.update({
      where: { id: customerId },
      data: { strikeCount: { increment: 1 } },
    });

    if (next.strikeCount >= 2) {
      const banned = await tx.customer.update({
        where: { id: customerId },
        data: {
          isBanned: true,
          bannedAt: new Date(),
          bannedReason: 'Refused payment twice',
        },
      });
      await tx.notification.create({
        data: {
          recipientId: customerId,
          recipientType: 'CUSTOMER',
          title: 'Account suspended',
          message:
            'Your account has been suspended due to payment issues.',
        },
      });
      return banned;
    }
    return next;
  });

  const { password, ...customer } = updated;
  res.json({ customer });
}

async function resolveDispute(req, res) {
  const jobId = req.params.id;
  const { winner, notes } = req.body;
  const adminRecipientId =
    process.env.ADMIN_NOTIFICATION_RECIPIENT_ID || 'admin';

  if (winner !== 'locksmith' && winner !== 'customer') {
    throw new AppError('winner must be locksmith or customer', 400);
  }
  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    throw new AppError('notes is required', 400);
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { customer: true, locksmith: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (!job.isDisputed) throw new AppError('Job is not under dispute', 400);

  const existingCredit = await prisma.transaction.findFirst({
    where: { jobId, type: 'CREDIT' },
  });

  if (winner === 'locksmith') {
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          disputeResolvedAt: new Date(),
          disputeNotes: notes.trim(),
        },
      });

      const wallet = job.locksithId
        ? await tx.wallet.findUnique({ where: { locksithId: job.locksithId } })
        : null;

      if (!existingCredit && wallet && job.locksithId && job.locksithEarning > 0) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: job.locksithEarning } },
        });
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount: job.locksithEarning,
            type: 'CREDIT',
            description: `Dispute resolved — payment for job ${job.id}`,
            jobId: job.id,
          },
        });
      }

      if (job.locksithId) {
        await tx.notification.create({
          data: {
            recipientId: job.locksithId,
            recipientType: 'LOCKSMITH',
            title: 'Dispute resolved',
            message:
              'Dispute resolved in your favour. Payment released.',
          },
        });
      }
      await tx.notification.create({
        data: {
          recipientId: job.customerId,
          recipientType: 'CUSTOMER',
          title: 'Dispute resolved',
          message: 'Dispute resolved. No refund will be issued.',
        },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          disputeResolvedAt: new Date(),
          disputeNotes: notes.trim(),
        },
      });

      const wallet = job.locksithId
        ? await tx.wallet.findUnique({ where: { locksithId: job.locksithId } })
        : null;

      if (existingCredit && wallet && job.locksithEarning > 0) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: job.locksithEarning } },
        });
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount: job.locksithEarning,
            type: 'DEBIT',
            description: `Dispute refund clawback — job ${job.id}`,
            jobId: job.id,
          },
        });
      }

      await tx.notification.create({
        data: {
          recipientId: adminRecipientId,
          recipientType: 'CUSTOMER',
          title: 'Refund required',
          message: `Manual refund processing for job ${jobId}. Customer dispute resolved in customer's favour.`,
        },
      });

      await tx.notification.create({
        data: {
          recipientId: job.customerId,
          recipientType: 'CUSTOMER',
          title: 'Dispute resolved',
          message:
            'Dispute resolved in your favour. Refund will be processed within 3 business days.',
        },
      });

      if (job.locksithId) {
        await tx.notification.create({
          data: {
            recipientId: job.locksithId,
            recipientType: 'LOCKSMITH',
            title: 'Dispute resolved',
            message:
              "Dispute resolved in customer's favour. No payment will be released.",
          },
        });
      }
    });
  }

  const updatedJob = await prisma.job.findUnique({ where: { id: jobId } });
  res.json({ job: updatedJob });
}

module.exports = {
  listPendingLocksmiths,
  approveLocksmith,
  rejectLocksmith,
  suspendLocksmith,
  listAllJobs,
  getStats,
  strikeCustomer,
  resolveDispute,
};
