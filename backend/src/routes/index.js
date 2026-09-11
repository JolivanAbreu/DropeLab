const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const promoBannerService = require('../services/promoBanner.service');
const newsletterService = require('../services/newsletter.service');
const instagramPostService = require('../services/instagramPost.service');

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Dados públicos da loja usados pelo frontend (ex.: número de WhatsApp para
// o contato de "combinar frete com o vendedor") — endpoint dedicado em vez
// de embutir no build do frontend, assim dá pra trocar o número sem rebuild.
router.get('/store-info', (req, res) => {
  res.json({
    storeName: 'Dravennx',
    whatsappNumber: process.env.STORE_WHATSAPP_NUMBER || null,
  });
});

// Banner promocional configurável pelo admin (imagem + textos) — exibido no
// topo da home.
router.get('/promo-banner', asyncHandler(async (req, res) => {
  res.json(await promoBannerService.getPromoBanner());
}));

// Newsletter — formulário do rodapé, público.
router.post('/newsletter/subscribe', asyncHandler(async (req, res) => {
  const subscriber = await newsletterService.subscribe(req.body.email);
  res.status(201).json({ email: subscriber.email });
}));

// Galeria curada do Instagram (posts reais, adicionados manualmente pelo
// admin — ver nota de arquitetura no README do backend).
router.get('/instagram-posts', asyncHandler(async (req, res) => {
  res.json(await instagramPostService.listActivePosts());
}));

// Nota: cada sub-router aplica authenticate/requireRole por rota individual,
// nunca via router.use(authenticate) sem prefixo — como os sub-routers abaixo
// são montados em '/', um router.use() sem path intercepta TODA requisição
// que passa por ele, mesmo as destinadas a outro router mais à frente na pilha
// (isso já causou um bug real: /health e /products ficavam bloqueados por
// exigir token, pois cart.routes rodava antes na cadeia). Ver histórico do
// projeto / testes de integração para o caso que expôs o problema.
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
