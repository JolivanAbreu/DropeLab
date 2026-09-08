const cron = require('node-cron');
const { fn, col } = require('sequelize');
const { Cart, CartItem, ProductVariant, Product, User } = require('../models');
const emailService = require('../services/email.service');

const ABANDONED_AFTER_HOURS = 24;

/**
 * Manda um lembrete por e-mail pra quem deixou item no carrinho e não
 * finalizou a compra em 24h (RF-40 ampliado). Um carrinho só entra na
 * lista se:
 *   1. Tiver pelo menos um item;
 *   2. A última mexida nele (adicionar/alterar quantidade) foi há mais de
 *      24h — carrinho "parado", não um em uso ativo;
 *   3. Ainda não recebeu lembrete desde essa última mexida — evita mandar
 *      o mesmo e-mail toda vez que o job roda enquanto nada muda, mas
 *      volta a ficar elegível se o cliente voltar, mexer no carrinho de
 *      novo, e abandonar outra vez.
 *
 * Carrinho de quem já finalizou a compra nunca aparece aqui — clearCart()
 * já esvazia o carrinho na criação do pedido (order.service.js), então não
 * há risco de mandar "você esqueceu algo" pra quem já comprou.
 */
async function sendAbandonedCartReminders() {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000);

  // Última atividade de cada carrinho = item mais recentemente
  // adicionado/alterado nele — mais confiável que updated_at do carrinho em
  // si, que o Sequelize não toca automaticamente quando um item filho muda.
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

  // Filtra em JS (não dá pra comparar isso direto no WHERE do SQL sem uma
  // subquery correlacionada): só é elegível quem nunca foi notificado, OU
  // foi notificado antes da ÚLTIMA mexida NESTE carrinho específico — cada
  // carrinho tem sua própria "última atividade", diferente de comparar
  // contra o corte fixo de 24h global.
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
  // Uma vez por hora — não precisa da mesma frequência do job de
  // expiração de reserva (que lida com estoque, mais sensível a atraso).
  cron.schedule('0 * * * *', () => {
    sendAbandonedCartReminders().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[job] erro inesperado no job de carrinho abandonado:', err);
    });
  });
}

module.exports = { scheduleAbandonedCartJob, sendAbandonedCartReminders };
