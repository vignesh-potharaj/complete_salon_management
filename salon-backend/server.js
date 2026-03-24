const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const connectDB = require('./db');
const { apiLimiter } = require('./middleware/rateLimiter');

dotenv.config();
connectDB();

const app = express();

app.use(helmet());
app.use(cors({ 
    origin: process.env.CLIENT_URL || '*', 
    credentials: true 
})); 
app.use(express.json());

// Global limiters if needed
app.use('/api', apiLimiter); // Uses existing rateLimiter, assuming it exists 

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/services', require('./routes/services'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/', (req, res) => res.json({ message: 'SalonPro API is running 🚀' }));

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ msg: 'API route not found' });
});

// Error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));