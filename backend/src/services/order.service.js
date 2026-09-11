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
// Formas de pagamento combinadas com quem entrega (só fazem sentido pra
// Uber Flash/99/"combinar com o vendedor", onde existe um entregador real
// pra receber o pagamento na hora).
const PHYSICAL_PAYMENT_METHODS = ['credit_card', 'debit_card', 'cash', 'pix'];

/**
 * Cria um pedido a partir do carrinho atual (RF-18): dentro de uma única
 * transação, valida e reserva o estoque de cada item, calcula os totais e
 * grava o pedido em "aguardando_pagamento". Se qualquer item não tiver
 * estoque suficiente, a transação inteira é revertida (RF-15).
 *
 * A forma de pagamento depende do tipo de frete escolhido:
 * - Uber Flash/99/combinar (requiresArrangement=true): pagamento é
 *   combinado com quem entrega — cliente só informa COMO (cartão físico,
 *   dinheiro ou Pix na hora), sem processar nada aqui.
 * - Correios/transportadora real via Melhor Envio (requiresArrangement=
 *   false): não existe entregador pra combinar pagamento, então é
 *   obrigatório pagar antecipado por Pix (pix_antecipado) — o pedido é
 *   criado normalmente aqui, mas só avança pra separação depois que o
 *   webhook do Mercado Pago confirmar o pagamento (ver payment.service).
 *
 * changeFor só é relevante quando paymentMethod === 'cash' e o cliente vai
 * precisar de troco; se informado, precisa ser suficiente pra cobrir o
 * total do pedido.
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
    // Reserva o estoque item a item — RETURNING/condição atômica no UPDATE
    // garante que dois checkouts simultâneos não vendam além do saldo (RN-02).
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
        unitPrice: item.unitPrice, // preço congelado no momento da compra (documento 3, seção 4)
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
  if (userId) where.userId = userId; // admin/operador consulta sem filtrar por usuário

  const order = await Order.findOne({
    where,
    include: [
      { model: OrderItem, as: 'items', include: [{ model: ProductVariant, as: 'variant', include: [{ model: Product, as: 'product', include: [{ model: ProductImage, as: 'images', separate: true, limit: 1, order: [['order', 'ASC']] }] }] }] },
      { model: Address, as: 'address' },
      { model: Payment, as: 'payments', separate: true, order: [['createdAt', 'DESC']] },
      // Dados do cliente só fazem sentido quando é uma consulta administrativa
      // (userId nulo) — no autoatendimento do cliente, ele já sabe quem é.
      ...(userId ? [] : [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'cpf'] }]),
    ],
  });
  if (!order) throw ApiError.notFound('Pedido não encontrado');
  return order;
}

/**
 * Libera o estoque reservado de um pedido — usado no cancelamento e na
 * expiração automática de pedidos Pix não pagos (RF-19, RN-03).
 */
async function releaseOrderStock(order, { transaction } = {}) {
  const items = order.items || (await OrderItem.findAll({ where: { orderId: order.id }, transaction }));
  for (const item of items) {
    await stockService.releaseStock(item.variantId, item.quantity, { transaction });
  }
}

// Máquina de estados usada para ações do próprio cliente (cancelamento) e
// como padrão de updateOrderStatus. Mais restritiva: só avança um passo por
// vez, refletindo o fluxo natural do pedido.
function assertValidTransition(currentStatus, nextStatus, transitions = Order.VALID_TRANSITIONS) {
  const allowed = transitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.unprocessable(
      `Transição de status inválida: ${currentStatus} -> ${nextStatus}`,
      'invalid_status_transition'
    );
  }
}

// Máquina de estados usada pelo painel administrativo — mais permissiva que
// a do cliente: a equipe da loja frequentemente pula etapas na prática (ex.:
// despacha no mesmo dia sem passar por "em separação", ou confirma um
// pagamento manualmente). Continua bloqueando o que não faz sentido, como
// pular a confirmação de pagamento ou reabrir um pedido já entregue.
const ADMIN_VALID_TRANSITIONS = {
  aguardando_pagamento: ['em_separacao', 'enviado', 'entregue', 'pago', 'cancelado'],
  em_separacao: ['enviado', 'entregue', 'pago', 'cancelado'],
  enviado: ['entregue', 'pago', 'cancelado'],
  entregue: ['pago', 'reembolsado'],
  // "pago" pode ser tanto o ÚLTIMO passo (pagamento físico, confirmado só
  // depois da entrega) quanto o PRIMEIRO (Pix antecipado, confirmado antes
  // de qualquer separação/envio, via webhook do Mercado Pago) — por isso
  // aqui ele também precisa poder seguir pro fluxo normal de fulfillment,
  // não só terminar em reembolso.
  pago: ['em_separacao', 'enviado', 'entregue', 'reembolsado'],
  cancelado: ['reembolsado'],
  reembolsado: [],
};

/**
 * Atualiza o status do pedido validando a máquina de estados (RF-26/RF-27),
 * disparando e-mail ao cliente (RF-28) e liberando estoque em cancelamentos.
 * `transitions` permite trocar a máquina de estados aplicada (ver
 * ADMIN_VALID_TRANSITIONS, usada pelo painel administrativo).
 */
async function updateOrderStatus(orderId, nextStatus, { trackingCode, transitions } = {}) {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(orderId, {
      include: [{ model: OrderItem, as: 'items' }],
      transaction,
    });
    if (!order) throw ApiError.notFound('Pedido não encontrado');

    assertValidTransition(order.status, nextStatus, transitions);

    // Código de rastreio só é exigido quando a entrega é por um serviço com
    // rastreamento de verdade (Correios/Melhor Envio) — Uber Flash, 99 e
    // "combinar com o vendedor" nunca geram código de rastreio, então
    // exigir isso travaria o admin pra sempre nesses casos.
    if (nextStatus === 'enviado' && !order.requiresShippingArrangement && !trackingCode) {
      throw ApiError.badRequest('Código de rastreio é obrigatório para marcar como enviado');
    }
    // Estoque é reservado já na criação do pedido (aguardando_pagamento), então
    // todo cancelamento libera o estoque — independentemente do status anterior.
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
    // Fire-and-forget: notificação por e-mail nunca deve atrasar a resposta
    // HTTP da atualização de status (o await + catch anterior chegava a
    // segurar a request por segundos quando o SMTP estava fora do ar).
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
    // Busca por número do pedido OU nome/e-mail do cliente. Como envolve
    // duas tabelas, resolve os IDs de usuário que combinam primeiro, depois
    // monta um único OR — mais simples e previsível do que tentar um OR
    // through de um include aninhado no Sequelize.
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

// Status a partir dos quais o próprio cliente ainda pode cancelar o pedido —
// depois de "enviado" o cancelamento passa a exigir contato com o suporte,
// já que a mercadoria já está a caminho.
const CUSTOMER_CANCELABLE_STATUSES = ['aguardando_pagamento', 'em_separacao'];
// Só é seguro apagar de vez pedidos que nunca chegaram a ser pagos — preserva
// o histórico fiscal de qualquer pedido que teve pagamento aprovado.
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

  // Se o pedido ainda reservava estoque (nunca chegou a ser pago nem
  // cancelado formalmente), libera antes de remover — evita órfãos de estoque.
  if (order.status === 'aguardando_pagamento') {
    await releaseOrderStock(order);
  }

  await Order.destroy({ where: { id: orderId } }); // cascade remove order_items/payments (ver migrations)
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
