const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Service = require('../models/Service');

// GET /api/services
router.get('/', auth, async (req, res) => {
  try {
    const services = await Service.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/services
router.post('/', auth, async (req, res) => {
  try {
    const newService = new Service({
      ...req.body,
      userId: req.user.userId
    });
    const service = await newService.save();
    res.json(service);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/services/:id
router.put('/:id', auth, async (req, res) => {
  try {
    let service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ msg: 'Service not found' });
    if (service.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    service = await Service.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(service);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/services/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ msg: 'Service not found' });
    if (service.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    await Service.findByIdAndRemove(req.params.id);
    res.json({ msg: 'Service removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
