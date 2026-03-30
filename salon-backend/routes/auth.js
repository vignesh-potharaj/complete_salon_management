const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { generateOTP, sendVerificationCode, sendPasswordResetCode } = require('../emailService');

const User = require('../models/User');

// ─── POST /api/auth/register ───
router.post('/register', [
  registerLimiter,
  body('userId')
    .trim()
    .notEmpty().withMessage('userId is required')
    .isLength({ min: 3, max: 30 }).withMessage('userId must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('userId may only contain letters, numbers, and underscores'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('salonName').trim().notEmpty().withMessage('Salon Name is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { userId, email, name, salonName, password } = req.body;

  try {
    // Check if userId or email already exists
    let existing = await User.findOne({ $or: [{ userId }, { email }] });
    if (existing) {
      if (existing.userId === userId) return res.status(400).json({ message: 'User ID already taken' });
      if (existing.email === email) return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate verification code
    const code = generateOTP();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user (unverified)
    const user = new User({
      userId, email, name, salonName, passwordHash,
      isEmailVerified: false,
      emailVerifyCode: code,
      emailVerifyExpires: codeExpires
    });

    await user.save();

    // Send verification email
    try {
      await sendVerificationCode(email, code, salonName);
    } catch (emailErr) {
      console.error('Email send error:', emailErr.message);
      // Don't fail registration if email fails, user can resend
    }

    res.json({ message: 'Account created. Please verify your email.', userId, email });

  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/verify-email ───
router.post('/verify-email', [
  body('userId').trim().notEmpty().withMessage('userId is required'),
  body('code').trim().notEmpty().withMessage('Verification code is required')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { userId, code } = req.body;

  try {
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isEmailVerified) {
      // Already verified — just issue token
      const payload = { user: { userId: user.userId } };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5 days' });
      return res.json({ token, userId: user.userId, name: user.name, salonName: user.salonName });
    }

    if (user.emailVerifyCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (user.emailVerifyExpires < new Date()) {
      return res.status(400).json({ message: 'Code has expired. Please request a new one.' });
    }

    // Mark as verified
    user.isEmailVerified = true;
    user.emailVerifyCode = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    // Issue JWT
    const payload = { user: { userId: user.userId } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5 days' });

    res.json({ token, userId: user.userId, name: user.name, salonName: user.salonName });

  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/resend-verify ───
router.post('/resend-verify', [
  body('userId').trim().notEmpty().withMessage('userId is required')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const user = await User.findOne({ userId: req.body.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isEmailVerified) return res.json({ message: 'Email already verified' });

    const code = generateOTP();
    user.emailVerifyCode = code;
    user.emailVerifyExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendVerificationCode(user.email, code, user.salonName);
    res.json({ message: 'New verification code sent to your email.' });

  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/forgot-password ───
router.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail()
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      // Don't reveal whether email exists (security)
      return res.json({ message: 'If this email is registered, you will receive a reset code.' });
    }

    const code = generateOTP();
    user.resetPasswordCode = code;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendPasswordResetCode(user.email, code, user.name);
    res.json({ message: 'If this email is registered, you will receive a reset code.' });

  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/reset-password ───
router.post('/reset-password', [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('code').trim().notEmpty().withMessage('Reset code is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { email, code, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid request' });

    if (user.resetPasswordCode !== code) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful! You can now log in.' });

  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ───
router.post('/login', [
  loginLimiter,
  body('userId').notEmpty().withMessage('userId is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { userId, password } = req.body;

  try {
    let user = await User.findOne({ userId });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Block login if email not verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Please verify your email first.', needsVerification: true, userId: user.userId });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    const payload = { user: { userId: user.userId } };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5 days' },
      (err, token) => {
        if (err) return next(err);
        res.json({ token, userId: user.userId, name: user.name, salonName: user.salonName });
      }
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;