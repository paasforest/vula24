const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const {
  authenticateCustomer,
  authenticateLocksmith,
  authenticateJobParticipant,
  authenticateMember,
} = require('../middleware/auth');
const { memberPhotoUpload } = require('../middleware/uploadLocksmith');
const jobs = require('../controllers/jobController');
const { SERVICE_TYPES: serviceTypes } = require('../constants/serviceTypes');

const router = Router();
const memberRouter = Router();

router.post(
  '/emergency/create',
  authenticateCustomer,
  [
    body('serviceType').isIn(serviceTypes),
    body('customerLat').isFloat({ min: -90, max: 90 }),
    body('customerLng').isFloat({ min: -180, max: 180 }),
    body('customerAddress').trim().notEmpty(),
    body('customerNote').optional().trim(),
  ],
  handleValidationErrors,
  asyncHandler(jobs.createEmergencyJob)
);

router.post(
  '/scheduled/create',
  authenticateCustomer,
  [
    body('serviceType').isIn(serviceTypes),
    body('description').optional().trim(),
    body('jobPhotoUrl').optional().trim(),
    body('scheduledDate').notEmpty(),
    body('customerLat').isFloat({ min: -90, max: 90 }),
    body('customerLng').isFloat({ min: -180, max: 180 }),
    body('customerAddress').trim().notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(jobs.createScheduledJob)
);

router.get(
  '/customer/my-jobs',
  authenticateCustomer,
  asyncHandler(jobs.listCustomerJobs)
);

router.get(
  '/locksmith/my-jobs',
  authenticateLocksmith,
  asyncHandler(jobs.listLocksmithJobs)
);

router.get(
  '/locksmith/scheduled-open',
  authenticateLocksmith,
  asyncHandler(jobs.listOpenScheduledJobsForLocksmith)
);

router.get(
  '/locksmith/job/:id',
  authenticateLocksmith,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.getLocksmithJobById)
);

router.get(
  '/nearby',
  authenticateCustomer,
  [
    query('lat').isFloat({ min: -90, max: 90 }),
    query('lng').isFloat({ min: -180, max: 180 }),
    query('serviceType').optional().isIn(serviceTypes),
  ],
  handleValidationErrors,
  asyncHandler(jobs.getNearbyLocksmiths)
);

router.get(
  '/:id',
  authenticateCustomer,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.getJobById)
);

router.post(
  '/:id/locksmith-timeout',
  authenticateLocksmith,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.locksmithTimeout)
);

router.post(
  '/:id/accept',
  authenticateLocksmith,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.acceptJob)
);

router.post(
  '/:id/dispatch',
  authenticateCustomer,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.dispatchJob)
);

router.post(
  '/:id/arrived',
  authenticateLocksmith,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.arrivedJob)
);

router.post(
  '/:id/start',
  authenticateLocksmith,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.startJob)
);

router.post(
  '/:id/complete',
  authenticateLocksmith,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.completeJob)
);

router.post(
  '/:id/set-payment-method',
  authenticateLocksmith,
  [
    param('id').isUUID(),
    body('paymentMethod').isIn(['APP', 'CASH']),
  ],
  handleValidationErrors,
  asyncHandler(jobs.setPaymentMethod)
);

router.post(
  '/:id/cash-collected',
  authenticateLocksmith,
  [
    param('id').isUUID(),
    body('cashCollected').isFloat({ gt: 0 }),
  ],
  handleValidationErrors,
  asyncHandler(jobs.recordCashCollected)
);

router.post(
  '/:id/dispute',
  authenticateCustomer,
  [
    param('id').isUUID(),
    body('reason').trim().notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(jobs.raiseDispute)
);

router.post(
  '/:id/dispute/proof',
  authenticateLocksmith,
  [
    param('id').isUUID(),
    body('disputeProofUrl').trim().notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(jobs.submitDisputeProof)
);

router.post(
  '/:id/cancel',
  authenticateJobParticipant,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.cancelJob)
);

router.post(
  '/:id/quote/submit',
  authenticateLocksmith,
  [
    param('id').isUUID(),
    body('price').isFloat({ gt: 0 }),
    body('message').optional().trim(),
  ],
  handleValidationErrors,
  asyncHandler(jobs.submitQuote)
);

router.get(
  '/:id/quotes',
  authenticateCustomer,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.listQuotes)
);

router.post(
  '/:id/quote/:quoteId/accept',
  authenticateCustomer,
  [
    param('id').isUUID(),
    param('quoteId').isUUID(),
  ],
  handleValidationErrors,
  asyncHandler(jobs.acceptQuote)
);

router.get(
  '/:id/locksmith-location',
  authenticateCustomer,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.getLocksmithLocationForJob)
);

memberRouter.get(
  '/profile',
  authenticateMember,
  asyncHandler(jobs.getMemberProfile)
);

memberRouter.put(
  '/toggle-online',
  authenticateMember,
  asyncHandler(jobs.toggleMemberOnline)
);

memberRouter.post(
  '/location/update',
  authenticateMember,
  [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
  ],
  handleValidationErrors,
  asyncHandler(jobs.updateMemberLocation)
);

memberRouter.put(
  '/push-token',
  authenticateMember,
  [body('pushToken').optional().isString()],
  handleValidationErrors,
  asyncHandler(jobs.updateMemberPushToken)
);

memberRouter.put(
  '/profile',
  authenticateMember,
  asyncHandler(jobs.updateMemberProfile)
);

memberRouter.post(
  '/profile/photo',
  authenticateMember,
  memberPhotoUpload,
  asyncHandler(jobs.uploadMemberPhoto)
);

memberRouter.get(
  '/jobs/available',
  authenticateMember,
  asyncHandler(jobs.listMemberAvailableJobs)
);

memberRouter.post(
  '/jobs/:id/accept',
  authenticateMember,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.memberAcceptJob)
);

memberRouter.post(
  '/jobs/:id/arrived',
  authenticateMember,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.memberArrivedJob)
);

memberRouter.post(
  '/jobs/:id/start',
  authenticateMember,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.memberStartJob)
);

memberRouter.post(
  '/jobs/:id/complete',
  authenticateMember,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.memberCompleteJob)
);

memberRouter.get(
  '/jobs/my-jobs',
  authenticateMember,
  asyncHandler(jobs.listMemberCompletedJobs)
);

module.exports = router;
module.exports.memberRouter = memberRouter;
