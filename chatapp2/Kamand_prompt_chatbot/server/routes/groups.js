const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Message = require('../models/Message');

// Create a Group
router.post('/create', async (req, res) => {
  try {
    const { name, adminId, members } = req.body;
    const newGroup = new Group({
      name,
      admin: adminId,
      members
    });
    await newGroup.save();
    res.status(201).json({ ...newGroup.toObject(), isGroup: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Fetch Group Chat History
router.get('/history/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await Message.find({ groupId })
      .populate('sender', 'username')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group history' });
  }
});

module.exports = router;