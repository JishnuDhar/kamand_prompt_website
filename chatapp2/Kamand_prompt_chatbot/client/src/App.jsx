import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const BACKEND_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : 'https://kamand-prompt-chatbot-backend.onrender.com';

const LLM_APP_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5174'
  : 'https://your-llm-chat-app.netlify.app';

const socket = io(BACKEND_URL);

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  
  // Image handling state & refs
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Voice recording state & refs
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);

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

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned HTML instead of JSON. Check if your backend server is running on port 5000.");
      }

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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioPreview(reader.result);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if ((message.trim() !== '' || imagePreview || audioPreview) && selectedUser) {
      const messageData = {
        senderId: userId,
        recipientId: selectedUser._id,
        message: message,
        imageUrl: imagePreview || '',
        audioUrl: audioPreview || ''
      };

      socket.emit('send_private_message', messageData);

      setConversations((prevConvos) => {
        const existingIndex = prevConvos.findIndex(c => c._id === selectedUser._id);
        const updatedConvo = {
          _id: selectedUser._id,
          username: selectedUser.username,
          lastMessage: message || (audioPreview ? '[Voice Note]' : '[Image attachment]'),
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
      setImagePreview(null);
      setAudioPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (token) {
    return (
      <div className="chat-layout" onClick={() => setActiveMenuIndex(null)}>
        {isSidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
        )}

        <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
          <header className="sidebar-header">
            <h3>Chats</h3>
            
            <div className="header-actions">
              <a
                href={`${LLM_APP_URL}?userId=${userId}`}
                className="ai-chat-btn"
                title="Switch to Gemini AI Assistant"
              >
                AI Chat
              </a>

              <button 
                onClick={() => {
                  localStorage.clear();
                  setToken('');
                  setUserId('');
                }}
                className="logout-btn"
              >
                Logout
              </button>
            </div>
          </header>

          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search username..." 
              value={searchQuery}
              onChange={handleSearch}
              className="chat-input-field"
            />
          </div>

          {searchQuery && (
            <div className="search-results">
              <div className="section-label">Search Results</div>
              {Array.isArray(searchResults) && searchResults.map((user) => (
                <div 
                  key={user._id} 
                  onClick={() => {
                    setSelectedUser(user);
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsSidebarOpen(false);
                    if (!conversations.some(c => c._id === user._id)) {
                      setConversations([{ _id: user._id, username: user.username, lastMessage: '' }, ...conversations]);
                    }
                  }}
                  className="user-item"
                >
                  <strong>{user.username}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="conversations-list">
            <div className="section-label">Recent Conversations</div>
            {Array.isArray(conversations) && conversations.map((convo) => (
              <div 
                key={convo._id} 
                onClick={() => {
                  setSelectedUser(convo);
                  setIsSidebarOpen(false);
                }}
                className={`convo-item ${selectedUser?._id === convo._id ? 'active' : ''}`}
              >
                <div className="convo-username">{convo.username}</div>
                <div className="convo-last-msg">
                  {convo.lastMessage || 'Click to start chatting'}
                </div>
              </div>
            ))}
            {(!Array.isArray(conversations) || conversations.length === 0) && !searchQuery && (
              <p className="empty-state-text">No chats yet. Search a username above!</p>
            )}
          </div>

          <footer className="user-footer">
            Logged in as: <strong>{username}</strong>
          </footer>
        </aside>

        <main className="main-chat-area">
          {selectedUser ? (
            <>
              <header className="chat-header">
                <button 
                  className="hamburger-btn" 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  aria-label="Toggle Menu"
                >
                  ☰
                </button>
                <h3>{selectedUser.username}</h3>
              </header>

              <div className="chat-messages">
                {Array.isArray(chatLog) && chatLog.map((chat, index) => {
                  const isMe = String(chat.sender) === String(userId);
                  const isHatBc = chat.message && chat.message.trim().toLowerCase() === 'hat bc';
                  const hasText = chat.message && chat.message.trim().length > 0;
                  
                  return (
                    <div 
                      key={index} 
                      className={`message-bubble-wrapper ${isMe ? 'outgoing-wrapper' : 'incoming-wrapper'}`}
                    >
                      {!isMe && hasText && (
                        <div className="external-menu-wrapper">
                          <button 
                            className="options-dots-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuIndex(activeMenuIndex === index ? null : index);
                            }}
                            title="Options"
                          >
                            ⋮
                          </button>

                          {activeMenuIndex === index && (
                            <div className="message-dropdown-menu">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(chat.message);
                                  setActiveMenuIndex(null);
                                }}
                              >
                                📋 Copy Text
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`message-bubble ${isMe ? 'outgoing' : 'incoming'} ${isHatBc ? 'orange-bubble' : ''}`}>
                        {chat.imageUrl && (
                          <img src={chat.imageUrl} alt="attachment" className="chat-image-attachment" />
                        )}
                        {chat.audioUrl && (
                          <audio controls src={chat.audioUrl} className="chat-audio-attachment" />
                        )}
                        {chat.message && (
                          <div className="message-content">
                            {chat.message}
                          </div>
                        )}
                        <div className="message-time">
                          {new Date(chat.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {imagePreview && (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Upload preview" className="preview-thumbnail" />
                  <button 
                    type="button" 
                    onClick={() => {
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }} 
                    className="remove-preview-btn"
                  >
                    ✕
                  </button>
                </div>
              )}

              {audioPreview && (
                <div className="image-preview-container">
                  <audio controls src={audioPreview} className="preview-audio" />
                  <button 
                    type="button" 
                    onClick={() => setAudioPreview(null)} 
                    className="remove-preview-btn"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={sendMessage} className="chat-input-container">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect} 
                  style={{ display: 'none' }} 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="attach-btn"
                  title="Attach Photo"
                >
                  📷
                </button>

                {!isRecording ? (
                  <button 
                    type="button" 
                    onClick={startRecording} 
                    className="attach-btn"
                    title="Record Voice Note"
                  >
                    🎙️
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={stopRecording} 
                    className="attach-btn recording-active"
                    title="Stop Recording"
                  >
                    ⏹️ Recording...
                  </button>
                )}

                <input 
                  type="text" 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  placeholder={`Message ${selectedUser.username}...`} 
                  className="chat-input-field"
                />
                <button 
                  type="submit" 
                  className="primary-btn"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <button 
                className="hamburger-btn mobile-only-hamburger" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                ☰ Open Chats
              </button>
              <h3>Select a chat from the sidebar or search a user</h3>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <h1 className="app-title">RIZZAI</h1>

        <form onSubmit={handleAuthSubmit} className="auth-card">
          <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>

          {error && <p className="status-msg error">{error}</p>}
          {successMessage && <p className="status-msg success">{successMessage}</p>}

          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              className="chat-input-field"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="chat-input-field"
            />
          </div>

          <button 
            type="submit" 
            className="primary-btn full-width"
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>

          <p className="auth-toggle">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span 
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMessage(''); }} 
            >
              {isLogin ? 'Sign Up' : 'Login'}
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default App;