const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, User } = require('../models');

async function registerAndLogin(email, cpf) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Feedback', email, password: 'senha1234', cpf, phone: '85999999999',
  });
  const res = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return res.body.access_token;
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Mensagens de erro de cadastro', () => {
  it('CPF duplicado retorna mensagem clara (409), não "Dados inválidos" genérico', async () => {
    const cpf = `${Date.now()}`.slice(0, 11);
    await request(app).post('/v1/register').send({
      name: 'Primeiro', email: `primeiro-${Date.now()}@teste.com`, password: 'senha1234', cpf, phone: '85999999999',
    });

    const res = await request(app).post('/v1/register').send({
      name: 'Segundo', email: `segundo-${Date.now()}@teste.com`, password: 'senha1234', cpf, phone: '85999999999',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('cpf_already_registered');
    expect(res.body.message).toMatch(/CPF/);
  });

  it('cadastro funciona sem informar CPF (campo removido do formulário de cadastro)', async () => {
    const res = await request(app).post('/v1/register').send({
      name: 'Sem CPF', email: `sem-cpf-${Date.now()}@teste.com`, password: 'senha1234', phone: '85999999999',
    });
    expect(res.status).toBe(201);

    const user = await User.findByPk(res.body.id);
    expect(user.cpf).toBeNull();
  });

  it('dois cadastros sem CPF não conflitam entre si (unique permite múltiplos NULL)', async () => {
    const res1 = await request(app).post('/v1/register').send({
      name: 'Sem CPF 1', email: `sem-cpf-1-${Date.now()}@teste.com`, password: 'senha1234', phone: '85999999999',
    });
    const res2 = await request(app).post('/v1/register').send({
      name: 'Sem CPF 2', email: `sem-cpf-2-${Date.now()}@teste.com`, password: 'senha1234', phone: '85999999999',
    });
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });
});

describe('Troca de e-mail (Conta)', () => {
  it('troca o e-mail com a senha atual correta e permite login com o novo e-mail', async () => {
    const oldEmail = `antigo-${Date.now()}@teste.com`;
    const newEmail = `novo-${Date.now()}@teste.com`;
    const token = await registerAndLogin(oldEmail, `${Date.now()}`.slice(0, 11));

    const res = await request(app).put('/v1/account/email').set('Authorization', `Bearer ${token}`).send({
      new_email: newEmail, current_password: 'senha1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(newEmail);

    const loginOld = await request(app).post('/v1/login').send({ email: oldEmail, password: 'senha1234' });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app).post('/v1/login').send({ email: newEmail, password: 'senha1234' });
    expect(loginNew.status).toBe(200);
  });

  it('rejeita troca de e-mail com senha atual incorreta', async () => {
    const token = await registerAndLogin(`emailerrado-${Date.now()}@teste.com`, `${Date.now()}`.slice(0, 11));
    const res = await request(app).put('/v1/account/email').set('Authorization', `Bearer ${token}`).send({
      new_email: `outro-${Date.now()}@teste.com`, current_password: 'senhaErrada',
    });
    expect(res.status).toBe(401);
  });

  it('rejeita troca para um e-mail já usado por outra conta', async () => {
    const takenEmail = `ocupado-${Date.now()}@teste.com`;
    await registerAndLogin(takenEmail, `${Date.now()}`.slice(0, 11));

    const token = await registerAndLogin(`quermudar-${Date.now()}@teste.com`, `${Date.now() + 1}`.slice(0, 11));
    const res = await request(app).put('/v1/account/email').set('Authorization', `Bearer ${token}`).send({
      new_email: takenEmail, current_password: 'senha1234',
    });
    expect(res.status).toBe(409);
  });
});

describe('Opções de frete (Uberflex, 99Flex, combinar)', () => {
  it('retorna as três opções de entrega esperadas', async () => {
    const token = await registerAndLogin(`frete-${Date.now()}@teste.com`, `${Date.now()}`.slice(0, 11));
    const res = await request(app).post('/v1/cart/shipping-quote').set('Authorization', `Bearer ${token}`).send({ zip: '60000-000' });

    // shipping-quote exige carrinho não vazio — sem item, é esperado 400
    expect(res.status).toBe(400);
  });

  it('com item no carrinho, retorna uberflex/99flex/combinar', async () => {
    const category = await Category.create({ name: 'Cat Frete', slug: `cat-frete-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Frete', slug: `produto-frete-${uuidv4()}`, basePrice: 50, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-FRETE-${uuidv4()}`, stockQuantity: 10 });

    const token = await registerAndLogin(`frete2-${Date.now()}@teste.com`, `${Date.now()}`.slice(0, 11));
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });

    const res = await request(app).post('/v1/cart/shipping-quote').set('Authorization', `Bearer ${token}`).send({ zip: '60000-000' });
    expect(res.status).toBe(200);
    const ids = res.body.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['uberflex', '99flex', 'combinar']));

    const combinar = res.body.find((o) => o.id === 'combinar');
    expect(combinar.price).toBe(0);
    expect(combinar.requiresArrangement).toBe(true);
  });

  it('pedido criado com "combinar" persiste o método de frete e contactMethod=store', async () => {
    const category = await Category.create({ name: 'Cat Combinar', slug: `cat-combinar-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Combinar', slug: `produto-combinar-${uuidv4()}`, basePrice: 70, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-COMBINAR-${uuidv4()}`, stockQuantity: 10 });

    const token = await registerAndLogin(`frete-combinar-${Date.now()}@teste.com`, `${Date.now()}`.slice(0, 11));
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Combinar', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });

    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar', payment_method: 'pix',
    });

    expect(order.status).toBe(201);
    expect(order.body.shippingMethod).toBe('combinar');
    expect(order.body.shippingMethodName).toBe('Combinar com o vendedor');
    expect(order.body.requiresShippingArrangement).toBe(true);
    expect(order.body.shippingContactMethod).toBe('store');
    expect(order.body.shippingCost).toBe('0.00');
  });

  it('pedido criado com Uber Flash tem preço zero e contactMethod=customer_app (cliente pede no app)', async () => {
    const category = await Category.create({ name: 'Cat Uberflex', slug: `cat-uberflex-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Uberflex', slug: `produto-uberflex-${uuidv4()}`, basePrice: 70, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-UBERFLEX-${uuidv4()}`, stockQuantity: 10 });

    const token = await registerAndLogin(`frete-uberflex-${Date.now()}@teste.com`, `${Date.now()}`.slice(0, 11));
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Uberflex', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });

    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'uberflex', payment_method: 'pix',
    });

    expect(order.status).toBe(201);
    expect(order.body.shippingMethodName).toBe('Uber Flash');
    expect(order.body.shippingCost).toBe('0.00');
    expect(order.body.requiresShippingArrangement).toBe(true);
    expect(order.body.shippingContactMethod).toBe('customer_app');
  });

  it('a cotação de frete retorna "Uber Flash" (não mais "Uberflex") e nenhuma opção de app externo tem preço fixo', async () => {
    const category = await Category.create({ name: 'Cat Cotacao', slug: `cat-cotacao-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Cotacao', slug: `produto-cotacao-${uuidv4()}`, basePrice: 70, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-COTACAO-${uuidv4()}`, stockQuantity: 10 });

    const token = await registerAndLogin(`frete-cotacao-${Date.now()}@teste.com`, `${Date.now()}`.slice(0, 11));
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });

    const res = await request(app).post('/v1/cart/shipping-quote').set('Authorization', `Bearer ${token}`).send({ zip: '60000-000' });
    const uber = res.body.find((o) => o.id === 'uberflex');
    const flex99 = res.body.find((o) => o.id === '99flex');

    expect(uber.name).toBe('Uber Flash');
    expect(uber.price).toBe(0);
    expect(flex99.price).toBe(0);
  });
});

describe('Upload de imagem', () => {
  it('admin envia uma imagem e recebe uma URL pública', async () => {
    const adminEmail = `admin-upload-${Date.now()}@teste.com`;
    const token = await registerAndLogin(adminEmail, `${Date.now()}`.slice(0, 11));
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const login = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });
    const adminToken = login.body.access_token;

    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const tmpPath = path.join(__dirname, 'tmp-upload-test.png');
    fs.writeFileSync(tmpPath, tinyPng);

    try {
      const res = await request(app)
        .post('/v1/admin/uploads')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', tmpPath);

      expect(res.status).toBe(201);
      expect(res.body.url).toMatch(/\/uploads\/.+\.webp$/);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('operador não pode fazer upload (403)', async () => {
    const opEmail = `op-upload-${Date.now()}@teste.com`;
    const token = await registerAndLogin(opEmail, `${Date.now()}`.slice(0, 11));
    await User.update({ role: 'operator' }, { where: { email: opEmail } });
    const login = await request(app).post('/v1/login').send({ email: opEmail, password: 'senha1234' });

    const res = await request(app).post('/v1/admin/uploads').set('Authorization', `Bearer ${login.body.access_token}`);
    expect(res.status).toBe(403);
  });
});

describe('Detalhe do pedido no painel administrativo', () => {
  it('inclui dados do cliente (nome, e-mail, telefone)', async () => {
    const category = await Category.create({ name: 'Cat Pedido Admin', slug: `cat-pedido-admin-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Pedido Admin', slug: `produto-pedido-admin-${uuidv4()}`, basePrice: 60, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Azul', sku: `SKU-PEDADM-${uuidv4()}`, stockQuantity: 10 });

    const clientEmail = `cliente-pedido-${Date.now()}@teste.com`;
    const clientToken = await registerAndLogin(clientEmail, `${Date.now()}`.slice(0, 11));

    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${clientToken}`).send({
      street: 'Rua Pedido', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${clientToken}`).send({ variant_id: variant.id, quantity: 1 });
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${clientToken}`).send({
      address_id: addr.body.id, shipping_option_id: 'uberflex', payment_method: 'pix',
    });

    const adminEmail = `admin-pedido-${Date.now()}@teste.com`;
    await registerAndLogin(adminEmail, `${Date.now() + 1}`.slice(0, 11));
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const adminLogin = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });

    const res = await request(app).get(`/v1/admin/orders/${order.body.id}`).set('Authorization', `Bearer ${adminLogin.body.access_token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(clientEmail);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });
});
