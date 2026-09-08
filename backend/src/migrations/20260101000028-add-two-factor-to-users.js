'use strict';
// Autenticação de dois fatores (TOTP) — opcional, o usuário ativa por conta
// própria em "Minha conta". two_factor_secret só é preenchido durante o
// fluxo de ativação (fica "pendente" até confirmado com um código válido);
// two_factor_enabled só vira true depois dessa confirmação.
// two_factor_backup_codes guarda hashes (nunca o código em texto puro) de
// códigos de uso único para recuperação de acesso caso o app autenticador
// seja perdido.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'two_factor_secret', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'two_factor_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'two_factor_backup_codes', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'two_factor_secret');
    await queryInterface.removeColumn('users', 'two_factor_enabled');
    await queryInterface.removeColumn('users', 'two_factor_backup_codes');
  },
};
