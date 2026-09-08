const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const productService = require('../services/product.service');
const orderService = require('../services/order.service');
const couponService = require('../services/coupon.service');
const stockService = require('../services/stock.service');
const reportService = require('../services/report.service');
const adminUserService = require('../services/adminUser.service');
const categoryService = require('../services/category.service');
const promoBannerService = require('../services/promoBanner.service');
const instagramPostService = require('../services/instagramPost.service');
const newsletterService = require('../services/newsletter.service');
const storageService = require('../integrations/storage');
const auditLogService = require('../services/auditLog.service');
const { sequelize, Coupon, Category } = require('../models');

// --- Usuários ---

const listUsers = asyncHandler(async (req, res) => {
  const { search, role, page } = req.query;
  res.json(await adminUserService.listUsers({ search, role, page }));
});

const setUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!role) throw ApiError.badRequest('role é obrigatório');
  const user = await adminUserService.setUserRole(req.params.id, role, req.user.id);
  await auditLogService.logAction({
    actor: req.user, action: 'user.role_changed', entityType: 'user', entityId: user.id,
    details: { targetEmail: user.email, newRole: user.role },
  });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const result = await adminUserService.resetUserPassword(req.params.id);
  await auditLogService.logAction({
    actor: req.user, action: 'user.password_reset', entityType: 'user', entityId: req.params.id,
  });
  res.json(result);
});

// --- Produtos ---

const listProducts = asyncHandler(async (req, res) => {
  const { search, page } = req.query;
  res.json(await productService.listProductsForAdmin({ search, page }));
});

const getProduct = asyncHandler(async (req, res) => {
  res.json(await productService.getProductForAdmin(req.params.id));
});

const createProduct = asyncHandler(async (req, res) => {
  const { categoryId, name, slug, basePrice } = req.body;
  if (!categoryId || !name || !slug || !basePrice) {
    throw ApiError.badRequest('Campos obrigatórios: categoryId, name, slug, basePrice');
  }
  const product = await productService.createProduct(req.body);
  res.status(201).json(product);
});

const updateProduct = asyncHandler(async (req, res) => {
  res.json(await productService.updateProduct(req.params.id, req.body));
});

const deactivateProduct = asyncHandler(async (req, res) => {
  await productService.deactivateProduct(req.params.id);
  await auditLogService.logAction({ actor: req.user, action: 'product.deactivated', entityType: 'product', entityId: req.params.id });
  res.status(204).send();
});

const deleteProductPermanently = asyncHandler(async (req, res) => {
  await productService.deleteProductPermanently(req.params.id);
  await auditLogService.logAction({ actor: req.user, action: 'product.deleted_permanently', entityType: 'product', entityId: req.params.id });
  res.status(204).send();
});

const reactivateProduct = asyncHandler(async (req, res) => {
  const product = await productService.reactivateProduct(req.params.id);
  await auditLogService.logAction({ actor: req.user, action: 'product.reactivated', entityType: 'product', entityId: req.params.id });
  res.json(product);
});

const bulkSetActive = asyncHandler(async (req, res) => {
  const { ids, active } = req.body;
  if (typeof active !== 'boolean') throw ApiError.badRequest('active precisa ser true ou false');
  const result = await productService.bulkSetActive(ids, active);
  await auditLogService.logAction({
    actor: req.user, action: active ? 'product.bulk_activated' : 'product.bulk_deactivated', entityType: 'product',
    details: { ids, updated: result.updated },
  });
  res.json(result);
});

const bulkAdjustPrice = asyncHandler(async (req, res) => {
  const { ids, percentage } = req.body;
  const result = await productService.bulkAdjustPrice(ids, Number(percentage));
  await auditLogService.logAction({
    actor: req.user, action: 'product.bulk_price_adjusted', entityType: 'product',
    details: { ids, percentage: Number(percentage), updated: result.updated },
  });
  res.json(result);
});

const adjustStock = asyncHandler(async (req, res) => {
  const { delta, reason } = req.body;
  if (delta === undefined || !reason) throw ApiError.badRequest('delta e reason são obrigatórios');
  const variant = await stockService.adjustStock(req.params.variantId, Number(delta), reason);
  res.json(variant);
});

// --- Pedidos ---

const listOrders = asyncHandler(async (req, res) => {
  const { status, search, page } = req.query;
  res.json(await orderService.listAllOrders({ status, search, page }));
});

const getOrder = asyncHandler(async (req, res) => {
  res.json(await orderService.getOrderById(null, req.params.id));
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, trackingCode } = req.body;
  if (!status) throw ApiError.badRequest('status é obrigatório');
  const order = await orderService.updateOrderStatus(req.params.id, status, {
    trackingCode,
    transitions: orderService.ADMIN_VALID_TRANSITIONS,
  });
  await auditLogService.logAction({
    actor: req.user, action: 'order.status_changed', entityType: 'order', entityId: req.params.id,
    details: { orderNumber: order.orderNumber, newStatus: status, trackingCode: trackingCode || null },
  });
  res.json(order);
});

// --- Cupons ---

const createCoupon = asyncHandler(async (req, res) => {
  const { code, discountType, discountValue, validFrom, validUntil } = req.body;
  if (!code || !discountType || !discountValue || !validFrom || !validUntil) {
    throw ApiError.badRequest('Campos obrigatórios: code, discountType, discountValue, validFrom, validUntil');
  }
  res.status(201).json(await couponService.createCoupon(req.body));
});

const listCoupons = asyncHandler(async (req, res) => {
  res.json(await couponService.listCoupons());
});

const setCouponActive = asyncHandler(async (req, res) => {
  const { active } = req.body;
  const coupon = await couponService.setCouponActive(req.params.id, !!active);
  await auditLogService.logAction({
    actor: req.user, action: active ? 'coupon.activated' : 'coupon.deactivated', entityType: 'coupon', entityId: req.params.id,
    details: { code: coupon.code },
  });
  res.json(coupon);
});

const updateCoupon = asyncHandler(async (req, res) => {
  res.json(await couponService.updateCoupon(req.params.id, req.body));
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByPk(req.params.id);
  await couponService.deleteCoupon(req.params.id);
  await auditLogService.logAction({
    actor: req.user, action: 'coupon.deleted', entityType: 'coupon', entityId: req.params.id,
    details: { code: coupon?.code },
  });
  res.status(204).send();
});

// --- Categorias ---

const listCategories = asyncHandler(async (req, res) => {
  res.json(await categoryService.listCategoriesWithProductCount());
});

const createCategory = asyncHandler(async (req, res) => {
  res.status(201).json(await categoryService.createCategory(req.body));
});

const updateCategory = asyncHandler(async (req, res) => {
  res.json(await categoryService.updateCategory(req.params.id, req.body));
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByPk(req.params.id);
  await categoryService.deleteCategory(req.params.id);
  await auditLogService.logAction({
    actor: req.user, action: 'category.deleted', entityType: 'category', entityId: req.params.id,
    details: { name: category?.name },
  });
  res.status(204).send();
});

// --- Banner promocional (home) ---

const getPromoBanner = asyncHandler(async (req, res) => {
  res.json(await promoBannerService.getPromoBanner());
});

const updatePromoBanner = asyncHandler(async (req, res) => {
  res.json(await promoBannerService.upsertPromoBanner(req.body));
});

// --- Galeria do Instagram ---

const listInstagramPosts = asyncHandler(async (req, res) => {
  res.json(await instagramPostService.listAllPosts());
});

const createInstagramPost = asyncHandler(async (req, res) => {
  res.status(201).json(await instagramPostService.createPost(req.body));
});

const updateInstagramPost = asyncHandler(async (req, res) => {
  res.json(await instagramPostService.updatePost(req.params.id, req.body));
});

const deleteInstagramPost = asyncHandler(async (req, res) => {
  await instagramPostService.deletePost(req.params.id);
  res.status(204).send();
});

// --- Dashboard ---

// --- Upload de imagens ---

const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Nenhum arquivo enviado', 'no_file');

  // Monta a URL de fallback (disco local) a partir da própria requisição —
  // só é usada quando nenhum bucket S3/R2 está configurado (ver
  // integrations/storage.js). Com o bucket configurado, a URL pública vem
  // de lá, não daqui.
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const { url } = await storageService.saveFile({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    requestBaseUrl: baseUrl,
  });
  res.status(201).json({ url });
});

// --- Relatórios ---

const salesReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  res.json(await reportService.getSalesReport({ from, to }));
});

const salesReportExport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const rows = await reportService.getSalesExportRows({ from, to });
  const csv = reportService.rowsToCsv(rows);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-vendas-${Date.now()}.csv"`);
  res.send(csv);
});

// --- Newsletter ---

const listNewsletterSubscribers = asyncHandler(async (req, res) => {
  res.json(await newsletterService.listSubscribers());
});

const exportNewsletterSubscribers = asyncHandler(async (req, res) => {
  const subscribers = await newsletterService.listSubscribers();
  const csv = newsletterService.subscribersToCsv(subscribers);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="newsletter-${Date.now()}.csv"`);
  res.send(csv);
});

const dashboardMetrics = asyncHandler(async (req, res) => {
  const [salesByDay] = await sequelize.query(`
    SELECT DATE(created_at) AS day, COUNT(*) AS orders, SUM(total) AS revenue
    FROM orders
    WHERE status NOT IN ('cancelado') AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY day ASC;
  `);

  const [bestSelling] = await sequelize.query(`
    SELECT p.name, SUM(oi.quantity) AS units_sold
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelado')
    GROUP BY p.name
    ORDER BY units_sold DESC
    LIMIT 10;
  `);

  const [[ticket]] = await sequelize.query(`
    SELECT AVG(total) AS average_ticket
    FROM orders WHERE status NOT IN ('cancelado', 'aguardando_pagamento');
  `);

  const [[pending]] = await sequelize.query(`
    SELECT COUNT(*) AS pending_orders FROM orders WHERE status = 'pago';
  `);

  res.json({
    sales_by_day: salesByDay,
    best_selling_products: bestSelling,
    average_ticket: Number(ticket.average_ticket || 0),
    pending_orders: Number(pending.pending_orders || 0),
  });
});

// --- Log de auditoria ---

const listAuditLogs = asyncHandler(async (req, res) => {
  const { entityType, action, page } = req.query;
  res.json(await auditLogService.listAuditLogs({ entityType, action, page }));
});

module.exports = {
  listUsers, setUserRole, resetUserPassword,
  listProducts, getProduct, createProduct, updateProduct, deactivateProduct, deleteProductPermanently, reactivateProduct, adjustStock,
  bulkSetActive, bulkAdjustPrice,
  uploadImage,
  listOrders, getOrder, updateOrderStatus,
  createCoupon, listCoupons, setCouponActive, updateCoupon, deleteCoupon,
  listCategories, createCategory, updateCategory, deleteCategory,
  getPromoBanner, updatePromoBanner,
  listInstagramPosts, createInstagramPost, updateInstagramPost, deleteInstagramPost,
  salesReport, salesReportExport,
  listNewsletterSubscribers, exportNewsletterSubscribers,
  listAuditLogs,
  dashboardMetrics,
};
