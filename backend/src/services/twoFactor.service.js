const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const ApiError = require('../utils/apiError');

const BACKUP_CODE_COUNT = 8;

function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

// Segredo só passa a valer depois de confirmado (ver confirmSetup).
async function startSetup(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, 'Dravennx Painel', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await user.update({ twoFactorSecret: secret, twoFactorEnabled: false, twoFactorBackupCodes: null });

  return { secret, qrCodeDataUrl };
}

// Códigos de backup só aparecem em texto puro aqui — depois só o hash fica salvo.
async function confirmSetup(userId, code) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');
  if (!user.twoFactorSecret) throw ApiError.badRequest('Nenhuma ativação de 2FA pendente — comece o processo novamente', 'two_factor_setup_not_started');

  const valid = authenticator.check(code, user.twoFactorSecret);
  if (!valid) throw ApiError.badRequest('Código inválido — confira o horário do celular e tente de novo', 'invalid_two_factor_code');

  const backupCodes = generateBackupCodes();
  await user.update({
    twoFactorEnabled: true,
    twoFactorBackupCodes: backupCodes.map(hashBackupCode),
  });

  return { backupCodes };
}

// Exige a senha atual, não o código do app (que pode ser o motivo de desativar).
async function disable(userId, password) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Senha atual incorreta', 'invalid_current_password');

  await user.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null });
}

// Aceita código do app OU de backup — o de backup é consumido no primeiro uso.
async function verifyLoginCode(userId, code) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user || !user.twoFactorEnabled) throw ApiError.unauthorized('2FA não está ativo para esta conta');

  if (authenticator.check(code, user.twoFactorSecret)) {
    return true;
  }

  const hashedInput = hashBackupCode(code.trim().toUpperCase());
  const backupCodes = user.twoFactorBackupCodes || [];
  const matchIndex = backupCodes.indexOf(hashedInput);
  if (matchIndex === -1) {
    throw ApiError.unauthorized('Código incorreto', 'invalid_two_factor_code');
  }

  const remaining = [...backupCodes];
  remaining.splice(matchIndex, 1);
  await user.update({ twoFactorBackupCodes: remaining });
  return true;
}

module.exports = { startSetup, confirmSetup, disable, verifyLoginCode };
