const rateLimit = require('express-rate-limit');

// Login — max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs:   15 * 60 * 1000,
  max:        10,
  message:    { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false
});

// Register — max 5 accounts per hour per IP
const registerLimiter = rateLimit({
  windowMs:   60 * 60 * 1000,
  max:        5,
  message:    { message: 'Too many accounts created from this IP. Please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders:   false
});

// General API — max 100 requests per 10 minutes per IP
const apiLimiter = rateLimit({
  windowMs:   10 * 60 * 1000,
  max:        100,
  message:    { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false
});

module.exports = { loginLimiter, registerLimiter, apiLimiter };