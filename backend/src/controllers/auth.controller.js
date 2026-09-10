const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const authService = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, cpf, phone } = req.body;
  if (!name || !email || !password) {
    throw ApiError.badRequest('Campos obrigatórios: name, email, password');
  }
  if (password.length < 8) {
    throw ApiError.badRequest('A senha deve ter ao menos 8 caracteres');
  }

  const user = await authService.register({ name, email, password, cpf: cpf || null, phone });
  res.status(201).json({ id: user.id, name: user.name, email: user.email });
});

const confirmEmail = asyncHandler(async (req, res) => {
  await authService.confirmEmail(req.body.token);
  res.json({ message: 'E-mail confirmado com sucesso' });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw ApiError.badRequest('Informe e-mail e senha');

  const result = await authService.login({ email, password });

  if (result.requiresTwoFactor) {
    return res.json({ requires_two_factor: true, two_factor_token: result.twoFactorToken });
  }

  res.json({
    user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
    access_token: result.tokens.accessToken,
    refresh_token: result.tokens.refreshToken,
  });
});

const verifyTwoFactorLogin = asyncHandler(async (req, res) => {
  const { two_factor_token: twoFactorToken, code } = req.body;
  if (!twoFactorToken || !code) throw ApiError.badRequest('two_factor_token e code são obrigatórios');

  const { user, tokens } = await authService.verifyTwoFactorLogin(twoFactorToken, code);
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refresh_token: refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('refresh_token é obrigatório');

  const tokens = await authService.refresh(refreshToken);
  res.json({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  res.json({ message: 'Se o e-mail existir em nossa base, um link de redefinição foi enviado' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw ApiError.badRequest('token e password são obrigatórios');
  if (password.length < 8) throw ApiError.badRequest('A senha deve ter ao menos 8 caracteres');

  await authService.resetPassword(token, password);
  res.json({ message: 'Senha redefinida com sucesso' });
});

module.exports = { register, confirmEmail, login, verifyTwoFactorLogin, refresh, forgotPassword, resetPassword };
