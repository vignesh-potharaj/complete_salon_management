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
    if (cloudinary.config().cloud_name) {
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

    // Fallback: save to local uploads folder (existing behavior)
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // Clean and create unique filename
    const safeName = (filename || `receipt_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const outName = `${Date.now()}_${safeName}`;
    const filePath = path.join(uploadsDir, outName);

    // data may include data:<mime>;base64, prefix
    const base64 = data.replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    fs.writeFileSync(filePath, buffer);

    // Construct public URL based on request
    const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(outName)}`;
    res.json({ url: publicUrl, provider: 'local' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
