export function formatPrice(value) {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const ORDER_STATUS_LABELS = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_separacao: 'Em separação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
};

// tone usado pelo componente StatusPill: warn (atenção), lime (positivo), danger (negativo), neutral
export const ORDER_STATUS_TONE = {
  aguardando_pagamento: 'warn',
  pago: 'lime',
  em_separacao: 'warn',
  enviado: 'neutral',
  entregue: 'lime',
  cancelado: 'danger',
  reembolsado: 'danger',
};

// Próximo(s) status que o operador pode escolher a partir do atual — espelha
// Order.VALID_TRANSITIONS do backend (order.service.js) para já filtrar as
// opções do formulário antes mesmo de chamar a API.
// Precisa bater exatamente com ADMIN_VALID_TRANSITIONS em
// backend/src/services/order.service.js — pagamento agora acontece na
// entrega, então "pago" deixou de ser pré-requisito pra separar/enviar, e
// passou a poder ser confirmado a qualquer momento do fluxo (a equipe da
// loja decide quando o valor foi mesmo recebido).
// Precisa bater exatamente com ADMIN_VALID_TRANSITIONS em
// backend/src/services/order.service.js — "pago" agora pode ser tanto o
// ÚLTIMO passo (pagamento físico, confirmado só depois da entrega) quanto
// o PRIMEIRO (Pix antecipado, confirmado antes de qualquer separação/envio
// via webhook do Mercado Pago) — por isso também pode seguir pro fluxo
// normal de fulfillment, não só terminar em reembolso.
export const ORDER_NEXT_STATUSES = {
  aguardando_pagamento: ['em_separacao', 'enviado', 'entregue', 'pago', 'cancelado'],
  em_separacao: ['enviado', 'entregue', 'pago', 'cancelado'],
  enviado: ['entregue', 'pago', 'cancelado'],
  entregue: ['pago', 'reembolsado'],
  pago: ['em_separacao', 'enviado', 'entregue', 'reembolsado'],
  cancelado: ['reembolsado'],
  reembolsado: [],
};
