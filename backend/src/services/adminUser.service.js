const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const ApiError = require('../utils/apiError');

const PAGE_SIZE = 30;
const VALID_ROLES = ['customer', 'operator', 'admin'];

// defaultScope do model User já exclui passwordHash.
async function listUsers({ search, role, page = 1 } = {}) {
  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (role) where.role = role;

  const { rows, count } = await User.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return { data: rows, page: Number(page), totalPages: Math.ceil(count / PAGE_SIZE), total: count };
}

async function setUserRole(targetUserId, newRole, requestingUserId) {
  if (!VALID_ROLES.includes(newRole)) {
    throw ApiError.badRequest(`Perfil inválido. Use um de: ${VALID_ROLES.join(', ')}`);
  }
  if (targetUserId === requestingUserId) {
    throw ApiError.badRequest('Você não pode alterar o próprio perfil por aqui', 'cannot_change_own_role');
  }

  const user = await User.findByPk(targetUserId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  user.role = newRole;
  await user.save();
  return user;
}

// Senha em texto puro só existe neste retorno — nunca é logada nem persistida.
async function resetUserPassword(targetUserId) {
  const user = await User.findByPk(targetUserId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const temporaryPassword = crypto.randomBytes(6).toString('base64url'); // ~8 caracteres, url-safe
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await user.save();

  return { email: user.email, temporaryPassword };
}

module.exports = { listUsers, setUserRole, resetUserPassword, VALID_ROLES };
