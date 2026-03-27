const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Settings = require('../models/Settings');

// Validation
const settingsValidation = [
  body('salonName').trim().notEmpty().withMessage('Salon name is required')
];

// GET /api/settings
router.get('/', auth, async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ userId: req.user.userId });
    
    if (!settings) {
      settings = new Settings({
        userId: req.user.userId,
        salonName: 'My Salon'
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
router.put('/', [auth, settingsValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    let settings = await Settings.findOne({ userId: req.user.userId });
    
    if (!settings) {
      settings = new Settings({ ...req.body, userId: req.user.userId });
      await settings.save();
    } else {
      settings = await Settings.findOneAndUpdate(
        { userId: req.user.userId },
        { $set: req.body },
        { new: true }
      );
    }
    
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
