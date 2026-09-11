const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant } = require('../models');
const melhorEnvio = require('../integrations/melhorEnvio');

async function registerAndLogin(email) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Frete', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

async function addItemToCart(token) {
  const category = await Category.create({ name: 'Cat Frete', slug: `cat-frete-${uuidv4()}` });
  const product = await Product.create({ categoryId: category.id, name: 'Produto Frete', slug: `produto-frete-${uuidv4()}`, basePrice: 80, active: true });
  const variant = await ProductVariant.create({
    productId: product.id, size: 'M', color: 'Preto', sku: `SKU-FRETE-${uuidv4()}`, stockQuantity: 10,
    weightKg: 0.35, heightCm: 4, widthCm: 22, lengthCm: 18,
  });
  await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
  return variant;
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Integração melhorEnvio.js (unitário, sem servidor)', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it('sem MELHOR_ENVIO_TOKEN configurado, isConfigured() retorna false e quoteByCep não chama fetch', async () => {
    delete process.env.MELHOR_ENVIO_TOKEN;
    delete process.env.STORE_POSTAL_CODE;
    global.fetch = jest.fn();

    expect(melhorEnvio.isConfigured()).toBe(false);
    const result = await melhorEnvio.quoteByCep({ toPostalCode: '01310-100', items: [] });
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('com credenciais configuradas, chama a API real e normaliza a resposta', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: 1, name: 'PAC', price: '24.50', custom_price: '22.90', delivery_time: 8, custom_delivery_time: 7, company: { name: 'Correios' } },
        { id: 2, name: 'SEDEX', price: '38.00', custom_price: null, delivery_time: 3, custom_delivery_time: null, company: { name: 'Correios' } },
      ]),
    });

    const result = await melhorEnvio.quoteByCep({
      toPostalCode: '01310-100',
      items: [{ quantity: 1, variant: { sku: 'SKU-1', weightKg: 0.3, heightCm: 5, widthCm: 20, lengthCm: 15, product: { basePrice: 90 } } }],
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/v2/me/shipment/calculate');
    expect(options.headers.Authorization).toBe('Bearer token-de-teste');
    expect(options.headers['User-Agent']).toBeTruthy();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('me-1');
    expect(result[0].price).toBe(22.9); // usa custom_price quando disponível
    expect(result[0].estimatedDays).toBe(7);
    expect(result[1].price).toBe(38); // sem custom_price, cai pro price normal
    expect(result.every((r) => r.requiresArrangement === false)).toBe(true);
  });

  it('descarta serviços que vieram com erro da API (transportadora indisponível pra essa rota)', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: 1, name: 'PAC', price: '24.50', company: { name: 'Correios' } },
        { id: 3, name: 'Jadlog', error: 'Serviço indisponível para o CEP informado' },
      ]),
    });

    const result = await melhorEnvio.quoteByCep({ toPostalCode: '01310-100', items: [{ quantity: 1, variant: { sku: 'X' } }] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('PAC');
  });

  it('API fora do ar (resposta não-ok) retorna lista vazia, sem lançar erro', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const result = await melhorEnvio.quoteByCep({ toPostalCode: '01310-100', items: [{ quantity: 1, variant: {} }] });
    expect(result).toEqual([]);
  });

  it('timeout/erro de rede retorna lista vazia, sem lançar erro', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    const result = await melhorEnvio.quoteByCep({ toPostalCode: '01310-100', items: [{ quantity: 1, variant: {} }] });
    expect(result).toEqual([]);
  });

  it('item sem peso/dimensão cadastrados usa os valores padrão de fallback', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });

    await melhorEnvio.quoteByCep({ toPostalCode: '01310-100', items: [{ quantity: 1, variant: { sku: 'SEM-DIMENSAO' } }] });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.products[0].weight).toBeGreaterThan(0);
    expect(body.products[0].width).toBeGreaterThan(0);
  });
});

describe('POST /cart/shipping-quote — mesclando opções fixas com frete real', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it('sem Melhor Envio configurado, retorna só as 3 opções fixas (comportamento já existente preservado)', async () => {
    delete process.env.MELHOR_ENVIO_TOKEN;
    delete process.env.STORE_POSTAL_CODE;

    const token = await registerAndLogin(`frete-sem-me-${Date.now()}@teste.com`);
    await addItemToCart(token);

    const res = await request(app).post('/v1/cart/shipping-quote').set('Authorization', `Bearer ${token}`).send({ zip: '60000-000' });

    expect(res.status).toBe(200);
    expect(res.body.map((o) => o.id)).toEqual(['uberflex', '99flex', 'combinar']);
  });

  it('com Melhor Envio configurado, acrescenta as cotações reais às 3 opções fixas', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ id: 5, name: 'PAC', price: '19.90', company: { name: 'Correios' } }]),
    });

    const token = await registerAndLogin(`frete-com-me-${Date.now()}@teste.com`);
    await addItemToCart(token);

    const res = await request(app).post('/v1/cart/shipping-quote').set('Authorization', `Bearer ${token}`).send({ zip: '01310-100' });

    expect(res.status).toBe(200);
    const ids = res.body.map((o) => o.id);
    expect(ids).toEqual(['uberflex', '99flex', 'combinar', 'me-5']);
    const meOption = res.body.find((o) => o.id === 'me-5');
    expect(meOption.price).toBe(19.9);
    expect(meOption.requiresArrangement).toBe(false);
  });

  it('se a API do Melhor Envio falhar, a cotação segue funcionando só com as 3 opções fixas (não quebra o checkout)', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));

    const token = await registerAndLogin(`frete-falha-me-${Date.now()}@teste.com`);
    await addItemToCart(token);

    const res = await request(app).post('/v1/cart/shipping-quote').set('Authorization', `Bearer ${token}`).send({ zip: '01310-100' });

    expect(res.status).toBe(200);
    expect(res.body.map((o) => o.id)).toEqual(['uberflex', '99flex', 'combinar']);
  });
});

describe('Criação de pedido com uma cotação real de transportadora', () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
  });

  it('cobra o preço real da transportadora no total do pedido, sem exigir combinação por WhatsApp', async () => {
    process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste';
    process.env.STORE_POSTAL_CODE = '60000-000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ id: 7, name: 'SEDEX', price: '35.00', company: { name: 'Correios' } }]),
    });

    const token = await registerAndLogin(`pedido-frete-real-${Date.now()}@teste.com`);
    await addItemToCart(token);

    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Frete Real', number: '1', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', zip: '01310-100',
    });

    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'me-7', payment_method: 'pix_antecipado',
    });

    expect(order.status).toBe(201);
    expect(Number(order.body.shippingCost)).toBe(35);
    expect(order.body.requiresShippingArrangement).toBe(false);
    expect(order.body.shippingContactMethod).toBeNull();
    expect(Number(order.body.total)).toBe(80 + 35);
  });
});
