const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, Order } = require('../models');

let variantId;
let productId;

async function registerAndLogin(email) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Avaliação', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  const res = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return res.body.access_token;
}

async function createDeliveredOrder(token) {
  const address = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
    street: 'Rua Review', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
  });
  await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variantId, quantity: 1 });
  const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
    address_id: address.body.id, shipping_option_id: 'uberflex', payment_method: 'pix',
  });
  await Order.update({ status: 'entregue' }, { where: { id: order.body.id } });
  return order.body;
}

beforeAll(async () => {
  await sequelize.authenticate();
  const category = await Category.create({ name: 'Categoria Review', slug: `categoria-review-${uuidv4()}` });
  const product = await Product.create({ categoryId: category.id, name: 'Produto Review', slug: `produto-review-${uuidv4()}`, basePrice: 80, active: true });
  const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-REVIEW-${uuidv4()}`, stockQuantity: 20 });
  productId = product.id;
  variantId = variant.id;
});

afterAll(async () => {
  await sequelize.close();
});

describe('Avaliações de produto (RF-37)', () => {
  it('cliente com pedido entregue consegue avaliar (regressão: bug de subquery do Sequelize)', async () => {
    const token = await registerAndLogin(`avaliador-${Date.now()}@teste.com`);
    await createDeliveredOrder(token);

    const res = await request(app)
      .post(`/v1/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Excelente produto' });

    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
  });

  it('cliente sem pedido entregue do produto não consegue avaliar', async () => {
    const token = await registerAndLogin(`sem-pedido-${Date.now()}@teste.com`);

    const res = await request(app)
      .post(`/v1/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Nunca comprei isso' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('purchase_not_delivered');
  });

  it('não permite avaliar o mesmo produto duas vezes', async () => {
    const token = await registerAndLogin(`duplicado-${Date.now()}@teste.com`);
    await createDeliveredOrder(token);

    await request(app).post(`/v1/products/${productId}/reviews`).set('Authorization', `Bearer ${token}`).send({ rating: 4 });
    const second = await request(app).post(`/v1/products/${productId}/reviews`).set('Authorization', `Bearer ${token}`).send({ rating: 2 });

    expect(second.status).toBe(409);
  });

  it('rejeita nota fora do intervalo 1-5', async () => {
    const token = await registerAndLogin(`nota-invalida-${Date.now()}@teste.com`);
    await createDeliveredOrder(token);

    const res = await request(app).post(`/v1/products/${productId}/reviews`).set('Authorization', `Bearer ${token}`).send({ rating: 7 });
    expect(res.status).toBe(400);
  });

  it('a listagem pública de produtos retorna média e contagem de avaliações', async () => {
    const bySlug = await Product.findByPk(productId);
    const publicDetail = await request(app).get(`/v1/products/${bySlug.slug}`);
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body.reviewCount).toBeGreaterThanOrEqual(2);
    expect(publicDetail.body.avgRating).not.toBeNull();
  });

  it('GET /products/:id/reviews lista as avaliações com nome do autor', async () => {
    const res = await request(app).get(`/v1/products/${productId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].user).toHaveProperty('name');
  });
});
