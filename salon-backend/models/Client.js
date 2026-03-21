const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  phone:       { type: String, required: true },
  gender:      { type: String, enum: ['Male', 'Female', 'Other'] },
  email:       { type: String, lowercase: true, trim: true },
  firstVisit:  { type: Date, default: Date.now },
  lastVisit:   { type: Date },
  totalVisits: { type: Number, default: 0 },
  totalSpent:  { type: Number, default: 0 },
  notes:       { type: String },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);