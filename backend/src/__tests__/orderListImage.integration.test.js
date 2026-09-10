const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, Category, Product, ProductVariant, ProductImage } = require('../models');

async function registerAndLogin(email) {
  await request(app).post('/v1/register').send({
    name: 'Cliente Imagem Pedido', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
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

describe('GET /orders — imagem do produto na listagem (tela "Meus Pedidos")', () => {
  it('retorna a foto do produto junto de cada item, não só o nome', async () => {
    const category = await Category.create({ name: 'Cat Imagem Pedido', slug: `cat-imagem-pedido-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Homem-Aranha Miles Morales', slug: `homem-aranha-${uuidv4()}`, basePrice: 55, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Branca', sku: `SKU-IMAGEM-${uuidv4()}`, stockQuantity: 10 });
    await ProductImage.create({ productId: product.id, url: 'http://exemplo.com/homem-aranha.jpg', order: 0 });

    const token = await registerAndLogin(`cliente-imagem-pedido-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Imagem', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
    await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar', payment_method: 'pix',
    });

    const res = await request(app).get('/v1/orders').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const item = res.body[0].items[0];
    expect(item.variant.product.name).toBe('Homem-Aranha Miles Morales');
    expect(item.variant.product.images).toBeDefined();
    expect(item.variant.product.images.length).toBeGreaterThan(0);
    expect(item.variant.product.images[0].url).toBe('http://exemplo.com/homem-aranha.jpg');
  });

  it('produto sem foto cadastrada retorna array de imagens vazio (não quebra)', async () => {
    const category = await Category.create({ name: 'Cat Sem Foto', slug: `cat-sem-foto-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Sem Foto', slug: `produto-sem-foto-${uuidv4()}`, basePrice: 40, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-SEMFOTO-${uuidv4()}`, stockQuantity: 5 });

    const token = await registerAndLogin(`cliente-sem-foto-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Sem Foto', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ variant_id: variant.id, quantity: 1 });
    await request(app).post('/v1/orders').set('Authorization', `Bearer ${token}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar', payment_method: 'pix',
    });

    const res = await request(app).get('/v1/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].items[0].variant.product.images).toEqual([]);
  });
});
