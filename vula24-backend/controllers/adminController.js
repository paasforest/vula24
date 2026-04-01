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

module.exports = {
  listPendingLocksmiths,
  approveLocksmith,
  rejectLocksmith,
  suspendLocksmith,
  listAllJobs,
  getStats,
};
