const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const connectDB = require('./db');
const { apiLimiter } = require('./middleware/rateLimiter');

dotenv.config();
connectDB();

const app = express();
app.set('trust proxy', 1); // Required for Render (reverse proxy)

const rateLimit = require('express-rate-limit');
const adminAuth = require('./middleware/adminAuth');
const adminRouter = require('./routes/admin');

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: { msg: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use((req, res, next) => {
  const allowedOrigins = [
    'https://complete-salon-management.vercel.app',
    process.env.ADMIN_PORTAL_URL
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://complete-salon-management.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(express.json({ limit: '10mb' }));

app.use('/api', apiLimiter);

// Specific admin login rate limiting
app.use('/api/admin/login', adminLoginLimiter);

// Admin routes mount
app.use('/api/admin', adminAuth, adminRouter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', t: Date.now() }));

app.get('/', (req, res) => res.json({ message: 'SalonPro API is running 🚀' }));

app.use((req, res, next) => {
    res.status(404).json({ msg: 'API route not found' });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;