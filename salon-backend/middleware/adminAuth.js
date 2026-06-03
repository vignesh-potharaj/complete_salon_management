const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // If request is to login or webhook, bypass middleware
  const path = req.path || '';
  const originalUrl = req.originalUrl || '';
  if (
    path === '/login' || 
    path === '/razorpay/webhook' || 
    path === '/api/admin/login' || 
    path === '/api/admin/razorpay/webhook' ||
    originalUrl.endsWith('/login') ||
    originalUrl.endsWith('/webhook') ||
    originalUrl.includes('/razorpay/webhook')
  ) {
    return next();
  }

  // Get token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ msg: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ msg: 'Access denied: not a superadmin' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ msg: 'Token is invalid or expired' });
  }
};
