const express   = require('express');
const router    = express.Router();
const Inventory = require('../models/Inventory');
const { protect } = require('../middleware/authMiddleware');
const { validateInventory } = require('../middleware/validators');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const items = await Inventory.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) { next(err); }
});

router.post('/', validateInventory, async (req, res, next) => {
  try {
    const item = await Inventory.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/:id', validateInventory, async (req, res, next) => {
  try {
    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Product not found' });
    res.json(item);
  } catch (err) { next(err); }
});

// PATCH — adjust stock by delta
router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { delta } = req.body;
    if (typeof delta !== 'number') {
      return res.status(400).json({ message: 'Delta must be a number' });
    }
    const item = await Inventory.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!item) return res.status(404).json({ message: 'Product not found' });
    item.stock = Math.max(0, item.stock + delta);
    await item.save();
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await Inventory.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!item) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
});

module.exports = router;