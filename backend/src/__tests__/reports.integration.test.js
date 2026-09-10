const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, Order, User } = require('../models');

let adminToken;
let variantId;

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Relatório', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  if (role !== 'customer') await User.update({ role }, { where: { email } });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

async function createPaidOrder(customerToken) {
  const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${customerToken}`).send({
    street: 'Rua Relatório', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
  });
  await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${customerToken}`).send({ variant_id: variantId, quantity: 1 });
  const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${customerToken}`).send({
    address_id: addr.body.id, shipping_option_id: 'uberflex', payment_method: 'pix',
  });
  await Order.update({ status: 'pago' }, { where: { id: order.body.id } });
  return order.body;
}

beforeAll(async () => {
  await sequelize.authenticate();
  const category = await Category.create({ name: 'Categoria Relatório', slug: `categoria-relatorio-${uuidv4()}` });
  const product = await Product.create({ categoryId: category.id, name: 'Produto Relatório', slug: `produto-relatorio-${uuidv4()}`, basePrice: 70, active: true });
  const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-RELATORIO-${uuidv4()}`, stockQuantity: 50 });
  variantId = variant.id;
  adminToken = await makeUser(`admin-relatorio-${Date.now()}@teste.com`, 'admin');
});

afterAll(async () => {
  await sequelize.close();
});

describe('Relatório de vendas', () => {
  it('operador não pode acessar (403)', async () => {
    const opToken = await makeUser(`operador-relatorio-${Date.now()}@teste.com`, 'operator');
    const res = await request(app).get('/v1/admin/reports/sales').set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });

  it('retorna resumo com pedido pago dentro do período', async () => {
    const customerToken = await makeUser(`cliente-relatorio-${Date.now()}@teste.com`, 'customer');
    const order = await createPaidOrder(customerToken);

    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/v1/admin/reports/sales?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalOrders).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.totalRevenue).toBeGreaterThanOrEqual(Number(order.total));
    expect(res.body.byStatus.some((s) => s.status === 'pago')).toBe(true);
    expect(res.body.topProducts.some((p) => p.name === 'Produto Relatório')).toBe(true);
  });

  it('retorna a quebra por forma de pagamento a partir de orders.payment_method (pagamento na entrega, não mais de uma tabela de pagamento online)', async () => {
    const customerToken = await makeUser(`cliente-relatorio-pagamento-${Date.now()}@teste.com`, 'customer');
    await createPaidOrder(customerToken); // usa payment_method: 'pix'

    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/v1/admin/reports/sales?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const pixEntry = res.body.byPaymentMethod.find((m) => m.method === 'pix');
    expect(pixEntry).toBeTruthy();
    expect(pixEntry.count).toBeGreaterThanOrEqual(1);
    expect(pixEntry.revenue).toBeGreaterThan(0);
  });

  it('rejeita período com data inicial depois da final', async () => {
    const res = await request(app)
      .get('/v1/admin/reports/sales?from=2026-12-31&to=2026-01-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_date_range');
  });

  it('exporta CSV com cabeçalho e ao menos uma linha de pedido', async () => {
    const customerToken = await makeUser(`cliente-csv-${Date.now()}@teste.com`, 'customer');
    await createPaidOrder(customerToken);

    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/v1/admin/reports/sales/export?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('Pedido,Data,Status,Cliente,E-mail,Subtotal,Desconto,Frete,Total');
    expect(lines.length).toBeGreaterThan(1);
  });
});
