const express   = require('express');
const cors      = require('cors');
const dotenv    = require('dotenv');
const connectDB = require('./db');

dotenv.config();
connectDB();

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Global API rate limiter — 100 requests per 10 minutes per IP
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/staff',        require('./routes/staff'));
app.use('/api/inventory',    require('./routes/inventory'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/bills',        require('./routes/bills'));

// Health check
app.get('/', (req, res) => res.json({ message: 'SalonPro API is running 🚀' }));

// Error handler
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));