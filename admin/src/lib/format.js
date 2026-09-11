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

// Precisa bater com ADMIN_VALID_TRANSITIONS em backend/src/services/order.service.js.
export const ORDER_NEXT_STATUSES = {
  aguardando_pagamento: ['em_separacao', 'enviado', 'entregue', 'pago', 'cancelado'],
  em_separacao: ['enviado', 'entregue', 'pago', 'cancelado'],
  enviado: ['entregue', 'pago', 'cancelado'],
  entregue: ['pago', 'reembolsado'],
  pago: ['em_separacao', 'enviado', 'entregue', 'reembolsado'],
  cancelado: ['reembolsado'],
  reembolsado: [],
};
