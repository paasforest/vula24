const axios = require('axios');

const CLIENT_ID = process.env.SMSPORTAL_CLIENT_ID;
const CLIENT_SECRET = process.env.SMSPORTAL_CLIENT_SECRET;
const BASE_URL = 'https://rest.smsportal.com/v1';

/** Canonical SA mobile digits only, e.g. 27821234567 (no +). */
function normalizeSaPhone(input) {
  let p = String(input || '').replace(/\s/g, '');
  if (!p) return '';
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = `27${p.slice(1)}`;
  p = p.replace(/\D/g, '');
  if (!p.startsWith('27')) return '';
  return p;
}

async function getAuthToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    'base64'
  );

  const { data } = await axios.post(
    `${BASE_URL}/Authentication`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return data.token;
}

async function sendOTP(phone, otp) {
  try {
    const token = await getAuthToken();

    // Format SA phone number
    let formatted = String(phone).replace(/\s/g, '');
    if (formatted.startsWith('0')) {
      formatted = `27${formatted.slice(1)}`;
    }
    if (!formatted.startsWith('+')) {
      formatted = `+${formatted}`;
    }

    await axios.post(
      `${BASE_URL}/BulkMessages`,
      {
        messages: [
          {
            destination: formatted,
            content: `Your Vula24 verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return true;
  } catch (e) {
    console.error('[SMS] Failed to send OTP:', e?.message);
    return false;
  }
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { sendOTP, generateOTP, normalizeSaPhone };
