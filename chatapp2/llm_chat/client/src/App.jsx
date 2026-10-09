import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Bot, User, Sparkles, RefreshCw, ArrowLeft } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('guest-session');
  const messagesEndRef = useRef(null);

  // 1. Resolve User ID from URL search params or local storage
  useEffect(() => {
    const resolveUserSession = () => {
      try {
        // Read from URL query param (?userId=xxx) passed from port 5173
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');

        if (urlUserId) {
          localStorage.setItem('userId', urlUserId);
          return urlUserId;
        }

        // Fallback to local storage if refreshed directly on port 5174
        const localUserId = localStorage.getItem('userId');
        if (localUserId) return localUserId;

        // Fallback to object stored under 'user' key
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed._id || parsed.id || parsed.username) {
            return parsed._id || parsed.id || parsed.username;
          }
        }
      } catch (err) {
        console.error('Error resolving user session:', err);
      }
      return 'guest-session';
    };

    setSessionId(resolveUserSession());
  }, []);

  // 2. Fetch history for the specific logged-in user
  useEffect(() => {
    if (!sessionId || sessionId === 'guest-session') return;

    axios.get(`/api/chat/${sessionId}`)
      .then(res => setMessages(res.data || []))
      .catch(err => console.error('Error fetching chat history:', err));
  }, [sessionId]);

  // Smooth scroll to bottom when a new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setLoading(true);

    // Optimistically update UI
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);

    try {
      const res = await axios.post('/api/chat', {
        sessionId: sessionId,
        userId: sessionId,
        message: userText
      });
      if (res.data && res.data.messages) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => [
        ...prev,
        { sender: 'model', text: '⚠️ Connection error. Please check your backend server logs.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          {/* Link back to Main Chat App */}
          <a
            href="http://localhost:5173"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700/60 transition-all shadow-sm"
            title="Return to Main Chat"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Main Chat</span>
          </a>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-xl shadow-lg shadow-cyan-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-wide text-slate-100 flex items-center gap-2">
                Gemini AI Chat <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              </h1>
              <p className="text-xs text-slate-400">
                User ID: <span className="text-cyan-400 font-mono font-medium">{sessionId}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-slate-400 font-medium">Online</span>
        </div>
      </header>

      {/* Main Chat Stream */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full space-y-6">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-4 my-auto py-16">
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
              <Bot className="w-12 h-12 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-slate-200">How can I assist you today?</h2>
              <p className="text-sm text-slate-400 max-w-sm mt-1">
                Ask a question, request code snippets, or start a context-aware conversation.
              </p>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${
              m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                m.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-cyan-400 border border-slate-700/60'
              }`}
            >
              {m.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                m.sender === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-tr-none'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-800/80 rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-cyan-400 border border-slate-700/60">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 text-slate-400 text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Prompt Bar */}
      <footer className="p-4 bg-slate-900/40 border-t border-slate-800/80">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your prompt..."
            disabled={loading}
            className="flex-1 bg-slate-900/90 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-cyan-500/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>
    </div>
  );
}