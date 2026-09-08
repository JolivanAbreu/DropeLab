'use strict';
// Marca quando o lembrete de carrinho abandonado foi enviado pro dono
// daquele carrinho — evita mandar o mesmo e-mail toda vez que o job roda
// enquanto o carrinho continuar parado. Se o cliente voltar e mexer no
// carrinho de novo depois de já ter recebido o lembrete, o job volta a
// considerá-lo elegível (ver jobs/abandonedCart.js).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('carts', 'abandoned_email_sent_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('carts', 'abandoned_email_sent_at');
  },
};
