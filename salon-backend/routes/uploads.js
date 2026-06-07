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
      // Ensure incoming data is a PDF data URL
      const mimeMatch = String(data || '').match(/^data:([^;]+);base64,/);
      if (!mimeMatch || mimeMatch[1].toLowerCase() !== 'application/pdf') {
        return res.status(400).json({ message: 'Uploaded data is not a PDF (expected data:application/pdf;base64,...)' });
      }

      // data may include data:<mime>;base64, prefix
      const base64 = data.replace(/^data:.*;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');

      // Build a safe public id from filename (without extension)
      const safeName = (filename || `receipt_${Date.now()}`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const nameNoExt = safeName.replace(/\.pdf$/i, '');
      const publicId = `salonpro_receipts/${Date.now()}_${nameNoExt}`;

      // Upload buffer via upload_stream, forcing resource_type raw and public_id so Cloudinary preserves file type
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'raw', public_id: publicId }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        stream.end(buffer);
      });

      // Ensure Cloudinary recognized the upload as a PDF
      if (uploadResult && String(uploadResult.format || '').toLowerCase() !== 'pdf') {
        // Attempt to remove the uploaded resource to avoid orphaned files
        try { if (uploadResult.public_id) await cloudinary.uploader.destroy(uploadResult.public_id, { resource_type: 'raw' }); } catch (e) { /* ignore */ }
        return res.status(500).json({ message: 'Upload succeeded but Cloudinary did not recognize the file as PDF' });
      }

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
