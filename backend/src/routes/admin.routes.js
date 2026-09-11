const router = require('express').Router();
const controller = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/rbac');
const { upload } = require('../middlewares/upload');

// Usuários — só admin (mudar perfil e redefinir senha são ações sensíveis)
router.get('/admin/users', authenticate, requireRole('admin'), controller.listUsers);
router.put('/admin/users/:id/role', authenticate, requireRole('admin'), controller.setUserRole);
router.post('/admin/users/:id/reset-password', authenticate, requireRole('admin'), controller.resetUserPassword);

// Produtos e estoque — leitura pra admin/operador, escrita só admin
router.get('/admin/products', authenticate, requireRole('admin', 'operator'), controller.listProducts);
router.get('/admin/products/:id', authenticate, requireRole('admin', 'operator'), controller.getProduct);
router.post('/admin/products', authenticate, requireRole('admin'), controller.createProduct);
router.put('/admin/products/:id', authenticate, requireRole('admin'), controller.updateProduct);
router.delete('/admin/products/:id', authenticate, requireRole('admin'), controller.deactivateProduct);
router.delete('/admin/products/:id/permanently', authenticate, requireRole('admin'), controller.deleteProductPermanently);
router.put('/admin/products/:id/reactivate', authenticate, requireRole('admin'), controller.reactivateProduct);
router.post('/admin/products/bulk-active', authenticate, requireRole('admin'), controller.bulkSetActive);
router.post('/admin/products/bulk-price', authenticate, requireRole('admin'), controller.bulkAdjustPrice);
router.put('/admin/variants/:variantId/stock', authenticate, requireRole('admin', 'operator'), controller.adjustStock);

router.post('/admin/uploads', authenticate, requireRole('admin'), upload.single('image'), controller.uploadImage);

// Pedidos — administrador e operador
router.get('/admin/orders', authenticate, requireRole('admin', 'operator'), controller.listOrders);
router.get('/admin/orders/:id', authenticate, requireRole('admin', 'operator'), controller.getOrder);
router.put('/admin/orders/:id/status', authenticate, requireRole('admin', 'operator'), controller.updateOrderStatus);

// Cupons — administrador
router.post('/admin/coupons', authenticate, requireRole('admin'), controller.createCoupon);
router.get('/admin/coupons', authenticate, requireRole('admin'), controller.listCoupons);
router.put('/admin/coupons/:id', authenticate, requireRole('admin'), controller.updateCoupon);
router.put('/admin/coupons/:id/active', authenticate, requireRole('admin'), controller.setCouponActive);
router.delete('/admin/coupons/:id', authenticate, requireRole('admin'), controller.deleteCoupon);

// Categorias — leitura pra admin/operador, escrita só admin
router.get('/admin/categories', authenticate, requireRole('admin', 'operator'), controller.listCategories);
router.post('/admin/categories', authenticate, requireRole('admin'), controller.createCategory);
router.put('/admin/categories/:id', authenticate, requireRole('admin'), controller.updateCategory);
router.delete('/admin/categories/:id', authenticate, requireRole('admin'), controller.deleteCategory);

// Banner promocional — leitura pra admin/operador, escrita só admin
router.get('/admin/promo-banner', authenticate, requireRole('admin', 'operator'), controller.getPromoBanner);
router.put('/admin/promo-banner', authenticate, requireRole('admin'), controller.updatePromoBanner);

// Galeria do Instagram — leitura pra admin/operador, escrita só admin
router.get('/admin/instagram-posts', authenticate, requireRole('admin', 'operator'), controller.listInstagramPosts);
router.post('/admin/instagram-posts', authenticate, requireRole('admin'), controller.createInstagramPost);
router.put('/admin/instagram-posts/:id', authenticate, requireRole('admin'), controller.updateInstagramPost);
router.delete('/admin/instagram-posts/:id', authenticate, requireRole('admin'), controller.deleteInstagramPost);

// Dashboard — só admin (dados financeiros, RNF-07)
router.get('/admin/dashboard/metrics', authenticate, requireRole('admin'), controller.dashboardMetrics);

// Relatórios de vendas — restrito a administrador
router.get('/admin/reports/sales', authenticate, requireRole('admin'), controller.salesReport);
router.get('/admin/reports/sales/export', authenticate, requireRole('admin'), controller.salesReportExport);

// Newsletter — leitura pra admin/operador (assinar é só pelo formulário público)
router.get('/admin/newsletter', authenticate, requireRole('admin', 'operator'), controller.listNewsletterSubscribers);
router.get('/admin/newsletter/export', authenticate, requireRole('admin', 'operator'), controller.exportNewsletterSubscribers);

// Log de auditoria — só admin, nem operador vê
router.get('/admin/audit-logs', authenticate, requireRole('admin'), controller.listAuditLogs);

module.exports = router;
