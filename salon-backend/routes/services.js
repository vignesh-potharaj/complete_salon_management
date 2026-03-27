const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Service = require('../models/Service');

// Validation middleware
const serviceValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('durationMins').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
  body('defaultPrice').isFloat({ min: 0 }).withMessage('Price must be a non-negative number')
];

// GET /api/services
router.get('/', auth, async (req, res, next) => {
  try {
    const services = await Service.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    next(err);
  }
});

// POST /api/services
router.post('/', [auth, serviceValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const newService = new Service({
      ...req.body,
      userId: req.user.userId
    });
    const service = await newService.save();
    res.json(service);
  } catch (err) {
    next(err);
  }
});

// PUT /api/services/:id
router.put('/:id', [auth, serviceValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    let service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found' });
    if (service.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    service = await Service.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(service);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/services/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found' });
    if (service.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    await Service.deleteOne({ _id: req.params.id });
    res.json({ message: 'Service removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
