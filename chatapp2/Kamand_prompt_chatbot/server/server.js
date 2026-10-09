const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const Message = require('./models/Message');

const app = express();

// Middleware
app.use(express.json({ limit: '15mb' }));
app.use(cors());

// MongoDB Connection
const MONGO_URI = "mongodb+srv://sarthakmishra05:Sarthak%40123@chatapp.fwsctrc.mongodb.net/chatapp?appName=chatapp";

mongoose.connect(MONGO_URI, { autoSelectFamily: false })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err));

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const activeUsers = new Map(); // Store userId -> socketId

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Register user session
  socket.on('register_user', (userId) => {
    activeUsers.set(userId, socket.id);
  });

  // Handle sending private messages
  socket.on('send_private_message', async (data) => {
    try {
      const { senderId, recipientId, message, imageUrl, audioUrl } = data;
      
      const newMessage = new Message({ 
        sender: senderId, 
        recipient: recipientId, 
        message: message || '', 
        imageUrl: imageUrl || '',
        audioUrl: audioUrl || '',
        reactions: []
      });
      await newMessage.save();

      const recipientSocketId = activeUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_private_message', newMessage);
      }
      
      socket.emit('receive_private_message', newMessage);
    } catch (err) {
      console.log('Error saving message:', err);
    }
  });

  // Handle joining group rooms
  socket.on('join_group', (groupId) => {
    socket.join(groupId);
  });

  // Handle sending group messages
  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, senderId, message, imageUrl, audioUrl } = data;
      
      const newMessage = new Message({
        sender: senderId,
        groupId,
        message: message || '',
        imageUrl: imageUrl || '',
        audioUrl: audioUrl || '',
        reactions: []
      });
      await newMessage.save();

      // Populate sender info for username display in group chat
      await newMessage.populate('sender', 'username');

      // Broadcast to all members in the group room
      io.to(groupId).emit('receive_group_message', newMessage);
    } catch (err) {
      console.log('Error saving group message:', err);
    }
  });

  // Handle adding message reactions (Single reaction override mode for DM & Groups)
  socket.on('add_reaction', async ({ messageId, userId, emoji }) => {
    try {
      const targetMessage = await Message.findById(messageId).populate('sender', 'username');
      if (!targetMessage) return;

      // Check if this user has already reacted to this message
      const existingReactionIndex = targetMessage.reactions.findIndex(
        r => String(r.user) === String(userId)
      );

      if (existingReactionIndex > -1) {
        if (targetMessage.reactions[existingReactionIndex].emoji === emoji) {
          // If they click the exact same emoji again, remove it (toggle off)
          targetMessage.reactions.splice(existingReactionIndex, 1);
        } else {
          // If they click a different emoji, overwrite the old one
          targetMessage.reactions[existingReactionIndex].emoji = emoji;
        }
      } else {
        // Add new reaction if they haven't reacted yet
        targetMessage.reactions.push({ user: userId, emoji });
      }

      await targetMessage.save();

      if (targetMessage.groupId) {
        // Broadcast to group room
        io.to(String(targetMessage.groupId)).emit('message_reaction_updated', targetMessage);
      } else {
        // Broadcast to private DM sender and recipient
        const senderSocketId = activeUsers.get(String(targetMessage.sender?._id || targetMessage.sender));
        const recipientSocketId = activeUsers.get(String(targetMessage.recipient));

        if (senderSocketId) io.to(senderSocketId).emit('message_reaction_updated', targetMessage);
        if (recipientSocketId && recipientSocketId !== senderSocketId) {
          io.to(recipientSocketId).emit('message_reaction_updated', targetMessage);
        }
      }
    } catch (err) {
      console.log('Error updating reaction:', err);
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, sockId] of activeUsers.entries()) {
      if (sockId === socket.id) {
        activeUsers.delete(userId);
        break;
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});