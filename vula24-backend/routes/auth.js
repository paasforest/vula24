const { Router } = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { locksmithRegisterMultipart } = require('../middleware/uploadLocksmith');
const auth = require('../controllers/authController');

const router = Router();

router.post(
  '/customer/register',
  [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('phone').trim().notEmpty().withMessage('phone is required'),
    body('email').isEmail().normalizeEmail().withMessage('valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('password min 8 characters'),
  ],
  handleValidationErrors,
  asyncHandler(auth.registerCustomer)
);

router.post(
  '/customer/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(auth.loginCustomer)
);

router.post(
  '/locksmith/register',
  locksmithRegisterMultipart,
  [
    body('name').trim().notEmpty(),
    body('phone').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('accountType').isIn(['INDIVIDUAL', 'BUSINESS']),
    body('businessName')
      .optional()
      .trim()
      .custom((value, { req }) => {
        if (req.body.accountType === 'BUSINESS' && (!value || !value.length)) {
          throw new Error('businessName is required for BUSINESS');
        }
        return true;
      }),
  ],
  handleValidationErrors,
  asyncHandler(auth.registerLocksmith)
);

router.post(
  '/locksmith/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(auth.loginLocksmith)
);

router.post(
  '/member/login',
  [
    body('appEmail').isEmail().normalizeEmail(),
    body('appPassword').notEmpty(),
  ],
  handleValidationErrors,
  asyncHandler(auth.loginMember)
);

module.exports = router;
