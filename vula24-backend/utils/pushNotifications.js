const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(pushToken, title, body, data) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;
  try {
    const payload = {
      to: pushToken,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'job-requests',
      ttl: 300,
      expiration: Math.floor(Date.now() / 1000) + 300,
    };
    if (data != null && typeof data === 'object') {
      payload.data = data;
    }
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore push errors — never block main flow */
  }
}

module.exports = { sendPushNotification };
