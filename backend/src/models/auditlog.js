'use strict';
module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    actorId: { type: DataTypes.UUID, field: 'actor_id' },
    actorName: { type: DataTypes.STRING(150), allowNull: false, field: 'actor_name' },
    actorEmail: { type: DataTypes.STRING(150), allowNull: false, field: 'actor_email' },
    action: { type: DataTypes.STRING(60), allowNull: false },
    entityType: { type: DataTypes.STRING(40), allowNull: false, field: 'entity_type' },
    entityId: { type: DataTypes.UUID, field: 'entity_id' },
    details: { type: DataTypes.JSONB },
  }, {
    tableName: 'audit_logs',
    underscored: true,
    updatedAt: false,
  });

  return AuditLog;
};
