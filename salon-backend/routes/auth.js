const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { validateRegister, validateLogin } = require('../middleware/validators');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRE || '7d'
});

// @route  POST /api/auth/register
router.post('/register', registerLimiter, validateRegister, async (req, res, next) => {
  try {
    const { userId, name, salonName, password } = req.body;

    const exists = await User.findOne({ userId: userId.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'This User ID is already taken. Please choose another.' });
    }

    const user = await User.create({ userId: userId.toLowerCase(), name, salonName, password });

    res.status(201).json({
      _id:       user._id,
      userId:    user.userId,
      name:      user.name,
      salonName: user.salonName,
      role:      user.role,
      token:     generateToken(user._id)
    });
  } catch (error) { next(error); }
});

// @route  POST /api/auth/login
router.post('/login', loginLimiter, validateLogin, async (req, res, next) => {
  try {
    const { userId, password } = req.body;

    const user = await User.findOne({ userId: userId.toLowerCase() });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid User ID or password' });
    }

    res.json({
      _id:       user._id,
      userId:    user.userId,
      name:      user.name,
      salonName: user.salonName,
      role:      user.role,
      token:     generateToken(user._id)
    });
  } catch (error) { next(error); }
});

// @route  GET /api/auth/me
const { protect } = require('../middleware/authMiddleware');
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;