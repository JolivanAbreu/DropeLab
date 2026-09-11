'use strict';
// Campos usados só quando payment_method = 'pix_antecipado' (frete por
// transportadora real, sem entregador pra combinar pagamento na entrega).
// pix_payment_id é o ID do pagamento no Mercado Pago (usado pra consultar
// status e casar o webhook com o pedido certo); qr_code/copy_paste são os
// dados de exibição devolvidos na hora de gerar a cobrança.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'pix_payment_id', {
      type: Sequelize.STRING(60),
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'pix_qr_code', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'pix_copy_paste', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'pix_payment_id');
    await queryInterface.removeColumn('orders', 'pix_qr_code');
    await queryInterface.removeColumn('orders', 'pix_copy_paste');
  },
};
