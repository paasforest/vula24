const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const { sendPushNotification } = require('../utils/pushNotifications');

async function createReview(req, res) {
  const { jobId, comment } = req.body;
  const rating = parseInt(req.body.rating, 10);
  const customerId = req.customer.id;

  if (Number.isNaN(rating) || rating < 1 || rating > 5) {
    throw new AppError('Rating must be an integer between 1 and 5', 400);
  }

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      customerId,
      status: 'COMPLETED',
    },
    include: {
      locksmith: { select: { id: true, pushToken: true } },
    },
  });

  if (!job) throw new AppError('Job not found', 404);
  if (!job.locksithId) throw new AppError('No locksmith', 400);

  const existing = await prisma.review.findFirst({
    where: { jobId, customerId },
  });
  if (existing) throw new AppError('Already reviewed', 400);

  const clamped = Math.min(5, Math.max(1, rating));

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        jobId,
        customerId,
        locksithId: job.locksithId,
        rating: clamped,
        comment: comment?.trim() || null,
      },
    });

    const agg = await tx.review.aggregate({
      where: { locksithId: job.locksithId },
      _avg: { rating: true },
    });

    const avgRating = agg._avg.rating ?? clamped;
    const rounded = Math.round(avgRating * 10) / 10;

    await tx.locksmith.update({
      where: { id: job.locksithId },
      data: { rating: rounded },
    });

    return created;
  });

  await prisma.notification.create({
    data: {
      recipientId: job.locksithId,
      recipientType: 'LOCKSMITH',
      title: 'New review',
      message: `You received a ${clamped}-star review.`,
    },
  });

  sendPushNotification(
    job.locksmith?.pushToken,
    'New review',
    `You received a ${clamped}-star review.`
  );

  res.status(201).json({ review });
}

module.exports = { createReview };
