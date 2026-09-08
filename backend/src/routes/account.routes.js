const router = require('express').Router();
const controller = require('../controllers/account.controller');
const { authenticate } = require('../middlewares/auth');

router.get('/account', authenticate, controller.getMe);
router.put('/account', authenticate, controller.updateMe);
router.put('/account/email', authenticate, controller.changeEmail);
router.put('/account/password', authenticate, controller.changePassword);
router.get('/account/export', authenticate, controller.exportData);
router.delete('/account', authenticate, controller.deleteAccount);

router.post('/account/2fa/setup', authenticate, controller.startTwoFactorSetup);
router.post('/account/2fa/confirm', authenticate, controller.confirmTwoFactorSetup);
router.post('/account/2fa/disable', authenticate, controller.disableTwoFactor);

module.exports = router;
