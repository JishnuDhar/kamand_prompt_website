const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');

// Search users by username
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }
    const users = await User.find({ 
      username: { $regex: query, $options: 'i' } 
    }).select('username _id');
    res.json(users);
  } catch (err) {
    console.error('Search User Error:', err);
    res.status(500).json({ error: 'Server error during search' });
  }
});

// Get recent chat conversations for a user
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      $or: [{ sender: userId }, { recipient: userId }]
    }).populate('sender recipient', 'username');

    const contactMap = new Map();
    messages.forEach(msg => {
      // Handle edge cases if populated fields are null
      if (!msg.sender || !msg.recipient) return;
      
      const isSender = msg.sender._id.toString() === userId;
      const otherUser = isSender ? msg.recipient : msg.sender;

      contactMap.set(otherUser._id.toString(), {
        _id: otherUser._id,
        username: otherUser.username,
        lastMessage: msg.message,
        createdAt: msg.createdAt
      });
    });

    res.json(Array.from(contactMap.values()));
  } catch (err) {
    console.error('Conversations Error:', err);
    res.status(500).json({ error: 'Server error fetching conversations' });
  }
});

// Get message history between two users
router.get('/history/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: otherUserId },
        { sender: otherUserId, recipient: userId }
      ]
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error('History Error:', err);
    res.status(500).json({ error: 'Server error fetching history' });
  }
});

module.exports = router;