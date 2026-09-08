const request = require('supertest');

const app = require('../app');
const { sequelize, User, NewsletterSubscriber } = require('../models');

async function makeUser(email, role) {
  await request(app).post('/v1/register').send({
    name: 'Usuário Newsletter', email, password: 'senha1234', cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
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

describe('Newsletter', () => {
  it('assina a newsletter com um e-mail válido (sem precisar estar logado)', async () => {
    const email = `assinante-${Date.now()}@teste.com`;
    const res = await request(app).post('/v1/newsletter/subscribe').send({ email });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
  });

  it('normaliza o e-mail (minúsculas, sem espaço nas pontas)', async () => {
    const email = `  MAIUSCULO-${Date.now()}@Teste.com  `;
    const res = await request(app).post('/v1/newsletter/subscribe').send({ email });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email.trim().toLowerCase());
  });

  it('rejeita e-mail inválido', async () => {
    const res = await request(app).post('/v1/newsletter/subscribe').send({ email: 'não-é-um-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  it('assinar de novo com o mesmo e-mail não dá erro (idempotente)', async () => {
    const email = `duplicado-${Date.now()}@teste.com`;
    const first = await request(app).post('/v1/newsletter/subscribe').send({ email });
    const second = await request(app).post('/v1/newsletter/subscribe').send({ email });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const count = await NewsletterSubscriber.count({ where: { email } });
    expect(count).toBe(1);
  });

  it('admin lista os assinantes', async () => {
    const email = `visivel-admin-${Date.now()}@teste.com`;
    await request(app).post('/v1/newsletter/subscribe').send({ email });

    const adminToken = await makeUser(`admin-newsletter-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).get('/v1/admin/newsletter').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some((s) => s.email === email)).toBe(true);
  });

  it('operador também consegue ver a lista (leitura liberada)', async () => {
    const opToken = await makeUser(`operador-newsletter-${Date.now()}@teste.com`, 'operator');
    const res = await request(app).get('/v1/admin/newsletter').set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(200);
  });

  it('visitante sem login não acessa a lista de assinantes', async () => {
    const res = await request(app).get('/v1/admin/newsletter');
    expect(res.status).toBe(401);
  });

  it('exporta os assinantes em CSV', async () => {
    const email = `csv-${Date.now()}@teste.com`;
    await request(app).post('/v1/newsletter/subscribe').send({ email });

    const adminToken = await makeUser(`admin-newsletter-csv-${Date.now()}@teste.com`, 'admin');
    const res = await request(app).get('/v1/admin/newsletter/export').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain(email);
    expect(res.text).toContain('E-mail,Assinou em');
  });
});
