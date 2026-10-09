import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Chat from './models/Chat.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Verify MONGO_URI exists
if (!process.env.MONGO_URI) {
  console.error('❌ ERROR: MONGO_URI is missing in server/.env file!');
  process.exit(1);
}

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Initialize Gemini API SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Route: Get history for a specific user session
app.get('/api/chat/:sessionId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ sessionId: req.params.sessionId });
    res.json(chat ? chat.messages : []);
  } catch (err) {
    console.error('Error retrieving messages:', err);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Route: Send message to Gemini and update isolated user history
app.post('/api/chat', async (req, res) => {
  const { sessionId, userId, message } = req.body;

  // Fallback userId to sessionId if userId is not explicitly passed
  const activeUserId = userId || sessionId;

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    let chat = await Chat.findOne({ sessionId });
    if (!chat) {
      chat = new Chat({ userId: activeUserId, sessionId, messages: [] });
    }

    // Append user input
    chat.messages.push({ sender: 'user', text: message });

    // Build context history for multi-turn chat memory
    const contents = chat.messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // Generate completion with context
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
    });

    const botText = response.text || 'No response generated.';

    // Append model output
    chat.messages.push({ sender: 'model', text: botText });
    await chat.save();

    res.json({ messages: chat.messages });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Error generating AI response' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LLM Chat Server running on http://localhost:${PORT}`);
});