const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const {
  User, Address, Order, OrderItem, ProductVariant, Product, Review, Wishlist, Cart, CartItem,
} = require('../models');
const ApiError = require('../utils/apiError');

async function getProfile(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');
  return user;
}

async function updateProfile(userId, { name, phone }) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  // E-mail, CPF e perfil (role) não são editáveis por aqui: e-mail tem fluxo
  // próprio (changeEmail, abaixo, exige senha), CPF é documento fixo, e role
  // é controlado apenas pelo painel administrativo.
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();
  return user;
}

async function changeEmail(userId, { newEmail, currentPassword }) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Senha atual incorreta', 'invalid_current_password');

  const existing = await User.findOne({ where: { email: newEmail } });
  if (existing && existing.id !== userId) {
    throw ApiError.conflict('Este e-mail já está em uso por outra conta', 'email_already_registered');
  }

  user.email = newEmail;
  await user.save();
  return user;
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Senha atual incorreta', 'invalid_current_password');

  if (newPassword.length < 8) {
    throw ApiError.badRequest('A nova senha deve ter ao menos 8 caracteres');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
}

/**
 * Exportação de dados pessoais (LGPD, art. 18) — reúne tudo o que o sistema
 * guarda sobre o cliente logado num único documento, pra ele baixar. Não
 * inclui dados de outros clientes nem informação interna (ex.: hash de
 * senha, tokens).
 */
async function exportData(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const addresses = await Address.findAll({ where: { userId } });

  const orders = await Order.findAll({
    where: { userId },
    include: [{
      model: OrderItem,
      as: 'items',
      include: [{ model: ProductVariant, as: 'variant', include: [{ model: Product, as: 'product' }] }],
    }],
    order: [['createdAt', 'DESC']],
  });

  const reviews = await Review.findAll({
    where: { userId },
    include: [{ model: Product, as: 'product' }],
    order: [['createdAt', 'DESC']],
  });

  const wishlist = await Wishlist.findAll({
    where: { userId },
    include: [{ model: Product, as: 'product' }],
    order: [['createdAt', 'DESC']],
  });

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id, name: user.name, email: user.email, cpf: user.cpf, phone: user.phone,
      role: user.role, createdAt: user.createdAt,
    },
    addresses: addresses.map((a) => ({
      street: a.street, number: a.number, complement: a.complement, neighborhood: a.neighborhood,
      city: a.city, state: a.state, zip: a.zip, isDefault: a.isDefault,
    })),
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber, status: o.status, subtotal: o.subtotal, discount: o.discount,
      total: o.total, createdAt: o.createdAt,
      items: (o.items || []).map((i) => ({
        product: i.variant?.product?.name, size: i.variant?.size, color: i.variant?.color,
        quantity: i.quantity, unitPrice: i.unitPrice,
      })),
    })),
    reviews: reviews.map((r) => ({
      product: r.product?.name, rating: r.rating, comment: r.comment, createdAt: r.createdAt,
    })),
    wishlist: wishlist.map((w) => ({ product: w.product?.name, addedAt: w.createdAt })),
  };
}

/**
 * Autoexclusão de conta (LGPD, art. 18, VI). Não é uma remoção física:
 * pedidos e pagamentos têm retenção legal (obrigação fiscal/contábil), então
 * a conta é ANONIMIZADA — dados pessoais identificáveis são substituídos,
 * login passa a ser bloqueado, mas o histórico de pedidos (necessário pra
 * contabilidade da loja) permanece íntegro, agora associado a um usuário
 * anônimo. Endereços, favoritos e carrinho — sem essa exigência legal — são
 * excluídos de verdade.
 */
async function deleteAccount(userId, currentPassword) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw ApiError.notFound('Usuário não encontrado');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Senha atual incorreta', 'invalid_current_password');

  const anonymizedSuffix = uuidv4().slice(0, 8);

  await Address.destroy({ where: { userId } });
  await Wishlist.destroy({ where: { userId } });
  const cart = await Cart.findOne({ where: { userId } });
  if (cart) {
    await CartItem.destroy({ where: { cartId: cart.id } });
    await cart.destroy();
  }

  user.name = 'Usuário excluído';
  user.email = `excluido-${anonymizedSuffix}@removido.dravennx`;
  user.cpf = null;
  user.phone = null;
  user.passwordHash = await bcrypt.hash(uuidv4(), 12); // login fica impossível — ninguém sabe essa senha
  user.deletedAt = new Date();
  await user.save();
}

module.exports = { getProfile, updateProfile, changeEmail, changePassword, exportData, deleteAccount };
