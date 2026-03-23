const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Settings = require('../models/Settings');

// GET /api/settings
router.get('/', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user.userId });
    
    if (!settings) {
      // Create defaults
      settings = new Settings({
        userId: req.user.userId,
        salonName: 'My Salon'
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/settings
router.put('/', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user.userId });
    
    if (!settings) {
      settings = new Settings({ ...req.body, userId: req.user.userId });
    } else {
      settings = await Settings.findOneAndUpdate(
        { userId: req.user.userId },
        { $set: req.body },
        { new: true }
      );
    }
    
    res.json(settings);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
