const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function deleteCustomerAccount(req, res) {
  const customerId = req.customer.id;

  const activeJob = await prisma.job.findFirst({
    where: {
      customerId,
      status: {
        in: ['PENDING', 'ACCEPTED', 'DISPATCHED', 'ARRIVED', 'IN_PROGRESS'],
      },
    },
  });

  if (activeJob) {
    throw new AppError(
      'Cannot delete account with an active job. Please complete or cancel your current job first.',
      400
    );
  }

  await prisma.customer.delete({
    where: { id: customerId },
  });

  res.json({ success: true });
}

module.exports = {
  deleteCustomerAccount,
};
