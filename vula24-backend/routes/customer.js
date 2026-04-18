const { Router } = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateCustomer } = require('../middleware/auth');
const auth = require('../controllers/authController');

const router = Router();

router.put(
  '/push-token',
  authenticateCustomer,
  [body('pushToken').optional().isString()],
  handleValidationErrors,
  asyncHandler(auth.updateCustomerPushToken)
);

module.exports = router;
