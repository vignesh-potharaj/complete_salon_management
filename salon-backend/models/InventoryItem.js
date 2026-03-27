const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String },
  brand: { type: String },
  unit: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  stock: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  sellPrice: { type: Number, default: 0 },
  stockLog: [{
    date: { type: Date, default: Date.now },
    adjustment: { type: Number, required: true },
    reason: { type: String },
    newStock: { type: Number, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
