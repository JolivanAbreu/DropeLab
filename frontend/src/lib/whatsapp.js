import { api } from '../api/client';
import { formatPrice } from './format';

let cachedStoreInfo = null;

// Cacheado em memória — não muda durante a sessão.
export async function getStoreInfo() {
  if (cachedStoreInfo) return cachedStoreInfo;
  cachedStoreInfo = await api.get('/store-info', { auth: false });
  return cachedStoreInfo;
}

export function buildShippingWhatsAppLink(whatsappNumber, order) {
  const itemsSummary = (order.items || [])
    .map((item) => `${item.quantity}x ${item.variant?.product?.name || 'produto'} (${item.variant?.size}/${item.variant?.color})`)
    .join(', ');

  const address = order.address
    ? `${order.address.street}, ${order.address.number} — ${order.address.neighborhood}, ${order.address.city}/${order.address.state}, CEP ${order.address.zip}`
    : '';

  const lines = [
    `Olá! Meu pedido *${order.orderNumber}* foi criado com frete "a combinar".`,
    itemsSummary && `Itens: ${itemsSummary}`,
    `Total dos produtos: ${formatPrice(order.subtotal)}`,
    address && `Endereço de entrega: ${address}`,
    'Poderiam me passar o valor e o prazo do frete?',
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${whatsappNumber}?text=${text}`;
}

export function buildGeneralWhatsAppLink(whatsappNumber) {
  const text = encodeURIComponent('Olá! Vim pelo site da Dravennx e queria tirar uma dúvida.');
  return `https://wa.me/${whatsappNumber}?text=${text}`;
}

// Telefone do cliente, não da loja.
export function buildAdminContactWhatsAppLink(customerPhone, order) {
  const digits = (customerPhone || '').replace(/\D/g, '');
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;

  const lines = [
    `Olá! Aqui é da Dravennx sobre o seu pedido *${order.orderNumber}*.`,
    'Vamos combinar o frete — pode me confirmar o endereço e o melhor horário para a entrega?',
  ];
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${withCountryCode}?text=${text}`;
}
