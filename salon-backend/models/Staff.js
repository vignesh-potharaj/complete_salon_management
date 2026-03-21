const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  role:          { type: String, required: true },
  phone:         { type: String, required: true },
  commission:    { type: Number, default: 0 },  // percentage
  totalRevenue:  { type: Number, default: 0 },
  status:        { type: String, enum: ['Present', 'Absent'], default: 'Present' },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);