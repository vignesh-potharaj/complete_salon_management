const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary if env vars present
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

// POST /api/uploads/pdf
// Body: { filename, data } where data is a base64 string (with or without data: prefix)
router.post('/pdf', auth, async (req, res, next) => {
  try {
    const { filename, data } = req.body;
    if (!data) return res.status(400).json({ message: 'No file data provided' });
    // If Cloudinary is configured, upload the PDF as a raw resource
    if (cloudinary && cloudinary.config && cloudinary.config().cloud_name) {
      // data may include data:<mime>;base64, prefix
      const base64 = data.replace(/^data:.*;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');

      // Upload buffer via upload_stream
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'raw', folder: 'salonpro_receipts' }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        stream.end(buffer);
      });

      // Return secure URL from Cloudinary. Note: Cloudinary public URLs are long-lived by default.
      return res.json({ url: uploadResult.secure_url, provider: 'cloudinary', raw: uploadResult });
    }

    // If Cloudinary is not configured, we return a 503 so the caller knows uploads are not available
    return res.status(503).json({ message: 'Upload service unavailable: Cloudinary not configured' });
  } catch (err) {
    next(err);
  }
});

// GET /api/uploads/status
// Returns current upload provider state and cleanup configuration (protected)
router.get('/status', auth, async (req, res) => {
  try {
    const cloudConfigured = !!(cloudinary && cloudinary.config && cloudinary.config().cloud_name);
    const cloudName = cloudConfigured ? cloudinary.config().cloud_name : null;
    const ttlEnv = process.env.UPLOAD_TTL_DAYS ? parseInt(process.env.UPLOAD_TTL_DAYS, 10) : (cloudConfigured ? 90 : 7);
    const intervalEnv = process.env.UPLOAD_CLEAN_INTERVAL_HOURS ? parseInt(process.env.UPLOAD_CLEAN_INTERVAL_HOURS, 10) : 24;

    res.json({
      provider: cloudConfigured ? 'cloudinary' : 'none',
      cloudName: cloudName ? ("***" + cloudName.slice(-4)) : null,
      uploadTtlDays: ttlEnv,
      cleanupIntervalHours: intervalEnv,
      note: cloudConfigured ? 'Cloudinary is configured; uploads will be stored in Cloudinary.' : 'Cloudinary not configured; upload endpoint unavailable (returns 503).'
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve upload status', error: err.message });
  }
});

module.exports = router;
