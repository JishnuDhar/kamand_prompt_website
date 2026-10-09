import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Bot, User, Sparkles, RefreshCw, ArrowLeft, Clipboard } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('guest-session');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const resolveUserSession = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('userId');

        if (urlUserId) {
          localStorage.setItem('userId', urlUserId);
          return urlUserId;
        }

        const localUserId = localStorage.getItem('userId');
        if (localUserId) return localUserId;

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

  useEffect(() => {
    if (!sessionId || sessionId === 'guest-session') return;

    axios.get(`/api/chat/${sessionId}`)
      .then(res => setMessages(res.data || []))
      .catch(err => console.error('Error fetching chat history:', err));
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(prev => prev + text);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      alert('Clipboard permission denied or unavailable. Please use Ctrl+V/Cmd+V instead.');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setLoading(true);

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
    <div className="flex flex-col h-screen w-full bg-[#0a0508] text-[#ffe6fa] font-sans antialiased selection:bg-[#ff00bf] selection:text-[#ffe6fa]">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#140a12]/90 backdrop-blur-md border-b border-[#3b1832] sticky top-0 z-10 shadow-md">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <a
            href="http://localhost:5173"
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-[#1f0f1c] hover:bg-[#3b1832] text-[#d0a3c7] hover:text-[#ffe6fa] rounded-lg text-xs font-medium border border-[#3b1832] transition-all shadow-sm"
            title="Return to Main Chat"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#ff80df]" />
            <span className="hidden xs:inline">Main Chat</span>
          </a>

          <div className="h-5 w-px bg-[#3b1832]" />

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-2 bg-gradient-to-br from-[#ff00bf] to-[#5c0044] rounded-xl shadow-md shadow-[#ff00bf]/40 border border-[#ff00bf]/50">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffe6fa]" />
            </div>
            <div>
              <h1 className="font-semibold text-sm sm:text-base tracking-wide text-[#ffe6fa] flex items-center gap-1.5 sm:gap-2">
                  RIZZ AI <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff80df] animate-pulse" />
              </h1>
              <p className="text-[11px] sm:text-xs text-[#d0a3c7]">
                User ID: <span className="text-[#ff80df] font-mono font-medium">{sessionId}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 bg-[#1f0f1c] border border-[#3b1832] rounded-full">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ea043] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2ea043]"></span>
          </span>
          <span className="text-[11px] sm:text-xs text-[#d0a3c7] font-medium">Online</span>
        </div>
      </header>

      {/* Main Chat Stream */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#d0a3c7] space-y-4 my-auto py-16">
            <div className="p-4 bg-[#140a12] rounded-2xl border border-[#3b1832] shadow-inner">
              <Bot className="w-12 h-12 text-[#ff80df]" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[#ffe6fa]">How can I assist you today?</h2>
              <p className="text-sm text-[#d0a3c7] max-w-sm mt-1.5 leading-relaxed">
                Ask a question, request code snippets, or start a context-aware conversation.
              </p>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 sm:gap-3 ${
              m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`p-2 rounded-xl flex items-center justify-center shrink-0 border ${
                m.sender === 'user'
                  ? 'bg-[#ff00bf] text-[#ffe6fa] border-[#ff00bf] shadow-md shadow-[#ff00bf]/40'
                  : 'bg-[#140a12] text-[#ff80df] border-[#3b1832]'
              }`}
            >
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[82%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                m.sender === 'user'
                  ? 'bg-gradient-to-r from-[#ff00bf] to-[#a3007a] text-[#ffe6fa] rounded-tr-none border border-[#ff00bf]/60 shadow-[0_0_15px_rgba(255,0,191,0.4)]'
                  : 'bg-[#140a12] text-[#ffe6fa] border border-[#3b1832] rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#140a12] text-[#ff80df] border border-[#3b1832]">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#140a12] border border-[#3b1832] rounded-2xl rounded-tl-none px-4 py-3 text-[#d0a3c7] text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#ff80df]" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Prompt Bar */}
      <footer className="p-3 sm:p-4 bg-[#140a12] border-t border-[#3b1832]">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex items-center gap-2.5 sm:gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your prompt..."
            disabled={loading}
            className="flex-1 bg-[#0a0508] border border-[#3b1832] text-[#ffe6fa] placeholder-[#d0a3c7]/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff00bf]/50 focus:border-[#ff00bf] transition-all disabled:opacity-50 shadow-inner"
          />
          
          {/* Paste Button */}
          <button
            type="button"
            onClick={handlePaste}
            disabled={loading}
            className="p-3 bg-[#1f0f1c] text-[#d0a3c7] hover:text-[#ffe6fa] rounded-xl hover:bg-[#3b1832] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-[#3b1832] shrink-0"
            title="Paste from clipboard"
          >
            <Clipboard className="w-4 h-4 text-[#ff80df]" />
          </button>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-[#ff00bf] text-[#ffe6fa] rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#ff00bf]/40 border border-[#ff00bf]/60 shrink-0"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}