const jwt = require('jsonwebtoken');

function requireJwtSecret() {
  if (!process.env.JWT_SECRET?.trim()) {
    const err = new Error('JWT_SECRET is not configured');
    err.statusCode = 503;
    throw err;
  }
}

function signCustomerToken(customerId) {
  requireJwtSecret();
  return jwt.sign(
    { sub: customerId, type: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function signLocksmithToken(locksmithId) {
  requireJwtSecret();
  return jwt.sign(
    { sub: locksmithId, type: 'locksmith' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function signMemberToken(memberId, businessId) {
  requireJwtSecret();
  return jwt.sign(
    { sub: memberId, type: 'member', memberId, businessId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function signAdminToken() {
  return jwt.sign({ sub: 'admin', type: 'admin' }, process.env.ADMIN_SECRET, {
    expiresIn: '1d',
  });
}

function verifyUserToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyAdminToken(token) {
  return jwt.verify(token, process.env.ADMIN_SECRET);
}

module.exports = {
  requireJwtSecret,
  signCustomerToken,
  signLocksmithToken,
  signMemberToken,
  signAdminToken,
  verifyUserToken,
  verifyAdminToken,
};
