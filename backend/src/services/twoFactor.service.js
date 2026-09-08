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

/**
 * Início da ativação — gera um segredo novo (ainda não ativo) e devolve o
 * QR Code pra escanear no app autenticador. O segredo só passa a valer de
 * verdade depois de confirmado com um código correto (ver confirmSetup);
 * gerar de novo antes de confirmar simplesmente substitui o pendente.
 */
async function startSetup(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(user.email, 'Dravennx Painel', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await user.update({ twoFactorSecret: secret, twoFactorEnabled: false, twoFactorBackupCodes: null });

  return { secret, qrCodeDataUrl };
}

/**
 * Confirma a ativação — exige um código válido gerado a partir do segredo
 * pendente, provando que o app autenticador foi configurado corretamente
 * antes de tornar o 2FA obrigatório no login. Gera os códigos de backup
 * nesse momento e os retorna em texto puro UMA ÚNICA VEZ — depois disso só
 * os hashes ficam salvos, não há como recuperá-los de novo.
 */
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

/**
 * Desativa o 2FA — exige a senha atual (não o código do app, que pode já
 * estar inacessível se for justamente o motivo de querer desativar).
 */
async function disable(userId, password) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Senha atual incorreta', 'invalid_current_password');

  await user.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null });
}

/**
 * Verifica um código no momento do login — aceita tanto o código de 6
 * dígitos do app autenticador quanto um código de backup (formato
 * XXXX-XXXX). Um código de backup é consumido (removido da lista) no
 * primeiro uso — nunca funciona de novo depois.
 */
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
