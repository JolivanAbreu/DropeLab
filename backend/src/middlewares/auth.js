const jwt = require('jsonwebtoken');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { User } = require('../models');

// Exige um access token JWT válido. Popula req.user com { id, role }.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Token de acesso ausente');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Token de acesso inválido ou expirado');
  }

  const user = await User.findByPk(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Usuário do token não encontrado');
  }
  // Conta anonimizada por autoexclusão (LGPD) — mesmo um access token já
  // emitido antes da exclusão para de funcionar imediatamente, em vez de
  // continuar válido até expirar naturalmente.
  if (user.deletedAt) {
    throw ApiError.unauthorized('Esta conta foi excluída', 'account_deleted');
  }

  req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
  next();
});

// Autenticação opcional: popula req.user se houver token válido, mas não bloqueia visitantes.
const authenticateOptional = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.sub);
    if (user) req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
  } catch (err) {
    // token inválido em rota opcional: segue como visitante, sem erro
  }
  next();
});

module.exports = { authenticate, authenticateOptional };
