'use strict';
// Suporte a autoexclusão de conta (LGPD) — a exclusão é uma anonimização,
// não uma remoção física: pedidos/pagamentos têm retenção legal (fiscal),
// então a conta é anonimizada e marcada como excluída, em vez de apagada.
// deleted_at também bloqueia login numa conta anonimizada.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'deleted_at');
  },
};
