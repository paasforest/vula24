const { Router } = require('express');
const { body, param } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateLocksmith } = require('../middleware/auth');
const { profilePhotoUpload } = require('../middleware/uploadLocksmith');
const jobs = require('../controllers/jobController');

const router = Router();

const serviceTypes = [
  'CAR_LOCKOUT',
  'HOUSE_LOCKOUT',
  'KEY_DUPLICATION',
  'LOCK_REPLACEMENT',
  'LOCK_REPAIR',
];

router.post(
  '/location/update',
  authenticateLocksmith,
  [
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
  ],
  handleValidationErrors,
  asyncHandler(jobs.updateLocksmithLocation)
);

router.get(
  '/profile',
  authenticateLocksmith,
  asyncHandler(jobs.getLocksmithProfile)
);

router.post(
  '/profile/photo',
  authenticateLocksmith,
  profilePhotoUpload,
  asyncHandler(jobs.uploadLocksmithProfilePhoto)
);

router.get(
  '/pricing',
  authenticateLocksmith,
  asyncHandler(jobs.getServicePricing)
);

router.post(
  '/pricing',
  authenticateLocksmith,
  [
    body().custom((value, { req }) => {
      const payload = req.body;
      if (!Array.isArray(payload) || payload.length < 1) {
        throw new Error('Body must be a non-empty array');
      }
      for (const item of payload) {
        if (!item || typeof item !== 'object') {
          throw new Error('Each item must be an object');
        }
        if (!serviceTypes.includes(item.serviceType)) {
          throw new Error('Invalid serviceType');
        }
        if (typeof item.basePrice !== 'number' || item.basePrice <= 0) {
          throw new Error('basePrice must be a positive number');
        }
        if (typeof item.isOffered !== 'boolean') {
          throw new Error('isOffered must be a boolean');
        }
      }
      return true;
    }),
  ],
  handleValidationErrors,
  asyncHandler(jobs.upsertServicePricing)
);

router.put(
  '/profile',
  authenticateLocksmith,
  [
    body('bankName').optional().isString().trim(),
    body('bankAccountNumber').optional().isString().trim(),
    body('bankAccountHolder').optional().isString().trim(),
    body('psiraNumber').optional().isString().trim(),
    body('idPhotoUrl').optional().isString().trim(),
    body('selfiePhotoUrl').optional().isString().trim(),
    body('toolsPhotoUrl').optional().isString().trim(),
    body('proofOfAddressUrl').optional().isString().trim(),
    body('profilePhoto').optional().isString().trim(),
    body('vehicleType').optional().isString().trim(),
    body('vehicleColor').optional().isString().trim(),
    body('vehiclePlateNumber').optional().isString().trim(),
  ],
  handleValidationErrors,
  asyncHandler(jobs.updateLocksmithProfile)
);

router.put(
  '/toggle-online',
  authenticateLocksmith,
  asyncHandler(jobs.toggleLocksmithOnline)
);

router.put(
  '/push-token',
  authenticateLocksmith,
  [body('pushToken').optional().isString()],
  handleValidationErrors,
  asyncHandler(jobs.updateLocksmithPushToken)
);

router.post(
  '/team/add',
  authenticateLocksmith,
  [
    body('name').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('appEmail').isEmail().normalizeEmail(),
    body('appPassword').isLength({ min: 8 }),
  ],
  handleValidationErrors,
  asyncHandler(jobs.addTeamMember)
);

router.get('/team', authenticateLocksmith, asyncHandler(jobs.listTeamMembers));

router.post(
  '/team/:memberId/deactivate',
  authenticateLocksmith,
  [param('memberId').isUUID()],
  handleValidationErrors,
  asyncHandler(jobs.deactivateTeamMember)
);

module.exports = router;
