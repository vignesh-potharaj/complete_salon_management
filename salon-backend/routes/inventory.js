const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const InventoryItem = require('../models/InventoryItem');

// GET /api/inventory
router.get('/', auth, async (req, res) => {
  try {
    const items = await InventoryItem.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/inventory/low-stock
router.get('/low-stock', auth, async (req, res) => {
  try {
    const items = await InventoryItem.find({ 
      userId: req.user.userId,
      $expr: { $lte: ['$stock', '$minStock'] }
    }).sort({ stock: 1 });
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/inventory
router.post('/', auth, async (req, res) => {
  try {
    const newItem = new InventoryItem({
      ...req.body,
      userId: req.user.userId
    });
    const item = await newItem.save();
    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/inventory/:id
router.put('/:id', auth, async (req, res) => {
  try {
    let item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Inventory Item not found' });
    if (item.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    item = await InventoryItem.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Inventory Item not found' });
    if (item.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    await InventoryItem.findByIdAndRemove(req.params.id);
    res.json({ msg: 'Inventory Item removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/inventory/:id/adjust-stock
router.post('/:id/adjust-stock', auth, async (req, res) => {
  try {
    const { adjustment, reason } = req.body; // adjustment can be positive or negative
    
    let item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Inventory Item not found' });
    if (item.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    item.stock += Number(adjustment);
    
    // Optional: Log the reason in a separate collection if needed in future
    await item.save();

    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;