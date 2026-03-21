const express = require('express');
const router  = express.Router();
const Staff   = require('../models/Staff');
const { protect } = require('../middleware/authMiddleware');
const { validateStaff } = require('../middleware/validators');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const staff = await Staff.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) { next(err); }
});

router.post('/', validateStaff, async (req, res, next) => {
  try {
    const member = await Staff.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(member);
  } catch (err) { next(err); }
});

router.put('/:id', validateStaff, async (req, res, next) => {
  try {
    const member = await Staff.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!member) return res.status(404).json({ message: 'Staff not found' });
    res.json(member);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const member = await Staff.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!member) return res.status(404).json({ message: 'Staff not found' });
    res.json({ message: 'Staff deleted' });
  } catch (err) { next(err); }
});

module.exports = router;