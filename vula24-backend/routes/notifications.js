const { Router } = require('express');
const { param } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateCustomerOrLocksmith } = require('../middleware/auth');
const notifications = require('../controllers/notificationController');

const router = Router();

router.get(
  '/',
  authenticateCustomerOrLocksmith,
  asyncHandler(notifications.listNotifications)
);

router.post(
  '/:id/read',
  authenticateCustomerOrLocksmith,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(notifications.markNotificationRead)
);

router.post(
  '/read-all',
  authenticateCustomerOrLocksmith,
  asyncHandler(notifications.markAllNotificationsRead)
);

module.exports = router;
