const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  salonName: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  taxPct: { type: Number, default: 0 },
  currency: { type: String, default: '₹' },
  loyaltyEnabled: { type: Boolean, default: false },
  pointsPerRupee: { type: Number, default: 0 },
  defaultCommission: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
