const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, Order, User } = require('../models');

let variantId;

async function registerAndLogin(email) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Conta', email, password: 'senha1234', cpf: `${Date.now()}`.slice(0, 11), phone: '85999999999',
  });
  const res = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return res.body.access_token;
}

async function createAddress(token) {
  const res = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
    street: 'Rua Conta', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
  });
  return res.body.id;
}

async function createOrder(token) {
  await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variantId, quantity: 1 });
  const addressId = await createAddress(token);
  const res = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
    address_id: addressId, shipping_option_id: 'uberflex', payment_method: 'pix',
  });
  return res.body;
}

beforeAll(async () => {
  await sequelize.authenticate();
  const category = await Category.create({ name: 'Categoria Conta', slug: `categoria-conta-${uuidv4()}` });
  const product = await Product.create({ categoryId: category.id, name: 'Produto Conta', slug: `produto-conta-${uuidv4()}`, basePrice: 80, active: true });
  const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-CONTA-${uuidv4()}`, stockQuantity: 10 });
  variantId = variant.id;
});

afterAll(async () => {
  await sequelize.close();
});

describe('Conta do usuário', () => {
  it('retorna o perfil do usuário autenticado', async () => {
    const token = await registerAndLogin(`perfil-${Date.now()}@teste.com`);
    const res = await request(app).get('/v1/account').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Cliente Conta');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('atualiza nome e telefone', async () => {
    const token = await registerAndLogin(`update-${Date.now()}@teste.com`);
    const res = await request(app).put('/v1/account').set('Authorization', `Bearer ${token}`).send({ name: 'Nome Novo', phone: '85888887777' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nome Novo');
    expect(res.body.phone).toBe('85888887777');
  });

  it('troca a senha com sucesso e permite login com a nova senha', async () => {
    const email = `senha-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);

    const change = await request(app).put('/v1/account/password').set('Authorization', `Bearer ${token}`).send({
      current_password: 'senha1234', new_password: 'novaSenha123',
    });
    expect(change.status).toBe(200);

    const loginOld = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app).post('/v1/login').send({ email, password: 'novaSenha123' });
    expect(loginNew.status).toBe(200);
  });

  it('rejeita troca de senha com senha atual incorreta', async () => {
    const token = await registerAndLogin(`senha-errada-${Date.now()}@teste.com`);
    const res = await request(app).put('/v1/account/password').set('Authorization', `Bearer ${token}`).send({
      current_password: 'senhaErrada', new_password: 'novaSenha123',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_current_password');
  });
});

describe('Cancelamento e exclusão de pedido pelo cliente', () => {
  it('cliente cancela pedido aguardando pagamento e o estoque é liberado', async () => {
    const token = await registerAndLogin(`cancela-${Date.now()}@teste.com`);
    const before = await ProductVariant.findByPk(variantId);
    const order = await createOrder(token);

    const res = await request(app).post(`/v1/orders/${order.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelado');

    const afterVariant = await ProductVariant.findByPk(variantId);
    expect(afterVariant.stockQuantity).toBe(before.stockQuantity);
  });

  it('cliente não consegue cancelar pedido de outro cliente', async () => {
    const tokenA = await registerAndLogin(`dono-${Date.now()}@teste.com`);
    const order = await createOrder(tokenA);

    const tokenB = await registerAndLogin(`intruso-${Date.now()}@teste.com`);
    const res = await request(app).post(`/v1/orders/${order.id}/cancel`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('cliente exclui pedido aguardando pagamento (remove do banco)', async () => {
    const token = await registerAndLogin(`exclui-${Date.now()}@teste.com`);
    const order = await createOrder(token);

    const res = await request(app).delete(`/v1/orders/${order.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const stillExists = await Order.findByPk(order.id);
    expect(stillExists).toBeNull();
  });

  it('não permite excluir pedido já pago', async () => {
    const token = await registerAndLogin(`nao-exclui-pago-${Date.now()}@teste.com`);
    const order = await createOrder(token);
    await Order.update({ status: 'pago' }, { where: { id: order.id } });

    const res = await request(app).delete(`/v1/orders/${order.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('order_not_deletable');

    const stillExists = await Order.findByPk(order.id);
    expect(stillExists).not.toBeNull();
  });

  it('não permite cancelar pedido já entregue', async () => {
    const token = await registerAndLogin(`nao-cancela-entregue-${Date.now()}@teste.com`);
    const order = await createOrder(token);
    await Order.update({ status: 'entregue' }, { where: { id: order.id } });

    const res = await request(app).post(`/v1/orders/${order.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('order_not_cancelable');
  });

  it('não permite cliente autocancelar pedido já pago (pagamento na entrega já foi recebido — só admin trata isso, como reembolso)', async () => {
    const token = await registerAndLogin(`nao-cancela-pago-${Date.now()}@teste.com`);
    const order = await createOrder(token);
    await Order.update({ status: 'pago' }, { where: { id: order.id } });

    const res = await request(app).post(`/v1/orders/${order.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('order_not_cancelable');
  });

  it('cancelamento de pedido pago funciona normalmente (sem estorno online — pagamento foi físico, na entrega)', async () => {
    const token = await registerAndLogin(`cancela-pago-${Date.now()}@teste.com`);
    const order = await createOrder(token);
    await Order.update({ status: 'pago' }, { where: { id: order.id } });

    const adminEmail = `admin-cancela-pago-${Date.now()}@teste.com`;
    await registerAndLogin(adminEmail);
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const adminLogin = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });

    // Pedido "pago" só permite ir pra "reembolsado" na máquina de estados —
    // não existe mais "cancelado" a partir daí, já que o pagamento na
    // entrega não tem uma cobrança online pra estornar automaticamente.
    const res = await request(app)
      .put(`/v1/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ status: 'reembolsado' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reembolsado');
  });

  it('admin confirma pagamento manualmente após a entrega (entregue -> pago)', async () => {
    const token = await registerAndLogin(`confirma-manual-${Date.now()}@teste.com`);
    const order = await createOrder(token);
    await Order.update({ status: 'entregue' }, { where: { id: order.id } });

    const adminEmail = `admin-confirma-${Date.now()}@teste.com`;
    await registerAndLogin(adminEmail);
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const adminLogin = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });

    const res = await request(app)
      .put(`/v1/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ status: 'pago' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pago');
  });

  it('admin reembolsa pedido entregue diretamente, sem passar por pago (devolução na hora da entrega)', async () => {
    const token = await registerAndLogin(`entrega-reembolso-${Date.now()}@teste.com`);
    const order = await createOrder(token);
    await Order.update({ status: 'entregue' }, { where: { id: order.id } });

    const adminEmail = `admin-entrega-reembolso-${Date.now()}@teste.com`;
    await registerAndLogin(adminEmail);
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const adminLogin = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });

    const res = await request(app)
      .put(`/v1/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ status: 'reembolsado' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reembolsado');
  });

  it('marca como enviado SEM código de rastreio quando o frete é combinado (Uber Flash/99/combinar não têm rastreio de verdade)', async () => {
    const token = await registerAndLogin(`enviado-sem-rastreio-${Date.now()}@teste.com`);
    const order = await createOrder(token); // usa shipping_option_id: 'uberflex' (requiresShippingArrangement: true)
    await Order.update({ status: 'em_separacao' }, { where: { id: order.id } });

    const adminEmail = `admin-sem-rastreio-${Date.now()}@teste.com`;
    await registerAndLogin(adminEmail);
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const adminLogin = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });

    const res = await request(app)
      .put(`/v1/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ status: 'enviado' }); // sem trackingCode nenhum

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('enviado');
  });

  it('continua exigindo código de rastreio pra marcar como enviado quando o frete tem rastreamento de verdade', async () => {
    const token = await registerAndLogin(`enviado-com-rastreio-${Date.now()}@teste.com`);
    const order = await createOrder(token);
    // Simula um frete com rastreamento real (ex.: Melhor Envio) — sem
    // depender de configurar a integração externa só pra este teste.
    await Order.update({ status: 'em_separacao', requiresShippingArrangement: false }, { where: { id: order.id } });

    const adminEmail = `admin-com-rastreio-${Date.now()}@teste.com`;
    await registerAndLogin(adminEmail);
    await User.update({ role: 'admin' }, { where: { email: adminEmail } });
    const adminLogin = await request(app).post('/v1/login').send({ email: adminEmail, password: 'senha1234' });

    const semRastreio = await request(app)
      .put(`/v1/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ status: 'enviado' });
    expect(semRastreio.status).toBe(400);

    const comRastreio = await request(app)
      .put(`/v1/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ status: 'enviado', trackingCode: 'BR123456789BR' });
    expect(comRastreio.status).toBe(200);
    expect(comRastreio.body.trackingCode).toBe('BR123456789BR');
  });
});
