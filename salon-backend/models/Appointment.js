const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  service:    { type: String, required: true },
  time:       { type: String, required: true },
  date:       { type: Date, default: Date.now },
  status:     { type: String, enum: ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'], default: 'Upcoming' },
  staff:      { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  amount:     { type: Number, default: 0 },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);