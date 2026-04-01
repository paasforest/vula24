const crypto = require('crypto');

function isSandbox() {
  return String(process.env.PAYFAST_SANDBOX).toLowerCase() === 'true';
}

function getProcessUrl() {
  return isSandbox()
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';
}

/**
 * PayFast signature: md5 of concatenated param=value pairs (alphabetical), no empty values, then &passphrase=secret
 */
function generateSignature(data, passphrase) {
  const filtered = { ...data };
  delete filtered.signature;

  const pairs = Object.keys(filtered)
    .filter((k) => {
      const v = filtered[k];
      return v !== '' && v !== null && v !== undefined;
    })
    .sort()
    .map((k) => {
      const val = String(filtered[k]).trim();
      return `${k}=${encodeURIComponent(val).replace(/%20/g, '+')}`;
    });

  let query = pairs.join('&');
  if (passphrase) {
    const p = String(passphrase).trim();
    query += `&passphrase=${encodeURIComponent(p).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(query).digest('hex');
}

/**
 * Build PayFast form fields for redirect POST
 */
function buildPaymentFields({
  amount,
  itemName,
  itemDescription,
  mPaymentId,
  email,
  returnUrl,
  cancelUrl,
  notifyUrl,
}) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';

  const data = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    name_first: 'Vula24',
    name_last: 'Customer',
    email_address: email || 'noreply@vula24.local',
    m_payment_id: mPaymentId,
    amount: Number(amount).toFixed(2),
    item_name: itemName,
    item_description: itemDescription || itemName,
  };

  data.signature = generateSignature(data, passphrase);
  return { url: getProcessUrl(), fields: data };
}

/**
 * Verify ITN (webhook) signature from PayFast POST body (flat object)
 */
function verifyItnSignature(body) {
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  const received = body.signature;
  if (!received) return false;

  const copy = { ...body };
  delete copy.signature;
  const computed = generateSignature(copy, passphrase);
  return computed === received;
}

module.exports = {
  buildPaymentFields,
  verifyItnSignature,
  getProcessUrl,
  isSandbox,
};
