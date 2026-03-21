const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  category:     { type: String, required: true },
  stock:        { type: Number, required: true, default: 0 },
  minStock:     { type: Number, required: true, default: 0 },
  supplier:     { type: String },
  supplierPhone:{ type: String },
  purchasePrice:{ type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Virtual fields
inventorySchema.virtual('status').get(function () {
  return this.stock <= this.minStock ? 'Low' : 'Good';
});
inventorySchema.virtual('reorderQty').get(function () {
  return this.stock < this.minStock ? this.minStock - this.stock : 0;
});
inventorySchema.virtual('totalValue').get(function () {
  return this.stock * this.purchasePrice;
});
inventorySchema.virtual('profitPerUnit').get(function () {
  return this.sellingPrice - this.purchasePrice;
});

inventorySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);