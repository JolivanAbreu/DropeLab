const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, User, Category, Product } = require('../models');

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Ações em Massa', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  if (role) await User.update({ role }, { where: { email } });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

async function makeProducts(count, basePrice = 100) {
  const category = await Category.create({ name: `Cat Massa ${uuidv4()}`, slug: `cat-massa-${uuidv4()}` });
  const products = [];
  for (let i = 0; i < count; i += 1) {
    products.push(await Product.create({
      categoryId: category.id, name: `Produto Massa ${i}-${uuidv4()}`, slug: `produto-massa-${i}-${uuidv4()}`,
      basePrice, active: true,
    }));
  }
  return products;
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Ações em massa — ativar/desativar produtos', () => {
  it('desativa vários produtos de uma vez', async () => {
    const [p1, p2, p3] = await makeProducts(3);
    const adminToken = await makeUser(`admin-massa-desativar-${Date.now()}@teste.com`, 'admin');

    const res = await request(app).post('/v1/admin/products/bulk-active').set('Authorization', `Bearer ${adminToken}`).send({
      ids: [p1.id, p2.id, p3.id], active: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.requested).toBe(3);
    expect(res.body.updated).toBe(3);

    await p1.reload(); await p2.reload(); await p3.reload();
    expect(p1.active).toBe(false);
    expect(p2.active).toBe(false);
    expect(p3.active).toBe(false);
  });

  it('reativa vários produtos de uma vez', async () => {
    const [p1, p2] = await makeProducts(2);
    await Product.update({ active: false }, { where: { id: [p1.id, p2.id] } });
    const adminToken = await makeUser(`admin-massa-reativar-${Date.now()}@teste.com`, 'admin');

    const res = await request(app).post('/v1/admin/products/bulk-active').set('Authorization', `Bearer ${adminToken}`).send({
      ids: [p1.id, p2.id], active: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    await p1.reload();
    expect(p1.active).toBe(true);
  });

  it('não afeta produtos fora da lista de ids selecionados', async () => {
    const [selecionado, naoSelecionado] = await makeProducts(2);
    const adminToken = await makeUser(`admin-massa-parcial-${Date.now()}@teste.com`, 'admin');

    await request(app).post('/v1/admin/products/bulk-active').set('Authorization', `Bearer ${adminToken}`).send({
      ids: [selecionado.id], active: false,
    });

    await selecionado.reload(); await naoSelecionado.reload();
    expect(selecionado.active).toBe(false);
    expect(naoSelecionado.active).toBe(true);
  });

  it('rejeita lista de ids vazia', async () => {
    const adminToken = await makeUser(`admin-massa-vazio-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).post('/v1/admin/products/bulk-active').set('Authorization', `Bearer ${adminToken}`).send({ ids: [], active: false });
    expect(res.status).toBe(400);
  });

  it('operador não pode usar ações em massa (só admin)', async () => {
    const [p1] = await makeProducts(1);
    const opToken = await makeUser(`operador-massa-${Date.now()}@teste.com`, 'operator');
    const res = await request(app).post('/v1/admin/products/bulk-active').set('Authorization', `Bearer ${opToken}`).send({ ids: [p1.id], active: false });
    expect(res.status).toBe(403);
  });
});

describe('Ações em massa — reajuste de preço', () => {
  it('aumenta o preço de vários produtos em X%', async () => {
    const [p1, p2] = await makeProducts(2, 100);
    const adminToken = await makeUser(`admin-preco-aumento-${Date.now()}@teste.com`, 'admin');

    const res = await request(app).post('/v1/admin/products/bulk-price').set('Authorization', `Bearer ${adminToken}`).send({
      ids: [p1.id, p2.id], percentage: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    await p1.reload(); await p2.reload();
    expect(Number(p1.basePrice)).toBe(110);
    expect(Number(p2.basePrice)).toBe(110);
  });

  it('reduz o preço de vários produtos em X%', async () => {
    const [p1] = await makeProducts(1, 200);
    const adminToken = await makeUser(`admin-preco-reducao-${Date.now()}@teste.com`, 'admin');

    await request(app).post('/v1/admin/products/bulk-price').set('Authorization', `Bearer ${adminToken}`).send({
      ids: [p1.id], percentage: -25,
    });

    await p1.reload();
    expect(Number(p1.basePrice)).toBe(150);
  });

  it('rejeita percentual de redução de -100% ou menor (preço zeraria ou ficaria negativo)', async () => {
    const [p1] = await makeProducts(1, 100);
    const adminToken = await makeUser(`admin-preco-invalido-${Date.now()}@teste.com`, 'admin');

    const res = await request(app).post('/v1/admin/products/bulk-price').set('Authorization', `Bearer ${adminToken}`).send({
      ids: [p1.id], percentage: -100,
    });

    expect(res.status).toBe(400);
    await p1.reload();
    expect(Number(p1.basePrice)).toBe(100); // não mudou
  });

  it('rejeita percentual que não é número', async () => {
    const [p1] = await makeProducts(1);
    const adminToken = await makeUser(`admin-preco-nan-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).post('/v1/admin/products/bulk-price').set('Authorization', `Bearer ${adminToken}`).send({
      ids: [p1.id], percentage: 'abacate',
    });
    expect(res.status).toBe(400);
  });
});
