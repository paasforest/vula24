/**
 * Verifies ADMIN_SECRET in .env can sign/verify a JWT (same as production check).
 * Usage: cd vula24-backend && node scripts/check-admin-secret.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');

const s = process.env.ADMIN_SECRET;
if (!s) {
  console.error('ADMIN_SECRET missing in vula24-backend/.env');
  process.exit(1);
}

const t = jwt.sign({ sub: 'admin', type: 'admin' }, s, { expiresIn: '1h' });
jwt.verify(t, s);
console.log('OK: local sign and verify match');
