import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// Automatically use localhost when developing, and your Render backend when live on Netlify
const BACKEND_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : 'https://kamand-prompt-chatbot-backend.onrender.com';

// Dedicated URL for the standalone Gemini LLM Chat application
const LLM_APP_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5174'
  : 'https://your-llm-chat-app.netlify.app'; // Update when deploying live

const socket = io(BACKEND_URL);

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Chat, Search & Conversations States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);

  // Fetch recent conversations on login
  useEffect(() => {
    if (userId) {
      fetch(`${BACKEND_URL}/api/users/conversations/${userId}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setConversations(data);
        })
        .catch((err) => console.log('Error fetching conversations:', err));
    }
  }, [userId]);

  // Register socket connection and handle incoming messages
  useEffect(() => {
    if (userId) {
      socket.emit('register_user', userId);

      socket.on('receive_private_message', (newMessage) => {
        if (
          selectedUser && 
          (String(newMessage.sender) === String(selectedUser._id) || String(newMessage.recipient) === String(selectedUser._id))
        ) {
          setChatLog((prevLog) => {
            const exists = prevLog.some(msg => msg._id === newMessage._id);
            if (exists) return prevLog;
            return [...prevLog, newMessage];
          });
        }

        fetch(`${BACKEND_URL}/api/users/conversations/${userId}`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setConversations(data);
          })
          .catch((err) => console.log('Error updating conversations:', err));
      });

      return () => {
        socket.off('receive_private_message');
      };
    }
  }, [userId, selectedUser]);

  // Fetch message history when selected user changes
  useEffect(() => {
    if (selectedUser && userId) {
      fetch(`${BACKEND_URL}/api/users/history/${userId}/${selectedUser._id}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setChatLog(data);
        })
        .catch((err) => console.log('Error fetching history:', err));
    }
  }, [selectedUser, userId]);

  // Handle User Search
  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/users/search?query=${query}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setSearchResults(data.filter((u) => u._id !== userId));
      }
    } catch (err) {
      console.log('Search error:', err);
    }
  };

  // Handle Authentication Form Submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = { username, password };

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      if (isLogin) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('userId', data.userId);
        setUsername(data.username);
        setUserId(data.userId);
        setToken(data.token);
      } else {
        setSuccessMessage('Registration successful! Please log in.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Send Private Message
  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() !== '' && selectedUser) {
      const messageData = {
        senderId: userId,
        recipientId: selectedUser._id,
        message: message,
      };

      socket.emit('send_private_message', messageData);

      // Instant conversation list preview update
      setConversations((prevConvos) => {
        const existingIndex = prevConvos.findIndex(c => c._id === selectedUser._id);
        const updatedConvo = {
          _id: selectedUser._id,
          username: selectedUser.username,
          lastMessage: message,
          createdAt: new Date().toISOString()
        };

        if (existingIndex > -1) {
          const newConvos = [...prevConvos];
          newConvos[existingIndex] = updatedConvo;
          return newConvos;
        } else {
          return [updatedConvo, ...prevConvos];
        }
      });

      setMessage('');
    }
  };

  if (token) {
    return (
      <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial', background: '#f4f4f9' }}>
        {/* Sidebar */}
        <div style={{ width: '320px', background: 'white', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '15px', background: '#007bff', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Chats</h3>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Button to Switch to Gemini LLM Chat App with active userId in URL */}
              <a
                href={`${LLM_APP_URL}?userId=${userId}`}
                style={{
                  padding: '5px 10px',
                  background: '#17a2b8',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Switch to Gemini AI Assistant"
              >
                ✨ AI Chat
              </a>

              {/* Logout Button */}
              <button 
                onClick={() => {
                  localStorage.clear();
                  setToken('');
                  setUserId('');
                }}
                style={{ padding: '5px 10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
              >
                Logout
              </button>
            </div>
          </div>

          <div style={{ padding: '10px', background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
            <input 
              type="text" 
              placeholder="Search new username..." 
              value={searchQuery}
              onChange={handleSearch}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          {searchQuery && (
            <div style={{ background: '#fff', borderBottom: '1px solid #ddd', maxHeight: '150px', overflowY: 'auto' }}>
              <div style={{ padding: '6px 10px', fontSize: '11px', color: '#888', background: '#f1f1f1' }}>Search Results</div>
              {Array.isArray(searchResults) && searchResults.map((user) => (
                <div 
                  key={user._id} 
                  onClick={() => {
                    setSelectedUser(user);
                    setSearchQuery('');
                    setSearchResults([]);
                    if (!conversations.some(c => c._id === user._id)) {
                      setConversations([{ _id: user._id, username: user.username, lastMessage: '' }, ...conversations]);
                    }
                  }}
                  style={{ padding: '10px 15px', borderBottom: '1px solid #f4f4f9', cursor: 'pointer', background: '#fff' }}
                >
                  <strong>{user.username}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '8px 15px', fontSize: '11px', color: '#888', background: '#f8f9fa' }}>Recent Conversations</div>
            {Array.isArray(conversations) && conversations.map((convo) => (
              <div 
                key={convo._id} 
                onClick={() => setSelectedUser(convo)}
                style={{ 
                  padding: '12px 15px', 
                  borderBottom: '1px solid #eee', 
                  cursor: 'pointer', 
                  background: selectedUser?._id === convo._id ? '#e9ecef' : 'white' 
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '3px' }}>{convo.username}</div>
                <div style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {convo.lastMessage || 'Click to start chatting'}
                </div>
              </div>
            ))}
            {(!Array.isArray(conversations) || conversations.length === 0) && !searchQuery && (
              <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginTop: '30px' }}>No chats yet. Search a username above!</p>
            )}
          </div>

          <div style={{ padding: '10px', fontSize: '12px', color: '#666', borderTop: '1px solid #ddd', textAlign: 'center' }}>
            Logged in as: <strong>{username}</strong>
          </div>
        </div>

        {/* Main Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          {selectedUser ? (
            <>
              <div style={{ padding: '15px 20px', background: '#f8f9fa', borderBottom: '1px solid #ddd' }}>
                <h3 style={{ margin: 0 }}>{selectedUser.username}</h3>
              </div>

              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f4f4f9' }}>
                {Array.isArray(chatLog) && chatLog.map((chat, index) => {
                  const isMe = String(chat.sender) === String(userId);
                  return (
                    <div 
                      key={index} 
                      style={{ 
                        background: isMe ? '#dcf8c6' : 'white', 
                        padding: '10px 15px', 
                        borderRadius: '8px', 
                        maxWidth: '60%', 
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ fontSize: '14px', color: '#333', wordBreak: 'break-word' }}>{chat.message}</div>
                      <div style={{ fontSize: '10px', color: '#888', textAlign: 'right', marginTop: '3px' }}>
                        {new Date(chat.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendMessage} style={{ display: 'flex', padding: '15px', background: 'white', borderTop: '1px solid #ddd' }}>
                <input 
                  type="text" 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  placeholder={`Message ${selectedUser.username}...`} 
                  style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginRight: '10px', outline: 'none' }}
                />
                <button 
                  type="submit" 
                  style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888' }}>
              <h3>Select a chat from the sidebar or search a user</h3>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial', background: '#f4f4f9' }}>
      <form onSubmit={handleAuthSubmit} style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', width: '300px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{isLogin ? 'Login' : 'Sign Up'}</h2>

        {error && <p style={{ color: 'red', fontSize: '14px', textAlign: 'center' }}>{error}</p>}
        {successMessage && <p style={{ color: 'green', fontSize: '14px', textAlign: 'center' }}>{successMessage}</p>}

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button 
          type="submit" 
          style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isLogin ? 'Login' : 'Sign Up'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMessage(''); }} 
            style={{ color: '#007bff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </form>
    </div>
  );
}

export default App;