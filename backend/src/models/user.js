'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
    cpf: { type: DataTypes.STRING(14), unique: true },
    phone: { type: DataTypes.STRING(20) },
    role: { type: DataTypes.ENUM('customer', 'operator', 'admin'), allowNull: false, defaultValue: 'customer' },
    emailVerifiedAt: { type: DataTypes.DATE, field: 'email_verified_at' },
    deletedAt: { type: DataTypes.DATE, field: 'deleted_at' },
    twoFactorSecret: { type: DataTypes.STRING(255), field: 'two_factor_secret' },
    twoFactorEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'two_factor_enabled' },
    twoFactorBackupCodes: { type: DataTypes.JSONB, field: 'two_factor_backup_codes' },
  }, {
    tableName: 'users',
    underscored: true,
    defaultScope: { attributes: { exclude: ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes'] } },
    scopes: {
      // Sem exclusão nenhuma — usado tanto pra checar senha no login quanto
      // pra ler/gravar segredo e códigos de backup do 2FA (mesmo escopo
      // serve pros dois, evita duplicar uma segunda variante idêntica).
      withPassword: { attributes: {} },
    },
  });

  User.associate = (models) => {
    User.hasMany(models.Address, { foreignKey: 'userId', as: 'addresses' });
    User.hasOne(models.Cart, { foreignKey: 'userId', as: 'cart' });
    User.hasMany(models.Order, { foreignKey: 'userId', as: 'orders' });
    User.hasMany(models.Review, { foreignKey: 'userId', as: 'reviews' });
    User.hasMany(models.Wishlist, { foreignKey: 'userId', as: 'wishlists' });
  };

  return User;
};
