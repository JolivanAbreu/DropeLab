const request = require('supertest');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, Order, User } = require('../models');

async function registerAndLogin(email) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Pix Antecipado', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

async function addItemToCart(token) {
  const category = await Category.create({ name: 'Cat Pix', slug: `cat-pix-${uuidv4()}` });
  const product = await Product.create({ categoryId: category.id, name: 'Produto Pix', slug: `produto-pix-${uuidv4()}`, basePrice: 100, active: true });
  const variant = await ProductVariant.create({
    productId: product.id, size: 'M', color: 'Preto', sku: `SKU-PIX-${uuidv4()}`, stockQuantity: 10,
    weightKg: 0.35, heightCm: 4, widthCm: 22, lengthCm: 18,
  });
  await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
  return variant;
}

async function createAddress(token, zip = '01310-100') {
  const res = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
    street: 'Rua Pix', number: '1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', zip,
  });
  return res.body.id;
}

function mockRealCarrierShipping() {
  process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
  process.env.STORE_POSTAL_CODE = '60000-000';
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: async () => ([{ id: 7, name: 'SEDEX', price: '35.00', company: { name: 'Correios' } }]),
  }));
}

async function createPixAntecipadoOrder(token) {
  mockRealCarrierShipping();
  await addItemToCart(token);
  const addressId = await createAddress(token);
  const res = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
    address_id: addressId, shipping_option_id: 'me-7', payment_method: 'pix_antecipado',
  });
  return res.body;
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Validação cruzada frete x forma de pagamento', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it('rejeita pix_antecipado com frete combinado (Uber Flash/99/combinar)', async () => {
    const token = await registerAndLogin(`cruzada-fisico-${Date.now()}@teste.com`);
    await addItemToCart(token);
    const addressId = await createAddress(token, '60000-000');

    const res = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addressId, shipping_option_id: 'uberflex', payment_method: 'pix_antecipado',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('pix_antecipado_not_applicable');
  });

  it('rejeita forma de pagamento física com frete por transportadora real', async () => {
    const token = await registerAndLogin(`cruzada-transportadora-${Date.now()}@teste.com`);
    mockRealCarrierShipping();
    await addItemToCart(token);
    const addressId = await createAddress(token);

    const res = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addressId, shipping_option_id: 'me-7', payment_method: 'cash',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('physical_payment_not_applicable');
  });

  it('aceita pix_antecipado com frete por transportadora real', async () => {
    const token = await registerAndLogin(`cruzada-ok-${Date.now()}@teste.com`);
    const order = await createPixAntecipadoOrder(token);
    expect(order.status).toBe('aguardando_pagamento');
    expect(order.paymentMethod).toBe('pix_antecipado');
  });
});

describe('Geração de cobrança Pix', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it('sem MERCADOPAGO_ACCESS_TOKEN configurado, retorna 502 com mensagem segura', async () => {
    const token = await registerAndLogin(`sem-credencial-${Date.now()}@teste.com`);
    const order = await createPixAntecipadoOrder(token);
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;

    const res = await request(app).post('/v1/payments/pix').set('Authorization', `Bearer ${token}`).send({ order_id: order.id });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('payment_provider_unavailable');
  });

  it('com credencial configurada, gera QR Code e código copia-e-cola', async () => {
    const token = await registerAndLogin(`com-credencial-${Date.now()}@teste.com`);
    const order = await createPixAntecipadoOrder(token);
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-credencial-real-de-teste';
    const mpPaymentId = Date.now() + Math.floor(Math.random() * 100000);

    global.fetch = jest.fn((url) => {
      if (String(url).includes('api.mercadopago.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: mpPaymentId,
            status: 'pending',
            point_of_interaction: { transaction_data: { qr_code_base64: 'BASE64FAKE', qr_code: '00020126copia-e-colafake' } },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ([]) });
    });

    const res = await request(app).post('/v1/payments/pix').set('Authorization', `Bearer ${token}`).send({ order_id: order.id, identification_number: '17225854127' });

    expect(res.status).toBe(201);
    expect(res.body.pixQrCode).toBe('BASE64FAKE');
    expect(res.body.pixCopyPaste).toBe('00020126copia-e-colafake');
    expect(res.body.status).toBe('pending');
  });

  it('rejeita gerar Pix pra pedido que não é pix_antecipado', async () => {
    const token = await registerAndLogin(`nao-pix-${Date.now()}@teste.com`);
    await addItemToCart(token);
    const addressId = await createAddress(token, '60000-000');
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addressId, shipping_option_id: 'uberflex', payment_method: 'cash',
    });

    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-credencial-real-de-teste';
    const res = await request(app).post('/v1/payments/pix').set('Authorization', `Bearer ${token}`).send({ order_id: order.body.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('not_pix_antecipado_order');
  });
});

describe('Webhook do Mercado Pago', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  function buildSignature(secret, dataId, requestId, ts) {
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return `ts=${ts},v1=${v1}`;
  }

  it('rejeita webhook com assinatura inválida', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo-teste';
    const res = await request(app)
      .post('/v1/webhooks/mercadopago?data.id=123')
      .set('x-signature', 'ts=123,v1=assinaturafalsa')
      .set('x-request-id', 'req-1')
      .send({});
    expect(res.status).toBe(401);
  });

  it('confirma o pagamento e move o pedido de aguardando_pagamento pra pago', async () => {
    const token = await registerAndLogin(`webhook-confirma-${Date.now()}@teste.com`);
    const order = await createPixAntecipadoOrder(token);
    const mpPaymentId = Date.now() + Math.floor(Math.random() * 100000);

    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-credencial-real-de-teste';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo-webhook-teste';

    global.fetch = jest.fn((url) => {
      if (String(url).includes('api.mercadopago.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: mpPaymentId, status: 'pending', point_of_interaction: { transaction_data: { qr_code_base64: 'X', qr_code: 'Y' } } }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ([]) });
    });
    await request(app).post('/v1/payments/pix').set('Authorization', `Bearer ${token}`).send({ order_id: order.id });

    global.fetch = jest.fn((url) => {
      if (String(url).includes('api.mercadopago.com')) {
        return Promise.resolve({ ok: true, json: async () => ({ id: mpPaymentId, status: 'approved' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ([]) });
    });

    const ts = Math.floor(Date.now() / 1000);
    const signature = buildSignature('segredo-webhook-teste', String(mpPaymentId), 'req-2', ts);
    const webhookRes = await request(app)
      .post(`/v1/webhooks/mercadopago?data.id=${mpPaymentId}`)
      .set('x-signature', signature)
      .set('x-request-id', 'req-2')
      .send({});

    expect(webhookRes.status).toBe(200);

    const updated = await Order.findByPk(order.id);
    expect(updated.status).toBe('pago');
  });

  it('depois de pago via Pix antecipado, admin continua o fluxo normal (pago -> em_separacao -> enviado -> entregue)', async () => {
    const token = await registerAndLogin(`fluxo-pos-pago-${Date.now()}@teste.com`);
    const order = await createPixAntecipadoOrder(token);
    await Order.update({ status: 'pago' }, { where: { id: order.id } });

    const adminEmail = `admin-pos-pago-${Date.now()}@teste.com`;
    await registerAndLogin(adminEmail);
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const adminLogin = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });
    const adminToken = adminLogin.body.access_token;

    const toSeparacao = await request(app).put(`/v1/admin/orders/${order.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'em_separacao' });
    expect(toSeparacao.status).toBe(200);

    const toEnviado = await request(app).put(`/v1/admin/orders/${order.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'enviado', trackingCode: 'BR999888777BR' });
    expect(toEnviado.status).toBe(200);

    const toEntregue = await request(app).put(`/v1/admin/orders/${order.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'entregue' });
    expect(toEntregue.status).toBe(200);
  });
});

describe('Job de expiração de Pix antecipado não pago', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it('cancela pedido pix_antecipado parado há mais de 30 minutos, liberando o estoque', async () => {
    const { expireUnpaidPixCharges } = require('../jobs/expireUnpaidPixCharges');

    const token = await registerAndLogin(`expira-pix-${Date.now()}@teste.com`);
    const order = await createPixAntecipadoOrder(token);

    await Order.update(
      { createdAt: new Date(Date.now() - 40 * 60 * 1000) },
      { where: { id: order.id } }
    );

    const count = await expireUnpaidPixCharges();
    expect(count).toBeGreaterThanOrEqual(1);

    const updated = await Order.findByPk(order.id);
    expect(updated.status).toBe('cancelado');
  });

  it('NUNCA cancela pedido de pagamento físico (Uber Flash/cartão/dinheiro), mesmo há muito tempo aguardando', async () => {
    const { expireUnpaidPixCharges } = require('../jobs/expireUnpaidPixCharges');

    const token = await registerAndLogin(`nao-expira-fisico-${Date.now()}@teste.com`);
    await addItemToCart(token);
    const addressId = await createAddress(token, '60000-000');
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addressId, shipping_option_id: 'uberflex', payment_method: 'cash',
    });

    await Order.update(
      { createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      { where: { id: order.body.id } }
    );

    await expireUnpaidPixCharges();

    const stillWaiting = await Order.findByPk(order.body.id);
    expect(stillWaiting.status).toBe('aguardando_pagamento');
  });
});
