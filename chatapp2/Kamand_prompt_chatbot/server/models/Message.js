const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for groups
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // Optional for DMs
  message: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  audioUrl: { type: String, default: '' },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);