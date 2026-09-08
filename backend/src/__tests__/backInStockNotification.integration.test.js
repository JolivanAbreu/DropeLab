const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, User, Category, Product, ProductVariant } = require('../models');

// Mock explícito (não automock) — email.service.js também é usado pelo
// fluxo de registro (confirmação de cadastro) e por outros fluxos que
// fazem .catch() na promise retornada; sem resolver todas as funções, o
// automock quebra QUALQUER cadastro feito dentro deste arquivo de teste
// (a promise vem undefined, e .catch() de undefined explode).
jest.mock('../services/email.service', () => ({
  sendEmailConfirmation: jest.fn().mockResolvedValue(),
  sendPasswordReset: jest.fn().mockResolvedValue(),
  sendOrderStatusUpdate: jest.fn().mockResolvedValue(),
  sendBackInStockNotification: jest.fn().mockResolvedValue(),
}));
const emailService = require('../services/email.service');

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Estoque', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  if (role) await User.update({ role }, { where: { email } });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(() => {
  emailService.sendBackInStockNotification.mockClear();
  emailService.sendBackInStockNotification.mockResolvedValue();
});

describe('Aviso de "voltou ao estoque"', () => {
  it('avisa quem favoritou quando um produto totalmente esgotado recebe estoque de novo', async () => {
    const category = await Category.create({ name: 'Cat Estoque', slug: `cat-estoque-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Esgotado', slug: `produto-esgotado-${uuidv4()}`, basePrice: 80, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-ESGOTADO-${uuidv4()}`, stockQuantity: 0 });

    const clientToken = await makeUser(`cliente-favoritou-${Date.now()}@teste.com`);
    await request(app).post('/v1/wishlist').set('Authorization', `Bearer ${clientToken}`).send({ product_id: product.id });

    const adminToken = await makeUser(`admin-estoque-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).put(`/v1/admin/variants/${variant.id}/stock`).set('Authorization', `Bearer ${adminToken}`).send({ delta: 10, reason: 'reposição' });

    expect(res.status).toBe(200);
    // O envio é best-effort/assíncrono (não bloqueia a resposta) — espera um instante
    await new Promise((r) => setTimeout(r, 50));

    expect(emailService.sendBackInStockNotification).toHaveBeenCalledTimes(1);
    const [notifiedUser, notifiedProduct] = emailService.sendBackInStockNotification.mock.calls[0];
    expect(notifiedUser.email).toContain('cliente-favoritou');
    expect(notifiedProduct.id).toBe(product.id);
  });

  it('NÃO avisa quando o produto já tinha estoque em outra variação (não estava totalmente esgotado)', async () => {
    const category = await Category.create({ name: 'Cat Estoque Parcial', slug: `cat-estoque-parcial-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Parcial', slug: `produto-parcial-${uuidv4()}`, basePrice: 80, active: true });
    const variantZerada = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-PARCIAL-M-${uuidv4()}`, stockQuantity: 0 });
    await ProductVariant.create({ productId: product.id, size: 'G', color: 'Preto', sku: `SKU-PARCIAL-G-${uuidv4()}`, stockQuantity: 5 });

    const clientToken = await makeUser(`cliente-parcial-${Date.now()}@teste.com`);
    await request(app).post('/v1/wishlist').set('Authorization', `Bearer ${clientToken}`).send({ product_id: product.id });

    const adminToken = await makeUser(`admin-estoque-parcial-${Date.now()}@teste.com`, 'admin');
    await request(app).put(`/v1/admin/variants/${variantZerada.id}/stock`).set('Authorization', `Bearer ${adminToken}`).send({ delta: 3, reason: 'reposição' });

    await new Promise((r) => setTimeout(r, 50));
    expect(emailService.sendBackInStockNotification).not.toHaveBeenCalled();
  });

  it('NÃO avisa em ajuste de baixa (delta negativo)', async () => {
    const category = await Category.create({ name: 'Cat Baixa', slug: `cat-baixa-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Baixa', slug: `produto-baixa-${uuidv4()}`, basePrice: 80, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-BAIXA-${uuidv4()}`, stockQuantity: 10 });

    const clientToken = await makeUser(`cliente-baixa-${Date.now()}@teste.com`);
    await request(app).post('/v1/wishlist').set('Authorization', `Bearer ${clientToken}`).send({ product_id: product.id });

    const adminToken = await makeUser(`admin-baixa-${Date.now()}@teste.com`, 'admin');
    await request(app).put(`/v1/admin/variants/${variant.id}/stock`).set('Authorization', `Bearer ${adminToken}`).send({ delta: -3, reason: 'avaria' });

    await new Promise((r) => setTimeout(r, 50));
    expect(emailService.sendBackInStockNotification).not.toHaveBeenCalled();
  });

  it('sem ninguém tendo favoritado, não chama o e-mail (mas o ajuste funciona normalmente)', async () => {
    const category = await Category.create({ name: 'Cat Sem Favorito', slug: `cat-sem-favorito-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Sem Favorito', slug: `produto-sem-favorito-${uuidv4()}`, basePrice: 80, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-SEMFAV-${uuidv4()}`, stockQuantity: 0 });

    const adminToken = await makeUser(`admin-sem-favorito-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).put(`/v1/admin/variants/${variant.id}/stock`).set('Authorization', `Bearer ${adminToken}`).send({ delta: 5, reason: 'reposição' });

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(emailService.sendBackInStockNotification).not.toHaveBeenCalled();
  });

  it('avisa vários clientes que favoritaram o mesmo produto', async () => {
    const category = await Category.create({ name: 'Cat Vários', slug: `cat-varios-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Popular', slug: `produto-popular-${uuidv4()}`, basePrice: 80, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-POPULAR-${uuidv4()}`, stockQuantity: 0 });

    const token1 = await makeUser(`fan1-${Date.now()}@teste.com`);
    const token2 = await makeUser(`fan2-${Date.now()}@teste.com`);
    await request(app).post('/v1/wishlist').set('Authorization', `Bearer ${token1}`).send({ product_id: product.id });
    await request(app).post('/v1/wishlist').set('Authorization', `Bearer ${token2}`).send({ product_id: product.id });

    const adminToken = await makeUser(`admin-varios-${Date.now()}@teste.com`, 'admin');
    await request(app).put(`/v1/admin/variants/${variant.id}/stock`).set('Authorization', `Bearer ${adminToken}`).send({ delta: 8, reason: 'reposição' });

    await new Promise((r) => setTimeout(r, 50));
    expect(emailService.sendBackInStockNotification).toHaveBeenCalledTimes(2);
  });
});
