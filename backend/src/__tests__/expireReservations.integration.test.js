const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Mock explícito (não automock) do e-mail — sem isso, o cancelamento por
// expiração tenta mandar e-mail de verdade (fluxo fire-and-forget real do
// updateOrderStatus), o que fica bem mais lento aqui por causa da tentativa
// de conexão SMTP que sempre falha neste ambiente de teste.
jest.mock('../services/email.service', () => ({
  sendEmailConfirmation: jest.fn().mockResolvedValue(),
  sendPasswordReset: jest.fn().mockResolvedValue(),
  sendOrderStatusUpdate: jest.fn().mockResolvedValue(),
  sendBackInStockNotification: jest.fn().mockResolvedValue(),
}));

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, Order } = require('../models');
const { expireStaleReservations } = require('../jobs/expireReservations');

async function registerAndLogin(email) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Expiração', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Expiração automática de pedido não pago — estoque volta ao original', () => {
  it('pedido criado há mais de 30 minutos e ainda aguardando pagamento é cancelado e o estoque reservado volta', async () => {
    const category = await Category.create({ name: 'Cat Expiração', slug: `cat-expiracao-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Expiração', slug: `produto-expiracao-${uuidv4()}`, basePrice: 90, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-EXPIRACAO-${uuidv4()}`, stockQuantity: 10 });

    const token = await registerAndLogin(`expira-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Expiração', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 3 });

    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar',
    });
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('aguardando_pagamento');

    // Confirma que o estoque foi reservado no momento da compra
    await variant.reload();
    expect(variant.stockQuantity).toBe(7); // 10 - 3

    // Simula "passou 35 minutos" sem precisar esperar de verdade — reescreve
    // created_at direto no banco, exatamente como o job vai encontrar quando
    // rodar de verdade a cada 5 minutos.
    const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);
    await Order.update({ createdAt: thirtyFiveMinutesAgo }, { where: { id: order.body.id } });

    const expiredCount = await expireStaleReservations();
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const orderAfter = await Order.findByPk(order.body.id);
    expect(orderAfter.status).toBe('cancelado');

    await variant.reload();
    expect(variant.stockQuantity).toBe(10); // voltou ao original
  });

  it('pedido criado há menos de 30 minutos NÃO é cancelado nem tem o estoque mexido', async () => {
    const category = await Category.create({ name: 'Cat Recente', slug: `cat-recente-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Recente', slug: `produto-recente-${uuidv4()}`, basePrice: 90, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-RECENTE-${uuidv4()}`, stockQuantity: 5 });

    const token = await registerAndLogin(`recente-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Recente', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 2 });
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar',
    });

    await expireStaleReservations();

    const orderAfter = await Order.findByPk(order.body.id);
    expect(orderAfter.status).toBe('aguardando_pagamento'); // continua esperando, não foi tocado

    await variant.reload();
    expect(variant.stockQuantity).toBe(3); // ainda reservado (5 - 2), não voltou
  });

  it('pedido já pago (não mais aguardando_pagamento) nunca é cancelado pelo job, mesmo antigo', async () => {
    const category = await Category.create({ name: 'Cat Pago', slug: `cat-pago-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Pago', slug: `produto-pago-${uuidv4()}`, basePrice: 90, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-PAGO-${uuidv4()}`, stockQuantity: 5 });

    const token = await registerAndLogin(`pago-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Pago', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar',
    });

    const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);
    await Order.update({ status: 'pago', createdAt: thirtyFiveMinutesAgo }, { where: { id: order.body.id } });

    await expireStaleReservations();

    const orderAfter = await Order.findByPk(order.body.id);
    expect(orderAfter.status).toBe('pago'); // o job só mexe em aguardando_pagamento
  });
});
