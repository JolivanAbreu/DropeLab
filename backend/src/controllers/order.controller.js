const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const orderService = require('../services/order.service');

const create = asyncHandler(async (req, res) => {
  const {
    address_id: addressId, shipping_option_id: shippingOptionId, coupon_code: couponCode,
    payment_method: paymentMethod, change_for: changeFor,
  } = req.body;
  if (!addressId || !shippingOptionId || !paymentMethod) {
    throw ApiError.badRequest('address_id, shipping_option_id e payment_method são obrigatórios');
  }

  const order = await orderService.createOrder(req.user.id, { addressId, shippingOptionId, couponCode, paymentMethod, changeFor });
  res.status(201).json(order);
});

const listMine = asyncHandler(async (req, res) => {
  res.json(await orderService.listOrdersForUser(req.user.id));
});

const getOne = asyncHandler(async (req, res) => {
  res.json(await orderService.getOrderById(req.user.id, req.params.id));
});

const cancel = asyncHandler(async (req, res) => {
  res.json(await orderService.cancelOwnOrder(req.user.id, req.params.id));
});

const remove = asyncHandler(async (req, res) => {
  await orderService.deleteOwnOrder(req.user.id, req.params.id);
  res.status(204).send();
});

module.exports = { create, listMine, getOne, cancel, remove };
