const { ProductVariant, Product, Wishlist, User, sequelize } = require('../models');
const ApiError = require('../utils/apiError');
const emailService = require('./email.service');

/**
 * Decrementa o estoque de uma variação de forma atômica: o UPDATE só afeta a
 * linha se houver saldo suficiente (WHERE stock_quantity >= quantity), o que
 * evita estoque negativo mesmo sob requisições concorrentes (RN-02) sem
 * precisar de lock explícito de linha.
 */
async function reserveStock(variantId, quantity, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `UPDATE product_variants
     SET stock_quantity = stock_quantity - :quantity, updated_at = NOW()
     WHERE id = :variantId AND stock_quantity >= :quantity
     RETURNING id, sku, stock_quantity;`,
    { replacements: { variantId, quantity }, transaction }
  );

  if (rows.length === 0) {
    const variant = await ProductVariant.findByPk(variantId, { transaction });
    if (!variant) throw ApiError.notFound('Variação de produto não encontrada');
    throw ApiError.conflict(`Estoque insuficiente para o SKU ${variant.sku}`, 'insufficient_stock');
  }

  return rows[0];
}

async function releaseStock(variantId, quantity, { transaction } = {}) {
  await sequelize.query(
    `UPDATE product_variants SET stock_quantity = stock_quantity + :quantity, updated_at = NOW()
     WHERE id = :variantId;`,
    { replacements: { variantId, quantity }, transaction }
  );
}

async function getTotalStockForProduct(productId) {
  const total = await ProductVariant.sum('stockQuantity', { where: { productId } });
  return total || 0;
}

/**
 * Avisa por e-mail quem favoritou o produto que ele voltou a ter estoque —
 * best-effort: uma falha de envio nunca deve interromper o ajuste de
 * estoque em si (mesmo princípio já usado nos e-mails de pedido/cadastro).
 */
async function notifyWishlistersBackInStock(productId) {
  const product = await Product.findByPk(productId);
  if (!product) return;

  const entries = await Wishlist.findAll({ where: { productId }, include: [{ model: User, as: 'user' }] });
  for (const entry of entries) {
    if (!entry.user) continue;
    emailService.sendBackInStockNotification(entry.user, product).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[estoque] falha ao avisar ${entry.user.email} sobre volta ao estoque:`, err.message);
    });
  }
}

async function adjustStock(variantId, delta, reason) {
  const variant = await ProductVariant.findByPk(variantId);
  if (!variant) throw ApiError.notFound('Variação não encontrada');

  const newQuantity = variant.stockQuantity + delta;
  if (newQuantity < 0) {
    throw ApiError.unprocessable('Ajuste resultaria em estoque negativo');
  }

  // Só verifica se o produto (todas as variações somadas) estava
  // completamente zerado ANTES deste ajuste — e só quando o ajuste é de
  // entrada (delta > 0), já que só faz sentido avisar "voltou ao estoque"
  // em reposição, não em baixa. Se o total já estava em zero e esta
  // variação está recebendo estoque, o total necessariamente passa a ser
  // positivo depois (nenhuma variação pode estar com saldo negativo), sem
  // precisar de uma segunda consulta pra confirmar.
  const productWasOutOfStock = delta > 0 && (await getTotalStockForProduct(variant.productId)) === 0;

  variant.stockQuantity = newQuantity;
  await variant.save();

  // eslint-disable-next-line no-console
  console.log(`[estoque] SKU ${variant.sku}: ${delta >= 0 ? '+' : ''}${delta} (motivo: ${reason}) -> ${newQuantity}`);

  if (productWasOutOfStock) {
    notifyWishlistersBackInStock(variant.productId).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[estoque] falha ao notificar favoritos sobre volta ao estoque:', err.message);
    });
  }

  return variant;
}

module.exports = { reserveStock, releaseStock, adjustStock, notifyWishlistersBackInStock, getTotalStockForProduct };
