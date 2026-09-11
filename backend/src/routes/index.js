const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const promoBannerService = require('../services/promoBanner.service');
const newsletterService = require('../services/newsletter.service');
const instagramPostService = require('../services/instagramPost.service');

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Endpoint dedicado (em vez de embutir no build) pra trocar sem rebuild.
router.get('/store-info', (req, res) => {
  res.json({
    storeName: 'Dravennx',
    whatsappNumber: process.env.STORE_WHATSAPP_NUMBER || null,
  });
});

router.get('/promo-banner', asyncHandler(async (req, res) => {
  res.json(await promoBannerService.getPromoBanner());
}));

router.post('/newsletter/subscribe', asyncHandler(async (req, res) => {
  const subscriber = await newsletterService.subscribe(req.body.email);
  res.status(201).json({ email: subscriber.email });
}));

router.get('/instagram-posts', asyncHandler(async (req, res) => {
  res.json(await instagramPostService.listActivePosts());
}));

// Cada sub-router aplica authenticate/requireRole por rota individual —
// nunca via router.use(authenticate) sem prefixo, ou intercepta TODA rota
// montada depois dele na pilha (já causou bug real: /health bloqueado).
router.use(require('./auth.routes'));
router.use(require('./account.routes'));
router.use(require('./product.routes'));
router.use(require('./cart.routes'));
router.use(require('./order.routes'));
// Pix antecipado — só usado quando o frete é por transportadora real
// (sem entregador pra combinar pagamento na entrega).
router.use(require('./payment.routes'));
router.use(require('./address.routes'));
router.use(require('./wishlist.routes'));
router.use(require('./admin.routes'));

module.exports = router;
