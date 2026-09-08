const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, User, Category } = require('../models');

let adminToken;
let operatorToken;
let categoryId;

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Admin Teste', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 100)}`.slice(0, 11), phone: '85999999999',
  });
  await User.update({ role }, { where: { email } });
  const login = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
  return login.body.access_token;
}

beforeAll(async () => {
  await sequelize.authenticate();
  adminToken = await makeUser(`admin-${Date.now()}@teste.com`, 'admin');
  operatorToken = await makeUser(`operador-${Date.now()}@teste.com`, 'operator');
  const category = await Category.create({ name: 'Categoria Admin Teste', slug: `categoria-admin-${uuidv4()}` });
  categoryId = category.id;
});

afterAll(async () => {
  await sequelize.close();
});

describe('CRUD administrativo de produtos', () => {
  it('admin cria produto com variações e imagens', async () => {
    const res = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId,
      name: 'Produto Admin Teste',
      slug: `produto-admin-teste-${uuidv4()}`,
      basePrice: 79.9,
      variants: [{ size: 'M', color: 'Preto', sku: `SKU-ADM-${uuidv4()}`, stockQuantity: 10 }],
      images: [{ url: 'https://exemplo.com/img1.jpg', order: 0 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.variants).toHaveLength(1);
    expect(res.body.images).toHaveLength(1);
  });

  it('cria produto já com featuredSlot, badgeLabel e imageFocalPoint definidos (antes só dava pra setar isso num update separado)', async () => {
    const res = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId,
      name: 'Produto Destaque na Criação',
      slug: `produto-destaque-criacao-${uuidv4()}`,
      basePrice: 99.9,
      featuredSlot: 'destaque',
      badgeLabel: 'NOVO',
      imageFocalPoint: 'top',
      variants: [{ size: 'M', color: 'Preto', sku: `SKU-DEST-${uuidv4()}`, stockQuantity: 5 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.featuredSlot).toBe('destaque');
    expect(res.body.badgeLabel).toBe('NOVO');
    expect(res.body.imageFocalPoint).toBe('top');
  });

  it('produto novo tem imageFocalPoint "center" por padrão quando não informado', async () => {
    const res = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId, name: 'Produto Sem Enquadramento', slug: `produto-sem-enquadramento-${uuidv4()}`, basePrice: 60,
    });
    expect(res.status).toBe(201);
    expect(res.body.imageFocalPoint).toBe('center');
  });

  it('admin edita o enquadramento da imagem de um produto existente', async () => {
    const created = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId, name: 'Produto Editar Enquadramento', slug: `produto-editar-enquadramento-${uuidv4()}`, basePrice: 60,
    });

    const updated = await request(app).put(`/v1/admin/products/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({
      imageFocalPoint: 'bottom',
    });

    expect(updated.status).toBe(200);
    expect(updated.body.imageFocalPoint).toBe('bottom');
  });

  it('operador não pode criar produto (403)', async () => {
    const res = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${operatorToken}`).send({
      categoryId, name: 'X', slug: `x-${uuidv4()}`, basePrice: 10,
    });
    expect(res.status).toBe(403);
  });

  it('operador consegue listar produtos (leitura liberada)', async () => {
    const res = await request(app).get('/v1/admin/products').set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('lista de produtos do admin inclui produtos inativos (diferente da loja pública)', async () => {
    const created = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId, name: 'Produto Inativo Teste', slug: `produto-inativo-${uuidv4()}`, basePrice: 50, active: false,
    });

    const publicList = await request(app).get(`/v1/products?category=${(await Category.findByPk(categoryId)).slug}`);
    expect(publicList.body.data.some((p) => p.id === created.body.id)).toBe(false);

    const adminList = await request(app).get('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).query({ search: 'Produto Inativo Teste' });
    expect(adminList.body.data.some((p) => p.id === created.body.id)).toBe(true);
  });

  it('atualiza campos do produto e adiciona nova variação sem apagar a existente', async () => {
    const created = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId,
      name: 'Produto Editável',
      slug: `produto-editavel-${uuidv4()}`,
      basePrice: 60,
      variants: [{ size: 'M', color: 'Azul', sku: `SKU-EDIT-M-${uuidv4()}`, stockQuantity: 5 }],
    });
    const existingVariantId = created.body.variants[0].id;

    const updated = await request(app).put(`/v1/admin/products/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({
      name: 'Produto Editável (Atualizado)',
      variants: [
        { id: existingVariantId, size: 'M', color: 'Azul', sku: created.body.variants[0].sku, stockQuantity: 8 },
        { size: 'G', color: 'Azul', sku: `SKU-EDIT-G-${uuidv4()}`, stockQuantity: 3 },
      ],
    });

    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Produto Editável (Atualizado)');
    expect(updated.body.variants).toHaveLength(2);
    const editedVariant = updated.body.variants.find((v) => v.id === existingVariantId);
    expect(editedVariant.stockQuantity).toBe(8);
  });

  it('desativa e reativa um produto', async () => {
    const created = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId, name: 'Produto Toggle', slug: `produto-toggle-${uuidv4()}`, basePrice: 40,
    });

    const deactivated = await request(app).delete(`/v1/admin/products/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(deactivated.status).toBe(204);

    const reactivated = await request(app).put(`/v1/admin/products/${created.body.id}/reactivate`).set('Authorization', `Bearer ${adminToken}`);
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.active).toBe(true);
  });

  it('operador ajusta estoque de uma variação', async () => {
    const created = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId,
      name: 'Produto Estoque',
      slug: `produto-estoque-${uuidv4()}`,
      basePrice: 45,
      variants: [{ size: 'GG', color: 'Verde', sku: `SKU-ESTOQUE-${uuidv4()}`, stockQuantity: 10 }],
    });
    const variantId = created.body.variants[0].id;

    const res = await request(app).put(`/v1/admin/variants/${variantId}/stock`).set('Authorization', `Bearer ${operatorToken}`).send({
      delta: -3, reason: 'avaria',
    });
    expect(res.status).toBe(200);
    expect(res.body.stockQuantity).toBe(7);
  });

  it('salva peso e dimensões da variação na criação do produto', async () => {
    const created = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId,
      name: 'Produto com Dimensões',
      slug: `produto-dimensoes-${uuidv4()}`,
      basePrice: 70,
      variants: [{ size: 'M', color: 'Azul', sku: `SKU-DIM-${uuidv4()}`, stockQuantity: 5, weightKg: 0.4, heightCm: 6, widthCm: 24, lengthCm: 19 }],
    });
    expect(created.status).toBe(201);
    const variant = created.body.variants[0];
    expect(Number(variant.weightKg)).toBe(0.4);
    expect(Number(variant.heightCm)).toBe(6);
    expect(Number(variant.widthCm)).toBe(24);
    expect(Number(variant.lengthCm)).toBe(19);
  });

  it('salva peso e dimensões ao EDITAR uma variação já existente (não descarta o campo)', async () => {
    const created = await request(app).post('/v1/admin/products').set('Authorization', `Bearer ${adminToken}`).send({
      categoryId,
      name: 'Produto Editar Dimensões',
      slug: `produto-editar-dimensoes-${uuidv4()}`,
      basePrice: 70,
      variants: [{ size: 'M', color: 'Verde', sku: `SKU-EDITDIM-${uuidv4()}`, stockQuantity: 5 }],
    });
    const productId = created.body.id;
    const variantId = created.body.variants[0].id;

    const updated = await request(app).put(`/v1/admin/products/${productId}`).set('Authorization', `Bearer ${adminToken}`).send({
      variants: [{ id: variantId, size: 'M', color: 'Verde', sku: created.body.variants[0].sku, stockQuantity: 5, weightKg: 0.5, heightCm: 7, widthCm: 26, lengthCm: 21 }],
    });

    expect(updated.status).toBe(200);
    const variant = updated.body.variants[0];
    expect(Number(variant.weightKg)).toBe(0.5);
    expect(Number(variant.widthCm)).toBe(26);
  });
});
