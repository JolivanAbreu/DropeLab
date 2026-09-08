const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, User, Category, Product, ProductVariant, ProductImage, Review, Wishlist } = require('../models');

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Exclusão', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  if (role) await User.update({ role }, { where: { email } });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return { token: login.body.access_token, userId: login.body.user.id };
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Exclusão definitiva de produto', () => {
  it('exclui de verdade um produto que nunca foi vendido', async () => {
    const category = await Category.create({ name: 'Cat Exclusão', slug: `cat-exclusao-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Nunca Vendido', slug: `produto-nunca-vendido-${uuidv4()}`, basePrice: 90, active: true });
    await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-NUNCA-${uuidv4()}`, stockQuantity: 5 });

    const { token: adminToken } = await makeUser(`admin-exclusao-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).delete(`/v1/admin/products/${product.id}/permanently`).set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    const stillExists = await Product.findByPk(product.id);
    expect(stillExists).toBeNull();
  });

  it('remove em cascata variações, imagens, avaliações e favoritos', async () => {
    const category = await Category.create({ name: 'Cat Cascata', slug: `cat-cascata-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Cascata', slug: `produto-cascata-${uuidv4()}`, basePrice: 90, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-CASCATA-${uuidv4()}`, stockQuantity: 5 });
    const image = await ProductImage.create({ productId: product.id, url: 'http://exemplo.com/foto.jpg', order: 0 });

    const { token: clientToken, userId } = await makeUser(`cliente-cascata-${Date.now()}@teste.com`);
    await request(app).post('/v1/wishlist').set('Authorization', `Bearer ${clientToken}`).send({ product_id: product.id });
    const review = await Review.create({ productId: product.id, userId, rating: 5, comment: 'Ótimo' });

    const { token: adminToken } = await makeUser(`admin-cascata-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).delete(`/v1/admin/products/${product.id}/permanently`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    expect(await ProductVariant.findByPk(variant.id)).toBeNull();
    expect(await ProductImage.findByPk(image.id)).toBeNull();
    expect(await Review.findByPk(review.id)).toBeNull();
    const wishlistLeft = await Wishlist.count({ where: { productId: product.id } });
    expect(wishlistLeft).toBe(0);
  });

  it('bloqueia a exclusão de um produto que já foi vendido, orientando a desativar', async () => {
    const category = await Category.create({ name: 'Cat Vendido', slug: `cat-vendido-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Vendido', slug: `produto-vendido-${uuidv4()}`, basePrice: 90, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-VENDIDO-${uuidv4()}`, stockQuantity: 10 });

    const { token: clientToken } = await makeUser(`cliente-vendido-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${clientToken}`).send({
      street: 'Rua Vendido', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${clientToken}`).send({ variant_id: variant.id, quantity: 1 });
    await request(app).post('/v1/orders').set('Authorization', `Bearer ${clientToken}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar',
    });

    const { token: adminToken } = await makeUser(`admin-vendido-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).delete(`/v1/admin/products/${product.id}/permanently`).set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('product_has_orders');

    // Continua existindo, intacto
    const stillExists = await Product.findByPk(product.id);
    expect(stillExists).not.toBeNull();
  });

  it('operador não pode excluir definitivamente (só admin)', async () => {
    const category = await Category.create({ name: 'Cat Operador', slug: `cat-operador-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Operador', slug: `produto-operador-${uuidv4()}`, basePrice: 90, active: true });

    const { token: opToken } = await makeUser(`operador-exclusao-${Date.now()}@teste.com`, 'operator');
    const res = await request(app).delete(`/v1/admin/products/${product.id}/permanently`).set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });

  it('404 ao tentar excluir um produto que não existe', async () => {
    const { token: adminToken } = await makeUser(`admin-inexistente-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).delete(`/v1/admin/products/${uuidv4()}/permanently`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
