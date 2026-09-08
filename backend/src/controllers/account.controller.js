const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const accountService = require('../services/account.service');
const twoFactorService = require('../services/twoFactor.service');

const getMe = asyncHandler(async (req, res) => {
  const user = await accountService.getProfile(req.user.id);
  res.json({ id: user.id, name: user.name, email: user.email, cpf: user.cpf, phone: user.phone, role: user.role, twoFactorEnabled: user.twoFactorEnabled });
});

const updateMe = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = await accountService.updateProfile(req.user.id, { name, phone });
  res.json({ id: user.id, name: user.name, email: user.email, cpf: user.cpf, phone: user.phone, role: user.role });
});

const changeEmail = asyncHandler(async (req, res) => {
  const { new_email: newEmail, current_password: currentPassword } = req.body;
  if (!newEmail || !currentPassword) {
    throw ApiError.badRequest('new_email e current_password são obrigatórios');
  }
  const user = await accountService.changeEmail(req.user.id, { newEmail, currentPassword });
  res.json({ id: user.id, name: user.name, email: user.email, cpf: user.cpf, phone: user.phone, role: user.role });
});

const changePassword = asyncHandler(async (req, res) => {
  const { current_password: currentPassword, new_password: newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('current_password e new_password são obrigatórios');
  }
  await accountService.changePassword(req.user.id, { currentPassword, newPassword });
  res.json({ message: 'Senha atualizada com sucesso' });
});

const exportData = asyncHandler(async (req, res) => {
  const data = await accountService.exportData(req.user.id);
  res.setHeader('Content-Disposition', `attachment; filename="meus-dados-${Date.now()}.json"`);
  res.json(data);
});

const deleteAccount = asyncHandler(async (req, res) => {
  const { current_password: currentPassword } = req.body;
  if (!currentPassword) {
    throw ApiError.badRequest('current_password é obrigatório');
  }
  await accountService.deleteAccount(req.user.id, currentPassword);
  res.json({ message: 'Conta excluída com sucesso' });
});

// --- Autenticação de dois fatores ---

const startTwoFactorSetup = asyncHandler(async (req, res) => {
  const result = await twoFactorService.startSetup(req.user.id);
  res.json({ secret: result.secret, qr_code: result.qrCodeDataUrl });
});

const confirmTwoFactorSetup = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) throw ApiError.badRequest('code é obrigatório');
  const result = await twoFactorService.confirmSetup(req.user.id, code);
  res.json({ backup_codes: result.backupCodes });
});

const disableTwoFactor = asyncHandler(async (req, res) => {
  const { current_password: currentPassword } = req.body;
  if (!currentPassword) throw ApiError.badRequest('current_password é obrigatório');
  await twoFactorService.disable(req.user.id, currentPassword);
  res.json({ message: 'Autenticação de dois fatores desativada' });
});

module.exports = {
  getMe, updateMe, changeEmail, changePassword, exportData, deleteAccount,
  startTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor,
};
