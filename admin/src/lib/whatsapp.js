// Telefone do cliente, não da loja (caminho inverso do lib/whatsapp.js do frontend).
export function buildCustomerWhatsAppLink(customerPhone, order) {
  const digits = (customerPhone || '').replace(/\D/g, '');
  if (!digits) return null;

  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;

  const lines = [
    `Olá! Aqui é da Dravennx sobre o seu pedido *${order.orderNumber}*.`,
    'Vamos combinar o frete — pode confirmar o endereço e o melhor horário para a entrega?',
  ];
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${withCountryCode}?text=${text}`;
}
