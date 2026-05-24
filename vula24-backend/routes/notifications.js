const { Router } = require('express');
const { param } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/validate');
const { authenticateCustomerLocksmithOrMember } = require('../middleware/auth');
const notifications = require('../controllers/notificationController');

const router = Router();

router.get(
  '/',
  authenticateCustomerLocksmithOrMember,
  asyncHandler(notifications.listNotifications)
);

router.post(
  '/:id/read',
  authenticateCustomerLocksmithOrMember,
  [param('id').isUUID()],
  handleValidationErrors,
  asyncHandler(notifications.markNotificationRead)
);

router.post(
  '/read-all',
  authenticateCustomerLocksmithOrMember,
  asyncHandler(notifications.markAllNotificationsRead)
);

module.exports = router;
