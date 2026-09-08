const { sendMail } = require('../integrations/mailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function sendEmailConfirmation(user, token) {
  const link = `${FRONTEND_URL}/confirmar-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Confirme seu e-mail — Dravennx',
    html: `<p>Olá, ${user.name}!</p><p>Confirme seu e-mail clicando no link abaixo:</p><p><a href="${link}">${link}</a></p>`,
  });
}

async function sendPasswordReset(user, token) {
  const link = `${FRONTEND_URL}/redefinir-senha?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Redefinição de senha — Dravennx',
    html: `<p>Olá, ${user.name}!</p><p>Clique no link abaixo para redefinir sua senha (válido por 1 hora):</p><p><a href="${link}">${link}</a></p><p>Se você não solicitou, ignore este e-mail.</p>`,
  });
}

const STATUS_LABELS = {
  pago: 'Pagamento confirmado',
  em_separacao: 'Seu pedido está em separação',
  enviado: 'Seu pedido foi enviado',
  entregue: 'Seu pedido foi entregue',
  cancelado: 'Seu pedido foi cancelado',
  reembolsado: 'Seu pedido foi reembolsado',
};

async function sendOrderStatusUpdate(user, order) {
  const label = STATUS_LABELS[order.status] || `Status do pedido atualizado: ${order.status}`;
  const trackingInfo = order.trackingCode ? `<p>Código de rastreio: <strong>${order.trackingCode}</strong></p>` : '';
  await sendMail({
    to: user.email,
    subject: `${label} — Pedido ${order.orderNumber}`,
    html: `<p>Olá, ${user.name}!</p><p>${label}.</p>${trackingInfo}<p>Acompanhe todos os detalhes na área "Meus Pedidos".</p>`,
  });
}

async function sendBackInStockNotification(user, product) {
  const link = `${FRONTEND_URL}/produtos/${product.slug}`;
  await sendMail({
    to: user.email,
    subject: `Voltou ao estoque: ${product.name} — Dravennx`,
    html: `<p>Olá, ${user.name}!</p><p>Boas notícias: <strong>${product.name}</strong>, que você favoritou, está disponível de novo.</p><p><a href="${link}">Ver produto</a></p><p>Corre que o estoque costuma ser limitado.</p>`,
  });
}

async function sendAbandonedCartReminder(user, cartItems) {
  const link = `${FRONTEND_URL}/carrinho`;
  const itemsHtml = cartItems
    .map((item) => `<li>${item.quantity}x ${item.productName} (${item.size}, ${item.color})</li>`)
    .join('');
  await sendMail({
    to: user.email,
    subject: 'Você esqueceu uma coisa no carrinho — Dravennx',
    html: `<p>Olá, ${user.name}!</p><p>Você deixou isso no carrinho:</p><ul>${itemsHtml}</ul><p><a href="${link}">Voltar ao carrinho</a></p><p>O estoque não é garantido — se quiser, finaliza antes que acabe.</p>`,
  });
}

module.exports = { sendEmailConfirmation, sendPasswordReset, sendOrderStatusUpdate, sendBackInStockNotification, sendAbandonedCartReminder };
