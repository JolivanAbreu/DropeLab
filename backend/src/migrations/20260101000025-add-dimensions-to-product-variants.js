'use strict';
// Pré-requisito pra cotação de frete real (Melhor Envio) — a API deles
// exige peso e dimensões por item. Nullable de propósito: produtos
// cadastrados antes desta migration não têm esse dado, e o service de
// frete aplica um valor padrão razoável pra roupa dobrada nesse caso (ver
// integrations/melhorEnvio.js), em vez de travar a cotação.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('product_variants', 'weight_kg', {
      type: Sequelize.DECIMAL(6, 3),
      allowNull: true,
    });
    await queryInterface.addColumn('product_variants', 'height_cm', {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('product_variants', 'width_cm', {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('product_variants', 'length_cm', {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('product_variants', 'weight_kg');
    await queryInterface.removeColumn('product_variants', 'height_cm');
    await queryInterface.removeColumn('product_variants', 'width_cm');
    await queryInterface.removeColumn('product_variants', 'length_cm');
  },
};
