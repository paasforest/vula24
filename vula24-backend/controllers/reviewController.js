const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function createReview(req, res) {
  const { jobId, comment } = req.body;
  const rating = parseInt(req.body.rating, 10);
  const customerId = req.customer.id;

  if (Number.isNaN(rating) || rating < 1 || rating > 5) {
    throw new AppError('Rating must be an integer between 1 and 5', 400);
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);
  if (job.customerId !== customerId) throw new AppError('Forbidden', 403);
  if (job.status !== 'COMPLETED') {
    throw new AppError('You can only review completed jobs', 400);
  }
  if (!job.locksithId) throw new AppError('Invalid job', 400);

  const existing = await prisma.review.findUnique({ where: { jobId } });
  if (existing) throw new AppError('You have already reviewed this job', 409);

  await prisma.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        jobId,
        customerId,
        locksithId: job.locksithId,
        rating,
        comment: comment?.trim() || null,
      },
    });

    const agg = await tx.review.aggregate({
      where: { locksithId: job.locksithId },
      _avg: { rating: true },
    });

    await tx.locksmith.update({
      where: { id: job.locksithId },
      data: { rating: agg._avg.rating ?? 5 },
    });
  });

  res.status(201).json({ success: true });
}

module.exports = { createReview };
