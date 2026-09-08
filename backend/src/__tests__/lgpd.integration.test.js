const request = require('supertest');

const app = require('../app');
const { sequelize, User, Category, Product, ProductVariant, Review } = require('../models');

async function registerAndLogin(email, password = 'senha1234') {
  await request(app).post('/v1/register').send({
    name: 'Cliente LGPD', email, password, cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  const login = await request(app).post('/v1/login').send({ email, password });
  return { token: login.body.access_token, userId: login.body.user.id };
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Exportação de dados pessoais (LGPD)', () => {
  it('exporta o perfil, endereços e pedidos do próprio cliente', async () => {
    const email = `export-${Date.now()}@teste.com`;
    const { token } = await registerAndLogin(email);

    await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Exportação', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });

    const res = await request(app).get('/v1/account/export').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.email).toBe(email);
    expect(res.body.addresses).toHaveLength(1);
    expect(res.body.addresses[0].street).toBe('Rua Exportação');
    expect(res.body.orders).toEqual([]);
    expect(res.body.exportedAt).toBeDefined();
  });

  it('não retorna hash de senha nem dados de outro cliente', async () => {
    const { token } = await registerAndLogin(`export-seguro-${Date.now()}@teste.com`);
    const res = await request(app).get('/v1/account/export').set('Authorization', `Bearer ${token}`);

    expect(res.body.profile.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('exige login — visitante não consegue exportar', async () => {
    const res = await request(app).get('/v1/account/export');
    expect(res.status).toBe(401);
  });
});

describe('Autoexclusão de conta (LGPD)', () => {
  it('exige a senha atual pra excluir', async () => {
    const { token } = await registerAndLogin(`excluir-sem-senha-${Date.now()}@teste.com`);
    const res = await request(app).delete('/v1/account').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('rejeita senha incorreta', async () => {
    const { token } = await registerAndLogin(`excluir-senha-errada-${Date.now()}@teste.com`);
    const res = await request(app).delete('/v1/account').set('Authorization', `Bearer ${token}`).send({ current_password: 'senhaerrada' });
    expect(res.status).toBe(401);
  });

  it('anonimiza os dados pessoais, mas não apaga a linha do usuário', async () => {
    const email = `excluir-${Date.now()}@teste.com`;
    const { token, userId } = await registerAndLogin(email);

    const res = await request(app).delete('/v1/account').set('Authorization', `Bearer ${token}`).send({ current_password: 'senha1234' });
    expect(res.status).toBe(200);

    const userRow = await User.unscoped().findByPk(userId);
    expect(userRow).not.toBeNull();
    expect(userRow.name).toBe('Usuário excluído');
    expect(userRow.email).not.toBe(email);
    expect(userRow.cpf).toBeNull();
    expect(userRow.phone).toBeNull();
    expect(userRow.deletedAt).not.toBeNull();
  });

  it('depois de excluída, a conta não consegue mais logar com o e-mail original', async () => {
    const email = `excluir-login-${Date.now()}@teste.com`;
    const { token } = await registerAndLogin(email);
    await request(app).delete('/v1/account').set('Authorization', `Bearer ${token}`).send({ current_password: 'senha1234' });

    const loginRes = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    expect(loginRes.status).toBe(401);
  });

  it('o access token já emitido para de funcionar imediatamente após a exclusão', async () => {
    const { token } = await registerAndLogin(`excluir-token-${Date.now()}@teste.com`);
    await request(app).delete('/v1/account').set('Authorization', `Bearer ${token}`).send({ current_password: 'senha1234' });

    const res = await request(app).get('/v1/account').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('account_deleted');
  });

  it('remove endereços e favoritos, mas preserva pedidos e avaliações (retenção legal)', async () => {
    const category = await Category.create({ name: 'Cat LGPD', slug: `cat-lgpd-${Date.now()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto LGPD', slug: `produto-lgpd-${Date.now()}`, basePrice: 50, active: true });
    await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-LGPD-${Date.now()}`, stockQuantity: 10 });

    const email = `excluir-com-pedido-${Date.now()}@teste.com`;
    const { token, userId } = await registerAndLogin(email);

    await request(app).post('/v1/addresses').set('Authorization', `Bearer ${token}`).send({
      street: 'Rua Antes de Excluir', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/wishlist').set('Authorization', `Bearer ${token}`).send({ product_id: product.id });

    const review = await Review.create({ productId: product.id, userId, rating: 5, comment: 'Ótimo produto' });

    await request(app).delete('/v1/account').set('Authorization', `Bearer ${token}`).send({ current_password: 'senha1234' });

    const addressesLeft = await sequelize.models.Address.count({ where: { userId } });
    const wishlistLeft = await sequelize.models.Wishlist.count({ where: { userId } });
    expect(addressesLeft).toBe(0);
    expect(wishlistLeft).toBe(0);

    const reviewStillExists = await Review.findByPk(review.id);
    expect(reviewStillExists).not.toBeNull();
  });
});
