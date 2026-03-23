const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String },
  brand: { type: String },
  unit: { type: String, required: true }, // e.g., 'ml', 'bottles'
  stock: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  sellPrice: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
