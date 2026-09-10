const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, User, Category, Product, ProductVariant } = require('../models');

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Aprimoramento', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
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

describe('Editar e excluir cupom', () => {
  it('admin edita um cupom já criado', async () => {
    const adminToken = await makeUser(`admin-cupom-edita-${Date.now()}@teste.com`, 'admin');
    const created = await request(app).post('/v1/admin/coupons').set('Authorization', `Bearer ${adminToken}`).send({
      code: `EDITA${Date.now()}`, discountType: 'percentage', discountValue: 10,
      validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app).put(`/v1/admin/coupons/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({
      discountValue: 20, minOrderValue: 100,
    });

    expect(res.status).toBe(200);
    expect(Number(res.body.discountValue)).toBe(20);
    expect(Number(res.body.minOrderValue)).toBe(100);
  });

  it('admin exclui um cupom', async () => {
    const adminToken = await makeUser(`admin-cupom-exclui-${Date.now()}@teste.com`, 'admin');
    const created = await request(app).post('/v1/admin/coupons').set('Authorization', `Bearer ${adminToken}`).send({
      code: `EXCLUI${Date.now()}`, discountType: 'fixed', discountValue: 15,
      validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app).delete(`/v1/admin/coupons/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/v1/admin/coupons').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.some((c) => c.id === created.body.id)).toBe(false);
  });

  it('operador não pode editar nem excluir cupom', async () => {
    const adminToken = await makeUser(`admin-cupom-op-${Date.now()}@teste.com`, 'admin');
    const opToken = await makeUser(`operador-cupom-${Date.now()}@teste.com`, 'operator');
    const created = await request(app).post('/v1/admin/coupons').set('Authorization', `Bearer ${adminToken}`).send({
      code: `OPTESTE${Date.now()}`, discountType: 'fixed', discountValue: 5,
      validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const editRes = await request(app).put(`/v1/admin/coupons/${created.body.id}`).set('Authorization', `Bearer ${opToken}`).send({ discountValue: 99 });
    expect(editRes.status).toBe(403);

    const delRes = await request(app).delete(`/v1/admin/coupons/${created.body.id}`).set('Authorization', `Bearer ${opToken}`);
    expect(delRes.status).toBe(403);
  });
});

describe('Gestão de categorias', () => {
  it('admin cria, edita e lista categoria com contagem de produtos', async () => {
    const adminToken = await makeUser(`admin-categoria-${Date.now()}@teste.com`, 'admin');

    const created = await request(app).post('/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`).send({
      name: `Categoria Teste ${Date.now()}`, description: 'Uma categoria de teste',
    });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBeDefined();

    const updated = await request(app).put(`/v1/admin/categories/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({
      description: 'Descrição atualizada',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.description).toBe('Descrição atualizada');

    const list = await request(app).get('/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`);
    const found = list.body.find((c) => c.id === created.body.id);
    expect(found).toBeDefined();
    expect(found.productCount).toBe(0);
  });

  it('rejeita categoria duplicada (mesmo nome/slug)', async () => {
    const adminToken = await makeUser(`admin-categoria-dup-${Date.now()}@teste.com`, 'admin');
    const name = `Categoria Duplicada ${Date.now()}`;

    await request(app).post('/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`).send({ name });
    const second = await request(app).post('/v1/admin/categories').set('Authorization', `Bearer ${adminToken}`).send({ name });

    expect(second.status).toBe(409);
  });

  it('não permite excluir categoria com produtos cadastrados', async () => {
    const adminToken = await makeUser(`admin-categoria-produtos-${Date.now()}@teste.com`, 'admin');
    const category = await Category.create({ name: 'Categoria Com Produto', slug: `categoria-com-produto-${uuidv4()}` });
    await Product.create({ categoryId: category.id, name: 'Produto Vinculado', slug: `produto-vinculado-${uuidv4()}`, basePrice: 50, active: true });

    const res = await request(app).delete(`/v1/admin/categories/${category.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('category_has_products');
  });

  it('exclui categoria vazia normalmente', async () => {
    const adminToken = await makeUser(`admin-categoria-vazia-${Date.now()}@teste.com`, 'admin');
    const category = await Category.create({ name: 'Categoria Vazia', slug: `categoria-vazia-${uuidv4()}` });

    const res = await request(app).delete(`/v1/admin/categories/${category.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });
});

describe('Busca de pedidos no painel', () => {
  it('encontra pedido pelo número', async () => {
    const category = await Category.create({ name: 'Cat Busca Pedido', slug: `cat-busca-pedido-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Busca', slug: `produto-busca-${uuidv4()}`, basePrice: 60, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-BUSCA-${uuidv4()}`, stockQuantity: 10 });

    const clientToken = await makeUser(`cliente-busca-pedido-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${clientToken}`).send({
      street: 'Rua Busca', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${clientToken}`).send({ variant_id: variant.id, quantity: 1 });
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${clientToken}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar', payment_method: 'pix',
    });

    const adminToken = await makeUser(`admin-busca-pedido-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).get('/v1/admin/orders').set('Authorization', `Bearer ${adminToken}`).query({ search: order.body.orderNumber });

    expect(res.status).toBe(200);
    expect(res.body.data.some((o) => o.id === order.body.id)).toBe(true);
  });

  it('encontra pedido pelo nome do cliente', async () => {
    const category = await Category.create({ name: 'Cat Busca Cliente', slug: `cat-busca-cliente-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Busca Cliente', slug: `produto-busca-cliente-${uuidv4()}`, basePrice: 60, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-BUSCACLI-${uuidv4()}`, stockQuantity: 10 });

    const uniqueName = `ClienteBuscavel${Date.now()}`;
    const email = `${uniqueName.toLowerCase()}@teste.com`;
    await request(app).post('/v1/register').send({
      name: uniqueName, email, password: 'senha1234', cpf: `${Date.now()}`.slice(0, 11), phone: '85999999999',
    });
    const clientLogin = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    const clientToken = clientLogin.body.access_token;

    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${clientToken}`).send({
      street: 'Rua Busca Cliente', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${clientToken}`).send({ variant_id: variant.id, quantity: 1 });
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${clientToken}`).send({
      address_id: addr.body.id, shipping_option_id: 'combinar', payment_method: 'pix',
    });

    const adminToken = await makeUser(`admin-busca-nome-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).get('/v1/admin/orders').set('Authorization', `Bearer ${adminToken}`).query({ search: uniqueName });

    expect(res.status).toBe(200);
    expect(res.body.data.some((o) => o.id === order.body.id)).toBe(true);
  });

  it('busca sem resultado retorna lista vazia, não erro', async () => {
    const adminToken = await makeUser(`admin-busca-vazia-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).get('/v1/admin/orders').set('Authorization', `Bearer ${adminToken}`).query({ search: 'NaoExisteNaBase999888777' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
