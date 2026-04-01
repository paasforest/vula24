const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateAdmin } = require('../middleware/auth');
const admin = require('../controllers/adminController');

const router = Router();

router.use(authenticateAdmin);

router.get('/pending-locksmiths', asyncHandler(admin.listPendingLocksmiths));

router.post(
  '/locksmith/:id/approve',
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(admin.approveLocksmith)
);

router.post(
  '/locksmith/:id/reject',
  [
    param('id').isUUID(),
    body('reason').optional().trim(),
  ],
  handleValidationErrors,
  asyncHandler(admin.rejectLocksmith)
);

router.post(
  '/locksmith/:id/suspend',
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(admin.suspendLocksmith)
);

router.get(
  '/jobs',
  [
    query('status').optional().isIn([
      'PENDING',
      'ACCEPTED',
      'ARRIVED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED',
    ]),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
  ],
  handleValidationErrors,
  asyncHandler(admin.listAllJobs)
);

router.get('/stats', asyncHandler(admin.getStats));

module.exports = router;
