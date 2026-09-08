'use strict';
module.exports = (sequelize, DataTypes) => {
  const NewsletterSubscriber = sequelize.define('NewsletterSubscriber', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'newsletter_subscribers',
    underscored: true,
  });

  return NewsletterSubscriber;
};
