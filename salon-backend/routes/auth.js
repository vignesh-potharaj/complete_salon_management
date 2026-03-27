const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');

// POST /api/auth/register
router.post('/register', [
  body('userId').trim().notEmpty().withMessage('userId is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('salonName').trim().notEmpty().withMessage('Salon Name is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { userId, name, salonName, password } = req.body;

  try {
    let user = await User.findOne({ userId });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({ userId, name, salonName, passwordHash: password });

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);

    await user.save();

    const payload = { user: { userId: user.userId } };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5 days' },
      (err, token) => {
        if (err) return next(err);
        res.json({ token, user: { userId, name, salonName } });
      }
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', [
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
        res.json({ token, user: { userId: user.userId, name: user.name, salonName: user.salonName } });
      }
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;