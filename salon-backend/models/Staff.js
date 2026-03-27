const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String },
  commissionPct: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  joinDate: { type: Date, default: Date.now },
  services: [
    {
      name:         { type: String, required: true },
      category:     { type: String, default: 'General' },
      durationMins: { type: Number, default: 30 },
      price:        { type: Number, required: true }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Staff', staffSchema);