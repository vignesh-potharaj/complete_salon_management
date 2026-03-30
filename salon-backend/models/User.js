const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  salonName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },

  // Email Verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerifyCode: { type: String },
  emailVerifyExpires: { type: Date },

  // Password Reset
  resetPasswordCode: { type: String },
  resetPasswordExpires: { type: Date },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);