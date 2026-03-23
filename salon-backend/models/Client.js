const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  totalVisits: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },
  lastVisit: { type: Date },
  loyaltyPoints: { type: Number, default: 0 },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Client', clientSchema);