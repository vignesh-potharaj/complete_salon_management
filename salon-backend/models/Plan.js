const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true }, // in Rupees
  period: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
  interval: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plan', planSchema);
