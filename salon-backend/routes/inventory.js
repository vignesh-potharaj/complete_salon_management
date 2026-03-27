const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const InventoryItem = require('../models/InventoryItem');

// Validation middleware
const inventoryValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be non-negative'),
  body('sellPrice').isFloat({ min: 0 }).withMessage('Sell price must be non-negative')
    .custom((value, { req }) => {
      if (parseFloat(value) <= parseFloat(req.body.costPrice)) {
        throw new Error('Selling price must be greater than cost price');
      }
      return true;
    })
];

// GET /api/inventory
router.get('/', auth, async (req, res, next) => {
  try {
    const items = await InventoryItem.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/low-stock
router.get('/low-stock', auth, async (req, res, next) => {
  try {
    const items = await InventoryItem.find({ 
      userId: req.user.userId,
      $expr: { $lte: ['$stock', '$minStock'] }
    }).sort({ stock: 1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory
router.post('/', [auth, inventoryValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const newItem = new InventoryItem({
      ...req.body,
      userId: req.user.userId
    });
    const item = await newItem.save();
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/:id
router.put('/:id', [auth, inventoryValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    let item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Inventory Item not found' });
    if (item.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    item = await InventoryItem.findOneAndUpdate({ _id: req.params.id, userId: req.user.userId }, { $set: req.body }, { new: true });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Inventory Item not found' });
    if (item.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    await InventoryItem.deleteOne({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Inventory Item removed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/:id/adjust-stock
router.post('/:id/adjust-stock', auth, async (req, res, next) => {
  try {
    const { adjustment } = req.body;
    
    let item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Inventory Item not found' });
    if (item.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    item.stock += Number(adjustment);
    await item.save();

    res.json(item);
  } catch (err) {
    next(err);
  }
});

module.exports = router;