const { AuditLog } = require('../models');

const PAGE_SIZE = 30;

async function logAction({ actor, action, entityType, entityId, details }) {
  try {
    await AuditLog.create({
      actorId: actor?.id || null,
      actorName: actor?.name || 'Desconhecido',
      actorEmail: actor?.email || 'desconhecido',
      action,
      entityType,
      entityId: entityId || null,
      details: details || null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] falha ao registrar log de auditoria:', err.message);
  }
}

async function listAuditLogs({ entityType, action, page = 1 } = {}) {
  const where = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return { data: rows, total: count, page: Number(page), pageSize: PAGE_SIZE };
}

module.exports = { logAction, listAuditLogs };
