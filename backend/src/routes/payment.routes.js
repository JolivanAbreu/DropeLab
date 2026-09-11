const router = require('express').Router();
const controller = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/auth');

router.post('/payments/pix', authenticate, controller.generatePixCharge);
router.get('/payments/pix/:orderId/status', authenticate, controller.getPixStatus);
// Webhook do Mercado Pago — nunca autenticado (o Mercado Pago não tem como
// enviar um token de sessão nosso); a segurança vem da validação de
// assinatura (x-signature) feita dentro do controller.
router.post('/webhooks/mercadopago', controller.webhook);

module.exports = router;
