const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateLocksmith } = require('../middleware/auth');
const wallet = require('../controllers/walletController');

const router = Router();

router.get('/my-wallet', authenticateLocksmith, asyncHandler(wallet.getMyWallet));
router.get(
  '/pending-payouts',
  authenticateLocksmith,
  asyncHandler(wallet.getPendingPayouts)
);

module.exports = router;
