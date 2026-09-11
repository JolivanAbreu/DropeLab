const cron = require('node-cron');
const { fn, col } = require('sequelize');
const { Cart, CartItem, ProductVariant, Product, User } = require('../models');
const emailService = require('../services/email.service');

const ABANDONED_AFTER_HOURS = 24;

// Lembra quem deixou item no carrinho há 24h+ sem finalizar (RF-40). Só
// reenvia se o carrinho mudou desde o último lembrete.
async function sendAbandonedCartReminders() {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000);

  const lastActivityByCart = await CartItem.findAll({
    attributes: ['cartId', [fn('MAX', col('updated_at')), 'lastActivity']],
    group: ['cart_id'],
    raw: true,
  });

  const lastActivityMap = new Map(lastActivityByCart.map((row) => [row.cartId, new Date(row.lastActivity)]));

  const eligibleCartIds = lastActivityByCart
    .filter((row) => new Date(row.lastActivity) < cutoff)
    .map((row) => row.cartId);

  if (eligibleCartIds.length === 0) return 0;

  const candidateCarts = await Cart.findAll({
    where: { id: eligibleCartIds },
    include: [
      { model: User, as: 'user' },
      {
        model: CartItem,
        as: 'items',
        include: [{ model: ProductVariant, as: 'variant', include: [{ model: Product, as: 'product' }] }],
      },
    ],
  });

  const carts = candidateCarts.filter((cart) => {
    const lastActivity = lastActivityMap.get(cart.id);
    return !cart.abandonedEmailSentAt || cart.abandonedEmailSentAt < lastActivity;
  });

  let sentCount = 0;
  for (const cart of carts) {
    if (!cart.user || cart.items.length === 0) continue;

    try {
      const itemsForEmail = cart.items.map((item) => ({
        quantity: item.quantity,
        productName: item.variant?.product?.name || 'Produto',
        size: item.variant?.size,
        color: item.variant?.color,
      }));

      await emailService.sendAbandonedCartReminder(cart.user, itemsForEmail);
      await cart.update({ abandonedEmailSentAt: new Date() });
      sentCount += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[job] falha ao enviar lembrete de carrinho abandonado (cart ${cart.id}):`, err.message);
    }
  }

  return sentCount;
}

function scheduleAbandonedCartJob() {
  cron.schedule('0 * * * *', () => {
    sendAbandonedCartReminders().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[job] erro inesperado no job de carrinho abandonado:', err);
    });
  });
}

module.exports = { scheduleAbandonedCartJob, sendAbandonedCartReminders };
