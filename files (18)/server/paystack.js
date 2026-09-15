const crypto = require('crypto');

const PAYSTACK_BASE = 'https://api.paystack.co';

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set in the environment.');
  return key;
}

async function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      amount: amountKobo, // Paystack expects the amount in kobo (subunit of NGN)
      currency: 'NGN',
      reference,
      callback_url: callbackUrl,
      metadata
    })
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Paystack initialize request failed.');
  }
  return data.data; // { authorization_url, access_code, reference }
}

async function verifyTransaction(reference) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` }
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Paystack verify request failed.');
  }
  return data.data; // { status: 'success' | 'failed' | ..., amount, reference, ... }
}

// Paystack signs each webhook delivery with HMAC-SHA512 of the RAW request
// body, hex-encoded, in the x-paystack-signature header. Must be checked
// against the raw bytes — not the re-serialized/parsed JSON.
function isValidWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha512', secretKey()).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false; // length mismatch etc. -> treat as invalid, never throw here
  }
}

module.exports = { initializeTransaction, verifyTransaction, isValidWebhookSignature };
