const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  type:  { type: String, enum: ['Service', 'Product'], required: true },
  qty:   { type: Number, required: true },
  price: { type: Number, required: true },
  total: { type: Number, required: true }
}, { _id: false });

const billSchema = new mongoose.Schema({
  clientName: { type: String, required: true, trim: true },
  items:      [billItemSchema],
  subtotal:   { type: Number, required: true },
  gst:        { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Other'],
    default: 'Cash'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Bill', billSchema);