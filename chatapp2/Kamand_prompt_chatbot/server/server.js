const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const Message = require('./models/Message');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const MONGO_URI = "mongodb+srv://sarthakmishra05:Sarthak%40123@chatapp.fwsctrc.mongodb.net/chatapp?appName=chatapp";

mongoose.connect(MONGO_URI, { autoSelectFamily: false })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err));

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); // <-- Mounted here!

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
      const { senderId, recipientId, message } = data;
      
      // Save message to MongoDB
      const newMessage = new Message({ sender: senderId, recipient: recipientId, message });
      await newMessage.save();

      // Send to recipient if online
      const recipientSocketId = activeUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_private_message', newMessage);
      }
      
      // Send back to sender so it displays on their screen too
      socket.emit('receive_private_message', newMessage);
    } catch (err) {
      console.log('Error saving message:', err);
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