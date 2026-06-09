const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function deleteLocksmithAccount(req, res) {
  const locksmithId = req.locksmith.id;

  const activeJob = await prisma.job.findFirst({
    where: {
      locksithId: locksmithId,
      status: {
        in: ['ACCEPTED', 'DISPATCHED', 'ARRIVED', 'IN_PROGRESS'],
      },
    },
  });

  if (activeJob) {
    throw new AppError(
      'Cannot delete account with an active job. Please complete your current job first.',
      400
    );
  }

  await prisma.locksmith.delete({
    where: { id: locksmithId },
  });

  res.json({ success: true });
}

module.exports = {
  deleteLocksmithAccount,
};
