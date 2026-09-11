const { Order, User, sequelize } = require('../models');
const ApiError = require('../utils/apiError');
const mercadopago = require('../integrations/mercadopago');
const emailService = require('./email.service');

async function callMercadoPago(fn) {
  if (!mercadopago.hasValidCredentials()) {
    // eslint-disable-next-line no-console
    console.error(
      '[mercadopago] MERCADOPAGO_ACCESS_TOKEN não configurado (ou ainda é o valor de exemplo). ' +
      'Pix antecipado (pedidos por transportadora) vai continuar falhando até você colocar uma ' +
      'credencial de sandbox real — gere uma em https://www.mercadopago.com.br/developers/panel.'
    );
    throw new ApiError(502, 'payment_provider_unavailable', 'Não foi possível gerar a cobrança Pix no momento. Tente novamente em instantes.');
  }
  try {
    return await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mercadopago] falha na comunicação com a API:', err.message);
    throw new ApiError(502, 'payment_provider_unavailable', 'Não foi possível gerar a cobrança Pix no momento. Tente novamente em instantes.');
  }
}

function buildPayer(user, checkoutCpf) {
  const payer = { email: user.email };
  const cpf = checkoutCpf || user.cpf;
  if (cpf) {
    payer.identification = { type: 'CPF', number: cpf.replace(/\D/g, '') };
  }
  return payer;
}

function mapMpStatus(mpStatus) {
  if (mpStatus === 'approved') return 'approved';
  if (['rejected', 'cancelled'].includes(mpStatus)) return 'rejected';
  return 'pending';
}

async function generatePixCharge(userId, { orderId, identificationNumber }) {
  const order = await Order.findOne({ where: { id: orderId, userId } });
  if (!order) throw ApiError.notFound('Pedido não encontrado');
  if (order.paymentMethod !== 'pix_antecipado') {
    throw ApiError.badRequest('Este pedido não usa Pix antecipado', 'not_pix_antecipado_order');
  }
  if (order.status !== 'aguardando_pagamento') {
    throw ApiError.conflict('Este pedido não está mais aguardando pagamento', 'order_not_payable');
  }

  const user = await User.findByPk(userId);

  const mpResponse = await callMercadoPago(() => mercadopago.createPixPayment({
    transactionAmount: Number(order.total),
    description: `Pedido ${order.orderNumber} — Dravennx`,
    payer: buildPayer(user, identificationNumber),
    externalReference: order.id,
    idempotencyKey: order.id,
  }));

  const txData = mpResponse.point_of_interaction?.transaction_data || {};
  order.pixPaymentId = String(mpResponse.id);
  order.pixQrCode = txData.qr_code_base64 || null;
  order.pixCopyPaste = txData.qr_code || null;
  await order.save();

  return {
    orderId: order.id,
    status: mapMpStatus(mpResponse.status),
    pixQrCode: order.pixQrCode,
    pixCopyPaste: order.pixCopyPaste,
  };
}

async function confirmPixPaid(orderId) {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(orderId, { transaction });
    if (!order || order.status !== 'aguardando_pagamento') return;

    order.status = 'pago';
    await order.save({ transaction });

    const user = await User.findByPk(order.userId, { transaction });
    emailService.sendOrderStatusUpdate(user, order).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[email] falha ao notificar pagamento Pix confirmado', err.message);
    });
  });
}

async function getPixStatus(userId, orderId) {
  const order = await Order.findOne({ where: { id: orderId, userId } });
  if (!order) throw ApiError.notFound('Pedido não encontrado');
  if (!order.pixPaymentId) throw ApiError.badRequest('Este pedido ainda não tem uma cobrança Pix gerada', 'pix_not_generated');

  if (order.status === 'pago') return { status: 'approved' };

  const mpPayment = await callMercadoPago(() => mercadopago.getPayment(order.pixPaymentId));
  const status = mapMpStatus(mpPayment.status);
  if (status === 'approved') await confirmPixPaid(order.id);
  return { status };
}

async function handleWebhook({ dataId, xSignature, xRequestId }) {
  const isValid = mercadopago.isValidWebhookSignature({ xSignature, xRequestId, dataId });
  if (!isValid) {
    throw ApiError.unauthorized('Assinatura de webhook inválida', 'invalid_webhook_signature');
  }

  const mpPayment = await callMercadoPago(() => mercadopago.getPayment(dataId));
  const order = await Order.findOne({ where: { pixPaymentId: String(dataId) } });
  if (!order) return { ignored: true };

  const status = mapMpStatus(mpPayment.status);
  if (status === 'approved') await confirmPixPaid(order.id);

  return { processed: true, status };
}

module.exports = { generatePixCharge, getPixStatus, handleWebhook, confirmPixPaid, mapMpStatus };
