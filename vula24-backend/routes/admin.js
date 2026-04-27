const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateAdmin } = require('../middleware/auth');
const admin = require('../controllers/adminController');

const router = Router();

router.post(
  '/auth',
  [body('secret').trim().notEmpty()],
  handleValidationErrors,
  asyncHandler(admin.adminLogin)
);

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

router.put(
  '/locksmith/:id/suspend',
  [
    param('id').isUUID(),
    body('suspended').isBoolean(),
  ],
  handleValidationErrors,
  asyncHandler(admin.setLocksmithSuspended)
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

router.get('/disputes', asyncHandler(admin.listDisputes));

router.get('/locksmiths', asyncHandler(admin.listLocksmithsAdmin));

router.get('/stats', asyncHandler(admin.getStats));

router.post(
  '/customer/:id/strike',
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(admin.strikeCustomer)
);

router.post(
  '/jobs/:id/dispute/resolve',
  [
    param('id').isUUID(),
    body('winner').isIn(['locksmith', 'customer']),
    body('notes').trim().notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(admin.resolveDispute)
);

router.delete(
  '/locksmith/:id/delete',
  [
    param('id').isUUID(),
    body('reason').trim().notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(admin.deleteLocksmith)
);

module.exports = router;
