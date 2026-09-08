const { Op } = require('sequelize');
const { Product, ProductVariant, ProductImage, Category, Review, sequelize } = require('../models');
const ApiError = require('../utils/apiError');

const PAGE_SIZE = 20;

const SORT_MAP = {
  newest: [['createdAt', 'DESC']],
  price_asc: [['basePrice', 'ASC']],
  price_desc: [['basePrice', 'DESC']],
  best_selling: [['createdAt', 'DESC']], // ligação com order_items.sum(quantity) é feita em relatórios (documento 3, seção de índices)
};

/**
 * Busca média de avaliação e quantidade de reviews para um conjunto de
 * produtos em uma única query agregada (evita N+1) e devolve um mapa
 * productId -> { avgRating, reviewCount } pronto para mesclar na resposta.
 */
async function getRatingSummary(productIds) {
  if (productIds.length === 0) return {};

  const rows = await Review.findAll({
    where: { productId: productIds },
    attributes: [
      'productId',
      [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
    ],
    group: ['productId'],
    raw: true,
  });

  return Object.fromEntries(rows.map((r) => [
    r.productId,
    { avgRating: Number(Number(r.avgRating).toFixed(1)), reviewCount: Number(r.reviewCount) },
  ]));
}

function attachRatings(products, summary) {
  return products.map((p) => {
    const json = p.toJSON();
    json.avgRating = summary[p.id]?.avgRating ?? null;
    json.reviewCount = summary[p.id]?.reviewCount ?? 0;
    return json;
  });
}

/**
 * Produtos marcados pelo admin para aparecer em destaque na loja — banner
 * principal da home (normalmente um só) ou fileira de destaques (vários).
 * Sempre filtra por active:true, senão um produto desativado continuaria
 * aparecendo em destaque na vitrine.
 */
async function listFeaturedProducts(slot) {
  const products = await Product.findAll({
    where: { featuredSlot: slot, active: true },
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images', separate: true, order: [['order', 'ASC']] },
      { model: Category, as: 'category' },
    ],
    order: [['updatedAt', 'DESC']],
  });
  const summary = await getRatingSummary(products.map((p) => p.id));
  return attachRatings(products, summary);
}

async function listProducts({ category, size, color, minPrice, maxPrice, sort, page = 1 }) {
  const where = { active: true };
  const variantWhere = {};

  if (minPrice) where.basePrice = { ...where.basePrice, [Op.gte]: minPrice };
  if (maxPrice) where.basePrice = { ...where.basePrice, [Op.lte]: maxPrice };
  if (size) variantWhere.size = size;
  if (color) variantWhere.color = color;

  const include = [
    { model: ProductVariant, as: 'variants', required: !!(size || color), where: Object.keys(variantWhere).length ? variantWhere : undefined },
    { model: ProductImage, as: 'images', separate: true, order: [['order', 'ASC']] },
    { model: Category, as: 'category', required: !!category, where: category ? { slug: category } : undefined },
  ];

  const { rows, count } = await Product.findAndCountAll({
    where,
    include,
    distinct: true,
    order: SORT_MAP[sort] || SORT_MAP.newest,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const summary = await getRatingSummary(rows.map((r) => r.id));

  return { data: attachRatings(rows, summary), page: Number(page), totalPages: Math.ceil(count / PAGE_SIZE), total: count };
}

async function getProductBySlug(slug) {
  const product = await Product.findOne({
    where: { slug, active: true },
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images', separate: true, order: [['order', 'ASC']] },
      { model: Category, as: 'category' },
    ],
  });
  if (!product) throw ApiError.notFound('Produto não encontrado');

  const summary = await getRatingSummary([product.id]);
  const json = product.toJSON();
  json.avgRating = summary[product.id]?.avgRating ?? null;
  json.reviewCount = summary[product.id]?.reviewCount ?? 0;
  return json;
}

async function searchProducts(query) {
  return Product.findAll({
    where: {
      active: true,
      [Op.or]: [
        { name: { [Op.iLike]: `%${query}%` } },
        { description: { [Op.iLike]: `%${query}%` } },
      ],
    },
    limit: 10,
    include: [{ model: ProductImage, as: 'images', separate: true, limit: 1, order: [['order', 'ASC']] }],
  });
}

async function listCategories() {
  return Category.findAll({ order: [['name', 'ASC']] });
}

// --- Admin ---

const ADMIN_PAGE_SIZE = 30;

/**
 * Lista produtos para o painel administrativo — ao contrário de listProducts
 * (loja pública), inclui produtos inativos, já que o operador precisa
 * encontrá-los para reativar ou ajustar estoque.
 */
async function listProductsForAdmin({ search, page = 1 } = {}) {
  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { slug: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: Category, as: 'category' },
      { model: ProductImage, as: 'images', separate: true, limit: 1, order: [['order', 'ASC']] },
    ],
    distinct: true,
    order: [['createdAt', 'DESC']],
    limit: ADMIN_PAGE_SIZE,
    offset: (page - 1) * ADMIN_PAGE_SIZE,
  });

  return { data: rows, page: Number(page), totalPages: Math.ceil(count / ADMIN_PAGE_SIZE), total: count };
}

async function getProductForAdmin(id, { transaction } = {}) {
  const product = await Product.findByPk(id, {
    include: [
      { model: ProductVariant, as: 'variants' },
      { model: ProductImage, as: 'images', separate: true, order: [['order', 'ASC']] },
      { model: Category, as: 'category' },
    ],
    transaction,
  });
  if (!product) throw ApiError.notFound('Produto não encontrado');
  return product;
}

async function createProduct(payload) {
  const created = await sequelize.transaction(async (transaction) => {
    const product = await Product.create({
      categoryId: payload.categoryId,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      fabric: payload.fabric,
      careInstructions: payload.careInstructions,
      basePrice: payload.basePrice,
      featuredSlot: payload.featuredSlot || null,
      badgeLabel: payload.badgeLabel || null,
      imageFocalPoint: payload.imageFocalPoint || 'center',
      active: payload.active ?? true,
    }, { transaction });

    if (Array.isArray(payload.variants)) {
      await ProductVariant.bulkCreate(
        payload.variants.map((v) => ({ ...v, productId: product.id })),
        { transaction }
      );
    }
    if (Array.isArray(payload.images)) {
      await ProductImage.bulkCreate(
        payload.images.map((img, idx) => ({ url: img.url, order: img.order ?? idx, productId: product.id })),
        { transaction }
      );
    }
    return product;
  });

  return getProductForAdmin(created.id);
}

async function updateProduct(id, payload) {
  await sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(id, { transaction });
    if (!product) throw ApiError.notFound('Produto não encontrado');

    const { variants, images, ...productFields } = payload;
    await product.update(productFields, { transaction });

    // Variações: atualiza as que já têm id, cria as novas. Nunca exclui aqui
    // — remover uma variação com pedidos associados quebraria o histórico
    // (FK RESTRICT em order_items); para "aposentar" uma variação, zere o
    // estoque em vez de excluí-la.
    if (Array.isArray(variants)) {
      for (const variant of variants) {
        if (variant.id) {
          await ProductVariant.update(
            {
              size: variant.size,
              color: variant.color,
              sku: variant.sku,
              stockQuantity: variant.stockQuantity,
              priceOverride: variant.priceOverride ?? null,
              weightKg: variant.weightKg ?? null,
              heightCm: variant.heightCm ?? null,
              widthCm: variant.widthCm ?? null,
              lengthCm: variant.lengthCm ?? null,
            },
            { where: { id: variant.id, productId: id }, transaction }
          );
        } else {
          await ProductVariant.create({ ...variant, productId: id }, { transaction });
        }
      }
    }

    // Imagens: substitui a lista inteira — não há histórico de pedido
    // dependente de imagem, então é seguro recriar do zero a cada edição.
    if (Array.isArray(images)) {
      await ProductImage.destroy({ where: { productId: id }, transaction });
      await ProductImage.bulkCreate(
        images.map((img, idx) => ({ url: img.url, order: img.order ?? idx, productId: id })),
        { transaction }
      );
    }
  });

  // Recarrega após o commit — mais simples e seguro do que depender de
  // includes com separate:true enxergarem a transação em aberto.
  return getProductForAdmin(id);
}

async function deactivateProduct(id) {
  // Exclusão lógica: preserva o histórico de order_items (documento 3, seção 4)
  const product = await Product.findByPk(id);
  if (!product) throw ApiError.notFound('Produto não encontrado');
  await product.update({ active: false });
}

/**
 * Exclusão DEFINITIVA — remove o produto de verdade do banco, com variações,
 * imagens, avaliações e favoritos em cascata. Só é permitida quando o
 * produto NUNCA apareceu em nenhum pedido: order_items.variant_id tem
 * RESTRICT no banco de propósito, então tentar excluir um produto já
 * vendido quebraria o histórico financeiro — em vez de deixar o banco
 * rejeitar com um erro de constraint, o service checa antes e devolve uma
 * mensagem clara orientando a usar "desativar" nesse caso.
 */
async function deleteProductPermanently(id) {
  const product = await Product.findByPk(id, { include: [{ model: ProductVariant, as: 'variants' }] });
  if (!product) throw ApiError.notFound('Produto não encontrado');

  const variantIds = (product.variants || []).map((v) => v.id);
  if (variantIds.length > 0) {
    const orderItemCount = await sequelize.models.OrderItem.count({ where: { variantId: variantIds } });
    if (orderItemCount > 0) {
      throw ApiError.conflict(
        'Este produto já foi vendido — excluir apagaria o histórico de pedidos que o contêm. Use "desativar" para tirá-lo da loja sem perder esse histórico.',
        'product_has_orders'
      );
    }
  }

  await product.destroy(); // cascade remove variações, imagens, avaliações e favoritos (ver migrations)
}

async function reactivateProduct(id) {
  const product = await Product.findByPk(id);
  if (!product) throw ApiError.notFound('Produto não encontrado');
  await product.update({ active: true });
  return product;
}

/**
 * Ativa/desativa vários produtos de uma vez — mesma exclusão lógica de
 * deactivateProduct/reactivateProduct, só que em lote. IDs que não existem
 * são silenciosamente ignorados (não é erro pedir pra ativar um produto que
 * já foi excluído de outro jeito entre a seleção e o clique); o retorno diz
 * quantos foram realmente afetados, pra a tela poder avisar se algo ficou
 * de fora.
 */
async function bulkSetActive(ids, active) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('Informe ao menos um id de produto');
  }
  const [affectedCount] = await Product.update({ active }, { where: { id: ids } });
  return { requested: ids.length, updated: affectedCount };
}

/**
 * Reajusta o preço-base de vários produtos de uma vez, por percentual
 * (positivo = aumento, negativo = redução). Não altera priceOverride de
 * variações individuais — só o preço-base do produto.
 */
async function bulkAdjustPrice(ids, percentage) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('Informe ao menos um id de produto');
  }
  if (typeof percentage !== 'number' || Number.isNaN(percentage)) {
    throw ApiError.badRequest('percentage precisa ser um número');
  }
  if (percentage <= -100) {
    throw ApiError.badRequest('O percentual de redução não pode ser -100% ou menor (preço ficaria zero ou negativo)');
  }

  const multiplier = 1 + percentage / 100;
  const [affectedCount] = await Product.update(
    { basePrice: sequelize.literal(`ROUND((base_price * ${multiplier})::numeric, 2)`) },
    { where: { id: ids } }
  );
  return { requested: ids.length, updated: affectedCount };
}

module.exports = {
  listProducts,
  getProductBySlug,
  searchProducts,
  listCategories,
  createProduct,
  updateProduct,
  deactivateProduct,
  deleteProductPermanently,
  reactivateProduct,
  bulkSetActive,
  bulkAdjustPrice,
  listProductsForAdmin,
  getProductForAdmin,
  listFeaturedProducts,
};
