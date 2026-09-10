'use strict';
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    addressId: { type: DataTypes.UUID, allowNull: false, field: 'address_id' },
    orderNumber: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'order_number' },
    status: {
      type: DataTypes.ENUM(
        'aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado', 'reembolsado'
      ),
      allowNull: false,
      defaultValue: 'aguardando_pagamento',
    },
    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    discount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    shippingCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'shipping_cost' },
    shippingMethod: { type: DataTypes.STRING(30), field: 'shipping_method' },
    shippingMethodName: { type: DataTypes.STRING(100), field: 'shipping_method_name' },
    requiresShippingArrangement: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'requires_shipping_arrangement' },
    shippingContactMethod: { type: DataTypes.STRING(20), field: 'shipping_contact_method' },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    couponCode: { type: DataTypes.STRING(30), field: 'coupon_code' },
    trackingCode: { type: DataTypes.STRING(60), field: 'tracking_code' },
    shippedAt: { type: DataTypes.DATE, field: 'shipped_at' },
    deliveredAt: { type: DataTypes.DATE, field: 'delivered_at' },
    paymentMethod: {
      type: DataTypes.ENUM('credit_card', 'debit_card', 'cash', 'pix'),
      allowNull: false,
      field: 'payment_method',
    },
    changeFor: { type: DataTypes.DECIMAL(10, 2), field: 'change_for' },
  }, {
    tableName: 'orders',
    underscored: true,
  });

  // Transições válidas da máquina de estados do pedido (RF-26 / documento de
  // Arquitetura). O pagamento agora acontece na entrega (cartão físico,
  // dinheiro ou Pix combinado com o entregador) — por isso "pago" deixou de
  // ser um pré-requisito pra separar/enviar o pedido, e passou a ser a
  // confirmação de que o valor foi mesmo recebido, registrada depois de
  // "entregue".
  Order.VALID_TRANSITIONS = {
    aguardando_pagamento: ['em_separacao', 'cancelado'],
    em_separacao: ['enviado', 'cancelado'],
    enviado: ['entregue', 'cancelado'],
    entregue: ['pago', 'reembolsado'],
    pago: ['reembolsado'],
    cancelado: ['reembolsado'],
    reembolsado: [],
  };

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Order.belongsTo(models.Address, { foreignKey: 'addressId', as: 'address' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
    Order.hasMany(models.Payment, { foreignKey: 'orderId', as: 'payments' });
  };

  return Order;
};
