// Integração com o Mercado Pago restrita a Pix antecipado — usada
// exclusivamente quando o frete é por transportadora real (Correios/Melhor
// Envio), onde não existe entregador físico pra combinar pagamento na
// entrega. Para Uber Flash/99/combinar, pagamento continua sendo físico,
// sem nenhuma chamada a este arquivo.
const crypto = require('crypto');

function hasValidCredentials() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
  return !!token && !/^TEST-x+$/i.test(token) && token !== 'TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
}

/**
 * Monta a notification_url apenas quando há uma URL pública válida
 * configurada. Em ambiente local (localhost/127.0.0.1) o Mercado Pago nunca
 * conseguiria alcançar o webhook mesmo assim — e enviar uma URL relativa ou
 * inválida faz a própria criação do pagamento falhar ("notification_url
 * attribute must be url valid"). Por isso omitimos o campo nesses casos: o
 * pagamento ainda funciona normalmente, só depende de consulta de status
 * (polling) em vez de notificação automática.
 */
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

/**
 * Cria uma cobrança Pix (RF-21-antecipado). O CPF do pagador é obrigatório
 * na prática para o mercado brasileiro — sem ele, o motor de regras
 * antifraude do Mercado Pago rejeita a transação com "excludes_by_rule",
 * mesmo em sandbox com dados corretos em todo o resto.
 */
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

/**
 * Valida a assinatura do webhook (x-signature) — nunca confia num payload
 * de webhook sem confirmar que veio mesmo do Mercado Pago, já que o
 * endpoint é público por necessidade (o Mercado Pago precisa alcançá-lo
 * sem autenticação prévia).
 */
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
    return false; // tamanhos diferentes — nunca é uma assinatura válida
  }
}

module.exports = { hasValidCredentials, createPixPayment, getPayment, isValidWebhookSignature };
