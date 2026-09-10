const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Mock explícito (não automock) — email.service.js também é usado pelo
// fluxo de registro; sem resolver todas as funções, o automock quebra
// qualquer cadastro feito dentro deste arquivo de teste.
jest.mock('../services/email.service', () => ({
  sendEmailConfirmation: jest.fn().mockResolvedValue(),
  sendPasswordReset: jest.fn().mockResolvedValue(),
  sendOrderStatusUpdate: jest.fn().mockResolvedValue(),
  sendBackInStockNotification: jest.fn().mockResolvedValue(),
  sendAbandonedCartReminder: jest.fn().mockResolvedValue(),
}));
const emailService = require('../services/email.service');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, Cart, CartItem } = require('../models');
const { sendAbandonedCartReminders } = require('../jobs/abandonedCart');

async function registerAndLogin(email) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Carrinho', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

async function makeVariant() {
  const category = await Category.create({ name: 'Cat Carrinho', slug: `cat-carrinho-${uuidv4()}` });
  const product = await Product.create({ categoryId: category.id, name: 'Produto Carrinho', slug: `produto-carrinho-${uuidv4()}`, basePrice: 60, active: true });
  return ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-CARRINHO-${uuidv4()}`, stockQuantity: 10 });
}

// Reescreve o updated_at do cart_item direto no banco, simulando "isso foi
// adicionado há X horas" sem precisar esperar de verdade. Precisa ser via
// SQL bruto: o Sequelize gerencia updatedAt automaticamente e ignora (ou
// nem chega a rodar a query) um .update() que só contenha esse campo.
async function ageCartItem(token, hoursAgo) {
  const meRes = await request(app).get('/v1/account').set('Authorization', `Bearer ${token}`);
  const cart = await Cart.findOne({ where: { userId: meRes.body.id } });
  const when = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  await sequelize.query('UPDATE cart_items SET updated_at = :when WHERE cart_id = :cartId', {
    replacements: { when, cartId: cart.id },
  });
  return cart;
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(() => {
  emailService.sendAbandonedCartReminder.mockClear();
});

describe('Job de carrinho abandonado', () => {
  jest.setTimeout(30000); // banco de teste compartilhado acumula carrinhos de outros arquivos — a varredura pode demorar mais que os 5s padrão

  it('carrinho parado há mais de 24h recebe o lembrete', async () => {
    const variant = await makeVariant();
    const email = `abandonado-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 2 });
    const cart = await ageCartItem(token, 30);

    await sendAbandonedCartReminders();

    // O banco de teste é compartilhado entre todos os arquivos de teste (sem
    // limpeza global) — outros carrinhos "esquecidos" de testes anteriores
    // também são elegíveis e legitimamente recebem lembrete na mesma
    // varredura. O que importa verificar é que ESTE carrinho específico foi
    // notificado, não a contagem total de chamadas.
    const callForThisUser = emailService.sendAbandonedCartReminder.mock.calls.find((call) => call[0].email === email);
    expect(callForThisUser).toBeDefined();
    expect(callForThisUser[1][0].quantity).toBe(2);

    await cart.reload();
    expect(cart.abandonedEmailSentAt).not.toBeNull();
  });

  it('carrinho recente (menos de 24h) NÃO recebe lembrete ainda', async () => {
    const variant = await makeVariant();
    const token = await registerAndLogin(`recente-carrinho-${Date.now()}@teste.com`);
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
    await ageCartItem(token, 2); // só 2h atrás

    await sendAbandonedCartReminders();

    const emailedUsers = emailService.sendAbandonedCartReminder.mock.calls.map((call) => call[0].email);
    expect(emailedUsers.some((e) => e.includes('recente-carrinho-'))).toBe(false);
  });

  it('carrinho vazio nunca recebe lembrete', async () => {
    const token = await registerAndLogin(`carrinho-vazio-${Date.now()}@teste.com`);
    // Sem adicionar item nenhum — só loga pra criar a conta

    await sendAbandonedCartReminders();

    const emailedUsers = emailService.sendAbandonedCartReminder.mock.calls.map((call) => call[0].email);
    expect(emailedUsers.some((e) => e.includes('carrinho-vazio-'))).toBe(false);
  });

  it('não manda o lembrete de novo pro mesmo carrinho parado (já foi notificado, nada mudou)', async () => {
    const variant = await makeVariant();
    const email = `ja-notificado-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
    await ageCartItem(token, 30);

    await sendAbandonedCartReminders();
    const firstCall = emailService.sendAbandonedCartReminder.mock.calls.find((call) => call[0].email === email);
    expect(firstCall).toBeDefined();

    emailService.sendAbandonedCartReminder.mockClear();
    await sendAbandonedCartReminders(); // roda de novo, carrinho não mudou
    const secondCall = emailService.sendAbandonedCartReminder.mock.calls.find((call) => call[0].email === email);
    expect(secondCall).toBeUndefined();
  });

  it('volta a ficar elegível se o cliente mexer no carrinho de novo depois do lembrete', async () => {
    const variant = await makeVariant();
    const email = `mexeu-de-novo-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
    const cart = await ageCartItem(token, 30);

    await sendAbandonedCartReminders();
    expect(emailService.sendAbandonedCartReminder.mock.calls.some((call) => call[0].email === email)).toBe(true);

    // Empurra o "notificado em" pra 48h atrás — simula que o primeiro
    // lembrete foi enviado há dois dias, não agora mesmo (senão nenhuma
    // atividade posterior recente pareceria "depois" dele de verdade).
    await sequelize.query('UPDATE carts SET abandoned_email_sent_at = :when WHERE id = :cartId', {
      replacements: { when: new Date(Date.now() - 48 * 60 * 60 * 1000), cartId: cart.id },
    });

    // Cliente volta um dia depois do lembrete, mexe no carrinho de novo — e
    // esse toque também já ficou parado (mais de 24h), então volta a ser
    // elegível pro job mandar um novo lembrete.
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 3 });
    await ageCartItem(token, 25);

    emailService.sendAbandonedCartReminder.mockClear();
    await sendAbandonedCartReminders();
    expect(emailService.sendAbandonedCartReminder.mock.calls.some((call) => call[0].email === email)).toBe(true);
  });

  it('carrinho de quem já comprou nunca aparece (clearCart esvazia o carrinho na compra)', async () => {
    const variant = await makeVariant();
    const email = `ja-comprou-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
    await ageCartItem(token, 30);

    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Comprou', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({ address_id: addr.body.id, shipping_option_id: 'combinar', payment_method: 'pix' });

    await sendAbandonedCartReminders();

    expect(emailService.sendAbandonedCartReminder.mock.calls.some((call) => call[0].email === email)).toBe(false);
  });
});
