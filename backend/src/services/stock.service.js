const { ProductVariant, Product, Wishlist, User, sequelize } = require('../models');
const ApiError = require('../utils/apiError');
const emailService = require('./email.service');

// UPDATE atômico (WHERE stock_quantity >= quantity) evita estoque negativo
// sob concorrência, sem precisar de lock de linha (RN-02).
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

  // Só avisa "voltou ao estoque" se o produto inteiro estava zerado antes
  // de uma entrada (delta > 0) — não faz sentido em baixa de estoque.
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
