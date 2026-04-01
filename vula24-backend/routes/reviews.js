const { Router } = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateCustomer } = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

const router = Router();

router.post(
  '/',
  authenticateCustomer,
  [
    body('jobId').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim(),
  ],
  handleValidationErrors,
  asyncHandler(reviewController.createReview)
);

module.exports = router;
