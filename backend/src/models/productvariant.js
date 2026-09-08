'use strict';
module.exports = (sequelize, DataTypes) => {
  const ProductVariant = sequelize.define('ProductVariant', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false, field: 'product_id' },
    size: { type: DataTypes.ENUM('P', 'M', 'G', 'GG', 'XG'), allowNull: false },
    color: { type: DataTypes.STRING(50), allowNull: false },
    sku: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    stockQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'stock_quantity' },
    priceOverride: { type: DataTypes.DECIMAL(10, 2), field: 'price_override' },
    weightKg: { type: DataTypes.DECIMAL(6, 3), field: 'weight_kg' },
    heightCm: { type: DataTypes.DECIMAL(6, 2), field: 'height_cm' },
    widthCm: { type: DataTypes.DECIMAL(6, 2), field: 'width_cm' },
    lengthCm: { type: DataTypes.DECIMAL(6, 2), field: 'length_cm' },
  }, {
    tableName: 'product_variants',
    underscored: true,
    validate: {
      stockNaoNegativo() {
        if (this.stockQuantity < 0) {
          throw new Error('stock_quantity não pode ser negativo');
        }
      },
    },
  });

  ProductVariant.associate = (models) => {
    ProductVariant.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    ProductVariant.hasMany(models.CartItem, { foreignKey: 'variantId', as: 'cartItems' });
    ProductVariant.hasMany(models.OrderItem, { foreignKey: 'variantId', as: 'orderItems' });
  };

  return ProductVariant;
};
