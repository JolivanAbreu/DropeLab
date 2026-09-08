'use strict';
// Assinantes do formulário de newsletter do rodapé — antes o formulário só
// dava preventDefault() e não guardava o e-mail em lugar nenhum. Agora tem
// uma tabela real por trás, e o admin consegue ver/exportar quem assinou.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('newsletter_subscribers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      email: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('newsletter_subscribers');
  },
};
