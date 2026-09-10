'use strict';
// Pagamento deixou de acontecer online pelo site — agora é combinado na
// entrega (cartão de crédito/débito na maquininha, dinheiro ou Pix,
// escolhido no checkout só pra o entregador saber o que levar). change_for
// guarda quanto o cliente disse que vai pagar em dinheiro, só quando
// payment_method = 'cash' e ele precisa de troco — o valor do troco em si
// (change_for - total) é calculado na hora de exibir, não armazenado
// separadamente, pra nunca ficar inconsistente com o total do pedido.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('orders', 'payment_method', {
      type: Sequelize.ENUM('credit_card', 'debit_card', 'cash', 'pix'),
      allowNull: false,
      defaultValue: 'cash',
    });
    await queryInterface.addColumn('orders', 'change_for', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'payment_method');
    await queryInterface.removeColumn('orders', 'change_for');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orders_payment_method";');
  },
};
