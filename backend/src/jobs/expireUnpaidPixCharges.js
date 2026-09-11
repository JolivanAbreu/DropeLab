const { Op } = require('sequelize');
const { Order } = require('../models');
const orderService = require('../services/order.service');

const EXPIRATION_MINUTES = 30;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // a cada 5 minutos

// Cancela Pix antecipado (frete por transportadora) sem confirmação em 30+
// min, liberando o estoque. Nunca afeta pagamento físico (Uber Flash/99/
// combinar/cartão/dinheiro na entrega), que pode ser pago dias depois.
async function expireUnpaidPixCharges() {
  const cutoff = new Date(Date.now() - EXPIRATION_MINUTES * 60 * 1000);
  const staleOrders = await Order.findAll({
    where: {
      status: 'aguardando_pagamento',
      paymentMethod: 'pix_antecipado',
      createdAt: { [Op.lt]: cutoff },
    },
  });

  for (const order of staleOrders) {
    try {
      await orderService.updateOrderStatus(order.id, 'cancelado');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[expireUnpaidPixCharges] falha ao cancelar pedido ${order.id}:`, err.message);
    }
  }

  return staleOrders.length;
}

function scheduleExpireUnpaidPixChargesJob() {
  setInterval(() => {
    expireUnpaidPixCharges().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[expireUnpaidPixCharges] erro inesperado no job:', err.message);
    });
  }, CHECK_INTERVAL_MS);
}

module.exports = { expireUnpaidPixCharges, scheduleExpireUnpaidPixChargesJob };
