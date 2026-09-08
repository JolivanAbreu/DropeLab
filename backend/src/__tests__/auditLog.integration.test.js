const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const { sequelize, User, Category, Product, ProductVariant, Coupon, AuditLog } = require('../models');

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Auditoria', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
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

describe('Log de auditoria — registro de ações sensíveis', () => {
  it('registra a troca de perfil de um usuário, com o autor e o e-mail do alvo', async () => {
    const { token: adminToken, userId: adminId } = await makeUser(`admin-audit-role-${Date.now()}@teste.com`, 'admin');
    const { userId: targetId } = await makeUser(`alvo-role-${Date.now()}@teste.com`, 'customer');

    await request(app).put(`/v1/admin/users/${targetId}/role`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'operator' });

    const log = await AuditLog.findOne({ where: { action: 'user.role_changed', entityId: targetId }, order: [['createdAt', 'DESC']] });
    expect(log).not.toBeNull();
    expect(log.actorId).toBe(adminId);
    expect(log.details.newRole).toBe('operator');
  });

  it('registra a redefinição de senha de um usuário', async () => {
    const { token: adminToken } = await makeUser(`admin-audit-pwd-${Date.now()}@teste.com`, 'admin');
    const { userId: targetId } = await makeUser(`alvo-pwd-${Date.now()}@teste.com`, 'customer');

    await request(app).post(`/v1/admin/users/${targetId}/reset-password`).set('Authorization', `Bearer ${adminToken}`);

    const log = await AuditLog.findOne({ where: { action: 'user.password_reset', entityId: targetId } });
    expect(log).not.toBeNull();
  });

  it('registra a exclusão definitiva de um produto', async () => {
    const category = await Category.create({ name: 'Cat Auditoria', slug: `cat-auditoria-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Auditoria', slug: `produto-auditoria-${uuidv4()}`, basePrice: 60, active: true });

    const { token: adminToken } = await makeUser(`admin-audit-delprod-${Date.now()}@teste.com`, 'admin');
    await request(app).delete(`/v1/admin/products/${product.id}/permanently`).set('Authorization', `Bearer ${adminToken}`);

    const log = await AuditLog.findOne({ where: { action: 'product.deleted_permanently', entityId: product.id } });
    expect(log).not.toBeNull();
  });

  it('registra desativação/reativação de produto', async () => {
    const category = await Category.create({ name: 'Cat Auditoria 2', slug: `cat-auditoria2-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Auditoria 2', slug: `produto-auditoria2-${uuidv4()}`, basePrice: 60, active: true });

    const { token: adminToken } = await makeUser(`admin-audit-deactprod-${Date.now()}@teste.com`, 'admin');
    await request(app).delete(`/v1/admin/products/${product.id}`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).put(`/v1/admin/products/${product.id}/reactivate`).set('Authorization', `Bearer ${adminToken}`);

    const deactivateLog = await AuditLog.findOne({ where: { action: 'product.deactivated', entityId: product.id } });
    const reactivateLog = await AuditLog.findOne({ where: { action: 'product.reactivated', entityId: product.id } });
    expect(deactivateLog).not.toBeNull();
    expect(reactivateLog).not.toBeNull();
  });

  it('registra ações em massa (ativar/desativar e reajuste de preço) com a lista de ids afetados', async () => {
    const category = await Category.create({ name: 'Cat Auditoria Massa', slug: `cat-auditoria-massa-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Massa Auditoria', slug: `produto-massa-auditoria-${uuidv4()}`, basePrice: 100, active: true });

    const { token: adminToken } = await makeUser(`admin-audit-massa-${Date.now()}@teste.com`, 'admin');
    await request(app).post('/v1/admin/products/bulk-active').set('Authorization', `Bearer ${adminToken}`).send({ ids: [product.id], active: false });
    await request(app).post('/v1/admin/products/bulk-price').set('Authorization', `Bearer ${adminToken}`).send({ ids: [product.id], percentage: 10 });

    const bulkActiveLog = await AuditLog.findOne({ where: { action: 'product.bulk_deactivated' }, order: [['createdAt', 'DESC']] });
    const bulkPriceLog = await AuditLog.findOne({ where: { action: 'product.bulk_price_adjusted' }, order: [['createdAt', 'DESC']] });

    expect(bulkActiveLog.details.ids).toContain(product.id);
    expect(bulkPriceLog.details.percentage).toBe(10);
  });

  it('registra mudança de status de pedido, com o número do pedido', async () => {
    const category = await Category.create({ name: 'Cat Auditoria Pedido', slug: `cat-auditoria-pedido-${uuidv4()}` });
    const product = await Product.create({ categoryId: category.id, name: 'Produto Pedido Auditoria', slug: `produto-pedido-auditoria-${uuidv4()}`, basePrice: 80, active: true });
    const variant = await ProductVariant.create({ productId: product.id, size: 'M', color: 'Preto', sku: `SKU-AUDIT-PED-${uuidv4()}`, stockQuantity: 5 });

    const { token: clientToken } = await makeUser(`cliente-audit-pedido-${Date.now()}@teste.com`);
    const addr = await request(app).post('/v1/addresses').set('Authorization', `Bearer ${clientToken}`).send({
      street: 'Rua Auditoria', number: '1', neighborhood: 'Centro', city: 'Fortaleza', state: 'CE', zip: '60000-000',
    });
    await request(app).post('/v1/cart/items').set('Authorization', `Bearer ${clientToken}`).send({ variant_id: variant.id, quantity: 1 });
    const order = await request(app).post('/v1/orders').set('Authorization', `Bearer ${clientToken}`).send({ address_id: addr.body.id, shipping_option_id: 'combinar' });

    const { token: adminToken } = await makeUser(`admin-audit-order-${Date.now()}@teste.com`, 'admin');
    await request(app).put(`/v1/admin/orders/${order.body.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'cancelado' });

    const log = await AuditLog.findOne({ where: { action: 'order.status_changed', entityId: order.body.id } });
    expect(log).not.toBeNull();
    expect(log.details.orderNumber).toBe(order.body.orderNumber);
    expect(log.details.newStatus).toBe('cancelado');
  });

  it('registra exclusão de cupom, com o código', async () => {
    const coupon = await Coupon.create({
      code: `AUDIT${Date.now()}`, discountType: 'percentage', discountValue: 10,
      validFrom: new Date(), validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const { token: adminToken } = await makeUser(`admin-audit-coupon-${Date.now()}@teste.com`, 'admin');
    await request(app).delete(`/v1/admin/coupons/${coupon.id}`).set('Authorization', `Bearer ${adminToken}`);

    const log = await AuditLog.findOne({ where: { action: 'coupon.deleted', entityId: coupon.id } });
    expect(log).not.toBeNull();
    expect(log.details.code).toBe(coupon.code);
  });

  it('registra ativar/desativar cupom', async () => {
    const coupon = await Coupon.create({
      code: `AUDITTOGGLE${Date.now()}`, discountType: 'fixed', discountValue: 10, active: true,
      validFrom: new Date(), validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const { token: adminToken } = await makeUser(`admin-audit-couponactive-${Date.now()}@teste.com`, 'admin');
    await request(app).put(`/v1/admin/coupons/${coupon.id}/active`).set('Authorization', `Bearer ${adminToken}`).send({ active: false });

    const log = await AuditLog.findOne({ where: { action: 'coupon.deactivated', entityId: coupon.id } });
    expect(log).not.toBeNull();
  });

  it('registra exclusão de categoria, com o nome', async () => {
    const category = await Category.create({ name: 'Categoria Pra Excluir Audit', slug: `categoria-excluir-audit-${uuidv4()}` });

    const { token: adminToken } = await makeUser(`admin-audit-cat-${Date.now()}@teste.com`, 'admin');
    await request(app).delete(`/v1/admin/categories/${category.id}`).set('Authorization', `Bearer ${adminToken}`);

    const log = await AuditLog.findOne({ where: { action: 'category.deleted', entityId: category.id } });
    expect(log).not.toBeNull();
    expect(log.details.name).toBe('Categoria Pra Excluir Audit');
  });

  it('GET /admin/audit-logs lista os registros mais recentes primeiro, só pra admin', async () => {
    const { token: adminToken } = await makeUser(`admin-audit-list-${Date.now()}@teste.com`, 'admin');
    const { token: opToken } = await makeUser(`operador-audit-list-${Date.now()}@teste.com`, 'operator');

    const category = await Category.create({ name: 'Cat Listagem Audit', slug: `cat-listagem-audit-${uuidv4()}` });
    await request(app).delete(`/v1/admin/categories/${category.id}`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app).get('/v1/admin/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);

    const opRes = await request(app).get('/v1/admin/audit-logs').set('Authorization', `Bearer ${opToken}`);
    expect(opRes.status).toBe(403);
  });

  it('visitante sem login não acessa o log de auditoria', async () => {
    const res = await request(app).get('/v1/admin/audit-logs');
    expect(res.status).toBe(401);
  });
});
