const { Router } = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateCustomer, authenticateLocksmith } = require('../middleware/auth');
const payments = require('../controllers/paymentController');

const router = Router();

router.post(
  '/deposit',
  authenticateCustomer,
  [body('jobId').isUUID()],
  handleValidationErrors,
  asyncHandler(payments.createDepositPayment)
);

router.post(
  '/final',
  authenticateCustomer,
  [body('jobId').isUUID()],
  handleValidationErrors,
  asyncHandler(payments.createFinalPayment)
);

router.post('/webhook', asyncHandler(payments.payfastWebhook));

router.get('/return', asyncHandler(payments.paymentReturn));
router.get('/cancel', asyncHandler(payments.paymentCancel));

router.post(
  '/withdraw',
  authenticateLocksmith,
  [body('amount').isFloat({ gt: 0 })],
  handleValidationErrors,
  asyncHandler(payments.withdraw)
);

router.post(
  '/wallet-topup',
  authenticateLocksmith,
  [body('amount').isFloat({ gte: 100 })],
  handleValidationErrors,
  asyncHandler(payments.createWalletTopup)
);

module.exports = router;
