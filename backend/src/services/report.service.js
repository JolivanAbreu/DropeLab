const { sequelize } = require('../models');
const ApiError = require('../utils/apiError');

function resolvePeriod({ from, to }) {
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Datas inválidas — use o formato AAAA-MM-DD', 'invalid_date_range');
  }
  if (start > end) {
    throw ApiError.badRequest('A data inicial não pode ser depois da data final', 'invalid_date_range');
  }
  return { start, end };
}

/**
 * Relatório de vendas por período — resumo, quebra por status, por meio de
 * pagamento, série diária e produtos mais vendidos. Pedidos cancelados são
 * excluídos do faturamento (mas aparecem na quebra por status, para dar
 * visibilidade da taxa de cancelamento).
 */
async function getSalesReport({ from, to }) {
  const { start, end } = resolvePeriod({ from, to });
  const replacements = { start, end };

  const [[summary]] = await sequelize.query(`
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('cancelado')) AS total_orders,
      COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelado')), 0) AS total_revenue,
      COALESCE(SUM(discount) FILTER (WHERE status NOT IN ('cancelado')), 0) AS total_discount,
      COALESCE(SUM(shipping_cost) FILTER (WHERE status NOT IN ('cancelado')), 0) AS total_shipping,
      COALESCE(AVG(total) FILTER (WHERE status NOT IN ('cancelado', 'aguardando_pagamento')), 0) AS average_ticket,
      COUNT(*) FILTER (WHERE status = 'cancelado') AS cancelled_orders
    FROM orders
    WHERE created_at BETWEEN :start AND :end;
  `, { replacements });

  const [byStatus] = await sequelize.query(`
    SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE created_at BETWEEN :start AND :end
    GROUP BY status
    ORDER BY count DESC;
  `, { replacements });

  // Pagamento acontece na entrega (não mais online) — a forma de pagamento
  // já vem escolhida na criação do pedido (orders.payment_method), sem
  // depender mais de um registro de pagamento aprovado via provedor externo.
  const [byPaymentMethod] = await sequelize.query(`
    SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE status NOT IN ('cancelado') AND created_at BETWEEN :start AND :end
    GROUP BY payment_method;
  `, { replacements });

  const [byDay] = await sequelize.query(`
    SELECT DATE(created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE status NOT IN ('cancelado') AND created_at BETWEEN :start AND :end
    GROUP BY DATE(created_at)
    ORDER BY day ASC;
  `, { replacements });

  const [topProducts] = await sequelize.query(`
    SELECT p.name, SUM(oi.quantity) AS units_sold, SUM(oi.quantity * oi.unit_price) AS revenue
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelado') AND o.created_at BETWEEN :start AND :end
    GROUP BY p.name
    ORDER BY units_sold DESC
    LIMIT 10;
  `, { replacements });

  return {
    period: { from: start.toISOString(), to: end.toISOString() },
    summary: {
      totalOrders: Number(summary.total_orders),
      totalRevenue: Number(summary.total_revenue),
      totalDiscount: Number(summary.total_discount),
      totalShipping: Number(summary.total_shipping),
      averageTicket: Number(summary.average_ticket),
      cancelledOrders: Number(summary.cancelled_orders),
    },
    byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count), revenue: Number(r.revenue) })),
    byPaymentMethod: byPaymentMethod.map((r) => ({ method: r.method, count: Number(r.count), revenue: Number(r.revenue) })),
    byDay: byDay.map((r) => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) })),
    topProducts: topProducts.map((r) => ({ name: r.name, unitsSold: Number(r.units_sold), revenue: Number(r.revenue) })),
  };
}

/** Linhas detalhadas de pedidos no período, para exportação em CSV. */
async function getSalesExportRows({ from, to }) {
  const { start, end } = resolvePeriod({ from, to });

  const [rows] = await sequelize.query(`
    SELECT
      o.order_number, o.created_at, o.status,
      u.name AS customer_name, u.email AS customer_email,
      o.subtotal, o.discount, o.shipping_cost, o.total
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.created_at BETWEEN :start AND :end
    ORDER BY o.created_at ASC;
  `, { replacements: { start, end } });

  return rows;
}

function rowsToCsv(rows) {
  const headers = ['Pedido', 'Data', 'Status', 'Cliente', 'E-mail', 'Subtotal', 'Desconto', 'Frete', 'Total'];
  const escape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.order_number,
      new Date(r.created_at).toISOString(),
      r.status,
      r.customer_name,
      r.customer_email,
      r.subtotal,
      r.discount,
      r.shipping_cost,
      r.total,
    ].map(escape).join(','));
  }
  return lines.join('\n');
}

module.exports = { getSalesReport, getSalesExportRows, rowsToCsv };
