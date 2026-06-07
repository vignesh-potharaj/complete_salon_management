const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// POST /api/uploads/pdf
// Body: { filename, data } where data is a base64 string (with or without data: prefix)
router.post('/pdf', auth, async (req, res, next) => {
  try {
    const { filename, data } = req.body;
    if (!data) return res.status(400).json({ message: 'No file data provided' });

    // Prepare uploads directory
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
    res.json({ url: publicUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
