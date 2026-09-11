// Só Pix antecipado (frete por transportadora, sem entregador físico).
const crypto = require('crypto');

function hasValidCredentials() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
  return !!token && !/^TEST-x+$/i.test(token) && token !== 'TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
}

// Omitido em localhost — o Mercado Pago não alcançaria o webhook mesmo
// assim, e uma URL inválida quebraria a criação do pagamento.
function buildNotificationUrl() {
  const base = process.env.API_PUBLIC_URL || '';
  if (!base || base.includes('localhost') || base.includes('127.0.0.1')) return undefined;
  return `${base.replace(/\/$/, '')}/v1/webhooks/mercadopago`;
}

async function mpFetch(path, options) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      ...(options?.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
      ...options?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.message || body?.cause?.[0]?.description || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return body;
}

// CPF do pagador é obrigatório na prática — sem ele o Mercado Pago rejeita
// com "excludes_by_rule".
async function createPixPayment({ transactionAmount, description, payer, externalReference, idempotencyKey }) {
  return mpFetch('/v1/payments', {
    method: 'POST',
    idempotencyKey,
    body: JSON.stringify({
      transaction_amount: transactionAmount,
      description,
      payment_method_id: 'pix',
      payer,
      external_reference: externalReference,
      notification_url: buildNotificationUrl(),
    }),
  });
}

async function getPayment(paymentId) {
  return mpFetch(`/v1/payments/${paymentId}`, { method: 'GET' });
}

function isValidWebhookSignature({ xSignature, xRequestId, dataId }) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !xSignature) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=')).filter((p) => p.length === 2)
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId || ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

module.exports = { hasValidCredentials, createPixPayment, getPayment, isValidWebhookSignature };
