const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');

async function listNotifications(req, res) {
  const { id, type } = req.notificationRecipient;
  const notifications = await prisma.notification.findMany({
    where: { recipientId: id, recipientType: type },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ notifications });
}

async function markNotificationRead(req, res) {
  const { id: notifId } = req.params;
  const { id, type } = req.notificationRecipient;

  const notification = await prisma.notification.findFirst({
    where: { id: notifId, recipientId: id, recipientType: type },
  });
  if (!notification) throw new AppError('Notification not found', 404);

  const updated = await prisma.notification.update({
    where: { id: notifId },
    data: { isRead: true },
  });
  res.json({ notification: updated });
}

async function markAllNotificationsRead(req, res) {
  const { id, type } = req.notificationRecipient;
  await prisma.notification.updateMany({
    where: { recipientId: id, recipientType: type, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
}

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
