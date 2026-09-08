const request = require('supertest');
const { authenticator } = require('otplib');

const app = require('../app');
const { sequelize } = require('../models');

async function registerAndLogin(email, password = 'senha1234') {
  await request(app).post('/v1/register').send({
    name: 'Cliente 2FA', email, password, cpf: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 11), phone: '85999999999',
  });
  const login = await request(app).post('/v1/login').send({ email, password });
  return login.body.access_token;
}

async function setupAndEnableTwoFactor(token) {
  const setupRes = await request(app).post('/v1/account/2fa/setup').set('Authorization', `Bearer ${token}`);
  const { secret } = setupRes.body;
  const code = authenticator.generate(secret);
  const confirmRes = await request(app).post('/v1/account/2fa/confirm').set('Authorization', `Bearer ${token}`).send({ code });
  return { secret, backupCodes: confirmRes.body.backup_codes };
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Ativação do 2FA', () => {
  it('gera um QR Code e um segredo ao iniciar a ativação', async () => {
    const token = await registerAndLogin(`setup-2fa-${Date.now()}@teste.com`);
    const res = await request(app).post('/v1/account/2fa/setup').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.secret).toBeTruthy();
    expect(res.body.qr_code).toMatch(/^data:image\/png;base64,/);
  });

  it('confirma a ativação com um código válido e retorna 8 códigos de backup', async () => {
    const token = await registerAndLogin(`confirm-2fa-${Date.now()}@teste.com`);
    const { backupCodes } = await setupAndEnableTwoFactor(token);

    expect(backupCodes).toHaveLength(8);
    expect(backupCodes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it('rejeita confirmação com código inválido', async () => {
    const token = await registerAndLogin(`confirm-invalido-2fa-${Date.now()}@teste.com`);
    await request(app).post('/v1/account/2fa/setup').set('Authorization', `Bearer ${token}`);

    const res = await request(app).post('/v1/account/2fa/confirm').set('Authorization', `Bearer ${token}`).send({ code: '000000' });
    expect(res.status).toBe(400);
  });

  it('GET /account reflete que o 2FA está ativo depois de confirmado', async () => {
    const token = await registerAndLogin(`reflete-2fa-${Date.now()}@teste.com`);
    await setupAndEnableTwoFactor(token);

    const res = await request(app).get('/v1/account').set('Authorization', `Bearer ${token}`);
    expect(res.body.twoFactorEnabled).toBe(true);
  });
});

describe('Login com 2FA ativo', () => {
  it('login com senha correta não retorna tokens direto — pede o código', async () => {
    const email = `login-2fa-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    await setupAndEnableTwoFactor(token);

    const res = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    expect(res.status).toBe(200);
    expect(res.body.requires_two_factor).toBe(true);
    expect(res.body.two_factor_token).toBeTruthy();
    expect(res.body.access_token).toBeUndefined();
  });

  it('completa o login com o código correto do app autenticador', async () => {
    const email = `login-completo-2fa-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    const { secret } = await setupAndEnableTwoFactor(token);

    const loginRes = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    const code = authenticator.generate(secret);

    const verifyRes = await request(app).post('/v1/login/2fa').send({ two_factor_token: loginRes.body.two_factor_token, code });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.access_token).toBeTruthy();
    expect(verifyRes.body.user.email).toBe(email);
  });

  it('rejeita código incorreto na segunda etapa', async () => {
    const email = `login-errado-2fa-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    await setupAndEnableTwoFactor(token);

    const loginRes = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    const res = await request(app).post('/v1/login/2fa').send({ two_factor_token: loginRes.body.two_factor_token, code: '000000' });
    expect(res.status).toBe(401);
  });

  it('completa o login com um código de backup, e esse código não funciona de novo', async () => {
    const email = `login-backup-2fa-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    const { backupCodes } = await setupAndEnableTwoFactor(token);
    const backupCode = backupCodes[0];

    const loginRes1 = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    const firstUse = await request(app).post('/v1/login/2fa').send({ two_factor_token: loginRes1.body.two_factor_token, code: backupCode });
    expect(firstUse.status).toBe(200);

    const loginRes2 = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    const secondUse = await request(app).post('/v1/login/2fa').send({ two_factor_token: loginRes2.body.two_factor_token, code: backupCode });
    expect(secondUse.status).toBe(401);
  });

  it('token de verificação de outro login não serve pra outra conta', async () => {
    const emailA = `conta-a-2fa-${Date.now()}@teste.com`;
    const tokenA = await registerAndLogin(emailA);
    const emailB = `conta-b-2fa-${Date.now()}@teste.com`;
    const tokenB = await registerAndLogin(emailB);
    const { secret: secretB } = await setupAndEnableTwoFactor(tokenB);
    await setupAndEnableTwoFactor(tokenA);

    const loginResA = await request(app).post('/v1/login').send({ email: emailA, password: 'senha1234' });
    const codeFromB = authenticator.generate(secretB);
    const res = await request(app).post('/v1/login/2fa').send({ two_factor_token: loginResA.body.two_factor_token, code: codeFromB });
    expect(res.status).toBe(401);
  });
});

describe('Desativação do 2FA', () => {
  it('desativa com a senha correta, e o próximo login não pede mais código', async () => {
    const email = `desativar-2fa-${Date.now()}@teste.com`;
    const token = await registerAndLogin(email);
    await setupAndEnableTwoFactor(token);

    const disableRes = await request(app).post('/v1/account/2fa/disable').set('Authorization', `Bearer ${token}`).send({ current_password: 'senha1234' });
    expect(disableRes.status).toBe(200);

    const loginRes = await request(app).post('/v1/login').send({ email, password: 'senha1234' });
    expect(loginRes.body.requires_two_factor).toBeUndefined();
    expect(loginRes.body.access_token).toBeTruthy();
  });

  it('rejeita desativação com senha incorreta', async () => {
    const token = await registerAndLogin(`desativar-errado-2fa-${Date.now()}@teste.com`);
    await setupAndEnableTwoFactor(token);

    const res = await request(app).post('/v1/account/2fa/disable').set('Authorization', `Bearer ${token}`).send({ current_password: 'senhaerrada' });
    expect(res.status).toBe(401);
  });
});
