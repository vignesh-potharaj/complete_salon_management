const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  salonName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },

  // Email Verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerifyCode: { type: String },
  emailVerifyExpires: { type: Date },

  // Password Reset
  resetPasswordCode: { type: String },
  resetPasswordExpires: { type: Date },

  // Subscription and Admin details
  subscriptionStatus: { type: String, enum: ['trial', 'active', 'expired', 'terminated'], default: 'trial' },
  subscriptionPlan: { type: String, enum: ['starter', 'growth', 'pro'], default: 'starter' },
  subscriptionStartDate: { type: Date },
  subscriptionEndDate: { type: Date },
  razorpayCustomerId: { type: String },
  razorpaySubscriptionId: { type: String },
  lastPaymentDate: { type: Date },
  lastPaymentAmount: { type: Number },
  paymentHistory: [{
    razorpayPaymentId: { type: String },
    amount: { type: Number },
    currency: { type: String },
    status: { type: String },  // 'captured' | 'failed' | 'refunded'
    plan: { type: String },
    paidAt: { type: Date }
  }],
  notificationsSent: [{
    type: { type: String },   // 'renewal_reminder' | 'expiry_warning' | 'terminated' | 'activated' | 'custom'
    message: { type: String },
    sentAt: { type: Date },
    channel: { type: String }  // 'email' | 'in_app'
  }],
  isActive: { type: Boolean, default: true },
  adminNotes: { type: String },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);