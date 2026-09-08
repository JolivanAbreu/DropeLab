'use strict';
// Registro de ações administrativas sensíveis (troca de perfil, exclusão,
// reajuste em massa, etc.) — "quem fez o quê e quando", além do que os logs
// de aplicação padrão capturam. actor_name/actor_email são uma FOTOGRAFIA
// do autor no momento da ação (não uma referência viva) — assim o registro
// continua legível mesmo que aquele usuário seja excluído ou renomeado
// depois; por isso não há FK para users aqui.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      actor_id: { type: Sequelize.UUID, allowNull: true },
      actor_name: { type: Sequelize.STRING(150), allowNull: false },
      actor_email: { type: Sequelize.STRING(150), allowNull: false },
      action: { type: Sequelize.STRING(60), allowNull: false },
      entity_type: { type: Sequelize.STRING(40), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      details: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['created_at']);
    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('audit_logs');
  },
};
