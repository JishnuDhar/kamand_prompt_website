import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: { 
    type: String, 
    enum: ['user', 'model'], 
    required: true 
  },
  text: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

const ChatSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  messages: [MessageSchema]
}, { timestamps: true });

export default mongoose.model('Chat', ChatSchema);