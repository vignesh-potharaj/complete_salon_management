const express = require('express');
const router  = express.Router();
const Client  = require('../models/Client');
const { protect } = require('../middleware/authMiddleware');
const { validateClient } = require('../middleware/validators');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const { gender, search } = req.query;
    let query = { createdBy: req.user._id };
    if (gender) query.gender = gender;
    if (search) query.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const clients = await Client.find(query).sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) { next(err); }
});

router.post('/', validateClient, async (req, res, next) => {
  try {
    const client = await Client.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(client);
  } catch (err) { next(err); }
});

router.put('/:id', validateClient, async (req, res, next) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const client = await Client.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted' });
  } catch (err) { next(err); }
});

module.exports = router;