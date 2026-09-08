const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { authLimiter } = require('../middlewares/rateLimit');

router.post('/register', authLimiter, controller.register);
router.post('/confirm-email', controller.confirmEmail);
router.post('/login', authLimiter, controller.login);
router.post('/login/2fa', authLimiter, controller.verifyTwoFactorLogin);
router.post('/refresh', controller.refresh);
router.post('/forgot-password', authLimiter, controller.forgotPassword);
router.post('/reset-password', authLimiter, controller.resetPassword);

module.exports = router;
