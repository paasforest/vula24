const { Router } = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateCustomer } = require('../middleware/auth');
const { customerPhotoUpload } = require('../middleware/uploadLocksmith');
const auth = require('../controllers/authController');

const router = Router();

router.get(
  '/profile',
  authenticateCustomer,
  asyncHandler(auth.getCustomerProfile)
);

router.put(
  '/profile',
  authenticateCustomer,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim(),
  ],
  handleValidationErrors,
  asyncHandler(auth.updateCustomerProfile)
);

router.put(
  '/push-token',
  authenticateCustomer,
  [body('pushToken').optional().isString()],
  handleValidationErrors,
  asyncHandler(auth.updateCustomerPushToken)
);

router.post(
  '/upload-photo',
  authenticateCustomer,
  customerPhotoUpload,
  asyncHandler(auth.uploadCustomerPhoto)
);

module.exports = router;
