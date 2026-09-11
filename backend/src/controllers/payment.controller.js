const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const paymentService = require('../services/payment.service');

const generatePixCharge = asyncHandler(async (req, res) => {
  const { order_id: orderId, identification_number: identificationNumber } = req.body;
  if (!orderId) throw ApiError.badRequest('order_id é obrigatório');

  const result = await paymentService.generatePixCharge(req.user.id, { orderId, identificationNumber });
  res.status(201).json(result);
});

const getPixStatus = asyncHandler(async (req, res) => {
  const result = await paymentService.getPixStatus(req.user.id, req.params.orderId);
  res.json(result);
});

const webhook = asyncHandler(async (req, res) => {
  const dataId = req.query['data.id'] || req.body?.data?.id;
  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  if (!dataId) return res.status(200).json({ ignored: true });

  await paymentService.handleWebhook({ dataId, xSignature, xRequestId });
  res.status(200).json({ received: true });
});

module.exports = { generatePixCharge, getPixStatus, webhook };
