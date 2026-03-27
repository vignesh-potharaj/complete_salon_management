module.exports = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}:`, err.message);
  const status = err.status || 500;
  res.status(status).json({ 
    message: err.message || 'An unexpected error occurred' 
  });
};