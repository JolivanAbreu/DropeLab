const { Op } = require('sequelize');
const { Order, OrderItem, Address, ProductVariant, Product, ProductImage, User, Payment, sequelize } = require('../models');
const ApiError = require('../utils/apiError');
const cartService = require('./cart.service');
const couponService = require('./coupon.service');
const stockService = require('./stock.service');
const shippingIntegration = require('../integrations/shipping');
const emailService = require('./email.service');
const { nextOrderNumber } = require('../utils/generateOrderNumber');

const VALID_PAYMENT_METHODS = ['credit_card', 'debit_card', 'cash', 'pix', 'pix_antecipado'];
// Combinadas com quem entrega — só valem para Uber Flash/99/"combinar".
const PHYSICAL_PAYMENT_METHODS = ['credit_card', 'debit_card', 'cash', 'pix'];

/**
 * Cria um pedido a partir do carrinho (RF-18): reserva estoque, calcula
 * totais e grava em "aguardando_pagamento" dentro de uma transação (RF-15).
 * pix_antecipado é obrigatório quando o frete é por transportadora real
 * (sem entregador pra combinar pagamento); os demais métodos exigem frete
 * combinado (Uber Flash/99/combinar).
 */
async function createOrder(userId, { addressId, shippingOptionId, couponCode, paymentMethod, changeFor }) {
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw ApiError.badRequest('Forma de pagamento inválida', 'invalid_payment_method');
  }

  const address = await Address.findOne({ where: { id: addressId, userId } });
  if (!address) throw ApiError.notFound('Endereço não encontrado para este cliente');

  const cart = await cartService.getCartWithItems(userId);
  if (cart.items.length === 0) throw ApiError.badRequest('Carrinho vazio');

  const shippingOptions = await shippingIntegration.quoteShipping({ zip: address.zip, items: cart.items });
  const shippingOption = shippingOptions.find((o) => o.id === shippingOptionId);
  if (!shippingOption) throw ApiError.badRequest('Opção de frete inválida', 'invalid_shipping_option');

  if (shippingOption.requiresArrangement && paymentMethod === 'pix_antecipado') {
    throw ApiError.badRequest(
      'Pix antecipado é só para entrega por transportadora — para Uber Flash/99/combinar, escolha uma forma de pagamento na entrega',
      'pix_antecipado_not_applicable',
    );
  }
  if (!shippingOption.requiresArrangement && PHYSICAL_PAYMENT_METHODS.includes(paymentMethod)) {
    throw ApiError.badRequest(
      'Entrega por transportadora não tem entregador para combinar pagamento — escolha Pix antecipado',
      'physical_payment_not_applicable',
    );
  }

  let coupon = null;
  let discount = 0;
  if (couponCode) {
    coupon = await couponService.validateCoupon(couponCode, cart.subtotal);
    discount = couponService.calculateDiscount(coupon, cart.subtotal);
  }

  const total = cart.subtotal - discount + shippingOption.price;

  let normalizedChangeFor = null;
  if (paymentMethod === 'cash' && changeFor !== undefined && changeFor !== null && changeFor !== '') {
    normalizedChangeFor = Number(changeFor);
    if (Number.isNaN(normalizedChangeFor) || normalizedChangeFor < total) {
      throw ApiError.badRequest('O valor informado para troco precisa ser igual ou maior que o total do pedido', 'invalid_change_for');
    }
  }

  return sequelize.transaction(async (transaction) => {
    for (const item of cart.items) {
      await stockService.reserveStock(item.variant.id, item.quantity, { transaction });
    }

    const orderNumber = await nextOrderNumber(sequelize);

    const order = await Order.create({
      userId,
      addressId,
      orderNumber,
      status: 'aguardando_pagamento',
      subtotal: cart.subtotal,
      discount,
      shippingCost: shippingOption.price,
      shippingMethod: shippingOption.id,
      shippingMethodName: shippingOption.name,
      requiresShippingArrangement: !!shippingOption.requiresArrangement,
      shippingContactMethod: shippingOption.contactMethod || null,
      total,
      couponCode: coupon ? coupon.code : null,
      paymentMethod,
      changeFor: normalizedChangeFor,
    }, { transaction });

    await OrderItem.bulkCreate(
      cart.items.map((item) => ({
        orderId: order.id,
        variantId: item.variant.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      { transaction }
    );

    if (coupon) {
      await couponService.registerUsage(coupon.code, { transaction });
    }

    await cartService.clearCart(userId, { transaction });

    return order;
  });
}

async function listOrdersForUser(userId) {
  return Order.findAll({
    where: { userId },
    include: [{
      model: OrderItem,
      as: 'items',
      include: [{
        model: ProductVariant,
        as: 'variant',
        include: [{
          model: Product,
          as: 'product',
          include: [{ model: ProductImage, as: 'images', separate: true, limit: 1, order: [['order', 'ASC']] }],
        }],
      }],
    }],
    order: [['createdAt', 'DESC']],
  });
}

async function getOrderById(userId, orderId) {
  const where = { id: orderId };
  if (userId) where.userId = userId;

  const order = await Order.findOne({
    where,
    include: [
      { model: OrderItem, as: 'items', include: [{ model: ProductVariant, as: 'variant', include: [{ model: Product, as: 'product', include: [{ model: ProductImage, as: 'images', separate: true, limit: 1, order: [['order', 'ASC']] }] }] }] },
      { model: Address, as: 'address' },
      { model: Payment, as: 'payments', separate: true, order: [['createdAt', 'DESC']] },
      ...(userId ? [] : [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'cpf'] }]),
    ],
  });
  if (!order) throw ApiError.notFound('Pedido não encontrado');
  return order;
}

/**
 * Libera o estoque reservado de um pedido (RF-19, RN-03).
 */
async function releaseOrderStock(order, { transaction } = {}) {
  const items = order.items || (await OrderItem.findAll({ where: { orderId: order.id }, transaction }));
  for (const item of items) {
    await stockService.releaseStock(item.variantId, item.quantity, { transaction });
  }
}

// Máquina de estados do cliente/padrão — só avança um passo por vez.
function assertValidTransition(currentStatus, nextStatus, transitions = Order.VALID_TRANSITIONS) {
  const allowed = transitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.unprocessable(
      `Transição de status inválida: ${currentStatus} -> ${nextStatus}`,
      'invalid_status_transition'
    );
  }
}

// Máquina de estados do painel — mais permissiva (permite pular etapas).
// "pago" pode ser o último passo (pagamento físico, confirmado após a
// entrega) ou o primeiro (Pix antecipado, via webhook), por isso segue pro
// fluxo normal em vez de terminar direto em reembolso.
const ADMIN_VALID_TRANSITIONS = {
  aguardando_pagamento: ['em_separacao', 'enviado', 'entregue', 'pago', 'cancelado'],
  em_separacao: ['enviado', 'entregue', 'pago', 'cancelado'],
  enviado: ['entregue', 'pago', 'cancelado'],
  entregue: ['pago', 'reembolsado'],
  pago: ['em_separacao', 'enviado', 'entregue', 'reembolsado'],
  cancelado: ['reembolsado'],
  reembolsado: [],
};

/**
 * Atualiza o status do pedido (RF-26/RF-27), notifica o cliente por e-mail
 * (RF-28) e libera estoque em cancelamentos.
 */
async function updateOrderStatus(orderId, nextStatus, { trackingCode, transitions } = {}) {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(orderId, {
      include: [{ model: OrderItem, as: 'items' }],
      transaction,
    });
    if (!order) throw ApiError.notFound('Pedido não encontrado');

    assertValidTransition(order.status, nextStatus, transitions);

    // Correios/Melhor Envio geram código de rastreio; Uber Flash/99/combinar não.
    if (nextStatus === 'enviado' && !order.requiresShippingArrangement && !trackingCode) {
      throw ApiError.badRequest('Código de rastreio é obrigatório para marcar como enviado');
    }
    if (nextStatus === 'cancelado') {
      await releaseOrderStock(order, { transaction });
    }

    order.status = nextStatus;
    if (nextStatus === 'enviado') {
      order.trackingCode = trackingCode;
      order.shippedAt = new Date();
    }
    if (nextStatus === 'entregue') order.deliveredAt = new Date();
    await order.save({ transaction });

    const user = await User.findByPk(order.userId, { transaction });
    emailService.sendOrderStatusUpdate(user, order).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[email] falha ao notificar mudança de status do pedido', err.message);
    });

    return order;
  });
}

async function listAllOrders({ status, search, page = 1 } = {}) {
  const where = {};
  if (status) where.status = status;

  if (search) {
    const matchingUsers = await User.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ],
      },
      attributes: ['id'],
    });
    where[Op.or] = [
      { orderNumber: { [Op.iLike]: `%${search}%` } },
      { userId: { [Op.in]: matchingUsers.map((u) => u.id) } },
    ];
  }

  const PAGE_SIZE = 30;

  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  return { data: rows, page: Number(page), totalPages: Math.ceil(count / PAGE_SIZE), total: count };
}

const CUSTOMER_CANCELABLE_STATUSES = ['aguardando_pagamento', 'em_separacao'];
const CUSTOMER_DELETABLE_STATUSES = ['aguardando_pagamento', 'cancelado'];

async function cancelOwnOrder(userId, orderId) {
  const order = await Order.findOne({ where: { id: orderId, userId } });
  if (!order) throw ApiError.notFound('Pedido não encontrado');

  if (!CUSTOMER_CANCELABLE_STATUSES.includes(order.status)) {
    throw ApiError.unprocessable(
      'Este pedido não pode mais ser cancelado por aqui — fale com o suporte.',
      'order_not_cancelable'
    );
  }

  return updateOrderStatus(orderId, 'cancelado');
}

async function deleteOwnOrder(userId, orderId) {
  const order = await Order.findOne({ where: { id: orderId, userId } });
  if (!order) throw ApiError.notFound('Pedido não encontrado');

  if (!CUSTOMER_DELETABLE_STATUSES.includes(order.status)) {
    throw ApiError.unprocessable(
      'Só é possível excluir pedidos cancelados ou que ainda não foram pagos.',
      'order_not_deletable'
    );
  }

  if (order.status === 'aguardando_pagamento') {
    await releaseOrderStock(order);
  }

  await Order.destroy({ where: { id: orderId } });
}

module.exports = {
  createOrder,
  listOrdersForUser,
  getOrderById,
  updateOrderStatus,
  releaseOrderStock,
  listAllOrders,
  assertValidTransition,
  cancelOwnOrder,
  deleteOwnOrder,
  ADMIN_VALID_TRANSITIONS,
};
