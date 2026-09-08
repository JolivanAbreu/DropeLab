const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const ApiError = require('../utils/apiError');
const emailService = require('./email.service');
const twoFactorService = require('./twoFactor.service');

// Tokens de confirmação de e-mail e redefinição de senha guardados em memória
// para simplificar este exemplo. Em produção, mover para uma tabela dedicada
// (ex.: password_reset_tokens) com expiração e índice, ou para o Redis.
const emailTokens = new Map(); // token -> userId
const resetTokens = new Map(); // token -> { userId, expiresAt }

function issueTokens(user) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { accessToken, refreshToken };
}

// Token de curtíssima duração (5 min) usado só pra atravessar a segunda
// etapa do login (código do 2FA) — não serve pra autenticar nenhuma outra
// rota da API, só pra provar "esta pessoa acabou de acertar a senha" sem
// precisar reenviar e-mail/senha de novo na segunda chamada.
function issueTwoFactorPendingToken(user) {
  return jwt.sign({ sub: user.id, type: 'two_factor_pending' }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

function verifyTwoFactorPendingToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Sessão de verificação expirada — faça login novamente');
  }
  if (payload.type !== 'two_factor_pending') {
    throw ApiError.unauthorized('Token inválido para esta etapa');
  }
  return payload.sub;
}

async function register({ name, email, password, cpf, phone }) {
  const existingByEmail = await User.findOne({ where: { email } });
  if (existingByEmail) {
    throw ApiError.conflict('E-mail já cadastrado', 'email_already_registered');
  }
  if (cpf) {
    const existingByCpf = await User.findOne({ where: { cpf } });
    if (existingByCpf) {
      throw ApiError.conflict('Já existe uma conta cadastrada com este CPF', 'cpf_already_registered');
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, cpf, phone, role: 'customer' });

  const token = crypto.randomBytes(32).toString('hex');
  emailTokens.set(token, user.id);
  // Best-effort: uma falha no envio do e-mail de confirmação (SMTP fora do ar,
  // timeout etc.) não pode derrubar o cadastro, que já foi persistido com
  // sucesso. O cliente pode solicitar reenvio depois.
  emailService.sendEmailConfirmation(user, token).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[email] falha ao enviar confirmação de cadastro:', err.message);
  });

  return user;
}

async function confirmEmail(token) {
  const userId = emailTokens.get(token);
  if (!userId) throw ApiError.badRequest('Token de confirmação inválido ou expirado');
  emailTokens.delete(token);
  await User.update({ emailVerifiedAt: new Date() }, { where: { id: userId } });
}

async function login({ email, password }) {
  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user) throw ApiError.unauthorized('Credenciais inválidas');
  if (user.deletedAt) throw ApiError.unauthorized('Esta conta foi excluída', 'account_deleted');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Credenciais inválidas');

  if (user.twoFactorEnabled) {
    return { requiresTwoFactor: true, twoFactorToken: issueTwoFactorPendingToken(user) };
  }

  return { user, tokens: issueTokens(user) };
}

async function verifyTwoFactorLogin(twoFactorToken, code) {
  if (!code) throw ApiError.badRequest('Informe o código de verificação');
  const userId = verifyTwoFactorPendingToken(twoFactorToken);

  await twoFactorService.verifyLoginCode(userId, code);

  const user = await User.findByPk(userId);
  if (!user) throw ApiError.unauthorized('Usuário não encontrado');
  if (user.deletedAt) throw ApiError.unauthorized('Esta conta foi excluída', 'account_deleted');

  return { user, tokens: issueTokens(user) };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Refresh token inválido ou expirado');
  }
  const user = await User.findByPk(payload.sub);
  if (!user) throw ApiError.unauthorized('Usuário não encontrado');
  if (user.deletedAt) throw ApiError.unauthorized('Esta conta foi excluída', 'account_deleted');
  return issueTokens(user);
}

async function forgotPassword(email) {
  const user = await User.findOne({ where: { email } });
  // Não revela se o e-mail existe ou não, para evitar enumeração de contas.
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + 60 * 60 * 1000 });
  emailService.sendPasswordReset(user, token).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[email] falha ao enviar redefinição de senha:', err.message);
  });
}

async function resetPassword(token, newPassword) {
  const entry = resetTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    throw ApiError.badRequest('Token de redefinição inválido ou expirado');
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await User.update({ passwordHash }, { where: { id: entry.userId } });
  resetTokens.delete(token);
}

module.exports = { register, confirmEmail, login, verifyTwoFactorLogin, refresh, forgotPassword, resetPassword, issueTokens };
